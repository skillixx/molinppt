/**
 * Mock vision provider for local tests and demos.
 */
export class MockVisionProvider {
  /**
   * Enhances an uploaded PPT template snapshot.
   * @param {{templateJson: object}} input
   * @returns {Promise<object>}
   */
  async analyzeTemplate({ templateJson }) {
    return {
      categoryId: templateJson.categoryId,
      style: "rule-assisted",
      useCase: "general",
      layoutSchema: templateJson.layoutSchema,
      visual: templateJson.visual,
      tags: [],
    };
  }
}

/**
 * Mock image provider that returns a deterministic transparent PNG payload.
 */
export class MockImageProvider {
  /**
   * Generates a simple image artifact.
   * @param {{topic: string, kind: string}} input
   * @returns {Promise<{content: Buffer, mimeType: string, fileName: string, prompt: string}>}
   */
  async generateImage({ topic, kind }) {
    return {
      content: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
      mimeType: "image/png",
      fileName: `${kind || "image"}.png`,
      prompt: `Generate ${kind || "image"} for ${topic}`,
    };
  }
}

/**
 * HTTP vision provider for production-compatible model integration.
 */
export class HttpVisionProvider {
  /**
   * Creates an HTTP vision provider.
   * @param {{endpoint: string, apiKey?: string, model?: string, fetcher?: typeof fetch}} input
   */
  constructor({ endpoint, apiKey = "", model = "", fetcher = fetch }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.fetcher = fetcher;
  }

  /**
   * Sends a template analysis request.
   * @param {object} input
   * @returns {Promise<object>}
   */
  async analyzeTemplate(input) {
    const response = await postJson({
      endpoint: this.endpoint,
      apiKey: this.apiKey,
      body: { operation: "analyze_template", model: this.model || undefined, input },
      fetcher: this.fetcher,
    });
    return response.analysis || response;
  }
}

/**
 * HTTP image provider for production-compatible model integration.
 */
export class HttpImageProvider {
  /**
   * Creates an HTTP image provider.
   * @param {{endpoint: string, apiKey?: string, model?: string, fetcher?: typeof fetch}} input
   */
  constructor({ endpoint, apiKey = "", model = "", fetcher = fetch }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.fetcher = fetcher;
  }

  /**
   * Sends an image generation request.
   * @param {object} input
   * @returns {Promise<{content: Buffer, mimeType: string, fileName: string, prompt?: string}>}
   */
  async generateImage(input) {
    const response = await postJson({
      endpoint: this.endpoint,
      apiKey: this.apiKey,
      body: { operation: "generate_image", model: this.model || undefined, input },
      fetcher: this.fetcher,
    });
    const image = response.image || response;
    return {
      content: Buffer.from(String(image.content_base64 || image.contentBase64 || ""), "base64"),
      mimeType: image.mime_type || image.mimeType || "image/png",
      fileName: image.file_name || image.fileName || `${input.kind || "image"}.png`,
      prompt: image.prompt,
    };
  }
}

async function postJson({ endpoint, apiKey, body, fetcher }) {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`MODEL_PROVIDER_FAILED: ${response.status}`);
  return response.json();
}
