export const templateRenderer = {
  templateId: "operating-dashboard",
  templateName: "经营数据看板",
  themeId: "warning",
  themeName: "指标预警",
  style: "operating-dashboard",
  visual: {
    primary: "1E293B",
    accent: "F59E0B",
    background: "F4F1EA",
    surface: "FFFFFF",
    title: "111827",
    body: "475569",
    layout: "executive",
    variant: "warning"
  }
};

export function getTemplateVisual() {
  return templateRenderer.visual;
}
