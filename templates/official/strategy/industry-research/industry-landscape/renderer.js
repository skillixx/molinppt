/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度；
 * 本文件承载目录化模板元数据，后续可把该主题的独立绘制逻辑迁入这里。
 */
export const templateRenderer = {
  "templateId": "industry-research",
  "templateName": "行业研究报告",
  "themeId": "industry-landscape",
  "themeName": "行业格局",
  "style": "consulting-report",
  "visual": {
    "primary": "12325A",
    "accent": "18A7A7",
    "background": "F3F7FA",
    "surface": "FFFFFF",
    "title": "0B1F33",
    "body": "334155",
    "layout": "industry-research",
    "variant": "industry-landscape"
  },
  "layoutSchema": {
    "defaultCoverLayout": "industry-research-cover",
    "defaultContentLayout": "industry-research-content",
    "allowedLayouts": [
      "industry-research-cover",
      "industry-overview",
      "industry-value-chain",
      "industry-competition",
      "industry-opportunity-risk",
      "industry-research-closing",
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
