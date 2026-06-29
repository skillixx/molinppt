/**
 * Validates manually configured Moling user-to-entitlement mappings.
 * @param {{userEntitlementMap: Map<number, number>, billingClient: {getBalance(input: {userId: number, entitlementId: number}): Promise<object>}}} input
 * @returns {Promise<{status: "passed" | "failed" | "skipped", entries: object[]}>}
 */
export async function validateUserEntitlementMap({ userEntitlementMap, billingClient }) {
  const mappings = Array.from(userEntitlementMap || []);
  if (mappings.length === 0) {
    return { status: "skipped", entries: [] };
  }

  const entries = [];
  for (const [userId, entitlementId] of mappings) {
    try {
      const balance = await billingClient.getBalance({ userId, entitlementId });
      entries.push({
        status: "passed",
        user_id: userId,
        entitlement_id: entitlementId,
        remaining: balance?.remaining ?? null,
        usable: balance?.usable ?? null,
      });
    } catch (error) {
      entries.push({
        status: "failed",
        user_id: userId,
        entitlement_id: entitlementId,
        error: error.message,
      });
    }
  }

  return {
    status: entries.every((entry) => entry.status === "passed") ? "passed" : "failed",
    entries,
  };
}
