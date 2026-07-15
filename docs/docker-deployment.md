# AI PPT 工作台 Docker 部署指南

本文档用于在 Linux 服务器或安装了 Docker Desktop 的开发机上，通过 `docker-compose.prod.yml` 部署 AI PPT 工作台。所有命令默认在仓库根目录执行。

## 1. 部署结构

生产 Compose 会启动一个 `ppt-ai-app` 服务：

- 容器端口：`5177`
- 宿主机端口：`5177`
- 持久化目录：Docker volume `ppt_ai_prod_data` 挂载到 `/data`
- 官方模板目录：镜像内 `/app/templates/official`
- 环境变量文件：宿主机 `ppt-ai-app/.env`
- 健康检查：`GET /api/health`

镜像使用 Node.js 20 Alpine，并在构建时安装生产依赖、复制应用代码和官方模板。`.env` 不会复制到镜像中。

## 2. 服务器要求

推荐环境：

- Ubuntu 22.04 或 24.04
- Docker Engine 24+
- Docker Compose v2
- 至少 2 核 CPU、4 GB 内存和 20 GB 可用磁盘
- 可访问魔灵平台接口和所配置的大模型接口
- 已开放 `5177`，或已配置 Nginx/Caddy 反向代理

确认 Docker 可用：

```bash
docker --version
docker compose version
docker info
```

如果 Windows 无法安装 Docker，可以在远程 Linux 服务器执行本文命令，Windows 只负责 SSH、Git 和浏览器访问。

## 3. 获取代码

```bash
git clone https://github.com/skillixx/molinppt.git
cd molinppt
git checkout main
git pull --ff-only
```

部署前确认以下文件存在：

```bash
test -f docker-compose.prod.yml
test -f ppt-ai-app/Dockerfile
test -d templates/official
```

## 4. 配置环境变量

从示例创建生产配置：

```bash
cp ppt-ai-app/.env.example ppt-ai-app/.env
chmod 600 ppt-ai-app/.env
nano ppt-ai-app/.env
```

`.env` 至少需要确认以下配置。示例值不能直接用于生产：

```dotenv
APP_ENV=production
APP_PORT=5177
APP_BASE_URL=https://ppt.example.com
SESSION_COOKIE_SECURE=true

MOLING_API_BASE_URL=https://moling.example.com
INTERNAL_API_TOKEN=<真实内部令牌>
MOLING_APP_ID=<应用ID>
MOLING_PRODUCT_ID=<产品ID>
LOCAL_MOLING_MOCK=false

DATABASE_URL=json:/data/ppt-ai-db.json

LLM_PROVIDER=http
LLM_API_URL=https://api.deepseek.com/chat/completions
LLM_API_KEY=<模型密钥>
LLM_MODEL=<实际模型名称>
```

注意事项：

- 不要提交 `ppt-ai-app/.env`。
- `docker-compose.prod.yml` 不会覆盖 `DATABASE_URL`，数据库连接以 `.env` 为准。
- Compose 固定容器内 `STORAGE_DIR=/data/storage` 和 `OFFICIAL_TEMPLATES_DIR=/app/templates/official`。
- HTTPS 部署使用 `SESSION_COOKIE_SECURE=true`；仅在 HTTP 联调时设置为 `false`。
- `LLM_API_URL` 必须是完整接口地址，不要只填写域名。

## 5. 选择数据库

### 5.1 JSON 数据库

适用于单机试运行或低并发环境：

```dotenv
DATABASE_URL=json:/data/ppt-ai-db.json
```

数据库文件和本地存储都位于 `/data`，由 Docker volume 持久化。删除容器不会删除数据，但执行 `docker compose down -v` 会删除 volume，请勿在生产环境随意使用。

### 5.2 MySQL 数据库

生产环境建议使用独立 MySQL：

```dotenv
DATABASE_URL=mysql://ppt_user:<URL编码后的密码>@mysql-host:3306/ppt_ai_app
```

数据库主机填写原则：

- MySQL 在同一个 Compose 网络中：填写 MySQL 服务名。
- MySQL 在其他服务器：填写内网 IP 或域名。
- MySQL 在 Docker 宿主机：使用 Docker 可访问的宿主机地址。
- 不要填写 `127.0.0.1` 指向宿主机；容器内的 `127.0.0.1` 是容器自身。

## 6. 构建镜像

先检查 Compose 展开结果：

```bash
docker compose -f docker-compose.prod.yml config --quiet
```

不要把不带 `--quiet` 的配置输出粘贴到工单或聊天中，因为展开结果可能包含 `.env` 中的敏感值。

构建镜像：

```bash
docker compose -f docker-compose.prod.yml build --pull
```

查看镜像：

```bash
docker compose -f docker-compose.prod.yml images
```

## 7. 首次初始化

初始化数据库结构：

```bash
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app npm run migrate
```

检查并同步官方模板：

```bash
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/list-official-templates.js
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-template-categories.js
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-templates.js
```

这里直接执行 Node.js 脚本，因为 Compose 已通过 `env_file` 注入环境变量，容器内不需要复制 `.env` 文件。

## 8. 启动服务

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

查看启动日志：

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200 ppt-ai-app
```

按 `Ctrl+C` 只会退出日志查看，不会停止容器。

## 9. 验证部署

检查健康接口：

```bash
curl -fsS http://127.0.0.1:5177/api/health
```

期望返回：

```json
{"status":"ok"}
```

检查容器健康状态和模板目录：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml exec ppt-ai-app sh -lc 'test -d /app/templates/official && find /app/templates/official -name manifest.json | head'
```

浏览器访问：

```text
http://<服务器IP>:5177/
```

正式上线还应验证：魔灵 ticket 登录、模板列表、PPT 生成、在线预览、PPTX/PDF 导出、文件下载和计费扣减。

## 10. 配置 HTTPS 反向代理

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
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

完成 HTTPS 配置后，确认 `.env` 中 `APP_BASE_URL` 使用 HTTPS，且 `SESSION_COOKIE_SECURE=true`。

## 11. 更新版本

更新前先备份数据库和存储数据，然后执行：

```bash
git fetch origin
git checkout main
git pull --ff-only
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app npm run migrate
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-template-categories.js
docker compose -f docker-compose.prod.yml run --rm ppt-ai-app node scripts/seed-official-templates.js
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

更新模板代码后必须重新构建镜像并执行模板同步，否则数据库中可能仍然保留旧模板信息或旧缩略图。

## 12. 备份和恢复

使用 JSON 数据库或本地文件存储时，备份 `/data`：

```bash
docker compose -f docker-compose.prod.yml exec ppt-ai-app sh -lc 'tar -czf /tmp/ppt-ai-data.tar.gz -C /data .'
docker compose -f docker-compose.prod.yml cp ppt-ai-app:/tmp/ppt-ai-data.tar.gz ./ppt-ai-data.tar.gz
```

同时单独备份：

- `ppt-ai-app/.env`
- 外部 MySQL 数据库
- S3/MinIO bucket
- 当前部署的 Git commit SHA

恢复前应停止服务，并确认备份文件来源和恢复目标。不要在运行中的生产数据库上直接覆盖数据文件。

## 13. 停止和回滚

停止服务但保留数据：

```bash
docker compose -f docker-compose.prod.yml down
```

回滚到已知正常提交：

```bash
git checkout <last-good-commit>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
curl -fsS http://127.0.0.1:5177/api/health
```

不要使用以下命令，除非已经确认要永久删除本地持久化数据：

```bash
docker compose -f docker-compose.prod.yml down -v
```

## 14. 常见问题

### 容器启动后不断重启

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=300 ppt-ai-app
```

重点检查 `.env` 是否存在、必填变量是否为空、数据库是否可访问，以及端口 `5177` 是否已被占用。

### 模板列表为空或缩略图不显示

确认镜像中存在模板：

```bash
docker compose -f docker-compose.prod.yml exec ppt-ai-app ls -la /app/templates/official
```

然后重新执行第 7 节的三个模板检查和同步命令。若模板文件刚更新，还需要先重新构建镜像。

### MySQL 连接失败

不要在连接串中使用容器内的 `127.0.0.1` 访问宿主机 MySQL。确认防火墙、MySQL 监听地址、账号授权和密码 URL 编码均正确。

### 健康接口正常但页面仍是旧版本

确认浏览器访问的域名和端口指向当前容器，并执行：

```bash
docker compose -f docker-compose.prod.yml images
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### 修改 `.env` 后没有生效

环境变量在创建容器时加载。修改后重新创建服务：

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

## 15. 上线检查清单

- [ ] `docker compose ... config --quiet` 通过。
- [ ] `.env` 权限为 `600`，且未提交到 Git。
- [ ] `LOCAL_MOLING_MOCK=false`。
- [ ] `DATABASE_URL` 指向持久化 JSON 路径或生产 MySQL。
- [ ] 数据库迁移成功。
- [ ] 官方模板扫描和同步成功。
- [ ] 容器状态为 `healthy`。
- [ ] `/api/health` 返回 `ok`。
- [ ] HTTPS 和安全 Cookie 配置正确。
- [ ] 魔灵登录、生成、导出、下载和计费链路验收通过。
- [ ] 数据库、存储和 `.env` 已建立备份方案。
