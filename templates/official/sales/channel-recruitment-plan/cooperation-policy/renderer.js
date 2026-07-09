/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 * 这里保留目录化模板的结构信息，便于同步脚本读取和后续维护。
 */
export const templateRenderer = {
  "templateId": "channel-recruitment-plan",
  "templateName": "渠道招商方案",
  "themeId": "cooperation-policy",
  "themeName": "合作政策",
  "style": "channel-recruitment-policy",
  "visual": {
    "primary": "0F2D4A",
    "accent": "10B981",
    "background": "F3F8F7",
    "surface": "FFFFFF",
    "title": "10233D",
    "body": "40566D",
    "secondary": "D9A441",
    "warning": "F97316",
    "layout": "channel-recruitment-policy",
    "variant": "cooperation-policy"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
