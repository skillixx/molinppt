/**
 * 经营问题诊断问题树模板渲染元数据。
 * 真实页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一调度。
 */
export const templateRenderer = {
  templateId: "operating-problem-diagnosis",
  templateName: "经营问题诊断",
  themeId: "problem-tree",
  themeName: "问题树",
  style: "operating-problem-diagnosis",
  visual: {
    primary: "17233B",
    accent: "E94B3C",
    secondary: "0EA5A8",
    warning: "F59E0B",
    background: "F5F7FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "operating-problem-tree",
    variant: "problem-tree"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
