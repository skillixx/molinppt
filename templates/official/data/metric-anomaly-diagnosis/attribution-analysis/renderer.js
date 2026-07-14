/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "metric-anomaly-diagnosis",
  "templateName": "指标异常诊断",
  "themeId": "attribution-analysis",
  "themeName": "归因分析",
  "style": "metric-anomaly-attribution",
  "visual": {
    "primary": "0F172A",
    "accent": "06B6D4",
    "secondary": "F97316",
    "warning": "EF4444",
    "background": "F4F8FB",
    "surface": "FFFFFF",
    "title": "0B1220",
    "body": "334155",
    "layout": "metric-anomaly-attribution",
    "variant": "attribution-analysis"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
