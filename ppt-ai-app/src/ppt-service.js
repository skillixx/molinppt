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
const MAX_SLIDE_COUNT = 20;
const SLIDE_GENERATION_MAX_ATTEMPTS = 2;
const MAX_ACTIVE_PPT_ASSETS = 100;
const MAX_PROMPT_CHARS = 5000;
const RUNNING_GENERATION_STATUSES = new Set(["running", "reconcile_pending", "release_pending"]);

/**
 * Orchestrates AI PPT outlines, decks, exports, billing, and call logs.
 */
export class PptService {
  /**
   * Creates a PPT workflow service.
   * @param {{database: object, storage: object, taskCenter: object, templateManager: object, aiProvider: object, promptManager: object, exporter: object, billingClient: object, metrics?: object, generationLocks?: Set<string>}} input
   */
  constructor({ database, storage, taskCenter, templateManager, aiProvider, promptManager, exporter, billingClient, metrics, generationLocks }) {
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
    const prompt = this.promptManager.buildOutlinePrompt({ topic, documentText, slideCount: normalizedSlideCount, theme });
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
        templateVisual: template.visual,
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
    const visual = resolveTemplateVisual({
      templateId: deck.templateId,
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
    const domeRole = resolvePreviewDomeRole(slide, index, deck.slides.length);
    // dome 模板允许任意页显式声明封面版式，预览 class 必须跟随角色才能套用封面背景。
    const slideKind = visual.layout === "red-gold" && domeRole === "cover" ? "cover" : index === 0 ? "cover" : "content";
    const bullets = shouldRenderDomePreviewBodyList(visual, domeRole)
      ? (slide.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")
      : "";
    return `<article class="preview-page" aria-label="第 ${index + 1} 页"><div class="slide slide-${slideKind}" data-dome-role="${escapeHtml(domeRole)}"><div class="accent"></div><div class="motif"></div>${renderDomePreviewDecoration(domeRole, slide)}<div class="slide-content"><h2>${escapeHtml(slide.title)}</h2><ul>${bullets}</ul></div><div class="page-number">${index + 1} / ${deck.slides.length}</div></div></article>`;
  }).join("");
  const domePreviewVars = visual.layout === "red-gold"
    ? `--dome-cover-bg:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.cover}");--dome-content-bg:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.content}");--dome-business-1:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business1}");--dome-business-2:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business2}");--dome-business-3:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business3}");--dome-business-4:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business4}");--dome-business-5:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business5}");--dome-business-6:url("data:image/jpeg;base64,${DOME_PREVIEW_ASSETS.business6}");`
    : "";
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
    body[data-layout="red-gold"] .slide{background-image:var(--dome-content-bg),linear-gradient(135deg,var(--template-primary),#d91d24 58%,#7d0610);background-size:cover;background-position:center;border:0;padding:10.5% 12% 9%;box-shadow:0 22px 58px rgba(104,5,13,.24);}
    body[data-layout="red-gold"] .slide-cover{background-image:var(--dome-cover-bg),linear-gradient(135deg,var(--template-primary),#d91d24 58%,#7d0610);}
    body[data-layout="red-gold"] .slide::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.10),transparent 44%),repeating-linear-gradient(115deg,rgba(255,232,176,.08) 0 1px,transparent 1px 42px);}
    body[data-layout="red-gold"] .slide::after{content:"";position:absolute;left:0;right:0;bottom:0;height:25%;background:linear-gradient(135deg,rgba(255,248,204,.92),rgba(246,212,138,.78) 34%,rgba(184,15,26,.28) 35%,rgba(126,6,16,.68));clip-path:polygon(0 66%,14% 48%,28% 58%,44% 34%,60% 52%,76% 30%,100% 44%,100% 100%,0 100%);}
    body[data-layout="red-gold"] .accent{left:0;right:0;top:auto;bottom:23.2%;height:2px;background:var(--template-accent);}
    body[data-layout="red-gold"] .slide-content{align-content:center;justify-items:center;text-align:center;color:#ffe8b0;}
    body[data-layout="red-gold"] .slide-cover h2{max-width:78%;margin-bottom:2.8%;font-size:58px;color:#fff2b8;text-shadow:0 3px 0 rgba(90,4,10,.32),0 12px 24px rgba(60,0,0,.24);}
    body[data-layout="red-gold"] .slide-cover ul{max-width:60%;padding:0;list-style:none;color:#ffe8b0;text-align:center;}
    body[data-layout="red-gold"] .slide-content::before{content:"商务办公系列 PPT 模板";position:absolute;left:-4%;bottom:-30%;color:rgba(255,232,176,.82);font-size:12px;letter-spacing:0;}
    body[data-layout="red-gold"] .slide-content::after{content:"";position:absolute;z-index:0;inset:18% 13% 12%;border:1px solid rgba(255,232,176,.18);border-radius:18px;}
    body[data-layout="red-gold"] .slide-content>*{z-index:2;}
    body[data-layout="red-gold"] .slide:not(.slide-cover){padding:12% 12% 10%;}
    body[data-layout="red-gold"] .slide:not(.slide-cover)::before{background:linear-gradient(180deg,rgba(255,255,255,.10),transparent 42%),repeating-linear-gradient(115deg,rgba(255,232,176,.07) 0 1px,transparent 1px 42px);}
    body[data-layout="red-gold"] .slide:not(.slide-cover)::after{inset:12% 7.5% 16%;height:auto;border-radius:20px;background:rgba(255,248,230,.96);box-shadow:0 22px 42px rgba(82,5,12,.23);}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content{align-content:start;justify-items:start;text-align:left;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content::before{content:"BUSINESS REPORT";left:0;top:-12%;bottom:auto;color:var(--template-accent);font-size:12px;font-weight:800;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .slide-content::after{display:none;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) h2{max-width:66%;font-size:42px;color:var(--template-title);text-shadow:none;}
    body[data-layout="red-gold"] .slide:not(.slide-cover) ul{max-width:64%;font-size:21px;color:var(--template-body);}
    body[data-layout="red-gold"] .slide:not(.slide-cover) .motif{display:block;right:11%;top:30%;width:7.8%;height:34%;border-radius:12px;background:var(--template-accent);box-shadow:0 18px 28px rgba(82,5,12,.18);}
    body[data-layout="red-gold"] .dome-role-visual{position:absolute;z-index:2;right:10.5%;top:27%;width:24%;height:35%;border-radius:10px;background:var(--dome-business-1) center/cover no-repeat;box-shadow:0 18px 30px rgba(82,5,12,.22);overflow:hidden;}
    body[data-layout="red-gold"] .dome-role-decor{position:absolute;z-index:3;pointer-events:none;}
    body[data-layout="red-gold"] .dome-agenda-grid{left:13%;right:13%;top:33%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;}
    body[data-layout="red-gold"] .dome-agenda-card{min-height:74px;border-radius:12px;background:rgba(246,212,138,.92);box-shadow:0 14px 22px rgba(82,5,12,.20);color:var(--template-title);font-size:20px;font-weight:800;display:grid;place-items:center;}
    body[data-layout="red-gold"] .dome-section-number{left:50%;top:32%;transform:translateX(-50%);color:#ffe8b0;font-size:28px;font-weight:900;letter-spacing:0;text-shadow:0 10px 22px rgba(60,0,0,.24);}
    body[data-layout="red-gold"] .dome-step-row{left:12%;right:12%;bottom:26%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
    body[data-layout="red-gold"] .dome-step-card,.dome-metric-card{border-radius:12px;background:rgba(255,248,230,.95);box-shadow:0 12px 22px rgba(82,5,12,.16);padding:16px;color:var(--template-title);font-weight:800;text-align:center;display:grid;gap:8px;align-content:center;min-width:0;}
    body[data-layout="red-gold"] .dome-card-index{display:block;font-size:20px;line-height:1;color:var(--template-title);}
    body[data-layout="red-gold"] .dome-card-text{display:block;font-size:14px;line-height:1.25;color:var(--template-body);overflow-wrap:anywhere;}
    body[data-layout="red-gold"] .dome-metric-grid{left:12%;right:34%;bottom:25%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}
    body[data-layout="red-gold"] .dome-risk-card{right:10.5%;bottom:25%;width:24%;border-radius:12px;background:rgba(246,212,138,.94);padding:16px;color:var(--template-title);font-size:18px;font-weight:800;text-align:center;box-shadow:0 14px 22px rgba(82,5,12,.18);display:grid;place-items:center;}
    body[data-layout="red-gold"] .dome-plan-timeline{left:13%;right:13%;bottom:33%;height:3px;background:var(--template-accent);}
    body[data-layout="red-gold"] .slide[data-dome-role="showcase"] .dome-role-visual{background-image:var(--dome-business-2);}
    body[data-layout="red-gold"] .slide[data-dome-role="retrospective"] .dome-role-visual{background-image:var(--dome-business-3);}
    body[data-layout="red-gold"] .slide[data-dome-role="four-steps"] .dome-role-visual{background-image:var(--dome-business-4);}
    body[data-layout="red-gold"] .slide[data-dome-role="next-plan"] .dome-role-visual{background-image:var(--dome-business-6);}
    body[data-layout="red-gold"] .slide[data-dome-role="metrics"] .dome-role-visual{background-image:var(--dome-business-5);top:24%;height:28%;}
    body[data-layout="red-gold"] .slide[data-dome-role="agenda"] .slide-content{justify-items:center;text-align:center;}
    body[data-layout="red-gold"] .slide[data-dome-role="section-divider"] .slide-content{align-content:center;justify-items:center;text-align:center;color:#ffe8b0;}
    body[data-layout="red-gold"] .slide[data-dome-role="closing"] .slide-content{align-content:center;justify-items:center;text-align:center;color:#ffe8b0;}
    @media (max-width:720px){body{padding:14px;}main{gap:18px;}.slide{padding:8% 7%;}h2{font-size:26px;}ul{max-width:94%;font-size:16px;line-height:1.48;}body[data-layout="hero"] .slide-cover h2,body[data-layout="executive"] h2,body[data-layout="academy"] h2,body[data-layout="venture"] h2,body[data-layout="red-gold"] .slide-cover h2{font-size:30px;}body[data-layout="red-gold"] .slide:not(.slide-cover) h2{font-size:26px;}body[data-layout="red-gold"] .slide:not(.slide-cover) ul{font-size:15px;max-width:74%;}}
  </style></head><body data-template="${escapeHtml(visual.id)}" data-layout="${escapeHtml(visual.layout)}"><main>${slides}</main></body></html>`;
}

/**
 * 判断 dome 预览页是否还需要普通正文列表。
 * 对已经有模板卡片承载 bullets 的版式，预览端隐藏普通列表，避免用户看到重复内容。
 * @param {object} visual
 * @param {string} role
 * @returns {boolean}
 */
function shouldRenderDomePreviewBodyList(visual, role) {
  if (visual.layout !== "red-gold") return true;
  return !["agenda", "section-divider", "three-steps", "four-steps", "metrics", "retrospective", "next-plan"].includes(role);
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
  if ((slide?.bullets || []).length >= 4) return "four-steps";
  if ((slide?.bullets || []).length === 3) return "three-steps";
  return "image-report";
}

/**
 * 为 HTML 预览生成与 dome 角色匹配的视觉占位符。
 * PPTX 导出会生成真实 OOXML 形状；这里生成轻量 HTML 层，保证用户预览时能看到同样的版式意图。
 * @param {string} role
 * @param {object} slide
 * @returns {string}
 */
function renderDomePreviewDecoration(role, slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  if (role === "agenda") {
    const cards = bullets.slice(0, 4).map((item) => `<div class="dome-agenda-card">${escapeHtml(item)}</div>`).join("");
    return `<div class="dome-role-decor dome-agenda-grid">${cards}</div>`;
  }
  if (role === "section-divider") {
    return `<div class="dome-role-decor dome-section-number">${escapeHtml(domePreviewSectionNumberText(slide))}</div>`;
  }
  if (role === "three-steps" || role === "four-steps") {
    const count = role === "three-steps" ? 3 : 4;
    const cards = Array.from({ length: count }, (_, index) => renderDomePreviewCard("dome-step-card", index, bullets[index])).join("");
    const visual = role === "four-steps" ? `<div class="dome-role-visual"></div>` : "";
    return `${visual}<div class="dome-role-decor dome-step-row" style="grid-template-columns:repeat(${count},minmax(0,1fr))">${cards}</div>`;
  }
  if (role === "metrics") {
    const cards = Array.from({ length: 3 }, (_, index) => renderDomePreviewCard("dome-metric-card", index, bullets[index])).join("");
    return `<div class="dome-role-visual"></div><div class="dome-role-decor dome-metric-grid">${cards}</div>`;
  }
  if (role === "showcase" || role === "image-report") {
    return `<div class="dome-role-visual"></div>`;
  }
  if (role === "retrospective") {
    return `<div class="dome-role-visual"></div><div class="dome-role-decor dome-risk-card"><span class="dome-card-text">${escapeHtml(bullets[0] || "RISK")}</span></div>`;
  }
  if (role === "next-plan") {
    const cards = Array.from({ length: 4 }, (_, index) => renderDomePreviewCard("dome-step-card", index, bullets[index])).join("");
    return `<div class="dome-role-visual"></div><div class="dome-role-decor dome-plan-timeline"></div><div class="dome-role-decor dome-step-row">${cards}</div>`;
  }
  return "";
}

/**
 * 读取预览端章节分隔页的结构化编号。
 * 与 PPTX 导出一致，优先使用 bullets[0]，避免章节号在预览和导出中不一致。
 * @param {object} slide
 * @returns {string}
 */
function domePreviewSectionNumberText(slide) {
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  return String(bullets[0] || "PART 00");
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
    const title = typeof slide.title === "string" ? slide.title.trim() : "";
    if (!title) {
      throwSlideSchemaError(`slide ${index + 1} title must be a non-empty string`);
    }
    if (!Array.isArray(slide.bullets) || !slide.bullets.every((bullet) => typeof bullet === "string")) {
      throwSlideSchemaError(`slide ${index + 1} bullets must be an array of strings`);
    }
    return {
      ...slide,
      id: normalizeSlideId(slide.id, index),
      sortOrder: normalizeSortOrder(slide.sortOrder, index),
      title,
      bullets: slide.bullets,
      speakerNotes: typeof slide.speakerNotes === "string" ? slide.speakerNotes : "",
      layout: normalizeSlideLayout({ layout: slide.layout, template, index }),
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
      id: `slide_${index + 1}`,
      sortOrder: index + 1,
      title,
      bullets: normalizeBulletList(slide?.bullets),
      speakerNotes: `Generated from confirmed outline: ${title}`,
      layout: normalizeSlideLayout({ layout: "", template, index }),
      theme: outline.theme || "modern",
      fallback: true,
    };
  });
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
 * @param {{layout: unknown, template: object, index: number}} input
 * @returns {string}
 */
function normalizeSlideLayout({ layout, template, index }) {
  const schema = template?.layoutSchema || {};
  const fallback = index === 0
    ? schema.defaultCoverLayout || "title"
    : schema.defaultContentLayout || "content";
  const normalized = normalizeSlideText(layout, fallback);
  const allowedLayouts = Array.isArray(schema.allowedLayouts) ? schema.allowedLayouts : [];
  return allowedLayouts.length === 0 || allowedLayouts.includes(normalized) ? normalized : fallback;
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
 * @param {{original: object, regenerated: object}} input
 * @returns {object}
 */
function normalizeRegeneratedSlide({ original, regenerated }) {
  return {
    ...original,
    ...(regenerated && typeof regenerated === "object" ? regenerated : {}),
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
