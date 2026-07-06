# 官方模板目录规范

官方模板以代码和资产目录的方式维护，执行同步脚本后写入数据库，并把模板源文件、缩略图和模板定义上传到本地存储或 MinIO/S3。

## 推荐目录结构

```text
templates/official/
  categories.json
  _shared/
    images/
    textures/
    icons/

  business-report/
    executive-business-report/
      minimal-gray-blue/
        manifest.json
        template.json
        renderer.js
        thumbnail.png
        source.pptx
        assets/
      modern-red-gold/
        manifest.json
        source.pptx
        thumbnail.png
        template.json
        renderer.js
        assets/

  marketing/
    campaign-plan/
      growth-marketing/
        manifest.json
        source.pptx
        thumbnail.png
        template.json
        renderer.js
        assets/
```

目录含义：

- 第一层是模板分类，例如 `business-report`、`marketing`、`finance-roadshow`。
- 第二层是模板名称，例如 `executive-business-report`、`campaign-plan`。
- 第三层是主题风格，例如 `minimal-gray-blue`、`growth-marketing`。
- `_shared` 用于共享图片、纹理、图标等素材，不参与模板同步。

当前同步逻辑仍兼容旧结构：

```text
templates/official/{slug}/manifest.json
```

## manifest.json

```json
{
  "slug": "marketing-campaign-plan-growth-marketing",
  "name": "营销活动方案 - 增长营销",
  "description": "适合增长复盘、投放策略和转化路径展示的营销模板。",
  "category_slug": "marketing",
  "category_name": "市场营销",
  "category_sort_order": 60,
  "status": "active",
  "tags": ["marketing", "growth"],
  "template_file": "template.json",
  "renderer_file": "renderer.js",
  "thumbnail_file": "thumbnail.png",
  "source_file": "source.pptx"
}
```

规则：

- `slug` 必须全局唯一，只能使用小写字母、数字和连字符。
- 新的多级目录中，`slug` 不需要等于目录名，但建议由分类、模板、主题拼接而成。
- 旧的一层目录中，`slug` 仍需要和目录名一致，保证历史模板稳定。
- `status` 只能是 `active` 或 `disabled`。
- `template_file` 只能引用当前主题目录下的 `.json` 文件。
- `renderer_file` 建议引用当前主题目录下的 `.js` 文件，用于承载后续独立模板渲染代码。
- `source_file` 可选；如果填写，只能引用当前主题目录下的 `.pptx` 文件。
- `thumbnail_file` 可选；如果填写，只能引用当前主题目录下的 `.png` 文件。
- 代码实现的模板可以只提供 `manifest.json`、`template.json`、`renderer.js` 和 `assets/`。

## template.json

```json
{
  "themes": [
    { "id": "growth-marketing", "name": "增长营销" }
  ],
  "visual": {
    "primary": "0F766E",
    "accent": "F97316",
    "background": "ECFDF5",
    "surface": "FFFFFF",
    "title": "102A43",
    "body": "334155",
    "layout": "campaign-content"
  },
  "layoutSchema": {
    "defaultCoverLayout": "campaign-cover",
    "defaultContentLayout": "campaign-content",
    "allowedLayouts": ["campaign-cover", "campaign-content", "hero", "story", "content"]
  }
}
```

## 同步命令

从 `ppt-ai-app/` 目录执行：

```bash
npm run migrate:official-template-dirs
```

这个命令会把当前内置模板刷新到 `templates/official/分类/模板/主题/` 目录中。

```bash
OFFICIAL_TEMPLATES_DIR="../templates/official" npm run seed:official-template-categories
OFFICIAL_TEMPLATES_DIR="../templates/official" npm run seed:official-templates
```

预览当前官方模板目录：

```bash
OFFICIAL_TEMPLATES_DIR="../templates/official" npm run list:official-templates
OFFICIAL_TEMPLATES_DIR="../templates/official" npm run list:official-templates -- --json
```
