/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "sales-proposal",
  "templateName": "销售提案方案",
  "themeId": "enterprise",
  "themeName": "企业客户",
  "style": "enterprise-account-proposal",
  "visual": {
    "primary": "0F2F4A",
    "accent": "22B8A7",
    "secondary": "D99A2B",
    "warning": "D65A31",
    "background": "F3F7FA",
    "surface": "FFFFFF",
    "title": "0A1F33",
    "body": "334155",
    "layout": "sales-enterprise-proposal",
    "variant": "enterprise"
  },
  "layoutSchema": {
    "defaultCoverLayout": "sales-enterprise-proposal-cover",
    "defaultContentLayout": "sales-enterprise-proposal-content",
    "allowedLayouts": [
      "sales-enterprise-proposal-cover",
      "sales-enterprise-proposal-organization",
      "sales-enterprise-proposal-painpoints",
      "sales-enterprise-proposal-matching",
      "sales-enterprise-proposal-deployment",
      "sales-enterprise-proposal-roi",
      "sales-enterprise-proposal-sla",
      "sales-enterprise-proposal-closing"
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
