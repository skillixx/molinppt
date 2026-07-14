/**
 * 官方投资人更新报告模板渲染入口。
 * 在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一绘制。
 */
export const templateRenderer = {
  templateId: "investor-update-report",
  templateName: "投资人更新报告",
  themeId: "progress-sync",
  themeName: "进展同步",
  style: "investor-update-progress-sync",
  visual: {
    primary: "111827",
    accent: "14B8A6",
    secondary: "F59E0B",
    warning: "EF4444",
    background: "EEF4F8",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "investor-update-progress-sync",
    variant: "progress-sync",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
