import assert from "node:assert/strict";
import { test } from "node:test";

import { loadConfig } from "../src/config.js";

test("loadConfig reads platform settings from env", () => {
  const config = loadConfig({
    MOLING_API_BASE_URL: "http://8.130.9.163:8080",
    INTERNAL_API_TOKEN: "secret-token",
    PPT_APP_ID: "15",
    PPT_PRODUCT_ID: "73",
    PPT_DEFAULT_ENTITLEMENT_ID: "62",
    PORT: "5177",
  });

  assert.deepEqual(config, {
    platformBaseUrl: "http://8.130.9.163:8080",
    internalToken: "secret-token",
    appId: 15,
    productId: 73,
    defaultEntitlementId: 62,
    port: 5177,
    databaseUrl: "sqlite:./data/ppt-ai.db",
  });
});

test("loadConfig allows DATABASE_URL override", () => {
  const config = loadConfig({
    MOLING_API_BASE_URL: "http://platform.test",
    INTERNAL_API_TOKEN: "secret-token",
    DATABASE_URL: "sqlite::memory:",
  });

  assert.equal(config.databaseUrl, "sqlite::memory:");
});

test("loadConfig reports missing required settings", () => {
  assert.throws(
    () => loadConfig({}),
    /MOLING_API_BASE_URL, INTERNAL_API_TOKEN/,
  );
});
