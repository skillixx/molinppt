/**
 * 制造行业解决方案模板元数据入口。
 * 主体版式由在线预览和 PPTX 导出代码共同绘制，确保模板内容可编辑且预览导出一致。
 */
export const templateRenderer = {
  id: "sales-industry-solution-manufacturing-industry",
  name: "行业解决方案 - 制造行业",
  category: "sales",
  categoryName: "销售方案",
  baseTemplateId: "industry-solution",
  themeId: "manufacturing-industry",
  layout: "sales-manufacturing-solution",
  variant: "manufacturing-industry",
  description: "面向制造业数字化方案、工厂流程优化、设备数据看板和工业客户提案的官方模板。",
  tags: ["sales", "industry-solution", "manufacturing-industry", "factory", "industrial-dashboard"],
};

/**
 * 返回当前主题的模板视觉配置，供官方模板同步和模板管理识别。
 *
 * @returns {object}
 */
export function getTemplateVisual() {
  return {
    primary: "123A5A",
    accent: "17A7B8",
    background: "E6ECF2",
    surface: "FFFFFF",
    title: "1F2933",
    body: "4B5B68",
    layout: "sales-manufacturing-solution",
    variant: "manufacturing-industry",
  };
}
