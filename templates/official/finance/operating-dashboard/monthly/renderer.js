export const templateRenderer = {
  templateId: "operating-dashboard",
  templateName: "经营数据看板",
  themeId: "monthly",
  themeName: "月度经营",
  style: "operating-dashboard",
  visual: {
    primary: "164E63",
    accent: "22C55E",
    background: "EEF6F7",
    surface: "FFFFFF",
    title: "0F2F3A",
    body: "3F5660",
    layout: "executive",
    variant: "monthly"
  }
};

export function getTemplateVisual() {
  return templateRenderer.visual;
}
