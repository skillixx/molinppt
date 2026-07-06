/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "brand-story",
  "templateName": "品牌故事叙事",
  "themeId": "editorial",
  "themeName": "编辑叙事",
  "style": "brand-narrative",
  "visual": {
    "primary": "2A2F3F",
    "accent": "C7825A",
    "background": "F6F1EA",
    "surface": "FFFDFC",
    "title": "171B26",
    "body": "4A5160",
    "layout": "brand-story",
    "variant": "editorial"
  },
  "layoutSchema": {
    "defaultCoverLayout": "venture-cover",
    "defaultContentLayout": "venture-story",
    "allowedLayouts": [
      "venture-cover",
      "venture-story",
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
