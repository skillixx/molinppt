/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "product-roadmap",
  "templateName": "产品路线图",
  "themeId": "release-cadence",
  "themeName": "版本节奏",
  "style": "product-release-cadence",
  "visual": {
    "primary": "0B1F3A",
    "accent": "22D3EE",
    "secondary": "F97316",
    "background": "EFF6FF",
    "surface": "FFFFFF",
    "title": "0A1730",
    "body": "405166",
    "layout": "product-release-cadence",
    "variant": "release-cadence"
  },
  "layoutSchema": {
    "defaultCoverLayout": "product-release-cadence-cover",
    "defaultContentLayout": "product-release-cadence-content",
    "allowedLayouts": [
      "product-release-cadence-cover",
      "product-release-cadence-content",
      "product-release-cadence-analysis",
      "product-release-cadence-lanes",
      "product-release-cadence-risk",
      "product-release-cadence-summary",
      "title",
      "content",
      "closing"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
