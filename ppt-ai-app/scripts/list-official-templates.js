import fs from "node:fs/promises";
import path from "node:path";

import { fileURLToPath } from "node:url";

const rootDir = resolveOfficialTemplatesDir();
const asJson = process.argv.includes("--json");

let hasError = false;

try {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(rootDir, entry.name);
    const manifestPath = path.join(dir, "manifest.json");
    if (!(await safeExists(manifestPath))) continue;

    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const slug = manifest.slug || entry.name;
      const status = manifest.status || "active";
      const templatePath = path.join(dir, manifest.template_file || "template.json");
      const sourceFile = path.join(dir, manifest.source_file || "source.pptx");
      const thumbFile = path.join(dir, manifest.thumbnail_file || "thumbnail.png");

      const [templateData, sourceExists, thumbExists] = await Promise.all([
        safeReadJson(templatePath),
        safeExists(sourceFile),
        safeExists(thumbFile),
      ]);

      const sourceInfo = templateData?.source || {};
      const validFiles = sourceExists && thumbExists && Boolean(templateData);
      const isUsable = validFiles && manifest.status === "active";

      templates.push({
        slug: String(slug),
        name: manifest.name || slug,
        status: validFiles ? status : "invalid",
        category: manifest.category_slug || "uncategorized",
        themes: templateData?.themes?.length || 0,
        layout: templateData?.visual?.layout || "top-band",
        source_file_exists: sourceExists,
        template_file_exists: Boolean(templateData),
        thumbnail_file_exists: thumbExists,
        usable: isUsable,
        source_repository: sourceInfo.repository || "N/A",
        source_file: sourceInfo.file || manifest.source_file || "source.pptx",
        source_license: sourceInfo.license || "N/A",
        source_commit: sourceInfo.commit || "N/A",
      });
    } catch (error) {
      hasError = true;
      templates.push({
        slug: entry.name,
        name: "INVALID",
        status: "invalid",
        category: "invalid",
        themes: 0,
        layout: "invalid",
        source_file_exists: false,
        template_file_exists: false,
        thumbnail_file_exists: false,
        source_repository: "N/A",
        source_file: "N/A",
        source_license: "N/A",
        source_commit: "N/A",
        error: String(error?.message || error),
      });
    }
  }

  templates.sort((a, b) => a.slug.localeCompare(b.slug));
  console.log(asJson ? JSON.stringify(templates, null, 2) : formatTemplates(templates));
  process.exit(hasError ? 1 : 0);
} catch (error) {
  console.error("FAILED_TO_SCAN_TEMPLATES", error?.message || error);
  process.exit(1);
}

async function safeReadJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function safeExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatTemplates(templates) {
  const usableCount = templates.filter((item) => item.status === "active" && item.usable).length;
  const invalidCount = templates.length - usableCount;
  const rows = templates.map((item) => {
    const state = item.status === "active" && item.usable ? "✓" : "×";
      return [
      item.usable ? "usable" : "skip",
      state,
      item.slug,
      item.name,
      item.category,
      `layout=${item.layout}`,
      `themes=${item.themes}`,
      `files=${item.source_file_exists ? "S" : "s"}${item.template_file_exists ? "T" : "t"}${item.thumbnail_file_exists ? "P" : "p"}`,
      `license=${item.source_license}`,
      item.source_repository,
    ].join(" | ");
  });

  const head = [
    `可用: ${usableCount}/${templates.length} (status=active + 三文件齐全), 不可用: ${invalidCount}`,
    "usable | state | slug | name | category | layout/themes | files(STP) | license | repo",
    "-------|-------|------|------|----------|--------------|----------|---------|----",
  ];
  return [head.join("\n"), ...rows].join("\n");
}

function resolveOfficialTemplatesDir() {
  if (process.env.OFFICIAL_TEMPLATES_DIR) return path.resolve(process.env.OFFICIAL_TEMPLATES_DIR);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/official");
}
