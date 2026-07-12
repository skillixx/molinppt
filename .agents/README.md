# 本地 Agent 目录

这个目录保存项目内可复用的 Agent 定义。

## PPT 模板开发

入口目录：

```text
.agents/ppt-template-workflow/
```

推荐从这里开始：

```text
.agents/ppt-template-workflow/README.md
```

机器可读索引：

```text
.agents/ppt-template-workflow/registry.json
```

## PPT 模板缩略图批处理

入口目录：

```text
.agents/ppt-thumbnail-workflow/
```

该工作流配合项目 Skill 使用：

```text
.codex/skills/generate-ppt-template-thumbnails/SKILL.md
```

Goal 创建模板案例说明：

```text
docs/goal-agent-template-example.md
```

最短使用方式：

```md
创建一个 goal：使用 PPT 模板开发 Agent 工作流，完整开发【分类 / 模板 / 主题风格】模板。
```

## 调用示例

```md
请使用 .agents/ppt-template-workflow/01-requirement-analyst.md，
根据下面信息输出模板需求说明：

模板分类：
模板名称：
主题风格：
目标用户：
使用场景：
参考图片：
特殊要求：
```

如果要完整做一个模板，按 `registry.json` 的 `recommendedOrder` 顺序执行。
