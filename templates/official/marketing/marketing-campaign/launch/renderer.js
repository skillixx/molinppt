/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "marketing-campaign",
  "templateName": "营销活动方案",
  "themeId": "launch",
  "themeName": "新品发布",
  "style": "campaign-story",
  "visual": {
    "primary": "E11D48",
    "accent": "F59E0B",
    "background": "FFF3F5",
    "surface": "FFFFFF",
    "title": "2A0F1B",
    "body": "5B3441",
    "layout": "marketing",
    "variant": "launch"
  },
  "layoutSchema": {
    "defaultCoverLayout": "campaign-cover",
    "defaultContentLayout": "campaign-content",
    "allowedLayouts": [
      "campaign-cover",
      "campaign-content",
      "hero",
      "story",
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
