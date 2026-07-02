import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import {
  cleanupDeletedStorageObjects,
  disableUser,
  recalculateUserUsageCounters,
  restoreUser,
  softDeletePersonalTemplate,
  softDeletePptAsset,
} from "../src/admin-operations.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-admin-ops-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("disableUser and restoreUser update status with backup, rollback, and execution records", async () => {
  const { database } = await createContext();
  await database.insert("users", { id: "user-7", moling_user_id: 7, display_name: "User 7", status: "active" });

  const disabled = await disableUser({ database, userId: 7, actor: "ops", reason: "risk" });
  const restored = await restoreUser({ database, userId: 7, actor: "ops", reason: "resolved" });
  const logs = await database.find("admin_change_logs");

  assert.equal(disabled.user.status, "disabled");
  assert.equal(restored.user.status, "active");
  assert.equal(logs.length, 2);
  assert.equal(logs[0].operation, "disable_user");
  assert.equal(logs[0].before.status, "active");
  assert.equal(logs[0].after.status, "disabled");
  assert.match(logs[0].rollbackSql, /UPDATE users SET status = 'active'/);
});

test("disabled users cannot use restored sessions", async () => {
  const { database, storage } = await createContext();
  await database.insert("users", { id: "user-7", moling_user_id: 7, status: "disabled" });
  const session = await database.insert("sessions", {
    id: "disabled-session",
    identity: { user_id: 7, app_id: 15, product_id: 73 },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const app = createApp({
    database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage,
    taskCenter: {},
    templateManager: new TemplateManager({ database }),
    aiProvider: {},
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${app.address().port}/api/me`, { headers: { cookie: `sid=${session.id}` } });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, "USER_DISABLED");
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

test("recalculateUserUsageCounters rebuilds active asset and personal template counts", async () => {
  const { database } = await createContext();
  await database.insert("ppt_assets", { id: "asset-1", ownerUserId: 7, status: "active" });
  await database.insert("ppt_assets", { id: "asset-2", ownerUserId: 7, status: "deleted" });
  await database.insert("templates", { id: "template-1", ownerUserId: 7, scope: "user", status: "active" });
  await database.insert("templates", { id: "template-2", ownerUserId: 7, scope: "user", status: "deleted" });
  await database.insert("storage_objects", { id: "object-1", ownerUserId: 7, status: "available" });

  const result = await recalculateUserUsageCounters({ database, ownerUserId: 7, actor: "ops" });
  const counter = await database.findOne("user_usage_counters", (item) => Number(item.ownerUserId) === 7);

  assert.deepEqual(result.counter, {
    ownerUserId: 7,
    activePptAssets: 1,
    activePersonalTemplates: 1,
    availableStorageObjects: 1,
  });
  assert.equal(counter.activePptAssets, 1);
});

test("softDeletePptAsset blocks future file downloads and records rollback", async () => {
  const { database, storage } = await createContext();
  await database.insert("ppt_assets", { id: "asset-1", ownerUserId: 7, status: "active", deckId: "deck-1" });
  const file = await storage.upload({
    ownerUserId: 7,
    fileName: "bad.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    content: Buffer.from("pptx"),
    assetId: "asset-1",
    visibility: "private",
  });

  const result = await softDeletePptAsset({ database, ownerUserId: 7, assetId: "asset-1", actor: "ops", reason: "bad export" });
  const object = await database.findOne("storage_objects", (item) => item.fileId === file.id);

  assert.equal(result.asset.status, "deleted");
  assert.equal(object.status, "deleted");
  await assert.rejects(() => storage.download({ ownerUserId: 7, fileId: file.id }), { code: "FILE_NOT_FOUND" });
});

test("softDeletePersonalTemplate removes visibility and cleanupDeletedStorageObjects purges deleted objects", async () => {
  const { database, storage } = await createContext();
  const file = await storage.upload({
    ownerUserId: 7,
    fileName: "template.json",
    mimeType: "application/json",
    content: Buffer.from("{}"),
    visibility: "private",
    templateSlug: "personal-template",
  });
  await database.insert("templates", { id: "template-1", ownerUserId: 7, scope: "user", status: "active" });
  const object = await database.findOne("storage_objects", (item) => item.fileId === file.id);
  await database.update("storage_objects", object.id, { templateId: "template-1" });

  const deleted = await softDeletePersonalTemplate({ database, ownerUserId: 7, templateId: "template-1", actor: "ops", reason: "broken template" });
  const cleanup = await cleanupDeletedStorageObjects({ database, storageDir: path.join(tempDir, "storage"), actor: "ops" });
  const visibleTemplates = new TemplateManager({ database }).listTemplates({ ownerUserId: 7 });
  const cleanedObject = await database.findOne("storage_objects", (item) => item.id === object.id);

  assert.equal(deleted.template.status, "deleted");
  assert.equal(visibleTemplates.some((template) => template.id === "template-1"), false);
  assert.equal(cleanup.purged, 1);
  assert.equal(cleanedObject.status, "purged");
});

async function createContext() {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["users", "sessions", "files", "ppt_assets", "templates", "storage_objects", "user_usage_counters", "admin_change_logs"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  return { database, storage };
}

