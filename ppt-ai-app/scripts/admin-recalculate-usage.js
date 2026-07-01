import { recalculateUserUsageCounters } from "../src/admin-operations.js";
import { openAdminDatabase, parseArgs, requireArg } from "./admin-utils.js";

const args = parseArgs();
const database = await openAdminDatabase();
try {
  const result = await recalculateUserUsageCounters({
    database,
    ownerUserId: Number(requireArg(args, "owner-user-id")),
    actor: requireArg(args, "actor"),
    reason: args.reason || "recalculate usage counters",
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await database.close?.();
}

