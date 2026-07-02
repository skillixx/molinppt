import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { Logger } from "../src/logger.js";
import { MetricsRegistry } from "../src/metrics.js";
import { PromptManager } from "../src/prompt-manager.js";
import { PptExportService } from "../src/ppt-exporter.js";
import { PptService } from "../src/ppt-service.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager } from "../src/templates.js";
import { MockAiProvider } from "../src/ai-provider.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-hardening-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("HTTP app records structured request logs and exposes metrics", async () => {
  const context = await createContext();
  const logs = [];
  const app = createApp({
    ...context,
    logger: new Logger({ sink: { write: (line) => logs.push(JSON.parse(line)) } }),
    metrics: context.metrics,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${app.address().port}`;
    const cookie = await createSession(context.database, 7);
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const metrics = await fetch(`${baseUrl}/metrics`).then((response) => response.text());

    assert.equal(me.status, 200);
    assert.match(metrics, /http_requests_total\{route="\/api\/me",status="200"\} 1/);
    assert.equal(logs.some((entry) => entry.event === "request_completed" && entry.route === "/api/me" && entry.status === 200 && entry.requestId), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP app rejects per-user requests over the rate limit", async () => {
  const context = await createContext();
  const app = createApp({
    ...context,
    rateLimit: { maxRequests: 1, windowMs: 60_000 },
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${app.address().port}`;
    const cookie = await createSession(context.database, 7);
    const first = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const second = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const body = await second.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(body.error.code, "RATE_LIMIT_EXCEEDED");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("PptService rejects oversized prompts before calling the AI provider", async () => {
  const context = await createContext({
    aiProvider: {
      generateOutline: async () => {
        throw new Error("AI should not be called");
      },
    },
  });

  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "x".repeat(5001),
      slideCount: 3,
      templateId: "business",
      theme: "modern",
    }),
    { code: "PROMPT_TOO_LONG" },
  );
});

test("PptService rejects concurrent generation for the same outline before duplicate reserve", async () => {
  let reserveCalls = 0;
  const context = await createContext({
    aiProvider: {
      generateOutline: async () => [{ title: "Outline", bullets: ["A"] }],
      generateSlides: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [{ title: "Deck", bullets: ["A"] }];
      },
    },
    billingOverrides: {
      reserveCredits: async (input) => {
        reserveCalls += 1;
        return { hold_id: 700 + reserveCalls, reserved: input.amount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Concurrent generation",
    slideCount: 1,
    templateId: "business",
    theme: "modern",
  });

  const [first, second] = await Promise.allSettled([
    context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 }),
    context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 }),
  ]);

  assert.equal([first.status, second.status].filter((status) => status === "fulfilled").length, 1);
  assert.equal([first, second].some((result) => result.status === "rejected" && result.reason.code === "GENERATION_ALREADY_RUNNING"), true);
  assert.equal(reserveCalls, 1);
});

async function createContext(options = {}) {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "outlines", "decks", "generation_tasks", "billing_events", "call_logs", "templates", "template_categories", "ppt_assets", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const taskCenter = new MemoryTaskCenter();
  const templateManager = new TemplateManager({ database });
  const metrics = options.metrics || new MetricsRegistry();
  const billingClient = {
    getBalance: async () => ({ usable: true, remaining: "100" }),
    reserveCredits: async (input) => ({ hold_id: 501, reserved: input.amount }),
    settleCredits: async (input) => ({ status: "settled", settled_amount: input.actualAmount }),
    releaseCredits: async (input) => ({ status: "released", hold_id: input.holdId }),
    ...(options.billingOverrides || {}),
  };
  const pptService = new PptService({
    database,
    storage,
    taskCenter,
    templateManager,
    aiProvider: options.aiProvider || new MockAiProvider(),
    promptManager: new PromptManager(),
    exporter: new PptExportService(),
    billingClient,
    metrics,
  });
  return {
    database,
    storage,
    taskCenter,
    templateManager,
    aiProvider: options.aiProvider || new MockAiProvider(),
    pptService,
    billingClient,
    metrics,
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
  };
}

async function createSession(database, userId) {
  const session = await database.insert("sessions", {
    id: `session-${userId}`,
    identity: { user_id: userId, app_id: 15, product_id: 73 },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  return `sid=${session.id}`;
}
