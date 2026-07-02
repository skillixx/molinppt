import { LocalFileStorage } from "./files.js";
import { S3CompatibleFileStorage } from "./s3-storage.js";

/**
 * Creates the configured file storage adapter.
 * @param {{config: object, database: object}} input
 * @returns {LocalFileStorage | S3CompatibleFileStorage}
 */
export function createStorage({ config, database }) {
  if (config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey) {
    return new S3CompatibleFileStorage({ config, database });
  }
  return new LocalFileStorage({ storageDir: config.directory, database });
}

