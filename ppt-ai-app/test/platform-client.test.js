import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformClient, PlatformError } from "../src/platform-client.js";
import { runMockPptGeneration } from "../src/mock-generation.js";

test("verifyLaunchTicket posts ticket with internal token", async () => {
  const calls = [];
  const client = new PlatformClient({
    baseUrl: "https://platform.example",
    internalToken: "secret-token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        code: 0,
        message: "ok",
        data: { user_id: 479, app_id: 15, product_id: 73 },
      });
    },
  });

  const identity = await client.verifyLaunchTicket("lt_abc");

  assert.deepEqual(identity, { user_id: 479, app_id: 15, product_id: 73 });
  assert.equal(calls[0].url, "https://platform.example/api/internal/app-launch/verify");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-Internal-Token"], "secret-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), { launch_ticket: "lt_abc" });
});

test("getEntitlementBalance calls internal balance endpoint", async () => {
  const calls = [];
  const client = new PlatformClient({
    baseUrl: "https://platform.example/",
    internalToken: "secret-token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        code: 0,
        message: "ok",
        data: {
          entitlement_id: 62,
          user_id: 479,
          remaining: "10",
          usable: true,
        },
      });
    },
  });

  const balance = await client.getEntitlementBalance({
    userId: 479,
    entitlementId: 62,
  });

  assert.equal(balance.remaining, "10");
  assert.equal(calls[0].url, "https://platform.example/api/internal/entitlement-balance?user_id=479&entitlement_id=62");
  assert.equal(calls[0].init.headers["X-Internal-Token"], "secret-token");
});

test("platform errors include code and message", async () => {
  const client = new PlatformClient({
    baseUrl: "https://platform.example",
    internalToken: "secret-token",
    fetcher: async () => jsonResponse({ code: 60005, message: "权益额度不足", data: null }, 400),
  });

  await assert.rejects(
    () => client.reserveEntitlement({
      userId: 479,
      entitlementId: 62,
      amount: "6",
      idempotencyKey: "task_1:ppt_generate:reserve",
    }),
    (error) => {
      assert.ok(error instanceof PlatformError);
      assert.equal(error.code, 60005);
      assert.equal(error.message, "权益额度不足");
      return true;
    },
  );
});

test("reserveEntitlement sends numeric ids even when UI provides strings", async () => {
  const calls = [];
  const client = new PlatformClient({
    baseUrl: "https://platform.example",
    internalToken: "secret-token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        code: 0,
        message: "ok",
        data: { hold_id: 120, reserved: "6" },
      });
    },
  });

  await client.reserveEntitlement({
    userId: "479",
    entitlementId: "62",
    amount: "6",
    idempotencyKey: "task_1:ppt_generate:reserve",
  });

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    user_id: 479,
    entitlement_id: 62,
    amount: "6",
    idempotency_key: "task_1:ppt_generate:reserve",
  });
});

test("consumeEntitlement sends numeric ids even when UI provides strings", async () => {
  const calls = [];
  const client = new PlatformClient({
    baseUrl: "https://platform.example",
    internalToken: "secret-token",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        code: 0,
        message: "ok",
        data: { entitlement_id: 62 },
      });
    },
  });

  await client.consumeEntitlement({
    userId: "479",
    entitlementId: "62",
    amount: "2",
    idempotencyKey: "task_1:ppt_slide_edit",
  });

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    user_id: 479,
    entitlement_id: 62,
    amount: "2",
    idempotency_key: "task_1:ppt_slide_edit",
  });
});

test("successful mock PPT generation reserves then settles credits", async () => {
  const calls = [];
  const platform = {
    reserveEntitlement: async (input) => {
      calls.push(["reserve", input]);
      return { hold_id: 1001 };
    },
    settleEntitlement: async (input) => {
      calls.push(["settle", input]);
      return { status: "settled" };
    },
    releaseEntitlement: async (input) => {
      calls.push(["release", input]);
      return { status: "released" };
    },
  };

  const result = await runMockPptGeneration({
    platform,
    userId: 479,
    entitlementId: 62,
    taskId: "task_success",
    shouldFail: false,
  });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(calls.map(([name]) => name), ["reserve", "settle"]);
  assert.equal(calls[0][1].idempotencyKey, "task_success:ppt_generate:reserve");
  assert.equal(calls[1][1].holdId, 1001);
  assert.equal(calls[1][1].actualAmount, "6");
});

test("failed mock PPT generation releases reserved credits", async () => {
  const calls = [];
  const platform = {
    reserveEntitlement: async (input) => {
      calls.push(["reserve", input]);
      return { hold_id: 1002 };
    },
    settleEntitlement: async (input) => {
      calls.push(["settle", input]);
      return { status: "settled" };
    },
    releaseEntitlement: async (input) => {
      calls.push(["release", input]);
      return { status: "released" };
    },
  };

  const result = await runMockPptGeneration({
    platform,
    userId: 479,
    entitlementId: 62,
    taskId: "task_failed",
    shouldFail: true,
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(calls.map(([name]) => name), ["reserve", "release"]);
  assert.equal(calls[1][1].holdId, 1002);
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}
