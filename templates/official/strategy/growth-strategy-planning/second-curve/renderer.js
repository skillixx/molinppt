/**
 * 官方代码模板渲染入口。
 * 当前项目仍由 ppt-service.js 与 ppt-exporter.js 统一调度预览和导出绘制，
 * 本文件承载目录化模板元数据，方便后续迁移为独立渲染器。
 */
export const templateRenderer = {
  templateId: "growth-strategy-planning",
  templateName: "增长战略规划",
  themeId: "second-curve",
  themeName: "第二曲线",
  style: "strategy-growth",
  visual: {
    primary: "0E2A47",
    accent: "16B8A6",
    secondary: "F2B84B",
    background: "EEF6F4",
    surface: "FFFFFF",
    title: "071A2D",
    body: "315168",
    layout: "strategy-second-curve",
    variant: "second-curve",
  },
};

/**
 * 返回当前主题的模板视觉配置，供模板注册器读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
