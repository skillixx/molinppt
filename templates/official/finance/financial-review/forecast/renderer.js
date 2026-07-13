/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "financial-review",
  "templateName": "财务经营复盘",
  "themeId": "forecast",
  "themeName": "预测规划",
  "style": "finance-fpa-forecast",
  "visual": {
    "primary": "0F2D3A",
    "accent": "22A699",
    "secondary": "3B82F6",
    "warning": "F59E0B",
    "danger": "E0564A",
    "background": "F4F8F7",
    "surface": "FFFFFF",
    "title": "0B1F2A",
    "body": "314B55",
    "layout": "finance-fpa-forecast",
    "variant": "forecast"
  },
  "layoutSchema": {
    "defaultCoverLayout": "fpa-forecast-cover",
    "defaultContentLayout": "fpa-forecast-content",
    "allowedLayouts": [
      "fpa-forecast-cover",
      "fpa-forecast-agenda",
      "fpa-assumption-cards",
      "fpa-scenario-model",
      "fpa-revenue-cost-link",
      "fpa-cash-flow-trend",
      "fpa-resource-priority",
      "fpa-forecast-closing",
      "title",
      "content"
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
