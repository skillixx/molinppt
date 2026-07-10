/**
 * 部门述职报告-团队绩效官方模板元数据。
 * 实际页面绘制由 ppt-service.js 和 ppt-exporter.js 根据 visual.layout 统一处理。
 */
export const templateRenderer = {
  templateId: "department-performance-report",
  templateName: "部门述职报告",
  themeId: "team-performance",
  themeName: "团队绩效",
  style: "department-performance-report",
  visual: {
    primary: "173B73",
    accent: "F5B84B",
    secondary: "24B8A8",
    background: "F5F8FC",
    surface: "FFFFFF",
    title: "102033",
    body: "334155",
    layout: "department-team-performance",
    variant: "team-performance"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
