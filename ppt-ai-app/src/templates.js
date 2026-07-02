import { AppError } from "./errors.js";

/**
 * Built-in template categories used by the local template catalog.
 */
export const DEFAULT_TEMPLATE_CATEGORIES = [
  { id: "business", name: "Business", sortOrder: 10 },
  { id: "strategy", name: "Strategy", sortOrder: 20 },
  { id: "finance", name: "Finance", sortOrder: 30 },
  { id: "sales", name: "Sales", sortOrder: 40 },
  { id: "product", name: "Product", sortOrder: 50 },
  { id: "marketing", name: "Marketing", sortOrder: 60 },
  { id: "data", name: "Data", sortOrder: 70 },
  { id: "education", name: "Education", sortOrder: 80 },
  { id: "pitch", name: "Pitch", sortOrder: 90 },
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
    name: "Executive Business",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "executive-report",
    description: "Boardroom-ready operating review template with strong hierarchy and restrained corporate accents.",
    themes: [
      {
        id: "minimal",
        name: "Minimal",
        visual: {
          primary: "1E3A8A",
          accent: "6B7280",
          background: "F8FAFC",
          surface: "FFFFFF",
          title: "0F172A",
          body: "334155",
          layout: "top-band",
        },
      },
      {
        id: "modern",
        name: "Modern",
        visual: {
          primary: "1F4E79",
          accent: "F4A261",
          background: "F1F5F9",
          surface: "FFFFFF",
          title: "0F2945",
          body: "334155",
          layout: "red-gold",
        },
      },
      {
        id: "classic",
        name: "Classic",
        visual: {
          primary: "243B53",
          accent: "9D8A60",
          background: "F5F7FA",
          surface: "FFFFFF",
          title: "1F2937",
          body: "4B5563",
          layout: "executive",
        },
      },
      {
        id: "executive",
        name: "Executive",
        visual: {
          primary: "18344E",
          accent: "CFAF70",
          background: "F2F5F8",
          surface: "FFFFFF",
          title: "10263C",
          body: "2F4255",
          layout: "venture",
        },
      },
    ],
    visual: {
      primary: "1F4E79",
      accent: "F4A261",
      background: "F1F5F9",
      surface: "FFFFFF",
      title: "0F2945",
      body: "334155",
      layout: "red-gold",
    },
    layoutSchema: DOME_LAYOUT_SCHEMA,
  },
  {
    id: "strategy-consulting",
    name: "Strategy Consulting",
    categoryId: "strategy",
    scope: "official",
    status: "active",
    style: "consulting-case",
    description: "Consulting-style recommendation deck for diagnosis, options, and executive decisions.",
    themes: [
      { id: "board", name: "Board" },
      { id: "matrix", name: "Matrix" },
      { id: "workstream", name: "Workstream" },
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
    name: "Financial Review",
    categoryId: "finance",
    scope: "official",
    status: "active",
    style: "finance-report",
    description: "Finance and operating review template with dense hierarchy, sober contrast, and KPI-ready pages.",
    themes: [
      { id: "quarterly", name: "Quarterly" },
      { id: "audit", name: "Audit" },
      { id: "forecast", name: "Forecast" },
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
    name: "Sales Proposal",
    categoryId: "sales",
    scope: "official",
    status: "active",
    style: "proposal",
    description: "Client-facing sales proposal template for value framing, solution narrative, and next steps.",
    themes: [
      { id: "enterprise", name: "Enterprise" },
      { id: "solution", name: "Solution" },
      { id: "renewal", name: "Renewal" },
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
    name: "Product Roadmap",
    categoryId: "product",
    scope: "official",
    status: "active",
    style: "product-planning",
    description: "Product strategy and roadmap template with clear planning rhythm and prioritization pages.",
    themes: [
      { id: "roadmap", name: "Roadmap" },
      { id: "release", name: "Release" },
      { id: "product-review", name: "Product Review" },
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
    name: "Marketing Campaign",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "campaign-story",
    description: "Campaign planning template with bold contrast for positioning, channels, and launch plans.",
    themes: [
      { id: "launch", name: "Launch" },
      { id: "brand", name: "Brand" },
      { id: "growth", name: "Growth" },
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
    name: "Data Insight",
    categoryId: "data",
    scope: "official",
    status: "active",
    style: "analytics-report",
    description: "Insight report template for metrics, findings, and analytical recommendations.",
    themes: [
      { id: "insight", name: "Insight" },
      { id: "dashboard", name: "Dashboard" },
      { id: "research", name: "Research" },
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
    name: "Academy Workshop",
    categoryId: "education",
    scope: "official",
    status: "active",
    style: "learning-workshop",
    description: "Clear learning and training template with calm panels, teaching rhythm, and readable hierarchy.",
    themes: [
      { id: "lecture", name: "Lecture" },
      { id: "workshop", name: "Workshop" },
      { id: "minimal", name: "Minimal" },
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
    name: "Venture Pitch",
    categoryId: "pitch",
    scope: "official",
    status: "active",
    style: "venture-story",
    description: "Investor-facing pitch template with bold contrast, narrative cover, and high-impact content pages.",
    themes: [
      { id: "startup", name: "Startup" },
      { id: "investor", name: "Investor" },
      { id: "product", name: "Product" },
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
    name: "Brand Story",
    categoryId: "marketing",
    scope: "official",
    status: "active",
    style: "brand-narrative",
    description: "Brand narrative template for positioning, message architecture, and customer-facing stories.",
    themes: [
      { id: "editorial", name: "Editorial" },
      { id: "premium", name: "Premium" },
      { id: "identity", name: "Identity" },
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
    name: "Project Status",
    categoryId: "business",
    scope: "official",
    status: "active",
    style: "status-update",
    description: "Program and project status template for progress, risks, dependencies, and leadership updates.",
    themes: [
      { id: "weekly", name: "Weekly" },
      { id: "steering", name: "Steering" },
      { id: "delivery", name: "Delivery" },
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
   * Lists all available template categories.
   * @returns {object[]}
   */
  listCategories() {
    return dedupeById([...this.categories, ...this.#databaseCategories()])
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
    const categories = this.listCategories();
    const templates = [...this.templates, ...this.#databaseTemplates()].filter((template) => {
      const status = template.status || "active";
      const scope = template.scope || "official";
      if (status !== "active") return false;
      if (scope === "user" && Number(template.ownerUserId ?? template.owner_user_id) !== Number(ownerUserId)) return false;
      if (scope !== "official" && scope !== "user") return false;
      if (categoryId && resolveCategoryId(template) !== categoryId) return false;
      return true;
    });
    return dedupeById(templates).map((template) => normalizeTemplate(template, categories));
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
