/**
 * 官方代码模板渲染入口。
 * 当前模板的实际 HTML 预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "knowledge-handout",
  templateName: "知识课程讲义",
  themeId: "blackboard",
  themeName: "课堂板书",
  style: "knowledge-blackboard-system",
  visual: {
    primary: "173B33",
    accent: "FACC15",
    secondary: "60A5FA",
    warning: "F87171",
    background: "F4F1E8",
    surface: "FFFDF5",
    title: "F8FAE7",
    body: "E8F3DF",
    layout: "knowledge-blackboard",
    variant: "blackboard",
  },
  layoutSchema: {
    defaultCoverLayout: "blackboard-cover",
    defaultContentLayout: "blackboard-note",
    allowedLayouts: [
      "blackboard-cover",
      "blackboard-outline",
      "blackboard-concept",
      "blackboard-detail",
      "blackboard-case",
      "blackboard-steps",
      "blackboard-summary",
      "title",
      "content",
      "closing",
    ],
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
