# Official Templates

官方模板不通过后台管理。每个模板以固定 `slug` 放在仓库目录中，然后执行同步脚本写入数据库并上传模板文件到对象存储索引。

目录结构：

```text
templates/official/
  categories.json
  {slug}/
    manifest.json
    source.pptx
    thumbnail.png
    template.json
```

`manifest.json` 必填字段：

```json
{
  "slug": "business-blue",
  "name": "Business Blue",
  "description": "Blue business report template",
  "category_slug": "business-report",
  "category_name": "Business Report",
  "category_sort_order": 10,
  "status": "active",
  "tags": ["business", "report"],
  "source_file": "source.pptx",
  "thumbnail_file": "thumbnail.png",
  "template_file": "template.json"
}
```

规则：

- `manifest.slug` 必须和目录名 `{slug}` 一致。
- 只有包含 `manifest.json` 的一级子目录会被当作模板同步，纯素材目录会被跳过。
- `status` 只能是 `active` 或 `disabled`。
- `source_file` 只能引用当前目录下的 `.pptx` 文件。
- `thumbnail_file` 只能引用当前目录下的 `.png` 文件。
- `template_file` 只能引用当前目录下的 `.json` 文件。
- 同一个 `slug` 重复同步会更新原记录，保持模板 ID 稳定。
- `disabled` 模板会同步进数据库，但不会展示给用户。
- 官方模板使用 `scope: "official"`，不占用户个人模板配额。

分类种子 `categories.json` 可选，支持数组或 `{ "categories": [] }`：

```json
[
  { "id": "business-report", "name": "Business Report", "sortOrder": 10 }
]
```

同步命令：

```bash
cd ppt-ai-app
OFFICIAL_TEMPLATES_DIR='../templates/official'
npm run seed:official-template-categories
npm run seed:official-templates
```

可选环境变量：

- `DATABASE_URL`：默认 `json:./data/ppt-ai-db.json`，生产可配置 `mysql://user:password@host:3306/database`。
- `STORAGE_DIR`：默认 `./data/storage`。
- `STORAGE_ENDPOINT`、`STORAGE_BUCKET`、`STORAGE_ACCESS_KEY_ID`、`STORAGE_SECRET_ACCESS_KEY`：配置后模板文件上传到 MinIO/S3-compatible 对象存储。
- `OFFICIAL_TEMPLATES_DIR`：默认仓库根目录下 `templates/official`。
  - 从 `ppt-ai-app/` 目录运行命令时，建议显式传 `OFFICIAL_TEMPLATES_DIR='../templates/official'`。

当前仓库内目前可直接接入的开源模板源：

- `open-city-template`
  - GitHub：`https://github.com/burkeholland/powerpoints`
  - 许可：`MIT`
- `open-powerpoint-sample`
  - GitHub：`https://github.com/Suparnapaul393/PowerPoint-Sample`
  - 许可：`Apache-2.0`

可直接复用且建议先做验收的模板文件：

- `burkeholland/powerpoints`
  - `city-template.pptx`
- `Suparnapaul393/PowerPoint-Sample`
  - `Journey.pptx`
  - `Journey1.pptx`
  - `PowerPoint skill Test.pptx`
  - `suparna.pptx`

新增一个开源模板到系统的方法：

1. 在 `templates/official/` 下新增目录（目录名即 `slug`）并放入：
   - `manifest.json`
   - `source.pptx`
   - `thumbnail.png`
   - `template.json`
2. 按本文上方“manifest”规则填写元数据并确认许可协议允许商用/再分发。
3. 跑同步：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
DATABASE_URL='json:./data/ppt-ai-db.json'
npm run seed:official-template-categories
npm run seed:official-templates
```

4. 验证：

```bash
# 看当前数据库中是否入库（本地 json 文件示例）
node --input-type=module -e "import fs from 'node:fs'; const d=JSON.parse(fs.readFileSync('data/ppt-ai-db.json','utf8')); console.log((d.templates||[]).filter(t=>t.scope==='official').map(t=>t.slug));"
```

预检官方模板目录（不落库）：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run list:official-templates
```

输出 JSON（适合脚本）：

```bash
cd /home/pc-w1/ppt/ppt-ai-app
npm run list:official-templates -- --json
```
