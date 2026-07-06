# ppt-ai-app Agent Guidelines

## 子项目定位

`ppt-ai-app/` 是 AI PPT 应用的核心 Node.js ESM 项目，负责登录会话、魔灵平台对接、计费、文件、任务、AI 生成、模板管理、在线预览和 PPTX/PDF 导出。

## 常用命令

```powershell
npm test
npm run migrate
npm start
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
```

本地端口常用 `5778`：

```powershell
$env:APP_PORT='5778'
node --env-file=.env src/server.js
```

健康检查：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

## 主要文件职责

- `src/config.js`：环境变量解析和配置校验。
- `src/app.js`：HTTP 路由、session、权限入口。
- `src/moling-client.js`：魔灵平台 API 客户端。
- `src/billing.js`：计费 reserve、settle、release、consume。
- `src/files.js`：文件上传、下载、存储对象。
- `src/tasks.js`：任务中心。
- `src/ppt-service.js`：PPT 生成、在线预览、资产库、业务流程。
- `src/ppt-exporter.js`：PPTX/PDF 导出绘制。
- `src/templates.js`：模板注册、分类、主题、视觉解析。
- `scripts/seed-official-templates.js`：官方模板同步。
- `scripts/list-official-templates.js`：官方模板扫描。

## 开发约束

- 使用 Node.js >= 20。
- 使用 ESM imports。
- 新增导出类和方法需要 JSDoc。
- 错误通过项目现有 `AppError` 和错误映射风格处理。
- 不能绕过 owner 权限检查。
- 不要把密钥、`.env`、本地数据库、导出文件、日志提交进仓库。
- 代码里复杂逻辑需要中文注释，尤其是 PPT 模板布局、导出 XML、同步逻辑。

## 模板相关改动

模板开发优先阅读：

```text
../.codex/skills/ppt-template-developer/SKILL.md
../.agents/ppt-template-workflow/README.md
```

模板目录在：

```text
../templates/official/
```

模板相关改动通常需要关注：

- `src/templates.js`
- `src/ppt-service.js`
- `src/ppt-exporter.js`
- `test/framework.test.js`
- `test/ppt-business.test.js`
- `test/exporter.test.js`
- `test/official-templates.test.js`

模板验收至少运行：

```powershell
npm run list:official-templates
npm run seed:official-templates
npm test
```

## 测试策略

- 使用 `node:test`。
- 测试文件命名为 `*.test.js`。
- 业务流程改动要覆盖成功和失败路径。
- 计费相关改动要覆盖幂等、余额不足、settle/release 失败和对账。
- 模板改动要覆盖在线预览和 PPTX 导出。
- 文件和资产改动要覆盖 owner 隔离。

## 启动和验证

如果修改了运行中的服务，完成后重启并检查：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

如果修改了模板同步逻辑，还要检查模板数量、缺失模板禁用结果和后台模板管理展示。

