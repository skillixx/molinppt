/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "strategy-consulting",
  "templateName": "战略咨询方案",
  "themeId": "board",
  "themeName": "董事会汇报",
  "style": "strategy-board-report",
  "visual": {
    "primary": "172033",
    "accent": "B68A3A",
    "secondary": "2F7D68",
    "warning": "B94A48",
    "background": "F3F5F7",
    "surface": "FFFFFF",
    "title": "101828",
    "body": "344054",
    "layout": "strategy-board-report",
    "variant": "board"
  },
  "layoutSchema": {
    "defaultCoverLayout": "strategy-board-cover",
    "defaultContentLayout": "strategy-board-decision-summary",
    "allowedLayouts": [
      "strategy-board-cover",
      "strategy-board-decision-summary",
      "strategy-board-background",
      "strategy-board-option-matrix",
      "strategy-board-risk-return",
      "strategy-board-resolution",
      "strategy-board-closing",
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
