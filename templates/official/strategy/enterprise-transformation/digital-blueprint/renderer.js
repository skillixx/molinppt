/**
 * 官方企业转型方案模板渲染入口。
 * 在线预览和 PPTX 导出由 ppt-service.js 与 ppt-exporter.js 统一绘制。
 */
export const templateRenderer = {
  templateId: "enterprise-transformation",
  templateName: "企业转型方案",
  themeId: "digital-blueprint",
  themeName: "数字化蓝图",
  style: "enterprise-digital-blueprint",
  visual: {
    primary: "0B1F3A",
    accent: "22D3EE",
    secondary: "38BDF8",
    warning: "F59E0B",
    background: "EAF4FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "enterprise-digital-blueprint",
    variant: "digital-blueprint",
  },
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
