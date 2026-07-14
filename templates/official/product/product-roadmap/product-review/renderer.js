/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "product-roadmap",
  "templateName": "产品路线规划",
  "themeId": "product-review",
  "themeName": "产品复盘",
  "style": "product-planning",
  "visual": {
    "primary": "173B3A",
    "accent": "20B486",
    "secondary": "F59E0B",
    "warning": "E76F51",
    "background": "F4F7F6",
    "surface": "FFFFFF",
    "title": "102A2A",
    "body": "405A58",
    "layout": "product-review-canvas",
    "variant": "product-review"
  },
  "layoutSchema": {
    "defaultCoverLayout": "product-review-cover",
    "defaultContentLayout": "product-review-content",
    "allowedLayouts": [
      "product-review-cover",
      "product-review-content",
      "goal-result-compare",
      "behavior-change",
      "feature-adoption",
      "feedback-cluster",
      "root-cause",
      "iteration-hypothesis",
      "product-review-closing"
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
