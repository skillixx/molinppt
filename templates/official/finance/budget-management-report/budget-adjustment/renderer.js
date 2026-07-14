/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "budget-management-report",
  "templateName": "预算管理报告",
  "themeId": "budget-adjustment",
  "themeName": "预算调整",
  "style": "finance-decision",
  "visual": {
    "primary": "18233F",
    "accent": "F59E0B",
    "background": "F4F7FB",
    "surface": "FFFFFF",
    "title": "111827",
    "body": "3B4658",
    "layout": "finance-budget-adjustment",
    "variant": "budget-adjustment",
    "secondary": "14B8A6",
    "risk": "B91C1C"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-budget-adjustment-cover",
    "defaultContentLayout": "finance-budget-adjustment-content",
    "allowedLayouts": [
      "finance-budget-adjustment-cover",
      "finance-budget-adjustment-content",
      "finance-budget-adjustment-analysis",
      "finance-budget-adjustment-reallocation",
      "finance-budget-adjustment-approval",
      "finance-budget-adjustment-impact",
      "finance-budget-adjustment-summary",
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
