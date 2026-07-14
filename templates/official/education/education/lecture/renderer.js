/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "education",
  "templateName": "教育培训课件",
  "themeId": "lecture",
  "themeName": "课题讲授",
  "style": "learning-workshop",
  "visual": {
    "primary": "214E44",
    "accent": "E6B84F",
    "background": "EEF5F0",
    "surface": "FFFEF7",
    "title": "17352F",
    "body": "415A53",
    "layout": "education-course",
    "variant": "lecture"
  },
  "layoutSchema": {
    "defaultCoverLayout": "academy-cover",
    "defaultContentLayout": "academy-content",
    "allowedLayouts": [
      "academy-cover",
      "academy-content",
      "lesson-title",
      "lesson-content"
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
