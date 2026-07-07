/**
 * 季度业务复盘行动闭环模板渲染元数据。
 * 真实页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一调度。
 */
export const templateRenderer = {
  templateId: "quarterly-business-review",
  templateName: "季度业务复盘",
  themeId: "action-loop",
  themeName: "行动闭环",
  style: "quarterly-business-review",
  visual: {
    primary: "1F5FBF",
    accent: "1CC8A0",
    background: "F3F7FE",
    surface: "FFFFFF",
    title: "10233F",
    body: "40516C",
    layout: "quarterly-action-loop",
    variant: "action-loop"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
