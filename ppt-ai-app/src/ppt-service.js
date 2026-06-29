import { AppError } from "./errors.js";

const GENERATE_AMOUNT = "6";
const REGENERATE_SLIDE_AMOUNT = "2";
const MIN_SLIDE_COUNT = 1;
const MAX_SLIDE_COUNT = 20;

/**
 * Orchestrates AI PPT outlines, decks, exports, billing, and call logs.
 */
export class PptService {
  /**
   * Creates a PPT workflow service.
   * @param {{database: object, storage: object, taskCenter: object, templateManager: object, aiProvider: object, promptManager: object, exporter: object, billingClient: object}} input
   */
  constructor({ database, storage, taskCenter, templateManager, aiProvider, promptManager, exporter, billingClient }) {
    this.database = database;
    this.storage = storage;
    this.taskCenter = taskCenter;
    this.templateManager = templateManager;
    this.aiProvider = aiProvider;
    this.promptManager = promptManager;
    this.exporter = exporter;
    this.billingClient = billingClient;
  }

  /**
   * Generates an editable outline from a topic or uploaded document.
   * @param {{ownerUserId: number, topic?: string, sourceFileId?: string, slideCount?: number, templateId: string, theme?: string}} input
   * @returns {Promise<object>}
   */
  async generateOutline({ ownerUserId, topic, sourceFileId, slideCount = 8, templateId, theme = "modern" }) {
    const normalizedSlideCount = normalizeSlideCount(slideCount);
    const documentText = sourceFileId ? await this.#readDocumentText({ sourceFileId, ownerUserId }) : "";
    const template = this.templateManager.getTemplate(templateId);
    validateTemplateTheme({ template, theme });
    const prompt = this.promptManager.buildOutlinePrompt({ topic, documentText, slideCount: normalizedSlideCount, theme });
    let slides;
    try {
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
   * @param {{ownerUserId: number, outlineId: string, entitlementId: number}} input
   * @returns {Promise<{deck: object, task: object}>}
   */
  async generateDeck({ ownerUserId, outlineId, entitlementId }) {
    const outline = await this.#getOwned("outlines", outlineId, ownerUserId, "OUTLINE_NOT_FOUND");
    const task = await this.taskCenter.createTask({
      ownerUserId,
      type: "ppt_generate",
      input: { outlineId, entitlementId },
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
    const reserve = await this.billingClient.reserveCredits({
      userId: ownerUserId,
      entitlementId,
      amount: GENERATE_AMOUNT,
      idempotencyKey: reserveKey,
    });
    await this.#recordBilling({ ownerUserId, taskId: task.id, eventType: "reserve", amount: GENERATE_AMOUNT, status: "reserved", holdId: reserve.hold_id, idempotencyKey: reserveKey });
    let deck;
    try {
      const template = this.templateManager.getTemplate(outline.templateId);
      const prompt = this.promptManager.buildDeckPrompt({ outline, template });
      const slides = await this.aiProvider.generateSlides(prompt);
      deck = await this.database.insert("decks", {
        ownerUserId,
        outlineId,
        title: outline.topic,
        templateId: outline.templateId,
        theme: outline.theme,
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
            if (task.deckId) await this.database.update("decks", task.deckId, { status: "ready" });
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
    const slide = deck.slides.find((item) => item.id === slideId);
    if (!slide) throw new AppError({ code: "SLIDE_NOT_FOUND", status: 404, message: "Slide not found" });
    const reserveKey = `${deckId}:${slideId}:ppt_slide_regenerate:reserve`;
    const settleKey = `${deckId}:${slideId}:ppt_slide_regenerate:settle`;
    const releaseKey = `${deckId}:${slideId}:ppt_slide_regenerate:release`;
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
      regenerated = await this.aiProvider.regenerateSlide(prompt);
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
    const slides = deck.slides.map((item) => (item.id === slideId ? regenerated : item));
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
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title)}</title></head><body>${deck.slides.map((slide) => `<section><h2>${escapeHtml(slide.title)}</h2><ul>${(slide.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></section>`).join("")}</body></html>`;
  }

  /**
   * Exports a deck and stores the generated file.
   * @param {{ownerUserId: number, deckId: string, format: string}} input
   * @returns {Promise<object>}
   */
  async exportDeck({ ownerUserId, deckId, format }) {
    const deck = await this.#getOwned("decks", deckId, ownerUserId, "DECK_NOT_FOUND");
    assertDeckReady(deck);
    const exportPayload = this.exporter.exportDeck({ deck, format });
    const file = await this.storage.upload({
      ownerUserId,
      fileName: exportPayload.fileName,
      mimeType: exportPayload.mimeType,
      content: exportPayload.content,
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
        publicDetails: { entitlement_id: entitlementId, balance },
      });
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
  if (themes.length && !themes.includes(theme)) {
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
