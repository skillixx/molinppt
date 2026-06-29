import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { AppError } from "./errors.js";
import { requirePermission } from "./permissions.js";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "application/pdf",
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
   * @param {{ownerUserId: number, fileName: string, mimeType: string, content: Buffer}} input
   * @returns {Promise<object>}
   */
  async upload({ ownerUserId, fileName, mimeType, content }) {
    validateUploadPayload({ fileName, mimeType, content });
    await mkdir(this.storageDir, { recursive: true });
    const id = randomUUID();
    const storageKey = `${ownerUserId}/${id}-${sanitizeFileName(fileName)}`;
    const fullPath = path.join(this.storageDir, storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
    return this.database.insert("files", {
      id,
      ownerUserId,
      fileName,
      mimeType,
      storageKey,
      sizeBytes: content.length,
      status: "available",
    });
  }

  /**
   * Downloads a file after owner validation.
   * @param {{fileId: string, ownerUserId: number}} input
   * @returns {Promise<{file: object, content: Buffer}>}
   */
  async download({ fileId, ownerUserId }) {
    const file = await this.database.findOne("files", (record) => record.id === fileId);
    if (!file) throw new AppError({ code: "FILE_NOT_FOUND", status: 404, message: "File not found" });
    requirePermission({
      actor: { userId: ownerUserId, role: "user" },
      resource: { ownerUserId: file.ownerUserId },
      action: "download",
    });
    return {
      file,
      content: await readFile(path.join(this.storageDir, file.storageKey)),
    };
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
