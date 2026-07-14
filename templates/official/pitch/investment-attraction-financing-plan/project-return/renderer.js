/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "investment-attraction-financing-plan",
  "templateName": "招商融资方案",
  "themeId": "project-return",
  "themeName": "项目收益",
  "style": "pitch-project-return",
  "visual": {
    "primary": "111827",
    "accent": "D6A84F",
    "secondary": "1FB6A6",
    "warning": "F59E0B",
    "background": "E8EEF3",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "3A4656",
    "layout": "pitch-project-return",
    "variant": "project-return"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
