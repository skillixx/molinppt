/**
 * 官方金融行业解决方案模板入口。
 * 当前模板主体由 ppt-service.js 和 ppt-exporter.js 统一绘制，
 * 这里承载目录化元数据，方便官方模板同步和后续独立渲染迁移。
 */
export const templateRenderer = {
  "templateId": "industry-solution",
  "templateName": "行业解决方案",
  "themeId": "financial-industry",
  "themeName": "金融行业",
  "style": "financial-solution",
  "visual": {
    "primary": "0B2A4A",
    "accent": "18A0A6",
    "background": "EAF3F7",
    "surface": "FFFFFF",
    "title": "071D33",
    "body": "385269",
    "layout": "sales-financial-solution",
    "variant": "financial-industry"
  },
  "layoutSchema": {
    "defaultCoverLayout": "sales-financial-solution-cover",
    "defaultContentLayout": "sales-financial-solution-content",
    "allowedLayouts": [
      "sales-financial-solution-cover",
      "sales-financial-solution-painpoints",
      "sales-financial-solution-architecture",
      "sales-financial-solution-compliance",
      "sales-financial-solution-value",
      "sales-financial-solution-closing",
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
