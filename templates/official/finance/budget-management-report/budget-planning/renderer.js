/**
 * 官方代码模板渲染入口。
 * 当前模板绘制由 ppt-service.js 和 ppt-exporter.js 统一调度；
 * 这里承载目录化模板元数据，方便官方模板同步和后续迁移独立渲染器。
 */
export const templateRenderer = {
  "templateId": "budget-management-report",
  "templateName": "预算管理报告",
  "themeId": "budget-planning",
  "themeName": "预算编制",
  "style": "finance-plan",
  "visual": {
    "primary": "102A43",
    "accent": "2A9D8F",
    "background": "EEF4F8",
    "surface": "FFFFFF",
    "title": "0B1F33",
    "body": "405163",
    "layout": "finance-budget-planning",
    "variant": "budget-planning"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-budget-planning-cover",
    "defaultContentLayout": "finance-budget-planning-content",
    "allowedLayouts": [
      "finance-budget-planning-cover",
      "finance-budget-planning-overview",
      "finance-budget-planning-allocation",
      "finance-budget-planning-table",
      "finance-budget-planning-flow",
      "finance-budget-planning-closing",
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
