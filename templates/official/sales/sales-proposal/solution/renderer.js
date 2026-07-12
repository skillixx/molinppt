/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "sales-proposal",
  "templateName": "销售提案方案",
  "themeId": "solution",
  "themeName": "解决方案",
  "style": "solution-proposal-system",
  "visual": {
    "primary": "123047",
    "accent": "1AA6A6",
    "secondary": "D99A2B",
    "warning": "D9603B",
    "background": "F4F7FA",
    "surface": "FFFFFF",
    "title": "0B2233",
    "body": "40515F",
    "layout": "sales-proposal-solution",
    "variant": "solution"
  },
  "layoutSchema": {
    "defaultCoverLayout": "sales-proposal-solution-cover",
    "defaultContentLayout": "sales-proposal-solution-content",
    "allowedLayouts": [
      "sales-proposal-solution-cover",
      "sales-proposal-solution-diagnosis",
      "sales-proposal-solution-painpoints",
      "sales-proposal-solution-architecture",
      "sales-proposal-solution-process",
      "sales-proposal-solution-roadmap",
      "sales-proposal-solution-value",
      "sales-proposal-solution-closing"
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
