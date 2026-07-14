/**
 * 官方代码模板渲染入口。
 * 当前项目仍由 ppt-service.js 和 ppt-exporter.js 统一调度预览与导出，本文件承载目录化模板元数据。
 */
export const templateRenderer = {
  templateId: "market-entry-strategy",
  templateName: "市场进入策略",
  themeId: "region-entry",
  themeName: "区域进入",
  style: "strategy-region-entry",
  visual: {
    id: "strategy-market-entry-strategy-region-entry",
    primary: "102A43",
    accent: "14B8A6",
    secondary: "F2B84B",
    warning: "F97316",
    background: "EEF6F8",
    surface: "FFFFFF",
    title: "0B1F33",
    body: "334155",
    layout: "strategy-region-entry",
    variant: "region-entry",
  },
};

/**
 * 返回当前主题的模板视觉配置，供模板注册器读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
