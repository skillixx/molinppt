/**
 * 官方代码模板渲染入口。
 * 当前渲染由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "experiment-analysis-report",
  templateName: "实验分析报告",
  themeId: "ab-test",
  themeName: "A/B 测试",
  style: "experiment-ab-test",
  visual: {
    primary: "12355B",
    accent: "16A3A3",
    secondary: "F59E0B",
    warning: "EF4444",
    background: "EEF7F8",
    surface: "FFFFFF",
    title: "0B172A",
    body: "334155",
    layout: "experiment-ab-test",
    variant: "ab-test",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
