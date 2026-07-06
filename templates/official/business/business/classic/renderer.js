/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "business",
  "templateName": "高管商务汇报",
  "themeId": "classic",
  "themeName": "经典商务",
  "style": "executive-report",
  "visual": {
    "primary": "1F2A37",
    "accent": "B89B5E",
    "background": "E8ECEF",
    "surface": "FFFFFF",
    "title": "111827",
    "body": "374151",
    "layout": "top-band"
  },
  "layoutSchema": {
    "defaultCoverLayout": "cover",
    "defaultContentLayout": "image-report",
    "allowedLayouts": [
      "cover",
      "agenda",
      "section-divider",
      "image-report",
      "three-steps",
      "four-steps",
      "metrics",
      "showcase",
      "retrospective",
      "next-plan",
      "closing",
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
