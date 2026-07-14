/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "product-roadmap",
  "templateName": "产品路线规划",
  "themeId": "roadmap",
  "themeName": "路线图",
  "style": "product-strategy-roadmap",
  "visual": {
    "primary": "0B1F3A",
    "accent": "14B8A6",
    "secondary": "F59E0B",
    "warning": "DC2626",
    "background": "F6FAFC",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "product-strategy-roadmap",
    "variant": "roadmap"
  },
  "layoutSchema": {
    "defaultCoverLayout": "product-strategy-roadmap-cover",
    "defaultContentLayout": "product-strategy-roadmap-content",
    "allowedLayouts": [
      "product-strategy-roadmap-cover",
      "product-strategy-roadmap-overview",
      "product-strategy-roadmap-capabilities",
      "product-strategy-roadmap-milestones",
      "product-strategy-roadmap-dependencies",
      "product-strategy-roadmap-priority",
      "product-strategy-roadmap-closing",
      "product-strategy-roadmap-content",
      "title",
      "content",
      "closing"
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
