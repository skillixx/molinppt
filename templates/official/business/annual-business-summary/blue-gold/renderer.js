/**
 * 年度经营总结模板渲染元数据。
 * 当前真实渲染由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "annual-business-summary",
  templateName: "年度经营总结",
  themeId: "blue-gold",
  themeName: "蓝金年度版",
  style: "annual-business-summary",
  visual: {
    primary: "15325F",
    accent: "C8A24A",
    background: "EDF3FA",
    surface: "FFFFFF",
    title: "0B172A",
    body: "334155",
    layout: "annual-summary",
    variant: "blue-gold"
  }
};

/**
 * 返回当前主题的视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
