/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "pitch",
  "templateName": "创业融资路演",
  "themeId": "investor",
  "themeName": "投资人版",
  "style": "pitch-investor-memo",
  "visual": {
    "primary": "101828",
    "accent": "12B76A",
    "background": "F8FAFC",
    "surface": "FFFFFF",
    "title": "101828",
    "body": "475467",
    "secondary": "F79009",
    "layout": "pitch-investor-memo",
    "variant": "investor"
  },
  "layoutSchema": {
    "defaultCoverLayout": "pitch-investor-memo-cover",
    "defaultContentLayout": "pitch-investor-memo-market",
    "allowedLayouts": [
      "pitch-investor-memo-cover",
      "pitch-investor-memo-summary",
      "pitch-investor-memo-market",
      "pitch-investor-memo-revenue",
      "pitch-investor-memo-unit-economics",
      "pitch-investor-memo-moat",
      "pitch-investor-memo-funding",
      "pitch-investor-memo-closing",
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
