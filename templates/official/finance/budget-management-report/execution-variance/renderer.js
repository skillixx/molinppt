/**
 * 官方代码模板渲染入口。
 * 当前渲染由 ppt-service.js 和 ppt-exporter.js 统一调度；
 * 本文件保留主题元数据，便于官方模板同步和后续独立渲染器拆分。
 */
export const templateRenderer = {
  "templateId": "budget-management-report",
  "templateName": "预算管理报告",
  "themeId": "execution-variance",
  "themeName": "执行偏差",
  "style": "finance-variance-review",
  "visual": {
    "primary": "16213E",
    "accent": "E9574F",
    "background": "F3F6FA",
    "surface": "FFFFFF",
    "title": "172036",
    "body": "3D4B5F",
    "layout": "finance-budget-variance",
    "variant": "execution-variance",
    "warning": "F6B84B",
    "positive": "2FA879"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-budget-variance-cover",
    "defaultContentLayout": "finance-budget-variance-content",
    "allowedLayouts": [
      "finance-budget-variance-cover",
      "finance-budget-variance-overview",
      "finance-budget-variance-comparison",
      "finance-budget-variance-analysis",
      "finance-budget-variance-correction",
      "finance-budget-variance-loop",
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
