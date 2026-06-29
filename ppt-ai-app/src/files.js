import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { AppError } from "./errors.js";
import { requirePermission } from "./permissions.js";

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
 * Removes unsafe path characters from an uploaded file name.
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeFileName(fileName) {
  return fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}
