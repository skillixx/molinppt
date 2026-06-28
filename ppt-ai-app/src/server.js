import { loadConfig } from "./config.js";
import { createApp } from "./http-app.js";
import { PlatformClient } from "./platform-client.js";

const config = loadConfig();
const platform = new PlatformClient({
  baseUrl: config.platformBaseUrl,
  internalToken: config.internalToken,
});

const server = createApp({
  platform,
  appId: config.appId,
  productId: config.productId,
  defaultEntitlementId: config.defaultEntitlementId,
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`PPT AI integration app listening on http://127.0.0.1:${config.port}`);
});
