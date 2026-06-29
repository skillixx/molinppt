export async function openPgDatabase(databaseUrl) {
  let pg;
  try {
    pg = await import("pg");
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        "PostgreSQL DATABASE_URL requires the optional pg package to be installed",
      );
    }
    throw error;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    dialect: "pg",
    async query(sql, params = []) {
      const result = await pool.query(toPgPlaceholders(sql), params);
      return result.rows;
    },
    async run(sql, params = []) {
      return pool.query(toPgPlaceholders(sql), params);
    },
    async exec(sql) {
      return pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replaceAll("?", () => `$${++index}`);
}
