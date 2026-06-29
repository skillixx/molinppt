/**
 * Billing client for Moling prepaid entitlement operations.
 */
export class BillingClient {
  /**
   * Creates a billing client.
   * @param {{molingClient: {postInternal(pathName: string, body: object): Promise<object>}}} input
   */
  constructor({ molingClient }) {
    this.molingClient = molingClient;
  }

  /**
   * Reads the current prepaid entitlement balance.
   * @param {{userId: number, entitlementId: number}} input
   * @returns {Promise<object>}
   */
  getBalance({ userId, entitlementId }) {
    const query = new URLSearchParams({
      user_id: String(toPositiveInteger(userId, "userId")),
      entitlement_id: String(toPositiveInteger(entitlementId, "entitlementId")),
    });
    return this.molingClient.getInternal(`/api/internal/entitlement-balance?${query}`);
  }

  /**
   * Reserves prepaid credits for an expensive task.
   * @param {{userId: number, entitlementId: number, amount: string, idempotencyKey: string}} input
   * @returns {Promise<object>}
   */
  reserveCredits({ userId, entitlementId, amount, idempotencyKey }) {
    return this.molingClient.postInternal("/api/internal/entitlement-reserve", {
      user_id: toPositiveInteger(userId, "userId"),
      entitlement_id: toPositiveInteger(entitlementId, "entitlementId"),
      amount,
      idempotency_key: idempotencyKey,
    });
  }

  /**
   * Settles reserved credits after success.
   * @param {{holdId: number, actualAmount: string, idempotencyKey: string}} input
   * @returns {Promise<object>}
   */
  settleCredits({ holdId, actualAmount, idempotencyKey }) {
    return this.molingClient.postInternal("/api/internal/entitlement-settle", {
      hold_id: toPositiveInteger(holdId, "holdId"),
      actual_amount: actualAmount,
      idempotency_key: idempotencyKey,
    });
  }

  /**
   * Releases reserved credits after failure.
   * @param {{holdId: number, idempotencyKey: string}} input
   * @returns {Promise<object>}
   */
  releaseCredits({ holdId, idempotencyKey }) {
    return this.molingClient.postInternal("/api/internal/entitlement-release", {
      hold_id: toPositiveInteger(holdId, "holdId"),
      idempotency_key: idempotencyKey,
    });
  }

  /**
   * Consumes prepaid credits for known-cost actions.
   * @param {{userId: number, entitlementId: number, amount: string, idempotencyKey: string}} input
   * @returns {Promise<object>}
   */
  consumeCredits({ userId, entitlementId, amount, idempotencyKey }) {
    return this.molingClient.postInternal("/api/internal/entitlement-consume", {
      user_id: toPositiveInteger(userId, "userId"),
      entitlement_id: toPositiveInteger(entitlementId, "entitlementId"),
      amount,
      idempotency_key: idempotencyKey,
    });
  }
}

/**
 * Converts IDs to positive JSON numbers for Moling APIs.
 * @param {unknown} value
 * @param {string} name
 * @returns {number}
 */
function toPositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
