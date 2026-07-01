import { randomUUID } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { AppError } from "./errors.js";

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const TEMPLATE_MIME_TYPE = "application/json";
const THUMBNAIL_MIME_TYPE = "image/png";
const MAX_PERSONAL_TEMPLATE_BYTES = 20 * 1024 * 1024;
const PERSONAL_TEMPLATE_LIMIT = 20;
const PERSONAL_CATEGORY = { id: "personal", name: "Personal", sortOrder: 90, scope: "user", status: "active" };
const DEFAULT_VISUAL = {
  primary: "2563EB",
  accent: "16A34A",
  background: "F8FAFC",
  surface: "FFFFFF",
  title: "0F172A",
  body: "334155",
  layout: "top-band",
};
const ONE_PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");

/**
 * Creates and manages owner-scoped personal PPT templates.
 */
export class PersonalTemplateService {
  /**
   * Creates a personal template service.
   * @param {{database: object, storage: object, visionProvider?: object | null}} input
   */
  constructor({ database, storage, visionProvider = null }) {
    this.database = database;
    this.storage = storage;
    this.visionProvider = visionProvider;
  }

  /**
   * Creates a personal template by parsing an uploaded PPTX package.
   * @param {{ownerUserId: number, fileName: string, content: Buffer, name?: string}} input
   * @returns {Promise<object>}
   */
  async createFromPptx({ ownerUserId, fileName, content, name }) {
    validateUpload({ fileName, content });
    await this.#assertQuotaAvailable(ownerUserId);
    const packageFiles = readZipFiles(content);
    validatePptxPackage(packageFiles);
    const baseTemplateJson = buildTemplateJson({ packageFiles, name: name || stripExtension(fileName) });
    const thumbnail = extractThumbnail(packageFiles);
    const { templateJson, enhancement } = await this.#enhanceTemplateJson({
      templateJson: baseTemplateJson,
      thumbnail,
      packageFiles,
    });
    templateJson.thumbnail = { generated: thumbnail.generated };
    await this.#ensurePersonalCategory();
    const sourceFile = await this.storage.upload({
      ownerUserId,
      fileName,
      mimeType: PPTX_MIME_TYPE,
      content,
      fileRole: "personal_template_source",
      visibility: "private",
    });
    const templateFile = await this.storage.upload({
      ownerUserId,
      fileName: `${stripExtension(fileName)}.template.json`,
      mimeType: TEMPLATE_MIME_TYPE,
      content: Buffer.from(JSON.stringify(templateJson, null, 2)),
      fileRole: "personal_template_definition",
      visibility: "private",
    });
    const thumbnailFile = await this.storage.upload({
      ownerUserId,
      fileName: `${stripExtension(fileName)}.thumbnail.png`,
      mimeType: THUMBNAIL_MIME_TYPE,
      content: thumbnail.content,
      fileRole: "personal_template_thumbnail",
      visibility: "private",
    });

    const now = new Date().toISOString();
    const template = await this.database.insert("templates", {
      id: `personal-${ownerUserId}-${randomUUID()}`,
      name: templateJson.name,
      description: `Personal template generated from ${fileName}`,
      categoryId: templateJson.categoryId || PERSONAL_CATEGORY.id,
      categorySlug: templateJson.categoryId || PERSONAL_CATEGORY.id,
      scope: "user",
      status: "active",
      ownerUserId,
      source: "uploaded_pptx",
      sourceFileId: sourceFile.id,
      templateFileId: templateFile.id,
      thumbnailFileId: thumbnailFile.id,
      templateJson,
      themes: templateJson.themes,
      visual: templateJson.visual,
      layoutSchema: templateJson.layoutSchema,
      fonts: templateJson.fonts,
      placeholders: templateJson.placeholders,
      style: templateJson.style,
      useCase: templateJson.useCase,
      tags: templateJson.tags || [],
      modelEnhancement: enhancement,
      created_at: now,
      updated_at: now,
    });
    await this.#tagTemplateFiles({ ownerUserId, templateId: template.id, fileIds: [sourceFile.id, templateFile.id, thumbnailFile.id] });
    return template;
  }

  /**
   * Soft deletes an owner-scoped personal template.
   * @param {{ownerUserId: number, templateId: string}} input
   * @returns {Promise<object>}
   */
  async deleteTemplate({ ownerUserId, templateId }) {
    const template = await this.database.findOne("templates", (item) => (
      item.id === templateId
      && item.scope === "user"
      && Number(item.ownerUserId) === Number(ownerUserId)
      && item.status === "active"
    ));
    if (!template) throw new AppError({ code: "TEMPLATE_NOT_FOUND", status: 404, message: "Template not found" });
    const deleted = await this.database.update("templates", template.id, {
      status: "deleted",
      deleted_at: new Date().toISOString(),
    });
    await this.#deleteTemplateFiles({ ownerUserId, templateId });
    return deleted;
  }

  async #assertQuotaAvailable(ownerUserId) {
    const activeTemplates = await this.database.find("templates", (item) => (
      item.scope === "user"
      && item.status === "active"
      && Number(item.ownerUserId) === Number(ownerUserId)
    ));
    if (activeTemplates.length >= PERSONAL_TEMPLATE_LIMIT) {
      throw new AppError({
        code: "PERSONAL_TEMPLATE_QUOTA_EXCEEDED",
        status: 409,
        message: "Personal template quota exceeded",
        publicDetails: { limit: PERSONAL_TEMPLATE_LIMIT },
      });
    }
  }

  async #ensurePersonalCategory() {
    const existing = await this.database.findOne("template_categories", (item) => item.id === PERSONAL_CATEGORY.id);
    if (existing) return existing;
    try {
      return await this.database.insert("template_categories", PERSONAL_CATEGORY);
    } catch (error) {
      if (!isDuplicateRecordError(error)) throw error;
      if (typeof this.database.reloadCollection === "function") {
        await this.database.reloadCollection("template_categories");
      }
      const synced = await this.database.findOne("template_categories", (item) => item.id === PERSONAL_CATEGORY.id);
      if (synced) return synced;
      throw error;
    }
  }

  async #tagTemplateFiles({ ownerUserId, templateId, fileIds }) {
    let objects;
    try {
      objects = await this.database.find("storage_objects", (item) => fileIds.includes(item.fileId) && Number(item.ownerUserId) === Number(ownerUserId));
    } catch (error) {
      if (error?.code === "DATABASE_NOT_INITIALIZED") return;
      throw error;
    }
    for (const object of objects) {
      await this.database.update("storage_objects", object.id, {
        templateId,
        templateScope: "user",
      });
    }
  }

  async #deleteTemplateFiles({ ownerUserId, templateId }) {
    let objects;
    try {
      objects = await this.database.find("storage_objects", (item) => (
        item.templateId === templateId && Number(item.ownerUserId) === Number(ownerUserId)
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
        await this.database.update("files", object.fileId, {
          status: "deleted",
          deleted_at: new Date().toISOString(),
        });
      }
    }
  }

  async #enhanceTemplateJson({ templateJson, thumbnail, packageFiles }) {
    if (!this.visionProvider) {
      return {
        templateJson: { ...templateJson, categoryId: PERSONAL_CATEGORY.id },
        enhancement: { status: "not_configured" },
      };
    }
    try {
      const analysis = await this.visionProvider.analyzeTemplate({
        templateJson,
        thumbnail: {
          generated: thumbnail.generated,
          contentBase64: thumbnail.content.toString("base64"),
        },
        packageSummary: summarizePptxPackage(packageFiles),
      });
      return {
        templateJson: mergeVisionAnalysis(templateJson, analysis),
        enhancement: {
          status: "applied",
          provider: "vision",
          appliedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        templateJson: { ...templateJson, categoryId: PERSONAL_CATEGORY.id },
        enhancement: {
          status: "failed",
          provider: "vision",
          error: error.message,
        },
      };
    }
  }
}

function validateUpload({ fileName, content }) {
  if (!fileName || typeof fileName !== "string" || !fileName.toLowerCase().endsWith(".pptx")) {
    throw new AppError({ code: "PPTX_FILE_REQUIRED", status: 400, message: "A .pptx file is required" });
  }
  if (!Buffer.isBuffer(content) || content.length === 0) {
    throw new AppError({ code: "PPTX_FILE_INVALID", status: 400, message: "PPTX content is invalid" });
  }
  if (content.length > MAX_PERSONAL_TEMPLATE_BYTES) {
    throw new AppError({ code: "PPTX_FILE_TOO_LARGE", status: 413, message: "PPTX file is too large", publicDetails: { max_bytes: MAX_PERSONAL_TEMPLATE_BYTES } });
  }
}

function isDuplicateRecordError(error) {
  return error?.code === "ER_DUP_ENTRY"
    || Number(error?.errno) === 1062
    || /duplicate entry|duplicate key|unique constraint/i.test(String(error?.message || ""));
}

function validatePptxPackage(files) {
  const names = Object.keys(files);
  if (!files["[Content_Types].xml"] || !files["ppt/presentation.xml"]) {
    throw new AppError({ code: "PPTX_STRUCTURE_INVALID", status: 400, message: "PPTX structure is invalid" });
  }
  if (names.some((name) => {
    const normalized = name.toLowerCase();
    return normalized.includes("vbaproject")
      || normalized.endsWith(".bin")
      || normalized.startsWith("ppt/embeddings/")
      || normalized.startsWith("ppt/activex/");
  })) {
    throw new AppError({ code: "PPTX_UNSAFE_CONTENT", status: 400, message: "PPTX contains macros or embedded objects" });
  }
}

function buildTemplateJson({ packageFiles, name }) {
  const xmlFiles = Object.entries(packageFiles)
    .filter(([fileName]) => fileName.endsWith(".xml"))
    .map(([, content]) => content.toString("utf8"));
  const colors = extractColors(xmlFiles);
  const fonts = extractFonts(xmlFiles);
  const placeholders = extractPlaceholders(xmlFiles);
  const layouts = extractLayouts(packageFiles);
  const visual = {
    ...DEFAULT_VISUAL,
    primary: colors[0] || DEFAULT_VISUAL.primary,
    accent: colors[1] || colors[0] || DEFAULT_VISUAL.accent,
    title: colors[2] || DEFAULT_VISUAL.title,
    body: colors[3] || DEFAULT_VISUAL.body,
  };
  return {
    name,
    source: "uploaded_pptx",
    categoryId: PERSONAL_CATEGORY.id,
    themes: [{ id: "default", name: "Default" }],
    visual,
    fonts,
    thumbnail: { generated: true },
    layoutSchema: {
      defaultCoverLayout: layouts[0] || "title",
      defaultContentLayout: layouts[1] || "title-content",
      allowedLayouts: [...new Set(["title", "title-content", ...layouts])],
    },
    placeholders,
  };
}

function mergeVisionAnalysis(templateJson, analysis) {
  const allowedLayouts = Array.isArray(analysis?.layoutSchema?.allowedLayouts)
    ? analysis.layoutSchema.allowedLayouts.filter((layout) => typeof layout === "string" && layout.trim())
    : templateJson.layoutSchema.allowedLayouts;
  return {
    ...templateJson,
    categoryId: normalizeCategoryId(analysis?.categoryId, templateJson.categoryId),
    style: normalizeOptionalString(analysis?.style),
    useCase: normalizeOptionalString(analysis?.useCase),
    tags: Array.isArray(analysis?.tags) ? analysis.tags.filter((tag) => typeof tag === "string" && tag.trim()) : [],
    visual: {
      ...templateJson.visual,
      ...(analysis?.visual && typeof analysis.visual === "object" ? pickVisual(analysis.visual) : {}),
    },
    layoutSchema: {
      ...templateJson.layoutSchema,
      ...(analysis?.layoutSchema && typeof analysis.layoutSchema === "object" ? {
        defaultCoverLayout: normalizeOptionalString(analysis.layoutSchema.defaultCoverLayout) || templateJson.layoutSchema.defaultCoverLayout,
        defaultContentLayout: normalizeOptionalString(analysis.layoutSchema.defaultContentLayout) || templateJson.layoutSchema.defaultContentLayout,
        allowedLayouts: [...new Set([...allowedLayouts, ...templateJson.layoutSchema.allowedLayouts])],
      } : {}),
    },
  };
}

function normalizeCategoryId(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback || PERSONAL_CATEGORY.id;
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickVisual(visual) {
  return Object.fromEntries(["primary", "accent", "background", "surface", "title", "body", "layout"]
    .filter((key) => visual[key] !== undefined)
    .map((key) => [key, visual[key]]));
}

function summarizePptxPackage(packageFiles) {
  const names = Object.keys(packageFiles);
  return {
    xmlFileCount: names.filter((name) => name.endsWith(".xml")).length,
    slideCount: names.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length,
    layoutCount: names.filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).length,
    hasThumbnail: Boolean(packageFiles["docProps/thumbnail.png"]),
  };
}

function extractThumbnail(packageFiles) {
  if (packageFiles["docProps/thumbnail.png"]) {
    return { content: packageFiles["docProps/thumbnail.png"], generated: false };
  }
  return { content: ONE_PIXEL_PNG, generated: true };
}

function extractColors(xmlFiles) {
  const values = [];
  for (const xml of xmlFiles) {
    for (const match of xml.matchAll(/<a:srgbClr[^>]+val="([0-9A-Fa-f]{6})"/g)) {
      const color = match[1].toUpperCase();
      if (!["FFFFFF", "F8FAFC", "000000"].includes(color) && !values.includes(color)) values.push(color);
    }
  }
  return values;
}

function extractFonts(xmlFiles) {
  const fonts = [];
  for (const xml of xmlFiles) {
    for (const match of xml.matchAll(/typeface="([^"]+)"/g)) {
      if (!fonts.includes(match[1])) fonts.push(match[1]);
    }
  }
  return fonts.length ? fonts : ["Arial", "Microsoft YaHei"];
}

function extractPlaceholders(xmlFiles) {
  const placeholders = [];
  for (const xml of xmlFiles) {
    const titleCount = (xml.match(/name="Title[^"]*"/g) || []).length;
    const contentCount = (xml.match(/name="Content[^"]*"/g) || []).length;
    if (titleCount) placeholders.push({ type: "title", count: titleCount });
    if (contentCount) placeholders.push({ type: "body", count: contentCount });
  }
  return placeholders.length ? placeholders : [{ type: "title", count: 1 }, { type: "body", count: 1 }];
}

function extractLayouts(packageFiles) {
  return Object.keys(packageFiles)
    .filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"))
    .map((name, index) => (index === 0 ? "title" : "title-content"));
}

function readZipFiles(buffer) {
  const files = {};
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;
    const fileName = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if (fileName.includes("..") || fileName.startsWith("/") || fileName.startsWith("\\")) {
      throw new AppError({ code: "PPTX_STRUCTURE_INVALID", status: 400, message: "PPTX entry path is invalid" });
    }
    const raw = buffer.subarray(dataStart, dataEnd);
    if (method === 0) {
      files[fileName] = raw;
    } else if (method === 8) {
      files[fileName] = inflateRawSync(raw);
    } else {
      throw new AppError({ code: "PPTX_COMPRESSION_UNSUPPORTED", status: 400, message: "Compressed PPTX entries are not supported" });
    }
    if (files[fileName].length !== uncompressedSize) {
      throw new AppError({ code: "PPTX_STRUCTURE_INVALID", status: 400, message: "PPTX entry size is invalid" });
    }
    offset = dataEnd;
  }
  return files;
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}
