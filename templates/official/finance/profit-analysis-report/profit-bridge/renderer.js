/**
 * 官方代码模板渲染入口。
 * 当前渲染由 ppt-service.js 和 ppt-exporter.js 统一调度；
 * 本文件保留主题元数据，便于官方模板同步和后续独立渲染器拆分。
 */
export const templateRenderer = {
  "templateId": "profit-analysis-report",
  "templateName": "利润分析报告",
  "themeId": "profit-bridge",
  "themeName": "利润桥",
  "style": "finance-profit-attribution",
  "visual": {
    "primary": "14213D",
    "accent": "C99A2E",
    "secondary": "2E7D7A",
    "negative": "C65A42",
    "background": "EEF3F7",
    "surface": "FFFFFF",
    "title": "0B1528",
    "body": "334155",
    "layout": "finance-profit-bridge",
    "variant": "profit-bridge"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-profit-bridge-cover",
    "defaultContentLayout": "finance-profit-bridge-content",
    "allowedLayouts": [
      "finance-profit-bridge-cover",
      "finance-profit-bridge-waterfall",
      "finance-profit-bridge-margin-structure",
      "finance-profit-bridge-factor-analysis",
      "finance-profit-bridge-improvement",
      "finance-profit-bridge-closing",
      "title",
      "content"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
