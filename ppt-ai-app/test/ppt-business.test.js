import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { MockAiProvider } from "../src/ai-provider.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { PromptManager } from "../src/prompt-manager.js";
import { PptExportService } from "../src/ppt-exporter.js";
import { PptService } from "../src/ppt-service.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-ai-business-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("PptService completes topic to outline to editable deck to PPTX/PDF with billing and logs", async () => {
  const context = await createBusinessContext();

  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "AI sales enablement",
    slideCount: 3,
    templateId: "business",
    theme: "modern",
  });
  const edited = await context.pptService.updateOutline({
    ownerUserId: 7,
    outlineId: outline.id,
    slides: [
      { title: "Market context", bullets: ["Demand is shifting"] },
      { title: "AI workflow", bullets: ["Automate research"] },
      { title: "Next steps", bullets: ["Pilot with sales"] },
    ],
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: edited.id,
    entitlementId: 88,
  });
  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: deckResult.deck.slides[1].id,
    instruction: "Make this more executive friendly",
    entitlementId: 88,
  });
  const pptx = await context.pptService.exportDeck({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    format: "pptx",
  });
  const pdf = await context.pptService.exportDeck({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    format: "pdf",
  });

  assert.equal(outline.status, "outline_ready");
  assert.equal(deckResult.task.status, "succeeded");
  assert.equal(deckResult.task.progress, 100);
  assert.equal(deckResult.deck.slides.length, 3);
  assert.equal(regenerated.slide.title.includes("executive"), true);
  assert.equal(pptx.file.mimeType, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(pdf.file.mimeType, "application/pdf");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle", "balance", "reserve", "settle"]);
  assert.equal((await context.database.find("call_logs")).length >= 5, true);
});

test("PptService releases slide regeneration credits when AI fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Regeneration failure",
    slideCount: 2,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deckResult.deck.id,
      slideId: deckResult.deck.slides[0].id,
      instruction: "fail after reserve",
      entitlementId: 88,
    }),
    /AI_PROVIDER_FAILED/,
  );

  assert.deepEqual(context.billingCalls.map((call) => call[0]), [
    "balance",
    "reserve",
    "settle",
    "balance",
    "reserve",
    "release",
  ]);
});

test("PptService records slide release reconciliation when regeneration release fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        throw new Error("slide release unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide release failure",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "fail release",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release" && event.status === "release_pending");
  const logs = await context.database.find("call_logs", (log) => log.action === "billing_release_pending");

  assert.equal(releaseEvent.taskId, deck.id);
  assert.equal(releaseEvent.amount, "0");
  assert.equal(logs.length, 1);
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle", "balance", "reserve", "release"]);
});

test("PptService reconciles pending slide release events", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async () => {
    throw new Error("slide provider failed");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        if (context.billingCalls.filter((call) => call[0] === "release").length === 1) {
          throw new Error("slide release unavailable");
        }
        return { status: "released", hold_id: input.holdId };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide release reconcile",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "fail release",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release");

  assert.deepEqual(result, { checked: 1, settled: 0, released: 1, failed: 0 });
  assert.equal(releaseEvent.status, "released");
  assert.equal(context.billingCalls.filter((call) => call[0] === "release").length, 2);
});

test("PptService locks deck when slide regeneration settle fails", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (input.idempotencyKey.includes("ppt_slide_regenerate")) {
          throw new Error("slide settle unavailable");
        }
        return { status: "settled", hold_id: input.holdId, settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide settle failure",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });

  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "paid edit",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const lockedDeck = await context.database.findOne("decks", (item) => item.id === deck.id);
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle" && event.status === "settle_pending");

  assert.equal(lockedDeck.status, "billing_pending");
  assert.equal(lockedDeck.slides[0].title.includes("paid edit"), true);
  assert.equal(settleEvent.taskId, deck.id);
  await assert.rejects(
    () => context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id }),
    { code: "DECK_BILLING_PENDING" },
  );
});

test("PptService reconciles pending slide settle events", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (input.idempotencyKey.includes("ppt_slide_regenerate")
          && context.billingCalls.filter((call) => call[0] === "settle" && call[1].idempotencyKey.includes("ppt_slide_regenerate")).length === 1) {
          throw new Error("slide settle unavailable");
        }
        return { status: "settled", hold_id: input.holdId, settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Slide settle reconcile",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 });
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "paid edit",
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const readyDeck = await context.database.findOne("decks", (item) => item.id === deck.id);
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle" && event.taskId === deck.id);

  assert.deepEqual(result, { checked: 1, settled: 1, released: 0, failed: 0 });
  assert.equal(readyDeck.status, "ready");
  assert.equal(settleEvent.status, "settled");
  assert.equal(context.billingCalls.filter((call) => call[0] === "settle" && call[1].idempotencyKey.includes("ppt_slide_regenerate")).length, 2);
});

test("PptService rejects unsupported deck export formats", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Export validation",
    slideCount: 2,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  await assert.rejects(
    () => context.pptService.exportDeck({
      ownerUserId: 7,
      deckId: deckResult.deck.id,
      format: "docx",
    }),
    { code: "EXPORT_FORMAT_UNSUPPORTED" },
  );
});

test("PptService records release reconciliation when generation release fails", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    throw new Error("provider failed before deck");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        throw new Error("release unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Release failure",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const [task] = await context.database.find("generation_tasks");
  const events = await context.database.find("billing_events");

  assert.equal(task.status, "release_pending");
  assert.equal(task.retryable, false);
  assert.equal(task.errorCode, "RELEASE_FAILED");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "release"]);
  assert.deepEqual(events.map((event) => event.status), ["reserved", "release_pending"]);
});

test("PptService reconciles pending release events", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    throw new Error("provider failed before deck");
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      releaseCredits: async (input) => {
        context.billingCalls.push(["release", input]);
        if (context.billingCalls.filter((call) => call[0] === "release").length === 1) {
          throw new Error("release unavailable");
        }
        return { status: "released", hold_id: input.holdId };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Release reconcile",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const [task] = await context.database.find("generation_tasks");
  const releaseEvent = await context.database.findOne("billing_events", (event) => event.eventType === "release");

  assert.deepEqual(result, { checked: 1, settled: 0, released: 1, failed: 0 });
  assert.equal(task.status, "failed");
  assert.equal(task.retryable, true);
  assert.equal(releaseEvent.status, "released");
  assert.equal(context.billingCalls.filter((call) => call[0] === "release").length, 2);
});

test("PptService marks successful generation for reconciliation when settle fails", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        throw new Error("settle unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Settle failure",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const [task] = await context.database.find("generation_tasks");
  const [deck] = await context.database.find("decks");
  const events = await context.database.find("billing_events");

  assert.equal(task.status, "reconcile_pending");
  assert.equal(task.retryable, false);
  assert.equal(task.deckId, deck.id);
  assert.equal(task.errorCode, "SETTLE_FAILED");
  assert.equal(deck.status, "billing_pending");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
  assert.deepEqual(events.map((event) => event.status), ["reserved", "settle_pending"]);
});

test("PptService blocks deck usage while billing settlement is pending", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        throw new Error("settle unavailable");
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Locked deck",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );
  const [deck] = await context.database.find("decks");

  await assert.rejects(
    () => context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id }),
    { code: "DECK_BILLING_PENDING" },
  );
  await assert.rejects(
    () => context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" }),
    { code: "DECK_BILLING_PENDING" },
  );
  await assert.rejects(
    () => context.pptService.regenerateSlide({
      ownerUserId: 7,
      deckId: deck.id,
      slideId: deck.slides[0].id,
      instruction: "change",
      entitlementId: 88,
    }),
    { code: "DECK_BILLING_PENDING" },
  );
});

test("PptService reconciles pending settle events", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      settleCredits: async (input) => {
        context.billingCalls.push(["settle", input]);
        if (context.billingCalls.filter((call) => call[0] === "settle").length === 1) {
          throw new Error("settle unavailable");
        }
        return { status: "settled", settled_amount: input.actualAmount };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Reconcile settle",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "BILLING_RECONCILIATION_PENDING" },
  );

  const result = await context.pptService.reconcileBillingEvents({ limit: 10 });
  const [task] = await context.database.find("generation_tasks");
  const [deck] = await context.database.find("decks");
  const settleEvent = await context.database.findOne("billing_events", (event) => event.eventType === "settle");

  assert.deepEqual(result, { checked: 1, settled: 1, released: 0, failed: 0 });
  assert.equal(task.status, "succeeded");
  assert.equal(deck.status, "ready");
  assert.equal(settleEvent.status, "settled");
  assert.equal(context.billingCalls.filter((call) => call[0] === "settle").length, 2);
});

test("PptService routes slide regeneration through PromptManager", async () => {
  const promptCalls = [];
  const aiCalls = [];
  const promptManager = {
    buildOutlinePrompt: (input) => input,
    buildDeckPrompt: (input) => input,
    buildRegenerateSlidePrompt: (input) => {
      promptCalls.push(input);
      return { kind: "regenerate_slide", ...input };
    },
  };
  const aiProvider = {
    generateOutline: async ({ slideCount }) => Array.from({ length: slideCount }, (_, index) => ({
      title: `Slide ${index + 1}`,
      bullets: ["A"],
    })),
    generateSlides: async ({ outline }) => outline.slides.map((slide, index) => ({
      id: `slide_${index + 1}`,
      title: slide.title,
      bullets: slide.bullets,
    })),
    regenerateSlide: async (prompt) => {
      aiCalls.push(prompt);
      return { ...prompt.slide, title: "Prompted regeneration" };
    },
  };
  const context = await createBusinessContext({ promptManager, aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Prompt route",
    slideCount: 1,
    templateId: "business",
  });
  const deckResult = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deckResult.deck.id,
    slideId: "slide_1",
    instruction: "Use the prompt manager",
    entitlementId: 88,
  });

  assert.equal(promptCalls[0].instruction, "Use the prompt manager");
  assert.equal(aiCalls[0].kind, "regenerate_slide");
  assert.equal(regenerated.slide.title, "Prompted regeneration");
});

test("PptService generates outline from uploaded document content", async () => {
  const context = await createBusinessContext();
  const sourceFile = await context.storage.upload({
    ownerUserId: 7,
    fileName: "brief.txt",
    mimeType: "text/plain",
    content: Buffer.from("Customer retention plan\nExpansion revenue\nRenewal risk"),
  });

  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    sourceFileId: sourceFile.id,
    slideCount: 2,
    templateId: "business",
    theme: "classic",
  });

  assert.equal(outline.input.sourceFileId, sourceFile.id);
  assert.equal(outline.slides.length, 2);
  assert.match(outline.slides[0].title, /Customer retention plan|Document insight/);
});

test("PptService enforces slide count and template theme rules", async () => {
  const context = await createBusinessContext();

  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Too short",
      slideCount: 0,
      templateId: "business",
      theme: "modern",
    }),
    /SLIDE_COUNT_INVALID/,
  );
  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Too long",
      slideCount: 21,
      templateId: "business",
      theme: "modern",
    }),
    /SLIDE_COUNT_INVALID/,
  );
  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "Wrong theme",
      slideCount: 3,
      templateId: "business",
      theme: "startup",
    }),
    /THEME_NOT_SUPPORTED/,
  );
});

test("PptService marks failed generation retryable and retry succeeds", async () => {
  const context = await createBusinessContext({
    aiProvider: new MockAiProvider({ failNextDeck: true }),
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Risk review",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({ ownerUserId: 7, outlineId: outline.id, entitlementId: 88 }),
    /AI_PROVIDER_FAILED/,
  );
  const failedTask = (await context.database.find("generation_tasks"))[0];
  const retried = await context.pptService.retryTask({
    ownerUserId: 7,
    taskId: failedTask.id,
    entitlementId: 88,
  });

  assert.equal(failedTask.status, "failed");
  assert.equal(retried.task.status, "succeeded");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "release", "balance", "reserve", "settle"]);
});

test("HTTP API returns retryable task ID when deck generation fails", async () => {
  const context = await createBusinessContext({
    aiProvider: new MockAiProvider({ failNextDeck: true }),
  });
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Retryable failure",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const failedResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const failedBody = await failedResponse.json();

    assert.equal(failedResponse.status, 502);
    assert.equal(failedBody.error.code, "AI_PROVIDER_FAILED");
    assert.match(failedBody.error.details.task_id, /^[0-9a-f-]+$/);
    const taskResponse = await fetch(`${baseUrl}/api/ppt/tasks/${failedBody.error.details.task_id}`, { headers: { cookie } });
    const taskBody = await taskResponse.json();
    assert.equal(taskResponse.status, 200);
    assert.equal(taskBody.task.status, "failed");
    assert.equal(taskBody.task.retryable, true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API runs acceptance flow from login to outline, deck, preview, exports, billing, and logs", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Board update",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const editedResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outline.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: outline.outline.slides }),
    });
    assert.equal(editedResponse.status, 200);
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const taskResponse = await fetch(`${baseUrl}/api/ppt/tasks/${deckBody.task.id}`, { headers: { cookie } });
    const taskBody = await taskResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const pptx = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pptx" });
    const pdf = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pdf" });
    const pptxBody = await pptx.json();
    const pdfBody = await pdf.json();
    const downloadedPptx = await fetch(`${baseUrl}/api/files/${pptxBody.file.id}`, { headers: { cookie } });
    const logs = await fetch(`${baseUrl}/api/logs`, { headers: { cookie } });
    const logsBody = await logs.json();

    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(taskResponse.status, 200);
    assert.equal(taskBody.task.status, "succeeded");
    assert.equal(taskBody.task.progress, 100);
    assert.equal(taskBody.task.deckId, deckBody.deck.id);
    assert.match(await preview.text(), /Board update/);
    assert.equal(pptxBody.file.mimeType.includes("presentationml"), true);
    assert.equal(pdfBody.file.mimeType, "application/pdf");
    assert.equal(downloadedPptx.status, 200);
    assert.match(downloadedPptx.headers.get("content-disposition"), /filename="Board_update\.pptx"/);
    assert.equal((await downloadedPptx.arrayBuffer()).byteLength > 0, true);
    assert.equal(logsBody.logs.some((log) => log.action === "file_downloaded" && log.resourceId === pptxBody.file.id), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API rejects invalid outline edits before deck generation", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Invalid outline edit",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outlineBody = await outlineResponse.json();
    const editResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outlineBody.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: [{ title: "Missing bullets" }] }),
    });
    const editBody = await editResponse.json();
    const storedOutline = await context.database.findOne("outlines", (outline) => outline.id === outlineBody.outline.id);

    assert.equal(editResponse.status, 400);
    assert.equal(editBody.error.code, "OUTLINE_INVALID");
    assert.equal(storedOutline.status, "outline_ready");
    assert.equal(storedOutline.slides.length, 2);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page exposes the AI PPT generation controls after login", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /AI PPT 工作台/);
    assert.match(html, /id="topic"/);
    assert.match(html, /id="outline-editor"/);
    assert.match(html, /loadTemplates/);
    assert.match(html, /\/api\/templates/);
    assert.match(html, /id="generate-outline"/);
    assert.match(html, /id="save-outline"/);
    assert.match(html, /id="preview"/);
    assert.match(html, /id="entitlement" value="62"/);
    assert.match(html, /id="slide-id"/);
    assert.match(html, /id="regenerate-slide"/);
    assert.match(html, /id="retry-task"/);
    assert.match(html, /PPTX/);
    assert.match(html, /PDF/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API uses default entitlement ID when request omits entitlement_id", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Default entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const deckBody = await deckResponse.json();

    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(context.billingCalls[0][1].entitlementId, 62);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API rejects invalid entitlement IDs before billing", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Invalid entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: "not-a-number",
    });
    const body = await deckResponse.json();

    assert.equal(deckResponse.status, 400);
    assert.equal(body.error.code, "ENTITLEMENT_INVALID");
    assert.deepEqual(context.billingCalls, []);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API prefers the launch identity entitlement over the configured default", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 9,
        app_id: 15,
        product_id: 73,
        entitlements: [
          { entitlement_id: 91, product_id: 73, status: "active", usable: true },
        ],
      }),
    },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "User-specific entitlement",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const deckBody = await deckResponse.json();

    assert.match(html, /id="entitlement" value="91"/);
    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    assert.equal(context.billingCalls[0][1].entitlementId, 91);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API exposes session entitlement balance for package checks", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const response = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie } });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.entitlement_id, 62);
    assert.equal(body.balance.remaining, "100");
    assert.deepEqual(context.billingCalls[0], ["balance", { userId: 7, entitlementId: 62 }]);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page exposes package balance status", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: context.taskCenter,
    templateManager: context.templateManager,
    aiProvider: context.aiProvider,
    pptService: context.pptService,
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /id="balance-status"/);
    assert.match(html, /\/api\/billing\/balance/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

async function createBusinessContext(options = {}) {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["files", "tasks", "outlines", "decks", "generation_tasks", "billing_events", "call_logs"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const taskCenter = new MemoryTaskCenter();
  const templateManager = new TemplateManager({
    templates: [{ id: "business", name: "Business", style: "clean", themes: ["modern", "classic"] }],
  });
  const billingCalls = [];
  const billingClient = {
    getBalance: async (input) => {
      billingCalls.push(["balance", input]);
      return { usable: true, remaining: "100" };
    },
    reserveCredits: async (input) => {
      billingCalls.push(["reserve", input]);
      return { hold_id: 501, reserved: input.amount };
    },
    settleCredits: async (input) => {
      billingCalls.push(["settle", input]);
      return { status: "settled", settled_amount: input.actualAmount };
    },
    releaseCredits: async (input) => {
      billingCalls.push(["release", input]);
      return { status: "released", hold_id: input.holdId };
    },
    consumeCredits: async (input) => {
      billingCalls.push(["consume", input]);
      return { status: "consumed", amount: input.amount };
    },
    ...(options.billingOverrides || {}),
  };
  const aiProvider = options.aiProvider || new MockAiProvider();
  const pptService = new PptService({
    database,
    storage,
    taskCenter,
    templateManager,
    aiProvider,
    promptManager: options.promptManager || new PromptManager(),
    exporter: new PptExportService(),
    billingClient,
  });

  return { database, storage, taskCenter, templateManager, aiProvider, pptService, billingClient, billingCalls };
}

async function postJson(url, cookie, body) {
  return fetch(url, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
