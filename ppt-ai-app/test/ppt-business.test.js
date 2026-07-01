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

test("PptService returns provider failure for outline generation as AI_PROVIDER_FAILED", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateOutline = async () => {
    throw new Error("provider unavailable");
  };
  const context = await createBusinessContext({ aiProvider });

  await assert.rejects(
    () => context.pptService.generateOutline({
      ownerUserId: 7,
      topic: "outline fail",
      slideCount: 2,
      templateId: "business",
    }),
    { code: "AI_PROVIDER_FAILED" },
  );
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

test("PptService blocks generation when entitlement is not usable", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: false, status: "expired", remaining: "100" };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Blocked by entitlement status",
    slideCount: 2,
    templateId: "business",
  });
  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    { code: "ENTITLEMENT_NOT_USABLE" },
  );
  assert.deepEqual(context.billingCalls, [["balance", { userId: 7, entitlementId: 88 }]]);
});

test("PptService reports required credits when balance is insufficient", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: true, remaining: "3.9" };
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Insufficient credits detail",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 62,
    }),
    (error) => {
      assert.equal(error.code, "INSUFFICIENT_CREDITS");
      assert.equal(error.publicDetails.entitlement_id, 62);
      assert.equal(error.publicDetails.required_amount, "6");
      assert.equal(error.publicDetails.balance.remaining, "3.9");
      return true;
    },
  );
});

test("PptService maps platform insufficient-credit reserve errors before AI generation", async () => {
  let aiCalled = false;
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async () => {
    aiCalled = true;
    return [];
  };
  const context = await createBusinessContext({
    aiProvider,
    billingOverrides: {
      reserveCredits: async (input) => {
        context.billingCalls.push(["reserve", input]);
        const error = new Error("平台积分不足");
        error.code = "60005";
        error.status = 400;
        throw error;
      },
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Reserve insufficient credits",
    slideCount: 2,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    (error) => {
      assert.equal(error.code, "INSUFFICIENT_CREDITS");
      assert.equal(error.status, 402);
      assert.equal(error.publicDetails.entitlement_id, 88);
      assert.equal(error.publicDetails.required_amount, "6");
      return true;
    },
  );

  assert.equal(aiCalled, false);
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve"]);
});

test("PptService persists deterministic generation billing idempotency keys", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Billing key persistence",
    slideCount: 2,
    templateId: "business",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const events = await context.database.find("billing_events");

  assert.deepEqual(events.map((event) => event.eventType), ["reserve", "settle"]);
  assert.deepEqual(events.map((event) => event.idempotencyKey), [
    `${result.task.id}:ppt_generate:reserve`,
    `${result.task.id}:ppt_generate:settle`,
  ]);
  assert.deepEqual(context.billingCalls.filter((call) => call[0] !== "balance").map((call) => call[1].idempotencyKey), [
    `${result.task.id}:ppt_generate:reserve`,
    `${result.task.id}:ppt_generate:settle`,
  ]);
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

test("PptService regenerates a slide when the UI sends a one-based slide number", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Numbered slide regeneration",
    slideCount: 3,
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
    slideId: "2",
    instruction: "Tighten this page",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.id, "slide_2");
  assert.equal(regenerated.slide.title.includes("Tighten this page"), true);
});

test("PptService preserves slide identity when regenerated slide omits ids", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async ({ slide, instruction }) => ({
    title: `${slide.title} regenerated`,
    bullets: [instruction],
  });
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Identity preservation",
    slideCount: 2,
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
    slideId: deckResult.deck.slides[0].id,
    instruction: "Keep identity",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.id, "slide_1");
  assert.equal(regenerated.slide.sortOrder, 1);
  assert.equal(regenerated.deck.slides[0].id, "slide_1");
});

test("PptService preserves dome layout metadata during slide regeneration", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.regenerateSlide = async ({ instruction }) => ({
    title: "成果展示 regenerated",
    bullets: [instruction, "客户反馈", "团队荣誉"],
    layout: "unknown-layout",
    sectionLabel: "",
  });
  const context = await createBusinessContext({ aiProvider });
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-regenerate",
    title: "Dome regenerate",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "B80F1A",
      accent: "F6D48A",
      background: "8F0613",
      surface: "FFF8E6",
      title: "7A0611",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [{
      id: "slide_1",
      sortOrder: 1,
      title: "成果展示",
      bullets: ["项目成果", "客户反馈", "团队荣誉"],
      layout: "showcase",
      sectionLabel: "PART 02",
    }],
  });

  const regenerated = await context.pptService.regenerateSlide({
    ownerUserId: 7,
    deckId: deck.id,
    slideId: "slide_1",
    instruction: "强化成果表达",
    entitlementId: 88,
  });

  assert.equal(regenerated.slide.layout, "showcase");
  assert.equal(regenerated.slide.sectionLabel, "PART 02");
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

test("PptService can apply a different template to an existing outline without regenerating it", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Market expansion",
    slideCount: 2,
    templateId: "business",
    theme: "modern",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
    templateId: "pitch",
    theme: "startup",
  });
  const persistedOutline = await context.database.findOne("outlines", (item) => item.id === outline.id);

  assert.equal(persistedOutline.templateId, "business");
  assert.equal(persistedOutline.theme, "modern");
  assert.equal(result.deck.templateId, "pitch");
  assert.equal(result.deck.theme, "startup");
  assert.equal(result.deck.slides.length, outline.slides.length);
  assert.match(result.deck.slides[0].title, /Market expansion - slide 1/);
  assert.match(result.deck.slides[0].bullets[0], /Pitch angle:/);
});

test("PptService retries slide generation when slide JSON fails schema validation", async () => {
  const calls = [];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async (prompt) => {
    calls.push(prompt);
    if (calls.length === 1) {
      return prompt.outline.slides.map((slide) => ({ title: slide.title, bullets: "not an array" }));
    }
    return prompt.outline.slides.map((slide, index) => ({
      id: `retry_slide_${index + 1}`,
      sortOrder: index + 1,
      title: slide.title,
      bullets: slide.bullets.map((bullet) => `Retried: ${bullet}`),
      speakerNotes: `Retried notes for ${slide.title}`,
      layout: index === 0 ? "title" : "content",
      theme: prompt.outline.theme,
    }));
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Schema retry",
    slideCount: 2,
    templateId: "business",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[1].validation.retry, true);
  assert.match(calls[1].validation.reason, /bullets/);
  assert.equal(result.deck.slides.length, outline.slides.length);
  assert.equal(result.deck.slides[0].id, "retry_slide_1");
  assert.equal(result.deck.slides[0].bullets[0], "Retried: Key point 1");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
});

test("PptService degrades to outline slides after repeated schema-invalid slide JSON", async () => {
  const calls = [];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async (prompt) => {
    calls.push(prompt);
    return prompt.outline.slides.map((slide) => ({
      id: "",
      title: slide.title,
      bullets: ["valid looking extra slide"],
    })).concat([{ title: "unexpected extra", bullets: ["extra"] }]);
  };
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Schema fallback",
    slideCount: 2,
    templateId: "business",
    theme: "modern",
  });
  const edited = await context.pptService.updateOutline({
    ownerUserId: 7,
    outlineId: outline.id,
    slides: [
      { title: "Stable title one", bullets: ["Stable point one", "Stable point two"] },
      { title: "Stable title two", bullets: ["Stable point three"] },
    ],
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: edited.id,
    entitlementId: 88,
    templateId: "education",
    theme: "lecture",
  });

  assert.equal(calls.length, 2);
  assert.equal(result.deck.templateId, "education");
  assert.equal(result.deck.theme, "lecture");
  assert.equal(result.deck.slides.length, edited.slides.length);
  assert.deepEqual(result.deck.slides.map((slide) => slide.title), ["Stable title one", "Stable title two"]);
  assert.deepEqual(result.deck.slides[0].bullets, ["Stable point one", "Stable point two"]);
  assert.equal(result.deck.slides[0].fallback, true);
  assert.equal(result.deck.slides[0].theme, "lecture");
  assert.deepEqual(context.billingCalls.map((call) => call[0]), ["balance", "reserve", "settle"]);
});

test("PptService normalizes generated slide layouts with the selected template schema", async () => {
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: "unknown-layout",
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Layout schema",
    slideCount: 2,
    templateId: "pitch",
    theme: "startup",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.equal(result.deck.slides[0].layout, "venture-cover");
  assert.equal(result.deck.slides[1].layout, "venture-story");
});

test("PptService assigns dome layout roles from outline structure when provider omits usable layouts", async () => {
  const outlineSlides = [
    { title: "年度工作汇报", bullets: ["2026 年度经营复盘"] },
    { title: "目录", bullets: ["工作汇报", "成果展示", "问题复盘", "下步计划"] },
    { title: "工作汇报", bullets: ["PART 01"] },
    { title: "年度工作概况", bullets: ["业务进展", "团队投入", "关键成果"] },
    { title: "三步骤流程", bullets: ["调研", "规划", "落地"] },
    { title: "四步骤流程", bullets: ["目标拆解", "资源配置", "执行跟踪", "复盘优化"] },
    { title: "数据指标", bullets: ["收入增长", "留存提升", "交付提速"] },
    { title: "成果展示", bullets: ["项目成果", "客户反馈", "团队荣誉"], sectionLabel: "PART 02" },
    { title: "问题复盘", bullets: ["风险信号", "原因分析", "改进措施"] },
    { title: "下一步计划", bullets: ["季度路线", "关键动作", "负责人复盘"] },
    { title: "汇报结束", bullets: ["感谢观看"] },
  ];
  const aiProvider = new MockAiProvider();
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: "unknown-layout",
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.database.insert("outlines", {
    ownerUserId: 7,
    topic: "Dome auto roles",
    templateId: "business",
    theme: "modern",
    status: "outline_ready",
    input: { topic: "Dome auto roles", slideCount: outlineSlides.length, templateId: "business", theme: "modern" },
    slides: outlineSlides,
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.deepEqual(result.deck.slides.map((slide) => slide.layout), [
    "cover",
    "agenda",
    "section-divider",
    "image-report",
    "three-steps",
    "four-steps",
    "metrics",
    "showcase",
    "retrospective",
    "next-plan",
    "closing",
  ]);
  assert.equal(result.deck.slides[7].sectionLabel, "PART 02");
});

test("PromptManager includes dome placeholder instructions for red-gold deck generation", () => {
  const template = new TemplateManager().getTemplate("business", { ownerUserId: 7 });
  const prompt = new PromptManager().buildDeckPrompt({
    outline: {
      topic: "Dome prompt",
      theme: "modern",
      slides: [{ title: "年度工作汇报", bullets: ["2026 年度经营复盘"] }],
    },
    template,
  });

  assert.equal(prompt.templateInstructions?.templateSystem, "dome-red-gold");
  assert.deepEqual(prompt.templateInstructions?.layoutRoles, [
    "cover",
    "agenda",
    "section-divider",
    "image-report",
    "three-steps",
    "four-steps",
    "metrics",
    "showcase",
    "retrospective",
    "next-plan",
    "closing",
  ]);
  assert.match(prompt.templateInstructions?.contentContract || "", /把 bullets 填入对应占位符/);
  assert.match(prompt.templateInstructions?.contentContract || "", /指标名: 指标值/);
  assert.match(prompt.templateInstructions?.contentContract || "", /阶段: 动作/);
  assert.match(prompt.templateInstructions?.contentContract || "", /风险、原因、措施/);
  assert.match(prompt.templateInstructions?.roleHints?.agenda || "", /必须 4 项/);
  assert.match(prompt.templateInstructions?.roleHints?.["image-report"] || "", /必须 3 条/);
  assert.match(prompt.templateInstructions?.roleHints?.["three-steps"] || "", /必须 3 条/);
  assert.match(prompt.templateInstructions?.roleHints?.["four-steps"] || "", /必须 4 条/);
  assert.match(prompt.templateInstructions?.roleHints?.showcase || "", /必须 3 条/);
  assert.match(prompt.templateInstructions?.roleHints?.metrics || "", /指标名: 指标值/);
  assert.match(prompt.templateInstructions?.roleHints?.retrospective || "", /风险、原因、措施/);
  assert.match(prompt.templateInstructions?.roleHints?.["next-plan"] || "", /阶段: 动作/);
  assert.match(prompt.templateInstructions?.contentContract || "", /不要生成普通项目符号列表/);
});

test("PptService preserves dome layout roles for the business template", async () => {
  const roles = ["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"];
  const aiProvider = new MockAiProvider();
  aiProvider.generateOutline = async () => roles.map((role, index) => ({
    title: `Dome ${role}`,
    bullets: index === 0 ? ["年度汇报"] : ["要点一", "要点二", "要点三"],
    layout: role,
  }));
  aiProvider.generateSlides = async ({ outline }) => outline.slides.map((slide, index) => ({
    id: `slide_${index + 1}`,
    sortOrder: index + 1,
    title: slide.title,
    bullets: slide.bullets,
    speakerNotes: "",
    layout: roles[index],
    theme: outline.theme,
  }));
  const context = await createBusinessContext({ aiProvider });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Dome layout roles",
    slideCount: roles.length,
    templateId: "business",
    theme: "modern",
  });

  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.deepEqual(result.deck.slides.map((slide) => slide.layout), roles);
});

test("PptService uses a user-owned template for preview and exports", async () => {
  const context = await createBusinessContext();
  await context.database.insert("template_categories", { id: "custom", name: "Custom", sortOrder: 20 });
  await context.database.insert("templates", {
    id: "user-template-7",
    name: "User Template 7",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 7,
    themes: [{ id: "custom-dark", name: "Custom Dark" }],
    visual: {
      primary: "123456",
      accent: "ABCDEF",
      background: "101820",
      surface: "FFFFFF",
      title: "F8FAFC",
      body: "E2E8F0",
      layout: "left-rail",
    },
    layoutSchema: {
      defaultCoverLayout: "lesson-title",
      defaultContentLayout: "lesson-content",
      allowedLayouts: ["lesson-title", "lesson-content"],
    },
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "User template generation",
    slideCount: 2,
    templateId: "user-template-7",
    theme: "custom-dark",
  });
  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const preview = await context.pptService.previewDeck({ ownerUserId: 7, deckId: result.deck.id });
  const pptx = await context.pptService.exportDeck({ ownerUserId: 7, deckId: result.deck.id, format: "pptx" });
  const pdf = await context.pptService.exportDeck({ ownerUserId: 7, deckId: result.deck.id, format: "pdf" });
  const pptxDownload = await context.storage.download({ ownerUserId: 7, fileId: pptx.file.id });
  const pdfDownload = await context.storage.download({ ownerUserId: 7, fileId: pdf.file.id });

  assert.match(preview, /data-template="user-template-7"/);
  assert.match(preview, /--template-primary:#123456/);
  assert.match(pptxDownload.content.toString("latin1"), /val="123456"/);
  assert.match(pdfDownload.content.toString("latin1"), /0\.071 0\.204 0\.337 rg/);
});

test("PptService persists generated decks as owner-scoped PPT assets", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Managed asset",
    slideCount: 2,
    templateId: "business",
  });
  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  const assets = await context.pptService.listAssets({ ownerUserId: 7 });
  const detail = await context.pptService.getAsset({ ownerUserId: 7, assetId: assets[0].id });

  assert.equal(assets.length, 1);
  assert.equal(assets[0].deckId, result.deck.id);
  assert.equal(assets[0].title, "Managed asset");
  assert.equal(assets[0].status, "active");
  assert.equal(detail.asset.deckId, result.deck.id);
  assert.equal(detail.deck.id, result.deck.id);
  assert.equal((await context.pptService.listAssets({ ownerUserId: 9 })).length, 0);
  await assert.rejects(
    () => context.pptService.getAsset({ ownerUserId: 9, assetId: assets[0].id }),
    { code: "ASSET_NOT_FOUND" },
  );
});

test("PptService stores exported files in storage_objects with deck and asset metadata", async () => {
  const context = await createBusinessContext();
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Indexed export",
    slideCount: 2,
    templateId: "business",
  });
  const { deck } = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const [asset] = await context.pptService.listAssets({ ownerUserId: 7 });

  const pptx = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pptx" });
  const pdf = await context.pptService.exportDeck({ ownerUserId: 7, deckId: deck.id, format: "pdf" });
  const objects = await context.database.find("storage_objects", (object) => object.ownerUserId === 7);

  assert.deepEqual(objects.map((object) => object.fileRole), ["generated_pptx", "generated_pdf"]);
  assert.deepEqual(objects.map((object) => object.assetId), [asset.id, asset.id]);
  assert.deepEqual(objects.map((object) => object.deckId), [deck.id, deck.id]);
  assert.deepEqual(objects.map((object) => object.fileId), [pptx.file.id, pdf.file.id]);
  assert.equal(objects.every((object) => object.visibility === "private" && object.status === "available"), true);
});

test("PptService enforces a 100 active PPT asset quota and soft delete releases a slot", async () => {
  const context = await createBusinessContext();
  for (let index = 0; index < 100; index += 1) {
    await context.database.insert("ppt_assets", {
      ownerUserId: 7,
      deckId: `deck_${index}`,
      outlineId: `outline_${index}`,
      title: `Asset ${index}`,
      status: "active",
      slideCount: 1,
      templateId: "business",
      theme: "modern",
    });
  }
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Quota blocked",
    slideCount: 1,
    templateId: "business",
  });

  await assert.rejects(
    () => context.pptService.generateDeck({
      ownerUserId: 7,
      outlineId: outline.id,
      entitlementId: 88,
    }),
    (error) => {
      assert.equal(error.code, "PPT_ASSET_LIMIT_REACHED");
      assert.equal(error.status, 409);
      assert.equal(error.publicDetails.limit, 100);
      return true;
    },
  );
  assert.deepEqual(context.billingCalls, []);

  const [firstAsset] = await context.pptService.listAssets({ ownerUserId: 7 });
  const deleted = await context.pptService.deleteAsset({ ownerUserId: 7, assetId: firstAsset.id });
  const generated = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });
  const assets = await context.pptService.listAssets({ ownerUserId: 7 });

  assert.equal(deleted.status, "deleted");
  assert.equal(generated.deck.status, "ready");
  assert.equal(assets.length, 100);
  assert.equal(assets.some((asset) => asset.id === firstAsset.id), false);
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

test("HTTP API supports document upload based outline and deck generation", async () => {
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
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const upload = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "source.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("Source document\nUsed for outline generation").toString("base64"),
      }),
    });
    const uploadBody = await upload.json();
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      source_file_id: uploadBody.file.id,
      slide_count: 3,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });

    assert.equal(upload.status, 201);
    assert.equal(outlineResponse.status, 201);
    assert.equal(outline.outline.slides[0].title, "Source document");
    assert.equal(outline.outline.slides.length, 3);
    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.task.status, "succeeded");
    const previewBody = await preview.text();
    assert.equal(preview.status, 200);
    assert.match(previewBody, /Source document/);
    assert.match(preview.headers.get("content-type"), /text\/html/);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].entitlementId === 88 && call[1].userId === 7), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API preview exposes selected template visual styling", async () => {
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
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Business styling",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const html = await preview.text();

    assert.equal(preview.status, 200);
    assert.match(html, /data-template="business"/);
    assert.match(html, /--template-primary:#B80F1A/);
    assert.match(html, /--template-accent:#F6D48A/);
    assert.match(html, /data-layout="red-gold"/);
    assert.match(html, /data-dome-role="cover"/);
    assert.match(html, /--dome-cover-bg:url\("data:image\/jpeg;base64,/);
    assert.match(html, /--dome-content-bg:url\("data:image\/jpeg;base64,/);
    assert.match(html, /class="preview-page"/);
    assert.match(html, /aspect-ratio:16\/9/);
    assert.match(html, /class="page-number">1 \/ 2/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("PptService preview renders dome role classes and business image assets", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-preview",
    title: "Dome preview",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "B80F1A",
      accent: "F6D48A",
      background: "8F0613",
      surface: "FFF8E6",
      title: "7A0611",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: ["年度汇报"], layout: "cover" },
      { title: "目录", bullets: ["工作汇报", "成果展示"], layout: "agenda" },
      { title: "第一章", bullets: ["PART 01"], layout: "section-divider" },
      { title: "工作汇报图文页", bullets: ["业务进展", "团队投入", "关键成果"], layout: "image-report" },
      { title: "追加封面", bullets: ["Manual cover"], layout: "cover" },
      { title: "三步骤流程", bullets: ["Discovery", "Planning", "Launch"], layout: "three-steps" },
      { title: "四步骤流程", bullets: ["Target split", "Resource plan", "Process tracking", "Review loop"], layout: "four-steps" },
      { title: "数据指标", bullets: ["Revenue growth: 32%", "Retention rate: 88%", "Delivery speed: 2.4d"], layout: "metrics" },
      { title: "成果展示", bullets: ["项目成果", "客户反馈", "团队荣誉"], layout: "showcase", sectionLabel: "PART 02" },
      { title: "问题复盘", bullets: ["Risk signal", "Root cause", "Mitigation"], layout: "retrospective" },
      { title: "下一步计划", bullets: ["Q1: Quarter roadmap", "Q2: Key action", "Q3: Owner review"], layout: "next-plan" },
      { title: "汇报结束", bullets: ["感谢观看"], layout: "closing" },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  for (const role of ["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"]) {
    assert.match(html, new RegExp(`data-dome-role="${role}"`));
  }
  assert.match(html, /--dome-business-1:url\("data:image\/jpeg;base64,/);
  assert.match(html, /--dome-business-4:url\("data:image\/jpeg;base64,/);
  assert.match(html, /--dome-business-6:url\("data:image\/jpeg;base64,/);
  assert.match(html, /\.slide\[data-dome-role="four-steps"\] \.dome-role-visual\{background-image:var\(--dome-business-4\);\}/);
  assert.match(html, /class="dome-role-visual"/);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-footer-decoration"/g)].length, 12);
  assert.match(html, /class="dome-role-decor dome-footer-decoration">商务办公系列 PPT 模板<\/div>/);
  assert.match(html, /dome-agenda-card/);
  assert.equal([...html.matchAll(/class="dome-agenda-card"/g)].length, 4);
  assert.equal([...html.matchAll(/class="dome-agenda-number"/g)].length, 4);
  assert.match(html, /<span class="dome-agenda-number">01<\/span><span class="dome-agenda-text">工作汇报<\/span>/);
  assert.match(html, /<span class="dome-agenda-text">问题不足<\/span>/);
  assert.match(html, /<span class="dome-agenda-text">下步计划<\/span>/);
  assert.equal([...html.matchAll(/class="dome-image-report-card"/g)].length, 3);
  assert.match(html, /class="dome-role-decor dome-section-number">PART 01<\/div>/);
  assert.match(html, /data-dome-role="image-report"[\s\S]*class="dome-role-decor dome-section-label">PART 03<\/div>/);
  assert.match(html, /data-dome-role="three-steps"[\s\S]*class="dome-role-decor dome-section-label">PART 05<\/div>/);
  assert.match(html, /data-dome-role="four-steps"[\s\S]*class="dome-role-decor dome-section-label">PART 06<\/div>/);
  assert.equal([...html.matchAll(/class="dome-role-decor dome-step-connector"/g)].length, 2);
  assert.match(html, /data-dome-role="three-steps"[\s\S]*class="dome-role-decor dome-step-connector"/);
  assert.match(html, /data-dome-role="four-steps"[\s\S]*class="dome-role-decor dome-step-connector"/);
  assert.match(html, /data-dome-role="metrics"[\s\S]*class="dome-role-decor dome-section-label">PART 07<\/div>/);
  assert.match(html, /class="dome-role-decor dome-section-label">PART 02<\/div>/);
  assert.match(html, /data-dome-role="next-plan"[\s\S]*class="dome-role-decor dome-section-label">PART 10<\/div>/);
  assert.match(html, /dome-metric-card/);
  assert.match(html, /<span class="dome-metric-value">88%<\/span><span class="dome-metric-label">Retention rate<\/span>/);
  assert.equal([...html.matchAll(/class="dome-showcase-card"/g)].length, 3);
  assert.equal([...html.matchAll(/class="dome-showcase-number"/g)].length, 3);
  assert.match(html, /<span class="dome-showcase-number">01<\/span><span class="dome-showcase-text">项目成果<\/span>/);
  assert.match(html, /<span class="dome-showcase-number">03<\/span><span class="dome-showcase-text">团队荣誉<\/span>/);
  assert.match(html, /dome-risk-card/);
  assert.equal([...html.matchAll(/class="dome-retrospective-card"/g)].length, 3);
  assert.equal([...html.matchAll(/class="dome-retrospective-label"/g)].length, 3);
  assert.match(html, /dome-plan-timeline/);
  assert.equal([...html.matchAll(/class="dome-next-plan-phase"/g)].length, 4);
  assert.equal([...html.matchAll(/class="dome-next-plan-action"/g)].length, 4);
  assert.match(html, /class="dome-role-decor dome-cover-subtitle">年度汇报<\/div>/);
  assert.match(html, /<span class="dome-card-index">01<\/span><span class="dome-card-text">Discovery<\/span>/);
  assert.match(html, /<span class="dome-metric-value">2\.4d<\/span><span class="dome-metric-label">Delivery speed<\/span>/);
  assert.match(html, /<span class="dome-card-text">团队投入<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">风险<\/span><span class="dome-card-text">Risk signal<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">原因<\/span><span class="dome-card-text">Root cause<\/span>/);
  assert.match(html, /<span class="dome-retrospective-label">措施<\/span><span class="dome-card-text">Mitigation<\/span>/);
  assert.match(html, /<span class="dome-next-plan-phase">Q1<\/span><span class="dome-next-plan-action">Quarter roadmap<\/span>/);
  assert.match(html, /<span class="dome-next-plan-phase">Q3<\/span><span class="dome-next-plan-action">Owner review<\/span>/);
  assert.doesNotMatch(html, /data-dome-role="three-steps"[\s\S]*<li>Discovery<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="metrics"[\s\S]*<li>Retention rate<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="image-report"[\s\S]*<li>团队投入<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="showcase"[\s\S]*<li>客户反馈<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="retrospective"[\s\S]*<li>Root cause<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="closing"[\s\S]*<li>感谢观看<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="cover"[\s\S]*<li>年度汇报<\/li>/);
  assert.doesNotMatch(html, /data-dome-role="section-divider"[\s\S]*<li>PART 01<\/li>/);
  const previewSlides = [...html.matchAll(/<div class="([^"]*\bslide\b[^"]*)" data-dome-role="([^"]+)"[\s\S]*?<h2>([^<]+)<\/h2>/g)];
  const explicitCoverSlide = previewSlides.find(([, , , title]) => title === "追加封面");
  assert.equal(explicitCoverSlide?.[2], "cover");
  assert.match(explicitCoverSlide?.[1] || "", /\bslide-cover\b/);
  const closingSlide = previewSlides.find(([, , , title]) => title === "汇报结束");
  assert.equal(closingSlide?.[2], "closing");
  assert.match(closingSlide?.[1] || "", /\bslide-cover\b/);
});

test("PptService preview infers image-report role from work summary titles", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-implicit-summary",
    title: "Dome implicit summary",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "B80F1A",
      accent: "F6D48A",
      background: "8F0613",
      surface: "FFF8E6",
      title: "7A0611",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: ["年度汇报"] },
      { title: "年度工作概况", bullets: ["业务进展", "团队投入", "关键成果"] },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-dome-role="image-report"[\s\S]*<h2>年度工作概况<\/h2>/);
  assert.doesNotMatch(html, /data-dome-role="three-steps"[\s\S]*<h2>年度工作概况<\/h2>/);
});

test("PptService preview fills a default dome section number when omitted", async () => {
  const context = await createBusinessContext();
  const deck = await context.database.insert("decks", {
    ownerUserId: 7,
    outlineId: "outline-dome-default-section",
    title: "Dome default section",
    templateId: "business",
    templateName: "Executive Business",
    templateVisual: {
      primary: "B80F1A",
      accent: "F6D48A",
      background: "8F0613",
      surface: "FFF8E6",
      title: "7A0611",
      body: "3C1F1F",
      layout: "red-gold",
    },
    theme: "modern",
    status: "ready",
    slides: [
      { title: "封面", bullets: ["年度汇报"], layout: "cover" },
      { title: "第一章", bullets: [], layout: "section-divider" },
    ],
  });

  const html = await context.pptService.previewDeck({ ownerUserId: 7, deckId: deck.id });

  assert.match(html, /data-dome-role="section-divider"[\s\S]*class="dome-role-decor dome-section-number">PART 01<\/div>/);
  assert.doesNotMatch(html, /class="dome-role-decor dome-section-number">PART 00<\/div>/);
});

test("HTTP API generates a new deck from an existing outline with the currently selected template", async () => {
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
    billingClient: context.billingClient,
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const enter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const cookie = enter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Template switch",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
      entitlement_id: 88,
      template_id: "pitch",
      theme: "startup",
    });
    const deckBody = await deckResponse.json();
    const preview = await fetch(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/preview`, { headers: { cookie } });
    const html = await preview.text();

    assert.equal(deckResponse.status, 201);
    assert.equal(deckBody.deck.templateId, "pitch");
    assert.equal(deckBody.deck.theme, "startup");
    assert.equal(deckBody.deck.slides.length, outline.outline.slides.length);
    assert.match(deckBody.deck.slides[0].bullets[0], /Pitch angle:/);
    assert.match(html, /data-template="pitch"/);
    assert.match(html, /--template-primary:#111827/);
    assert.match(html, /data-layout="venture"/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API lists template categories and merges official active templates with owner templates", async () => {
  const context = await createBusinessContext();
  await context.database.insert("template_categories", { id: "custom", name: "Custom", sortOrder: 20 });
  await context.database.insert("templates", {
    id: "official-custom",
    name: "Official Custom",
    categoryId: "custom",
    scope: "official",
    status: "active",
    themes: [{ id: "clean", name: "Clean" }],
  });
  await context.database.insert("templates", {
    id: "disabled-custom",
    name: "Disabled Custom",
    categoryId: "custom",
    scope: "official",
    status: "disabled",
  });
  await context.database.insert("templates", {
    id: "my-custom",
    name: "My Custom",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 7,
    themes: [{ id: "mine", name: "Mine" }],
  });
  await context.database.insert("templates", {
    id: "their-custom",
    name: "Their Custom",
    categoryId: "custom",
    scope: "user",
    status: "active",
    ownerUserId: 9,
  });
  const app = createApp({
    database: context.database,
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
    const categoriesResponse = await fetch(`${baseUrl}/api/template-categories`, { headers: { cookie } });
    const templatesResponse = await fetch(`${baseUrl}/api/templates?category_id=custom`, { headers: { cookie } });
    const categories = await categoriesResponse.json();
    const templates = await templatesResponse.json();

    assert.equal(categoriesResponse.status, 200);
    assert.equal(categories.categories.some((category) => category.id === "custom"), true);
    assert.equal(templatesResponse.status, 200);
    assert.deepEqual(templates.templates.map((template) => template.id), ["official-custom", "my-custom"]);
    assert.equal(templates.templates[0].category.id, "custom");
    assert.equal(templates.templates[1].scope, "user");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API persists generated PPT assets across sessions and isolates owners", async () => {
  const context = await createBusinessContext();
  let nextIdentity = { user_id: 7, app_id: 15, product_id: 73 };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => nextIdentity },
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
    const firstEnter = await fetch(`${baseUrl}/enter?ticket=ok`, { redirect: "manual" });
    const firstCookie = firstEnter.headers.get("set-cookie").split(";")[0];
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, firstCookie, {
      topic: "Persistent history",
      slide_count: 2,
      template_id: "business",
    });
    const outlineBody = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, firstCookie, {
      outline_id: outlineBody.outline.id,
    });
    assert.equal(deckResponse.status, 201);

    const secondEnter = await fetch(`${baseUrl}/enter?ticket=again`, { redirect: "manual" });
    const secondCookie = secondEnter.headers.get("set-cookie").split(";")[0];
    const listResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: secondCookie } });
    const listBody = await listResponse.json();
    const detailResponse = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, { headers: { cookie: secondCookie } });
    const detailBody = await detailResponse.json();

    nextIdentity = { user_id: 9, app_id: 15, product_id: 73 };
    const otherEnter = await fetch(`${baseUrl}/enter?ticket=other`, { redirect: "manual" });
    const otherCookie = otherEnter.headers.get("set-cookie").split(";")[0];
    const otherListResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: otherCookie } });
    const otherListBody = await otherListResponse.json();
    const forbiddenDetail = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, { headers: { cookie: otherCookie } });

    const deleteResponse = await fetch(`${baseUrl}/api/ppt/assets/${listBody.assets[0].id}`, {
      method: "DELETE",
      headers: { cookie: secondCookie },
    });
    const afterDeleteResponse = await fetch(`${baseUrl}/api/ppt/assets`, { headers: { cookie: secondCookie } });
    const afterDeleteBody = await afterDeleteResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.assets.length, 1);
    assert.equal(listBody.assets[0].title, "Persistent history");
    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.asset.title, "Persistent history");
    assert.equal(detailBody.deck.id, listBody.assets[0].deckId);
    assert.deepEqual(otherListBody.assets, []);
    assert.equal(forbiddenDetail.status, 404);
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(afterDeleteBody.assets, []);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API blocks downloads for files belonging to deleted PPT assets", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    internalToken: "download-secret",
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
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Deleted download",
      slide_count: 2,
      template_id: "business",
    });
    const outlineBody = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outlineBody.outline.id,
    });
    const deckBody = await deckResponse.json();
    const [asset] = await context.pptService.listAssets({ ownerUserId: 7 });
    const exportResponse = await postJson(`${baseUrl}/api/ppt/decks/${deckBody.deck.id}/exports`, cookie, { format: "pdf" });
    const exportBody = await exportResponse.json();
    const signedResponse = await fetch(`${baseUrl}/api/files/${exportBody.file.id}/download-url`, { headers: { cookie } });
    const signedBody = await signedResponse.json();

    const deleteResponse = await fetch(`${baseUrl}/api/ppt/assets/${asset.id}`, { method: "DELETE", headers: { cookie } });
    const directDownload = await fetch(`${baseUrl}/api/files/${exportBody.file.id}`, { headers: { cookie } });
    const signedDownload = await fetch(`${baseUrl}${signedBody.url}`);
    const directBody = await directDownload.json();
    const signedDownloadBody = await signedDownload.json();

    assert.equal(exportResponse.status, 201);
    assert.equal(signedResponse.status, 200);
    assert.equal(deleteResponse.status, 200);
    assert.equal(directDownload.status, 404);
    assert.equal(directBody.error.code, "FILE_NOT_FOUND");
    assert.equal(signedDownload.status, 404);
    assert.equal(signedDownloadBody.error.code, "FILE_NOT_FOUND");
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

test("HTTP API keeps edited outline slide count within page limits", async () => {
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
      topic: "Too many edited slides",
      slide_count: 2,
      template_id: "business",
      theme: "modern",
    });
    const outlineBody = await outlineResponse.json();
    const tooManySlides = Array.from({ length: 21 }, (_, index) => ({
      title: `Slide ${index + 1}`,
      bullets: ["A"],
    }));
    const editResponse = await fetch(`${baseUrl}/api/ppt/outlines/${outlineBody.outline.id}`, {
      method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slides: tooManySlides }),
    });
    const editBody = await editResponse.json();
    const storedOutline = await context.database.findOne("outlines", (outline) => outline.id === outlineBody.outline.id);

    assert.equal(editResponse.status, 400);
    assert.equal(editBody.error.code, "OUTLINE_INVALID");
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
    assert.match(html, /生成工作台/);
    assert.match(html, /模板管理/);
    assert.match(html, /资产库/);
    assert.match(html, /状态中心/);
    assert.match(html, /id="topic"/);
    assert.match(html, /PPT 生成步骤/);
    assert.match(html, /填写主题或文档/);
    assert.match(html, /生成并确认大纲/);
    assert.match(html, /选择模板并生成 PPT/);
    assert.match(html, /预览并下载/);
    assert.match(html, /data-flow-step="download"/);
    assert.match(html, /data-flow-panel="input preview"/);
    assert.match(html, /data-flow-panel="outline"/);
    assert.match(html, /data-flow-panel="preview"/);
    assert.match(html, /data-flow-panel="outline preview"/);
    assert.match(html, /setFlowStep/);
    assert.match(html, /setFlowStage/);
    assert.match(html, /applyWorkspaceVisibility/);
    assert.match(html, /id="outline-editor"/);
    assert.match(html, /id="outline-board"/);
    assert.match(html, /id="outline-summary"/);
    assert.match(html, /大纲信息/);
    assert.match(html, /大纲确认/);
    assert.match(html, /当前状态/);
    assert.match(html, /可编辑要点/);
    assert.match(html, /class="outline-shell"/);
    assert.match(html, /renderOutlineBoard/);
    assert.match(html, /renderOutlineLoading/);
    assert.match(html, /loading-spinner/);
    assert.match(html, /正在生成大纲/);
    assert.match(html, /理解主题和文档内容/);
    assert.match(html, /OUTLINE_REVEAL_INTERVAL_MS = 620/);
    assert.match(html, /revealOutlineCards/);
    assert.match(html, /data-outline-reveal-list/);
    assert.match(html, /is-revealing/);
    assert.match(html, /stagger: true/);
    assert.match(html, /requireEditableOutlineSlides/);
    assert.match(html, /loadTemplates/);
    assert.match(html, /\/api\/templates/);
    assert.match(html, /id="template-gallery"/);
    assert.match(html, /模板内容样式预览/);
    assert.match(html, /class="template-card"/);
    assert.match(html, /class="template-thumb"/);
    assert.match(html, /data-template-card/);
    assert.match(html, /renderTemplateGallery/);
    assert.match(html, /selectTemplateCard/);
    assert.match(html, /normalizedTemplateVisual/);
    assert.match(html, /id="generate-outline"/);
    assert.match(html, /generateButton\.disabled = true/);
    assert.match(html, /id="save-outline"/);
    assert.match(html, /每行一个要点/);
    assert.match(html, /\/api\/ppt\/outlines\/" \+ state\.outlineId/);
    assert.match(html, /id="preview"/);
    assert.match(html, /data-page-panel="create assets"/);
    assert.match(html, /保存大纲后才能生成并查看模板预览/);
    assert.match(html, /下载文件/);
    assert.match(html, /download-button/);
    assert.match(html, /AI 单页润色/);
    assert.match(html, /在中间预览中点击要优化的页面/);
    assert.match(html, /id="selected-slide-label"/);
    assert.match(html, /未选择页面/);
    assert.match(html, /attachPreviewSlidePicker/);
    assert.match(html, /selectPreviewSlide/);
    assert.match(html, /点击选择第 /);
    assert.match(html, /润色建议/);
    assert.match(html, /AI 润色本页/);
    assert.match(html, /setSlideRegenerationBusy/);
    assert.match(html, /请先应用模板生成 PPT，再使用 AI 润色单页/);
    assert.match(html, /请先用鼠标在在线预览中选择要润色的页面/);
    assert.match(html, /class="preview-frame"/);
    assert.match(html, /deck-loading/);
    assert.match(html, /正在应用当前模板生成 PPT/);
    assert.match(html, /deck-progress-bar/);
    assert.match(html, /deck-loading-slide/);
    assert.match(html, /renderDeckGeneratingPreview/);
    assert.match(html, /updateDeckGeneratingPreview/);
    assert.match(html, /setDeckGenerationBusy/);
    assert.match(html, /DECK_REVEAL_INTERVAL_MS = 700/);
    assert.match(html, /DECK_MIN_LOADING_MS = 2200/);
    assert.match(html, /waitForDeckLoadingRhythm/);
    assert.match(html, /\.preview-stage \{ display: grid; min-height: 0;/);
    assert.match(html, /\.preview\.is-deck-loaded \{ height: 100%; min-height: 0;/);
    assert.match(html, /\.preview\.is-deck-loaded \.preview-frame \{ height: 100%; min-height: 0;/);
    assert.match(html, /\.preview, \.preview-frame, \.preview\.is-deck-loaded, \.preview\.is-deck-loaded \.preview-frame \{ min-height: 420px;/);
    assert.match(html, /renderDeckPreviewFrame/);
    assert.doesNotMatch(html, /fetch\("\/api\/ppt\/decks\/" \+ state\.deckId \+ "\/preview"\)\.then\(\(res\) => res\.text\(\)\)/);
    assert.match(html, /id="asset-list"/);
    assert.match(html, /loadAssets/);
    assert.match(html, /\/api\/ppt\/assets/);
    assert.match(html, /id="entitlement" value="62"/);
    assert.match(html, /id="regenerate-slide"/);
    assert.match(html, /\/slides\/" \+ slideId \+ "\/regenerate/);
    assert.match(html, /id="retry-task"/);
    assert.match(html, /setWorkspacePage/);
    assert.match(html, /PPTX/);
    assert.match(html, /PDF/);
    assert.match(html, /请先应用模板生成 PPT，再下载文件/);
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Function(script));
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

test("HTTP API blocks generation when launch entitlement is not usable", async () => {
  const context = await createBusinessContext({
    billingOverrides: {
      getBalance: async (input) => {
        context.billingCalls.push(["balance", input]);
        return { usable: "0", status: "paused", remaining: "100" };
      },
    },
  });
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 7,
        app_id: 15,
        product_id: 73,
        entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }],
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
    const outlineResponse = await postJson(`${baseUrl}/api/ppt/outlines`, cookie, {
      topic: "Entitlement not usable",
      slide_count: 2,
      template_id: "business",
    });
    const outline = await outlineResponse.json();
    const deckResponse = await postJson(`${baseUrl}/api/ppt/decks`, cookie, {
      outline_id: outline.outline.id,
    });
    const body = await deckResponse.json();

    assert.equal(deckResponse.status, 403);
    assert.equal(body.error.code, "ENTITLEMENT_NOT_USABLE");
    assert.deepEqual(context.billingCalls[0], ["balance", { userId: 7, entitlementId: 88 }]);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve"), false);
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

test("HTTP API resolves entitlement through Moling user entitlement lookup", async () => {
  const context = await createBusinessContext();
  const lookupCalls = [];
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
      listUserEntitlements: async ({ userId, productId }) => {
        lookupCalls.push({ userId, productId });
        return {
          entitlements: [
            { entitlement_id: 90, product_id: 73, status: "expired", usable: false },
            { entitlement_id: 88, product_id: 73, status: "active", usable: true },
          ],
        };
      },
    },
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
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const body = await me.json();

    assert.equal(enter.status, 302);
    assert.deepEqual(lookupCalls, [{ userId: 7, productId: 73 }]);
    assert.equal(body.user.entitlement_id, 88);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API uses configured user entitlement map when Moling lookup is unavailable", async () => {
  const context = await createBusinessContext();
  const warnings = [];
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    userEntitlementMap: new Map([[7, 88]]),
    logger: { info() {}, error() {}, warn(event, details) { warnings.push({ event, details }); }, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }),
      listUserEntitlements: async () => {
        throw new Error("not deployed");
      },
    },
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
    const me = await fetch(`${baseUrl}/api/me`, { headers: { cookie } });
    const body = await me.json();

    assert.equal(enter.status, 302);
    assert.equal(body.user.entitlement_id, 88);
    assert.equal(warnings[0].event, "entitlement_lookup_failed");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API resolves camelCase entitlement fields from launch identity", async () => {
  const context = await createBusinessContext();
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async () => ({
        user_id: 9,
        app_id: 15,
        productId: 73,
        entitlements: [
          { entitlementId: 91, productId: 73, status: "active", usable: true },
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
      topic: "CamelCase entitlement",
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

test("HTTP API keeps separate users in different sessions with separate entitlement and user id", async () => {
  const context = await createBusinessContext();
  const identities = {
    ok1: { user_id: 7, app_id: 15, product_id: 73, entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }] },
    ok2: { user_id: 9, app_id: 15, product_id: 73, entitlements: [{ entitlement_id: 91, product_id: 73, status: "active", usable: true }] },
  };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => identities[ticket],
    },
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
    const enter1 = await fetch(`${baseUrl}/enter?ticket=ok1`, { redirect: "manual" });
    const cookie1 = enter1.headers.get("set-cookie").split(";")[0];
    const enter2 = await fetch(`${baseUrl}/enter?ticket=ok2`, { redirect: "manual" });
    const cookie2 = enter2.headers.get("set-cookie").split(";")[0];

    const balance1 = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie: cookie1 } });
    const balance1Body = await balance1.json();
    const balance2 = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie: cookie2 } });
    const balance2Body = await balance2.json();

    const outline1Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie1, { topic: "User7", slide_count: 2, template_id: "business" });
    const outline1 = await outline1Response.json();
    await postJson(`${baseUrl}/api/ppt/decks`, cookie1, { outline_id: outline1.outline.id });

    const outline2Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie2, { topic: "User9", slide_count: 2, template_id: "business" });
    const outline2 = await outline2Response.json();
    await postJson(`${baseUrl}/api/ppt/decks`, cookie2, { outline_id: outline2.outline.id });

    assert.equal(balance1.status, 200);
    assert.equal(balance1Body.entitlement_id, 88);
    assert.equal(balance2.status, 200);
    assert.equal(balance2Body.entitlement_id, 91);
    assert.equal(context.billingCalls.some((call) => call[0] === "balance" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "balance" && call[1].userId === 9 && call[1].entitlementId === 91), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 9 && call[1].entitlementId === 91), true);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API keeps uploaded-document outlines isolated by user for billing", async () => {
  const context = await createBusinessContext();
  const identities = {
    user7: {
      user_id: 7,
      app_id: 15,
      product_id: 73,
      entitlements: [{ entitlement_id: 88, product_id: 73, status: "active", usable: true }],
    },
    user9: {
      user_id: 9,
      app_id: 15,
      product_id: 73,
      entitlements: [{ entitlement_id: 91, product_id: 73, status: "active", usable: true }],
    },
  };
  const app = createApp({
    database: context.database,
    defaultEntitlementId: 62,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: {
      verifyLaunchTicket: async (ticket) => identities[ticket],
    },
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
    const enter7 = await fetch(`${baseUrl}/enter?ticket=user7`, { redirect: "manual" });
    const cookie7 = enter7.headers.get("set-cookie").split(";")[0];
    const enter9 = await fetch(`${baseUrl}/enter?ticket=user9`, { redirect: "manual" });
    const cookie9 = enter9.headers.get("set-cookie").split(";")[0];

    const upload7 = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie: cookie7, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "user7.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("User7 source for outline").toString("base64"),
      }),
    });
    const file7 = await upload7.json();
    const upload9 = await fetch(`${baseUrl}/api/files`, {
      method: "POST",
      headers: { cookie: cookie9, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "user9.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from("User9 source for outline").toString("base64"),
      }),
    });
    const file9 = await upload9.json();
    const outline7Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie7, {
      source_file_id: file7.file.id,
      slide_count: 2,
      template_id: "business",
    });
    const outline9Response = await postJson(`${baseUrl}/api/ppt/outlines`, cookie9, {
      source_file_id: file9.file.id,
      slide_count: 2,
      template_id: "business",
    });
    assert.equal(outline7Response.status, 201);
    assert.equal(outline9Response.status, 201);
    const outline7 = await outline7Response.json();
    const outline9 = await outline9Response.json();
    const deck7Response = await postJson(`${baseUrl}/api/ppt/decks`, cookie7, {
      outline_id: outline7.outline.id,
    });
    const deck9Response = await postJson(`${baseUrl}/api/ppt/decks`, cookie9, {
      outline_id: outline9.outline.id,
    });
    assert.equal(deck7Response.status, 201);
    assert.equal(deck9Response.status, 201);
    const deck7 = await deck7Response.json();
    const deck9 = await deck9Response.json();
    const task7 = await fetch(`${baseUrl}/api/ppt/tasks/${deck7.task.id}`, { headers: { cookie: cookie7 } }).then((response) => response.json());
    const task9 = await fetch(`${baseUrl}/api/ppt/tasks/${deck9.task.id}`, { headers: { cookie: cookie9 } }).then((response) => response.json());

    assert.equal(upload7.status, 201);
    assert.equal(upload9.status, 201);
    assert.equal(outline7.outline.slides[0].title, "User7 source for outline");
    assert.equal(outline9.outline.slides[0].title, "User9 source for outline");
    assert.equal(deck7.task.status, "succeeded");
    assert.equal(deck9.task.status, "succeeded");
    assert.equal(task7.task.status, "succeeded");
    assert.equal(task9.task.status, "succeeded");
    assert.equal(task7.task.deckId, deck7.deck.id);
    assert.equal(task9.task.deckId, deck9.deck.id);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 7 && call[1].entitlementId === 88), true);
    assert.equal(context.billingCalls.some((call) => call[0] === "reserve" && call[1].userId === 9 && call[1].entitlementId === 91), true);
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
    assert.match(html, /balance-progress/);
    assert.match(html, /套餐正常/);
    assert.match(html, /总额 /);
    assert.ok(
      html.indexOf("\n    loadBalance();") < html.indexOf('document.querySelector("#template").addEventListener'),
      "balance should start loading before optional control event binding",
    );
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("workspace page explains missing entitlement resolution", async () => {
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
    assert.match(html, /未识别到权益 ID/);
    assert.match(html, /formatApiError/);
    assert.match(html, /ENTITLEMENT_REQUIRED/);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP API falls back to configured entitlement for restored sessions without entitlement", async () => {
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
    const storedSession = await context.database.insert("sessions", {
      id: "legacy-session",
      identity: { user_id: 7, app_id: 15, product_id: 73 },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const cookie = `sid=${storedSession.id}`;

    const page = await fetch(`${baseUrl}/`, { headers: { cookie } });
    const html = await page.text();
    const balance = await fetch(`${baseUrl}/api/billing/balance`, { headers: { cookie } });
    const balanceBody = await balance.json();

    assert.equal(page.status, 200);
    assert.match(html, /id="entitlement" value="62"/);
    assert.equal(balance.status, 200);
    assert.equal(balanceBody.entitlement_id, 62);
    assert.equal(context.billingCalls[0][1].entitlementId, 62);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

async function createBusinessContext(options = {}) {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "outlines", "decks", "generation_tasks", "billing_events", "call_logs", "templates", "template_categories", "ppt_assets", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const taskCenter = new MemoryTaskCenter();
  const templateManager = new TemplateManager({ database });
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
