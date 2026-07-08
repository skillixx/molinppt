/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "data-insight",
  "templateName": "数据洞察报告",
  "themeId": "dashboard",
  "themeName": "仪表盘",
  "style": "analytics-report",
  "visual": {
    "primary": "123B63",
    "accent": "18A0A6",
    "background": "EEF6F9",
    "surface": "FFFFFF",
    "title": "102A43",
    "body": "3C5364",
    "layout": "data-insight",
    "variant": "dashboard"
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
