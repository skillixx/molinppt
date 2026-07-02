# 母版模板素材交付规范

> 面向"母版路线"商业化模板:好看的视觉 = **专业设计的整页背景图铺底 + 文字叠加**(参考 `templates/official/dome/`,即 red-gold)。
> 本规范说明:要新增一套商用模板(如"简约高端""活力现代"),你需要提供哪些素材、什么格式、怎么命名。
> 关联:`ppt-ai-app-roadmap.md` P3-1 母版类、`template-rendering-design.md` §1.4。

---

## 1. 一套模板需要什么

| 项 | 要求 |
|---|---|
| 背景整图 | 一组 **16:9、1920×1080**(或 1280×720)的 **JPG**,每张是一整页设计好的背景 |
| 张数 | **最少 3 张**(封面 / 通用内容 / 结束);**推荐 6–8 张**覆盖全部版式 |
| 单张体积 | 建议 ≤ 500KB(JPG quality 82–88);过大导出文件会臃肿 |
| 文字安全区 | 背景的**主视觉靠边**,给正文留出干净区域(见 §3) |
| 配色 | 给出主色/强调色/标题色/正文色的 hex(用于文字取色与卡片) |

> 也可以直接给一份**设计好的 .pptx**,我用 §4 的脚本把每页背景抽出来转成上面的整图。但 pptx 里最好每页背景是"一张整图",而不是十几个碎形状——碎形状抽不出干净背景。

## 2. 命名约定(放进 `templates/official/<slug>/assets/`)

按"版式角色"命名,和 dome 对齐:

| 文件名 | 用途(角色) | 必需 |
|---|---|---|
| `cover.jpg` | 封面(可与结束页共用) | ✅ |
| `content.jpg` | 通用内容页底图 | ✅ |
| `closing.jpg` | 结束页(没有就复用 cover) | 建议 |
| `section.jpg` | 章节分隔页 | 建议 |
| `agenda.jpg` | 目录页(没有就用 content) | 可选 |
| `business-1.jpg` … `business-6.jpg` | 图文页/指标/流程页的配图 | 可选 |

> 角色对应的版式(cover/agenda/section-divider/image-report/three-steps/metrics/closing…)见 `templates.js` 的 `layoutSchema.allowedLayouts`。缺哪张,渲染时按"就近回退"(如 agenda→content、closing→cover)。

## 3. 文字安全区(决定"背景好看但字看得清")

设计背景时,给文字留出低干扰区域,否则叠字会糊:

- **封面 `cover.jpg`**:主视觉(帆船/图形)放在**右侧或下方**,**左上 ~60% 区域保持简洁**(放大标题+副标题)。dome 封面正是右下帆船、左上留白。
- **内容 `content.jpg`**:装饰集中在**顶部/底部条带**,**中部大片区域干净**(放标题+要点/卡片)。
- **对比度**:深底(如红/深蓝)配浅色字;浅底配深色字。至少保证正文与背景对比度 ≥ 4.5:1。

## 4. 交付方式二选一

**A. 直接给整图**(推荐):按 §2 命名,放进 `templates/official/<slug>/assets/`,并附一份色值。

**B. 给 .pptx**:放到 `templates/official/<slug>/source.pptx`,然后运行抽图脚本:

```bash
cd ppt-ai-app
node scripts/extract-pptx-media.mjs ../templates/official/<slug>/source.pptx ../templates/official/<slug>/assets
```

脚本会把 pptx 里的图片抽出、转 JPG、报出尺寸,并标出哪些是 16:9 整图背景候选。你(或我)再从候选里挑图、按 §2 重命名即可。

## 5. 交付清单(每套模板)

- [ ] `templates/official/<slug>/assets/` 下的背景整图(按 §2 命名)
- [ ] 色值:primary / accent / background / surface / title / body(hex)
- [ ] 模板名、类目(category)、若干主题名(theme)
- [ ] `LICENSE` / 来源说明(若为第三方素材,注明授权)

素材齐了我就:抽图入库 → 写 `template.json` → 接入 exporter + 预览(按母版机制)→ 截图验收。
