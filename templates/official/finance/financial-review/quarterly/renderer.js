/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "financial-review",
  "templateName": "财务经营复盘",
  "themeId": "quarterly",
  "themeName": "季度复盘",
  "style": "finance-quarterly-review",
  "visual": {
    "primary": "12263A",
    "accent": "2F9E6D",
    "secondary": "D9902F",
    "warning": "C94B4B",
    "background": "F5F7FA",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "finance-quarterly-review",
    "variant": "quarterly"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-quarterly-cover",
    "defaultContentLayout": "finance-quarterly-overview",
    "allowedLayouts": [
      "finance-quarterly-cover",
      "finance-quarterly-overview",
      "finance-quarterly-profit-bridge",
      "finance-quarterly-budget-variance",
      "finance-quarterly-risk-matrix",
      "finance-quarterly-action-loop",
      "finance-quarterly-closing",
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
