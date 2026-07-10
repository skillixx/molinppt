import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

import { AppError, normalizeError } from "./errors.js";
import { MetricsRegistry } from "./metrics.js";

// 工作台模板卡片直接复用 dome.pptx 提取出的封面图，让用户选模板时看到真实帆船红金视觉。
const DOME_TEMPLATE_THUMBNAIL = readFileSync(new URL("../../templates/official/business/business/modern/assets/dome-cover.jpg", import.meta.url)).toString("base64");
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
        sendJson(response, { categories: dependencies.templateManager.listCategories({ ownerUserId }) });
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

      if (request.method === "PATCH" && url.pathname.match(/^\/api\/ppt\/decks\/[^/]+\/template$/)) {
        const deckId = url.pathname.split("/")[4];
        const body = await readJson(request);
        const deck = await dependencies.pptService.applyTemplateToDeck({
          ownerUserId,
          deckId,
          templateId: body.template_id,
          theme: body.theme,
        });
        sendJson(response, { deck });
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
  const slideCountOptions = Array.from({ length: 32 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}"${value === 6 ? " selected" : ""}>${value} 页</option>`;
  }).join("");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI PPT 工作台</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef3f8;
      --surface: #ffffff;
      --surface-soft: #f7f9fc;
      --line: #d8e2ee;
      --line-strong: #bdcadb;
      --text: #101828;
      --muted: #667085;
      --subtle: #8a99ad;
      --primary: #1f5eff;
      --primary-strong: #1746c8;
      --primary-soft: #eaf1ff;
      --teal: #0f7f7a;
      --warning: #b45309;
      --success: #15803d;
      --shadow: 0 22px 58px rgba(16, 24, 40, .10);
      --shadow-soft: 0 12px 30px rgba(16, 24, 40, .07);
      --dome-template-thumb:url("data:image/jpeg;base64,${DOME_TEMPLATE_THUMBNAIL}");
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background:
      linear-gradient(180deg, #f8fbff 0%, #eef3f8 42%, #eef3f8 100%);
      color: var(--text);
    }
    body::before { content: ""; position: fixed; inset: 0 0 auto; height: 320px; background:
      linear-gradient(115deg, rgba(31,94,255,.10) 0 28%, transparent 28% 100%),
      linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(238,243,248,0) 100%);
      pointer-events: none;
    }
    header {
      position: sticky; top: 0; z-index: 10;
      min-height: 78px; display: flex; align-items: center; justify-content: space-between; gap: 22px;
      padding: 14px 30px; background: rgba(255,255,255,.90); border-bottom: 1px solid rgba(216,226,238,.86);
      backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(16,24,40,.05);
    }
    h1 { font-size: 22px; line-height: 1.15; margin: 0; letter-spacing: 0; }
    h2 { font-size: 15px; line-height: 1.25; margin: 0; letter-spacing: 0; }
    label { display: block; font-size: 12px; font-weight: 800; color: #344054; margin: 14px 0 7px; }
    input, textarea, select, button { font: inherit; box-sizing: border-box; }
    input, textarea, select {
      width: 100%; min-height: 44px; border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px;
      background: rgba(255,255,255,.96); color: var(--text); outline: none; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
    }
    input:hover, textarea:hover, select:hover { background: #fff; border-color: #c6d3e3; }
    input:focus, textarea:focus, select:focus { border-color: rgba(31,94,255,.72); box-shadow: 0 0 0 4px rgba(31,94,255,.12); background: #fff; }
    input[type="file"] { padding: 8px; color: var(--muted); font-size: 12px; }
    input[type="file"]::file-selector-button { border: 1px solid #cfe0ff; border-radius: 7px; background: #eef4ff; color: #1d4ed8; padding: 7px 10px; margin-right: 8px; font-weight: 700; cursor: pointer; }
    textarea { min-height: 96px; resize: vertical; line-height: 1.55; }
    button {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      border: 0; border-radius: 10px; padding: 11px 15px; background: linear-gradient(135deg, var(--primary), #3b82f6); color: white;
      cursor: pointer; font-weight: 800; font-size: 13px; transition: transform .12s ease, background .16s ease, box-shadow .16s ease, border-color .16s ease;
      box-shadow: 0 10px 22px rgba(31,94,255,.18);
    }
    button:hover { background: linear-gradient(135deg, var(--primary-strong), #2563eb); box-shadow: 0 14px 28px rgba(31,94,255,.24); transform: translateY(-1px); }
    button:disabled { cursor: not-allowed; opacity: .62; transform: none; box-shadow: none; }
    button.is-waiting { position: relative; overflow: hidden; opacity: .92; box-shadow: 0 14px 30px rgba(31,94,255,.20); }
    button.is-waiting::after {
      content: ""; position: absolute; inset: 0; transform: translateX(-120%);
      background: linear-gradient(110deg, transparent 0 28%, rgba(255,255,255,.34) 48%, transparent 70% 100%);
      animation: button-waiting-sheen 1.25s ease-in-out infinite; pointer-events: none;
    }
    button.secondary { background: #fff; color: #1d4ed8; border: 1px solid #c9d9f4; box-shadow: 0 8px 18px rgba(16,24,40,.05); }
    button.secondary:hover { background: #f3f7ff; border-color: #b8ccf0; box-shadow: 0 10px 20px rgba(16,24,40,.07); }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #101828, #243b68); color: white; font-weight: 900; box-shadow: 0 12px 24px rgba(16,24,40,.18); }
    .brand-subtitle { margin-top: 5px; color: var(--muted); font-size: 12px; }
    .page-nav { display: flex; align-items: center; gap: 6px; padding: 6px; border: 1px solid var(--line); border-radius: 12px; background: rgba(248,251,255,.92); box-shadow: inset 0 1px 0 rgba(255,255,255,.8); }
    .page-nav button { min-height: 38px; padding: 0 15px; border-radius: 9px; background: transparent; color: var(--muted); box-shadow: none; font-size: 13px; }
    .page-nav button:hover { background: #edf4ff; color: var(--primary); box-shadow: none; transform: none; }
    body[data-workspace-page="create"] [data-page-target="create"],
    body[data-workspace-page="templates"] [data-page-target="templates"],
    body[data-workspace-page="assets"] [data-page-target="assets"],
    body[data-workspace-page="status"] [data-page-target="status"] {
      background: linear-gradient(135deg, var(--primary), #3b82f6); color: #fff; box-shadow: 0 10px 22px rgba(31,94,255,.22);
    }
    .top-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .status-chip { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--muted); font-size: 12px; font-weight: 750; box-shadow: 0 8px 18px rgba(16,24,40,.05); }
    .status-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--success); }
    main { position: relative; display: grid; grid-template-columns: minmax(320px, 390px) minmax(520px, 1fr) minmax(300px, 360px); gap: 22px; padding: 24px; max-width: 1720px; margin: 0 auto; }
    body[data-workspace-page="create"][data-flow-stage="input"] main { grid-template-columns: minmax(0, 760px); justify-content: center; align-items: start; padding-top: 34px; }
    body[data-workspace-page="create"][data-flow-stage="outline"] main { grid-template-columns: minmax(0, 1180px); justify-content: center; align-items: start; }
    body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: minmax(300px, 360px) minmax(640px, 1fr) minmax(280px, 340px); }
    body[data-workspace-page="templates"] main { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="templates"] .workflow { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="templates"] .template-gallery-wrap { width: 100%; }
    body[data-workspace-page="templates"] .panel { box-shadow: none; }
    body[data-workspace-page="status"] main { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="status"] .context { grid-template-columns: minmax(0, 1fr); }
    .preview-shell, .outline-shell, .panel { background: rgba(255,255,255,.96); border: 1px solid rgba(216,226,238,.96); border-radius: 14px; box-shadow: var(--shadow); }
    .workflow, .context { display: grid; gap: 16px; align-content: start; }
    .panel { padding: 18px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .panel-title { display: flex; align-items: center; gap: 8px; }
    .step-number { display: grid; place-items: center; width: 27px; height: 27px; border-radius: 9px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 900; }
    .panel-note { color: var(--muted); font-size: 12px; line-height: 1.55; margin: -4px 0 12px; }
    .hint { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: #6b7280; }
    .hint.warning { color: var(--warning); }
    .flow-guide { display: grid; gap: 8px; margin-bottom: 14px; }
    .flow-step {
      display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: start;
      padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff;
    }
    .flow-step strong { display: block; color: var(--text); font-size: 13px; }
    .flow-step span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .flow-step.is-active { border-color: #b8ccf0; background: linear-gradient(135deg, #fff, #f2f7ff); box-shadow: 0 12px 26px rgba(31,94,255,.08); }
    .flow-dot { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 999px; background: var(--primary-soft); color: var(--primary); font-size: 12px; font-weight: 900; }
    .stage-empty { min-height: 520px; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--muted); background: linear-gradient(135deg, #fff, #f4f8ff); border: 1px dashed #bfd0e6; border-radius: 14px; }
    .stage-empty strong { display: block; margin-bottom: 8px; color: #1e3a8a; font-size: 22px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .workflow,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow { width: 100%; }
    body[data-workspace-page="create"][data-flow-stage="input"] .workflow > .panel[data-flow-panel~="input"],
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow > .panel[data-flow-panel~="outline"] {
      position: relative; overflow: hidden; padding: 32px; border-color: #cfe0ff;
      background:
        linear-gradient(135deg, rgba(255,255,255,.98), rgba(242,247,255,.96)),
        repeating-linear-gradient(90deg, rgba(31,94,255,.035) 0 1px, transparent 1px 36px);
      box-shadow: 0 30px 78px rgba(31,94,255,.13);
    }
    body[data-workspace-page="create"][data-flow-stage="input"] .workflow > .panel[data-flow-panel~="input"]::after,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow > .panel[data-flow-panel~="outline"]::after {
      content: ""; position: absolute; right: -30px; top: 0; width: 260px; height: 100%;
      background: linear-gradient(115deg, transparent 0 38%, rgba(31,94,255,.08) 38% 58%, transparent 58% 100%); pointer-events: none;
    }
    body[data-workspace-page="create"][data-flow-stage="input"] .workflow > .panel[data-flow-panel~="input"] > *,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow > .panel[data-flow-panel~="outline"] > * { position: relative; z-index: 1; }
    body[data-workspace-page="create"][data-flow-stage="input"] .panel-head,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow .panel-head { justify-content: center; text-align: center; margin-bottom: 18px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .panel-title,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow .panel-title { justify-content: center; }
    body[data-workspace-page="create"][data-flow-stage="input"] .panel-title h2,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow .panel-title h2 { font-size: 22px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .panel-note,
    body[data-workspace-page="create"][data-flow-stage="outline"] .workflow .panel-note { max-width: 560px; margin: 0 auto 18px; text-align: center; font-size: 13px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .flow-guide,
    body[data-workspace-page="create"][data-flow-stage="outline"] .flow-guide { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .flow-step,
    body[data-workspace-page="create"][data-flow-stage="outline"] .flow-step { display: grid; grid-template-columns: 1fr; justify-items: center; text-align: center; min-height: 108px; padding: 12px 10px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .flow-step span,
    body[data-workspace-page="create"][data-flow-stage="outline"] .flow-step span { font-size: 11px; }
    body[data-workspace-page="create"][data-flow-stage="input"] #topic,
    body[data-workspace-page="create"][data-flow-stage="outline"] #topic { min-height: 122px; font-size: 16px; line-height: 1.65; }
    body[data-workspace-page="create"][data-flow-stage="input"] .primary-action,
    body[data-workspace-page="create"][data-flow-stage="outline"] .primary-action { max-width: 286px; margin: 8px auto 0; min-height: 50px; font-size: 14px; }
    body[data-workspace-page="create"][data-flow-stage="input"] .outline-shell[data-flow-panel="input"] { display: none !important; }
    body[data-workspace-page="create"][data-flow-stage="outline"] .outline-shell { margin-top: 18px; }
    body[data-workspace-page="create"][data-flow-stage="outline"] .context { display: none !important; }
    .template-browser-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; padding: 6px 0 2px; }
    .template-browser-head h2 { margin: 0; font-size: 23px; color: #0f172a; letter-spacing: 0; }
    .template-search { flex: 1 1 360px; max-width: 520px; display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 14px; border: 1px solid #dbe5f2; border-radius: 999px; background: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.72), 0 8px 18px rgba(16,24,40,.05); }
    .template-search span { flex: 0 0 auto; color: #64748b; font-size: 14px; font-weight: 850; }
    .template-search input { min-width: 0; width: 100%; height: 34px; border: 0; outline: 0; background: transparent; color: #0f172a; font-size: 13px; }
    .template-search input::placeholder { color: #94a3b8; }
    .template-gallery-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 12px 0 18px; border-bottom: 1px solid #edf2f7; }
    .template-gallery-title { font-size: 12px; color: var(--muted); }
    #template-scope,
    label[for="template-scope"],
    .template-manage-split,
    .template-manage-split ~ .panel-head,
    .template-manage-split ~ .row,
    .template-manage-split ~ .actions { display: none !important; }
    .template-gallery-count { font-size: 12px; color: #475569; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 6px 11px; white-space: nowrap; box-shadow: 0 8px 18px rgba(16,24,40,.05); }
    .template-category-tabs { display: flex; align-items: center; gap: 30px; min-height: 38px; overflow-x: auto; scrollbar-width: thin; }
    .template-category-tab {
      position: relative; flex: 0 0 auto; min-height: 38px; padding: 0; border-radius: 0; background: transparent; color: #374151;
      box-shadow: none; transform: none; font-size: 14px; font-weight: 650;
    }
    .template-category-tab:hover { background: transparent; color: #6d28d9; box-shadow: none; transform: none; }
    .template-category-tab[aria-selected="true"] { color: #111827; }
    .template-category-tab[aria-selected="true"]::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 999px; background: #7c3aed;
    }
    .template-more-link {
      flex: 0 0 auto; min-height: 38px; padding: 0; border-radius: 0; background: transparent; color: #4b5563;
      box-shadow: none; transform: none; font-size: 13px; font-weight: 650;
    }
    .template-more-link:hover { background: transparent; color: #6d28d9; box-shadow: none; transform: none; }
    .template-gallery-wrap { border: 0; border-radius: 8px; padding: 0; background: transparent; }
    .template-gallery { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px 32px; margin-top: 0; }
    .template-category-preview-head { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid #e5edf7; border-radius: 12px; background: linear-gradient(135deg, #fff, #f6f9ff); }
    .template-category-preview-head strong { display: block; color: #0f172a; font-size: 15px; }
    .template-category-preview-head span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
    .template-category-preview-actions { grid-column: 1 / -1; display: flex; justify-content: center; padding: 2px 0 4px; }
    .template-category-more-button { min-width: 220px; min-height: 42px; border-radius: 999px; background: #fff; color: #1d4ed8; border: 1px solid #c9d9f4; box-shadow: 0 10px 22px rgba(31,94,255,.08); }
    .template-category-more-button:hover { background: #f3f7ff; border-color: #b8ccf0; box-shadow: 0 14px 28px rgba(31,94,255,.12); }
    .template-category-block { border: 1px solid var(--line); border-radius: 14px; background: #fff; padding: 14px; box-shadow: var(--shadow); }
    .template-category-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; padding-bottom: 10px; border-bottom: 1px solid #e8eef7; }
    .template-category-head h3 { margin: 0; font-size: 13px; letter-spacing: 0; color: #1e3a8a; font-weight: 800; }
    .template-category-subtle { font-size: 11px; color: var(--muted); }
    .template-category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .template-manage-split { height: 8px; }
    .template-card {
      display: grid; gap: 13px; width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px;
      background: #fff; color: var(--text); text-align: center; box-shadow: 0 12px 28px rgba(16,24,40,.05); transform: none;
    }
    .template-card:hover { background: #fff; border-color: #b8ccf0; box-shadow: 0 18px 38px rgba(31,94,255,.12); transform: translateY(-2px); }
    .template-card[aria-selected="true"] { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(31,94,255,.12), 0 18px 38px rgba(31,94,255,.12); }
    .template-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .template-card-title { display: block; min-width: 0; padding: 0 6px 8px; font-size: 15px; font-weight: 650; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .template-card-scope { flex: 0 0 auto; min-height: 22px; display: inline-flex; align-items: center; padding: 0 7px; border-radius: 999px; background: #eef4ff; color: #1d4ed8; font-size: 11px; font-weight: 800; }
    .selected-template-preview {
      display: grid; gap: 14px; align-content: start; min-height: 360px; padding: 16px; border: 1px solid var(--line);
      border-radius: 14px; background: rgba(255,255,255,.96); box-shadow: var(--shadow);
    }
    .selected-template-preview-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .selected-template-preview-title { display: grid; gap: 4px; min-width: 0; }
    .selected-template-preview-title strong { color: #0f172a; font-size: 15px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .selected-template-preview-title span { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .selected-template-preview-badge { flex: 0 0 auto; border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; color: #1d4ed8; padding: 4px 9px; font-size: 12px; font-weight: 800; }
    .selected-template-preview-empty { min-height: 280px; display: grid; place-items: center; border: 1px dashed #bfd0e6; border-radius: 12px; color: var(--muted); background: linear-gradient(135deg, #fff, #f4f8ff); font-size: 13px; }
    .selected-template-preview .template-thumb { border-radius: 8px; box-shadow: 0 18px 42px rgba(15,23,42,.12); }
    .create-template-list-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-top: 2px; border-top: 1px solid #edf2f7; }
    .create-template-list-title { display: grid; gap: 3px; min-width: 0; }
    .create-template-list-title strong { color: #0f172a; font-size: 14px; line-height: 1.35; }
    .create-template-list-title span { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .create-template-list-count { flex: 0 0 auto; border: 1px solid #dbeafe; border-radius: 999px; background: #f8fbff; color: #1d4ed8; padding: 4px 8px; font-size: 11px; font-weight: 800; white-space: nowrap; }
    .create-template-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .create-template-grid .template-card { gap: 10px; padding: 9px; text-align: left; border-radius: 12px; }
    .create-template-grid .template-card-title { padding: 0 3px 2px; font-size: 13px; line-height: 1.35; }
    .create-template-grid .template-card-meta { padding: 0 3px 1px; }
    .create-template-grid .template-thumb { box-shadow: 0 12px 28px rgba(15,23,42,.10); }
    .create-template-more { min-height: 38px; border-radius: 12px; border: 1px solid #c9d9f4; background: #f8fbff; color: #1d4ed8; font-size: 13px; font-weight: 800; }
    .create-template-more:hover { background: #eef5ff; border-color: #b8ccf0; }
    .template-thumb {
      position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 10px; border: 1px solid rgba(23,32,51,.08);
      background: var(--thumb-bg); color: var(--thumb-body); box-shadow: inset 0 0 0 1px rgba(255,255,255,.70), 0 12px 26px rgba(15,23,42,.08);
    }
    .template-thumb[data-has-thumbnail="true"] { background-image: var(--template-thumbnail); background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.30), 0 14px 28px rgba(15,23,42,.10); }
    .template-thumb[data-has-thumbnail="true"]::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(15,23,42,.10)); }
    .template-thumb[data-has-thumbnail="true"]::after,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-back,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-cover,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-band,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-content,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-image,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-accent,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-wave,
    .template-thumb[data-has-thumbnail="true"] .template-thumb-palette { display: none; }
    .template-thumb::before { content: ""; position: absolute; inset: 0; background:
      radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--thumb-accent) 24%, transparent), transparent 24%),
      linear-gradient(135deg, rgba(255,255,255,.86), rgba(255,255,255,.24)),
      repeating-linear-gradient(90deg, rgba(15,23,42,.035) 0 1px, transparent 1px 30px),
      var(--thumb-bg); }
    .template-thumb::after { content: ""; position: absolute; z-index: 1; inset: 7% 5% 10%; border-radius: 8px; border: 1px solid rgba(15,23,42,.07); background: rgba(255,255,255,.64); box-shadow: 0 16px 28px rgba(15,23,42,.11); }
    .template-thumb-back { position: absolute; z-index: 2; overflow: hidden; border-radius: 7px; border: 1px solid rgba(15,23,42,.07); background: var(--thumb-surface); box-shadow: 0 12px 22px rgba(15,23,42,.10); }
    .template-thumb-back::before { content: ""; position: absolute; left: 6%; top: 10%; width: 16%; height: 72%; border-radius: 5px; background:
      linear-gradient(var(--thumb-primary), var(--thumb-primary)) 50% 8% / 42% 5% no-repeat,
      linear-gradient(var(--thumb-accent), var(--thumb-accent)) 50% 30% / 52% 4% no-repeat,
      linear-gradient(var(--thumb-primary), var(--thumb-primary)) 50% 52% / 48% 4% no-repeat,
      linear-gradient(color-mix(in srgb, var(--thumb-body) 20%, #ffffff 80%), color-mix(in srgb, var(--thumb-body) 20%, #ffffff 80%));
      opacity: .72; }
    .template-thumb-back::after { content: ""; position: absolute; right: 7%; top: 14%; width: 22%; height: 58%; border-radius: 5px; background:
      linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 72%, #ffffff 28%), color-mix(in srgb, var(--thumb-accent) 70%, #ffffff 30%));
      box-shadow: -34px 16px 0 -9px rgba(255,255,255,.72), -56px 29px 0 -18px color-mix(in srgb, var(--thumb-accent) 48%, #ffffff 52%); opacity: .80; }
    .template-thumb-back-left { inset: 8% auto 15% 5%; width: 58%; transform: translateX(-1%); background:
      linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 76%, #ffffff 24%) 0 16%, rgba(255,255,255,.96) 16%),
      repeating-linear-gradient(0deg, rgba(15,23,42,.07) 0 1px, transparent 1px 18px); }
    .template-thumb-back-right { inset: 10% 5% 13% auto; width: 58%; background:
      linear-gradient(180deg, rgba(255,255,255,.94) 0 20%, color-mix(in srgb, var(--thumb-bg) 82%, #ffffff 18%) 20%),
      repeating-linear-gradient(90deg, rgba(15,23,42,.055) 0 1px, transparent 1px 22px); }
    /* 缩略图模拟真实封面层级：大标题、章节、摘要和标签都直接呈现。 */
    .template-thumb-cover { position: absolute; z-index: 8; left: var(--thumb-cover-left); right: var(--thumb-cover-right); top: var(--thumb-cover-top); bottom: 19%; display: grid; align-content: center; gap: 4px; padding: 7% 11%; border-radius: 8px; background:
      linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 92%, #111827 8%), color-mix(in srgb, var(--thumb-primary) 70%, var(--thumb-accent) 30%));
      box-shadow: 0 18px 32px rgba(15,23,42,.22); }
    .template-thumb-cover::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background:
      radial-gradient(circle at 92% 12%, rgba(255,255,255,.20), transparent 24%),
      linear-gradient(115deg, transparent 0 58%, rgba(255,255,255,.13) 58% 66%, transparent 66%);
      pointer-events: none; }
    .template-thumb-cover > span { position: relative; z-index: 1; }
    .template-thumb-date { display: block; color: color-mix(in srgb, var(--thumb-accent) 28%, #ffffff 72%); font-size: 10px; line-height: 1.1; font-weight: 800; letter-spacing: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .template-thumb-kicker { position: relative; display: block; margin-top: 1px; color: rgba(255,255,255,.76); font-size: 8px; line-height: 1.1; font-weight: 750; letter-spacing: 0; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* 一级标题优先完整展示，允许换行，避免被图片区和装饰元素挤压。 */
    .template-thumb-heading { position: relative; display: block; max-width: 100%; min-height: 38px; margin-top: 2px; color: #ffffff; font-size: 18px; line-height: 1.08; font-weight: 900; letter-spacing: 0; text-shadow: 0 2px 10px rgba(15,23,42,.18); white-space: normal; overflow: hidden; overflow-wrap: anywhere; word-break: break-word; }
    .template-thumb-summary { position: relative; display: grid; gap: 2px; margin-top: 2px; max-width: 82%; color: rgba(255,255,255,.86); font-size: 8px; line-height: 1.25; font-weight: 650; }
    .template-thumb-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .template-thumb-tag { position: relative; display: inline-flex; align-items: center; justify-content: center; width: max-content; max-width: 46%; min-height: 13px; margin-top: 3px; padding: 0 7px; border-radius: 999px; background: rgba(255,255,255,.90); color: var(--thumb-primary); font-size: 8px; line-height: 1; font-weight: 850; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .template-thumb-image { position: absolute; z-index: 3; right: 7%; top: var(--thumb-image-top); width: var(--thumb-image-width); height: 43%; overflow: hidden; border-radius: 7px; background:
      linear-gradient(135deg, rgba(255,255,255,.34), rgba(255,255,255,.08)),
      linear-gradient(135deg, color-mix(in srgb, var(--thumb-accent) 72%, #ffffff 28%), color-mix(in srgb, var(--thumb-primary) 62%, #000000 38%));
      box-shadow: 0 14px 22px rgba(15,23,42,.18); opacity: .64; }
    .template-thumb-image::before { content: ""; position: absolute; inset: 0; background:
      radial-gradient(circle at 74% 24%, rgba(255,255,255,.64), transparent 11%),
      linear-gradient(135deg, transparent 0 48%, rgba(255,255,255,.22) 48% 50%, transparent 50%),
      linear-gradient(160deg, rgba(255,255,255,.10), transparent); }
    .template-thumb-image::after { content: ""; position: absolute; left: 12%; right: 12%; bottom: 12%; height: 15%; border-radius: 999px; background: rgba(255,255,255,.58); }
    .template-thumb-band { position: absolute; z-index: 4; inset: auto 0 0 0; width: auto; height: 20%; background: linear-gradient(90deg, var(--thumb-primary), color-mix(in srgb, var(--thumb-primary) 72%, var(--thumb-accent) 28%)); }
    .template-thumb-accent { position: absolute; z-index: 3; right: 8%; top: 9%; width: 5%; height: 13%; border-radius: 999px; background: var(--thumb-accent); box-shadow: 0 8px 16px rgba(15,23,42,.12); opacity: .78; }
    .template-thumb-wave { position: absolute; z-index: 4; left: -4%; right: -4%; bottom: 2%; height: var(--thumb-wave-height); background:
      linear-gradient(135deg, rgba(255,255,255,.80), color-mix(in srgb, var(--thumb-accent) 55%, #ffffff 45%) 50%, color-mix(in srgb, var(--thumb-primary) 76%, #ffffff 24%));
      clip-path: polygon(0 55%, 14% 42%, 27% 52%, 43% 30%, 58% 48%, 73% 28%, 88% 43%, 100% 33%, 100% 100%, 0 100%); opacity: .86; }
    .template-thumb[data-layout="top-band"] .template-thumb-band { top: 0; bottom: auto; height: 20%; background: linear-gradient(90deg, rgba(255,255,255,.96), color-mix(in srgb, var(--thumb-accent) 60%, var(--thumb-title) 40%)); }
    .template-thumb[data-layout="top-band"] .template-thumb-cover { top: 26%; bottom: 16%; }
    .template-thumb[data-layout="status-report"] { background: linear-gradient(135deg, var(--thumb-bg), #ffffff 54%, color-mix(in srgb, var(--thumb-primary) 18%, var(--thumb-bg) 82%)); }
    .template-thumb[data-layout="status-report"]::before { background:
      repeating-linear-gradient(90deg, rgba(22,61,89,.035) 0 1px, transparent 1px 28px),
      linear-gradient(135deg, rgba(255,255,255,.88), rgba(255,255,255,.22)); }
    .template-thumb[data-layout="status-report"] .template-thumb-band { top: 0; bottom: auto; height: 19%; background: linear-gradient(90deg, var(--thumb-primary), color-mix(in srgb, var(--thumb-primary) 72%, var(--thumb-accent) 28%)); }
    .template-thumb[data-layout="status-report"] .template-thumb-cover { left: 9%; right: 27%; top: 24%; bottom: 18%; border-left: 4px solid var(--thumb-accent); }
    .template-thumb[data-layout="status-report"] .template-thumb-image { right: 8%; top: 28%; width: 20%; height: 35%; border-radius: 8px; background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 80%, #ffffff 20%), color-mix(in srgb, var(--thumb-accent) 55%, #ffffff 45%)); box-shadow: 0 12px 22px rgba(15,42,67,.18); }
    .template-thumb[data-layout="status-report"] .template-thumb-wave { height: 13%; background: linear-gradient(90deg, var(--thumb-primary), var(--thumb-accent), rgba(255,255,255,.80)); clip-path: polygon(0 54%, 100% 54%, 100% 65%, 0 65%); }
    .template-thumb[data-layout="hero"] .template-thumb-cover { left: 9%; right: 9%; top: 19%; bottom: 18%; background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 88%, #111827 12%), color-mix(in srgb, var(--thumb-accent) 76%, var(--thumb-primary) 24%)); }
    .template-thumb[data-layout="hero"] .template-thumb-image { right: 6%; top: 20%; height: 52%; }
    .template-thumb[data-layout="marketing"] { background: linear-gradient(135deg, var(--thumb-bg), #fff 50%, color-mix(in srgb, var(--thumb-primary) 16%, #fff 84%)); }
    .template-thumb[data-layout="marketing"]::before { background:
      radial-gradient(circle at 78% 24%, color-mix(in srgb, var(--thumb-accent) 34%, transparent), transparent 27%),
      radial-gradient(circle at 18% 78%, color-mix(in srgb, var(--thumb-primary) 16%, transparent), transparent 30%),
      repeating-linear-gradient(115deg, rgba(15,23,42,.035) 0 1px, transparent 1px 27px); }
    .template-thumb[data-layout="marketing"] .template-thumb-cover { left: 10%; right: 28%; top: 22%; bottom: 20%; border-radius: 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 88%, #111827 12%), color-mix(in srgb, var(--thumb-accent) 45%, var(--thumb-primary) 55%)); }
    .template-thumb[data-layout="marketing"] .template-thumb-image { right: 9%; top: 25%; width: 23%; height: 42%; border-radius: 15px; background: linear-gradient(135deg,#fff,color-mix(in srgb,var(--thumb-bg) 70%,#fff 30%)); box-shadow: 0 14px 24px rgba(15,23,42,.16); }
    .template-thumb[data-layout="marketing"] .template-thumb-wave { height: 22%; background: linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 80%, transparent), color-mix(in srgb, var(--thumb-accent) 72%, transparent)); clip-path: polygon(0 62%, 18% 48%, 35% 58%, 55% 40%, 76% 54%, 100% 38%, 100% 100%, 0 100%); }
    .template-thumb[data-layout="marketing"] .template-thumb-tag { background: var(--thumb-accent); color: #fff; }
    .template-thumb[data-layout="social-video-growth"] { background: linear-gradient(135deg, #f8fbff 0%, #ffffff 48%, #ecfdf5 100%); }
    .template-thumb[data-layout="social-video-growth"]::before { background:
      radial-gradient(circle at 78% 22%, color-mix(in srgb, var(--thumb-accent) 30%, transparent), transparent 26%),
      radial-gradient(circle at 15% 80%, color-mix(in srgb, var(--thumb-secondary) 22%, transparent), transparent 26%),
      repeating-linear-gradient(90deg, rgba(15,23,42,.04) 0 1px, transparent 1px 30px); }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-cover { left: 8%; right: 34%; top: 22%; bottom: 20%; border-radius: 18px; background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 92%, #000 8%), color-mix(in srgb, var(--thumb-primary) 72%, var(--thumb-secondary) 28%)); box-shadow: 0 16px 30px rgba(15,23,42,.16); }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-image { right: 10%; top: 20%; width: 21%; height: 52%; border-radius: 18px; background: linear-gradient(160deg, #111827, #1f2937); box-shadow: 0 16px 28px rgba(15,23,42,.18); }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-image::before { content: ""; position: absolute; inset: 12% 12% 18%; border-radius: 12px; background: linear-gradient(180deg, #f8fafc, #e0f2fe); }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-image::after { left: 43%; top: 43%; width: 0; height: 0; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 13px solid var(--thumb-accent); background: transparent; box-shadow: none; }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-wave { left: 8%; right: 8%; bottom: 12%; height: 8%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), var(--thumb-secondary), var(--thumb-warning)); clip-path: none; opacity: .92; }
    .template-thumb[data-layout="social-video-growth"] .template-thumb-tag { background: var(--thumb-accent); color: #052e16; }
    .template-thumb[data-layout="executive"] .template-thumb-cover,
    .template-thumb[data-layout="academy"] .template-thumb-cover { right: 10%; }
    .template-thumb[data-layout="academy"] .template-thumb-cover { background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 84%, #064e3b 16%), color-mix(in srgb, var(--thumb-accent) 62%, var(--thumb-primary) 38%)); }
    .template-thumb[data-layout="academy"] .template-thumb-wave { background: linear-gradient(135deg, rgba(255,255,255,.86), color-mix(in srgb, var(--thumb-bg) 76%, #ffffff 24%) 44%, color-mix(in srgb, var(--thumb-primary) 58%, #ffffff 42%)); }
    .template-thumb[data-layout="education-course"] { background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 92%, #0f172a 8%), color-mix(in srgb, var(--thumb-primary) 70%, var(--thumb-accent) 30%) 58%, var(--thumb-bg)); }
    .template-thumb[data-layout="education-course"]::before { background:
      repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 26px),
      radial-gradient(circle at 78% 22%, rgba(255,255,255,.18), transparent 25%); }
    .template-thumb[data-layout="education-course"] .template-thumb-band { left: 8%; right: 8%; bottom: 14%; top: auto; height: 4%; background: var(--thumb-accent); }
    .template-thumb[data-layout="education-course"] .template-thumb-cover { left: 8%; right: 8%; top: 17%; bottom: 15%; border-radius: 8px; background: linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 88%, #0f172a 12%), color-mix(in srgb, var(--thumb-primary) 72%, #000 28%)); box-shadow: inset 0 -8px 0 color-mix(in srgb, var(--thumb-accent) 72%, transparent); }
    .template-thumb[data-layout="education-course"] .template-thumb-image { right: 13%; top: 34%; width: 17%; height: 30%; border-radius: 4px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22); box-shadow: none; }
    .template-thumb[data-layout="education-course"] .template-thumb-wave { height: 0; opacity: 0; }
    .template-thumb[data-layout="education-course"] .template-thumb-tag { background: var(--thumb-accent); color: color-mix(in srgb, var(--thumb-primary) 88%, #000 12%); }
    .template-thumb[data-layout="feature-priority-matrix"] { background: linear-gradient(135deg, #f7fbfd 0%, var(--thumb-bg) 58%, #e8f8f4 100%); }
    .template-thumb[data-layout="feature-priority-matrix"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 28px); }
    .template-thumb[data-layout="feature-priority-matrix"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 16px; background: rgba(255,255,255,.94); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 30px rgba(15,23,42,.12); }
    .template-thumb[data-layout="feature-priority-matrix"] .template-thumb-band { left: 11%; right: 55%; top: 39%; height: 2%; border-radius: 999px; background: var(--thumb-accent); }
    .template-thumb[data-layout="feature-priority-matrix"] .template-thumb-image { right: 12%; top: 25%; width: 29%; height: 38%; border-radius: 12px; background: linear-gradient(90deg, transparent 49%, color-mix(in srgb, var(--thumb-primary) 34%, transparent) 49% 51%, transparent 51%), linear-gradient(0deg, transparent 49%, color-mix(in srgb, var(--thumb-primary) 34%, transparent) 49% 51%, transparent 51%), #f8fbfd; border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="feature-priority-matrix"] .template-thumb-wave { left: 12%; right: 52%; bottom: 23%; height: 11%; background: linear-gradient(90deg, var(--thumb-accent) 0 9%, transparent 9% 34%, var(--thumb-primary) 34% 43%, transparent 43% 68%, #f97316 68% 77%, transparent 77%); clip-path: none; opacity: .95; }
    .template-thumb[data-layout="feature-priority-matrix"] .template-thumb-tag { background: var(--thumb-accent); color: #073b2c; }
    .template-thumb[data-layout="experience-journey-map"] { background: linear-gradient(135deg, #f8fcff 0%, var(--thumb-bg) 58%, #e1f6f3 100%); }
    .template-thumb[data-layout="experience-journey-map"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 28px); }
    .template-thumb[data-layout="experience-journey-map"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 30px rgba(16,32,51,.12); }
    .template-thumb[data-layout="experience-journey-map"] .template-thumb-band { left: 11%; right: 51%; top: 39%; height: 2%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), transparent); }
    .template-thumb[data-layout="experience-journey-map"] .template-thumb-image { right: 11%; top: 25%; width: 31%; height: 39%; border-radius: 14px; background: radial-gradient(circle at 16% 61%, var(--thumb-accent) 0 5%, transparent 6%), radial-gradient(circle at 38% 34%, var(--thumb-primary) 0 5%, transparent 6%), radial-gradient(circle at 60% 57%, #f9735b 0 5%, transparent 6%), radial-gradient(circle at 82% 32%, var(--thumb-primary) 0 5%, transparent 6%), linear-gradient(165deg, transparent 45%, color-mix(in srgb, var(--thumb-accent) 50%, transparent) 46% 49%, transparent 50%), #f8fbfd; border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="experience-journey-map"] .template-thumb-wave { left: 12%; right: 13%; bottom: 22%; height: 10%; background: linear-gradient(90deg, var(--thumb-accent) 0 7%, transparent 7% 22%, var(--thumb-primary) 22% 29%, transparent 29% 45%, #f9735b 45% 52%, transparent 52% 70%, var(--thumb-accent) 70% 77%, transparent 77%); clip-path: none; opacity: .92; }
    .template-thumb[data-layout="experience-journey-map"] .template-thumb-tag { background: var(--thumb-accent); color: #073b2c; }
    .template-thumb[data-layout="capability-radar-map"] { background: linear-gradient(135deg, #f8fbfd 0%, var(--thumb-bg) 58%, #e9f7f4 100%); }
    .template-thumb[data-layout="capability-radar-map"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 28px); }
    .template-thumb[data-layout="capability-radar-map"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 30px rgba(13,27,42,.12); }
    .template-thumb[data-layout="capability-radar-map"] .template-thumb-band { left: 11%; right: 52%; top: 39%; height: 2%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), transparent); }
    .template-thumb[data-layout="capability-radar-map"] .template-thumb-image { right: 11%; top: 25%; width: 31%; height: 39%; border-radius: 50%; background: radial-gradient(circle at 50% 50%, transparent 0 18%, color-mix(in srgb, var(--thumb-primary) 20%, transparent) 19% 20%, transparent 21% 38%, color-mix(in srgb, var(--thumb-primary) 18%, transparent) 39% 40%, transparent 41%), conic-gradient(from 18deg, rgba(22,184,166,.26), rgba(255,138,61,.20), rgba(23,35,63,.20), rgba(22,184,166,.26)); border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="capability-radar-map"] .template-thumb-wave { left: 12%; right: 13%; bottom: 22%; height: 10%; background: linear-gradient(90deg, var(--thumb-accent) 0 7%, transparent 7% 22%, var(--thumb-primary) 22% 29%, transparent 29% 45%, #ff8a3d 45% 52%, transparent 52% 70%, var(--thumb-accent) 70% 77%, transparent 77%); clip-path: none; opacity: .92; }
    .template-thumb[data-layout="capability-radar-map"] .template-thumb-tag { background: var(--thumb-accent); color: #073b2c; }
    .template-thumb[data-layout="investor-update-progress-sync"] { background: linear-gradient(135deg, #eef4f8 0%, #fbfdff 56%, #e5f7f4 100%); }
    .template-thumb[data-layout="investor-update-progress-sync"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 8%, transparent) 0 1px, transparent 1px 34px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 30px); }
    .template-thumb[data-layout="investor-update-progress-sync"] .template-thumb-cover { left: 7%; right: 7%; top: 14%; bottom: 12%; border-radius: 16px; background: rgba(255,255,255,.96); border: 1px solid color-mix(in srgb, var(--thumb-primary) 13%, transparent); box-shadow: 0 16px 32px rgba(15,23,42,.13); }
    .template-thumb[data-layout="investor-update-progress-sync"] .template-thumb-band { left: 11%; right: 11%; top: 25%; height: 3%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-primary) 0 34%, var(--thumb-accent) 34% 76%, var(--thumb-secondary) 76%); }
    .template-thumb[data-layout="investor-update-progress-sync"] .template-thumb-image { right: 10%; top: 36%; width: 33%; height: 32%; border-radius: 15px; background: linear-gradient(180deg, color-mix(in srgb, var(--thumb-primary) 92%, white) 0 18%, transparent 18%), linear-gradient(90deg, var(--thumb-accent) 0 28%, transparent 28% 36%, var(--thumb-secondary) 36% 58%, transparent 58% 66%, var(--thumb-primary) 66%); background-size: 100% 100%, 100% 26%; background-position: 0 0, 0 58%; background-repeat: no-repeat; border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: none; }
    .template-thumb[data-layout="investor-update-progress-sync"] .template-thumb-wave { left: 11%; right: 51%; bottom: 24%; height: 12%; background: linear-gradient(90deg, var(--thumb-accent) 0 18%, transparent 18% 27%, var(--thumb-primary) 27% 46%, transparent 46% 55%, var(--thumb-secondary) 55% 70%, transparent 70%); clip-path: none; opacity: .9; }
    .template-thumb[data-layout="investor-update-progress-sync"] .template-thumb-tag { background: var(--thumb-primary); color: #fff; }
    .template-thumb[data-layout="pre-a-market-validation"] { background: linear-gradient(135deg, #07111f 0%, #0b1220 46%, #123044 100%); }
    .template-thumb[data-layout="pre-a-market-validation"]::before { background: repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 1px, transparent 1px 32px), repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 28px); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 18px; background: rgba(255,255,255,.96); border: 1px solid rgba(255,255,255,.32); box-shadow: 0 18px 34px rgba(0,0,0,.22); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-band { left: 8%; right: 8%; top: 15%; height: 3%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), var(--thumb-secondary), var(--thumb-warning)); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-image { right: 10%; top: 28%; width: 33%; height: 38%; border-radius: 16px; background: linear-gradient(180deg, var(--thumb-primary) 0 18%, #f8fafc 18%); border: 1px solid rgba(15,23,42,.12); box-shadow: 0 12px 24px rgba(15,23,42,.18); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-image::before { left: 13%; right: 13%; top: 34%; height: 6%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent) 0 34%, var(--thumb-secondary) 34% 68%, var(--thumb-warning) 68%); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-image::after { left: 18%; right: 18%; bottom: 18%; height: 22%; border-radius: 10px; background: linear-gradient(90deg, var(--thumb-accent) 0 18%, transparent 18% 30%, var(--thumb-secondary) 30% 50%, transparent 50% 62%, var(--thumb-warning) 62%); }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-wave { left: 12%; right: 52%; bottom: 22%; height: 11%; background: linear-gradient(90deg, var(--thumb-accent) 0 18%, transparent 18% 28%, var(--thumb-secondary) 28% 48%, transparent 48% 58%, var(--thumb-warning) 58% 74%, transparent 74%); clip-path: none; opacity: .92; }
    .template-thumb[data-layout="pre-a-market-validation"] .template-thumb-tag { background: var(--thumb-accent); color: #062a2a; }
    .template-thumb[data-layout="operating-problem-tree"] { background: linear-gradient(135deg, #f7fbff 0%, #ffffff 58%, #eef7f7 100%); }
    .template-thumb[data-layout="operating-problem-tree"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 8%, transparent) 0 1px, transparent 1px 26px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 7%, transparent) 0 1px, transparent 1px 24px); }
    .template-thumb[data-layout="operating-problem-tree"] .template-thumb-cover { left: 8%; right: 8%; top: 14%; bottom: 13%; border-radius: 16px; background: rgba(255,255,255,.94); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 32px rgba(15,23,42,.12); }
    .template-thumb[data-layout="operating-problem-tree"] .template-thumb-band { left: 12%; right: 52%; top: 44%; height: 2%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), transparent); }
    .template-thumb[data-layout="operating-problem-tree"] .template-thumb-image { right: 11%; top: 23%; width: 34%; height: 42%; border-radius: 12px; background: radial-gradient(circle at 50% 20%, var(--thumb-primary) 0 12%, transparent 13%), linear-gradient(90deg, transparent 49%, color-mix(in srgb, var(--thumb-primary) 36%, transparent) 49% 51%, transparent 51%), linear-gradient(0deg, transparent 52%, color-mix(in srgb, var(--thumb-primary) 32%, transparent) 52% 54%, transparent 54%), radial-gradient(circle at 22% 72%, var(--thumb-accent) 0 9%, transparent 10%), radial-gradient(circle at 50% 72%, var(--thumb-secondary) 0 9%, transparent 10%), radial-gradient(circle at 78% 72%, var(--thumb-accent) 0 9%, transparent 10%), #fff; border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: none; }
    .template-thumb[data-layout="operating-problem-tree"] .template-thumb-wave { left: 12%; right: 50%; bottom: 24%; height: 8%; background: linear-gradient(90deg, var(--thumb-accent), var(--thumb-secondary), var(--thumb-primary)); clip-path: none; border-radius: 999px; opacity: .9; }
    .template-thumb[data-layout="operating-problem-tree"] .template-thumb-tag { background: var(--thumb-accent); color: #fff; }
    .template-thumb[data-layout="enterprise-digital-blueprint"] { background: linear-gradient(135deg, #eaf4fb 0%, #f8fcff 56%, #dff8ff 100%); }
    .template-thumb[data-layout="enterprise-digital-blueprint"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 24px); }
    .template-thumb[data-layout="enterprise-digital-blueprint"] .template-thumb-cover { left: 7%; right: 7%; top: 13%; bottom: 12%; border-radius: 14px; background: rgba(255,255,255,.95); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 32px rgba(11,31,58,.13); }
    .template-thumb[data-layout="enterprise-digital-blueprint"] .template-thumb-band { left: 11%; right: 48%; top: 38%; height: 2%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), transparent); }
    .template-thumb[data-layout="enterprise-digital-blueprint"] .template-thumb-image { right: 10%; top: 23%; width: 35%; height: 44%; border-radius: 12px; background: linear-gradient(90deg, transparent 31%, color-mix(in srgb, var(--thumb-primary) 34%, transparent) 31% 33%, transparent 33% 64%, color-mix(in srgb, var(--thumb-accent) 42%, transparent) 64% 66%, transparent 66%), linear-gradient(0deg, transparent 30%, color-mix(in srgb, var(--thumb-accent) 36%, transparent) 30% 32%, transparent 32% 64%, color-mix(in srgb, var(--thumb-primary) 30%, transparent) 64% 66%, transparent 66%), radial-gradient(circle at 22% 35%, var(--thumb-accent) 0 5%, transparent 6%), radial-gradient(circle at 51% 56%, var(--thumb-primary) 0 5%, transparent 6%), radial-gradient(circle at 78% 33%, var(--thumb-secondary) 0 5%, transparent 6%), #f8fcff; border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="enterprise-digital-blueprint"] .template-thumb-wave { left: 12%; right: 51%; bottom: 24%; height: 11%; background: linear-gradient(90deg, var(--thumb-primary) 0 9%, transparent 9% 26%, var(--thumb-accent) 26% 35%, transparent 35% 52%, var(--thumb-secondary) 52% 61%, transparent 61% 78%, var(--thumb-accent) 78%); clip-path: none; opacity: .94; }
    .template-thumb[data-layout="enterprise-digital-blueprint"] .template-thumb-tag { background: var(--thumb-primary); color: #fff; }
    .template-thumb[data-layout="product-pricing-strategy"] { background: linear-gradient(135deg, #f8fafc 0%, var(--thumb-bg) 54%, #e3f7f4 100%); }
    .template-thumb[data-layout="product-pricing-strategy"]::before { background: radial-gradient(circle at 78% 18%, color-mix(in srgb, var(--thumb-accent) 28%, transparent), transparent 25%), repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 8%, transparent) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-secondary) 7%, transparent) 0 1px, transparent 1px 26px); }
    .template-thumb[data-layout="product-pricing-strategy"] .template-thumb-cover { left: 7%; right: 7%; top: 14%; bottom: 12%; border-radius: 16px; background: rgba(255,255,255,.95); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 32px rgba(20,33,61,.13); }
    .template-thumb[data-layout="product-pricing-strategy"] .template-thumb-band { left: 11%; right: 52%; top: 40%; height: 2.4%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), var(--thumb-secondary), transparent); }
    .template-thumb[data-layout="product-pricing-strategy"] .template-thumb-image { right: 10%; top: 23%; width: 35%; height: 41%; border-radius: 14px; background: linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--thumb-secondary) 48%, transparent) 20% 28%, transparent 28% 42%, color-mix(in srgb, var(--thumb-accent) 55%, transparent) 42% 50%, transparent 50% 64%, color-mix(in srgb, var(--thumb-primary) 36%, transparent) 64% 72%, transparent 72%), radial-gradient(circle at 72% 25%, var(--thumb-accent) 0 7%, transparent 8%), linear-gradient(135deg,#fff,#eef9f8); border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="product-pricing-strategy"] .template-thumb-wave { left: 12%; right: 14%; bottom: 22%; height: 10%; background: linear-gradient(90deg, var(--thumb-primary) 0 10%, transparent 10% 24%, var(--thumb-accent) 24% 34%, transparent 34% 48%, var(--thumb-secondary) 48% 58%, transparent 58% 72%, var(--thumb-primary) 72% 82%, transparent 82%); clip-path: none; opacity: .94; }
    .template-thumb[data-layout="product-pricing-strategy"] .template-thumb-tag { background: var(--thumb-accent); color: #14213d; }
    .template-thumb[data-layout="channel-recruitment-policy"] { background: linear-gradient(135deg, #f8fcfb 0%, var(--thumb-bg) 56%, #e4f6ef 100%); }
    .template-thumb[data-layout="channel-recruitment-policy"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 26px); }
    .template-thumb[data-layout="channel-recruitment-policy"] .template-thumb-cover { left: 7%; right: 7%; top: 14%; bottom: 12%; border-radius: 16px; background: rgba(255,255,255,.95); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: 0 16px 32px rgba(15,45,74,.13); }
    .template-thumb[data-layout="channel-recruitment-policy"] .template-thumb-band { left: 11%; right: 52%; top: 39%; height: 2.4%; border-radius: 999px; background: linear-gradient(90deg, var(--thumb-accent), var(--thumb-secondary), transparent); }
    .template-thumb[data-layout="channel-recruitment-policy"] .template-thumb-image { right: 10%; top: 23%; width: 35%; height: 40%; border-radius: 14px; background: radial-gradient(circle at 23% 28%, var(--thumb-accent) 0 5%, transparent 6%), radial-gradient(circle at 75% 28%, var(--thumb-secondary) 0 5%, transparent 6%), radial-gradient(circle at 50% 52%, var(--thumb-primary) 0 9%, transparent 10%), radial-gradient(circle at 25% 76%, #f97316 0 5%, transparent 6%), radial-gradient(circle at 78% 74%, var(--thumb-accent) 0 5%, transparent 6%), linear-gradient(90deg, transparent 20%, color-mix(in srgb, var(--thumb-accent) 48%, transparent) 20% 22%, transparent 22% 50%, color-mix(in srgb, var(--thumb-primary) 32%, transparent) 50% 52%, transparent 52% 78%, color-mix(in srgb, var(--thumb-secondary) 50%, transparent) 78% 80%, transparent 80%), #f8fcfb; border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: none; }
    .template-thumb[data-layout="channel-recruitment-policy"] .template-thumb-wave { left: 12%; right: 14%; bottom: 22%; height: 10%; background: linear-gradient(90deg, var(--thumb-primary) 0 10%, transparent 10% 24%, var(--thumb-accent) 24% 34%, transparent 34% 48%, var(--thumb-secondary) 48% 58%, transparent 58% 72%, #f97316 72% 82%, transparent 82%); clip-path: none; opacity: .94; }
    .template-thumb[data-layout="channel-recruitment-policy"] .template-thumb-tag { background: var(--thumb-accent); color: #073b2c; }
    .template-thumb[data-layout="knowledge-blackboard"] { background: linear-gradient(135deg, #f4f1e8 0%, #efe7d1 100%); }
    .template-thumb[data-layout="knowledge-blackboard"]::before { background: repeating-linear-gradient(90deg, rgba(23,59,51,.08) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(23,59,51,.06) 0 1px, transparent 1px 28px); }
    .template-thumb[data-layout="knowledge-blackboard"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 6px; background: linear-gradient(135deg, #173b33, #0d2a24); border: 5px solid #c8b88f; box-shadow: inset 0 -6px 0 #c8b88f, 0 16px 28px rgba(23,59,51,.18); }
    .template-thumb[data-layout="knowledge-blackboard"] .template-thumb-band { left: 12%; right: 18%; bottom: 20%; top: auto; height: 3%; border-radius: 999px; background: var(--thumb-accent); }
    .template-thumb[data-layout="knowledge-blackboard"] .template-thumb-image { right: 13%; top: 28%; width: 24%; height: 37%; border-radius: 4px; background: #fffdf5; border: 2px solid #d8cdaf; box-shadow: none; }
    .template-thumb[data-layout="knowledge-blackboard"] .template-thumb-wave { left: 13%; right: 48%; bottom: 29%; height: 12%; background: linear-gradient(90deg, #f8fae7 0 34%, transparent 34% 44%, #60a5fa 44% 68%, transparent 68% 76%, #f87171 76%); clip-path: polygon(0 35%, 100% 35%, 100% 48%, 0 48%); opacity: .9; }
    .template-thumb[data-layout="knowledge-blackboard"] .template-thumb-tag { background: var(--thumb-accent); color: #173b33; }
    .template-thumb[data-layout="exam-review-keypoints"] { background: linear-gradient(135deg, #f4f7fb 0%, #ffffff 58%, color-mix(in srgb, var(--thumb-accent) 10%, #ffffff 90%) 100%); }
    .template-thumb[data-layout="exam-review-keypoints"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-primary) 7%, transparent) 0 1px, transparent 1px 26px); }
    .template-thumb[data-layout="exam-review-keypoints"] .template-thumb-cover { left: 8%; right: 8%; top: 15%; bottom: 13%; border-radius: 8px; background: #fff; border: 1px solid color-mix(in srgb, var(--thumb-primary) 16%, transparent); box-shadow: 0 16px 30px rgba(30,42,120,.13); }
    .template-thumb[data-layout="exam-review-keypoints"] .template-thumb-band { left: 8%; right: 8%; top: 15%; height: 16%; background: var(--thumb-primary); border-radius: 8px 8px 0 0; }
    .template-thumb[data-layout="exam-review-keypoints"] .template-thumb-image { right: 12%; top: 31%; width: 29%; height: 35%; border-radius: 14px; background: radial-gradient(circle at 30% 42%, var(--thumb-secondary) 0 17%, transparent 18%), radial-gradient(circle at 66% 52%, #ef4444 0 12%, transparent 13%), linear-gradient(#fff,#fff); border: 1px solid color-mix(in srgb, var(--thumb-primary) 14%, transparent); box-shadow: none; }
    .template-thumb[data-layout="exam-review-keypoints"] .template-thumb-wave { left: 13%; right: 51%; top: 42%; bottom: auto; height: 5%; border-radius: 999px; background: var(--thumb-accent); clip-path: none; opacity: .95; }
    .template-thumb[data-layout="exam-review-keypoints"] .template-thumb-tag { background: var(--thumb-accent); color: #172554; }
    .template-thumb[data-layout="corporate-training"] { background: linear-gradient(135deg, #f6f9fc 0%, var(--thumb-bg) 58%, #e8f5f4 100%); }
    .template-thumb[data-layout="corporate-training"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 10%, transparent) 0 1px, transparent 1px 28px), radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--thumb-accent) 22%, transparent), transparent 24%); }
    .template-thumb[data-layout="corporate-training"] .template-thumb-cover { left: 8%; right: 8%; top: 16%; bottom: 14%; border-radius: 14px; background: rgba(255,255,255,.92); border: 1px solid color-mix(in srgb, var(--thumb-primary) 12%, transparent); box-shadow: 0 16px 30px rgba(31,58,95,.13); }
    .template-thumb[data-layout="corporate-training"] .template-thumb-band { left: 0; right: 0; top: 0; height: 14%; background: linear-gradient(90deg, var(--thumb-primary), var(--thumb-accent)); }
    .template-thumb[data-layout="corporate-training"] .template-thumb-image { right: 11%; top: 24%; width: 27%; height: 42%; border-radius: 12px; background: linear-gradient(135deg, #fff, color-mix(in srgb, var(--thumb-accent) 18%, #fff 82%)); border: 1px solid color-mix(in srgb, var(--thumb-primary) 10%, transparent); box-shadow: 0 12px 22px rgba(31,58,95,.12); }
    .template-thumb[data-layout="corporate-training"] .template-thumb-tag { background: #f3a712; color: #10233d; }
    .template-thumb[data-layout="onboarding-guide"] { background: linear-gradient(135deg, #f4f8fb 0%, color-mix(in srgb, var(--thumb-accent) 11%, #fff 89%) 58%, #e9f7f4 100%); }
    .template-thumb[data-layout="onboarding-guide"]::before { background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--thumb-primary) 9%, transparent) 0 1px, transparent 1px 30px), repeating-linear-gradient(0deg, color-mix(in srgb, var(--thumb-accent) 8%, transparent) 0 1px, transparent 1px 30px); }
    .template-thumb[data-layout="onboarding-guide"] .template-thumb-cover { left: 8%; right: 8%; top: 17%; bottom: 14%; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid color-mix(in srgb, var(--thumb-primary) 12%, transparent); box-shadow: 0 16px 32px rgba(16,32,51,.12); }
    .template-thumb[data-layout="onboarding-guide"] .template-thumb-band { left: 8%; right: 8%; top: 17%; height: 16%; border-radius: 18px 18px 0 0; background: linear-gradient(90deg, var(--thumb-primary), var(--thumb-accent)); }
    .template-thumb[data-layout="onboarding-guide"] .template-thumb-image { right: 11%; top: 31%; width: 26%; height: 39%; border-radius: 16px; background: linear-gradient(135deg, #fff, color-mix(in srgb, var(--thumb-accent) 14%, #fff 86%)); border: 1px solid color-mix(in srgb, var(--thumb-primary) 12%, transparent); box-shadow: 0 12px 22px rgba(16,32,51,.10); }
    .template-thumb[data-layout="onboarding-guide"] .template-thumb-wave { left: 12%; right: 42%; bottom: 19%; height: 10%; background: linear-gradient(90deg, var(--thumb-accent), color-mix(in srgb, var(--thumb-primary) 42%, #fff 58%)); clip-path: polygon(0 45%, 18% 45%, 18% 30%, 30% 30%, 30% 45%, 50% 45%, 50% 30%, 62% 30%, 62% 45%, 82% 45%, 82% 30%, 94% 30%, 94% 45%, 100% 45%, 100% 58%, 0 58%); opacity: .85; }
    .template-thumb[data-layout="onboarding-guide"] .template-thumb-tag { background: #f59e0b; color: #102033; }
    .template-thumb[data-layout="venture"] { background: var(--thumb-bg); }
    .template-thumb[data-layout="venture"]::before { background:
      radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--thumb-accent) 26%, transparent), transparent 34%),
      linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 94%, #ffffff 6%), color-mix(in srgb, var(--thumb-primary) 78%, var(--thumb-bg) 22%)); }
    .template-thumb[data-layout="venture"] .template-thumb-cover { background: linear-gradient(135deg, #151923, color-mix(in srgb, var(--thumb-primary) 76%, #111827 24%)); }
    .template-thumb[data-layout="venture"] .template-thumb-tag { color: #111827; background: color-mix(in srgb, var(--thumb-accent) 86%, #ffffff 14%); }
    .template-thumb[data-layout="venture"] .template-thumb-image { right: 8%; border-radius: 16px; background:
      linear-gradient(135deg, rgba(255,255,255,.72), rgba(255,255,255,.18)),
      radial-gradient(circle at 68% 25%, color-mix(in srgb, var(--thumb-accent) 70%, #ffffff 30%), transparent 18%),
      linear-gradient(145deg, color-mix(in srgb, var(--thumb-primary) 70%, #ffffff 30%), color-mix(in srgb, var(--thumb-accent) 38%, var(--thumb-primary) 62%)); }
    .template-thumb[data-layout="venture"] .template-thumb-image::after { left: 15%; right: 18%; bottom: 15%; height: 5px; box-shadow: 0 -18px 0 rgba(255,255,255,.46), 0 -36px 0 rgba(255,255,255,.28); }
    .template-thumb[data-layout="venture"] .template-thumb-wave { height: 18%; background: linear-gradient(90deg, color-mix(in srgb, var(--thumb-accent) 88%, #fff 12%), color-mix(in srgb, var(--thumb-primary) 70%, #fff 30%)); clip-path: polygon(0 72%, 18% 56%, 36% 68%, 56% 48%, 78% 64%, 100% 42%, 100% 100%, 0 100%); opacity: .9; }
    .template-thumb[data-layout="venture"][data-thumb-variant="wide-cover"] .template-thumb-cover { border-radius: 10px 22px 10px 22px; }
    .template-thumb[data-layout="venture"][data-thumb-variant="center-card"] .template-thumb-cover { border-radius: 22px; background: linear-gradient(145deg, color-mix(in srgb, var(--thumb-primary) 92%, #000 8%), color-mix(in srgb, var(--thumb-accent) 42%, var(--thumb-primary) 58%)); }
    .template-thumb[data-layout="venture"][data-thumb-variant="left-title"] .template-thumb-cover { border-left: 5px solid var(--thumb-accent); }
    .template-thumb[data-template="pitch"][data-layout="venture"] { background: linear-gradient(120deg, color-mix(in srgb, var(--thumb-primary) 96%, #000 4%), var(--thumb-primary) 52%, color-mix(in srgb, var(--thumb-accent) 24%, var(--thumb-primary) 76%)); }
    .template-thumb[data-template="pitch"][data-layout="venture"]::before { background:
      linear-gradient(105deg, rgba(255,255,255,.06) 0 10%, transparent 10% 64%, rgba(255,255,255,.12) 64% 100%),
      repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 32px); }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-cover { left: 9%; right: 33%; top: 23%; bottom: 20%; border-radius: 2px 18px 2px 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.80)); box-shadow: 0 18px 28px rgba(0,0,0,.20); border-left: 4px solid var(--thumb-accent); }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-heading { color: var(--thumb-title); text-shadow: none; }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-date,
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-kicker,
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-summary { color: color-mix(in srgb, var(--thumb-body) 88%, transparent); }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-tag { background: var(--thumb-accent); color: var(--thumb-primary); }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-image { right: 8%; top: 27%; width: 24%; height: 36%; border-radius: 2px 16px 2px 16px; box-shadow: 0 18px 28px rgba(0,0,0,.22); opacity: .88; }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-band { height: 15%; background: color-mix(in srgb, var(--thumb-primary) 55%, #000 45%); clip-path: polygon(0 58%, 100% 20%, 100% 100%, 0 100%); }
    .template-thumb[data-template="pitch"][data-layout="venture"] .template-thumb-wave { display: none; }
    .template-thumb[data-layout="red-gold"] { background: var(--thumb-primary); }
    .template-thumb[data-layout="red-gold"][data-has-dome-asset="true"] { background-image: var(--dome-template-thumb), linear-gradient(135deg, var(--thumb-primary), #7d0610); background-size: cover; background-position: center; }
    .template-thumb[data-layout="red-gold"]::before {
      background:
        repeating-linear-gradient(115deg, rgba(255,232,176,.10) 0 1px, transparent 1px 24px),
        linear-gradient(135deg, color-mix(in srgb, var(--thumb-primary) 96%, #000000 4%), color-mix(in srgb, var(--thumb-primary) 78%, #f97316 22%));
    }
    .template-thumb[data-layout="red-gold"][data-has-dome-asset="true"]::before { background: linear-gradient(90deg, rgba(111,4,13,.14), rgba(111,4,13,.02) 48%, rgba(255,232,176,.10)); }
    .template-thumb[data-layout="red-gold"] .template-thumb-cover { background: linear-gradient(135deg, rgba(255,248,230,.98), rgba(255,232,176,.94)); box-shadow: 0 18px 30px rgba(82,5,12,.22); }
    .template-thumb[data-layout="red-gold"] .template-thumb-date { color: #b45309; }
    .template-thumb[data-layout="red-gold"] .template-thumb-kicker { color: rgba(82,5,12,.58); }
    .template-thumb[data-layout="red-gold"] .template-thumb-heading { color: color-mix(in srgb, var(--thumb-primary) 86%, #111827 14%); text-shadow: none; }
    .template-thumb[data-layout="red-gold"] .template-thumb-summary { color: rgba(82,5,12,.78); }
    .template-thumb[data-layout="red-gold"] .template-thumb-tag { background: var(--thumb-primary); color: #fff7ed; }
    .template-thumb[data-layout="red-gold"] .template-thumb-band { background: linear-gradient(135deg, rgba(255,248,204,.94), color-mix(in srgb, var(--thumb-accent) 82%, #ffffff 18%) 36%, rgba(184,15,26,.25) 37%, color-mix(in srgb, var(--thumb-primary) 80%, #3f0308 20%)); clip-path: polygon(0 64%, 15% 48%, 29% 58%, 45% 34%, 61% 53%, 76% 31%, 100% 44%, 100% 100%, 0 100%); }
    .template-thumb[data-thumb-variant="left-title"] .template-thumb-heading { max-width: 100%; }
    .template-thumb[data-thumb-variant="left-title"] .template-thumb-summary { max-width: 86%; }
    .template-thumb[data-thumb-variant="center-card"] .template-thumb-cover { text-align: center; padding-left: 9%; padding-right: 9%; }
    .template-thumb[data-thumb-variant="center-card"] .template-thumb-heading,
    .template-thumb[data-thumb-variant="center-card"] .template-thumb-summary { max-width: 100%; }
    .template-thumb[data-thumb-variant="center-card"] .template-thumb-tag { justify-self: center; }
    .template-thumb[data-thumb-variant="banner-card"] .template-thumb-cover { align-content: start; padding-top: 6%; }
    .template-thumb[data-thumb-variant="banner-card"] .template-thumb-heading { max-width: 100%; font-size: 17px; }
    .template-thumb[data-thumb-variant="compact-card"] .template-thumb-cover { padding-left: 10%; padding-right: 10%; }
    .template-thumb[data-thumb-variant="compact-card"] .template-thumb-heading { max-width: 100%; font-size: 17px; }
    .template-thumb-content { display: contents; }
    .template-thumb-title { display: none; }
    .template-thumb-palette { position: absolute; z-index: 8; right: 8%; top: 8%; display: inline-flex; gap: 4px; }
    .template-thumb-swatch { width: 8px; height: 18px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); }
    .template-card-meta { display: none; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .primary-action { width: 100%; justify-content: center; min-height: 42px; }
    .preview-shell { min-height: calc(100vh - 118px); display: grid; grid-template-rows: auto 1fr; overflow: hidden; }
    .preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px 18px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #fff, #fbfdff); }
    .preview-meta { color: var(--muted); font-size: 12px; margin-top: 3px; }
    .preview-actions { display: flex; gap: 8px; flex: 0 0 auto; flex-wrap: wrap; justify-content: flex-end; }
    .preview-actions button { min-height: 40px; padding: 9px 13px; }
    .preview-stage { position: relative; display: grid; min-height: 0; padding: 20px; background: linear-gradient(135deg, #edf3fb 0%, #f5f8fc 100%); overflow: auto; }
    .preview {
      min-height: 620px; background: #ffffff; color: var(--text); border-radius: 14px; padding: 20px; overflow: auto;
      box-shadow: inset 0 0 0 1px rgba(31,94,255,.08), 0 22px 52px rgba(16,24,40,.13);
    }
    .preview.is-deck-loaded { height: 100%; min-height: 0; padding: 0; background: #edf3fb; overflow: hidden; }
    .preview-frame { display: block; width: 100%; min-height: 620px; border: 0; border-radius: 12px; background: #edf3fb; }
    .preview.is-deck-loaded .preview-frame { height: 100%; min-height: 0; }
    .preview-polish-loading { position: absolute; z-index: 20; inset: 18px; display: none; place-items: center; border-radius: 8px; background: rgba(237,243,251,.62); backdrop-filter: blur(2px); pointer-events: none; }
    .preview-stage.is-polishing .preview-polish-loading { display: grid; }
    .polish-loading-card { display: inline-flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 16px; border: 1px solid #bfdbfe; border-radius: 999px; background: rgba(255,255,255,.94); color: #1d4ed8; font-size: 13px; font-weight: 850; box-shadow: 0 14px 34px rgba(37,99,235,.18); }
    .polish-spinner, .button-spinner { display: inline-block; width: 15px; height: 15px; border-radius: 999px; border: 2px solid rgba(37,99,235,.24); border-top-color: #2563eb; animation: spin .75s linear infinite; }
    .button-spinner { position: relative; z-index: 1; flex: 0 0 auto; width: 13px; height: 13px; margin-right: 2px; border-color: rgba(255,255,255,.42); border-top-color: #fff; vertical-align: -2px; }
    button.secondary .button-spinner { border-color: rgba(37,99,235,.24); border-top-color: #2563eb; }
    .button-label { position: relative; z-index: 1; }
    .structure-side-panel, .ai-polish-side-panel { display: none !important; }
    .slide-edit-modal { position: absolute; z-index: 30; inset: 18px; display: none; align-items: center; justify-content: center; padding: 18px; background: rgba(15,23,42,.20); backdrop-filter: blur(2px); }
    .slide-edit-modal[aria-hidden="false"] { display: flex; }
    .slide-edit-dialog { width: min(720px, 100%); max-height: min(760px, 92vh); overflow: auto; border: 1px solid #cfe0ff; border-radius: 14px; background: #fff; box-shadow: 0 26px 70px rgba(15,23,42,.24); }
    .slide-edit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 16px 18px; border-bottom: 1px solid var(--line); }
    .slide-edit-head h2 { font-size: 16px; margin: 0 0 5px; color: var(--text); }
    .slide-edit-selected { color: var(--muted); font-size: 12px; font-weight: 800; }
    .slide-edit-close { width: 34px; height: 34px; padding: 0; border: 1px solid #d8e2f0; background: #fff; color: #475569; box-shadow: none; }
    .slide-edit-body { display: grid; gap: 12px; padding: 16px 18px 18px; }
    .slide-edit-body textarea { min-height: 116px; }
    .slide-ai-choice { display: grid; gap: 8px; padding: 12px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; }
    .slide-ai-choice label { display: flex; align-items: center; gap: 8px; margin: 0; color: #1e3a8a; font-size: 13px; font-weight: 850; }
    .slide-ai-choice input[type="checkbox"] { width: 16px; height: 16px; padding: 0; }
    .slide-edit-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; padding-top: 4px; }
    .empty-preview { min-height: 584px; display: grid; place-items: center; border: 1px dashed #bfd0e6; border-radius: 14px; background: linear-gradient(135deg, #ffffff 0%, #f6f9ff 62%, #e8f1ff 100%); }
    .empty-slide { width: min(560px, 90%); aspect-ratio: 16 / 9; border-radius: 16px; background: linear-gradient(135deg, #fff 0%, #fff 58%, #f2f7ff 100%); border: 1px solid #d9e5f5; box-shadow: 0 26px 68px rgba(31,94,255,.13); padding: 48px 58px; }
    .empty-slide h3 { margin: 0 0 14px; font-size: 30px; line-height: 1.16; color: #173b8f; letter-spacing: 0; }
    .empty-slide p { margin: 0; color: var(--muted); line-height: 1.7; }
    .empty-line { width: 58px; height: 4px; margin: 28px 0 0; border-radius: 999px; background: linear-gradient(90deg, var(--primary), var(--teal)); }
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
    .outline-shell { position: relative; min-height: calc(100vh - 118px); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; padding-bottom: 92px; }
    .outline-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #fff, #fbfdff); }
    .outline-title-row { display: flex; align-items: center; gap: 10px; }
    .outline-badge { display: inline-flex; align-items: center; min-height: 28px; padding: 0 9px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 12px; font-weight: 800; }
    .outline-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
    .outline-toolbar button { min-height: 44px; padding: 11px 16px; }
    .outline-action-save {
      min-width: 236px; min-height: 54px; border-radius: 14px; padding: 0 28px;
      background: linear-gradient(135deg, #1f5eff 0%, #2563eb 48%, #0f7f7a 100%);
      box-shadow: 0 18px 36px rgba(31,94,255,.25);
      font-size: 14px; letter-spacing: 0;
    }
    .outline-action-save:hover { box-shadow: 0 22px 42px rgba(31,94,255,.30); transform: translateY(-1px); }
    button.outline-action-retry {
      min-width: 150px; min-height: 46px; border-radius: 12px;
      background: #fff; color: #475569; border-color: #d8e2f0;
      box-shadow: 0 10px 22px rgba(15,23,42,.06);
    }
    button.outline-action-retry:hover { background: #f8fafc; color: #1f2937; border-color: #cbd5e1; box-shadow: 0 12px 26px rgba(15,23,42,.08); }
    .outline-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--line); background: rgba(255,255,255,.98); }
    .outline-header .outline-toolbar {
      position: absolute; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center;
      padding: 18px 22px; border-top: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,.94), #fff);
      box-shadow: 0 -18px 40px rgba(15,23,42,.08);
    }
    .outline-header .outline-action-retry { justify-self: start; }
    .outline-header .outline-action-save { justify-self: end; }
    .outline-summary { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .outline-stat { padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
    .outline-stat span { display: block; color: var(--muted); font-size: 11px; font-weight: 800; }
    .outline-stat strong { display: block; margin-top: 4px; color: var(--text); font-size: 16px; }
    .outline-board { padding: 16px; overflow: auto; background: #edf3fb; }
    .outline-empty { min-height: 520px; display: grid; place-items: center; text-align: center; border: 1px dashed #bfd0e6; border-radius: 14px; background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%); color: var(--muted); }
    .outline-empty strong { display: block; margin-bottom: 8px; color: #1e3a8a; font-size: 22px; }
    .outline-loading {
      min-height: 520px; display: grid; place-items: center; padding: 24px; text-align: center;
      border: 1px dashed #bfd0e6; border-radius: 14px; background: linear-gradient(135deg, #fff 0%, #f5f9ff 100%);
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
    @keyframes button-waiting-sheen { 0% { transform: translateX(-120%); } 55%, 100% { transform: translateX(120%); } }
    .outline-card-list { display: grid; gap: 12px; }
    .outline-card { display: grid; gap: 11px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: #fff; box-shadow: var(--shadow-soft); }
    .outline-card.is-revealing { animation: outlineReveal .28s ease-out both; }
    @keyframes outlineReveal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .outline-card-head { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; }
    .outline-index { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #101828, #243b68); color: #fff; font-weight: 900; font-size: 13px; }
    .outline-title-input { font-size: 17px; font-weight: 800; color: var(--text); }
    .outline-bullets-input { min-height: 92px; font-size: 13px; line-height: 1.55; }
    .outline-card-meta { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 12px; }
    .outline-json-details { padding: 0 16px 16px; background: #edf3fb; }
    .outline-json-details summary { cursor: pointer; color: var(--muted); font-size: 12px; font-weight: 800; margin-bottom: 8px; }
    .download-panel { display: grid; gap: 12px; }
    .download-button { width: 100%; min-height: 42px; }
    .selected-slide-box { padding: 10px 12px; border: 1px solid #bfdbfe; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 800; }
    .selected-slide-box span { display: block; margin-top: 3px; color: var(--muted); font-weight: 700; line-height: 1.45; }
    .structure-editor { display: grid; gap: 10px; }
    .structure-editor textarea { min-height: 118px; }
    .structure-editor-actions { display: grid; gap: 8px; }
    .structure-editor-note { color: var(--muted); font-size: 12px; line-height: 1.5; }
    .asset-toolbar { display: grid; gap: 8px; margin-bottom: 12px; }
    .asset-filter-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 180px); gap: 8px; }
    .asset-search { width: 100%; min-height: 38px; }
    .asset-time-filter { width: 100%; min-height: 38px; }
    .asset-list-summary { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .asset-list { display: grid; gap: 10px; margin-bottom: 0; }
    .asset-list:empty::before { content: "暂无历史 PPT"; color: var(--muted); font-size: 13px; }
    .asset-item { display: grid; grid-template-columns: 1fr; gap: 10px; align-items: start; padding: 13px; border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: 0 12px 28px rgba(23,32,51,.06); }
    .asset-item[aria-selected="true"] { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12), 0 12px 28px rgba(23,32,51,.08); }
    .asset-head { display: grid; grid-template-columns: minmax(128px, 42%) minmax(0, 1fr); gap: 10px; align-items: start; }
    .asset-thumb { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; border: 1px solid #dbeafe; background: linear-gradient(135deg, #1e3a8a, #0f766e); box-shadow: inset 0 0 0 1px rgba(255,255,255,.20); }
    .asset-thumb::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 82% 18%, rgba(255,255,255,.24), transparent 22%), linear-gradient(135deg, rgba(255,255,255,.12), transparent 48%); }
    .asset-thumb::after { content: ""; position: absolute; z-index: 0; left: -4%; right: -4%; bottom: -2%; height: 24%; background: linear-gradient(135deg, rgba(255,255,255,.78), rgba(219,234,254,.64)); clip-path: polygon(0 58%, 20% 44%, 40% 60%, 62% 38%, 80% 52%, 100% 42%, 100% 100%, 0 100%); opacity: .72; pointer-events: none; }
    .asset-thumb-content { position: relative; z-index: 2; display: grid; align-content: center; gap: 4px; height: 100%; padding: 12px 14px 18px; color: #fff; }
    .asset-thumb-kicker { font-size: 9px; line-height: 1; font-weight: 850; color: rgba(255,255,255,.78); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .asset-thumb-title { min-height: 35px; max-height: 38px; font-size: 16px; line-height: 1.12; font-weight: 900; letter-spacing: 0; overflow: hidden; overflow-wrap: anywhere; word-break: break-word; text-shadow: 0 2px 8px rgba(15,23,42,.22); }
    .asset-thumb-subtitle { max-width: 92%; font-size: 9px; line-height: 1.25; font-weight: 700; color: rgba(255,255,255,.86); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 5px rgba(15,23,42,.18); }
    .asset-title { min-width: 0; color: #0f172a; font-weight: 850; font-size: 14px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .asset-meta { margin-top: 4px; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .asset-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
    .asset-fact { min-width: 0; padding: 8px; border: 1px solid #edf2f7; border-radius: 8px; background: #f8fafc; }
    .asset-fact span { display: block; color: var(--muted); font-size: 11px; font-weight: 750; }
    .asset-fact strong { display: block; margin-top: 3px; color: #172033; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .asset-actions { display: flex; gap: 7px; justify-content: flex-end; }
    .asset-actions button { padding: 7px 9px; font-size: 12px; }
    .asset-pagination { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .asset-page-info { color: var(--muted); font-size: 12px; font-weight: 800; }
    .asset-pagination button { min-height: 32px; padding: 6px 10px; font-size: 12px; }
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
    .status-dashboard { display: grid; gap: 14px; }
    .status-hero { position: relative; overflow: hidden; display: grid; gap: 14px; padding: 20px; border: 1px solid #cfe0ff; border-radius: 8px; background: linear-gradient(135deg, #ffffff 0%, #eef4ff 58%, #e8fbf8 100%); box-shadow: var(--shadow); }
    .status-hero::after { content: ""; position: absolute; right: -52px; top: -78px; width: 220px; height: 220px; border-radius: 999px; background: rgba(37,99,235,.10); pointer-events: none; }
    .status-hero-head { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .status-hero-title { display: grid; gap: 6px; }
    .status-hero-title h2 { font-size: 22px; color: #0f172a; }
    .status-hero-title p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .status-live-badge { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 10px; border-radius: 999px; border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534; font-size: 12px; font-weight: 850; white-space: nowrap; }
    .status-live-badge::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: var(--success); box-shadow: 0 0 0 4px rgba(21,128,61,.10); }
    .status-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .status-metric { min-width: 0; padding: 12px; border: 1px solid rgba(191,219,254,.92); border-radius: 8px; background: rgba(255,255,255,.82); }
    .status-metric span { display: block; color: var(--muted); font-size: 11px; font-weight: 800; }
    .status-metric strong { display: block; margin-top: 6px; color: #172033; font-size: 16px; line-height: 1.2; overflow-wrap: anywhere; }
    .status-grid { display: grid; grid-template-columns: minmax(320px, .86fr) minmax(420px, 1.14fr); gap: 14px; align-items: start; }
    .status-panel { min-height: 100%; border-radius: 8px; box-shadow: none; }
    .status-panel .panel-head { align-items: flex-start; border-bottom: 1px solid #edf2f7; padding-bottom: 12px; }
    .status-panel-subtitle { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .status-log-panel pre { max-height: 440px; min-height: 300px; background: #0f172a; border-color: #1e293b; color: #dbeafe; font-size: 12px; line-height: 1.6; }
    .status-log-panel pre:empty::before { content: "暂无任务日志"; color: #94a3b8; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid var(--line); color: #334155; font-size: 12px; line-height: 1.55; max-height: 240px; overflow: auto; }
    .outline-editor { min-height: 160px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .sidebar-panel { box-shadow: none; }
    body[data-workspace-page="assets"] .context { order: 1; }
    body[data-workspace-page="assets"] .preview-shell { order: 2; }
    body[data-workspace-page="assets"][data-asset-preview-open="false"] main { grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="assets"][data-asset-preview-open="false"] .context { grid-column: 1 / -1; grid-template-columns: minmax(0, 1fr); }
    body[data-workspace-page="assets"][data-asset-preview-open="false"] .asset-list { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .is-hidden { display: none !important; }
    @media (max-width: 1180px) { header { flex-wrap: wrap; } main { grid-template-columns: minmax(300px, 380px) 1fr; } .context { grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); } .preview-shell { min-height: 620px; } .status-grid { grid-template-columns: 1fr; } }
    @media (min-width: 1021px) and (max-width: 1320px) { body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: minmax(280px, 320px) minmax(520px, 1fr) minmax(280px, 320px); } }
    @media (max-width: 1020px) { body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: 1fr; } body[data-workspace-page="create"][data-flow-stage="preview"] .context { grid-template-columns: 1fr; } }
    @media (max-width: 980px) { body[data-workspace-page="templates"] main { grid-template-columns: 1fr; } }
    @media (max-width: 1180px) { .template-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 860px) { header { align-items: flex-start; padding: 14px 16px; } .page-nav { width: 100%; overflow-x: auto; } .page-nav button { flex: 0 0 auto; } main, body[data-workspace-page="create"][data-flow-stage="input"] main, body[data-workspace-page="create"][data-flow-stage="outline"] main, body[data-workspace-page="create"][data-flow-stage="preview"] main { grid-template-columns: 1fr; padding: 12px; } body[data-workspace-page="create"][data-flow-stage="input"] .workflow > .panel[data-flow-panel~="input"], body[data-workspace-page="create"][data-flow-stage="outline"] .workflow > .panel[data-flow-panel~="outline"] { padding: 20px; } body[data-workspace-page="create"][data-flow-stage="input"] .flow-guide, body[data-workspace-page="create"][data-flow-stage="outline"] .flow-guide { grid-template-columns: repeat(2, minmax(0, 1fr)); } .context { grid-template-columns: 1fr; } .row { grid-template-columns: 1fr; } .preview-shell, .outline-shell { min-height: auto; } .preview, .preview-frame, .preview.is-deck-loaded, .preview.is-deck-loaded .preview-frame { min-height: 420px; } .outline-header { align-items: flex-start; flex-direction: column; } .outline-toolbar { justify-content: flex-start; } .outline-header .outline-toolbar { grid-template-columns: 1fr; gap: 10px; } .outline-header .outline-action-retry, .outline-header .outline-action-save { justify-self: stretch; width: 100%; } .outline-summary { grid-template-columns: 1fr; } .outline-empty { min-height: 320px; } .template-gallery { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; } .template-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .template-category-tabs { gap: 22px; } .top-status { justify-content: flex-start; } }
    @media (max-width: 520px) { body[data-workspace-page="create"][data-flow-stage="input"] .flow-guide, body[data-workspace-page="create"][data-flow-stage="outline"] .flow-guide { grid-template-columns: 1fr; } .outline-toolbar { width: 100%; } .outline-toolbar button { flex: 1 1 100%; } .outline-action-save, button.outline-action-retry { min-width: 0; } .template-gallery { grid-template-columns: 1fr; } .template-category-grid { grid-template-columns: 1fr; } .balance-facts, .status-metrics { grid-template-columns: 1fr; } .balance-main-head, .status-hero-head { align-items: stretch; flex-direction: column; } .balance-badge { width: max-content; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-mark">P</div>
      <div>
        <h1>AI PPT 工作台</h1>
        <div class="brand-subtitle">输入主题，选择模板，生成可编辑的专业演示文稿</div>
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
      <div class="status-chip">大纲生成 · 模板预览 · PPTX/PDF 导出</div>
    </div>
  </header>
  <main>
	    <section class="workflow" aria-label="生成流程" data-page-panel="create templates" data-flow-panel="input outline preview">
		      <div class="panel" data-page-panel="create" data-flow-panel="input outline">
	        <div class="panel-head">
	          <div class="panel-title"><span class="step-number">1</span><h2>生成流程</h2></div>
	        </div>
	        <div class="flow-guide" aria-label="PPT 生成步骤">
	          <div class="flow-step is-active" data-flow-step="input"><div class="flow-dot">1</div><div><strong>输入生成需求</strong><span>填写主题、页数，也可以粘贴已有文档作为参考。</span></div></div>
	          <div class="flow-step" data-flow-step="outline"><div class="flow-dot">2</div><div><strong>确认内容大纲</strong><span>逐页检查标题和要点，必要时直接编辑。</span></div></div>
	          <div class="flow-step" data-flow-step="template"><div class="flow-dot">3</div><div><strong>套用商业模板</strong><span>选择模板分类、模板和主题风格后生成 PPT。</span></div></div>
	          <div class="flow-step" data-flow-step="download"><div class="flow-dot">4</div><div><strong>预览并导出</strong><span>在线查看完整效果，再下载 PPTX 或 PDF。</span></div></div>
	        </div>
	        <p class="panel-note">先把要讲清楚的事情写下来，系统会生成可编辑大纲，再根据所选模板输出完整 PPT。</p>
      <label for="topic">PPT 主题</label>
      <textarea id="topic">季度经营复盘</textarea>
      <div class="row">
        <div>
          <label for="slide-count">页数</label>
          <select id="slide-count">${slideCountOptions}</select>
        </div>
        <input id="entitlement" type="hidden" value="${escapeHtml(entitlementValue)}" />
      </div>
      <label for="document">参考资料</label>
      <textarea id="document" placeholder="可粘贴会议纪要、项目资料、汇报素材等文本，系统会结合这些内容生成大纲"></textarea>
      <div class="actions">
        <button id="generate-outline" class="primary-action">开始生成大纲</button>
      </div>
      </div>
      <div class="panel" data-page-panel="create" data-flow-panel="preview">
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
          <select id="theme"><option value="minimal">minimal</option></select>
        </div>
        <div>
          <label for="template-scope">模板来源</label>
          <input id="template-scope" class="is-hidden" value="官方模板" disabled aria-hidden="true" tabindex="-1" />
        </div>
      </div>
      <p class="panel-note">选择模板分类后，下方会展示该分类的模板缩略图，点击卡片即可切换模板。</p>
      </div>
      <div id="selected-template-preview" class="selected-template-preview" data-page-panel="create" data-flow-panel="preview" aria-label="已选择模板样式展示">
        <div class="selected-template-preview-empty">选择分类后在这里浏览模板缩略图</div>
      </div>
      <div class="panel" data-page-panel="templates">
      <div class="template-browser-head">
        <h2>模板管理</h2>
        <label class="template-search" for="template-search"><span>&#25628;&#32034;</span><input id="template-search" type="search" placeholder="&#36755;&#20837;&#27169;&#26495;&#21517;&#31216;&#12289;&#20998;&#31867;&#25110;&#20027;&#39064;&#39118;&#26684;" autocomplete="off" /></label>
        <span id="template-gallery-count" class="template-gallery-count">0 个专业模板</span>
      </div>
      <div class="template-gallery-toolbar">
        <div id="template-category-tabs" class="template-category-tabs" aria-label="模板分类导航"></div>
        <button type="button" class="template-more-link" data-template-category-more>查看更多 ›</button>
      </div>
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
      <div class="stage-empty"><div><strong>准备生成内容大纲</strong><span>填写左侧主题和参考资料后，点击“开始生成大纲”。</span></div></div>
    </section>
    <section class="outline-shell" aria-label="大纲确认" data-page-panel="create" data-flow-panel="outline">
      <div class="outline-header">
        <div>
          <div class="outline-title-row"><h2>大纲确认</h2><span class="outline-badge">可编辑</span></div>
          <div class="preview-meta">逐页确认标题和要点，保存后即可选择模板并生成完整 PPT。</div>
        </div>
        <div class="outline-toolbar">
          <button id="retry-task" class="secondary outline-action-retry">重试失败任务</button>
          <button id="save-outline" class="outline-action-save">保存并选择模板</button>
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
    <section class="preview-shell" aria-label="在线预览" data-page-panel="create assets" data-flow-panel="preview" data-asset-preview-panel="true">
      <div class="preview-header">
        <div>
          <h2>在线预览</h2>
          <div class="preview-meta">生成后可直接查看排版效果，并继续微调单页内容。</div>
        </div>
        <div class="preview-actions">
          <button id="back-to-outline" type="button" class="secondary">返回大纲</button>
          <button id="generate-deck">生成专业 PPT</button>
        </div>
      </div>
      <div class="preview-stage">
        <div id="preview" class="preview"><div class="empty-preview"><div class="empty-slide"><h3>等待生成预览</h3><p>保存大纲并选择模板后，这里会展示每一页 PPT 的真实排版、配色和导出效果。</p><div class="empty-line"></div></div></div></div>
        <div id="preview-polish-loading" class="preview-polish-loading" aria-live="polite"><div class="polish-loading-card"><span class="polish-spinner"></span><span>AI 正在润色本页...</span></div></div>
        <div id="slide-edit-modal" class="slide-edit-modal" aria-hidden="true">
          <div class="slide-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="slide-edit-title">
            <div class="slide-edit-head">
              <div>
                <h2 id="slide-edit-title">编辑当前页面</h2>
                <div id="slide-edit-selected" class="slide-edit-selected">请选择一页 PPT</div>
              </div>
              <button id="close-slide-edit-modal" class="slide-edit-close" type="button" aria-label="关闭">×</button>
            </div>
            <div class="slide-edit-body">
              <label for="structure-slide-title">页面标题</label>
              <input id="structure-slide-title" placeholder="选择页面后可编辑标题" disabled />
              <label for="structure-slide-layout">页面版式</label>
              <select id="structure-slide-layout" disabled></select>
              <label for="structure-slide-bullets">页面要点</label>
              <textarea id="structure-slide-bullets" placeholder="每行一个要点" disabled></textarea>
              <div class="slide-ai-choice">
                <label for="single-page-ai-toggle"><input id="single-page-ai-toggle" type="checkbox" />需要 AI 单页优化</label>
                <textarea id="slide-instruction" placeholder="例如：让这一页更适合高层汇报，标题更有力度，要点更精炼。"></textarea>
              </div>
              <div class="slide-edit-actions">
                <button id="apply-structure-preview" type="button" class="secondary">仅更新预览</button>
                <button id="regenerate-slide" type="button">AI 优化本页</button>
              </div>
            </div>
          </div>
        </div>
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
      <div class="panel sidebar-panel" data-page-panel="create assets" data-flow-panel="preview" data-asset-preview-panel="true">
        <div class="panel-head"><h2>下载文件</h2></div>
        <p class="panel-note">生成 PPT 预览后，可下载 PPTX 或 PDF 文件。</p>
        <div class="download-panel">
          <button id="export-pptx" class="secondary download-button">下载 PPTX</button>
          <button id="export-pdf" class="secondary download-button">下载 PDF</button>
        </div>
      </div>
      <div class="panel sidebar-panel structure-side-panel" data-page-panel="create assets" data-flow-panel="preview" data-asset-preview-panel="true">
        <div class="panel-head"><h2>PPT 结构调整</h2></div>
        <p class="panel-note">在中间预览中选择页面后，可调整标题、要点和版式角色，再按当前模板重新预览。</p>
        <div class="structure-editor">
          <label for="legacy-structure-slide-title">页面标题</label>
          <input id="legacy-structure-slide-title" placeholder="选择页面后可编辑标题" disabled />
          <label for="legacy-structure-slide-layout">页面版式</label>
          <select id="legacy-structure-slide-layout" disabled></select>
          <label for="legacy-structure-slide-bullets">页面要点</label>
          <textarea id="legacy-structure-slide-bullets" placeholder="每行一个要点" disabled></textarea>
          <div class="structure-editor-note">调整会先同步到大纲结构，再重新生成在线预览。</div>
          <div class="structure-editor-actions">
            <button id="legacy-apply-structure-preview" type="button" class="secondary">应用结构并重新预览</button>
          </div>
        </div>
      </div>
      <div class="panel sidebar-panel ai-polish-side-panel" data-page-panel="create assets" data-flow-panel="preview" data-asset-preview-panel="true">
        <div class="panel-head"><h2>AI 单页润色</h2></div>
        <p class="panel-note">在中间预览中点击要优化的页面，再输入润色建议。</p>
        <div id="legacy-selected-slide-label" class="selected-slide-box">未选择页面<span>请先在在线预览中点击一页 PPT。</span></div>
        <label for="legacy-slide-instruction">润色建议</label>
        <textarea id="legacy-slide-instruction" placeholder="例如：让这一页更适合高层汇报，标题更有力度，要点更精炼。"></textarea>
        <div class="actions">
          <button id="legacy-regenerate-slide" class="secondary">AI 润色本页</button>
        </div>
      </div>
      <div class="panel sidebar-panel" data-page-panel="create assets" data-flow-panel="preview" data-asset-preview-panel="true">
        <div class="panel-head"><h2>任务状态 / 日志</h2></div>
        <pre id="status">ready</pre>
      </div>
      <div class="panel sidebar-panel" data-page-panel="assets">
        <div class="panel-head"><h2>历史 PPT</h2></div>
        <div class="asset-toolbar">
          <div class="asset-filter-row">
            <input id="asset-search" class="asset-search" placeholder="按标题搜索历史 PPT" />
            <select id="asset-time-filter" class="asset-time-filter" aria-label="历史 PPT 时间范围">
              <option value="all">全部时间</option>
              <option value="today">今天</option>
              <option value="7d">近 7 天</option>
              <option value="30d">近 30 天</option>
            </select>
          </div>
          <div id="asset-list-summary" class="asset-list-summary">每页显示 20 个历史 PPT</div>
        </div>
        <div id="asset-list" class="asset-list">加载中...</div>
        <div id="asset-pagination" class="asset-pagination"></div>
      </div>
      <section class="status-dashboard" data-page-panel="status" aria-label="状态中心总览">
        <div class="status-hero">
          <div class="status-hero-head">
            <div class="status-hero-title">
              <h2>状态中心</h2>
              <p>集中查看套餐余额、生成任务、导出状态和最近运行日志。</p>
            </div>
            <span class="status-live-badge">服务在线</span>
          </div>
          <div class="status-metrics" aria-label="关键状态">
            <div class="status-metric"><span>生成服务</span><strong>可用</strong></div>
            <div class="status-metric"><span>预览渲染</span><strong>PPTX / HTML</strong></div>
            <div class="status-metric"><span>导出格式</span><strong>PPTX / PDF</strong></div>
            <div class="status-metric"><span>任务重试</span><strong>失败后可重试</strong></div>
          </div>
        </div>
        <div class="status-grid">
          <div class="panel status-panel">
            <div class="panel-head"><div><h2>套餐余额</h2><p class="status-panel-subtitle">展示当前权益、可用点数和消耗进度。</p></div></div>
            <div id="balance-status" class="balance-card"><div class="balance-message">正在读取套餐余额...</div></div>
          </div>
          <div class="panel status-panel status-log-panel">
            <div class="panel-head"><div><h2>任务状态 / 日志</h2><p class="status-panel-subtitle">同步生成工作台中的最近任务状态，便于排查生成、预览和导出问题。</p></div></div>
            <pre id="status-readonly">ready</pre>
          </div>
        </div>
      </section>
    </aside>
  </main>
  <script>
    const state = { outlineId: null, deckId: null, taskId: null, outlineSlides: [], selectedSlideId: null, selectedSlideNumber: null, previewRevision: 0, assetPreviewOpen: false, currentAssetId: null };
    let taskPollTimeout;
    const statusEl = document.querySelector("#status");
    const statusReadonlyEl = document.querySelector("#status-readonly");
    const balanceStatusEl = document.querySelector("#balance-status");
    const previewEl = document.querySelector("#preview");
    const previewStageEl = document.querySelector(".preview-stage");
    const previewPolishLoadingEl = document.querySelector("#preview-polish-loading");
    const backToOutlineButton = document.querySelector("#back-to-outline");
    const outlineEditorEl = document.querySelector("#outline-editor");
    const outlineBoardEl = document.querySelector("#outline-board");
    const outlineSummaryEl = document.querySelector("#outline-summary");
    const selectedSlideLabelEl = document.querySelector("#selected-slide-label");
    const slideEditModalEl = document.querySelector("#slide-edit-modal");
    const slideEditSelectedEl = document.querySelector("#slide-edit-selected");
    const singlePageAiToggleEl = document.querySelector("#single-page-ai-toggle");
    const structureSlideTitleEl = document.querySelector("#structure-slide-title");
    const structureSlideLayoutEl = document.querySelector("#structure-slide-layout");
    const structureSlideBulletsEl = document.querySelector("#structure-slide-bullets");
    const applyStructurePreviewButton = document.querySelector("#apply-structure-preview");
    const templateGalleryEl = document.querySelector("#template-gallery");
    const templateGalleryCountEl = document.querySelector("#template-gallery-count");
    const templateCategoryTabsEl = document.querySelector("#template-category-tabs");
    const templateSearchEl = document.querySelector("#template-search");
    const selectedTemplatePreviewEl = document.querySelector("#selected-template-preview");
    const assetSearchEl = document.querySelector("#asset-search");
    const assetTimeFilterEl = document.querySelector("#asset-time-filter");
    const assetListSummaryEl = document.querySelector("#asset-list-summary");
    const assetListEl = document.querySelector("#asset-list");
    const assetPaginationEl = document.querySelector("#asset-pagination");
    const pageButtons = [...document.querySelectorAll("[data-page-target]")];
    const flowStepEls = [...document.querySelectorAll("[data-flow-step]")];
    const workspacePages = new Set(["create", "templates", "assets", "status"]);
    const OUTLINE_REVEAL_INTERVAL_MS = 620;
    const DECK_REVEAL_INTERVAL_MS = 700;
    const DECK_MIN_LOADING_MS = 2200;
    const ASSET_PAGE_SIZE = 20;
    const TEMPLATE_CATEGORY_PREVIEW_LIMIT = 10;
    let flowStage = "input";
    let templateCategories = [{ id: "business", name: "Business" }];
    let templateCatalog = [{ id: "business", name: "Business", category: { id: "business", name: "Business" }, themes: [{ id: "modern", name: "Modern" }] }];
    let templateSearchQuery = "";
    let expandedTemplateCategoryId = "";
    let assetCatalog = [];
    let assetSearchQuery = "";
    let assetTimeFilter = "all";
    let assetPage = 1;
    let deckLoadingStartedAt = 0;
    let deckRevealTimer = null;
    let deckRevealTargetCount = 0;
    let deckRevealSlides = [];
    const STRUCTURE_LAYOUT_OPTIONS = [
      ["", "自动匹配"],
      ["cover", "封面页"],
      ["agenda", "目录页"],
      ["section-divider", "章节页"],
      ["image-report", "图文汇报"],
      ["metrics", "数据指标"],
      ["three-steps", "三步骤流程"],
      ["four-steps", "四步骤流程"],
      ["showcase", "成果展示"],
      ["retrospective", "问题复盘"],
      ["next-plan", "下一步计划"],
      ["closing", "结束页"],
      ["content", "普通内容"]
    ];
    const json = (url, body, method = "POST") => fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(formatApiError(data));
        error.payload = data;
        throw error;
      }
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
    if (statusEl && statusReadonlyEl) {
      statusReadonlyEl.textContent = statusEl.textContent || "ready";
      new MutationObserver(() => {
        statusReadonlyEl.textContent = statusEl.textContent || "ready";
      }).observe(statusEl, { childList: true, characterData: true, subtree: true });
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
      renderTemplateCategoryTabs();
    }
    function renderTemplateCategoryTabs() {
      if (!templateCategoryTabsEl) return;
      const tabs = preferredTemplateCategoryTabs();
      const currentCategoryId = document.querySelector("#template-category")?.value || "";
      let activeMatched = false;
      templateCategoryTabsEl.innerHTML = tabs.map((tab) => {
        const selected = !activeMatched && tab.categoryId === currentCategoryId;
        if (selected) activeMatched = true;
        return '<button type="button" class="template-category-tab" data-template-category-tab="' + escapeHtml(tab.categoryId) + '" aria-selected="' + (selected ? 'true' : 'false') + '">' + escapeHtml(tab.label) + '</button>';
      }).join("");
      templateCategoryTabsEl.querySelectorAll("[data-template-category-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          const categoryEl = document.querySelector("#template-category");
          expandedTemplateCategoryId = "";
          categoryEl.value = button.dataset.templateCategoryTab || "";
          loadTemplates();
        });
      });
    }
    function preferredTemplateCategoryTabs() {
      const categoryIds = new Set((templateCategories || []).map((category) => category.id));
      const findCategoryId = (ids) => ids.find((id) => categoryIds.has(id)) || "";
      return [
        { label: "精品推荐", categoryId: "" },
        { label: "总结汇报", categoryId: findCategoryId(["business", "finance", "project-status"]) },
        { label: "教育培训", categoryId: findCategoryId(["education"]) },
        { label: "营销推广", categoryId: findCategoryId(["marketing", "sales"]) },
        { label: "企业宣讲", categoryId: findCategoryId(["strategy", "business"]) },
        { label: "高校专区", categoryId: findCategoryId(["education"]) },
        { label: "党政民生", categoryId: findCategoryId(["data", "business"]) },
        { label: "商业计划", categoryId: findCategoryId(["pitch", "strategy"]) },
        { label: "人资行政", categoryId: findCategoryId(["business"]) },
        { label: "医疗健康", categoryId: findCategoryId(["data"]) },
        { label: "产品发布", categoryId: findCategoryId(["product", "marketing"]) }
      ];
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
      const templateScopeEl = document.querySelector("#template-scope");
      if (templateScopeEl) templateScopeEl.value = selected ? "官方模板" : "";
      renderSelectedTemplatePreview();
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
      const sourceTemplates = categoryId
        ? templateCatalog.filter((template) => resolveTemplateCategory(template).id === categoryId)
        : templateCatalog;
      const keyword = normalizeTemplateSearchKeyword(templateSearchQuery);
      const templates = keyword
        ? sourceTemplates.filter((template) => templateMatchesSearch(template, keyword))
        : sourceTemplates;
      renderTemplateCategoryTabs();
      if (templateGalleryCountEl) {
        const collapsed = categoryId && !keyword && templates.length > TEMPLATE_CATEGORY_PREVIEW_LIMIT && expandedTemplateCategoryId !== categoryId;
        templateGalleryCountEl.textContent = collapsed
          ? "\u5f53\u524d\u663e\u793a " + TEMPLATE_CATEGORY_PREVIEW_LIMIT + " / " + templates.length + " \u4e2a\u6a21\u677f"
          : templates.length + " \u4e2a\u53ef\u7528\u6a21\u677f";
      }
      if (!templates.length) {
        templateGalleryEl.innerHTML = '<div class="hint">' + (keyword ? '\u6ca1\u6709\u5339\u914d\u7684\u6a21\u677f' : '\u5f53\u524d\u5206\u7c7b\u6682\u65e0\u53ef\u7528\u6a21\u677f') + '</div>';
        if (templateGalleryCountEl) templateGalleryCountEl.textContent = keyword ? "\u6ca1\u6709\u5339\u914d\u7684\u6a21\u677f" : "\u5f53\u524d\u5206\u7c7b\u6682\u65e0\u53ef\u7528\u6a21\u677f";
        return;
      }
      // 分类模式默认只露出前 10 个模板，避免列表过长；用户点击后再展开完整分类。
      const shouldLimitCategory = categoryId && !keyword && templates.length > TEMPLATE_CATEGORY_PREVIEW_LIMIT && expandedTemplateCategoryId !== categoryId;
      const visibleTemplates = shouldLimitCategory ? templates.slice(0, TEMPLATE_CATEGORY_PREVIEW_LIMIT) : templates;
      const categoryName = categoryId ? selectedTemplateCategoryName(categoryId, templates) : "";
      const categoryHeader = categoryId && !keyword
        ? '<div class="template-category-preview-head"><div><strong>' + escapeHtml(categoryName) + '</strong><span>' + (shouldLimitCategory ? "\u5148\u5c55\u793a\u524d 10 \u4e2a\u6a21\u677f\uff0c\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u53ef\u67e5\u770b\u5168\u90e8\u7f29\u7565\u56fe\u3002" : "\u5df2\u5c55\u793a\u8be5\u5206\u7c7b\u5168\u90e8\u6a21\u677f\u7f29\u7565\u56fe\u3002") + '</span></div><span class="template-gallery-count">' + visibleTemplates.length + " / " + templates.length + ' \u4e2a</span></div>'
        : "";
      const categoryMore = categoryId && !keyword && templates.length > TEMPLATE_CATEGORY_PREVIEW_LIMIT
        ? '<div class="template-category-preview-actions"><button type="button" class="template-category-more-button" data-template-category-toggle="' + escapeHtml(categoryId) + '">' + (shouldLimitCategory ? "\u5c55\u5f00\u5168\u90e8\u6a21\u677f" : "\u6536\u8d77\uff0c\u4ec5\u663e\u793a\u524d 10 \u4e2a") + '</button></div>'
        : "";
      templateGalleryEl.innerHTML = categoryHeader + visibleTemplates.map((template) => templateCardHtml(template, selectedId)).join("") + categoryMore;
      templateGalleryEl.querySelectorAll("[data-template-card]").forEach((button) => {
        button.addEventListener("click", () => selectTemplateCard(button.dataset.templateCard));
      });
      templateGalleryEl.querySelector("[data-template-category-toggle]")?.addEventListener("click", (event) => {
        const toggleCategoryId = event.currentTarget.dataset.templateCategoryToggle || "";
        expandedTemplateCategoryId = expandedTemplateCategoryId === toggleCategoryId ? "" : toggleCategoryId;
        renderTemplateGallery();
      });
    }
    function selectedTemplateCategoryName(categoryId, templates = []) {
      const configured = (templateCategories || []).find((category) => category.id === categoryId);
      if (configured?.name) return configured.name;
      const matchedTemplate = templates.find((template) => resolveTemplateCategory(template).id === categoryId);
      return matchedTemplate ? resolveTemplateCategory(matchedTemplate).name : categoryId;
    }
    function normalizeTemplateSearchKeyword(value) {
      return String(value || "").trim().toLowerCase();
    }
    function templateMatchesSearch(template, keyword) {
      const category = resolveTemplateCategory(template);
      const themes = Array.isArray(template.themes) ? template.themes : [];
      const fields = [
        template.id,
        template.slug,
        template.name,
        template.description,
        template.style,
        category.id,
        category.name,
        ...(Array.isArray(template.tags) ? template.tags : []),
        ...themes.flatMap((theme) => [theme?.id || theme, theme?.name || "", theme?.description || ""]),
      ];
      return fields.some((field) => String(field || "").toLowerCase().includes(keyword));
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
      const display = resolveTemplateDisplay(template, selectedId);
      const displayTheme = display.theme;
      const displayVisual = display.visual;
      const categoryName = template.category?.name || template.category || "未分类";
      return ''
        + '<button type="button" class="template-card" data-template-card="' + escapeHtml(template.id) + '" aria-selected="' + (template.id === selectedId ? 'true' : 'false') + '">'
        + templateThumbHtml(display)
        + '<span class="template-card-title">' + escapeHtml(template.name) + '</span>'
        + '<span class="template-card-meta"><span>' + escapeHtml(categoryName) + '</span><span>' + escapeHtml(displayTheme.name || displayTheme.id || displayTheme) + '</span></span>'
        + '</button>';
    }
    function renderSelectedTemplatePreview() {
      if (!selectedTemplatePreviewEl) return;
      const selectedId = document.querySelector("#template").value;
      const categoryId = document.querySelector("#template-category")?.value || "";
      const categoryTemplates = categoryId
        ? templateCatalog.filter((item) => resolveTemplateCategory(item).id === categoryId)
        : templateCatalog;
      const template = templateCatalog.find((item) => item.id === selectedId) || categoryTemplates[0] || templateCatalog[0];
      if (!template) {
        selectedTemplatePreviewEl.innerHTML = '<div class="selected-template-preview-empty">当前分类暂无可用模板</div>';
        return;
      }
      const display = resolveTemplateDisplay(template, template.id);
      const categoryName = template.category?.name || template.category || "未分类";
      const themeName = display.theme?.name || display.theme?.id || display.theme || "默认主题";
      selectedTemplatePreviewEl.innerHTML = ''
        + '<div class="selected-template-preview-head">'
        + '<div class="selected-template-preview-title"><strong>' + escapeHtml(template.name) + '</strong><span>' + escapeHtml(categoryName) + ' · ' + escapeHtml(themeName) + '</span></div>'
        + '<span class="selected-template-preview-badge">官方模板</span>'
        + '</div>'
        + renderCreateTemplateCards(categoryTemplates, template.id, categoryId);
      selectedTemplatePreviewEl.querySelectorAll("[data-template-card]").forEach((button) => {
        button.addEventListener("click", () => selectTemplateCard(button.dataset.templateCard));
      });
      selectedTemplatePreviewEl.querySelector("[data-create-template-category-toggle]")?.addEventListener("click", (event) => {
        const targetKey = event.currentTarget.dataset.createTemplateCategoryToggle || "__all__";
        expandedTemplateCategoryId = expandedTemplateCategoryId === targetKey ? "" : targetKey;
        renderSelectedTemplatePreview();
        renderTemplateGallery();
      });
    }
    function renderCreateTemplateCards(templates, selectedId, categoryId) {
      if (!templates.length) {
        return '<div class="selected-template-preview-empty">当前分类暂无可用模板</div>';
      }
      const categoryKey = categoryId || "__all__";
      const collapsed = templates.length > TEMPLATE_CATEGORY_PREVIEW_LIMIT && expandedTemplateCategoryId !== categoryKey;
      const visibleTemplates = collapsed ? templates.slice(0, TEMPLATE_CATEGORY_PREVIEW_LIMIT) : templates;
      const categoryName = categoryId ? selectedTemplateCategoryName(categoryId, templates) : "全部模板";
      // 生成工作台空间较窄，这里只渲染单列缩略图，保证用户能直接点击切换模板。
      const cards = visibleTemplates.map((template) => templateCardHtml(template, selectedId)).join("");
      const moreButton = templates.length > TEMPLATE_CATEGORY_PREVIEW_LIMIT
        ? '<button type="button" class="create-template-more" data-create-template-category-toggle="' + escapeHtml(categoryKey) + '">' + (collapsed ? "展开全部模板" : "收起，仅显示前 10 个") + '</button>'
        : "";
      return ''
        + '<div class="create-template-list-head" data-create-template-card-list>'
        + '<div class="create-template-list-title"><strong>' + escapeHtml(categoryName) + '</strong><span>' + (collapsed ? "先展示前 10 个模板，展开后可查看全部缩略图。" : "已展示当前分类全部模板缩略图。") + '</span></div>'
        + '<span class="create-template-list-count">' + visibleTemplates.length + ' / ' + templates.length + ' 个</span>'
        + '</div>'
        + '<div class="create-template-grid">' + cards + '</div>'
        + moreButton;
    }
    function resolveTemplateDisplay(template, selectedId) {
      const visual = normalizedTemplateVisual(template.visual);
      const themes = Array.isArray(template.themes) ? template.themes : [];
      const selectedThemeId = document.querySelector("#theme").value;
      const selectedTheme = themes.find((theme) => (theme.id || theme) === selectedThemeId);
      const fallbackTheme = themes[0] || { id: "modern", name: "Modern" };
      const hasSelectedTemplate = template.id === selectedId;
      const displayTheme = (hasSelectedTemplate && selectedTheme) || fallbackTheme;
      return {
        id: template.id || "",
        style: template.style || "",
        categoryId: resolveTemplateCategory(template).id,
        theme: displayTheme,
        visual: resolveTemplateCardVisual(template.visual, hasSelectedTemplate ? selectedTheme : null, visual),
        thumbnailUrl: template.thumbnailUrl || ""
      };
    }
    function templateThumbHtml(display) {
      const displayVisual = display.visual;
      const displayLayout = displayVisual.layout;
      const hasDomeAsset = displayLayout === "red-gold";
      const copy = templateThumbCopy(display);
      const variant = templateThumbVariant(display.id || display.style || display.categoryId || displayLayout, display);
      const thumbnailUrl = display.thumbnailUrl ? "url('" + cssUrl(display.thumbnailUrl) + "')" : "";
      const style = "--thumb-primary:#" + displayVisual.primary + ";--thumb-accent:#" + displayVisual.accent + ";--thumb-bg:#" + displayVisual.background + ";--thumb-surface:#" + displayVisual.surface + ";--thumb-title:#" + displayVisual.title + ";--thumb-body:#" + displayVisual.body + ";--thumb-cover-left:" + variant.coverLeft + "%;--thumb-cover-right:" + variant.coverRight + "%;--thumb-cover-top:" + variant.coverTop + "%;--thumb-image-top:" + variant.imageTop + "%;--thumb-image-width:" + variant.imageWidth + "%;--thumb-wave-height:" + variant.waveHeight + "%;" + (thumbnailUrl ? "--template-thumbnail:" + thumbnailUrl + ";" : "");
      return ''
        + '<span class="template-thumb" data-template="' + escapeHtml(display.id || "") + '" data-layout="' + escapeHtml(displayLayout) + '" data-thumb-variant="' + escapeHtml(variant.name) + '" data-has-dome-asset="' + (hasDomeAsset ? 'true' : 'false') + '" data-has-thumbnail="' + (thumbnailUrl ? 'true' : 'false') + '" style="' + style + '">'
        + '<span class="template-thumb-back template-thumb-back-left"></span><span class="template-thumb-back template-thumb-back-right"></span>'
        + '<span class="template-thumb-cover"><span class="template-thumb-date">' + escapeHtml(copy.date) + '</span><span class="template-thumb-kicker">' + escapeHtml(copy.kicker) + '</span><span class="template-thumb-heading">' + escapeHtml(copy.title) + '</span><span class="template-thumb-summary"><span class="template-thumb-line">' + escapeHtml(copy.lines[0]) + '</span><span class="template-thumb-line">' + escapeHtml(copy.lines[1]) + '</span></span><span class="template-thumb-tag">' + escapeHtml(copy.tag) + '</span></span>'
        + '<span class="template-thumb-image"></span><span class="template-thumb-band"></span><span class="template-thumb-wave"></span><span class="template-thumb-accent"></span>'
        + '<span class="template-thumb-palette"><span class="template-thumb-swatch" style="background:#' + displayVisual.primary + ';"></span><span class="template-thumb-swatch" style="background:#' + displayVisual.accent + ';"></span><span class="template-thumb-swatch" style="background:#' + displayVisual.title + ';"></span></span>'
        + '</span>';
    }
    function templateThumbCopy(display) {
      // 每个模板使用不同示例内容，但仍避免直接把模板名称写进缩略图正文。
      const themeId = String(display.theme?.id || display.theme || "");
      const themeCopies = {
        "project-status:weekly": { date: "2026/07/28", kicker: "STATUS 01", title: "进展同步", lines: ["里程碑完成情况", "风险阻塞与资源请求"], tag: "项目周报" },
        "project-status:steering": { date: "2026/07/29", kicker: "MEETING 01", title: "例会议题", lines: ["关键决策事项", "风险依赖与行动闭环"], tag: "管理例会" },
        "project-status:delivery": { date: "2026/07/30", kicker: "DELIVERY 01", title: "交付看板", lines: ["验收节点与交付质量", "风险依赖及闭环进度"], tag: "交付跟踪" },
        "strategy-consulting:board": { date: "2026/07/12", kicker: "BOARD 01", title: "董事会议题", lines: ["关键结论与决策建议", "战略议题优先级排序"], tag: "董事会汇报" },
        "strategy-consulting:matrix": { date: "2026/07/13", kicker: "MATRIX 01", title: "分类矩阵", lines: ["业务象限与机会排序", "资源投入组合判断"], tag: "矩阵分类" },
        "strategy-consulting:workstream": { date: "2026/07/14", kicker: "STREAM 01", title: "推进路径", lines: ["阶段任务与责任分工", "里程碑节奏和风险闭环"], tag: "流程推进" },
        "financial-review:quarterly": { date: "2026/08/06", kicker: "FINANCE 01", title: "季度经营复盘", lines: ["收入利润现金流追踪", "预算执行偏差分析"], tag: "季度复盘" },
        "financial-review:audit": { date: "2026/08/12", kicker: "AUDIT 01", title: "审计风险核验", lines: ["关键差异与凭证追溯", "整改闭环与风险评级"], tag: "审计分析" },
        "financial-review:forecast": { date: "2026/08/18", kicker: "FORECAST 01", title: "预算预测规划", lines: ["滚动预测与情景假设", "资源配置和目标校准"], tag: "预测规划" },
        "sales-proposal:enterprise": { date: "2026/05/18", kicker: "ACCOUNT 01", title: "企业客户画像", lines: ["采购角色与决策链路", "客户痛点和价值机会"], tag: "企业客户" },
        "sales-proposal:solution": { date: "2026/05/22", kicker: "SOLUTION 01", title: "方案价值架构", lines: ["能力模块与交付路径", "业务场景和收益证明"], tag: "解决方案" },
        "sales-proposal:renewal": { date: "2026/05/28", kicker: "GROWTH 01", title: "续约增长计划", lines: ["留存风险和增购机会", "续约节奏与客户成功"], tag: "续约增长" },
        "pitch:startup": { date: "2026/09/10", kicker: "FOUNDER 01", title: "创业叙事路径", lines: ["用户痛点与创始洞察", "从验证到规模化增长"], tag: "创业故事" },
        "pitch:investor": { date: "2026/09/18", kicker: "INVEST 01", title: "投资备忘录", lines: ["市场空间与商业模型", "融资计划和资金用途"], tag: "投资人版" },
        "pitch:product": { date: "2026/09/26", kicker: "PRODUCT 01", title: "产品亮点展示", lines: ["核心功能和差异优势", "场景价值与增长证据"], tag: "产品亮点" },
        "marketing-campaign:launch": { date: "2026/10/10", kicker: "LAUNCH 01", title: "新品首发节奏", lines: ["首发卖点与场景素材", "渠道预热和发布转化"], tag: "新品发布" },
        "marketing-campaign:brand": { date: "2026/10/18", kicker: "BRAND 01", title: "品牌声量计划", lines: ["传播主张与内容矩阵", "核心触点和用户心智"], tag: "品牌传播" },
        "marketing-campaign:growth": { date: "2026/10/26", kicker: "GROWTH 01", title: "增长转化路径", lines: ["渠道漏斗与转化节点", "复购闭环和投放复盘"], tag: "增长营销" },
      };
      const copies = {
        business: { date: "2026/06/05", kicker: "PART 01", title: "季度概览", lines: ["核心指标达成分析", "重点项目进展复盘"], tag: "商务汇报" },
        "strategy-consulting": { date: "2026/07/12", kicker: "ISSUE 01", title: "诊断框架", lines: ["关键问题拆解路径", "组织能力提升建议"], tag: "咨询方案" },
        "financial-review": { date: "2026/08/06", kicker: "FINANCE 01", title: "经营复盘", lines: ["收入利润现金流追踪", "预算执行偏差分析"], tag: "财务分析" },
        "sales-proposal": { date: "2026/05/18", kicker: "SOLUTION 01", title: "客户方案", lines: ["业务痛点与价值主张", "交付计划及合作路径"], tag: "销售提案" },
        "product-roadmap": { date: "2026/09/22", kicker: "ROADMAP 01", title: "版本规划", lines: ["核心功能优先级排序", "里程碑节奏与风险"], tag: "产品规划" },
        "feature-priority-matrix": { date: "2026/10/06", kicker: "PRIORITY 01", title: "优先级评审", lines: ["价值成本矩阵排序", "研发资源投入取舍"], tag: "产品决策" },
        "experience-journey-map": { date: "2026/10/08", kicker: "UX JOURNEY", title: "体验改版", lines: ["旅程触点诊断", "改版路径评审"], tag: "体验旅程" },
        "capability-radar-map": { date: "2026/10/10", kicker: "COMPETE 01", title: "竞品对比", lines: ["能力雷达评分", "功能差距路线输入"], tag: "能力雷达" },
        "investor-update-progress-sync": { date: "2026/10/16", kicker: "INVESTOR 01", title: "投资人月报", lines: ["经营进展同步", "关键指标披露"], tag: "投资人更新" },
        "enterprise-digital-blueprint": { date: "2026/10/22", kicker: "BLUEPRINT 01", title: "转型蓝图", lines: ["系统架构与能力升级", "阶段路线和治理机制"], tag: "数字化转型" },
        "product-pricing-strategy": { date: "2026/11/12", kicker: "PRICING 01", title: "定价商业化", lines: ["价格锚点与套餐权益", "收入模型和转化路径"], tag: "商业化" },
        "channel-recruitment-plan": { date: "2026/11/08", kicker: "PARTNER 01", title: "渠道招商", lines: ["合作政策与权益支持", "收益模型和招商路线"], tag: "渠道合作" },
        "operating-problem-tree": { date: "2026/10/24", kicker: "DIAGNOSIS 01", title: "问题诊断", lines: ["经营异常定位", "原因拆解与整改闭环"], tag: "经营诊断" },
        "marketing-campaign": { date: "2026/10/10", kicker: "CAMPAIGN 01", title: "活动复盘", lines: ["渠道触达与转化表现", "品牌声量增长洞察"], tag: "营销推广" },
        "data-insight": { date: "2026/11/03", kicker: "DATA 01", title: "洞察结论", lines: ["指标异常与趋势变化", "行动建议优先级排序"], tag: "数据报告" },
        "market-trend-insight": { date: "2026/11/18", kicker: "MARKET 01", title: "趋势信号扫描", lines: ["行业变化与机会窗口", "竞争格局和进入时机"], tag: "趋势洞察" },
        education: { date: "2026/08/22", kicker: "COURSE 01", title: "课程导入", lines: ["教学目标与知识框架", "课堂活动路径设计"], tag: "教育培训" },
        "education-course": { date: "2026/08/22", kicker: "LESSON 01", title: "课程目标", lines: ["知识框架与重点概念", "课堂互动与练习路径"], tag: "教学课件" },
        "knowledge-blackboard": { date: "2026/09/12", kicker: "LESSON 01", title: "知识点拆解", lines: ["定义原理和例题讲解", "重点批注与课后练习"], tag: "课程讲义" },
        "corporate-training": { date: "2026/08/22", kicker: "LEARNING 01", title: "课程目标", lines: ["管理模型与案例研讨", "课堂练习与行动计划"], tag: "内训课程" },
        "onboarding-guide": { date: "2026/09/01", kicker: "WELCOME 01", title: "入职路径", lines: ["公司认知与制度学习", "岗位职责和团队融入"], tag: "新人培训" },
        pitch: { date: "2026/09/10", kicker: "PITCH 01", title: "增长故事", lines: ["市场机会与产品优势", "融资计划及资金用途"], tag: "融资路演" },
        "brand-story": { date: "2026/10/26", kicker: "BRAND 01", title: "品牌叙事", lines: ["核心主张与用户心智", "传播内容矩阵规划"], tag: "品牌传播" },
        "project-status": { date: "2026/07/28", kicker: "STATUS 01", title: "进展同步", lines: ["里程碑完成情况", "风险阻塞与资源请求"], tag: "项目周报" }
      };
      // 年度经营总结缩略图使用经营复盘语义，不直接展示主题风格名。
      themeCopies["annual-business-summary:blue-gold"] = { date: "2026/12/31", kicker: "ANNUAL 01", title: "年度经营总结", lines: ["核心指标与成果沉淀", "来年目标和行动规划"], tag: "年度汇报" };
      const layoutCopies = {
        "exam-review-keypoints": { date: "2026/10/18", kicker: "EXAM REVIEW", title: "考点框架", lines: ["必背清单和易错归因", "冲刺计划与练习安排"], tag: "考前复习" },
        "product-pricing-strategy": { date: "2026/11/12", kicker: "PRICING 01", title: "定价策略", lines: ["套餐层级与权益矩阵", "商业闭环和收入假设"], tag: "商业化" },
        "channel-recruitment-policy": { date: "2026/11/08", kicker: "PARTNER 01", title: "合作政策", lines: ["准入门槛与权益矩阵", "分润路径和签约流程"], tag: "渠道招商" },
        "red-gold": { date: "2026/06/05", kicker: "PART 01", title: "季度概览", lines: ["核心指标达成分析", "重点项目进展复盘"], tag: "商务汇报" },
        "academy": { date: "2026/08/22", kicker: "COURSE 01", title: "课程导入", lines: ["教学目标与知识框架", "课堂活动路径设计"], tag: "教育培训" },
        "executive": { date: "2026/07/18", kicker: "REPORT 01", title: "年度复盘", lines: ["经营数据与增长趋势", "关键任务完成情况"], tag: "企业汇报" },
        "venture": { date: "2026/09/10", kicker: "PLAN 01", title: "项目计划", lines: ["商业模式与市场机会", "阶段目标及执行节奏"], tag: "商业计划" },
        "status-report": { date: "2026/07/28", kicker: "STATUS 01", title: "进展同步", lines: ["里程碑完成情况", "风险阻塞与资源请求"], tag: "项目周报" },
        "top-band": { date: "2026/05/20", kicker: "SECTION 01", title: "方案总览", lines: ["背景洞察与问题拆解", "策略路径与落地安排"], tag: "方案演示" },
        "hero": { date: "2026/10/12", kicker: "IDEA 01", title: "主题发布", lines: ["核心亮点集中呈现", "视觉主张清晰传达"], tag: "产品发布" }
      };
      return themeCopies[String(display.id || "") + ":" + themeId] || copies[display.id] || copies[display.style] || copies[display.categoryId] || layoutCopies[display.visual?.layout] || { date: "2026/06/05", kicker: "PART 01", title: "内容概览", lines: ["核心信息结构展示", "重点内容层级清晰"], tag: "演示文稿" };
    }
    function templateThumbVariant(seed, display = {}) {
      const statusVariant = display.visual?.layout === "status-report" ? display.visual?.variant : "";
      if (statusVariant === "weekly") return { name: "wide-cover", coverLeft: 9, coverRight: 9, coverTop: 17, imageTop: 24, imageWidth: 24, waveHeight: 30 };
      if (statusVariant === "steering") return { name: "center-card", coverLeft: 12, coverRight: 10, coverTop: 15, imageTop: 27, imageWidth: 22, waveHeight: 34 };
      if (statusVariant === "delivery") return { name: "banner-card", coverLeft: 10, coverRight: 9, coverTop: 24, imageTop: 16, imageWidth: 20, waveHeight: 22 };
      const strategyVariant = display.id === "strategy-consulting" ? display.visual?.variant : "";
      if (strategyVariant === "board") return { name: "wide-cover", coverLeft: 9, coverRight: 11, coverTop: 18, imageTop: 23, imageWidth: 24, waveHeight: 24 };
      if (strategyVariant === "matrix") return { name: "center-card", coverLeft: 13, coverRight: 13, coverTop: 16, imageTop: 29, imageWidth: 21, waveHeight: 31 };
      if (strategyVariant === "workstream") return { name: "banner-card", coverLeft: 10, coverRight: 10, coverTop: 24, imageTop: 17, imageWidth: 23, waveHeight: 22 };
      const financeVariant = display.id === "financial-review" ? display.visual?.variant : "";
      if (financeVariant === "quarterly") return { name: "wide-cover", coverLeft: 9, coverRight: 10, coverTop: 17, imageTop: 25, imageWidth: 23, waveHeight: 24 };
      if (financeVariant === "audit") return { name: "compact-card", coverLeft: 12, coverRight: 12, coverTop: 18, imageTop: 24, imageWidth: 22, waveHeight: 20 };
      if (financeVariant === "forecast") return { name: "banner-card", coverLeft: 10, coverRight: 10, coverTop: 23, imageTop: 17, imageWidth: 24, waveHeight: 26 };
      const salesVariant = display.id === "sales-proposal" ? display.visual?.variant : "";
      if (salesVariant === "enterprise") return { name: "wide-cover", coverLeft: 9, coverRight: 10, coverTop: 18, imageTop: 25, imageWidth: 23, waveHeight: 24 };
      if (salesVariant === "solution") return { name: "center-card", coverLeft: 12, coverRight: 12, coverTop: 16, imageTop: 26, imageWidth: 22, waveHeight: 30 };
      if (salesVariant === "renewal") return { name: "banner-card", coverLeft: 10, coverRight: 10, coverTop: 23, imageTop: 17, imageWidth: 24, waveHeight: 26 };
      const marketingVariant = display.id === "marketing-campaign" ? display.visual?.variant : "";
      if (marketingVariant === "launch") return { name: "wide-cover", coverLeft: 10, coverRight: 28, coverTop: 22, imageTop: 25, imageWidth: 23, waveHeight: 22 };
      if (marketingVariant === "brand") return { name: "center-card", coverLeft: 13, coverRight: 27, coverTop: 20, imageTop: 24, imageWidth: 24, waveHeight: 28 };
      if (marketingVariant === "growth") return { name: "banner-card", coverLeft: 10, coverRight: 28, coverTop: 26, imageTop: 21, imageWidth: 22, waveHeight: 24 };
      // 年度总结模板强调正式报告封面感，卡片区域更宽，右侧留出经营图表装饰。
      if (display.id === "annual-business-summary") return { name: "wide-cover", coverLeft: 9, coverRight: 12, coverTop: 18, imageTop: 24, imageWidth: 25, waveHeight: 22 };
      const pitchVariant = display.id === "pitch" ? display.visual?.variant : "";
      if (pitchVariant === "startup") return { name: "left-title", coverLeft: 9, coverRight: 31, coverTop: 23, imageTop: 22, imageWidth: 25, waveHeight: 18 };
      if (pitchVariant === "investor") return { name: "wide-cover", coverLeft: 10, coverRight: 30, coverTop: 20, imageTop: 26, imageWidth: 24, waveHeight: 20 };
      if (pitchVariant === "product") return { name: "center-card", coverLeft: 14, coverRight: 29, coverTop: 21, imageTop: 24, imageWidth: 26, waveHeight: 24 };
      const variants = [
        { name: "wide-cover", coverLeft: 9, coverRight: 9, coverTop: 17, imageTop: 24, imageWidth: 24, waveHeight: 30 },
        { name: "left-title", coverLeft: 8, coverRight: 11, coverTop: 19, imageTop: 20, imageWidth: 24, waveHeight: 24 },
        { name: "center-card", coverLeft: 12, coverRight: 10, coverTop: 15, imageTop: 27, imageWidth: 22, waveHeight: 34 },
        { name: "banner-card", coverLeft: 10, coverRight: 9, coverTop: 24, imageTop: 16, imageWidth: 20, waveHeight: 22 },
        { name: "compact-card", coverLeft: 12, coverRight: 12, coverTop: 18, imageTop: 23, imageWidth: 22, waveHeight: 28 }
      ];
      const hash = String(seed || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return variants[hash % variants.length];
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
        layout: ["top-band", "left-rail", "hero", "executive", "academy", "venture", "marketing", "social-video-growth", "pre-a-market-validation", "status-report", "red-gold", "education-course", "feature-priority-matrix", "experience-journey-map", "capability-radar-map", "product-interview-insight", "investor-update-progress-sync", "enterprise-digital-blueprint", "product-pricing-strategy", "channel-recruitment-policy", "operating-problem-tree", "knowledge-blackboard", "exam-review-keypoints", "corporate-training", "onboarding-guide", "annual-summary", "quarterly-dashboard", "quarterly-diagnosis", "quarterly-action-loop", "industry-research", "industry-trend-forecast", "strategy-swot-map", "sales-key-account-decision-chain", "bi-executive-cockpit", "user-path-funnel", "market-trend-radar"].includes(visual.layout) ? visual.layout : "top-band",
        variant: typeof visual.variant === "string" ? visual.variant : ""
      };
    }
    function resolveTemplateCardVisual(baseVisual, theme, fallbackVisual) {
      if (!theme || !theme.visual) return fallbackVisual;
      const merged = {
        ...baseVisual,
        primary: normalizeHexColor(theme.visual.primary, baseVisual.primary),
        accent: normalizeHexColor(theme.visual.accent, baseVisual.accent),
        background: normalizeHexColor(theme.visual.background, baseVisual.background),
        surface: normalizeHexColor(theme.visual.surface, baseVisual.surface),
        title: normalizeHexColor(theme.visual.title, baseVisual.title),
        body: normalizeHexColor(theme.visual.body, baseVisual.body),
        layout: ["top-band", "left-rail", "hero", "executive", "academy", "venture", "marketing", "social-video-growth", "pre-a-market-validation", "status-report", "red-gold", "education-course", "feature-priority-matrix", "experience-journey-map", "capability-radar-map", "product-interview-insight", "investor-update-progress-sync", "enterprise-digital-blueprint", "product-pricing-strategy", "channel-recruitment-policy", "operating-problem-tree", "knowledge-blackboard", "exam-review-keypoints", "corporate-training", "onboarding-guide", "annual-summary", "quarterly-dashboard", "quarterly-diagnosis", "quarterly-action-loop", "industry-research", "industry-trend-forecast", "strategy-swot-map", "sales-key-account-decision-chain", "bi-executive-cockpit", "user-path-funnel", "market-trend-radar"].includes(theme.visual.layout)
          ? theme.visual.layout
          : baseVisual.layout,
        variant: typeof theme.visual.variant === "string" ? theme.visual.variant : baseVisual.variant,
      };
      return merged;
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
        const [categoryData, templateData] = await Promise.all([
          fetch("/api/template-categories").then(async (res) => {
            const payload = await res.json();
            if (!res.ok) throw new Error(formatApiError(payload));
            return payload;
          }),
          fetch("/api/templates").then(async (res) => {
            const payload = await res.json();
            if (!res.ok) throw new Error(formatApiError(payload));
            return payload;
          })
        ]);
        const availableTemplates = (templateData.templates || []).filter((template) => template.scope !== "user");
        const availableCategoryIds = new Set(availableTemplates.map((template) => resolveTemplateCategory(template).id));
        const knownCategoryIds = new Set();
        templateCategories = (categoryData.categories || []).filter((category) => {
          if (category.id === "personal" || !availableCategoryIds.has(category.id)) return false;
          knownCategoryIds.add(category.id);
          return true;
        });
        availableTemplates.forEach((template) => {
          const category = resolveTemplateCategory(template);
          if (!category.id || knownCategoryIds.has(category.id)) return;
          knownCategoryIds.add(category.id);
          templateCategories.push(category);
        });
        const categoryEl = document.querySelector("#template-category");
        if (categoryEl && categoryEl.value && !availableCategoryIds.has(categoryEl.value)) {
          categoryEl.value = "";
        }
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
        templateCatalog = (data.templates || []).filter((template) => template.scope !== "user");
        renderTemplateOptions();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    function renderAssets(assets = assetCatalog) {
      const sourceAssets = Array.isArray(assets) ? assets : [];
      const keyword = assetSearchQuery.trim().toLowerCase();
      const filteredAssets = sourceAssets.filter((asset) => {
        const titleMatched = keyword ? String(asset.title || "").toLowerCase().includes(keyword) : true;
        return titleMatched && assetMatchesTimeFilter(asset, assetTimeFilter);
      });
      const pageCount = Math.max(1, Math.ceil(filteredAssets.length / ASSET_PAGE_SIZE));
      assetPage = Math.min(Math.max(assetPage, 1), pageCount);
      const pageAssets = filteredAssets.slice((assetPage - 1) * ASSET_PAGE_SIZE, assetPage * ASSET_PAGE_SIZE);
      renderAssetPagination({ total: filteredAssets.length, pageCount });
      if (!pageAssets.length) {
        assetListEl.textContent = keyword ? "没有匹配的历史 PPT" : "暂无历史 PPT";
        return;
      }
      assetListEl.innerHTML = pageAssets.map((asset) => (
        '<div class="asset-item" data-asset-id="' + asset.id + '" aria-selected="' + (asset.id === state.currentAssetId ? 'true' : 'false') + '">'
          + '<div class="asset-head">' + assetThumbHtml(asset) + '<div><div class="asset-title">' + escapeHtml(asset.title || "Untitled") + '</div>'
          + '<div class="asset-meta">' + escapeHtml(formatAssetDate(asset.created_at || asset.createdAt)) + '</div></div></div>'
          + '<div class="asset-facts">'
          + '<div class="asset-fact"><span>模板</span><strong>' + escapeHtml(asset.templateName || asset.templateId || "未记录") + '</strong></div>'
          + '<div class="asset-fact"><span>主题</span><strong>' + escapeHtml(asset.theme || "默认") + '</strong></div>'
          + '<div class="asset-fact"><span>页数</span><strong>' + Number(asset.slideCount || 0) + ' 页</strong></div>'
          + '</div>'
          + '<div class="asset-actions"><button type="button" data-open-asset="' + asset.id + '">打开预览</button><button type="button" class="secondary" data-delete-asset="' + asset.id + '">删除</button></div>'
        + '</div>'
      )).join("");
      assetListEl.querySelectorAll("[data-open-asset]").forEach((button) => {
        button.addEventListener("click", () => openAsset(button.dataset.openAsset));
      });
      assetListEl.querySelectorAll("[data-delete-asset]").forEach((button) => {
        button.addEventListener("click", () => deleteAsset(button.dataset.deleteAsset));
      });
    }

    function assetMatchesTimeFilter(asset, filter) {
      if (!filter || filter === "all") return true;
      const rawValue = asset.created_at || asset.createdAt;
      const createdAt = rawValue ? new Date(rawValue) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
      const now = new Date();
      if (filter === "today") {
        return createdAt.toDateString() === now.toDateString();
      }
      const days = filter === "7d" ? 7 : filter === "30d" ? 30 : null;
      if (!days) return true;
      return now.getTime() - createdAt.getTime() <= days * 24 * 60 * 60 * 1000;
    }

    function assetThumbHtml(asset) {
      const title = String(asset.title || "历史 PPT").trim();
      const shortTitle = title.length > 18 ? title.slice(0, 18) + "..." : title;
      const template = asset.templateName || asset.templateId || "PPT 文件";
      const subtitle = template + " · " + Number(asset.slideCount || 0) + " 页";
      return ''
        + '<div class="asset-thumb" aria-hidden="true">'
        + '<div class="asset-thumb-content">'
        + '<div class="asset-thumb-kicker">HISTORY PPT</div>'
        + '<div class="asset-thumb-title">' + escapeHtml(shortTitle) + '</div>'
        + '<div class="asset-thumb-subtitle">' + escapeHtml(subtitle) + '</div>'
        + '</div>'
        + '</div>';
    }

    function renderAssetPagination({ total, pageCount }) {
      if (assetListSummaryEl) {
        const start = total ? (assetPage - 1) * ASSET_PAGE_SIZE + 1 : 0;
        const end = Math.min(assetPage * ASSET_PAGE_SIZE, total);
        assetListSummaryEl.textContent = "共 " + total + " 个历史 PPT，当前显示 " + start + "-" + end + "，每页 20 个";
      }
      if (!assetPaginationEl) return;
      assetPaginationEl.innerHTML = ''
        + '<button type="button" class="secondary" data-asset-page="prev" ' + (assetPage <= 1 ? "disabled" : "") + '>上一页</button>'
        + '<span class="asset-page-info">第 ' + assetPage + ' / ' + pageCount + ' 页</span>'
        + '<button type="button" class="secondary" data-asset-page="next" ' + (assetPage >= pageCount ? "disabled" : "") + '>下一页</button>';
      assetPaginationEl.querySelectorAll("[data-asset-page]").forEach((button) => {
        button.addEventListener("click", () => {
          assetPage += button.dataset.assetPage === "next" ? 1 : -1;
          renderAssets(assetCatalog);
        });
      });
    }

    async function loadAssets() {
      try {
        const data = await fetch("/api/ppt/assets").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(formatApiError(payload));
          return payload;
        });
        assetCatalog = data.assets || [];
        assetPage = Math.min(assetPage, Math.max(1, Math.ceil(assetCatalog.length / ASSET_PAGE_SIZE)));
        renderAssets(assetCatalog);
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
        const deck = data.deck || {};
        state.assetPreviewOpen = true;
        state.currentAssetId = data.asset?.id || assetId;
        state.deckId = deck.id || data.asset.deckId;
        state.outlineId = deck.outlineId || null;
        state.taskId = null;
        state.selectedSlideNumber = deck.slides?.length ? 1 : null;
        state.selectedSlideId = slideIdForNumber(deck, state.selectedSlideNumber);
        setTemplateSelectionFromDeck(deck);
        renderOutlineBoard(deck.slides || []);
        renderDeckPreviewFrame(state.deckId, { bustCache: true });
        setWorkspacePage("assets");
        setFlowStage("preview");
        renderAssets(assetCatalog);
        statusEl.textContent = "已打开历史 PPT，可继续调整结构、AI 润色单页并重新下载。\\n" + JSON.stringify(data.asset, null, 2);
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }

    function setTemplateSelectionFromDeck(deck) {
      const templateSelect = document.querySelector("#template");
      const themeSelect = document.querySelector("#theme");
      if (templateSelect && deck.templateId && [...templateSelect.options].some((option) => option.value === deck.templateId)) {
        templateSelect.value = deck.templateId;
      }
      renderThemeOptions(deck.theme);
      if (themeSelect && deck.theme && [...themeSelect.options].some((option) => option.value === deck.theme)) {
        themeSelect.value = deck.theme;
      }
      renderTemplateGallery();
    }

    async function deleteAsset(assetId) {
      try {
        const data = await json("/api/ppt/assets/" + assetId, {}, "DELETE");
        if (state.currentAssetId === assetId) {
          state.assetPreviewOpen = false;
          state.currentAssetId = null;
          state.deckId = null;
          state.outlineId = null;
          applyWorkspaceVisibility();
        }
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

    function renderDeckPreviewFrame(deckId, options = {}) {
      stopDeckRevealTimer();
      if (options.bustCache) state.previewRevision += 1;
      previewEl.classList.add("is-deck-loaded");
      previewEl.innerHTML = '<iframe class="preview-frame" title="PPT 在线预览" src="/api/ppt/decks/'
        + encodeURIComponent(deckId)
        + '/preview?v=' + encodeURIComponent(state.previewRevision) + '"></iframe>';
      const frame = previewEl.querySelector(".preview-frame");
      frame.addEventListener("load", attachPreviewSlidePicker);
    }

    async function refreshDeckPreviewFrame(deckId) {
      stopDeckRevealTimer();
      state.previewRevision += 1;
      const url = "/api/ppt/decks/" + encodeURIComponent(deckId) + "/preview?v=" + encodeURIComponent(state.previewRevision);
      const html = await fetch(url, { cache: "no-store" }).then(async (res) => {
        const text = await res.text();
        if (!res.ok) throw new Error(text || "预览刷新失败");
        return text;
      });
      previewEl.classList.add("is-deck-loaded");
      previewEl.innerHTML = '<iframe class="preview-frame" title="PPT 在线预览"></iframe>';
      const frame = previewEl.querySelector(".preview-frame");
      frame.addEventListener("load", attachPreviewSlidePicker);
      frame.srcdoc = html;
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
        page.setAttribute("title", "点击第 " + slideNumber + " 页，编辑内容或选择 AI 单页优化");
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
      if (selected) selectPreviewSlide(selected, { openEditor: false });
      else renderSelectedSlideLabel();
    }

    function selectPreviewSlide(slideNumber, { openEditor = true } = {}) {
      const normalizedNumber = Number(slideNumber);
      state.selectedSlideNumber = Number.isInteger(normalizedNumber) && normalizedNumber > 0 ? normalizedNumber : null;
      state.selectedSlideId = slideIdForNumber({ slides: state.outlineSlides }, state.selectedSlideNumber);
      const frame = previewEl.querySelector(".preview-frame");
      const pages = frame?.contentDocument ? [...frame.contentDocument.querySelectorAll(".preview-page")] : [];
      pages.forEach((page) => {
        page.dataset.selected = page.dataset.slideNumber === String(state.selectedSlideNumber);
      });
      renderSelectedSlideLabel();
      renderStructureEditor();
      if (openEditor) openSlideEditModal();
    }

    function openSlideEditModal() {
      if (!slideEditModalEl || !state.selectedSlideNumber) return;
      slideEditModalEl.setAttribute("aria-hidden", "false");
      renderSelectedSlideLabel();
    }

    function closeSlideEditModal() {
      if (!slideEditModalEl) return;
      slideEditModalEl.setAttribute("aria-hidden", "true");
    }

    function slideIdForNumber(deck, slideNumber) {
      const index = Number(slideNumber) - 1;
      const slide = Number.isInteger(index) && index >= 0 ? deck?.slides?.[index] : null;
      return slide?.id ? String(slide.id) : (slideNumber ? String(slideNumber) : null);
    }

    function updateCurrentPreviewSlide(slide) {
      const frame = previewEl.querySelector(".preview-frame");
      const doc = frame?.contentDocument;
      const page = doc?.querySelector('.preview-page[data-slide-number="' + state.selectedSlideNumber + '"]');
      if (!page || !slide) return false;
      const slideEl = page.querySelector(".slide");
      if (slideEl && slide.layout) slideEl.dataset.domeRole = String(slide.layout);
      const bullets = normalizePreviewBullets(slide.bullets);
      const annualTitleEl = page.querySelector(".annual-summary-text-title");
      const annualListEl = page.querySelector(".annual-summary-text-list");
      if (annualTitleEl) annualTitleEl.textContent = slide.title || "";
      if (annualListEl) {
        annualListEl.innerHTML = bullets.map((bullet) => '<li>' + escapeHtml(bullet) + '</li>').join("");
      }
      const annualTextEl = page.querySelector(".annual-summary-text");
      if (annualTextEl) {
        annualTextEl.style.setProperty("--annual-title-size", annualPreviewTitleSize(slide.title || "", state.selectedSlideNumber === 1) + "px");
        annualTextEl.style.setProperty("--annual-body-size", annualPreviewBodySize(bullets, state.selectedSlideNumber === 1) + "px");
      }
      const titleEl = page.querySelector(".slide-content h2");
      if (titleEl) titleEl.textContent = slide.title || "";
      const listEl = page.querySelector(".slide-content ul");
      if (listEl) {
        listEl.innerHTML = bullets.map((bullet) => '<li>' + escapeHtml(bullet) + '</li>').join("");
      }
      const showcaseCards = [...page.querySelectorAll(".dome-showcase-text")];
      if (showcaseCards.length) {
        showcaseCards.forEach((card, index) => {
          card.textContent = bullets[index] || "";
        });
      }
      const imageReportCards = [...page.querySelectorAll(".dome-image-report-card")];
      if (imageReportCards.length) {
        imageReportCards.forEach((card, index) => {
          card.textContent = bullets[index] || "";
        });
      }
      selectPreviewSlide(state.selectedSlideNumber);
      return true;
    }

    function normalizePreviewBullets(bullets) {
      if (!Array.isArray(bullets)) return [];
      return bullets.map((bullet) => {
        if (bullet == null) return "";
        if (typeof bullet === "string" || typeof bullet === "number" || typeof bullet === "boolean") return String(bullet).trim();
        if (typeof bullet === "object") {
          for (const key of ["text", "title", "label", "name", "value", "summary", "description"]) {
            if (bullet[key] != null) return String(bullet[key]).trim();
          }
        }
        return "";
      }).filter(Boolean);
    }

    function estimatePreviewTextUnits(text) {
      return Array.from(String(text || "")).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
    }

    function annualPreviewTitleSize(title, isCover) {
      const units = estimatePreviewTextUnits(title);
      if (isCover) {
        if (units > 88) return 20;
        if (units > 68) return 24;
        if (units > 48) return 28;
        return 38;
      }
      if (units > 82) return 13;
      if (units > 62) return 16;
      if (units > 42) return 19;
      return 28;
    }

    function annualPreviewBodySize(bullets, isCover) {
      const units = bullets.reduce((sum, item) => sum + estimatePreviewTextUnits(item), 0);
      const base = isCover ? 14 : 13;
      if (units > 180) return 8.5;
      if (units > 140) return 9.5;
      if (units > 100) return 10.5;
      if (units > 70) return 11.5;
      return base;
    }

    function renderSelectedSlideLabel() {
      if (slideEditSelectedEl) {
        slideEditSelectedEl.textContent = state.selectedSlideNumber
          ? "已选择第 " + state.selectedSlideNumber + " 页，可直接修改内容，或勾选 AI 单页优化。"
          : "请选择一页 PPT";
      }
      if (!selectedSlideLabelEl) return;
      if (!state.selectedSlideNumber) {
        selectedSlideLabelEl.innerHTML = '未选择页面<span>请先在在线预览中点击一页 PPT。</span>';
        return;
      }
      selectedSlideLabelEl.innerHTML = '已选择第 ' + state.selectedSlideNumber + ' 页<span>点击中间预览中的其他页面可切换。</span>';
    }

    function selectedOutlineSlideIndex() {
      const index = Number(state.selectedSlideNumber) - 1;
      return Number.isInteger(index) && index >= 0 && index < state.outlineSlides.length ? index : -1;
    }

    function renderStructureLayoutOptions(selectedLayout = "") {
      if (!structureSlideLayoutEl) return;
      structureSlideLayoutEl.innerHTML = STRUCTURE_LAYOUT_OPTIONS.map(([value, label]) => (
        '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + '</option>'
      )).join("");
      structureSlideLayoutEl.value = STRUCTURE_LAYOUT_OPTIONS.some(([value]) => value === selectedLayout) ? selectedLayout : "";
    }

    function setStructureEditorDisabled(isDisabled) {
      [structureSlideTitleEl, structureSlideLayoutEl, structureSlideBulletsEl, applyStructurePreviewButton].forEach((element) => {
        if (element) element.disabled = isDisabled;
      });
    }

    function syncSinglePageAiChoice() {
      const instructionEl = document.querySelector("#slide-instruction");
      const enabled = singlePageAiToggleEl?.checked === true;
      if (instructionEl) instructionEl.disabled = !enabled;
      const regenerateButton = document.querySelector("#regenerate-slide");
      if (regenerateButton) regenerateButton.disabled = !enabled || !state.selectedSlideId;
    }

    function formatAssetDate(value) {
      if (!value) return "历史文件";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return date.toLocaleString("zh-CN", { hour12: false });
    }

    function renderStructureEditor() {
      if (!structureSlideTitleEl || !structureSlideLayoutEl || !structureSlideBulletsEl) return;
      const index = selectedOutlineSlideIndex();
      renderStructureLayoutOptions(index >= 0 ? String(state.outlineSlides[index]?.layout || "") : "");
      if (index < 0) {
        structureSlideTitleEl.value = "";
        structureSlideBulletsEl.value = "";
        setStructureEditorDisabled(true);
        syncSinglePageAiChoice();
        return;
      }
      const slide = state.outlineSlides[index] || {};
      structureSlideTitleEl.value = slide.title || "";
      structureSlideBulletsEl.value = normalizePreviewBullets(slide.bullets).join("\\n");
      setStructureEditorDisabled(false);
      syncSinglePageAiChoice();
    }

    function applyStructureEditorToSelectedSlide() {
      const index = selectedOutlineSlideIndex();
      if (index < 0) throw new Error("请先在在线预览中选择要调整结构的页面");
      const title = structureSlideTitleEl.value.trim();
      const bullets = String(structureSlideBulletsEl.value || "")
        .split(/\\r?\\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!title) throw new Error("页面标题不能为空");
      if (!bullets.length) throw new Error("页面至少需要一个要点");
      const layout = structureSlideLayoutEl.value;
      const nextSlide = {
        ...state.outlineSlides[index],
        title,
        bullets,
        ...(layout ? { layout } : {})
      };
      if (!layout) delete nextSlide.layout;
      state.outlineSlides = state.outlineSlides.map((slide, slideIndex) => (
        slideIndex === index ? nextSlide : slide
      ));
      renderOutlineBoard(state.outlineSlides);
      state.selectedSlideNumber = index + 1;
      state.selectedSlideId = slideIdForNumber({ slides: state.outlineSlides }, state.selectedSlideNumber);
      renderStructureEditor();
      renderSelectedSlideLabel();
      return state.outlineSlides;
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
      if (state.selectedSlideNumber && state.selectedSlideNumber > state.outlineSlides.length) {
        state.selectedSlideNumber = state.outlineSlides.length || null;
        state.selectedSlideId = state.selectedSlideNumber ? String(state.selectedSlideNumber) : null;
      }
      outlineEditorEl.value = JSON.stringify(state.outlineSlides, null, 2);
      renderOutlineSummary(state.outlineSlides);
      renderStructureEditor();
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

    function setButtonWaiting(button, isBusy, label) {
      if (!button) return;
      button.disabled = isBusy;
      button.classList.toggle("is-waiting", isBusy);
      button.setAttribute("aria-busy", isBusy ? "true" : "false");
      button.innerHTML = isBusy
        ? '<span class="button-spinner" aria-hidden="true"></span><span class="button-label">' + escapeHtml(label) + '</span>'
        : escapeHtml(label);
    }

    function setDeckGenerationBusy(isBusy) {
      const button = document.querySelector("#generate-deck");
      setButtonWaiting(button, isBusy, isBusy ? "生成中..." : "生成专业 PPT");
    }

    function setSlideRegenerationBusy(isBusy) {
      const button = document.querySelector("#regenerate-slide");
      setButtonWaiting(button, isBusy, isBusy ? "AI 优化中..." : "AI 优化本页");
      if (!isBusy) syncSinglePageAiChoice();
      if (previewStageEl) previewStageEl.classList.toggle("is-polishing", isBusy);
      if (previewPolishLoadingEl) previewPolishLoadingEl.setAttribute("aria-hidden", isBusy ? "false" : "true");
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
          }, 1500);
          return;
        }

        if (task.status === "succeeded") {
          state.deckId = task.deckId || state.deckId;
          if (state.deckId) {
            await waitForDeckLoadingRhythm(state.outlineSlides);
            renderDeckPreviewFrame(state.deckId, { bustCache: true });
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
      document.body.dataset.assetPreviewOpen = state.assetPreviewOpen ? "true" : "false";
      if (backToOutlineButton) {
        backToOutlineButton.textContent = currentPage === "assets" && state.assetPreviewOpen ? "返回资产库" : "返回大纲内容";
      }
      document.querySelectorAll("[data-page-panel]").forEach((element) => {
        const pages = String(element.dataset.pagePanel || "").split(/\\s+/);
        const flowPanels = String(element.dataset.flowPanel || "").split(/\\s+/);
        const pageVisible = pages.includes(currentPage);
        const stageVisible = currentPage !== "create"
          || !element.dataset.flowPanel
          || flowPanels.includes(flowStage);
        const assetPreviewHidden = currentPage === "assets"
          && element.dataset.assetPreviewPanel === "true"
          && !state.assetPreviewOpen;
        element.classList.toggle("is-hidden", !pageVisible || !stageVisible || assetPreviewHidden);
      });
    }

    loadBalance();
    loadAssets();
    loadTemplateCategories();
    pageButtons.forEach((button) => {
      button.addEventListener("click", () => setWorkspacePage(button.dataset.pageTarget));
    });
    if (assetSearchEl) {
      assetSearchEl.addEventListener("input", () => {
        assetSearchQuery = assetSearchEl.value;
        assetPage = 1;
        renderAssets(assetCatalog);
      });
    }
    if (assetTimeFilterEl) {
      assetTimeFilterEl.addEventListener("change", () => {
        assetTimeFilter = assetTimeFilterEl.value;
        assetPage = 1;
        renderAssets(assetCatalog);
      });
    }
    setWorkspacePage(location.hash.slice(1) || "create");
    setFlowStage("input");
    renderStructureEditor();
    document.querySelector("#template").addEventListener("change", () => {
      renderThemeOptions();
      renderTemplateGallery();
    });
    document.querySelector("#theme").addEventListener("change", () => {
      renderSelectedTemplatePreview();
      renderTemplateGallery();
    });
    templateSearchEl?.addEventListener("input", () => {
      templateSearchQuery = templateSearchEl.value;
      expandedTemplateCategoryId = "";
      renderTemplateGallery();
    });
    document.querySelector("#template-category").addEventListener("change", () => {
      expandedTemplateCategoryId = "";
      loadTemplates();
    });
    document.querySelector("#upload-personal-template")?.addEventListener("click", uploadPersonalTemplate);
    document.querySelector("#delete-personal-template")?.addEventListener("click", deleteSelectedPersonalTemplate);
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
        setButtonWaiting(generateButton, true, "生成中...");
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
        setButtonWaiting(generateButton, false, "开始生成大纲");
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
    document.querySelector("#back-to-outline").addEventListener("click", () => {
      try {
        if ((document.body.dataset.workspacePage || "create") === "assets" && state.assetPreviewOpen) {
          // 资产库中的返回按钮只关闭在线预览，让用户回到历史 PPT 列表。
          state.assetPreviewOpen = false;
          state.currentAssetId = null;
          setWorkspacePage("assets");
          renderAssets(assetCatalog);
          statusEl.textContent = "已返回资产库，可继续搜索或打开其他历史 PPT。";
          return;
        }
        if (!state.outlineSlides.length) throw new Error("暂无可返回的大纲内容，请先生成大纲");
        // 直接回到当前大纲编辑态，保留用户已经生成或润色后的内容。
        setWorkspacePage("create");
        setFlowStage("outline");
        renderOutlineBoard(state.outlineSlides);
        statusEl.textContent = "已返回大纲内容，可继续编辑标题和要点。";
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
        if (state.deckId) {
          statusEl.textContent = "正在应用当前模板并刷新在线预览...";
          const data = await json("/api/ppt/decks/" + state.deckId + "/template", {
            template_id: document.querySelector("#template").value,
            theme: document.querySelector("#theme").value
          }, "PATCH");
          setTemplateSelectionFromDeck(data.deck);
          renderDeckPreviewFrame(state.deckId, { bustCache: true });
          statusEl.textContent = JSON.stringify(data.deck, null, 2);
          await loadAssets();
          return;
        }
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
          renderDeckPreviewFrame(state.deckId, { bustCache: true });
          setFlowStage("preview");
          await loadBalance();
          await loadAssets();
        } else {
          shouldReleaseButton = false;
        }
        await loadBalance();
      } catch (error) {
        const apiError = error.payload?.error || {};
        const runningTaskId = apiError.code === "GENERATION_ALREADY_RUNNING" ? apiError.details?.task_id : "";
        if (runningTaskId) {
          state.taskId = runningTaskId;
          statusEl.textContent = "已有 PPT 生成任务正在运行，已继续等待当前任务完成。";
          pollTaskProgress(state.taskId);
          shouldReleaseButton = false;
          return;
        }
        previewEl.classList.remove("is-deck-loaded");
        previewEl.innerHTML = '<div class="empty-preview"><div class="empty-slide"><h3>生成 PPT 失败</h3><p>' + escapeHtml(error.message) + '</p><div class="empty-line"></div></div></div>';
        statusEl.textContent = error.message;
      } finally {
        if (shouldReleaseButton) setDeckGenerationBusy(false);
      }
    });
    document.querySelector("#retry-task").addEventListener("click", async () => {
      const retryButton = document.querySelector("#retry-task");
      try {
        setButtonWaiting(retryButton, true, "重试中...");
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const data = await json("/api/ppt/tasks/" + state.taskId + "/retry", {
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        state.deckId = data.deck.id;
        state.taskId = data.task.id;
        showTaskStatus(data.task);
        pollTaskProgress(state.taskId);
        if (data.task.status === "succeeded" && state.deckId) {
          renderDeckPreviewFrame(state.deckId, { bustCache: true });
          setFlowStage("preview");
          await loadBalance();
          await loadAssets();
        }
        await loadBalance();
      } catch (error) { statusEl.textContent = error.message; }
      finally { setButtonWaiting(retryButton, false, "重试失败任务"); }
    });
    document.querySelector("#apply-structure-preview").addEventListener("click", async () => {
      try {
        if (!state.outlineId) throw new Error("请先生成大纲");
        applyStructureEditorToSelectedSlide();
        statusEl.textContent = "已更新第 " + state.selectedSlideNumber + " 页结构，正在重新生成在线预览...";
        closeSlideEditModal();
        document.querySelector("#generate-deck").click();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    });
    document.querySelector("#close-slide-edit-modal")?.addEventListener("click", closeSlideEditModal);
    document.querySelector("#slide-edit-modal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeSlideEditModal();
    });
    singlePageAiToggleEl?.addEventListener("change", syncSinglePageAiChoice);
    document.querySelector("#regenerate-slide").addEventListener("click", async () => {
      try {
        if (!state.deckId) throw new Error("请先应用模板生成 PPT，再使用 AI 润色单页");
        if (!singlePageAiToggleEl?.checked) throw new Error("请先勾选需要 AI 单页优化");
        setSlideRegenerationBusy(true);
        applyStructureEditorToSelectedSlide();
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
        if (data.deck?.slides) {
          state.outlineSlides = normalizeOutlineSlides(data.deck.slides);
          renderOutlineBoard(state.outlineSlides);
          state.selectedSlideId = slideIdForNumber({ slides: state.outlineSlides }, state.selectedSlideNumber);
        }
        updateCurrentPreviewSlide(data.slide);
        statusEl.textContent = JSON.stringify(data.slide, null, 2);
        await refreshDeckPreviewFrame(state.deckId);
        await loadBalance();
        closeSlideEditModal();
      } catch (error) {
        statusEl.textContent = error.message;
      } finally {
        setSlideRegenerationBusy(false);
      }
    });
    async function exportDeck(format, button) {
      const idleLabel = format === "pptx" ? "下载 PPTX" : "下载 PDF";
      try {
        setButtonWaiting(button, true, "准备下载...");
        if (!state.deckId) throw new Error("请先应用模板生成 PPT，再下载文件");
        const data = await json("/api/ppt/decks/" + state.deckId + "/exports", { format });
        statusEl.textContent = JSON.stringify(data.file, null, 2);
        window.location.href = "/api/files/" + data.file.id;
      } catch (error) { statusEl.textContent = error.message; }
      finally { setButtonWaiting(button, false, idleLabel); }
    }
    document.querySelector("#export-pptx").addEventListener("click", (event) => exportDeck("pptx", event.currentTarget));
    document.querySelector("#export-pdf").addEventListener("click", (event) => exportDeck("pdf", event.currentTarget));
  </script>
</body>
</html>`;
}
