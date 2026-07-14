export const templateRenderer = {
  id: "strategy-competitor-analysis-swot-map",
  name: "竞争对手分析 - SWOT 地图",
  category: "strategy",
  templateName: "竞争对手分析",
  theme: "swot-map",
  layout: "strategy-swot-map",
  variant: "swot-map",
  description: "用于竞品分析、SWOT 评估、竞争坐标定位和差异化策略汇报的咨询报告模板。",
};

/**
 * 返回模板视觉参数，供官方模板同步和生成工作台解析。
 * 主体版式由代码绘制，局部贴图只承载轻量装饰，不作为整页背景。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "102A43",
    accent: "12A5A6",
    secondary: "22C55E",
    warning: "F97316",
    background: "F5F8FB",
    surface: "FFFFFF",
    title: "071A2D",
    body: "3D5363",
    layout: "strategy-swot-map",
    variant: "swot-map",
  };
}
