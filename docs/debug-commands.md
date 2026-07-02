# PPT AI 应用调试命令清单

本文整理本地开发、接口调试、导出下载、计费对账和 Goal 验收常用命令。命令默认从仓库根目录 `/home/pc-w1/ppt` 执行。

## Goal 提示词通用原则

复制任意 Goal 给 agent 执行时，统一附加以下原则：

```text
代码修改范围限制：
只能在本仓库 /home/pc-w1/ppt 内修改代码、文档和配置样例。
不得修改其他仓库、系统目录、外部项目或本仓库以外的任何文件。
如需要读取外部资料，只允许只读查看；如确实需要改动外部依赖或服务配置，必须先说明原因并等待用户确认。
不得提交 .env、密钥、node_modules、生成文件、本地数据库文件或对象存储数据。
```

## 0. 通用环境变量

```bash
cd /home/pc-w1/ppt/ppt-ai-app
export BASE_URL="http://127.0.0.1:5177"
export NO_PROXY="127.0.0.1,localhost"
```

如果当前 shell 配了代理，`curl` 建议统一加 `--noproxy 127.0.0.1,localhost`：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/health"
```

## 1. G0 本地运行与基础环境

安装依赖：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm install
```

检查环境配置：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
node --env-file=.env -e 'import("./src/config.js").then(({loadConfig}) => console.log(JSON.stringify(loadConfig(), null, 2)))'
```

执行迁移：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run migrate
```

启动服务：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm start
```

健康检查：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/health"
```

查看 MySQL 容器状态：

```bash
docker ps --filter name=molin-mysql
```

查看 MinIO 容器状态：

```bash
docker ps --filter name=molin-minio
```

检查 MinIO 健康状态：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "http://127.0.0.1:19000/minio/health/live"
```

## 2. G1 Moling 用户入口与会话

本地 mock 模式建议 `.env` 中设置：

```bash
LOCAL_MOLING_MOCK=true
LOCAL_MOLING_USER_ID=7
LOCAL_MOLING_ENTITLEMENT_ID=88
LOCAL_MOLING_INITIAL_CREDITS=100
```

通过 ticket 创建会话并保存 cookie：

```bash
curl --noproxy 127.0.0.1,localhost -i -sS "$BASE_URL/?ticket=local_debug" \
  | tee /tmp/ppt-launch.txt

export COOKIE="$(grep -i '^Set-Cookie:' /tmp/ppt-launch.txt | head -n 1 | sed -E 's/^Set-Cookie: ([^;]+).*/\1/I')"
echo "$COOKIE"
```

查询当前用户：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/me" \
  -H "Cookie: $COOKIE"
```

## 3. G2 计费与幂等闭环

查询余额：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/billing/balance" \
  -H "Cookie: $COOKIE"
```

指定 entitlement 查询余额：

```bash
export ENTITLEMENT_ID=88
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/billing/balance?entitlement_id=$ENTITLEMENT_ID" \
  -H "Cookie: $COOKIE"
```

执行本地完整验收，覆盖登录、模板、余额、生成、导出、下载和日志：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
LOCAL_MOLING_MOCK=true \
ACCEPTANCE_BASE_URL="$BASE_URL" \
ACCEPTANCE_ENTITLEMENT_ID="${ENTITLEMENT_ID:-88}" \
npm run acceptance
```

执行对账：

```bash
export INTERNAL_API_TOKEN="$(grep '^INTERNAL_API_TOKEN=' .env | cut -d= -f2-)"

curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/internal/reconcile" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: $INTERNAL_API_TOKEN" \
  -d '{"limit":20}'
```

## 4. G3 大纲与内容生成

生成大纲：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/outlines" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "季度经营复盘",
    "slide_count": 3,
    "template_id": "business",
    "theme": "modern"
  }' | tee /tmp/ppt-outline.json
```

提取 `outline_id`：

```bash
export OUTLINE_ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/ppt-outline.json","utf8")).outline.id)')"
echo "$OUTLINE_ID"
```

编辑大纲：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/outlines/$OUTLINE_ID" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -X PATCH \
  -d '{
    "slides": [
      { "title": "季度经营复盘", "bullets": ["收入表现", "成本变化", "关键风险"] },
      { "title": "业务进展", "bullets": ["核心项目", "客户反馈", "团队协作"] },
      { "title": "下一步计划", "bullets": ["增长动作", "资源需求", "时间节点"] }
    ]
  }' | tee /tmp/ppt-outline-edited.json
```

按当前模板生成 deck：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/decks" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d "{
    \"outline_id\": \"$OUTLINE_ID\",
    \"entitlement_id\": ${ENTITLEMENT_ID:-88}
  }" | tee /tmp/ppt-deck.json
```

提取 `deck_id` 和 `task_id`：

```bash
export DECK_ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/ppt-deck.json","utf8")).deck.id)')"
export TASK_ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/ppt-deck.json","utf8")).task.id)')"
echo "$DECK_ID"
echo "$TASK_ID"
```

查看生成任务：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/tasks/$TASK_ID" \
  -H "Cookie: $COOKIE"
```

在不重新生成大纲的情况下切换模板并重新生成 deck：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/decks" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d "{
    \"outline_id\": \"$OUTLINE_ID\",
    \"template_id\": \"pitch\",
    \"theme\": \"startup\",
    \"entitlement_id\": ${ENTITLEMENT_ID:-88}
  }" | tee /tmp/ppt-deck-retpl.json
```

## 5. G4 模板体系基础

查看模板列表：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/templates" \
  -H "Cookie: $COOKIE" | tee /tmp/ppt-templates.json
```

只查看模板 ID、名称和主题：

```bash
node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync("/tmp/ppt-templates.json","utf8")); for (const t of data.templates) console.log(`${t.id}\t${t.name}\t${(t.themes || []).map(x => x.id || x).join(",")}`)'
```

运行模板相关测试：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm test -- test/ppt-business.test.js
```

## 6. G6 导出与下载

预览 deck：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/decks/$DECK_ID/preview" \
  -H "Cookie: $COOKIE" \
  -o /tmp/ppt-preview.html
```

导出 PPTX：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/decks/$DECK_ID/exports" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"format":"pptx"}' | tee /tmp/ppt-export-pptx.json
```

导出 PDF：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/ppt/decks/$DECK_ID/exports" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"format":"pdf"}' | tee /tmp/ppt-export-pdf.json
```

下载导出的 PPTX：

```bash
export PPTX_FILE_ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/ppt-export-pptx.json","utf8")).file.id)')"

curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/files/$PPTX_FILE_ID/download-url" \
  -H "Cookie: $COOKIE" | tee /tmp/pptx-download-url.json

export PPTX_DOWNLOAD_URL="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/pptx-download-url.json","utf8")).url)')"

curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL$PPTX_DOWNLOAD_URL" \
  -o /tmp/debug-export.pptx
```

下载导出的 PDF：

```bash
export PDF_FILE_ID="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/ppt-export-pdf.json","utf8")).file.id)')"

curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/files/$PDF_FILE_ID/download-url" \
  -H "Cookie: $COOKIE" | tee /tmp/pdf-download-url.json

export PDF_DOWNLOAD_URL="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("/tmp/pdf-download-url.json","utf8")).url)')"

curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL$PDF_DOWNLOAD_URL" \
  -o /tmp/debug-export.pdf
```

检查导出文件大小：

```bash
ls -lh /tmp/debug-export.pptx /tmp/debug-export.pdf
```

运行导出专项测试：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm test -- test/exporter.test.js
```

## 7. G9 运维数据能力

查看调用日志：

```bash
curl --noproxy 127.0.0.1,localhost -fsS "$BASE_URL/api/logs" \
  -H "Cookie: $COOKIE" | tee /tmp/ppt-logs.json
```

查看当前 MySQL 数据库：

```bash
docker exec molin-mysql mysql -umolin -p -e 'select database();' ppt_ai_app
```

查看官方模板和用户模板表结构，表落地后使用：

```bash
docker exec molin-mysql mysql -umolin -p -e 'show tables;' ppt_ai_app
docker exec molin-mysql mysql -umolin -p -e 'describe templates;' ppt_ai_app
docker exec molin-mysql mysql -umolin -p -e 'describe ppt_assets;' ppt_ai_app
```

未来运维脚本命令建议：

```bash
npm run ops:recount-usage -- --user-id 7
npm run ops:disable-user -- --user-id 7 --reason "manual_debug"
npm run ops:soft-delete-asset -- --asset-id 123 --reason "bad_export"
npm run ops:cleanup-storage -- --dry-run
```

## 8. G7/G8 模板库未来命令

当前规划的官方模板目录：

```bash
find /home/pc-w1/ppt/templates/official -maxdepth 2 -type f | sort
```

官方模板同步命令建议：

```bash
npm run seed:official-template-categories
npm run seed:official-templates
```

官方模板目录预检（不写库）：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run list:official-templates
```

JSON 输出（脚本化检查）：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run list:official-templates -- --json | node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(0, 'utf8')); console.log(data.filter((item) => item.usable).length + '/' + data.length);"
```

模板清单和文件完整性快速校验（替代单独 validate 脚本）：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
node --env-file=.env --input-type=module -e "import fs from 'node:fs'; const data=JSON.parse(fs.readFileSync('data/ppt-ai-db.json','utf8')); const official=(data.templates||[]).filter(t=>t.scope==='official'); console.log(JSON.stringify(official.map(t=>({slug:t.slug,name:t.name,status:t.status,categoryId:t.categoryId})),null,2));"
```

也可以直接运行官方模板回归测试：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm test -- test/official-templates.test.js
```

## 9. 真实 Moling 联调

检查 Moling 配置：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run validate:moling-config
```

真实 Moling 验收：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
ACCEPTANCE_BASE_URL="$BASE_URL" \
npm run acceptance:moling
```

## 10. 全量测试

运行全部测试：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm test
```

运行当前重点测试：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm test -- test/exporter.test.js
npm test -- test/ppt-business.test.js
```

## 11. 常见排查命令

查看端口占用：

```bash
ss -ltnp | rg ':5177'
```

查看服务进程：

```bash
ps aux | rg 'node --env-file=.env src/server.js'
```

查看最近修改：

```bash
git status --short
git diff --stat
```

检查文档和代码 diff 是否有空白错误：

```bash
git diff --check
```

检查 PDF 是否包含中文字体对象：

```bash
strings /tmp/debug-export.pdf | rg 'STSong|UniGB|Title|季度|经营'
```

检查 PPTX ZIP 结构：

```bash
unzip -l /tmp/debug-export.pptx | sed -n '1,80p'
```
