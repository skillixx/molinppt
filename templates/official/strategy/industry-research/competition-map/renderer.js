export const templateRenderer = {
  id: "strategy-industry-research-competition-map",
  name: "行业研究报告 - 竞争地图",
  category: "strategy",
  templateName: "行业研究报告",
  theme: "competition-map",
  layout: "strategy-competition-map",
  variant: "competition-map",
  description: "用于竞品分析、市场定位、竞争格局判断和差异化策略汇报的咨询报告模板。",
};

/**
 * 返回模板视觉参数，供官方模板同步和生成工作台解析。
 * 主体版式由代码绘制，局部贴图只承担轻量装饰，不作为整页背景。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "102A43",
    accent: "12A5A6",
    background: "F4F8FB",
    surface: "FFFFFF",
    title: "071A2D",
    body: "3D5363",
    layout: "strategy-competition-map",
    variant: "competition-map",
  };
}
