/**
 * 渠道数据分析-流量质量官方模板元数据入口。
 * 当前模板由 ppt-service.js 和 ppt-exporter.js 统一绘制预览与 PPTX。
 */
export const templateRenderer = {
  templateId: "channel-data-analysis",
  templateName: "渠道数据分析",
  themeId: "traffic-quality",
  themeName: "流量质量",
  style: "channel-quality-diagnosis",
  visual: {
    primary: "172554",
    accent: "22C55E",
    secondary: "38BDF8",
    warning: "F59E0B",
    danger: "EF4444",
    background: "F3F7FB",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "channel-traffic-quality",
    variant: "traffic-quality",
  },
};

/**
 * 返回当前主题视觉配置，供官方模板同步和后续扩展复用。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
