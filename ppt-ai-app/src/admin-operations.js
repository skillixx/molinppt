import { rm } from "node:fs/promises";
import path from "node:path";

import { AppError } from "./errors.js";

/**
 * Disables one user by Moling user ID or local user record ID.
 * @param {{database: object, userId: number | string, actor: string, reason?: string}} input
 * @returns {Promise<{user: object, changeLog: object}>}
 */
export async function disableUser({ database, userId, actor, reason = "" }) {
  const user = await findUser(database, userId);
  const after = await database.update("users", user.id, { status: "disabled", disabled_at: new Date().toISOString(), disabled_reason: reason });
  return {
    user: after,
    changeLog: await recordChange({
      database,
      actor,
      operation: "disable_user",
      targetType: "user",
      targetId: user.id,
      before: user,
      after,
      reason,
      rollbackSql: `UPDATE users SET status = '${escapeSql(user.status || "active")}' WHERE id = '${escapeSql(user.id)}';`,
    }),
  };
}

/**
 * Restores one disabled user.
 * @param {{database: object, userId: number | string, actor: string, reason?: string}} input
 * @returns {Promise<{user: object, changeLog: object}>}
 */
export async function restoreUser({ database, userId, actor, reason = "" }) {
  const user = await findUser(database, userId);
  const after = await database.update("users", user.id, { status: "active", restored_at: new Date().toISOString(), restore_reason: reason });
  return {
    user: after,
    changeLog: await recordChange({
      database,
      actor,
      operation: "restore_user",
      targetType: "user",
      targetId: user.id,
      before: user,
      after,
      reason,
      rollbackSql: `UPDATE users SET status = '${escapeSql(user.status || "disabled")}' WHERE id = '${escapeSql(user.id)}';`,
    }),
  };
}

/**
 * Recalculates usage counters for one owner.
 * @param {{database: object, ownerUserId: number, actor: string, reason?: string}} input
 * @returns {Promise<{counter: object, changeLog: object}>}
 */
export async function recalculateUserUsageCounters({ database, ownerUserId, actor, reason = "recalculate usage counters" }) {
  const counter = {
    ownerUserId: Number(ownerUserId),
    activePptAssets: (await database.find("ppt_assets", (item) => Number(item.ownerUserId) === Number(ownerUserId) && item.status === "active")).length,
    activePersonalTemplates: (await database.find("templates", (item) => Number(item.ownerUserId) === Number(ownerUserId) && item.scope === "user" && item.status === "active")).length,
    availableStorageObjects: (await database.find("storage_objects", (item) => Number(item.ownerUserId) === Number(ownerUserId) && item.status === "available")).length,
  };
  const existing = await database.findOne("user_usage_counters", (item) => Number(item.ownerUserId) === Number(ownerUserId));
  const stored = existing
    ? await database.update("user_usage_counters", existing.id, counter)
    : await database.insert("user_usage_counters", counter);
  return {
    counter,
    changeLog: await recordChange({
      database,
      actor,
      operation: "recalculate_user_usage_counters",
      targetType: "user_usage_counters",
      targetId: String(ownerUserId),
      before: existing,
      after: stored,
      reason,
      rollbackSql: existing
        ? `UPDATE user_usage_counters SET data = '${escapeSql(JSON.stringify(existing))}' WHERE id = '${escapeSql(existing.id)}';`
        : `DELETE FROM user_usage_counters WHERE ownerUserId = ${Number(ownerUserId)};`,
    }),
  };
}

/**
 * Soft deletes one abnormal PPT asset and its indexed generated files.
 * @param {{database: object, ownerUserId: number, assetId: string, actor: string, reason?: string}} input
 * @returns {Promise<{asset: object, changeLog: object}>}
 */
export async function softDeletePptAsset({ database, ownerUserId, assetId, actor, reason = "" }) {
  const asset = await database.findOne("ppt_assets", (item) => item.id === assetId && Number(item.ownerUserId) === Number(ownerUserId));
  if (!asset) throw new AppError({ code: "ASSET_NOT_FOUND", status: 404, message: "Asset not found" });
  const after = await database.update("ppt_assets", asset.id, { status: "deleted", deleted_at: new Date().toISOString(), delete_reason: reason });
  await softDeleteStorageObjects({ database, ownerUserId, predicate: (item) => item.assetId === asset.id });
  return {
    asset: after,
    changeLog: await recordChange({
      database,
      actor,
      operation: "soft_delete_ppt_asset",
      targetType: "ppt_asset",
      targetId: asset.id,
      before: asset,
      after,
      reason,
      rollbackSql: `UPDATE ppt_assets SET status = '${escapeSql(asset.status || "active")}' WHERE id = '${escapeSql(asset.id)}';`,
    }),
  };
}

/**
 * Soft deletes one abnormal owner-scoped personal template and its files.
 * @param {{database: object, ownerUserId: number, templateId: string, actor: string, reason?: string}} input
 * @returns {Promise<{template: object, changeLog: object}>}
 */
export async function softDeletePersonalTemplate({ database, ownerUserId, templateId, actor, reason = "" }) {
  const template = await database.findOne("templates", (item) => item.id === templateId && item.scope === "user" && Number(item.ownerUserId) === Number(ownerUserId));
  if (!template) throw new AppError({ code: "TEMPLATE_NOT_FOUND", status: 404, message: "Template not found" });
  const after = await database.update("templates", template.id, { status: "deleted", deleted_at: new Date().toISOString(), delete_reason: reason });
  await softDeleteStorageObjects({ database, ownerUserId, predicate: (item) => item.templateId === template.id });
  return {
    template: after,
    changeLog: await recordChange({
      database,
      actor,
      operation: "soft_delete_personal_template",
      targetType: "template",
      targetId: template.id,
      before: template,
      after,
      reason,
      rollbackSql: `UPDATE templates SET status = '${escapeSql(template.status || "active")}' WHERE id = '${escapeSql(template.id)}';`,
    }),
  };
}

/**
 * Purges local files for storage objects already marked deleted.
 * @param {{database: object, storageDir: string, actor: string, reason?: string, limit?: number}} input
 * @returns {Promise<{checked: number, purged: number}>}
 */
export async function cleanupDeletedStorageObjects({ database, storageDir, actor, reason = "cleanup deleted storage objects", limit = 100 }) {
  const objects = (await database.find("storage_objects", (item) => item.status === "deleted")).slice(0, limit);
  let purged = 0;
  for (const object of objects) {
    if (object.storageKey) await rm(path.join(storageDir, object.storageKey), { force: true });
    const before = object;
    const after = await database.update("storage_objects", object.id, { status: "purged", purged_at: new Date().toISOString() });
    await recordChange({
      database,
      actor,
      operation: "cleanup_storage_object",
      targetType: "storage_object",
      targetId: object.id,
      before,
      after,
      reason,
      rollbackSql: `UPDATE storage_objects SET status = '${escapeSql(before.status)}' WHERE id = '${escapeSql(before.id)}';`,
    });
    purged += 1;
  }
  return { checked: objects.length, purged };
}

async function softDeleteStorageObjects({ database, ownerUserId, predicate }) {
  const objects = await database.find("storage_objects", (item) => Number(item.ownerUserId) === Number(ownerUserId) && item.status === "available" && predicate(item));
  for (const object of objects) {
    await database.update("storage_objects", object.id, { status: "deleted", deleted_at: new Date().toISOString() });
    if (object.fileId) {
      try {
        await database.update("files", object.fileId, { status: "deleted", deleted_at: new Date().toISOString() });
      } catch (error) {
        if (error?.code !== "NOT_FOUND") throw error;
      }
    }
  }
}

async function findUser(database, userId) {
  const user = await database.findOne("users", (item) => item.id === userId || Number(item.moling_user_id) === Number(userId));
  if (!user) throw new AppError({ code: "USER_NOT_FOUND", status: 404, message: "User not found" });
  return user;
}

async function recordChange({ database, actor, operation, targetType, targetId, before, after, reason, rollbackSql }) {
  return database.insert("admin_change_logs", {
    actor,
    operation,
    targetType,
    targetId,
    before: before || null,
    after: after || null,
    reason,
    rollbackSql,
    executed_at: new Date().toISOString(),
  });
}

function escapeSql(value) {
  return String(value ?? "").replaceAll("'", "''");
}

