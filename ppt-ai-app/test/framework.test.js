import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { AppError } from "../src/errors.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage, MAX_UPLOAD_BYTES } from "../src/files.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager, resolveTemplateVisual } from "../src/templates.js";
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

test("MolingClient maps non-JSON Moling errors to AppError", async () => {
  const client = new MolingClient({
    baseUrl: "http://moling.test",
    internalToken: "secret",
    fetcher: async () => new Response("404 page not found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    }),
  });

  await assert.rejects(
    () => client.listUserEntitlements({ userId: 7, productId: 73 }),
    (error) => {
      assert.equal(error instanceof AppError, true);
      assert.equal(error.code, "404");
      assert.equal(error.status, 404);
      assert.match(error.message, /404 page not found/);
      return true;
    },
  );
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

test("LocalMolingClient rejects invalid local launch tickets", async () => {
  const client = new LocalMolingClient({
    userId: 7,
    appId: 15,
    productId: 73,
    entitlementId: 88,
  });

  await assert.rejects(
    () => client.verifyLaunchTicket("invalid_ticket"),
    (error) => {
      assert.equal(error instanceof AppError, true);
      assert.equal(error.code, "40003");
      assert.equal(error.status, 403);
      return true;
    },
  );
});

test("LocalMolingClient reuses idempotent billing responses without double charging", async () => {
  const client = new LocalMolingClient({
    userId: 7,
    appId: 15,
    productId: 73,
    entitlementId: 88,
    initialCredits: "20",
  });

  const firstReserve = await client.postInternal("/api/internal/entitlement-reserve", {
    user_id: 7,
    entitlement_id: 88,
    amount: "6",
    idempotency_key: "same-task:reserve",
  });
  const secondReserve = await client.postInternal("/api/internal/entitlement-reserve", {
    user_id: 7,
    entitlement_id: 88,
    amount: "6",
    idempotency_key: "same-task:reserve",
  });
  const afterReserve = await client.getInternal("/api/internal/entitlement-balance?user_id=7&entitlement_id=88");
  const firstSettle = await client.postInternal("/api/internal/entitlement-settle", {
    hold_id: firstReserve.hold_id,
    actual_amount: "6",
    idempotency_key: "same-task:settle",
  });
  const secondSettle = await client.postInternal("/api/internal/entitlement-settle", {
    hold_id: firstReserve.hold_id,
    actual_amount: "6",
    idempotency_key: "same-task:settle",
  });
  const afterSettle = await client.getInternal("/api/internal/entitlement-balance?user_id=7&entitlement_id=88");

  assert.deepEqual(secondReserve, firstReserve);
  assert.deepEqual(secondSettle, firstSettle);
  assert.equal(afterReserve.quota_reserved, "6");
  assert.equal(afterReserve.remaining, "14");
  assert.equal(afterSettle.quota_reserved, "0");
  assert.equal(afterSettle.quota_used, "6");
  assert.equal(afterSettle.remaining, "14");
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

test("LocalFileStorage rejects unsafe upload payloads", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["files"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({
    storageDir: path.join(tempDir, "storage"),
    database,
  });

  await assert.rejects(
    () => storage.upload({
      ownerUserId: 7,
      fileName: "empty.txt",
      mimeType: "text/plain",
      content: Buffer.alloc(0),
    }),
    { code: "FILE_EMPTY" },
  );
  await assert.rejects(
    () => storage.upload({
      ownerUserId: 7,
      fileName: "tool.exe",
      mimeType: "application/x-msdownload",
      content: Buffer.from("bad"),
    }),
    { code: "UNSUPPORTED_FILE_TYPE" },
  );
  await assert.rejects(
    () => storage.upload({
      ownerUserId: 7,
      fileName: "large.txt",
      mimeType: "text/plain",
      content: Buffer.alloc(MAX_UPLOAD_BYTES + 1),
    }),
    { code: "FILE_TOO_LARGE" },
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

  assert.equal(catalog.length >= 10, true);
  assert.deepEqual(catalog.slice(0, 5).map((template) => template.id), ["business", "strategy-consulting", "industry-research", "competitor-analysis", "growth-strategy-planning"]);
  assert.equal(catalog.some((template) => template.id === "financial-review"), true);
  assert.equal(catalog.some((template) => template.id === "sales-proposal"), true);
  assert.equal(catalog.some((template) => template.id === "product-roadmap"), true);
  assert.equal(catalog.some((template) => template.id === "marketing-campaign"), true);
  assert.equal(catalog.some((template) => template.id === "data-insight"), true);
  assert.equal(catalog.some((template) => template.id === "quarterly-business-review"), false);
  assert.equal(catalog.every((template) => template.themes.length >= 1), true);
  assert.equal(catalog.every((template) => template.category?.id), true);
  assert.equal(catalog.every((template) => template.layoutSchema?.defaultContentLayout), true);
  assert.equal(templates.getTemplate("pitch").style, "venture-story");
});

test("resolveTemplateVisual applies business theme visual overrides", () => {
  const defaultVisual = resolveTemplateVisual({ templateId: "business", theme: "modern" });
  const classicVisual = resolveTemplateVisual({ templateId: "business", theme: "classic" });
  const executiveVisual = resolveTemplateVisual({ templateId: "business", theme: "executive" });
  const minimalVisual = resolveTemplateVisual({ templateId: "business", theme: "minimal" });

  assert.equal(defaultVisual.primary, "B91C1C");
  assert.equal(defaultVisual.accent, "D97706");
  assert.equal(classicVisual.primary, "1F2A37");
  assert.equal(classicVisual.accent, "B89B5E");
  assert.equal(classicVisual.background, "E8ECEF");
  assert.equal(classicVisual.title, "111827");
  assert.equal(classicVisual.body, "374151");
  assert.equal(executiveVisual.primary, "102A43");
  assert.equal(executiveVisual.accent, "BFA46A");
  assert.equal(executiveVisual.background, "E6EDF5");
  assert.equal(executiveVisual.title, "0B1F33");
  assert.equal(executiveVisual.body, "334155");
  assert.equal(minimalVisual.accent, "6B7280");
  assert.equal(minimalVisual.background, "E9EEF5");
  assert.equal(minimalVisual.title, "0F172A");
  assert.equal(minimalVisual.layout, "top-band");
  assert.equal(defaultVisual.layout, "top-band");
  assert.equal(classicVisual.layout, "top-band");
  assert.equal(executiveVisual.layout, "top-band");
});

test("resolveTemplateVisual applies project status weekly commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "project-status", theme: "weekly" });

  assert.equal(visual.primary, "163D59");
  assert.equal(visual.accent, "2AA7A5");
  assert.equal(visual.background, "EEF2F6");
  assert.equal(visual.title, "102A43");
  assert.equal(visual.layout, "status-report");
  assert.equal(visual.variant, "weekly");
});

test("resolveTemplateVisual applies project status steering commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "project-status", theme: "steering" });

  assert.equal(visual.primary, "1F2F46");
  assert.equal(visual.accent, "D59E3D");
  assert.equal(visual.background, "EEF2F6");
  assert.equal(visual.title, "111827");
  assert.equal(visual.layout, "status-report");
  assert.equal(visual.variant, "steering");
});

test("resolveTemplateVisual applies project status delivery commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "project-status", theme: "delivery" });

  assert.equal(visual.primary, "12324A");
  assert.equal(visual.accent, "2BA6A0");
  assert.equal(visual.background, "EEF2F6");
  assert.equal(visual.title, "0F2637");
  assert.equal(visual.layout, "status-report");
  assert.equal(visual.variant, "delivery");
});

test("resolveTemplateVisual applies strategy consulting board commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "strategy-consulting", theme: "board" });

  assert.equal(visual.primary, "18253A");
  assert.equal(visual.accent, "C7A15A");
  assert.equal(visual.background, "EEF1F5");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "board");
});

test("TemplateManager keeps strategy consulting theme names readable", () => {
  const templates = new TemplateManager();
  const strategy = templates.getTemplate("strategy-consulting");

  assert.deepEqual(strategy.themes.map((theme) => theme.name), ["董事会汇报", "矩阵分类", "工作流程推进"]);
});

test("resolveTemplateVisual applies strategy consulting matrix commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "strategy-consulting", theme: "matrix" });

  assert.equal(visual.primary, "203A5C");
  assert.equal(visual.accent, "4C8F8A");
  assert.equal(visual.background, "F0F5F7");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "matrix");
});

test("resolveTemplateVisual applies strategy consulting workstream commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "strategy-consulting", theme: "workstream" });

  assert.equal(visual.primary, "27364A");
  assert.equal(visual.accent, "D29A45");
  assert.equal(visual.background, "F4F1EA");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "workstream");
});

test("resolveTemplateVisual applies industry research landscape visual", () => {
  const visual = resolveTemplateVisual({ templateId: "industry-research", theme: "industry-landscape" });

  assert.equal(visual.primary, "12325A");
  assert.equal(visual.accent, "18A7A7");
  assert.equal(visual.background, "F3F7FA");
  assert.equal(visual.layout, "industry-research");
  assert.equal(visual.variant, "industry-landscape");
});

test("resolveTemplateVisual applies competitor analysis SWOT map visual", () => {
  const visual = resolveTemplateVisual({ templateId: "competitor-analysis", theme: "swot-map" });

  assert.equal(visual.primary, "102A43");
  assert.equal(visual.accent, "12A5A6");
  assert.equal(visual.background, "F5F8FB");
  assert.equal(visual.layout, "strategy-swot-map");
  assert.equal(visual.variant, "swot-map");
});

test("resolveTemplateVisual applies growth strategy second curve visual", () => {
  const visual = resolveTemplateVisual({ templateId: "growth-strategy-planning", theme: "second-curve" });

  assert.equal(visual.primary, "0E2A47");
  assert.equal(visual.accent, "16B8A6");
  assert.equal(visual.background, "EEF6F4");
  assert.equal(visual.layout, "strategy-second-curve");
  assert.equal(visual.variant, "second-curve");
});

test("resolveTemplateVisual applies financial review quarterly commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "financial-review", theme: "quarterly" });

  assert.equal(visual.primary, "18344E");
  assert.equal(visual.accent, "3B8C62");
  assert.equal(visual.background, "EDF3F4");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "quarterly");
});

test("resolveTemplateVisual applies financial review audit commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "financial-review", theme: "audit" });

  assert.equal(visual.primary, "243447");
  assert.equal(visual.accent, "A56A43");
  assert.equal(visual.background, "F3F0EC");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "audit");
});

test("resolveTemplateVisual applies financial review forecast commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "financial-review", theme: "forecast" });

  assert.equal(visual.primary, "123B4D");
  assert.equal(visual.accent, "2F9E9A");
  assert.equal(visual.background, "EEF6F7");
  assert.equal(visual.layout, "executive");
  assert.equal(visual.variant, "forecast");
});

test("resolveTemplateVisual applies cost control breakdown official visual", () => {
  const visual = resolveTemplateVisual({ templateId: "cost-control-plan", theme: "cost-breakdown" });

  assert.equal(visual.primary, "102A43");
  assert.equal(visual.accent, "D59E3D");
  assert.equal(visual.background, "EEF3F6");
  assert.equal(visual.layout, "finance-cost-breakdown");
  assert.equal(visual.variant, "cost-breakdown");
});

test("resolveTemplateVisual maps cost control official slug to dedicated visual", () => {
  const visual = resolveTemplateVisual({ templateId: "finance-cost-control-plan-cost-breakdown", theme: "cost-breakdown" });

  assert.equal(visual.layout, "finance-cost-breakdown");
  assert.equal(visual.variant, "cost-breakdown");
});

test("resolveTemplateVisual maps cash flow official slug to dedicated visual", () => {
  const visual = resolveTemplateVisual({ templateId: "finance-cash-flow-analysis-report-cash-flow-forecast", theme: "cash-flow-forecast" });

  assert.equal(visual.layout, "finance-cash-flow-forecast");
  assert.equal(visual.variant, "cash-flow-forecast");
});

test("resolveTemplateVisual applies sales proposal enterprise commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "sales-proposal", theme: "enterprise" });

  assert.equal(visual.primary, "14565A");
  assert.equal(visual.accent, "D19A3E");
  assert.equal(visual.background, "EEF7F6");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "enterprise");
});

test("resolveTemplateVisual applies sales proposal solution commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "sales-proposal", theme: "solution" });

  assert.equal(visual.primary, "1E4F76");
  assert.equal(visual.accent, "39A7A0");
  assert.equal(visual.background, "EFF6F8");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "solution");
});

test("resolveTemplateVisual applies sales proposal renewal commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "sales-proposal", theme: "renewal" });

  assert.equal(visual.primary, "4B3F72");
  assert.equal(visual.accent, "E0A33C");
  assert.equal(visual.background, "F4F1FA");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "renewal");
});

test("resolveTemplateVisual applies key account decision chain official visual", () => {
  const visual = resolveTemplateVisual({ templateId: "key-account-plan", theme: "decision-chain" });

  assert.equal(visual.primary, "102A43");
  assert.equal(visual.accent, "F59E0B");
  assert.equal(visual.secondary, "15A39A");
  assert.equal(visual.background, "EEF4F8");
  assert.equal(visual.layout, "sales-key-account-decision-chain");
  assert.equal(visual.variant, "decision-chain");
});

test("resolveTemplateVisual maps key account official slug to dedicated visual", () => {
  const visual = resolveTemplateVisual({ templateId: "sales-key-account-plan-decision-chain", theme: "decision-chain" });

  assert.equal(visual.layout, "sales-key-account-decision-chain");
  assert.equal(visual.variant, "decision-chain");
});

test("resolveTemplateVisual applies product roadmap commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "product-roadmap", theme: "roadmap" });

  assert.equal(visual.primary, "145A7A");
  assert.equal(visual.accent, "2FB7A3");
  assert.equal(visual.background, "EEF8FA");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "roadmap");
});

test("resolveTemplateVisual applies product release commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "product-roadmap", theme: "release" });

  assert.equal(visual.primary, "3B4A8F");
  assert.equal(visual.accent, "F2A65A");
  assert.equal(visual.background, "F2F4FB");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "release");
});

test("resolveTemplateVisual applies product review commercial visual", () => {
  const visual = resolveTemplateVisual({ templateId: "product-roadmap", theme: "product-review" });

  assert.equal(visual.primary, "263D4A");
  assert.equal(visual.accent, "E07A5F");
  assert.equal(visual.background, "F5F6F2");
  assert.equal(visual.layout, "academy");
  assert.equal(visual.variant, "product-review");
});

test("resolveTemplateVisual applies product commercialization pricing strategy visual", () => {
  const visual = resolveTemplateVisual({ templateId: "product-commercialization-plan", theme: "pricing-strategy" });

  assert.equal(visual.primary, "14213D");
  assert.equal(visual.accent, "F4B740");
  assert.equal(visual.secondary, "2EC4B6");
  assert.equal(visual.background, "F3F6FA");
  assert.equal(visual.layout, "product-pricing-strategy");
  assert.equal(visual.variant, "pricing-strategy");
});

test("resolveTemplateVisual maps product commercialization official slug", () => {
  const visual = resolveTemplateVisual({ templateId: "product-product-commercialization-plan-pricing-strategy", theme: "pricing-strategy" });

  assert.equal(visual.layout, "product-pricing-strategy");
  assert.equal(visual.variant, "pricing-strategy");
});

test("resolveTemplateVisual applies education lecture course visual", () => {
  const visual = resolveTemplateVisual({ templateId: "education", theme: "lecture" });

  assert.equal(visual.primary, "214E44");
  assert.equal(visual.accent, "E6B84F");
  assert.equal(visual.background, "EEF5F0");
  assert.equal(visual.layout, "education-course");
  assert.equal(visual.variant, "lecture");
});

test("resolveTemplateVisual applies education workshop course visual", () => {
  const visual = resolveTemplateVisual({ templateId: "education", theme: "workshop" });

  assert.equal(visual.primary, "3F4A8A");
  assert.equal(visual.accent, "F28C6B");
  assert.equal(visual.background, "F3F1FA");
  assert.equal(visual.layout, "education-course");
  assert.equal(visual.variant, "workshop");
});

test("resolveTemplateVisual applies education minimal course visual", () => {
  const visual = resolveTemplateVisual({ templateId: "education", theme: "minimal" });

  assert.equal(visual.primary, "2F5D73");
  assert.equal(visual.accent, "7BBE9A");
  assert.equal(visual.background, "F1F6F7");
  assert.equal(visual.layout, "education-course");
  assert.equal(visual.variant, "minimal");
});

test("resolveTemplateVisual applies corporate training official visual", () => {
  const template = {
    id: "education-corporate-training-management",
    visual: {
      primary: "1F3A5F",
      accent: "20A39E",
      background: "F4F7FA",
      surface: "FFFFFF",
      title: "10233D",
      body: "40516A",
      layout: "corporate-training",
      variant: "management",
    },
    themes: [
      {
        id: "management",
        visual: {
          layout: "corporate-training",
          variant: "management",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "management", template });

  assert.equal(visual.id, "education-corporate-training-management");
  assert.equal(visual.primary, "1F3A5F");
  assert.equal(visual.accent, "20A39E");
  assert.equal(visual.background, "F4F7FA");
  assert.equal(visual.layout, "corporate-training");
  assert.equal(visual.variant, "management");
});

test("resolveTemplateVisual applies onboarding guide official visual", () => {
  const template = {
    id: "education-onboarding-training-onboarding-guide",
    visual: {
      primary: "1E3A5F",
      accent: "14B8A6",
      secondary: "F59E0B",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "102033",
      body: "41516A",
      layout: "onboarding-guide",
      variant: "onboarding-guide",
    },
    themes: [
      {
        id: "onboarding-guide",
        visual: {
          layout: "onboarding-guide",
          variant: "onboarding-guide",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "onboarding-guide", template });

  assert.equal(visual.id, "education-onboarding-training-onboarding-guide");
  assert.equal(visual.primary, "1E3A5F");
  assert.equal(visual.accent, "14B8A6");
  assert.equal(visual.background, "F4F8FB");
  assert.equal(visual.layout, "onboarding-guide");
  assert.equal(visual.variant, "onboarding-guide");
});

test("resolveTemplateVisual applies knowledge handout blackboard official visual", () => {
  const template = {
    id: "education-knowledge-handout-blackboard",
    visual: {
      primary: "173B33",
      accent: "FACC15",
      secondary: "60A5FA",
      background: "F4F1E8",
      surface: "FFFDF5",
      title: "F8FAE7",
      body: "E8F3DF",
      layout: "knowledge-blackboard",
      variant: "blackboard",
    },
    themes: [
      {
        id: "blackboard",
        visual: {
          layout: "knowledge-blackboard",
          variant: "blackboard",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "blackboard", template });

  assert.equal(visual.id, "education-knowledge-handout-blackboard");
  assert.equal(visual.primary, "173B33");
  assert.equal(visual.accent, "FACC15");
  assert.equal(visual.background, "F4F1E8");
  assert.equal(visual.layout, "knowledge-blackboard");
  assert.equal(visual.variant, "blackboard");
});

test("resolveTemplateVisual applies exam review courseware official visual", () => {
  const template = {
    id: "education-exam-review-courseware-key-points",
    visual: {
      primary: "1E2A78",
      accent: "F59E0B",
      secondary: "06B6D4",
      warning: "EF4444",
      background: "F4F7FB",
      surface: "FFFFFF",
      title: "172554",
      body: "334155",
      layout: "exam-review-keypoints",
      variant: "key-points",
    },
    themes: [
      {
        id: "key-points",
        visual: {
          layout: "exam-review-keypoints",
          variant: "key-points",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "key-points", template });

  assert.equal(visual.id, "education-exam-review-courseware-key-points");
  assert.equal(visual.primary, "1E2A78");
  assert.equal(visual.accent, "F59E0B");
  assert.equal(visual.background, "F4F7FB");
  assert.equal(visual.layout, "exam-review-keypoints");
  assert.equal(visual.variant, "key-points");
});

test("resolveTemplateVisual applies teaching achievement showcase official visual", () => {
  const template = {
    id: "education-teaching-achievement-report-showcase",
    visual: {
      primary: "1E3A8A",
      accent: "14B8A6",
      secondary: "F59E0B",
      success: "22C55E",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "172554",
      body: "334155",
      layout: "teaching-achievement-showcase",
      variant: "showcase",
    },
    themes: [
      {
        id: "showcase",
        visual: {
          layout: "teaching-achievement-showcase",
          variant: "showcase",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "showcase", template });

  assert.equal(visual.id, "education-teaching-achievement-report-showcase");
  assert.equal(visual.primary, "1E3A8A");
  assert.equal(visual.accent, "14B8A6");
  assert.equal(visual.background, "F4F8FB");
  assert.equal(visual.layout, "teaching-achievement-showcase");
  assert.equal(visual.variant, "showcase");
});

test("resolveTemplateVisual applies marketing campaign theme visuals", () => {
  const launch = resolveTemplateVisual({ templateId: "marketing-campaign", theme: "launch" });
  const brand = resolveTemplateVisual({ templateId: "marketing-campaign", theme: "brand" });
  const growth = resolveTemplateVisual({ templateId: "marketing-campaign", theme: "growth" });

  assert.equal(launch.layout, "marketing");
  assert.equal(launch.variant, "launch");
  assert.equal(launch.primary, "E11D48");
  assert.equal(brand.layout, "marketing");
  assert.equal(brand.variant, "brand");
  assert.equal(brand.accent, "06B6D4");
  assert.equal(growth.layout, "marketing");
  assert.equal(growth.variant, "growth");
  assert.equal(growth.accent, "F97316");
});

test("resolveTemplateVisual applies pitch deck commercial visuals", () => {
  const startup = resolveTemplateVisual({ templateId: "pitch", theme: "startup" });
  const investor = resolveTemplateVisual({ templateId: "pitch", theme: "investor" });
  const product = resolveTemplateVisual({ templateId: "pitch", theme: "product" });

  assert.equal(startup.layout, "venture");
  assert.equal(startup.variant, "startup");
  assert.equal(startup.primary, "16213E");
  assert.equal(startup.accent, "F59E0B");
  assert.equal(investor.layout, "venture");
  assert.equal(investor.variant, "investor");
  assert.equal(investor.primary, "0F2D3A");
  assert.equal(investor.accent, "19A0A5");
  assert.equal(product.layout, "venture");
  assert.equal(product.variant, "product");
  assert.equal(product.primary, "3B1D5A");
  assert.equal(product.accent, "E879F9");
});

test("resolveTemplateVisual applies brand story commercial visuals", () => {
  const editorial = resolveTemplateVisual({ templateId: "brand-story", theme: "editorial" });
  const premium = resolveTemplateVisual({ templateId: "brand-story", theme: "premium" });
  const identity = resolveTemplateVisual({ templateId: "brand-story", theme: "identity" });

  assert.equal(editorial.layout, "brand-story");
  assert.equal(editorial.variant, "editorial");
  assert.equal(editorial.primary, "2A2F3F");
  assert.equal(editorial.accent, "C7825A");
  assert.equal(premium.layout, "brand-story");
  assert.equal(premium.variant, "premium");
  assert.equal(premium.accent, "BFA06A");
  assert.equal(identity.layout, "brand-story");
  assert.equal(identity.variant, "identity");
  assert.equal(identity.primary, "123D4A");
  assert.equal(identity.accent, "E56F4F");
});

test("resolveTemplateVisual applies data insight commercial visuals", () => {
  const dashboard = resolveTemplateVisual({ templateId: "data-insight", theme: "dashboard" });
  const insight = resolveTemplateVisual({ templateId: "data-insight", theme: "insight" });
  const research = resolveTemplateVisual({ templateId: "data-insight", theme: "research" });

  assert.equal(dashboard.layout, "data-insight");
  assert.equal(dashboard.variant, "dashboard");
  assert.equal(dashboard.primary, "123B63");
  assert.equal(dashboard.accent, "18A0A6");
  assert.equal(insight.layout, "data-insight");
  assert.equal(insight.variant, "insight");
  assert.equal(insight.accent, "F6A623");
  assert.equal(research.layout, "data-insight");
  assert.equal(research.variant, "research");
  assert.equal(research.primary, "2F3A4A");
});

test("resolveTemplateVisual applies BI executive cockpit official visual", () => {
  const template = {
    id: "data-bi-dashboard-executive-cockpit",
    visual: {
      primary: "071A2F",
      accent: "22D3EE",
      secondary: "A3E635",
      background: "08111F",
      surface: "0E2238",
      title: "E6F7FF",
      body: "A8C7D8",
      layout: "bi-executive-cockpit",
      variant: "executive-cockpit",
    },
    themes: [
      {
        id: "executive-cockpit",
        visual: {
          layout: "bi-executive-cockpit",
          variant: "executive-cockpit",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "executive-cockpit", template });

  assert.equal(visual.id, "data-bi-dashboard-executive-cockpit");
  assert.equal(visual.layout, "bi-executive-cockpit");
  assert.equal(visual.variant, "executive-cockpit");
  assert.equal(visual.primary, "071A2F");
  assert.equal(visual.accent, "22D3EE");
});

test("resolveTemplateVisual applies user behavior path funnel official visual", () => {
  const template = {
    id: "data-user-behavior-analysis-path-funnel",
    visual: {
      primary: "172554",
      accent: "06B6D4",
      secondary: "22C55E",
      warning: "F97316",
      background: "F6FAFF",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "user-path-funnel",
      variant: "path-funnel",
    },
    themes: [
      {
        id: "path-funnel",
        visual: {
          layout: "user-path-funnel",
          variant: "path-funnel",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "path-funnel", template });

  assert.equal(visual.id, "data-user-behavior-analysis-path-funnel");
  assert.equal(visual.layout, "user-path-funnel");
  assert.equal(visual.variant, "path-funnel");
  assert.equal(visual.primary, "172554");
  assert.equal(visual.accent, "06B6D4");
});

test("resolveTemplateVisual applies market trend radar official visual", () => {
  const template = {
    id: "data-market-trend-insight-trend-radar",
    visual: {
      primary: "08111F",
      accent: "38BDF8",
      secondary: "A78BFA",
      warning: "F59E0B",
      background: "050B18",
      surface: "0F1E33",
      title: "E6F7FF",
      body: "B7C9DA",
      layout: "market-trend-radar",
      variant: "trend-radar",
    },
    themes: [
      {
        id: "trend-radar",
        visual: {
          layout: "market-trend-radar",
          variant: "trend-radar",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "trend-radar", template });

  assert.equal(visual.id, "data-market-trend-insight-trend-radar");
  assert.equal(visual.layout, "market-trend-radar");
  assert.equal(visual.variant, "trend-radar");
  assert.equal(visual.primary, "08111F");
  assert.equal(visual.accent, "38BDF8");
});

test("resolveTemplateVisual applies customer segmentation layering official visual", () => {
  const template = {
    id: "data-customer-segmentation-persona-layering",
    visual: {
      primary: "111827",
      accent: "14B8A6",
      secondary: "F59E0B",
      warning: "A855F7",
      background: "F6FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "customer-segmentation-layering",
      variant: "persona-layering",
    },
    themes: [
      {
        id: "persona-layering",
        visual: {
          layout: "customer-segmentation-layering",
          variant: "persona-layering",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "persona-layering", template });

  assert.equal(visual.id, "data-customer-segmentation-persona-layering");
  assert.equal(visual.layout, "customer-segmentation-layering");
  assert.equal(visual.variant, "persona-layering");
  assert.equal(visual.primary, "111827");
  assert.equal(visual.accent, "14B8A6");
});

test("resolveTemplateVisual applies metric anomaly attribution official visual", () => {
  const template = {
    id: "data-metric-anomaly-diagnosis-attribution-analysis",
    visual: {
      primary: "0F172A",
      accent: "06B6D4",
      secondary: "F97316",
      warning: "EF4444",
      background: "F4F8FB",
      surface: "FFFFFF",
      title: "0B1220",
      body: "334155",
      layout: "metric-anomaly-attribution",
      variant: "attribution-analysis",
    },
    themes: [
      {
        id: "attribution-analysis",
        visual: {
          layout: "metric-anomaly-attribution",
          variant: "attribution-analysis",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "attribution-analysis", template });

  assert.equal(visual.id, "data-metric-anomaly-diagnosis-attribution-analysis");
  assert.equal(visual.layout, "metric-anomaly-attribution");
  assert.equal(visual.variant, "attribution-analysis");
  assert.equal(visual.primary, "0F172A");
  assert.equal(visual.accent, "06B6D4");
});

test("resolveTemplateVisual applies market survey analysis official visual", () => {
  const template = {
    id: "data-market-research-report-survey-analysis",
    visual: {
      primary: "155E75",
      accent: "14B8A6",
      secondary: "F97316",
      warning: "F59E0B",
      background: "F5FAFC",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "market-survey-analysis",
      variant: "survey-analysis",
    },
    themes: [
      {
        id: "survey-analysis",
        visual: {
          layout: "market-survey-analysis",
          variant: "survey-analysis",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "survey-analysis", template });

  assert.equal(visual.id, "data-market-research-report-survey-analysis");
  assert.equal(visual.layout, "market-survey-analysis");
  assert.equal(visual.variant, "survey-analysis");
  assert.equal(visual.primary, "155E75");
  assert.equal(visual.accent, "14B8A6");
});

test("resolveTemplateVisual applies social media operation plan official visual", () => {
  const template = {
    id: "marketing-social-media-operation-plan-short-video-growth",
    visual: {
      id: "marketing-social-media-operation-plan-short-video-growth",
      primary: "111827",
      secondary: "0EA5E9",
      accent: "22C55E",
      warning: "F97316",
      background: "F4F7FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "social-video-growth",
      variant: "short-video-growth",
    },
    themes: [
      {
        id: "short-video-growth",
        visual: {
          layout: "social-video-growth",
          variant: "short-video-growth",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "short-video-growth", template });

  assert.equal(visual.id, "marketing-social-media-operation-plan-short-video-growth");
  assert.equal(visual.layout, "social-video-growth");
  assert.equal(visual.variant, "short-video-growth");
  assert.equal(visual.primary, "111827");
  assert.equal(visual.accent, "22C55E");
});

test("resolveTemplateVisual applies Pre-A market validation official visual", () => {
  const template = {
    id: "pitch-pre-a-funding-bp-market-validation",
    visual: {
      primary: "0B1220",
      secondary: "38BDF8",
      accent: "14B8A6",
      warning: "F59E0B",
      background: "EAF2F8",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "pre-a-market-validation",
      variant: "market-validation",
    },
    themes: [
      {
        id: "market-validation",
        visual: {
          layout: "pre-a-market-validation",
          variant: "market-validation",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "market-validation", template });

  assert.equal(visual.id, "pitch-pre-a-funding-bp-market-validation");
  assert.equal(visual.layout, "pre-a-market-validation");
  assert.equal(visual.variant, "market-validation");
  assert.equal(visual.primary, "0B1220");
  assert.equal(visual.accent, "14B8A6");
});

test("resolveTemplateVisual applies operating problem diagnosis official visual", () => {
  const template = {
    id: "business-operating-problem-diagnosis-problem-tree",
    visual: {
      primary: "17233B",
      accent: "E94B3C",
      secondary: "0EA5A8",
      warning: "F59E0B",
      background: "F5F7FB",
      surface: "FFFFFF",
      title: "0F172A",
      body: "334155",
      layout: "operating-problem-tree",
      variant: "problem-tree",
    },
    themes: [
      {
        id: "problem-tree",
        visual: {
          layout: "operating-problem-tree",
          variant: "problem-tree",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "problem-tree", template });

  assert.equal(visual.id, "business-operating-problem-diagnosis-problem-tree");
  assert.equal(visual.layout, "operating-problem-tree");
  assert.equal(visual.variant, "problem-tree");
  assert.equal(visual.primary, "17233B");
  assert.equal(visual.accent, "E94B3C");
});

test("resolveTemplateVisual applies channel recruitment policy official visual", () => {
  const template = {
    id: "sales-channel-recruitment-plan-cooperation-policy",
    visual: {
      primary: "0F2D4A",
      accent: "10B981",
      secondary: "D9A441",
      warning: "F97316",
      background: "F3F8F7",
      surface: "FFFFFF",
      title: "10233D",
      body: "40566D",
      layout: "channel-recruitment-policy",
      variant: "cooperation-policy",
    },
    themes: [
      {
        id: "cooperation-policy",
        visual: {
          layout: "channel-recruitment-policy",
          variant: "cooperation-policy",
        },
      },
    ],
  };

  const visual = resolveTemplateVisual({ templateId: template.id, theme: "cooperation-policy", template });

  assert.equal(visual.id, "sales-channel-recruitment-plan-cooperation-policy");
  assert.equal(visual.layout, "channel-recruitment-policy");
  assert.equal(visual.variant, "cooperation-policy");
  assert.equal(visual.primary, "0F2D4A");
  assert.equal(visual.accent, "10B981");
});

test("TemplateManager lists official active templates and the owner user templates by category", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["templates", "template_categories"],
  });
  await database.initialize();
  await database.insert("template_categories", { id: "sales", name: "Sales", sortOrder: 10 });
  await database.insert("template_categories", { id: "empty", name: "Empty", sortOrder: 11 });
  await database.insert("templates", {
    id: "official-sales",
    name: "Official Sales",
    categoryId: "sales",
    scope: "official",
    status: "active",
    themes: [{ id: "modern", name: "Modern" }],
    visual: { primary: "111111", accent: "222222", background: "FFFFFF", surface: "FFFFFF", title: "111111", body: "333333", layout: "top-band" },
    layoutSchema: { defaultCoverLayout: "title", defaultContentLayout: "content", allowedLayouts: ["title", "content"] },
  });
  await database.insert("templates", {
    id: "disabled-sales",
    name: "Disabled Sales",
    categoryId: "sales",
    scope: "official",
    status: "disabled",
  });
  await database.insert("templates", {
    id: "user-sales",
    name: "User Sales",
    categoryId: "sales",
    scope: "user",
    status: "active",
    ownerUserId: 7,
    themes: [{ id: "custom", name: "Custom" }],
  });
  await database.insert("templates", {
    id: "other-user-sales",
    name: "Other User Sales",
    categoryId: "sales",
    scope: "user",
    status: "active",
    ownerUserId: 9,
  });
  const templates = new TemplateManager({ database });

  const catalog = await templates.listTemplates({ ownerUserId: 7, categoryId: "sales" });
  const categories = templates.listCategories({ ownerUserId: 7 });

  assert.deepEqual(catalog.map((template) => template.id), ["sales-proposal", "key-account-plan", "official-sales", "user-sales"]);
  assert.equal(categories.some((category) => category.id === "sales"), true);
  assert.equal(categories.some((category) => category.id === "empty"), false);
  assert.equal(catalog[0].category.id, "sales");
  assert.equal((await templates.getTemplate("user-sales", { ownerUserId: 7 })).scope, "user");
  assert.throws(
    () => templates.getTemplate("other-user-sales", { ownerUserId: 7 }),
    { code: "TEMPLATE_NOT_FOUND" },
  );
});

test("TemplateManager prefers synced official templates over built-in official fallbacks", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "synced-official-db.json"),
    collections: ["templates", "template_categories"],
  });
  await database.initialize();
  await database.insert("templates", {
    id: "business-business-minimal",
    slug: "business-business-minimal",
    name: "高管商务汇报 - 极简灰蓝",
    categoryId: "business",
    scope: "official",
    status: "active",
    official: true,
    themes: [{ id: "minimal", name: "极简灰蓝" }],
  });
  const templates = new TemplateManager({ database });

  const catalog = templates.listTemplates({ ownerUserId: 7, categoryId: "business" });

  assert.deepEqual(catalog.map((template) => template.id), ["business-business-minimal"]);
});

test("TemplateManager keeps built-in fallbacks when database only has hidden open-source official templates", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "hidden-open-source-db.json"),
    collections: ["templates", "template_categories"],
  });
  await database.initialize();
  await database.insert("templates", {
    id: "open-city-template",
    slug: "open-city-template",
    name: "开源城市展示模板",
    categoryId: "open-source-samples",
    scope: "official",
    status: "active",
    official: true,
    tags: ["open-source"],
  });
  const templates = new TemplateManager({ database });

  const catalog = templates.listTemplates({ ownerUserId: 7, categoryId: "business" });

  assert.equal(catalog.some((template) => template.id === "business"), true);
});

test("TemplateManager hides open source sample templates from the catalog", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "open-source-templates-db.json"),
    collections: ["templates", "template_categories"],
  });
  await database.initialize();
  await database.insert("templates", {
    id: "open-city-showcase",
    slug: "city-showcase",
    name: "开源城市展示模板",
    categoryId: "business",
    scope: "official",
    status: "active",
    source: { type: "open-source", repository: "https://example.test/open-source" },
  });
  await database.insert("templates", {
    id: "open-general-demo",
    slug: "general-demo",
    name: "开源通用演示样例",
    categoryId: "business",
    scope: "official",
    status: "active",
    sourceLicense: "open source",
  });
  const templates = new TemplateManager({
    database,
    templates: [
      { id: "business", name: "Business", categoryId: "business", status: "active", themes: ["modern"] },
      { id: "opensource-built-in", name: "OpenSource Built In", categoryId: "business", status: "active", sourceType: "opensource" },
    ],
  });

  const catalog = templates.listTemplates({ ownerUserId: 7, categoryId: "business" });

  assert.deepEqual(catalog.map((template) => template.id), ["business"]);
  assert.throws(
    () => templates.getTemplate("open-city-showcase", { ownerUserId: 7 }),
    { code: "TEMPLATE_NOT_FOUND" },
  );
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

test("HttpAiProvider supports OpenAI-compatible chat-completion responses", async () => {
  const calls = [];
  const provider = new HttpAiProvider({
    endpoint: "https://api.deepseek.com/chat/completions",
    apiKey: "ai-key",
    model: "deepseek-v4-flash",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const body = JSON.parse(init.body);
      const input = JSON.parse(body.messages[1].content);

      if (input.operation === "generate_outline") {
        return Response.json({
          choices: [{
            message: {
              content: JSON.stringify({ outline: [{ title: "Chat outline", bullets: ["A"] }] }),
            },
          }],
        });
      }
      if (input.operation === "generate_slides") {
        return Response.json({
          choices: [{
            message: {
              content: JSON.stringify({ slides: [{ id: "slide_1", title: "Chat slide", bullets: ["B"] }] }),
            },
          }],
        });
      }
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({ slide: { id: "slide_1", title: "Chat regenerated", bullets: ["C"] } }),
          },
        }],
      });
    },
  });

  const outline = await provider.generateOutline({ topic: "Provider", slideCount: 1 });
  const slides = await provider.generateSlides({ outline: { slides: outline } });
  const slide = await provider.regenerateSlide({ slide: slides[0], instruction: "shorten" });
  const firstPayload = JSON.parse(calls[0].init.body);

  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer ai-key");
  assert.equal(firstPayload.model, "deepseek-v4-flash");
  assert.equal(firstPayload.messages[0].role, "system");
  assert.equal(firstPayload.messages[1].role, "user");
  assert.match(firstPayload.messages[0].content, /input\.designSkill/);
  assert.match(firstPayload.messages[0].content, /repetitive three-bullet slides/);
  assert.equal(outline[0].title, "Chat outline");
  assert.equal(slides[0].title, "Chat slide");
  assert.equal(slide.title, "Chat regenerated");
});

test("HttpAiProvider tolerates chat-completion outline as plain array output", async () => {
  const provider = new HttpAiProvider({
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash",
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: JSON.stringify([{ title: "Array outline", bullets: ["A"] }]),
        },
      }],
    }),
  });

  const outline = await provider.generateOutline({ topic: "Provider", slideCount: 1 });
  assert.equal(Array.isArray(outline), true);
  assert.equal(outline[0].title, "Array outline");
});

test("HttpAiProvider tolerates chat-completion responses with reasoning_content JSON", async () => {
  const provider = new HttpAiProvider({
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash",
    fetcher: async () => Response.json({
      choices: [{
        message: {
          content: "",
          reasoning_content: "[{\"title\": \"Reasoning outline\", \"bullets\": [\"A\"]}]",
        },
      }],
    }),
  });

  const outline = await provider.generateOutline({ topic: "Provider", slideCount: 1 });
  assert.equal(Array.isArray(outline), true);
  assert.equal(outline[0].title, "Reasoning outline");
});

test("HttpAiProvider rejects malformed OpenAI-compatible provider responses", async () => {
  const provider = new HttpAiProvider({
    endpoint: "https://api.deepseek.com/chat/completions",
    fetcher: async () => Response.json({
      choices: [{ message: { content: "not-a-json-object" } }],
    }),
  });

  await assert.rejects(
    () => provider.generateSlides({ outline: { slides: [] } }),
    /AI_PROVIDER_INVALID_RESPONSE/,
  );
});

test("HttpAiProvider rejects malformed provider responses", async () => {
  const provider = new HttpAiProvider({
    endpoint: "http://ai.test/generate",
    fetcher: async () => Response.json({ ok: true }),
  });

  await assert.rejects(
    () => provider.generateSlides({ outline: { slides: [] } }),
    /AI_PROVIDER_INVALID_RESPONSE/,
  );
});

test("HttpAiProvider retries transient provider failures", async () => {
  let attempts = 0;
  const provider = new HttpAiProvider({
    endpoint: "http://ai.test/generate",
    maxRetries: 1,
    fetcher: async () => {
      attempts += 1;
      return attempts === 1
        ? Response.json({ error: "temporary" }, { status: 503 })
        : Response.json({ outline: [{ title: "Recovered", bullets: [] }] });
    },
  });

  const outline = await provider.generateOutline({ topic: "Retry", slideCount: 1 });

  assert.equal(attempts, 2);
  assert.equal(outline[0].title, "Recovered");
});

test("HttpAiProvider passes timeout abort signals to fetch", async () => {
  const signals = [];
  const provider = new HttpAiProvider({
    endpoint: "http://ai.test/generate",
    timeoutMs: 1000,
    fetcher: async (url, init) => {
      signals.push(init.signal);
      return Response.json({ outline: [{ title: "Timed", bullets: [] }] });
    },
  });

  await provider.generateOutline({ topic: "Timeout", slideCount: 1 });

  assert.equal(signals.length, 1);
  assert.equal(signals[0] instanceof AbortSignal, true);
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
    assert.match(health.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);

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
    const uploaded = await upload.json();
    const downloaded = await fetch(`${baseUrl}/api/files/${uploaded.file.id}`, { headers: { cookie } });
    assert.match(downloaded.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);

    const invalidUpload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "brief.txt",
        mime_type: "text/plain",
        content_base64: "not base64",
      }),
    });
    assert.equal(invalidUpload.status, 400);
    assert.equal((await invalidUpload.json()).error.code, "FILE_CONTENT_INVALID");

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

test("createApp restores sessions from the persisted database after restart", async () => {
  const databasePath = path.join(tempDir, "db.json");
  const firstDatabase = new JsonFileDatabase({
    filePath: databasePath,
    collections: ["sessions"],
  });
  await firstDatabase.initialize();
  const firstApp = createApp({
    database: firstDatabase,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73, entitlement_id: 88 }),
    },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => firstApp.listen(0, "127.0.0.1", resolve));
  const firstBaseUrl = `http://127.0.0.1:${firstApp.address().port}`;
  const enter = await fetch(`${firstBaseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
  const cookie = enter.headers.get("set-cookie").split(";")[0];
  await new Promise((resolve, reject) => firstApp.close((error) => (error ? reject(error) : resolve())));

  const secondDatabase = new JsonFileDatabase({
    filePath: databasePath,
    collections: ["sessions"],
  });
  await secondDatabase.initialize();
  const secondApp = createApp({
    database: secondDatabase,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73, entitlement_id: 88 }),
    },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => secondApp.listen(0, "127.0.0.1", resolve));
  const secondBaseUrl = `http://127.0.0.1:${secondApp.address().port}`;
  try {
    const me = await fetch(`${secondBaseUrl}/api/me`, { headers: { cookie } });
    const body = await me.json();

    assert.equal(me.status, 200);
    assert.equal(body.user.user_id, 7);
    assert.equal(body.user.entitlement_id, 88);
  } finally {
    await new Promise((resolve, reject) => secondApp.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp rejects missing launch tickets and expired sessions", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions"],
  });
  await database.initialize();
  const expiredSession = await database.insert("sessions", {
    id: "expired-session",
    identity: { user_id: 7, app_id: 15, product_id: 73 },
    entitlementId: 88,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const app = createApp({
    database,
    defaultEntitlementId: 88,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
    },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const missingTicket = await fetch(`${baseUrl}/enter`);
    const missingTicketBody = await missingTicket.json();
    const expired = await fetch(`${baseUrl}/api/me`, { headers: { cookie: `sid=${expiredSession.id}` } });
    const expiredBody = await expired.json();

    assert.equal(missingTicket.status, 400);
    assert.equal(missingTicketBody.error.code, "MISSING_TICKET");
    assert.equal(expired.status, 401);
    assert.equal(expiredBody.error.code, "UNAUTHORIZED");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp maps Moling launch identities into local users", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "users"],
  });
  await database.initialize();
  const app = createApp({
    database,
    defaultEntitlementId: 88,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 7,
        app_id: 15,
        product_id: 73,
        display_name: "Local User",
        avatar_url: "https://example.test/avatar.png",
      }),
    },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    assert.equal(enter.status, 302);

    const users = await database.find("users");
    assert.equal(users.length, 1);
    assert.equal(users[0].moling_user_id, 7);
    assert.equal(users[0].display_name, "Local User");
    assert.equal(users[0].avatar_url, "https://example.test/avatar.png");
    assert.equal(users[0].status, "active");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp accepts Moling launch tickets appended to the access URL root", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions"],
  });
  await database.initialize();
  const app = createApp({
    database,
    defaultEntitlementId: 62,
    expectedAppId: 15,
    expectedProductId: 73,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => {
        assert.equal(ticket, "ticket_1");
        return { user_id: 7, app_id: 15, product_id: 73 };
      },
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager(),
    aiProvider: new MockAiProvider(),
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const launch = await fetch(`${baseUrl}/?ticket=ticket_1`, { redirect: "manual" });
    assert.equal(launch.status, 302);
    assert.equal(launch.headers.get("location"), "/");
    const cookie = launch.headers.get("set-cookie")?.split(";")[0];
    assert.match(cookie, /^sid=/);

    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), {
      user: { user_id: 7, role: "user", entitlement_id: 62 },
    });
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp redacts launch tickets from request failure logs", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions"],
  });
  await database.initialize();
  const logEntries = [];
  const app = createApp({
    database,
    logger: {
      info() {},
      warn() {},
      debug() {},
      error(event, fields) {
        logEntries.push({ event, fields });
      },
    },
    molingClient: {
      verifyLaunchTicket: async () => {
        throw new AppError({ code: "40003", status: 403, message: "Invalid ticket" });
      },
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager(),
    aiProvider: new MockAiProvider(),
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const response = await fetch(`${baseUrl}/?ticket=secret_launch_ticket&foo=bar`);
    assert.equal(response.status, 403);
    assert.equal(logEntries[0].event, "request_failed");
    assert.equal(logEntries[0].fields.url, "/?ticket=REDACTED&foo=bar");
    assert.doesNotMatch(JSON.stringify(logEntries), /secret_launch_ticket/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp can mark session cookies as secure", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions"],
  });
  await database.initialize();
  const app = createApp({
    database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
    },
    sessionCookieName: "sid",
    sessionCookieSecure: true,
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie");

    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp rejects malformed JSON request bodies as validation errors", async () => {
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
    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const response = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: "{\"file_name\":",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "REQUEST_JSON_INVALID");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp rejects oversized JSON request bodies", async () => {
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
    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const oversized = JSON.stringify({ type: "ppt_generate", input: { topic: "x".repeat(1024 * 1024 + 1) } });
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: oversized,
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.error.code, "REQUEST_BODY_TOO_LARGE");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp blocks cross-user file downloads and log visibility", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "call_logs"],
  });
  await database.initialize();
  const app = createApp({
    database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => ({
        user_id: ticket === "user_8" ? 8 : 7,
        app_id: 15,
        product_id: 73,
      }),
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager({ templates: [{ id: "business", name: "Business" }] }),
    aiProvider: new MockAiProvider(),
    pptService: { listLogs: async ({ ownerUserId }) => database.find("call_logs", (log) => Number(log.ownerUserId) === Number(ownerUserId)) },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enterUser7 = await fetch(`${baseUrl}/enter?ticket=user_7`, { redirect: "manual" });
    const cookie7 = enterUser7.headers.get("set-cookie").split(";")[0];
    const enterUser8 = await fetch(`${baseUrl}/enter?ticket=user_8`, { redirect: "manual" });
    const cookie8 = enterUser8.headers.get("set-cookie").split(";")[0];

    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie: cookie7, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "owner.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("owner only").toString("base64"),
      }),
    });
    const uploaded = await upload.json();
    const forbidden = await fetch(`${baseUrl}/api/files/${uploaded.file.id}`, { headers: { cookie: cookie8 } });
    const forbiddenBody = await forbidden.json();
    const ownerDownload = await fetch(`${baseUrl}/api/files/${uploaded.file.id}`, { headers: { cookie: cookie7 } });
    const ownerLogs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie: cookie7 } }).then((response) => response.json());
    const otherLogs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie: cookie8 } }).then((response) => response.json());

    assert.equal(forbidden.status, 403);
    assert.equal(forbiddenBody.error.code, "FORBIDDEN");
    assert.equal(ownerDownload.status, 200);
    assert.equal(ownerLogs.logs.some((log) => log.action === "file_downloaded" && log.resourceId === uploaded.file.id), true);
    assert.equal(otherLogs.logs.some((log) => log.resourceId === uploaded.file.id), false);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp issues short-lived owner download URLs", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "call_logs"],
  });
  await database.initialize();
  const app = createApp({
    database,
    internalToken: "download-secret",
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
    },
    storage: new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database }),
    taskCenter: new MemoryTaskCenter(),
    templateManager: new TemplateManager({ templates: [{ id: "business", name: "Business" }] }),
    aiProvider: new MockAiProvider(),
    pptService: { listLogs: async ({ ownerUserId }) => database.find("call_logs", (log) => Number(log.ownerUserId) === Number(ownerUserId)) },
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ticket_1`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "signed.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("signed download").toString("base64"),
      }),
    });
    const uploaded = await upload.json();
    const signed = await fetch(`${baseUrl}/api/files/${uploaded.file.id}/download-url`, { headers: { cookie } });
    const signedBody = await signed.json();
    const downloaded = await fetch(`${baseUrl}${signedBody.url}`);
    const tampered = await fetch(`${baseUrl}${signedBody.url.replace("download_token=", "download_token=x")}`);
    const logs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie } }).then((response) => response.json());

    assert.equal(signed.status, 200);
    assert.equal(signed.headers.get("cache-control"), "no-store");
    assert.match(signedBody.url, new RegExp(`^/api/files/${uploaded.file.id}\\?download_token=`));
    assert.equal(Date.parse(signedBody.expires_at) > Date.now(), true);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("cache-control"), "no-store");
    assert.equal(await downloaded.text(), "signed download");
    assert.equal(tampered.status, 403);
    assert.equal(logs.logs.some((log) => log.action === "file_downloaded" && log.resourceId === uploaded.file.id), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("createApp protects the internal reconciliation endpoint", async () => {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks"],
  });
  await database.initialize();
  let reconciled = 0;
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
    pptService: {
      reconcileBillingEvents: async () => {
        reconciled += 1;
        return { checked: 1, settled: 1, failed: 0 };
      },
    },
    internalToken: "internal-secret",
    sessionCookieName: "sid",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const forbidden = await fetch(`${baseUrl}/internal/reconcile`, {
      method: "POST",
      headers: { "X-Internal-Token": "wrong" },
    });
    assert.equal(forbidden.status, 403);

    const accepted = await fetch(`${baseUrl}/internal/reconcile`, {
      method: "POST",
      headers: { "X-Internal-Token": "internal-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 10 }),
    });
    assert.equal(accepted.status, 200);
    assert.match(accepted.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
    assert.deepEqual(await accepted.json(), { result: { checked: 1, settled: 1, failed: 0 } });
    assert.equal(reconciled, 1);
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
