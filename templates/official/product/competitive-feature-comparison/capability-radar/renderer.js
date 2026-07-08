/**
 * 官方代码模板渲染入口。
 * 具体页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一处理。
 */
export const templateRenderer = {
  id: "product-competitive-feature-comparison-capability-radar",
  templateId: "competitive-feature-comparison",
  theme: "capability-radar",
  name: "竞品功能对比 - 能力雷达",
  category: "product",
  style: "capability-radar-map",
  variant: "capability-radar",
  visual: {
    primary: "17233F",
    accent: "16B8A6",
    secondary: "FF8A3D",
    background: "EEF4F8",
    surface: "FFFFFF",
    title: "0D1B2A",
    body: "3D4B5C",
    layout: "capability-radar-map",
    variant: "capability-radar"
  },
  layoutSchema: {
    defaultCoverLayout: "capability-radar-cover",
    defaultContentLayout: "capability-radar-content",
    allowedLayouts: [
      "capability-radar-cover",
      "capability-radar-comparison",
      "capability-radar-analysis",
      "capability-radar-gap",
      "capability-radar-roadmap",
      "capability-radar-summary",
      "title",
      "content",
      "closing"
    ]
  }
};

export default templateRenderer;
