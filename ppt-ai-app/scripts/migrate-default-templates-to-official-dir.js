import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_TEMPLATE_CATEGORIES, DEFAULT_TEMPLATES } from "../src/templates.js";

const rootDir = resolveOfficialTemplatesDir();
const categoryNames = new Map(DEFAULT_TEMPLATE_CATEGORIES.map((category) => [category.id, category.name]));
const categoryOrders = new Map(DEFAULT_TEMPLATE_CATEGORIES.map((category) => [category.id, category.sortOrder]));

let written = 0;

for (const template of DEFAULT_TEMPLATES) {
  const categoryId = template.categoryId || "business";
  const templateSlug = toSlug(template.id || template.name);
  const themes = Array.isArray(template.themes) && template.themes.length
    ? template.themes
    : [{ id: "default", name: "默认风格", visual: template.visual || {} }];

  for (const theme of themes) {
    const themeSlug = toSlug(theme.id || theme.name);
    const slug = `${categoryId}-${templateSlug}-${themeSlug}`;
    const dir = path.join(rootDir, categoryId, templateSlug, themeSlug);
    const visual = { ...(template.visual || {}), ...(theme.visual || {}) };

    await fs.mkdir(path.join(dir, "assets"), { recursive: true });
    await writeJson(path.join(dir, "manifest.json"), {
      slug,
      name: `${template.name} - ${theme.name || theme.id}`,
      description: template.description || "",
      category_slug: categoryId,
      category_name: categoryNames.get(categoryId) || categoryId,
      category_sort_order: Number(categoryOrders.get(categoryId) ?? 100),
      status: template.status || "active",
      tags: normalizeTags([categoryId, templateSlug, themeSlug, template.style]),
      template_file: "template.json",
      renderer_file: "renderer.js",
    });
    await writeJson(path.join(dir, "template.json"), {
      baseTemplateId: template.id,
      themeId: theme.id,
      style: template.style || "",
      themes: [{ id: theme.id, name: theme.name || theme.id, visual }],
      visual,
      layoutSchema: template.layoutSchema,
    });
    await fs.writeFile(path.join(dir, "renderer.js"), buildRendererSource({ template, theme, visual }), "utf8");
    written += 1;
  }
}

console.log(JSON.stringify({ rootDir, written }, null, 2));

function buildRendererSource({ template, theme, visual }) {
  const payload = {
    templateId: template.id,
    templateName: template.name,
    themeId: theme.id,
    themeName: theme.name,
    style: template.style || "",
    visual,
    layoutSchema: template.layoutSchema,
  };
  return [
    "/**",
    " * 官方代码模板渲染入口。",
    " * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；",
    " * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。",
    " */",
    `export const templateRenderer = ${JSON.stringify(payload, null, 2)};`,
    "",
    "/**",
    " * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。",
    " * @returns {object}",
    " */",
    "export function getTemplateVisual() {",
    "  return templateRenderer.visual;",
    "}",
    "",
  ].join("\n");
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeTags(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function toSlug(value) {
  return String(value || "template")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "template";
}

function resolveOfficialTemplatesDir() {
  if (process.env.OFFICIAL_TEMPLATES_DIR) return path.resolve(process.env.OFFICIAL_TEMPLATES_DIR);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/official");
}
