/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "pitch",
  "templateName": "创业融资路演",
  "themeId": "investor",
  "themeName": "投资人版",
  "style": "venture-story",
  "visual": {
    "primary": "0F2D3A",
    "accent": "19A0A5",
    "background": "EFF7F7",
    "surface": "FFFFFF",
    "title": "0B2530",
    "body": "39515A",
    "layout": "venture",
    "variant": "investor"
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
