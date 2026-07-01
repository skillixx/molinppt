import { cleanupDeletedStorageObjects } from "../src/admin-operations.js";
import { openAdminDatabase, parseArgs, requireArg } from "./admin-utils.js";

const args = parseArgs();
const database = await openAdminDatabase();
try {
  const result = await cleanupDeletedStorageObjects({
    database,
    storageDir: process.env.STORAGE_DIR || "./data/storage",
    actor: requireArg(args, "actor"),
    reason: args.reason || "cleanup deleted storage objects",
    limit: Number(args.limit || 100),
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close?.();
}

