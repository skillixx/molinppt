# 新增差异化 PPT 模板样式实施指南

## 目标

当需要新增一个和现有模板明显不一样的模板样式时，不能只新增 `manifest.json` 和 `template.json`。如果复用现有 `layout` 和 `variant`，最终页面仍会沿用旧模板的结构，只是颜色有所变化。

差异化模板需要同时完成：

- 模板目录注册
- 主题视觉配置
- 在线预览 HTML/CSS 渲染
- PPTX 导出绘制逻辑
- 局部装饰图片或素材引用
- 对应测试覆盖

## 推荐目录结构

新增模板应放在 `templates/official/` 下，并按“模板分类 / 模板名称 / 主题风格”三级目录组织。

```text
templates/official/
  marketing/
    private-growth-plan/
      member-referral/
        manifest.json
        template.json
        renderer.js
        assets/
```

目录含义：

- `marketing`：模板分类目录，例如市场营销、战略咨询、财务经营。
- `private-growth-plan`：模板名称目录，例如私域增长方案。
- `member-referral`：主题风格目录，例如会员裂变。
- `assets/`：该主题独有的局部装饰图片、纹理、图标、场景素材。

## manifest.json

`manifest.json` 用于把模板同步到模板管理和数据库。

```json
{
  "slug": "marketing-private-growth-plan-member-referral",
  "name": "私域增长方案 - 会员裂变",
  "description": "适合私域增长、会员裂变、转化路径和复购运营分析的商业化营销模板。",
  "category_slug": "marketing",
  "category_name": "市场营销",
  "category_sort_order": 60,
  "status": "active",
  "tags": ["marketing", "private-growth", "member-referral"],
  "template_file": "template.json",
  "renderer_file": "renderer.js"
}
```

注意事项：

- `slug` 必须全局唯一，只使用小写字母、数字和连字符。
- `category_slug` 必须和分类目录、分类数据保持一致。
- `status` 使用 `active` 表示可用，`disabled` 表示保留但不展示。
- 如果有缩略图，可以增加 `thumbnail_file`。
- 如果有原始 PPTX 参考文件，可以增加 `source_file`，但不要直接把整页模板图片作为最终模板背景。

## template.json

`template.json` 用于定义模板主题、视觉参数和布局约束。

如果要做全新样式，不要复用旧模板的 `layout` 和 `variant`。

```json
{
  "baseTemplateId": "private-growth-plan",
  "themeId": "member-referral",
  "style": "private-growth-system",
  "themes": [
    {
      "id": "member-referral",
      "name": "会员裂变"
    }
  ],
  "visual": {
    "primary": "111827",
    "accent": "22C55E",
    "background": "F8FAFC",
    "surface": "FFFFFF",
    "title": "0F172A",
    "body": "334155",
    "layout": "private-growth",
    "variant": "member-referral"
  },
  "layoutSchema": {
    "defaultCoverLayout": "private-growth-cover",
    "defaultContentLayout": "private-growth-content",
    "allowedLayouts": [
      "private-growth-cover",
      "private-growth-content",
      "growth-funnel",
      "data-dashboard",
      "action-plan"
    ]
  }
}
```

关键规则：

- `baseTemplateId` 用于表达这是哪个基础模板。
- `themeId` 是当前主题风格。
- `visual.layout` 是新样式的核心识别字段。
- `visual.variant` 用于区分同一个模板下的不同主题。
- 新模板要有自己的 `layoutSchema`，避免生成内容被旧模板布局规则限制。

## renderer.js

当前项目中，`renderer.js` 主要承载模板目录化后的元数据。真正渲染仍由 `ppt-service.js` 和 `ppt-exporter.js` 统一调度。

```js
/**
 * 官方代码模板渲染入口。
 * 当前渲染由 ppt-service.js 和 ppt-exporter.js 统一调度。
 */
export const templateRenderer = {
  templateId: "private-growth-plan",
  templateName: "私域增长方案",
  themeId: "member-referral",
  themeName: "会员裂变",
  style: "private-growth-system",
  visual: {
    primary: "111827",
    accent: "22C55E",
    background: "F8FAFC",
    surface: "FFFFFF",
    title: "0F172A",
    body: "334155",
    layout: "private-growth",
    variant: "member-referral"
  }
};

/**
 * 返回当前主题的模板视觉配置。
 * @returns {object}
 */
export function getTemplateVisual() {
  return templateRenderer.visual;
}
```

## 在线预览渲染

如果是新样式，需要在 `ppt-ai-app/src/ppt-service.js` 中新增预览判断和样式。

建议新增类似函数：

```js
function isPrivateGrowthVisual(visual) {
  return visual?.id === "private-growth-plan" && visual?.layout === "private-growth";
}
```

然后补充：

- 预览页面结构
- 封面装饰
- 内容页装饰
- 特殊图表或流程区域
- CSS 变量和响应式尺寸

预览层要避免出现主题风格名称，例如不要把“会员裂变”直接写进页面角标。

## PPTX 导出绘制

下载 PPTX 的真实样式由 `ppt-ai-app/src/ppt-exporter.js` 生成。新模板必须在这里写对应的 DrawingML 绘制逻辑。

需要实现的内容：

- 背景色、纹理、装饰线条
- 封面布局
- 内容页布局
- 图片占位或局部装饰图片
- 指标卡、流程图、数据图形
- 标题、正文、页码等文本落位

重要原则：

- 不能直接把整页模板截图作为背景。
- 主要版式必须用代码绘制，保证 PPTX 可编辑。
- 图片只适合做局部装饰，例如人物、产品 mockup、纹理、场景图。
- 在线预览和 PPTX 导出必须保持一致。

## 图片和素材

模板素材放在当前主题目录的 `assets/` 中。

```text
templates/official/marketing/private-growth-plan/member-referral/assets/
  hero-dashboard.png
  user-card-texture.png
  referral-network.png
```

使用建议：

- 不要复用和其他模板高度相似的图片。
- 不要使用带水印的图片。
- 不要使用整页模板截图作为背景。
- 图片应服务于局部视觉，例如产品界面、人物场景、装饰纹理、图标组。

## 版式设计建议

新增模板时，应先定义一套“版式语言”，而不是只换颜色。

示例：

```text
封面：
  大标题 + 右侧场景图 + 底部三项指标卡

目录页：
  左侧章节导航 + 右侧路径图

内容页：
  左侧强标题 + 中间增长漏斗 + 右侧数据卡

分析页：
  问题 / 原因 / 动作三段式，但视觉上用卡片、路径、对比图承载

结尾页：
  深色背景 + 行动清单 + 下一步时间轴
```

商业化模板应做到：

- 首页和内容页样式不同。
- 页面结构不只是三段文字。
- 装饰元素和业务场景相关。
- 标题、正文、图形之间有明确层级。
- 不在模板页面中直接展示主题风格名称。

## 同步命令

新增或修改官方模板后，在 `ppt-ai-app/` 目录执行：

```powershell
$env:OFFICIAL_TEMPLATES_DIR="../templates/official"
npm run seed:official-templates
```

如分类也有变化，先同步分类：

```powershell
$env:OFFICIAL_TEMPLATES_DIR="../templates/official"
npm run seed:official-template-categories
```

查看模板目录识别结果：

```powershell
$env:OFFICIAL_TEMPLATES_DIR="../templates/official"
npm run list:official-templates
```

## 测试要求

新增差异化模板后至少补充：

- 模板能被 `TemplateManager` 识别。
- 在线预览能显示新模板样式。
- PPTX 导出包含新模板装饰元素。
- 预览和 PPTX 不显示主题风格名称。
- 生成工作台可以选择并应用该模板。

常用测试命令：

```powershell
cd ppt-ai-app
npm test
```

## 实施顺序

推荐按以下顺序开发：

1. 明确模板分类、模板名称、主题风格。
2. 设计封面、内容页、分析页、结尾页的版式语言。
3. 创建 `templates/official/<分类>/<模板>/<主题>/` 目录。
4. 编写 `manifest.json`、`template.json`、`renderer.js`。
5. 准备 `assets/` 局部素材。
6. 在 `ppt-service.js` 增加在线预览样式。
7. 在 `ppt-exporter.js` 增加 PPTX 绘制逻辑。
8. 补充测试。
9. 同步模板到数据库和对象存储。
10. 重启平台并在生成工作台验证。

## 判断是否算一个真正的新模板

可以用下面的问题检查：

- 是否有新的 `visual.layout`？
- 是否有独立的封面版式？
- 是否有独立的内容页结构？
- 是否有局部业务装饰图片或图形？
- 是否没有复用旧模板的主要页面骨架？
- 是否 PPTX 可编辑，而不是整页背景图？
- 是否预览和下载 PPTX 基本一致？

如果以上多数答案是“是”，才算一个真正差异化的新模板。
