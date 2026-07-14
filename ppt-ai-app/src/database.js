import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { AppError } from "./errors.js";

/**
 * JSON-file database used as a dependency-light foundation adapter.
 */
export class JsonFileDatabase {
  /**
   * Creates a JSON-file database adapter.
   * @param {{filePath: string, collections: string[]}} input
   */
  constructor({ filePath, collections }) {
    this.filePath = filePath;
    this.collections = collections;
    this.state = null;
    this.locks = new Set();
  }

  /**
   * Initializes database collections on disk.
   * @returns {Promise<Record<string, unknown[]>>}
   */
  async initialize() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.filePath, "utf8"));
    } catch {
      this.state = {};
    }
    for (const collection of this.collections) {
      if (!Array.isArray(this.state[collection])) this.state[collection] = [];
    }
    await this.#persist();
    return this.state;
  }

  /**
   * Reloads one collection from disk into memory.
   * @param {string} collection
   * @returns {Promise<object[]>}
   */
  async reloadCollection(collection) {
    this.#requireCollection(collection);
    try {
      const latest = JSON.parse(await readFile(this.filePath, "utf8"));
      this.state[collection] = Array.isArray(latest[collection]) ? latest[collection] : [];
    } catch {
      this.state[collection] = [];
    }
    return this.state[collection];
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
    this.state[collection].push(stored);
    await this.#persist();
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
    if (index === -1) {
      throw new AppError({ code: "NOT_FOUND", status: 404, message: "Record not found" });
    }
    this.state[collection][index] = {
      ...this.state[collection][index],
      ...changes,
      updated_at: new Date().toISOString(),
    };
    await this.#persist();
    return this.state[collection][index];
  }

  /**
   * Acquires a named process-local lock for development and tests.
   * @param {string} key
   * @returns {Promise<{release: () => Promise<void>} | null>}
   */
  async acquireLock(key) {
    if (this.locks.has(key)) return null;
    this.locks.add(key);
    return {
      release: async () => {
        this.locks.delete(key);
      },
    };
  }

  /** @param {string} collection */
  #requireCollection(collection) {
    if (!this.state || !Array.isArray(this.state[collection])) {
      throw new AppError({ code: "DATABASE_NOT_INITIALIZED", status: 500, message: "Database collection is not initialized" });
    }
  }

  /** @returns {Promise<void>} */
  async #persist() {
    await writeFile(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`);
  }
}
