import { createApp } from "./app.js";
import { HttpAiProvider, MockAiProvider } from "./ai-provider.js";
import { BillingClient } from "./billing.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./database-factory.js";
import { ImageGenerationService } from "./image-generation-service.js";
import { createStorage } from "./storage-factory.js";
import { Logger } from "./logger.js";
import { MetricsRegistry } from "./metrics.js";
import { HttpImageProvider, HttpVisionProvider, MockImageProvider, MockVisionProvider } from "./model-providers.js";
import { LocalMolingClient, MolingClient } from "./moling-client.js";
import { PersonalTemplateService } from "./personal-template-service.js";
import { PromptManager } from "./prompt-manager.js";
import { PptExportService } from "./ppt-exporter.js";
import { LibreOfficePptPreviewRenderer } from "./ppt-preview-renderer.js";
import { PptService } from "./ppt-service.js";
import { MemoryTaskCenter } from "./tasks.js";
import { TemplateManager } from "./templates.js";

const config = loadConfig();
const logger = new Logger({ level: config.logging.level });
const metrics = new MetricsRegistry();
const database = createDatabase({
  url: config.database.url,
  collections: ["sessions", "files", "tasks", "users", "billing_events", "outlines", "decks", "generation_tasks", "call_logs", "templates", "template_categories", "ppt_assets", "storage_objects", "user_usage_counters", "admin_change_logs"],
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
const storage = createStorage({
  config: config.storage,
  database,
});
const taskCenter = new MemoryTaskCenter();
const templateManager = new TemplateManager({ database });
const visionProvider = createVisionProvider(config);
const imageProvider = createImageProvider(config);
const personalTemplateService = new PersonalTemplateService({ database, storage, visionProvider });
const imageGenerationService = new ImageGenerationService({ storage, templateManager, imageProvider });
const aiProvider = config.ai.llmProvider === "http"
  ? new HttpAiProvider({
    endpoint: config.ai.llmApiUrl,
    apiKey: config.ai.llmApiKey,
    model: config.ai.llmModel,
    timeoutMs: config.ai.llmTimeoutMs,
    maxRetries: config.ai.llmMaxRetries,
  })
  : new MockAiProvider();
const pptService = new PptService({
  database,
  storage,
  taskCenter,
  templateManager,
  personalTemplateService,
  aiProvider,
  promptManager: new PromptManager(),
  exporter: new PptExportService(),
  pptPreviewRenderer: new LibreOfficePptPreviewRenderer({
    command: config.preview.rendererCommand,
    imageCommand: config.preview.imageRendererCommand,
    timeoutMs: config.preview.rendererTimeoutMs,
    logger,
  }),
  billingClient,
  metrics,
});

const app = createApp({
  database,
  defaultEntitlementId: config.moling.defaultEntitlementId || config.moling.localEntitlementId,
  userEntitlementMap: config.moling.userEntitlementMap,
  expectedAppId: config.app.molingAppId,
  expectedProductId: config.app.molingProductId,
  logger,
  metrics,
  molingClient,
  billingClient,
  storage,
  taskCenter,
  templateManager,
  personalTemplateService,
  aiProvider,
  imageGenerationService,
  pptService,
  internalToken: config.moling.internalToken,
  sessionCookieName: config.auth.sessionCookieName,
  sessionTtlMs: config.auth.sessionTtlMs,
  sessionCookieSecure: config.auth.sessionCookieSecure,
  rateLimit: {
    maxRequests: config.limits.rateLimitMaxRequests,
    windowMs: config.limits.rateLimitWindowMs,
  },
});

app.listen(config.app.port, "0.0.0.0", () => {
  logger.info("server_started", { port: config.app.port });
});

function createVisionProvider(config) {
  if (config.ai.visionProvider === "http") {
    return new HttpVisionProvider({
      endpoint: config.ai.visionApiUrl,
      apiKey: config.ai.visionApiKey,
      model: config.ai.visionModel,
    });
  }
  if (config.ai.visionProvider === "mock") return new MockVisionProvider();
  return null;
}

function createImageProvider(config) {
  if (config.ai.imageProvider === "http") {
    return new HttpImageProvider({
      endpoint: config.ai.imageApiUrl,
      apiKey: config.ai.imageApiKey,
      model: config.ai.imageModel,
    });
  }
  if (config.ai.imageProvider === "mock") return new MockImageProvider();
  return null;
}
