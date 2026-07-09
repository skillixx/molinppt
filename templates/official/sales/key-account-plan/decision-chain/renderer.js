/**
 * 官方大客户攻坚方案「决策链路」模板入口。
 * 当前模板主体由 ppt-service.js 和 ppt-exporter.js 统一绘制。
 * 这里承载目录化元数据，方便官方模板同步和后续独立渲染迁移。
 */
export const templateRenderer = {
  templateId: "key-account-plan",
  templateName: "大客户攻坚方案",
  themeId: "decision-chain",
  themeName: "决策链路",
  style: "key-account-attack",
  visual: {
    primary: "102A43",
    accent: "F59E0B",
    secondary: "15A39A",
    warning: "E11D48",
    background: "EEF4F8",
    surface: "FFFFFF",
    title: "0B1F33",
    body: "334155",
    layout: "sales-key-account-decision-chain",
    variant: "decision-chain",
  },
  layoutSchema: {
    defaultCoverLayout: "key-account-decision-cover",
    defaultContentLayout: "key-account-decision-content",
    allowedLayouts: [
      "key-account-decision-cover",
      "key-account-organization-map",
      "key-account-decision-path",
      "key-account-stakeholder-matrix",
      "key-account-win-roadmap",
      "key-account-closing",
      "title",
      "content",
    ],
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
