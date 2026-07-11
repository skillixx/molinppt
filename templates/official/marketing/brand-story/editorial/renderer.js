/**
 * 官方代码模板渲染入口。
 * 当前 PPT 渲染仍由 ppt-exporter.js 和 ppt-service.js 统一调度；
 * 这个文件先承载模板目录化后的独立元数据，后续可把该主题的绘制代码逐步迁入这里。
 */
export const templateRenderer = {
  "templateId": "brand-story",
  "templateName": "品牌故事叙事",
  "themeId": "editorial",
  "themeName": "编辑叙事",
  "style": "brand-narrative",
  "visual": {
    "primary": "2A2F3F",
    "accent": "C7825A",
    "background": "F6F1EA",
    "surface": "FFFDFC",
    "title": "171B26",
    "body": "4A5160",
    "layout": "brand-story-editorial",
    "variant": "editorial"
  },
  "layoutSchema": {
    "defaultCoverLayout": "editorial-cover",
    "defaultContentLayout": "editorial-story",
    "allowedLayouts": [
      "editorial-cover",
      "editorial-opener",
      "editorial-timeline",
      "editorial-interview",
      "editorial-manifesto",
      "editorial-feature",
      "editorial-evidence",
      "editorial-closing"
    ]
  },
  // 页面角色契约用于说明专用布局语义；实际标题和正文仍由用户大纲动态注入。
  "pageRoles": [
    { "id": "cover", "layout": "editorial-cover", "purpose": "品牌年刊封面和导读" },
    { "id": "opener", "layout": "editorial-opener", "purpose": "首字下沉与跨栏故事导读" },
    { "id": "timeline", "layout": "editorial-timeline", "purpose": "品牌发展历程和关键节点" },
    { "id": "interview", "layout": "editorial-interview", "purpose": "人物专访和核心引语" },
    { "id": "manifesto", "layout": "editorial-manifesto", "purpose": "品牌主张和价值证据" },
    { "id": "feature", "layout": "editorial-feature", "purpose": "品牌摄影与双栏图文故事" },
    { "id": "evidence", "layout": "editorial-evidence", "purpose": "品牌成果和数据证据" },
    { "id": "closing", "layout": "editorial-closing", "purpose": "品牌宣言和下一章节" }
  ]
};

/**
 * 返回当前主题的模板视觉配置，供后续模板注册器直接读取。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}

/**
 * 返回编辑叙事主题支持的页面角色，供模板检查器和后续目录化渲染器复用。
 * @returns {Array<{id: string, layout: string, purpose: string}>}
 */
export function getTemplatePageRoles() {
  return templateRenderer.pageRoles;
}
