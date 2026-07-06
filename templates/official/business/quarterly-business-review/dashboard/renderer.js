/**
 * 季度业务复盘经营看板模板渲染元数据。
 * 真实在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 的 quarterly-dashboard 分支绘制。
 */
export const templateRenderer = {
  templateId: "quarterly-business-review",
  templateName: "季度业务复盘",
  themeId: "dashboard",
  themeName: "经营看板",
  style: "quarterly-business-review",
  visual: {
    primary: "25508C",
    accent: "B74D40",
    background: "F4F7FB",
    surface: "FFFFFF",
    title: "1E2D41",
    body: "46556C",
    layout: "quarterly-dashboard",
    variant: "dashboard"
  }
};

/**
 * 返回当前主题的视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
