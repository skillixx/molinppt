import { AppError } from "./errors.js";

/**
 * Built-in template categories used by the local template catalog.
 */
export const DEFAULT_TEMPLATE_CATEGORIES = [
  { id: "business", name: "商业汇报", sortOrder: 10 },
  { id: "strategy", name: "战略咨询", sortOrder: 20 },
  { id: "finance", name: "财务经营", sortOrder: 30 },
  { id: "sales", name: "销售方案", sortOrder: 40 },
  { id: "product", name: "产品规划", sortOrder: 50 },
  { id: "marketing", name: "市场营销", sortOrder: 60 },
  { id: "data", name: "数据洞察", sortOrder: 70 },
  { id: "education", name: "教育培训", sortOrder: 80 },
  { id: "pitch", name: "融资路演", sortOrder: 90 },
];

const EXECUTIVE_LAYOUT_SCHEMA = {
  defaultCoverLayout: "executive-cover",
  defaultContentLayout: "executive-content",
  allowedLayouts: ["executive-cover", "executive-content", "title", "content"],
};

const ACADEMY_LAYOUT_SCHEMA = {
  defaultCoverLayout: "academy-cover",
  defaultContentLayout: "academy-content",
  allowedLayouts: ["academy-cover", "academy-content", "lesson-title", "lesson-content"],
};

const VENTURE_LAYOUT_SCHEMA = {
  defaultCoverLayout: "venture-cover",
  defaultContentLayout: "venture-story",
  allowedLayouts: ["venture-cover", "venture-story", "hero", "story"],
};

const DOME_LAYOUT_SCHEMA = {
  defaultCoverLayout: "cover",
  defaultContentLayout: "image-report",
  allowedLayouts: [
    "cover",
    "agenda",
    "section-divider",
    "image-report",
    "three-steps",
    "four-steps",
    "metrics",
    "showcase",
    "retrospective",
    "next-plan",
    "closing",
    "title",
    "content",
  ],
};

/**
 * Built-in template catalog used when no external catalog is configured.
 */
export const DEFAULT_TEMPLATES = [
  {
    id: "business",
    name: "高管商务汇报",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "executive-report",
    description: "适合经营复盘、管理层汇报和董事会沟通的稳重商务模板。",
    themes: [
      {
        id: "minimal",
        name: "极简灰蓝",
        visual: {
          primary: "1E3A8A",
          accent: "6B7280",
          background: "E9EEF5",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "top-band",
        },
      },
      {
        id: "modern",
        name: "现代红金",
        visual: {
          primary: "B91C1C",
          accent: "D97706",
          background: "FFF1E6",
          surface: "FFFFFF",
          title: "3B0A0A",
          body: "5B3328",
          layout: "top-band",
        },
      },
      {
        id: "classic",
        name: "经典商务",
        visual: {
          primary: "1F2A37",
          accent: "B89B5E",
          background: "E8ECEF",
          surface: "FFFFFF",
          title: "111827",
          body: "374151",
          layout: "top-band",
        },
      },
      {
        id: "executive",
        name: "高管深蓝",
        visual: {
          primary: "102A43",
          accent: "BFA46A",
          background: "E6EDF5",
          surface: "FFFFFF",
          title: "0B1F33",
          body: "334155",
          layout: "top-band",
        },
      },
    ],
    visual: {
      primary: "B91C1C",
      accent: "D97706",
      background: "FFF1E6",
      surface: "FFFFFF",
      title: "3B0A0A",
      body: "5B3328",
      layout: "top-band",
    },
    layoutSchema: DOME_LAYOUT_SCHEMA,
  },
  {
    id: "strategy-consulting",
    name: "战略咨询方案",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "consulting-case",
    description: "适合问题诊断、方案对比和高层决策的咨询风格模板。",
    themes: [
      { id: "board", name: "董事会汇报" },
      { id: "matrix", name: "矩阵分析" },
      { id: "workstream", name: "工作流推进" },
    ],
    visual: {
      primary: "1B365D",
      accent: "B88746",
      background: "F1F4F8",
      surface: "FEFEFD",
      title: "111C2E",
      body: "465568",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
  {
    id: "financial-review",
    name: "财务经营复盘",
    categoryId: "finance",
    scope: "official",
    status: "active",
    style: "finance-report",
    description: "适合财务分析、经营指标和预算预测的专业复盘模板。",
    themes: [
      { id: "quarterly", name: "季度复盘" },
      { id: "audit", name: "审计分析" },
      { id: "forecast", name: "预测规划" },
    ],
    visual: {
      primary: "18344E",
      accent: "3B8C62",
      background: "F0F4F6",
      surface: "FCFEFD",
      title: "102639",
      body: "405163",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
  {
    id: "sales-proposal",
    name: "销售提案方案",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "proposal",
    description: "适合客户提案、价值阐述、解决方案和下一步计划展示。",
    themes: [
      { id: "enterprise", name: "企业客户" },
      { id: "solution", name: "解决方案" },
      { id: "renewal", name: "续约增长" },
    ],
    visual: {
      primary: "0E5A57",
      accent: "C79A45",
      background: "EEF7F6",
      surface: "FCFEFD",
      title: "143E3D",
      body: "3E5A58",
      layout: "academy",
    },
    layoutSchema: ACADEMY_LAYOUT_SCHEMA,
  },
  {
    id: "product-roadmap",
    name: "产品路线规划",
    categoryId: "product",
    scope: "official",
    status: "active",
    style: "product-planning",
    description: "适合产品战略、版本规划、优先级和路线图沟通。",
    themes: [
      { id: "roadmap", name: "路线图" },
      { id: "release", name: "版本发布" },
      { id: "product-review", name: "产品复盘" },
    ],
    visual: {
      primary: "245B68",
      accent: "D99A3D",
      background: "EDF6F8",
      surface: "FCFEFF",
      title: "173F49",
      body: "405A62",
      layout: "academy",
    },
    layoutSchema: ACADEMY_LAYOUT_SCHEMA,
  },
  {
    id: "marketing-campaign",
    name: "营销活动方案",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "campaign-story",
    description: "适合品牌定位、渠道策略、活动节奏和增长计划展示。",
    themes: [
      { id: "launch", name: "新品发布" },
      { id: "brand", name: "品牌传播" },
      { id: "growth", name: "增长营销" },
    ],
    visual: {
      primary: "27213F",
      accent: "D96C3B",
      background: "F4EFE9",
      surface: "FFFEFC",
      title: "211A32",
      body: "4D4658",
      layout: "venture",
    },
    layoutSchema: VENTURE_LAYOUT_SCHEMA,
  },
  {
    id: "data-insight",
    name: "数据洞察报告",
    categoryId: "data",
    scope: "official",
    status: "active",
    style: "analytics-report",
    description: "适合指标解读、数据发现、分析结论和行动建议。",
    themes: [
      { id: "insight", name: "洞察分析" },
      { id: "dashboard", name: "仪表盘" },
      { id: "research", name: "研究报告" },
    ],
    visual: {
      primary: "12324A",
      accent: "2BA6A0",
      background: "EEF5F7",
      surface: "FCFEFF",
      title: "10283A",
      body: "405564",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
  {
    id: "education",
    name: "教育培训课件",
    categoryId: "education",
    scope: "official",
    status: "active",
    style: "learning-workshop",
    description: "适合课程讲义、培训工作坊和知识分享的清晰课件模板。",
    themes: [
      { id: "lecture", name: "课堂讲授" },
      { id: "workshop", name: "互动工作坊" },
      { id: "minimal", name: "简洁教学" },
    ],
    visual: {
      primary: "0B5A63",
      accent: "D8A541",
      background: "EDF7F6",
      surface: "FCFEFD",
      title: "143D42",
      body: "3F5A61",
      layout: "academy",
    },
    layoutSchema: ACADEMY_LAYOUT_SCHEMA,
  },
  {
    id: "pitch",
    name: "创业融资路演",
    categoryId: "pitch",
    scope: "official",
    status: "active",
    style: "venture-story",
    description: "适合投资人沟通、创业项目介绍和商业计划书展示。",
    themes: [
      { id: "startup", name: "创业故事" },
      { id: "investor", name: "投资人版" },
      { id: "product", name: "产品亮点" },
    ],
    visual: {
      primary: "111827",
      accent: "D96C3B",
      background: "F4EFE8",
      surface: "FFFEFC",
      title: "111827",
      body: "3F4652",
      layout: "venture",
    },
    layoutSchema: VENTURE_LAYOUT_SCHEMA,
  },
  {
    id: "brand-story",
    name: "品牌故事叙事",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "brand-narrative",
    description: "适合品牌定位、信息架构、客户故事和传播叙事。",
    themes: [
      { id: "editorial", name: "编辑叙事" },
      { id: "premium", name: "高端质感" },
      { id: "identity", name: "品牌识别" },
    ],
    visual: {
      primary: "202636",
      accent: "BD7A3A",
      background: "F3EEE6",
      surface: "FFFEFB",
      title: "171D29",
      body: "4A5260",
      layout: "venture",
    },
    layoutSchema: VENTURE_LAYOUT_SCHEMA,
  },
  {
    id: "project-status",
    name: "项目状态汇报",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "status-update",
    description: "适合项目进展、风险依赖、里程碑和管理层周报。",
    themes: [
      { id: "weekly", name: "周报进展" },
      { id: "steering", name: "例会汇报" },
      { id: "delivery", name: "交付跟踪" },
    ],
    visual: {
      primary: "203F57",
      accent: "C7A03A",
      background: "EEF3F6",
      surface: "FCFEFF",
      title: "172B3B",
      body: "465866",
      layout: "executive",
    },
    layoutSchema: EXECUTIVE_LAYOUT_SCHEMA,
  },
];

const DEFAULT_VISUAL = DEFAULT_TEMPLATES[0].visual;

/**
 * Registry for PPT template metadata.
 */
export class TemplateManager {
  /**
   * Creates a template manager.
   * @param {{templates?: object[], categories?: object[], database?: object}} input
   */
  constructor({ templates = DEFAULT_TEMPLATES, categories = DEFAULT_TEMPLATE_CATEGORIES, database = null } = {}) {
    this.templates = templates;
    this.categories = categories;
    this.database = database;
  }

  /**
   * Lists all available templates.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  listTemplates({ ownerUserId, categoryId } = {}) {
    return this.#visibleTemplates({ ownerUserId, categoryId });
  }

  /**
   * Lists template categories that still have at least one visible template.
   * @param {{ownerUserId?: number}} input
   * @returns {object[]}
   */
  listCategories({ ownerUserId } = {}) {
    const usedCategoryIds = new Set(
      this.#rawVisibleTemplates({ ownerUserId }).map((template) => resolveCategoryId(template)),
    );
    return this.#allCategories()
      .filter((category) => usedCategoryIds.has(category.id))
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }

  /**
   * Returns one template by ID.
   * @param {string} templateId
   * @param {{ownerUserId?: number}} input
   * @returns {object}
   */
  getTemplate(templateId, { ownerUserId } = {}) {
    const template = this.#visibleTemplates({ ownerUserId }).find((item) => item.id === templateId);
    if (!template) throw new AppError({ code: "TEMPLATE_NOT_FOUND", status: 404, message: "Template not found" });
    return template;
  }

  /**
   * Returns visible official templates and the current user's active templates.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  #visibleTemplates({ ownerUserId, categoryId } = {}) {
    const categories = this.#allCategories();
    return dedupeById(this.#rawVisibleTemplates({ ownerUserId, categoryId })).map((template) => normalizeTemplate(template, categories));
  }

  /**
   * Returns visible template records before API normalization.
   * @param {{ownerUserId?: number, categoryId?: string}} input
   * @returns {object[]}
   */
  #rawVisibleTemplates({ ownerUserId, categoryId } = {}) {
    return [...this.templates, ...this.#databaseTemplates()].filter((template) => {
      const status = template.status || "active";
      const scope = template.scope || "official";
      if (status !== "active") return false;
      if (scope === "user" && Number(template.ownerUserId ?? template.owner_user_id) !== Number(ownerUserId)) return false;
      if (scope !== "official" && scope !== "user") return false;
      if (isOpenSourceTemplate(template)) return false;
      if (categoryId && resolveCategoryId(template) !== categoryId) return false;
      return true;
    });
  }

  /**
   * Reads template records from the JSON database when the collection exists.
   * @returns {object[]}
   */
  #databaseTemplates() {
    return Array.isArray(this.database?.state?.templates) ? this.database.state.templates : [];
  }

  /**
   * Reads template category records from the JSON database when the collection exists.
   * @returns {object[]}
   */
  #databaseCategories() {
    return Array.isArray(this.database?.state?.template_categories) ? this.database.state.template_categories : [];
  }

  /**
   * Returns all known category records before removing empty categories.
   * @returns {object[]}
   */
  #allCategories() {
    return dedupeById([...this.categories, ...this.#databaseCategories()]);
  }
}

/**
 * Resolves presentation visual settings for a deck or template.
 * @param {{templateId?: string, template?: object, visual?: object, theme?: string}} input
 * @returns {{id: string, name: string, primary: string, accent: string, background: string, surface: string, title: string, body: string, layout: string}}
 */
export function resolveTemplateVisual(input = {}) {
  const baseTemplate = DEFAULT_TEMPLATES.find((item) => item.id === input.templateId) || DEFAULT_TEMPLATES[0];
  const templateOverrides = input.template ? removeUndefinedValues(input.template) : null;
  const selectedTheme = String(input.theme || "").trim();
  const template = input.template
    ? {
      ...baseTemplate,
      ...templateOverrides,
      visual: { ...(baseTemplate.visual || {}), ...(templateOverrides.visual || {}) },
    }
    : (input.visual ? { ...baseTemplate, visual: { ...(baseTemplate.visual || {}), ...input.visual } } : baseTemplate);
  const hasVisualOverride = hasVisualOverrideAgainstBase(template.visual, baseTemplate.visual || {});
  const themeVisual = !hasVisualOverride ? resolveThemeVisual(template.themes || baseTemplate.themes || [], selectedTheme) : null;
  const mergedVisual = { ...template.visual, ...(templateOverrides?.visual || {}), ...(themeVisual || {}) };
  const visual = { ...DEFAULT_VISUAL, ...(mergedVisual || {}) };
  return {
    id: template.id || "business",
    name: template.name || "Business",
    primary: normalizeHex(visual.primary, DEFAULT_VISUAL.primary),
    accent: normalizeHex(visual.accent, DEFAULT_VISUAL.accent),
    background: normalizeHex(visual.background, DEFAULT_VISUAL.background),
    surface: normalizeHex(visual.surface, DEFAULT_VISUAL.surface),
    title: normalizeHex(visual.title, DEFAULT_VISUAL.title),
    body: normalizeHex(visual.body, DEFAULT_VISUAL.body),
    layout: visual.layout || DEFAULT_VISUAL.layout,
  };
}

function resolveThemeVisual(themes, themeId) {
  if (!themeId || !Array.isArray(themes) || themes.length === 0) return null;
  const match = themes.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const id = String(candidate.id || candidate.value || candidate.name || "").trim();
    return id === themeId;
  });
  if (!match || typeof match.visual !== "object") return null;
  return normalizeThemeVisual(match.visual);
}

function hasVisualOverrideAgainstBase(visual, baseVisual) {
  if (!visual || !baseVisual) return false;
  const keys = ["primary", "accent", "background", "surface", "title", "body", "layout"];
  for (const key of keys) {
    if (key === "layout") {
      if (String(visual.layout || "").trim() !== String(baseVisual.layout || "").trim()) return true;
      continue;
    }
    if (normalizeHex(visual[key] || "") !== normalizeHex(baseVisual[key] || "")) return true;
  }
  return false;
}

function normalizeThemeVisual(themeVisual) {
  return {
    primary: normalizeHex(themeVisual.primary),
    accent: normalizeHex(themeVisual.accent),
    background: normalizeHex(themeVisual.background),
    surface: normalizeHex(themeVisual.surface),
    title: normalizeHex(themeVisual.title),
    body: normalizeHex(themeVisual.body),
    layout: typeof themeVisual.layout === "string" ? themeVisual.layout : "",
  };
}

/**
 * Normalizes a template record for API, generation, preview, and export consumers.
 * @param {object} template
 * @param {object[]} categories
 * @returns {object}
 */
function normalizeTemplate(template, categories) {
  const categoryId = resolveCategoryId(template);
  const category = categories.find((item) => item.id === categoryId) || { id: categoryId, name: categoryId || "General" };
  return {
    ...template,
    categoryId,
    category,
    scope: template.scope || "official",
    status: template.status || "active",
    themes: normalizeThemes(template.themes),
    visual: { ...DEFAULT_VISUAL, ...(template.visual || {}) },
    layoutSchema: normalizeLayoutSchema(template.layoutSchema),
  };
}

/**
 * Resolves a template category ID.
 * @param {object} template
 * @returns {string}
 */
function resolveCategoryId(template) {
  return template.categoryId || template.category_id || template.category?.id || "business";
}

/**
 * 判断模板是否属于历史开源样例模板，避免不好看的开源模板重新出现在前台。
 * @param {object} template
 * @returns {boolean}
 */
function isOpenSourceTemplate(template) {
  const source = template?.source && typeof template.source === "object" ? template.source : {};
  const values = [
    template?.id,
    template?.slug,
    template?.name,
    template?.description,
    template?.sourceType,
    template?.source_type,
    template?.license,
    template?.sourceLicense,
    template?.source_license,
    source.type,
    source.repository,
    source.license,
    source.file,
  ].map((value) => String(value || "").toLowerCase());
  return values.some((value) => (
    value.includes("开源")
    || value.includes("open-source")
    || value.includes("opensource")
    || value.includes("open source")
    || value.includes("城市展示")
    || value.includes("通用演示")
    || value.includes("city-showcase")
    || value.includes("general-demo")
  ));
}

/**
 * Normalizes theme config while accepting legacy string themes.
 * @param {unknown} themes
 * @returns {{id: string, name: string}[]}
 */
function normalizeThemes(themes) {
  const values = Array.isArray(themes) && themes.length ? themes : ["modern"];
  return values.map((theme) => {
    if (theme && typeof theme === "object") {
      const id = String(theme.id || theme.value || theme.name || "").trim();
      return { ...theme, id, name: theme.name || id };
    }
    const id = String(theme || "").trim();
    return { id, name: id };
  }).filter((theme) => theme.id);
}

/**
 * Normalizes template layout schema.
 * @param {unknown} layoutSchema
 * @returns {{defaultCoverLayout: string, defaultContentLayout: string, allowedLayouts: string[]}}
 */
function normalizeLayoutSchema(layoutSchema) {
  const schema = layoutSchema && typeof layoutSchema === "object" ? layoutSchema : {};
  const defaultCoverLayout = String(schema.defaultCoverLayout || "title");
  const defaultContentLayout = String(schema.defaultContentLayout || "content");
  const allowedLayouts = Array.isArray(schema.allowedLayouts) && schema.allowedLayouts.length
    ? schema.allowedLayouts.map((layout) => String(layout))
    : [defaultCoverLayout, defaultContentLayout];
  return { ...schema, defaultCoverLayout, defaultContentLayout, allowedLayouts };
}

/**
 * Deduplicates records by stable ID while preserving first-seen order.
 * @param {object[]} records
 * @returns {object[]}
 */
function dedupeById(records) {
  const seen = new Set();
  const result = [];
  for (const record of records) {
    if (!record?.id || seen.has(record.id)) continue;
    seen.add(record.id);
    result.push(record);
  }
  return result;
}

/**
 * Removes undefined/null fields so partial template snapshots do not erase built-in metadata.
 * @param {object} value
 * @returns {object}
 */
function removeUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, entry]) => entry !== undefined && entry !== null));
}

/**
 * Returns a safe six-digit uppercase hex value without a leading hash.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeHex(value, fallback) {
  const normalized = String(value || "").replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}
