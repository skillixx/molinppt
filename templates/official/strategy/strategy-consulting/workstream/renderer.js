/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "strategy-consulting",
  "templateName": "战略咨询方案",
  "themeId": "workstream",
  "themeName": "工作流程推进",
  "style": "consulting-case",
  "visual": {
    "primary": "27364A",
    "accent": "2563EB",
    "secondary": "14B8A6",
    "warning": "F59E0B",
    "background": "F6F8FB",
    "surface": "FFFFFF",
    "title": "172033",
    "body": "475569",
    "layout": "strategy-workstream-pmo",
    "variant": "workstream"
  },
  "layoutSchema": {
    "defaultCoverLayout": "strategy-workstream-cover",
    "defaultContentLayout": "strategy-workstream-overview",
    "allowedLayouts": [
      "strategy-workstream-cover",
      "strategy-workstream-overview",
      "strategy-workstream-swimlane",
      "strategy-workstream-deliverables",
      "strategy-workstream-raci",
      "strategy-workstream-risks",
      "strategy-workstream-next-plan",
      "title",
      "content"
    ]
  }
};

/**
 * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
