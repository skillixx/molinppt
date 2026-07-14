/**
 * BI 数据看板管理驾驶舱主题的目录化元数据。
 * 当前真实预览和 PPTX 绘制仍由 ppt-service.js / ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "bi-dashboard",
  "templateName": "BI 数据看板",
  "themeId": "executive-cockpit",
  "themeName": "管理驾驶舱",
  "style": "management-dashboard",
  "visual": {
    "primary": "071A2F",
    "accent": "22D3EE",
    "secondary": "A3E635",
    "background": "08111F",
    "surface": "0E2238",
    "title": "E6F7FF",
    "body": "A8C7D8",
    "layout": "bi-executive-cockpit",
    "variant": "executive-cockpit"
  },
  "layoutSchema": {
    "defaultCoverLayout": "cockpit-cover",
    "defaultContentLayout": "cockpit-dashboard",
    "allowedLayouts": [
      "cockpit-cover",
      "cockpit-dashboard",
      "cockpit-trend",
      "cockpit-distribution",
      "cockpit-alert",
      "cockpit-closing",
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
