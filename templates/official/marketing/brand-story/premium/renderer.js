/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "brand-story",
  "templateName": "品牌故事叙事",
  "themeId": "premium",
  "themeName": "高端质感",
  "style": "brand-narrative",
  "visual": {
    "primary": "181C24",
    "accent": "BFA06A",
    "background": "F2EFE8",
    "surface": "FFFEFA",
    "title": "151922",
    "body": "474B55",
    "secondary": "D8C7A5",
    "layout": "luxury-brand-story",
    "variant": "premium"
  },
  "layoutSchema": {
    "defaultCoverLayout": "luxury-brand-cover",
    "defaultContentLayout": "luxury-brand-story",
    "allowedLayouts": [
      "luxury-brand-cover",
      "luxury-brand-story",
      "luxury-brand-gallery",
      "luxury-brand-proof",
      "luxury-brand-launch",
      "luxury-brand-closing",
      "hero",
      "story"
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
