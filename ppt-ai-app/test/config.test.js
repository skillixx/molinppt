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
    IMAGE_PROVIDER: "mock-image",
    IMAGE_API_KEY: "image-key",
    SESSION_COOKIE_NAME: "sid",
    SESSION_TTL_SECONDS: "3600",
    SESSION_COOKIE_SECURE: "false",
  });

  assert.equal(config.app.port, 5180);
  assert.equal(config.moling.baseUrl, "http://moling.test");
  assert.equal(config.moling.localMock, true);
  assert.equal(config.moling.localUserId, 7);
  assert.equal(config.moling.localEntitlementId, 88);
  assert.equal(config.auth.sessionCookieName, "sid");
  assert.equal(config.auth.sessionTtlMs, 3600000);
  assert.equal(config.auth.sessionCookieSecure, false);
  assert.equal(config.storage.directory, "./tmp/storage");
  assert.equal(config.ai.llmProvider, "mock");
  assert.equal(config.ai.llmApiUrl, "http://ai.test/generate");
  assert.equal(config.ai.llmModel, "deepseek-v4-flash");
  assert.equal(config.ai.llmTimeoutMs, 1500);
  assert.equal(config.ai.llmMaxRetries, 2);
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
