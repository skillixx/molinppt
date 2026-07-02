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

function normalizeHexColor(hex) {
  const normalized = String(hex || "000000").replace(/^#/, "").trim();
  if (normalized.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(normalized)) return "000000";
  return normalized.toUpperCase();
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
        this.generationLocks.delete(lockKey);
        await databaseLock?.release?.();
        throw new AppError({
          code: "GENERATION_ALREADY_RUNNING",
          status: 409,
          message: "Generation is already running for this outline",
          publicDetails: { task_id: activeTask.id },
        });
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
            ? '<div class="top-band-cover-glow"></div><div class="top-band-cover-kicker">EXECUTIVE BRIEFING</div><div class="top-band-cover-frame"></div><div class="top-band-cover-sheen"></div><div class="top-band-cover-beacon"></div>'
            : '<div class="top-band-content-rail"></div><div class="top-band-content-wave"></div><div class="top-band-content-trace"></div>'}`
          + '<div class="top-band-ribbon"></div><div class="top-band-edge"></div>'
          + `<span class="top-band-page-chip">${String(index + 1).padStart(2, "0")}</span>`
          + `${index === 0 ? '<span class="top-band-cover-label">Cover</span>' : '<div class="top-band-content-rule"></div>'}`
          + '<div class="top-band-soft-grid"></div>'
        )
      : "";
    const topBandHeadingClass = topBandTitleClass ? ` class="${topBandTitleClass}"` : "";
    const domeChrome = isDomeLayout
      ? `<div class="dome-role-decor dome-canvas-frame"></div>${renderDomePreviewContentFrame(domeRole)}${renderDomePreviewContentSurface(domeRole)}${renderDomePreviewDecoration(domeRole, slide, index)}${renderDomePreviewWaves(visual)}${renderDomePreviewFooter(visual)}`
      : "";
    return `<article class="preview-page" aria-label="第 ${index + 1} 页"><div class="slide slide-${slideKind}" data-dome-role="${escapeHtml(domeRole)}"><div class="accent"></div><div class="motif"></div><div class="top-band-brand">${topBandBrand}</div>${topBandMark}${domeChrome}<div class="slide-content"><h2${topBandHeadingClass}>${escapeHtml(slide.title)}</h2>${bodyList}</div><div class="page-number">${index + 1} / ${deck.slides.length}</div></div></article>`;
  }).join("");
  const domePreviewVars = visual.layout === "red-gold" ? redGoldPreviewVars(visual) : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title)}</title><style>
    :root{--template-primary:#${visual.primary};--template-accent:#${visual.accent};--template-bg:#${visual.background};--template-surface:#${visual.surface};--template-title:#${visual.title};--template-body:#${visual.body};${domePreviewVars}}
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
    body[data-layout="top-band"] .slide{background:linear-gradient(175deg,var(--template-bg),color-mix(in srgb,var(--template-bg) 96%, var(--template-surface) 4%));padding:7.8% 7% 6.9% 7.4%;border:0;}
    body[data-layout="top-band"] .slide::before{content:"";position:absolute;inset:2.4% 2.4% 2.2%;border:1px solid color-mix(in srgb,var(--template-title) 16%, transparent);border-radius:12px;box-shadow:0 12px 28px rgba(15,23,42,.10);}
    body[data-layout="top-band"] .slide::after{display:none;}
    body[data-layout="top-band"] .accent{left:0;right:auto;width:2%;height:100%;top:0;background:linear-gradient(180deg,color-mix(in srgb,var(--template-accent) 70%, var(--template-primary) 30%),var(--template-primary));opacity:.95;}
    body[data-layout="top-band"] .motif{display:block;left:2.55%;top:50%;width:0.6%;height:34%;transform:translateY(-50%);border-radius:999px;background:color-mix(in srgb,var(--template-title) 26%, transparent);opacity:.68;}
    body[data-layout="top-band"] .slide-content{align-content:start;justify-content:start;padding-right:4.8%;min-height:100%;}
    body[data-layout="top-band"] .slide[data-dome-role="cover"] .slide-content{padding-top:1.8%;}
    body[data-layout="top-band"] .slide[data-dome-role="cover"] h2{max-width:80%;margin-top:1.2%;font-size:50px;line-height:1.06;}
    body[data-layout="top-band"] .top-band-brand{position:absolute;left:13px;top:12px;z-index:3;color:color-mix(in srgb,var(--template-title) 36%, var(--template-bg) 64%);font-size:10px;letter-spacing:0.18em;font-weight:700;text-transform:uppercase;opacity:.82;}
    body[data-layout="top-band"] .top-band-ribbon{position:absolute;right:-4%;top:14%;width:49%;height:16%;background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--template-accent) 36%,transparent) 55%,transparent);transform:skewX(-10deg);opacity:.22;z-index:1;}
    body[data-layout="top-band"] .top-band-edge{display:none;}
    body[data-layout="top-band"] .top-band-soft-grid{display:none;}
    body[data-layout="top-band"] .top-band-cover-frame{position:absolute;left:3%;top:12.2%;right:3%;bottom:9.2%;border:1px solid color-mix(in srgb,var(--template-title) 18%, transparent);z-index:1;border-radius:10px;}
    body[data-layout="top-band"] .top-band-cover-sheen{position:absolute;left:3%;top:27%;right:3%;height:46%;background:linear-gradient(180deg,rgba(255,255,255,.12),transparent);opacity:.55;z-index:1;}
    body[data-layout="top-band"] .top-band-cover-beacon{display:none;}
    body[data-layout="top-band"] .top-band-content-rail{position:absolute;left:0;top:23.5%;width:1.3%;height:61%;border-left:6px solid color-mix(in srgb,var(--template-primary) 28%, var(--template-accent) 72%);}
    body[data-layout="top-band"] .top-band-content-wave{display:none;}
    body[data-layout="top-band"] .top-band-content-trace{display:none;}
    body[data-layout="top-band"] .top-band-page-chip{left:14px;top:17.5%;height:34px;min-width:43px;padding:0 10px;display:grid;place-items:center;border-radius:999px;background:rgba(15,23,42,.10);font-size:11px;font-weight:800;color:var(--template-title);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.22);box-shadow:0 6px 18px rgba(15,23,42,.08);}
    body[data-layout="top-band"] .top-band-cover-glow{position:absolute;top:5.8%;left:10%;right:10%;height:7%;border-radius:999px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);z-index:1;}
    body[data-layout="top-band"] .top-band-cover-kicker{position:absolute;left:14px;top:3%;z-index:4;font-size:9.5px;font-weight:700;letter-spacing:0.13em;color:color-mix(in srgb,var(--template-title) 46%, transparent);}
    body[data-layout="top-band"] .top-band-cover-label{position:absolute;left:50%;top:19.8%;transform:translateX(-50%);z-index:4;font-size:11px;font-weight:700;letter-spacing:0.06em;color:color-mix(in srgb,var(--template-title) 65%, transparent);}
    body[data-layout="top-band"] .top-band-content-rule{position:absolute;left:8.8%;top:78.8%;width:1.2%;height:15.4%;background:color-mix(in srgb,var(--template-title) 74%, transparent);border-radius:999px;opacity:.56;z-index:2;}
    body[data-layout="top-band"] .top-band-cover-title{font-size:48px;line-height:1.06;max-width:80%;}
    body[data-layout="top-band"] .top-band-content-title{font-size:38px;line-height:1.1;max-width:80%;}
    body[data-layout="top-band"] .top-band-cover-bullets{max-width:82%;font-size:23px;line-height:1.5;}
    body[data-layout="top-band"] .top-band-content-bullets{max-width:78%;font-size:18px;line-height:1.58;}
    body[data-layout="top-band"] .page-number{z-index:2;background:rgba(15,23,42,.05);padding:5px 10px;border-radius:999px;border:1px solid rgba(15,23,42,.10);backdrop-filter:blur(3px);}
    body[data-layout="top-band"] h2{max-width:78%;font-size:44px;line-height:1.08;color:var(--template-title);padding-left:5.1%;}
    body[data-layout="top-band"] ul{max-width:79%;font-size:20px;margin-left:5.1%;padding-left:1.06em;line-height:1.6;}
    body[data-layout="executive"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 68%);padding:8.2% 10%;border:0;}
    body[data-layout="executive"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(15,23,42,.026) 0 1px,transparent 1px 38px);}
    body[data-layout="executive"] .slide::after{content:"";position:absolute;inset:12% 6% 10%;background:var(--template-surface);box-shadow:0 18px 46px rgba(15,42,67,.12);}
    body[data-layout="executive"] .accent{height:9.8%;background:var(--template-primary);box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="executive"] .motif{display:block;right:10%;top:25%;width:8.8%;height:42%;border-radius:8px;background:var(--template-accent);opacity:.82;}
    body[data-layout="executive"] h2{max-width:74%;font-size:44px;}
    body[data-layout="academy"] .slide{background:linear-gradient(135deg,var(--template-bg),#ffffff 72%);padding:8% 10%;border:0;}
    body[data-layout="academy"] .slide::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(15,23,42,.022) 0 1px,transparent 1px 32px);}
    body[data-layout="academy"] .slide::after{content:"";position:absolute;inset:14% 7.5% 12%;background:var(--template-surface);box-shadow:0 16px 40px rgba(11,93,102,.10);}
    body[data-layout="academy"] .accent{height:7.6%;background:var(--template-primary);box-shadow:inset 0 -3px 0 var(--template-accent);}
    body[data-layout="academy"] .motif{display:block;right:9.5%;top:26%;width:7.2%;height:40%;border-radius:8px;background:var(--template-accent);opacity:.78;}
    body[data-layout="academy"] h2{max-width:78%;font-size:42px;}
    body[data-layout="venture"] .slide{background:linear-gradient(135deg,var(--template-primary),color-mix(in srgb,var(--template-primary) 78%,var(--template-bg) 22%));padding:8.5% 10%;border:0;}
    body[data-layout="venture"] .slide::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 18% 18%,color-mix(in srgb,var(--template-accent) 24%,transparent),transparent 32%),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 36px);}
    body[data-layout="venture"] .slide::after{content:"";position:absolute;inset:9% 6% 11%;background:var(--template-surface);box-shadow:0 22px 54px rgba(17,24,39,.20);}
    body[data-layout="venture"] .accent{top:auto;left:9%;right:9%;bottom:14%;height:2.2%;border-radius:999px;background:var(--template-accent);}
    body[data-layout="venture"] h2{max-width:82%;font-size:46px;}
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
    @media (max-width:720px){body{padding:14px;}main{gap:18px;}.slide{padding:8% 7%;}h2{font-size:26px;}ul{max-width:94%;font-size:16px;line-height:1.48;}body[data-layout="hero"] .slide-cover h2,body[data-layout="executive"] h2,body[data-layout="academy"] h2,body[data-layout="venture"] h2,body[data-layout="red-gold"] .slide-cover h2{font-size:30px;}body[data-layout="red-gold"] .slide:not(.slide-cover) h2{font-size:26px;}body[data-layout="red-gold"] .slide:not(.slide-cover) ul{font-size:15px;max-width:74%;}}
  </style></head><body data-template="${escapeHtml(visual.id)}" data-layout="${escapeHtml(visual.layout)}"><main>${slides}</main></body></html>`;
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
