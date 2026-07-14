/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "sales-proposal",
  "templateName": "销售提案方案",
  "themeId": "renewal",
  "themeName": "续约增长",
  "style": "renewal-growth-qbr",
  "visual": {
    "primary": "123B3A",
    "accent": "2FBF71",
    "secondary": "F2B84B",
    "warning": "D66A3A",
    "background": "F5F8F6",
    "surface": "FFFFFF",
    "title": "102826",
    "body": "3F5552",
    "layout": "sales-renewal-growth-qbr",
    "variant": "renewal"
  },
  "layoutSchema": {
    "defaultCoverLayout": "sales-renewal-qbr-cover",
    "defaultContentLayout": "sales-renewal-qbr-content",
    "allowedLayouts": [
      "sales-renewal-qbr-cover",
      "sales-renewal-qbr-health",
      "sales-renewal-qbr-value",
      "sales-renewal-qbr-opportunity",
      "sales-renewal-qbr-growth-path",
      "sales-renewal-qbr-pricing",
      "sales-renewal-qbr-success-plan",
      "sales-renewal-qbr-closing"
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
