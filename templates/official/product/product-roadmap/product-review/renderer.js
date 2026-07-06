/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "product-roadmap",
  "templateName": "产品路线规划",
  "themeId": "product-review",
  "themeName": "产品复盘",
  "style": "product-planning",
  "visual": {
    "primary": "263D4A",
    "accent": "E07A5F",
    "background": "F5F6F2",
    "surface": "FFFFFF",
    "title": "1E3038",
    "body": "4A5960",
    "layout": "academy",
    "variant": "product-review"
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
