const baseUrl = process.env.ACCEPTANCE_BASE_URL || `http://127.0.0.1:${process.env.APP_PORT || "5177"}`;

const checks = [
  {
    name: "health endpoint",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      const payload = await response.json();
      assert(response.ok && payload.status === "ok", "GET /api/health must return {status:\"ok\"}");
    },
  },
  {
    name: "metrics endpoint",
    run: async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const text = await response.text();
      assert(response.ok, "GET /metrics must return 2xx");
      assert(text.includes("http_requests_total"), "metrics must include http_requests_total");
    },
  },
];

for (const check of checks) {
  try {
    await check.run();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    console.error(`FAIL ${check.name}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error(`Production acceptance failed against ${baseUrl}`);
} else {
  console.log(`Production acceptance passed against ${baseUrl}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
