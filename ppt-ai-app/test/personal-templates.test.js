import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { createApp } from "../src/app.js";
import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { PersonalTemplateService } from "../src/personal-template-service.js";
import { PptExportService } from "../src/ppt-exporter.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-personal-templates-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("PersonalTemplateService creates an owner-visible personal template from PPTX without a vision model", async () => {
  const context = await createContext();
  const pptx = samplePptx({
    templateId: "business",
    templateName: "Blue Source",
    templateVisual: { primary: "123456", accent: "ABCDEF", background: "F8FAFC", surface: "FFFFFF", title: "111111", body: "222222", layout: "top-band" },
  });

  const template = await context.service.createFromPptx({
    ownerUserId: 7,
    fileName: "blue-source.pptx",
    content: pptx,
    name: "Blue Personal",
  });
  const ownerTemplates = context.templateManager.listTemplates({ ownerUserId: 7, categoryId: "personal" });
  const otherUserTemplates = context.templateManager.listTemplates({ ownerUserId: 8, categoryId: "personal" });

  assert.equal(template.scope, "user");
  assert.equal(template.ownerUserId, 7);
  assert.equal(template.categoryId, "personal");
  assert.equal(template.visual.primary, "123456");
  assert.equal(template.templateJson?.themes[0].id, "default");
  assert.equal(template.templateJson?.layoutSchema.allowedLayouts.includes("title-content"), true);
  assert.equal(template.templateJson?.fonts.includes("Arial"), true);
  assert.equal(template.templateJson?.placeholders.some((item) => item.type === "title"), true);
  assert.equal(ownerTemplates.some((item) => item.id === template.id), true);
  assert.equal(otherUserTemplates.some((item) => item.id === template.id), false);
});

test("PersonalTemplateService recovers when personal category already exists outside the in-memory cache", async () => {
  const database = createStalePersonalCategoryDatabase();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "stale-storage"), database });
  const service = new PersonalTemplateService({ database, storage });

  const template = await service.createFromPptx({
    ownerUserId: 7,
    fileName: "stale-category.pptx",
    content: samplePptx(),
    name: "Stale Category",
  });

  assert.equal(template.categoryId, "personal");
  assert.equal(database.reloads, 1);
  assert.equal(database.state.template_categories.some((category) => category.id === "personal"), true);
});

test("PersonalTemplateService validates PPTX file type and size before parsing", async () => {
  const context = await createContext();

  await assert.rejects(
    () => context.service.createFromPptx({
      ownerUserId: 7,
      fileName: "not-ppt.txt",
      content: Buffer.from("text"),
      name: "Wrong Type",
    }),
    { code: "PPTX_FILE_REQUIRED" },
  );
  await assert.rejects(
    () => context.service.createFromPptx({
      ownerUserId: 7,
      fileName: "too-large.pptx",
      content: Buffer.alloc(20 * 1024 * 1024 + 1),
      name: "Too Large",
    }),
    { code: "PPTX_FILE_TOO_LARGE" },
  );
});

test("PersonalTemplateService enforces a 20 active personal template quota and delete releases one slot", async () => {
  const context = await createContext();
  const pptx = samplePptx();

  for (let index = 1; index <= 20; index += 1) {
    await context.service.createFromPptx({
      ownerUserId: 7,
      fileName: `template-${index}.pptx`,
      content: pptx,
      name: `Template ${index}`,
    });
  }
  await assert.rejects(
    () => context.service.createFromPptx({
      ownerUserId: 7,
      fileName: "template-21.pptx",
      content: pptx,
      name: "Template 21",
    }),
    { code: "PERSONAL_TEMPLATE_QUOTA_EXCEEDED" },
  );

  const [first] = context.templateManager.listTemplates({ ownerUserId: 7, categoryId: "personal" });
  await context.service.deleteTemplate({ ownerUserId: 7, templateId: first.id });
  const created = await context.service.createFromPptx({
    ownerUserId: 7,
    fileName: "template-after-delete.pptx",
    content: pptx,
    name: "Template After Delete",
  });

  assert.equal(created.status, "active");
  assert.equal(context.templateManager.listTemplates({ ownerUserId: 7, categoryId: "personal" }).length, 20);
});

test("PersonalTemplateService rejects macro-enabled and embedded-object PPTX packages", async () => {
  const context = await createContext();
  const pptx = samplePptx();

  await assert.rejects(
    () => context.service.createFromPptx({
      ownerUserId: 7,
      fileName: "macro.pptx",
      content: appendZipFile(pptx, "ppt/vbaProject.bin", "macro"),
      name: "Macro",
    }),
    { code: "PPTX_UNSAFE_CONTENT" },
  );
  await assert.rejects(
    () => context.service.createFromPptx({
      ownerUserId: 7,
      fileName: "embedded.pptx",
      content: appendZipFile(pptx, "ppt/embeddings/oleObject1.bin", "ole"),
      name: "Embedded",
    }),
    { code: "PPTX_UNSAFE_CONTENT" },
  );
});

test("PersonalTemplateService extracts a package thumbnail when one is available", async () => {
  const context = await createContext();
  const thumbnail = Buffer.from("thumbnail-png");
  const template = await context.service.createFromPptx({
    ownerUserId: 7,
    fileName: "with-thumbnail.pptx",
    content: appendZipFile(samplePptx(), "docProps/thumbnail.png", thumbnail),
    name: "With Thumbnail",
  });
  const downloaded = await context.storage.download({ ownerUserId: 7, fileId: template.thumbnailFileId });

  assert.equal(downloaded.content.toString("utf8"), "thumbnail-png");
});

test("HTTP API creates and deletes owner-scoped personal templates", async () => {
  const context = await createContext();
  const app = createApp({
    database: context.database,
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    molingClient: { verifyLaunchTicket: async () => ({ user_id: 7, app_id: 15, product_id: 73 }) },
    storage: context.storage,
    taskCenter: { createTask() {}, getTask() {} },
    templateManager: context.templateManager,
    personalTemplateService: context.service,
    aiProvider: {},
    sessionCookieName: "sid",
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;
  try {
    const session = await context.database.insert("sessions", {
      id: "personal-template-session",
      identity: { user_id: 7, app_id: 15, product_id: 73 },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const cookie = `sid=${session.id}`;
    const uploadedPptx = appendZipFile(samplePptx(), "ppt/media/large-note.txt", "x".repeat(1_100_000));
    const create = await fetch(`${baseUrl}/api/templates/personal`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: "uploaded.pptx",
        name: "Uploaded Personal",
        content_base64: uploadedPptx.toString("base64"),
      }),
    });
    const createBody = await create.json();
    const listed = await fetch(`${baseUrl}/api/templates?category_id=personal`, { headers: { cookie } });
    const listedBody = await listed.json();
    const remove = await fetch(`${baseUrl}/api/templates/${createBody.template.id}`, { method: "DELETE", headers: { cookie } });
    const afterDelete = await fetch(`${baseUrl}/api/templates?category_id=personal`, { headers: { cookie } });
    const afterDeleteBody = await afterDelete.json();

    assert.equal(create.status, 201);
    assert.equal(createBody.template.scope, "user");
    assert.equal(listedBody.templates.some((template) => template.id === createBody.template.id), true);
    assert.equal(remove.status, 200);
    assert.equal(afterDeleteBody.templates.some((template) => template.id === createBody.template.id), false);
  } finally {
    await new Promise((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
  }
});

async function createContext() {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["sessions", "files", "templates", "template_categories", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  const templateManager = new TemplateManager({ database });
  const service = new PersonalTemplateService({ database, storage });
  return { database, storage, templateManager, service };
}

function samplePptx(overrides = {}) {
  return new PptExportService().exportDeck({
    format: "pptx",
    deck: {
      title: "Source Deck",
      templateId: overrides.templateId || "business",
      templateName: overrides.templateName || "Business",
      templateVisual: overrides.templateVisual || undefined,
      slides: [
        { title: "Cover", bullets: ["First point"], layout: "title" },
        { title: "Content", bullets: ["Second point"], layout: "content" },
      ],
    },
  }).content;
}

function appendZipFile(zipBuffer, fileName, content) {
  const centralStart = zipBuffer.indexOf(Buffer.from("PK\u0001\u0002", "binary"));
  const beforeCentral = zipBuffer.subarray(0, centralStart);
  const centralAndEnd = zipBuffer.subarray(centralStart);
  const name = Buffer.from(fileName, "utf8");
  const body = Buffer.from(content, "utf8");
  const local = Buffer.alloc(30 + name.length + body.length);
  let offset = 0;
  local.writeUInt32LE(0x04034b50, offset); offset += 4;
  local.writeUInt16LE(20, offset); offset += 2;
  local.writeUInt16LE(0, offset); offset += 2;
  local.writeUInt16LE(0, offset); offset += 2;
  local.writeUInt16LE(0, offset); offset += 2;
  local.writeUInt16LE(0, offset); offset += 2;
  local.writeUInt32LE(0, offset); offset += 4;
  local.writeUInt32LE(body.length, offset); offset += 4;
  local.writeUInt32LE(body.length, offset); offset += 4;
  local.writeUInt16LE(name.length, offset); offset += 2;
  local.writeUInt16LE(0, offset); offset += 2;
  name.copy(local, offset); offset += name.length;
  body.copy(local, offset);
  return Buffer.concat([beforeCentral, local, centralAndEnd]);
}

function createStalePersonalCategoryDatabase() {
  return {
    reloads: 0,
    state: {
      files: [],
      templates: [],
      template_categories: [],
      storage_objects: [],
    },
    async find(collection, predicate = () => true) {
      return this.state[collection].filter(predicate);
    },
    async findOne(collection, predicate) {
      return (await this.find(collection, predicate))[0] || null;
    },
    async insert(collection, record) {
      if (collection === "template_categories" && record.id === "personal") {
        const error = new Error("Duplicate entry 'personal' for key 'PRIMARY'");
        error.code = "ER_DUP_ENTRY";
        error.errno = 1062;
        throw error;
      }
      const stored = { id: record.id || `${collection}-${this.state[collection].length + 1}`, ...record };
      this.state[collection].push(stored);
      return stored;
    },
    async update(collection, id, changes) {
      const index = this.state[collection].findIndex((record) => record.id === id);
      assert.notEqual(index, -1);
      this.state[collection][index] = { ...this.state[collection][index], ...changes };
      return this.state[collection][index];
    },
    async reloadCollection(collection) {
      this.reloads += 1;
      if (collection === "template_categories") {
        this.state.template_categories = [{ id: "personal", name: "Personal", sortOrder: 90, scope: "user", status: "active" }];
      }
      return this.state[collection];
    },
  };
}
