import { openPgDatabase } from "./pg-driver.js";
import { openSqliteDatabase } from "./sqlite-driver.js";

export async function openDatabase(databaseUrl = "sqlite:./data/ppt-ai.db") {
  if (databaseUrl.startsWith("sqlite:")) {
    return openSqliteDatabase(databaseUrl);
  }

  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    return openPgDatabase(databaseUrl);
  }

  throw new Error(
    "Unsupported DATABASE_URL scheme. Use sqlite:, postgres://, or postgresql://",
  );
}
