import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

import { AppError, normalizeError } from "./errors.js";
import { MetricsRegistry } from "./metrics.js";

// 工作台模板卡片直接复用 dome.pptx 提取出的封面图，让用户选模板时看到真实帆船红金视觉。
const DOME_TEMPLATE_THUMBNAIL = readFileSync(new URL("../../templates/official/dome/assets/dome-cover.jpg", import.meta.url)).toString("base64");
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const MAX_TEMPLATE_UPLOAD_JSON_BODY_BYTES = 30 * 1024 * 1024;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Creates the HTTP API application.
 * @param {object} dependencies
 * @returns {import("node:http").Server}
 */
export function createApp(dependencies) {
  const sessions = new Map();
  const rateLimitBuckets = new Map();
  const metrics = dependencies.metrics || new MetricsRegistry();
  const sessionCookieName = dependencies.sessionCookieName || "ppt_ai_session";
  const sessionTtlMs = dependencies.sessionTtlMs || DEFAULT_SESSION_TTL_MS;
  const sessionCookieSecure = dependencies.sessionCookieSecure === true;
  const rateLimit = dependencies.rateLimit || { maxRequests: 120, windowMs: 60_000 };

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    let route = "unmatched";
    let url;
    response.setHeader("X-Request-Id", requestId);
    try {
      url = new URL(request.url, "http://127.0.0.1");
      route = routeForMetrics(url.pathname);

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, { status: "ok" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/metrics") {
        response.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
        response.end(metrics.renderPrometheus());
        return;
      }

      if (request.method === "POST" && url.pathname === "/internal/reconcile") {
        requireInternalToken(request, dependencies.internalToken);
        const body = await readJson(request);
        const result = await dependencies.pptService.reconcileBillingEvents({ limit: body.limit });
        sendJson(response, { result });
        return;
      }

      if (request.method === "GET" && isLaunchRequest(url)) {
        const ticket = url.searchParams.get("ticket");
        if (!ticket) throw new AppError({ code: "MISSING_TICKET", status: 400, message: "Missing launch ticket" });
        const identity = await dependencies.molingClient.verifyLaunchTicket(ticket);
        validateMolingIdentity({
          identity,
          expectedAppId: dependencies.expectedAppId,
          expectedProductId: dependencies.expectedProductId,
        });
        const entitlementId = await resolveSessionEntitlementId({
          identity,
          configuredDefault: dependencies.defaultEntitlementId,
          userEntitlementMap: dependencies.userEntitlementMap,
          molingClient: dependencies.molingClient,
          logger: dependencies.logger,
        });
        await persistLaunchUser({ database: dependencies.database, identity });
        const sessionId = randomUUID();
        const session = {
          id: sessionId,
          identity,
          entitlementId,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
        };
        sessions.set(sessionId, session);
        await dependencies.database.insert("sessions", session);
        response.writeHead(302, {
          "Set-Cookie": buildSessionCookie({
            name: sessionCookieName,
            value: sessionId,
            maxAgeSeconds: Math.floor(sessionTtlMs / 1000),
            secure: sessionCookieSecure,
          }),
          Location: "/",
        });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/files\/[^/]+$/) && url.searchParams.has("download_token")) {
        const token = verifyDownloadToken({
          token: url.searchParams.get("download_token"),
          secret: dependencies.internalToken,
        });
        const fileId = url.pathname.split("/")[3];
        if (token.fileId !== fileId) {
          throw new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
        }
        const downloaded = await dependencies.storage.download({ fileId, ownerUserId: token.ownerUserId });
        await sendFileDownload({ response, database: dependencies.database, ownerUserId: token.ownerUserId, downloaded });
        return;
      }

      const session = await requireSession(request, sessions, sessionCookieName, dependencies.database);
      const ownerUserId = Number(session.identity.user_id);
      const sessionEntitlementId = session.entitlementId || dependencies.defaultEntitlementId;
      enforceUserRateLimit({ buckets: rateLimitBuckets, rateLimit, ownerUserId });

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderWorkspace({ defaultEntitlementId: sessionEntitlementId }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        sendJson(response, {
          user: {
            user_id: ownerUserId,
            role: "user",
            entitlement_id: sessionEntitlementId,
          },
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/templates") {
        const templates = dependencies.templateManager.listTemplates({
          ownerUserId,
          categoryId: url.searchParams.get("category_id") || undefined,
        });
        sendJson(response, {
          templates: templates.map(withTemplateThumbnailUrl),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/template-categories") {
        sendJson(response, { categories: dependencies.templateManager.listCategories() });
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/templates\/[^/]+\/thumbnail$/)) {
        const templateId = decodeURIComponent(url.pathname.split("/")[3]);
        const downloaded = await downloadTemplateThumbnail({
          templateManager: dependencies.templateManager,
          storage: dependencies.storage,
          ownerUserId,
          templateId,
        });
        sendInlineFile(response, downloaded);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/templates/personal") {
        const body = await readJson(request, { maxBytes: MAX_TEMPLATE_UPLOAD_JSON_BODY_BYTES });
        const template = await dependencies.personalTemplateService.createFromPptx({
          ownerUserId,
          fileName: body.file_name,
          name: body.name,
          content: decodeBase64Content(body.content_base64),
        });
        sendJson(response, { template }, 201);
        return;
      }

      if (request.method === "DELETE" && url.pathname.match(/^\/api\/templates\/[^/]+$/)) {
        const templateId = url.pathname.split("/")[3];
        const template = await dependencies.personalTemplateService.deleteTemplate({ ownerUserId, templateId });
        sendJson(response, { template });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/billing/balance") {
        const entitlementId = resolveEntitlementId(url.searchParams.get("entitlement_id"), sessionEntitlementId);
        const balance = await dependencies.billingClient.getBalance({ userId: ownerUserId, entitlementId });
        sendJson(response, { entitlement_id: Number(entitlementId), balance });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/files") {
        const body = await readJson(request);
        const file = await dependencies.storage.upload({
          ownerUserId,
          fileName: body.file_name,
          mimeType: body.mime_type,
          content: decodeBase64Content(body.content_base64),
        });
        sendJson(response, { file }, 201);
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/files\/[^/]+\/download-url$/)) {
        const fileId = url.pathname.split("/")[3];
        await dependencies.storage.download({ fileId, ownerUserId });
        const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MS).toISOString();
        const token = signDownloadToken({
          fileId,
          ownerUserId,
          expiresAt,
          secret: dependencies.internalToken,
        });
        response.setHeader("Cache-Control", "no-store");
        sendJson(response, {
          url: `/api/files/${fileId}?download_token=${encodeURIComponent(token)}`,
          expires_at: expiresAt,
        });
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/files\/[^/]+$/)) {
        const fileId = url.pathname.split("/")[3];
        const downloaded = await dependencies.storage.download({ fileId, ownerUserId });
        await sendFileDownload({ response, database: dependencies.database, ownerUserId, downloaded });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/tasks") {
        const body = await readJson(request);
        const task = await dependencies.taskCenter.createTask({
          ownerUserId,
          type: body.type,
          input: body.input || {},
        });
        sendJson(response, { task }, 201);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/tasks/")) {
        const taskId = url.pathname.split("/")[3];
        const task = await dependencies.taskCenter.getTask(taskId, ownerUserId);
        sendJson(response, { task });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ppt/outlines") {
        const body = await readJson(request);
        const outline = await dependencies.pptService.generateOutline({
          ownerUserId,
          topic: body.topic,
          sourceFileId: body.source_file_id,
          slideCount: body.slide_count,
          templateId: body.template_id,
          theme: body.theme,
        });
        sendJson(response, { outline }, 201);
        return;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/ppt/outlines/")) {
        const outlineId = url.pathname.split("/")[4];
        const body = await readJson(request);
        const outline = await dependencies.pptService.updateOutline({
          ownerUserId,
          outlineId,
          slides: body.slides,
        });
        sendJson(response, { outline });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/ppt/assets") {
        const assets = await dependencies.pptService.listAssets({ ownerUserId });
        sendJson(response, { assets });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ppt/generated-images") {
        const body = await readJson(request);
        const result = await dependencies.imageGenerationService.generateImageAsset({
          ownerUserId,
          topic: body.topic,
          kind: body.kind,
          templateId: body.template_id,
          theme: body.theme,
        });
        sendJson(response, result, 201);
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/ppt\/assets\/[^/]+$/)) {
        const assetId = url.pathname.split("/")[4];
        const result = await dependencies.pptService.getAsset({ ownerUserId, assetId });
        sendJson(response, result);
        return;
      }

      if (request.method === "DELETE" && url.pathname.match(/^\/api\/ppt\/assets\/[^/]+$/)) {
        const assetId = url.pathname.split("/")[4];
        const asset = await dependencies.pptService.deleteAsset({ ownerUserId, assetId });
        sendJson(response, { asset });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ppt/decks") {
        const body = await readJson(request);
        const result = await dependencies.pptService.generateDeck({
          ownerUserId,
          outlineId: body.outline_id,
          templateId: body.template_id,
          theme: body.theme,
          entitlementId: resolveEntitlementId(body.entitlement_id, sessionEntitlementId),
        });
        sendJson(response, result, 201);
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/ppt\/decks\/[^/]+\/preview$/)) {
        const deckId = url.pathname.split("/")[4];
        const html = await dependencies.pptService.previewDeck({ ownerUserId, deckId });
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (request.method === "POST" && url.pathname.match(/^\/api\/ppt\/decks\/[^/]+\/exports$/)) {
        const deckId = url.pathname.split("/")[4];
        const body = await readJson(request);
        const result = await dependencies.pptService.exportDeck({
          ownerUserId,
          deckId,
          format: body.format,
        });
        sendJson(response, result, 201);
        return;
      }

      if (request.method === "POST" && url.pathname.match(/^\/api\/ppt\/decks\/[^/]+\/slides\/[^/]+\/regenerate$/)) {
        const parts = url.pathname.split("/");
        const body = await readJson(request);
        const result = await dependencies.pptService.regenerateSlide({
          ownerUserId,
          deckId: parts[4],
          slideId: parts[6],
          instruction: body.instruction,
          entitlementId: resolveEntitlementId(body.entitlement_id, sessionEntitlementId),
        });
        sendJson(response, result);
        return;
      }

      if (request.method === "GET" && url.pathname.match(/^\/api\/ppt\/tasks\/[^/]+$/)) {
        const taskId = url.pathname.split("/")[4];
        const task = await dependencies.pptService.getGenerationTask({ ownerUserId, taskId });
        sendJson(response, { task });
        return;
      }

      if (request.method === "POST" && url.pathname.match(/^\/api\/ppt\/tasks\/[^/]+\/retry$/)) {
        const taskId = url.pathname.split("/")[4];
        const body = await readJson(request);
        const result = await dependencies.pptService.retryTask({
          ownerUserId,
          taskId,
          entitlementId: resolveEntitlementId(body.entitlement_id, sessionEntitlementId),
        });
        sendJson(response, result, 201);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/logs") {
        const logs = await dependencies.pptService.listLogs({ ownerUserId });
        sendJson(response, { logs });
        return;
      }

      throw new AppError({ code: "NOT_FOUND", status: 404, message: "Not found" });
    } catch (error) {
      const appError = normalizeError(error);
      dependencies.logger?.error?.("request_failed", {
        request_id: requestId,
        method: request.method,
        url: redactRequestUrl(request.url),
        code: appError.code,
        message: appError.message,
        cause: error instanceof Error ? error.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      sendJson(response, appError.toJSON(requestId), appError.status);
    } finally {
      const status = response.statusCode || 500;
      const latencyMs = Date.now() - startedAt;
      metrics.increment("http_requests_total", { route, status });
      metrics.observe("http_request_duration_ms", { route, status }, latencyMs);
      if (status >= 500) metrics.increment("alerts_total", { type: "http_5xx", route });
      dependencies.logger?.info?.("request_completed", {
        requestId,
        method: request.method,
        route,
        status,
        latencyMs,
        url: redactRequestUrl(url ? `${url.pathname}${url.search}` : request.url),
      });
    }
  });
}

/**
 * Redacts sensitive query parameters before structured request logging.
 * @param {string | undefined} requestUrl
 * @returns {string}
 */
function redactRequestUrl(requestUrl) {
  const parsed = new URL(requestUrl || "/", "http://127.0.0.1");
  for (const name of ["ticket", "download_token"]) {
    if (parsed.searchParams.has(name)) parsed.searchParams.set(name, "REDACTED");
  }
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * Normalizes dynamic paths so metrics cardinality remains bounded.
 * @param {string} pathName
 * @returns {string}
 */
function routeForMetrics(pathName) {
  if (pathName === "/") return "/";
  if (pathName === "/metrics") return "/metrics";
  if (pathName === "/api/health") return "/api/health";
  if (pathName === "/api/me") return "/api/me";
  if (pathName === "/api/templates") return "/api/templates";
  if (pathName === "/api/templates/personal") return "/api/templates/personal";
  if (pathName === "/api/template-categories") return "/api/template-categories";
  if (pathName === "/api/billing/balance") return "/api/billing/balance";
  if (pathName === "/api/files") return "/api/files";
  if (pathName === "/api/tasks") return "/api/tasks";
  if (pathName === "/api/ppt/outlines") return "/api/ppt/outlines";
  if (pathName === "/api/ppt/assets") return "/api/ppt/assets";
  if (pathName === "/api/ppt/generated-images") return "/api/ppt/generated-images";
  if (pathName === "/api/ppt/decks") return "/api/ppt/decks";
  if (pathName === "/api/logs") return "/api/logs";
  if (pathName === "/internal/reconcile") return "/internal/reconcile";
  if (pathName === "/enter" || pathName === "/auth/launch") return pathName;
  return pathName
    .replace(/^\/api\/files\/[^/]+\/download-url$/, "/api/files/:id/download-url")
    .replace(/^\/api\/files\/[^/]+$/, "/api/files/:id")
    .replace(/^\/api\/tasks\/[^/]+$/, "/api/tasks/:id")
    .replace(/^\/api\/templates\/[^/]+$/, "/api/templates/:id")
    .replace(/^\/api\/ppt\/outlines\/[^/]+$/, "/api/ppt/outlines/:id")
    .replace(/^\/api\/ppt\/assets\/[^/]+$/, "/api/ppt/assets/:id")
    .replace(/^\/api\/ppt\/decks\/[^/]+\/preview$/, "/api/ppt/decks/:id/preview")
    .replace(/^\/api\/ppt\/decks\/[^/]+\/exports$/, "/api/ppt/decks/:id/exports")
    .replace(/^\/api\/ppt\/decks\/[^/]+\/slides\/[^/]+\/regenerate$/, "/api/ppt/decks/:id/slides/:id/regenerate")
    .replace(/^\/api\/ppt\/tasks\/[^/]+\/retry$/, "/api/ppt/tasks/:id/retry")
    .replace(/^\/api\/ppt\/tasks\/[^/]+$/, "/api/ppt/tasks/:id");
}

/**
 * Enforces a fixed-window per-user request limit.
 * @param {{buckets: Map<string, object>, rateLimit: {maxRequests: number, windowMs: number}, ownerUserId: number}} input
 * @returns {void}
 */
function enforceUserRateLimit({ buckets, rateLimit, ownerUserId }) {
  const maxRequests = Number(rateLimit?.maxRequests);
  const windowMs = Number(rateLimit?.windowMs);
  if (!Number.isInteger(maxRequests) || maxRequests <= 0 || !Number.isInteger(windowMs) || windowMs <= 0) return;
  const key = String(ownerUserId);
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > maxRequests) {
    throw new AppError({
      code: "RATE_LIMIT_EXCEEDED",
      status: 429,
      message: "Rate limit exceeded",
      publicDetails: { limit: maxRequests, window_ms: windowMs, reset_at: new Date(current.resetAt).toISOString() },
    });
  }
}

/**
 * Sends a downloaded file and records the user-visible audit log.
 * @param {{response: import("node:http").ServerResponse, database: object, ownerUserId: number, downloaded: {file: object, content: Buffer}}} input
 * @returns {Promise<void>}
 */
async function sendFileDownload({ response, database, ownerUserId, downloaded }) {
  await recordFileDownload({ database, ownerUserId, file: downloaded.file });
  response.writeHead(200, {
    "Content-Type": downloaded.file.mimeType,
    "Content-Disposition": `attachment; filename="${headerSafeFileName(downloaded.file.fileName)}"`,
    "Cache-Control": "no-store",
  });
  response.end(downloaded.content);
}

/**
 * Sends an inline image/file response for UI assets such as template thumbnails.
 * @param {import("node:http").ServerResponse} response
 * @param {{file: object, content: Buffer}} downloaded
 * @returns {void}
 */
function sendInlineFile(response, downloaded) {
  response.writeHead(200, {
    "Content-Type": downloaded.file.mimeType,
    "Content-Disposition": `inline; filename="${headerSafeFileName(downloaded.file.fileName)}"`,
    "Cache-Control": "private, max-age=300",
  });
  response.end(downloaded.content);
}

/**
 * Adds the authenticated thumbnail endpoint to template API records.
 * @param {object} template
 * @returns {object}
 */
function withTemplateThumbnailUrl(template) {
  if (!template.thumbnailFileId) return template;
  return {
    ...template,
    thumbnailUrl: `/api/templates/${encodeURIComponent(template.id)}/thumbnail`,
  };
}

/**
 * Downloads a template thumbnail after confirming the current user can see that template.
 * 官方模板文件归属系统用户 0，个人模板仍按当前用户校验，避免用户越权读取他人模板缩略图。
 * @param {{templateManager: object, storage: object, ownerUserId: number, templateId: string}} input
 * @returns {Promise<{file: object, content: Buffer}>}
 */
async function downloadTemplateThumbnail({ templateManager, storage, ownerUserId, templateId }) {
  const template = templateManager.getTemplate(templateId, { ownerUserId });
  if (!template.thumbnailFileId) throw new AppError({ code: "TEMPLATE_THUMBNAIL_NOT_FOUND", status: 404, message: "Template thumbnail not found" });
  const fileOwnerUserId = template.scope === "official" ? 0 : ownerUserId;
  return storage.download({ fileId: template.thumbnailFileId, ownerUserId: fileOwnerUserId });
}

/**
 * Signs a short-lived file download token.
 * @param {{fileId: string, ownerUserId: number, expiresAt: string, secret: string | undefined}} input
 * @returns {string}
 */
function signDownloadToken({ fileId, ownerUserId, expiresAt, secret }) {
  if (!secret) throw new AppError({ code: "DOWNLOAD_TOKEN_SECRET_REQUIRED", status: 500, message: "Download token secret is not configured" });
  const payload = Buffer.from(JSON.stringify({ fileId, ownerUserId, exp: Date.parse(expiresAt) }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies a short-lived file download token.
 * @param {{token: string | null, secret: string | undefined}} input
 * @returns {{fileId: string, ownerUserId: number}}
 */
function verifyDownloadToken({ token, secret }) {
  if (!secret) throw new AppError({ code: "DOWNLOAD_TOKEN_SECRET_REQUIRED", status: 500, message: "Download token secret is not configured" });
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || !isValidSignature({ payload, signature, secret })) {
    throw new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
  }
  if (!parsed.fileId || !Number.isInteger(Number(parsed.ownerUserId)) || Number(parsed.exp) <= Date.now()) {
    throw new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
  }
  return { fileId: parsed.fileId, ownerUserId: Number(parsed.ownerUserId) };
}

/**
 * Compares HMAC signatures without leaking timing details.
 * @param {{payload: string, signature: string, secret: string}} input
 * @returns {boolean}
 */
function isValidSignature({ payload, signature, secret }) {
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Returns true when the request is a Moling SSO launch callback.
 * @param {URL} url
 * @returns {boolean}
 */
function isLaunchRequest(url) {
  return url.pathname === "/enter"
    || url.pathname === "/auth/launch"
    || (url.pathname === "/" && url.searchParams.has("ticket"));
}

/**
 * Builds the application session cookie header.
 * @param {{name: string, value: string, maxAgeSeconds: number, secure: boolean}} input
 * @returns {string}
 */
function buildSessionCookie({ name, value, maxAgeSeconds, secure }) {
  return [
    `${name}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

/**
 * Resolves the current user's entitlement from Moling launch identity.
 * @param {{identity: object, configuredDefault?: number, userEntitlementMap?: Map<number, number>, molingClient?: object, logger?: object}} input
 * @returns {Promise<number | undefined>}
 */
async function resolveSessionEntitlementId({ identity, configuredDefault, userEntitlementMap, molingClient, logger }) {
  const launchEntitlementId = readPositiveId(identity.entitlement_id)
    || readPositiveId(identity.entitlementId)
    || readPositiveId(identity.default_entitlement_id)
    || readPositiveId(identity.defaultEntitlementId)
    || readPositiveId(identity.entitlement?.entitlement_id)
    || readPositiveId(identity.entitlement?.entitlementId)
    || readPositiveId(identity.entitlement?.id)
    || readEntitlementList(identity.entitlements, identity.product_id)
    || readEntitlementList(identity.entitlements, identity.productId);
  if (launchEntitlementId) return launchEntitlementId;

  const userId = readPositiveId(identity.user_id) || readPositiveId(identity.userId);
  const productId = readPositiveId(identity.product_id) || readPositiveId(identity.productId);
  if (userId && productId && typeof molingClient?.listUserEntitlements === "function") {
    try {
      const result = await molingClient.listUserEntitlements({ userId, productId });
      const resolved = readEntitlementList(result?.entitlements, productId);
      if (resolved) return resolved;
    } catch (error) {
      logger?.warn?.("entitlement_lookup_failed", {
        user_id: userId,
        product_id: productId,
        error: error.message,
      });
    }
  }

  const mapped = readPositiveId(userEntitlementMap?.get?.(userId));
  if (mapped) return mapped;

  return configuredDefault;
}

/**
 * Reads the first active entitlement that belongs to the current product.
 * @param {unknown} entitlements
 * @param {unknown} productId
 * @returns {number | undefined}
 */
function readEntitlementList(entitlements, productId) {
  if (!Array.isArray(entitlements)) return undefined;
  const product = readPositiveId(productId);
  const matched = entitlements.find((item) => {
    if (item.status && item.status !== "active") return false;
    if (item.usable === false) return false;
    const itemProduct = readPositiveId(item.product_id) || readPositiveId(item.productId);
    return !product || !itemProduct || itemProduct === product;
  });
  return matched
    ? readPositiveId(matched.entitlement_id)
      || readPositiveId(matched.entitlementId)
      || readPositiveId(matched.id)
    : undefined;
}

/**
 * Reads a positive integer ID without throwing on absent values.
 * @param {unknown} value
 * @returns {number | undefined}
 */
function readPositiveId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Resolves and validates the entitlement ID from a request body or configured default.
 * @param {number | string | null | undefined} requested
 * @param {number | undefined} configuredDefault
 * @returns {number}
 */
function resolveEntitlementId(requested, configuredDefault) {
  const value = requested === undefined || requested === null || requested === "" ? configuredDefault : requested;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError({
      code: value === undefined ? "ENTITLEMENT_REQUIRED" : "ENTITLEMENT_INVALID",
      status: 400,
      message: "A positive entitlement_id is required",
    });
  }
  return parsed;
}

/**
 * Escapes text for HTML attributes and content.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Requires a valid application session.
 * @param {import("node:http").IncomingMessage} request
 * @param {Map<string, object>} sessions
 * @param {string} cookieName
 * @param {object} database
 * @returns {object}
 */
async function requireSession(request, sessions, cookieName, database) {
  const sessionId = readCookie(request, cookieName);
  const cachedSession = sessionId ? sessions.get(sessionId) : null;
  if (cachedSession && isSessionActive(cachedSession)) return cachedSession;
  const storedSession = sessionId
    ? await database.findOne("sessions", (item) => item.id === sessionId)
    : null;
  const session = storedSession && isSessionActive(storedSession) ? storedSession : null;
  if (!session) throw new AppError({ code: "UNAUTHORIZED", status: 401, message: "Unauthorized" });
  await assertUserActive({ database, userId: session.identity?.user_id });
  sessions.set(session.id, session);
  return session;
}

/**
 * Checks whether a session is still usable.
 * @param {object} session
 * @returns {boolean}
 */
function isSessionActive(session) {
  const expiresAt = Date.parse(session.expiresAt || "");
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/**
 * Blocks restored sessions for disabled users.
 * @param {{database: object, userId: number | string}} input
 * @returns {Promise<void>}
 */
async function assertUserActive({ database, userId }) {
  try {
    const user = await database.findOne("users", (item) => Number(item.moling_user_id) === Number(userId));
    if (user?.status === "disabled") throw new AppError({ code: "USER_DISABLED", status: 403, message: "User is disabled" });
  } catch (error) {
    if (error?.code === "DATABASE_NOT_INITIALIZED") return;
    throw error;
  }
}

/**
 * Persists the Moling identity as a local user profile when the users collection exists.
 * @param {{database: object, identity: object}} input
 * @returns {Promise<void>}
 */
async function persistLaunchUser({ database, identity }) {
  const molingUserId = Number(identity.user_id);
  if (!Number.isFinite(molingUserId) || molingUserId <= 0) return;
  const profile = {
    moling_user_id: molingUserId,
    display_name: identity.display_name || identity.nickname || identity.name || "",
    avatar_url: identity.avatar_url || identity.avatar || "",
    status: "active",
  };
  try {
    const existing = await database.findOne("users", (user) => Number(user.moling_user_id) === molingUserId);
    if (existing) {
      await database.update("users", existing.id, profile);
      return;
    }
    await database.insert("users", profile);
  } catch (error) {
    if (error?.code !== "DATABASE_NOT_INITIALIZED") throw error;
  }
}

/**
 * Requires the backend internal token for operational endpoints.
 * @param {import("node:http").IncomingMessage} request
 * @param {string | undefined} expectedToken
 * @returns {void}
 */
function requireInternalToken(request, expectedToken) {
  if (!expectedToken) {
    throw new AppError({ code: "INTERNAL_TOKEN_NOT_CONFIGURED", status: 500, message: "Internal token is not configured" });
  }
  if (request.headers["x-internal-token"] !== expectedToken) {
    throw new AppError({ code: "FORBIDDEN", status: 403, message: "Forbidden" });
  }
}

/**
 * Records an owner-scoped file download call log.
 * @param {{database: object, ownerUserId: number, file: object}} input
 * @returns {Promise<void>}
 */
async function recordFileDownload({ database, ownerUserId, file }) {
  await database.insert("call_logs", {
    ownerUserId,
    action: "file_downloaded",
    resourceType: "file",
    resourceId: file.id,
    metadata: { fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
  });
}

/**
 * Produces a safe ASCII filename for Content-Disposition.
 * @param {unknown} value
 * @returns {string}
 */
function headerSafeFileName(value) {
  return String(value || "download").replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Reads one cookie value.
 * @param {import("node:http").IncomingMessage} request
 * @param {string} name
 * @returns {string | null}
 */
function readCookie(request, name) {
  const cookie = request.headers.cookie || "";
  for (const item of cookie.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return null;
}

/**
 * Validates Moling launch identity against configured app and product IDs.
 * @param {{identity: object, expectedAppId?: number, expectedProductId?: number}} input
 * @returns {void}
 */
function validateMolingIdentity({ identity, expectedAppId, expectedProductId }) {
  if (expectedAppId && Number(identity.app_id) !== Number(expectedAppId)) {
    throw new AppError({ code: "APP_MISMATCH", status: 403, message: "APP_MISMATCH: launch ticket belongs to another app" });
  }
  if (expectedProductId && Number(identity.product_id) !== Number(expectedProductId)) {
    throw new AppError({ code: "PRODUCT_MISMATCH", status: 403, message: "PRODUCT_MISMATCH: launch ticket belongs to another product" });
  }
}

/**
 * Reads a JSON request body.
 * @param {import("node:http").IncomingMessage} request
 * @param {{maxBytes?: number}} options
 * @returns {Promise<object>}
 */
async function readJson(request, { maxBytes = MAX_JSON_BODY_BYTES } = {}) {
  const chunks = [];
  let sizeBytes = 0;
  for await (const chunk of request) {
    sizeBytes += chunk.length;
    if (sizeBytes > maxBytes) {
      throw new AppError({
        code: "REQUEST_BODY_TOO_LARGE",
        status: 413,
        message: "Request body is too large",
      });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new AppError({
      code: "REQUEST_JSON_INVALID",
      status: 400,
      message: "Request body must be valid JSON",
      details: error,
    });
  }
}

/**
 * Decodes a canonical base64 request payload.
 * @param {unknown} value
 * @returns {Buffer}
 */
function decodeBase64Content(value) {
  if (typeof value !== "string") {
    throw new AppError({ code: "FILE_CONTENT_INVALID", status: 400, message: "File content is invalid" });
  }
  const normalized = value.trim();
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new AppError({ code: "FILE_CONTENT_INVALID", status: 400, message: "File content is invalid" });
  }
  return Buffer.from(normalized, "base64");
}

/**
 * Sends a JSON response.
 * @param {import("node:http").ServerResponse} response
 * @param {object} payload
 * @param {number} status
 */
function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

/**
 * Sends an HTML response.
 * @param {import("node:http").ServerResponse} response
 * @param {string} html
 * @param {number} status
 */
function sendHtml(response, html, status = 200) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

/**
 * Renders the AI PPT workspace.
 * @returns {string}
 */
function renderWorkspace({ defaultEntitlementId } = {}) {
  const entitlementValue = defaultEntitlementId ? String(defaultEntitlementId) : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI PPT 工作台</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --surface: #ffffff;
      --surface-soft: #f8fafc;
      --line: #dbe4ef;
      --line-strong: #c8d4e3;
      --text: #172033;
      --muted: #64748b;
      --subtle: #8a99ad;
      --primary: #2563eb;
      --primary-strong: #1d4ed8;
      --teal: #0f766e;
      --warning: #b45309;
      --success: #15803d;
      --shadow: 0 18px 46px rgba(23, 32, 51, .08);
      --dome-template-thumb:url("data:image/jpeg;base64,${DOME_TEMPLATE_THUMBNAIL}");
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--text); }
    body::before { content: ""; position: fixed; inset: 0 0 auto; height: 280px; background: linear-gradient(180deg, #eef5ff 0%, rgba(244,247,251,0) 100%); pointer-events: none; }
    header {
      position: sticky; top: 0; z-index: 10;
      min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 18px;
      padding: 14px 28px; background: rgba(255,255,255,.86); border-bottom: 1px solid rgba(219,228,239,.9);
      backdrop-filter: blur(18px);
    }
    h1 { font-size: 20px; line-height: 1.2; margin: 0; letter-spacing: 0; }
    h2 { font-size: 14px; line-height: 1.25; margin: 0; letter-spacing: 0; }
    label { display: block; font-size: 12px; font-weight: 700; color: #42526a; margin: 12px 0 6px; }
    input, textarea, select, button { font: inherit; box-sizing: border-box; }
    input, textarea, select {
      width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 10px 11px;
      background: #fff; color: var(--text); outline: none; transition: border-color .16s ease, box-shadow .16s ease;
    }
    input:focus, textarea:focus, select:focus { border-color: rgba(37,99,235,.72); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    input[type="file"] { padding: 8px; color: var(--muted); font-size: 12px; }
    input[type="file"]::file-selector-button { border: 1px solid #cfe0ff; border-radius: 7px; background: #eef4ff; color: #1d4ed8; padding: 7px 10px; margin-right: 8px; font-weight: 700; cursor: pointer; }
    textarea { min-height: 96px; resize: vertical; line-height: 1.55; }
    button {
      border: 0; border-radius: 8px; padding: 10px 13px; background: var(--primary); color: white;
      cursor: pointer; font-weight: 700; font-size: 13px; transition: transform .12s ease, background .16s ease, box-shadow .16s ease;
    }
    button:hover { background: var(--primary-strong); box-shadow: 0 10px 22px rgba(37,99,235,.18); transform: translateY(-1px); }
    button:disabled { cursor: not-allowed; opacity: .62; transform: none; box-shadow: none; }
    button.secondary { background: #eef4ff; color: #1d4ed8; border: 1px solid #cfe0ff; }
    button.secondary:hover { background: #e2edff; box-shadow: none; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 8px; background: #172033; color: white; font-weight: 800; }
    .brand-subtitle { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .page-nav { display: flex; align-items: center; gap: 6px; padding: 5px; border: 1px solid var(--line); border-radius: 8px; background: #f8fbff; }
    .page-nav button { min-height: 34px; padding: 0 12px; border-radius: 7px; background: transparent; color: var(--muted); box-shadow: none; font-size: 13px; }
    .page-nav button:hover { background: #eef4ff; color: var(--primary); box-shadow: none; transform: none; }
    body[data-workspace-page="create"] [data-page-target="create"],
    body[data-workspace-page="templates"] [data-page-target="templates"],
    body[data-workspace-page="assets"] [data-page-target="assets"],
    body[data-workspace-page="status"] [data-page-target="status"] {
      background: var(--primary); color: #fff;
    }
    .top-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .status-chip { min-height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--muted); font-size: 12px; font-weight: 700; }
    .status-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--success); }
    main { position: relative; display: grid; grid-template-columns: minmax(320px, 390px) minmax(520px, 1fr) minmax(300px, 360px); gap: 18px; padding: 18px; max-width: 1680px; margin: 0 auto; }
    body[data-workspace-page="create"][data-flow-stage="input"] main { grid-template-columns: minmax(320px, 390px) minmax(520px, 1fr); }
    body[data-workspace-page="create"][data-flow-stage="outline"] main { grid-template-columns: minmax(620px, 1fr) minmax(300px, 360px); }
    body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: minmax(300px, 360px) minmax(640px, 1fr) minmax(280px, 340px); }
    body[data-workspace-page="templates"] main { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="templates"] .workflow { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="templates"] .template-gallery-wrap { width: 100%; }
    body[data-workspace-page="templates"] .template-category-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .preview-shell, .outline-shell, .panel { background: rgba(255,255,255,.96); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
    .workflow, .context { display: grid; gap: 14px; align-content: start; }
    .panel { padding: 16px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .panel-title { display: flex; align-items: center; gap: 8px; }
    .step-number { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 8px; background: #eaf2ff; color: var(--primary); font-size: 12px; font-weight: 800; }
    .panel-note { color: var(--muted); font-size: 12px; line-height: 1.5; margin: -4px 0 10px; }
    .hint { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: #6b7280; }
    .hint.warning { color: var(--warning); }
    .flow-guide { display: grid; gap: 8px; margin-bottom: 14px; }
    .flow-step {
      display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: start;
      padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff;
    }
    .flow-step strong { display: block; color: var(--text); font-size: 13px; }
    .flow-step span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .flow-step.is-active { border-color: #bfdbfe; background: #f8fbff; }
    .flow-dot { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px; background: #eaf2ff; color: var(--primary); font-size: 12px; font-weight: 850; }
    .stage-empty { min-height: 520px; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--muted); background: #f8fbff; border: 1px dashed #bfd0e6; border-radius: 8px; }
    .stage-empty strong { display: block; margin-bottom: 8px; color: #1e3a8a; font-size: 22px; }
    .template-gallery-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
    .template-gallery-title { font-size: 12px; color: var(--muted); }
    .template-gallery-count { font-size: 12px; color: #475569; background: #eaf2ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 4px 9px; white-space: nowrap; }
    .template-gallery-wrap { border: 0; border-radius: 8px; padding: 0; background: transparent; }
    .template-gallery { display: grid; gap: 18px; margin-top: 0; }
    .template-category-block { border: 1px solid var(--line); border-radius: 11px; background: #fff; padding: 12px; box-shadow: var(--shadow); }
    .template-category-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; padding-bottom: 10px; border-bottom: 1px solid #e8eef7; }
    .template-category-head h3 { margin: 0; font-size: 13px; letter-spacing: 0; color: #1e3a8a; font-weight: 800; }
    .template-category-subtle { font-size: 11px; color: var(--muted); }
    .template-category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .template-manage-split { height: 8px; }
    .template-card {
      display: grid; gap: 9px; width: 100%; padding: 11px; border: 1px solid var(--line); border-radius: 10px;
      background: #fff; color: var(--text); text-align: left; box-shadow: none; transform: none;
    }
    .template-card:hover { background: #f8fbff; border-color: #bfdbfe; box-shadow: 0 12px 28px rgba(37,99,235,.10); transform: translateY(-1px); }
    .template-card[aria-selected="true"] { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
    .template-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .template-card-title { font-size: 13px; font-weight: 850; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .template-card-scope { flex: 0 0 auto; min-height: 22px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 999px; background: #eef4ff; color: #1d4ed8; font-size: 11px; font-weight: 800; }
    .template-thumb {
      position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 7px; border: 1px solid rgba(23,32,51,.10);
      background: var(--thumb-bg); color: var(--thumb-body);
    }
    .template-thumb[data-has-thumbnail="true"] { background-image: var(--template-thumbnail); background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.30), 0 14px 28px rgba(15,23,42,.10); }
    .template-thumb[data-has-thumbnail="true"]::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(15,23,42,.10)); }
    .template-thumb[data-has-thumbnail="true"]::after,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-band,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-content,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-accent { display: none; }
    .template-thumb::before { content: ""; position: absolute; inset: 0; background:
      linear-gradient(135deg, rgba(255,255,255,.70), rgba(255,255,255,.18)),
      repeating-linear-gradient(90deg, rgba(15,23,42,.035) 0 1px, transparent 1px 24px),
      var(--thumb-bg); }
    .template-thumb::after { content: ""; position: absolute; inset: 10% 7% 11%; border-radius: 6px; border: 1px solid rgba(15,23,42,.06); background: var(--thumb-surface); box-shadow: 0 16px 28px rgba(15,23,42,.10); }
    .template-thumb-band { position: absolute; z-index: 1; inset: 0 auto 0 0; width: 18%; background: var(--thumb-primary); }
    .template-thumb[data-layout="top-band"] .template-thumb-band { inset: 0 0 auto 0; width: auto; height: 20%; }
    .template-thumb[data-layout="hero"] .template-thumb-band { inset: 0; width: 100%; opacity: .16; }
    .template-thumb[data-layout="hero"] .template-thumb-content { width: 68%; top: 24%; left: 10%; }
    .template-thumb[data-layout="executive"] .template-thumb-band { inset: 11% 7% auto 7%; width: auto; height: 12%; border-radius: 6px 6px 0 0; }
    .template-thumb[data-layout="executive"] .template-thumb-content { left: 14%; right: 30%; top: 30%; }
    .template-thumb[data-layout="executive"] .template-thumb-accent { right: 12%; top: 27%; bottom: auto; width: 11%; height: 46%; border-radius: 5px; box-shadow: 0 10px 18px rgba(15,23,42,.10); }
    .template-thumb[data-layout="academy"] .template-thumb-band { inset: 12% 7% auto 7%; width: auto; height: 10%; border-radius: 6px 6px 0 0; }
    .template-thumb[data-layout="academy"] .template-thumb-content { left: 13%; right: 22%; top: 28%; }
    .template-thumb[data-layout="academy"] .template-thumb-accent { right: 10%; top: 28%; bottom: auto; width: 8%; height: 44%; border-radius: 5px; box-shadow: 0 10px 18px rgba(15,23,42,.08); }
    .template-thumb[data-layout="venture"] { background: var(--thumb-bg); }
    .template-thumb[data-layout="venture"]::before { background:
      radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--thumb-accent) 26%, transparent), transparent 34%),
      linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 94%, #ffffff 6%), color-mix(in srgb, var(--thumb-primary) 78%, var(--thumb-bg) 22%)); }
    .template-thumb[data-layout="venture"]::after { inset: 9% 7% 12%; background: var(--thumb-surface); opacity: .98; }
    .template-thumb[data-layout="venture"] .template-thumb-band { inset: auto 10% 16% 10%; width: auto; height: 6%; background: var(--thumb-accent); border-radius: 999px; }
    .template-thumb[data-layout="venture"] .template-thumb-content { left: 13%; right: 14%; top: 29%; }
    .template-thumb[data-layout="venture"] .template-thumb-accent { display: none; }
    .template-thumb[data-layout="red-gold"] { background: var(--thumb-primary); }
    .template-thumb[data-layout="red-gold"][data-has-dome-asset="true"] { background-image: var(--dome-template-thumb), linear-gradient(135deg, var(--thumb-primary), #7d0610); background-size: cover; background-position: center; }
    .template-thumb[data-layout="red-gold"]::before {
      background:
        repeating-linear-gradient(115deg, rgba(255,232,176,.10) 0 1px, transparent 1px 24px),
        linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 96%, #000000 4%), color-mix(in srgb, var(--thumb-primary) 78%, #f97316 22%));
    }
    .template-thumb[data-layout="red-gold"][data-has-dome-asset="true"]::before { background: linear-gradient(90deg, rgba(111,4,13,.14), rgba(111,4,13,.02) 48%, rgba(255,232,176,.10)); }
    .template-thumb[data-layout="red-gold"]::after { inset: 18% 12% 25% 12%; background: rgba(255,248,230,.94); border-color: rgba(246,212,138,.50); box-shadow: 0 18px 30px rgba(82,5,12,.22); }
    .template-thumb[data-layout="red-gold"][data-has-dome-asset="true"]::after { display:none; }
    .template-thumb[data-layout="red-gold"] .template-thumb-band { inset: auto 0 0 0; width: auto; height: 28%; background: linear-gradient(135deg, rgba(255,248,204,.94), color-mix(in srgb, var(--thumb-accent) 82%, #ffffff 18%) 36%, rgba(184,15,26,.25) 37%, color-mix(in srgb, var(--thumb-primary) 80%, #3f0308 20%)); clip-path: polygon(0 64%, 15% 48%, 29% 58%, 45% 34%, 61% 53%, 76% 31%, 100% 44%, 100% 100%, 0 100%); }
    .template-thumb[data-layout="red-gold"] .template-thumb-content { left: 19%; right: 24%; top: 34%; }
    .template-thumb[data-layout="red-gold"] .template-thumb-title { background: var(--thumb-title); }
    .template-thumb[data-layout="red-gold"] .template-thumb-accent { right: 15%; top: 33%; bottom: auto; width: 9%; height: 36%; border-radius: 7px; box-shadow: 0 10px 18px rgba(82,5,12,.22); }
    .template-thumb-content { position: absolute; z-index: 2; top: 24%; left: 24%; right: 9%; display: grid; gap: 7px; }
    .template-thumb-title { width: 78%; height: 13px; border-radius: 999px; background: var(--thumb-title); }
    .template-thumb-line { height: 7px; border-radius: 999px; background: var(--thumb-body); opacity: .48; }
    .template-thumb-line:nth-child(3) { width: 72%; }
    .template-thumb-accent { position: absolute; z-index: 2; right: 9%; bottom: 12%; width: 18%; height: 7px; border-radius: 999px; background: var(--thumb-accent); }
    .template-card-meta { display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .primary-action { width: 100%; justify-content: center; min-height: 42px; }
    .preview-shell { min-height: calc(100vh - 108px); display: grid; grid-template-rows: auto 1fr; overflow: hidden; }
    .preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 16px; border-bottom: 1px solid var(--line); }
    .preview-meta { color: var(--muted); font-size: 12px; }
    .preview-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .preview-actions button { min-height: 34px; padding: 8px 10px; }
    .preview-stage { display: grid; min-height: 0; padding: 18px; background: #edf3fb; overflow: auto; }
    .preview {
      min-height: 620px; background: #ffffff; color: var(--text); border-radius: 8px; padding: 18px; overflow: auto;
      box-shadow: inset 0 0 0 1px rgba(37,99,235,.08), 0 18px 42px rgba(23,32,51,.12);
    }
    .preview.is-deck-loaded { height: 100%; min-height: 0; padding: 0; background: #edf3fb; overflow: hidden; }
    .preview-frame { display: block; width: 100%; min-height: 620px; border: 0; border-radius: 8px; background: #edf3fb; }
    .preview.is-deck-loaded .preview-frame { height: 100%; min-height: 0; }
    .empty-preview { min-height: 584px; display: grid; place-items: center; border: 1px dashed #bfd0e6; border-radius: 8px; background: linear-gradient(135deg, #ffffff 0%, #f5f9ff 62%, #e8f1ff 100%); }
    .empty-slide { width: min(520px, 90%); aspect-ratio: 16 / 9; border-radius: 8px; background: #fff; border: 1px solid #d9e5f5; box-shadow: 0 24px 60px rgba(37,99,235,.12); padding: 46px 54px; }
    .empty-slide h3 { margin: 0 0 14px; font-size: 28px; line-height: 1.2; color: #1e3a8a; letter-spacing: 0; }
    .empty-slide p { margin: 0; color: var(--muted); line-height: 1.7; }
    .empty-line { width: 46px; height: 4px; margin: 28px 0 0; border-radius: 999px; background: var(--primary); }
    .deck-loading { display: grid; gap: 18px; min-height: 584px; }
    .deck-loading-head {
      display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center;
      padding: 16px; border: 1px dashed #bfd0e6; border-radius: 8px; background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%);
    }
    .deck-loading-head strong { display: block; margin-bottom: 4px; color: #1e3a8a; font-size: 18px; }
    .deck-loading-head span { display: block; color: var(--muted); font-size: 12px; line-height: 1.5; }
    .deck-progress { height: 8px; margin-top: 10px; border-radius: 999px; overflow: hidden; background: #dbeafe; }
    .deck-progress-bar { display: block; width: var(--deck-progress, 12%); height: 100%; border-radius: inherit; background: var(--primary); transition: width .24s ease; }
    .deck-loading-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .deck-loading-step { padding: 9px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: #64748b; font-size: 12px; font-weight: 800; }
    .deck-loading-step.is-active { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
    .deck-loading-grid { display: grid; gap: 12px; }
    .deck-loading-slide {
      display: grid; gap: 10px; aspect-ratio: 16 / 9; padding: 8.5% 9%; border-radius: 8px;
      border: 1px solid #d9e5f5; background: #fff; box-shadow: 0 18px 46px rgba(23,32,51,.10); animation: deckReveal .28s ease-out both;
    }
    .deck-loading-title { width: 62%; height: 18px; border-radius: 999px; background: #1e3a8a; }
    .deck-loading-line { height: 9px; border-radius: 999px; background: #cbd5e1; }
    .deck-loading-line:nth-child(3) { width: 82%; }
    .deck-loading-line:nth-child(4) { width: 68%; }
    @keyframes deckReveal { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .outline-shell { min-height: calc(100vh - 108px); display: grid; grid-template-rows: auto auto 1fr; overflow: hidden; }
    .outline-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px; border-bottom: 1px solid var(--line); }
    .outline-title-row { display: flex; align-items: center; gap: 10px; }
    .outline-badge { display: inline-flex; align-items: center; min-height: 28px; padding: 0 9px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 12px; font-weight: 800; }
    .outline-toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .outline-toolbar button { min-height: 34px; padding: 8px 10px; }
    .outline-summary { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .outline-stat { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .outline-stat span { display: block; color: var(--muted); font-size: 11px; font-weight: 800; }
    .outline-stat strong { display: block; margin-top: 4px; color: var(--text); font-size: 16px; }
    .outline-board { padding: 16px; overflow: auto; background: #edf3fb; }
    .outline-empty { min-height: 520px; display: grid; place-items: center; text-align: center; border: 1px dashed #bfd0e6; border-radius: 8px; background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%); color: var(--muted); }
    .outline-empty strong { display: block; margin-bottom: 8px; color: #1e3a8a; font-size: 22px; }
    .outline-loading {
      min-height: 520px; display: grid; place-items: center; padding: 24px; text-align: center;
      border: 1px dashed #bfd0e6; border-radius: 8px; background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%);
    }
    .loading-spinner {
      width: 42px; height: 42px; margin: 0 auto 14px; border-radius: 999px;
      border: 4px solid #dbeafe; border-top-color: var(--primary); animation: spin .8s linear infinite;
    }
    .outline-loading strong { display: block; margin-bottom: 8px; color: #1e3a8a; font-size: 22px; }
    .outline-loading span { display: block; color: var(--muted); font-size: 13px; line-height: 1.55; }
    .loading-steps { display: grid; gap: 8px; width: min(420px, 100%); margin: 18px auto 0; text-align: left; }
    .loading-step { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; font-weight: 700; }
    .loading-step::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: #bfdbfe; }
    .loading-step.is-active { color: #1d4ed8; }
    .loading-step.is-active::before { background: var(--primary); box-shadow: 0 0 0 4px rgba(37,99,235,.12); }
    @keyframes spin { to { transform: rotate(360deg); } }
    .outline-card-list { display: grid; gap: 12px; }
    .outline-card { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 12px 32px rgba(23,32,51,.06); }
    .outline-card.is-revealing { animation: outlineReveal .28s ease-out both; }
    @keyframes outlineReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .outline-card-head { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; }
    .outline-index { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: #172033; color: #fff; font-weight: 850; font-size: 13px; }
    .outline-title-input { font-size: 17px; font-weight: 800; color: var(--text); }
    .outline-bullets-input { min-height: 92px; font-size: 13px; line-height: 1.55; }
    .outline-card-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 12px; }
    .outline-json-details { padding: 0 16px 16px; background: #edf3fb; }
    .outline-json-details summary { cursor: pointer; color: var(--muted); font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .download-panel { display: grid; gap: 12px; }
    .download-button { width: 100%; min-height: 42px; }
    .selected-slide-box { padding: 10px 12px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 800; }
    .selected-slide-box span { display: block; margin-top: 3px; color: var(--muted); font-weight: 700; line-height: 1.45; }
    .asset-list { display: grid; gap: 8px; margin-bottom: 0; }
    .asset-list:empty::before { content: "暂无历史 PPT"; color: var(--muted); font-size: 13px; }
    .asset-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-soft); }
    .asset-title { font-weight: 800; font-size: 13px; }
    .asset-meta { margin-top: 3px; font-size: 12px; color: var(--muted); }
    .asset-actions { display: flex; gap: 6px; }
    .asset-actions button { padding: 6px 8px; font-size: 12px; }
    .balance-card { display: grid; gap: 10px; }
    .balance-main { display: grid; gap: 14px; padding: 14px; border: 1px solid #c7d2fe; border-radius: 8px; background: linear-gradient(135deg, #fff 0%, #eef4ff 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.72); }
    .balance-main-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .balance-label { color: var(--muted); font-size: 12px; font-weight: 800; }
    .balance-value { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; margin-top: 4px; color: #1d4ed8; font-size: 34px; line-height: 1; font-weight: 900; letter-spacing: 0; word-break: break-word; }
    .balance-unit { color: var(--muted); font-size: 12px; font-weight: 800; }
    .balance-meta-line { color: #475569; font-size: 12px; font-weight: 700; }
    .balance-badge { display: inline-flex; align-items: center; min-height: 26px; padding: 0 9px; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .balance-badge.is-warning { background: #fef3c7; color: #92400e; }
    .balance-progress { display: grid; gap: 7px; }
    .balance-progress-track { height: 8px; overflow: hidden; border-radius: 999px; background: #dbeafe; }
    .balance-progress-fill { display: block; height: 100%; width: var(--balance-progress, 0%); border-radius: inherit; background: linear-gradient(90deg, #2563eb 0%, #0f766e 100%); }
    .balance-progress-row { display: flex; justify-content: space-between; gap: 10px; color: #64748b; font-size: 11px; font-weight: 800; }
    .balance-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .balance-fact { min-width: 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .balance-fact span { display: block; color: var(--muted); font-size: 11px; font-weight: 700; }
    .balance-fact strong { display: block; margin-top: 4px; overflow-wrap: anywhere; color: var(--text); font-size: 13px; }
    .balance-message { padding: 10px 12px; border-radius: 8px; border: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 12px; line-height: 1.5; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid var(--line); color: #334155; font-size: 12px; line-height: 1.55; max-height: 240px; overflow: auto; }
    .outline-editor { min-height: 160px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .sidebar-panel { box-shadow: none; }
    body[data-workspace-page="assets"] .context { order: 1; }
    body[data-workspace-page="assets"] .preview-shell { order: 2; }
    .is-hidden { display: none !important; }
    @media (max-width: 1180px) { header { flex-wrap: wrap; } main { grid-template-columns: minmax(300px, 380px) 1fr; } .context { grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); } .preview-shell { min-height: 620px; } }
    @media (min-width: 1021px) and (max-width: 1320px) { body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: minmax(280px, 320px) minmax(520px, 1fr) minmax(280px, 320px); } }
    @media (max-width: 1020px) { body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: 1fr; } body[data-workspace-page="create"][data-flow-stage="preview"] .context { grid-template-columns: 1fr; } }
    @media (max-width: 980px) { body[data-workspace-page="templates"] main { grid-template-columns: 1fr; } }
    @media (max-width: 860px) { header { align-items: flex-start; padding: 14px 16px; } .page-nav { width: 100%; overflow-x: auto; } .page-nav button { flex: 0 0 auto; } main, body[data-workspace-page="create"][data-flow-stage="input"] main, body[data-workspace-page="create"][data-flow-stage="outline"] main, body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: 1fr; padding: 12px; } .context { grid-template-columns: 1fr; } .row { grid-template-columns: 1fr; } .preview-shell, .outline-shell { min-height: auto; } .preview, .preview-frame, .preview.is-deck-loaded, .preview.is-deck-loaded .preview-frame { min-height: 420px; } .outline-header { align-items: flex-start; flex-direction: column; } .outline-toolbar { justify-content: flex-start; } .outline-summary { grid-template-columns: 1fr; } .outline-empty { min-height: 320px; } .template-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .top-status { justify-content: flex-start; } }
    @media (max-width: 520px) { .template-category-grid { grid-template-columns: 1fr; } .balance-facts { grid-template-columns: 1fr; } .balance-main-head { align-items: stretch; flex-direction: column; } .balance-badge { width: max-content; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-mark">P</div>
      <div>
        <h1>AI PPT 工作台</h1>
        <div class="brand-subtitle">从想法到大纲、模板、预览和导出的一体化流程</div>
      </div>
    </div>
    <nav class="page-nav" aria-label="工作台页面">
      <button type="button" data-page-target="create" aria-selected="true">生成工作台</button>
      <button type="button" data-page-target="templates" aria-selected="false">模板管理</button>
      <button type="button" data-page-target="assets" aria-selected="false">资产库</button>
      <button type="button" data-page-target="status" aria-selected="false">状态中心</button>
    </nav>
    <div class="top-status">
      <div class="status-chip"><span class="status-dot"></span><span>服务在线</span></div>
      <div class="status-chip">主题生成 / 文档生成 / 预览 / 导出</div>
    </div>
  </header>
  <main>
	    <section class="workflow" aria-label="生成流程" data-page-panel="create templates" data-flow-panel="input preview">
		      <div class="panel" data-page-panel="create" data-flow-panel="input">
	        <div class="panel-head">
	          <div class="panel-title"><span class="step-number">1</span><h2>生成流程</h2></div>
	        </div>
	        <div class="flow-guide" aria-label="PPT 生成步骤">
	          <div class="flow-step is-active" data-flow-step="input"><div class="flow-dot">1</div><div><strong>填写主题或文档</strong><span>输入主题，或粘贴文档内容作为生成依据。</span></div></div>
	          <div class="flow-step" data-flow-step="outline"><div class="flow-dot">2</div><div><strong>生成并确认大纲</strong><span>在中间主页面逐页修改标题和要点。</span></div></div>
	          <div class="flow-step" data-flow-step="template"><div class="flow-dot">3</div><div><strong>选择模板并生成 PPT</strong><span>保存大纲后应用当前模板和主题生成完整 PPT。</span></div></div>
	          <div class="flow-step" data-flow-step="download"><div class="flow-dot">4</div><div><strong>预览并下载</strong><span>右侧查看模板效果，下载 PPTX 或 PDF。</span></div></div>
	        </div>
	        <p class="panel-note">先描述主题，也可以粘贴文档内容。系统会先生成可编辑大纲，再按模板生成 PPT。</p>
      <label for="topic">主题</label>
      <textarea id="topic">季度经营复盘</textarea>
      <div class="row">
        <div>
          <label for="slide-count">页数</label>
          <input id="slide-count" type="number" min="1" max="20" value="6" />
        </div>
        <div>
          <label for="entitlement">entitlement_id</label>
          <input id="entitlement" value="${escapeHtml(entitlementValue)}" />
          ${entitlementValue ? "" : '<p class="hint warning">未识别到权益 ID。请确认魔灵入口 verify 返回 entitlement_id，或手动填写用户购买套餐后的 entitlement_id。</p>'}
        </div>
      </div>
      <label for="document">上传文档内容</label>
      <textarea id="document" placeholder="可粘贴文档文本，生成大纲时会作为 source file 上传"></textarea>
      <div class="actions">
        <button id="generate-outline" class="primary-action">生成大纲</button>
      </div>
      </div>
	      <div class="panel" data-page-panel="create templates" data-flow-panel="preview">
        <div class="panel-head">
          <div class="panel-title"><span class="step-number">2</span><h2>模板与主题</h2></div>
        </div>
      <div class="row">
        <div>
          <label for="template-category">模板分类</label>
          <select id="template-category"><option value="">全部分类</option></select>
        </div>
        <div>
          <label for="template">模板</label>
          <select id="template"><option value="business">Business</option></select>
        </div>
      </div>
      <div class="row">
        <div>
          <label for="theme">主题风格</label>
          <select id="theme"><option value="modern">modern</option></select>
        </div>
        <div>
          <label for="template-scope">模板来源</label>
          <input id="template-scope" value="官方 / 个人" disabled />
        </div>
      </div>
      <p class="panel-note">模板列表请前往“模板管理”按分类进行大图浏览，并选择当前模板。</p>
      </div>
      <div class="panel" data-page-panel="templates">
      <div class="panel-head">
        <div class="panel-title"><span class="step-number">3</span><h2>模板库总览</h2></div>
      </div>
      <div class="template-gallery-toolbar">
        <span class="template-gallery-title">模板列表</span>
        <span id="template-gallery-count" class="template-gallery-count">0 个可用模板</span>
      </div>
      <p class="panel-note">按分类区块平铺展示全部模板，支持官方与个人模板快速切换。</p>
      <div class="template-gallery-wrap">
        <div id="template-gallery" class="template-gallery" aria-label="模板内容样式预览"></div>
      </div>
      <div class="template-manage-split"></div>
      <div class="panel-head">
        <div class="panel-title"><span class="step-number">4</span><h2>个人模板</h2></div>
      </div>
      <div class="row">
        <div>
          <label for="personal-template-name">模板名称</label>
          <input id="personal-template-name" placeholder="例如：我的汇报模板" />
        </div>
        <div>
          <label for="personal-template-file">PPTX 文件</label>
          <input id="personal-template-file" type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" />
        </div>
      </div>
      <div class="actions">
        <button id="upload-personal-template" type="button" class="secondary">上传个人模板</button>
        <button id="delete-personal-template" type="button" class="secondary">删除当前个人模板</button>
      </div>
      </div>
	    </section>
    <section class="outline-shell" aria-label="流程引导" data-page-panel="create" data-flow-panel="input">
      <div class="stage-empty"><div><strong>填写主题或文档内容</strong><span>完成左侧信息后点击“生成大纲”，系统会自动进入下一阶段。</span></div></div>
    </section>
    <section class="outline-shell" aria-label="大纲确认" data-page-panel="create" data-flow-panel="outline">
      <div class="outline-header">
        <div>
          <div class="outline-title-row"><h2>大纲确认</h2><span class="outline-badge">可编辑</span></div>
          <div class="preview-meta">逐页确认标题和要点。确认无误后保存大纲，进入模板预览和下载阶段。</div>
        </div>
        <div class="outline-toolbar">
          <button id="save-outline" class="secondary">保存大纲</button>
          <button id="retry-task" class="secondary">重试失败任务</button>
        </div>
      </div>
      <div id="outline-board" class="outline-board">
        <div class="outline-empty"><div><strong>先生成大纲</strong><span>生成后会以每页卡片展示，直接修改标题和要点即可。</span></div></div>
      </div>
      <details class="outline-json-details">
        <summary>查看 JSON 原始数据</summary>
        <textarea id="outline-editor" class="outline-editor" placeholder="生成大纲后会同步显示 slides JSON"></textarea>
      </details>
    </section>
    <section class="preview-shell" aria-label="在线预览" data-page-panel="create assets" data-flow-panel="preview">
      <div class="preview-header">
        <div>
          <h2>在线预览</h2>
          <div class="preview-meta">保存大纲后才能生成并查看模板预览。</div>
        </div>
        <button id="generate-deck">应用当前模板生成 PPT</button>
      </div>
      <div class="preview-stage">
        <div id="preview" class="preview"><div class="empty-preview"><div class="empty-slide"><h3>等待生成 PPT</h3><p>先生成大纲，再应用当前模板。预览区会展示每页内容、配色和版式效果。</p><div class="empty-line"></div></div></div></div>
      </div>
    </section>
    <aside class="context" aria-label="上下文信息" data-page-panel="create assets status" data-flow-panel="outline preview">
      <div class="panel sidebar-panel" data-page-panel="create" data-flow-panel="outline">
        <div class="panel-head"><h2>大纲信息</h2></div>
        <div id="outline-summary" class="outline-summary">
          <div class="outline-stat"><span>大纲确认</span><strong>等待大纲</strong></div>
          <div class="outline-stat"><span>当前状态</span><strong>未开始</strong></div>
          <div class="outline-stat"><span>页数</span><strong>0</strong></div>
          <div class="outline-stat"><span>可编辑要点</span><strong>0</strong></div>
        </div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="create" data-flow-panel="preview">
        <div class="panel-head"><h2>下载文件</h2></div>
        <p class="panel-note">生成 PPT 预览后，可下载 PPTX 或 PDF 文件。</p>
        <div class="download-panel">
          <button id="export-pptx" class="secondary download-button">下载 PPTX</button>
          <button id="export-pdf" class="secondary download-button">下载 PDF</button>
        </div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="create" data-flow-panel="preview">
        <div class="panel-head"><h2>AI 单页润色</h2></div>
        <p class="panel-note">在中间预览中点击要优化的页面，再输入润色建议。</p>
        <div id="selected-slide-label" class="selected-slide-box">未选择页面<span>请先在在线预览中点击一页 PPT。</span></div>
        <label for="slide-instruction">润色建议</label>
        <textarea id="slide-instruction" placeholder="例如：让这一页更适合高层汇报，标题更有力度，要点更精炼。"></textarea>
        <div class="actions">
          <button id="regenerate-slide" class="secondary">AI 润色本页</button>
        </div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="create" data-flow-panel="preview">
        <div class="panel-head"><h2>任务状态 / 日志</h2></div>
        <pre id="status">ready</pre>
      </div>
      <div class="panel sidebar-panel" data-page-panel="assets">
        <div class="panel-head"><h2>历史 PPT</h2></div>
        <div id="asset-list" class="asset-list">加载中...</div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="status">
        <div class="panel-head"><h2>套餐余额</h2></div>
        <div id="balance-status" class="balance-card"><div class="balance-message">正在读取套餐余额...</div></div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="status">
        <div class="panel-head"><h2>任务状态 / 日志</h2></div>
        <pre id="status-readonly">ready</pre>
      </div>
    </aside>
  </main>
  <script>
    const state = { outlineId: null, deckId: null, taskId: null, outlineSlides: [], selectedSlideId: null, selectedSlideNumber: null };
    let taskPollTimeout;
    const statusEl = document.querySelector("#status");
    const balanceStatusEl = document.querySelector("#balance-status");
    const previewEl = document.querySelector("#preview");
    const outlineEditorEl = document.querySelector("#outline-editor");
    const outlineBoardEl = document.querySelector("#outline-board");
    const outlineSummaryEl = document.querySelector("#outline-summary");
    const selectedSlideLabelEl = document.querySelector("#selected-slide-label");
    const templateGalleryEl = document.querySelector("#template-gallery");
    const templateGalleryCountEl = document.querySelector("#template-gallery-count");
    const assetListEl = document.querySelector("#asset-list");
    const pageButtons = [...document.querySelectorAll("[data-page-target]")];
    const flowStepEls = [...document.querySelectorAll("[data-flow-step]")];
    const workspacePages = new Set(["create", "templates", "assets", "status"]);
    const OUTLINE_REVEAL_INTERVAL_MS = 620;
    const DECK_REVEAL_INTERVAL_MS = 700;
    const DECK_MIN_LOADING_MS = 2200;
    let flowStage = "input";
    let templateCategories = [{ id: "business", name: "Business" }];
    let templateCatalog = [{ id: "business", name: "Business", category: { id: "business", name: "Business" }, themes: [{ id: "modern", name: "Modern" }] }];
    let deckLoadingStartedAt = 0;
    let deckRevealTimer = null;
    let deckRevealTargetCount = 0;
    let deckRevealSlides = [];
    const json = (url, body, method = "POST") => fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data));
      return data;
    });
    function formatApiError(payload) {
      const error = payload?.error || {};
      if (error.code === "ENTITLEMENT_REQUIRED") {
        return "ENTITLEMENT_REQUIRED: 未识别到权益 ID。请从魔灵平台重新进入应用，或填写该用户购买积分套餐后生成的 entitlement_id。";
      }
      if (error.code === "40003") {
        return "40003: 票据无效、已过期或已被使用。请从魔灵平台重新点击进入应用，不要刷新旧链接。";
      }
      if (error.code === "INSUFFICIENT_CREDITS") {
        const details = error.details || {};
        const remaining = details.balance?.remaining ?? "未知";
        const required = details.required_amount ?? "未知";
        return "INSUFFICIENT_CREDITS: 积分不足。当前权益 " + details.entitlement_id + " 剩余 " + remaining + "，本次需要 " + required + "。请购买或补充积分后重试。";
      }
      if (error.code === "PERSONAL_TEMPLATE_QUOTA_EXCEEDED") {
        return "PERSONAL_TEMPLATE_QUOTA_EXCEEDED: 个人模板最多 " + ((error.details || {}).limit || 20) + " 个。请删除一个后再上传。";
      }
      if (error.code === "OBJECT_STORAGE_FAILED") {
        return "OBJECT_STORAGE_FAILED: 模板文件保存到对象存储失败。请检查 MinIO/S3 服务、bucket 和访问密钥配置。request_id=" + (error.request_id || "");
      }
      if (error.code === "INTERNAL_ERROR") {
        return "INTERNAL_ERROR: 个人模板上传失败。请把 request_id 发给开发排查：" + (error.request_id || "");
      }
      return error.code
        ? error.code + ": " + (error.message || "请求失败")
        : JSON.stringify(payload);
    }
    async function loadBalance() {
      try {
        const data = await fetch("/api/billing/balance").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        renderBalanceStatus(data);
      } catch (error) {
        balanceStatusEl.innerHTML = '<div class="balance-message">' + escapeHtml(error.message) + '</div>';
      }
    }
    function renderBalanceStatus(data) {
      const balance = data.balance || {};
      const remaining = balance.remaining ?? balance.available ?? "未知";
      const usable = balance.usable !== false && balance.status !== "inactive";
      const reserved = balance.quota_reserved ?? balance.reserved ?? "0";
      const used = balance.quota_used ?? balance.used ?? "0";
      const total = balance.quota_total ?? balance.total ?? "未知";
      const usedNumber = Number(used);
      const totalNumber = Number(total);
      const progress = Number.isFinite(usedNumber) && Number.isFinite(totalNumber) && totalNumber > 0
        ? Math.max(0, Math.min(100, Math.round((usedNumber / totalNumber) * 100)))
        : 0;
      balanceStatusEl.innerHTML = ''
        + '<div class="balance-main">'
        + '<div class="balance-main-head">'
        + '<div><div class="balance-label">当前可用余额</div>'
        + '<div class="balance-value">' + escapeHtml(remaining) + '<span class="balance-unit">点</span></div>'
        + '<div class="balance-meta-line">权益 ID ' + escapeHtml(data.entitlement_id ?? "未识别") + '</div></div>'
        + '<span class="balance-badge ' + (usable ? '' : 'is-warning') + '">' + (usable ? '套餐正常' : '需处理') + '</span>'
        + '</div>'
        + '<div class="balance-progress" aria-label="套餐用量">'
        + '<div class="balance-progress-track"><span class="balance-progress-fill" style="--balance-progress:' + progress + '%"></span></div>'
        + '<div class="balance-progress-row"><span>已用 ' + escapeHtml(used) + '</span><span>总额 ' + escapeHtml(total) + '</span></div>'
        + '</div>'
        + '</div>'
        + '<div class="balance-facts">'
        + '<div class="balance-fact"><span>预占积分</span><strong>' + escapeHtml(reserved) + '</strong></div>'
        + '<div class="balance-fact"><span>已用积分</span><strong>' + escapeHtml(used) + '</strong></div>'
        + '<div class="balance-fact"><span>套餐状态</span><strong>' + (usable ? '正常' : '需处理') + '</strong></div>'
        + '</div>';
    }
    function renderTemplateOptions() {
      const templateEl = document.querySelector("#template");
      templateEl.innerHTML = templateCatalog.map((template) => (
        '<option value="' + escapeHtml(template.id) + '">' + escapeHtml(template.name) + '</option>'
      )).join("");
      renderThemeOptions();
      renderTemplateGallery();
    }
    function renderCategoryOptions() {
      const categoryEl = document.querySelector("#template-category");
      categoryEl.innerHTML = '<option value="">全部分类</option>' + templateCategories.map((category) => (
        '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.name) + '</option>'
      )).join("");
    }
    function renderThemeOptions(preferredThemeId) {
      const selected = templateCatalog.find((template) => template.id === document.querySelector("#template").value) || templateCatalog[0];
      const themeEl = document.querySelector("#theme");
      themeEl.innerHTML = (selected.themes || ["modern"]).map((theme) => (
        '<option value="' + escapeHtml(theme.id || theme) + '">' + escapeHtml(theme.name || theme.id || theme) + '</option>'
      )).join("");
      if (preferredThemeId && [...themeEl.options].some((option) => option.value === preferredThemeId)) {
        themeEl.value = preferredThemeId;
      }
      document.querySelector("#template-scope").value = selected ? (selected.scope === "user" ? "个人模板" : "官方模板") : "";
    }
    function resolveTemplateCategory(template) {
      const category = template.category || {};
      const resolvedId = template.categoryId || category.id || template.category_id || category.name || "uncategorized";
      const resolvedName = category.name || category.id || category.title || resolvedId;
      return {
        id: String(resolvedId),
        name: String(resolvedName)
      };
    }
    function sortTemplateCategoryEntries(entries) {
      const orderMap = new Map((templateCategories || []).map((category, index) => [category.id, index + 1]));
      return entries.sort((left, right) => {
        const categoryOrderDiff = (orderMap.get(left[0]) || Number.MAX_SAFE_INTEGER) - (orderMap.get(right[0]) || Number.MAX_SAFE_INTEGER);
        if (categoryOrderDiff) return categoryOrderDiff;
        return left[1].categoryName.localeCompare(right[1].categoryName, "zh-CN");
      });
    }
    function renderTemplateGallery() {
      if (!templateGalleryEl) return;
      const selectedId = document.querySelector("#template").value;
      const categoryId = document.querySelector("#template-category")?.value || "";
      const templates = categoryId
        ? templateCatalog.filter((template) => resolveTemplateCategory(template).id === categoryId)
        : templateCatalog;
      const groupedTemplates = new Map();
      for (const template of templates) {
        const category = resolveTemplateCategory(template);
        const key = category.id;
        if (!groupedTemplates.has(key)) {
          groupedTemplates.set(key, {
            categoryId: key,
            categoryName: category.name || "未分类",
            templates: []
          });
        }
        groupedTemplates.get(key).templates.push(template);
      }
      const groups = sortTemplateCategoryEntries(Array.from(groupedTemplates.values()).map((item) => [item.categoryId, item]));
      if (templateGalleryCountEl) {
        templateGalleryCountEl.textContent = templates.length + " 个可用模板";
      }
      if (!templates.length) {
        templateGalleryEl.innerHTML = '<div class="hint">当前分类暂无可用模板</div>';
        if (templateGalleryCountEl) templateGalleryCountEl.textContent = "当前分类暂无可用模板";
        return;
      }
      templateGalleryEl.innerHTML = groups.map(([categoryId, group]) => templateCategoryBlockHtml(categoryId, group, selectedId)).join("");
      templateGalleryEl.querySelectorAll("[data-template-card]").forEach((button) => {
        button.addEventListener("click", () => selectTemplateCard(button.dataset.templateCard));
      });
    }
    function templateCategoryBlockHtml(categoryId, group, selectedId) {
      const cards = group.templates.map((template) => templateCardHtml(template, selectedId)).join("");
      return ''
        + '<section class="template-category-block" data-template-category-id="' + escapeHtml(categoryId) + '">'
        + '<div class="template-category-head">'
        + '<h3>' + escapeHtml(group.categoryName) + '</h3>'
        + '<div class="template-category-subtle">' + group.templates.length + ' 个模板</div>'
        + '</div>'
        + '<div class="template-category-grid">'
        + cards
        + '</div>'
        + '</section>';
    }
    function templateCardHtml(template, selectedId) {
      const visual = normalizedTemplateVisual(template.visual);
      const themes = Array.isArray(template.themes) ? template.themes : [];
      const selectedThemeId = document.querySelector("#theme").value;
      const selectedTheme = themes.find((theme) => (theme.id || theme) === selectedThemeId);
      const displayTheme = (template.id === selectedId && selectedTheme) || themes[0] || { id: "modern", name: "Modern" };
      const categoryName = template.category?.name || template.category || "未分类";
      const hasDomeAsset = visual.layout === "red-gold";
      const thumbnailUrl = template.thumbnailUrl ? "url('" + cssUrl(template.thumbnailUrl) + "')" : "";
      const style = "--thumb-primary:#" + visual.primary + ";--thumb-accent:#" + visual.accent + ";--thumb-bg:#" + visual.background + ";--thumb-surface:#" + visual.surface + ";--thumb-title:#" + visual.title + ";--thumb-body:#" + visual.body + ";" + (thumbnailUrl ? "--template-thumbnail:" + thumbnailUrl + ";" : "");
      return ''
        + '<button type="button" class="template-card" data-template-card="' + escapeHtml(template.id) + '" aria-selected="' + (template.id === selectedId ? 'true' : 'false') + '">'
        + '<span class="template-card-head"><span class="template-card-title">' + escapeHtml(template.name) + '</span><span class="template-card-scope">' + (template.scope === "user" ? '个人' : '官方') + '</span></span>'
        + '<span class="template-thumb" data-layout="' + escapeHtml(visual.layout) + '" data-has-dome-asset="' + (hasDomeAsset ? 'true' : 'false') + '" data-has-thumbnail="' + (thumbnailUrl ? 'true' : 'false') + '" style="' + style + '">'
        + '<span class="template-thumb-band"></span><span class="template-thumb-content"><span class="template-thumb-title"></span><span class="template-thumb-line"></span><span class="template-thumb-line"></span></span><span class="template-thumb-accent"></span>'
        + '</span>'
        + '<span class="template-card-meta"><span>' + escapeHtml(categoryName) + '</span><span>' + escapeHtml(displayTheme.name || displayTheme.id || displayTheme) + '</span></span>'
        + '</button>';
    }
    function selectTemplateCard(templateId) {
      const templateEl = document.querySelector("#template");
      templateEl.value = templateId;
      renderThemeOptions();
      renderTemplateGallery();
    }
    function normalizedTemplateVisual(visual = {}) {
      return {
        primary: normalizeHexColor(visual.primary, "2563EB"),
        accent: normalizeHexColor(visual.accent, "14B8A6"),
        background: normalizeHexColor(visual.background, "F8FAFC"),
        surface: normalizeHexColor(visual.surface, "FFFFFF"),
        title: normalizeHexColor(visual.title, "0F172A"),
        body: normalizeHexColor(visual.body, "475569"),
        layout: ["top-band", "left-rail", "hero", "executive", "academy", "venture", "red-gold"].includes(visual.layout) ? visual.layout : "top-band"
      };
    }
    function normalizeHexColor(value, fallback) {
      const normalized = String(value || "").replace(/^#/, "").trim().toUpperCase();
      return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
    }
    function cssUrl(value) {
      return String(value || "").replaceAll("\\\\", "\\\\\\\\").replaceAll("'", "\\\\'");
    }
    async function loadTemplateCategories() {
      try {
        const data = await fetch("/api/template-categories").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        templateCategories = data.categories;
        renderCategoryOptions();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }
    async function loadTemplates() {
      try {
        const categoryId = document.querySelector("#template-category")?.value || "";
        const url = categoryId ? "/api/templates?category_id=" + encodeURIComponent(categoryId) : "/api/templates";
        const data = await fetch(url).then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        templateCatalog = data.templates;
        renderTemplateOptions();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    function renderAssets(assets) {
      if (!assets.length) {
        assetListEl.textContent = "暂无历史 PPT";
        return;
      }
      assetListEl.innerHTML = assets.map((asset) => (
        '<div class="asset-item" data-asset-id="' + asset.id + '">'
          + '<div><div class="asset-title">' + escapeHtml(asset.title || "Untitled") + '</div>'
          + '<div class="asset-meta">' + escapeHtml(asset.templateName || asset.templateId || "") + ' · ' + escapeHtml(asset.theme || "") + ' · ' + Number(asset.slideCount || 0) + ' 页</div></div>'
          + '<div class="asset-actions"><button type="button" data-open-asset="' + asset.id + '">打开</button><button type="button" class="secondary" data-delete-asset="' + asset.id + '">删除</button></div>'
        + '</div>'
      )).join("");
      assetListEl.querySelectorAll("[data-open-asset]").forEach((button) => {
        button.addEventListener("click", () => openAsset(button.dataset.openAsset));
      });
      assetListEl.querySelectorAll("[data-delete-asset]").forEach((button) => {
        button.addEventListener("click", () => deleteAsset(button.dataset.deleteAsset));
      });
    }

    async function loadAssets() {
      try {
        const data = await fetch("/api/ppt/assets").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        renderAssets(data.assets || []);
      } catch (error) {
        assetListEl.textContent = error.message;
      }
    }

    async function openAsset(assetId) {
      try {
        const data = await fetch("/api/ppt/assets/" + assetId).then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        state.deckId = data.asset.deckId;
        renderDeckPreviewFrame(state.deckId);
        setFlowStage("preview");
        statusEl.textContent = JSON.stringify(data.asset, null, 2);
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    async function deleteAsset(assetId) {
      try {
        const data = await json("/api/ppt/assets/" + assetId, {}, "DELETE");
        statusEl.textContent = JSON.stringify(data.asset, null, 2);
        await loadAssets();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    function readFileBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
        reader.readAsDataURL(file);
      });
    }

    async function uploadPersonalTemplate() {
      try {
        const file = document.querySelector("#personal-template-file").files[0];
        if (!file) throw new Error("请选择 PPTX 文件");
        const data = await json("/api/templates/personal", {
          file_name: file.name,
          name: document.querySelector("#personal-template-name").value.trim() || file.name.replace(/\\.pptx$/i, ""),
          content_base64: await readFileBase64(file)
        });
        const categoryId = data.template.categoryId || data.template.category?.id || "personal";
        await loadTemplateCategories();
        document.querySelector("#template-category").value = categoryId;
        await loadTemplates();
        document.querySelector("#template").value = data.template.id;
        renderThemeOptions();
        renderTemplateGallery();
        statusEl.textContent = JSON.stringify(data.template, null, 2);
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    async function deleteSelectedPersonalTemplate() {
      try {
        const selected = templateCatalog.find((template) => template.id === document.querySelector("#template").value);
        if (!selected || selected.scope !== "user") throw new Error("请选择一个个人模板");
        const data = await json("/api/templates/" + selected.id, {}, "DELETE");
        await loadTemplates();
        statusEl.textContent = JSON.stringify(data.template, null, 2);
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function renderDeckPreviewFrame(deckId) {
      stopDeckRevealTimer();
      previewEl.classList.add("is-deck-loaded");
      previewEl.innerHTML = '<iframe class="preview-frame" title="PPT 在线预览" src="/api/ppt/decks/'
        + encodeURIComponent(deckId)
        + '/preview"></iframe>';
      const frame = previewEl.querySelector(".preview-frame");
      frame.addEventListener("load", attachPreviewSlidePicker);
    }

    function attachPreviewSlidePicker() {
      const frame = previewEl.querySelector(".preview-frame");
      const doc = frame?.contentDocument;
      if (!doc) return;
      if (!doc.querySelector("[data-slide-picker-style]")) {
        const style = doc.createElement("style");
        style.dataset.slidePickerStyle = "true";
        style.textContent = ".preview-page{cursor:pointer;border-radius:10px}.preview-page .slide{transition:outline-color .16s ease,box-shadow .16s ease,transform .16s ease}.preview-page:hover .slide{outline:3px solid rgba(37,99,235,.38);outline-offset:6px}.preview-page[data-selected='true'] .slide{outline:4px solid #2563eb;outline-offset:6px;box-shadow:0 22px 58px rgba(37,99,235,.22)}";
        doc.head.appendChild(style);
      }
      const pages = [...doc.querySelectorAll(".preview-page")];
      pages.forEach((page, index) => {
        const slideNumber = index + 1;
        page.dataset.slideNumber = String(slideNumber);
        page.setAttribute("role", "button");
        page.setAttribute("tabindex", "0");
        page.setAttribute("title", "点击选择第 " + slideNumber + " 页进行 AI 润色");
        page.onclick = () => selectPreviewSlide(slideNumber);
        page.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectPreviewSlide(slideNumber);
          }
        };
      });
      const selected = state.selectedSlideNumber && pages[state.selectedSlideNumber - 1]
        ? state.selectedSlideNumber
        : (pages.length ? 1 : null);
      if (selected) selectPreviewSlide(selected);
      else renderSelectedSlideLabel();
    }

    function selectPreviewSlide(slideNumber) {
      const normalizedNumber = Number(slideNumber);
      state.selectedSlideNumber = Number.isInteger(normalizedNumber) && normalizedNumber > 0 ? normalizedNumber : null;
      state.selectedSlideId = state.selectedSlideNumber ? String(state.selectedSlideNumber) : null;
      const frame = previewEl.querySelector(".preview-frame");
      const pages = frame?.contentDocument ? [...frame.contentDocument.querySelectorAll(".preview-page")] : [];
      pages.forEach((page) => {
        page.dataset.selected = page.dataset.slideNumber === String(state.selectedSlideNumber);
      });
      renderSelectedSlideLabel();
    }

    function renderSelectedSlideLabel() {
      if (!selectedSlideLabelEl) return;
      if (!state.selectedSlideNumber) {
        selectedSlideLabelEl.innerHTML = '未选择页面<span>请先在在线预览中点击一页 PPT。</span>';
        return;
      }
      selectedSlideLabelEl.innerHTML = '已选择第 ' + state.selectedSlideNumber + ' 页<span>点击中间预览中的其他页面可切换。</span>';
    }

    function renderDeckGeneratingPreview(slides = []) {
      const normalized = normalizeOutlineSlides(slides);
      stopDeckRevealTimer();
      deckLoadingStartedAt = Date.now();
      deckRevealTargetCount = 0;
      deckRevealSlides = normalized;
      previewEl.classList.remove("is-deck-loaded");
      previewEl.innerHTML = ''
        + '<div class="deck-loading" role="status" aria-live="polite" data-deck-loading>'
        + '<div class="deck-loading-head">'
        + '<div class="loading-spinner" aria-hidden="true"></div>'
        + '<div><strong>正在应用当前模板生成 PPT</strong>'
        + '<span>系统正在把确认后的大纲转换为页面内容、版式和预览文件。</span>'
        + '<div class="deck-progress" aria-hidden="true"><span class="deck-progress-bar"></span></div></div>'
        + '</div>'
        + '<div class="deck-loading-steps">'
        + '<div class="deck-loading-step is-active" data-deck-step="template">应用模板和主题</div>'
        + '<div class="deck-loading-step" data-deck-step="slides">生成页面内容</div>'
        + '<div class="deck-loading-step" data-deck-step="preview">整理在线预览</div>'
        + '</div>'
        + '<div class="deck-loading-grid" data-deck-loading-grid></div>'
        + '</div>';
      updateDeckGeneratingPreview({ progress: 8, slides: normalized });
    }

    function updateDeckGeneratingPreview({ progress = 0, slides = state.outlineSlides } = {}) {
      const loadingEl = previewEl.querySelector("[data-deck-loading]");
      if (!loadingEl) return;
      const safeProgress = Math.max(8, Math.min(96, Number(progress) || 0));
      loadingEl.style.setProperty("--deck-progress", safeProgress + "%");
      loadingEl.querySelectorAll("[data-deck-step]").forEach((step) => {
        const key = step.dataset.deckStep;
        const active = key === "template" || (key === "slides" && safeProgress >= 34) || (key === "preview" && safeProgress >= 72);
        step.classList.toggle("is-active", active);
      });
      const normalized = normalizeOutlineSlides(slides);
      const visibleCount = Math.max(1, Math.min(normalized.length || 1, Math.ceil(((safeProgress || 8) / 100) * Math.max(normalized.length || 1, 3))));
      scheduleDeckLoadingSlides({ targetCount: visibleCount, slides: normalized });
    }

    function scheduleDeckLoadingSlides({ targetCount, slides }) {
      deckRevealTargetCount = Math.max(deckRevealTargetCount, targetCount);
      deckRevealSlides = normalizeOutlineSlides(slides);
      const loadingEl = previewEl.querySelector("[data-deck-loading]");
      const gridEl = loadingEl?.querySelector("[data-deck-loading-grid]");
      if (!gridEl) return;
      const currentCount = gridEl.querySelectorAll(".deck-loading-slide").length;
      if (currentCount >= deckRevealTargetCount || deckRevealTimer) return;
      deckRevealTimer = setTimeout(() => {
        deckRevealTimer = null;
        appendDeckLoadingSlide(deckRevealSlides);
        scheduleDeckLoadingSlides({ targetCount: deckRevealTargetCount, slides: deckRevealSlides });
      }, currentCount === 0 ? 0 : DECK_REVEAL_INTERVAL_MS);
    }

    function appendDeckLoadingSlide(slides) {
      const loadingEl = previewEl.querySelector("[data-deck-loading]");
      const gridEl = loadingEl?.querySelector("[data-deck-loading-grid]");
      if (!gridEl) return;
      const currentCount = gridEl.querySelectorAll(".deck-loading-slide").length;
      const normalized = normalizeOutlineSlides(slides);
      const sourceSlides = normalized.length ? normalized : [{ title: "正在生成页面", bullets: ["应用模板", "整理内容"] }];
      const slide = sourceSlides[currentCount] || sourceSlides[sourceSlides.length - 1];
      gridEl.insertAdjacentHTML("beforeend", deckLoadingSlideHtml(slide, currentCount));
    }

    function stopDeckRevealTimer() {
      if (deckRevealTimer) {
        clearTimeout(deckRevealTimer);
        deckRevealTimer = null;
      }
      deckRevealTargetCount = 0;
      deckRevealSlides = [];
    }

    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitForDeckLoadingRhythm(slides = state.outlineSlides) {
      const normalized = normalizeOutlineSlides(slides);
      updateDeckGeneratingPreview({ progress: 96, slides: normalized });
      const targetCount = Math.max(1, normalized.length || 1);
      const startedAt = deckLoadingStartedAt || Date.now();
      while (previewEl.querySelector("[data-deck-loading]")) {
        const shownCount = previewEl.querySelectorAll(".deck-loading-slide").length;
        const elapsed = Date.now() - startedAt;
        if (shownCount >= targetCount && elapsed >= DECK_MIN_LOADING_MS) return;
        await delay(120);
      }
    }

    function deckLoadingSlideHtml(slide, index) {
      return ''
        + '<div class="deck-loading-slide" data-deck-loading-slide="' + index + '">'
        + '<div class="deck-loading-title" title="' + escapeHtml(slide.title) + '"></div>'
        + '<div class="deck-loading-line"></div>'
        + '<div class="deck-loading-line"></div>'
        + '<div class="deck-loading-line"></div>'
        + '</div>';
    }

    function setFlowStep(step) {
      flowStepEls.forEach((item) => item.classList.toggle("is-active", item.dataset.flowStep === step));
    }

    function setFlowStage(stage) {
      flowStage = stage;
      document.body.dataset.flowStage = stage;
      setFlowStep(stage === "input" ? "input" : stage === "outline" ? "outline" : "download");
      applyWorkspaceVisibility();
    }

    function normalizeOutlineSlides(slides) {
      if (!Array.isArray(slides)) return [];
      return slides.map((slide, index) => ({
        ...slide,
        title: String(slide?.title || "第 " + (index + 1) + " 页").trim(),
        bullets: Array.isArray(slide?.bullets)
          ? slide.bullets.map((bullet) => String(bullet).trim()).filter(Boolean)
          : []
      }));
    }

    function renderOutlineSummary(slides, status = slides.length ? "待确认" : "等待大纲") {
      const bulletCount = slides.reduce((sum, slide) => sum + (slide.bullets || []).length, 0);
      outlineSummaryEl.innerHTML = ''
        + '<div class="outline-stat"><span>大纲确认</span><strong>' + status + '</strong></div>'
        + '<div class="outline-stat"><span>当前状态</span><strong>' + (status === '生成中' ? '正在生成' : (slides.length ? '可编辑' : '未开始')) + '</strong></div>'
        + '<div class="outline-stat"><span>页数</span><strong>' + slides.length + '</strong></div>'
        + '<div class="outline-stat"><span>可编辑要点</span><strong>' + bulletCount + '</strong></div>';
    }

    function renderOutlineLoading() {
      state.outlineSlides = [];
      outlineEditorEl.value = "";
      renderOutlineSummary([], "生成中");
      outlineBoardEl.innerHTML = ''
        + '<div class="outline-loading" role="status" aria-live="polite">'
        + '<div><div class="loading-spinner" aria-hidden="true"></div>'
        + '<strong>正在生成大纲</strong>'
        + '<span>系统正在分析主题、拆分页数并组织每页要点。</span>'
        + '<div class="loading-steps">'
        + '<div class="loading-step is-active">理解主题和文档内容</div>'
        + '<div class="loading-step">规划页面结构</div>'
        + '<div class="loading-step">整理标题和要点</div>'
        + '</div></div></div>';
    }

    function outlineCardHtml(slide, index, revealing = false) {
      return '<article class="outline-card ' + (revealing ? 'is-revealing' : '') + '" data-outline-index="' + index + '">'
        + '<div class="outline-card-head">'
        + '<div class="outline-index">' + (index + 1) + '</div>'
        + '<div><label for="outline-title-' + index + '">页面标题</label>'
        + '<input id="outline-title-' + index + '" class="outline-title-input" data-outline-title="' + index + '" value="' + escapeHtml(slide.title) + '" /></div>'
        + '</div>'
        + '<label for="outline-bullets-' + index + '">页面要点</label>'
        + '<textarea id="outline-bullets-' + index + '" class="outline-bullets-input" data-outline-bullets="' + index + '">' + escapeHtml((slide.bullets || []).join("\\n")) + '</textarea>'
        + '<div class="outline-card-meta"><span>每行一个要点</span><span>' + (slide.bullets || []).length + ' 个要点</span></div>'
      + '</article>';
    }

    function bindOutlineCardInputs(root = outlineBoardEl) {
      root.querySelectorAll("[data-outline-title], [data-outline-bullets]").forEach((field) => {
        field.addEventListener("input", syncOutlineFromCards);
      });
    }

    function renderOutlineBoard(slides, options = {}) {
      state.outlineSlides = normalizeOutlineSlides(slides);
      outlineEditorEl.value = JSON.stringify(state.outlineSlides, null, 2);
      renderOutlineSummary(state.outlineSlides);
      if (!state.outlineSlides.length) {
        outlineBoardEl.innerHTML = '<div class="outline-empty"><div><strong>先生成大纲</strong><span>生成后会以每页卡片展示，直接修改标题和要点即可。</span></div></div>';
        return;
      }
      if (options.stagger) {
        revealOutlineCards(state.outlineSlides);
        return;
      }
      outlineBoardEl.innerHTML = '<div class="outline-card-list">' + state.outlineSlides.map((slide, index) => outlineCardHtml(slide, index)).join("") + '</div>';
      bindOutlineCardInputs();
    }

    function revealOutlineCards(slides) {
      outlineBoardEl.innerHTML = '<div class="outline-card-list" data-outline-reveal-list></div>';
      const listEl = outlineBoardEl.querySelector("[data-outline-reveal-list]");
      slides.forEach((slide, index) => {
        setTimeout(() => {
          listEl.insertAdjacentHTML("beforeend", outlineCardHtml(slide, index, true));
          const latest = listEl.lastElementChild;
          if (latest) {
            bindOutlineCardInputs(latest);
            latest.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, index * OUTLINE_REVEAL_INTERVAL_MS);
      });
    }

    function readOutlineSlidesFromCards() {
      const cards = [...outlineBoardEl.querySelectorAll("[data-outline-index]")];
      if (!cards.length) return normalizeOutlineSlides(JSON.parse(outlineEditorEl.value || "[]"));
      return cards.map((card, index) => {
        const source = state.outlineSlides[index] || {};
        const title = card.querySelector("[data-outline-title]")?.value.trim() || "第 " + (index + 1) + " 页";
        const bullets = String(card.querySelector("[data-outline-bullets]")?.value || "")
          .split(/\\r?\\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        return { ...source, title, bullets };
      });
    }

    function syncOutlineFromCards() {
      state.outlineSlides = readOutlineSlidesFromCards();
      outlineEditorEl.value = JSON.stringify(state.outlineSlides, null, 2);
      renderOutlineSummary(state.outlineSlides);
    }

    function requireEditableOutlineSlides() {
      if (!state.outlineId) throw new Error("请先生成大纲");
      syncOutlineFromCards();
      const slides = normalizeOutlineSlides(state.outlineSlides);
      if (!slides.length) throw new Error("请先生成大纲");
      if (slides.some((slide) => !slide.title || !slide.bullets.length)) {
        throw new Error("每页都需要标题和至少一个要点");
      }
      return slides;
    }

    function stopTaskPoll() {
      if (taskPollTimeout) {
        clearTimeout(taskPollTimeout);
        taskPollTimeout = null;
      }
    }

    function setDeckGenerationBusy(isBusy) {
      const button = document.querySelector("#generate-deck");
      button.disabled = isBusy;
      button.textContent = isBusy ? "生成中..." : "应用当前模板生成 PPT";
    }

    function setSlideRegenerationBusy(isBusy) {
      const button = document.querySelector("#regenerate-slide");
      button.disabled = isBusy;
      button.textContent = isBusy ? "AI 润色中..." : "AI 润色本页";
    }

    async function pollTaskProgress(taskId) {
      stopTaskPoll();
      if (!taskId) return;
      try {
        const response = await fetch("/api/ppt/tasks/" + taskId);
        const payload = await response.json();
        if (!response.ok) throw new Error(formatApiError(payload));

        const task = payload.task;
        updateDeckGeneratingPreview({ progress: task.progress, slides: state.outlineSlides });
        statusEl.textContent = "任务状态: " + task.status + "\\n"
          + "进度: " + task.progress + "%\\n"
          + "重试: " + (task.retryable ? "可重试" : "不可重试") + "\\n"
          + "失败信息: " + (task.error || "");

        if (task.status === "running" || task.status === "pending") {
          taskPollTimeout = setTimeout(() => {
            pollTaskProgress(taskId);
          }, 300);
          return;
        }

        if (task.status === "succeeded") {
          state.deckId = task.deckId || state.deckId;
          if (state.deckId) {
            await waitForDeckLoadingRhythm(state.outlineSlides);
            renderDeckPreviewFrame(state.deckId);
            setFlowStage("preview");
            setDeckGenerationBusy(false);
            await loadBalance();
            await loadAssets();
          }
          return;
        }
        setDeckGenerationBusy(false);
      } catch (error) {
        setDeckGenerationBusy(false);
        statusEl.textContent = error.message;
      }
    }

    function showTaskStatus(task) {
      statusEl.textContent = JSON.stringify(task, null, 2);
    }

    function setWorkspacePage(page) {
      const nextPage = workspacePages.has(page) ? page : "create";
      document.body.dataset.workspacePage = nextPage;
      pageButtons.forEach((button) => {
        const selected = button.dataset.pageTarget === nextPage;
        button.setAttribute("aria-selected", selected ? "true" : "false");
      });
      applyWorkspaceVisibility();
      if (location.hash.slice(1) !== nextPage) history.replaceState(null, "", "#" + nextPage);
    }

    function applyWorkspaceVisibility() {
      const currentPage = document.body.dataset.workspacePage || "create";
      document.querySelectorAll("[data-page-panel]").forEach((element) => {
        const pages = String(element.dataset.pagePanel || "").split(/\\s+/);
        const flowPanels = String(element.dataset.flowPanel || "").split(/\\s+/);
        const pageVisible = pages.includes(currentPage);
        const stageVisible = currentPage !== "create"
          || !element.dataset.flowPanel
          || flowPanels.includes(flowStage);
        element.classList.toggle("is-hidden", !pageVisible || !stageVisible);
      });
    }

    loadBalance();
    loadAssets();
    loadTemplateCategories();
    pageButtons.forEach((button) => {
      button.addEventListener("click", () => setWorkspacePage(button.dataset.pageTarget));
    });
    setWorkspacePage(location.hash.slice(1) || "create");
    setFlowStage("input");
    document.querySelector("#template").addEventListener("change", () => {
      renderThemeOptions();
      renderTemplateGallery();
    });
    document.querySelector("#theme").addEventListener("change", renderTemplateGallery);
    document.querySelector("#template-category").addEventListener("change", loadTemplates);
    document.querySelector("#upload-personal-template").addEventListener("click", uploadPersonalTemplate);
    document.querySelector("#delete-personal-template").addEventListener("click", deleteSelectedPersonalTemplate);
    outlineEditorEl.addEventListener("change", () => {
      try {
        renderOutlineBoard(JSON.parse(outlineEditorEl.value || "[]"));
      } catch (error) {
        statusEl.textContent = "大纲 JSON 格式错误: " + error.message;
      }
    });
    loadTemplates();
    document.querySelector("#generate-outline").addEventListener("click", async () => {
      const generateButton = document.querySelector("#generate-outline");
      try {
        generateButton.disabled = true;
        generateButton.textContent = "生成中...";
        setFlowStage("outline");
        renderOutlineLoading();
        statusEl.textContent = "正在生成大纲...";
        let sourceFileId;
        const documentText = document.querySelector("#document").value.trim();
        if (documentText) {
          const uploaded = await json("/api/files", {
            file_name: "source.txt",
            mime_type: "text/plain",
            content_base64: btoa(unescape(encodeURIComponent(documentText)))
          });
          sourceFileId = uploaded.file.id;
        }
        const data = await json("/api/ppt/outlines", {
          topic: document.querySelector("#topic").value,
          source_file_id: sourceFileId,
          slide_count: Number(document.querySelector("#slide-count").value),
          template_id: document.querySelector("#template").value,
          theme: document.querySelector("#theme").value
        });
        state.outlineId = data.outline.id;
        renderOutlineBoard(data.outline.slides, { stagger: true });
        setFlowStage("outline");
        statusEl.textContent = JSON.stringify(data.outline, null, 2);
      } catch (error) {
        outlineBoardEl.innerHTML = '<div class="outline-empty"><div><strong>生成大纲失败</strong><span>' + escapeHtml(error.message) + '</span></div></div>';
        renderOutlineSummary([], "生成失败");
        statusEl.textContent = error.message;
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = "生成大纲";
      }
    });
    document.querySelector("#save-outline").addEventListener("click", async () => {
      try {
        const slides = requireEditableOutlineSlides();
        const data = await json("/api/ppt/outlines/" + state.outlineId, {
          slides
        }, "PATCH");
        renderOutlineBoard(data.outline.slides);
        setFlowStage("preview");
        statusEl.textContent = JSON.stringify(data.outline, null, 2);
      } catch (error) { statusEl.textContent = error.message; }
    });
    document.querySelector("#generate-deck").addEventListener("click", async () => {
      let shouldReleaseButton = true;
      try {
        setDeckGenerationBusy(true);
        const slides = requireEditableOutlineSlides();
        const edited = await json("/api/ppt/outlines/" + state.outlineId, { slides }, "PATCH");
        renderOutlineBoard(edited.outline.slides);
        setFlowStage("preview");
        renderDeckGeneratingPreview(edited.outline.slides);
        statusEl.textContent = "正在应用当前模板生成 PPT...";
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const data = await json("/api/ppt/decks", {
          outline_id: state.outlineId,
          template_id: document.querySelector("#template").value,
          theme: document.querySelector("#theme").value,
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        state.deckId = data.deck.id;
        state.taskId = data.task.id;
        showTaskStatus(data.task);
        updateDeckGeneratingPreview({ progress: data.task.progress, slides: state.outlineSlides });
        pollTaskProgress(state.taskId);
        if (data.task.status === "succeeded" && state.deckId) {
          await waitForDeckLoadingRhythm(state.outlineSlides);
          renderDeckPreviewFrame(state.deckId);
          setFlowStage("preview");
          await loadBalance();
          await loadAssets();
        } else {
          shouldReleaseButton = false;
        }
        await loadBalance();
      } catch (error) {
        try {
          const parsed = JSON.parse(error.message);
          state.taskId = parsed.error?.details?.task_id || state.taskId;
        } catch {}
        previewEl.classList.remove("is-deck-loaded");
        previewEl.innerHTML = '<div class="empty-preview"><div class="empty-slide"><h3>生成 PPT 失败</h3><p>' + escapeHtml(error.message) + '</p><div class="empty-line"></div></div></div>';
        statusEl.textContent = error.message;
      } finally {
        if (shouldReleaseButton) setDeckGenerationBusy(false);
      }
    });
    document.querySelector("#retry-task").addEventListener("click", async () => {
      try {
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const data = await json("/api/ppt/tasks/" + state.taskId + "/retry", {
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        state.deckId = data.deck.id;
        state.taskId = data.task.id;
        showTaskStatus(data.task);
        pollTaskProgress(state.taskId);
        if (data.task.status === "succeeded" && state.deckId) {
          renderDeckPreviewFrame(state.deckId);
          setFlowStage("preview");
          await loadBalance();
          await loadAssets();
        }
        await loadBalance();
      } catch (error) { statusEl.textContent = error.message; }
    });
    document.querySelector("#regenerate-slide").addEventListener("click", async () => {
      try {
        if (!state.deckId) throw new Error("请先应用模板生成 PPT，再使用 AI 润色单页");
        setSlideRegenerationBusy(true);
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const slideId = state.selectedSlideId;
        const instruction = document.querySelector("#slide-instruction").value.trim();
        if (!slideId) throw new Error("请先用鼠标在在线预览中选择要润色的页面");
        if (!instruction) throw new Error("请输入 AI 润色建议");
        statusEl.textContent = "AI 正在润色第 " + (state.selectedSlideNumber || slideId) + " 页...";
        const data = await json("/api/ppt/decks/" + state.deckId + "/slides/" + slideId + "/regenerate", {
          instruction,
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        statusEl.textContent = JSON.stringify(data.slide, null, 2);
        renderDeckPreviewFrame(state.deckId);
        await loadBalance();
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        setSlideRegenerationBusy(false);
      }
    });
    async function exportDeck(format) {
      try {
        if (!state.deckId) throw new Error("请先应用模板生成 PPT，再下载文件");
        const data = await json("/api/ppt/decks/" + state.deckId + "/exports", { format });
        statusEl.textContent = JSON.stringify(data.file, null, 2);
        window.location.href = "/api/files/" + data.file.id;
      } catch (error) { statusEl.textContent = error.message; }
    }
    document.querySelector("#export-pptx").addEventListener("click", () => exportDeck("pptx"));
    document.querySelector("#export-pdf").addEventListener("click", () => exportDeck("pdf"));
  </script>
</body>
</html>`;
}
