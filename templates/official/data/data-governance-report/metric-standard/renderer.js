/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "data-governance-report",
  "templateName": "数据治理汇报",
  "themeId": "metric-standard",
  "themeName": "指标口径",
  "style": "data-governance-standard",
  "visual": {
    "primary": "102A43",
    "accent": "00A7B5",
    "secondary": "D9A441",
    "background": "F3F7FA",
    "surface": "FFFFFF",
    "title": "0B1826",
    "body": "32465A",
    "layout": "data-governance-standard",
    "variant": "metric-standard"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
