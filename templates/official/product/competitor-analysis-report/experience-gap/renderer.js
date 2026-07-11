/**
 * 官方代码模板渲染入口。
 * 具体页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一处理。
 */
export const templateRenderer = {
  id: "product-competitor-analysis-report-experience-gap",
  templateId: "competitor-analysis-report",
  theme: "experience-gap",
  name: "竞品分析报告 - 体验差距",
  category: "product",
  style: "experience-gap-map",
  variant: "experience-gap",
  visual: {
    primary: "18233F",
    accent: "2F80ED",
    secondary: "F9735B",
    background: "EEF4FA",
    surface: "FFFFFF",
    title: "101828",
    body: "405166",
    layout: "experience-gap-map",
    variant: "experience-gap"
  },
  layoutSchema: {
    defaultCoverLayout: "experience-gap-cover",
    defaultContentLayout: "experience-gap-content",
    allowedLayouts: [
      "experience-gap-cover",
      "experience-gap-comparison",
      "experience-gap-path",
      "experience-gap-diagnosis",
      "experience-gap-opportunity",
      "experience-gap-summary",
      "title",
      "content",
      "closing"
    ]
  }
};

export default templateRenderer;
