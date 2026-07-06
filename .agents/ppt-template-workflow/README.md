# PPT 模板单模板开发 Agent 工作流

这个目录用于保存“单个 PPT 模板从设计到发布”的本地 Agent 定义。后续新增模板时，可以按顺序调用这些 Agent，把模板需求、参考分析、视觉设计、贴图资产、代码实现、预览导出校验和发布同步拆开处理。

## Agent 顺序

1. `01-requirement-analyst.md`：模板需求分析 Agent
2. `02-web-reference-researcher.md`：网络参考分析 Agent
3. `03-visual-system-designer.md`：视觉方案设计 Agent
4. `04-asset-prompt-designer.md`：贴图资产规划 Agent
5. `05-image-asset-generator.md`：贴图生成 Agent
6. `06-template-structure-architect.md`：模板结构架构 Agent
7. `07-template-implementation-engineer.md`：模板开发 Agent
8. `08-preview-export-qa.md`：预览导出校验 Agent
9. `09-sync-release-engineer.md`：同步发布 Agent

## 推荐调用方式

把下面信息发给第 1 个 Agent：

```md
模板分类：
模板名称：
主题风格：
目标用户：
使用场景：
参考图片：
特殊要求：
```

每个 Agent 的输出交给下一个 Agent。不要跳过 `08-preview-export-qa.md`，因为当前项目最容易出现的问题是在线预览、缩略图和导出 PPTX 不一致。

## 统一约束

- 网络参考只能用于分析设计规律，不能直接复制、下载或复刻第三方模板。
- 图片资产不能包含水印、Logo、固定文字、真实品牌标识或版权不明人物。
- 模板主体版式必须用代码实现，图片只用于局部装饰、纹理、场景图或氛围资产。
- PPT 页面中不要直接显示主题风格名称。
- 模板内容必须可动态替换，不能把业务文字写死在模板中。
- 首页、内容页、数据页、结尾页必须有明显结构差异。
- 在线预览和 PPTX 导出的核心布局必须保持一致。
- 编写项目代码时保留中文注释，说明复杂布局或关键映射逻辑。

