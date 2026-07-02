import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import { JsonFileDatabase } from "../src/database.js";
import { LocalFileStorage } from "../src/files.js";
import { syncOfficialTemplateCategories, syncOfficialTemplates } from "../src/official-templates.js";
import { TemplateManager } from "../src/templates.js";

let tempDir;
const repoOfficialTemplatesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/official");

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ppt-official-templates-"));
});

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("syncOfficialTemplateCategories upserts category seed records", async () => {
  const rootDir = path.join(tempDir, "templates", "official");
  await mkdir(rootDir, { recursive: true });
  await writeFile(path.join(rootDir, "categories.json"), JSON.stringify([
    { id: "business-report", name: "Business Report", sortOrder: 10 },
  ], null, 2));
  const context = await createSyncContext();

  const first = await syncOfficialTemplateCategories({ rootDir, database: context.database });
  await writeFile(path.join(rootDir, "categories.json"), JSON.stringify([
    { id: "business-report", name: "Business Report Updated", sortOrder: 5 },
  ], null, 2));
  const second = await syncOfficialTemplateCategories({ rootDir, database: context.database });
  const categories = await context.database.find("template_categories");

  assert.deepEqual(first, { checked: 1, upserted: 1 });
  assert.deepEqual(second, { checked: 1, upserted: 1 });
  assert.equal(categories.length, 1);
  assert.equal(categories[0].id, "business-report");
  assert.equal(categories[0].name, "Business Report Updated");
  assert.equal(categories[0].sortOrder, 5);
});

test("syncOfficialTemplates upserts active official templates by slug and uploads files", async () => {
  const rootDir = path.join(tempDir, "templates", "official");
  await writeOfficialTemplate(rootDir, "business-blue", {
    manifest: {
      slug: "business-blue",
      name: "Business Blue",
      description: "Blue report",
      category_slug: "business-report",
      status: "active",
      tags: ["business", "blue"],
      source_file: "source.pptx",
      thumbnail_file: "thumbnail.png",
      template_file: "template.json",
    },
    template: {
      themes: [{ id: "modern", name: "Modern" }],
      visual: { primary: "123456", accent: "ABCDEF", background: "FFFFFF", surface: "FFFFFF", title: "111111", body: "222222", layout: "top-band" },
      layoutSchema: { defaultCoverLayout: "title", defaultContentLayout: "content", allowedLayouts: ["title", "content"] },
    },
  });
  await writeOfficialTemplate(rootDir, "disabled-red", {
    manifest: {
      slug: "disabled-red",
      name: "Disabled Red",
      description: "Hidden report",
      category_slug: "business-report",
      status: "disabled",
      tags: ["hidden"],
      source_file: "source.pptx",
      thumbnail_file: "thumbnail.png",
      template_file: "template.json",
    },
    template: {
      themes: [{ id: "classic", name: "Classic" }],
      visual: { primary: "AA0000", accent: "BB0000", background: "FFFFFF", surface: "FFFFFF", title: "111111", body: "222222", layout: "top-band" },
      layoutSchema: { defaultCoverLayout: "title", defaultContentLayout: "content", allowedLayouts: ["title", "content"] },
    },
  });
  const context = await createSyncContext();

  const result = await syncOfficialTemplates({
    rootDir,
    database: context.database,
    storage: context.storage,
  });
  const templates = await context.database.find("templates");
  const objects = await context.database.find("storage_objects", (object) => object.visibility === "official");
  const visible = new TemplateManager({ database: context.database }).listTemplates({ ownerUserId: 7, categoryId: "business-report" });

  assert.deepEqual(result, { checked: 2, upserted: 2, active: 1, disabled: 1 });
  assert.equal(templates.length, 2);
  assert.deepEqual(visible.map((template) => template.id), ["business-blue"]);
  assert.equal(visible[0].scope, "official");
  assert.equal(visible[0].status, "active");
  assert.equal(visible[0].visual.primary, "123456");
  assert.equal(objects.length, 6);
  assert.equal(objects.some((object) => object.fileRole === "official_template_source" && object.templateSlug === "business-blue"), true);
  assert.equal(objects.some((object) => object.fileRole === "official_template_thumbnail" && object.templateSlug === "business-blue"), true);
  assert.equal(objects.some((object) => object.fileRole === "official_template_definition" && object.templateSlug === "business-blue"), true);
  assert.equal(
    objects.some((object) => object.templateSlug === "business-blue" && object.storageKey === "official-templates/business-blue/5b3185613eeb8b6ec9959f380495a21b-source.pptx"),
    true,
  );
});

test("syncOfficialTemplates updates an existing slug without changing the template id", async () => {
  const rootDir = path.join(tempDir, "templates", "official");
  await writeOfficialTemplate(rootDir, "business-blue", {
    manifest: {
      slug: "business-blue",
      name: "Business Blue",
      description: "Blue report",
      category_slug: "business-report",
      status: "active",
      tags: ["business"],
      source_file: "source.pptx",
      thumbnail_file: "thumbnail.png",
      template_file: "template.json",
    },
    template: { themes: [{ id: "modern", name: "Modern" }] },
  });
  const context = await createSyncContext();
  await syncOfficialTemplates({ rootDir, database: context.database, storage: context.storage });
  const before = await context.database.findOne("templates", (template) => template.slug === "business-blue");

  await writeOfficialTemplate(rootDir, "business-blue", {
    manifest: {
      slug: "business-blue",
      name: "Business Blue Updated",
      description: "Updated report",
      category_slug: "business-report",
      status: "disabled",
      tags: ["updated"],
      source_file: "source.pptx",
      thumbnail_file: "thumbnail.png",
      template_file: "template.json",
    },
    template: { themes: [{ id: "executive", name: "Executive" }] },
  });
  await syncOfficialTemplates({ rootDir, database: context.database, storage: context.storage });
  const after = await context.database.findOne("templates", (template) => template.slug === "business-blue");
  const visible = new TemplateManager({ database: context.database }).listTemplates({ ownerUserId: 7, categoryId: "business-report" });

  assert.equal(after.id, before.id);
  assert.equal(after.name, "Business Blue Updated");
  assert.equal(after.status, "disabled");
  assert.equal(after.description, "Updated report");
  assert.deepEqual(after.themes, [{ id: "executive", name: "Executive" }]);
  assert.deepEqual(visible.map((template) => template.id), []);
});

test("syncOfficialTemplates rejects invalid manifests before writing database records", async () => {
  const rootDir = path.join(tempDir, "templates", "official");
  await mkdir(path.join(rootDir, "bad-template"), { recursive: true });
  await writeFile(path.join(rootDir, "bad-template", "manifest.json"), JSON.stringify({
    slug: "wrong-slug",
    name: "Bad",
    category_slug: "business-report",
    status: "active",
    source_file: "source.pptx",
    thumbnail_file: "thumbnail.png",
    template_file: "template.json",
  }, null, 2));
  const context = await createSyncContext();

  await assert.rejects(
    () => syncOfficialTemplates({ rootDir, database: context.database, storage: context.storage }),
    { code: "OFFICIAL_TEMPLATE_MANIFEST_INVALID" },
  );
  assert.deepEqual(await context.database.find("templates"), []);
});

test("repository official templates do not include removed open-source samples", async () => {
  const context = await createSyncContext();

  const result = await syncOfficialTemplates({
    rootDir: repoOfficialTemplatesRoot,
    database: context.database,
    storage: context.storage,
  });
  const visible = new TemplateManager({ database: context.database }).listTemplates({ ownerUserId: 7 });

  assert.equal(result.active >= 0, true);
  assert.equal(visible.some((template) => template.id === "open-city-template"), false);
  assert.equal(visible.some((template) => template.id === "open-powerpoint-sample"), false);
  assert.equal((await context.database.findOne("templates", (template) => template.id === "open-city-template")), null);
  assert.equal((await context.database.findOne("templates", (template) => template.id === "open-powerpoint-sample")), null);
});

async function createSyncContext() {
  const database = new JsonFileDatabase({
    filePath: path.join(tempDir, "db.json"),
    collections: ["files", "templates", "template_categories", "storage_objects"],
  });
  await database.initialize();
  const storage = new LocalFileStorage({ storageDir: path.join(tempDir, "storage"), database });
  return { database, storage };
}

async function writeOfficialTemplate(rootDir, slug, { manifest, template }) {
  const dir = path.join(rootDir, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(path.join(dir, "source.pptx"), Buffer.from(`pptx:${slug}`));
  await writeFile(path.join(dir, "thumbnail.png"), Buffer.from(`png:${slug}`));
  await writeFile(path.join(dir, "template.json"), JSON.stringify(template, null, 2));
}
