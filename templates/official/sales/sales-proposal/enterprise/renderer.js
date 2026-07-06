/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "sales-proposal",
  "templateName": "销售提案方案",
  "themeId": "enterprise",
  "themeName": "企业客户",
  "style": "proposal",
  "visual": {
    "primary": "14565A",
    "accent": "D19A3E",
    "background": "EEF7F6",
    "surface": "FFFFFF",
    "title": "123E42",
    "body": "3E5A58",
    "layout": "academy",
    "variant": "enterprise"
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
