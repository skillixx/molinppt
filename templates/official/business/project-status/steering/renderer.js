/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "project-status",
  "templateName": "项目状态汇报",
  "themeId": "steering",
  "themeName": "例会汇报",
  "style": "status-update",
  "visual": {
    "primary": "1F2F46",
    "accent": "D59E3D",
    "background": "EEF2F6",
    "surface": "FFFFFF",
    "title": "111827",
    "body": "3F4A5A",
    "layout": "status-report",
    "variant": "steering"
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
