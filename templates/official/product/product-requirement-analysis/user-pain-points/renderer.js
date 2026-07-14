export const templateRenderer = {
  id: "product-product-requirement-analysis-user-pain-points",
  name: "产品需求分析 - 用户痛点",
  category: "product",
  templateName: "产品需求分析",
  theme: "user-pain-points",
  layout: "product-pain-points",
  variant: "user-pain-points",
  description: "用于产品方案汇报、需求评审、用户痛点分析和功能优先级规划的产品洞察模板。",
};

/**
 * 返回模板视觉参数，供官方模板同步和生成工作台解析。
 * 主体版式由代码绘制，局部资产只用于轻量画像和便签装饰。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "1D4ED8",
    accent: "F97316",
    secondary: "14B8A6",
    background: "F4F7FB",
    surface: "FFFFFF",
    title: "10233F",
    body: "405166",
    layout: "product-pain-points",
    variant: "user-pain-points",
  };
}
