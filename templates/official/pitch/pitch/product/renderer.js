/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "pitch",
  "templateName": "创业融资路演",
  "themeId": "product",
  "themeName": "产品亮点",
  "style": "startup-product-highlights",
  "visual": {
    "primary": "0F172A",
    "accent": "14B8A6",
    "secondary": "22C55E",
    "warning": "F59E0B",
    "background": "F8FAFC",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "startup-product-highlights",
    "variant": "product-highlights"
  },
  "layoutSchema": {
    "defaultCoverLayout": "startup-product-cover",
    "defaultContentLayout": "startup-product-capability",
    "allowedLayouts": [
      "startup-product-cover",
      "startup-product-pain-scene",
      "startup-product-capability",
      "startup-product-demo-flow",
      "startup-product-architecture",
      "startup-product-value-journey",
      "startup-product-validation",
      "startup-product-moat",
      "startup-product-funding",
      "startup-product-closing"
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
