/**
 * 官方代码模板渲染入口。
 * 当前真实预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "seed-round-pitch",
  templateName: "种子轮融资路演",
  themeId: "startup-story",
  themeName: "创业故事",
  style: "seed-round-storytelling",
  visual: {
    primary: "172033",
    accent: "F97316",
    background: "F6F4EF",
    surface: "FFFFFF",
    title: "172033",
    body: "465266",
    layout: "seed-round-story",
    variant: "startup-story",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
