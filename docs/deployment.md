# AI PPT 工作台部署文档

本文档说明 `ppt-ai-app/` 的部署、初始化、验收和回滚流程。当前应用是单体 Node.js 服务，包含工作台页面、模板管理、PPT 生成编排、文件导出、魔灵登录与计费对接能力。

## 1. 部署目标

生产部署需要保证：

- 用户从魔灵平台携带 `ticket` 进入应用后可以创建会话。
- 用户只能访问自己的大纲、PPT、文件、任务和个人模板。
- 生成、单页优化、导出、下载链路可用。
- 官方模板分类和模板数据已同步到运行时数据库。
- 计费走魔灵权益包，失败和重试不会重复扣费。
- 日志、健康检查和验收脚本可以用于上线确认和问题排查。

## 2. 推荐拓扑

```mermaid
flowchart LR
  User[用户浏览器] --> Proxy[HTTPS 反向代理]
  Proxy --> App[ppt-ai-app Node.js 服务]
  App --> DB[(数据库)]
  App --> Storage[(本地目录或 S3/MinIO)]
  App --> Moling[魔灵平台内部接口]
  App --> LLM[大模型服务]
```

当前服务默认监听 `APP_PORT`。生产建议使用 HTTPS 反向代理转发到应用端口；本地联调常用 `5778`，示例生产 Compose 使用 `5177`。

## 3. 环境要求

- Node.js >= 20。
- 可写数据目录，用于 JSON 数据库或本地文件存储。
- 生产建议准备 MySQL 数据库，`ppt-ai-app/.env.example` 已给出连接示例。
- 可选 S3/MinIO 对象存储，用于持久化文件和模板缩略图。
- 可访问魔灵平台内部接口。
- 可访问 LLM HTTP 接口，例如 DeepSeek chat completions。

## 4. 关键目录和文件

| 路径 | 用途 |
|---|---|
| `ppt-ai-app/` | 应用主目录，部署命令在这里执行。 |
| `ppt-ai-app/.env.example` | 环境变量模板，只能放示例值。 |
| `docker-compose.prod.yml` | 生产向 Docker Compose 示例。 |
| `templates/official/` | 官方模板源目录。 |
| `ppt-ai-app/scripts/` | 迁移、同步、验收和运维脚本。 |
| `docs/debug-commands.md` | 常用排障命令集合。 |

## 5. 环境变量

部署前在 `ppt-ai-app/.env` 中配置真实值。不要提交 `.env`、真实 token、数据库密码或模型密钥。

### 5.1 应用运行

| 变量 | 必填 | 说明 |
|---|---|---|
| `APP_ENV` | 是 | 生产设置为 `production`。 |
| `APP_PORT` | 否 | 应用监听端口，默认 `5177`；本地常用 `5778`。 |
| `APP_BASE_URL` | 建议 | 应用外部访问地址，用于生成回调或下载场景的绝对地址。 |
| `SESSION_TTL_SECONDS` | 否 | 会话有效期，默认 7 天。 |
| `SESSION_COOKIE_SECURE` | 建议 | HTTPS 后设置 `true`；直接 HTTP 联调时设置 `false`，否则浏览器不会保存安全 Cookie。 |
| `RATE_LIMIT_MAX_REQUESTS` | 否 | 单窗口限流请求数，默认示例为 `120`。 |
| `RATE_LIMIT_WINDOW_MS` | 否 | 限流窗口毫秒数，默认示例为 `60000`。 |

### 5.2 魔灵平台

| 变量 | 必填 | 说明 |
|---|---|---|
| `MOLING_API_BASE_URL` | 是 | 魔灵平台接口根地址。 |
| `INTERNAL_API_TOKEN` | 是 | 调用魔灵 `/api/internal/*` 的内部 token。 |
| `MOLING_APP_ID` | 建议 | 魔灵应用 ID，用于校验 ticket 属于当前应用。 |
| `MOLING_PRODUCT_ID` | 建议 | 魔灵产品 ID，用于校验产品和权益上下文。 |
| `MOLING_USER_ENTITLEMENT_MAP` | 临时 | 用户 ID 到权益包 ID 的临时映射，例如 `696:64,479:62`。仅在魔灵用户权益查询接口未上线时使用。 |
| `MOLING_DEFAULT_ENTITLEMENT_ID` | 谨慎 | 单用户冒烟或演示兜底权益包。多用户生产不要配置固定全局权益包。 |
| `LOCAL_MOLING_MOCK` | 否 | 本地 mock 模式，生产必须为 `false`。 |

同机部署访问魔灵内部接口时，优先使用 `127.0.0.1`，不要用 `localhost`，避免 IPv6 `::1` 与 IP 白名单不一致。

### 5.3 数据库和文件存储

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 建议 | 数据库连接。开发可用 `json:./data/ppt-ai-db.json`；生产建议使用 MySQL，如 `mysql://ppt_user:password@127.0.0.1:3306/ppt_ai_app`。 |
| `STORAGE_DIR` | 本地存储必填 | 本地文件存储目录。Docker 示例中是 `/data/storage`。 |
| `OFFICIAL_TEMPLATES_DIR` | 否 | 官方模板目录覆盖值，默认读取仓库 `templates/official/`。 |
| `STORAGE_ENDPOINT` | 对象存储时必填 | S3/MinIO endpoint。 |
| `STORAGE_BUCKET` | 对象存储时必填 | S3/MinIO bucket。 |
| `STORAGE_ACCESS_KEY_ID` | 对象存储时必填 | 对象存储访问 key。 |
| `STORAGE_SECRET_ACCESS_KEY` | 对象存储时必填 | 对象存储访问 secret。 |

### 5.4 AI Provider

| 变量 | 必填 | 说明 |
|---|---|---|
| `LLM_PROVIDER` | 是 | `mock` 或 `http`。生产使用 `http`。 |
| `LLM_API_URL` | `http` 必填 | LLM 接口地址。DeepSeek 使用 `https://api.deepseek.com/chat/completions`。 |
| `LLM_API_KEY` | `http` 通常必填 | Provider token。 |
| `LLM_MODEL` | `http` 必填 | 模型名，例如 `deepseek-v4-flash`。 |
| `LLM_TIMEOUT_MS` | 否 | 单次模型调用超时，默认 30000ms。 |
| `LLM_MAX_RETRIES` | 否 | 网络或 5xx 的重试次数。 |
| `VISION_PROVIDER` | 否 | 个人模板解析增强，默认 `none`。 |
| `IMAGE_PROVIDER` | 否 | 图片生成能力，默认 `none`。 |

### 5.5 PPT 预览渲染

| 变量 | 必填 | 说明 |
|---|---|---|
| `PPT_PREVIEW_RENDERER_COMMAND` | 否 | 可选 LibreOffice 路径，用于 PPTX 预览渲染。 |
| `PPT_PREVIEW_IMAGE_RENDERER_COMMAND` | 否 | 可选 Poppler `pdftoppm` 路径。 |
| `PPT_PREVIEW_RENDERER_TIMEOUT_MS` | 否 | 外部渲染超时时间。 |

未配置外部渲染器时，应用使用 HTML fallback 在线预览。

## 6. 首次部署流程

### 6.1 准备代码和依赖

```powershell
cd G:\toolapp\molinppt\ppt-ai-app
npm install
```

Linux 服务器示例：

```bash
cd /opt/molinppt/ppt-ai-app
npm install
```

### 6.2 创建 `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

至少确认：

- `APP_ENV=production`
- `APP_PORT=<实际端口>`
- `MOLING_API_BASE_URL`
- `INTERNAL_API_TOKEN`
- `MOLING_APP_ID`
- `MOLING_PRODUCT_ID`
- `DATABASE_URL`
- `STORAGE_DIR` 或 S3/MinIO 配置
- `LLM_PROVIDER=http`
- `LLM_API_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LOCAL_MOLING_MOCK=false`

### 6.3 初始化数据库

```powershell
npm run migrate
```

如果使用 MySQL，先确保数据库和账号已创建，且应用账号拥有建表和读写权限。

### 6.4 同步官方模板

```powershell
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
```

模板同步会扫描 `templates/official/**/manifest.json`，把官方模板、主题、缩略图等信息写入数据库和存储。新增或删除官方模板后，也需要重新执行这三条命令。

### 6.5 启动服务

直接启动：

```powershell
npm start
```

指定本地联调端口：

```powershell
$env:APP_PORT='5778'
npm start
```

Docker Compose 示例：

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app npm run migrate
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-template-categories.js
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-templates.js
docker compose -f docker-compose.prod.yml up -d
```

`docker-compose.prod.yml` 默认加载 `ppt-ai-app/.env`，并挂载持久化 volume 到 `/data`。镜像会从仓库根目录复制 `templates/official/`，容器内通过 `/app/templates/official` 读取官方模板。

`DATABASE_URL` 必须在 `ppt-ai-app/.env` 中设置，Compose 不会覆盖它。使用 JSON 数据库时可配置 `DATABASE_URL=json:/data/ppt-ai-db.json`；使用 MySQL 时应填写生产连接串。MySQL 在宿主机上运行时，容器中的 `127.0.0.1` 指向容器自身，需要改用数据库服务名或 Docker 可访问的宿主机地址。

## 7. 反向代理建议

Nginx 示例：

```nginx
server {
  listen 443 ssl;
  server_name ppt.example.com;

  ssl_certificate     /etc/nginx/certs/ppt.example.com.crt;
  ssl_certificate_key /etc/nginx/certs/ppt.example.com.key;

  location / {
    proxy_pass http://127.0.0.1:5177;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

如果魔灵测试环境直接用 HTTP 访问应用，需要把 `SESSION_COOKIE_SECURE=false`，否则登录态可能无法保存。

## 8. 上线验收

### 8.1 健康检查

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5177/api/health -TimeoutSec 10
```

期望返回：

```json
{"status":"ok"}
```

本地常用端口为 `5778` 时：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

### 8.2 自动化测试

部署前至少执行：

```powershell
npm test
```

生产硬化和验收：

```powershell
npm run acceptance:production
```

如果服务不是默认地址：

```powershell
$env:ACCEPTANCE_BASE_URL='http://127.0.0.1:5177'
npm run acceptance:production
```

### 8.3 魔灵真实链路验收

从魔灵入口拿到一次性 `launch_ticket` 后执行：

```powershell
$env:ACCEPTANCE_BASE_URL='http://127.0.0.1:5177'
$env:ACCEPTANCE_LAUNCH_TICKET='<real_launch_ticket>'
$env:ACCEPTANCE_ENTITLEMENT_ID='<optional_entitlement_id>'
npm run acceptance:moling
```

验收脚本会覆盖：

- 魔灵 ticket 登录。
- 模板分类和模板列表。
- 余额和权益包读取。
- 大纲生成与编辑。
- PPT 生成。
- 单页优化。
- 在线预览。
- PPTX/PDF 导出和下载。
- 调用日志和余额扣减校验。

### 8.4 临时权益映射校验

如果配置了 `MOLING_USER_ENTITLEMENT_MAP`，上线前必须执行：

```powershell
npm run validate:moling-config
```

该命令会逐个校验 `user_id:entitlement_id` 是否能从魔灵读取余额，避免把用户绑定到错误权益包。

## 9. 发布检查清单

发布前确认：

- [ ] `.env` 未提交到 Git。
- [ ] `LOCAL_MOLING_MOCK=false`。
- [ ] `APP_ENV=production`。
- [ ] HTTPS 场景下 `SESSION_COOKIE_SECURE=true`。
- [ ] HTTP 直连测试场景下 `SESSION_COOKIE_SECURE=false`。
- [ ] `DATABASE_URL` 指向生产数据库或明确的持久化 JSON 路径。
- [ ] `STORAGE_DIR` 或 S3/MinIO 已持久化。
- [ ] `npm run migrate` 已执行。
- [ ] `npm run seed:official-template-categories` 已执行。
- [ ] `npm run seed:official-templates` 已执行。
- [ ] `/api/health` 返回正常。
- [ ] `npm test` 通过。
- [ ] `npm run acceptance:production` 通过。
- [ ] 魔灵真实 ticket 验收通过。
- [ ] 反向代理日志和应用日志可查。

## 10. 日常运维

### 10.1 查看服务

Docker：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f ppt-ai-app
```

本机进程：

```powershell
Get-NetTCPConnection -LocalPort 5177 -State Listen
```

### 10.2 重启服务

Docker：

```bash
docker compose -f docker-compose.prod.yml restart ppt-ai-app
```

本地 PowerShell：

```powershell
$connections = Get-NetTCPConnection -LocalPort 5778 -State Listen -ErrorAction SilentlyContinue
if ($connections) {
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) { Stop-Process -Id $processId -Force }
}
$env:APP_PORT='5778'
npm start
```

### 10.3 模板更新

官方模板目录变化后：

```powershell
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
npm test
```

如果模板缩略图或在线预览未变化，优先排查：

- 当前浏览器访问的端口是否是刚部署的服务。
- `.env` 是否指向同一个数据库。
- 官方模板是否已经同步到数据库。
- 历史 PPT 是否仍绑定旧模板或旧 deck 数据。

### 10.4 日志和指标

应用会输出结构化请求日志。重点关注：

- `request_completed`
- `request_failed`
- AI provider 错误码
- 魔灵 reserve/settle/release 相关日志
- 文件下载和权限拒绝日志

如部署启用指标端点，可通过：

```bash
curl -fs http://127.0.0.1:5177/metrics
```

## 11. 回滚流程

### 11.1 代码回滚

推荐保留上一版本镜像或 Git tag。回滚时：

```bash
git checkout <last_good_tag_or_commit>
docker compose -f docker-compose.prod.yml up -d --build
```

或在非 Docker 部署中：

```bash
git checkout <last_good_tag_or_commit>
cd ppt-ai-app
npm install
npm start
```

### 11.2 数据回滚

上线前应备份：

- 数据库。
- `/data/storage` 或对象存储 bucket。
- 当前 `.env`。

若本次发布只改前端页面或模板展示，一般优先回滚代码，不直接回滚数据库。涉及模板同步、数据迁移或计费字段变更时，先评估迁移是否可逆，再执行数据库恢复。

### 11.3 计费异常处理

如果出现扣费异常：

1. 立即停止新生成入口或回滚服务。
2. 保留任务 ID、用户 ID、权益包 ID、请求 ID 和日志。
3. 检查 reserve/settle/release/reconciliation 记录。
4. 不要手工删除计费记录；通过魔灵平台对账或补偿流程处理。

## 12. 常见问题

### `/api/health` 正常，但页面还是旧版本

通常是访问了旧端口或旧进程。检查：

```powershell
Get-NetTCPConnection -LocalPort 5778 -State Listen
Get-Process -Id <PID>
```

确认浏览器地址、反向代理 upstream、实际启动端口一致。

### 模板管理看不到新模板

执行：

```powershell
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
```

再确认 `.env` 的 `DATABASE_URL` 与运行服务一致。

### 生成时报 `RATE_LIMIT_EXCEEDED`

这是应用限流，不是模型必然限流。检查：

- `RATE_LIMIT_MAX_REQUESTS`
- `RATE_LIMIT_WINDOW_MS`
- 同一用户或同一 IP 是否短时间重复请求

### 魔灵登录后无权益包

检查优先级：

1. launch ticket 是否包含可用权益信息。
2. 魔灵 `GET /api/internal/user-entitlements` 是否可用。
3. `MOLING_USER_ENTITLEMENT_MAP` 是否配置正确。
4. 是否错误配置了全局 `MOLING_DEFAULT_ENTITLEMENT_ID`。

### DeepSeek 配置后仍调用失败

确认 `LLM_API_URL` 是完整 chat completions 地址：

```text
https://api.deepseek.com/chat/completions
```

只填 `https://api.deepseek.com` 不够。

## 13. 最小本地冒烟示例

仅用于本地验证，不用于生产：

```powershell
cd G:\toolapp\molinppt\ppt-ai-app
Copy-Item .env.example .env
```

编辑 `.env`：

```text
APP_ENV=development
APP_PORT=5778
DATABASE_URL=json:./data/ppt-ai-db.json
STORAGE_DIR=./data/storage
LOCAL_MOLING_MOCK=true
LOCAL_MOLING_USER_ID=479
LOCAL_MOLING_ENTITLEMENT_ID=88
LOCAL_MOLING_INITIAL_CREDITS=100
LLM_PROVIDER=mock
SESSION_COOKIE_SECURE=false
```

执行：

```powershell
npm install
npm run migrate
npm run seed:official-template-categories
npm run seed:official-templates
npm start
```

验证：

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:5778/api/health -TimeoutSec 10
```

浏览器打开：

```text
http://127.0.0.1:5778/
```
