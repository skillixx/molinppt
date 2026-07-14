/**
 * 教学成果汇报官方模板渲染入口。
 * 当前模板的真实预览和 PPTX 导出由 ppt-service.js / ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  "templateId": "teaching-achievement-report",
  "templateName": "教学成果汇报",
  "themeId": "showcase",
  "themeName": "成果展示",
  "style": "teaching-achievement-gallery",
  "visual": {
    "primary": "1E3A8A",
    "accent": "14B8A6",
    "secondary": "F59E0B",
    "success": "22C55E",
    "background": "F4F8FB",
    "surface": "FFFFFF",
    "title": "172554",
    "body": "334155",
    "layout": "teaching-achievement-showcase",
    "variant": "showcase"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
