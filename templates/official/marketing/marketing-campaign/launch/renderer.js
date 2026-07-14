/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "marketing-campaign",
  "templateName": "营销活动方案",
  "themeId": "launch",
  "themeName": "新品发布",
  "style": "campaign-story",
  "visual": {
    "primary": "0B1020",
    "accent": "FF3B5C",
    "secondary": "22D3EE",
    "warning": "F8C14A",
    "background": "0B1020",
    "surface": "FFFFFF",
    "title": "F8FAFC",
    "body": "CBD5E1",
    "layout": "marketing-product-premiere",
    "variant": "product-premiere"
  },
  "layoutSchema": {
    "defaultCoverLayout": "product-premiere-cover",
    "defaultContentLayout": "product-premiere-content",
    "allowedLayouts": [
      "product-premiere-cover",
      "product-premiere-overview",
      "product-premiere-selling-points",
      "product-premiere-scenario",
      "product-premiere-audience",
      "product-premiere-timeline",
      "product-premiere-channel",
      "product-premiere-data",
      "product-premiere-closing",
      "hero",
      "story",
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
