/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "pitch",
  "templateName": "创业融资路演",
  "themeId": "startup",
  "themeName": "创业故事",
  "style": "venture-story",
  "visual": {
    "primary": "16213E",
    "accent": "F59E0B",
    "background": "F7F1E8",
    "surface": "FFFDF8",
    "title": "121826",
    "body": "3F4652",
    "layout": "venture",
    "variant": "startup"
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
