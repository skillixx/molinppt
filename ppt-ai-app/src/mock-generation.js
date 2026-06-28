export const PPT_GENERATE_CREDITS = "6";

export async function runMockPptGeneration({
  platform,
  userId,
  entitlementId,
  taskId,
  shouldFail = false,
}) {
  const reserveKey = `${taskId}:ppt_generate:reserve`;
  const reserve = await platform.reserveEntitlement({
    userId,
    entitlementId,
    amount: PPT_GENERATE_CREDITS,
    idempotencyKey: reserveKey,
  });

  const holdId = reserve.hold_id ?? reserve.holdId;

  if (shouldFail) {
    await platform.releaseEntitlement({
      holdId,
      idempotencyKey: reserveKey,
    });
    return {
      taskId,
      status: "failed",
      holdId,
      reservedAmount: PPT_GENERATE_CREDITS,
      settledAmount: "0",
    };
  }

  await platform.settleEntitlement({
    holdId,
    actualAmount: PPT_GENERATE_CREDITS,
  });
  return {
    taskId,
    status: "succeeded",
    holdId,
    reservedAmount: PPT_GENERATE_CREDITS,
    settledAmount: PPT_GENERATE_CREDITS,
  };
}
