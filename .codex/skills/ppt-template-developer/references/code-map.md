# 项目模板代码地图

## 官方模板目录

```text
templates/official/
```

当前使用三级结构：

```text
templates/official/<category>/<template>/<theme>/
```

每个主题目录：

```text
manifest.json
template.json
renderer.js
assets/
```

## 模板同步

核心文件：

```text
ppt-ai-app/src/official-templates.js
ppt-ai-app/scripts/list-official-templates.js
ppt-ai-app/scripts/seed-official-templates.js
ppt-ai-app/scripts/seed-official-template-categories.js
```

要点：

- `syncOfficialTemplates` 会递归查找 `manifest.json`。
- `_shared` 目录不会参与同步。
- `manifest.slug` 必须全局唯一。
- `template_file` 必须存在。
- `thumbnail_file` 和 `source_file` 可选。

## 模板注册和视觉解析

核心文件：

```text
ppt-ai-app/src/templates.js
```

关键点：

- `DEFAULT_TEMPLATES` 保存内置官方模板兜底配置。
- `TemplateManager` 合并数据库官方模板、个人模板和内置兜底模板。
- `resolveTemplateVisual` 根据 `templateId`、`theme`、`template.visual` 合成最终 `visual`。
- 新样式如果和现有骨架差异很大，应新增独立 `visual.layout`。

## 在线预览

核心文件：

```text
ppt-ai-app/src/ppt-service.js
```

关键区域：

- `previewDeck` 生成预览入口。
- `renderDeckPreviewHtml` 生成 HTML。
- 现有模板通常有：
  - `isXxxVisual`
  - `xxxPreviewScene`
  - CSS 规则块
  - HTML 装饰片段

要求：

- 页面上不显示主题风格名称。
- 预览需要和 PPTX 导出主要版式一致。

## PPTX 导出

核心文件：

```text
ppt-ai-app/src/ppt-exporter.js
```

关键区域：

- `PptExportService`
- `resolveDeckVisual`
- `slideXml`
- 各模板的 `xxxDecorationsXml`
- `textShapeXml`、`solidShapeXml`、`rectShapeXml`、`pictureXml`

要求：

- 主体内容用 DrawingML 代码绘制，保持可编辑。
- 局部图片通过 assets 插入，不使用整页截图背景。
- 与 HTML 预览保持主要结构一致。

## 测试入口

```text
ppt-ai-app/test/framework.test.js
ppt-ai-app/test/ppt-business.test.js
ppt-ai-app/test/exporter.test.js
ppt-ai-app/test/official-templates.test.js
```

常见测试职责：

- `framework.test.js`：模板管理、视觉解析、分类。
- `ppt-business.test.js`：业务流程、HTML 预览、生成工作台。
- `exporter.test.js`：PPTX/PDF 导出 XML 结构。
- `official-templates.test.js`：官方模板目录扫描和同步。

## 文档入口

```text
docs/new-template-style-guide.md
docs/template-expansion-requirements.md
docs/template-theme-style-details.md
```

开发前先查这些文档，开发后同步更新进度状态。
