# Repository Guidelines

## 项目定位

本仓库是 Moling（魔灵）平台的 AI PPT 应用项目，核心业务代码在 `ppt-ai-app/`。项目目标是支持用户从主题、大纲、模板和资料生成可预览、可编辑、可导出的 PPT。

## 目录结构

- `ppt-ai-app/`：当前主要应用代码，Node.js ESM 项目。
- `templates/official/`：官方 PPT 模板目录，按分类、模板、主题风格组织。
- `.agents/`：本项目可复用 Agent 工作流定义，PPT 模板开发优先看 `.agents/ppt-template-workflow/`。
- `.codex/skills/`：项目内 Codex skill，例如 `ppt-template-developer`。
- `app/`：产品规划、分支规范、路线图等项目文档。
- `docs/`：架构、模块、模板规划、开发说明等文档。
- `presenton/`：上游演示生成项目参考目录，只作为产品体验参考，除非任务明确要求，否则不要大范围改动。
- `molin_docs/`：魔灵平台对接相关文档。

## 常用命令

在 `ppt-ai-app/` 目录执行：

```powershell
npm test
npm run migrate
npm start
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
```

本地常用服务端口是 `5778`，健康检查：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

## 代码风格

- 使用 Node.js >= 20 和 ESM imports。
- 保持模块边界清晰：
  - 魔灵 HTTP 调用放在 `moling-client.js`。
  - 环境变量解析放在 `config.js`。
  - 路由和 session 处理放在 `app.js`。
  - 计费逻辑放在 `billing.js`。
  - 文件操作放在 `files.js`。
  - PPT 模板注册和视觉解析优先看 `templates.js`。
  - 在线预览相关逻辑看 `ppt-service.js`。
  - PPTX/PDF 导出相关逻辑看 `ppt-exporter.js`。
- 导出的类和方法需要 JSDoc。
- 文件名和 slug 使用 kebab-case。
- 编写项目代码时，对复杂布局、模板映射、同步逻辑添加中文注释。
- 不要为了小改动引入不必要的新抽象。

## PPT 模板开发规则

做官方模板时优先使用项目 skill：

```text
.codex/skills/ppt-template-developer/SKILL.md
```

做单个模板从设计到发布时优先使用 Agent 工作流：

```text
.agents/ppt-template-workflow/README.md
.agents/ppt-template-workflow/registry.json
```

官方模板目录规范：

```text
templates/official/<category-slug>/<template-slug>/<theme-slug>/
  manifest.json
  template.json
  renderer.js
  thumbnail.png
  assets/
```

模板开发要求：

- 不能只换颜色，必须有明确版式差异。
- 不要直接用整页模板图片作为背景。
- 主体版式尽量用代码实现，保证 PPTX 可编辑。
- 图片只能用于局部装饰、纹理、场景图、图标或氛围资产。
- PPT 页面中不要直接显示模板名称或主题风格名称。
- 文本内容必须动态替换，不能写死业务内容。
- 首页、内容页、数据页、分析页、结尾页要有明显差异。
- 在线预览和导出 PPTX 的核心布局必须一致。
- 新模板或删除模板后，需要运行官方模板扫描和同步命令。

## 测试要求

在 `ppt-ai-app/` 中使用 Node 内置 `node:test`。

常见测试文件：

- `test/framework.test.js`：模板注册、视觉解析、框架能力。
- `test/ppt-business.test.js`：PPT 生成、在线预览、业务流程。
- `test/exporter.test.js`：PPTX/PDF 导出。
- `test/official-templates.test.js`：官方模板同步和目录扫描。

模板相关改动至少运行：

```powershell
cd ppt-ai-app
npm run list:official-templates
npm run seed:official-templates
npm test
```

## Git 和提交

- 默认在当前分支工作，提交前检查 `git status --short`。
- 不要提交 `.env`、真实 token、生成导出文件、本地数据库、`node_modules`。
- 不要回滚用户已有改动，除非用户明确要求。
- 提交信息使用中文，格式建议：

```text
<type>(<scope>): <简短说明>
```

示例：

```text
fix(ppt-template): 修复营销模板预览布局
docs(agent): 增加模板开发Agent工作流
```

## 安全和配置

- 所有运行时配置来自环境变量。
- `.env.example` 和 `ppt-ai-app/.env.example` 只保留示例，不写真实密钥。
- 计费数量保持 decimal string。
- 魔灵平台 ID 按接口约定使用 JSON number。
- 用户文件、生成资产、任务、下载链接都必须校验 owner。

## Agent 回复要求

- 默认使用中文回复。
- 代码、命令、文件路径、日志保持原始语言。
- 解释、总结、提交说明、PR 描述使用中文。
- 处理 UI 或模板问题时，优先给出已验证结果和具体文件路径。
- 如果未能运行测试或验证，必须明确说明。

