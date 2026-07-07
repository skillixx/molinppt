/**
 * 官方代码模板渲染入口。
 * 当前主题通过 industry-trend-forecast 独立 layout 接入在线预览和 PPTX 导出，
 * 这里保留可被模板注册器读取的主题视觉配置。
 */
export const templateRenderer = {
  templateId: "industry-research",
  templateName: "行业研究报告",
  themeId: "trend-forecast",
  themeName: "趋势判断",
  style: "consulting-report",
  visual: {
    primary: "102A56",
    accent: "16A3B8",
    secondary: "22C55E",
    warning: "F59E0B",
    background: "F5F8FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "industry-trend-forecast",
    variant: "trend-forecast",
  },
  layoutSchema: {
    defaultCoverLayout: "industry-trend-cover",
    defaultContentLayout: "industry-trend-content",
    allowedLayouts: [
      "industry-trend-cover",
      "trend-overview",
      "trend-signal-matrix",
      "trend-driver-wheel",
      "trend-opportunity-risk",
      "trend-roadmap",
      "industry-trend-closing",
      "title",
      "content",
    ],
  },
};

/**
 * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
