/**
 * Mock AI provider implementing the future provider interface.
 */
export class MockAiProvider {
  /**
   * Creates a mock AI provider.
   * @param {{failNextDeck?: boolean}} input
   */
  constructor({ failNextDeck = false } = {}) {
    this.failNextDeck = failNextDeck;
  }

  /**
   * Generates an outline from topic and slide count.
   * @param {{topic?: string, documentText?: string, slideCount?: number, theme?: string}} input
   * @returns {Promise<object[]>}
   */
  async generateOutline({ topic, documentText, slideCount = 5 }) {
    const sourceLines = String(documentText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return Array.from({ length: slideCount }, (_, index) => {
      const title = sourceLines[index] || `${topic || "Document insight"} - slide ${index + 1}`;
      return {
        title,
        bullets: [
          `Key point ${index + 1}`,
          `Supporting detail for ${title}`,
        ],
      };
    });
  }

  /**
   * Generates normalized slide JSON from an outline.
   * @param {{outline: {slides: object[], theme?: string}}} input
   * @returns {Promise<object[]>}
   */
  async generateSlides({ outline }) {
    if (this.failNextDeck) {
      this.failNextDeck = false;
      throw new Error("AI_PROVIDER_FAILED");
    }
    return outline.slides.map((slide, index) => ({
      id: `slide_${index + 1}`,
      sortOrder: index + 1,
      title: slide.title,
      bullets: slide.bullets || [],
      speakerNotes: `Talk through ${slide.title}`,
      layout: index === 0 ? "title" : "content",
      theme: outline.theme || "modern",
    }));
  }

  /**
   * Regenerates one slide from an instruction.
   * @param {{slide: object, instruction: string}} input
   * @returns {Promise<object>}
   */
  async regenerateSlide({ slide, instruction }) {
    return {
      ...slide,
      title: `${slide.title} (${instruction})`,
      bullets: [...(slide.bullets || []), instruction],
    };
  }
}

/**
 * HTTP AI provider for production-compatible provider integration.
 */
export class HttpAiProvider {
  /**
   * Creates an HTTP AI provider.
   * @param {{endpoint: string, apiKey?: string, fetcher?: typeof fetch, timeoutMs?: number, maxRetries?: number}} input
   */
  constructor({ endpoint, apiKey = "", fetcher = fetch, timeoutMs = 30000, maxRetries = 0 }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Requests outline generation from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object[]>}
   */
  async generateOutline(input) {
    const response = await this.#post({ operation: "generate_outline", input });
    return requireArray(response.outline, "outline");
  }

  /**
   * Requests slide generation from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object[]>}
   */
  async generateSlides(input) {
    const response = await this.#post({ operation: "generate_slides", input });
    return requireArray(response.slides, "slides");
  }

  /**
   * Requests single-slide regeneration from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async regenerateSlide(input) {
    const response = await this.#post({ operation: "regenerate_slide", input });
    return requireObject(response.slide, "slide");
  }

  /**
   * Sends a JSON request to the configured AI provider.
   * @param {object} body
   * @returns {Promise<object>}
   */
  async #post(body) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status >= 500 && attempt < this.maxRetries) continue;
          throw new Error(`AI provider failed with status ${response.status}`);
        }
        return response.json();
      } catch (error) {
        if (attempt >= this.maxRetries || error.name === "AbortError") throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("AI provider request failed");
  }
}

/**
 * Validates an AI provider array response field.
 * @param {unknown} value
 * @param {string} field
 * @returns {object[]}
 */
function requireArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`AI_PROVIDER_INVALID_RESPONSE: ${field} must be an array`);
  return value;
}

/**
 * Validates an AI provider object response field.
 * @param {unknown} value
 * @param {string} field
 * @returns {object}
 */
function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`AI_PROVIDER_INVALID_RESPONSE: ${field} must be an object`);
  }
  return value;
}
