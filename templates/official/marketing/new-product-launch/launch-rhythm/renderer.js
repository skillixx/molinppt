/**
 * 官方新品上市首发节奏模板入口。
 * 主体页面由 ppt-service.js 和 ppt-exporter.js 统一绘制，
 * 这里保留目录化模板元数据，便于官方模板同步和后续迁移独立渲染器。
 */
export const templateRenderer = {
  "templateId": "new-product-launch",
  "templateName": "新品上市方案",
  "themeId": "launch-rhythm",
  "themeName": "首发节奏",
  "style": "launch-rhythm",
  "visual": {
    "primary": "101828",
    "accent": "FF5A3D",
    "background": "111827",
    "surface": "FFFFFF",
    "title": "FFFFFF",
    "body": "D7DEE8",
    "layout": "marketing-launch-rhythm",
    "variant": "launch-rhythm"
  },
  "layoutSchema": {
    "defaultCoverLayout": "marketing-launch-rhythm-cover",
    "defaultContentLayout": "marketing-launch-rhythm-content",
    "allowedLayouts": [
      "marketing-launch-rhythm-cover",
      "marketing-launch-rhythm-timeline",
      "marketing-launch-rhythm-selling-points",
      "marketing-launch-rhythm-channel",
      "marketing-launch-rhythm-kpi",
      "marketing-launch-rhythm-closing",
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
