/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "strategy-consulting",
  "templateName": "战略咨询方案",
  "themeId": "matrix",
  "themeName": "矩阵分类",
  "style": "consulting-case",
  "visual": {
    "primary": "203A5C",
    "accent": "4C8F8A",
    "background": "F0F5F7",
    "surface": "FFFFFF",
    "title": "12263A",
    "body": "3D5366",
    "layout": "executive",
    "variant": "matrix"
  },
  "layoutSchema": {
    "defaultCoverLayout": "executive-cover",
    "defaultContentLayout": "executive-content",
    "allowedLayouts": [
      "executive-cover",
      "executive-content",
      "title",
      "content"
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
