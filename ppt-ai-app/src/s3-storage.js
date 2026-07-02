import { createHash, createHmac, randomUUID } from "node:crypto";

import { AppError } from "./errors.js";
import { requirePermission } from "./permissions.js";

const REGION = "us-east-1";
const SERVICE = "s3";

/**
 * S3-compatible storage adapter for MinIO and AWS S3.
 */
export class S3CompatibleFileStorage {
  /**
   * Creates S3-compatible storage.
   * @param {{config: object, database: object}} input
   */
  constructor({ config, database }) {
    this.config = config;
    this.database = database;
  }

  /**
   * Uploads a file to S3-compatible object storage.
   * @param {{ownerUserId: number, fileName: string, mimeType: string, content: Buffer, fileRole?: string, visibility?: string, assetId?: string, deckId?: string, templateSlug?: string, storageKey?: string}} input
   * @returns {Promise<object>}
   */
  async upload({ ownerUserId, fileName, mimeType, content, fileRole = "upload", visibility = "private", assetId, deckId, templateSlug, storageKey }) {
    validateUploadPayload({ fileName, mimeType, content });
    const id = randomUUID();
    const resolvedStorageKey = storageKey || `${ownerUserId}/${id}-${sanitizeFileName(fileName)}`;
    validateStorageKey(resolvedStorageKey);
    await this.#sendObjectRequest({
      method: "PUT",
      storageKey: resolvedStorageKey,
      content,
      mimeType,
    });
    const file = await this.database.insert("files", {
      id,
      ownerUserId,
      fileName,
      mimeType,
      storageKey: resolvedStorageKey,
      sizeBytes: content.length,
      status: "available",
    });
    await this.#insertStorageObject({ file, ownerUserId, fileRole, visibility, assetId, deckId, templateSlug });
    return file;
  }

  /**
   * Downloads a file from S3-compatible object storage after owner validation.
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
    const content = await this.#sendObjectRequest({ method: "GET", storageKey: file.storageKey, content: Buffer.alloc(0), mimeType: file.mimeType });
    return { file, content };
  }

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

  async #sendObjectRequest({ method, storageKey, content, mimeType }) {
    const endpoint = new URL(this.config.endpoint);
    const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
    const pathname = `/${this.config.bucket}/${encodedKey}`;
    const url = new URL(pathname, endpoint);
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(content).digest("hex");
    const headers = {
      "content-type": mimeType,
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    headers.authorization = signRequest({
      method,
      pathname,
      headers,
      payloadHash,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      dateStamp,
    });
    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : content,
    });
    if (!response.ok) {
      throw new AppError({ code: "OBJECT_STORAGE_FAILED", status: 502, message: "Object storage request failed", publicDetails: { status: response.status } });
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

function signRequest({ method, pathname, headers, payloadHash, accessKeyId, secretAccessKey, dateStamp }) {
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name]}\n`).join("");
  const canonicalRequest = [
    method,
    pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    headers["x-amz-date"],
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), REGION), SERVICE), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function toAmzDate(date) {
  return date.toISOString().replaceAll(/[:-]|\.\d{3}/g, "");
}

function validateUploadPayload({ fileName, mimeType, content }) {
  if (!fileName || typeof fileName !== "string") throw new AppError({ code: "FILE_NAME_REQUIRED", status: 400, message: "File name is required" });
  if (!Buffer.isBuffer(content)) throw new AppError({ code: "FILE_CONTENT_INVALID", status: 400, message: "File content is invalid" });
  if (content.length === 0) throw new AppError({ code: "FILE_EMPTY", status: 400, message: "File is empty" });
  if (!mimeType || typeof mimeType !== "string") throw new AppError({ code: "UNSUPPORTED_FILE_TYPE", status: 400, message: "Unsupported file type" });
}

function validateStorageKey(storageKey) {
  if (!storageKey || typeof storageKey !== "string" || storageKey.startsWith("/") || storageKey.split(/[\\/]/).includes("..")) {
    throw new AppError({ code: "FILE_STORAGE_KEY_INVALID", status: 400, message: "File storage key is invalid" });
  }
}

function sanitizeFileName(fileName) {
  return fileName.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}
