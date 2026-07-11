/**
 * 官方模板元数据入口。
 * 具体预览和 PPTX 绘制仍由 ppt-service.js 与 ppt-exporter.js 统一调度；
 * 这里保持主题目录可被官方模板同步器读取。
 */
export const templateRenderer = {
  templateId: "marketing-campaign",
  templateName: "营销活动方案",
  themeId: "brand",
  themeName: "品牌传播",
  style: "brand-communication-console",
  visual: {
    primary: "7F1D4E",
    accent: "F97316",
    secondary: "0F766E",
    background: "FFF7F3",
    surface: "FFFFFF",
    title: "26101F",
    body: "5A3B48",
    layout: "marketing-brand-communication-console",
    variant: "brand-console",
  },
  layoutSchema: {
    defaultCoverLayout: "brand-communication-cover",
    defaultContentLayout: "brand-communication-content",
    allowedLayouts: [
      "brand-communication-cover",
      "brand-communication-proposition",
      "brand-communication-audience",
      "brand-communication-content-matrix",
      "brand-communication-media-matrix",
      "brand-communication-rhythm",
      "brand-communication-dashboard",
      "brand-communication-closing",
      "hero",
      "story",
      "content",
    ],
  },
};

/**
 * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
