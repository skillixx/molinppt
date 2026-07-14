/**
 * Pre-A 融资 BP - 市场验证模板元数据。
 * 实际页面由 ppt-service.js 和 ppt-exporter.js 统一绘制，保证在线预览和 PPTX 导出结构一致。
 */
export const templateRenderer = {
  templateId: "pre-a-funding-bp",
  templateName: "Pre-A 融资 BP",
  themeId: "market-validation",
  themeName: "市场验证",
  style: "pre-a-market-validation",
  visual: {
    primary: "0B1220",
    accent: "14B8A6",
    secondary: "38BDF8",
    warning: "F59E0B",
    background: "EAF2F8",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "pre-a-market-validation",
    variant: "market-validation",
  },
  layoutSchema: {
    defaultCoverLayout: "pre-a-validation-cover",
    defaultContentLayout: "pre-a-validation-content",
    allowedLayouts: [
      "pre-a-validation-cover",
      "pre-a-evidence-wall",
      "pre-a-traction-dashboard",
      "pre-a-business-model",
      "pre-a-moat-map",
      "pre-a-capital-plan",
      "pre-a-team-closing",
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
