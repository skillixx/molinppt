/**
 * 业务增长汇报机会地图模板元数据。
 * 实际页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一处理。
 */
export const templateRenderer = {
  templateId: "business-growth-report",
  templateName: "业务增长汇报",
  themeId: "opportunity-map",
  themeName: "机会地图",
  style: "business-growth-report",
  visual: {
    primary: "123A5A",
    accent: "17A673",
    secondary: "D9A441",
    warning: "F97316",
    background: "EEF5F7",
    surface: "FFFFFF",
    title: "0B1F33",
    body: "33475B",
    layout: "business-opportunity-map",
    variant: "opportunity-map"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
