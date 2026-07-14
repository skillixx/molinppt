/**
 * 市场趋势洞察趋势雷达主题的目录化元数据。
 * 真实在线预览和 PPTX 绘制由 ppt-service.js / ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "market-trend-insight",
  "templateName": "市场趋势洞察",
  "themeId": "trend-radar",
  "themeName": "趋势雷达",
  "style": "market-intelligence-radar",
  "visual": {
    "primary": "08111F",
    "accent": "38BDF8",
    "secondary": "A78BFA",
    "warning": "F59E0B",
    "background": "050B18",
    "surface": "0F1E33",
    "title": "E6F7FF",
    "body": "B7C9DA",
    "layout": "market-trend-radar",
    "variant": "trend-radar"
  },
  "layoutSchema": {
    "defaultCoverLayout": "trend-radar-cover",
    "defaultContentLayout": "trend-radar-scan",
    "allowedLayouts": [
      "trend-radar-cover",
      "trend-radar-scan",
      "trend-opportunity-map",
      "trend-competition-shift",
      "trend-risk-signal",
      "trend-action-roadmap",
      "title",
      "content",
      "closing"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置，供官方模板同步和预览生成复用。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
