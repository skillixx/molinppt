import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDatabase } from "../src/database-factory.js";
import { syncOfficialTemplateCategories } from "../src/official-templates.js";

const database = createDatabase({
  url: resolveDatabaseUrl(),
  collections: ["template_categories"],
});

await database.initialize();
const result = await syncOfficialTemplateCategories({
  rootDir: resolveOfficialTemplatesDir(),
  database,
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
