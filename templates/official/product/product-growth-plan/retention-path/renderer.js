/**
 * 官方代码模板渲染入口。
 * 当前渲染仍由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  id: "product-product-growth-plan-retention-path",
  name: "产品增长方案 - 留存路径",
  category: "product",
  templateName: "产品增长方案",
  theme: "retention-path",
  layout: "product-retention-path",
  variant: "retention-path",
  description: "用于产品增长、用户激活、留存提升和转化路径优化的产品规划模板。",
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "111827",
    accent: "16A3A6",
    secondary: "7C3AED",
    warning: "F97316",
    background: "EFF6FF",
    surface: "FFFFFF",
    title: "0B1220",
    body: "334155",
    layout: "product-retention-path",
    variant: "retention-path",
  };
}
