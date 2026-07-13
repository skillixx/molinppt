/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "product-roadmap",
  "templateName": "产品路线规划",
  "themeId": "release",
  "themeName": "版本发布",
  "style": "product-release-committee",
  "visual": {
    "primary": "0B1F3A",
    "accent": "14B8A6",
    "secondary": "F59E0B",
    "warning": "DC2626",
    "background": "EEF4F8",
    "surface": "FFFFFF",
    "title": "0A1730",
    "body": "405166",
    "layout": "product-release-committee",
    "variant": "release"
  },
  "layoutSchema": {
    "defaultCoverLayout": "product-release-committee-cover",
    "defaultContentLayout": "product-release-committee-content",
    "allowedLayouts": [
      "product-release-committee-cover",
      "product-release-committee-scope",
      "product-release-committee-timeline",
      "product-release-committee-gray",
      "product-release-committee-risk",
      "product-release-committee-metrics",
      "product-release-committee-summary",
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
