# 母版模板素材交付规范

面向“母版路线”的商业化模板，好看的视觉应该由代码布局、整页背景、装饰图片和可编辑文字层共同组成。当前红金商务母版素材已经迁移到：

```text
templates/official/business/business/modern/assets/
```

也就是：

```text
官方模板 / 商业汇报 / 高管商务汇报 / 现代红金 / assets
```

## 1. 每套模板需要什么

| 项目 | 要求 |
|---|---|
| 背景整图 | 一组 16:9 JPG，建议 1920x1080 或 1280x720 |
| 张数 | 至少 3 张：封面、内容页、结束页；推荐 6-8 张覆盖更多版式 |
| 单张体积 | 建议不超过 500KB，避免导出 PPTX 过大 |
| 文字安全区 | 背景图片需要给标题、正文、卡片留出干净区域 |
| 配色 | 提供 primary、accent、background、surface、title、body 六个 hex 色值 |

## 2. 推荐目录

```text
templates/official/<category>/<template>/<theme>/
  manifest.json
  template.json
  renderer.js
  assets/
    cover.jpg
    content.jpg
    closing.jpg
    section.jpg
    agenda.jpg
    business-1.jpg
    business-2.jpg
```

当前红金商务模板继续沿用历史文件名：

```text
templates/official/business/business/modern/assets/
  dome-cover.jpg
  dome-content.jpg
  dome-business-1.jpeg
  dome-business-2.jpeg
  dome-business-3.jpeg
  dome-business-4.jpeg
  dome-business-5.jpeg
  dome-business-6.jpeg
```

## 3. 命名规则

- `cover.jpg`：封面，可复用为结束页。
- `content.jpg`：通用内容页背景。
- `closing.jpg`：结束页，没有则复用封面。
- `section.jpg`：章节页。
- `agenda.jpg`：目录页，没有则复用内容页。
- `business-1.jpg` 到 `business-6.jpg`：图文、指标、流程、复盘等页面配图。

## 4. 设计要求

- 封面主视觉放在右侧或下方，左上区域留给大标题。
- 内容页装饰集中在顶部、底部或边角，中间保留正文区域。
- 正文和背景对比度要足够，避免图片压住文字。
- 不要把标题文字烘焙进背景图，标题必须保持可编辑。

## 5. 接入步骤

1. 将素材放入对应主题目录的 `assets/`。
2. 在 `template.json` 中配置视觉颜色和 `layoutSchema`。
3. 在 `renderer.js` 中承载该主题后续独立渲染逻辑。
4. 如需同步到数据库，执行：

```bash
cd ppt-ai-app
npm run seed:official-template-categories
npm run seed:official-templates
```
