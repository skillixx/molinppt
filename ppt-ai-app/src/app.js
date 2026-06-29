import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { AppError, normalizeError } from "./errors.js";

const MAX_JSON_BODY_BYTES = 1024 * 1024;
const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Creates the HTTP API application.
 * @param {object} dependencies
 * @returns {import("node:http").Server}
 */
export function createApp(dependencies) {
  const sessions = new Map();
  const sessionCookieName = dependencies.sessionCookieName || "ppt_ai_session";
  const sessionTtlMs = dependencies.sessionTtlMs || DEFAULT_SESSION_TTL_MS;
  const sessionCookieSecure = dependencies.sessionCookieSecure === true;

  return createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader("X-Request-Id", requestId);
    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, { status: "ok" });
        return;
      }

      if (request.method === "POST" && url.pathname === "/internal/reconcile") {
        requireInternalToken(request, dependencies.internalToken);
        const body = await readJson(request);
        const result = await dependencies.pptService.reconcileBillingEvents({ limit: body.limit });
        sendJson(response, { result });
        return;
      }

      if (request.method === "GET" && url.pathname === "/enter") {
        const ticket = url.searchParams.get("ticket");
        if (!ticket) throw new AppError({ code: "MISSING_TICKET", status: 400, message: "Missing launch ticket" });
        const identity = await dependencies.molingClient.verifyLaunchTicket(ticket);
        validateMolingIdentity({
          identity,
          expectedAppId: dependencies.expectedAppId,
          expectedProductId: dependencies.expectedProductId,
        });
        const sessionId = randomUUID();
        const session = {
          id: sessionId,
          identity,
          entitlementId: resolveSessionEntitlementId(identity, dependencies.defaultEntitlementId),
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

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderWorkspace({ defaultEntitlementId: session.entitlementId }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        sendJson(response, {
          user: {
            user_id: ownerUserId,
            role: "user",
            entitlement_id: session.entitlementId,
          },
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/templates") {
        sendJson(response, { templates: dependencies.templateManager.listTemplates() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/billing/balance") {
        const entitlementId = resolveEntitlementId(url.searchParams.get("entitlement_id"), session.entitlementId);
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

      if (request.method === "POST" && url.pathname === "/api/ppt/decks") {
        const body = await readJson(request);
        const result = await dependencies.pptService.generateDeck({
          ownerUserId,
          outlineId: body.outline_id,
          entitlementId: resolveEntitlementId(body.entitlement_id, session.entitlementId),
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
          entitlementId: resolveEntitlementId(body.entitlement_id, session.entitlementId),
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
          entitlementId: resolveEntitlementId(body.entitlement_id, session.entitlementId),
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
        url: request.url,
        code: appError.code,
      });
      sendJson(response, appError.toJSON(requestId), appError.status);
    }
  });
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
 * @param {object} identity
 * @param {number | undefined} configuredDefault
 * @returns {number | undefined}
 */
function resolveSessionEntitlementId(identity, configuredDefault) {
  return readPositiveId(identity.entitlement_id)
    || readPositiveId(identity.default_entitlement_id)
    || readPositiveId(identity.entitlement?.entitlement_id)
    || readPositiveId(identity.entitlement?.id)
    || readEntitlementList(identity.entitlements, identity.product_id)
    || configuredDefault;
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
    const itemProduct = readPositiveId(item.product_id);
    return !product || !itemProduct || itemProduct === product;
  });
  return matched ? readPositiveId(matched.entitlement_id) || readPositiveId(matched.id) : undefined;
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
 * @returns {Promise<object>}
 */
async function readJson(request) {
  const chunks = [];
  let sizeBytes = 0;
  for await (const chunk of request) {
    sizeBytes += chunk.length;
    if (sizeBytes > MAX_JSON_BODY_BYTES) {
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
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #171717; }
    header { height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    main { display: grid; grid-template-columns: 360px 1fr; gap: 18px; padding: 18px; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 15px; margin: 0 0 12px; }
    label { display: block; font-size: 12px; font-weight: 700; margin: 12px 0 6px; }
    input, textarea, select, button { font: inherit; box-sizing: border-box; }
    input, textarea, select { width: 100%; border: 1px solid #cfd5df; border-radius: 6px; padding: 9px 10px; }
    textarea { min-height: 92px; resize: vertical; }
    button { border: 0; border-radius: 6px; padding: 9px 12px; background: #165dff; color: white; cursor: pointer; }
    button.secondary { background: #475569; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .preview { min-height: 460px; background: #0f172a; color: #dbeafe; border-radius: 8px; padding: 16px; overflow: auto; }
    pre { white-space: pre-wrap; word-break: break-word; }
    @media (max-width: 860px) { main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>AI PPT 工作台</h1>
    <span>主题生成 / 文档生成 / 预览 / 导出</span>
  </header>
  <main>
    <section>
      <h2>生成设置</h2>
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
        </div>
      </div>
      <div class="row">
        <div>
          <label for="template">模板</label>
          <select id="template"><option value="business">Business</option></select>
        </div>
        <div>
          <label for="theme">主题风格</label>
          <select id="theme"><option value="modern">modern</option></select>
        </div>
      </div>
      <label for="document">上传文档内容</label>
      <textarea id="document" placeholder="可粘贴文档文本，生成大纲时会作为 source file 上传"></textarea>
      <label for="outline-editor">大纲 JSON</label>
      <textarea id="outline-editor" placeholder="生成大纲后可编辑 slides JSON"></textarea>
      <div class="actions">
        <button id="generate-outline">生成大纲</button>
        <button id="save-outline" class="secondary">保存大纲</button>
        <button id="generate-deck" class="secondary">生成 PPT</button>
        <button id="retry-task" class="secondary">重试失败任务</button>
        <button id="export-pptx" class="secondary">下载 PPTX</button>
        <button id="export-pdf" class="secondary">下载 PDF</button>
      </div>
      <h2>单页重生成</h2>
      <div class="row">
        <div>
          <label for="slide-id">slide_id</label>
          <input id="slide-id" placeholder="slide_1" />
        </div>
        <div>
          <label for="slide-instruction">指令</label>
          <input id="slide-instruction" placeholder="更正式、更简洁" />
        </div>
      </div>
      <div class="actions">
        <button id="regenerate-slide" class="secondary">重新生成单页</button>
      </div>
    </section>
    <section>
      <h2>在线预览</h2>
      <div id="preview" class="preview">等待生成...</div>
      <h2>套餐余额</h2>
      <pre id="balance-status">checking</pre>
      <h2>任务状态 / 日志</h2>
      <pre id="status">ready</pre>
    </section>
  </main>
  <script>
    const state = { outlineId: null, deckId: null, taskId: null };
    const statusEl = document.querySelector("#status");
    const balanceStatusEl = document.querySelector("#balance-status");
    const previewEl = document.querySelector("#preview");
    const outlineEditorEl = document.querySelector("#outline-editor");
    let templateCatalog = [{ id: "business", name: "Business", themes: ["modern", "classic"] }];
    const json = (url, body, method = "POST") => fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      return data;
    });
    async function loadBalance() {
      try {
        const data = await fetch("/api/billing/balance").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(JSON.stringify(payload));
          return payload;
        });
        balanceStatusEl.textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        balanceStatusEl.textContent = error.message;
      }
    }
    function renderTemplateOptions() {
      const templateEl = document.querySelector("#template");
      templateEl.innerHTML = templateCatalog.map((template) => (
        '<option value="' + template.id + '">' + template.name + '</option>'
      )).join("");
      renderThemeOptions();
    }
    function renderThemeOptions() {
      const selected = templateCatalog.find((template) => template.id === document.querySelector("#template").value) || templateCatalog[0];
      const themeEl = document.querySelector("#theme");
      themeEl.innerHTML = (selected.themes || ["modern"]).map((theme) => (
        '<option value="' + theme + '">' + theme + '</option>'
      )).join("");
    }
    async function loadTemplates() {
      try {
        const data = await fetch("/api/templates").then(async (res) => {
          const payload = await res.json();
          if (!res.ok) throw new Error(JSON.stringify(payload));
          return payload;
        });
        templateCatalog = data.templates;
        renderTemplateOptions();
      } catch (error) {
        statusEl.textContent = error.message;
      }
    }
    document.querySelector("#template").addEventListener("change", renderThemeOptions);
    loadTemplates();
    loadBalance();
    document.querySelector("#generate-outline").addEventListener("click", async () => {
      try {
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
        outlineEditorEl.value = JSON.stringify(data.outline.slides, null, 2);
        statusEl.textContent = JSON.stringify(data.outline, null, 2);
      } catch (error) { statusEl.textContent = error.message; }
    });
    document.querySelector("#save-outline").addEventListener("click", async () => {
      try {
        const data = await json("/api/ppt/outlines/" + state.outlineId, {
          slides: JSON.parse(outlineEditorEl.value)
        }, "PATCH");
        outlineEditorEl.value = JSON.stringify(data.outline.slides, null, 2);
        statusEl.textContent = JSON.stringify(data.outline, null, 2);
      } catch (error) { statusEl.textContent = error.message; }
    });
    document.querySelector("#generate-deck").addEventListener("click", async () => {
      try {
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const data = await json("/api/ppt/decks", {
          outline_id: state.outlineId,
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        state.deckId = data.deck.id;
        state.taskId = data.task.id;
        statusEl.textContent = JSON.stringify(data.task, null, 2);
        previewEl.innerHTML = await fetch("/api/ppt/decks/" + state.deckId + "/preview").then((res) => res.text());
        await loadBalance();
      } catch (error) {
        try {
          const parsed = JSON.parse(error.message);
          state.taskId = parsed.error?.details?.task_id || state.taskId;
        } catch {}
        statusEl.textContent = error.message;
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
        statusEl.textContent = JSON.stringify(data.task, null, 2);
        previewEl.innerHTML = await fetch("/api/ppt/decks/" + state.deckId + "/preview").then((res) => res.text());
        await loadBalance();
      } catch (error) { statusEl.textContent = error.message; }
    });
    document.querySelector("#regenerate-slide").addEventListener("click", async () => {
      try {
        const entitlementValue = document.querySelector("#entitlement").value.trim();
        const slideId = document.querySelector("#slide-id").value.trim();
        const instruction = document.querySelector("#slide-instruction").value.trim();
        const data = await json("/api/ppt/decks/" + state.deckId + "/slides/" + slideId + "/regenerate", {
          instruction,
          ...(entitlementValue ? { entitlement_id: Number(entitlementValue) } : {})
        });
        statusEl.textContent = JSON.stringify(data.slide, null, 2);
        previewEl.innerHTML = await fetch("/api/ppt/decks/" + state.deckId + "/preview").then((res) => res.text());
        await loadBalance();
      } catch (error) { statusEl.textContent = error.message; }
    });
    async function exportDeck(format) {
      try {
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
