export const templateRenderer = {
  templateId: "operating-dashboard",
  templateName: "经营数据看板",
  themeId: "control-room",
  themeName: "管理驾驶舱",
  style: "operating-dashboard",
  visual: {
    primary: "0B1F3A",
    accent: "2DD4BF",
    background: "EAF2F6",
    surface: "FFFFFF",
    title: "071827",
    body: "334155",
    layout: "executive",
    variant: "control-room"
  }
};

export function getTemplateVisual() {
  return templateRenderer.visual;
}
