/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "tech-startup-pitch",
  "templateName": "科技创业路演",
  "themeId": "ai-saas",
  "themeName": "AI SaaS",
  "style": "pitch-ai-saas",
  "visual": {
    "primary": "07111F",
    "accent": "2DD4BF",
    "background": "EAF4FF",
    "surface": "F8FBFF",
    "title": "0B1220",
    "body": "334155",
    "layout": "pitch-ai-saas",
    "variant": "ai-saas"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
