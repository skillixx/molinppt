import { readFileSync } from "node:fs";

import { AppError } from "./errors.js";
import { resolveTemplateVisual } from "./templates.js";

const DOME_PREVIEW_ASSET_BASE_URL = new URL("../../templates/official/business/business/modern/assets/", import.meta.url);
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
   * Applies a different template to an existing ready deck without regenerating slide content.
   * @param {{ownerUserId: number, deckId: string, templateId: string, theme?: string}} input
   * @returns {Promise<object>}
   */
  async applyTemplateToDeck({ ownerUserId, deckId, templateId, theme = "modern" }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    assertDeckReady(deck);
    const template = this.templateManager.getTemplate(templateId, { ownerUserId });
    validateTemplateTheme({ template, theme });
    const templateVisual = resolveTemplateVisual({
      templateId,
      theme,
      template: { id: template.id, name: template.name, visual: template.visual, themes: template.themes },
    });
    const updatedDeck = await this.database.update("decks", deck.id, {
      templateId,
      templateName: template.name,
      templateVisual,
      templateLayoutSchema: template.layoutSchema,
      theme,
      status: "ready",
    });
    const activeAsset = await this.database.findOne("ppt_assets", (asset) => (
      asset.deckId === deck.id && Number(asset.ownerUserId) === Number(ownerUserId) && asset.status === "active"
    ));
    if (activeAsset) {
      await this.database.update("ppt_assets", activeAsset.id, {
        templateId,
        templateName: template.name,
        theme,
      });
    }
    await this.#log({ ownerUserId, action: "deck_template_applied", resourceType: "deck", resourceId: deck.id });
    return updatedDeck;
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
    // dome 妯℃澘鍏佽浠绘剰椤垫樉寮忓０鏄庡皝闈?缁撴潫鐗堝紡锛岄瑙?class 蹇呴』璺熼殢瑙掕壊鎵嶈兘濂楃敤甯嗚埞鑳屾櫙銆?
    const slideKind = isDomeLayout && ["cover", "closing"].includes(domeRole) ? "cover" : index === 0 ? "cover" : "body";
    const renderBodyList = shouldRenderTemplatePreviewBodyList(visual, domeRole);
    const bullets = renderBodyList
      ? (slide.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")
      : "";
    // dome 模板化页面的内容已经落入专用视觉层，不输出空 ul锛岄伩鍏嶉瑙堝眰绾у拰闂磋窛琚櫘閫氬垪琛ㄥ共鎵般€?
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
    const financialSolutionScene = isFinancialSolutionVisual(visual) ? financialSolutionPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const manufacturingSolutionScene = isManufacturingSolutionVisual(visual) ? manufacturingSolutionPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const educationSolutionScene = isEducationSolutionVisual(visual) ? educationSolutionPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const productScene = isProductRoadmapVisual(visual) ? productRoadmapPreviewScene(visual) : null;
    const pitchScene = isPitchDeckVisual(visual) ? pitchDeckPreviewScene(visual) : null;
    const marketingScene = isMarketingCampaignVisual(visual) ? marketingCampaignPreviewScene(visual) : null;
    const launchRhythmScene = isLaunchRhythmVisual(visual) ? launchRhythmPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const brandStoryScene = isBrandStoryVisual(visual) ? brandStoryPreviewScene(visual) : null;
    const dataInsightScene = isDataInsightVisual(visual) ? dataInsightPreviewScene(visual) : null;
    const educationScene = isEducationCourseVisual(visual) ? educationCoursePreviewScene(visual) : null;
    const annualSummaryScene = isAnnualSummaryVisual(visual) ? annualSummaryPreviewScene(visual) : null;
    const quarterlyDashboardScene = isQuarterlyDashboardVisual(visual) ? quarterlyDashboardPreviewScene({ visual, slide, index }) : null;
    const quarterlyDiagnosisScene = isQuarterlyDiagnosisVisual(visual) ? quarterlyDiagnosisPreviewScene(visual) : null;
    const quarterlyActionLoopScene = isQuarterlyActionLoopVisual(visual) ? quarterlyActionLoopPreviewScene(visual) : null;
    const industryResearchScene = isIndustryResearchVisual(visual) ? industryResearchPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const budgetPlanningScene = isBudgetPlanningVisual(visual) ? budgetPlanningPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const budgetVarianceScene = isBudgetVarianceVisual(visual) ? budgetVariancePreviewScene({ slide, index, total: deck.slides.length }) : null;
    const budgetAdjustmentScene = isBudgetAdjustmentVisual(visual) ? budgetAdjustmentPreviewScene({ slide, index, total: deck.slides.length }) : null;
    const statusReportMark = statusReportScene
      ? (
          `${index === 0
            ? `<div class="status-report-kicker">${escapeHtml(statusReportScene.kicker)}</div><div class="status-report-hero-panel"></div><div class="status-report-metrics">${statusReportScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="status-report-section">${escapeHtml(statusReportScene.section)}</div><div class="status-report-checklist"><span></span><span></span><span></span></div>`}`
          + `<div class="status-report-sticker">${escapeHtml(statusReportScene.sticker)}</div><div class="status-report-photo"></div><div class="status-report-photo-frame"></div><div class="status-report-timeline"><span></span><span></span><span></span><span></span></div><div class="status-report-corner"></div>`
        )
      : "";
    const strategyMark = strategyScene
      ? `<div class="strategy-photo"></div><div class="strategy-photo-frame"></div><div class="strategy-label">${escapeHtml(strategyScene.label)}</div><div class="strategy-chip" aria-hidden="true"></div>`
      : "";
    const financeMark = financeScene
      ? `<div class="finance-label">${escapeHtml(financeScene.label)}</div><div class="finance-visual" data-finance-kind="${escapeHtml(financeScene.variant)}"><span></span><span></span><span></span><span></span></div><div class="finance-chip" aria-hidden="true"></div>`
      : "";
    const salesMark = salesScene
      ? `<div class="sales-label">${escapeHtml(salesScene.label)}</div><div class="sales-visual"><span></span><span></span><span></span><span></span></div><div class="sales-chip" aria-hidden="true"></div><div class="sales-caption">${escapeHtml(salesScene.caption)}</div>`
      : "";
    const financialSolutionMark = financialSolutionScene
      ? renderFinancialSolutionPreview(slide, financialSolutionScene)
      : "";
    const manufacturingSolutionMark = manufacturingSolutionScene
      ? renderManufacturingSolutionPreview(slide, manufacturingSolutionScene)
      : "";
    const educationSolutionMark = educationSolutionScene
      ? renderEducationSolutionPreview(slide, educationSolutionScene)
      : "";
    const productMark = productScene
      ? `<div class="product-label">${escapeHtml(productScene.label)}</div><div class="product-chip" aria-hidden="true"></div><div class="product-visual"><span></span><span></span><span></span><span></span></div><div class="product-caption">${escapeHtml(productScene.caption)}</div>`
      : "";
    const pitchMark = pitchScene
      ? (
          `${index === 0
            ? `<div class="pitch-kicker">${escapeHtml(pitchScene.kicker)}</div><div class="pitch-metrics">${pitchScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="pitch-kicker">${escapeHtml(pitchScene.section)}</div><div class="pitch-proof-row"><span></span><span></span><span></span></div>`}`
          + `<div class="pitch-chip" aria-hidden="true"></div><div class="pitch-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="pitch-caption">${escapeHtml(pitchScene.caption)}</div><div class="pitch-arc"></div>`
        )
      : "";
    const marketingMark = marketingScene
      ? (
          `${index === 0
            ? `<div class="marketing-kicker">${escapeHtml(marketingScene.kicker)}</div><div class="marketing-hero-spotlight"></div><div class="marketing-metrics">${marketingScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="marketing-kicker">${escapeHtml(marketingScene.section)}</div><div class="marketing-channel-row"><span></span><span></span><span></span></div>`}`
          + `<div class="marketing-chip" aria-hidden="true"></div><div class="marketing-visual"><span></span><span></span><span></span><span></span></div><div class="marketing-caption">${escapeHtml(marketingScene.caption)}</div><div class="marketing-orbit"></div>`
        )
      : "";
    const launchRhythmMark = launchRhythmScene
      ? renderLaunchRhythmPreview(slide, launchRhythmScene)
      : "";
    const brandStoryMark = brandStoryScene
      ? (
          `${index === 0
            ? `<div class="brand-story-kicker">${escapeHtml(brandStoryScene.kicker)}</div><div class="brand-story-editorial-rule"></div><div class="brand-story-points">${brandStoryScene.points.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>`
            : `<div class="brand-story-kicker">${escapeHtml(brandStoryScene.section)}</div><div class="brand-story-content-index"><span>01</span><span>02</span><span>03</span></div>`}`
          + `<div class="brand-story-chip" aria-hidden="true"></div><div class="brand-story-image"><span></span><span></span><span></span><span></span><span></span></div><div class="brand-story-caption">${escapeHtml(brandStoryScene.caption)}</div><div class="brand-story-monogram">${escapeHtml(brandStoryScene.mark)}</div>`
        )
      : "";
    const dataInsightMark = dataInsightScene
      ? (
          `${index === 0
            ? `<div class="data-insight-kicker">${escapeHtml(dataInsightScene.kicker)}</div><div class="data-insight-hero-grid"><span><strong>${escapeHtml(dataInsightScene.metrics[0].value)}</strong>${escapeHtml(dataInsightScene.metrics[0].label)}</span><span><strong>${escapeHtml(dataInsightScene.metrics[1].value)}</strong>${escapeHtml(dataInsightScene.metrics[1].label)}</span><span><strong>${escapeHtml(dataInsightScene.metrics[2].value)}</strong>${escapeHtml(dataInsightScene.metrics[2].label)}</span></div>`
            : `<div class="data-insight-kicker">${escapeHtml(dataInsightScene.section)}</div><div class="data-insight-mini-row"><span></span><span></span><span></span></div>`}`
          + `<div class="data-insight-chip" aria-hidden="true"></div><div class="data-insight-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="data-insight-caption">${escapeHtml(dataInsightScene.caption)}</div><div class="data-insight-scanline"></div>`
        )
      : "";
    const educationMark = educationScene
      ? (
          `${index === 0
            ? `<div class="education-kicker">${escapeHtml(educationScene.kicker)}</div><div class="education-outcomes">${educationScene.outcomes.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
            : `<div class="education-kicker">${escapeHtml(educationScene.section)}</div><div class="education-note-row"><span></span><span></span><span></span></div>`}`
          + `<div class="education-chip" aria-hidden="true"></div><div class="education-visual"><span></span><span></span><span></span><span></span><span></span></div><div class="education-caption">${escapeHtml(educationScene.caption)}</div>`
        )
      : "";
    const annualSummaryMark = annualSummaryScene
      ? (
          `${index === 0
            ? `<div class="annual-summary-kicker">${escapeHtml(annualSummaryScene.kicker)}</div><div class="annual-summary-doc"><span></span><span></span><span></span><span></span><span></span></div><div class="annual-summary-metrics">${annualSummaryScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div>`
            : `<div class="annual-summary-kicker">${escapeHtml(annualSummaryScene.section)}</div><div class="annual-summary-diagnostic"><span></span><span></span><span></span></div>`}`
          + `<div class="annual-summary-rail"><span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span></div><div class="annual-summary-year">${escapeHtml(annualSummaryScene.year)}</div><div class="annual-summary-ribbon"></div><div class="annual-summary-dashboard"><span></span><span></span><span></span><span></span><span></span></div><div class="annual-summary-timeline"><span></span><span></span><span></span><span></span></div>`
          + renderAnnualSummaryTextPreview(slide, index)
        )
      : "";
    const quarterlyDashboardMark = quarterlyDashboardScene
      ? (
          `${index === 0
            ? `<div class="quarterly-dashboard-kicker">${escapeHtml(quarterlyDashboardScene.kicker)}</div><div class="quarterly-dashboard-hero-visual"><span></span><span></span><span></span><span></span><span></span><i></i></div><div class="quarterly-dashboard-hero-bars"><span></span><span></span><span></span><span></span><span></span></div><div class="quarterly-dashboard-cover-card"><strong>${escapeHtml(quarterlyDashboardScene.reportYear)}</strong><span>${escapeHtml(quarterlyDashboardScene.coverCaption)}</span></div>`
            : index === deck.slides.length - 1
              ? `<div class="quarterly-dashboard-ending"><strong>${escapeHtml(quarterlyDashboardScene.endingTitle)}</strong><span>${escapeHtml(quarterlyDashboardScene.endingCaption)}</span></div><div class="quarterly-dashboard-hero-visual quarterly-dashboard-hero-visual-closing"><span></span><span></span><span></span><span></span><span></span><i></i></div><div class="quarterly-dashboard-hero-bars"><span></span><span></span><span></span><span></span><span></span></div>`
              : `<div class="quarterly-dashboard-section">${escapeHtml(quarterlyDashboardScene.section)}</div><div class="quarterly-dashboard-content-frame"></div><div class="quarterly-dashboard-command-strip"><span></span><span></span><span></span></div><div class="quarterly-dashboard-insight-lens"></div><div class="quarterly-dashboard-rings">${quarterlyDashboardScene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("")}</div><div class="quarterly-dashboard-bar-panel"><strong class="quarterly-dashboard-panel-title">${escapeHtml(quarterlyDashboardScene.barTitle)}</strong><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="quarterly-dashboard-client-panel"><strong class="quarterly-dashboard-panel-title">${escapeHtml(quarterlyDashboardScene.clientTitle)}</strong><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="quarterly-dashboard-region-cards">${quarterlyDashboardScene.regions.map((region) => `<span><strong>${escapeHtml(region.name)}</strong><em>${escapeHtml(region.rate)}</em></span>`).join("")}</div><div class="quarterly-dashboard-combo"><strong class="quarterly-dashboard-panel-title">${escapeHtml(quarterlyDashboardScene.comboTitle)}</strong><span></span><span></span><span></span><span></span><span></span><span></span><b></b></div><div class="quarterly-dashboard-pie"><strong>${escapeHtml(quarterlyDashboardScene.pieTitle)}</strong></div>`}`
          + `<div class="quarterly-dashboard-footer-line"></div>`
        )
      : "";
    const quarterlyDiagnosisMark = quarterlyDiagnosisScene
      ? (
          `${index === 0
            ? `<div class="quarterly-diagnosis-kicker">${escapeHtml(quarterlyDiagnosisScene.kicker)}</div><div class="quarterly-diagnosis-cover-model"><span>存在<br>问题</span><b></b><span>改进<br>方法</span></div><div class="quarterly-diagnosis-cover-notes"><span>${escapeHtml(quarterlyDiagnosisScene.leftCards[0])}</span><span>${escapeHtml(quarterlyDiagnosisScene.rightCards[0])}</span></div>`
            : index === deck.slides.length - 1
              ? `<div class="quarterly-diagnosis-closing-model"><span></span><span></span><span></span></div><div class="quarterly-diagnosis-ending"><strong>${escapeHtml(quarterlyDiagnosisScene.endingTitle)}</strong><span>${escapeHtml(quarterlyDiagnosisScene.endingCaption)}</span></div>`
              : `<div class="quarterly-diagnosis-section">${escapeHtml(quarterlyDiagnosisScene.section)}</div><div class="quarterly-diagnosis-main-model"><span></span><span></span><span></span><span></span></div><div class="quarterly-diagnosis-left-cards">${quarterlyDiagnosisScene.leftCards.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><div class="quarterly-diagnosis-right-cards">${quarterlyDiagnosisScene.rightCards.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div><div class="quarterly-diagnosis-evidence"><span></span><span></span><span></span><span></span></div>`}`
          + `<div class="quarterly-diagnosis-footer-line"></div>`
        )
      : "";
    const quarterlyActionLoopMark = quarterlyActionLoopScene
      ? (
          `${index === 0
            ? `<div class="quarterly-action-kicker">${escapeHtml(quarterlyActionLoopScene.kicker)}</div>${renderQuarterlyActionContentPreview(slide, "cover")}<div class="quarterly-action-cover-board">${quarterlyActionLoopScene.columns.map((column) => `<section><strong>${escapeHtml(column.title)}</strong>${column.items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</section>`).join("")}<div class="quarterly-action-loop-core"><span></span><span></span><span></span></div></div>`
            : index === deck.slides.length - 1
              ? `<div class="quarterly-action-ending"><strong>${escapeHtml(quarterlyActionLoopScene.endingTitle)}</strong><span>${escapeHtml(quarterlyActionLoopScene.endingCaption)}</span></div>${renderQuarterlyActionContentPreview(slide, "closing")}<div class="quarterly-action-roadmap">${quarterlyActionLoopScene.steps.map((step) => `<span>${escapeHtml(step)}</span>`).join("")}</div>`
              : `<div class="quarterly-action-section">${escapeHtml(quarterlyActionLoopScene.section)}</div>${renderQuarterlyActionContentPreview(slide, "content")}<div class="quarterly-action-plan">${quarterlyActionLoopScene.steps.map((step) => `<span>${escapeHtml(step)}</span>`).join("")}</div><div class="quarterly-action-matrix">${quarterlyActionLoopScene.owners.map((owner) => `<span>${escapeHtml(owner)}</span>`).join("")}</div><div class="quarterly-action-progress"><i></i><i></i><i></i><i></i><i></i></div>`}`
          + `<div class="quarterly-action-footer-line"></div>`
        )
      : "";
    const industryResearchMark = industryResearchScene
      ? renderIndustryResearchPreview(slide, industryResearchScene)
      : "";
    const budgetPlanningMark = budgetPlanningScene
      ? renderBudgetPlanningPreview(slide, budgetPlanningScene)
      : "";
    const budgetVarianceMark = budgetVarianceScene
      ? renderBudgetVariancePreview(slide, budgetVarianceScene)
      : "";
    const budgetAdjustmentMark = budgetAdjustmentScene
      ? renderBudgetAdjustmentPreview(slide, budgetAdjustmentScene)
      : "";
    const topBandHeadingClass = topBandTitleClass ? ` class="${topBandTitleClass}"` : "";
    const domeChrome = isDomeLayout
      ? `<div class="dome-role-decor dome-canvas-frame"></div>${renderDomePreviewContentFrame(domeRole)}${renderDomePreviewContentSurface(domeRole)}${renderDomePreviewDecoration(domeRole, slide, index)}${renderDomePreviewWaves(visual)}${renderDomePreviewFooter(visual)}`
      : "";
    // 年度总结、行业研究、预算管理、行业解决方案和新品首发节奏模板已经由专用内容层承载真实文字，普通内容层保持空壳，防止两套文字叠加。
    const defaultSlideContent = annualSummaryScene || industryResearchScene || budgetPlanningScene || budgetVarianceScene || budgetAdjustmentScene || financialSolutionScene || manufacturingSolutionScene || educationSolutionScene || launchRhythmScene
      ? '<div class="slide-content"></div>'
      : `<div class="slide-content"><h2${topBandHeadingClass}>${escapeHtml(slide.title)}</h2>${bodyList}</div>`;
    return `<article class="preview-page" aria-label="第 ${index + 1} 页"><div class="slide slide-${slideKind}" data-dome-role="${escapeHtml(domeRole)}" data-status-variant="${escapeHtml(statusReportScene?.variant || "")}" data-template-variant="${escapeHtml(strategyScene?.variant || financeScene?.variant || salesScene?.variant || financialSolutionScene?.variant || manufacturingSolutionScene?.variant || educationSolutionScene?.variant || productScene?.variant || pitchScene?.variant || marketingScene?.variant || launchRhythmScene?.variant || brandStoryScene?.variant || dataInsightScene?.variant || educationScene?.variant || annualSummaryScene?.variant || quarterlyDashboardScene?.variant || quarterlyDiagnosisScene?.variant || quarterlyActionLoopScene?.variant || industryResearchScene?.variant || budgetPlanningScene?.variant || budgetVarianceScene?.variant || budgetAdjustmentScene?.variant || "")}"><div class="accent"></div><div class="motif"></div><div class="top-band-brand">${topBandBrand}</div>${topBandMark}${statusReportMark}${strategyMark}${financeMark}${salesMark}${financialSolutionMark}${manufacturingSolutionMark}${educationSolutionMark}${productMark}${pitchMark}${marketingMark}${launchRhythmMark}${brandStoryMark}${dataInsightMark}${educationMark}${annualSummaryMark}${quarterlyDashboardMark}${quarterlyDiagnosisMark}${quarterlyActionLoopMark}${industryResearchMark}${budgetPlanningMark}${budgetVarianceMark}${budgetAdjustmentMark}${domeChrome}${defaultSlideContent}<div class="page-number">${index + 1} / ${deck.slides.length}</div></div></article>`;
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
    body[data-layout="industry-research"] .slide{background:linear-gradient(135deg,#ffffff 0%,var(--template-bg) 100%);padding:0;border:0;}
    body[data-layout="industry-research"] .slide::before{background:repeating-linear-gradient(90deg,rgba(18,50,90,.045) 0 1px,transparent 1px 46px),repeating-linear-gradient(0deg,rgba(24,167,167,.03) 0 1px,transparent 1px 38px);}
    body[data-layout="industry-research"] .slide::after{content:"";position:absolute;left:5.2%;right:5.2%;top:8.8%;bottom:8.6%;z-index:1;border-radius:14px;background:rgba(255,255,255,.9);border:1px solid rgba(18,50,90,.12);box-shadow:0 22px 50px rgba(15,23,42,.12);}
    body[data-layout="industry-research"] .accent{height:5.8%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 62%,var(--template-accent) 38%));}
    body[data-layout="industry-research"] .industry-layer{position:absolute;inset:0;z-index:3;pointer-events:none;color:var(--template-body);}
    body[data-layout="industry-research"] .industry-kicker{position:absolute;left:8%;top:13%;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--template-accent);}
    body[data-layout="industry-research"] .industry-title{position:absolute;left:8%;top:21%;width:48%;margin:0;color:var(--template-title);font-size:34px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="industry-research"] .industry-bullets{position:absolute;left:8.2%;top:51%;width:43%;margin:0;padding-left:1.05em;font-size:14px;line-height:1.52;color:var(--template-body);}
    body[data-layout="industry-research"] .industry-bullets li{margin:.16em 0;}
    body[data-layout="industry-research"] .industry-metric-row{position:absolute;left:8%;right:43%;bottom:15%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="industry-research"] .industry-metric-row span{min-height:58px;border-radius:10px;background:#fff;border:1px solid rgba(18,50,90,.12);box-shadow:0 10px 24px rgba(15,23,42,.08);padding:12px 14px;display:grid;align-content:center;gap:3px;font-size:11px;font-weight:800;color:var(--template-body);}
    body[data-layout="industry-research"] .industry-metric-row strong{font-size:19px;line-height:1;color:var(--template-primary);}
    body[data-layout="industry-research"] .industry-map{position:absolute;right:7.6%;top:16%;width:34%;height:54%;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.78),rgba(230,244,248,.9));border:1px solid rgba(18,50,90,.12);overflow:hidden;box-shadow:0 16px 32px rgba(15,23,42,.10);}
    body[data-layout="industry-research"] .industry-map::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 22% 66%,rgba(24,167,167,.32) 0 5px,transparent 6px),radial-gradient(circle at 54% 28%,rgba(18,50,90,.26) 0 4px,transparent 5px),radial-gradient(circle at 78% 62%,rgba(24,167,167,.28) 0 5px,transparent 6px),repeating-linear-gradient(90deg,rgba(18,50,90,.08) 0 1px,transparent 1px 34px),repeating-linear-gradient(0deg,rgba(18,50,90,.055) 0 1px,transparent 1px 30px);}
    body[data-layout="industry-research"] .industry-map::after{content:"";position:absolute;left:16%;right:10%;top:34%;height:34%;border-top:2px dashed rgba(18,50,90,.36);border-right:2px dashed rgba(24,167,167,.45);border-radius:50%;transform:rotate(-8deg);}
    body[data-layout="industry-research"] .industry-chain{position:absolute;left:8%;right:8%;bottom:16%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;}
    body[data-layout="industry-research"] .industry-chain span,.industry-risk span{border-radius:12px;background:#fff;border:1px solid rgba(18,50,90,.12);box-shadow:0 10px 22px rgba(15,23,42,.08);padding:14px 16px;font-size:13px;line-height:1.35;font-weight:800;color:var(--template-title);}
    body[data-layout="industry-research"] .industry-chain span{position:relative;min-height:76px;}
    body[data-layout="industry-research"] .industry-chain span::after{content:"";position:absolute;right:-23px;top:50%;width:28px;height:2px;background:var(--template-accent);}
    body[data-layout="industry-research"] .industry-chain span:last-child::after{display:none;}
    body[data-layout="industry-research"] .industry-matrix{position:absolute;right:8%;top:19%;width:37%;height:49%;border-radius:14px;background:#fff;border:1px solid rgba(18,50,90,.14);box-shadow:0 14px 30px rgba(15,23,42,.10);}
    body[data-layout="industry-research"] .industry-matrix::before{content:"";position:absolute;left:50%;top:9%;bottom:10%;width:1px;background:rgba(18,50,90,.16);box-shadow:-128px 0 0 rgba(18,50,90,.035),128px 0 0 rgba(18,50,90,.035);}
    body[data-layout="industry-research"] .industry-matrix::after{content:"";position:absolute;left:9%;right:9%;top:50%;height:1px;background:rgba(18,50,90,.16);box-shadow:0 -72px 0 rgba(18,50,90,.035),0 72px 0 rgba(18,50,90,.035);}
    body[data-layout="industry-research"] .industry-matrix i{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--template-accent);box-shadow:0 0 0 7px rgba(24,167,167,.12);}
    body[data-layout="industry-research"] .industry-matrix i:nth-child(1){left:22%;top:60%;}body[data-layout="industry-research"] .industry-matrix i:nth-child(2){left:48%;top:34%;background:var(--template-primary);}body[data-layout="industry-research"] .industry-matrix i:nth-child(3){left:70%;top:42%;}body[data-layout="industry-research"] .industry-matrix i:nth-child(4){left:62%;top:70%;background:color-mix(in srgb,var(--template-primary) 55%,var(--template-accent) 45%);}
    body[data-layout="industry-research"] .industry-risk{position:absolute;right:8%;top:22%;width:34%;display:grid;gap:12px;}
    body[data-layout="industry-research"] .industry-risk span{min-height:56px;border-left:6px solid var(--template-accent);}
    body[data-layout="industry-research"] .industry-opportunity-grid{position:absolute;left:8%;bottom:15%;width:43%;height:31%;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
    body[data-layout="industry-research"] .industry-opportunity-grid span{border-radius:12px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 76%,#fff 24%));border:1px solid rgba(18,50,90,.12);}
    body[data-layout="industry-research"] .industry-closing-line{position:absolute;left:8%;right:8%;bottom:23%;height:2px;background:linear-gradient(90deg,var(--template-accent),transparent);}
    body[data-layout="industry-research"] .page-number{z-index:4;right:7.2%;bottom:6.4%;background:rgba(255,255,255,.78);border:1px solid rgba(18,50,90,.12);border-radius:999px;padding:5px 10px;color:rgba(11,31,51,.62);}
    body[data-layout="finance-budget-planning"] .slide{padding:0;border:0;background:radial-gradient(circle at 86% 22%,rgba(42,157,143,.22) 0 18%,transparent 19% 42%),linear-gradient(135deg,#f6fbfa 0%,var(--template-bg) 48%,#d8ebe7 100%);}
    body[data-layout="finance-budget-planning"] .slide::before{background:linear-gradient(110deg,rgba(16,42,67,.08) 0 13%,transparent 13% 100%),repeating-linear-gradient(90deg,rgba(16,42,67,.052) 0 1px,transparent 1px 48px),repeating-linear-gradient(0deg,rgba(42,157,143,.04) 0 1px,transparent 1px 40px);}
    body[data-layout="finance-budget-planning"] .slide::after{content:"";position:absolute;right:-8%;bottom:-16%;width:44%;height:46%;border-radius:999px;background:rgba(214,168,79,.16);filter:blur(1px);}
    body[data-layout="finance-budget-planning"] .accent{height:6.2%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 56%,var(--template-accent) 44%));box-shadow:0 6px 20px rgba(16,42,67,.12);}
    body[data-layout="finance-budget-planning"] .budget-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="finance-budget-planning"] .budget-surface{position:absolute;left:6.8%;right:6.8%;top:12.2%;bottom:8.8%;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(249,252,251,.88));border:1px solid rgba(16,42,67,.13);box-shadow:0 24px 52px rgba(16,42,67,.15),inset 0 0 0 1px rgba(255,255,255,.72);}
    body[data-layout="finance-budget-planning"] .budget-kicker{position:absolute;left:9.2%;top:16%;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--template-accent);}
    body[data-layout="finance-budget-planning"] .budget-title{position:absolute;left:9.2%;top:24%;width:45%;margin:0;color:var(--template-title);font-size:34px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="finance-budget-planning"] .budget-rule{position:absolute;left:9.2%;top:45%;width:36%;height:3px;background:linear-gradient(90deg,var(--template-accent),transparent);}
    body[data-layout="finance-budget-planning"] .budget-bullets{position:absolute;left:9.2%;top:51%;width:39%;margin:0;padding-left:1.05em;font-size:14px;line-height:1.48;color:var(--template-body);}
    body[data-layout="finance-budget-planning"] .budget-bullets li{margin:.16em 0;}
    body[data-layout="finance-budget-planning"] .budget-amount-cards{position:absolute;left:9.2%;right:46%;bottom:15%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="finance-budget-planning"] .budget-amount-cards span{min-height:58px;border-radius:12px;background:#fff;border:1px solid rgba(16,42,67,.12);box-shadow:0 10px 22px rgba(16,42,67,.08);padding:12px 14px;display:grid;align-content:center;gap:3px;font-size:11px;font-weight:800;color:var(--template-body);}
    body[data-layout="finance-budget-planning"] .budget-amount-cards strong{font-size:19px;line-height:1;color:var(--template-primary);}
    body[data-layout="finance-budget-planning"] .budget-dashboard{position:absolute;right:9.2%;top:20%;width:32%;height:45%;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.95),color-mix(in srgb,var(--template-bg) 82%,#fff 18%));border:1px solid rgba(16,42,67,.14);box-shadow:0 18px 34px rgba(16,42,67,.12);overflow:hidden;}
    body[data-layout="finance-budget-planning"] .budget-dashboard::before{content:"";position:absolute;left:10%;top:14%;width:36%;height:36%;border-radius:50%;background:conic-gradient(var(--template-accent) 0 46%,#d6a84f 46% 70%,rgba(16,42,67,.14) 70% 100%);box-shadow:0 0 0 16px rgba(42,157,143,.08);}
    body[data-layout="finance-budget-planning"] .budget-dashboard::after{content:"";position:absolute;right:12%;top:16%;bottom:14%;width:40%;background:linear-gradient(180deg,transparent 0 18%,rgba(16,42,67,.14) 18% 19%,transparent 19% 40%,rgba(42,157,143,.22) 40% 41%,transparent 41% 62%,rgba(16,42,67,.14) 62% 63%,transparent 63%),linear-gradient(90deg,var(--template-accent) 0 8px,transparent 8px 100%);}
    body[data-layout="finance-budget-planning"] .budget-table{position:absolute;left:9.2%;right:9.2%;top:50%;bottom:16%;border-radius:14px;background:#fff;border:1px solid rgba(16,42,67,.12);box-shadow:0 12px 24px rgba(16,42,67,.08);overflow:hidden;}
    body[data-layout="finance-budget-planning"] .budget-table span{display:grid;grid-template-columns:1.2fr .8fr .8fr 1fr;align-items:center;height:25%;padding:0 18px;border-bottom:1px solid rgba(16,42,67,.08);font-size:12px;font-weight:800;color:var(--template-body);}
    body[data-layout="finance-budget-planning"] .budget-table span:first-child{background:var(--template-primary);color:#fff;}
    body[data-layout="finance-budget-planning"] .budget-flow{position:absolute;left:9.2%;right:9.2%;bottom:17%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;}
    body[data-layout="finance-budget-planning"] .budget-flow span{position:relative;min-height:72px;border-radius:14px;background:#fff;border:1px solid rgba(16,42,67,.12);box-shadow:0 10px 22px rgba(16,42,67,.08);padding:14px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="finance-budget-planning"] .budget-flow span::before{content:attr(data-step);display:block;width:26px;height:26px;margin-bottom:6px;border-radius:50%;background:var(--template-accent);color:#fff;text-align:center;line-height:26px;font-size:11px;}
    body[data-layout="finance-budget-planning"] .budget-flow span::after{content:"";position:absolute;right:-17px;top:50%;width:20px;height:2px;background:var(--template-accent);}
    body[data-layout="finance-budget-planning"] .budget-flow span:last-child::after{display:none;}
    body[data-layout="finance-budget-planning"] .budget-allocation{position:absolute;right:9.2%;top:22%;width:34%;height:45%;border-radius:16px;background:#fff;border:1px solid rgba(16,42,67,.12);box-shadow:0 14px 30px rgba(16,42,67,.10);}
    body[data-layout="finance-budget-planning"] .budget-allocation i{position:absolute;left:12%;right:12%;height:22px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),rgba(42,157,143,.18));}
    body[data-layout="finance-budget-planning"] .budget-allocation i:nth-child(1){top:18%;width:72%;}body[data-layout="finance-budget-planning"] .budget-allocation i:nth-child(2){top:34%;width:58%;}body[data-layout="finance-budget-planning"] .budget-allocation i:nth-child(3){top:50%;width:66%;}body[data-layout="finance-budget-planning"] .budget-allocation i:nth-child(4){top:66%;width:48%;}
    body[data-layout="finance-budget-planning"] .budget-closing{position:absolute;left:9.2%;right:9.2%;top:49%;display:grid;grid-template-columns:1.2fr 1fr;gap:16px;}
    body[data-layout="finance-budget-planning"] .budget-closing span{min-height:122px;border-radius:16px;background:#fff;border:1px solid rgba(16,42,67,.12);box-shadow:0 12px 24px rgba(16,42,67,.08);padding:18px;font-size:14px;font-weight:800;color:var(--template-body);}
    body[data-layout="finance-budget-planning"] .page-number{z-index:4;right:7.3%;bottom:5.6%;background:rgba(255,255,255,.78);border:1px solid rgba(16,42,67,.12);border-radius:999px;padding:5px 10px;color:rgba(11,31,51,.62);}
    body[data-layout="finance-budget-variance"] .slide{padding:0;border:0;background:linear-gradient(135deg,#fbfdff 0%,var(--template-bg) 56%,#e7edf5 100%);}
    body[data-layout="finance-budget-variance"] .slide::before{background:repeating-linear-gradient(0deg,rgba(246,184,75,.18) 0 1px,transparent 1px 54px),repeating-linear-gradient(90deg,rgba(22,33,62,.045) 0 1px,transparent 1px 46px);}
    body[data-layout="finance-budget-variance"] .slide::after{content:"";position:absolute;right:-8%;top:10%;width:35%;height:54%;border-radius:34px;background:rgba(233,87,79,.10);transform:rotate(9deg);}
    body[data-layout="finance-budget-variance"] .accent{height:6.1%;z-index:2;background:linear-gradient(90deg,var(--template-primary),#27395f 66%,var(--template-accent));box-shadow:0 8px 22px rgba(22,33,62,.14);}
    body[data-layout="finance-budget-variance"] .variance-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="finance-budget-variance"] .variance-surface{position:absolute;left:6.2%;right:6.2%;top:11.5%;bottom:8.4%;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(248,250,252,.9));border:1px solid rgba(22,33,62,.13);box-shadow:0 24px 52px rgba(22,33,62,.14),inset 0 0 0 1px rgba(255,255,255,.78);}
    body[data-layout="finance-budget-variance"] .variance-kicker{position:absolute;left:8.8%;top:15.6%;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--template-accent);}
    body[data-layout="finance-budget-variance"] .variance-title{position:absolute;left:8.8%;top:22.7%;width:42%;margin:0;color:var(--template-title);font-size:34px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="finance-budget-variance"] .variance-rule{position:absolute;left:8.8%;top:43.5%;width:34%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),#f6b84b,transparent);}
    body[data-layout="finance-budget-variance"] .variance-bullets{position:absolute;left:8.8%;top:50%;width:38%;margin:0;padding-left:1.05em;font-size:14px;line-height:1.46;color:var(--template-body);}
    body[data-layout="finance-budget-variance"] .variance-bullets li{margin:.16em 0;}
    body[data-layout="finance-budget-variance"] .variance-ledger{position:absolute;right:8.4%;top:19%;width:36%;height:47%;border-radius:18px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 16px 34px rgba(22,33,62,.12);overflow:hidden;}
    body[data-layout="finance-budget-variance"] .variance-ledger::before{content:"";position:absolute;left:0;right:0;top:0;height:48px;background:var(--template-primary);}
    body[data-layout="finance-budget-variance"] .variance-ledger span{position:absolute;left:9%;right:9%;height:14px;border-radius:999px;background:rgba(22,33,62,.12);}
    body[data-layout="finance-budget-variance"] .variance-ledger span:nth-child(1){top:28%;width:74%;background:rgba(22,33,62,.18);}
    body[data-layout="finance-budget-variance"] .variance-ledger span:nth-child(2){top:42%;width:56%;background:rgba(233,87,79,.78);}
    body[data-layout="finance-budget-variance"] .variance-ledger span:nth-child(3){top:56%;width:68%;background:rgba(246,184,75,.82);}
    body[data-layout="finance-budget-variance"] .variance-ledger span:nth-child(4){top:70%;width:46%;background:rgba(47,168,121,.82);}
    body[data-layout="finance-budget-variance"] .variance-ledger i{position:absolute;right:11%;bottom:13%;width:34%;height:32%;border-radius:50%;border:8px solid rgba(233,87,79,.28);border-top-color:var(--template-accent);transform:rotate(34deg);}
    body[data-layout="finance-budget-variance"] .variance-metrics{position:absolute;left:8.8%;right:46%;bottom:14.2%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="finance-budget-variance"] .variance-metrics span{min-height:62px;border-radius:13px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 10px 22px rgba(22,33,62,.08);padding:12px 14px;display:grid;align-content:center;gap:3px;font-size:11px;font-weight:800;color:var(--template-body);border-top:5px solid var(--template-accent);}
    body[data-layout="finance-budget-variance"] .variance-metrics span:nth-child(2){border-top-color:#f6b84b;}body[data-layout="finance-budget-variance"] .variance-metrics span:nth-child(3){border-top-color:#2fa879;}
    body[data-layout="finance-budget-variance"] .variance-metrics strong{font-size:19px;line-height:1;color:var(--template-title);}
    body[data-layout="finance-budget-variance"] .variance-waterfall{position:absolute;right:8.4%;top:18.5%;width:38%;height:52%;border-radius:18px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 14px 30px rgba(22,33,62,.10);}
    body[data-layout="finance-budget-variance"] .variance-waterfall span{position:absolute;bottom:18%;width:13%;border-radius:7px 7px 0 0;}
    body[data-layout="finance-budget-variance"] .variance-waterfall span:nth-child(1){left:10%;height:28%;background:#2fa879;}body[data-layout="finance-budget-variance"] .variance-waterfall span:nth-child(2){left:27%;height:44%;background:#f6b84b;}body[data-layout="finance-budget-variance"] .variance-waterfall span:nth-child(3){left:44%;height:22%;background:#e9574f;}body[data-layout="finance-budget-variance"] .variance-waterfall span:nth-child(4){left:61%;height:53%;background:#f6b84b;}body[data-layout="finance-budget-variance"] .variance-waterfall span:nth-child(5){left:78%;height:34%;background:#e9574f;}
    body[data-layout="finance-budget-variance"] .variance-waterfall::after{content:"";position:absolute;left:8%;right:8%;bottom:18%;height:2px;background:rgba(22,33,62,.28);}
    body[data-layout="finance-budget-variance"] .variance-analysis{position:absolute;right:8.4%;top:18%;width:39%;height:54%;display:grid;grid-template-columns:1.1fr 1fr;gap:12px;}
    body[data-layout="finance-budget-variance"] .variance-trend{position:relative;border-radius:18px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 14px 28px rgba(22,33,62,.09);}
    body[data-layout="finance-budget-variance"] .variance-trend::before{content:"";position:absolute;left:15%;right:12%;top:62%;height:7px;border-radius:999px;background:var(--template-accent);transform:rotate(-18deg);box-shadow:36px -34px 0 -1px #f6b84b,76px -14px 0 -1px #2fa879;}
    body[data-layout="finance-budget-variance"] .variance-reasons{display:grid;gap:10px;}
    body[data-layout="finance-budget-variance"] .variance-reasons span{border-radius:14px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 10px 22px rgba(22,33,62,.08);padding:14px 16px;font-size:13px;font-weight:900;color:var(--template-title);border-left:6px solid var(--template-accent);}
    body[data-layout="finance-budget-variance"] .variance-reasons span:nth-child(2){border-left-color:#f6b84b;}body[data-layout="finance-budget-variance"] .variance-reasons span:nth-child(3){border-left-color:#2fa879;}
    body[data-layout="finance-budget-variance"] .variance-actions{position:absolute;left:8.8%;right:8.8%;bottom:15%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
    body[data-layout="finance-budget-variance"] .variance-actions span{min-height:84px;border-radius:14px;background:#fff;border:1px solid rgba(22,33,62,.12);box-shadow:0 10px 22px rgba(22,33,62,.08);padding:15px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="finance-budget-variance"] .variance-actions span::before{content:attr(data-step);display:block;width:26px;height:26px;margin-bottom:7px;border-radius:50%;background:var(--template-accent);color:#fff;text-align:center;line-height:26px;font-size:11px;}
    body[data-layout="finance-budget-variance"] .variance-loop{position:absolute;right:8.4%;top:20%;width:38%;height:45%;}
    body[data-layout="finance-budget-variance"] .variance-loop::before{content:"";position:absolute;left:8%;right:8%;top:46%;height:9px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),#f6b84b,#2fa879);}
    body[data-layout="finance-budget-variance"] .variance-loop span{position:absolute;top:31%;width:42px;height:42px;border-radius:50%;background:#fff;border:7px solid var(--template-accent);box-shadow:0 8px 18px rgba(22,33,62,.12);}
    body[data-layout="finance-budget-variance"] .variance-loop span:nth-child(1){left:8%;}body[data-layout="finance-budget-variance"] .variance-loop span:nth-child(2){left:35%;border-color:#f6b84b;}body[data-layout="finance-budget-variance"] .variance-loop span:nth-child(3){left:62%;border-color:#2fa879;}body[data-layout="finance-budget-variance"] .variance-loop span:nth-child(4){left:84%;border-color:var(--template-primary);}
    body[data-layout="finance-budget-variance"] .page-number{z-index:4;right:7.1%;bottom:5.5%;background:rgba(255,255,255,.78);border:1px solid rgba(22,33,62,.12);border-radius:999px;padding:5px 10px;color:rgba(23,32,54,.62);}
    body[data-layout="finance-budget-adjustment"] .slide{padding:0;border:0;background:radial-gradient(circle at 84% 20%,rgba(245,158,11,.18) 0 14%,transparent 15% 42%),linear-gradient(135deg,#ffffff 0%,var(--template-bg) 54%,#e9eef7 100%);}
    body[data-layout="finance-budget-adjustment"] .slide::before{background:linear-gradient(110deg,rgba(24,35,63,.075) 0 12%,transparent 12% 100%),repeating-linear-gradient(90deg,rgba(24,35,63,.05) 0 1px,transparent 1px 48px),repeating-linear-gradient(0deg,rgba(20,184,166,.035) 0 1px,transparent 1px 40px);}
    body[data-layout="finance-budget-adjustment"] .slide::after{content:"";position:absolute;right:-7%;bottom:-18%;width:42%;height:44%;border-radius:999px;background:rgba(20,184,166,.14);}
    body[data-layout="finance-budget-adjustment"] .accent{height:6.4%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 70%,var(--template-accent) 30%));box-shadow:0 6px 22px rgba(24,35,63,.14);}
    body[data-layout="finance-budget-adjustment"] .adjustment-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="finance-budget-adjustment"] .adjustment-surface{position:absolute;left:6.4%;right:6.4%;top:12%;bottom:8.6%;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(248,250,252,.9));border:1px solid rgba(24,35,63,.13);box-shadow:0 24px 52px rgba(24,35,63,.14),inset 0 0 0 1px rgba(255,255,255,.76);}
    body[data-layout="finance-budget-adjustment"] .adjustment-kicker{position:absolute;left:9%;top:15.8%;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--template-accent);}
    body[data-layout="finance-budget-adjustment"] .adjustment-title{position:absolute;left:9%;top:23.2%;width:44%;margin:0;color:var(--template-title);font-size:34px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="finance-budget-adjustment"] .adjustment-rule{position:absolute;left:9%;top:44%;width:35%;height:4px;border-radius:999px;background:linear-gradient(90deg,var(--template-accent),rgba(20,184,166,.72),transparent);}
    body[data-layout="finance-budget-adjustment"] .adjustment-bullets{position:absolute;left:9%;top:50.6%;width:39%;margin:0;padding-left:1.05em;font-size:14px;line-height:1.46;color:var(--template-body);}
    body[data-layout="finance-budget-adjustment"] .adjustment-bullets li{margin:.16em 0;}
    body[data-layout="finance-budget-adjustment"] .adjustment-dashboard{position:absolute;right:8.8%;top:19%;width:34%;height:46%;border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));border:1px solid rgba(24,35,63,.14);box-shadow:0 18px 34px rgba(24,35,63,.12);overflow:hidden;}
    body[data-layout="finance-budget-adjustment"] .adjustment-dashboard::before{content:"";position:absolute;left:12%;top:16%;width:34%;height:36%;border-radius:50%;background:conic-gradient(#14b8a6 0 52%,var(--template-accent) 52% 78%,rgba(24,35,63,.16) 78% 100%);box-shadow:0 0 0 16px rgba(20,184,166,.08);}
    body[data-layout="finance-budget-adjustment"] .adjustment-dashboard::after{content:"";position:absolute;right:12%;top:28%;width:35%;height:20%;clip-path:polygon(0 22%,64% 22%,64% 0,100% 50%,64% 100%,64% 78%,0 78%);background:var(--template-accent);}
    body[data-layout="finance-budget-adjustment"] .adjustment-metrics{position:absolute;left:9%;right:46%;bottom:14.5%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="finance-budget-adjustment"] .adjustment-metrics span{min-height:62px;border-radius:12px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 10px 22px rgba(24,35,63,.08);padding:12px 14px;display:grid;align-content:center;gap:3px;font-size:11px;font-weight:800;color:var(--template-body);}
    body[data-layout="finance-budget-adjustment"] .adjustment-metrics strong{font-size:19px;line-height:1;color:var(--template-primary);}
    body[data-layout="finance-budget-adjustment"] .adjustment-reallocation{position:absolute;right:8.8%;top:20%;width:35%;height:48%;border-radius:18px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 14px 30px rgba(24,35,63,.1);}
    body[data-layout="finance-budget-adjustment"] .adjustment-reallocation i{position:absolute;height:24px;border-radius:999px;background:linear-gradient(90deg,#14b8a6,var(--template-accent));}
    body[data-layout="finance-budget-adjustment"] .adjustment-reallocation i:nth-child(1){left:12%;top:22%;width:62%;}body[data-layout="finance-budget-adjustment"] .adjustment-reallocation i:nth-child(2){left:12%;top:40%;width:44%;background:linear-gradient(90deg,var(--template-accent),rgba(245,158,11,.2));}body[data-layout="finance-budget-adjustment"] .adjustment-reallocation i:nth-child(3){left:12%;top:58%;width:72%;}body[data-layout="finance-budget-adjustment"] .adjustment-reallocation i:nth-child(4){left:12%;top:76%;width:36%;background:linear-gradient(90deg,#b91c1c,rgba(185,28,28,.16));}
    body[data-layout="finance-budget-adjustment"] .adjustment-bridge{position:absolute;right:8.4%;top:19%;width:38%;height:52%;display:grid;grid-template-columns:1fr .7fr 1fr;gap:10px;align-items:center;}
    body[data-layout="finance-budget-adjustment"] .adjustment-bridge span{min-height:110px;border-radius:14px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 12px 24px rgba(24,35,63,.08);padding:16px;font-size:13px;font-weight:900;color:var(--template-title);}
    body[data-layout="finance-budget-adjustment"] .adjustment-bridge b{height:28px;clip-path:polygon(0 30%,70% 30%,70% 0,100% 50%,70% 100%,70% 70%,0 70%);background:var(--template-accent);}
    body[data-layout="finance-budget-adjustment"] .adjustment-approval{position:absolute;left:9%;right:9%;bottom:16%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;}
    body[data-layout="finance-budget-adjustment"] .adjustment-approval span{position:relative;min-height:76px;border-radius:14px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 10px 22px rgba(24,35,63,.08);padding:14px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="finance-budget-adjustment"] .adjustment-approval span::before{content:attr(data-step);display:block;width:26px;height:26px;margin-bottom:6px;border-radius:50%;background:var(--template-accent);color:#fff;text-align:center;line-height:26px;font-size:11px;}
    body[data-layout="finance-budget-adjustment"] .adjustment-approval span::after{content:"";position:absolute;right:-17px;top:50%;width:20px;height:2px;background:var(--template-primary);}
    body[data-layout="finance-budget-adjustment"] .adjustment-approval span:last-child::after{display:none;}
    body[data-layout="finance-budget-adjustment"] .adjustment-impact{position:absolute;right:8.8%;top:19.5%;width:36%;height:50%;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    body[data-layout="finance-budget-adjustment"] .adjustment-impact span{border-radius:14px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 12px 24px rgba(24,35,63,.08);padding:16px;font-size:13px;font-weight:900;color:var(--template-title);border-left:6px solid var(--template-accent);}
    body[data-layout="finance-budget-adjustment"] .adjustment-impact span:nth-child(2){border-left-color:#14b8a6;}body[data-layout="finance-budget-adjustment"] .adjustment-impact span:nth-child(4){border-left-color:#b91c1c;}
    body[data-layout="finance-budget-adjustment"] .adjustment-closing{position:absolute;left:9%;right:9%;top:49%;display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:14px;}
    body[data-layout="finance-budget-adjustment"] .adjustment-closing span{min-height:118px;border-radius:16px;background:#fff;border:1px solid rgba(24,35,63,.12);box-shadow:0 12px 24px rgba(24,35,63,.08);padding:18px;font-size:14px;font-weight:800;color:var(--template-body);border-top:5px solid var(--template-accent);}
    body[data-layout="finance-budget-adjustment"] .page-number{z-index:4;right:7.2%;bottom:5.6%;background:rgba(255,255,255,.78);border:1px solid rgba(24,35,63,.12);border-radius:999px;padding:5px 10px;color:rgba(17,24,39,.62);}
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
    body[data-template^="finance-operating-dashboard-"] h2{max-width:61%;font-size:32px;line-height:1.14;margin-bottom:4.4%;}
    body[data-template^="finance-operating-dashboard-"] ul{max-width:56%;font-size:14.5px;line-height:1.48;}
    body[data-template^="finance-operating-dashboard-"] .finance-label{position:absolute;left:9.2%;top:15.2%;z-index:3;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.12em;}
    body[data-template^="finance-operating-dashboard-"] .finance-chip{position:absolute;right:10.4%;top:17%;z-index:4;min-width:84px;height:30px;display:grid;place-items:center;border-radius:999px;background:var(--template-primary);color:#fff;font-size:11px;font-weight:900;box-shadow:0 10px 20px rgba(16,38,57,.14);}
    body[data-template^="finance-operating-dashboard-"] .finance-visual{position:absolute;right:8.8%;top:28%;width:24%;height:31%;z-index:3;border-radius:14px;background:linear-gradient(135deg,rgba(255,255,255,.92),color-mix(in srgb,var(--template-bg) 74%,#fff 26%));border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 16px 30px rgba(16,38,57,.14);overflow:hidden;}
    body[data-template^="finance-operating-dashboard-"] .finance-visual::before{content:"";position:absolute;left:9%;right:9%;bottom:17%;height:2px;background:color-mix(in srgb,var(--template-primary) 18%,transparent);}
    body[data-template^="finance-operating-dashboard-"] .finance-visual span{position:absolute;bottom:20%;width:12%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,var(--template-accent),color-mix(in srgb,var(--template-accent) 52%,var(--template-primary) 48%));}
    body[data-template^="finance-operating-dashboard-"] .finance-visual span:nth-child(1){left:14%;height:31%;}
    body[data-template^="finance-operating-dashboard-"] .finance-visual span:nth-child(2){left:34%;height:48%;}
    body[data-template^="finance-operating-dashboard-"] .finance-visual span:nth-child(3){left:54%;height:38%;}
    body[data-template^="finance-operating-dashboard-"] .finance-visual span:nth-child(4){left:74%;height:61%;}
    body[data-template^="finance-operating-dashboard-"] .page-number{z-index:5;right:7.3%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 72%,transparent);background:rgba(255,255,255,.78);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="control-room"] .finance-visual{background:linear-gradient(135deg,color-mix(in srgb,var(--template-primary) 92%,#fff 8%),color-mix(in srgb,var(--template-primary) 72%,var(--template-accent) 28%));}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="control-room"] .finance-visual::after{content:"";position:absolute;left:16%;top:17%;width:30%;height:30%;border-radius:50%;border:4px solid var(--template-accent);box-shadow:0 0 0 16px color-mix(in srgb,var(--template-accent) 14%,transparent);}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="warning"] .finance-visual span{width:15px;height:15px;border-radius:50%;bottom:auto;left:14%;background:var(--template-accent);}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="warning"] .finance-visual span:nth-child(1){top:20%;}body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="warning"] .finance-visual span:nth-child(2){top:43%;background:#ef4444;}body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="warning"] .finance-visual span:nth-child(3){top:66%;}body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="warning"] .finance-visual span:nth-child(4){display:none;}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="monthly"] .finance-visual{border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 82%,var(--template-accent) 18%));}
    body[data-template^="finance-operating-dashboard-"] .slide[data-template-variant="monthly"] .finance-visual::after{content:"";position:absolute;left:13%;right:13%;top:18%;height:18%;border-radius:8px;background:var(--template-primary);}
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
    body[data-layout="sales-financial-solution"] .slide{padding:0;border:0;background:radial-gradient(circle at 86% 20%,rgba(24,160,166,.18) 0 18%,transparent 19% 42%),linear-gradient(135deg,#f7fbfc 0%,var(--template-bg) 54%,#dbeaf0 100%);}
    body[data-layout="sales-financial-solution"] .slide::before{background:linear-gradient(110deg,rgba(11,42,74,.12) 0 12%,transparent 12% 100%),repeating-linear-gradient(90deg,rgba(11,42,74,.045) 0 1px,transparent 1px 54px),repeating-linear-gradient(0deg,rgba(24,160,166,.04) 0 1px,transparent 1px 44px);}
    body[data-layout="sales-financial-solution"] .slide::after{content:"";position:absolute;right:-10%;bottom:-18%;width:42%;height:48%;border-radius:50%;background:rgba(214,168,79,.14);}
    body[data-layout="sales-financial-solution"] .accent{height:6.6%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 64%,var(--template-accent) 36%));box-shadow:0 7px 22px rgba(11,42,74,.16);}
    body[data-layout="sales-financial-solution"] .financial-solution-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="sales-financial-solution"] .financial-solution-surface{position:absolute;left:6.4%;right:6.4%;top:12.4%;bottom:8.4%;border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.95),rgba(248,252,253,.9));border:1px solid rgba(11,42,74,.14);box-shadow:0 24px 54px rgba(11,42,74,.14),inset 0 0 0 1px rgba(255,255,255,.72);}
    body[data-layout="sales-financial-solution"] .financial-solution-kicker{position:absolute;left:9.2%;top:16.3%;font-size:12px;font-weight:900;letter-spacing:.15em;color:var(--template-accent);}
    body[data-layout="sales-financial-solution"] .financial-solution-title{position:absolute;left:9.2%;top:24%;width:43%;margin:0;color:var(--template-title);font-size:34px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="sales-financial-solution"] .financial-solution-rule{position:absolute;left:9.2%;top:45.4%;width:35%;height:3px;background:linear-gradient(90deg,var(--template-accent),transparent);}
    body[data-layout="sales-financial-solution"] .financial-solution-bullets{position:absolute;left:9.2%;top:51.5%;width:39%;margin:0;padding-left:1.05em;font-size:13.5px;line-height:1.45;color:var(--template-body);}
    body[data-layout="sales-financial-solution"] .financial-solution-bullets li{margin:.12em 0;}
    body[data-layout="sales-financial-solution"] .financial-solution-tags{position:absolute;left:9.2%;right:47%;bottom:14.6%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-financial-solution"] .financial-solution-tags span{min-height:58px;border-left:7px solid var(--template-accent);border-radius:10px;background:#fff;border-top:1px solid rgba(11,42,74,.1);border-right:1px solid rgba(11,42,74,.1);border-bottom:1px solid rgba(11,42,74,.1);box-shadow:0 10px 22px rgba(11,42,74,.08);padding:11px 12px;font-size:11px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-financial-solution"] .financial-solution-shield{position:absolute;right:9.2%;top:20%;width:30%;height:48%;border-radius:22px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 78%,#fff 22%));border:1px solid rgba(11,42,74,.14);box-shadow:0 18px 36px rgba(11,42,74,.12);overflow:hidden;}
    body[data-layout="sales-financial-solution"] .financial-solution-shield::before{content:"";position:absolute;left:28%;top:13%;width:44%;height:62%;clip-path:polygon(50% 0,88% 18%,88% 55%,50% 100%,12% 55%,12% 18%);background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(24,160,166,.12));border:3px solid var(--template-primary);}
    body[data-layout="sales-financial-solution"] .financial-solution-shield::after{content:"";position:absolute;left:42%;top:28%;width:16%;height:34%;border-left:4px solid var(--template-accent);border-bottom:3px solid var(--template-primary);box-shadow:0 -22px 0 -8px #d6a84f;}
    body[data-layout="sales-financial-solution"] .financial-solution-shield i{position:absolute;width:13px;height:13px;border-radius:50%;background:var(--template-accent);box-shadow:0 0 0 6px rgba(24,160,166,.12);}
    body[data-layout="sales-financial-solution"] .financial-solution-shield i:nth-child(1){left:18%;top:68%;}body[data-layout="sales-financial-solution"] .financial-solution-shield i:nth-child(2){right:18%;top:68%;}body[data-layout="sales-financial-solution"] .financial-solution-shield i:nth-child(3){left:48%;top:20%;background:#d6a84f;}
    body[data-layout="sales-financial-solution"] .financial-solution-architecture{position:absolute;right:9.2%;top:22%;width:36%;height:48%;display:grid;gap:10px;}
    body[data-layout="sales-financial-solution"] .financial-solution-architecture span{border-radius:12px;background:#fff;border:1px solid rgba(11,42,74,.12);box-shadow:0 9px 18px rgba(11,42,74,.07);padding:10px 14px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-financial-solution"] .financial-solution-architecture span::before{content:"";display:inline-block;width:9px;height:9px;margin-right:8px;border-radius:50%;background:var(--template-accent);}
    body[data-layout="sales-financial-solution"] .financial-solution-matrix{position:absolute;left:9.2%;right:9.2%;bottom:15%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-financial-solution"] .financial-solution-matrix span{min-height:86px;border-radius:14px;background:#fff;border:1px solid rgba(11,42,74,.12);box-shadow:0 10px 22px rgba(11,42,74,.08);padding:14px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-financial-solution"] .financial-solution-matrix span::after{content:"";display:block;width:36px;height:3px;margin-top:12px;background:var(--template-accent);}
    body[data-layout="sales-financial-solution"] .financial-solution-value{position:absolute;right:9.2%;top:24%;width:32%;height:44%;border-radius:18px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 74%,var(--template-accent) 26%));box-shadow:0 18px 34px rgba(11,42,74,.18);}
    body[data-layout="sales-financial-solution"] .financial-solution-value span{position:absolute;left:16%;right:16%;height:8px;border-radius:999px;background:rgba(255,255,255,.72);}
    body[data-layout="sales-financial-solution"] .financial-solution-value span:nth-child(1){top:28%;width:58%;}body[data-layout="sales-financial-solution"] .financial-solution-value span:nth-child(2){top:45%;width:70%;}body[data-layout="sales-financial-solution"] .financial-solution-value span:nth-child(3){top:62%;width:46%;background:#d6a84f;}
    body[data-layout="sales-financial-solution"] .financial-solution-closing{position:absolute;left:9.2%;right:9.2%;top:50%;display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:14px;}
    body[data-layout="sales-financial-solution"] .financial-solution-closing span{min-height:104px;border-radius:14px;background:#fff;border:1px solid rgba(11,42,74,.12);box-shadow:0 12px 24px rgba(11,42,74,.08);padding:16px;font-size:13px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-financial-solution"] .page-number{z-index:4;right:7.2%;bottom:5.4%;background:rgba(255,255,255,.82);border:1px solid rgba(11,42,74,.12);border-radius:999px;padding:5px 10px;color:rgba(7,29,51,.62);}
    body[data-layout="sales-manufacturing-solution"] .slide{padding:0;border:0;background:linear-gradient(135deg,#f6f9fb 0%,var(--template-bg) 58%,#d4dde6 100%);}
    body[data-layout="sales-manufacturing-solution"] .slide::before{background:repeating-linear-gradient(90deg,rgba(18,58,90,.055) 0 1px,transparent 1px 48px),repeating-linear-gradient(0deg,rgba(23,167,184,.04) 0 1px,transparent 1px 42px),linear-gradient(115deg,rgba(18,58,90,.1) 0 10%,transparent 10%);}
    body[data-layout="sales-manufacturing-solution"] .slide::after{content:"";position:absolute;right:-7%;top:10%;width:38%;height:70%;background:linear-gradient(180deg,rgba(18,58,90,.12),rgba(23,167,184,.08));clip-path:polygon(24% 0,100% 0,76% 100%,0 100%);}
    body[data-layout="sales-manufacturing-solution"] .accent{height:7%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 66%,var(--template-accent) 34%));box-shadow:0 8px 24px rgba(18,58,90,.16);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-surface{position:absolute;left:5.8%;right:5.8%;top:12.2%;bottom:8%;border-radius:10px;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(246,249,251,.9));border:1px solid rgba(18,58,90,.16);box-shadow:0 24px 52px rgba(18,58,90,.14),inset 0 0 0 1px rgba(255,255,255,.72);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-kicker{position:absolute;left:8.4%;top:16.4%;font-size:12px;font-weight:900;letter-spacing:.14em;color:var(--template-accent);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-title{position:absolute;left:8.4%;top:23.8%;width:41%;margin:0;color:var(--template-title);font-size:32px;line-height:1.12;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-rule{position:absolute;left:8.4%;top:44.8%;width:35%;height:4px;background:linear-gradient(90deg,#f59e0b,var(--template-accent),transparent);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-bullets{position:absolute;left:8.4%;top:51%;width:39%;margin:0;padding-left:1.05em;font-size:13px;line-height:1.45;color:var(--template-body);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-bullets li{margin:.1em 0;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory{position:absolute;right:8.4%;top:21%;width:35%;height:42%;border-radius:14px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));border:1px solid rgba(18,58,90,.16);box-shadow:0 18px 36px rgba(18,58,90,.12);overflow:hidden;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory::before{content:"";position:absolute;left:9%;right:9%;bottom:18%;height:19%;background:linear-gradient(90deg,var(--template-primary),var(--template-accent));clip-path:polygon(0 100%,0 42%,15% 42%,15% 16%,30% 42%,45% 42%,45% 10%,62% 42%,100% 42%,100% 100%);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory::after{content:"";position:absolute;left:11%;right:11%;top:22%;height:4px;background:rgba(18,58,90,.16);box-shadow:0 42px 0 rgba(18,58,90,.12),0 84px 0 rgba(23,167,184,.22);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory i{position:absolute;width:12px;height:12px;border-radius:50%;background:var(--template-accent);box-shadow:0 0 0 6px rgba(23,167,184,.14);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory i:nth-child(1){left:18%;top:30%;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory i:nth-child(2){left:48%;top:43%;background:#f59e0b;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-factory i:nth-child(3){right:18%;top:30%;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-tags{position:absolute;left:8.4%;right:48%;bottom:14%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-tags span{min-height:58px;border-radius:8px;background:#fff;border:1px solid rgba(18,58,90,.12);border-top:5px solid var(--template-accent);box-shadow:0 10px 22px rgba(18,58,90,.08);padding:10px 12px;font-size:11px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-process{position:absolute;right:7.8%;top:30%;width:43%;height:20%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-items:center;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-process span{position:relative;min-height:52px;border-radius:8px;background:#fff;border:1px solid rgba(18,58,90,.14);display:grid;place-items:center;text-align:center;padding:8px;font-size:11px;font-weight:900;color:var(--template-title);box-shadow:0 9px 18px rgba(18,58,90,.07);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-process span:not(:last-child)::after{content:"";position:absolute;right:-13px;top:50%;width:18px;height:4px;background:#f59e0b;transform:translateY(-50%);z-index:2;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard{position:absolute;right:8.4%;top:20.5%;width:35%;height:46%;border-radius:14px;background:#fff;border:1px solid rgba(18,58,90,.14);box-shadow:0 18px 36px rgba(18,58,90,.12);overflow:hidden;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard::before{content:"";position:absolute;left:0;right:0;top:0;height:15%;background:var(--template-primary);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span{position:absolute;bottom:18%;width:7%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,var(--template-accent),var(--template-primary));}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span:nth-child(1){left:13%;height:30%;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span:nth-child(2){left:26%;height:48%;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span:nth-child(3){left:39%;height:62%;background:#f59e0b;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span:nth-child(4){left:52%;height:42%;}body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-dashboard span:nth-child(5){left:65%;height:70%;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-matrix{position:absolute;left:8.4%;right:8.4%;bottom:14.5%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-matrix span{min-height:76px;border-radius:10px;background:#fff;border:1px solid rgba(18,58,90,.12);box-shadow:0 10px 22px rgba(18,58,90,.08);padding:14px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-matrix span::after{content:"";display:block;width:34px;height:4px;margin-top:11px;background:#f59e0b;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-roadmap{position:absolute;left:8.4%;right:8.4%;top:55%;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:center;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-roadmap span{min-height:72px;border-radius:10px;background:#fff;border:1px solid rgba(18,58,90,.12);box-shadow:0 10px 20px rgba(18,58,90,.08);display:grid;place-items:center;text-align:center;padding:10px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-closing{position:absolute;left:8.4%;right:8.4%;top:50%;display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:14px;}
    body[data-layout="sales-manufacturing-solution"] .manufacturing-solution-closing span{min-height:104px;border-radius:10px;background:#fff;border:1px solid rgba(18,58,90,.12);box-shadow:0 12px 24px rgba(18,58,90,.08);padding:16px;font-size:13px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-manufacturing-solution"] .page-number{z-index:4;right:7%;bottom:5.3%;background:rgba(255,255,255,.82);border:1px solid rgba(18,58,90,.12);border-radius:999px;padding:5px 10px;color:rgba(31,41,51,.62);}
    body[data-layout="sales-education-solution"] .slide{padding:0;border:0;background:linear-gradient(135deg,#f8fffd 0%,var(--template-bg) 58%,#dff5ef 100%);}
    body[data-layout="sales-education-solution"] .slide::before{background:repeating-linear-gradient(90deg,rgba(21,94,117,.045) 0 1px,transparent 1px 46px),repeating-linear-gradient(0deg,rgba(34,197,94,.035) 0 1px,transparent 1px 38px),radial-gradient(circle at 82% 18%,rgba(34,197,94,.18),transparent 25%);}
    body[data-layout="sales-education-solution"] .accent{height:7.2%;z-index:2;background:linear-gradient(90deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 62%,var(--template-accent) 38%));box-shadow:inset 0 -3px 0 rgba(34,197,94,.62);}
    body[data-layout="sales-education-solution"] .education-solution-layer{position:absolute;inset:0;z-index:3;color:var(--template-body);pointer-events:none;}
    body[data-layout="sales-education-solution"] .education-solution-surface{position:absolute;left:6.2%;right:6.2%;top:12.2%;bottom:8.8%;border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.95),rgba(247,254,253,.9));border:1px solid rgba(21,94,117,.13);box-shadow:0 24px 54px rgba(21,94,117,.13),inset 0 0 0 1px rgba(255,255,255,.78);}
    body[data-layout="sales-education-solution"] .education-solution-kicker{position:absolute;left:9.1%;top:16.4%;font-size:12px;font-weight:900;letter-spacing:.16em;color:var(--template-accent);}
    body[data-layout="sales-education-solution"] .education-solution-title{position:absolute;left:9.1%;top:23.2%;width:44%;margin:0;color:var(--template-title);font-size:32px;line-height:1.13;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="sales-education-solution"] .education-solution-rule{position:absolute;left:9.1%;top:43.8%;width:35%;height:3px;background:linear-gradient(90deg,var(--template-accent),transparent);}
    body[data-layout="sales-education-solution"] .education-solution-bullets{position:absolute;left:9.1%;top:50.2%;width:39%;margin:0;padding-left:1.05em;font-size:13.2px;line-height:1.46;color:var(--template-body);}
    body[data-layout="sales-education-solution"] .education-solution-bullets li{margin:.1em 0;}
    body[data-layout="sales-education-solution"] .education-solution-platform{position:absolute;right:8.6%;top:20%;width:32%;height:45%;border-radius:18px;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 70%,#fff 30%));border:1px solid rgba(21,94,117,.14);box-shadow:0 18px 36px rgba(21,94,117,.12);overflow:hidden;}
    body[data-layout="sales-education-solution"] .education-solution-platform::before{content:"";position:absolute;left:10%;top:13%;width:31%;height:64%;border-radius:14px;background:color-mix(in srgb,var(--template-accent) 18%,#fff 82%);border:1px solid color-mix(in srgb,var(--template-accent) 34%,#fff 66%);}
    body[data-layout="sales-education-solution"] .education-solution-platform::after{content:"";position:absolute;right:10%;top:16%;width:42%;height:18%;border-radius:12px;background:color-mix(in srgb,var(--template-primary) 12%,#fff 88%);box-shadow:0 86px 0 color-mix(in srgb,var(--template-primary) 8%,#fff 92%),0 176px 0 color-mix(in srgb,var(--template-accent) 12%,#fff 88%);}
    body[data-layout="sales-education-solution"] .education-solution-platform i{position:absolute;display:block;border-radius:999px;background:var(--template-accent);}
    body[data-layout="sales-education-solution"] .education-solution-platform i:nth-child(1){left:17%;top:28%;width:14%;height:7px;background:var(--template-primary);}body[data-layout="sales-education-solution"] .education-solution-platform i:nth-child(2){left:17%;top:42%;width:19%;height:7px;}body[data-layout="sales-education-solution"] .education-solution-platform i:nth-child(3){right:18%;top:48%;width:18px;height:18px;}body[data-layout="sales-education-solution"] .education-solution-platform i:nth-child(4){right:29%;top:69%;width:18px;height:18px;background:var(--template-primary);}
    body[data-layout="sales-education-solution"] .education-solution-tags{position:absolute;left:9.1%;right:48%;bottom:14.8%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-education-solution"] .education-solution-tags span{min-height:56px;border-radius:13px;background:#fff;border:1px solid rgba(21,94,117,.12);border-top:5px solid var(--template-accent);box-shadow:0 10px 22px rgba(21,94,117,.08);padding:10px 12px;font-size:11px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-education-solution"] .education-solution-path{position:absolute;right:8.8%;top:23%;width:35%;height:47%;display:grid;grid-template-columns:1fr;gap:10px;}
    body[data-layout="sales-education-solution"] .education-solution-path span{border-radius:14px;background:#fff;border:1px solid rgba(21,94,117,.12);box-shadow:0 9px 18px rgba(21,94,117,.07);padding:10px 14px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-education-solution"] .education-solution-path span::before{content:"";display:inline-block;width:10px;height:10px;margin-right:8px;border-radius:3px;background:var(--template-accent);}
    body[data-layout="sales-education-solution"] .education-solution-scenes{position:absolute;left:9.1%;right:9.1%;bottom:14.6%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
    body[data-layout="sales-education-solution"] .education-solution-scenes span{min-height:100px;border-radius:16px;background:#fff;border:1px solid rgba(21,94,117,.12);box-shadow:0 12px 24px rgba(21,94,117,.08);padding:14px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-education-solution"] .education-solution-scenes span::after{content:"";display:block;width:42px;height:4px;margin-top:12px;border-radius:999px;background:var(--template-accent);}
    body[data-layout="sales-education-solution"] .education-solution-data{position:absolute;right:9%;top:23%;width:32%;height:44%;border-radius:18px;background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 66%,var(--template-accent) 34%));box-shadow:0 18px 34px rgba(21,94,117,.18);overflow:hidden;}
    body[data-layout="sales-education-solution"] .education-solution-data span{position:absolute;bottom:18%;width:11%;border-radius:8px 8px 0 0;background:rgba(255,255,255,.72);}
    body[data-layout="sales-education-solution"] .education-solution-data span:nth-child(1){left:17%;height:34%;}body[data-layout="sales-education-solution"] .education-solution-data span:nth-child(2){left:35%;height:55%;background:var(--template-accent);}body[data-layout="sales-education-solution"] .education-solution-data span:nth-child(3){left:53%;height:42%;}body[data-layout="sales-education-solution"] .education-solution-data span:nth-child(4){left:71%;height:64%;background:#fff;}
    body[data-layout="sales-education-solution"] .education-solution-roadmap{position:absolute;left:9.1%;right:9.1%;bottom:17%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
    body[data-layout="sales-education-solution"] .education-solution-roadmap span{min-height:74px;border-radius:15px;background:#fff;border:1px solid rgba(21,94,117,.12);box-shadow:0 10px 22px rgba(21,94,117,.08);padding:13px 12px;font-size:12px;font-weight:900;color:var(--template-title);}
    body[data-layout="sales-education-solution"] .education-solution-roadmap span::before{content:"";display:block;width:24px;height:24px;margin-bottom:8px;border-radius:50%;background:color-mix(in srgb,var(--template-accent) 70%,#fff 30%);}
    body[data-layout="sales-education-solution"] .page-number{z-index:4;right:7.2%;bottom:5.4%;background:rgba(255,255,255,.82);border:1px solid rgba(21,94,117,.12);border-radius:999px;padding:5px 10px;color:rgba(15,47,58,.62);}
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
    body[data-layout="marketing-launch-rhythm"] .slide{padding:0;border:0;background:radial-gradient(circle at 84% 18%,rgba(255,90,61,.28) 0 17%,transparent 18% 42%),radial-gradient(circle at 18% 78%,rgba(124,58,237,.26) 0 18%,transparent 19% 42%),linear-gradient(135deg,#101828 0%,#161B2E 54%,#24122C 100%);}
    body[data-layout="marketing-launch-rhythm"] .slide::before{background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 54px),repeating-linear-gradient(0deg,rgba(34,211,238,.05) 0 1px,transparent 1px 44px);}
    body[data-layout="marketing-launch-rhythm"] .slide::after{content:"";position:absolute;right:7%;top:15%;width:28%;height:54%;background:linear-gradient(180deg,rgba(255,255,255,.09),transparent);clip-path:polygon(28% 0,72% 0,100% 100%,0 100%);}
    body[data-layout="marketing-launch-rhythm"] .accent{height:0;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-layer{position:absolute;inset:0;z-index:3;color:#d7dee8;pointer-events:none;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kicker{position:absolute;left:8.8%;top:13.8%;font-size:12px;font-weight:900;letter-spacing:.16em;color:#22d3ee;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-title{position:absolute;left:8.8%;top:22%;width:45%;margin:0;color:#fff;font-size:36px;line-height:1.08;font-weight:900;overflow-wrap:anywhere;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-rule{position:absolute;left:8.8%;top:43.5%;width:34%;height:4px;background:linear-gradient(90deg,var(--template-accent),#22d3ee,transparent);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-bullets{position:absolute;left:8.8%;top:50%;width:40%;margin:0;padding-left:1.05em;font-size:13.5px;line-height:1.48;color:#d7dee8;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-bullets li{margin:.12em 0;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-countdown{position:absolute;left:8.8%;bottom:13%;font-size:54px;line-height:1;font-weight:900;color:var(--template-accent);letter-spacing:0;text-shadow:0 18px 36px rgba(255,90,61,.22);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-tags{position:absolute;left:8.8%;bottom:12%;width:36%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-tags span{min-height:42px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.10);border-radius:10px;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:900;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage{position:absolute;right:8.5%;top:24%;width:32%;height:43%;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage::before{content:"";position:absolute;left:18%;right:18%;top:14%;height:28%;border-radius:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage::after{content:"";position:absolute;left:4%;right:4%;bottom:8%;height:36%;clip-path:polygon(22% 0,78% 0,100% 100%,0 100%);border:3px solid #22d3ee;background:rgba(34,211,238,.05);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage i{position:absolute;border-radius:50%;background:var(--template-accent);box-shadow:0 0 0 7px rgba(255,90,61,.12);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage i:nth-child(1){left:49%;top:-1%;width:18px;height:18px;}body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage i:nth-child(2){left:8%;top:18%;width:12px;height:12px;background:#7c3aed;}body[data-layout="marketing-launch-rhythm"] .launch-rhythm-stage i:nth-child(3){right:8%;top:18%;width:12px;height:12px;background:#22d3ee;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-timeline{position:absolute;left:8.8%;right:8.8%;bottom:13%;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-timeline span{position:relative;min-height:74px;border-radius:14px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);padding:14px 10px 10px;color:#fff;font-size:11px;font-weight:900;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-timeline span::before{content:attr(data-step);display:block;margin-bottom:6px;color:var(--template-accent);font-size:15px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-channel-grid{position:absolute;right:8.8%;top:23%;width:35%;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-channel-grid span{min-height:88px;border-radius:14px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.22);box-shadow:0 14px 28px rgba(0,0,0,.18);padding:15px;color:#fff;font-size:12px;font-weight:900;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-channel-grid span::after{content:"";display:block;width:42px;height:4px;margin-top:14px;background:#22d3ee;border-radius:999px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi{position:absolute;right:8.8%;top:23%;width:35%;height:46%;border-radius:18px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);box-shadow:0 18px 36px rgba(0,0,0,.20);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi i{position:absolute;bottom:18%;width:12%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,var(--template-accent),#7c3aed);}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi i:nth-child(1){left:15%;height:28%;}body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi i:nth-child(2){left:35%;height:44%;}body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi i:nth-child(3){left:55%;height:62%;}body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi i:nth-child(4){left:75%;height:50%;background:#22d3ee;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi-row{position:absolute;left:8.8%;right:48%;bottom:13%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-kpi-row span{min-height:62px;border-radius:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);padding:12px;color:#fff;font-size:11px;font-weight:900;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-closing{position:absolute;left:8.8%;right:8.8%;top:52%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
    body[data-layout="marketing-launch-rhythm"] .launch-rhythm-closing span{min-height:104px;border-radius:14px;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.22);padding:16px;color:#fff;font-size:13px;font-weight:900;}
    body[data-layout="marketing-launch-rhythm"] .page-number{z-index:4;right:7.4%;bottom:5.4%;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:5px 10px;color:rgba(255,255,255,.72);}
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
    body[data-layout="quarterly-dashboard"] .slide{background:#eef3f9;padding:7.2% 6.2% 5.4%;border:0;box-shadow:0 22px 54px rgba(15,35,65,.14);}
    body[data-layout="quarterly-dashboard"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#102b4c 0 13.6%,#d7a650 13.6% 14.2%,#eef3f9 14.2% 100%);opacity:1;}
    body[data-layout="quarterly-dashboard"] .slide::after{content:"";position:absolute;left:4%;right:4%;top:17%;bottom:6%;background:linear-gradient(180deg,#fff,#f8fbff 56%,#edf5ff);border:1px solid #d8e2ef;box-shadow:0 18px 42px rgba(20,45,80,.1);}
    body[data-layout="quarterly-dashboard"] .accent,body[data-layout="quarterly-dashboard"] .motif{display:none;}
    body[data-layout="quarterly-dashboard"] .slide-content{z-index:10;height:auto;align-content:start;}
    body[data-layout="quarterly-dashboard"] h2{font-size:22px;line-height:1.08;margin:0;color:#fff;max-width:62%;position:absolute;left:6%;top:3.1%;letter-spacing:0;font-weight:900;}
    body[data-layout="quarterly-dashboard"] ul{display:none;}
    body[data-layout="quarterly-dashboard"] .slide-cover,body[data-layout="quarterly-dashboard"] .slide:last-child{background:#173861;padding:18.4% 6.4% 7%;box-shadow:0 24px 60px rgba(15,35,65,.24);}
    body[data-layout="quarterly-dashboard"] .slide-cover::before,body[data-layout="quarterly-dashboard"] .slide:last-child::before{background:radial-gradient(circle at 78% 32%,rgba(93,145,205,.42),transparent 30%),linear-gradient(135deg,#102b4c 0,#1f4d84 58%,#15345b 100%);}
    body[data-layout="quarterly-dashboard"] .slide-cover::after,body[data-layout="quarterly-dashboard"] .slide:last-child::after{display:none;}
    body[data-layout="quarterly-dashboard"] .slide-cover h2{font-size:50px;line-height:1.06;max-width:48%;color:#fff;left:6.4%;top:25.8%;text-shadow:0 12px 26px rgba(15,35,65,.24);}
    body[data-layout="quarterly-dashboard"] .slide:last-child .slide-content{padding-top:4%;}
    body[data-layout="quarterly-dashboard"] .slide:last-child h2{font-size:58px;color:#fff;max-width:47%;left:6.4%;top:25.2%;margin:0;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-kicker{position:absolute;left:6.4%;top:20.4%;z-index:8;color:#c4d8ef;font-size:16px;font-weight:900;letter-spacing:.06em;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual{position:absolute;right:6%;top:14.8%;width:38%;height:55%;z-index:5;border-radius:22px;background:linear-gradient(145deg,rgba(244,247,251,.96),rgba(196,216,239,.86));border:1px solid rgba(255,255,255,.72);box-shadow:0 26px 54px rgba(8,22,40,.32);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual::before{content:"";position:absolute;left:8%;top:10%;width:50%;height:42%;border-radius:16px;background:#fff;box-shadow:0 16px 28px rgba(18,48,82,.14);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual::after{content:"";position:absolute;right:11%;top:13%;width:25%;height:38%;border-radius:18px;background:linear-gradient(180deg,#173861,#2f64a4);box-shadow:0 16px 26px rgba(18,48,82,.2);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span{position:absolute;z-index:2;display:block;border-radius:999px;background:#5d91cd;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span:nth-child(1){left:12%;top:18%;width:9%;height:4%;background:#39d5e8;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span:nth-child(2){left:24%;top:19%;width:26%;height:2.6%;background:#c4d8ef;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span:nth-child(3){left:12%;top:31%;width:9%;height:4%;background:#d7a650;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span:nth-child(4){left:24%;top:32%;width:31%;height:2.6%;background:#c4d8ef;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual span:nth-child(5){right:16%;bottom:21%;width:18%;height:18%;background:transparent;border:7px solid rgba(255,255,255,.8);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual i{position:absolute;right:12%;bottom:17%;width:4%;height:18%;border-radius:999px;background:rgba(23,56,97,.54);transform:rotate(7deg);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-visual-closing{opacity:.86;transform:scale(.94);transform-origin:right center;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars{position:absolute;right:11%;top:39%;width:26%;height:28%;z-index:6;border-radius:16px;background:rgba(16,43,76,.14);border:1px solid rgba(196,216,239,.46);box-shadow:0 22px 40px rgba(8,22,40,.18);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span{position:absolute;bottom:13%;width:9%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#9fc2e8,#2f64a4);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span:nth-of-type(1){left:12%;height:46%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span:nth-of-type(2){left:27%;height:62%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span:nth-of-type(3){left:42%;height:38%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span:nth-of-type(4){left:57%;height:76%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars span:nth-of-type(5){left:72%;height:56%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars::before{content:"";position:absolute;left:8%;right:8%;top:13%;height:12px;border-radius:999px;background:rgba(255,255,255,.22);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-hero-bars::after{content:"";position:absolute;left:10%;right:10%;bottom:12%;height:2px;background:rgba(196,216,239,.44);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-cover-card{position:absolute;right:8%;bottom:18%;z-index:9;width:28%;border-radius:14px;background:rgba(244,247,251,.96);border:1px solid #b9d2ee;padding:16px 22px;color:var(--template-title);box-shadow:0 16px 32px rgba(8,22,40,.16);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-cover-card strong{display:block;font-size:18px;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-cover-card span{display:block;font-size:18px;font-weight:900;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-section{position:absolute;left:5.4%;top:18.4%;z-index:8;width:17%;height:4.5%;background:#173861;color:#fff;font-size:12px;font-weight:900;padding:8px 16px;border-radius:999px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 8px 18px rgba(23,56,97,.16);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-content-frame{position:absolute;left:5%;right:5%;top:24%;bottom:10%;z-index:4;border:1px solid #dbe4ef;background:linear-gradient(180deg,rgba(248,251,255,.9),rgba(255,255,255,.78));}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-command-strip{position:absolute;right:6.2%;top:18.6%;z-index:8;width:31%;height:4.2%;border-radius:999px;background:linear-gradient(90deg,#173861,#2f64a4);box-shadow:0 12px 24px rgba(23,56,97,.18);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-command-strip span{position:absolute;top:28%;width:18%;height:20%;border-radius:999px;background:rgba(255,255,255,.72);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-command-strip span:nth-child(1){left:9%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-command-strip span:nth-child(2){left:38%;background:rgba(215,166,80,.9);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-command-strip span:nth-child(3){right:9%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-insight-lens{position:absolute;right:23.5%;bottom:27.5%;z-index:5;width:12%;height:21%;border-radius:50%;border:10px solid rgba(139,178,219,.34);box-shadow:inset 0 0 0 18px rgba(255,255,255,.38),0 18px 30px rgba(20,45,80,.08);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-insight-lens::after{content:"";position:absolute;right:-24%;bottom:-18%;width:12%;height:44%;border-radius:999px;background:rgba(23,56,97,.42);transform:rotate(35deg);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-rings{position:absolute;left:6.2%;top:28%;z-index:8;display:flex;gap:16px;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-rings span{width:122px;height:72px;border-radius:12px;border:1px solid #d8e2ed;border-left:5px solid #d7a650;display:grid;align-content:center;text-align:left;color:#5c6f84;font-size:10px;font-weight:800;background:#fff;padding:10px 12px;box-shadow:0 12px 24px rgba(20,45,80,.08);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-rings strong{display:block;color:#173861;font-size:24px;line-height:1.05;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel{position:absolute;left:34%;top:24%;width:39.5%;height:31%;z-index:8;border:1px solid #d8e2ed;background:#fff;box-shadow:0 14px 28px rgba(20,45,80,.08);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-panel-title{position:absolute;left:16px;top:12px;right:16px;color:#1e2d41;font-size:12px;font-weight:900;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel::before{content:"";position:absolute;left:8%;right:8%;bottom:21%;height:1px;background:#d8e2ed;box-shadow:0 -36px 0 #eef3f9,0 -72px 0 #eef3f9;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span{position:absolute;bottom:22%;width:6%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#2f64a4,#173861);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(1){left:12%;height:42%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(2){left:25%;height:28%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(3){left:38%;height:58%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(4){left:51%;height:34%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(5){left:64%;height:58%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-bar-panel span:nth-of-type(6){left:77%;height:36%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel{position:absolute;left:6.2%;bottom:16%;width:26%;height:18%;z-index:8;border:1px solid #d8e2ed;background:#fff;box-shadow:0 12px 24px rgba(20,45,80,.07);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i{position:absolute;top:56%;width:8%;height:26%;border-radius:6px 6px 0 0;background:#2f64a4;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(n+4){top:72%;background:#b74d40;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(1),body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(4){left:24%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(2),body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(5){left:38%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(3),body[data-layout="quarterly-dashboard"] .quarterly-dashboard-client-panel i:nth-of-type(6){left:52%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-region-cards{position:absolute;right:6.2%;top:24%;z-index:8;display:grid;grid-template-columns:1fr;gap:10px;width:17.2%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-region-cards span{min-height:46px;border-radius:10px;background:#173861;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;text-align:left;box-shadow:0 10px 20px rgba(20,45,80,.12);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-region-cards span:nth-child(n+3){background:#a95646;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-region-cards strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-region-cards em{font-style:normal;font-size:16px;font-weight:900;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo{position:absolute;left:34%;bottom:16%;width:29%;height:18%;z-index:8;border:1px solid #d8e2ed;background:#fff;box-shadow:0 12px 24px rgba(20,45,80,.07);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span{position:absolute;bottom:16%;width:5.2%;background:#1d3e6e;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(1){left:11%;height:38%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(2){left:24%;height:52%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(3){left:37%;height:18%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(4){left:50%;height:76%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(5){left:63%;height:40%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo span:nth-of-type(6){left:76%;height:58%;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-combo b{position:absolute;left:12%;right:12%;top:38%;height:4px;background:#b74d40;transform:skewY(-12deg);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-pie{position:absolute;right:6.2%;bottom:16%;width:28.4%;height:18%;z-index:8;border:1px solid #d8e2ed;background:radial-gradient(circle at 34% 55%,transparent 0 18%,#fff 19%),conic-gradient(#173861 0 58%,#a95646 58% 78%,#7fa5cf 78% 100%);box-shadow:0 12px 24px rgba(20,45,80,.07);}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-pie strong{position:absolute;left:50%;right:8%;top:38%;color:#1e2d41;font-size:12px;font-weight:900;line-height:1.2;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    body[data-layout="quarterly-dashboard"] .quarterly-dashboard-footer-line{position:absolute;left:5%;right:5%;bottom:6%;height:2px;background:rgba(139,178,219,.72);z-index:8;}
    body[data-layout="quarterly-diagnosis"] .slide{background:#f4f6f8;padding:7.2% 6.2% 5.6%;border:0;box-shadow:0 20px 54px rgba(15,23,42,.12);}
    body[data-layout="quarterly-diagnosis"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#fff 0 13.5%,#f4f6f8 13.5% 100%);}
    body[data-layout="quarterly-diagnosis"] .slide::after{content:"";position:absolute;left:2.4%;right:2.4%;top:16%;height:2px;background:#111827;opacity:.82;}
    body[data-layout="quarterly-diagnosis"] .accent,body[data-layout="quarterly-diagnosis"] .motif{display:none;}
    body[data-layout="quarterly-diagnosis"] .slide-content{z-index:12;align-content:start;pointer-events:none;}
    body[data-layout="quarterly-diagnosis"] h2{max-width:37%;font-size:24px;line-height:1.16;margin:0;color:var(--template-title);}
    body[data-layout="quarterly-diagnosis"] ul{max-width:31%;margin-top:14px;background:rgba(255,255,255,.86);border:1px solid #dfe5ee;border-left:6px solid var(--template-primary);box-shadow:0 10px 24px rgba(15,23,42,.06);padding:12px 14px 12px 28px;font-size:12px;line-height:1.48;color:var(--template-body);}
    body[data-layout="quarterly-diagnosis"] .slide-cover h2{font-size:34px;max-width:36%;margin-top:2.5%;}
    body[data-layout="quarterly-diagnosis"] .slide-cover ul{max-width:30%;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-kicker{position:absolute;left:4%;top:5.6%;z-index:13;font-size:14px;font-weight:900;color:#111827;letter-spacing:.06em;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-section{position:absolute;left:4%;top:5.8%;z-index:13;font-size:15px;font-weight:900;color:#111827;letter-spacing:.05em;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model{position:absolute;left:31%;top:31%;width:38%;height:34%;z-index:8;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 16px 22px rgba(15,23,42,.15));}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model span{width:42%;height:78%;display:grid;place-items:center;text-align:center;color:#fff;font-size:27px;font-weight:900;line-height:1.18;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model span:first-child{background:linear-gradient(135deg,#1c318a,#13266f);clip-path:polygon(0 0,100% 50%,0 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model span:last-child{background:linear-gradient(135deg,#5d9162,#3d7146);clip-path:polygon(100% 0,0 50%,100% 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model b{width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:0 8px 22px rgba(15,23,42,.18);position:relative;margin:0 -10px;z-index:2;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-model b::after{content:"";position:absolute;left:16px;top:13px;width:13px;height:13px;border-right:4px solid #4f7f55;border-top:4px solid #4f7f55;transform:rotate(45deg);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-notes{position:absolute;left:4%;right:4%;top:24%;bottom:18%;z-index:7;display:flex;justify-content:space-between;pointer-events:none;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-notes span{width:24%;height:13%;background:#fff;border-left:8px solid var(--template-primary);box-shadow:0 10px 22px rgba(15,23,42,.08);padding:10px 14px;font-size:13px;font-weight:900;color:#111827;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-cover-notes span:last-child{align-self:flex-end;border-left-color:var(--template-accent);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model{position:absolute;left:34%;top:28%;width:32%;height:36%;z-index:8;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model span{position:absolute;background:var(--template-primary);box-shadow:0 10px 22px rgba(15,23,42,.12);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model span:nth-child(1){left:0;top:18%;width:50%;height:56%;clip-path:polygon(0 0,100% 50%,0 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model span:nth-child(2){right:0;top:18%;width:50%;height:56%;background:var(--template-accent);clip-path:polygon(100% 0,0 50%,100% 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model span:nth-child(3){left:43%;top:0;width:14%;height:36%;background:linear-gradient(180deg,#5d9162,transparent);clip-path:polygon(50% 0,100% 45%,66% 45%,66% 100%,34% 100%,34% 45%,0 45%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-main-model span:nth-child(4){left:43%;bottom:0;width:14%;height:36%;background:linear-gradient(0deg,#1c318a,transparent);clip-path:polygon(34% 0,66% 0,66% 55%,100% 55%,50% 100%,0 55%,34% 55%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-left-cards,body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-right-cards{position:absolute;top:24%;z-index:8;display:grid;gap:12px;width:23%;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-left-cards{left:4%;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-right-cards{right:4%;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-left-cards span,body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-right-cards span{background:#fff;min-height:48px;border-left:8px solid var(--template-primary);box-shadow:0 8px 18px rgba(15,23,42,.07);padding:12px 14px;font-size:13px;font-weight:900;color:#111827;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-right-cards span{border-left-color:var(--template-accent);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-evidence{position:absolute;left:31%;right:31%;bottom:12%;z-index:8;display:flex;gap:10px;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-evidence span{height:28px;flex:1;border-radius:999px;background:#e5eaf0;border:1px solid #cfd8e3;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-closing-model{position:absolute;left:47%;top:24%;width:36%;height:44%;z-index:8;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-closing-model span{position:absolute;background:#fff;border:2px solid #dfe5ee;box-shadow:0 12px 26px rgba(15,23,42,.08);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-closing-model span:nth-child(1){left:0;top:18%;width:76%;height:20%;background:var(--template-primary);clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-closing-model span:nth-child(2){left:22%;top:42%;width:76%;height:20%;background:var(--template-accent);clip-path:polygon(0 0,86% 0,100% 50%,86% 100%,0 100%);}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-closing-model span:nth-child(3){left:44%;top:66%;width:42%;height:20%;background:#e7edf4;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-ending{position:absolute;left:6%;bottom:18%;z-index:8;width:36%;display:grid;gap:10px;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-ending strong{font-size:28px;color:#111827;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-ending span{font-size:16px;font-weight:800;color:#4b5563;}
    body[data-layout="quarterly-diagnosis"] .quarterly-diagnosis-footer-line{position:absolute;left:4%;right:4%;bottom:7%;z-index:8;height:2px;background:#111827;opacity:.72;}
    body[data-layout="quarterly-action-loop"] main{width:min(100%,1180px);}
    body[data-layout="quarterly-action-loop"] .preview-page{justify-items:center;}
    body[data-layout="quarterly-action-loop"] .slide{width:min(100%,1120px);background:#f3f7fe;padding:0;border:0;box-shadow:0 22px 58px rgba(31,95,191,.16);}
    body[data-layout="quarterly-action-loop"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#fff 0 14.2%,#f3f7fe 14.2% 100%);}
    body[data-layout="quarterly-action-loop"] .slide::after{content:"";position:absolute;left:3.3%;right:3.3%;top:17%;bottom:8.2%;border:1px solid rgba(31,95,191,.38);background:rgba(255,255,255,.7);box-shadow:0 14px 28px rgba(31,95,191,.08);}
    body[data-layout="quarterly-action-loop"] .accent,body[data-layout="quarterly-action-loop"] .motif{display:none;}
    body[data-layout="quarterly-action-loop"] .slide-content{z-index:16;align-content:start;pointer-events:none;}
    body[data-layout="quarterly-action-loop"] .slide-content h2,body[data-layout="quarterly-action-loop"] .slide-content ul{display:none;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-content-card{position:absolute;left:6.2%;top:24.5%;z-index:18;width:35.5%;min-height:24%;display:grid;align-content:start;gap:7px;padding:14px 16px 14px 18px;border-radius:12px;background:rgba(255,255,255,.96);border:1px solid #c9ddfb;border-left:5px solid var(--template-primary);box-shadow:0 12px 26px rgba(31,95,191,.1);color:var(--template-body);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-content-card strong{display:block;margin-bottom:3px;font-size:15px;line-height:1.24;font-weight:900;color:var(--template-title);overflow-wrap:anywhere;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-content-card span{display:block;position:relative;padding-left:13px;font-size:11px;line-height:1.34;font-weight:800;overflow-wrap:anywhere;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-content-card span::before{content:"";position:absolute;left:0;top:.58em;width:5px;height:5px;border-radius:50%;background:var(--template-accent);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-content-card em{font-style:normal;color:var(--template-title);font-weight:900;}
    body[data-layout="quarterly-action-loop"] .slide-cover .quarterly-action-content-card{top:24%;width:34%;min-height:20%;padding:13px 15px;}
    body[data-layout="quarterly-action-loop"] .slide-cover .quarterly-action-content-card strong{font-size:14px;line-height:1.2;}
    body[data-layout="quarterly-action-loop"] .slide-cover .quarterly-action-content-card span{font-size:10.5px;line-height:1.28;}
    body[data-layout="quarterly-action-loop"] .slide:last-child .quarterly-action-content-card{left:7%;top:47%;width:34%;min-height:20%;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-kicker{position:absolute;left:6%;top:7.3%;z-index:15;color:var(--template-title);font-size:14px;font-weight:900;letter-spacing:.08em;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-cover-board{position:absolute;left:44%;right:6%;top:25%;bottom:18%;z-index:10;display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:18px;align-items:stretch;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-cover-board section{position:relative;background:rgba(255,255,255,.86);border:1px solid #d9e7f8;box-shadow:0 10px 26px rgba(31,95,191,.09);padding:34px 24px 18px;display:grid;align-content:start;gap:12px;text-align:center;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-cover-board strong{position:absolute;left:50%;top:-18px;transform:translateX(-50%);min-width:104px;border-radius:4px;background:linear-gradient(90deg,var(--template-primary),#174a9a);color:#fff;padding:8px 18px;font-size:13px;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-cover-board span{display:block;padding:9px 12px;border-bottom:4px solid #2d72d6;background:linear-gradient(180deg,#fff,#eef5ff);color:#41546f;font-size:12px;font-weight:800;box-shadow:0 7px 12px rgba(31,95,191,.08);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-loop-core{position:absolute;left:27%;top:12%;width:46%;height:74%;display:grid;place-items:center;pointer-events:none;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-loop-core span{position:absolute;border:4px solid var(--template-accent);border-radius:50%;opacity:.86;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-loop-core span:nth-child(1){width:58%;height:92%;transform:rotate(0deg);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-loop-core span:nth-child(2){width:72%;height:58%;transform:rotate(14deg);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-loop-core span:nth-child(3){width:42%;height:42%;background:rgba(31,95,191,.12);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-section{position:absolute;left:6%;top:7.3%;z-index:15;font-size:15px;font-weight:900;color:var(--template-title);letter-spacing:.06em;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-plan{position:absolute;left:5.5%;right:5.5%;bottom:12%;height:12%;z-index:10;display:grid;grid-template-columns:repeat(4,1fr);gap:0;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-plan span{position:relative;display:grid;place-items:center;background:linear-gradient(90deg,var(--template-primary),#2d72d6);color:#fff;font-size:12px;font-weight:900;clip-path:polygon(0 0,88% 0,100% 50%,88% 100%,0 100%,10% 50%);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-plan span:first-child{clip-path:polygon(0 0,88% 0,100% 50%,88% 100%,0 100%);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-matrix{position:absolute;left:49%;top:25%;right:7%;height:28%;z-index:10;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-matrix span{background:#fff;border-top:5px solid var(--template-primary);box-shadow:0 10px 20px rgba(31,95,191,.08);padding:18px 10px;text-align:center;font-size:13px;font-weight:900;color:var(--template-title);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress{position:absolute;left:7%;top:56%;width:35%;height:20%;z-index:10;border-radius:14px;background:#fff;border:1px solid #d8e7fb;box-shadow:0 10px 24px rgba(31,95,191,.08);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress::before{content:"杩涘害杩借釜";position:absolute;left:18px;top:14px;color:var(--template-title);font-size:13px;font-weight:900;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i{position:absolute;bottom:22%;width:8%;border-radius:6px 6px 0 0;background:var(--template-primary);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i:nth-child(1){left:14%;height:32%;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i:nth-child(2){left:29%;height:50%;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i:nth-child(3){left:44%;height:70%;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i:nth-child(4){left:59%;height:48%;background:var(--template-accent);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-progress i:nth-child(5){left:74%;height:82%;background:var(--template-accent);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-ending{position:absolute;left:6%;top:30%;z-index:10;width:34%;display:grid;gap:12px;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-ending strong{font-size:30px;color:var(--template-title);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-ending span{font-size:16px;font-weight:800;color:var(--template-body);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-roadmap{position:absolute;right:7%;top:30%;width:46%;height:42%;z-index:10;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;gap:10px;}
    body[data-layout="quarterly-action-loop"] .quarterly-action-roadmap span{height:68px;border-radius:12px;background:linear-gradient(180deg,#fff,#edf5ff);border:1px solid #d8e7fb;display:grid;place-items:center;text-align:center;font-size:12px;font-weight:900;color:var(--template-title);box-shadow:0 10px 22px rgba(31,95,191,.08);}
    body[data-layout="quarterly-action-loop"] .quarterly-action-footer-line{position:absolute;left:4%;right:4%;bottom:6.8%;height:3px;z-index:10;background:linear-gradient(90deg,var(--template-primary),#9ecbff,var(--template-accent));}
    body[data-layout="annual-summary"] .slide{background:linear-gradient(135deg,#f7fbff 0%,#ffffff 54%,#eefcff 100%);padding:7.2% 8.4% 7%;border:0;box-shadow:0 22px 58px rgba(25,88,160,.14);}
    body[data-layout="annual-summary"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(49,89,246,.035) 0 1px,transparent 1px 48px),repeating-linear-gradient(0deg,rgba(57,213,232,.03) 0 1px,transparent 1px 38px);}
    body[data-layout="annual-summary"] .slide::after{content:"";position:absolute;left:7.5%;right:7.5%;top:14%;bottom:13%;border-radius:0;background:rgba(255,255,255,.88);border-top:4px solid var(--template-accent);box-shadow:0 16px 36px rgba(30,96,180,.10);}
    body[data-layout="annual-summary"] .accent{display:none;}
    body[data-layout="annual-summary"] .motif{display:block;left:7.5%;top:14%;width:24%;height:4px;background:var(--template-primary);z-index:5;border-radius:999px;}
    body[data-layout="annual-summary"] .slide-content{display:none;}
    body[data-layout="annual-summary"] .annual-summary-text{position:absolute;z-index:9;display:grid;gap:14px;color:var(--template-body);pointer-events:none;min-width:0;}
    body[data-layout="annual-summary"] .annual-summary-text-title{display:block;margin:0;color:var(--template-title);font-size:var(--annual-title-size,28px);line-height:1.14;font-weight:900;letter-spacing:0;overflow-wrap:anywhere;word-break:break-word;max-width:100%;}
    body[data-layout="annual-summary"] .annual-summary-text-list{margin:0;padding-left:1.08em;font-size:var(--annual-body-size,13px);line-height:1.42;font-weight:650;overflow-wrap:anywhere;word-break:break-word;max-width:100%;}
    body[data-layout="annual-summary"] .annual-summary-text-list li{margin:.16em 0;}
    body[data-layout="annual-summary"] .slide:not(.slide-cover) .annual-summary-text{left:13.8%;top:20.2%;width:50.6%;grid-template-rows:auto 1fr;}
    body[data-layout="annual-summary"] .slide-cover{background:linear-gradient(125deg,#2f43f3 0%,#246df0 42%,#31c6ee 78%,#7ce8ee 100%);padding:9% 8% 7%;}
    body[data-layout="annual-summary"] .slide-cover::before{background:linear-gradient(135deg,transparent 0 58%,rgba(255,255,255,.18) 58% 64%,transparent 64%),linear-gradient(45deg,transparent 0 67%,rgba(255,255,255,.16) 67% 73%,transparent 73%),radial-gradient(circle at 86% 42%,rgba(255,255,255,.18),transparent 24%);}
    body[data-layout="annual-summary"] .slide-cover::after{left:58%;right:-3%;top:0;bottom:0;border:0;background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.04));clip-path:polygon(34% 0,100% 0,100% 100%,0 100%,24% 48%);box-shadow:none;}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-text{left:8%;top:25.8%;width:43.33%;gap:16px;}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-text-title{color:#fff;font-size:var(--annual-title-size,38px);line-height:1.08;text-shadow:0 8px 22px rgba(16,42,107,.22);}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-text-list{color:#e9fbff;font-size:var(--annual-body-size,14px);line-height:1.48;}
    body[data-layout="annual-summary"] .annual-summary-rail{display:none;}
    body[data-layout="annual-summary"] .annual-summary-rail::before{content:"ANNUAL";position:absolute;left:50%;top:12%;transform:translateX(-50%) rotate(90deg);font-size:12px;font-weight:900;letter-spacing:.24em;color:rgba(255,255,255,.52);}
    body[data-layout="annual-summary"] .annual-summary-rail span{position:absolute;left:50%;bottom:10%;transform:translateX(-50%);width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.42);display:grid;place-items:center;font-size:18px;font-weight:900;color:var(--template-accent);}
    body[data-layout="annual-summary"] .annual-summary-kicker{position:absolute;left:9.2%;top:16%;z-index:7;color:var(--template-accent);font-size:12px;font-weight:900;letter-spacing:.14em;}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-kicker{left:8%;top:18%;font-size:13px;color:#dffcff;}
    body[data-layout="annual-summary"] .annual-summary-year{position:absolute;right:8.6%;top:13.4%;z-index:7;color:color-mix(in srgb,var(--template-primary) 72%,transparent);font-size:42px;font-weight:900;letter-spacing:.04em;}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-year{right:9%;top:14%;font-size:42px;color:rgba(255,255,255,.32);}
    body[data-layout="annual-summary"] .annual-summary-ribbon{position:absolute;right:9%;top:14%;width:24%;height:7%;z-index:4;background:linear-gradient(90deg,color-mix(in srgb,var(--template-accent) 72%,#fff 28%),rgba(255,255,255,.12));clip-path:polygon(8% 0,100% 0,92% 100%,0 100%);opacity:.82;}
    body[data-layout="annual-summary"] .annual-summary-doc{position:absolute;right:14%;top:28%;width:22%;height:31%;z-index:7;filter:drop-shadow(0 20px 30px rgba(16,42,107,.22));}
    body[data-layout="annual-summary"] .annual-summary-doc::before{content:"";position:absolute;left:15%;top:4%;width:58%;height:74%;background:#fff;border-radius:2px;box-shadow:inset 0 0 0 1px rgba(49,89,246,.12);}
    body[data-layout="annual-summary"] .annual-summary-doc::after{content:"";position:absolute;right:4%;bottom:2%;width:38%;height:38%;border-radius:50%;border:8px solid rgba(255,255,255,.86);box-shadow:inset 0 0 0 3px rgba(49,89,246,.20);background:rgba(216,249,255,.42);}
    body[data-layout="annual-summary"] .annual-summary-doc span{position:absolute;z-index:2;display:block;border-radius:2px;}
    body[data-layout="annual-summary"] .annual-summary-doc span:nth-child(1){left:22%;top:18%;width:10%;height:8%;background:var(--template-accent);}
    body[data-layout="annual-summary"] .annual-summary-doc span:nth-child(2){left:38%;top:19%;width:28%;height:5%;background:#9fd9e9;}
    body[data-layout="annual-summary"] .annual-summary-doc span:nth-child(3){left:22%;top:39%;width:10%;height:8%;background:#9ae65b;}
    body[data-layout="annual-summary"] .annual-summary-doc span:nth-child(4){left:38%;top:40%;width:34%;height:5%;background:#9fd9e9;}
    body[data-layout="annual-summary"] .annual-summary-doc span:nth-child(5){right:7%;bottom:0;width:10%;height:32%;background:#5aa7c8;transform:rotate(-42deg);transform-origin:top center;border-radius:999px;}
    body[data-layout="annual-summary"] .slide:not(.slide-cover) .annual-summary-doc{display:none;}
    body[data-layout="annual-summary"] .annual-summary-ring{position:absolute;right:10.4%;top:29%;width:23%;height:40%;z-index:6;border-radius:50%;background:conic-gradient(var(--template-accent) 0 124deg,var(--template-primary) 124deg 242deg,color-mix(in srgb,var(--template-primary) 18%,#fff 82%) 242deg 360deg);box-shadow:0 22px 42px rgba(15,23,42,.18);}
    body[data-layout="annual-summary"] .annual-summary-ring::before{content:"";position:absolute;inset:13%;border-radius:50%;background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--template-bg) 72%,#fff 28%));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--template-primary) 10%,transparent);}
    body[data-layout="annual-summary"] .annual-summary-ring span{position:absolute;display:block;border-radius:999px;background:var(--template-primary);z-index:2;}
    body[data-layout="annual-summary"] .annual-summary-ring span:nth-child(1){left:33%;top:47%;width:34%;height:7px;}
    body[data-layout="annual-summary"] .annual-summary-ring span:nth-child(2){left:47%;top:31%;width:7px;height:34%;background:var(--template-accent);}
    body[data-layout="annual-summary"] .annual-summary-ring span:nth-child(3){left:42%;top:42%;width:18%;height:18%;border-radius:50%;background:#fff;border:6px solid var(--template-primary);}
    body[data-layout="annual-summary"] .annual-summary-dashboard{position:absolute;right:8.7%;top:31%;width:24%;height:33%;z-index:6;border-radius:0;background:rgba(255,255,255,.78);border:1px solid color-mix(in srgb,var(--template-primary) 12%,transparent);box-shadow:0 16px 32px rgba(15,23,42,.12);overflow:hidden;}
    body[data-layout="annual-summary"] .slide-cover .annual-summary-dashboard{display:none;}
    body[data-layout="annual-summary"] .annual-summary-dashboard::before{content:"";position:absolute;left:10%;right:10%;top:16%;height:8px;background:var(--template-primary);}
    body[data-layout="annual-summary"] .annual-summary-dashboard span{position:absolute;display:block;background:var(--template-accent);}
    body[data-layout="annual-summary"] .annual-summary-dashboard span:nth-child(1){left:13%;bottom:18%;width:10%;height:26%;border-radius:3px 3px 0 0;}
    body[data-layout="annual-summary"] .annual-summary-dashboard span:nth-child(2){left:29%;bottom:18%;width:10%;height:43%;border-radius:3px 3px 0 0;background:var(--template-primary);}
    body[data-layout="annual-summary"] .annual-summary-dashboard span:nth-child(3){left:45%;bottom:18%;width:10%;height:56%;border-radius:3px 3px 0 0;}
    body[data-layout="annual-summary"] .annual-summary-dashboard span:nth-child(4){left:67%;top:39%;width:21%;height:21%;border-radius:50%;background:color-mix(in srgb,var(--template-accent) 75%,#fff 25%);}
    body[data-layout="annual-summary"] .annual-summary-dashboard span:nth-child(5){left:13%;right:13%;bottom:16%;height:2px;background:color-mix(in srgb,var(--template-primary) 45%,transparent);}
    body[data-layout="annual-summary"] .annual-summary-metrics{position:absolute;left:10%;right:42.5%;bottom:15.5%;z-index:8;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
    body[data-layout="annual-summary"] .annual-summary-metrics span{min-height:62px;border-radius:0;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--template-accent) 9%,#fff 91%));border-top:4px solid var(--template-accent);box-shadow:0 12px 24px rgba(15,23,42,.08);display:grid;align-content:center;gap:3px;padding:0 14px;color:var(--template-body);font-size:11px;font-weight:800;}
    body[data-layout="annual-summary"] .annual-summary-metrics strong{font-size:19px;line-height:1;color:var(--template-title);}
    body[data-layout="annual-summary"] .annual-summary-diagnostic{position:absolute;left:16.66%;right:42%;bottom:17.8%;z-index:6;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
    body[data-layout="annual-summary"] .annual-summary-diagnostic span{height:44px;border-radius:0;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--template-accent) 10%,#fff 90%));border-top:4px solid var(--template-accent);box-shadow:0 10px 20px rgba(15,23,42,.07);}
    body[data-layout="annual-summary"] .annual-summary-timeline{position:absolute;left:17%;right:9%;bottom:11.8%;height:18px;z-index:7;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;}
    body[data-layout="annual-summary"] .annual-summary-timeline::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:linear-gradient(90deg,var(--template-primary),var(--template-accent),color-mix(in srgb,var(--template-primary) 28%,#fff 72%));}
    body[data-layout="annual-summary"] .annual-summary-timeline span{position:relative;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid var(--template-accent);}
    body[data-layout="annual-summary"] .page-number{z-index:8;right:7.4%;bottom:6.8%;color:color-mix(in srgb,var(--template-title) 68%,transparent);background:rgba(255,255,255,.70);border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:4px 9px;}
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
    /* 椤堕儴鍗＄墖鐗堝紡(image-report/showcase/retrospective)标题不再被内层块垂直居中压住卡片:置顶 + 娴呰壊鍙銆?*/
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

/**
 * 渲染年度总结模板的专用文字层。
 * 普通 h2/ul 在长文本下容易和装饰层叠加，因此年度模板用独立文本框承载动态标题和要点。
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function renderAnnualSummaryTextPreview(slide, index) {
  const isCover = index === 0;
  const title = normalizeSlideText(slide?.title, `Slide ${index + 1}`);
  const bullets = Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => annualSummaryPreviewText(bullet)).filter(Boolean)
    : [];
  const titleSize = annualSummaryPreviewTitleSize(title, isCover);
  const bodySize = annualSummaryPreviewBodySize(bullets, isCover);
  const list = bullets.length > 0
    ? `<ul class="annual-summary-text-list">${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
    : "";
  return `<div class="annual-summary-text" style="--annual-title-size:${titleSize}px;--annual-body-size:${bodySize}px"><strong class="annual-summary-text-title">${escapeHtml(title)}</strong>${list}</div>`;
}

/**
 * 将结构化 bullet 转成预览文字，避免对象值在 HTML 里显示为 [object Object]。
 * @param {unknown} value
 * @returns {string}
 */
function annualSummaryPreviewText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    for (const key of ["text", "title", "label", "name", "value", "summary", "description"]) {
      if (value[key] != null) return String(value[key]).trim();
    }
  }
  return "";
}

/**
 * 根据标题长度给年度预览标题降字号，优先保证文字完整显示。
 * @param {string} title
 * @param {boolean} isCover
 * @returns {number}
 */
function annualSummaryPreviewTitleSize(title, isCover) {
  const units = estimateTextUnits(title);
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

/**
 * 根据要点总长度给年度预览正文降字号，减少长要点互相覆盖。
 * @param {string[]} bullets
 * @param {boolean} isCover
 * @returns {number}
 */
function annualSummaryPreviewBodySize(bullets, isCover) {
  const units = bullets.reduce((sum, item) => sum + estimateTextUnits(item), 0);
  const base = isCover ? 14 : 13;
  if (units > 180) return 8.5;
  if (units > 140) return 9.5;
  if (units > 100) return 10.5;
  if (units > 70) return 11.5;
  return base;
}

/**
 * 估算中英文混排长度，中文按更宽的字符计算。
 * @param {string} text
 * @returns {number}
 */
function estimateTextUnits(text) {
  return Array.from(String(text || "")).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
}

function annualSummaryPreviewScene(visual) {
  const variant = annualSummaryVariant(visual);
  const scenes = {
    "blue-gold": {
      variant: "blue-gold",
      year: "2026",
      kicker: "ANNUAL REVIEW",
      section: "OPERATING INSIGHT",
      metrics: [
        { value: "128%", label: "年度目标达成" },
        { value: "36%", label: "核心业务增长" },
        { value: "12", label: "重点项目落地" },
      ],
    },
  };
  return scenes[variant] || scenes["blue-gold"];
}

function annualSummaryVariant(visual) {
  return ["blue-gold"].includes(visual?.variant) ? visual.variant : "blue-gold";
}

function isAnnualSummaryVisual(visual) {
  return visual?.layout === "annual-summary";
}

function budgetPlanningPreviewScene({ slide, index, total }) {
  const bullets = budgetPlanningBulletTexts(slide);
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 28 : 24);
  const role = index === 0 ? "cover" : index === total - 1 ? "closing" : ["overview", "allocation", "table", "flow"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetPlanningMetricFromText(bullets[itemIndex], itemIndex));
  return {
    variant: "budget-planning",
    role,
    kicker: role === "cover" ? "FINANCIAL PLAN" : "BUDGET WORKBOOK",
    title,
    bullets: bullets.slice(0, role === "cover" ? 3 : 4),
    metrics,
    tableRows: [
      ["科目", "预算值", "依据", "负责人"],
      ...[0, 1, 2].map((rowIndex) => {
        const text = budgetPlanningCompactText(bullets[rowIndex], title, 18);
        return [text || `预算科目 ${rowIndex + 1}`, metrics[rowIndex].value, "业务计划", `部门 ${rowIndex + 1}`];
      }),
    ],
    flowSteps: ["需求提交", "部门初审", "财务复核", "管理审批", "定稿发布"],
  };
}

function renderBudgetPlanningPreview(slide, scene) {
  const bulletItems = scene.bullets.map((item) => `<li>${escapeHtml(budgetPlanningCompactText(item, scene.title, 42))}</li>`).join("");
  const metrics = scene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("");
  const table = scene.tableRows.map((row) => `<span>${row.map((cell) => `<b>${escapeHtml(cell)}</b>`).join("")}</span>`).join("");
  const flow = scene.flowSteps.map((step, index) => `<span data-step="${index + 1}">${escapeHtml(step)}</span>`).join("");
  const allocation = '<div class="budget-allocation"><i></i><i></i><i></i><i></i></div>';
  const closing = `<div class="budget-closing"><span>${escapeHtml(scene.bullets[0] || scene.title)}</span><span>${escapeHtml(scene.bullets[1] || "明确预算责任、审批节奏和后续跟踪机制")}</span></div>`;
  const visual = scene.role === "flow"
    ? `<div class="budget-flow">${flow}</div>`
    : scene.role === "table"
      ? `<div class="budget-table">${table}</div>`
      : scene.role === "allocation"
        ? allocation
        : scene.role === "closing"
          ? closing
          : `<div class="budget-dashboard"></div><div class="budget-amount-cards">${metrics}</div>`;
  return `<div class="budget-layer"><div class="budget-surface"></div><div class="budget-kicker">${escapeHtml(scene.kicker)}</div><h2 class="budget-title">${escapeHtml(scene.title)}</h2><div class="budget-rule"></div><ul class="budget-bullets">${bulletItems}</ul>${visual}</div>`;
}

function budgetPlanningBulletTexts(slide) {
  return Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
}

function budgetPlanningMetricFromText(text, index) {
  const fallbackValues = ["01", "02", "03"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: `预算项 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  const label = budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10);
  return { value, label };
}

function budgetPlanningCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function isBudgetPlanningVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-planning" && (id === "budget-management-report" || id === "finance-budget-management-report-budget-planning");
}

function budgetVariancePreviewScene({ slide, index, total }) {
  const bullets = budgetPlanningBulletTexts(slide);
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 28 : 24);
  const role = index === 0 ? "cover" : index === total - 1 ? "loop" : ["overview", "comparison", "analysis", "correction"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetVarianceMetricFromText(bullets[itemIndex], itemIndex));
  return {
    variant: "execution-variance",
    role,
    // 页面角标使用业务语义，不直接暴露主题风格名称。
    kicker: role === "cover" ? "BUDGET REVIEW" : "VARIANCE BOARD",
    title,
    bullets: bullets.slice(0, role === "cover" ? 3 : 4),
    metrics,
    reasons: [
      budgetPlanningCompactText(bullets[0], "关键洞察", 12),
      budgetPlanningCompactText(bullets[1], "原因拆解", 12),
      budgetPlanningCompactText(bullets[2], "策略判断", 12),
    ],
    actions: ["确认口径", "锁定责任", "调整节奏", "复盘闭环"],
  };
}

function renderBudgetVariancePreview(slide, scene) {
  const bulletItems = scene.bullets.map((item) => `<li>${escapeHtml(budgetPlanningCompactText(item, scene.title, 42))}</li>`).join("");
  const metrics = scene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("");
  const actions = scene.actions.map((step, index) => `<span data-step="${index + 1}">${escapeHtml(step)}</span>`).join("");
  const visual = scene.role === "comparison"
    ? '<div class="variance-waterfall"><span></span><span></span><span></span><span></span><span></span></div>'
    : scene.role === "analysis"
      ? `<div class="variance-analysis"><div class="variance-trend"></div><div class="variance-reasons">${scene.reasons.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></div>`
      : scene.role === "correction"
        ? `<div class="variance-actions">${actions}</div>`
        : scene.role === "loop"
          ? `<div class="variance-loop"><span></span><span></span><span></span><span></span></div><div class="variance-actions">${actions}</div>`
          : `<div class="variance-ledger"><span></span><span></span><span></span><span></span><i></i></div><div class="variance-metrics">${metrics}</div>`;
  return `<div class="variance-layer"><div class="variance-surface"></div><div class="variance-kicker">${escapeHtml(scene.kicker)}</div><h2 class="variance-title">${escapeHtml(scene.title)}</h2><div class="variance-rule"></div><ul class="variance-bullets">${bulletItems}</ul>${visual}</div>`;
}

function budgetVarianceMetricFromText(text, index) {
  const fallbackValues = ["86%", "12.8", "+24%"];
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValues[index] || "00", label: ["预算达成", "偏差金额", "纠偏进度"][index] || `指标 ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*(?:万|亿|%|元|天)?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValues[index] || "00";
  const labelSource = match ? raw.replace(match[1], "") : raw;
  const label = budgetPlanningCompactText(labelSource.replace(/[：:，,。]/g, " ").trim(), raw, 10);
  return { value, label };
}

function isBudgetVarianceVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-variance" && (id === "budget-management-report" || id === "finance-budget-management-report-execution-variance");
}

function budgetAdjustmentPreviewScene({ slide, index, total }) {
  const bullets = budgetPlanningBulletTexts(slide);
  const title = budgetPlanningCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 28 : 24);
  const role = index === 0 ? "cover" : index === total - 1 ? "closing" : ["reallocation", "analysis", "approval", "impact"][(index - 1) % 4];
  const metrics = [0, 1, 2].map((itemIndex) => budgetPlanningMetricFromText(bullets[itemIndex], itemIndex));
  return {
    variant: "budget-adjustment",
    role,
    kicker: role === "cover" ? "BUDGET DECISION" : "ADJUSTMENT BOARD",
    title,
    bullets: bullets.slice(0, role === "cover" ? 3 : 4),
    metrics,
    approvalSteps: ["业务申请", "财务复核", "影响评估", "管理审批", "预算落账"],
    bridge: [
      budgetPlanningCompactText(bullets[0], "原预算基线", 16),
      budgetPlanningCompactText(bullets[1], "偏差原因", 16),
      budgetPlanningCompactText(bullets[2], "调整后方案", 16),
    ],
    impacts: [
      budgetPlanningCompactText(bullets[0], "收入影响", 14),
      budgetPlanningCompactText(bullets[1], "成本影响", 14),
      budgetPlanningCompactText(bullets[2], "现金流影响", 14),
      budgetPlanningCompactText(bullets[3], "项目进度影响", 14),
    ],
  };
}

function renderBudgetAdjustmentPreview(slide, scene) {
  const bulletItems = scene.bullets.map((item) => `<li>${escapeHtml(budgetPlanningCompactText(item, scene.title, 42))}</li>`).join("");
  const metrics = scene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("");
  const approval = scene.approvalSteps.map((step, index) => `<span data-step="${index + 1}">${escapeHtml(step)}</span>`).join("");
  const roleVisual = scene.role === "approval"
    ? `<div class="adjustment-approval">${approval}</div>`
    : scene.role === "analysis"
      ? `<div class="adjustment-bridge"><span>${escapeHtml(scene.bridge[0])}</span><b></b><span>${escapeHtml(scene.bridge[2])}</span></div>`
      : scene.role === "reallocation"
        ? '<div class="adjustment-reallocation"><i></i><i></i><i></i><i></i></div>'
        : scene.role === "impact"
          ? `<div class="adjustment-impact">${scene.impacts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : scene.role === "closing"
            ? `<div class="adjustment-closing"><span>${escapeHtml(scene.bullets[0] || "确认调整口径")}</span><span>${escapeHtml(scene.bullets[1] || "完成审批落账")}</span><span>${escapeHtml(scene.bullets[2] || "持续跟踪影响")}</span></div>`
            : `<div class="adjustment-dashboard"></div><div class="adjustment-metrics">${metrics}</div>`;
  return `<div class="adjustment-layer"><div class="adjustment-surface"></div><div class="adjustment-kicker">${escapeHtml(scene.kicker)}</div><h2 class="adjustment-title">${escapeHtml(scene.title)}</h2><div class="adjustment-rule"></div><ul class="adjustment-bullets">${bulletItems}</ul>${roleVisual}</div>`;
}

function isBudgetAdjustmentVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "finance-budget-adjustment" && (id === "budget-management-report" || id === "finance-budget-management-report-budget-adjustment");
}

function quarterlyDashboardPreviewScene({ visual, slide, index }) {
  const bullets = quarterlyDashboardBulletTexts(slide);
  const metrics = [0, 1].map((item) => quarterlyDashboardMetricFromText(bullets[item], item));
  const regions = [2, 3, 4, 5].map((bulletIndex, itemIndex) => {
    const metric = quarterlyDashboardMetricFromText(bullets[bulletIndex], itemIndex + 2);
    return {
      name: metric.label,
      rate: metric.value,
    };
  });
  const title = quarterlyDashboardCompactText(slide?.title, `Page ${index + 1}`, 16);
  return {
    variant: quarterlyDashboardVariant(visual),
    // 装饰层文案从当前页内容派生，避免模板出现固定样例文本。
    kicker: quarterlyDashboardCompactText(bullets[0], title, 30),
    section: title,
    reportYear: quarterlyDashboardCompactText(bullets[0], title, 24),
    coverCaption: quarterlyDashboardCompactText(bullets.slice(1, 4).join(" / "), title, 28),
    endingTitle: title,
    endingCaption: quarterlyDashboardCompactText(bullets[0], title, 30),
    metrics,
    barTitle: quarterlyDashboardCompactText(bullets[0], title, 18),
    clientTitle: quarterlyDashboardCompactText(bullets[1], title, 18),
    comboTitle: quarterlyDashboardCompactText(bullets[2], title, 18),
    pieTitle: quarterlyDashboardCompactText(bullets[3], title, 12),
    regions,
  };
}

function quarterlyDashboardBulletTexts(slide) {
  return Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
}

function quarterlyDashboardMetricFromText(text, index) {
  const fallbackValue = String(index + 1).padStart(2, "0");
  const raw = String(text || "").trim();
  if (!raw) return { value: fallbackValue, label: `Item ${index + 1}` };
  const match = raw.match(/([+-]?\d+(?:\.\d+)?\s*%?)/);
  const value = match ? match[1].replace(/\s+/g, "") : fallbackValue;
  const label = quarterlyDashboardCompactText(raw.replace(match?.[1] || "", "").replace(/[：:，,。]/g, " ").trim(), raw, 12);
  return { value, label };
}

function quarterlyDashboardCompactText(text, fallback, maxLength) {
  const normalized = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function renderQuarterlyActionContentPreview(slide, role) {
  // 行动闭环页的可变内容集中放在独立卡片内，避免用户编辑文字和流程装饰层重叠。
  const bullets = Array.isArray(slide?.bullets)
    ? slide.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
  const title = quarterlyDashboardCompactText(slide?.title, "本页重点", role === "cover" ? 24 : 22);
  const titleText = quarterlyDashboardCompactText(title, "本页重点", role === "cover" ? 42 : 48);
  const items = bullets.slice(0, role === "cover" ? 2 : 3);
  const body = items.map((item) => `<span>${escapeHtml(quarterlyDashboardCompactText(item, title, role === "cover" ? 36 : 42))}</span>`).join("");
  return `<div class="quarterly-action-content-card"><strong>${escapeHtml(titleText)}</strong>${body}</div>`;
}

function quarterlyDashboardVariant(visual) {
  return ["dashboard"].includes(visual?.variant) ? visual.variant : "dashboard";
}

function isQuarterlyDashboardVisual(visual) {
  return visual?.id === "quarterly-business-review" && visual?.layout === "quarterly-dashboard";
}

function quarterlyDiagnosisPreviewScene(visual) {
  const variant = quarterlyDiagnosisVariant(visual);
  const scenes = {
    "problem-diagnosis": {
      variant: "problem-diagnosis",
      kicker: "DIAGNOSIS REVIEW",
      section: "ISSUE ANALYSIS",
      endingTitle: "诊断结论与改善方向",
      endingCaption: "问题闭环 / 责任到人 / 下季追踪",
      leftCards: ["目标偏差", "过程断点", "资源瓶颈", "协同低效"],
      rightCards: ["原因归因", "优先级排序", "整改动作", "跟踪机制"],
    },
  };
  return scenes[variant] || scenes["problem-diagnosis"];
}

function quarterlyDiagnosisVariant(visual) {
  return ["problem-diagnosis"].includes(visual?.variant) ? visual.variant : "problem-diagnosis";
}

function isQuarterlyDiagnosisVisual(visual) {
  return ["quarterly-business-review", "business-quarterly-review-problem-diagnosis"].includes(visual?.id) && visual?.layout === "quarterly-diagnosis";
}

function quarterlyActionLoopPreviewScene(visual) {
  const variant = quarterlyActionLoopVariant(visual);
  const scenes = {
    "action-loop": {
      variant: "action-loop",
      kicker: "ACTION LOOP REVIEW",
      section: "EXECUTION CLOSED LOOP",
      coverTitle: "2026-2025 季度重点工作行动闭环",
      endingTitle: "复盘沉淀与下一步行动",
      endingCaption: "目标拆解 / 执行追踪 / 结果复盘 / 持续优化",
      columns: [
        { title: "目标拆解", items: ["完成经营目标", "明确关键动作", "分解重点项目", "沉淀检查标准"] },
        { title: "执行追踪", items: ["任务看板", "周度同步", "风险预警", "资源协调"] },
        { title: "结果复盘", items: ["目标达成", "经验沉淀", "问题修复", "下季计划"] },
      ],
      steps: ["计划", "执行", "检查", "复盘"],
      owners: ["负责人", "协同部门", "截止日期"],
    },
  };
  return scenes[variant] || scenes["action-loop"];
}

function quarterlyActionLoopVariant(visual) {
  return ["action-loop"].includes(visual?.variant) ? visual.variant : "action-loop";
}

function isQuarterlyActionLoopVisual(visual) {
  return visual?.id === "quarterly-business-review" && visual?.layout === "quarterly-action-loop";
}

function renderIndustryResearchPreview(slide, scene) {
  const items = Array.isArray(slide?.bullets) ? slide.bullets.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const bullets = items.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const metricValues = scene.metrics.map((metric) => `<span><strong>${escapeHtml(metric.value)}</strong>${escapeHtml(metric.label)}</span>`).join("");
  const chain = scene.chain.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const risks = scene.risks.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const title = escapeHtml(slide?.title || scene.title);
  const common = `<div class="industry-kicker">${escapeHtml(scene.kicker)}</div><h2 class="industry-title">${title}</h2>${bullets ? `<ul class="industry-bullets">${bullets}</ul>` : ""}`;
  if (scene.kind === "cover") {
    return `<div class="industry-layer">${common}<div class="industry-map"></div><div class="industry-metric-row">${metricValues}</div></div>`;
  }
  if (scene.kind === "chain") {
    return `<div class="industry-layer">${common}<div class="industry-chain">${chain}</div><div class="industry-map"></div></div>`;
  }
  if (scene.kind === "competition") {
    return `<div class="industry-layer">${common}<div class="industry-matrix"><i></i><i></i><i></i><i></i></div><div class="industry-risk">${risks}</div></div>`;
  }
  if (scene.kind === "risk") {
    return `<div class="industry-layer">${common}<div class="industry-opportunity-grid"><span></span><span></span><span></span><span></span></div><div class="industry-risk">${risks}</div></div>`;
  }
  if (scene.kind === "closing") {
    return `<div class="industry-layer">${common}<div class="industry-closing-line"></div><div class="industry-chain">${chain}</div></div>`;
  }
  return `<div class="industry-layer">${common}<div class="industry-map"></div><div class="industry-metric-row">${metricValues}</div></div>`;
}

function industryResearchPreviewScene({ slide, index, total }) {
  const fallbackTitle = slide?.title || "关键判断";
  const scenes = [
    {
      kind: "cover",
      variant: "industry-landscape",
      kicker: "MARKET STRUCTURE",
      title: fallbackTitle,
      metrics: [
        { value: "规模", label: "市场容量" },
        { value: "增速", label: "增长变化" },
        { value: "玩家", label: "核心竞争" },
      ],
      chain: ["上游资源", "核心环节", "下游客户"],
      risks: ["结构变化", "竞争分层", "机会窗口"],
    },
    {
      kind: "overview",
      variant: "industry-landscape",
      kicker: "MARKET OVERVIEW",
      title: fallbackTitle,
      metrics: [
        { value: "TAM", label: "总体市场" },
        { value: "CAGR", label: "增长速度" },
        { value: "TOP", label: "头部集中" },
      ],
      chain: ["规模", "增速", "结构"],
      risks: ["市场边界", "增长驱动", "结构拆分"],
    },
    {
      kind: "chain",
      variant: "industry-landscape",
      kicker: "VALUE CHAIN",
      title: fallbackTitle,
      metrics: [],
      chain: ["上游供给", "核心制造", "渠道与客户"],
      risks: ["价值迁移", "瓶颈环节", "利润分布"],
    },
    {
      kind: "competition",
      variant: "industry-landscape",
      kicker: "COMPETITIVE MAP",
      title: fallbackTitle,
      metrics: [],
      chain: ["领先者", "挑战者", "利基者"],
      risks: ["头部玩家", "差异定位", "能力边界"],
    },
    {
      kind: "risk",
      variant: "industry-landscape",
      kicker: "OPPORTUNITY & RISK",
      title: fallbackTitle,
      metrics: [],
      chain: ["优先级", "资源", "节奏"],
      risks: ["机会窗口", "关键风险", "建议动作"],
    },
  ];
  if (index === total - 1) {
    return {
      kind: "closing",
      variant: "industry-landscape",
      kicker: "NEXT STEPS",
      title: fallbackTitle,
      metrics: [],
      chain: ["补充研究", "策略判断", "落地路径"],
      risks: ["下一步"],
    };
  }
  return scenes[Math.min(index, scenes.length - 1)];
}

function isIndustryResearchVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "industry-research" && (id === "industry-research" || id === "strategy-industry-research-industry-landscape");
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
    "control-room": {
      variant: "control-room",
      label: "CONTROL PANEL",
      chip: "监控",
      points: ["核心指标", "趋势监控", "经营结论"],
    },
    warning: {
      variant: "warning",
      label: "RISK SIGNAL",
      chip: "预警",
      points: ["异常指标", "影响范围", "处置动作"],
    },
    monthly: {
      variant: "monthly",
      label: "MONTHLY REVIEW",
      chip: "月报",
      points: ["月度指标", "重点事项", "下月动作"],
    },
  };
  return scenes[variant] || scenes.quarterly;
}

function financialReviewVariant(visual) {
  return ["quarterly", "audit", "forecast", "control-room", "warning", "monthly"].includes(visual?.variant) ? visual.variant : "quarterly";
}

function isFinancialReviewVisual(visual) {
  const id = String(visual?.id || "");
  return (id === "financial-review" || id === "operating-dashboard" || id.startsWith("finance-operating-dashboard-")) && visual?.layout === "executive";
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

function financialSolutionPreviewScene({ slide, index, total }) {
  const bullets = financialSolutionBulletTexts(slide);
  const title = financialSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const role = index === 0
    ? "cover"
    : index === total - 1
      ? "closing"
      : ["painpoints", "architecture", "compliance", "value"][(index - 1) % 4];
  const tags = ["合规安全", "架构升级", "价值增长"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const architecture = ["客户触点", "业务中台", "数据风控", "合规审计"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 12));
  const matrix = ["监管合规", "数据安全", "流程提效", "客户体验"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    variant: "financial-industry",
    role,
    kicker: role === "cover" ? "FINANCIAL SOLUTION" : role === "architecture" ? "SOLUTION ARCHITECTURE" : role === "compliance" ? "COMPLIANCE VALUE" : role === "value" ? "BUSINESS VALUE" : "CLIENT NEXT STEP",
    title,
    bullets,
    tags,
    architecture,
    matrix,
  };
}

function renderFinancialSolutionPreview(slide, scene) {
  const bulletItems = scene.bullets.slice(0, 4).map((item) => `<li>${escapeHtml(financialSolutionCompactText(item, scene.title, 42))}</li>`).join("");
  const tags = scene.tags.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const architecture = scene.architecture.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const matrix = scene.matrix.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const shield = '<div class="financial-solution-shield"><i></i><i></i><i></i></div>';
  const visual = scene.role === "architecture"
    ? `<div class="financial-solution-architecture">${architecture}</div>`
    : scene.role === "compliance" || scene.role === "value"
      ? `<div class="financial-solution-value"><span></span><span></span><span></span></div><div class="financial-solution-matrix">${matrix}</div>`
      : scene.role === "closing"
        ? `<div class="financial-solution-closing">${scene.matrix.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : `${shield}<div class="financial-solution-tags">${tags}</div>`;
  return `<div class="financial-solution-layer"><div class="financial-solution-surface"></div><div class="financial-solution-kicker">${escapeHtml(scene.kicker)}</div><h2 class="financial-solution-title">${escapeHtml(scene.title)}</h2><div class="financial-solution-rule"></div><ul class="financial-solution-bullets">${bulletItems}</ul>${visual}</div>`;
}

function financialSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["金融客户场景痛点与合规要求", "安全可靠的数字化方案架构", "业务效率提升与客户体验增长"];
}

function financialSolutionCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function isFinancialSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-financial-solution" && (id === "industry-solution" || id === "sales-industry-solution-financial-industry");
}

function manufacturingSolutionPreviewScene({ slide, index, total }) {
  const bullets = manufacturingSolutionBulletTexts(slide);
  const title = financialSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const role = index === 0
    ? "cover"
    : index === total - 1
      ? "closing"
      : ["painpoints", "architecture", "process", "dashboard", "value", "roadmap"][(index - 1) % 6];
  const tags = ["流程提效", "设备联机", "交付闭环"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const process = ["计划", "生产", "质检", "仓储", "交付"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 8));
  const matrix = ["降本", "提效", "稳质", "追溯"].map((fallback, itemIndex) => financialSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    variant: "manufacturing-industry",
    role,
    kicker: role === "cover" ? "SMART FACTORY SOLUTION" : role === "architecture" ? "DIGITAL ARCHITECTURE" : role === "process" ? "PROCESS OPTIMIZATION" : role === "dashboard" ? "EQUIPMENT DASHBOARD" : role === "roadmap" ? "DELIVERY ROADMAP" : role === "value" ? "BUSINESS VALUE" : "CLIENT NEXT STEP",
    title,
    bullets,
    tags,
    process,
    matrix,
  };
}

function renderManufacturingSolutionPreview(slide, scene) {
  const bulletItems = scene.bullets.slice(0, 4).map((item) => `<li>${escapeHtml(financialSolutionCompactText(item, scene.title, 42))}</li>`).join("");
  const tags = scene.tags.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const process = scene.process.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const matrix = scene.matrix.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const factory = '<div class="manufacturing-solution-factory"><i></i><i></i><i></i></div>';
  const dashboard = '<div class="manufacturing-solution-dashboard"><span></span><span></span><span></span><span></span><span></span></div>';
  // 制造行业页面用流程、看板和价值卡承载正文，避免再输出普通列表造成文字叠加。
  const visual = scene.role === "process" || scene.role === "architecture"
    ? `<div class="manufacturing-solution-process">${process}</div><div class="manufacturing-solution-matrix">${matrix}</div>`
    : scene.role === "dashboard" || scene.role === "value"
      ? `${dashboard}<div class="manufacturing-solution-matrix">${matrix}</div>`
      : scene.role === "roadmap"
        ? `<div class="manufacturing-solution-roadmap">${process}</div>`
        : scene.role === "closing"
          ? `<div class="manufacturing-solution-closing">${scene.matrix.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : `${factory}<div class="manufacturing-solution-tags">${tags}</div>`;
  return `<div class="manufacturing-solution-layer"><div class="manufacturing-solution-surface"></div><div class="manufacturing-solution-kicker">${escapeHtml(scene.kicker)}</div><h2 class="manufacturing-solution-title">${escapeHtml(scene.title)}</h2><div class="manufacturing-solution-rule"></div><ul class="manufacturing-solution-bullets">${bulletItems}</ul>${visual}</div>`;
}

function manufacturingSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["制造现场流程瓶颈与设备数据孤岛", "产线联机和工厂流程优化方案", "效率提升、质量稳定和交付收益"];
}

function isManufacturingSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-manufacturing-solution" && (id === "industry-solution" || id === "sales-industry-solution-manufacturing-industry");
}

function educationSolutionPreviewScene({ slide, index, total }) {
  const bullets = educationSolutionBulletTexts(slide);
  const title = educationSolutionCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const role = index === 0
    ? "cover"
    : index === total - 1
      ? "roadmap"
      : ["painpoints", "platform", "scenarios", "data"][(index - 1) % 4];
  const tags = ["教学场景", "平台服务", "数据洞察"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 8));
  const path = ["课程资源", "教学互动", "学情分析", "运营服务"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 12));
  const scenes = ["教师备课", "学生学习", "管理决策"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 12));
  const roadmap = ["调研", "试点", "推广", "运营"].map((fallback, itemIndex) => educationSolutionCompactText(bullets[itemIndex], fallback, 10));
  return {
    variant: "education-industry",
    role,
    kicker: role === "cover" ? "SMART CAMPUS SOLUTION" : role === "platform" ? "PLATFORM ARCHITECTURE" : role === "scenarios" ? "TEACHING SCENARIOS" : role === "data" ? "LEARNING DATA" : "SERVICE ROADMAP",
    title,
    bullets,
    tags,
    path,
    scenes,
    roadmap,
  };
}

function renderEducationSolutionPreview(slide, scene) {
  const bulletItems = scene.bullets.slice(0, 4).map((item) => `<li>${escapeHtml(educationSolutionCompactText(item, scene.title, 42))}</li>`).join("");
  const tags = scene.tags.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const path = scene.path.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const scenes = scene.scenes.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const roadmap = scene.roadmap.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const platform = '<div class="education-solution-platform"><i></i><i></i><i></i><i></i></div>';
  const visual = scene.role === "platform"
    ? `<div class="education-solution-path">${path}</div>`
    : scene.role === "scenarios"
      ? `<div class="education-solution-scenes">${scenes}</div>${platform}`
      : scene.role === "data"
        ? `<div class="education-solution-data"><span></span><span></span><span></span><span></span></div><div class="education-solution-scenes">${scenes}</div>`
        : scene.role === "roadmap"
          ? `<div class="education-solution-roadmap">${roadmap}</div>${platform}`
          : `${platform}<div class="education-solution-tags">${tags}</div>`;
  return `<div class="education-solution-layer"><div class="education-solution-surface"></div><div class="education-solution-kicker">${escapeHtml(scene.kicker)}</div><h2 class="education-solution-title">${escapeHtml(scene.title)}</h2><div class="education-solution-rule"></div><ul class="education-solution-bullets">${bulletItems}</ul>${visual}</div>`;
}

function educationSolutionBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["教育客户教学与管理场景痛点", "统一教学平台与服务体系建设", "学习数据分析带来运营改进"];
}

function educationSolutionCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function isEducationSolutionVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "sales-education-solution" && (id === "industry-solution" || id === "sales-industry-solution-education-industry");
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

function launchRhythmPreviewScene({ slide, index, total }) {
  const bullets = launchRhythmBulletTexts(slide);
  const title = launchRhythmCompactText(slide?.title, `Page ${index + 1}`, index === 0 ? 30 : 28);
  const role = index === 0
    ? "cover"
    : index === total - 1
      ? "closing"
      : ["timeline", "channel", "kpi", "selling-points"][(index - 1) % 4];
  const timeline = ["T-30", "T-14", "T-7", "T-1", "Launch", "T+7"].map((step, itemIndex) => ({
    step,
    text: launchRhythmCompactText(bullets[itemIndex], ["预热启动", "内容种草", "渠道蓄水", "发布准备", "首发上线", "复盘增长"][itemIndex], 10),
  }));
  const cards = ["产品卖点", "渠道动作", "转化目标", "复盘增长"].map((fallback, itemIndex) => launchRhythmCompactText(bullets[itemIndex], fallback, 10));
  return {
    variant: "launch-rhythm",
    role,
    kicker: role === "cover" ? "LAUNCH RHYTHM" : role === "timeline" ? "T-MINUS TIMELINE" : role === "channel" ? "CHANNEL WARM-UP" : role === "kpi" ? "LAUNCH KPI" : "NEXT WAVE",
    title,
    bullets,
    timeline,
    cards,
  };
}

function renderLaunchRhythmPreview(slide, scene) {
  const bulletItems = scene.bullets.slice(0, 4).map((item) => `<li>${escapeHtml(launchRhythmCompactText(item, scene.title, 42))}</li>`).join("");
  const tags = ["预热", "首发", "转化"].map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const timeline = scene.timeline.map((item) => `<span data-step="${escapeHtml(item.step)}">${escapeHtml(item.text)}</span>`).join("");
  const cards = scene.cards.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const stage = '<div class="launch-rhythm-stage"><i></i><i></i><i></i></div>';
  const visual = scene.role === "timeline"
    ? `<div class="launch-rhythm-timeline">${timeline}</div>`
    : scene.role === "channel" || scene.role === "selling-points"
      ? `<div class="launch-rhythm-channel-grid">${cards}</div>`
      : scene.role === "kpi"
        ? `<div class="launch-rhythm-kpi"><i></i><i></i><i></i><i></i></div><div class="launch-rhythm-kpi-row">${scene.cards.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
        : scene.role === "closing"
          ? `<div class="launch-rhythm-closing">${scene.cards.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : `<div class="launch-rhythm-countdown">T-7</div><div class="launch-rhythm-tags">${tags}</div>${stage}`;
  return `<div class="launch-rhythm-layer"><div class="launch-rhythm-kicker">${escapeHtml(scene.kicker)}</div><h2 class="launch-rhythm-title">${escapeHtml(scene.title)}</h2><div class="launch-rhythm-rule"></div><ul class="launch-rhythm-bullets">${bulletItems}</ul>${visual}</div>`;
}

function launchRhythmBulletTexts(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets.filter(Boolean) : [];
  return bullets.length > 0 ? bullets : ["新品核心卖点与上市目标", "发布前预热与渠道蓄水", "首发转化 KPI 与复盘动作"];
}

function launchRhythmCompactText(text, fallback, maxLength) {
  const raw = String(text || fallback || "").replace(/\s+/g, " ").trim();
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, Math.max(1, maxLength - 1))}…`;
}

function isLaunchRhythmVisual(visual) {
  const id = String(visual?.id || "");
  return visual?.layout === "marketing-launch-rhythm" && (id === "new-product-launch" || id === "marketing-new-product-launch-launch-rhythm");
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
      kicker: "PROJECT WEEKLY",
      section: "WEEKLY UPDATE",
      sticker: "周报",
      metrics: [
        { value: "95%", label: "进度达成" },
        { value: "3", label: "关键风险" },
        { value: "7", label: "本周事项" },
      ],
    },
    steering: {
      variant: "steering",
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
      kicker: "DELIVERY TRACK",
      section: "MILESTONE CHECK",
      sticker: "交付",
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
 * 鍒ゆ柇 dome 棰勮椤垫槸鍚﹁繕闇€瑕佹櫘閫氭鏂囧垪琛ㄣ€?
 * 瀵瑰凡缁忔湁妯℃澘鍗犱綅绗︽壙杞?bullets 鐨勭増寮忥紝棰勮绔殣钘忔櫘閫氬垪琛紝閬垮厤鐢ㄦ埛鐪嬪埌閲嶅鍐呭銆?
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderDomePreviewBodyList(visual, role) {
  if (visual.layout !== "red-gold") return true;
  return !["cover", "agenda", "section-divider", "image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan", "closing"].includes(role);
}

/**
 * 鍒ゆ柇妯℃澘棰勮椤垫槸鍚﹁繕闇€瑕佹櫘閫氭鏂囧垪琛ㄣ€? * 行动闂幆妯℃澘宸茬粡鐢ㄤ换鍔″崱銆佽矗浠荤煩闃靛拰璺嚎鍥炬壙杞界粨鏋勪俊鎭紝鏅€?bullets 浼氬拰鍥捐〃閲嶅彔锛屽洜姝ゅ湪棰勮绔叧闂€? * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderTemplatePreviewBodyList(visual, role) {
  if (visual.layout === "quarterly-action-loop") return false;
  if (visual.layout === "industry-research") return false;
  if (visual.layout === "finance-budget-planning") return false;
  if (visual.layout === "finance-budget-adjustment") return false;
  if (visual.layout === "sales-financial-solution") return false;
  if (visual.layout === "sales-manufacturing-solution") return false;
  if (visual.layout === "sales-education-solution") return false;
  if (visual.layout === "marketing-launch-rhythm") return false;
  return shouldRenderDomePreviewBodyList(visual, role);
}

/**
 * 娓叉煋涓?PPTX 瀵煎嚭绔?Content Placement Card 瀵归綈鐨勫唴瀹规壙杞介潰銆? * 这些角色在导出文件里都有白色圆角大面板，预览端也必须输出同层级结构，避免用户看到的页面和下载 PPTX 涓嶄竴鑷淬€?
 * @param {string} role
 * @returns {string}
 */
function renderDomePreviewContentSurface(role) {
  if (!["image-report", "three-steps", "four-steps", "metrics", "showcase", "retrospective", "next-plan"].includes(role)) return "";
  return `<div class="dome-role-decor dome-content-surface"></div>`;
}

/**
 * 娓叉煋涓?PPTX 瀵煎嚭绔?Dome Content Frame 瀵归綈鐨勫唴瀹瑰唴妗嗐€?
 * 导出端除封面/结束页外都会写入该框线，预览端同步输出，避免用户看到的边框层级和 WPS 鎵撳紑鐨?PPTX 涓嶄竴鑷淬€?
 * @param {string} role
 * @returns {string}
 */
function renderDomePreviewContentFrame(role) {
  if (["cover", "closing"].includes(role)) return "";
  return `<div class="dome-role-decor dome-content-frame"></div>`;
}

/**
 * 娓叉煋 dome 棰勮椤佃剼瑁呴グ銆?
 * PPTX 瀵煎嚭姣忛〉閮戒細鐢熸垚 Dome Footer Decoration锛岄瑙堢涔熸樉寮忚緭鍑哄悓鍚嶈瑙夊眰锛岄伩鍏嶉瑙堝拰瀵煎嚭涓嶄竴鑷淬€?
 * @param {object} visual
 * @returns {string}
 */
function renderDomePreviewFooter(visual) {
  if (visual.layout !== "red-gold") return "";
  return `<div class="dome-role-decor dome-footer-decoration"></div>`;
}

/**
 * 娓叉煋 dome 棰勮搴曢儴鍦嗗姬娉㈡氮銆?
 * 杩欎袱灞?HTML 瑁呴グ瀵瑰簲 PPTX 瀵煎嚭鐨?Dome Gold/Light Wave Arc锛屼繚璇侀瑙堝拰瀵煎嚭鐪嬪埌鍚屼竴濂楀簳閮ㄦ尝娴眰绾с€?
 * @param {object} visual
 * @returns {string}
 */
function renderDomePreviewWaves(visual) {
  if (visual.layout !== "red-gold") return "";
  return `<div class="dome-role-decor dome-wave-arc dome-wave-gold"></div><div class="dome-role-decor dome-wave-arc dome-wave-light"></div>`;
}

/**
 * 预览端使用与 PPTX 瀵煎嚭涓€鑷寸殑椤甸潰瑙掕壊鍒ゆ柇銆?
 * 杩欐牱鐢ㄦ埛鐪嬪埌鐨勫皝闈€佺洰褰曘€佺珷鑺傞〉鍜岀粨鏉熼〉锛屼笉浼氬湪瀵煎嚭鏃跺彉鎴愬彟涓€濂楀竷灞€銆?
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
 * 涓?HTML 棰勮鐢熸垚涓?dome 瑙掕壊鍖归厤鐨勮瑙夊崰浣嶇銆?
 * PPTX 瀵煎嚭浼氱敓鎴愮湡瀹?OOXML 褰㈢姸锛涜繖閲岀敓鎴愯交閲?HTML 灞傦紝淇濊瘉鐢ㄦ埛棰勮鏃惰兘鐪嬪埌鍚屾牱鐨勭増寮忔剰鍥俱€?
 * @param {string} role
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function renderDomePreviewDecoration(role, slide, index) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  // 缁熶竴浠庣粨鏋勫寲 bullet 中读取展示文本，避免不同页面角色各自直出对象导致预览出现 [object Object]銆?
  const bulletText = (itemIndex) => domePreviewStructuredText(bullets[itemIndex], ["text", "title", "label", "name", "action", "task", "description", "value"]);
  if (role === "cover") {
    // 灏侀潰椤垫妸绗竴鏉＄粨鏋勫寲鍐呭鏀惧叆鍓爣棰樺崰浣嶏紝棰勮鏃朵繚鎸?dome.pptx 甯嗚埞灏侀潰鐨勭畝娲佺暀鐧姐€?
    return `<div class="dome-role-decor dome-cover-subtitle">${escapeHtml(bulletText(0))}</div>`;
  }
  if (role === "agenda") {
    // 鐩綍椤靛浐瀹氫繚鐣?4 个卡片占位符，和 dome.pptx/PPTX 瀵煎嚭淇濇寔涓€鑷达紝閬垮厤灏戦噺鐩綍椤瑰鑷寸増寮忓闄枫€?
    const cards = normalizeDomePreviewAgendaItems(slide).map((item, index) => `<div class="dome-agenda-card"><span class="dome-agenda-number">0${index + 1}</span><span class="dome-agenda-text">${escapeHtml(item)}</span></div>`).join("");
    return `<div class="dome-role-decor dome-agenda-grid">${cards}</div>`;
  }
  if (role === "section-divider") {
    // 绔犺妭鍒嗛殧椤靛悓姝?PPTX 閲岀殑 Dome Section Divider Line锛岃棰勮涔熶繚鐣欑珷鑺傜紪鍙蜂笅鏂圭殑閲戣壊鍒嗗壊绾垮眰绾с€?
    return `<div class="dome-role-decor dome-section-number">${escapeHtml(domePreviewSectionNumberText(slide, index))}</div><div class="dome-role-decor dome-section-divider-line"></div>`;
  }
  if (role === "three-steps" || role === "four-steps") {
    const count = role === "three-steps" ? 3 : 4;
    const cards = Array.from({ length: count }, (_, index) => renderDomePreviewCard("dome-step-card", index, bulletText(index))).join("");
    // 涓?鍥涙楠ゆ祦绋嬮〉閮芥樉绀哄晢鍔″浘鐗囧眰锛岃棰勮涓?PPTX 瀵煎嚭鐨勬祦绋嬮〉瑙嗚缁撴瀯涓€鑷淬€?
    const visual = `<div class="dome-role-visual"></div>`;
    return `${renderDomePreviewSectionLabel(slide, index)}${visual}<div class="dome-role-decor dome-step-connector"></div><div class="dome-role-decor dome-step-row" style="grid-template-columns:repeat(${count},minmax(0,1fr))">${cards}</div>`;
  }
  if (role === "metrics") {
    const cards = normalizeDomePreviewMetricItems(slide, 3).map((metric) => `<div class="dome-metric-card"><span class="dome-metric-value">${escapeHtml(metric.value)}</span><span class="dome-metric-label">${escapeHtml(metric.label)}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-metric-grid">${cards}</div>`;
  }
  if (role === "showcase") {
    // 成果展示页将编号和成果内容拆成两个视觉层，和 PPTX 鐨?Dome Showcase Number/Text 鍗犱綅淇濇寔涓€鑷淬€?
    const cards = Array.from({ length: 3 }, (_, index) => `<div class="dome-showcase-card"><span class="dome-showcase-number">0${index + 1}</span><span class="dome-showcase-text">${escapeHtml(bulletText(index))}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-showcase-grid">${cards}</div>`;
  }
  if (role === "image-report") {
    // 宸ヤ綔姹囨姤鍥炬枃椤电敤涓夊紶鍥哄畾鍗＄墖鎵胯浇瑕佺偣锛屼繚鎸佸浘鏂囨ā鏉跨殑鍗犱綅绗︾粨鏋勩€?
    const cards = Array.from({ length: 3 }, (_, index) => renderDomePreviewCard("dome-image-report-card", index, bulletText(index))).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-image-report-grid">${cards}</div>`;
  }
  if (role === "retrospective") {
    // 闂复盘椤靛浐瀹氳緭鍑衡€滈闄?鍘熷洜/鎺柦鈥濊涔夋爣绛撅紝鍜?PPTX 绔殑鐙珛鏍囩鍗犱綅淇濇寔涓€鑷淬€?
    const labels = ["风险", "原因", "措施"];
    const cards = Array.from({ length: 3 }, (_, index) => `<div class="dome-retrospective-card"><span class="dome-retrospective-label">${labels[index]}</span><span class="dome-card-text">${escapeHtml(bulletText(index))}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-retrospective-grid">${cards}</div><div class="dome-role-decor dome-risk-card"><span class="dome-card-text">${escapeHtml(bulletText(0) || "RISK")}</span></div>`;
  }
  if (role === "next-plan") {
    // 涓嬩竴姝ヨ鍒掗〉鏀寔鈥滈樁娈? 鍔ㄤ綔鈥濈粨鏋勫寲杈撳叆锛岄瑙堢鎷嗘垚闃舵鍜屽姩浣滀袱涓崰浣嶅眰銆?
    const cards = normalizeDomePreviewPlanItems(slide, 4).map((item) => `<div class="dome-step-card"><span class="dome-next-plan-phase">${escapeHtml(item.phase)}</span><span class="dome-next-plan-action">${escapeHtml(item.action)}</span></div>`).join("");
    return `${renderDomePreviewSectionLabel(slide, index)}<div class="dome-role-visual"></div><div class="dome-role-decor dome-plan-timeline"></div><div class="dome-role-decor dome-step-row">${cards}</div>`;
  }
  if (role === "closing") {
    // 结束页把用户输入作为模板副标题输出，避免破坏 THANKS 缁撴潫鐗堝紡銆?
    return `<div class="dome-role-decor dome-closing-subtitle">${escapeHtml(bulletText(0))}</div>`;
  }
  return "";
}

/**
 * 鐢熸垚 dome 预览目录页的 4 涓崱鐗囨枃妗堛€?
 * 鐢ㄦ埛灏戝～鐩綍椤规椂浣跨敤妯℃澘榛樿鍥涙琛ラ綈锛岃棰勮涓庡鍑虹殑鍗＄墖寮忕洰褰曚繚鎸佸畬鏁淬€?
 * @param {object} slide
 * @returns {string[]}
 */
function normalizeDomePreviewAgendaItems(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return Array.from({ length: 4 }, (_, index) => domePreviewStructuredText(bullets[index], ["text", "title", "label", "name"]) || DOME_AGENDA_DEFAULT_ITEMS[index] || "");
}

/**
 * 瑙ｆ瀽 dome 棰勮鎸囨爣椤电殑缁撴瀯鍖栬鐐广€?
 * 支持“指标名: 鎸囨爣鍊?/ 鎸囨爣鍚嶏細鎸囨爣鍊?/ 鎸囨爣鍚峾鎸囨爣鍊尖€濓紝涓?PPTX 瀵煎嚭淇濇寔涓€鑷淬€?
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
 * 瑙ｆ瀽 dome 涓嬩竴姝ヨ鍒掗〉鐨勭粨鏋勫寲瑕佺偣銆?
 * 鏀寔鈥滈樁娈? 鍔ㄤ綔 / 闃舵锛氬姩浣?/ 阶段|鍔ㄤ綔鈥濓紝鏃犲垎闅旂鏃舵寜鏃х紪鍙峰厹搴曘€?
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
 * 浠庨瑙堢缁撴瀯鍖?bullet 涓鍙栧崰浣嶇鏂囨湰銆?
 * 鏀寔瀵硅薄杈撳叆锛岄伩鍏?HTML 预览出现 [object Object]锛屽苟淇濇寔涓?PPTX 瀵煎嚭涓€鑷淬€?
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
 * 鍒ゆ柇鍊兼槸鍚︿负鏅€氱粨鏋勫寲瀵硅薄銆?
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 璇诲彇棰勮绔珷鑺傚垎闅旈〉鐨勭粨鏋勫寲缂栧彿銆?
 * 涓?PPTX 瀵煎嚭涓€鑷达紝浼樺厛浣跨敤 bullets[0]锛涚己鐪佹椂鎸夐〉搴忕敓鎴愮ǔ瀹?PART 缂栧彿锛岄伩鍏嶉瑙堝嚭鐜?PART 00銆?
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function domePreviewSectionNumberText(slide, index) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return domePreviewStructuredText(bullets[0], ["text", "title", "label", "name"]) || `PART ${String(index).padStart(2, "0")}`;
}

/**
 * 娓叉煋鍐呭椤甸瑙堝彸涓婅绔犺妭鏍囩銆?
 * 涓?PPTX 瀵煎嚭涓€鑷达細浼樺厛浣跨敤 outline 缁撴瀯鍖栫珷鑺傚瓧娈碉紝缂虹渷鏃舵寜椤靛簭鍏滃簳锛岀‘淇濋瑙堣兘鐪嬪埌瀵煎嚭涓殑绔犺妭鏍囩銆?
 * @param {object} slide
 * @param {number} index
 * @returns {string}
 */
function renderDomePreviewSectionLabel(slide, index) {
  const label = String(slide?.sectionLabel || slide?.section || `PART ${String(index).padStart(2, "0")}`);
  return `<div class="dome-role-decor dome-section-label">${escapeHtml(label)}</div>`;
}

/**
 * 娓叉煋 dome 棰勮閲岀殑缂栧彿鍗＄墖銆?
 * 杩欓噷鐨勭粨鏋勪笌 PPTX 鍗＄墖鏂囨湰灞備繚鎸佷竴鑷达紝渚夸簬鐢ㄦ埛棰勮缁撴瀯鍖栧唴瀹规槸鍚﹁繘鍏ユ纭崰浣嶇銆?
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
 * 淇濈暀 outline 涓細椹卞姩妯℃澘鍗犱綅绗︾殑缁撴瀯鍖栧瓧娈点€?
 * 鍙鍒舵槑纭敤浜?dome 绔犺妭鏍囩鐨勫瓧娈碉紝閬垮厤鎶?outline 鐨勫唴閮ㄧ姸鎬佹棤鎰忓啓鍏ユ渶缁?deck銆?
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
 * dome 妯℃澘鍦?AI 鏈繑鍥炲彲鐢?layout 鏃讹紝浼氭牴鎹?outline 缁撴瀯鑷姩鎺ㄦ柇椤甸潰瑙掕壊锛岄伩鍏嶆暣浠?deck 閫€鍖栦负鍚屼竴绉嶅浘鏂囬〉銆?
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
 * 判断模板是否使用 dome.pptx 鐨?red-gold 鐗堝紡浣撶郴銆?
 * @param {object} template
 * @returns {boolean}
 */
function isDomeTemplate(template) {
  return template?.visual?.layout === "red-gold";
}

/**
 * 鏍规嵁宸茬‘璁?outline 鐨勯〉闈㈢粨鏋勬帹鏂?dome 鐗堝紡瑙掕壊銆?
 * 杩欓噷鍜岄瑙?瀵煎嚭鐨勮鑹茶涔変繚鎸佷竴鑷达紝璁╃敤鎴锋棤闇€鎵嬪啓 layout 涔熻兘杩涘叆瀵瑰簲鍗犱綅绗︺€?
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
 * 鍗曢〉閲嶇敓鎴愬彧鏇挎崲鍐呭锛屼笉鍏佽妯″瀷杩斿洖鍊肩牬鍧?dome 妯℃澘鐨勭増寮忚鑹插拰绔犺妭鍗犱綅瀛楁銆?
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
