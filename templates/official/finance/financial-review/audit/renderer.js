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
  "style": "finance-audit-review",
  "visual": {
    "primary": "172033",
    "accent": "C2413A",
    "secondary": "2D7F76",
    "warning": "D9902F",
    "background": "F4F6F8",
    "surface": "FFFFFF",
    "title": "101827",
    "body": "3F4A5A",
    "layout": "finance-audit-review",
    "variant": "audit"
  },
  "layoutSchema": {
    "defaultCoverLayout": "finance-audit-cover",
    "defaultContentLayout": "finance-audit-findings",
    "allowedLayouts": [
      "finance-audit-cover",
      "finance-audit-summary",
      "finance-audit-findings",
      "finance-audit-control-flow",
      "finance-audit-transaction-analysis",
      "finance-audit-remediation",
      "finance-audit-closing",
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
