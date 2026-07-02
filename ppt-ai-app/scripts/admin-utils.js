import { createDatabase } from "../src/database-factory.js";

export const ADMIN_COLLECTIONS = [
  "users",
  "sessions",
  "files",
  "ppt_assets",
  "templates",
  "storage_objects",
  "user_usage_counters",
  "admin_change_logs",
];

/**
 * Opens the configured operational database.
 * @param {string[]} [collections]
 * @returns {Promise<object>}
 */
export async function openAdminDatabase(collections = ADMIN_COLLECTIONS) {
  const database = createDatabase({
    url: process.env.DATABASE_URL || "json:./data/ppt-ai-db.json",
    collections,
  });
  await database.initialize();
  return database;
}

/**
 * Parses --key=value command line arguments.
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const item of argv) {
    const [key, ...value] = item.replace(/^--/, "").split("=");
    args[key] = value.join("=") || "true";
  }
  return args;
}

/**
 * Requires one CLI argument.
 * @param {Record<string, string>} args
 * @param {string} name
 * @returns {string}
 */
export function requireArg(args, name) {
  if (!args[name]) throw new Error(`Missing --${name}`);
  return args[name];
}

