import assert from "node:assert/strict";
import { test } from "node:test";

import { validateUserEntitlementMap } from "../src/moling-config-validator.js";

test("validateUserEntitlementMap verifies every mapped entitlement balance", async () => {
  const calls = [];
  const report = await validateUserEntitlementMap({
    userEntitlementMap: new Map([[696, 64], [479, 62]]),
    billingClient: {
      getBalance: async (input) => {
        calls.push(input);
        return { user_id: input.userId, entitlement_id: input.entitlementId, remaining: "10", usable: true };
      },
    },
  });

  assert.equal(report.status, "passed");
  assert.deepEqual(calls, [
    { userId: 696, entitlementId: 64 },
    { userId: 479, entitlementId: 62 },
  ]);
  assert.deepEqual(report.entries.map((entry) => entry.remaining), ["10", "10"]);
});

test("validateUserEntitlementMap reports failed mapped entitlement balance checks", async () => {
  const report = await validateUserEntitlementMap({
    userEntitlementMap: new Map([[696, 62]]),
    billingClient: {
      getBalance: async () => {
        throw new Error("权益不属于该用户");
      },
    },
  });

  assert.equal(report.status, "failed");
  assert.equal(report.entries[0].user_id, 696);
  assert.equal(report.entries[0].entitlement_id, 62);
  assert.match(report.entries[0].error, /权益不属于该用户/);
});

test("validateUserEntitlementMap reports skipped when no user entitlement map is configured", async () => {
  const report = await validateUserEntitlementMap({
    userEntitlementMap: new Map(),
    billingClient: {
      getBalance: async () => {
        throw new Error("should not be called");
      },
    },
  });

  assert.equal(report.status, "skipped");
  assert.deepEqual(report.entries, []);
});
