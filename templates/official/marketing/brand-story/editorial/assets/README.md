# 编辑叙事素材说明

- `editorial-catalog-source.svg`：模板管理缩略图的可维护源文件，展示封面、历程和人物专访三种代表页型。
- 页面主体由 `ppt-service.js` 和 `ppt-exporter.js` 使用代码绘制，SVG 不会作为整页 PPT 背景。
- `thumbnail.png` 位于主题目录根部，由上述 SVG 渲染生成，并通过 `manifest.json` 的 `thumbnail_file` 同步到对象存储。
