/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "customer-segmentation",
  "templateName": "客户分群画像",
  "themeId": "persona-layering",
  "themeName": "人群分层",
  "style": "customer-segmentation-layering",
  "visual": {
    "primary": "111827",
    "accent": "14B8A6",
    "secondary": "F59E0B",
    "warning": "A855F7",
    "background": "F6FAFC",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "customer-segmentation-layering",
    "variant": "persona-layering"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
