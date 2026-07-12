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
  "style": "founder-cinematic-storytelling",
  "visual": {
    "primary": "172033",
    "accent": "F97316",
    "background": "F6F4EF",
    "surface": "FFFFFF",
    "title": "172033",
    "body": "465266",
    "layout": "founder-cinematic-story",
    "variant": "startup"
  },
  "layoutSchema": {
    "defaultCoverLayout": "founder-film-cover",
    "defaultContentLayout": "founder-story-scene",
    "allowedLayouts": [
      "founder-film-cover",
      "founder-storyline",
      "user-pain-scene",
      "founding-insight",
      "prototype-validation",
      "evidence-wall",
      "growth-chapter",
      "team-mission",
      "vision-funding-roadmap",
      "founder-film-closing"
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
