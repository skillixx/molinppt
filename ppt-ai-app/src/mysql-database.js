import { randomUUID } from "node:crypto";

import { AppError } from "./errors.js";

/**
 * MySQL-backed document database adapter for the foundation collection API.
 */
export class MySqlDocumentDatabase {
  /**
   * Creates a MySQL document database adapter.
   * @param {{url: string, collections: string[], connector?: Function}} input
   */
  constructor({ url, collections, connector }) {
    this.url = url;
    this.collections = collections;
    this.connector = connector;
    this.connection = null;
    this.state = null;
    this.dialect = "mysql";
  }

  /**
   * Initializes MySQL tables and loads collection state.
   * @returns {Promise<Record<string, unknown[]>>}
   */
  async initialize() {
    this.connection = await this.#connect();
    this.state = {};
    for (const collection of this.collections) {
      validateCollectionName(collection);
      await this.connection.query(`CREATE TABLE IF NOT EXISTS \`${collection}\` (
        id VARCHAR(191) PRIMARY KEY,
        data JSON NOT NULL,
        created_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL
      )`);
      const [rows] = await this.connection.query(`SELECT id, data FROM \`${collection}\``);
      this.state[collection] = rows.map((row) => normalizeRow(row));
    }
    return this.state;
  }

  /**
   * Reloads one collection from MySQL into memory.
   * @param {string} collection
   * @returns {Promise<object[]>}
   */
  async reloadCollection(collection) {
    this.#requireCollection(collection);
    validateCollectionName(collection);
    const [rows] = await this.connection.query(`SELECT id, data FROM \`${collection}\``);
    this.state[collection] = rows.map((row) => normalizeRow(row));
    return this.state[collection];
  }

  /**
   * Closes the MySQL connection.
   * @returns {Promise<void>}
   */
  async close() {
    if (this.connection?.end) await this.connection.end();
  }

  /**
   * Inserts a record into a collection.
   * @param {string} collection
   * @param {object} record
   * @returns {Promise<object>}
   */
  async insert(collection, record) {
    this.#requireCollection(collection);
    const now = new Date().toISOString();
    const stored = { id: randomUUID(), created_at: now, updated_at: now, ...record };
    await this.connection.execute(
      `INSERT INTO \`${collection}\` (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [stored.id, JSON.stringify(stored), toMysqlDateTime(stored.created_at), toMysqlDateTime(stored.updated_at)],
    );
    this.state[collection].push(stored);
    return stored;
  }

  /**
   * Finds records in a collection.
   * @param {string} collection
   * @param {(record: object) => boolean} predicate
   * @returns {Promise<object[]>}
   */
  async find(collection, predicate = () => true) {
    this.#requireCollection(collection);
    return this.state[collection].filter(predicate);
  }

  /**
   * Finds one record in a collection.
   * @param {string} collection
   * @param {(record: object) => boolean} predicate
   * @returns {Promise<object | null>}
   */
  async findOne(collection, predicate) {
    const [record] = await this.find(collection, predicate);
    return record || null;
  }

  /**
   * Updates one record by ID.
   * @param {string} collection
   * @param {string} id
   * @param {object} changes
   * @returns {Promise<object>}
   */
  async update(collection, id, changes) {
    this.#requireCollection(collection);
    const index = this.state[collection].findIndex((record) => record.id === id);
    if (index === -1) throw new AppError({ code: "NOT_FOUND", status: 404, message: "Record not found" });
    const stored = {
      ...this.state[collection][index],
      ...changes,
      updated_at: new Date().toISOString(),
    };
    await this.connection.execute(
      `UPDATE \`${collection}\` SET data = ?, updated_at = ? WHERE id = ?`,
      [JSON.stringify(stored), toMysqlDateTime(stored.updated_at), id],
    );
    this.state[collection][index] = stored;
    return stored;
  }

  /**
   * Acquires a MySQL advisory lock shared across application instances.
   * @param {string} key
   * @returns {Promise<{release: () => Promise<void>} | null>}
   */
  async acquireLock(key) {
    const lockName = `ppt-ai-app:${key}`.slice(0, 64);
    const [rows] = await this.connection.query("SELECT GET_LOCK(?, 0) AS acquired", [lockName]);
    if (Number(rows?.[0]?.acquired) !== 1) return null;
    return {
      release: async () => {
        await this.connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
      },
    };
  }

  async #connect() {
    if (this.connector) return this.connector(this.url);
    const mysql = await import("mysql2/promise").catch((error) => {
      throw new AppError({
        code: "MYSQL_DRIVER_MISSING",
        status: 500,
        message: "mysql2 dependency is required for mysql DATABASE_URL",
        details: error,
      });
    });
    return mysql.createConnection(normalizeMysqlUrl(this.url));
  }

  /** @param {string} collection */
  #requireCollection(collection) {
    if (!this.state || !Array.isArray(this.state[collection])) {
      throw new AppError({ code: "DATABASE_NOT_INITIALIZED", status: 500, message: "Database collection is not initialized" });
    }
  }
}

function normalizeRow(row) {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  return { id: row.id, ...data };
}

function normalizeMysqlUrl(url) {
  return url.startsWith("mysql2://") ? `mysql://${url.slice("mysql2://".length)}` : url;
}

function validateCollectionName(collection) {
  if (!/^[a-z_]+$/.test(collection)) {
    throw new AppError({ code: "DATABASE_COLLECTION_INVALID", status: 500, message: "Database collection name is invalid" });
  }
}

function toMysqlDateTime(value) {
  return value.replace("T", " ").replace("Z", "").slice(0, 23);
}
