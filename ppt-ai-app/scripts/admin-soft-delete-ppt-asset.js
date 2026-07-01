import { softDeletePptAsset } from "../src/admin-operations.js";
import { openAdminDatabase, parseArgs, requireArg } from "./admin-utils.js";

const args = parseArgs();
const database = await openAdminDatabase();
try {
  const result = await softDeletePptAsset({
    database,
    ownerUserId: Number(requireArg(args, "owner-user-id")),
    assetId: requireArg(args, "asset-id"),
    actor: requireArg(args, "actor"),
    reason: args.reason || "",
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close?.();
}

