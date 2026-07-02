import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { AppError } from "./errors.js";
import { requirePermission } from "./permissions.js";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "application/pdf",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/**
 * Local file storage adapter for uploads and downloads.
 */
export class LocalFileStorage {
  /**
   * Creates local file storage.
   * @param {{storageDir: string, database: import("./database.js").JsonFileDatabase}} input
   */
  constructor({ storageDir, database }) {
    this.storageDir = storageDir;
    this.database = database;
  }

  /**
   * Uploads a file owned by a user.
   * @param {{ownerUserId: number, fileName: string, mimeType: string, content: Buffer, fileRole?: string, visibility?: string, assetId?: string, deckId?: string, templateSlug?: string, storageKey?: string}} input
   * @returns {Promise<object>}
   */
  async upload({ ownerUserId, fileName, mimeType, content, fileRole = "upload", visibility = "private", assetId, deckId, templateSlug, storageKey }) {
    validateUploadPayload({ fileName, mimeType, content });
    await mkdir(this.storageDir, { recursive: true });
    const id = randomUUID();
    const resolvedStorageKey = storageKey || `${ownerUserId}/${id}-${sanitizeFileName(fileName)}`;
    validateStorageKey(resolvedStorageKey);
    const fullPath = path.join(this.storageDir, resolvedStorageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
    const file = await this.database.insert("files", {
      id,
      ownerUserId,
      fileName,
      mimeType,
      storageKey: resolvedStorageKey,
      sizeBytes: content.length,
      status: "available",
    });
    await this.#insertStorageObject({
      file,
      ownerUserId,
      fileRole,
      visibility,
      assetId,
      deckId,
      templateSlug,
    });
    return file;
  }

  /**
   * Downloads a file after owner validation.
   * @param {{fileId: string, ownerUserId: number}} input
   * @returns {Promise<{file: object, content: Buffer}>}
   */
  async download({ fileId, ownerUserId }) {
    const file = await this.database.findOne("files", (record) => record.id === fileId);
    if (!file || file.status !== "available") throw new AppError({ code: "FILE_NOT_FOUND", status: 404, message: "File not found" });
    requirePermission({
      actor: { userId: ownerUserId, role: "user" },
      resource: { ownerUserId: file.ownerUserId },
      action: "download",
    });
    await this.#assertStorageObjectDownloadable({ file, ownerUserId });
    return {
      file,
      content: await readFile(path.join(this.storageDir, file.storageKey)),
    };
  }

  /**
   * Stores a storage object index row when that collection is available.
   * @param {{file: object, ownerUserId: number, fileRole: string, visibility: string, assetId?: string, deckId?: string, templateSlug?: string}} input
   * @returns {Promise<void>}
   */
  async #insertStorageObject({ file, ownerUserId, fileRole, visibility, assetId, deckId, templateSlug }) {
    try {
      await this.database.insert("storage_objects", {
        fileId: file.id,
        ownerUserId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        storageKey: file.storageKey,
        sizeBytes: file.sizeBytes,
        fileRole,
        visibility,
        assetId,
        deckId,
        templateSlug,
        status: "available",
      });
    } catch (error) {
      if (error?.code !== "DATABASE_NOT_INITIALIZED") throw error;
    }
  }

  /**
   * Blocks downloads for deleted storage objects or files tied to deleted PPT assets.
   * @param {{file: object, ownerUserId: number}} input
   * @returns {Promise<void>}
   */
  async #assertStorageObjectDownloadable({ file, ownerUserId }) {
    let object;
    try {
      object = await this.database.findOne("storage_objects", (item) => item.fileId === file.id);
    } catch (error) {
      if (error?.code === "DATABASE_NOT_INITIALIZED") return;
      throw error;
    }
    if (!object) return;
    if (object.status !== "available") throw new AppError({ code: "FILE_NOT_FOUND", status: 404, message: "File not found" });
    requirePermission({
      actor: { userId: ownerUserId, role: "user" },
      resource: { ownerUserId: object.ownerUserId },
      action: "download",
    });
    if (!object.assetId) return;
    try {
      const asset = await this.database.findOne("ppt_assets", (item) => item.id === object.assetId);
      if (!asset || asset.status !== "active") throw new AppError({ code: "FILE_NOT_FOUND", status: 404, message: "File not found" });
    } catch (error) {
      if (error?.code === "DATABASE_NOT_INITIALIZED") return;
      throw error;
    }
  }
}

/**
 * Validates a file payload before persisting it.
 * @param {{fileName: string, mimeType: string, content: Buffer}} input
 * @returns {void}
 */
function validateUploadPayload({ fileName, mimeType, content }) {
  if (!fileName || typeof fileName !== "string") {
    throw new AppError({ code: "FILE_NAME_REQUIRED", status: 400, message: "File name is required" });
  }
  if (!Buffer.isBuffer(content)) {
    throw new AppError({ code: "FILE_CONTENT_INVALID", status: 400, message: "File content is invalid" });
  }
  if (content.length === 0) {
    throw new AppError({ code: "FILE_EMPTY", status: 400, message: "File is empty" });
  }
  if (content.length > MAX_UPLOAD_BYTES) {
    throw new AppError({
      code: "FILE_TOO_LARGE",
      status: 413,
      message: "File is too large",
      publicDetails: { max_bytes: MAX_UPLOAD_BYTES },
    });
  }
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new AppError({
      code: "UNSUPPORTED_FILE_TYPE",
      status: 400,
      message: "Unsupported file type",
      publicDetails: { supported_mime_types: [...SUPPORTED_MIME_TYPES] },
    });
  }
}

/**
 * Removes unsafe path characters from an uploaded file name.
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeFileName(fileName) {
  return fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Validates a storage object key.
 * @param {string} storageKey
 * @returns {void}
 */
function validateStorageKey(storageKey) {
  if (!storageKey || typeof storageKey !== "string" || path.isAbsolute(storageKey) || storageKey.split(/[\\/]/).includes("..")) {
    throw new AppError({ code: "FILE_STORAGE_KEY_INVALID", status: 400, message: "File storage key is invalid" });
  }
}
