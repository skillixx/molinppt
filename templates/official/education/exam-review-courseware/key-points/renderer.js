/**
 * 官方代码模板渲染入口。
 * 具体在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 中的 exam-review-keypoints 分支统一绘制。
 */
export const templateRenderer = {
  templateId: "exam-review-courseware",
  templateName: "考试复习课件",
  themeId: "key-points",
  themeName: "重点梳理",
  style: "exam-review-keypoints-system",
  visual: {
    primary: "1E2A78",
    accent: "F59E0B",
    secondary: "06B6D4",
    warning: "EF4444",
    background: "F4F7FB",
    surface: "FFFFFF",
    title: "172554",
    body: "334155",
    layout: "exam-review-keypoints",
    variant: "key-points",
  },
  layoutSchema: {
    defaultCoverLayout: "exam-review-cover",
    defaultContentLayout: "exam-review-keypoints",
    allowedLayouts: [
      "exam-review-cover",
      "exam-review-roadmap",
      "exam-review-framework",
      "exam-review-keypoints",
      "exam-review-mistakes",
      "exam-review-plan",
      "exam-review-summary",
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
