/**
 * 官方商业模式设计模板渲染入口。
 * 在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一绘制。
 */
export const templateRenderer = {
  templateId: "business-model-design",
  templateName: "商业模式设计",
  themeId: "value-chain",
  themeName: "价值链",
  style: "business-model-value-chain",
  visual: {
    primary: "10233D",
    accent: "18A999",
    secondary: "D6A756",
    warning: "F97316",
    background: "EEF5F3",
    surface: "FFFFFF",
    title: "102033",
    body: "334155",
    layout: "business-model-value-chain",
    variant: "value-chain",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
