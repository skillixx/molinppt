/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "public-courseware",
  "templateName": "公开课课件",
  "themeId": "enrollment-conversion",
  "themeName": "招生转化",
  "style": "public-course-enrollment",
  "visual": {
    "primary": "173A6A",
    "accent": "FF6B3D",
    "secondary": "24C6DC",
    "success": "20B486",
    "warning": "F7B731",
    "background": "F2F7FB",
    "surface": "FFFFFF",
    "title": "10233B",
    "body": "34445C",
    "layout": "public-course-enrollment",
    "variant": "enrollment-conversion"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
