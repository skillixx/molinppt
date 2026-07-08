/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "data-insight",
  "templateName": "数据洞察报告",
  "themeId": "insight",
  "themeName": "洞察分析",
  "style": "analytics-report",
  "visual": {
    "primary": "273C75",
    "accent": "F6A623",
    "background": "F4F7FB",
    "surface": "FFFFFF",
    "title": "17243A",
    "body": "46566C",
    "layout": "data-insight",
    "variant": "insight"
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
