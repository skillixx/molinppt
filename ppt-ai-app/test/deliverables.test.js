import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const appRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../", import.meta.url);

test("second-stage deployment and documentation deliverables exist", async () => {
  const requiredFiles = [
    new URL("Dockerfile", appRoot),
    new URL("docker-compose.yml", repoRoot),
    new URL(".github/workflows/ci.yml", repoRoot),
    new URL("changelog.md", repoRoot),
    new URL("docs/modules/auth.md", repoRoot),
    new URL("docs/modules/billing.md", repoRoot),
    new URL("docs/modules/files.md", repoRoot),
    new URL("docs/modules/tasks.md", repoRoot),
    new URL("docs/modules/ai-provider.md", repoRoot),
    new URL("docs/modules/templates.md", repoRoot),
    new URL("docs/modules/platform.md", repoRoot),
    new URL("docs/modules/api.md", repoRoot),
    new URL("docs/modules/ppt-service.md", repoRoot),
    new URL("docs/third-stage-business-design.md", repoRoot),
    new URL("src/prompt-manager.js", appRoot),
    new URL("src/ppt-exporter.js", appRoot),
    new URL("src/ppt-service.js", appRoot),
    new URL("src/moling-config-validator.js", appRoot),
    new URL("scripts/validate-moling-config.js", appRoot),
    new URL("scripts/moling-acceptance.js", appRoot),
  ];

  for (const filePath of requiredFiles) {
    await access(filePath);
  }
});

test("production Moling acceptance command is documented and ticket-gated", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", appRoot), "utf8"));
  const script = await readFile(new URL("scripts/moling-acceptance.js", appRoot), "utf8");

  assert.equal(packageJson.scripts["acceptance:moling"], "node scripts/moling-acceptance.js");
  assert.match(script, /ACCEPTANCE_LAUNCH_TICKET/);
  assert.match(script, /\/api\/billing\/balance/);
  assert.match(script, /\/api\/ppt\/decks/);
});

test("Moling config validation command is available for mapped entitlement checks", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", appRoot), "utf8"));
  const script = await readFile(new URL("scripts/validate-moling-config.js", appRoot), "utf8");

  assert.equal(packageJson.scripts["validate:moling-config"], "node --env-file=.env scripts/validate-moling-config.js");
  assert.match(script, /validateUserEntitlementMap/);
  assert.doesNotMatch(script, /INTERNAL_API_TOKEN/);
});

test("production compose loads app env file without interpolating secrets", async () => {
  const compose = await readFile(new URL("docker-compose.prod.yml", repoRoot), "utf8");

  assert.match(compose, /env_file:\s*\n\s*-\s*\.\/ppt-ai-app\/\.env/);
  assert.doesNotMatch(compose, /\$\{(?:MOLING_|INTERNAL_API_TOKEN|LLM_)/);
  assert.doesNotMatch(compose, /SESSION_COOKIE_SECURE:\s*true/);
});

test("local acceptance verifies exported file downloads", async () => {
  const script = await readFile(new URL("scripts/acceptance.js", appRoot), "utf8");

  assert.match(script, /\/api\/files\/\$\{file\.id\}\/download-url/);
  assert.match(script, /content-disposition/i);
  assert.match(script, /file_downloaded/);
});

test("real Moling acceptance verifies exported file downloads", async () => {
  const script = await readFile(new URL("scripts/moling-acceptance.js", appRoot), "utf8");

  assert.match(script, /\/api\/files\/\$\{file\.id\}\/download-url/);
  assert.match(script, /content-disposition/i);
  assert.match(script, /file_downloaded/);
});

test("acceptance scripts verify credit deduction after paid operations", async () => {
  const localScript = await readFile(new URL("scripts/acceptance.js", appRoot), "utf8");
  const molingScript = await readFile(new URL("scripts/moling-acceptance.js", appRoot), "utf8");

  for (const script of [localScript, molingScript]) {
    assert.match(script, /expectedDebit/);
    assert.match(script, /assertBalanceDeducted/);
    assert.match(script, /credit deduction failed/);
  }
});

test("environment examples keep sensitive values empty", async () => {
  const rootEnv = await readFile(new URL(".env.example", repoRoot), "utf8");
  const appEnv = await readFile(new URL(".env.example", appRoot), "utf8");

  for (const content of [rootEnv, appEnv]) {
    assert.match(content, /^MOLING_API_BASE_URL=$/m);
    assert.match(content, /^INTERNAL_API_TOKEN=$/m);
    assert.match(content, /^TEST_ACCOUNT=$/m);
    assert.match(content, /^TEST_PASSWORD=$/m);
  }
});

test("runtime database collections include persisted sessions", async () => {
  const serverSource = await readFile(new URL("src/server.js", appRoot), "utf8");

  assert.match(serverSource, /collections:\s*\[[^\]]*"sessions"/s);
});
