import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { MockAiProvider } from "../src/ai-provider.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { ImageGenerationService } from "../src/image-generation-service.js";
import { PersonalTemplateService } from "../src/personal-template-service.js";
import { PromptManager } from "../src/prompt-manager.js";
import { PptExportService } from "../src/ppt-exporter.js";
import { PptService } from "../src/ppt-service.js";
import { MemoryTaskCenter } from "../src/tasks.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-model-enhancements-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("vision provider enhances uploaded PPT template classification and layout", async () => {
  const context = await createContext({
    visionProvider: {
      analyzeTemplate: async ({ templateJson }) => ({
        categoryId: "pitch",
        style: "cinematic",
        useCase: "investor_pitch",
        tags: ["fundraising", "storytelling"],
        visual: { primary: "7C3AED", accent: "F97316" },
        layoutSchema: {
          defaultCoverLayout: "hero",
          defaultContentLayout: "story",
          allowedLayouts: ["hero", "story", ...templateJson.layoutSchema.allowedLayouts],
        },
      }),
    },
  });

  const template = await context.personalTemplateService.createFromPptx({
    ownerUserId: 7,
    fileName: "pitch-source.pptx",
    content: samplePptx(),
    name: "Pitch Source",
  });
  const pitchTemplates = context.templateManager.listTemplates({ ownerUserId: 7, categoryId: "pitch" });

  assert.equal(template.categoryId, "pitch");
  assert.equal(template.style, "cinematic");
  assert.equal(template.useCase, "investor_pitch");
  assert.equal(template.visual.primary, "7C3AED");
  assert.equal(template.layoutSchema.defaultCoverLayout, "hero");
  assert.equal(template.layoutSchema.defaultContentLayout, "story");
  assert.equal(template.modelEnhancement.status, "applied");
  assert.equal(template.modelEnhancement.provider, "vision");
  assert.deepEqual(template.tags, ["fundraising", "storytelling"]);
  assert.equal(pitchTemplates.some((item) => item.id === template.id), true);
});

test("vision provider failure falls back to rule parsing and still allows deck generation", async () => {
  const context = await createContext({
    visionProvider: {
      analyzeTemplate: async () => {
        throw new Error("vision unavailable");
      },
    },
  });
  const template = await context.personalTemplateService.createFromPptx({
    ownerUserId: 7,
    fileName: "fallback-source.pptx",
    content: samplePptx(),
    name: "Fallback Source",
  });
  const outline = await context.pptService.generateOutline({
    ownerUserId: 7,
    topic: "Fallback template generation",
    slideCount: 2,
    templateId: template.id,
    theme: "default",
  });
  const result = await context.pptService.generateDeck({
    ownerUserId: 7,
    outlineId: outline.id,
    entitlementId: 88,
  });

  assert.equal(template.categoryId, "personal");
  assert.equal(template.modelEnhancement.status, "failed");
  assert.equal(template.modelEnhancement.error, "vision unavailable");
  assert.equal(result.deck.templateId, template.id);
  assert.equal(result.deck.status, "ready");
});

test("HTTP API generates owner-scoped image assets when image provider is configured", async () => {
  const context = await createContext({
    imageProvider: {
      generateImage: async ({ topic, kind }) => ({
        content: Buffer.from(`png:${kind}:${topic}`),
        mimeType: "image/png",
        fileName: `${kind}.png`,
        prompt: `Generate ${kind} for ${topic}`,
      }),
    },
  });
  const app = createApp({
    ...context,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${app.address().port}`;
    const cookie = await createSession(context.database, 7);
    const response = await fetch(`${baseUrl}/api/ppt/generated-images`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "AI quarterly review", kind: "cover", template_id: "business" }),
    });
    const body = await response.json();
    const downloaded = await context.storage.download({ ownerUserId: 7, fileId: body.file.id });
    const [object] = await context.database.find("storage_objects", (item) => item.fileId === body.file.id);

    assert.equal(response.status, 201);
    assert.equal(body.asset.kind, "cover");
    assert.equal(body.asset.topic, "AI quarterly review");
    assert.equal(body.file.mimeType, "image/png");
    assert.equal(downloaded.content.toString("utf8"), "png:cover:AI quarterly review");
    assert.equal(object.fileRole, "generated_image_asset");
    assert.equal(object.visibility, "private");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("image generation rejects clearly when image provider is not configured", async () => {
  const context = await createContext();

  await assert.rejects(
    () => context.imageGenerationService.generateImageAsset({
      ownerUserId: 7,
      topic: "No provider",
      kind: "cover",
    }),
    { code: "IMAGE_PROVIDER_NOT_CONFIGURED" },
  );
});

async function createContext(options = {}) {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "tasks", "outlines", "decks", "generation_tasks", "billing_events", "call_logs", "templates", "template_categories", "ppt_assets", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const templateManager = new TemplateManager({ database });
  const personalTemplateService = new PersonalTemplateService({
    database,
    storage,
    visionProvider: options.visionProvider,
  });
  const taskCenter = new MemoryTaskCenter();
  const billingClient = {
    getBalance: async () => ({ usable: true, remaining: "100" }),
    reserveCredits: async (input) => ({ hold_id: 501, reserved: input.amount }),
    settleCredits: async (input) => ({ status: "settled", settled_amount: input.actualAmount }),
    releaseCredits: async (input) => ({ status: "released", hold_id: input.holdId }),
  };
  const pptService = new PptService({
    database,
    storage,
    taskCenter,
    templateManager,
    aiProvider: new MockAiProvider(),
    promptManager: new PromptManager(),
    exporter: new PptExportService(),
    billingClient,
  });
  const imageGenerationService = new ImageGenerationService({
    storage,
    templateManager,
    imageProvider: options.imageProvider,
  });
  return {
    database,
    storage,
    templateManager,
    personalTemplateService,
    taskCenter,
    billingClient,
    pptService,
    imageGenerationService,
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

function samplePptx(overrides = {}) {
  return new PptExportService().exportDeck({
    format: "pptx",
    deck: {
      title: "Source Deck",
      templateId: overrides.templateId || "business",
      templateName: overrides.templateName || "Business",
      templateVisual: overrides.templateVisual || undefined,
      slides: [
        { title: "Cover", bullets: ["First point"], layout: "title" },
        { title: "Content", bullets: ["Second point"], layout: "content" },
      ],
    },
  }).content;
}
