/**
 * 这些场景同时供在线预览和 PPTX 导出使用。
 * 共享文案与指标语义可以避免两套渲染器各自演进后出现内容不一致。
 */
const SCENES = Object.freeze({
  marketing: Object.freeze({
    launch: scene("launch", "PRODUCT LAUNCH", "GO TO MARKET", "首发卖点、场景化素材与发布节奏", [
      metric("01", "首发卖点"), metric("3", "核心场景"), metric("7D", "发布节奏"),
    ]),
    brand: scene("brand", "BRAND VOICE", "CONTENT MATRIX", "视觉符号、传播主张与内容矩阵", [
      metric("VI", "识别系统"), metric("3", "传播主张"), metric("全域", "内容触点"),
    ]),
    growth: scene("growth", "GROWTH LOOP", "CHANNEL FUNNEL", "渠道漏斗、转化路径与复购闭环", [
      metric("AARRR", "增长模型"), metric("5", "关键触点"), metric("ROI", "投放复盘"),
    ]),
  }),
  brandStory: Object.freeze({
    editorial: story("editorial", "EDITORIAL STORY", "NARRATIVE ARC", "品牌主张、故事线与传播语境", "ST", ["品牌起点", "核心主张", "传播语境"]),
    premium: story("premium", "PREMIUM MOOD", "TEXTURE SYSTEM", "材质、影调与高级视觉秩序", "PR", ["品质证据", "高级影调", "信任资产"]),
    identity: story("identity", "BRAND IDENTITY", "VISUAL CODES", "核心符号、色彩系统与触点一致性", "ID", ["核心符号", "色彩系统", "触点规范"]),
  }),
  dataInsight: Object.freeze({
    dashboard: scene("dashboard", "DATA COMMAND CENTER", "KPI DASHBOARD", "核心指标、异常波动与经营信号", [
      metric("KPI", "指标总览"), metric("24H", "数据刷新"), metric("3", "异常信号"),
    ]),
    insight: scene("insight", "INSIGHT FINDINGS", "SIGNAL ANALYSIS", "趋势拆解、原因定位与行动优先级", [
      metric("01", "关键发现"), metric("4", "影响因子"), metric("Next", "行动建议"),
    ]),
    research: scene("research", "RESEARCH NOTE", "EVIDENCE REVIEW", "样本、结论和可追溯的研究证据", [
      metric("N", "样本说明"), metric("CI", "置信区间"), metric("Ref", "证据索引"),
    ]),
  }),
  pitch: Object.freeze({
    startup: scene("startup", "FOUNDER STORY", "TRACTION PATH", "从用户痛点到可规模化增长的融资叙事", [
      metric("痛点", "创始洞察"), metric("PMF", "验证路径"), metric("增长", "规模化机会"),
    ]),
    investor: scene("investor", "INVESTOR MEMO", "CAPITAL PLAN", "市场空间、商业模型和资金用途的决策视图", [
      metric("TAM", "市场空间"), metric("ARR", "收入模型"), metric("Runway", "资金计划"),
    ]),
    product: scene("product", "PRODUCT EDGE", "VALUE PROOF", "核心能力、场景价值和差异化证据", [
      metric("01", "核心功能"), metric("3X", "效率提升"), metric("NPS", "用户口碑"),
    ]),
  }),
});

function metric(value, label) {
  return Object.freeze({ value, label });
}

function scene(variant, kicker, section, caption, metrics) {
  return Object.freeze({ variant, kicker, section, caption, metrics: Object.freeze(metrics) });
}

function story(variant, kicker, section, caption, mark, points) {
  return Object.freeze({ variant, kicker, section, caption, mark, points: Object.freeze(points) });
}

/** @returns {object} */
export function resolveMarketingCampaignScene(visual) {
  return SCENES.marketing[visual?.variant] || SCENES.marketing.launch;
}

/** @returns {object} */
export function resolveBrandStoryScene(visual) {
  return SCENES.brandStory[visual?.variant] || SCENES.brandStory.editorial;
}

/** @returns {object} */
export function resolveDataInsightScene(visual) {
  return SCENES.dataInsight[visual?.variant] || SCENES.dataInsight.dashboard;
}

/** @returns {object} */
export function resolvePitchDeckScene(visual) {
  return SCENES.pitch[visual?.variant] || SCENES.pitch.startup;
}
