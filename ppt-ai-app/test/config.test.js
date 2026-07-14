import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config.js";

test("loadConfig reads every framework setting from environment variables", () => {
  const config = loadConfig({
    APP_ENV: "test",
    APP_PORT: "5180",
    APP_BASE_URL: "http://app.test",
    MOLING_API_BASE_URL: "http://moling.test",
    INTERNAL_API_TOKEN: "token",
    LOCAL_MOLING_MOCK: "true",
    LOCAL_MOLING_USER_ID: "7",
    LOCAL_MOLING_ENTITLEMENT_ID: "88",
    MOLING_USER_ENTITLEMENT_MAP: "7:88,9:91",
    TEST_ACCOUNT: "tester",
    TEST_PASSWORD: "password",
    DATABASE_URL: "sqlite:./tmp/test.db",
    STORAGE_DIR: "./tmp/storage",
    LOG_LEVEL: "debug",
    LLM_PROVIDER: "mock",
    LLM_API_URL: "http://ai.test/generate",
    LLM_API_KEY: "llm-key",
    LLM_MODEL: "deepseek-v4-flash",
    LLM_TIMEOUT_MS: "1500",
    LLM_MAX_RETRIES: "2",
    VISION_PROVIDER: "http",
    VISION_API_URL: "http://vision.test/analyze",
    VISION_API_KEY: "vision-key",
    VISION_MODEL: "vision-model",
    IMAGE_PROVIDER: "http",
    IMAGE_API_URL: "http://image.test/generate",
    IMAGE_API_KEY: "image-key",
    IMAGE_MODEL: "image-model",
    SESSION_COOKIE_NAME: "sid",
    SESSION_TTL_SECONDS: "3600",
    SESSION_COOKIE_SECURE: "false",
    RATE_LIMIT_MAX_REQUESTS: "42",
    RATE_LIMIT_WINDOW_MS: "30000",
    PPT_PREVIEW_RENDERER_COMMAND: "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    PPT_PREVIEW_IMAGE_RENDERER_COMMAND: "C:\\poppler\\bin\\pdftoppm.exe",
    PPT_PREVIEW_RENDERER_TIMEOUT_MS: "45000",
  });

  assert.equal(config.app.port, 5180);
  assert.equal(config.moling.baseUrl, "http://moling.test");
  assert.equal(config.moling.localMock, true);
  assert.equal(config.moling.localUserId, 7);
  assert.equal(config.moling.localEntitlementId, 88);
  assert.deepEqual(config.moling.userEntitlementMap, new Map([[7, 88], [9, 91]]));
  assert.equal(config.auth.sessionCookieName, "sid");
  assert.equal(config.auth.sessionTtlMs, 3600000);
  assert.equal(config.auth.sessionCookieSecure, false);
  assert.equal(config.limits.rateLimitMaxRequests, 42);
  assert.equal(config.limits.rateLimitWindowMs, 30000);
  assert.equal(config.storage.directory, "./tmp/storage");
  assert.equal(config.ai.llmProvider, "mock");
  assert.equal(config.ai.llmApiUrl, "http://ai.test/generate");
  assert.equal(config.ai.llmModel, "deepseek-v4-flash");
  assert.equal(config.ai.llmTimeoutMs, 1500);
  assert.equal(config.ai.llmMaxRetries, 2);
  assert.equal(config.ai.visionProvider, "http");
  assert.equal(config.ai.visionApiUrl, "http://vision.test/analyze");
  assert.equal(config.ai.visionApiKey, "vision-key");
  assert.equal(config.ai.visionModel, "vision-model");
  assert.equal(config.ai.imageProvider, "http");
  assert.equal(config.ai.imageApiUrl, "http://image.test/generate");
  assert.equal(config.ai.imageApiKey, "image-key");
  assert.equal(config.ai.imageModel, "image-model");
  assert.equal(config.preview.rendererCommand, "C:\\Program Files\\LibreOffice\\program\\soffice.exe");
  assert.equal(config.preview.imageRendererCommand, "C:\\poppler\\bin\\pdftoppm.exe");
  assert.equal(config.preview.rendererTimeoutMs, 45000);
});

test("loadConfig secures session cookies by default in production", () => {
  const config = loadConfig({
    APP_ENV: "production",
    MOLING_API_BASE_URL: "http://moling.test",
    INTERNAL_API_TOKEN: "token",
  });

  assert.equal(config.auth.sessionCookieSecure, true);
});

test("loadConfig uses port 5177 when APP_PORT is omitted", () => {
  const config = loadConfig({
    MOLING_API_BASE_URL: "http://moling.test",
    INTERNAL_API_TOKEN: "token",
  });

  assert.equal(config.app.port, 5177);
  assert.equal(config.auth.sessionTtlMs, 7 * 24 * 60 * 60 * 1000);
});

test("loadConfig accepts Moling launch aliases used by deployment commands", () => {
  const config = loadConfig({
    PORT: "5178",
    PPT_APP_ID: "15",
    PPT_PRODUCT_ID: "73",
    PPT_DEFAULT_ENTITLEMENT_ID: "62",
    MOLING_API_BASE_URL: "http://moling.test",
    INTERNAL_API_TOKEN: "token",
  });

  assert.equal(config.app.port, 5178);
  assert.equal(config.app.molingAppId, 15);
  assert.equal(config.app.molingProductId, 73);
  assert.equal(config.moling.defaultEntitlementId, 62);
  assert.equal(config.moling.localEntitlementId, 62);
});

test("loadConfig treats empty numeric env values as defaults", () => {
  const config = loadConfig({
    MOLING_API_BASE_URL: "http://moling.test",
    INTERNAL_API_TOKEN: "token",
    SESSION_TTL_SECONDS: "",
    LLM_TIMEOUT_MS: "",
    LLM_MAX_RETRIES: "",
    RATE_LIMIT_MAX_REQUESTS: "",
    RATE_LIMIT_WINDOW_MS: "",
  });

  assert.equal(config.auth.sessionTtlMs, 7 * 24 * 60 * 60 * 1000);
  assert.equal(config.ai.llmTimeoutMs, 30000);
  assert.equal(config.ai.llmMaxRetries, 0);
  assert.equal(config.ai.visionProvider, "none");
  assert.equal(config.ai.imageProvider, "none");
  assert.equal(config.limits.rateLimitMaxRequests, 120);
  assert.equal(config.limits.rateLimitWindowMs, 60_000);
  assert.equal(config.preview.rendererCommand, "");
  assert.equal(config.preview.imageRendererCommand, "");
  assert.equal(config.preview.rendererTimeoutMs, 30_000);
});

test("loadConfig rejects missing required secrets", () => {
  assert.throws(
    () => loadConfig({ MOLING_API_BASE_URL: "http://moling.test" }),
    /INTERNAL_API_TOKEN/,
  );
});

test("loadConfig rejects invalid session TTL values", () => {
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      SESSION_TTL_SECONDS: "0",
    }),
    /SESSION_TTL_SECONDS/,
  );
});

test("loadConfig rejects invalid AI provider retry settings", () => {
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      LLM_MAX_RETRIES: "-1",
    }),
    /LLM_MAX_RETRIES/,
  );
});

test("loadConfig rejects invalid user entitlement mappings", () => {
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      MOLING_USER_ENTITLEMENT_MAP: "7:88,bad",
    }),
    /MOLING_USER_ENTITLEMENT_MAP/,
  );
});

test("loadConfig rejects missing LLM API URL for HTTP provider", () => {
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      LLM_PROVIDER: "http",
    }),
    /LLM_API_URL/,
  );
});

test("loadConfig rejects missing vision and image API URLs for HTTP providers", () => {
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      VISION_PROVIDER: "http",
    }),
    /VISION_API_URL/,
  );
  assert.throws(
    () => loadConfig({
      MOLING_API_BASE_URL: "http://moling.test",
      INTERNAL_API_TOKEN: "token",
      IMAGE_PROVIDER: "http",
    }),
    /IMAGE_API_URL/,
  );
});
