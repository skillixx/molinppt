export function loadConfig(env = process.env) {
  const missing = [];
  if (!env.MOLING_API_BASE_URL) missing.push("MOLING_API_BASE_URL");
  if (!env.INTERNAL_API_TOKEN) missing.push("INTERNAL_API_TOKEN");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    platformBaseUrl: env.MOLING_API_BASE_URL,
    internalToken: env.INTERNAL_API_TOKEN,
    appId: readNumber(env.PPT_APP_ID, 15),
    productId: readNumber(env.PPT_PRODUCT_ID, 73),
    defaultEntitlementId: readOptionalNumber(env.PPT_DEFAULT_ENTITLEMENT_ID),
    port: readNumber(env.PORT, 5177),
  };
}

function readNumber(value, fallback) {
  const raw = value ?? fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got ${raw}`);
  }
  return parsed;
}

function readOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return readNumber(value);
}
