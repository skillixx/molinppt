import crypto from "node:crypto";
import { createServer } from "node:http";

import { runMockPptGeneration } from "./mock-generation.js";

const SESSION_COOKIE = "ppt_ai_session";

export function createApp({
  platform,
  appId,
  productId,
  defaultEntitlementId,
}) {
  const sessions = new Map();

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/enter") {
        await handleEnter({
          request,
          response,
          url,
          platform,
          sessions,
          appId,
          productId,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/dashboard") {
        const session = requireSession(request, sessions);
        sendHtml(response, renderDashboard({ session, defaultEntitlementId }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        const session = requireSession(request, sessions);
        sendJson(response, session.identity);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/entitlement-balance") {
        const session = requireSession(request, sessions);
        const entitlementId =
          url.searchParams.get("entitlement_id") || defaultEntitlementId;
        if (!entitlementId) {
          sendJson(response, { error: "entitlement_id is required" }, 400);
          return;
        }
        const balance = await platform.getEntitlementBalance({
          userId: session.identity.user_id,
          entitlementId,
        });
        sendJson(response, balance);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock-generate") {
        const session = requireSession(request, sessions);
        const body = await readJsonBody(request);
        const entitlementId = body.entitlement_id || defaultEntitlementId;
        if (!entitlementId) {
          sendJson(response, { error: "entitlement_id is required" }, 400);
          return;
        }
        const taskId = `task_${crypto.randomUUID()}`;
        request.pptAiContext = {
          taskId,
          userId: session.identity.user_id,
          entitlementId,
          amount: "6",
          mode: body.mode === "failure" ? "failure" : "success",
        };
        console.info("[ppt-ai-app] mock generation start", request.pptAiContext);
        const result = await runMockPptGeneration({
          platform,
          userId: session.identity.user_id,
          entitlementId,
          taskId,
          shouldFail: body.mode === "failure",
        });
        sendJson(response, result);
        return;
      }

      sendJson(response, { error: "not found" }, 404);
    } catch (error) {
      if (error.statusCode === 401) {
        sendJson(response, { error: "unauthorized" }, 401);
        return;
      }
      const status = error.status || 500;
      console.error("[ppt-ai-app] request failed", {
        method: request.method,
        url: request.url,
        status,
        code: error.code,
        path: error.path,
        message: error.message,
        data: error.data,
        context: request.pptAiContext,
      });
      sendJson(
        response,
        {
          error: error.message || "Internal server error",
          code: error.code,
          path: error.path,
          data: error.data,
          context: request.pptAiContext,
        },
        status,
      );
    }
  });
}

async function handleEnter({
  response,
  url,
  platform,
  sessions,
  appId,
  productId,
}) {
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    sendHtml(
      response,
      renderMessage("缺少 ticket", "请从魔灵平台点击进入 PPT AI 应用。"),
      400,
    );
    return;
  }

  const identity = await platform.verifyLaunchTicket(ticket);
  if (Number(identity.app_id) !== Number(appId)) {
    sendHtml(response, renderMessage("应用不匹配", "ticket 不属于 PPT AI 应用。"), 403);
    return;
  }
  if (Number(identity.product_id) !== Number(productId)) {
    sendHtml(
      response,
      renderMessage("商品不匹配", "ticket 不属于 PPT AI 积分包商品。"),
      403,
    );
    return;
  }

  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    id: sessionId,
    identity,
    createdAt: new Date().toISOString(),
  });

  response.writeHead(302, {
    "Set-Cookie": `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Lax; Path=/`,
    Location: "/dashboard",
  });
  response.end();
}

function requireSession(request, sessions) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
  return session;
}

function readCookie(request, name) {
  const cookie = request.headers.cookie || "";
  for (const item of cookie.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) return valueParts.join("=");
  }
  return null;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, html, status = 200) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function renderDashboard({ session, defaultEntitlementId }) {
  const identity = session.identity;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PPT AI 联调</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f7f8fb; color: #171717; }
    main { max-width: 920px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 28px; margin: 0 0 10px; }
    p { color: #555; line-height: 1.6; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 22px; margin-top: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    input, select, button { font: inherit; }
    input, select { height: 40px; border: 1px solid #cfd5df; border-radius: 6px; padding: 0 10px; min-width: 220px; }
    button { height: 40px; border: 0; border-radius: 6px; padding: 0 14px; background: #1f6feb; color: white; cursor: pointer; }
    button.secondary { background: #475569; }
    pre { background: #0f172a; color: #dbeafe; border-radius: 8px; padding: 16px; overflow: auto; min-height: 120px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .meta div { background: #f8fafc; border-radius: 6px; padding: 10px; }
  </style>
</head>
<body>
  <main>
    <h1>PPT AI 魔灵平台联调</h1>
    <p>当前页面只验证第一条链路：SSO ticket、积分余额、生成预占、成功结算、失败释放。真实 PPT 生成在下一阶段接入。</p>

    <section>
      <h2>登录身份</h2>
      <div class="meta">
        <div><strong>user_id</strong><br />${escapeHtml(identity.user_id)}</div>
        <div><strong>app_id</strong><br />${escapeHtml(identity.app_id)}</div>
        <div><strong>product_id</strong><br />${escapeHtml(identity.product_id)}</div>
      </div>
    </section>

    <section>
      <h2>积分余额</h2>
      <div class="row">
        <div>
          <label for="entitlement">entitlement_id</label>
          <input id="entitlement" value="${escapeHtml(defaultEntitlementId || "")}" />
        </div>
        <button id="check">查询余额</button>
      </div>
    </section>

    <section>
      <h2>模拟 PPT 生成</h2>
      <div class="row">
        <div>
          <label for="mode">模式</label>
          <select id="mode">
            <option value="success">成功：reserve 后 settle</option>
            <option value="failure">失败：reserve 后 release</option>
          </select>
        </div>
        <button id="generate">执行模拟生成</button>
      </div>
    </section>

    <section>
      <h2>结果</h2>
      <pre id="result">等待操作...</pre>
    </section>
  </main>
  <script>
    const result = document.querySelector("#result");
    const entitlement = document.querySelector("#entitlement");
    document.querySelector("#check").addEventListener("click", async () => {
      const res = await fetch("/api/entitlement-balance?entitlement_id=" + encodeURIComponent(entitlement.value));
      result.textContent = JSON.stringify(await res.json(), null, 2);
    });
    document.querySelector("#generate").addEventListener("click", async () => {
      const res = await fetch("/api/mock-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entitlement_id: entitlement.value,
          mode: document.querySelector("#mode").value
        })
      });
      result.textContent = JSON.stringify(await res.json(), null, 2);
    });
  </script>
</body>
</html>`;
}

function renderMessage(title, message) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
