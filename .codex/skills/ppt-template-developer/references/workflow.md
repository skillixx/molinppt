# PPT 模板开发工作流

## 1. 规划

从以下文档提取需求：

- `docs/template-expansion-requirements.md`：模板分类、模板名称、主题风格、进度表。
- `docs/template-theme-style-details.md`：每个主题风格的视觉定位、背景、配图、字段重点。
- `docs/new-template-style-guide.md`：差异化模板原则和落地标准。

输出开发前判断：

```text
模板分类：
模板名称：
主题风格：
是否新增 visual.layout：
封面结构：
内容页结构：
分析页结构：
结尾页结构：
需要的局部素材：
```

## 2. 目录和元数据

官方模板目录：

```text
templates/official/<category-slug>/<template-slug>/<theme-slug>/
```

主题目录至少包含：

```text
manifest.json
template.json
renderer.js
assets/
```

`manifest.json` 负责同步到数据库和对象存储。`template.json` 负责视觉参数、主题和布局约束。`renderer.js` 当前承载目录化后的模板元数据。

## 3. 视觉配置

差异化模板优先使用独立 `visual.layout`：

```json
{
  "visual": {
    "primary": "111827",
    "accent": "22C55E",
    "background": "F8FAFC",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "growth-marketing",
    "variant": "aarrr"
  }
}
```

不要只依赖 `variant` 换颜色；真正不同的模板要有不同版式和绘制分支。

## 4. 在线预览

在 `ppt-ai-app/src/ppt-service.js` 中实现：

- `isXxxVisual(visual)` 识别函数。
- `xxxPreviewScene(visual)` 场景数据。
- 页面 HTML 片段。
- CSS 规则。

注意：

- 不要把主题风格名称写进页面角标。
- 控制标题、正文、图形的边界，避免重叠。
- 首页和内容页不能完全同构。

## 5. PPTX 导出

在 `ppt-ai-app/src/ppt-exporter.js` 中实现：

- `isXxxVisual(visual)` 识别函数。
- `xxxScene(visual)` 场景数据。
- `xxxDecorationsXml(...)` 绘制函数。
- 必要的局部图片 relationship 和 picture shape。

PPTX 导出优先级高于 HTML 预览，因为用户最终下载的是 PPTX。

## 6. 测试

优先补充：

- `ppt-ai-app/test/exporter.test.js`：断言 PPTX XML 包含新增装饰元素。
- `ppt-ai-app/test/ppt-business.test.js`：断言 HTML 预览结构和主题名称不外露。
- `ppt-ai-app/test/framework.test.js`：断言模板注册、分类和视觉解析。

常见断言：

```js
assert.match(slide1, /name="Growth Marketing Funnel"/);
assert.doesNotMatch(preview, /<div class=".*-chip">AARRR<\/div>/);
```

## 7. 同步和验证

```powershell
cd ppt-ai-app
$env:OFFICIAL_TEMPLATES_DIR="../templates/official"
npm run list:official-templates
npm run seed:official-template-categories
npm run seed:official-templates
npm test
```

如果本地平台已运行，重启并验证浏览器生成流程。

## 8. 进度表维护

开发完成后更新 `docs/template-expansion-requirements.md` 的进度表：

- `未开始`
- `设计中`
- `开发中`
- `待同步`
- `已上线`

代码状态按实际推进更新：

- `未创建`
- `目录已建`
- `预览已建`
- `导出已建`
- `测试已补齐`
