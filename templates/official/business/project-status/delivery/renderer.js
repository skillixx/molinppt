/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "project-status",
  "templateName": "项目状态汇报",
  "themeId": "delivery",
  "themeName": "交付跟踪",
  "style": "status-update",
  "visual": {
    "primary": "12324A",
    "accent": "2BA6A0",
    "background": "EEF2F6",
    "surface": "FFFFFF",
    "title": "0F2637",
    "body": "3D5563",
    "layout": "status-report",
    "variant": "delivery"
  },
  "layoutSchema": {
    "defaultCoverLayout": "executive-cover",
    "defaultContentLayout": "executive-content",
    "allowedLayouts": [
      "executive-cover",
      "executive-content",
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
