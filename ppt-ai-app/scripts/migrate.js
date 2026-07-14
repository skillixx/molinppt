import { createDatabase } from "../src/database-factory.js";

const databaseUrl = process.env.DATABASE_URL || "json:./data/ppt-ai-db.json";
const database = createDatabase({
  url: databaseUrl,
  collections: [
    "users",
    "sessions",
    "files",
    "tasks",
    "billing_events",
    "templates",
    "template_categories",
    "storage_objects",
    "user_usage_counters",
    "admin_change_logs",
    "audit_logs",
    "outlines",
    "decks",
    "generation_tasks",
    "call_logs",
    "ppt_assets",
  ],
});

await database.initialize();
console.log("Database initialized");
await database.close?.();
