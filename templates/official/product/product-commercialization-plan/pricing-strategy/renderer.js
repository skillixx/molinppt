export const templateRenderer = {
  id: "product-product-commercialization-plan-pricing-strategy",
  name: "产品商业化方案 - 定价策略",
  category: "product",
  templateName: "产品商业化方案",
  theme: "pricing-strategy",
  layout: "product-pricing-strategy",
  variant: "pricing-strategy",
  description: "用于产品定价设计、套餐权益说明、商业化路径和收入模型汇报的产品商业化模板。",
};

/**
 * 返回模板视觉参数，供官方模板同步和生成工作台解析。
 * 主体版式由代码绘制，局部资产只用于产品样机、价格标签和套餐装饰。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "14213D",
    accent: "F4B740",
    secondary: "2EC4B6",
    warning: "EF476F",
    background: "F3F6FA",
    surface: "FFFFFF",
    title: "0B1F33",
    body: "334155",
    layout: "product-pricing-strategy",
    variant: "pricing-strategy",
  };
}
