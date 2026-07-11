/**
 * 官方售前技术方案「架构方案」模板入口。
 * 当前模板主体由 ppt-service.js 和 ppt-exporter.js 统一绘制，这里承载目录化元数据。
 */
export const templateRenderer = {
  templateId: "presales-technical-plan",
  templateName: "售前技术方案",
  themeId: "architecture-solution",
  themeName: "架构方案",
  style: "technical-blueprint",
  visual: {
    primary: "0B1F3A",
    accent: "22D3EE",
    secondary: "38BDF8",
    warning: "F59E0B",
    background: "EAF3FB",
    surface: "FFFFFF",
    title: "071827",
    body: "334155",
    layout: "presales-architecture-solution",
    variant: "architecture-solution",
  },
  layoutSchema: {
    defaultCoverLayout: "presales-architecture-cover",
    defaultContentLayout: "presales-architecture-content",
    allowedLayouts: [
      "presales-architecture-cover",
      "presales-requirement-map",
      "presales-architecture-blueprint",
      "presales-module-capability",
      "presales-deployment-topology",
      "presales-delivery-assurance",
      "presales-next-step",
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
