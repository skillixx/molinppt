---
name: generate-ppt-template-thumbnails
description: Generate polished catalog thumbnails for one PPTX or every PPTX in a directory. Use when Codex needs to render PowerPoint templates, infer template and theme names from filenames or repository metadata, select representative slides, create premium multi-slide template showcase images with image generation, batch-process a downloaded template directory, resume interrupted work, or validate thumbnail coverage and quality.
---

# PPT 模板缩略图生成

把 PPT 模板制作成“模板商城介绍图”，不要把首页截图或等宽九宫格当作最终缩略图。

## 输入与输出

- 输入：单个 `.pptx`，或包含多个 `.pptx` 的目录。
- 默认输出：输入目录下的 `thumbnails/`。
- 文件名：`<pptx-base-name>-thumbnail.png`。
- 中间文件：`<输出目录>/.work/<pptx-base-name>/slides/`。
- 批次记录：`<输出目录>/thumbnail-manifest.json`。

## 工作流程

1. 运行 `scripts/export-ppt-slides.ps1`，扫描 PPTX 并导出所有页面截图。
2. 从文件名、PPT 标题、仓库模板清单中提取：模板名称、主题名称、分类；无法确认时使用 PPT 文件名，并在清单中标记 `needs_review`。
3. 检查全部页面截图，选择 4–6 张有明显结构差异的代表页：封面、目录/总览、数据页、分析页、行动页、结尾页。不要只按页码机械抽样。
4. 使用 `imagegen` Skill 和内置图片生成工具，把代表页作为参考图生成一张 16:9 模板介绍缩略图。详细提示词读取 `references/imagegen-prompt.md`。
5. 生成结果必须满足：主页面清晰、内页有空间层次、标题准确、模板色彩可识别、没有水印和伪造 Logo。
6. 将最终图片复制到约定输出路径，保留图片生成工具的原始结果。
7. 更新 `thumbnail-manifest.json`，记录输入、输出、状态、主题名称、代表页、错误信息和生成时间。

## 批量与断点续跑

- 默认跳过已有最终 PNG 且清单状态为 `completed` 的项目。
- 仅在用户明确要求时使用 `-Force` 覆盖。
- 单个 PPT 失败不能中断整批；记录 `failed` 后继续。
- 每处理完一个 PPT 立即写入清单，不要等整批结束。
- 输入文件按完整路径排序，确保重跑顺序稳定。

## 缩略图设计要求

- 目标是模板商城封面，不是内容摘要海报。
- 主视觉占画面约 45%–60%，其余页面形成前后层级。
- 保留真实页面比例与主要配色，允许改变展示角度、阴影和背景。
- 只保留两级文字：模板名、主题名；文字必须逐字准确。
- 不直接平铺 4–10 个等大页面。
- 不放大 PPT 内具体业务数据作为宣传文案。
- 不生成额外人物、品牌、Logo、水印或无关装饰。

## 验收

- 输出为可打开的 PNG，建议尺寸至少 `1536×1024` 或等价 16:9 高清尺寸。
- 模板名和主题名无错字。
- 至少展示 3 种不同页面结构。
- 主页面和内页没有明显变形、裁断或超出画布。
- 缩小到模板卡片尺寸后仍能看出模板主色和版式特征。
- 批量模式下：`completed + failed + skipped = discovered`。

## 调用项目 Agent

需要处理整个下载目录时，按 `.agents/ppt-thumbnail-workflow/README.md` 调用批处理 Agent。
