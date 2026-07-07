/**
 * 季度业务复盘-问题诊断模板元数据。
 * 真实页面绘制由 ppt-service.js 与 ppt-exporter.js 统一实现，确保在线预览和 PPTX 导出保持一致。
 */
export const templateRenderer = {
  templateId: "quarterly-business-review",
  templateName: "季度业务复盘",
  themeId: "problem-diagnosis",
  themeName: "问题诊断",
  style: "quarterly-problem-diagnosis",
  visual: {
    primary: "1C318A",
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
 * 返回当前主题的视觉配置，供官方模板同步和预览兜底读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
