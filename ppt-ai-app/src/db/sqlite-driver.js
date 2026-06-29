import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openSqliteDatabase(databaseUrl) {
  const databasePath = parseSqlitePath(databaseUrl);
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");

  return {
    dialect: "sqlite",
    async query(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      return database.prepare(sql).run(...params);
    },
    async exec(sql) {
      database.exec(sql);
    },
    async close() {
      database.close();
    },
  };
}

function parseSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("sqlite:")) {
    throw new Error("SQLite DATABASE_URL must start with sqlite:");
  }

  const rawPath = databaseUrl.slice("sqlite:".length);
  if (!rawPath || rawPath === ":memory:") return ":memory:";
  return resolve(rawPath);
}
