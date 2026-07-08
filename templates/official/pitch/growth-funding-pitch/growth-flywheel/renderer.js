/**
 * 官方代码模板渲染入口。
 * 当前真实预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "growth-funding-pitch",
  templateName: "增长融资路演",
  themeId: "growth-flywheel",
  themeName: "增长飞轮",
  style: "growth-funding-flywheel",
  visual: {
    primary: "0B1220",
    accent: "22C55E",
    background: "EAF1F8",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "growth-funding-flywheel",
    variant: "growth-flywheel",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
