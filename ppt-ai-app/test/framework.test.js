import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { AppError } from "../src/errors.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager } from "../src/templates.js";
import { HttpAiProvider, MockAiProvider } from "../src/ai-provider.js";
import { LocalMolingClient, MolingClient } from "../src/moling-client.js";
import { BillingClient } from "../src/billing.js";
import { requirePermission } from "../src/permissions.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-ai-app-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("JsonFileDatabase initializes named collections on disk", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["users", "files", "tasks"],
  });

  const state = await database.initialize();

  assert.deepEqual(Object.keys(state).sort(), ["files", "tasks", "users"]);
  assert.deepEqual(JSON.parse(await readFile(path.join(tempDir, "db.json"), "utf8")), state);
});

test("MolingClient wraps internal requests with token and envelope parsing", async () => {
  const calls = [];
  const client = new MolingClient({
    baseUrl: "http://moling.test",
    internalToken: "secret",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ code: 0, data: { user_id: 7, app_id: 15 } });
    },
  });

  const identity = await client.verifyLaunchTicket("ticket_1");

  assert.deepEqual(identity, { user_id: 7, app_id: 15 });
  assert.equal(calls[0].url, "http://moling.test/api/internal/app-launch/verify");
  assert.equal(calls[0].init.headers["X-Internal-Token"], "secret");
});

test("LocalMolingClient supports launch, balance, reserve, settle, release, and consume for local acceptance", async () => {
  const client = new LocalMolingClient({
    userId: 7,
    appId: 15,
    productId: 73,
    entitlementId: 88,
    initialCredits: "20",
  });

  const identity = await client.verifyLaunchTicket("local_ticket");
  const balance = await client.getInternal("/api/internal/entitlement-balance?user_id=7&entitlement_id=88");
  const reserve = await client.postInternal("/api/internal/entitlement-reserve", {
    user_id: 7,
    entitlement_id: 88,
    amount: "6",
    idempotency_key: "task:reserve",
  });
  const settled = await client.postInternal("/api/internal/entitlement-settle", {
    hold_id: reserve.hold_id,
    actual_amount: "6",
    idempotency_key: "task:settle",
  });
  const consumed = await client.postInternal("/api/internal/entitlement-consume", {
    user_id: 7,
    entitlement_id: 88,
    amount: "2",
    idempotency_key: "task:consume",
  });

  assert.deepEqual(identity, { user_id: 7, app_id: 15, product_id: 73 });
  assert.equal(balance.usable, true);
  assert.equal(settled.status, "settled");
  assert.equal(consumed.remaining, "12");
});

test("BillingClient delegates reserve and settle to MolingClient with stable payloads", async () => {
  const calls = [];
  const billing = new BillingClient({
    molingClient: {
      postInternal: async (pathName, body) => {
        calls.push([pathName, body]);
        return pathName.endsWith("reserve") ? { hold_id: 99 } : { status: "settled" };
      },
    },
  });

  await billing.reserveCredits({
    userId: 7,
    entitlementId: 11,
    amount: "6",
    idempotencyKey: "task_1:ppt_generate:reserve",
  });
  await billing.settleCredits({
    holdId: 99,
    actualAmount: "6",
    idempotencyKey: "task_1:ppt_generate:settle",
  });

  assert.deepEqual(calls[0], ["/api/internal/entitlement-reserve", {
    user_id: 7,
    entitlement_id: 11,
    amount: "6",
    idempotency_key: "task_1:ppt_generate:reserve",
  }]);
  assert.equal(calls[1][0], "/api/internal/entitlement-settle");
});

test("BillingClient wraps balance and consume entitlement calls", async () => {
  const calls = [];
  const billing = new BillingClient({
    molingClient: {
      getInternal: async (pathName) => {
        calls.push(["GET", pathName]);
        return { remaining: "12" };
      },
      postInternal: async (pathName, body) => {
        calls.push(["POST", pathName, body]);
        return { remaining: "10" };
      },
    },
  });

  await billing.getBalance({ userId: 7, entitlementId: 11 });
  await billing.consumeCredits({
    userId: 7,
    entitlementId: 11,
    amount: "2",
    idempotencyKey: "task_1:ppt_edit:consume",
  });

  assert.equal(calls[0][1], "/api/internal/entitlement-balance?user_id=7&entitlement_id=11");
  assert.deepEqual(calls[1], ["POST", "/api/internal/entitlement-consume", {
    user_id: 7,
    entitlement_id: 11,
    amount: "2",
    idempotency_key: "task_1:ppt_edit:consume",
  }]);
});

test("LocalFileStorage uploads and downloads owner-scoped files", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["files"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({
    storageDir: path.join(tempDir, "storage"),
    database,
  });

  const file = await storage.upload({
    ownerUserId: 7,
    fileName: "outline.txt",
    mimeType: "text/plain",
    content: Buffer.from("hello"),
  });
  const downloaded = await storage.download({ fileId: file.id, ownerUserId: 7 });

  assert.equal(downloaded.file.fileName, "outline.txt");
  assert.equal(downloaded.content.toString("utf8"), "hello");
  await assert.rejects(
    () => storage.download({ fileId: file.id, ownerUserId: 8 }),
    /FORBIDDEN/,
  );
});

test("MemoryTaskCenter creates tasks and advances status", async () => {
  const taskCenter = new MemoryTaskCenter();

  const task = await taskCenter.createTask({
    ownerUserId: 7,
    type: "ppt_generate",
    input: { topic: "Quarterly review" },
  });
  const running = await taskCenter.updateTask(task.id, { status: "running", progress: 50 });

  assert.equal(task.status, "queued");
  assert.equal(running.progress, 50);
  assert.equal((await taskCenter.getTask(task.id, 7)).status, "running");
});

test("MockAiProvider and TemplateManager expose framework abstractions", async () => {
  const ai = new MockAiProvider();
  const templates = new TemplateManager({
    templates: [{ id: "business", name: "Business", style: "clean" }],
  });

  const outline = await ai.generateOutline({ topic: "Roadmap", slideCount: 2 });
  assert.equal(outline[0].title, "Roadmap - slide 1");
  assert.equal(outline[1].bullets.length, 2);
  assert.equal(templates.getTemplate("business").name, "Business");
});

test("TemplateManager provides a multi-template default catalog with themes", () => {
  const templates = new TemplateManager();
  const catalog = templates.listTemplates();

  assert.equal(catalog.length >= 3, true);
  assert.deepEqual(catalog.map((template) => template.id), ["business", "education", "pitch"]);
  assert.equal(catalog.every((template) => template.themes.length >= 2), true);
  assert.equal(templates.getTemplate("pitch").style, "storytelling");
});

test("HttpAiProvider posts prompt requests to an external provider endpoint", async () => {
  const calls = [];
  const provider = new HttpAiProvider({
    endpoint: "http://ai.test/generate",
    apiKey: "ai-key",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        outline: [{ title: "Provider outline", bullets: ["A"] }],
        slides: [{ id: "slide_1", title: "Provider slide", bullets: ["B"] }],
        slide: { id: "slide_1", title: "Regenerated", bullets: ["C"] },
      });
    },
  });

  const outline = await provider.generateOutline({ topic: "Provider", slideCount: 1 });
  const slides = await provider.generateSlides({ outline: { slides: outline } });
  const slide = await provider.regenerateSlide({ slide: slides[0], instruction: "shorten" });

  assert.equal(calls[0].url, "http://ai.test/generate");
  assert.equal(calls[0].init.headers.Authorization, "Bearer ai-key");
  assert.equal(outline[0].title, "Provider outline");
  assert.equal(slides[0].title, "Provider slide");
  assert.equal(slide.title, "Regenerated");
});

test("requirePermission blocks cross-user resource access", () => {
  assert.doesNotThrow(() => requirePermission({
    actor: { userId: 7, role: "user" },
    resource: { ownerUserId: 7 },
    action: "read",
  }));
  assert.throws(
    () => requirePermission({
      actor: { userId: 7, role: "user" },
      resource: { ownerUserId: 8 },
      action: "read",
    }),
    /FORBIDDEN/,
  );
});

test("createApp exposes health, session, task, template, file, and error APIs", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks"],
  });
  await database.initialize();
  const app = createApp({
    database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager({ templates: [{ id: "business", name: "Business" }] }),
    aiProvider: new MockAiProvider(),
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.deepEqual(await health.json(), { status: "ok" });

    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];

    const templates = await fetch(`${baseUrl}/api/templates`, { headers: { cookie } });
    assert.equal((await templates.json()).templates[0].id, "business");

    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "brief.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("brief").toString("base64"),
      }),
    });
    assert.equal(upload.status, 201);

    const task = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ppt_generate", input: { topic: "Roadmap" } }),
    });
    assert.equal((await task.json()).task.status, "queued");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp rejects Moling launch tickets for the wrong app or product", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks"],
  });
  await database.initialize();
  const app = createApp({
    database,
    expectedAppId: 15,
    expectedProductId: 73,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 16, product_id: 73 }),
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager({ templates: [{ id: "business", name: "Business" }] }),
    aiProvider: new MockAiProvider(),
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/enter?ticket=wrong`, { redirect: "manual" });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, "APP_MISMATCH");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("AppError serializes public error details", () => {
  const error = new AppError({
    code: "VALIDATION_FAILED",
    status: 400,
    message: "Invalid input",
  });

  assert.deepEqual(error.toJSON("req_1"), {
    error: {
      code: "VALIDATION_FAILED",
      message: "Invalid input",
      request_id: "req_1",
    },
  });
});
