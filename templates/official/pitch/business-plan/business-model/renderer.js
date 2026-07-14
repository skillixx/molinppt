/**
 * 商业计划书 - 商业模式模板渲染元数据。
 * 当前模板主体由 ppt-service.js 与 ppt-exporter.js 统一绘制，保持在线预览和 PPTX 导出一致。
 */
export const templateRenderer = {
  templateId: "business-plan",
  templateName: "商业计划书",
  themeId: "business-model",
  themeName: "商业模式",
  style: "investor-business-canvas",
  visual: {
    primary: "10213F",
    accent: "16A34A",
    secondary: "D6A84F",
    background: "F5F7FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "business-model-bp",
    variant: "business-model",
  },
  layoutSchema: {
    defaultCoverLayout: "bp-cover",
    defaultContentLayout: "bp-canvas",
    allowedLayouts: [
      "bp-cover",
      "bp-canvas",
      "bp-revenue",
      "bp-cost",
      "bp-value-chain",
      "bp-ecosystem",
      "bp-capital-plan",
      "hero",
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
