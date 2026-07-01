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
   * @param {{topic?: string, documentText?: string, slideCount: number, theme?: string}} input
   * @returns {object}
   */
  buildOutlinePrompt({ topic, documentText, slideCount, theme }) {
    return {
      kind: "outline",
      topic: topic || "Document generated presentation",
      documentText: documentText || "",
      slideCount,
      theme: theme || "modern",
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
      outline,
      template,
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
    };
  }
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
    contentContract: "按 outline 页序或标题选择 layout；把 bullets 填入对应占位符；目录固定 4 项，流程/指标/成果/复盘/计划按模板卡片槽位填充；封面和结束页使用副标题占位；不要生成普通项目符号列表。",
    roleHints: {
      cover: "封面页：title 是主标题，bullets[0] 是封面副标题。",
      agenda: "目录页：bullets 填入 4 个目录卡片。",
      "section-divider": "章节分隔页：bullets[0] 是 PART 编号。",
      "image-report": "工作汇报图文页：3 条 bullets 填入图文汇报卡片。",
      "three-steps": "三步骤流程页：3 条 bullets 填入流程卡片。",
      "four-steps": "四步骤流程页：4 条 bullets 填入流程卡片。",
      metrics: "数据指标页：3 条 bullets 填入指标卡片。",
      showcase: "成果展示页：3 条 bullets 填入成果卡片。",
      retrospective: "问题复盘页：3 条 bullets 填入复盘卡片，第一条同时作为风险高亮。",
      "next-plan": "下一步计划页：4 条 bullets 填入计划时间线卡片。",
      closing: "结束页：bullets[0] 是结束页副标题。",
    },
  };
}
