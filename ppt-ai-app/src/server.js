import path from "node:path";

import { createApp } from "./app.js";
import { HttpAiProvider, MockAiProvider } from "./ai-provider.js";
import { BillingClient } from "./billing.js";
import { loadConfig } from "./config.js";
import { JsonFileDatabase } from "./database.js";
import { LocalFileStorage } from "./files.js";
import { Logger } from "./logger.js";
import { LocalMolingClient, MolingClient } from "./moling-client.js";
import { PromptManager } from "./prompt-manager.js";
import { PptExportService } from "./ppt-exporter.js";
import { PptService } from "./ppt-service.js";
import { MemoryTaskCenter } from "./tasks.js";
import { TemplateManager } from "./templates.js";

const config = loadConfig();
const logger = new Logger({ level: config.logging.level });
const database = new JsonFileDatabase({
  filePath: resolveDatabasePath(config.database.url),
  collections: ["sessions", "files", "tasks", "users", "billing_events", "outlines", "decks", "generation_tasks", "call_logs"],
});
await database.initialize();

const molingClient = config.moling.localMock
  ? new LocalMolingClient({
    userId: config.moling.localUserId,
    appId: config.app.molingAppId,
    productId: config.app.molingProductId,
    entitlementId: config.moling.localEntitlementId,
    initialCredits: config.moling.localInitialCredits,
  })
  : new MolingClient({
    baseUrl: config.moling.baseUrl,
    internalToken: config.moling.internalToken,
  });
const billingClient = new BillingClient({ molingClient });
const storage = new LocalFileStorage({
  storageDir: config.storage.directory,
  database,
});
const taskCenter = new MemoryTaskCenter();
const templateManager = new TemplateManager();
const aiProvider = config.ai.llmProvider === "http"
  ? new HttpAiProvider({ endpoint: config.ai.llmApiUrl, apiKey: config.ai.llmApiKey })
  : new MockAiProvider();
const pptService = new PptService({
  database,
  storage,
  taskCenter,
  templateManager,
  aiProvider,
  promptManager: new PromptManager(),
  exporter: new PptExportService(),
  billingClient,
});

const app = createApp({
  database,
  defaultEntitlementId: config.moling.defaultEntitlementId || config.moling.localEntitlementId,
  expectedAppId: config.app.molingAppId,
  expectedProductId: config.app.molingProductId,
  logger,
  molingClient,
  billingClient,
  storage,
  taskCenter,
  templateManager,
  aiProvider,
  pptService,
  sessionCookieName: config.auth.sessionCookieName,
});

app.listen(config.app.port, "0.0.0.0", () => {
  logger.info("server_started", { port: config.app.port });
});

/**
 * Resolves the JSON database URL to a file path.
 * @param {string} databaseUrl
 * @returns {string}
 */
function resolveDatabasePath(databaseUrl) {
  if (databaseUrl.startsWith("json:")) return databaseUrl.slice("json:".length);
  return path.join("data", "ppt-ai-db.json");
}
