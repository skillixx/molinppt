/**
 * 官方代码模板渲染入口。
 * 具体页面绘制由 ppt-service.js 与 ppt-exporter.js 根据 visual.layout 统一处理。
 */
export const templateRenderer = {
  id: "product-user-experience-redesign-experience-journey",
  templateId: "user-experience-redesign",
  theme: "experience-journey",
  name: "用户体验改版方案 - 体验旅程",
  category: "product",
  style: "experience-journey-map",
  variant: "experience-journey",
  visual: {
    primary: "1E2A5A",
    accent: "18B7A6",
    secondary: "F9735B",
    background: "EEF5FA",
    surface: "FFFFFF",
    title: "102033",
    body: "405166",
    layout: "experience-journey-map",
    variant: "experience-journey"
  },
  layoutSchema: {
    defaultCoverLayout: "experience-journey-cover",
    defaultContentLayout: "experience-journey-content",
    allowedLayouts: [
      "experience-journey-cover",
      "experience-journey-content",
      "experience-journey-diagnosis",
      "experience-journey-redesign",
      "experience-journey-roadmap",
      "experience-journey-summary",
      "title",
      "content",
      "closing"
    ]
  }
};

export default templateRenderer;
