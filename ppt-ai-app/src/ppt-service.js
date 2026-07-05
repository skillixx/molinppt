import { readFileSync } from "node:fs";

import { AppError } from "./errors.js";
import { resolveTemplateVisual } from "./templates.js";

const DOME_PREVIEW_ASSET_BASE_URL = new URL("../../templates/official/dome/assets/", import.meta.url);
const DOME_PREVIEW_ASSETS = {
  cover: readFileSync(new URL("dome-cover.jpg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  content: readFileSync(new URL("dome-content.jpg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business1: readFileSync(new URL("dome-business-1.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business2: readFileSync(new URL("dome-business-2.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business3: readFileSync(new URL("dome-business-3.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business4: readFileSync(new URL("dome-business-4.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business5: readFileSync(new URL("dome-business-5.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
  business6: readFileSync(new URL("dome-business-6.jpeg", DOME_PREVIEW_ASSET_BASE_URL)).toString("base64"),
};

const GENERATE_AMOUNT = "6";
const REGENERATE_SLIDE_AMOUNT = "2";
const MIN_SLIDE_COUNT = 1;
const MAX_SLIDE_COUNT = 32;
const SLIDE_GENERATION_MAX_ATTEMPTS = 2;
const MAX_ACTIVE_PPT_ASSETS = 100;
const MAX_PROMPT_CHARS = 5000;
const DOME_AGENDA_DEFAULT_ITEMS = ["工作汇报", "成果展示", "问题不足", "下步计划"];
const RUNNING_GENERATION_STATUSES = new Set(["running", "reconcile_pending", "release_pending"]);
const STALE_RUNNING_GENERATION_MS = 10 * 60 * 1000;

function normalizeHexColor(hex) {
  const normalized = String(hex || "000000").replace(/^#/, "").trim();
  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) return "000000";
  return normalized.toUpperCase();
}

function isStaleRunningGeneration(task, now = Date.now()) {
  if (task?.status !== "running") return false;
  const updatedAt = Date.parse(task.updated_at || task.created_at || "");
  if (!Number.isFinite(updatedAt)) return false;
  return now - updatedAt > STALE_RUNNING_GENERATION_MS;
}

function blendHexColor(base, blend, amount = 0.5) {
  const baseHex = normalizeHexColor(base);
  const blendHex = normalizeHexColor(blend);
  const ratio = Math.max(0, Math.min(1, amount));
  const baseR = Number.parseInt(baseHex.slice(0, 2), 16);
  const baseG = Number.parseInt(baseHex.slice(2, 4), 16);
  const baseB = Number.parseInt(baseHex.slice(4, 6), 16);
  const blendR = Number.parseInt(blendHex.slice(0, 2), 16);
  const blendG = Number.parseInt(blendHex.slice(2, 4), 16);
  const blendB = Number.parseInt(blendHex.slice(4, 6), 16);
  const r = Math.round(baseR * (1 - ratio) + blendR * ratio);
  const g = Math.round(baseG * (1 - ratio) + blendG * ratio);
  const b = Math.round(baseB * (1 - ratio) + blendB * ratio);
  return `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function redGoldColorPalette(visual) {
  const primary = normalizeHexColor(visual?.primary);
  const accent = normalizeHexColor(visual?.accent);
  const surface = normalizeHexColor(visual?.surface || "FFFFFF");
  const titleGradientStart = blendHexColor(accent, "FFFFFF", 0.35);
  const titleGradientEnd = blendHexColor(accent, "000000", 0.2);
  const cardFill = blendHexColor(accent, surface, 0.82);
  const cardFillStrong = blendHexColor(accent, surface, 0.72);
  const contentPanel = blendHexColor(surface, primary, 0.1);
  const surfaceText = "FFFFFF";
  const surfaceHighlight = blendHexColor(surface, "FFFFFF", 0.08);
  const softLine = blendHexColor(surface, primary, 0.2);
  const surfaceStroke = blendHexColor(surface, accent, 0.34);
  return {
    titleGradientStart,
    titleGradientEnd,
    cardFill,
    cardFillStrong,
    contentPanel,
    surfaceText,
    surfaceHighlight,
    softLine,
    surfaceStroke,
    cardStroke: blendHexColor(accent, "D9A441", 0.55),
    frameStroke: blendHexColor(primary, accent, 0.38),
    softRgb: hexToRgbString(softLine),
    primaryRgb: hexToRgbString(primary),
    cardStrokeRgb: hexToRgbString(blendHexColor(accent, "D9A441", 0.55)),
    frameStrokeRgb: hexToRgbString(blendHexColor(primary, accent, 0.38)),
  };
}

function hexToRgbString(hex) {
  const safeHex = normalizeHexColor(hex);
  return `${Number.parseInt(safeHex.slice(0, 2), 16)},${Number.parseInt(safeHex.slice(2, 4), 16)},${Number.parseInt(safeHex.slice(4, 6), 16)}`;
}

/**
 * Orchestrates AI PPT outlines, decks, exports, billing, and call logs.
 */
export class PptService {
  /**
   * Creates a PPT workflow service.
   * @param {{database: object, storage: object, taskCenter: object, templateManager: object, aiProvider: object, promptManager: object, exporter: object, billingClient: object, metrics?: object, generationLocks?: Set<string>, pptPreviewRenderer?: object}} input
   */
  constructor({ database, storage, taskCenter, templateManager, aiProvider, promptManager, exporter, billingClient, metrics, generationLocks, pptPreviewRenderer }) {
    this.database = database;
    this.storage = storage;
    this.taskCenter = taskCenter;
    this.templateManager = templateManager;
    this.aiProvider = aiProvider;
    this.promptManager = promptManager;
    this.exporter = exporter;
    this.billingClient = billingClient;
    this.metrics = metrics;
    this.generationLocks = generationLocks || new Set();
    this.pptPreviewRenderer = pptPreviewRenderer;
  }

  /**
   * Generates an editable outline from a topic or uploaded document.
   * @param {{ownerUserId: number, topic?: string, sourceFileId?: string, slideCount?: number, templateId: string, theme?: string}} input
   * @returns {Promise<object>}
   */
  async generateOutline({ ownerUserId, topic, sourceFileId, slideCount = 8, templateId, theme = "modern" }) {
    const normalizedSlideCount = normalizeSlideCount(slideCount);
    const documentText = sourceFileId ? await this.#readDocumentText({ sourceFileId, ownerUserId }) : "";
    const template = this.templateManager.getTemplate(templateId, { ownerUserId });
    validateTemplateTheme({ template, theme });
    const prompt = this.promptManager.buildOutlinePrompt({ topic, documentText, slideCount: normalizedSlideCount, theme, template });
    this.#assertPromptWithinLimit({ operation: "outline", prompt });
    let slides;
    try {
      this.#recordAiCall({ operation: "outline", prompt });
      slides = await this.aiProvider.generateOutline(prompt);
    } catch (error) {
      throw new AppError({
        code: "AI_PROVIDER_FAILED",
        status: 502,
        message: `AI_PROVIDER_FAILED: ${error.message}`,
      });
    }
    const outline = await this.database.insert("outlines", {
      ownerUserId,
      topic: topic || documentText.split(/\r?\n/).find(Boolean) || "Document generated presentation",
      templateId: template.id,
      theme,
      status: "outline_ready",
      input: { topic, sourceFileId, slideCount: normalizedSlideCount, templateId, theme },
      slides,
    });
    await this.#log({ ownerUserId, action: "outline_generated", resourceType: "outline", resourceId: outline.id });
    return outline;
  }

  /**
   * Updates an editable outline before deck generation.
   * @param {{ownerUserId: number, outlineId: string, slides: object[]}} input
   * @returns {Promise<object>}
   */
  async updateOutline({ ownerUserId, outlineId, slides }) {
    const outline = await this.#getOwned("outlines", outlineId, ownerUserId, "OUTLINE_NOT_FOUND");
    validateOutlineSlides(slides);
    const updated = await this.database.update("outlines", outline.id, {
      slides,
      status: "outline_edited",
    });
    await this.#log({ ownerUserId, action: "outline_edited", resourceType: "outline", resourceId: outline.id });
    return updated;
  }

  /**
   * Generates a deck from an outline with reserve and settle billing.
   * @param {{ownerUserId: number, outlineId: string, entitlementId: number, templateId?: string, theme?: string}} input
   * @returns {Promise<{deck: object, task: object}>}
   */
  async generateDeck({ ownerUserId, outlineId, entitlementId, templateId, theme }) {
    const outline = await this.#getOwned("outlines", outlineId, ownerUserId, "OUTLINE_NOT_FOUND");
    const selectedTemplateId = templateId || outline.templateId;
    const selectedTheme = theme || outline.theme || "modern";
    const template = this.templateManager.getTemplate(selectedTemplateId, { ownerUserId });
    validateTemplateTheme({ template, theme: selectedTheme });
    await this.#ensureAssetQuota({ ownerUserId });
    const generationLock = await this.#acquireGenerationLock({ ownerUserId, outlineId });
    try {
    const deckOutline = {
      ...outline,
      templateId: selectedTemplateId,
      theme: selectedTheme,
      sourceTemplateId: outline.templateId,
      sourceTheme: outline.theme,
    };
    const task = await this.taskCenter.createTask({
      ownerUserId,
      type: "ppt_generate",
      input: { outlineId, entitlementId, templateId: selectedTemplateId, theme: selectedTheme },
    });
    const generationTask = await this.database.insert("generation_tasks", {
      id: task.id,
      ownerUserId,
      outlineId,
      entitlementId,
      status: "running",
      progress: 10,
      retryable: false,
    });
    const reserveKey = `${task.id}:ppt_generate:reserve`;
    const settleKey = `${task.id}:ppt_generate:settle`;
    const releaseKey = `${task.id}:ppt_generate:release`;
    await this.#ensureBalance({ ownerUserId, entitlementId, amount: GENERATE_AMOUNT });
    const reserve = await this.#reserveGenerationCredits({
      ownerUserId,
      entitlementId,
      idempotencyKey: reserveKey,
    });
    await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "reserve", amount: GENERATE_AMOUNT, status: "reserved", holdId: reserve.hold_id, idempotencyKey: reserveKey });
    let deck;
    try {
      const prompt = this.promptManager.buildDeckPrompt({ outline: deckOutline, template });
      this.#assertPromptWithinLimit({ operation: "deck", prompt });
      const slides = await this.#generateValidSlides({ prompt, outline: deckOutline, template });
      deck = await this.database.insert("decks", {
        ownerUserId,
        outlineId,
        title: outline.topic,
        templateId: selectedTemplateId,
        templateName: template.name,
        templateVisual: resolveTemplateVisual({
          templateId: selectedTemplateId,
          theme: selectedTheme,
          template: { id: template.id, name: template.name, visual: template.visual, themes: template.themes },
        }),
        templateLayoutSchema: template.layoutSchema,
        theme: selectedTheme,
        status: "billing_pending",
        slides,
      });
    } catch (error) {
      try {
        await this.billingClient.releaseCredits({ holdId: reserve.hold_id, idempotencyKey: releaseKey });
      } catch (releaseError) {
        await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "release", amount: "0", status: "release_pending", holdId: reserve.hold_id, idempotencyKey: releaseKey });
        await this.taskCenter.updateTask(task.id, { status: "failed", progress: 100, error: "Billing reconciliation pending" });
        await this.database.update("generation_tasks", generationTask.id, {
          status: "release_pending",
          progress: 100,
          retryable: false,
          errorCode: "RELEASE_FAILED",
          errorMessage: releaseError.message,
          originalErrorMessage: error.message,
        });
        await this.#log({ ownerUserId, action: "billing_release_pending", resourceType: "task", resourceId: task.id, metadata: { error: releaseError.message, originalError: error.message } });
        throw new AppError({
          code: "BILLING_RECONCILIATION_PENDING",
          status: 409,
          message: "Billing reconciliation pending",
          publicDetails: { task_id: task.id, retryable: false },
        });
      }
      await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "release", amount: "0", status: "released", holdId: reserve.hold_id, idempotencyKey: releaseKey });
      await this.taskCenter.updateTask(task.id, { status: "failed", progress: 100, error: error.message });
      await this.database.update("generation_tasks", generationTask.id, { status: "failed", progress: 100, retryable: true, errorMessage: error.message });
      await this.#log({ ownerUserId, action: "deck_generation_failed", resourceType: "task", resourceId: task.id, metadata: { error: error.message } });
      throw new AppError({
        code: "AI_PROVIDER_FAILED",
        status: 502,
        message: `AI_PROVIDER_FAILED: ${error.message}`,
        publicDetails: { task_id: task.id, retryable: true },
      });
    }
    try {
      await this.billingClient.settleCredits({
        holdId: reserve.hold_id,
        actualAmount: GENERATE_AMOUNT,
        idempotencyKey: settleKey,
      });
      await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "settle", amount: GENERATE_AMOUNT, status: "settled", holdId: reserve.hold_id, idempotencyKey: settleKey });
      const readyDeck = await this.database.update("decks", deck.id, { status: "ready" });
      const completedTask = await this.taskCenter.updateTask(task.id, { status: "succeeded", progress: 100, result: { deckId: deck.id } });
      await this.database.update("generation_tasks", generationTask.id, { status: "succeeded", progress: 100, deckId: deck.id });
      await this.#createAssetForDeck({ deck: readyDeck, outline });
      await this.#log({ ownerUserId, action: "deck_generated", resourceType: "deck", resourceId: deck.id });
      return { deck: readyDeck, task: completedTask };
    } catch (error) {
      await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "settle", amount: GENERATE_AMOUNT, status: "settle_pending", holdId: reserve.hold_id, idempotencyKey: settleKey });
      await this.taskCenter.updateTask(task.id, { status: "failed", progress: 100, error: "Billing reconciliation pending" });
      await this.database.update("generation_tasks", generationTask.id, {
        status: "reconcile_pending",
        progress: 100,
        deckId: deck.id,
        retryable: false,
        errorCode: "SETTLE_FAILED",
        errorMessage: error.message,
      });
      await this.#log({ ownerUserId, action: "billing_settle_pending", resourceType: "task", resourceId: task.id, metadata: { error: error.message, deckId: deck.id } });
      throw new AppError({
        code: "BILLING_RECONCILIATION_PENDING",
        status: 409,
        message: "Billing reconciliation pending",
        publicDetails: { task_id: task.id, deck_id: deck.id, retryable: false },
      });
    }
    } finally {
      await generationLock.release();
    }
  }

  /**
   * Retries a failed generation task.
   * @param {{ownerUserId: number, taskId: string, entitlementId: number}} input
   * @returns {Promise<{deck: object, task: object}>}
   */
  async retryTask({ ownerUserId, taskId, entitlementId }) {
    const failedTask = await this.#getOwned("generation_tasks", taskId, ownerUserId, "TASK_NOT_FOUND");
    if (!failedTask.retryable) {
      throw new AppError({ code: "TASK_NOT_RETRYABLE", status: 400, message: "Task is not retryable" });
    }
    return this.generateDeck({ ownerUserId, outlineId: failedTask.outlineId, entitlementId });
  }

  /**
   * Returns a persisted generation task for status and progress checks.
   * @param {{ownerUserId: number, taskId: string}} input
   * @returns {Promise<object>}
   */
  async getGenerationTask({ ownerUserId, taskId }) {
    return this.#getOwned("generation_tasks", taskId, ownerUserId, "TASK_NOT_FOUND");
  }

  /**
   * Lists active PPT assets owned by a user.
   * @param {{ownerUserId: number}} input
   * @returns {Promise<object[]>}
   */
  async listAssets({ ownerUserId }) {
    const assets = await this.database.find("ppt_assets", (asset) => (
      Number(asset.ownerUserId) === Number(ownerUserId) && asset.status === "active"
    ));
    return assets.sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  }

  /**
   * Returns an owner-scoped PPT asset with its deck.
   * @param {{ownerUserId: number, assetId: string}} input
   * @returns {Promise<{asset: object, deck: object}>}
   */
  async getAsset({ ownerUserId, assetId }) {
    const asset = await this.#getOwnedActiveAsset({ ownerUserId, assetId });
    const deck = await this.#getOwned("decks", asset.deckId, ownerUserId, "DECK_NOT_FOUND");
    return { asset, deck };
  }

  /**
   * Soft deletes an owner-scoped PPT asset.
   * @param {{ownerUserId: number, assetId: string}} input
   * @returns {Promise<object>}
   */
  async deleteAsset({ ownerUserId, assetId }) {
    const asset = await this.#getOwnedActiveAsset({ ownerUserId, assetId });
    const deleted = await this.database.update("ppt_assets", asset.id, {
      status: "deleted",
      deleted_at: new Date().toISOString(),
    });
    await this.#deleteAssetFiles({ ownerUserId, assetId: asset.id });
    await this.#log({ ownerUserId, action: "ppt_asset_deleted", resourceType: "ppt_asset", resourceId: asset.id });
    return deleted;
  }

  /**
   * Reconciles pending billing settlement events after transient platform failures.
   * @param {{limit?: number}} input
   * @returns {Promise<{checked: number, settled: number, released: number, failed: number}>}
   */
  async reconcileBillingEvents({ limit = 20 } = {}) {
    const pendingEvents = (await this.database.find("billing_events", (event) => event.status === "settle_pending" || event.status === "release_pending"))
      .slice(0, normalizeLimit(limit));
    const result = { checked: pendingEvents.length, settled: 0, released: 0, failed: 0 };
    for (const event of pendingEvents) {
      try {
        const platformResponse = event.status === "settle_pending"
          ? await this.billingClient.settleCredits({
            holdId: event.holdId,
            actualAmount: event.amount,
            idempotencyKey: event.idempotencyKey,
          })
          : await this.billingClient.releaseCredits({
            holdId: event.holdId,
            idempotencyKey: event.idempotencyKey,
          });
        await this.database.update("billing_events", event.id, {
          status: event.status === "settle_pending" ? "settled" : "released",
          platformResponse,
        });
        const task = await this.database.findOne("generation_tasks", (item) => item.id === event.taskId);
        if (task) {
          if (event.status === "settle_pending") {
            await this.database.update("generation_tasks", task.id, {
              status: "succeeded",
              progress: 100,
              retryable: false,
              errorCode: null,
              errorMessage: null,
            });
            if (task.deckId) {
              await this.database.update("decks", task.deckId, { status: "ready" });
              await this.#createAssetForReadyDeck({ ownerUserId: task.ownerUserId, deckId: task.deckId });
            }
          } else {
            await this.database.update("generation_tasks", task.id, {
              status: "failed",
              progress: 100,
              retryable: true,
              errorCode: null,
              errorMessage: task.originalErrorMessage || task.errorMessage,
            });
          }
          await this.#log({ ownerUserId: task.ownerUserId, action: "billing_reconciled", resourceType: "task", resourceId: task.id });
        } else if (event.status === "settle_pending") {
          const deck = await this.database.findOne("decks", (item) => item.id === event.taskId);
          if (deck) {
            await this.database.update("decks", deck.id, { status: "ready" });
            await this.#log({ ownerUserId: deck.ownerUserId, action: "billing_reconciled", resourceType: "deck", resourceId: deck.id });
          }
        }
        if (event.status === "settle_pending") result.settled += 1;
        else result.released += 1;
      } catch (error) {
        await this.database.update("billing_events", event.id, {
          status: "reconcile_failed",
          errorMessage: error.message,
        });
        result.failed += 1;
      }
    }
    return result;
  }

  /**
   * Regenerates one slide and consumes known-cost credits.
   * @param {{ownerUserId: number, deckId: string, slideId: string, instruction: string, entitlementId: number}} input
   * @returns {Promise<{deck: object, slide: object}>}
   */
  async regenerateSlide({ ownerUserId, deckId, slideId, instruction, entitlementId }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    assertDeckReady(deck);
    const slide = resolveSlide(deck.slides, slideId);
    if (!slide) throw new AppError({ code: "SLIDE_NOT_FOUND", status: 404, message: "Slide not found" });
    const resolvedSlideId = slide.id || String(slide.sortOrder || slideId);
    const reserveKey = `${deckId}:${resolvedSlideId}:ppt_slide_regenerate:reserve`;
    const settleKey = `${deckId}:${resolvedSlideId}:ppt_slide_regenerate:settle`;
    const releaseKey = `${deckId}:${resolvedSlideId}:ppt_slide_regenerate:release`;
    await this.#ensureBalance({ ownerUserId, entitlementId, amount: REGENERATE_SLIDE_AMOUNT });
    const reserve = await this.billingClient.reserveCredits({
      userId: ownerUserId,
      entitlementId,
      amount: REGENERATE_SLIDE_AMOUNT,
      idempotencyKey: reserveKey,
    });
    await this.#recordBilling({ ownerUserId, taskId: deckId, eventType: "reserve", amount: REGENERATE_SLIDE_AMOUNT, status: "reserved", holdId: reserve.hold_id, idempotencyKey: reserveKey });
    let regenerated;
    try {
      const prompt = this.promptManager.buildRegenerateSlidePrompt({ slide, instruction });
      this.#assertPromptWithinLimit({ operation: "slide_regenerate", prompt });
      this.#recordAiCall({ operation: "slide_regenerate", prompt });
      regenerated = normalizeRegeneratedSlide({ original: slide, regenerated: await this.aiProvider.regenerateSlide(prompt) });
    } catch (error) {
      try {
        await this.billingClient.releaseCredits({ holdId: reserve.hold_id, idempotencyKey: releaseKey });
      } catch (releaseError) {
        await this.#recordBilling({ ownerUserId, taskId: deckId, eventType: "release", amount: "0", status: "release_pending", holdId: reserve.hold_id, idempotencyKey: releaseKey });
        await this.#log({ ownerUserId, action: "billing_release_pending", resourceType: "deck", resourceId: deck.id, metadata: { error: releaseError.message, originalError: error.message, slideId } });
        throw new AppError({
          code: "BILLING_RECONCILIATION_PENDING",
          status: 409,
          message: "Billing reconciliation pending",
          publicDetails: { deck_id: deck.id, slide_id: slideId, retryable: false },
        });
      }
      await this.#recordBilling({ ownerUserId, taskId: deckId, eventType: "release", amount: "0", status: "released", holdId: reserve.hold_id, idempotencyKey: releaseKey });
      await this.#log({ ownerUserId, action: "slide_regeneration_failed", resourceType: "deck", resourceId: deck.id, metadata: { error: error.message } });
      throw new AppError({ code: "AI_PROVIDER_FAILED", status: 502, message: `AI_PROVIDER_FAILED: ${error.message}` });
    }
    const slides = deck.slides.map((item) => (item === slide ? regenerated : item));
    try {
      await this.billingClient.settleCredits({
        holdId: reserve.hold_id,
        actualAmount: REGENERATE_SLIDE_AMOUNT,
        idempotencyKey: settleKey,
      });
    } catch (error) {
      await this.database.update("decks", deck.id, { slides, status: "billing_pending" });
      await this.#recordBilling({ ownerUserId, taskId: deckId, eventType: "settle", amount: REGENERATE_SLIDE_AMOUNT, status: "settle_pending", holdId: reserve.hold_id, idempotencyKey: settleKey });
      await this.#log({ ownerUserId, action: "billing_settle_pending", resourceType: "deck", resourceId: deck.id, metadata: { error: error.message, slideId } });
      throw new AppError({
        code: "BILLING_RECONCILIATION_PENDING",
        status: 409,
        message: "Billing reconciliation pending",
        publicDetails: { deck_id: deck.id, slide_id: slideId, retryable: false },
      });
    }
    await this.#recordBilling({ ownerUserId, taskId: deckId, eventType: "settle", amount: REGENERATE_SLIDE_AMOUNT, status: "settled", holdId: reserve.hold_id, idempotencyKey: settleKey });
    const updatedDeck = await this.database.update("decks", deck.id, { slides, status: "ready" });
    await this.#log({ ownerUserId, action: "slide_regenerated", resourceType: "deck", resourceId: deck.id });
    return { deck: updatedDeck, slide: regenerated };
  }

  /**
   * Renders a simple online preview.
   * @param {{ownerUserId: number, deckId: string}} input
   * @returns {Promise<string>}
   */
  async previewDeck({ ownerUserId, deckId }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    assertDeckReady(deck);
    if (this.pptPreviewRenderer) {
      const pptx = this.exporter.exportDeck({ deck, format: "pptx" });
      const rendered = await this.pptPreviewRenderer.render({
        deck,
        pptx: pptx.content,
        fileName: pptx.fileName,
      });
      if (rendered) return rendered;
    }
    const visual = resolveTemplateVisual({
      templateId: deck.templateId,
      theme: deck.theme,
      template: { id: deck.templateId, name: deck.templateName, visual: deck.templateVisual },
    });
    return renderDeckPreview({ deck, visual });
  }

  /**
   * Exports a deck and stores the generated file.
   * @param {{ownerUserId: number, deckId: string, format: string}} input
   * @returns {Promise<object>}
   */
  async exportDeck({ ownerUserId, deckId, format }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    assertDeckReady(deck);
    const asset = await this.#getActiveAssetForDeck({ ownerUserId, deckId });
    const exportPayload = this.exporter.exportDeck({ deck, format });
    const file = await this.storage.upload({
      ownerUserId,
      fileName: exportPayload.fileName,
      mimeType: exportPayload.mimeType,
      content: exportPayload.content,
      fileRole: format === "pptx" ? "generated_pptx" : "generated_pdf",
      visibility: "private",
      assetId: asset.id,
      deckId,
    });
    await this.#log({ ownerUserId, action: `deck_exported_${format}`, resourceType: "file", resourceId: file.id });
    return { file };
  }

  /**
   * Lists call logs for an owner.
   * @param {{ownerUserId: number}} input
   * @returns {Promise<object[]>}
   */
  async listLogs({ ownerUserId }) {
    return this.database.find("call_logs", (log) => Number(log.ownerUserId) === Number(ownerUserId));
  }

  /**
   * Reads uploaded document text.
   * @param {{sourceFileId: string, ownerUserId: number}} input
   * @returns {Promise<string>}
   */
  async #readDocumentText({ sourceFileId, ownerUserId }) {
    const downloaded = await this.storage.download({ fileId: sourceFileId, ownerUserId });
    return downloaded.content.toString("utf8");
  }

  /**
   * Ensures enough balance before expensive work.
   * @param {{ownerUserId: number, entitlementId: number, amount: string}} input
   * @returns {Promise<void>}
   */
  async #ensureBalance({ ownerUserId, entitlementId, amount }) {
    const balance = await this.billingClient.getBalance({ userId: ownerUserId, entitlementId });
    const remaining = Number(balance?.remaining);
    const usable = isEntitlementUsable(balance);
    if (!usable || !Number.isFinite(remaining) || remaining < Number(amount)) {
      const isBlockedByStatus = !usable;
      throw new AppError({
        code: isBlockedByStatus ? "ENTITLEMENT_NOT_USABLE" : "INSUFFICIENT_CREDITS",
        status: isBlockedByStatus ? 403 : 402,
        message: isBlockedByStatus ? "Entitlement is not usable" : "Insufficient credits",
        publicDetails: { entitlement_id: entitlementId, required_amount: amount, balance },
      });
    }
  }

  /**
   * Reserves generation credits and maps platform credit errors into product errors.
   * @param {{ownerUserId: number, entitlementId: number, idempotencyKey: string}} input
   * @returns {Promise<object>}
   */
  async #reserveGenerationCredits({ ownerUserId, entitlementId, idempotencyKey }) {
    try {
      return await this.billingClient.reserveCredits({
        userId: ownerUserId,
        entitlementId,
        amount: GENERATE_AMOUNT,
        idempotencyKey,
      });
    } catch (error) {
      if (String(error?.code) === "60005") {
        throw new AppError({
          code: "INSUFFICIENT_CREDITS",
          status: 402,
          message: "Insufficient credits",
          publicDetails: { entitlement_id: entitlementId, required_amount: GENERATE_AMOUNT },
        });
      }
      throw error;
    }
  }

  /**
   * Generates schema-valid slide JSON, retrying provider shape errors once and falling back to outline content.
   * @param {{prompt: object, outline: object, template: object}} input
   * @returns {Promise<object[]>}
   */
  async #generateValidSlides({ prompt, outline, template }) {
    let lastError;
    for (let attempt = 1; attempt <= SLIDE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      try {
        this.#recordAiCall({ operation: attempt === 1 ? "deck" : "deck_retry", prompt });
        const slides = await this.aiProvider.generateSlides(
          attempt === 1
            ? prompt
            : {
              ...prompt,
              validation: {
                retry: true,
                reason: lastError.message,
              },
            },
        );
        return normalizeGeneratedSlides({ slides, outline, template });
      } catch (error) {
        if (!isSlideSchemaError(error)) throw error;
        lastError = error;
      }
    }
    return buildFallbackSlides({ outline, template });
  }

  /**
   * Ensures the owner has capacity for one more active PPT asset before paid generation.
   * @param {{ownerUserId: number}} input
   * @returns {Promise<void>}
   */
  async #ensureAssetQuota({ ownerUserId }) {
    const activeCount = (await this.database.find("ppt_assets", (asset) => (
      Number(asset.ownerUserId) === Number(ownerUserId) && asset.status === "active"
    ))).length;
    if (activeCount >= MAX_ACTIVE_PPT_ASSETS) {
      throw new AppError({
        code: "PPT_ASSET_LIMIT_REACHED",
        status: 409,
        message: "PPT asset limit reached",
        publicDetails: { limit: MAX_ACTIVE_PPT_ASSETS, active_count: activeCount },
      });
    }
  }

  /**
   * Creates an active PPT asset for a newly ready deck.
   * @param {{deck: object, outline?: object}} input
   * @returns {Promise<object>}
   */
  async #createAssetForDeck({ deck, outline }) {
    const existing = await this.database.findOne("ppt_assets", (asset) => asset.deckId === deck.id && asset.status === "active");
    if (existing) return existing;
    return this.database.insert("ppt_assets", {
      ownerUserId: deck.ownerUserId,
      deckId: deck.id,
      outlineId: deck.outlineId,
      title: deck.title,
      status: "active",
      slideCount: Array.isArray(deck.slides) ? deck.slides.length : 0,
      templateId: deck.templateId,
      templateName: deck.templateName,
      theme: deck.theme,
      topic: outline?.topic || deck.title,
      sourceType: outline?.input?.sourceFileId ? "document" : "topic",
    });
  }

  /**
   * Creates an asset after billing reconciliation makes a deck ready.
   * @param {{ownerUserId: number, deckId: string}} input
   * @returns {Promise<object | null>}
   */
  async #createAssetForReadyDeck({ ownerUserId, deckId }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    if (deck.status !== "ready") return null;
    const outline = await this.database.findOne("outlines", (item) => item.id === deck.outlineId && Number(item.ownerUserId) === Number(ownerUserId));
    return this.#createAssetForDeck({ deck, outline });
  }

  /**
   * Returns an active owner-scoped PPT asset.
   * @param {{ownerUserId: number, assetId: string}} input
   * @returns {Promise<object>}
   */
  async #getOwnedActiveAsset({ ownerUserId, assetId }) {
    const asset = await this.database.findOne("ppt_assets", (item) => (
      item.id === assetId && Number(item.ownerUserId) === Number(ownerUserId) && item.status === "active"
    ));
    if (!asset) throw new AppError({ code: "ASSET_NOT_FOUND", status: 404, message: "Asset not found" });
    return asset;
  }

  /**
   * Returns an active asset for a ready deck before export.
   * @param {{ownerUserId: number, deckId: string}} input
   * @returns {Promise<object>}
   */
  async #getActiveAssetForDeck({ ownerUserId, deckId }) {
    const asset = await this.database.findOne("ppt_assets", (item) => (
      item.deckId === deckId && Number(item.ownerUserId) === Number(ownerUserId) && item.status === "active"
    ));
    if (!asset) throw new AppError({ code: "ASSET_NOT_FOUND", status: 404, message: "Asset not found" });
    return asset;
  }

  /**
   * Marks all generated files for a deleted asset inaccessible.
   * @param {{ownerUserId: number, assetId: string}} input
   * @returns {Promise<void>}
   */
  async #deleteAssetFiles({ ownerUserId, assetId }) {
    let objects;
    try {
      objects = await this.database.find("storage_objects", (item) => (
        item.assetId === assetId && Number(item.ownerUserId) === Number(ownerUserId) && item.status === "available"
      ));
    } catch (error) {
      if (error?.code === "DATABASE_NOT_INITIALIZED") return;
      throw error;
    }
    for (const object of objects) {
      await this.database.update("storage_objects", object.id, {
        status: "deleted",
        deleted_at: new Date().toISOString(),
      });
      if (object.fileId) {
        try {
          await this.database.update("files", object.fileId, {
            status: "deleted",
            deleted_at: new Date().toISOString(),
          });
        } catch (error) {
          if (error?.code !== "NOT_FOUND") throw error;
        }
      }
    }
  }

  /**
   * Returns an owner-scoped record.
   * @param {string} collection
   * @param {string} id
   * @param {number} ownerUserId
   * @param {string} errorCode
   * @returns {Promise<object>}
   */
  async #getOwned(collection, id, ownerUserId, errorCode) {
    const record = await this.database.findOne(collection, (item) => item.id === id && Number(item.ownerUserId) === Number(ownerUserId));
    if (!record) throw new AppError({ code: errorCode, status: 404, message: `${errorCode}: record not found` });
    return record;
  }

  /**
   * Records a billing event.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async #recordBilling(input) {
    return this.database.insert("billing_events", input);
  }

  /**
   * Records a user-visible call log.
   * @param {{ownerUserId: number, action: string, resourceType: string, resourceId: string, metadata?: object}} input
   * @returns {Promise<object>}
   */
  async #log(input) {
    return this.database.insert("call_logs", input);
  }

  /**
   * Blocks duplicate generation for one user's outline before quota and credits can be consumed twice.
   * @param {{ownerUserId: number, outlineId: string}} input
   * @returns {Promise<{release: () => void}>}
   */
  async #acquireGenerationLock({ ownerUserId, outlineId }) {
    const lockKey = `${ownerUserId}:${outlineId}`;
    if (this.generationLocks.has(lockKey)) {
      throw new AppError({
        code: "GENERATION_ALREADY_RUNNING",
        status: 409,
        message: "Generation is already running for this outline",
      });
    }
    this.generationLocks.add(lockKey);
    let databaseLock;
    try {
      if (typeof this.database.acquireLock === "function") {
        databaseLock = await this.database.acquireLock(`ppt-generation:${lockKey}`);
        if (!databaseLock) {
          this.generationLocks.delete(lockKey);
          throw new AppError({
            code: "GENERATION_ALREADY_RUNNING",
            status: 409,
            message: "Generation is already running for this outline",
          });
        }
      }
      const activeTask = await this.database.findOne("generation_tasks", (task) => (
        Number(task.ownerUserId) === Number(ownerUserId)
          && task.outlineId === outlineId
          && RUNNING_GENERATION_STATUSES.has(task.status)
      ));
      if (activeTask) {
        if (isStaleRunningGeneration(activeTask)) {
          // 只回收超时的 running 任务；结算/释放挂起仍要阻止新任务，避免扣费状态被绕过。
          await this.database.update("generation_tasks", activeTask.id, {
            status: "failed",
            progress: 100,
            retryable: true,
            errorCode: "GENERATION_STALE",
            errorMessage: "Generation task timed out and was released for retry",
          });
          await this.#log({
            ownerUserId,
            action: "deck_generation_stale_released",
            resourceType: "task",
            resourceId: activeTask.id,
            metadata: { outlineId },
          });
        } else {
          this.generationLocks.delete(lockKey);
          await databaseLock?.release?.();
          throw new AppError({
            code: "GENERATION_ALREADY_RUNNING",
            status: 409,
            message: "Generation is already running for this outline",
            publicDetails: { task_id: activeTask.id },
          });
        }
      }
    } catch (error) {
      if (error?.code !== "GENERATION_ALREADY_RUNNING") this.generationLocks.delete(lockKey);
      if (error?.code !== "GENERATION_ALREADY_RUNNING") await databaseLock?.release?.();
      throw error;
    }
    return {
      release: async () => {
        this.generationLocks.delete(lockKey);
        await databaseLock?.release?.();
      },
    };
  }

  /**
   * Rejects prompts that would exceed the configured cost guard.
   * @param {{operation: string, prompt: object}} input
   * @returns {void}
   */
  #assertPromptWithinLimit({ operation, prompt }) {
    const promptChars = JSON.stringify(prompt).length;
    this.metrics?.observe?.("llm_prompt_chars", { operation }, promptChars);
    if (promptChars > MAX_PROMPT_CHARS) {
      this.metrics?.increment?.("alerts_total", { type: "prompt_too_long", operation });
      throw new AppError({
        code: "PROMPT_TOO_LONG",
        status: 400,
        message: "Prompt is too long",
        publicDetails: { max_chars: MAX_PROMPT_CHARS, prompt_chars: promptChars },
      });
    }
  }

  /**
   * Records an outbound model call for cost and volume monitoring.
   * @param {{operation: string, prompt: object}} input
   * @returns {void}
   */
  #recordAiCall({ operation, prompt }) {
    this.metrics?.increment?.("llm_calls_total", { operation });
    this.metrics?.increment?.("llm_prompt_chars_total", { operation }, JSON.stringify(prompt).length);
  }
}

/**
 * Escapes HTML preview text.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Renders an HTML deck preview using the selected template visuals.
 * @param {{deck: object, visual: object}} input
 * @returns {string}
 */
function renderDeckPreview({ deck, visual }) {
  const slides = deck.slides.map((slide, index) => {
    const isDomeLayout = visual.layout === "red-gold";
    const domeRole = resolvePreviewDomeRole(slide, index, deck.slides.length);
    // dome 模板允许任意页显式声明封面/结束版式，预览 class 必须跟随角色才能套用帆船背景。
    const slideKind = isDomeLayout && ["cover", "closing"].includes(domeRole) ? "cover" : index === 0 ? "cover" : "content";
    const renderBodyList = shouldRenderDomePreviewBodyList(visual, domeRole);
    const bullets = renderBodyList
      ? (slide.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")
      : "";
    // dome 模板化页面的内容已经落入专用视觉层，不输出空 ul，避免预览层级和间距被普通列表干扰。
    const topBandTitleClass = visual.layout === "top-band"
      ? (index === 0 ? "top-band-cover-title" : "top-band-content-title")
      : "";
    const bodyList = renderBodyList
      ? visual.layout === "top-band"
        ? `<ul class="${index === 0 ? "top-band-cover-bullets" : "top-band-content-bullets"}">${bullets}</ul>`
        : `<ul>${bullets}</ul>`
      : "";
    const topBandBrand = "";
    const topBandMark = visual.layout === "top-band"
      ? (
          `${index === 0
            ? '<div class="top-band-cover-glow"></div><div class="top-band-cover-kicker">高管汇报</div><div class="top-band-cover-frame"></div><div class="top-band-cover-sheen"></div><div class="top-band-cover-beacon"></div><div class="top-band-cover-metrics"><span><strong>01</strong>战略</span><span><strong>02</strong>复盘</span><span><strong>03</strong>行动</span></div>'
            : '<div class="top-band-content-rail"></div><div class="top-band-content-wave"></div><div class="top-band-content-trace"></div><div class="top-band-insight-card"><strong>重点关注</strong><span>高管决策视图</span></div>'}`
          + '<div class="top-band-ribbon"></div><div class="top-band-edge"></div>'
          + `<span class="top-band-page-chip">${String(index + 1).padStart(2, "0")}</span>`
          + `${index === 0 ? '<span class="top-band-cover-label">Cover</span>' : '<div class="top-band-content-rule"></div>'}`
          + '<div class="top-band-soft-grid"></div>'
        )
      : "";
    const statusReportScene = visual.layout === "status-report" ? statusReportPreviewScene(visual) : null;
    const strategyScene = isStrategyConsultingVisual(visual) ? strategyConsultingPreviewScene(visual) : null;
    const financeScene = isFinancialReviewVisual(visual) ? financialReviewPreviewScene(visual) : null;
    const salesScene = isSalesProposalVisual(visual) ? salesProposalPreviewScene(visual) : null;
    const productScene = isProductRoadmapVisual(visual) ? productRoadmapPreviewScene(visual) : null;
    const pitchScene = isPitchDeckVisual(visual) ? pitchDeckPreviewScene(visual) : null;
    const marketingScene = isMarketingCampaignVisual(visual) ? marketingCampaignPreviewScene(visual) : null;
    const brandStoryScene = isBrandStoryVisual(visual) ? brandStoryPreviewScene(visual) : null;
    const dataInsightScene = isDataInsightVisual(visual) ? dataInsightPreviewScene(visual) : null;
    const educationScene = isEducationCourseVisual(visual) ? educationCoursePreviewScene(visual) : null;
    const statusReportMark = statusReportScene
      ? (
          `${index === 0
            ? `<div class="status-report-kicker">${escapeHtml(statusReportScene.kicker)}</div><div class="status-report-hero-panel"></div><div class="status-report-metrics">${statusReportScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="status-report-section">${escapeHtml(statusReportScene.section)}</div><div class="status-report-checklist"><span></span><span></span><span></span></div>`}`
          + `<div class="status-report-sticker">${escapeHtml(statusReportScene.sticker)}</div><div class="status-report-photo"></div><div class="status-report-photo-frame"></div><div class="status-report-timeline"><span></span><span></span><span></span><span></span></div><div class="status-report-corner"></div>`
        )
      : "";
    const strategyMark = strategyScene
      ? `<div class="strategy-photo"></div><div class="strategy-photo-frame"></div><div class="strategy-label">${escapeHtml(strategyScene.label)}</div><div class="strategy-chip">${escapeHtml(strategyScene.chip)}</div>`
      : "";
    const financeMark = financeScene
      ? `<div class="finance-label">${escapeHtml(financeScene.label)}</div><div class="finance-visual" data-finance-kind="${escapeHtml(financeScene.variant)}"><span></span><span></span><span></span><span></span></div><div class="finance-chip">${escapeHtml(financeScene.chip)}</div>`
      : "";
    const salesMark = salesScene
      ? `<div class="sales-label">${escapeHtml(salesScene.label)}</div><div class="sales-visual"><span></span><span></span><span></span><span></span></div><div class="sales-chip">${escapeHtml(salesScene.chip)}</div><div class="sales-caption">${escapeHtml(salesScene.caption)}</div>`
      : "";
    const productMark = productScene
      ? `<div class="product-label">${escapeHtml(productScene.label)}</div><div class="product-chip">${escapeHtml(productScene.chip)}</div><div class="product-visual"><span></span><span></span><span></span><span></span></div><div class="product-caption">${escapeHtml(productScene.caption)}</div>`
      : "";
    const pitchMark = pitchScene
      ? (
          `${index === 0
            ? `<div class="pitch-kicker">${escapeHtml(pitchScene.kicker)}</div><div class="pitch-metrics">${pitchScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="pitch-kicker">${escapeHtml(pitchScene.section)}</div><div class="pitch-proof-row"><span></span><span></span><span></span></div>`}`
          + `<div class="pitch-chip">${escapeHtml(pitchScene.chip)}</div><div class="pitch-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="pitch-caption">${escapeHtml(pitchScene.caption)}</div><div class="pitch-arc"></div>`
        )
      : "";
    const marketingMark = marketingScene
      ? (
          `${index === 0
            ? `<div class="marketing-kicker">${escapeHtml(marketingScene.kicker)}</div><div class="marketing-hero-spotlight"></div><div class="marketing-metrics">${marketingScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="marketing-kicker">${escapeHtml(marketingScene.section)}</div><div class="marketing-channel-row"><span></span><span></span><span></span></div>`}`
          + `<div class="marketing-chip">${escapeHtml(marketingScene.chip)}</div><div class="marketing-visual"><span></span><span></span><span></span><span></span></div><div class="marketing-caption">${escapeHtml(marketingScene.caption)}</div><div class="marketing-orbit"></div>`
        )
      : "";
    const brandStoryMark = brandStoryScene
      ? (
          `${index === 0
            ? `<div class="brand-story-kicker">${escapeHtml(brandStoryScene.kicker)}</div><div class="brand-story-editorial-rule"></div><div class="brand-story-points">${brandStoryScene.points.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>`
            : `<div class="brand-story-kicker">${escapeHtml(brandStoryScene.section)}</div><div class="brand-story-content-index"><span>01</span><span>02</span><span>03</span></div>`}`
          + `<div class="brand-story-chip">${escapeHtml(brandStoryScene.chip)}</div><div class="brand-story-image"><span></span><span></span><span></span><span></span><span></span></div><div class="brand-story-caption">${escapeHtml(brandStoryScene.caption)}</div><div class="brand-story-monogram">${escapeHtml(brandStoryScene.mark)}</div>`
        )
      : "";
    const dataInsightMark = dataInsightScene
      ? (
          `${index === 0
            ? `<div class="data-insight-kicker">${escapeHtml(dataInsightScene.kicker)}</div><div class="data-insight-hero-grid"><span><strong>${escapeHtml(dataInsightScene.metrics[0].value)}</strong>${escapeHtml(dataInsightScene.metrics[0].label)}</span><span><strong>${escapeHtml(dataInsightScene.metrics[1].value)}</strong>${escapeHtml(dataInsightScene.metrics[1].label)}</span><span><strong>${escapeHtml(dataInsightScene.metrics[2].value)}</strong>${escapeHtml(dataInsightScene.metrics[2].label)}</span></div>`
            : `<div class="data-insight-kicker">${escapeHtml(dataInsightScene.section)}</div><div class="data-insight-mini-row"><span></span><span></span><span></span></div>`}`
          + `<div class="data-insight-chip">${escapeHtml(dataInsightScene.chip)}</div><div class="data-insight-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="data-insight-caption">${escapeHtml(dataInsightScene.caption)}</div><div class="data-insight-scanline"></div>`
        )
      : "";
    const educationMark = educationScene
      ? (
          `${index === 0
            ? `<div class="education-kicker">${escapeHtml(educationScene.kicker)}</div><div class="education-outcomes">${educationScene.outcomes.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
            : `<div class="education-kicker">${escapeHtml(educationScene.section)}</div><div class="education-note-row"><span></span><span></span><span></span></div>`}`
          + `<div class="education-chip">${escapeHtml(educationScene.chip)}</div><div class="education-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="education-caption">${escapeHtml(educationScene.caption)}</div>`
        )
      : "";
    const topBandHeadingClass = topBandTitleClass ? ` class="${topBandTitleClass}"` : "";
    const domeChrome = isDomeLayout
      ? `<div class="dome-role-decor dome-canvas-frame"></div>${renderDomePreviewContentFrame(domeRole)}${renderDomePreviewContentSurface(domeRole)}${renderDomePreviewDecoration(domeRole, slide, index)}${renderDomePreviewWaves(visual)}${renderDomePreviewFooter(visual)}`
      : "";
    return `<article class="preview-page" aria-label="第 ${index + 1} 页"><div class="slide slide-${slideKind}" data-dome-role="${escapeHtml(domeRole)}" data-status-variant="${escapeHtml(statusReportScene?.variant || "")}" data-template-variant="${escapeHtml(strategyScene?.variant || financeScene?.variant || salesScene?.variant || productScene?.variant || pitchScene?.variant || marketingScene?.variant || brandStoryScene?.variant || dataInsightScene?.variant || educationScene?.variant || "")}"><div class="accent"></div><div class="motif"></div><div class="top-band-brand">${topBandBrand}</div>${topBandMark}${statusReportMark}${strategyMark}${financeMark}${salesMark}${productMark}${pitchMark}${marketingMark}${brandStoryMark}${dataInsightMark}${educationMark}${domeChrome}<div class="slide-content"><h2${topBandHeadingClass}>${escapeHtml(slide.title)}</h2>${bodyList}</div><div class="page-number">${index + 1} / ${deck.slides.length}</div></div></article>`;
  }).join("");
  const domePreviewVars = visual.layout === "red-gold" ? redGoldPreviewVars(visual) : "";
  const statusReportVars = visual.layout === "status-report" ? statusReportPreviewVars(visual) : "";
  const strategyPreviewVars = isStrategyConsultingVisual(visual) ? strategyConsultingPreviewVars(visual) : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title)}</title><style>
    :root{--template-primary:#${visual.primary};--template-accent:#${visual.accent};--template-bg:#${visual.background};--template-surface:#${visual.surface};--template-title:#${visual.title};--template-body:#${visual.body};${domePreviewVars}${statusReportVars}${strategyPreviewVars}}
    *{box-sizing:border-box} html{background:var(--template-bg);} body{margin:0;padding:28px;background:linear-gradient(135deg,var(--template-bg),#ffffff 58%,var(--template-bg));color:var(--template-body);font-family:Arial,"Microsoft YaHei",sans-serif;}
    main{display:grid;gap:34px;width:min(100%,1120px);margin:0 auto;}
    .preview-page{display:grid;gap:10px;}
    .slide{position:relative;width:100%;aspect-ratio:16/9;min-height:0;overflow:hidden;background:var(--template-surface);border:1px solid rgba(15,23,42,.08);box-shadow:0 18px 50px rgba(15,23,42,.12);padding:6.5% 7.4%;}
    .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(15,23,42,.028) 0 1px,transparent 1px 34px),linear-gradient(135deg,rgba(255,255,255,.72),rgba(255,255,255,.12));pointer-events:none;}
    .slide-content{position:relative;z-index:2;display:grid;align-content:start;width:100%;height:100%;min-width:0;}
    .slide-content>*{position:relative;z-index:2;}
    .motif{display:none;position:absolute;z-index:1;pointer-events:none;}
    .accent{position:absolute;background:var(--template-primary);left:0;top:0;right:0;height:3.2%;}
    h2{position:relative;margin:0 0 3.8%;color:var(--template-title);font-size:42px;line-height:1.14;letter-spacing:0;overflow-wrap:anywhere;}
    ul{position:relative;margin:0;padding-left:1.25em;font-size:22px;line-height:1.55;max-width:82%;overflow-wrap:anywhere;}
    li::marker{color:var(--template-accent);}
    .page-number{position:absolute;right:3.2%;bottom:3.2%;color:rgba(15,23,42,.48);font-size:12px;font-weight:700;}
    body[data-layout="left-rail"] .accent{right:auto;bottom:0;width:2.6%;height:auto;}
    body[data-layout="left-rail"] .slide{padding-left:9.2%;}
    body[data-layout="hero"] .slide-cover{padding-top:10.8%;background:linear-gradient(135deg,var(--template-bg),var(--template-surface));}
    body[data-layout="hero"] .slide-cover h2{font-size:54px;max-width:82%;}
    body[data-layout="hero"] .slide-cover .accent{height:4.2%;background:var(--template-accent);}
    body[data-layout="top-band"] .slide{background:linear-gradient(135deg,color-mix(in srgb,var(--template-bg) 92%, #ffffff 8%),#ffffff 54%,color-mix(in srgb,var(--template-bg) 78%, var(--template-primary) 22%));padding:7.8% 7% 6.9% 7.4%;border:0;}
    body[data-layout="top-band"] .slide::before{content:"";position:absolute;inset:2.35% 2.45% 3.05%;border:1px solid color-mix(in srgb,var(--template-primary) 22%, transparent);border-radius:14px;box-shadow:0 16px 40px rgba(15,23,42,.12);background:linear-gradient(135deg,rgba(255,255,255,.62),rgba(255,255,255,.18));}
    body[data-layout="top-band"] .slide::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(15,23,42,.035) 0 1px,transparent 1px 56px),repeating-linear-gradient(0deg,rgba(15,23,42,.022) 0 1px,transparent 1px 42px);mask-image:linear-gradient(90deg,transparent 0%,#000 12%,#000 88%,transparent 100%);opacity:.8;pointer-events:none;}
    body[data-layout="top-band"] .accent{left:0;right:auto;width:2.15%;height:100%;top:0;background:linear-gradient(180deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 72%, var(--template-accent) 28%) 58%,var(--template-title));box-shadow:inset -2px 0 0 color-mix(in srgb,var(--template-accent) 65%, transparent);opacity:.98;}
    body[data-layout="top-band"] .motif{display:block;left:2.65%;top:48%;width:0.6%;height:43%;transform:translateY(-50%);border-radius:999px;background:linear-gradient(180deg,var(--template-accent),color-mix(in srgb,var(--template-primary) 50%,var(--template-accent) 50%));opacity:.78;}
    body[data-layout="top-band"] .slide-content{align-content:start;justify-content:start;padding-right:22%;min-height:100%;}
    body[data-layout="top-band"] .slide[data-dome-role="cover"] .slide-content{padding-top:3.1%;padding-right:26%;}
    body[data-layout="top-band"] .slide[data-dome-role="cover"] h2{max-width:72%;margin-top:1.2%;font-size:50px;line-height:1.06;}
    body[data-layout="top-band"] .top-band-brand{position:absolute;left:13px;top:12px;z-index:3;color:color-mix(in srgb,var(--template-title) 36%, var(--template-bg) 64%);font-size:10px;letter-spacing:0.18em;font-weight:700;text-transform:uppercase;opacity:.82;}
    body[data-layout="top-band"] .top-band-ribbon{position:absolute;right:-5%;top:12%;width:54%;height:18%;background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--template-primary) 20%,transparent) 38%,color-mix(in srgb,var(--template-accent) 42%,transparent) 72%,transparent);transform:skewX(-10deg);opacity:.38;z-index:1;}
    body[data-layout="top-band"] .top-band-edge{display:block;position:absolute;right:5.4%;top:14.4%;width:1px;height:70%;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--template-primary) 34%,transparent),transparent);z-index:2;}
    body[data-layout="top-band"] .top-band-soft-grid{display:block;position:absolute;left:6.2%;right:6.2%;bottom:6.8%;height:16%;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--template-primary) 10%,transparent) 0 1px,transparent 1px 38px);opacity:.5;z-index:1;}
    body[data-layout="top-band"] .top-band-cover-frame{position:absolute;left:4.4%;top:14.2%;right:7.4%;bottom:10.8%;border:1px solid color-mix(in srgb,var(--template-primary) 20%, transparent);z-index:1;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.32),rgba(255,255,255,.06));box-shadow:inset 0 0 0 1px rgba(255,255,255,.46);}
    body[data-layout="top-band"] .top-band-cover-sheen{position:absolute;left:4.6%;top:17%;right:7.6%;height:28%;background:linear-gradient(180deg,rgba(255,255,255,.46),transparent);opacity:.72;z-index:1;border-radius:14px;}
    body[data-layout="top-band"] .top-band-cover-beacon{display:block;position:absolute;right:9.5%;top:24%;width:17%;height:48%;border-radius:18px;background:linear-gradient(160deg,color-mix(in srgb,var(--template-primary) 90%,#ffffff 10%),color-mix(in srgb,var(--template-title) 72%,var(--template-primary) 28%));box-shadow:0 22px 48px rgba(15,23,42,.20);z-index:2;}
    body[data-layout="top-band"] .top-band-cover-beacon::before{content:"";position:absolute;inset:10% 12%;border:1px solid rgba(255,255,255,.25);border-radius:14px;}
    body[data-layout="top-band"] .top-band-cover-beacon::after{content:"";position:absolute;left:18%;right:18%;bottom:18%;height:4px;border-radius:999px;background:var(--template-accent);}
    body[data-layout="top-band"] .top-band-cover-metrics{position:absolute;left:10.6%;right:31%;bottom:16.2%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;z-index:3;}
    body[data-layout="top-band"] .top-band-cover-metrics span{min-height:58px;border-radius:10px;background:rgba(255,255,255,.78);border:1px solid color-mix(in srgb,var(--template-primary) 13%,transparent);box-shadow:0 10px 24px rgba(15,23,42,.10);display:grid;align-content:center;gap:2px;padding:0 14px;color:var(--template-body);font-size:11px;font-weight:700;}
    body[data-layout="top-band"] .top-band-cover-metrics strong{font-size:18px;color:var(--template-title);line-height:1;}
    body[data-layout="top-band"] .top-band-content-rail{position:absolute;left:3.8%;top:19%;width:2px;height:68%;background:linear-gradient(180deg,transparent,var(--template-accent),var(--template-primary),transparent);z-index:2;}
    body[data-layout="top-band"] .top-band-content-wave{display:block;position:absolute;right:8%;bottom:12%;width:27%;height:19%;border-radius:50%;border-top:5px solid color-mix(in srgb,var(--template-accent) 72%,transparent);opacity:.56;z-index:1;}
    body[data-layout="top-band"] .top-band-content-trace{display:block;position:absolute;right:9.5%;top:25%;width:12%;height:42%;border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--template-primary) 88%,#ffffff 12%),color-mix(in srgb,var(--template-title) 72%,var(--template-primary) 28%));box-shadow:0 18px 36px rgba(15,23,42,.16);z-index:1;}
    body[data-layout="top-band"] .top-band-insight-card{position:absolute;right:10.5%;top:31%;width:15.5%;min-height:25%;border-radius:12px;background:rgba(255,255,255,.80);border:1px solid color-mix(in srgb,var(--template-primary) 14%,transparent);box-shadow:0 12px 28px rgba(15,23,42,.12);padding:16px 14px;display:grid;align-content:center;gap:8px;z-index:3;color:var(--template-body);}
    body[data-layout="top-band"] .top-band-insight-card strong{font-size:13px;color:var(--template-title);}
    body[data-layout="top-band"] .top-band-insight-card span{font-size:11px;line-height:1.35;}
    body[data-layout="top-band"] .top-band-page-chip{left:14px;top:17.5%;height:34px;min-width:43px;padding:0 10px;display:grid;place-items:center;border-radius:999px;background:rgba(15,23,42,.10);font-size:11px;font-weight:800;color:var(--template-title);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.22);box-shadow:0 6px 18px rgba(15,23,42,.08);}
    body[data-layout="top-band"] .top-band-cover-glow{position:absolute;top:5.8%;left:10%;right:10%;height:7%;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);z-index:1;}
    body[data-layout="top-band"] .top-band-cover-kicker{position:absolute;left:14px;top:3%;z-index:4;font-size:9.5px;font-weight:700;letter-spacing:0.13em;color:color-mix(in srgb,var(--template-title) 46%, transparent);}
    body[data-layout="top-band"] .top-band-cover-label{position:absolute;left:50%;top:19.8%;transform:translateX(-50%);z-index:4;font-size:11px;font-weight:700;letter-spacing:0.06em;color:color-mix(in srgb,var(--template-title) 65%, transparent);}
    body[data-layout="top-band"] .top-band-content-rule{position:absolute;left:8.8%;top:78.8%;width:10%;height:4px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent),transparent);border-radius:999px;opacity:.72;z-index:2;}
    body[data-layout="top-band"] .top-band-cover-title{font-size:42px;line-height:1.12;max-width:62%;}
    body[data-layout="top-band"] .top-band-content-title{font-size:31px;line-height:1.16;max-width:61%;margin-bottom:4.2%;}
    body[data-layout="top-band"] .top-band-cover-bullets{max-width:58%;font-size:18px;line-height:1.52;}
    body[data-layout="top-band"] .top-band-content-bullets{max-width:58%;font-size:15px;line-height:1.56;}
    body[data-layout="top-band"] .page-number{z-index:2;background:rgba(15,23,42,.05);padding:5px 10px;border-radius:999px;border:1px solid rgba(15,23,42,.10);backdrop-filter:blur(3px);}
    body[data-layout="top-band"] h2{max-width:62%;font-size:36px;line-height:1.12;color:var(--template-title);padding-left:5.1%;}
    body[data-layout="top-band"] ul{max-width:58%;font-size:16px;margin-left:5.1%;padding-left:1.06em;line-height:1.56;}
    body[data-layout="status-report"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 56%,color-mix(in srgb,var(--template-bg) 72%,var(--template-primary) 28%));padding:7.2% 8% 6.6%;border:0;}
    body[data-layout="status-report"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(22,61,89,.035) 0 1px,transparent 1px 44px),repeating-linear-gradient(0deg,rgba(42,167,165,.026) 0 1px,transparent 1px 38px);mask-image:linear-gradient(90deg,transparent 0%,#000 10%,#000 92%,transparent 100%);}
    body[data-layout="status-report"] .slide::after{content:"";position:absolute;left:5.4%;top:12.5%;right:5.4%;bottom:10.5%;border-radius:16px;background:rgba(255,255,255,.86);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 18px 44px rgba(15,42,67,.12);}
    body[data-layout="status-report"] .accent{height:11.2%;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 74%,var(--template-accent) 26%));box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="status-report"] .motif{display:block;left:5.4%;top:11%;width:18%;height:3px;border-radius:999px;background:var(--template-accent);opacity:.95;}
    body[data-layout="status-report"] .slide-content{align-content:start;padding:4.4% 35% 0 0;}
    body[data-layout="status-report"] h2{max-width:72%;font-size:42px;line-height:1.12;margin-bottom:3.8%;}
    body[data-layout="status-report"] ul{max-width:70%;font-size:19px;line-height:1.58;padding-left:1.05em;}
    body[data-layout="status-report"] li{padding-left:.2em;margin:.18em 0;}
    body[data-layout="status-report"] .status-report-photo{position:absolute;right:8.4%;top:27%;width:24%;height:32%;z-index:3;border-radius:14px;background-image:linear-gradient(180deg,rgba(16,42,67,.08),rgba(16,42,67,.22)),var(--status-report-image);background-size:cover;background-position:center;box-shadow:0 18px 34px rgba(15,42,67,.20);overflow:hidden;}
    body[data-layout="status-report"] .status-report-photo-frame{position:absolute;right:7.4%;top:25.1%;width:24%;height:32%;z-index:2;border:1px solid color-mix(in srgb,var(--template-accent) 62%,transparent);border-radius:15px;}
    body[data-layout="status-report"] .status-report-corner{position:absolute;right:8.6%;bottom:16.5%;width:8.2%;height:22%;z-index:2;border-radius:12px;background:linear-gradient(180deg,var(--template-accent),color-mix(in srgb,var(--template-accent) 60%,#ffffff 40%));opacity:.9;}
    body[data-layout="status-report"] .status-report-sticker{position:absolute;right:9.8%;top:17%;z-index:4;min-width:86px;height:34px;padding:0 14px;display:grid;place-items:center;border-radius:999px;background:var(--template-accent);color:#fff;font-size:12px;font-weight:900;box-shadow:0 12px 22px rgba(15,42,67,.18);}
    body[data-layout="status-report"] .slide[data-status-variant="steering"] .status-report-sticker{border-radius:8px;background:linear-gradient(135deg,var(--template-accent),color-mix(in srgb,var(--template-primary) 36%,var(--template-accent) 64%));}
    body[data-layout="status-report"] .slide[data-status-variant="steering"] .status-report-corner{width:13%;height:13%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.92) 0 28%,var(--template-accent) 29% 100%);}
    body[data-layout="status-report"] .slide[data-status-variant="delivery"] .status-report-sticker{border-radius:6px 18px 18px 6px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-layout="status-report"] .slide[data-status-variant="delivery"] .status-report-photo{right:7.8%;top:24%;height:36%;border-radius:10px;}
    body[data-layout="status-report"] .slide[data-status-variant="delivery"] .status-report-corner{right:9.8%;bottom:18%;width:14%;height:7%;border-radius:999px;background:var(--template-accent);}
    body[data-layout="status-report"] .status-report-timeline{position:absolute;left:8%;right:8%;bottom:13%;height:22px;z-index:3;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;}
    body[data-layout="status-report"] .status-report-timeline::before{content:"";position:absolute;left:0;right:0;top:50%;height:3px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent),color-mix(in srgb,var(--template-primary) 40%,#ffffff 60%));}
    body[data-layout="status-report"] .status-report-timeline span{position:relative;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid var(--template-accent);box-shadow:0 0 0 5px rgba(42,167,165,.10);}
    body[data-layout="status-report"] .status-report-kicker,.status-report-section{position:absolute;left:8%;top:16%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:800;letter-spacing:.12em;}
    body[data-layout="status-report"] .status-report-hero-panel{position:absolute;right:33.8%;top:20%;width:1px;height:58%;z-index:3;background:linear-gradient(180deg,transparent,var(--template-accent),transparent);}
    body[data-layout="status-report"] .status-report-metrics{position:absolute;left:8%;right:40%;bottom:18%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;z-index:3;}
    body[data-layout="status-report"] .status-report-metrics span{min-height:62px;border-radius:10px;background:rgba(255,255,255,.92);border:1px solid color-mix(in srgb,var(--template-primary) 14%,transparent);box-shadow:0 12px 24px rgba(15,42,67,.09);display:grid;align-content:center;gap:4px;padding:0 16px;font-size:12px;font-weight:700;color:var(--template-body);}
    body[data-layout="status-report"] .status-report-metrics strong{font-size:21px;line-height:1;color:var(--template-title);}
    body[data-layout="status-report"] .status-report-checklist{position:absolute;right:9.8%;top:64%;width:18%;z-index:3;display:grid;gap:9px;}
    body[data-layout="status-report"] .status-report-checklist span{height:9px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 18%,#ffffff 82%));opacity:.78;}
    body[data-layout="status-report"] .status-report-checklist span:nth-child(2){width:78%;}
    body[data-layout="status-report"] .status-report-checklist span:nth-child(3){width:58%;}
    body[data-layout="status-report"] .page-number{z-index:4;color:color-mix(in srgb,var(--template-title) 62%,transparent);background:rgba(255,255,255,.72);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:5px 10px;}
    body[data-layout="executive"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 68%);padding:8.2% 10%;border:0;}
    body[data-layout="executive"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(15,23,42,.026) 0 1px,transparent 1px 38px);}
    body[data-layout="executive"] .slide::after{content:"";position:absolute;inset:12% 6% 10%;background:var(--template-surface);box-shadow:0 18px 46px rgba(15,42,67,.12);}
    body[data-layout="executive"] .accent{height:9.8%;background:var(--template-primary);box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="executive"] .motif{display:block;right:10%;top:25%;width:8.8%;height:42%;border-radius:8px;background:var(--template-accent);opacity:.82;}
    body[data-layout="executive"] h2{max-width:74%;font-size:44px;}
    body[data-template="strategy-consulting"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 62%,color-mix(in srgb,var(--template-primary) 10%,var(--template-bg) 90%));}
    body[data-template="strategy-consulting"] .slide::after{inset:10% 5.8% 9%;border-radius:16px;border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);background:rgba(255,255,255,.91);box-shadow:0 22px 54px rgba(15,23,42,.14);}
    body[data-template="strategy-consulting"] .slide-content{padding:2.2% 34% 0 0;}
    body[data-template="strategy-consulting"] h2{max-width:62%;font-size:30px;line-height:1.14;margin-bottom:4.8%;}
    body[data-template="strategy-consulting"] ul{max-width:55%;font-size:14px;line-height:1.46;}
    body[data-template="strategy-consulting"] li{margin:.12em 0;}
    body[data-template="strategy-consulting"] .strategy-photo{position:absolute;right:9.2%;top:28%;width:22%;height:27%;z-index:3;border-radius:12px;background-image:linear-gradient(180deg,rgba(24,37,58,.04),rgba(24,37,58,.16)),var(--strategy-image);background-size:cover;background-position:center;box-shadow:0 16px 30px rgba(15,23,42,.16);}
    body[data-template="strategy-consulting"] .strategy-photo-frame{position:absolute;right:8.4%;top:26.2%;width:22%;height:27%;z-index:2;border:1px solid color-mix(in srgb,var(--template-accent) 58%,transparent);border-radius:14px;}
    body[data-template="strategy-consulting"] .strategy-label{position:absolute;left:9.2%;top:15.5%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-template="strategy-consulting"] .strategy-chip{position:absolute;right:10.2%;top:17%;z-index:4;min-width:78px;height:30px;padding:0 12px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 64%,var(--template-accent) 36%));color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 20px rgba(15,23,42,.16);}
    body[data-template="strategy-consulting"] .page-number{z-index:5;right:7.5%;bottom:7%;color:color-mix(in srgb,var(--template-title) 74%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-template="strategy-consulting"] .slide[data-template-variant="matrix"] .strategy-photo{right:8.8%;top:30%;width:23%;height:25%;border-radius:10px;}
    body[data-template="strategy-consulting"] .slide[data-template-variant="matrix"] .strategy-chip{border-radius:999px;background:var(--template-accent);}
    body[data-template="strategy-consulting"] .slide[data-template-variant="matrix"] .motif{right:11%;top:64%;width:19%;height:3px;border-radius:999px;}
    body[data-template="strategy-consulting"] .slide[data-template-variant="workstream"] .strategy-photo{right:9%;top:27%;height:28%;border-radius:16px 6px 16px 6px;}
    body[data-template="strategy-consulting"] .slide[data-template-variant="workstream"] .strategy-chip{border-radius:6px 18px 18px 6px;background:linear-gradient(90deg,var(--template-accent),color-mix(in srgb,var(--template-primary) 42%,var(--template-accent) 58%));}
    body[data-template="financial-review"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 60%,color-mix(in srgb,var(--template-accent) 10%,var(--template-bg) 90%));}
    body[data-template="financial-review"] .slide::after{inset:10% 5.6% 9.2%;border-radius:14px;border:1px solid color-mix(in srgb,var(--template-primary) 10%,transparent);background:rgba(255,255,255,.92);box-shadow:0 22px 48px rgba(16,38,57,.12);}
    body[data-template="financial-review"] .slide-content{padding:1.8% 36% 0 0;}
    body[data-template="financial-review"] h2{max-width:61%;font-size:32px;line-height:1.14;margin-bottom:4.4%;}
    body[data-template="financial-review"] ul{max-width:56%;font-size:14.5px;line-height:1.48;}
    body[data-template="financial-review"] .finance-label{position:absolute;left:9.2%;top:15.2%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-template="financial-review"] .finance-chip{position:absolute;right:10.4%;top:17%;z-index:4;min-width:84px;height:30px;display:grid;place-items:center;border-radius:999px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 20px rgba(16,38,57,.14);}
    body[data-template="financial-review"] .finance-visual{position:absolute;right:8.8%;top:28%;width:24%;height:31%;z-index:3;border-radius:14px;background:linear-gradient(135deg,rgba(255,255,255,.92),color-mix(in srgb,var(--template-bg) 74%,#fff 26%));border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 16px 30px rgba(16,38,57,.14);overflow:hidden;}
    body[data-template="financial-review"] .finance-visual::before{content:"";position:absolute;left:9%;right:9%;bottom:17%;height:2px;background:color-mix(in srgb,var(--template-primary) 18%,transparent);}
    body[data-template="financial-review"] .finance-visual span{position:absolute;bottom:20%;width:12%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,var(--template-accent),color-mix(in srgb,var(--template-accent) 52%,var(--template-primary) 48%));}
    body[data-template="financial-review"] .finance-visual span:nth-child(1){left:14%;height:31%;}
    body[data-template="financial-review"] .finance-visual span:nth-child(2){left:34%;height:48%;}
    body[data-template="financial-review"] .finance-visual span:nth-child(3){left:54%;height:38%;}
    body[data-template="financial-review"] .finance-visual span:nth-child(4){left:74%;height:61%;}
    body[data-template="financial-review"] .page-number{z-index:5;right:7.3%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 72%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual{border-radius:8px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 86%,var(--template-accent) 14%));}
    body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual::before{left:12%;right:12%;top:20%;bottom:auto;height:3px;box-shadow:0 34px 0 color-mix(in srgb,var(--template-primary) 16%,transparent),0 68px 0 color-mix(in srgb,var(--template-primary) 16%,transparent);}
    body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual span{width:14px;height:14px;border-radius:50%;bottom:auto;left:13%;background:var(--template-accent);}
    body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual span:nth-child(1){top:18%;}body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual span:nth-child(2){top:38%;}body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual span:nth-child(3){top:58%;}body[data-template="financial-review"] .slide[data-template-variant="audit"] .finance-visual span:nth-child(4){display:none;}
    body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual{border-radius:18px 6px 18px 6px;}
    body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual::after{content:"";position:absolute;left:12%;right:10%;top:30%;height:45%;border-top:4px solid var(--template-accent);border-right:4px solid var(--template-accent);border-radius:60% 40% 0 0;transform:skewX(-12deg);}
    body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual span{width:10px;height:10px;border-radius:50%;bottom:auto;background:var(--template-primary);}
    body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual span:nth-child(1){left:16%;top:58%;}body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual span:nth-child(2){left:38%;top:48%;}body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual span:nth-child(3){left:60%;top:37%;}body[data-template="financial-review"] .slide[data-template-variant="forecast"] .finance-visual span:nth-child(4){left:78%;top:25%;}
    body[data-template="sales-proposal"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 62%,color-mix(in srgb,var(--template-accent) 12%,var(--template-bg) 88%));}
    body[data-template="sales-proposal"] .slide::after{inset:11% 6% 10%;border-radius:16px;background:rgba(255,255,255,.92);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 20px 44px rgba(14,90,87,.12);}
    body[data-template="sales-proposal"] .slide-content{padding:1.8% 37% 0 0;}
    body[data-template="sales-proposal"] h2{max-width:61%;font-size:33px;line-height:1.13;margin-bottom:4.4%;}
    body[data-template="sales-proposal"] ul{max-width:56%;font-size:15px;line-height:1.48;}
    body[data-template="sales-proposal"] .slide-cover{background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 72%,var(--template-bg) 28%) 52%,color-mix(in srgb,var(--template-accent) 38%,var(--template-primary) 62%));}
    body[data-template="sales-proposal"] .slide-cover::before{background:radial-gradient(circle at 74% 28%,color-mix(in srgb,var(--template-accent) 28%,transparent),transparent 28%),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 42px);}
    body[data-template="sales-proposal"] .slide-cover::after{inset:13% 7% 13%;border-radius:22px;background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.76));border:1px solid rgba(255,255,255,.42);box-shadow:0 26px 54px rgba(15,23,42,.24);}
    body[data-template="sales-proposal"] .slide-cover .accent{height:0;}
    body[data-template="sales-proposal"] .slide-cover .slide-content{padding:4.6% 39% 0 2.8%;}
    body[data-template="sales-proposal"] .slide-cover h2{max-width:62%;font-size:39px;line-height:1.08;margin-bottom:5.2%;color:var(--template-title);}
    body[data-template="sales-proposal"] .slide-cover ul{max-width:54%;font-size:15.5px;line-height:1.56;background:rgba(255,255,255,.72);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);border-radius:12px;padding:14px 18px 14px 34px;box-shadow:0 12px 24px rgba(15,23,42,.10);}
    body[data-template="sales-proposal"] .motif{display:none;}
    body[data-template="sales-proposal"] .sales-label{position:absolute;left:9.4%;top:15.4%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-template="sales-proposal"] .sales-chip{position:absolute;right:10.5%;top:17%;z-index:4;min-width:88px;height:30px;display:grid;place-items:center;border-radius:999px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 20px rgba(14,90,87,.16);}
    body[data-template="sales-proposal"] .sales-caption{position:absolute;right:9.4%;top:61.5%;width:23%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-template="sales-proposal"] .sales-visual{position:absolute;right:8.8%;top:28%;width:24%;height:30%;z-index:3;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.94),color-mix(in srgb,var(--template-bg) 74%,#fff 26%));border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 16px 30px rgba(14,90,87,.14);overflow:hidden;}
    body[data-template="sales-proposal"] .slide-cover .sales-label{left:10.6%;top:18%;font-size:13px;color:var(--template-accent);}
    body[data-template="sales-proposal"] .slide-cover .sales-chip{right:11%;top:19%;height:34px;min-width:106px;border-radius:12px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 62%,var(--template-accent) 38%));}
    body[data-template="sales-proposal"] .slide-cover .sales-visual{right:10%;top:30%;width:26.5%;height:35%;border-radius:20px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 78%,#fff 22%));box-shadow:0 24px 42px rgba(15,23,42,.20);}
    body[data-template="sales-proposal"] .slide-cover .sales-caption{right:9%;top:70%;width:29%;font-size:12px;color:var(--template-title);}
    body[data-template="sales-proposal"] .sales-visual::before{content:"";position:absolute;left:12%;right:12%;top:18%;height:26%;border-radius:10px;background:color-mix(in srgb,var(--template-primary) 12%,#fff 88%);}
    body[data-template="sales-proposal"] .sales-visual::after{content:"";position:absolute;left:16%;right:16%;bottom:19%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-template="sales-proposal"] .sales-visual span{position:absolute;border-radius:10px;background:var(--template-accent);}
    body[data-template="sales-proposal"] .sales-visual span:nth-child(1){left:16%;top:24%;width:22%;height:18%;}
    body[data-template="sales-proposal"] .sales-visual span:nth-child(2){left:43%;top:24%;width:22%;height:18%;background:var(--template-primary);}
    body[data-template="sales-proposal"] .sales-visual span:nth-child(3){left:70%;top:24%;width:14%;height:18%;background:color-mix(in srgb,var(--template-accent) 70%,#fff 30%);}
    body[data-template="sales-proposal"] .sales-visual span:nth-child(4){left:20%;bottom:31%;width:60%;height:16%;background:color-mix(in srgb,var(--template-primary) 18%,#fff 82%);}
    body[data-template="sales-proposal"] .page-number{z-index:5;right:7.3%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 72%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual{border-radius:8px;}
    body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual::before{left:40%;right:40%;top:19%;height:62%;border-radius:8px;background:var(--template-primary);}
    body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual::after{left:16%;right:16%;top:49%;bottom:auto;height:3px;background:color-mix(in srgb,var(--template-primary) 28%,transparent);}
    body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual span{width:24%;height:19%;border-radius:9px;}
    body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual span:nth-child(1){left:13%;top:20%;}body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual span:nth-child(2){left:63%;top:20%;}body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual span:nth-child(3){left:13%;top:61%;}body[data-template="sales-proposal"] .slide[data-template-variant="solution"] .sales-visual span:nth-child(4){left:63%;top:61%;background:var(--template-primary);}
    body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual{border-radius:18px 6px 18px 6px;}
    body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual::before{left:13%;right:13%;top:55%;height:3px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 18%,transparent);}
    body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual::after{left:18%;right:16%;top:43%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));transform:rotate(-16deg);}
    body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual span{width:10px;height:10px;border-radius:50%;background:var(--template-primary);}
    body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual span:nth-child(1){left:18%;top:60%;}body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual span:nth-child(2){left:39%;top:52%;}body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual span:nth-child(3){left:60%;top:41%;}body[data-template="sales-proposal"] .slide[data-template-variant="renewal"] .sales-visual span:nth-child(4){left:79%;top:30%;background:var(--template-accent);}
    body[data-template="product-roadmap"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 64%,color-mix(in srgb,var(--template-primary) 11%,var(--template-bg) 89%));padding:7.8% 8.2% 6.8%;border:0;}
    body[data-template="product-roadmap"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--template-primary) 5%,transparent) 0 1px,transparent 1px 44px),radial-gradient(circle at 78% 25%,color-mix(in srgb,var(--template-accent) 20%,transparent),transparent 28%);pointer-events:none;}
    body[data-template="product-roadmap"] .slide::after{content:"";position:absolute;inset:11% 6.2% 10%;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 22px 48px rgba(17,55,70,.12);}
    body[data-template="product-roadmap"] .accent{height:8%;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 68%,var(--template-accent) 32%));box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-template="product-roadmap"] .motif{display:none;}
    body[data-template="product-roadmap"] .slide-content{align-content:start;padding:2.2% 38% 0 0;}
    body[data-template="product-roadmap"] h2{max-width:58%;font-size:34px;line-height:1.12;margin-bottom:4.8%;}
    body[data-template="product-roadmap"] ul{max-width:55%;font-size:15px;line-height:1.52;}
    body[data-template="product-roadmap"] .slide-cover{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 96%,#ffffff 4%),color-mix(in srgb,var(--template-primary) 78%,var(--template-accent) 22%) 58%,var(--template-bg));}
    body[data-template="product-roadmap"] .slide-cover::before{background:radial-gradient(circle at 72% 30%,color-mix(in srgb,var(--template-accent) 34%,transparent),transparent 31%),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 42px);}
    body[data-template="product-roadmap"] .slide-cover::after{inset:13% 7% 13%;border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,255,255,.78));border:1px solid rgba(255,255,255,.42);box-shadow:0 28px 56px rgba(15,23,42,.20);}
    body[data-template="product-roadmap"] .slide-cover .accent{height:0;}
    body[data-template="product-roadmap"] .slide-cover .slide-content{padding:4.8% 41% 0 2.8%;}
    body[data-template="product-roadmap"] .slide-cover h2{max-width:60%;font-size:40px;line-height:1.08;margin-bottom:5.2%;}
    body[data-template="product-roadmap"] .slide-cover ul{max-width:54%;font-size:15.5px;line-height:1.56;background:rgba(255,255,255,.74);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);border-radius:14px;padding:14px 18px 14px 34px;box-shadow:0 12px 24px rgba(15,23,42,.09);}
    body[data-template="product-roadmap"] .product-label{position:absolute;left:9.4%;top:15.4%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-template="product-roadmap"] .product-chip{position:absolute;right:10.5%;top:17%;z-index:4;min-width:90px;height:30px;display:grid;place-items:center;border-radius:999px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 20px rgba(17,55,70,.16);}
    body[data-template="product-roadmap"] .product-caption{position:absolute;right:9.4%;top:62%;width:23%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-template="product-roadmap"] .product-visual{position:absolute;right:8.7%;top:28%;width:25%;height:31%;z-index:3;border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));border:1px solid color-mix(in srgb,var(--template-primary) 14%,transparent);box-shadow:0 18px 32px rgba(17,55,70,.14);overflow:hidden;}
    body[data-template="product-roadmap"] .slide-cover .product-label{left:10.6%;top:18%;font-size:13px;}
    body[data-template="product-roadmap"] .slide-cover .product-chip{right:11%;top:19%;height:34px;min-width:108px;border-radius:12px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 55%,var(--template-accent) 45%));}
    body[data-template="product-roadmap"] .slide-cover .product-visual{right:9.8%;top:29%;width:28%;height:38%;border-radius:22px;box-shadow:0 24px 44px rgba(15,23,42,.18);}
    body[data-template="product-roadmap"] .slide-cover .product-caption{right:8.8%;top:71%;width:30%;font-size:12px;color:var(--template-title);}
    body[data-template="product-roadmap"] .product-visual::before{content:"";position:absolute;left:12%;right:12%;top:50%;height:4px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 24%,transparent);}
    body[data-template="product-roadmap"] .product-visual::after{content:"";position:absolute;left:16%;right:16%;bottom:16%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-template="product-roadmap"] .product-visual span{position:absolute;background:var(--template-accent);box-shadow:0 6px 14px color-mix(in srgb,var(--template-primary) 16%,transparent);}
    body[data-template="product-roadmap"] .product-visual span:nth-child(1){left:14%;top:42%;width:12px;height:12px;border-radius:50%;}
    body[data-template="product-roadmap"] .product-visual span:nth-child(2){left:38%;top:33%;width:12px;height:12px;border-radius:50%;background:var(--template-primary);}
    body[data-template="product-roadmap"] .product-visual span:nth-child(3){left:62%;top:24%;width:12px;height:12px;border-radius:50%;}
    body[data-template="product-roadmap"] .product-visual span:nth-child(4){left:18%;top:63%;width:58%;height:16%;border-radius:10px;background:color-mix(in srgb,var(--template-primary) 16%,#fff 84%);}
    body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual::before{top:22%;height:26%;border-radius:12px;background:color-mix(in srgb,var(--template-accent) 34%,#fff 66%);}
    body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual::after{bottom:21%;height:5px;background:linear-gradient(90deg,var(--template-accent),var(--template-primary));}
    body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual span{border-radius:8px;}
    body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual span:nth-child(1){left:17%;top:28%;width:18%;height:17%;}body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual span:nth-child(2){left:41%;top:28%;width:18%;height:17%;}body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual span:nth-child(3){left:65%;top:28%;width:18%;height:17%;}body[data-template="product-roadmap"] .slide[data-template-variant="release"] .product-visual span:nth-child(4){left:18%;top:61%;width:64%;height:15%;}
    body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual::before{left:15%;right:15%;top:23%;height:52%;border-radius:18px;background:conic-gradient(from 210deg,var(--template-primary),var(--template-accent),color-mix(in srgb,var(--template-primary) 16%,#fff 84%));}
    body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual::after{left:38%;right:38%;top:38%;bottom:auto;height:24%;border-radius:999px;background:#fff;}
    body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual span{height:3px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 26%,transparent);}
    body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual span:nth-child(1){left:18%;top:78%;width:58%;}body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual span:nth-child(2){left:18%;top:84%;width:44%;}body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual span:nth-child(3){display:none;}body[data-template="product-roadmap"] .slide[data-template-variant="product-review"] .product-visual span:nth-child(4){display:none;}
    body[data-template="product-roadmap"] .page-number{z-index:5;right:7.3%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 70%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-layout="data-insight"] .slide{background:linear-gradient(135deg,var(--template-bg),#fff 58%,color-mix(in srgb,var(--template-accent) 12%,var(--template-bg) 88%));padding:7.4% 8.4% 6.8%;border:0;}
    body[data-layout="data-insight"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--template-primary) 5%,transparent) 0 1px,transparent 1px 40px),repeating-linear-gradient(0deg,color-mix(in srgb,var(--template-accent) 4%,transparent) 0 1px,transparent 1px 34px),radial-gradient(circle at 78% 26%,color-mix(in srgb,var(--template-accent) 18%,transparent),transparent 27%);}
    body[data-layout="data-insight"] .slide::after{content:"";position:absolute;inset:10.8% 6.2% 9.6%;border-radius:18px;background:rgba(255,255,255,.90);border:1px solid color-mix(in srgb,var(--template-primary) 10%,transparent);box-shadow:0 24px 52px rgba(16,42,67,.13);}
    body[data-layout="data-insight"] .accent{height:7.4%;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 72%,var(--template-accent) 28%));box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="data-insight"] .motif{display:none;}
    body[data-layout="data-insight"] .slide-content{align-content:start;padding:2.4% 39% 0 0;}
    body[data-layout="data-insight"] h2{max-width:58%;font-size:36px;line-height:1.12;margin-bottom:4.6%;}
    body[data-layout="data-insight"] ul{max-width:54%;font-size:15px;line-height:1.54;}
    body[data-layout="data-insight"] .slide-cover{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 94%,#000 6%),color-mix(in srgb,var(--template-primary) 72%,var(--template-accent) 28%) 54%,var(--template-bg));}
    body[data-layout="data-insight"] .slide-cover::before{background:radial-gradient(circle at 73% 27%,rgba(255,255,255,.22),transparent 25%),repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,transparent 1px 46px),repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 38px);}
    body[data-layout="data-insight"] .slide-cover::after{inset:13% 7% 12%;border-radius:22px;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,255,255,.78));border:1px solid rgba(255,255,255,.46);box-shadow:0 30px 60px rgba(15,23,42,.22);}
    body[data-layout="data-insight"] .slide-cover .accent{height:0;}
    body[data-layout="data-insight"] .slide-cover .slide-content{padding:4.8% 42% 0 2.8%;}
    body[data-layout="data-insight"] .slide-cover h2{max-width:58%;font-size:41px;line-height:1.07;}
    body[data-layout="data-insight"] .slide-cover ul{max-width:50%;font-size:15.5px;line-height:1.56;background:rgba(255,255,255,.72);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);border-left:4px solid var(--template-accent);border-radius:14px;padding:14px 18px 14px 32px;box-shadow:0 12px 24px rgba(15,23,42,.10);}
    body[data-layout="data-insight"] .data-insight-kicker{position:absolute;left:9.5%;top:15.2%;z-index:4;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.15em;}
    body[data-layout="data-insight"] .slide-cover .data-insight-kicker{left:10.4%;top:18%;font-size:13px;}
    body[data-layout="data-insight"] .data-insight-chip{position:absolute;right:10%;top:16.5%;z-index:5;min-width:100px;height:32px;padding:0 14px;display:grid;place-items:center;border-radius:999px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;}
    body[data-layout="data-insight"] .data-insight-visual{position:absolute;right:8.7%;top:28%;width:26%;height:33%;z-index:4;border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 76%,#fff 24%));border:1px solid color-mix(in srgb,var(--template-primary) 13%,transparent);box-shadow:0 18px 34px rgba(16,42,67,.14);overflow:hidden;}
    body[data-layout="data-insight"] .slide-cover .data-insight-visual{right:9.4%;top:30%;width:28%;height:37%;box-shadow:0 24px 44px rgba(15,23,42,.20);}
    body[data-layout="data-insight"] .data-insight-visual::before{content:"";position:absolute;left:11%;right:11%;bottom:18%;height:3px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 20%,transparent);}
    body[data-layout="data-insight"] .data-insight-visual::after{content:"";position:absolute;left:12%;right:12%;top:16%;height:18%;border-radius:10px;background:color-mix(in srgb,var(--template-accent) 16%,#fff 84%);}
    body[data-layout="data-insight"] .data-insight-visual span{position:absolute;display:block;background:var(--template-accent);box-shadow:0 8px 16px color-mix(in srgb,var(--template-primary) 14%,transparent);}
    body[data-layout="data-insight"] .data-insight-visual span:nth-child(1){left:16%;bottom:21%;width:10%;height:28%;border-radius:8px 8px 0 0;}
    body[data-layout="data-insight"] .data-insight-visual span:nth-child(2){left:32%;bottom:21%;width:10%;height:46%;border-radius:8px 8px 0 0;background:var(--template-primary);}
    body[data-layout="data-insight"] .data-insight-visual span:nth-child(3){left:48%;bottom:21%;width:10%;height:36%;border-radius:8px 8px 0 0;}
    body[data-layout="data-insight"] .data-insight-visual span:nth-child(4){left:64%;bottom:21%;width:10%;height:58%;border-radius:8px 8px 0 0;background:var(--template-primary);}
    body[data-layout="data-insight"] .data-insight-visual span:nth-child(5){right:14%;top:23%;width:15%;height:15%;border-radius:50%;background:var(--template-accent);}
    body[data-layout="data-insight"] .data-insight-caption{position:absolute;right:8.8%;top:64%;width:26%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-layout="data-insight"] .data-insight-scanline{position:absolute;left:9.4%;right:40%;top:33%;height:3px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),transparent);z-index:4;}
    body[data-layout="data-insight"] .data-insight-hero-grid{position:absolute;left:10.4%;right:41%;bottom:17.3%;z-index:4;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="data-insight"] .data-insight-hero-grid span{min-height:58px;padding:0 12px;display:grid;align-content:center;gap:3px;text-align:left;background:rgba(255,255,255,.78);border:1px solid color-mix(in srgb,var(--template-primary) 10%,transparent);border-radius:14px;box-shadow:0 10px 22px rgba(15,23,42,.08);color:var(--template-body);font-size:11px;font-weight:800;}
    body[data-layout="data-insight"] .data-insight-hero-grid strong{font-size:18px;line-height:1;color:var(--template-title);}
    body[data-layout="data-insight"] .data-insight-mini-row{position:absolute;left:10.4%;right:43%;bottom:17.4%;z-index:4;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="data-insight"] .data-insight-mini-row span{height:38px;border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 8%,#fff 92%),color-mix(in srgb,var(--template-accent) 12%,#fff 88%));border-top:3px solid var(--template-accent);box-shadow:0 8px 18px rgba(15,23,42,.06);}
    body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual{border-radius:50%;aspect-ratio:1/1;height:auto;top:28.5%;}
    body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual::before{left:47%;right:auto;top:56%;bottom:auto;width:34%;height:5px;transform:rotate(38deg);background:var(--template-primary);}
    body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual::after{left:23%;right:auto;top:22%;width:40%;height:40%;border-radius:50%;background:transparent;border:4px solid var(--template-accent);}
    body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual span:nth-child(1){left:24%;top:68%;bottom:auto;width:44%;height:4px;border-radius:999px;background:var(--template-primary);}body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual span:nth-child(2){left:29%;top:48%;bottom:auto;width:8px;height:8px;border-radius:50%;background:var(--template-primary);}body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual span:nth-child(3){left:43%;top:38%;bottom:auto;width:8px;height:8px;border-radius:50%;}body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual span:nth-child(4){left:57%;top:45%;bottom:auto;width:8px;height:8px;border-radius:50%;background:var(--template-primary);}body[data-layout="data-insight"] .slide[data-template-variant="insight"] .data-insight-visual span:nth-child(5){display:none;}
    body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual{border-radius:6px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 86%,var(--template-accent) 14%));}
    body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual::before{left:13%;right:13%;top:22%;bottom:auto;height:4px;box-shadow:0 24px 0 color-mix(in srgb,var(--template-primary) 18%,transparent),0 48px 0 color-mix(in srgb,var(--template-primary) 14%,transparent),0 72px 0 color-mix(in srgb,var(--template-primary) 12%,transparent);}
    body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual::after{left:14%;right:auto;top:63%;width:38%;height:18%;border-radius:8px;background:color-mix(in srgb,var(--template-accent) 22%,#fff 78%);}
    body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span{border-radius:4px;height:4px;background:var(--template-accent);}body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span:nth-child(1){left:13%;top:17%;width:54%;}body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span:nth-child(2){left:13%;top:82%;width:62%;background:var(--template-primary);}body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span:nth-child(3),body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span:nth-child(4),body[data-layout="data-insight"] .slide[data-template-variant="research"] .data-insight-visual span:nth-child(5){display:none;}
    body[data-layout="data-insight"] .page-number{z-index:6;right:7.3%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 70%,transparent);background:rgba(255,255,255,.76);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-layout="brand-story"] .slide{background:linear-gradient(135deg,var(--template-bg),#fff 62%,color-mix(in srgb,var(--template-accent) 10%,var(--template-bg) 90%));padding:7.8% 8.8% 6.8%;border:0;}
    body[data-layout="brand-story"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--template-primary) 7%,transparent) 0 14%,transparent 14%),repeating-linear-gradient(0deg,rgba(17,24,39,.024) 0 1px,transparent 1px 38px),radial-gradient(circle at 78% 24%,color-mix(in srgb,var(--template-accent) 18%,transparent),transparent 28%);}
    body[data-layout="brand-story"] .slide::after{content:"";position:absolute;inset:10.5% 6.5% 9.8%;border-radius:4px;background:rgba(255,255,255,.92);box-shadow:0 24px 54px rgba(23,27,38,.13);border:1px solid color-mix(in srgb,var(--template-primary) 9%,transparent);}
    body[data-layout="brand-story"] .accent{left:6.5%;right:6.5%;top:10.5%;height:5px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-layout="brand-story"] .motif{display:none;}
    body[data-layout="brand-story"] .slide-content{padding:2.2% 40% 0 0;}
    body[data-layout="brand-story"] h2{max-width:58%;font-size:38px;line-height:1.08;margin-bottom:4.8%;letter-spacing:0;}
    body[data-layout="brand-story"] ul{max-width:51%;font-size:15px;line-height:1.58;}
    body[data-layout="brand-story"] .slide-cover{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 94%,#000 6%),color-mix(in srgb,var(--template-primary) 72%,var(--template-accent) 28%) 56%,var(--template-bg));}
    body[data-layout="brand-story"] .slide-cover::before{background:radial-gradient(circle at 77% 25%,rgba(255,255,255,.22),transparent 24%),linear-gradient(90deg,rgba(255,255,255,.11) 0 12%,transparent 12%),repeating-linear-gradient(115deg,rgba(255,255,255,.08) 0 1px,transparent 1px 36px);}
    body[data-layout="brand-story"] .slide-cover::after{inset:13% 7.2% 12%;border-radius:2px;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,255,255,.78));box-shadow:0 30px 60px rgba(15,23,42,.25);border:1px solid rgba(255,255,255,.46);}
    body[data-layout="brand-story"] .slide-cover .slide-content{padding:4.8% 42% 0 2.8%;}
    body[data-layout="brand-story"] .slide-cover h2{max-width:57%;font-size:43px;line-height:1.05;}
    body[data-layout="brand-story"] .slide-cover ul{max-width:48%;font-size:15.5px;background:rgba(255,255,255,.72);border-left:4px solid var(--template-accent);padding:12px 18px 12px 28px;box-shadow:0 12px 24px rgba(15,23,42,.10);}
    body[data-layout="brand-story"] .brand-story-kicker{position:absolute;left:9.5%;top:15.4%;z-index:4;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.16em;}
    body[data-layout="brand-story"] .slide-cover .brand-story-kicker{left:10.3%;top:18%;font-size:13px;}
    body[data-layout="brand-story"] .brand-story-chip{position:absolute;right:9.8%;top:16.6%;z-index:5;min-width:104px;height:32px;padding:0 14px;display:grid;place-items:center;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;letter-spacing:.04em;}
    body[data-layout="brand-story"] .brand-story-monogram{position:absolute;right:9.8%;top:22.4%;z-index:4;color:color-mix(in srgb,var(--template-accent) 68%,transparent);font-size:36px;font-weight:900;letter-spacing:.03em;}
    body[data-layout="brand-story"] .brand-story-image{position:absolute;right:8.7%;top:29%;width:26%;height:33%;z-index:4;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 12%,#fff 88%),color-mix(in srgb,var(--template-accent) 16%,#fff 84%));border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 18px 34px rgba(17,24,39,.14);overflow:hidden;}
    body[data-layout="brand-story"] .slide-cover .brand-story-image{right:9.4%;top:31%;width:28%;height:37%;box-shadow:0 24px 44px rgba(15,23,42,.20);}
    body[data-layout="brand-story"] .brand-story-image::before{content:"";position:absolute;inset:10%;border:1px solid rgba(255,255,255,.74);}
    body[data-layout="brand-story"] .brand-story-image::after{content:"";position:absolute;right:8%;bottom:9%;width:42%;height:28%;background:linear-gradient(135deg,var(--template-primary),var(--template-accent));opacity:.88;}
    body[data-layout="brand-story"] .brand-story-image span{position:absolute;display:block;background:var(--template-accent);}
    body[data-layout="brand-story"] .brand-story-image span:nth-child(1){left:13%;top:16%;width:52%;height:6px;}
    body[data-layout="brand-story"] .brand-story-image span:nth-child(2){left:13%;top:30%;width:34%;height:6px;background:color-mix(in srgb,var(--template-primary) 54%,#fff 46%);}
    body[data-layout="brand-story"] .brand-story-image span:nth-child(3){left:13%;bottom:22%;width:34%;height:26%;background:color-mix(in srgb,var(--template-accent) 22%,#fff 78%);}
    body[data-layout="brand-story"] .brand-story-image span:nth-child(4){right:14%;top:20%;width:22%;height:22%;border-radius:50%;background:var(--template-primary);}
    body[data-layout="brand-story"] .brand-story-image span:nth-child(5){left:13%;bottom:13%;width:58%;height:4px;background:color-mix(in srgb,var(--template-primary) 20%,transparent);}
    body[data-layout="brand-story"] .slide[data-template-variant="premium"] .brand-story-image{border-radius:18px 2px 18px 2px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-accent) 18%,#fff 82%));}
    body[data-layout="brand-story"] .slide[data-template-variant="premium"] .brand-story-image::after{width:30%;height:44%;right:12%;bottom:14%;background:var(--template-accent);}
    body[data-layout="brand-story"] .slide[data-template-variant="identity"] .brand-story-image{border-radius:50%;aspect-ratio:1/1;height:auto;top:28%;}
    body[data-layout="brand-story"] .slide[data-template-variant="identity"] .brand-story-image::after{border-radius:12px;width:34%;height:34%;right:15%;bottom:16%;}
    body[data-layout="brand-story"] .brand-story-caption{position:absolute;right:8.8%;top:64%;width:26%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-layout="brand-story"] .brand-story-points{position:absolute;left:10.4%;right:41%;bottom:17.5%;z-index:4;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="brand-story"] .brand-story-points span{min-height:54px;padding:0 12px;display:grid;place-items:center;text-align:center;background:rgba(255,255,255,.76);border:1px solid color-mix(in srgb,var(--template-primary) 10%,transparent);box-shadow:0 10px 22px rgba(15,23,42,.08);color:var(--template-title);font-size:11px;font-weight:900;}
    body[data-layout="brand-story"] .brand-story-content-index{position:absolute;left:9.3%;right:44%;bottom:17%;z-index:4;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
    body[data-layout="brand-story"] .brand-story-content-index span{height:42px;display:grid;place-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 8%,#fff 92%),color-mix(in srgb,var(--template-accent) 12%,#fff 88%));border-top:3px solid var(--template-accent);font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="brand-story"] .page-number{z-index:6;right:7.4%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 68%,transparent);background:rgba(255,255,255,.74);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-layout="marketing"] .slide{background:linear-gradient(135deg,var(--template-bg),#fff 54%,color-mix(in srgb,var(--template-primary) 14%,var(--template-bg) 86%));padding:7.4% 8% 6.4%;border:0;}
    body[data-layout="marketing"] .slide::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 76% 22%,color-mix(in srgb,var(--template-accent) 28%,transparent),transparent 25%),radial-gradient(circle at 12% 82%,color-mix(in srgb,var(--template-primary) 18%,transparent),transparent 28%),repeating-linear-gradient(90deg,rgba(15,23,42,.025) 0 1px,transparent 1px 42px);}
    body[data-layout="marketing"] .slide::after{content:"";position:absolute;inset:10% 6% 9%;border-radius:22px;background:rgba(255,255,255,.88);border:1px solid color-mix(in srgb,var(--template-primary) 14%,transparent);box-shadow:0 22px 54px rgba(15,23,42,.13);}
    body[data-layout="marketing"] .accent{height:0;}
    body[data-layout="marketing"] .slide-content{padding:2.5% 38% 0 0;}
    body[data-layout="marketing"] h2{max-width:58%;font-size:37px;line-height:1.1;margin-bottom:4.4%;}
    body[data-layout="marketing"] ul{max-width:54%;font-size:15px;line-height:1.52;}
    body[data-layout="marketing"] .slide-cover{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 92%,#111827 8%),color-mix(in srgb,var(--template-accent) 40%,var(--template-primary) 60%) 52%,var(--template-bg));}
    body[data-layout="marketing"] .slide-cover::before{background:radial-gradient(circle at 72% 28%,rgba(255,255,255,.24),transparent 23%),radial-gradient(circle at 32% 16%,color-mix(in srgb,var(--template-accent) 36%,transparent),transparent 26%),repeating-linear-gradient(115deg,rgba(255,255,255,.08) 0 1px,transparent 1px 34px);}
    body[data-layout="marketing"] .slide-cover::after{inset:12% 7% 12%;border-radius:26px;background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.70));border:1px solid rgba(255,255,255,.48);box-shadow:0 28px 58px rgba(15,23,42,.22);}
    body[data-layout="marketing"] .slide-cover .slide-content{padding:4.6% 39% 0 2.6%;}
    body[data-layout="marketing"] .slide-cover h2{max-width:58%;font-size:43px;line-height:1.06;}
    body[data-layout="marketing"] .slide-cover ul{max-width:50%;font-size:15.5px;line-height:1.55;background:rgba(255,255,255,.70);border:1px solid color-mix(in srgb,var(--template-primary) 16%,transparent);border-radius:14px;padding:14px 18px 14px 34px;box-shadow:0 14px 26px rgba(15,23,42,.10);}
    body[data-layout="marketing"] .marketing-kicker{position:absolute;left:9.2%;top:15%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.14em;}
    body[data-layout="marketing"] .slide-cover .marketing-kicker{left:10.3%;top:18%;font-size:13px;}
    body[data-layout="marketing"] .marketing-chip{position:absolute;right:10%;top:17%;z-index:4;min-width:98px;height:32px;padding:0 14px;display:grid;place-items:center;border-radius:999px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-accent) 55%,var(--template-primary) 45%));color:#fff;font-size:11px;font-weight:900;box-shadow:0 12px 22px rgba(15,23,42,.16);}
    body[data-layout="marketing"] .marketing-visual{position:absolute;right:8.4%;top:27%;width:25%;height:33%;z-index:3;border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));border:1px solid color-mix(in srgb,var(--template-primary) 13%,transparent);box-shadow:0 18px 34px rgba(15,23,42,.15);overflow:hidden;}
    body[data-layout="marketing"] .slide-cover .marketing-visual{right:9.5%;top:30%;width:27%;height:36%;border-radius:22px;box-shadow:0 24px 44px rgba(15,23,42,.22);}
    body[data-layout="marketing"] .marketing-visual::before{content:"";position:absolute;inset:10%;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 14%,transparent),color-mix(in srgb,var(--template-accent) 18%,transparent));}
    body[data-layout="marketing"] .marketing-visual span{position:absolute;display:block;}
    body[data-template="marketing-campaign"] .slide[data-template-variant="launch"] .marketing-visual span:nth-child(1){left:18%;top:18%;width:58%;height:20%;border-radius:10px;background:var(--template-primary);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="launch"] .marketing-visual span:nth-child(2){left:21%;top:48%;width:48%;height:8%;border-radius:999px;background:var(--template-accent);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="launch"] .marketing-visual span:nth-child(3){right:13%;bottom:13%;width:24%;height:26%;border-radius:50%;background:color-mix(in srgb,var(--template-accent) 72%,#fff 28%);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="launch"] .marketing-visual span:nth-child(4){left:14%;bottom:16%;width:18%;height:18%;border-radius:6px;background:color-mix(in srgb,var(--template-primary) 65%,#fff 35%);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="brand"] .marketing-visual{border-radius:28px 8px 28px 8px;}
    body[data-template="marketing-campaign"] .slide[data-template-variant="brand"] .marketing-visual span:nth-child(1){left:16%;top:17%;width:28%;height:28%;border-radius:50%;background:var(--template-primary);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="brand"] .marketing-visual span:nth-child(2){right:16%;top:17%;width:28%;height:28%;border-radius:50%;background:var(--template-accent);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="brand"] .marketing-visual span:nth-child(3){left:16%;bottom:18%;width:68%;height:12%;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-template="marketing-campaign"] .slide[data-template-variant="brand"] .marketing-visual span:nth-child(4){left:16%;bottom:36%;width:42%;height:7%;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 24%,#fff 76%);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="growth"] .marketing-visual span:nth-child(1){left:16%;bottom:20%;width:12%;height:28%;border-radius:8px 8px 0 0;background:var(--template-primary);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="growth"] .marketing-visual span:nth-child(2){left:36%;bottom:20%;width:12%;height:42%;border-radius:8px 8px 0 0;background:var(--template-accent);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="growth"] .marketing-visual span:nth-child(3){left:56%;bottom:20%;width:12%;height:58%;border-radius:8px 8px 0 0;background:var(--template-primary);}
    body[data-template="marketing-campaign"] .slide[data-template-variant="growth"] .marketing-visual span:nth-child(4){left:12%;right:12%;bottom:18%;height:2px;background:color-mix(in srgb,var(--template-title) 18%,transparent);}
    body[data-layout="marketing"] .marketing-caption{position:absolute;right:8.8%;top:63%;width:25%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-layout="marketing"] .marketing-orbit{position:absolute;right:7%;bottom:13%;width:22%;height:18%;z-index:2;border-radius:50%;border-top:4px solid color-mix(in srgb,var(--template-accent) 72%,transparent);opacity:.58;}
    body[data-layout="marketing"] .marketing-metrics{position:absolute;left:10.4%;right:40%;bottom:17.5%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;z-index:4;}
    body[data-layout="marketing"] .marketing-metrics span{min-height:58px;border-radius:14px;background:rgba(255,255,255,.78);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 12px 24px rgba(15,23,42,.10);display:grid;align-content:center;gap:3px;padding:0 14px;color:var(--template-body);font-size:11px;font-weight:800;}
    body[data-layout="marketing"] .marketing-metrics strong{font-size:18px;line-height:1;color:var(--template-title);}
    body[data-layout="marketing"] .marketing-channel-row{position:absolute;left:9.2%;right:42%;bottom:16.8%;z-index:4;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
    body[data-layout="marketing"] .marketing-channel-row span{height:44px;border-radius:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 14%,#fff 86%),color-mix(in srgb,var(--template-accent) 18%,#fff 82%));border:1px solid color-mix(in srgb,var(--template-primary) 10%,transparent);box-shadow:0 10px 20px rgba(15,23,42,.08);}
    body[data-layout="marketing"] .page-number{z-index:5;color:color-mix(in srgb,var(--template-title) 64%,transparent);background:rgba(255,255,255,.72);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:5px 10px;}
    body[data-layout="academy"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 72%);padding:8% 10%;border:0;}
    body[data-layout="academy"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(15,23,42,.022) 0 1px,transparent 1px 32px);}
    body[data-layout="academy"] .slide::after{content:"";position:absolute;inset:14% 7.5% 12%;background:var(--template-surface);box-shadow:0 16px 40px rgba(11,93,102,.10);}
    body[data-layout="academy"] .accent{height:7.6%;background:var(--template-primary);box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="academy"] .motif{display:block;right:9.5%;top:26%;width:7.2%;height:40%;border-radius:8px;background:var(--template-accent);opacity:.78;}
    body[data-layout="academy"] h2{max-width:78%;font-size:42px;}
    body[data-layout="education-course"] .slide{background:linear-gradient(135deg,var(--template-bg),#fff 54%,color-mix(in srgb,var(--template-accent) 9%,var(--template-bg) 91%));padding:7% 8.5% 6.6%;border:0;}
    body[data-layout="education-course"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--template-primary) 6%,transparent) 0 1px,transparent 1px 30px),radial-gradient(circle at 12% 16%,color-mix(in srgb,var(--template-accent) 20%,transparent),transparent 22%);pointer-events:none;}
    body[data-layout="education-course"] .slide::after{content:"";position:absolute;left:8.8%;right:8.2%;top:13.5%;bottom:11%;border-radius:2px;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.90));border-left:8px solid color-mix(in srgb,var(--template-primary) 70%,var(--template-accent) 30%);box-shadow:0 18px 40px rgba(33,78,68,.12);}
    body[data-layout="education-course"] .accent{left:8.8%;right:8.2%;top:13.5%;height:7px;background:var(--template-accent);z-index:2;}
    body[data-layout="education-course"] .motif{display:none;}
    body[data-layout="education-course"] .slide-content{align-content:start;padding:3.3% 9% 0 6.5%;}
    body[data-layout="education-course"] h2{max-width:72%;font-size:34px;line-height:1.12;margin-bottom:4.5%;}
    body[data-layout="education-course"] ul{max-width:64%;font-size:16px;line-height:1.58;}
    body[data-layout="education-course"] .slide-cover{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 92%,#0f172a 8%),color-mix(in srgb,var(--template-primary) 72%,var(--template-accent) 28%) 56%,var(--template-bg));}
    body[data-layout="education-course"] .slide-cover::before{background:repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 1px,transparent 1px 32px),radial-gradient(circle at 82% 22%,rgba(255,255,255,.18),transparent 22%);}
    body[data-layout="education-course"] .slide-cover::after{left:8%;right:8%;top:15%;bottom:15%;border-radius:10px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 86%,#0b1220 14%),color-mix(in srgb,var(--template-primary) 70%,#000 30%));border:1px solid rgba(255,255,255,.18);box-shadow:0 28px 58px rgba(15,23,42,.28),inset 0 -8px 0 color-mix(in srgb,var(--template-accent) 76%,transparent);}
    body[data-layout="education-course"] .slide-cover .accent{left:10%;right:10%;top:79%;height:3px;background:rgba(255,255,255,.28);}
    body[data-layout="education-course"] .slide-cover .slide-content{padding:7.2% 14% 0 4.6%;}
    body[data-layout="education-course"] .slide-cover h2{max-width:66%;font-size:44px;line-height:1.08;margin-bottom:4.8%;color:#fff;}
    body[data-layout="education-course"] .slide-cover ul{max-width:56%;font-size:16px;line-height:1.55;color:rgba(255,255,255,.86);background:transparent;border:0;border-left:4px solid var(--template-accent);border-radius:0;padding:0 0 0 28px;box-shadow:none;}
    body[data-layout="education-course"] .education-kicker{position:absolute;left:11.2%;top:16.2%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-layout="education-course"] .slide-cover .education-kicker{left:12%;top:19%;font-size:13px;}
    body[data-layout="education-course"] .education-chip{position:absolute;right:12%;top:16.5%;z-index:4;min-width:86px;height:28px;display:grid;place-items:center;border-radius:3px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;box-shadow:none;}
    body[data-layout="education-course"] .slide-cover .education-chip{right:13%;top:20%;height:30px;min-width:110px;border-radius:3px;background:var(--template-accent);color:color-mix(in srgb,var(--template-primary) 88%,#000 12%);}
    body[data-layout="education-course"] .education-visual{position:absolute;right:12%;top:26%;width:16%;height:23%;z-index:3;border-radius:4px;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--template-bg) 82%,#fff 18%));border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:none;overflow:hidden;}
    body[data-layout="education-course"] .slide-cover .education-visual{right:13%;top:34%;width:18%;height:30%;border-radius:4px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);box-shadow:none;}
    body[data-layout="education-course"] .education-visual::before{content:"";position:absolute;left:12%;right:12%;top:18%;height:12%;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 16%,#fff 84%);}
    body[data-layout="education-course"] .education-visual::after{content:"";position:absolute;left:15%;right:15%;bottom:19%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));}
    body[data-layout="education-course"] .education-visual span{position:absolute;display:block;background:var(--template-accent);border-radius:8px;}
    body[data-layout="education-course"] .education-visual span:nth-child(1){left:16%;top:38%;width:58%;height:7px;background:var(--template-primary);}
    body[data-layout="education-course"] .education-visual span:nth-child(2){left:16%;top:50%;width:44%;height:7px;background:color-mix(in srgb,var(--template-primary) 28%,#fff 72%);}
    body[data-layout="education-course"] .education-visual span:nth-child(3){left:16%;top:62%;width:52%;height:7px;background:color-mix(in srgb,var(--template-primary) 18%,#fff 82%);}
    body[data-layout="education-course"] .education-visual span:nth-child(4){right:14%;top:48%;width:18%;height:24%;background:var(--template-accent);}
    body[data-layout="education-course"] .education-visual span:nth-child(5){right:16%;top:21%;width:10%;height:10%;border-radius:50%;background:var(--template-primary);}
    body[data-layout="education-course"] .education-caption{position:absolute;right:12%;bottom:15.2%;width:20%;z-index:4;color:var(--template-body);font-size:11px;font-weight:800;text-align:right;}
    body[data-layout="education-course"] .slide-cover .education-caption{right:13%;bottom:22%;width:20%;font-size:11px;color:rgba(255,255,255,.72);}
    body[data-layout="education-course"] .education-outcomes{position:absolute;left:12%;right:12%;bottom:17.2%;z-index:4;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid rgba(255,255,255,.22);}
    body[data-layout="education-course"] .education-outcomes span{min-height:44px;display:grid;place-items:center;text-align:center;padding:0 12px;color:rgba(255,255,255,.86);font-size:11px;font-weight:900;border-right:1px solid rgba(255,255,255,.18);}
    body[data-layout="education-course"] .education-note-row{position:absolute;left:12%;right:12%;bottom:16%;z-index:4;display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid color-mix(in srgb,var(--template-primary) 14%,transparent);}
    body[data-layout="education-course"] .education-note-row span{height:34px;background:transparent;border-right:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);border-radius:0;box-shadow:none;}
    body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual{border-radius:26px 8px 26px 8px;}
    body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual::before{left:14%;right:auto;top:18%;width:30%;height:28%;border-radius:10px;background:color-mix(in srgb,var(--template-accent) 30%,#fff 70%);}
    body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual::after{left:54%;right:auto;top:24%;bottom:auto;width:26%;height:23%;border-radius:10px;background:color-mix(in srgb,var(--template-primary) 18%,#fff 82%);}
    body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual span:nth-child(1){left:17%;top:59%;width:18%;height:18%;}body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual span:nth-child(2){left:41%;top:59%;width:18%;height:18%;background:var(--template-primary);}body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual span:nth-child(3){left:65%;top:59%;width:18%;height:18%;background:color-mix(in srgb,var(--template-accent) 68%,#fff 32%);}body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual span:nth-child(4){left:22%;top:49%;width:54%;height:3px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 22%,transparent);}body[data-layout="education-course"] .slide[data-template-variant="workshop"] .education-visual span:nth-child(5){display:none;}
    body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual{border-radius:10px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 86%,#fff 14%));}
    body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual::before{left:16%;right:16%;top:23%;height:4px;border-radius:999px;box-shadow:0 24px 0 color-mix(in srgb,var(--template-primary) 18%,transparent),0 48px 0 color-mix(in srgb,var(--template-primary) 12%,transparent);}
    body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual::after{left:16%;right:auto;bottom:18%;width:54%;height:5px;}
    body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual span:nth-child(1){left:15%;top:16%;width:48%;height:4px;}body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual span:nth-child(2){left:15%;top:76%;width:26%;height:12%;background:color-mix(in srgb,var(--template-accent) 36%,#fff 64%);}body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual span:nth-child(3),body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual span:nth-child(4),body[data-layout="education-course"] .slide[data-template-variant="minimal"] .education-visual span:nth-child(5){display:none;}
    body[data-layout="education-course"] .page-number{z-index:5;right:7.4%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 70%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-layout="venture"] .slide{background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 78%,var(--template-bg) 22%));padding:8.5% 10%;border:0;}
    body[data-layout="venture"] .slide::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 18%,color-mix(in srgb,var(--template-accent) 24%,transparent),transparent 32%),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 36px);}
    body[data-layout="venture"] .slide::after{content:"";position:absolute;inset:9% 6% 11%;background:var(--template-surface);box-shadow:0 22px 54px rgba(17,24,39,.20);}
    body[data-layout="venture"] .accent{top:auto;left:9%;right:9%;bottom:14%;height:2.2%;border-radius:999px;background:var(--template-accent);}
    body[data-layout="venture"] h2{max-width:82%;font-size:46px;}
    body[data-template="pitch"][data-layout="venture"] .slide{background:linear-gradient(120deg,color-mix(in srgb,var(--template-primary) 96%,#000 4%),var(--template-primary) 48%,color-mix(in srgb,var(--template-accent) 24%,var(--template-primary) 76%));padding:7.6% 8.8% 6.8%;border:0;}
    body[data-template="pitch"][data-layout="venture"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(105deg,rgba(255,255,255,.05) 0 8%,transparent 8% 63%,rgba(255,255,255,.09) 63% 100%),radial-gradient(circle at 74% 18%,color-mix(in srgb,var(--template-accent) 42%,transparent),transparent 24%),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 42px);}
    body[data-template="pitch"][data-layout="venture"] .slide::after{content:"";position:absolute;left:7.5%;top:14%;width:57%;height:66%;border-radius:4px 28px 4px 28px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,255,255,.82));box-shadow:0 30px 70px rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.48);}
    body[data-template="pitch"][data-layout="venture"] .accent{left:10%;right:45%;top:70.5%;bottom:auto;height:5px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),transparent);z-index:5;}
    body[data-template="pitch"][data-layout="venture"] .motif{display:block;right:0;top:0;width:33%;height:100%;border-radius:0;background:linear-gradient(160deg,color-mix(in srgb,var(--template-accent) 32%,transparent),rgba(255,255,255,.08) 36%,transparent 70%);box-shadow:none;z-index:2;}
    body[data-template="pitch"][data-layout="venture"] .motif::before{content:"";position:absolute;right:17%;top:30%;width:50%;height:30%;border-radius:22px;background:rgba(255,255,255,.16);box-shadow:0 0 0 1px rgba(255,255,255,.18),0 22px 46px rgba(0,0,0,.16);}
    body[data-template="pitch"][data-layout="venture"] .motif::after{content:"";position:absolute;right:12%;bottom:11%;width:72%;height:18%;background:color-mix(in srgb,var(--template-primary) 55%,#000 45%);clip-path:polygon(0 40%,100% 0,100% 100%,0 100%);}
    body[data-template="pitch"][data-layout="venture"] .slide-content{padding:2.8% 38% 0 0;z-index:6;}
    body[data-template="pitch"][data-layout="venture"] h2{max-width:59%;font-size:40px;line-height:1.08;margin-bottom:4.2%;color:var(--template-title);}
    body[data-template="pitch"][data-layout="venture"] ul{max-width:54%;font-size:15px;line-height:1.55;color:var(--template-body);}
    body[data-template="pitch"][data-layout="venture"] .slide-cover .slide-content{padding:4.8% 39% 0 2.4%;}
    body[data-template="pitch"][data-layout="venture"] .slide-cover h2{max-width:58%;font-size:44px;line-height:1.05;}
    body[data-template="pitch"][data-layout="venture"] .slide-cover ul{max-width:50%;padding:13px 18px 13px 34px;border-radius:2px 14px 2px 14px;background:rgba(255,255,255,.66);border-left:4px solid var(--template-accent);box-shadow:0 14px 24px rgba(15,23,42,.10);}
    body[data-template="pitch"][data-layout="venture"] .pitch-kicker{position:absolute;left:9.2%;top:15.2%;z-index:6;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.14em;}
    body[data-template="pitch"][data-layout="venture"] .slide-cover .pitch-kicker{left:10.4%;top:18.2%;font-size:13px;}
    body[data-template="pitch"][data-layout="venture"] .pitch-chip{position:absolute;right:10%;top:17%;z-index:6;min-width:96px;height:32px;padding:0 14px;display:grid;place-items:center;border-radius:999px;background:var(--template-accent);color:var(--template-primary);font-size:11px;font-weight:900;box-shadow:0 12px 24px rgba(15,23,42,.14);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual{position:absolute;right:8.5%;top:27%;width:25%;height:34%;z-index:5;border-radius:4px 22px 4px 22px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));border:1px solid rgba(255,255,255,.42);box-shadow:0 26px 46px rgba(0,0,0,.22);overflow:hidden;}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual::before{content:"";position:absolute;inset:10%;border-radius:3px 16px 3px 16px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 14%,transparent),color-mix(in srgb,var(--template-accent) 20%,transparent));}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span{position:absolute;display:block;background:var(--template-accent);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span:nth-child(1){left:15%;top:18%;width:48%;height:8px;border-radius:999px;background:var(--template-primary);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span:nth-child(2){left:15%;top:38%;width:68%;height:6px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 22%,transparent);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span:nth-child(3){left:15%;top:54%;width:52%;height:6px;border-radius:999px;background:color-mix(in srgb,var(--template-primary) 18%,transparent);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span:nth-child(4){right:14%;bottom:16%;width:26%;height:25%;border-radius:10px;background:var(--template-accent);}
    body[data-template="pitch"][data-layout="venture"] .pitch-visual span:nth-child(5){left:16%;bottom:17%;width:34%;height:18%;border-radius:10px;background:color-mix(in srgb,var(--template-primary) 74%,#fff 26%);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="investor"] .pitch-visual span:nth-child(1){left:13%;bottom:18%;top:auto;width:70%;height:3px;background:color-mix(in srgb,var(--template-primary) 22%,transparent);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="investor"] .pitch-visual span:nth-child(2){left:18%;bottom:20%;top:auto;width:12%;height:32%;border-radius:7px 7px 0 0;background:var(--template-primary);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="investor"] .pitch-visual span:nth-child(3){left:39%;bottom:20%;top:auto;width:12%;height:48%;border-radius:7px 7px 0 0;background:var(--template-accent);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="investor"] .pitch-visual span:nth-child(4){left:60%;bottom:20%;right:auto;width:12%;height:62%;border-radius:7px 7px 0 0;background:var(--template-primary);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="investor"] .pitch-visual span:nth-child(5){right:14%;top:18%;left:auto;bottom:auto;width:20%;height:20%;border-radius:50%;background:var(--template-accent);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual{border-radius:26px 8px 26px 8px;}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual span:nth-child(1){left:20%;top:18%;width:52%;height:44%;border-radius:14px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-accent) 48%,var(--template-primary) 52%));}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual span:nth-child(2){left:24%;top:69%;width:44%;height:5px;border-radius:999px;background:var(--template-primary);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual span:nth-child(3){right:14%;top:22%;left:auto;width:16%;height:16%;border-radius:50%;background:var(--template-accent);}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual span:nth-child(4){display:none;}
    body[data-template="pitch"][data-layout="venture"] .slide[data-template-variant="product"] .pitch-visual span:nth-child(5){display:none;}
    body[data-template="pitch"][data-layout="venture"] .pitch-caption{position:absolute;right:8.8%;top:64%;width:25%;z-index:6;color:var(--template-body);font-size:11px;font-weight:800;text-align:center;}
    body[data-template="pitch"][data-layout="venture"] .pitch-arc{position:absolute;right:7%;bottom:13.5%;width:23%;height:18%;z-index:3;border-radius:50%;border-top:4px solid color-mix(in srgb,var(--template-accent) 70%,transparent);opacity:.65;}
    body[data-template="pitch"][data-layout="venture"] .pitch-metrics{position:absolute;left:10.4%;right:41%;bottom:17.4%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;z-index:6;}
    body[data-template="pitch"][data-layout="venture"] .pitch-metrics span{min-height:58px;border-radius:2px 14px 2px 14px;background:rgba(255,255,255,.78);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 12px 24px rgba(15,23,42,.10);display:grid;align-content:center;gap:3px;padding:0 14px;color:var(--template-body);font-size:11px;font-weight:800;}
    body[data-template="pitch"][data-layout="venture"] .pitch-metrics strong{font-size:18px;line-height:1;color:var(--template-title);}
    body[data-template="pitch"][data-layout="venture"] .pitch-proof-row{position:absolute;left:10.3%;right:43%;bottom:17.2%;z-index:6;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-template="pitch"][data-layout="venture"] .pitch-proof-row span{height:40px;border-radius:2px 12px 2px 12px;background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 12%,#fff 88%),color-mix(in srgb,var(--template-accent) 18%,#fff 82%));border-top:3px solid var(--template-accent);box-shadow:0 10px 20px rgba(15,23,42,.08);}
    body[data-template="pitch"][data-layout="venture"] .page-number{z-index:7;right:7.4%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 68%,transparent);background:rgba(255,255,255,.74);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-layout="red-gold"] .slide{background-image:var(--dome-content-bg),linear-gradient(135deg,var(--template-primary),var(--dome-title-grad-end) 58%,var(--dome-title-grad-start));background-size:cover;background-position:center;border:0;padding:10.5% 12% 9%;box-shadow:0 22px 58px rgba(var(--dome-accent-rgb),.18);outline:1px solid rgba(var(--dome-frame-stroke-rgb),.24);}
    body[data-layout="red-gold"] .slide-cover{background-image:var(--dome-cover-bg),linear-gradient(135deg,var(--template-primary),var(--dome-title-grad-end) 58%,var(--dome-title-grad-start));}
    body[data-layout="red-gold"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.07),transparent 46%),repeating-linear-gradient(115deg,rgba(var(--dome-accent-rgb),.05) 0 1px,transparent 1px 42px);}
    body[data-layout="red-gold"] .slide::after{content:"";position:absolute;left:0;right:0;bottom:0;height:25%;background:linear-gradient(135deg,var(--dome-surface-highlight),var(--dome-card-fill-strong) 36%,rgba(var(--dome-primary-rgb),.22) 40%,rgba(var(--dome-accent-rgb),.58));clip-path:polygon(0 66%,14% 48%,28% 58%,44% 34%,60% 52%,76% 30%,100% 44%,100% 100%,0 100%);}
    body[data-layout="red-gold"] .accent{left:0;right:0;top:auto;bottom:23.2%;height:2px;background:var(--template-accent);}
    body[data-layout="red-gold"] .slide-content{align-content:center;justify-items:center;text-align:center;color:var(--dome-surface-text);}
    body[data-layout="red-gold"] .slide-cover h2{max-width:88%;margin-bottom:2.8%;font-size:54px;line-height:1.12;text-wrap:balance;color:var(--dome-surface-text);text-shadow:0 3px 0 rgba(var(--dome-accent-rgb),.32),0 12px 24px rgba(var(--dome-primary-rgb),.24);}
    body[data-layout="red-gold"] .slide-cover ul{max-width:60%;padding:0;list-style:none;color:var(--dome-surface-text);text-align:center;}
    body[data-layout="red-gold"] .dome-cover-subtitle{left:50%;top:58%;transform:translateX(-50%);width:46%;color:var(--dome-surface-text);font-size:18px;font-weight:800;text-align:center;text-shadow:0 10px 22px rgba(var(--dome-primary-rgb),.24);}
    body[data-layout="red-gold"] .slide-content::before{content:"";position:absolute;left:-4%;bottom:-30%;color:rgba(var(--dome-accent-rgb),.82);font-size:12px;letter-spacing:0;}
    body[data-layout="red-gold"] .slide-content::after{content:"";position:absolute;z-index:0;inset:18% 13% 12%;border:1px solid rgba(var(--dome-accent-rgb),.18);border-radius:18px;}
    body[data-layout="red-gold"] .dome-canvas-frame{position:absolute;left:4%;top:4%;right:4%;bottom:4%;z-index:2;pointer-events:none;border:1px solid rgba(var(--dome-frame-stroke-rgb),.38);border-radius:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}
    body[data-layout="red-gold"] .dome-canvas-frame::before{content:"";position:absolute;inset:12px;pointer-events:none;background:radial-gradient(circle at 18% 14%,rgba(255,255,255,.08),transparent 38%);mix-blend-mode:screen;opacity:.55;}
    body[data-layout="red-gold"] .dome-canvas-frame::after{content:"";position:absolute;inset:0;border-radius:16px;box-shadow:0 0 24px 4px rgba(var(--dome-accent-rgb),.08);pointer-events:none;}
    body[data-layout="red-gold"] .dome-content-frame{left:6.67%;top:8.89%;width:86.67%;height:82.07%;z-index:2;border:1px solid rgba(var(--dome-frame-stroke-rgb),.50);}
    body[data-layout="red-gold"] .dome-content-surface{left:10%;top:17.8%;width:78.3%;height:66.7%;z-index:1;border-radius:58px;background:var(--dome-content-panel);box-shadow:0 20px 44px rgba(var(--dome-soft-rgb),.16);border:1px solid rgba(var(--dome-card-stroke-rgb),.45);}
    body[data-layout="red-gold"] .slide-content>*{z-index:2;}
    body[data-layout="red-gold"] .slide:not(.slide-cover){padding:0;}
    body[data-layout="red-gold"] .slide:not(.slide-cover)::before{background:linear-gradient(180deg,rgba(255,255,255,.07),transparent 42%),repeating-linear-gradient(115deg,rgba(var(--dome-accent-rgb),.05) 0 1px,transparent 1px 42px);}
    body[data-layout="red-gold"] .slide:not(.slide-cover)::after{inset:12% 7.5% 16%;height:auto;border-radius:20px;background:rgba(var(--dome-accent-rgb),.045);box-shadow:0 22px 42px rgba(var(--dome-soft-rgb),.16);}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content{position:absolute;inset:0;display:block;text-align:left;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content::before{content:"BUSINESS REPORT";left:15%;top:44.7%;bottom:auto;color:var(--template-accent);font-size:12px;font-weight:800;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content::after{display:none;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) h2{position:absolute;left:15%;top:23.7%;width:47.5%;max-width:none;margin:0;font-size:42px;color:var(--template-title);text-shadow:none;}
    /* 顶部卡片版式(image-report/showcase/retrospective)标题不再被内层块垂直居中压住卡片:置顶 + 浅色可读。 */
    body[data-layout="red-gold"] .slide[data-dome-role="image-report"] .slide-content,
    body[data-layout="red-gold"] .slide[data-dome-role="showcase"] .slide-content,
    body[data-layout="red-gold"] .slide[data-dome-role="retrospective"] .slide-content{align-content:start;}
    body[data-layout="red-gold"] .slide[data-dome-role="image-report"] .slide-content h2,
    body[data-layout="red-gold"] .slide[data-dome-role="showcase"] .slide-content h2,
    body[data-layout="red-gold"] .slide[data-dome-role="retrospective"] .slide-content h2{color:var(--dome-surface-text);text-shadow:0 6px 16px rgba(var(--dome-primary-rgb),.28);}
    body[data-layout="red-gold"] .slide:not(.slide-cover) ul{position:absolute;left:16.7%;top:41.5%;width:53.3%;max-width:none;font-size:21px;color:var(--template-body);}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .motif{display:block;left:75.83%;top:35.56%;width:8.33%;height:35.56%;border-radius:12px;background:var(--template-accent);box-shadow:0 18px 28px rgba(var(--dome-accent-rgb),.18);}
    body[data-layout="red-gold"] .dome-role-visual{position:absolute;z-index:2;left:60%;top:29.63%;width:23.33%;height:35.56%;border-radius:10px;background:var(--dome-business-1) center/cover no-repeat;box-shadow:0 18px 30px rgba(var(--dome-accent-rgb),.22);overflow:hidden;}
    body[data-layout="red-gold"] .dome-role-decor{position:absolute;z-index:3;pointer-events:none;}
    body[data-layout="red-gold"] .dome-wave-arc{z-index:2;border-radius:50%;border-top-style:solid;border-left:0;border-right:0;border-bottom:0;background:transparent;}
    body[data-layout="red-gold"] .dome-wave-arc.dome-wave-gold{left:-7%;bottom:7.8%;width:54%;height:25%;border-top-width:8px;border-top-color:rgba(var(--dome-accent-rgb),.92);}
    body[data-layout="red-gold"] .dome-wave-arc.dome-wave-light{left:28%;bottom:10.5%;width:61%;height:27%;border-top-width:7px;border-top-color:rgba(var(--dome-primary-rgb),.88);}
    body[data-layout="red-gold"] .dome-footer-decoration{left:7%;bottom:7.2%;color:rgba(var(--dome-accent-rgb),.86);font-size:12px;font-weight:700;letter-spacing:0;text-shadow:0 8px 18px rgba(var(--dome-primary-rgb),.24);}
    body[data-layout="red-gold"] .dome-agenda-grid{left:13%;right:13%;top:33%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;}
    body[data-layout="red-gold"] .dome-agenda-card{position:relative;min-height:74px;border-radius:12px;background:var(--dome-card-fill);box-shadow:0 14px 22px rgba(var(--dome-accent-rgb),.20);color:var(--template-title);font-weight:800;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px;padding:0 22px;min-width:0;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-agenda-number{font-size:20px;line-height:1;color:var(--template-title);}
    body[data-layout="red-gold"] .dome-agenda-text{font-size:20px;line-height:1.2;overflow-wrap:anywhere;}
    body[data-layout="red-gold"] .dome-section-number{left:50%;top:32%;transform:translateX(-50%);color:var(--dome-surface-text);font-size:28px;font-weight:900;letter-spacing:0;text-shadow:0 10px 22px rgba(var(--dome-primary-rgb),.24);}
    body[data-layout="red-gold"] .dome-section-divider-line{left:37.5%;right:37.5%;top:53.5%;height:3px;background:var(--template-accent);box-shadow:0 8px 16px rgba(var(--dome-primary-rgb),.20);}
    body[data-layout="red-gold"] .dome-section-label{left:12%;top:13%;color:var(--template-accent);font-size:12px;font-weight:800;letter-spacing:0;}
    body[data-layout="red-gold"] .dome-step-connector{left:15%;top:65.2%;width:71.67%;height:3px;background:var(--template-accent);box-shadow:0 8px 16px rgba(var(--dome-accent-rgb),.14);z-index:2;}
    body[data-layout="red-gold"] .dome-step-row{left:13.33%;right:auto;top:56.3%;width:72%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
    body[data-layout="red-gold"] .dome-step-card,.dome-metric-card{position:relative;border-radius:12px;background:var(--dome-card-fill);box-shadow:0 12px 22px rgba(var(--dome-accent-rgb),.16);padding:16px;color:var(--template-title);font-weight:800;text-align:center;display:grid;gap:8px;align-content:center;min-width:0;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-card-index{display:block;font-size:20px;line-height:1;color:var(--template-title);}
    body[data-layout="red-gold"] .dome-card-text{display:block;font-size:14px;line-height:1.25;color:var(--template-body);overflow-wrap:anywhere;}
    body[data-layout="red-gold"] .dome-next-plan-phase{display:block;font-size:18px;line-height:1;color:var(--template-title);font-weight:900;}
    body[data-layout="red-gold"] .dome-next-plan-action{display:block;font-size:13px;line-height:1.25;color:var(--template-body);overflow-wrap:anywhere;}
    body[data-layout="red-gold"] .dome-metric-value{display:block;font-size:26px;line-height:1;color:var(--template-title);font-weight:900;}
    body[data-layout="red-gold"] .dome-metric-label{display:block;font-size:13px;line-height:1.25;color:var(--template-body);overflow-wrap:anywhere;}
    body[data-layout="red-gold"] .dome-metric-grid{left:13.33%;top:50.4%;width:60%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
    body[data-layout="red-gold"] .dome-image-report-grid{left:13.33%;top:47.4%;width:36.67%;display:grid;grid-template-columns:1fr;gap:10px;}
    body[data-layout="red-gold"] .dome-image-report-card{position:relative;border-radius:12px;background:var(--dome-card-fill);box-shadow:0 12px 20px rgba(var(--dome-accent-rgb),.14);padding:13px 16px;color:var(--template-title);font-weight:800;display:grid;gap:6px;align-content:center;min-width:0;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-image-report-card:nth-child(even){background:var(--dome-card-fill-strong);}
    body[data-layout="red-gold"] .dome-showcase-grid{left:13.33%;top:47.4%;width:36.67%;display:grid;grid-template-columns:1fr;gap:10px;}
    body[data-layout="red-gold"] .dome-showcase-card{position:relative;border-radius:12px;background:var(--dome-card-fill);box-shadow:0 12px 20px rgba(var(--dome-accent-rgb),.14);padding:13px 16px;color:var(--template-title);font-weight:800;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;min-width:0;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-showcase-number{font-size:16px;line-height:1;color:var(--template-title);}
    body[data-layout="red-gold"] .dome-showcase-text{font-size:14px;line-height:1.25;overflow-wrap:anywhere;min-width:0;}
    body[data-layout="red-gold"] .dome-showcase-card:nth-child(even){background:var(--dome-card-fill-strong);}
    body[data-layout="red-gold"] .dome-retrospective-grid{left:13.33%;top:47.4%;width:36.67%;display:grid;grid-template-columns:1fr;gap:10px;}
    body[data-layout="red-gold"] .dome-retrospective-card{position:relative;border-radius:12px;background:var(--dome-card-fill);box-shadow:0 12px 20px rgba(var(--dome-accent-rgb),.14);padding:13px 16px;color:var(--template-title);font-weight:800;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:12px;min-width:0;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-retrospective-label{font-size:13px;line-height:1;color:var(--template-title);}
    body[data-layout="red-gold"] .dome-retrospective-card:nth-child(even){background:var(--dome-card-fill-strong);}
    body[data-layout="red-gold"] .dome-risk-card{left:60%;top:62.2%;width:23.33%;height:11.85%;border-radius:12px;background:var(--dome-card-fill-strong);padding:16px;color:var(--template-title);font-size:18px;font-weight:800;text-align:center;box-shadow:0 14px 22px rgba(var(--dome-accent-rgb),.18);display:grid;place-items:center;border:1px solid rgba(var(--dome-card-stroke-rgb),.48);}
    body[data-layout="red-gold"] .dome-plan-timeline{left:13.33%;top:47.4%;width:70%;height:3px;background:var(--template-accent);}
    body[data-layout="red-gold"] .dome-closing-subtitle{left:50%;top:58%;transform:translateX(-50%);width:42%;color:var(--dome-surface-text);font-size:16px;font-weight:800;text-align:center;text-shadow:0 10px 22px rgba(var(--dome-primary-rgb),.24);}
    body[data-layout="red-gold"] .slide[data-dome-role="showcase"] .dome-role-visual{background-image:var(--dome-business-2);}
    body[data-layout="red-gold"] .slide[data-dome-role="three-steps"] .dome-role-visual{background-image:var(--dome-business-3);}
    body[data-layout="red-gold"] .slide[data-dome-role="retrospective"] .dome-role-visual{background-image:var(--dome-business-3);}
    body[data-layout="red-gold"] .slide[data-dome-role="four-steps"] .dome-role-visual{background-image:var(--dome-business-4);}
    body[data-layout="red-gold"] .slide[data-dome-role="next-plan"] .dome-role-visual{background-image:var(--dome-business-6);}
    body[data-layout="red-gold"] .slide[data-dome-role="showcase"] .dome-role-visual{left:58.33%;top:26.67%;width:26.67%;height:35.56%;}
    body[data-layout="red-gold"] .slide[data-dome-role="three-steps"] .dome-role-visual,
    body[data-layout="red-gold"] .slide[data-dome-role="four-steps"] .dome-role-visual,
    body[data-layout="red-gold"] .slide[data-dome-role="next-plan"] .dome-role-visual{left:65%;top:26.67%;width:20%;height:23.7%;}
    body[data-layout="red-gold"] .slide[data-dome-role="metrics"] .dome-role-visual{background-image:var(--dome-business-5);left:65%;top:26.67%;width:20%;height:23.7%;}
    body[data-layout="red-gold"] .slide[data-dome-role="agenda"] .slide-content{justify-items:center;text-align:center;}
    body[data-layout="red-gold"] .slide[data-dome-role="section-divider"] .slide-content{align-content:center;justify-items:center;text-align:center;color:var(--dome-surface-text);}
    body[data-layout="red-gold"] .slide[data-dome-role="closing"] .slide-content{align-content:center;justify-items:center;text-align:center;color:var(--dome-surface-text);}
    @media (max-width:720px){body{padding:14px;}main{gap:18px;}.slide{padding:8% 7%;}h2{font-size:26px;}ul{max-width:94%;font-size:16px;line-height:1.48;}body[data-layout="hero"] .slide-cover h2,body[data-layout="executive"] h2,body[data-layout="academy"] h2,body[data-layout="venture"] h2,body[data-layout="marketing"] h2,body[data-layout="data-insight"] h2,body[data-layout="education-course"] h2,body[data-layout="status-report"] h2,body[data-layout="red-gold"] .slide-cover h2{font-size:30px;}body[data-layout="status-report"] .slide-content{padding-right:0;}body[data-layout="status-report"] .status-report-photo,body[data-layout="status-report"] .status-report-photo-frame,body[data-layout="status-report"] .status-report-checklist{display:none;}body[data-layout="status-report"] ul{max-width:92%;}body[data-layout="marketing"] .slide-content,body[data-layout="data-insight"] .slide-content,body[data-layout="education-course"] .slide-content{padding-right:0;}body[data-layout="marketing"] .marketing-visual,body[data-layout="marketing"] .marketing-metrics,body[data-layout="marketing"] .marketing-channel-row,body[data-layout="marketing"] .marketing-caption,body[data-layout="marketing"] .marketing-orbit,body[data-layout="data-insight"] .data-insight-visual,body[data-layout="data-insight"] .data-insight-hero-grid,body[data-layout="data-insight"] .data-insight-mini-row,body[data-layout="data-insight"] .data-insight-caption,body[data-layout="data-insight"] .data-insight-scanline,body[data-layout="education-course"] .education-visual,body[data-layout="education-course"] .education-outcomes,body[data-layout="education-course"] .education-note-row,body[data-layout="education-course"] .education-caption{display:none;}body[data-layout="marketing"] h2,body[data-layout="marketing"] ul,body[data-layout="data-insight"] h2,body[data-layout="data-insight"] ul,body[data-layout="education-course"] h2,body[data-layout="education-course"] ul{max-width:92%;}body[data-layout="red-gold"] .slide:not(.slide-cover) h2{font-size:26px;}body[data-layout="red-gold"] .slide:not(.slide-cover) ul{font-size:15px;max-width:74%;}}
  </style></head><body data-template="${escapeHtml(visual.id)}" data-layout="${escapeHtml(visual.layout)}"><main>${slides}</main></body></html>`;
}

function strategyConsultingPreviewVars(visual) {
  const scene = strategyConsultingPreviewScene(visual);
  return `--strategy-image:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS[scene.assetKey]}");`;
}

function strategyConsultingPreviewScene(visual) {
  const variant = strategyConsultingVariant(visual);
  const scenes = {
    board: {
      variant: "board",
      assetKey: "business1",
      label: "BOARD BRIEFING",
      chip: "决策",
      marks: ["议题优先级", "经营结论", "行动授权"],
    },
    matrix: {
      variant: "matrix",
      assetKey: "business5",
      label: "MATRIX MODEL",
      chip: "分类",
      marks: ["象限判断", "机会排序", "资源匹配"],
    },
    workstream: {
      variant: "workstream",
      assetKey: "business6",
      label: "WORKSTREAM",
      chip: "推进",
      marks: ["阶段路径", "责任分工", "里程碑"],
    },
  };
  return scenes[variant] || scenes.board;
}

function strategyConsultingVariant(visual) {
  return ["board", "matrix", "workstream"].includes(visual?.variant) ? visual.variant : "board";
}

function isStrategyConsultingVisual(visual) {
  return visual?.id === "strategy-consulting" && visual?.layout === "executive";
}

function financialReviewPreviewScene(visual) {
  const variant = financialReviewVariant(visual);
  const scenes = {
    quarterly: {
      variant: "quarterly",
      label: "FINANCE REVIEW",
      chip: "复盘",
      points: ["收入结构", "利润质量", "现金效率"],
    },
    audit: {
      variant: "audit",
      label: "AUDIT CHECK",
      chip: "审计",
      points: ["差异核验", "风险底稿", "整改闭环"],
    },
    forecast: {
      variant: "forecast",
      label: "FORECAST PLAN",
      chip: "预测",
      points: ["滚动预测", "预算校准", "情景假设"],
    },
  };
  return scenes[variant] || scenes.quarterly;
}

function financialReviewVariant(visual) {
  return ["quarterly", "audit", "forecast"].includes(visual?.variant) ? visual.variant : "quarterly";
}

function isFinancialReviewVisual(visual) {
  return visual?.id === "financial-review" && visual?.layout === "executive";
}

function salesProposalPreviewScene(visual) {
  const variant = salesProposalVariant(visual);
  const scenes = {
    enterprise: {
      variant: "enterprise",
      label: "ENTERPRISE ACCOUNT",
      chip: "客户",
      caption: "客户画像与采购角色",
    },
    solution: {
      variant: "solution",
      label: "SOLUTION MAP",
      chip: "方案",
      caption: "模块组合与交付路径",
    },
    renewal: {
      variant: "renewal",
      label: "RENEWAL GROWTH",
      chip: "增长",
      caption: "续约机会与增购曲线",
    },
  };
  return scenes[variant] || scenes.enterprise;
}

function salesProposalVariant(visual) {
  return ["enterprise", "solution", "renewal"].includes(visual?.variant) ? visual.variant : "enterprise";
}

function isSalesProposalVisual(visual) {
  return visual?.id === "sales-proposal" && visual?.layout === "academy";
}

function productRoadmapPreviewScene(visual) {
  const variant = productRoadmapVariant(visual);
  const scenes = {
    roadmap: {
      variant: "roadmap",
      label: "PRODUCT ROADMAP",
      chip: "路线图",
      caption: "阶段里程碑与能力优先级",
    },
    release: {
      variant: "release",
      label: "VERSION RELEASE",
      chip: "发布",
      caption: "发布节奏与关键特性组合",
    },
    "product-review": {
      variant: "product-review",
      label: "PRODUCT REVIEW",
      chip: "复盘",
      caption: "用户反馈、指标变化和迭代机会",
    },
  };
  return scenes[variant] || scenes.roadmap;
}

function productRoadmapVariant(visual) {
  return ["roadmap", "release", "product-review"].includes(visual?.variant) ? visual.variant : "roadmap";
}

function isProductRoadmapVisual(visual) {
  return visual?.id === "product-roadmap" && visual?.layout === "academy";
}

function pitchDeckPreviewScene(visual) {
  const variant = pitchDeckVariant(visual);
  const scenes = {
    startup: {
      variant: "startup",
      kicker: "FOUNDER STORY",
      section: "TRACTION PATH",
      chip: "创业故事",
      caption: "从用户痛点到可规模化增长的融资叙事",
      metrics: [
        { value: "痛点", label: "创始洞察" },
        { value: "PMF", label: "验证路径" },
        { value: "增长", label: "规模化机会" },
      ],
    },
    investor: {
      variant: "investor",
      kicker: "INVESTOR MEMO",
      section: "CAPITAL PLAN",
      chip: "投资人版",
      caption: "市场空间、商业模型和资金用途的决策视图",
      metrics: [
        { value: "TAM", label: "市场空间" },
        { value: "ARR", label: "收入模型" },
        { value: "Runway", label: "资金计划" },
      ],
    },
    product: {
      variant: "product",
      kicker: "PRODUCT EDGE",
      section: "VALUE PROOF",
      chip: "产品亮点",
      caption: "核心能力、场景价值和差异化证据",
      metrics: [
        { value: "01", label: "核心功能" },
        { value: "3X", label: "效率提升" },
        { value: "NPS", label: "用户口碑" },
      ],
    },
  };
  return scenes[variant] || scenes.startup;
}

function pitchDeckVariant(visual) {
  return ["startup", "investor", "product"].includes(visual?.variant) ? visual.variant : "startup";
}

function isPitchDeckVisual(visual) {
  return visual?.id === "pitch" && visual?.layout === "venture";
}

function marketingCampaignPreviewScene(visual) {
  const variant = marketingCampaignVariant(visual);
  const scenes = {
    launch: {
      variant: "launch",
      kicker: "PRODUCT LAUNCH",
      section: "GO TO MARKET",
      chip: "新品首发",
      caption: "首发卖点、场景化素材与发布节奏",
      metrics: [
        { value: "01", label: "首发卖点" },
        { value: "3", label: "核心场景" },
        { value: "7D", label: "发布节奏" },
      ],
    },
    brand: {
      variant: "brand",
      kicker: "BRAND VOICE",
      section: "CONTENT MATRIX",
      chip: "品牌声量",
      caption: "品牌识别、传播主张与内容矩阵",
      metrics: [
        { value: "VI", label: "识别系统" },
        { value: "3", label: "传播主张" },
        { value: "全域", label: "内容触点" },
      ],
    },
    growth: {
      variant: "growth",
      kicker: "GROWTH LOOP",
      section: "CHANNEL FUNNEL",
      chip: "增长转化",
      caption: "渠道漏斗、转化路径与复购闭环",
      metrics: [
        { value: "AARRR", label: "增长模型" },
        { value: "5", label: "关键触点" },
        { value: "ROI", label: "投放复盘" },
      ],
    },
  };
  return scenes[variant] || scenes.launch;
}

function marketingCampaignVariant(visual) {
  return ["launch", "brand", "growth"].includes(visual?.variant) ? visual.variant : "launch";
}

function isMarketingCampaignVisual(visual) {
  return visual?.id === "marketing-campaign" && visual?.layout === "marketing";
}

function brandStoryPreviewScene(visual) {
  const variant = brandStoryVariant(visual);
  const scenes = {
    editorial: {
      variant: "editorial",
      kicker: "EDITORIAL STORY",
      section: "NARRATIVE ARC",
      chip: "编辑叙事",
      caption: "品牌主张、故事线与传播语境",
      mark: "ST",
      points: ["品牌起点", "核心主张", "传播语境"],
    },
    premium: {
      variant: "premium",
      kicker: "PREMIUM MOOD",
      section: "TEXTURE SYSTEM",
      chip: "高端质感",
      caption: "材质、影调与高级视觉秩序",
      mark: "PR",
      points: ["品质证据", "高级影调", "信任资产"],
    },
    identity: {
      variant: "identity",
      kicker: "BRAND IDENTITY",
      section: "VISUAL CODES",
      chip: "品牌识别",
      caption: "识别符号、色彩系统与触点一致性",
      mark: "ID",
      points: ["识别符号", "色彩系统", "触点规范"],
    },
  };
  return scenes[variant] || scenes.editorial;
}

function brandStoryVariant(visual) {
  return ["editorial", "premium", "identity"].includes(visual?.variant) ? visual.variant : "editorial";
}

function isBrandStoryVisual(visual) {
  return visual?.id === "brand-story" && visual?.layout === "brand-story";
}

function dataInsightPreviewScene(visual) {
  const variant = dataInsightVariant(visual);
  const scenes = {
    dashboard: {
      variant: "dashboard",
      kicker: "DATA COMMAND CENTER",
      section: "KPI DASHBOARD",
      chip: "仪表盘",
      caption: "核心指标、异常波动与经营信号",
      metrics: [
        { value: "KPI", label: "指标总览" },
        { value: "24H", label: "数据刷新" },
        { value: "3", label: "异常信号" },
      ],
    },
    insight: {
      variant: "insight",
      kicker: "INSIGHT FINDINGS",
      section: "SIGNAL ANALYSIS",
      chip: "洞察分析",
      caption: "趋势拆解、原因定位与行动优先级",
      metrics: [
        { value: "01", label: "关键发现" },
        { value: "4", label: "影响因子" },
        { value: "Next", label: "行动建议" },
      ],
    },
    research: {
      variant: "research",
      kicker: "RESEARCH NOTE",
      section: "EVIDENCE REVIEW",
      chip: "研究报告",
      caption: "样本、结论和可追溯的研究证据",
      metrics: [
        { value: "N", label: "样本说明" },
        { value: "CI", label: "置信区间" },
        { value: "Ref", label: "证据索引" },
      ],
    },
  };
  return scenes[variant] || scenes.dashboard;
}

function dataInsightVariant(visual) {
  return ["dashboard", "insight", "research"].includes(visual?.variant) ? visual.variant : "dashboard";
}

function isDataInsightVisual(visual) {
  return visual?.id === "data-insight" && visual?.layout === "data-insight";
}

function educationCoursePreviewScene(visual) {
  const variant = educationCourseVariant(visual);
  const scenes = {
    lecture: {
      variant: "lecture",
      kicker: "CLASSROOM BRIEF",
      section: "LESSON POINTS",
      chip: "课题讲授",
      caption: "概念讲解、板书结构与课堂小结",
      outcomes: ["目标导入", "概念讲授", "课堂总结"],
    },
    workshop: {
      variant: "workshop",
      kicker: "WORKSHOP MAP",
      section: "GROUP ACTIVITY",
      chip: "互动工作坊",
      caption: "分组任务、讨论反馈与共创产出",
      outcomes: ["分组协作", "互动练习", "成果共创"],
    },
    minimal: {
      variant: "minimal",
      kicker: "TEACHING NOTE",
      section: "KEY TAKEAWAYS",
      chip: "简洁教学",
      caption: "清晰讲义、重点标注与复习路径",
      outcomes: ["知识框架", "重点提示", "练习巩固"],
    },
  };
  return scenes[variant] || scenes.lecture;
}

function educationCourseVariant(visual) {
  return ["lecture", "workshop", "minimal"].includes(visual?.variant) ? visual.variant : "lecture";
}

function isEducationCourseVisual(visual) {
  return visual?.id === "education" && visual?.layout === "education-course";
}

function statusReportPreviewVars(visual) {
  const scene = statusReportPreviewScene(visual);
  return `--status-report-image:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS[scene.assetKey]}");`;
}

function statusReportPreviewScene(visual) {
  const variant = statusReportVariant(visual);
  const scenes = {
    weekly: {
      variant: "weekly",
      assetKey: "business4",
      kicker: "PROJECT WEEKLY",
      section: "WEEKLY UPDATE",
      sticker: "进度",
      metrics: [
        { value: "95%", label: "进度达成" },
        { value: "3", label: "关键风险" },
        { value: "7", label: "本周事项" },
      ],
    },
    steering: {
      variant: "steering",
      assetKey: "business2",
      kicker: "STEERING MEETING",
      section: "DECISION REVIEW",
      sticker: "决策",
      metrics: [
        { value: "4", label: "核心议题" },
        { value: "2", label: "待决事项" },
        { value: "8", label: "行动责任" },
      ],
    },
    delivery: {
      variant: "delivery",
      assetKey: "business6",
      kicker: "DELIVERY TRACK",
      section: "MILESTONE CHECK",
      sticker: "验收",
      metrics: [
        { value: "12", label: "交付节点" },
        { value: "96%", label: "验收通过" },
        { value: "5", label: "风险闭环" },
      ],
    },
  };
  return scenes[variant] || scenes.weekly;
}

function statusReportVariant(visual) {
  return ["weekly", "steering", "delivery"].includes(visual?.variant) ? visual.variant : "weekly";
}

function redGoldPreviewVars(visual) {
  const palette = redGoldColorPalette(visual);
  return `--dome-cover-bg:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.cover}");--dome-content-bg:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.content}");--dome-business-1:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business1}");--dome-business-2:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business2}");--dome-business-3:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business3}");--dome-business-4:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business4}");--dome-business-5:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business5}");--dome-business-6:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business6}");`
    + `--dome-title-grad-start:#${palette.titleGradientStart};--dome-title-grad-end:#${palette.titleGradientEnd};`
    + `--dome-card-fill:#${palette.cardFill};--dome-card-fill-strong:#${palette.cardFillStrong};`
    + `--dome-content-panel:#${palette.contentPanel};--dome-surface-stroke:#${palette.surfaceStroke};--dome-card-stroke:#${palette.cardStroke};--dome-frame-stroke:#${palette.frameStroke};`
    + `--dome-card-stroke-rgb:${palette.cardStrokeRgb};--dome-frame-stroke-rgb:${palette.frameStrokeRgb};`
    + `--dome-surface-text:#${palette.surfaceText};--dome-surface-highlight:#${palette.surfaceHighlight};`
    + `--dome-soft-line:#${palette.softLine};--dome-soft-rgb:${palette.softRgb};--dome-accent-rgb:${hexToRgbString(visual.accent)};`
    + `--dome-primary-rgb:${palette.primaryRgb};--dome-primary:#${visual.primary};`;
}

/**
 * 判断 dome 预览页是否还需要普通正文列表。
 * 对已经有模板占位符承载 bullets 的版式，预览端隐藏普通列表，避免用户看到重复内容。
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderDomePreviewBodyList(visual, role) {
  if (visual.layout !== "red-gold") return true;
  return !["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(role);
}

/**
 * 渲染与 PPTX 导出端 Content Placement Card 对齐的内容承载面。
 * 这些角色在导出文件里都有白色圆角大面板，预览端也必须输出同层级结构，避免用户看到的页面和下载 PPTX 不一致。
 * @param {string} role
 * @returns {string}
 */
function renderDomePreviewContentSurface(role) {
  if (!["image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan"].includes(role)) return "";
  return `<div class="dome-role-decor dome-content-surface"></div>`;
}

/**
 * 渲染与 PPTX 导出端 Dome Content Frame 对齐的内容内框。
 * 导出端除封面/结束页外都会写入该框线，预览端同步输出，避免用户看到的边框层级和 WPS 打开的 PPTX 不一致。
 * @param {string} role
 * @returns {string}
 */
function renderDomePreviewContentFrame(role) {
  if (["cover", "closing"].includes(role)) return "";
  return `<div class="dome-role-decor dome-content-frame"></div>`;
}

/**
 * 渲染 dome 预览页脚装饰。
 * PPTX 导出每页都会生成 Dome Footer Decoration，预览端也显式输出同名视觉层，避免预览和导出不一致。
 * @param {object} visual
 * @returns {string}
 */
function renderDomePreviewFooter(visual) {
  if (visual.layout !== "red-gold") return "";
  return `<div class="dome-role-decor dome-footer-decoration"></div>`;
}

/**
 * 渲染 dome 预览底部圆弧波浪。
 * 这两层 HTML 装饰对应 PPTX 导出的 Dome Gold/Light Wave Arc，保证预览和导出看到同一套底部波浪层级。
 * @param {object} visual
 * @returns {string}
 */
function renderDomePreviewWaves(visual) {
  if (visual.layout !== "red-gold") return "";
  return `<div class="dome-role-decor dome-wave-arc dome-wave-gold"></div><div class="dome-role-decor dome-wave-arc dome-wave-light"></div>`;
}

/**
 * 预览端使用与 PPTX 导出一致的页面角色判断。
 * 这样用户看到的封面、目录、章节页和结束页，不会在导出时变成另一套布局。
 * @param {object} slide
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
function resolvePreviewDomeRole(slide, index, total) {
  const explicit = String(slide?.layout || "").toLowerCase();
  if (["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(explicit)) return explicit;
  if (index === 0) return "cover";
  if (index === total - 1 && /结束|谢谢|感谢|thanks/i.test(String(slide?.title || ""))) return "closing";
  if (/目录|contents?/i.test(String(slide?.title || ""))) return "agenda";
  if (/part|章节|工作汇报|成果展示|问题不足|下步计划/i.test(String(slide?.title || "")) && (slide?.bullets || []).length <= 1) return "section-divider";
  if (/指标|数据|kpi|metric/i.test(String(slide?.title || ""))) return "metrics";
  if (/成果|展示|亮点/i.test(String(slide?.title || ""))) return "showcase";
  if (/问题|复盘|不足|风险/i.test(String(slide?.title || ""))) return "retrospective";
  if (/计划|下一步|下步/i.test(String(slide?.title || ""))) return "next-plan";
  if (/概况|汇报|图文|进展/i.test(String(slide?.title || ""))) return "image-report";
  if ((slide?.bullets || []).length >= 4) return "four-steps";
  if ((slide?.bullets || []).length === 3) return "three-steps";
  return "image-report";
}

/**
 * 为 HTML 预览生成与 dome 角色匹配的视觉占位符。
 * PPTX 导出会生成真实 OOXML 形状；这里生成轻量 HTML 层，保证用户预览时能看到同样的版式意图。
 * @param {string} role
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function renderDomePreviewDecoration(role, slide, index) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  // 统一从结构化 bullet 中读取展示文本，避免不同页面角色各自直出对象导致预览出现 [object Object]。
  const bulletText = (itemIndex) => domePreviewStructuredText(bullets[itemIndex], ["text", "title", "label", "name", "action", "task", "description", "value"]);
  if (role === "cover") {
    // 封面页把第一条结构化内容放入副标题占位，预览时保持 dome.pptx 帆船封面的简洁留白。
    return `<div class="dome-role-decor dome-cover-subtitle">${escapeHtml(bulletText(0))}</div>`;
  }
  if (role === "agenda") {
    // 目录页固定保留 4 个卡片占位符，和 dome.pptx/PPTX 导出保持一致，避免少量目录项导致版式塌陷。
    const cards = normalizeDomePreviewAgendaItems(slide).map((item, index) => `<div class="dome-agenda-card"><span class="dome-agenda-number">0${index + 1}</span><span class="dome-agenda-text">${escapeHtml(item)}</span></div>`).join("");
    return `<div class="dome-role-decor dome-agenda-grid">${cards}</div>`;
  }
  if (role === "section-divider") {
    // 章节分隔页同步 PPTX 里的 Dome Section Divider Line，让预览也保留章节编号下方的金色分割线层级。
    return `<div class="dome-role-decor dome-section-number">${escapeHtml(domePreviewSectionNumberText(slide, index))}</div><div class="dome-role-decor dome-section-divider-line"></div>`;
  }
  if (role === "three-steps" || role === "four-steps") {
    const count = role === "three-steps" ? 3 : 4;
    const cards = Array.from({ length: count }, (_, index) => renderDomePreviewCard("dome-step-card", index, bulletText(index))).join("");
    // 三/四步骤流程页都显示商务图片层，让预览与 PPTX 导出的流程页视觉结构一致。
    const visual = `<div class="dome-role-visual"></div>`;
    return `${renderDomePreviewSectionLabel(slide, index)}${visual}<div class="dome-role-decor dome-step-connector"></div><div class="dome-role-decor dome-step-row" style="grid-template-columns:repeat(${count},minmax(0,1fr))">${cards}</div>`;
  }
  if (role === "metrics") {
    const cards = normalizeDomePreviewMetricItems(slide, 3).map((metric) => `<div class="dome-metric-card"><span class="dome-metric-value">${escapeHtml(metric.value)}</span><span class="dome-metric-label">${escapeHtml(metric.label)}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-metric-grid">${cards}</div>`;
  }
  if (role === "showcase") {
    // 成果展示页将编号和成果内容拆成两个视觉层，和 PPTX 的 Dome Showcase Number/Text 占位保持一致。
    const cards = Array.from({ length: 3 }, (_, index) => `<div class="dome-showcase-card"><span class="dome-showcase-number">0${index + 1}</span><span class="dome-showcase-text">${escapeHtml(bulletText(index))}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-showcase-grid">${cards}</div>`;
  }
  if (role === "image-report") {
    // 工作汇报图文页用三张固定卡片承载要点，保持图文模板的占位符结构。
    const cards = Array.from({ length: 3 }, (_, index) => renderDomePreviewCard("dome-image-report-card", index, bulletText(index))).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-image-report-grid">${cards}</div>`;
  }
  if (role === "retrospective") {
    // 问题复盘页固定输出“风险/原因/措施”语义标签，和 PPTX 端的独立标签占位保持一致。
    const labels = ["风险", "原因", "措施"];
    const cards = Array.from({ length: 3 }, (_, index) => `<div class="dome-retrospective-card"><span class="dome-retrospective-label">${labels[index]}</span><span class="dome-card-text">${escapeHtml(bulletText(index))}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-retrospective-grid">${cards}</div><div class="dome-role-decor dome-risk-card"><span class="dome-card-text">${escapeHtml(bulletText(0) || "RISK")}</span></div>`;
  }
  if (role === "next-plan") {
    // 下一步计划页支持“阶段: 动作”结构化输入，预览端拆成阶段和动作两个占位层。
    const cards = normalizeDomePreviewPlanItems(slide, 4).map((item) => `<div class="dome-step-card"><span class="dome-next-plan-phase">${escapeHtml(item.phase)}</span><span class="dome-next-plan-action">${escapeHtml(item.action)}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-plan-timeline"></div><div class="dome-role-decor dome-step-row">${cards}</div>`;
  }
  if (role === "closing") {
    // 结束页把用户输入作为模板副标题输出，避免破坏 THANKS 结束版式。
    return `<div class="dome-role-decor dome-closing-subtitle">${escapeHtml(bulletText(0))}</div>`;
  }
  return "";
}

/**
 * 生成 dome 预览目录页的 4 个卡片文案。
 * 用户少填目录项时使用模板默认四段补齐，让预览与导出的卡片式目录保持完整。
 * @param {object} slide
 * @returns {string[]}
 */
function normalizeDomePreviewAgendaItems(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: 4 }, (_, index) => domePreviewStructuredText(bullets[index], ["text", "title", "label", "name"]) || DOME_AGENDA_DEFAULT_ITEMS[index] || "");
}

/**
 * 解析 dome 预览指标页的结构化要点。
 * 支持“指标名: 指标值 / 指标名：指标值 / 指标名|指标值”，与 PPTX 导出保持一致。
 * @param {object} slide
 * @param {number} count
 * @returns {{label: string, value: string}[]}
 */
function normalizeDomePreviewMetricItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => {
    const rawItem = bullets[index];
    if (isPlainObject(rawItem)) {
      return {
        label: domePreviewStructuredText(rawItem, ["label", "name", "title", "text"]) || "",
        value: domePreviewStructuredText(rawItem, ["value", "amount", "metric", "number"]) || `0${index + 1}`,
      };
    }
    const item = domePreviewStructuredText(rawItem, ["text"]);
    const match = item.match(/^(.+?)\s*[:：|]\s*(.+)$/);
    if (!match) return { label: item, value: `0${index + 1}` };
    return { label: match[1].trim(), value: match[2].trim() };
  });
}

/**
 * 解析 dome 下一步计划页的结构化要点。
 * 支持“阶段: 动作 / 阶段：动作 / 阶段|动作”，无分隔符时按旧编号兜底。
 * @param {object} slide
 * @param {number} count
 * @returns {{phase: string, action: string}[]}
 */
function normalizeDomePreviewPlanItems(slide, count) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: count }, (_, index) => {
    const rawItem = bullets[index];
    if (isPlainObject(rawItem)) {
      return {
        phase: domePreviewStructuredText(rawItem, ["phase", "stage", "name", "label", "title"]) || `0${index + 1}`,
        action: domePreviewStructuredText(rawItem, ["action", "task", "text", "description", "value"]) || "",
      };
    }
    const item = domePreviewStructuredText(rawItem, ["text"]);
    const match = item.match(/^(.+?)\s*[:：|]\s*(.*)$/);
    if (!match) return { phase: `0${index + 1}`, action: item };
    return { phase: match[1].trim(), action: match[2].trim() };
  });
}

/**
 * 从预览端结构化 bullet 中读取占位符文本。
 * 支持对象输入，避免 HTML 预览出现 [object Object]，并保持与 PPTX 导出一致。
 * @param {unknown} value
 * @param {string[]} preferredKeys
 * @returns {string}
 */
function domePreviewStructuredText(value, preferredKeys) {
  if (value == null) return "";
  if (!isPlainObject(value)) return String(value);
  for (const key of preferredKeys) {
    if (value[key] != null && value[key] !== "") return String(value[key]);
  }
  return "";
}

/**
 * 判断值是否为普通结构化对象。
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 读取预览端章节分隔页的结构化编号。
 * 与 PPTX 导出一致，优先使用 bullets[0]；缺省时按页序生成稳定 PART 编号，避免预览出现 PART 00。
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domePreviewSectionNumberText(slide, index) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return domePreviewStructuredText(bullets[0], ["text", "title", "label", "name"]) || `PART ${String(index).padStart(2, "0")}`;
}

/**
 * 渲染内容页预览右上角章节标签。
 * 与 PPTX 导出一致：优先使用 outline 结构化章节字段，缺省时按页序兜底，确保预览能看到导出中的章节标签。
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function renderDomePreviewSectionLabel(slide, index) {
  const label = String(slide?.sectionLabel || slide?.section || `PART ${String(index).padStart(2, "0")}`);
  return `<div class="dome-role-decor dome-section-label">${escapeHtml(label)}</div>`;
}

/**
 * 渲染 dome 预览里的编号卡片。
 * 这里的结构与 PPTX 卡片文本层保持一致，便于用户预览结构化内容是否进入正确占位符。
 * @param {string} className
 * @param {number} index
 * @param {unknown} text
 * @returns {string}
 */
function renderDomePreviewCard(className, index, text) {
  return `<div class="${className}"><span class="dome-card-index">0${index + 1}</span><span class="dome-card-text">${escapeHtml(text || "")}</span></div>`;
}

/**
 * Normalizes and validates requested slide count.
 * @param {unknown} value
 * @returns {number}
 */
function normalizeSlideCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_SLIDE_COUNT || parsed > MAX_SLIDE_COUNT) {
    throw new AppError({
      code: "SLIDE_COUNT_INVALID",
      status: 400,
      message: `SLIDE_COUNT_INVALID: slideCount must be an integer between ${MIN_SLIDE_COUNT} and ${MAX_SLIDE_COUNT}`,
    });
  }
  return parsed;
}

/**
 * Validates that the selected theme is supported by the template.
 * @param {{template: object, theme: string}} input
 * @returns {void}
 */
function validateTemplateTheme({ template, theme }) {
  const themes = Array.isArray(template.themes) ? template.themes : [];
  const themeIds = themes.map((item) => (item && typeof item === "object" ? item.id : item));
  if (themeIds.length && !themeIds.includes(theme)) {
    throw new AppError({
      code: "THEME_NOT_SUPPORTED",
      status: 400,
      message: `THEME_NOT_SUPPORTED: ${theme} is not supported by template ${template.id}`,
    });
  }
}

/**
 * Returns whether an entitlement is currently usable for charging.
 * @param {object} balance
 * @returns {boolean}
 */
function isEntitlementUsable(balance) {
  if (typeof balance?.usable === "boolean") return balance.usable;
  if (typeof balance?.usable === "number") return balance.usable === 1;
  if (typeof balance?.usable === "string") return balance.usable === "true" || balance.usable === "1";
  if (balance?.status !== undefined) return String(balance.status) === "active";
  return true;
}

/**
 * Validates user-edited outline slides before chargeable deck generation.
 * @param {unknown} slides
 * @returns {void}
 */
function validateOutlineSlides(slides) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new AppError({ code: "OUTLINE_INVALID", status: 400, message: "Outline slides must be a non-empty array" });
  }
  if (slides.length > MAX_SLIDE_COUNT) {
    throw new AppError({ code: "OUTLINE_INVALID", status: 400, message: `Outline slides must not exceed ${MAX_SLIDE_COUNT}` });
  }
  for (const slide of slides) {
    const title = typeof slide?.title === "string" ? slide.title.trim() : "";
    const bullets = slide?.bullets;
    if (!title || !Array.isArray(bullets) || !bullets.every((bullet) => typeof bullet === "string")) {
      throw new AppError({ code: "OUTLINE_INVALID", status: 400, message: "Each outline slide must include a title and string bullets" });
    }
  }
}

/**
 * Normalizes provider slide JSON after validating the required schema surface.
 * @param {{slides: unknown, outline: object, template: object}} input
 * @returns {object[]}
 */
function normalizeGeneratedSlides({ slides, outline, template }) {
  const outlineSlides = Array.isArray(outline?.slides) ? outline.slides : [];
  if (!Array.isArray(slides)) {
    throwSlideSchemaError("slides must be an array");
  }
  if (slides.length !== outlineSlides.length) {
    throwSlideSchemaError(`slides length must match outline length ${outlineSlides.length}`);
  }
  return slides.map((slide, index) => {
    if (!slide || typeof slide !== "object" || Array.isArray(slide)) {
      throwSlideSchemaError(`slide ${index + 1} must be an object`);
    }
    const outlineSlide = outlineSlides[index] || {};
    const mergedSlide = { ...outlineSlide, ...slide };
    const structuredMetadata = preserveStructuredSlideMetadata({ outlineSlide, generatedSlide: slide });
    const title = typeof slide.title === "string" ? slide.title.trim() : "";
    if (!title) {
      throwSlideSchemaError(`slide ${index + 1} title must be a non-empty string`);
    }
    if (!Array.isArray(slide.bullets) || !slide.bullets.every((bullet) => typeof bullet === "string")) {
      throwSlideSchemaError(`slide ${index + 1} bullets must be an array of strings`);
    }
    return {
      ...slide,
      ...structuredMetadata,
      id: normalizeSlideId(slide.id, index),
      sortOrder: normalizeSortOrder(slide.sortOrder, index),
      title,
      bullets: slide.bullets,
      speakerNotes: typeof slide.speakerNotes === "string" ? slide.speakerNotes : "",
      layout: normalizeSlideLayout({ layout: slide.layout || outlineSlide.layout, template, index, total: outlineSlides.length, slide: mergedSlide }),
      theme: normalizeSlideText(slide.theme, outline.theme || "modern"),
    };
  });
}

/**
 * Builds safe deck content from the confirmed outline when AI slide JSON remains invalid.
 * @param {{outline: object, template: object}} input
 * @returns {object[]}
 */
function buildFallbackSlides({ outline, template }) {
  const outlineSlides = Array.isArray(outline?.slides) ? outline.slides : [];
  return outlineSlides.map((slide, index) => {
    const title = normalizeSlideText(slide?.title, `Slide ${index + 1}`);
    return {
      ...preserveStructuredSlideMetadata({ outlineSlide: slide, generatedSlide: {} }),
      id: `slide_${index + 1}`,
      sortOrder: index + 1,
      title,
      bullets: normalizeBulletList(slide?.bullets),
      speakerNotes: `Generated from confirmed outline: ${title}`,
      layout: normalizeSlideLayout({ layout: "", template, index, total: outlineSlides.length, slide }),
      theme: outline.theme || "modern",
      fallback: true,
    };
  });
}

/**
 * 保留 outline 中会驱动模板占位符的结构化字段。
 * 只复制明确用于 dome 章节标签的字段，避免把 outline 的内部状态无意写入最终 deck。
 * @param {{outlineSlide: object, generatedSlide: object}} input
 * @returns {object}
 */
function preserveStructuredSlideMetadata({ outlineSlide, generatedSlide }) {
  const metadata = {};
  if (typeof generatedSlide?.sectionLabel === "string" && generatedSlide.sectionLabel.trim()) {
    metadata.sectionLabel = generatedSlide.sectionLabel.trim();
  } else if (typeof outlineSlide?.sectionLabel === "string" && outlineSlide.sectionLabel.trim()) {
    metadata.sectionLabel = outlineSlide.sectionLabel.trim();
  }
  if (typeof generatedSlide?.section === "string" && generatedSlide.section.trim()) {
    metadata.section = generatedSlide.section.trim();
  } else if (typeof outlineSlide?.section === "string" && outlineSlide.section.trim()) {
    metadata.section = outlineSlide.section.trim();
  }
  return metadata;
}

/**
 * Throws a typed slide schema error for retry and fallback handling.
 * @param {string} message
 * @returns {never}
 */
function throwSlideSchemaError(message) {
  throw new AppError({
    code: "SLIDE_SCHEMA_INVALID",
    status: 502,
    message: `SLIDE_SCHEMA_INVALID: ${message}`,
  });
}

/**
 * Returns whether an error was produced by slide schema validation.
 * @param {unknown} error
 * @returns {boolean}
 */
function isSlideSchemaError(error) {
  return error?.code === "SLIDE_SCHEMA_INVALID";
}

/**
 * Normalizes a generated slide ID.
 * @param {unknown} value
 * @param {number} index
 * @returns {string}
 */
function normalizeSlideId(value, index) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || `slide_${index + 1}`;
}

/**
 * Normalizes a generated slide sort order.
 * @param {unknown} value
 * @param {number} index
 * @returns {number}
 */
function normalizeSortOrder(value, index) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : index + 1;
}

/**
 * Normalizes required string fields with a fallback.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeSlideText(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

/**
 * Normalizes a slide layout against the selected template schema.
 * dome 模板在 AI 未返回可用 layout 时，会根据 outline 结构自动推断页面角色，避免整份 deck 退化为同一种图文页。
 * @param {{layout: unknown, template: object, index: number, total?: number, slide?: object}} input
 * @returns {string}
 */
function normalizeSlideLayout({ layout, template, index, total = 0, slide = {} }) {
  const schema = template?.layoutSchema || {};
  const fallback = index === 0
    ? schema.defaultCoverLayout || "title"
    : schema.defaultContentLayout || "content";
  const rawLayout = typeof layout === "string" ? layout.trim() : "";
  if (!rawLayout && isDomeTemplate(template)) return inferDomeLayoutRole({ slide, index, total });
  const normalized = rawLayout || fallback;
  const allowedLayouts = Array.isArray(schema.allowedLayouts) ? schema.allowedLayouts : [];
  if (allowedLayouts.length === 0 || allowedLayouts.includes(normalized)) return normalized;
  if (isDomeTemplate(template)) return inferDomeLayoutRole({ slide, index, total });
  return fallback;
}

/**
 * 判断模板是否使用 dome.pptx 的 red-gold 版式体系。
 * @param {object} template
 * @returns {boolean}
 */
function isDomeTemplate(template) {
  return template?.visual?.layout === "red-gold";
}

/**
 * 根据已确认 outline 的页面结构推断 dome 版式角色。
 * 这里和预览/导出的角色语义保持一致，让用户无需手写 layout 也能进入对应占位符。
 * @param {{slide: object, index: number, total: number}} input
 * @returns {string}
 */
function inferDomeLayoutRole({ slide, index, total }) {
  const title = String(slide?.title || "");
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  if (index === 0) return "cover";
  if (index === total - 1 && /结束|谢谢|感谢|thanks/i.test(title)) return "closing";
  if (/目录|contents?/i.test(title)) return "agenda";
  if (/part|章节|工作汇报|成果展示|问题不足|下步计划/i.test(title) && bullets.length <= 1) return "section-divider";
  if (/指标|数据|kpi|metric/i.test(title)) return "metrics";
  if (/成果|展示|亮点/i.test(title)) return "showcase";
  if (/问题|复盘|不足|风险/i.test(title)) return "retrospective";
  if (/计划|下一步|下步/i.test(title)) return "next-plan";
  if (/概况|汇报|图文|进展/i.test(title)) return "image-report";
  if (bullets.length >= 4) return "four-steps";
  if (bullets.length === 3) return "three-steps";
  return "image-report";
}

/**
 * Normalizes outline bullets for fallback slide content.
 * @param {unknown} bullets
 * @returns {string[]}
 */
function normalizeBulletList(bullets) {
  return Array.isArray(bullets) ? bullets.filter((bullet) => typeof bullet === "string") : [];
}

/**
 * Resolves a slide by stable ID, sort order, or one-based display index.
 * @param {object[]} slides
 * @param {unknown} requestedSlideId
 * @returns {object | undefined}
 */
function resolveSlide(slides, requestedSlideId) {
  const normalized = String(requestedSlideId ?? "").trim();
  if (!normalized) return undefined;
  const exact = slides.find((slide) => String(slide.id) === normalized);
  if (exact) return exact;
  const numeric = Number(normalized);
  if (!Number.isInteger(numeric) || numeric < 1) return undefined;
  return slides.find((slide) => Number(slide.sortOrder) === numeric) || slides[numeric - 1];
}

/**
 * Keeps persisted slide identity stable after AI regeneration.
 * 单页重生成只替换内容，不允许模型返回值破坏 dome 模板的版式角色和章节占位字段。
 * @param {{original: object, regenerated: object}} input
 * @returns {object}
 */
function normalizeRegeneratedSlide({ original, regenerated }) {
  const structuredMetadata = preserveStructuredSlideMetadata({ outlineSlide: original, generatedSlide: {} });
  const stableLayout = typeof original?.layout === "string" && original.layout.trim() ? { layout: original.layout } : {};
  return {
    ...original,
    ...(regenerated && typeof regenerated === "object" ? regenerated : {}),
    ...structuredMetadata,
    ...stableLayout,
    id: original.id,
    sortOrder: original.sortOrder,
  };
}

/**
 * Blocks user-facing deck operations until billing has settled.
 * @param {object} deck
 * @returns {void}
 */
function assertDeckReady(deck) {
  if (deck.status !== "ready") {
    throw new AppError({
      code: "DECK_BILLING_PENDING",
      status: 409,
      message: "Deck billing settlement is pending",
      publicDetails: { deck_id: deck.id, status: deck.status },
    });
  }
}

/**
 * Normalizes an operational reconciliation batch limit.
 * @param {unknown} value
 * @returns {number}
 */
function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}
