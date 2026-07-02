/**
 * PPT 设计大师技能：用短规则约束 AI，避免提示词过长触发成本保护。
 */
export const PPT_DESIGN_MASTER_SKILL = {
  id: "ppt-design-master",
  name: "专业 PPT 设计大师",
  version: "2026-07-03",
  role: "资深商业 PPT 设计大师、咨询顾问、信息可视化设计师。",
  detailPageTypes: ["knowledge-detail", "detail-analysis", "deep-dive", "case-detail", "problem-detail", "plan-detail"],
  universalRules: [
    "一页一个结论，标题写成判断句或行动句。",
    "避免固定三段式，也避免从三段式滑向四段式卡片堆砌。",
    "四宫格/四张卡只能偶尔使用，不能连续出现。",
    "必须穿插详情展开页：解释一个部分的背景、证据、原因、影响或动作。",
    "必须包含知识点详情挖掘页：围绕一个概念/方法/判断写一段重点解释，突出侧重点。",
    "内容遵循故事线：背景/矛盾/洞察/方案/行动/结果/下一步。",
    "不要出现模板名称、占位废话或无业务含义的装饰文字。",
  ],
  outlineRules: [
    "像顾问一样分配页面职责：总览、判断、证据、详情、方案、行动。",
    "至少 25% 的内容页应该是详情展开页，而不是继续罗列并列观点。",
    "详情页标题必须具体到对象和动作，例如“首访到试用环节导致转化下降”。",
    "知识点页标题必须点明侧重点，例如“预算偏差分析的重点是区分价格差与用量差”。",
    "bullets 要按页型变化：封面1、目录4、指标3、流程3-4、复盘风险/原因/措施、计划阶段/动作。",
  ],
  deckRules: [
    "把大纲转成版式化表达，不要复制 bullet 列表。",
    "knowledge-detail 要用一段 40-80 字重点解释 + 1-2 条辅助要点，不要做成并列卡片。",
    "detail-analysis/deep-dive/case-detail/problem-detail/plan-detail 要围绕同一对象逐层展开：现象、证据、原因、影响、动作。",
    "指标页用“指标名: 指标值”，流程页用“阶段: 动作”，对比页用“维度: 差异”。",
    "相邻页面结构必须变化，不能连续多页标题加三条/四条并列要点。",
  ],
  polishRules: [
    "保留原页身份和上下文，只优化标题、要点、讲稿和必要 layout。",
    "把普通 bullet 改成结论标题、关键数字、对比关系、行动建议或风险闭环。",
    "用户要求优化局部内容时，优先改成详情展开页。",
    "用户要求解释某个知识点时，优先改成 knowledge-detail：一段解释讲清侧重点，再补证据或动作。",
    "文本要适合当前模板容量，不要遮挡标题或溢出页面。",
  ],
  antiPatterns: [
    "连续页面使用三段式项目符号",
    "连续页面使用四段式卡片或四宫格",
    "没有详情展开页",
    "知识点只列名词，没有一段解释侧重点",
    "标题只是名词短语",
    "bullet 空泛且没有对象/动作/数字/判断",
  ],
};

/**
 * 按操作类型加载精简版 PPT 设计大师技能。
 * @param {"outline"|"deck"|"regenerate_slide"} operation
 * @returns {object}
 */
export function loadPptDesignMasterSkill(operation) {
  const operationRules = {
    outline: PPT_DESIGN_MASTER_SKILL.outlineRules,
    deck: PPT_DESIGN_MASTER_SKILL.deckRules,
    regenerate_slide: PPT_DESIGN_MASTER_SKILL.polishRules,
  }[operation] || [];

  return {
    id: PPT_DESIGN_MASTER_SKILL.id,
    name: PPT_DESIGN_MASTER_SKILL.name,
    version: PPT_DESIGN_MASTER_SKILL.version,
    role: PPT_DESIGN_MASTER_SKILL.role,
    detailPageTypes: PPT_DESIGN_MASTER_SKILL.detailPageTypes,
    rules: [
      ...PPT_DESIGN_MASTER_SKILL.universalRules,
      ...operationRules,
    ],
    antiPatterns: PPT_DESIGN_MASTER_SKILL.antiPatterns,
  };
}
