import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openDatabase } from "./index.js";

const DEFAULT_MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

export async function runMigrations({
  databaseUrl = "sqlite:./data/ppt-ai.db",
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
} = {}) {
  const db = await openDatabase(databaseUrl);
  const applied = [];
  const skipped = [];

  try {
    await ensureMigrationsTable(db);
    const migrationFiles = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const filename of migrationFiles) {
      if (await hasMigration(db, filename)) {
        skipped.push(filename);
        continue;
      }

      const sql = await readFile(join(migrationsDir, filename), "utf8");
      await applyMigration(db, filename, sql);
      applied.push(filename);
    }

    return { applied, skipped };
  } finally {
    await db.close();
  }
}

async function ensureMigrationsTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);
}

async function hasMigration(db, filename) {
  const rows = await db.query(
    "SELECT filename FROM schema_migrations WHERE filename = ?",
    [filename],
  );
  return rows.length > 0;
}

async function applyMigration(db, filename, sql) {
  await db.exec("BEGIN");
  try {
    await db.exec(sql);
    await db.run(
      "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)",
      [filename, Date.now()],
    );
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
