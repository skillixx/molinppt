import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/http-app.js";

let server;
let baseUrl;

beforeEach(async () => {
  const platform = createFakePlatform();
  server = createApp({
    platform,
    appId: 15,
    productId: 73,
    defaultEntitlementId: 62,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("launch verifies ticket and stores session cookie", async () => {
  const response = await fetch(`${baseUrl}/enter?ticket=lt_valid`, {
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/dashboard");
  assert.match(response.headers.get("set-cookie"), /ppt_ai_session=/);
});

test("me endpoint returns launch identity for session", async () => {
  const cookie = await launchAndGetCookie();

  const response = await fetch(`${baseUrl}/api/me`, {
    headers: { cookie },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.user_id, 479);
  assert.equal(body.app_id, 15);
  assert.equal(body.product_id, 73);
});

test("balance endpoint uses default entitlement id when omitted", async () => {
  const cookie = await launchAndGetCookie();

  const response = await fetch(`${baseUrl}/api/entitlement-balance`, {
    headers: { cookie },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.entitlement_id, 62);
  assert.equal(body.remaining, "10");
  assert.equal(body.usable, true);
});

test("mock generation success reserves and settles", async () => {
  const cookie = await launchAndGetCookie();

  const response = await fetch(`${baseUrl}/api/mock-generate`, {
    method: "POST",
    headers: {
      cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entitlement_id: 62, mode: "success" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "succeeded");
  assert.equal(body.settledAmount, "6");
});

test("mock generation failure releases reservation", async () => {
  const cookie = await launchAndGetCookie();

  const response = await fetch(`${baseUrl}/api/mock-generate`, {
    method: "POST",
    headers: {
      cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entitlement_id: 62, mode: "failure" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "failed");
  assert.equal(body.settledAmount, "0");
});

test("mock generation returns platform error details", async () => {
  const platform = createFakePlatform();
  platform.reserveEntitlement = async () => {
    const error = new Error("请求参数错误");
    error.code = 40000;
    error.status = 400;
    error.path = "/api/internal/entitlement-reserve";
    throw error;
  };
  const localServer = createApp({
    platform,
    appId: 15,
    productId: 73,
    defaultEntitlementId: 62,
  });
  await new Promise((resolve) => localServer.listen(0, "127.0.0.1", resolve));
  const address = localServer.address();
  const localBaseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const launch = await fetch(`${localBaseUrl}/enter?ticket=lt_valid`, {
      redirect: "manual",
    });
    const cookie = launch.headers.get("set-cookie").split(";")[0];

    const response = await fetch(`${localBaseUrl}/api/mock-generate`, {
      method: "POST",
      headers: {
        cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entitlement_id: 62, mode: "success" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "请求参数错误");
    assert.equal(body.code, 40000);
    assert.equal(body.path, "/api/internal/entitlement-reserve");
  } finally {
    await new Promise((resolve, reject) => {
      localServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function launchAndGetCookie() {
  const response = await fetch(`${baseUrl}/enter?ticket=lt_valid`, {
    redirect: "manual",
  });
  return response.headers.get("set-cookie").split(";")[0];
}

function createFakePlatform() {
  return {
    async verifyLaunchTicket(ticket) {
      if (ticket !== "lt_valid") {
        const error = new Error("票据无效、已过期或已被使用");
        error.code = 40003;
        throw error;
      }
      return { user_id: 479, app_id: 15, product_id: 73 };
    },
    async getEntitlementBalance({ userId, entitlementId }) {
      return {
        entitlement_id: Number(entitlementId),
        user_id: Number(userId),
        quota_total: "10",
        quota_used: "0",
        quota_reserved: "0",
        remaining: "10",
        status: "active",
        usable: true,
      };
    },
    async reserveEntitlement() {
      return { hold_id: 9001, reserved: "6" };
    },
    async settleEntitlement() {
      return { status: "settled", settled_amount: "6" };
    },
    async releaseEntitlement() {
      return { status: "released", settled_amount: "0" };
    },
  };
}
