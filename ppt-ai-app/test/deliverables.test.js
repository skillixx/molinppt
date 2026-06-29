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
  ];

  for (const filePath of requiredFiles) {
    await access(filePath);
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
