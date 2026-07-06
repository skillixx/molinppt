/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "financial-review",
  "templateName": "财务经营复盘",
  "themeId": "forecast",
  "themeName": "预测规划",
  "style": "finance-report",
  "visual": {
    "primary": "123B4D",
    "accent": "2F9E9A",
    "background": "EEF6F7",
    "surface": "FFFFFF",
    "title": "0E2B3A",
    "body": "3D5563",
    "layout": "executive",
    "variant": "forecast"
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
