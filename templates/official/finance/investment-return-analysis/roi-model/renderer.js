/**
 * 官方代码模板渲染入口。
 * 当前模板的真实在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一绘制。
 */
export const templateRenderer = {
  templateId: "investment-return-analysis",
  templateName: "投资回报分析",
  themeId: "roi-model",
  themeName: "ROI 模型",
  style: "finance-investment-roi-model",
  visual: {
    primary: "0F2742",
    accent: "16A34A",
    secondary: "F59E0B",
    warning: "EF4444",
    background: "F5F8FB",
    surface: "FFFFFF",
    title: "0B1726",
    body: "334155",
    layout: "finance-investment-roi-model",
    variant: "roi-model",
  },
  layoutSchema: {
    defaultCoverLayout: "finance-roi-model-cover",
    defaultContentLayout: "finance-roi-model-content",
    allowedLayouts: [
      "finance-roi-model-cover",
      "finance-roi-model-overview",
      "finance-roi-model-formula",
      "finance-roi-model-return-curve",
      "finance-roi-model-payback",
      "finance-roi-model-scenario",
      "finance-roi-model-decision",
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
