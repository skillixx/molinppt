/**
 * 季度业务复盘问题诊断模板渲染元数据。
 * 真实在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 的 quarterly-diagnosis 分支绘制。
 */
export const templateRenderer = {
  templateId: "quarterly-business-review",
  templateName: "季度业务复盘",
  themeId: "problem-diagnosis",
  themeName: "问题诊断",
  style: "quarterly-business-review",
  visual: {
    primary: "152E79",
    accent: "4F7F55",
    background: "F4F6F8",
    surface: "FFFFFF",
    title: "111827",
    body: "4B5563",
    layout: "quarterly-diagnosis",
    variant: "problem-diagnosis"
  }
};

/**
 * 返回当前主题的视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
