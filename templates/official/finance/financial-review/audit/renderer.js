/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "financial-review",
  "templateName": "财务经营复盘",
  "themeId": "audit",
  "themeName": "审计分析",
  "style": "finance-report",
  "visual": {
    "primary": "243447",
    "accent": "A56A43",
    "background": "F3F0EC",
    "surface": "FFFFFF",
    "title": "1A2735",
    "body": "4A5562",
    "layout": "executive",
    "variant": "audit"
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
