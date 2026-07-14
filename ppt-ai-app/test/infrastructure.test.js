import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createDatabase } from "../src/database-factory.js";
import { createStorage } from "../src/storage-factory.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-infra-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("createDatabase selects a MySQL adapter for mysql DATABASE_URL values", () => {
  const database = createDatabase({
    url: "mysql://ppt:secret@127.0.0.1:3306/ppt_ai_app",
    collections: ["templates"],
    mysqlConnector: async () => ({
      query: async () => [[]],
      execute: async () => [[]],
      end: async () => {},
    }),
  });

  assert.equal(database.dialect, "mysql");
});

test("MySQL adapter upserts official templates without changing the slug id", async () => {
  const operations = [];
  const rows = new Map();
  const database = createDatabase({
    url: "mysql://ppt:secret@127.0.0.1:3306/ppt_ai_app",
    collections: ["templates"],
    mysqlConnector: async () => ({
      query: async (sql) => {
        operations.push(["query", sql]);
        if (sql.startsWith("SELECT")) {
          return [[...rows.values()].map((row) => ({ id: row.id, data: JSON.stringify(row.data) }))];
        }
        return [[]];
      },
      execute: async (sql, params) => {
        operations.push(["execute", sql, params]);
        if (sql.startsWith("INSERT")) rows.set(params[0], { id: params[0], data: JSON.parse(params[1]) });
        if (sql.startsWith("UPDATE")) rows.set(params[1], { id: params[1], data: JSON.parse(params[0]) });
        return [[]];
      },
      end: async () => {},
    }),
  });

  await database.initialize();
  await database.insert("templates", { id: "business-blue", slug: "business-blue", name: "Business Blue" });
  await database.update("templates", "business-blue", { name: "Business Blue Updated" });
  const stored = await database.findOne("templates", (template) => template.slug === "business-blue");

  assert.equal(stored.id, "business-blue");
  assert.equal(stored.name, "Business Blue Updated");
  assert.equal(operations.some(([kind, sql]) => kind === "execute" && sql.includes("INSERT INTO `templates`")), true);
  assert.equal(operations.some(([kind, sql]) => kind === "execute" && sql.includes("UPDATE `templates`")), true);
});

test("MySQL adapter reconnects once when a connection is closed", async () => {
  const rows = new Map();
  let connectionCount = 0;
  let failedOnce = false;
  const database = createDatabase({
    url: "mysql://ppt:secret@127.0.0.1:3306/ppt_ai_app",
    collections: ["templates"],
    mysqlConnector: async () => {
      connectionCount += 1;
      return {
        query: async (sql) => {
          if (sql.startsWith("SELECT")) {
            return [[...rows.values()].map((row) => ({ id: row.id, data: JSON.stringify(row.data) }))];
          }
          return [[]];
        },
        execute: async (sql, params) => {
          if (!failedOnce) {
            failedOnce = true;
            throw new Error("Can't add new command when connection is in closed state");
          }
          if (sql.startsWith("INSERT")) rows.set(params[0], { id: params[0], data: JSON.parse(params[1]) });
          return [[]];
        },
        end: async () => {},
      };
    },
  });

  await database.initialize();
  await database.insert("templates", { id: "education-demo", name: "Education Demo" });
  const stored = await database.findOne("templates", (template) => template.id === "education-demo");

  assert.equal(connectionCount, 2);
  assert.equal(stored.name, "Education Demo");
});

test("MySQL adapter uses advisory locks for cross-instance generation guards", async () => {
  const operations = [];
  let locked = false;
  const database = createDatabase({
    url: "mysql://ppt:secret@127.0.0.1:3306/ppt_ai_app",
    collections: ["generation_tasks"],
    mysqlConnector: async () => ({
      query: async (sql, params) => {
        operations.push(["query", sql, params]);
        if (sql.startsWith("CREATE")) return [[]];
        if (sql.startsWith("SELECT id")) return [[]];
        if (sql.startsWith("SELECT GET_LOCK")) {
          if (locked) return [[{ acquired: 0 }]];
          locked = true;
          return [[{ acquired: 1 }]];
        }
        if (sql.startsWith("SELECT RELEASE_LOCK")) {
          locked = false;
          return [[{ released: 1 }]];
        }
        return [[]];
      },
      execute: async () => [[]],
      end: async () => {},
    }),
  });

  await database.initialize();
  const first = await database.acquireLock("ppt-generation:7:outline-1");
  const second = await database.acquireLock("ppt-generation:7:outline-1");
  await first.release();
  const third = await database.acquireLock("ppt-generation:7:outline-1");

  assert.ok(first);
  assert.equal(second, null);
  assert.ok(third);
  assert.equal(operations.some(([, sql]) => sql.startsWith("SELECT GET_LOCK")), true);
  assert.equal(operations.some(([, sql]) => sql.startsWith("SELECT RELEASE_LOCK")), true);
});

test("createStorage uploads official template files to S3-compatible object storage when configured", async () => {
  const requests = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(200);
      response.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    const database = createDatabase({
      url: `json:${path.join(tempDir, "db.json")}`,
      collections: ["files", "storage_objects"],
    });
    await database.initialize();
    const storage = createStorage({
      config: {
        directory: path.join(tempDir, "storage"),
        endpoint,
        bucket: "ppt-templates",
        accessKeyId: "minio-access",
        secretAccessKey: "minio-secret",
      },
      database,
    });

    await storage.upload({
      ownerUserId: 0,
      fileName: "business-blue-source.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      content: Buffer.from("pptx"),
      fileRole: "official_template_source",
      visibility: "official",
      templateSlug: "business-blue",
      storageKey: "official-templates/business-blue/hash-source.pptx",
    });

    const [request] = requests;
    const [object] = await database.find("storage_objects");
    assert.equal(request.method, "PUT");
    assert.equal(request.url, "/ppt-templates/official-templates/business-blue/hash-source.pptx");
    assert.match(request.authorization, /^AWS4-HMAC-SHA256 /);
    assert.equal(request.body, "pptx");
    assert.equal(object.visibility, "official");
    assert.equal(object.templateSlug, "business-blue");
  } finally {
    server.close();
  }
});
