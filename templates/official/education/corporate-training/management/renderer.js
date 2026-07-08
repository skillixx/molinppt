/**
 * 官方代码模板渲染入口。
 * 当前模板的主体版式由 ppt-service.js 与 ppt-exporter.js 统一绘制，目录文件承载元数据，方便官方模板同步。
 */
export const templateRenderer = {
  templateId: "corporate-training",
  templateName: "企业内训课程",
  themeId: "management",
  themeName: "管理培训",
  style: "enterprise-learning",
  visual: {
    primary: "1F3A5F",
    accent: "20A39E",
    background: "F4F7FA",
    surface: "FFFFFF",
    title: "10233D",
    body: "40516A",
    layout: "corporate-training",
    variant: "management",
  },
  layoutSchema: {
    defaultCoverLayout: "corporate-training-cover",
    defaultContentLayout: "corporate-training-content",
    allowedLayouts: [
      "corporate-training-cover",
      "corporate-training-agenda",
      "corporate-training-chapter",
      "corporate-training-model",
      "corporate-training-case",
      "corporate-training-tool",
      "corporate-training-practice",
      "corporate-training-summary",
      "title",
      "content",
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
