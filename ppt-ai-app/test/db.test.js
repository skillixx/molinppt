import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { openDatabase } from "../src/db/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { openSqliteDatabase } from "../src/db/sqlite-driver.js";

async function tempSqliteUrl() {
  const dir = await mkdtemp(join(tmpdir(), "ppt-ai-db-"));
  return `sqlite:${join(dir, "test.db")}`;
}

test("runMigrations creates the initial application tables", async () => {
  const databaseUrl = await tempSqliteUrl();

  const result = await runMigrations({ databaseUrl });

  assert.deepEqual(result, { applied: ["0001_init.sql"], skipped: [] });

  const db = openSqliteDatabase(databaseUrl);
  try {
    const rows = await db.query(
      "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name",
      ["table", "sqlite_%"],
    );
    assert.deepEqual(rows.map((row) => row.name), [
      "assets",
      "generation_tasks",
      "ppt_app_sessions",
      "presentations",
      "schema_migrations",
      "slides",
    ]);
  } finally {
    await db.close();
  }
});

test("runMigrations skips migrations that were already applied", async () => {
  const databaseUrl = await tempSqliteUrl();

  await runMigrations({ databaseUrl });
  const result = await runMigrations({ databaseUrl });

  assert.deepEqual(result, { applied: [], skipped: ["0001_init.sql"] });
});


test("openDatabase selects the SQLite driver for sqlite URLs", async () => {
  const db = await openDatabase("sqlite::memory:");
  try {
    assert.equal(db.dialect, "sqlite");
  } finally {
    await db.close();
  }
});

test("openDatabase rejects unsupported database URL schemes", async () => {
  await assert.rejects(
    () => openDatabase("mysql://localhost/ppt_ai"),
    /Unsupported DATABASE_URL scheme/,
  );
});
