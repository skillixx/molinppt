/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "data-insight",
  "templateName": "数据洞察报告",
  "themeId": "research",
  "themeName": "研究报告",
  "style": "research-publication",
  "visual": {
    "primary": "172033",
    "accent": "315C7C",
    "secondary": "B8822D",
    "background": "F7F5EF",
    "surface": "FFFFFF",
    "title": "172033",
    "body": "46515E",
    "layout": "data-research-report",
    "variant": "research"
  },
  "layoutSchema": {
    "defaultCoverLayout": "data-research-report-cover",
    "defaultContentLayout": "data-research-report-finding",
    "allowedLayouts": [
      "data-research-report-cover",
      "data-research-report-summary",
      "data-research-report-method",
      "data-research-report-sample",
      "data-research-report-evidence",
      "data-research-report-finding",
      "data-research-report-recommendation",
      "data-research-report-appendix",
      "title",
      "content",
      "closing"
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
