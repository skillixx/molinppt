/**
 * 官方私域运营方案会员分层模板入口。
 * 主体页面由 ppt-service.js 和 ppt-exporter.js 统一绘制，保证在线预览和 PPTX 导出一致。
 */
export const templateRenderer = {
  templateId: "private-domain-operation-plan",
  templateName: "私域运营方案",
  themeId: "member-layering",
  themeName: "会员分层",
  style: "private-domain-member-layering",
  visual: {
    primary: "123C35",
    accent: "D6A84F",
    secondary: "F06A4B",
    background: "F3F7F1",
    surface: "FFFFFF",
    title: "10231F",
    body: "43514C",
    layout: "private-domain-member-layering",
    variant: "member-layering",
  },
  layoutSchema: {
    defaultCoverLayout: "private-domain-member-layering-cover",
    defaultContentLayout: "private-domain-member-layering-content",
    allowedLayouts: [
      "private-domain-member-layering-cover",
      "private-domain-member-layering-pyramid",
      "private-domain-member-layering-touch-path",
      "private-domain-member-layering-benefits",
      "private-domain-member-layering-repurchase-loop",
      "private-domain-member-layering-dashboard",
      "private-domain-member-layering-action-plan",
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
