/**
 * 社媒运营方案 / 短视频增长模板渲染配置。
 * 这里仅暴露结构化视觉参数，真实页面绘制由预览端和 PPTX 导出端分别用代码实现。
 */
export const templateRenderer = {
  id: "marketing-social-media-operation-plan-short-video-growth",
  name: "社媒运营方案 - 短视频增长",
  categorySlug: "marketing",
  baseTemplateId: "social-media-operation-plan",
  themeId: "short-video-growth",
  visual: {
    id: "marketing-social-media-operation-plan-short-video-growth",
    layout: "social-video-growth",
    variant: "short-video-growth",
    primary: "111827",
    secondary: "0EA5E9",
    accent: "22C55E",
    warning: "F97316",
    background: "F4F7FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
  },
  layoutSchema: {
    defaultCoverLayout: "social-video-growth-cover",
    defaultContentLayout: "social-video-growth-content",
    allowedLayouts: [
      "social-video-growth-cover",
      "social-video-growth-matrix",
      "social-video-growth-content-rhythm",
      "social-video-growth-funnel",
      "social-video-growth-dashboard",
      "social-video-growth-action-plan",
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
