import { loadPptDesignMasterSkill } from "./ppt-design-skill.js";

const DECK_OUTLINE_PROMPT_BUDGET = 2400;
const DECK_OUTLINE_COMPACT_PROFILES = [
  { titleLimit: 90, bulletLimit: 120, maxBullets: 4 },
  { titleLimit: 72, bulletLimit: 88, maxBullets: 4 },
  { titleLimit: 64, bulletLimit: 64, maxBullets: 3 },
  { titleLimit: 48, bulletLimit: 42, maxBullets: 2 },
  { titleLimit: 40, bulletLimit: 28, maxBullets: 1 },
];

const DOME_LAYOUT_ROLES = [
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
];

/**
 * 构建 AI PPT 工作流提示词载荷。
 */
export class PromptManager {
  /**
   * 构建大纲生成提示词。
   * @param {{topic?: string, documentText?: string, slideCount: number, theme?: string, template?: object}} input
   * @returns {object}
   */
  buildOutlinePrompt({ topic, documentText, slideCount, theme, template }) {
    return {
      kind: "outline",
      topic: topic || "Document generated presentation",
      documentText: documentText || "",
      slideCount,
      theme: theme || "modern",
      templateContext: buildTemplateContext(template),
      designSkill: loadPptDesignMasterSkill("outline"),
    };
  }

  /**
   * 构建 PPT 内容生成提示词。
   * red-gold/dome 模板会额外携带版式角色和占位符规则，让模型按模板体系输出结构化 slide JSON。
   * @param {{outline: object, template: object}} input
   * @returns {object}
   */
  buildDeckPrompt({ outline, template }) {
    return {
      kind: "deck",
      outline: buildDeckOutlineContext(outline),
      templateContext: buildTemplateContext(template),
      designSkill: loadPptDesignMasterSkill("deck"),
      templateInstructions: buildTemplateInstructions(template),
    };
  }

  /**
   * 构建单页重生成提示词。
   * @param {{slide: object, instruction: string}} input
   * @returns {object}
   */
  buildRegenerateSlidePrompt({ slide, instruction }) {
    return {
      kind: "regenerate_slide",
      slide,
      instruction,
      designSkill: loadPptDesignMasterSkill("regenerate_slide"),
    };
  }
}

/**
 * 为生成 PPT 阶段构建精简大纲，避免把数据库元数据、长输入和历史字段塞进模型提示词。
 * @param {object | undefined} outline
 * @returns {object}
 */
function buildDeckOutlineContext(outline) {
  if (!outline) return {};
  const sourceSlides = Array.isArray(outline.slides) ? outline.slides : [];
  const base = {
    id: outline.id,
    topic: compactText(outline.topic, 120),
    theme: outline.theme,
    templateId: outline.templateId,
    sourceTemplateId: outline.sourceTemplateId,
    sourceTheme: outline.sourceTheme,
  };
  for (const profile of DECK_OUTLINE_COMPACT_PROFILES) {
    const context = {
      ...base,
      slides: sourceSlides.map((slide, index) => compactSlideForDeckPrompt(slide, index, profile)),
    };
    if (JSON.stringify(context).length <= DECK_OUTLINE_PROMPT_BUDGET) return context;
  }
  return {
    ...base,
    slides: sourceSlides.map((slide, index) => ({
      id: slide?.id || `slide-${index + 1}`,
      sortOrder: slide?.sortOrder || index + 1,
      title: compactText(slide?.title || `第 ${index + 1} 页`, 36),
      layout: slide?.layout,
    })),
  };
}

/**
 * 只保留模型生成页面所需的核心字段，业务长文本会在字段内做截断。
 * @param {object | undefined} slide
 * @param {number} index
 * @param {{titleLimit: number, bulletLimit: number, maxBullets: number}} profile
 * @returns {object}
 */
function compactSlideForDeckPrompt(slide, index, profile) {
  const bullets = Array.isArray(slide?.bullets)
    ? slide.bullets.slice(0, profile.maxBullets).map((bullet) => compactText(bullet, profile.bulletLimit)).filter(Boolean)
    : [];
  return {
    id: slide?.id || `slide-${index + 1}`,
    sortOrder: slide?.sortOrder || index + 1,
    title: compactText(slide?.title || `第 ${index + 1} 页`, profile.titleLimit),
    layout: slide?.layout,
    bullets,
  };
}

/**
 * 截断提示词字段时保留语义前缀，避免超长输入触发模型或本地长度限制。
 * @param {unknown} value
 * @param {number} limit
 * @returns {string}
 */
function compactText(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

/**
 * 为大纲阶段提供轻量模板上下文，帮助模型提前规划差异化页面结构。
 * @param {object | undefined} template
 * @returns {object}
 */
function buildTemplateContext(template) {
  if (!template) return {};
  const themeContexts = Array.isArray(template.themes)
    ? template.themes.slice(0, 6).map((theme) => ({
        id: theme.id,
        name: theme.name,
        visualLayout: theme?.visual?.layout || template?.visual?.layout || "",
        variant: theme?.visual?.variant || "",
      }))
    : [];
  return {
    id: template.id,
    name: template.name,
    categoryId: template.categoryId,
    allowedLayouts: Array.isArray(template?.layoutSchema?.allowedLayouts) ? template.layoutSchema.allowedLayouts : [],
    visualLayout: template?.visual?.layout || "",
    variant: template?.visual?.variant || "",
    themes: themeContexts,
  };
}

/**
 * 根据模板生成模型可读的版式约束。
 * 当前只对 dome.pptx/red-gold 启用强约束，其他模板继续依赖各自 layoutSchema。
 * @param {object} template
 * @returns {object}
 */
function buildTemplateInstructions(template) {
  if (template?.visual?.layout !== "red-gold") {
    return {
      templateSystem: "generic",
      allowedLayouts: Array.isArray(template?.layoutSchema?.allowedLayouts) ? template.layoutSchema.allowedLayouts : [],
    };
  }
  return {
    templateSystem: "dome-red-gold",
    layoutRoles: DOME_LAYOUT_ROLES,
    contentContract: "按 outline 页序或标题选择 layout；把 bullets 填入对应占位符；目录固定 4 项，流程/成果/复盘/计划按模板卡片槽位填充；指标页 bullets 必须使用“指标名: 指标值”格式；问题复盘页 bullets 必须按风险、原因、措施顺序输出；下一步计划页 bullets 必须使用“阶段: 动作”格式；封面和结束页使用副标题占位；不要生成普通项目符号列表。",
    roleHints: {
      cover: "封面页：title 是主标题，bullets[0] 必须使用副标题占位。",
      agenda: "目录页：必须 4 项 bullets 填入 4 个目录卡片，保持卡片式目录完整。",
      "section-divider": "章节分隔页：bullets[0] 必须是 PART 编号，例如“PART 01”。",
      "image-report": "工作汇报图文页：必须 3 条 bullets 填入图文汇报卡片，保持三张图文卡片完整。",
      "three-steps": "三步骤流程页：必须 3 条 bullets 填入流程卡片，保持三个步骤槽位完整。",
      "four-steps": "四步骤流程页：必须 4 条 bullets 填入流程卡片，保持四个步骤槽位完整。",
      metrics: "数据指标页：3 条 bullets 填入指标卡片；每条必须写成“指标名: 指标值”，例如“Revenue growth: 32%”。",
      showcase: "成果展示页：必须 3 条 bullets 填入成果卡片，保持三张成果卡片完整。",
      retrospective: "问题复盘页：3 条 bullets 必须按风险、原因、措施顺序填入复盘卡片，第一条同时作为风险高亮。",
      "next-plan": "下一步计划页：4 条 bullets 填入计划时间线卡片；每条必须写成“阶段: 动作”，例如“Q1: Launch pilot”。",
      closing: "结束页：bullets[0] 必须使用结束页副标题占位。",
    },
  };
}
