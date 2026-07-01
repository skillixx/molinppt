import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { AppError } from "./errors.js";

const MANIFEST_FILE = "manifest.json";
const CATEGORY_SEED_FILE = "categories.json";
const ACTIVE_STATUS = "active";
const DISABLED_STATUS = "disabled";
const OFFICIAL_OWNER_USER_ID = 0;

const SOURCE_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const THUMBNAIL_MIME_TYPE = "image/png";
const TEMPLATE_MIME_TYPE = "application/json";

const DEFAULT_THEMES = [{ id: "modern", name: "Modern" }];
const DEFAULT_VISUAL = {
  primary: "2563EB",
  accent: "16A34A",
  background: "F8FAFC",
  surface: "FFFFFF",
  title: "0F172A",
  body: "334155",
  layout: "top-band",
};
const DEFAULT_LAYOUT_SCHEMA = {
  defaultCoverLayout: "title",
  defaultContentLayout: "content",
  allowedLayouts: ["title", "content"],
};

/**
 * Syncs official template category seeds from templates/official/categories.json.
 * @param {{rootDir: string, database: import("./database.js").JsonFileDatabase}} input
 * @returns {Promise<{checked: number, upserted: number}>}
 */
export async function syncOfficialTemplateCategories({ rootDir, database }) {
  const seedPath = path.join(rootDir, CATEGORY_SEED_FILE);
  if (!(await exists(seedPath))) return { checked: 0, upserted: 0 };
  const payload = await readJson(seedPath, "OFFICIAL_TEMPLATE_CATEGORY_SEED_INVALID");
  const categories = Array.isArray(payload) ? payload : payload.categories;
  if (!Array.isArray(categories)) {
    throw invalidCategorySeed("categories.json must be an array or contain a categories array");
  }

  let upserted = 0;
  for (const category of categories) {
    validateCategorySeed(category);
    await upsertById(database, "template_categories", category.id, {
      id: category.id,
      name: category.name,
      sortOrder: Number(category.sortOrder ?? 100),
      scope: "official",
      status: category.status || ACTIVE_STATUS,
    });
    upserted += 1;
  }
  return { checked: categories.length, upserted };
}

/**
 * Syncs templates/official/{slug} manifests into the template catalog.
 * @param {{rootDir: string, database: import("./database.js").JsonFileDatabase, storage: import("./files.js").LocalFileStorage}} input
 * @returns {Promise<{checked: number, upserted: number, active: number, disabled: number}>}
 */
export async function syncOfficialTemplates({ rootDir, database, storage }) {
  const slugs = await findTemplateSlugs(rootDir);
  let upserted = 0;
  let active = 0;
  let disabled = 0;

  for (const slug of slugs) {
    const dir = path.join(rootDir, slug);
    const manifestPath = path.join(dir, MANIFEST_FILE);
    const manifest = await readJson(manifestPath, "OFFICIAL_TEMPLATE_MANIFEST_INVALID");
    await validateManifest({ manifest, slug, dir });
    const templateDefinition = await readJson(path.join(dir, manifest.template_file), "OFFICIAL_TEMPLATE_MANIFEST_INVALID");
    const source = await uploadOfficialFile({
      storage,
      dir,
      slug,
      fileName: manifest.source_file,
      mimeType: SOURCE_MIME_TYPE,
      fileRole: "official_template_source",
    });
    const thumbnail = await uploadOfficialFile({
      storage,
      dir,
      slug,
      fileName: manifest.thumbnail_file,
      mimeType: THUMBNAIL_MIME_TYPE,
      fileRole: "official_template_thumbnail",
    });
    const definition = await uploadOfficialFile({
      storage,
      dir,
      slug,
      fileName: manifest.template_file,
      mimeType: TEMPLATE_MIME_TYPE,
      fileRole: "official_template_definition",
    });

    await upsertById(database, "template_categories", manifest.category_slug, {
      id: manifest.category_slug,
      name: manifest.category_name || manifest.category_slug,
      sortOrder: Number(manifest.category_sort_order ?? 100),
      scope: "official",
      status: ACTIVE_STATUS,
    });
    await upsertTemplateBySlug(database, {
      id: slug,
      slug,
      name: manifest.name,
      description: manifest.description || "",
      categoryId: manifest.category_slug,
      categorySlug: manifest.category_slug,
      scope: "official",
      status: manifest.status,
      tags: normalizeStringArray(manifest.tags),
      themes: normalizeThemes(templateDefinition.themes || manifest.themes),
      visual: { ...DEFAULT_VISUAL, ...(templateDefinition.visual || {}) },
      layoutSchema: { ...DEFAULT_LAYOUT_SCHEMA, ...(templateDefinition.layoutSchema || {}) },
      sourceFileId: source.file.id,
      thumbnailFileId: thumbnail.file.id,
      templateFileId: definition.file.id,
      sourceMd5: source.md5,
      thumbnailMd5: thumbnail.md5,
      templateMd5: definition.md5,
      official: true,
      ownerUserId: null,
    });
    upserted += 1;
    if (manifest.status === ACTIVE_STATUS) active += 1;
    if (manifest.status === DISABLED_STATUS) disabled += 1;
  }

  return { checked: slugs.length, upserted, active, disabled };
}

async function findTemplateSlugs(rootDir) {
  if (!(await exists(rootDir))) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function uploadOfficialFile({ storage, dir, slug, fileName, mimeType, fileRole }) {
  const content = await readFile(path.join(dir, fileName));
  const md5 = createHash("md5").update(content).digest("hex");
  return {
    file: await storage.upload({
      ownerUserId: OFFICIAL_OWNER_USER_ID,
      fileName: `${slug}-${fileName}`,
      mimeType,
      content,
      fileRole,
      visibility: "official",
      templateSlug: slug,
      storageKey: `official-templates/${slug}/${md5}-${fileName}`,
    }),
    md5,
  };
}

async function upsertTemplateBySlug(database, record) {
  const existing = await database.findOne("templates", (template) => template.slug === record.slug || (template.scope === "official" && template.id === record.slug));
  if (existing) return database.update("templates", existing.id, { ...record, id: existing.id });
  return database.insert("templates", record);
}

async function upsertById(database, collection, id, record) {
  const existing = await database.findOne(collection, (item) => item.id === id);
  if (existing) return database.update(collection, id, record);
  return database.insert(collection, record);
}

async function validateManifest({ manifest, slug, dir }) {
  for (const field of ["slug", "name", "category_slug", "status", "source_file", "thumbnail_file", "template_file"]) {
    if (!manifest[field] || typeof manifest[field] !== "string") {
      throw invalidManifest(`manifest.${field} is required`);
    }
  }
  if (manifest.slug !== slug) throw invalidManifest("manifest.slug must match its directory name");
  if (![ACTIVE_STATUS, DISABLED_STATUS].includes(manifest.status)) {
    throw invalidManifest("manifest.status must be active or disabled");
  }
  await validateManifestFile({ dir, fileName: manifest.source_file, extension: ".pptx", field: "source_file" });
  await validateManifestFile({ dir, fileName: manifest.thumbnail_file, extension: ".png", field: "thumbnail_file" });
  await validateManifestFile({ dir, fileName: manifest.template_file, extension: ".json", field: "template_file" });
}

function validateManifestFile({ dir, fileName, extension, field }) {
  if (path.isAbsolute(fileName) || fileName.includes("..") || fileName !== path.basename(fileName)) {
    throw invalidManifest(`manifest.${field} must be a safe file name`);
  }
  if (path.extname(fileName).toLowerCase() !== extension) {
    throw invalidManifest(`manifest.${field} must be a ${extension} file`);
  }
  const fullPath = path.join(dir, fileName);
  return stat(fullPath).catch(() => {
    throw invalidManifest(`manifest.${field} file does not exist`);
  });
}

async function readJson(filePath, code) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new AppError({ code, status: 400, message: `Invalid JSON file: ${path.basename(filePath)}`, details: error });
  }
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateCategorySeed(category) {
  if (!category || typeof category !== "object") throw invalidCategorySeed("category must be an object");
  if (!category.id || typeof category.id !== "string") throw invalidCategorySeed("category.id is required");
  if (!category.name || typeof category.name !== "string") throw invalidCategorySeed("category.name is required");
}

function normalizeThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return DEFAULT_THEMES;
  const normalized = themes
    .filter((theme) => theme && typeof theme.id === "string" && typeof theme.name === "string")
    .map((theme) => ({ id: theme.id, name: theme.name }));
  return normalized.length > 0 ? normalized : DEFAULT_THEMES;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === "string");
}

function invalidManifest(message) {
  return new AppError({ code: "OFFICIAL_TEMPLATE_MANIFEST_INVALID", status: 400, message });
}

function invalidCategorySeed(message) {
  return new AppError({ code: "OFFICIAL_TEMPLATE_CATEGORY_SEED_INVALID", status: 400, message });
}
