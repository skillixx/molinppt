---
name: ppt-template-developer
description: Develop, update, scaffold, or review official PPT templates for this molinppt/ppt-ai-app project. Use when working on templates/official template directories, manifest.json/template.json/renderer.js, template categories/themes, PPT template design requirements, online HTML preview in ppt-service.js, PPTX export drawing in ppt-exporter.js, TemplateManager/template registry changes, template thumbnails/assets, or tests for newly added commercial PPT templates.
---

# PPT Template Developer

## 目标

使用本技能开发本项目的官方 PPT 模板，确保模板目录、元数据、在线预览、PPTX 导出、素材和测试一起落地。

## 必读顺序

先按任务读取对应参考文件：

- 做新模板或大改模板：读 `references/workflow.md` 和 `references/code-map.md`。
- 需要选模板分类、模板名、主题风格：读项目文档 `docs/template-expansion-requirements.md`。
- 需要设计主题视觉、背景、配图、字段组合：读项目文档 `docs/template-theme-style-details.md`。
- 需要确认差异化模板原则：读项目文档 `docs/new-template-style-guide.md`。
- 只做小修，比如修一个已有模板样式：读 `references/code-map.md`，再定位相关函数。

## 核心原则

- 不要只新增 `manifest.json` 和 `template.json` 就声称完成新模板；差异化模板必须同时覆盖在线预览和 PPTX 导出。
- 不要直接使用整页模板截图作为背景；主体版式必须用代码绘制，保证 PPTX 可编辑。
- 图片只用于局部装饰、业务场景、产品 mockup、纹理或图标。
- 主题风格名称只用于选择器和模板管理，不直接显示在 PPT 页面中。
- 首页、内容页、分析页、结尾页要有明显不同结构。
- 在线预览和下载 PPTX 的主要布局必须一致。
- 编写代码时使用中文注释，避免无意义注释。

## 开发流程

1. 确认模板范围：分类、模板、主题风格。
2. 查阅规划文档，提取视觉定位、背景、配图、字段重点。
3. 判断是复用现有布局，还是新增独立 `visual.layout`。
4. 为差异化模板优先新增独立 `visual.layout`，避免套旧骨架。
5. 创建目录：

```text
templates/official/<category-slug>/<template-slug>/<theme-slug>/
```

6. 创建或更新：

```text
manifest.json
template.json
renderer.js
assets/
thumbnail.png
```

7. 更新在线预览：`ppt-ai-app/src/ppt-service.js`。
8. 更新 PPTX 导出：`ppt-ai-app/src/ppt-exporter.js`。
9. 确认模板注册和视觉解析：`ppt-ai-app/src/templates.js` 或官方模板同步逻辑。
10. 补充测试：优先改 `ppt-ai-app/test/exporter.test.js`、`ppt-ai-app/test/ppt-business.test.js`、`ppt-ai-app/test/framework.test.js`。
11. 执行列表、同步、测试和重启验证。

## 脚手架

需要创建新主题目录时，优先使用脚本：

```powershell
python .codex/skills/ppt-template-developer/scripts/scaffold_official_template.py `
  --category marketing `
  --category-name 市场营销 `
  --template growth-marketing-plan `
  --template-name 增长营销方案 `
  --theme aarrr `
  --theme-name AARRR `
  --layout growth-marketing `
  --variant aarrr
```

脚本只创建基础目录和元数据，不会实现预览或 PPTX 绘制。

## 验证命令

在 `ppt-ai-app/` 下执行：

```powershell
$env:OFFICIAL_TEMPLATES_DIR="../templates/official"
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
npm test
```

如果改了运行中的平台，完成后重启服务并检查：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

## 完成标准

一个模板主题至少满足：

- 模板目录存在，且包含 `manifest.json`、`template.json`、`renderer.js`、`assets/`。
- 模板能被 `npm run list:official-templates` 识别。
- 生成工作台能选择分类、模板、主题风格。
- HTML 预览显示新样式。
- PPTX 导出显示同样的主要版式。
- 页面不显示主题风格名称。
- 测试通过。
