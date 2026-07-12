/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "marketing-campaign",
  "templateName": "营销活动方案",
  "themeId": "growth",
  "themeName": "增长营销",
  "style": "campaign-story",
  "visual": {
    "primary": "047857",
    "accent": "F97316",
    "secondary": "14B8A6",
    "background": "ECFDF5",
    "surface": "FFFFFF",
    "title": "063327",
    "body": "36594F",
    "layout": "growth-marketing-lab",
    "variant": "growth-lab"
  },
  "layoutSchema": {
    "defaultCoverLayout": "growth-lab-cover",
    "defaultContentLayout": "growth-lab-funnel",
    "allowedLayouts": [
      "growth-lab-cover",
      "growth-lab-funnel",
      "growth-lab-channel-matrix",
      "growth-lab-experiment-card",
      "growth-lab-trend-roi",
      "growth-lab-action-priority",
      "growth-lab-closing",
      "hero",
      "story",
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
