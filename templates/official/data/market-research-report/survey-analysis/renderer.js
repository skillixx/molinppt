/**
 * 官方代码模板渲染入口。
 * 当前渲染由 ppt-service.js 和 ppt-exporter.js 统一调度，目录内保留视觉配置方便同步和后续拆分。
 */
export const templateRenderer = {
  templateId: "market-research-report",
  templateName: "市场调研报告",
  themeId: "survey-analysis",
  themeName: "问卷分析",
  style: "market-survey-analysis",
  visual: {
    primary: "155E75",
    accent: "14B8A6",
    secondary: "F97316",
    warning: "F59E0B",
    background: "F5FAFC",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "market-survey-analysis",
    variant: "survey-analysis",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
