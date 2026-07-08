/**
 * 官方代码模板渲染入口。
 * 当前模板主体由 ppt-service.js 和 ppt-exporter.js 统一绘制，保证预览和导出一致。
 */
export const templateRenderer = {
  templateId: "feature-priority-review",
  templateName: "功能优先级评审",
  themeId: "value-matrix",
  themeName: "价值矩阵",
  style: "feature-priority-matrix",
  visual: {
    primary: "172554",
    accent: "10B981",
    secondary: "F97316",
    background: "EEF4F8",
    surface: "FFFFFF",
    title: "0B1736",
    body: "405166",
    layout: "feature-priority-matrix",
    variant: "value-matrix"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
