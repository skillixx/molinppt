export class PlatformError extends Error {
  constructor({ code, message, status, data }) {
    super(message || "Platform request failed");
    this.name = "PlatformError";
    this.code = code;
    this.status = status;
    this.data = data;
    this.path = undefined;
  }
}

export class PlatformClient {
  constructor({ baseUrl, internalToken, fetcher = fetch }) {
    if (!baseUrl) throw new Error("Platform baseUrl is required");
    if (!internalToken) throw new Error("Platform internalToken is required");

    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.internalToken = internalToken;
    this.fetcher = fetcher;
  }

  verifyLaunchTicket(ticket) {
    return this.#postInternal("/api/internal/app-launch/verify", {
      launch_ticket: ticket,
    });
  }

  getEntitlementBalance({ userId, entitlementId }) {
    const query = new URLSearchParams({
      user_id: String(userId),
      entitlement_id: String(entitlementId),
    });
    return this.#getInternal(`/api/internal/entitlement-balance?${query}`);
  }

  reserveEntitlement({ userId, entitlementId, amount, idempotencyKey }) {
    return this.#postInternal("/api/internal/entitlement-reserve", {
      user_id: toPositiveInteger(userId, "userId"),
      entitlement_id: toPositiveInteger(entitlementId, "entitlementId"),
      amount,
      idempotency_key: idempotencyKey,
    });
  }

  settleEntitlement({ holdId, idempotencyKey, actualAmount }) {
    const body = {
      actual_amount: actualAmount,
    };
    if (holdId !== undefined && holdId !== null) {
      body.hold_id = toPositiveInteger(holdId, "holdId");
    }
    if (idempotencyKey) body.idempotency_key = idempotencyKey;
    return this.#postInternal("/api/internal/entitlement-settle", body);
  }

  releaseEntitlement({ holdId, idempotencyKey }) {
    const body = {};
    if (holdId !== undefined && holdId !== null) {
      body.hold_id = toPositiveInteger(holdId, "holdId");
    }
    if (idempotencyKey) body.idempotency_key = idempotencyKey;
    return this.#postInternal("/api/internal/entitlement-release", body);
  }

  consumeEntitlement({ userId, entitlementId, amount, idempotencyKey }) {
    return this.#postInternal("/api/internal/entitlement-consume", {
      user_id: toPositiveInteger(userId, "userId"),
      entitlement_id: toPositiveInteger(entitlementId, "entitlementId"),
      amount,
      idempotency_key: idempotencyKey,
    });
  }

  async #getInternal(path) {
    return this.#request(path, { method: "GET" });
  }

  async #postInternal(path, body) {
    return this.#request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async #request(path, init) {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": this.internalToken,
        ...(init.headers || {}),
      },
    });

    let envelope;
    try {
      envelope = await response.json();
    } catch {
      const text = await response.text();
      const error = new PlatformError({
        status: response.status,
        code: response.status,
        message: text || "Platform response was not JSON",
      });
      error.path = path;
      throw error;
    }

    if (!response.ok || envelope.code !== 0) {
      const error = new PlatformError({
        status: response.status,
        code: envelope.code,
        message: envelope.message,
        data: envelope.data,
      });
      error.path = path;
      throw error;
    }

    return envelope.data;
  }
}

function toPositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
