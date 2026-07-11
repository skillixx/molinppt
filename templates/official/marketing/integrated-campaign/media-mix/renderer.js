/**
 * 整合营销传播 / 媒介组合模板渲染配置。
 * 这里只提供目录化元数据，预览和 PPTX 导出由统一渲染管线用代码绘制。
 */
export const templateRenderer = {
  id: "marketing-integrated-campaign-media-mix",
  name: "整合营销传播 - 媒介组合",
  categorySlug: "marketing",
  baseTemplateId: "integrated-campaign",
  themeId: "media-mix",
  visual: {
    id: "marketing-integrated-campaign-media-mix",
    layout: "integrated-media-mix",
    variant: "media-mix",
    primary: "12355B",
    secondary: "1D9BF0",
    accent: "F59E0B",
    warning: "EF4444",
    background: "F3F7FB",
    surface: "FFFFFF",
    title: "10233F",
    body: "334155",
  },
  layoutSchema: {
    defaultCoverLayout: "integrated-media-mix-cover",
    defaultContentLayout: "integrated-media-mix-content",
    allowedLayouts: [
      "integrated-media-mix-cover",
      "integrated-media-mix-matrix",
      "integrated-media-mix-budget",
      "integrated-media-mix-rhythm",
      "integrated-media-mix-effect",
      "integrated-media-mix-closing",
      "title",
      "content",
    ],
  },
};

/**
 * 供模板扫描器获取可序列化视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
