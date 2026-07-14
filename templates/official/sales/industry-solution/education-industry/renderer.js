/**
 * 教育行业解决方案模板元数据。
 * 这里不直接绘制整页图片，主体布局由在线预览和 PPTX 导出代码共同实现。
 */
export const templateRenderer = {
  id: "sales-industry-solution-education-industry",
  name: "行业解决方案 - 教育行业",
  category: "sales",
  categoryName: "销售方案",
  baseTemplateId: "industry-solution",
  themeId: "education-industry",
  layout: "sales-education-solution",
  variant: "education-industry",
  description: "面向教育信息化方案、教学平台建设、学习数据分析和教育客户提案的官方模板。",
  tags: ["sales", "industry-solution", "education-industry", "learning-platform"],
};

/**
 * 返回模板视觉参数，供同步脚本和模板管理器识别。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "155E75",
    accent: "22C55E",
    background: "EAF7F7",
    surface: "FFFFFF",
    title: "0F2F3A",
    body: "365A64",
    layout: "sales-education-solution",
    variant: "education-industry",
  };
}
