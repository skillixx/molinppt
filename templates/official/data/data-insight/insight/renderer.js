/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "data-insight",
  "templateName": "数据洞察报告",
  "themeId": "insight",
  "themeName": "洞察分析",
  "style": "analytics-report",
  "visual": {
    "primary": "172554",
    "accent": "F59E0B",
    "secondary": "14B8A6",
    "warning": "EF4444",
    "background": "F6F8FB",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "data-insight-workbench",
    "variant": "insight"
  },
  "layoutSchema": {
    "defaultCoverLayout": "data-insight-workbench-cover",
    "defaultContentLayout": "data-insight-workbench-trend",
    "allowedLayouts": [
      "data-insight-workbench-cover",
      "data-insight-workbench-trend",
      "data-insight-workbench-attribution",
      "data-insight-workbench-correlation",
      "data-insight-workbench-evidence",
      "data-insight-workbench-priority",
      "data-insight-workbench-closing",
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
