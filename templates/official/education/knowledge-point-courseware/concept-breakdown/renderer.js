/**
 * 官方知识点讲解课件模板渲染入口。
 * 当前真实渲染由 ppt-service.js 与 ppt-exporter.js 统一调度，这里保留目录化元数据。
 */
export const templateRenderer = {
  templateId: "knowledge-point-courseware",
  templateName: "知识点讲解课件",
  themeId: "concept-breakdown",
  themeName: "概念拆解",
  style: "concept-breakdown-courseware",
  visual: {
    primary: "245B5A",
    accent: "F59E0B",
    secondary: "3B82F6",
    success: "16A34A",
    background: "F5F2E9",
    surface: "FFFDF7",
    title: "182B3A",
    body: "415466",
    layout: "concept-breakdown-courseware",
    variant: "concept-breakdown"
  }
};

/**
 * 返回当前主题的视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
