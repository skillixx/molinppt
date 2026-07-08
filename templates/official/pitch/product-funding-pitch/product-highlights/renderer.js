/**
 * 官方产品融资路演模板渲染入口。
 * 在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一绘制。
 */
export const templateRenderer = {
  templateId: "product-funding-pitch",
  templateName: "产品融资路演",
  themeId: "product-highlights",
  themeName: "产品亮点",
  style: "product-funding-highlights",
  visual: {
    primary: "0B1220",
    accent: "06B6D4",
    secondary: "22C55E",
    warning: "F59E0B",
    background: "EAF2F8",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "product-funding-highlights",
    variant: "product-highlights",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
