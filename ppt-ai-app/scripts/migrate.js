import { JsonFileDatabase } from "../src/database.js";

const databaseUrl = process.env.DATABASE_URL || "json:./data/ppt-ai-db.json";
const database = new JsonFileDatabase({
  filePath: databaseUrl.startsWith("json:") ? databaseUrl.slice("json:".length) : "./data/ppt-ai-db.json",
  collections: ["users", "sessions", "files", "tasks", "billing_events", "templates", "audit_logs", "outlines", "decks", "generation_tasks", "call_logs"],
});

await database.initialize();
console.log("Database initialized");
