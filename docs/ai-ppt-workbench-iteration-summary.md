# AI PPT 工作台迭代总结

## 变更范围

本次迭代围绕 AI PPT 生成工作台、模板管理、资产库、在线预览和导出一致性做了集中优化，目标是让用户从“生成大纲”到“在线预览、二次调整、下载 PPTX/PDF、回看历史 PPT”的链路更稳定、更接近真实 PPT 文件。

## 核心能力

### 生成工作台

- 生成页支持 1-32 页选择，默认 6 页。
- 输入态和大纲态改为居中工作流布局，减少无关侧栏干扰。
- 生成 PPT 后提供“返回大纲内容”按钮，允许用户回到已生成大纲继续编辑。
- 预览页支持点击单页，打开结构编辑弹窗，直接修改标题、版式和要点。
- AI 单页优化增加开关和加载动画，避免误触发，并在优化后刷新当前预览内容。

### 真实 PPTX 预览

- 新增 `LibreOfficePptPreviewRenderer`，当环境具备 LibreOffice/soffice 时，在线预览优先使用下载同源 PPTX 转换出的 PDF 或 PNG 图片。
- 如果渲染器不可用或转换失败，自动回退到原 HTML 预览，保证基础预览可用。
- 新增环境变量：
  - `PPT_PREVIEW_RENDERER_COMMAND`：指定 LibreOffice/soffice 路径。
  - `PPT_PREVIEW_IMAGE_RENDERER_COMMAND`：指定 `pdftoppm` 路径，用于 PDF 转 PNG。
  - `PPT_PREVIEW_RENDERER_TIMEOUT_MS`：真实 PPTX 渲染超时时间，默认 30000。

### 模板体系

- 官方模板分类和模板名称改为中文，更贴近实际用户认知。
- 删除并屏蔽开源城市展示模板、开源通用演示样例，避免低质量样例进入前台。
- 模板管理页移除不需要的栏目功能，改为更直接的模板浏览。
- 模板卡片缩略图改为规则化封面缩略图，保证每个模板有差异化标题、内容和视觉结构。
- 缩略图调整标题层级，避免一级标题被装饰层遮挡。

### 资产库

- 历史 PPT 增加带文字的缩略图展示。
- 增加按标题搜索历史 PPT。
- 增加时间筛选：全部时间、近 7 天、近 30 天、近 90 天。
- 增加分页，每页 20 个历史 PPT。
- 历史 PPT 默认只展示列表，点击“打开预览”后才加载在线预览。
- 资产库预览态的返回按钮改为“返回资产库”，关闭当前预览并回到历史列表。

### AI 设计技能

- 新增 `ppt-design-skill.js`，以精简规则形式注入“专业 PPT 设计大师”技能。
- 大纲、整稿生成和单页优化都会自动加载 `designSkill`。
- 技能强调：
  - 避免固定三段式和连续四段式卡片堆砌。
  - 至少 25% 内容页使用详情展开页。
  - 增加 `knowledge-detail` 知识点详情挖掘页。
  - 对知识点页面使用 40-80 字重点解释加 1-2 条辅助要点。
  - 标题写成判断句或行动句，突出对象、动作和侧重点。

### PPTX/PDF 导出

- 下载文件名统一改为：
  - `PPT-标题-模板ID-页数p-生成时间-短ID.pptx`
  - `PPT-标题-模板ID-页数p-生成时间-短ID.pdf`
- 文件名保持 ASCII 安全，降低浏览器和网关中文文件名兼容风险。
- PPTX 中不再写入模板名称、模板来源文字和主题名称，避免下载文件页面出现“模板名称”。
- 红金商务模板的 HTML 兜底预览继续对齐 PPTX 导出结构，补齐内容承载面、内框、页脚装饰和页面角色样式。

## 关键代码位置

- `ppt-ai-app/src/app.js`：工作台页面、模板浏览、资产库、单页结构编辑、AI 优化交互。
- `ppt-ai-app/src/ppt-service.js`：PPT 生成流程、真实 PPTX 预览优先级、页数上限。
- `ppt-ai-app/src/ppt-preview-renderer.js`：LibreOffice/pdftoppm 真实 PPTX 预览渲染器。
- `ppt-ai-app/src/prompt-manager.js`：大纲、整稿、单页优化 prompt 注入设计技能和模板上下文。
- `ppt-ai-app/src/ppt-design-skill.js`：专业 PPT 设计大师规则。
- `ppt-ai-app/src/ai-provider.js`：OpenAI-compatible system prompt 支持 `input.designSkill`。
- `ppt-ai-app/src/ppt-exporter.js`：PPTX/PDF 文件命名、模板名称隐藏、红金模板导出结构。
- `ppt-ai-app/src/templates.js`：中文模板分类、官方模板中文化、开源样例屏蔽。
- `templates/official/`：官方模板目录说明和分类配置。

## 测试覆盖

本次改动补充或调整了以下测试：

- `ppt-ai-app/test/config.test.js`：真实 PPTX 预览渲染器环境变量。
- `ppt-ai-app/test/exporter.test.js`：下载文件命名、模板名称隐藏。
- `ppt-ai-app/test/framework.test.js`：开源样例屏蔽、AI provider 设计技能系统提示词。
- `ppt-ai-app/test/official-templates.test.js`：确认仓库官方模板不再包含已删除开源样例。
- `ppt-ai-app/test/ppt-business.test.js`：真实 PPTX 预览优先、兜底预览、工作台 UI、资产库、AI 单页优化和设计技能注入。

建议提交前执行：

```bash
cd ppt-ai-app
npm test
```

## 部署注意

- 不安装 LibreOffice 时系统仍可运行，只是预览使用 HTML 兜底版本。
- 需要真实 PPTX 图片预览时，服务器需安装 LibreOffice；如需逐页 PNG 图片，还需安装 Poppler 的 `pdftoppm`。
- Windows 环境建议显式配置 `PPT_PREVIEW_RENDERER_COMMAND` 和 `PPT_PREVIEW_IMAGE_RENDERER_COMMAND`。
- 生产环境请继续避免提交 `.env`、生成文件、导出文件和本地数据目录。
