/**
 * 季度业务复盘 - 经营看板模板渲染元数据。
 * 当前真实渲染由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "quarterly-business-review",
  templateName: "季度业务复盘",
  themeId: "dashboard",
  themeName: "经营看板",
  style: "quarterly-business-dashboard",
  visual: {
    primary: "173861",
    accent: "D7A650",
    background: "EEF3F9",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "quarterly-dashboard",
    variant: "dashboard"
  }
};

/**
 * 返回当前主题的视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
