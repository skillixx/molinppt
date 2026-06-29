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
  constructor({ endpoint, apiKey = "", model = "", fetcher = fetch, timeoutMs = 30000, maxRetries = 0 }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.useChatCompletionsPayload = isChatCompletionsEndpoint(endpoint);
  }

  /**
   * Requests outline generation from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object[]>}
   */
  async generateOutline(input) {
    const response = await this.#post({ operation: "generate_outline", input });
    const payload = normalizeProviderResponse({
      response,
      operation: "generate_outline",
      useChatCompletionsPayload: this.useChatCompletionsPayload,
    });
    return requireArray(payload.outline, "outline");
  }

  /**
   * Requests slide generation from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object[]>}
   */
  async generateSlides(input) {
    const response = await this.#post({ operation: "generate_slides", input });
    const payload = normalizeProviderResponse({
      response,
      operation: "generate_slides",
      useChatCompletionsPayload: this.useChatCompletionsPayload,
    });
    return requireArray(payload.slides, "slides");
  }

  /**
   * Requests single-slide regeneration from the provider endpoint.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async regenerateSlide(input) {
    const response = await this.#post({ operation: "regenerate_slide", input });
    const payload = normalizeProviderResponse({
      response,
      operation: "regenerate_slide",
      useChatCompletionsPayload: this.useChatCompletionsPayload,
    });
    return requireObject(payload.slide, "slide");
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
        const payload = buildRequestPayload(body, this.model, this.useChatCompletionsPayload);
        const response = await this.fetcher(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify(payload),
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

const OPENAI_SYSTEM_PROMPT = "You are an internal PPT generation service. Return only JSON, no markdown. Include exactly one top-level field for the requested operation.";

/**
 * Builds the body sent to the configured provider.
 * @param {{operation: string, input: object}} body
 * @param {string} model
 * @param {boolean} useChatCompletionsPayload
 * @returns {object}
 */
function buildRequestPayload(body, model, useChatCompletionsPayload) {
  if (!useChatCompletionsPayload) {
    return model ? { ...body, model } : body;
  }
  const operationInstruction = buildOperationInstruction(body.operation);
  const request = {
    messages: [
      { role: "system", content: `${OPENAI_SYSTEM_PROMPT}\n${operationInstruction}` },
      { role: "user", content: JSON.stringify(body) },
    ],
  };
  return model ? { ...request, model } : request;
}

/**
 * Converts provider responses to the internal payload contract.
 * @param {unknown} response
 * @param {boolean} useChatCompletionsPayload
 * @returns {{outline?: unknown, slides?: unknown, slide?: unknown}}
 */
function normalizeProviderResponse({ response, operation, useChatCompletionsPayload }) {
  if (!useChatCompletionsPayload) return response;
  if (!response || typeof response !== "object") {
    throw new Error("AI_PROVIDER_INVALID_RESPONSE: response must be an object");
  }
  const message = response.choices?.[0]?.message;
  const parsed = parseProviderMessage(message);
  if (parsed === undefined) {
    throw new Error("AI_PROVIDER_INVALID_RESPONSE: chat provider content missing or invalid");
  }
  const normalized = coerceOperationPayload(parsed, operation);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new Error("AI_PROVIDER_INVALID_RESPONSE: chat provider content must be an object");
  }
  return normalized;
}

/**
 * Returns true when endpoint looks like an OpenAI chat completions endpoint.
 * @param {string} endpoint
 * @returns {boolean}
 */
function isChatCompletionsEndpoint(endpoint) {
  try {
    const path = new URL(endpoint).pathname.toLowerCase();
    return /\/chat\/completions\/?$/.test(path);
  } catch {
    return false;
  }
}

/**
 * Parse JSON from raw model output, accepting optional markdown code fences.
 * @param {string} text
 * @returns {unknown}
 */
function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!match) {
      throw new Error("AI_PROVIDER_INVALID_RESPONSE: response content is not valid JSON");
    }
    try {
      return JSON.parse(match[1]);
    } catch {
      throw new Error("AI_PROVIDER_INVALID_RESPONSE: response content is not valid JSON");
    }
  }
}

/**
 * Parses provider response message text with DeepSeek/ChatGPT-style fields.
 * Prefers `content`, then `reasoning_content`.
 * @param {unknown} message
 * @returns {unknown | undefined}
 */
function parseProviderMessage(message) {
  if (!message || typeof message !== "object") return undefined;
  const candidates = [message.content, message.reasoning_content, message.reasoning]
    .filter((candidate) => typeof candidate === "string" && candidate.trim());
  if (!candidates.length) return undefined;

  for (const candidate of candidates) {
    try {
      return parseJSON(candidate.trim());
    } catch {
      // try extracting JSON from verbose text if strict parse fails
    }
    const bracketStart = candidate.indexOf("[");
    const braceStart = candidate.indexOf("{");
    const candidatesJson = [];
    if (bracketStart !== -1) candidatesJson.push(candidate.slice(bracketStart));
    if (braceStart !== -1) candidatesJson.push(candidate.slice(braceStart));
    for (const candidateText of candidatesJson) {
      try {
        return parseJSON(candidateText);
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

/**
 * Applies operation-specific normalization to make chat model outputs more tolerant.
 * @param {Record<string, unknown>} parsed
 * @param {string} operation
 * @returns {{outline?: unknown, slides?: unknown, slide?: unknown}}
 */
function coerceOperationPayload(parsed, operation) {
  if (operation === "generate_outline") {
    if (Array.isArray(parsed)) {
      return { outline: parsed };
    }
    return parsed;
  }
  if (operation === "generate_slides") {
    if (Array.isArray(parsed)) {
      return { slides: parsed };
    }
    return parsed;
  }
  if (operation === "regenerate_slide") {
    if (parsed && !parsed.slide && parsed.id && parsed.title) {
      return { slide: parsed };
    }
    return parsed;
  }
  return parsed;
}

/**
 * Returns strict system instructions for chat-completions payloads.
 * @param {string} operation
 * @returns {string}
 */
function buildOperationInstruction(operation) {
  if (operation === "generate_outline") {
    return (
      "Output format contract:\n"
      + "{ \"outline\": [\n"
      + "  { \"title\": string, \"bullets\": [string, ...] },\n"
      + "  ...\n"
      + "] }\n"
      + "Return ONLY JSON."
    );
  }
  if (operation === "generate_slides") {
    return (
      "Output format contract:\n"
      + "{ \"slides\": [\n"
      + "  { \"id\": string, \"sortOrder\": number, \"title\": string, \"bullets\": [string, ...], \"speakerNotes\": string, \"layout\": string, \"theme\": string },\n"
      + "  ...\n"
      + "] }\n"
      + "Return ONLY JSON."
    );
  }
  return (
    "Output format contract:\n"
    + "{ \"slide\": { \"id\": string, \"sortOrder\": number, \"title\": string, \"bullets\": [string, ...], \"speakerNotes\": string, \"layout\": string, \"theme\": string } }\n"
    + "Return ONLY JSON."
  );
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
