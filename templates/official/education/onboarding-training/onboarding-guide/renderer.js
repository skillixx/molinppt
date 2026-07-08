/**
 * 官方代码模板渲染入口。
 * 当前模板的主体版式由 ppt-service.js 与 ppt-exporter.js 统一绘制，目录文件承载元数据，方便官方模板同步。
 */
export const templateRenderer = {
  templateId: "onboarding-training",
  templateName: "新员工入职培训",
  themeId: "onboarding-guide",
  themeName: "Onboarding 指南",
  style: "employee-orientation",
  visual: {
    primary: "1E3A5F",
    accent: "14B8A6",
    secondary: "F59E0B",
    background: "F4F8FB",
    surface: "FFFFFF",
    title: "102033",
    body: "41516A",
    layout: "onboarding-guide",
    variant: "onboarding-guide",
  },
  layoutSchema: {
    defaultCoverLayout: "onboarding-cover",
    defaultContentLayout: "onboarding-content",
    allowedLayouts: [
      "onboarding-cover",
      "onboarding-journey",
      "onboarding-policy",
      "onboarding-role",
      "onboarding-culture",
      "onboarding-checklist",
      "onboarding-summary",
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
