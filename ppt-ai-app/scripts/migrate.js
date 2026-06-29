#!/usr/bin/env node
import { runMigrations } from "../src/db/migrate.js";

const databaseUrl = readDatabaseUrl(process.argv.slice(2), process.env);

try {
  const result = await runMigrations({ databaseUrl });
  console.log(
    JSON.stringify(
      {
        databaseUrl: redactDatabaseUrl(databaseUrl),
        applied: result.applied,
        skipped: result.skipped,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function readDatabaseUrl(args, env) {
  const flagIndex = args.indexOf("--database-url");
  if (flagIndex !== -1) {
    const value = args[flagIndex + 1];
    if (!value) throw new Error("--database-url requires a value");
    return value;
  }
  return env.DATABASE_URL || "sqlite:./data/ppt-ai.db";
}

function redactDatabaseUrl(databaseUrl) {
  if (!databaseUrl.startsWith("postgres")) return databaseUrl;
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "postgres://***";
  }
}
