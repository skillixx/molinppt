# 编辑叙事素材说明

- `editorial-catalog-source.svg`：模板管理缩略图的可维护源文件，展示封面、品牌历程、人物引语和价值证据四类代表页型。
- `thumbnail.png` 位于主题目录根部，由上述 SVG 的视觉系统重新绘制生成，并通过 `manifest.json` 的 `thumbnail_file` 同步到对象存储。
- 页面主体仍由 `ppt-service.js` 和 `ppt-exporter.js` 使用代码绘制；SVG/PNG 只用于模板目录和管理端缩略图，不作为整页 PPT 背景。
