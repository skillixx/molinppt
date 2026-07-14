/**
 * 官方代码模板渲染入口。
 * 当前模板的真实预览和 PPTX 绘制由 ppt-service.js 与 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "internal-control-compliance-report",
  templateName: "内控合规报告",
  themeId: "risk-inspection",
  themeName: "风险检查",
  style: "audit-risk-control",
  visual: {
    primary: "14213D",
    accent: "F97316",
    secondary: "16A34A",
    warning: "DC2626",
    background: "EEF3F7",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "finance-risk-inspection",
    variant: "risk-inspection"
  },
  layoutSchema: {
    defaultCoverLayout: "finance-risk-inspection-cover",
    defaultContentLayout: "finance-risk-inspection-finding",
    allowedLayouts: [
      "finance-risk-inspection-cover",
      "finance-risk-inspection-overview",
      "finance-risk-inspection-checklist",
      "finance-risk-inspection-finding",
      "finance-risk-inspection-rating",
      "finance-risk-inspection-remediation",
      "finance-risk-inspection-closing",
      "title",
      "content"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
