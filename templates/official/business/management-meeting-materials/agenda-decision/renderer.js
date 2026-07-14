/**
 * 管理层会议材料议题决策模板渲染元数据。
 * 真实页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一调度。
 */
export const templateRenderer = {
  templateId: "management-meeting-materials",
  templateName: "管理层会议材料",
  themeId: "agenda-decision",
  themeName: "议题决策",
  style: "management-meeting-materials",
  visual: {
    primary: "13233F",
    accent: "C99A3B",
    secondary: "2F6B7E",
    warning: "B64E3A",
    background: "EEF2F6",
    surface: "FFFFFF",
    title: "0B1426",
    body: "334155",
    layout: "management-agenda-decision",
    variant: "agenda-decision"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
