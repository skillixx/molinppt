/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "marketing-campaign",
  "templateName": "营销活动方案",
  "themeId": "brand",
  "themeName": "品牌传播",
  "style": "campaign-story",
  "visual": {
    "primary": "5B21B6",
    "accent": "06B6D4",
    "background": "F2F0FF",
    "surface": "FFFFFF",
    "title": "20113D",
    "body": "4B3D68",
    "layout": "marketing",
    "variant": "brand"
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
