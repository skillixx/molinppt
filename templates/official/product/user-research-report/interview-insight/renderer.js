export const templateRenderer = {
  id: "product-user-research-report-interview-insight",
  name: "用户研究报告 - 访谈洞察",
  category: "product",
  templateName: "用户研究报告",
  theme: "interview-insight",
  layout: "product-interview-insight",
  variant: "interview-insight",
  description: "用于用户访谈总结、用户画像、需求机会识别和产品优化建议的产品研究模板。",
};

/**
 * 返回模板视觉参数，供官方模板同步、生成工作台和导出链路解析。
 * 页面主体由代码绘制，访谈场景素材只作为局部装饰，确保 PPTX 内容可编辑。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "155E75",
    accent: "F59E0B",
    secondary: "7C3AED",
    background: "F6F8FB",
    surface: "FFFFFF",
    title: "132238",
    body: "475569",
    layout: "product-interview-insight",
    variant: "interview-insight",
  };
}
