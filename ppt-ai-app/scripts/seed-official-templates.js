import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabase } from "../src/database-factory.js";
import { syncOfficialTemplates } from "../src/official-templates.js";
import { createStorage } from "../src/storage-factory.js";

const database = createDatabase({
  url: resolveDatabaseUrl(),
  collections: ["files", "templates", "template_categories", "storage_objects"],
});

await database.initialize();
const result = await syncOfficialTemplates({
  rootDir: resolveOfficialTemplatesDir(),
  database,
  storage: createStorage({
    config: {
      directory: process.env.STORAGE_DIR || "./data/storage",
      endpoint: process.env.STORAGE_ENDPOINT || "",
      bucket: process.env.STORAGE_BUCKET || "",
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
    },
    database,
  }),
});
console.log(JSON.stringify(result, null, 2));
await database.close?.();

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || "json:./data/ppt-ai-db.json";
}

function resolveOfficialTemplatesDir() {
  if (process.env.OFFICIAL_TEMPLATES_DIR) return path.resolve(process.env.OFFICIAL_TEMPLATES_DIR);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/official");
}
