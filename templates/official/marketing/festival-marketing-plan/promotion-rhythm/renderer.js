/**
 * 官方节日营销方案促销节奏模板入口。
 * 主体页面由 ppt-service.js 和 ppt-exporter.js 统一绘制；
 * 这里保留目录化模板元数据，方便官方模板同步和后续独立渲染迁移。
 */
export const templateRenderer = {
  "templateId": "festival-marketing-plan",
  "templateName": "节日营销方案",
  "themeId": "promotion-rhythm",
  "themeName": "促销节奏",
  "style": "promotion-rhythm",
  "visual": {
    "primary": "8F1D2C",
    "secondary": "FF8A00",
    "accent": "F43F5E",
    "warning": "FBBF24",
    "background": "FFF4EC",
    "surface": "FFFFFF",
    "title": "2A1018",
    "body": "69313D",
    "layout": "marketing-festival-promotion-rhythm",
    "variant": "promotion-rhythm"
  },
  "layoutSchema": {
    "defaultCoverLayout": "marketing-festival-promotion-cover",
    "defaultContentLayout": "marketing-festival-promotion-content",
    "allowedLayouts": [
      "marketing-festival-promotion-cover",
      "marketing-festival-promotion-timeline",
      "marketing-festival-promotion-benefits",
      "marketing-festival-promotion-channel",
      "marketing-festival-promotion-funnel",
      "marketing-festival-promotion-review",
      "marketing-festival-promotion-closing",
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
