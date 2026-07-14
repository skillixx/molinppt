/**
 * 用户行为分析路径漏斗主题的目录化元数据。
 * 真实在线预览和 PPTX 绘制由 ppt-service.js / ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "user-behavior-analysis",
  "templateName": "用户行为分析",
  "themeId": "path-funnel",
  "themeName": "路径漏斗",
  "style": "conversion-path-workbench",
  "visual": {
    "primary": "172554",
    "accent": "06B6D4",
    "secondary": "22C55E",
    "warning": "F97316",
    "background": "F6FAFF",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "user-path-funnel",
    "variant": "path-funnel"
  },
  "layoutSchema": {
    "defaultCoverLayout": "path-cover",
    "defaultContentLayout": "path-analysis",
    "allowedLayouts": [
      "path-cover",
      "path-overview",
      "path-funnel",
      "path-experiment",
      "path-actions",
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
