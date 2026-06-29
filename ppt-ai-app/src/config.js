/**
 * Loads all application configuration from environment variables.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {object}
 */
export function loadConfig(env = process.env) {
  const missing = [];
  for (const name of ["MOLING_API_BASE_URL", "INTERNAL_API_TOKEN"]) {
    if (!env[name]) missing.push(name);
  }
  const llmProvider = env.LLM_PROVIDER || "mock";
  if (llmProvider === "http" && !env.LLM_API_URL) {
    missing.push("LLM_API_URL");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    app: {
      env: env.APP_ENV || "development",
      port: readPositiveInteger(firstDefined(env.APP_PORT, env.PORT), 5177, "APP_PORT"),
      baseUrl: env.APP_BASE_URL || "",
      molingAppId: readOptionalPositiveInteger(firstDefined(env.MOLING_APP_ID, env.PPT_APP_ID), "MOLING_APP_ID"),
      molingProductId: readOptionalPositiveInteger(firstDefined(env.MOLING_PRODUCT_ID, env.PPT_PRODUCT_ID), "MOLING_PRODUCT_ID"),
    },
    moling: {
      baseUrl: env.MOLING_API_BASE_URL,
      internalToken: env.INTERNAL_API_TOKEN,
      localMock: env.LOCAL_MOLING_MOCK === "true",
      localUserId: readOptionalPositiveInteger(env.LOCAL_MOLING_USER_ID, "LOCAL_MOLING_USER_ID"),
      defaultEntitlementId: readOptionalPositiveInteger(
        firstDefined(env.MOLING_DEFAULT_ENTITLEMENT_ID, env.PPT_DEFAULT_ENTITLEMENT_ID),
        "MOLING_DEFAULT_ENTITLEMENT_ID",
      ),
      localEntitlementId: readOptionalPositiveInteger(
        firstDefined(env.LOCAL_MOLING_ENTITLEMENT_ID, env.MOLING_DEFAULT_ENTITLEMENT_ID, env.PPT_DEFAULT_ENTITLEMENT_ID),
        "LOCAL_MOLING_ENTITLEMENT_ID",
      ),
      localInitialCredits: env.LOCAL_MOLING_INITIAL_CREDITS || "100",
    },
    test: {
      account: env.TEST_ACCOUNT || "",
      password: env.TEST_PASSWORD || "",
    },
    database: {
      url: env.DATABASE_URL || "json:./data/ppt-ai-db.json",
    },
    storage: {
      directory: env.STORAGE_DIR || "./data/storage",
      endpoint: env.STORAGE_ENDPOINT || "",
      bucket: env.STORAGE_BUCKET || "",
      accessKeyId: env.STORAGE_ACCESS_KEY_ID || "",
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || "",
    },
    logging: {
      level: env.LOG_LEVEL || "info",
    },
    ai: {
      llmProvider,
      llmApiUrl: env.LLM_API_URL || "",
      llmApiKey: env.LLM_API_KEY || "",
      llmModel: env.LLM_MODEL || "",
      llmTimeoutMs: readPositiveInteger(env.LLM_TIMEOUT_MS, 30000, "LLM_TIMEOUT_MS"),
      llmMaxRetries: readNonNegativeInteger(env.LLM_MAX_RETRIES, 0, "LLM_MAX_RETRIES"),
      imageProvider: env.IMAGE_PROVIDER || "mock",
      imageApiKey: env.IMAGE_API_KEY || "",
    },
    auth: {
      sessionCookieName: env.SESSION_COOKIE_NAME || "ppt_ai_session",
      sessionTtlMs: readPositiveInteger(env.SESSION_TTL_SECONDS, 7 * 24 * 60 * 60, "SESSION_TTL_SECONDS") * 1000,
      sessionCookieSecure: readBoolean(env.SESSION_COOKIE_SECURE, (env.APP_ENV || "development") === "production"),
    },
  };
}

/**
 * Returns the first non-empty env value.
 * @param {...(string | undefined)} values
 * @returns {string | undefined}
 */
function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== "");
}

/**
 * Reads a positive integer env value.
 * @param {string | undefined} value
 * @param {number} fallback
 * @param {string} name
 * @returns {number}
 */
function readPositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * Reads an optional positive integer env value.
 * @param {string | undefined} value
 * @param {string} name
 * @returns {number | undefined}
 */
function readOptionalPositiveInteger(value, name) {
  if (value === undefined || value === "") return undefined;
  return readPositiveInteger(value, undefined, name);
}

/**
 * Reads a zero-or-positive integer env value.
 * @param {string | undefined} value
 * @param {number} fallback
 * @param {string} name
 * @returns {number}
 */
function readNonNegativeInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

/**
 * Reads a boolean env value with an explicit fallback.
 * @param {string | undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function readBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return value === "true";
}
