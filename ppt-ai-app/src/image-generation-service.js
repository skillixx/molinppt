import { AppError } from "./errors.js";

const SUPPORTED_IMAGE_KINDS = new Set(["cover", "illustration", "icon", "variant"]);

/**
 * Generates owner-scoped image assets through an optional image model provider.
 */
export class ImageGenerationService {
  /**
   * Creates an image generation service.
   * @param {{storage: object, templateManager?: object, imageProvider?: object | null}} input
   */
  constructor({ storage, templateManager = null, imageProvider = null }) {
    this.storage = storage;
    this.templateManager = templateManager;
    this.imageProvider = imageProvider;
  }

  /**
   * Generates an image asset and stores it as a private user file.
   * @param {{ownerUserId: number, topic: string, kind: string, templateId?: string, theme?: string}} input
   * @returns {Promise<{asset: object, file: object}>}
   */
  async generateImageAsset({ ownerUserId, topic, kind, templateId, theme }) {
    if (!this.imageProvider) {
      throw new AppError({
        code: "IMAGE_PROVIDER_NOT_CONFIGURED",
        status: 503,
        message: "Image provider is not configured",
      });
    }
    const normalizedTopic = normalizeTopic(topic);
    const normalizedKind = normalizeKind(kind);
    const template = templateId && this.templateManager
      ? this.templateManager.getTemplate(templateId, { ownerUserId })
      : undefined;
    const generated = await this.imageProvider.generateImage({
      ownerUserId,
      topic: normalizedTopic,
      kind: normalizedKind,
      template,
      theme,
    });
    const content = normalizeImageContent(generated.content);
    const mimeType = generated.mimeType || generated.mime_type || "image/png";
    const fileName = generated.fileName || generated.file_name || `${normalizedKind}.png`;
    const file = await this.storage.upload({
      ownerUserId,
      fileName,
      mimeType,
      content,
      fileRole: "generated_image_asset",
      visibility: "private",
    });
    return {
      file,
      asset: {
        fileId: file.id,
        topic: normalizedTopic,
        kind: normalizedKind,
        templateId: template?.id || templateId,
        theme,
        prompt: generated.prompt,
      },
    };
  }
}

function normalizeTopic(topic) {
  const normalized = typeof topic === "string" ? topic.trim() : "";
  if (!normalized) throw new AppError({ code: "IMAGE_TOPIC_REQUIRED", status: 400, message: "Image topic is required" });
  return normalized;
}

function normalizeKind(kind) {
  const normalized = typeof kind === "string" ? kind.trim() : "";
  if (!SUPPORTED_IMAGE_KINDS.has(normalized)) {
    throw new AppError({
      code: "IMAGE_KIND_INVALID",
      status: 400,
      message: "Image kind is invalid",
      publicDetails: { supported_kinds: [...SUPPORTED_IMAGE_KINDS] },
    });
  }
  return normalized;
}

function normalizeImageContent(content) {
  if (Buffer.isBuffer(content) && content.length > 0) return content;
  throw new AppError({ code: "IMAGE_PROVIDER_INVALID_RESPONSE", status: 502, message: "Image provider returned invalid content" });
}
