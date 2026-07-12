/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "brand-story",
  "templateName": "品牌故事叙事",
  "themeId": "identity",
  "themeName": "品牌识别",
  "style": "brand-identity-system",
  "visual": {
    "primary": "121826",
    "accent": "D84B3F",
    "secondary": "D7A43A",
    "background": "F6F0E7",
    "surface": "FFFFFF",
    "title": "111827",
    "body": "4B5563",
    "layout": "brand-identity-system",
    "variant": "identity-manual"
  },
  "layoutSchema": {
    "defaultCoverLayout": "brand-identity-cover",
    "defaultContentLayout": "brand-identity-system",
    "allowedLayouts": [
      "brand-identity-cover",
      "brand-identity-logo",
      "brand-identity-palette",
      "brand-identity-typography",
      "brand-identity-applications",
      "brand-identity-touchpoints"
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
