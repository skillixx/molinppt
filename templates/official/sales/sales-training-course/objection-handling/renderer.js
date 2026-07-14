/**
 * 官方销售培训课件「异议处理」模板入口。
 * 模板页面由 ppt-service.js 与 ppt-exporter.js 统一绘制，保证在线预览和 PPTX 导出一致。
 */
export const templateRenderer = {
  templateId: "sales-training-course",
  templateName: "销售培训课件",
  themeId: "objection-handling",
  themeName: "异议处理",
  style: "sales-roleplay-training",
  visual: {
    primary: "17324D",
    accent: "FF8A3D",
    secondary: "2AB7A9",
    warning: "E94B5F",
    background: "F2F7FA",
    surface: "FFFFFF",
    title: "10233B",
    body: "34445C",
    layout: "sales-training-objection-handling",
    variant: "roleplay",
  },
  layoutSchema: {
    defaultCoverLayout: "sales-training-objection-cover",
    defaultContentLayout: "sales-training-objection-content",
    allowedLayouts: [
      "sales-training-objection-cover",
      "sales-training-objection-map",
      "sales-training-objection-path",
      "sales-training-objection-roleplay",
      "sales-training-objection-checklist",
      "sales-training-objection-closing",
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
