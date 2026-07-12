/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "data-insight",
  "templateName": "数据洞察报告",
  "themeId": "dashboard",
  "themeName": "仪表盘",
  "style": "analytics-report",
  "visual": {
    "primary": "07111F",
    "accent": "36C5F0",
    "secondary": "22C55E",
    "warning": "F59E0B",
    "danger": "EF4444",
    "background": "07111F",
    "surface": "101D31",
    "title": "E5EDF7",
    "body": "93A4B8",
    "layout": "data-insight-dashboard-console",
    "variant": "dashboard"
  },
  "layoutSchema": {
    "defaultCoverLayout": "data-console-cover",
    "defaultContentLayout": "data-console-overview",
    "allowedLayouts": [
      "data-console-cover",
      "data-console-overview",
      "data-console-trend",
      "data-console-alert",
      "data-console-ranking",
      "data-console-action",
      "title",
      "content",
      "closing"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
