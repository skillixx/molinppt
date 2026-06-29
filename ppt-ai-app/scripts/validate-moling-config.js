import { BillingClient } from "../src/billing.js";
import { loadConfig } from "../src/config.js";
import { MolingClient } from "../src/moling-client.js";
import { validateUserEntitlementMap } from "../src/moling-config-validator.js";

const config = loadConfig();
const molingClient = new MolingClient({
  baseUrl: config.moling.baseUrl,
  internalToken: config.moling.internalToken,
});
const billingClient = new BillingClient({ molingClient });

const report = await validateUserEntitlementMap({
  userEntitlementMap: config.moling.userEntitlementMap,
  billingClient,
});

console.log(JSON.stringify(report, null, 2));

if (report.status === "failed") {
  process.exitCode = 1;
}
