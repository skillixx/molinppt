# PPT 模板配图资产分析与对应关系

## 目标

本文档用于记录官方 PPT 模板需要的局部配图、装饰图、场景图和图标化插图，并将每个模板与可复用资产路径对应起来。

配图使用原则：

- 主体版式仍由代码绘制，不能把整页模板截图作为背景。
- 图片只用于局部装饰、场景补充、产品 mockup、数据氛围、纹理或图标化插图。
- 图片不能带水印，不能直接显示主题风格名称。
- 同一分类下的模板可以复用少量基础资产，但页面结构、色彩和装饰方式要做差异化处理。

## 生成资产目录

已生成的共享配图资产统一保存到：

```text
templates/official/_shared/generated-illustrations/
```

| 资产文件 | 适用场景 | 使用建议 |
|---|---|---|
| `executive-command-center.svg` | 高管汇报、经营总览、管理驾驶舱 | 可放在封面右侧、内页角落或指标页背景局部，不要铺满整页。 |
| `red-gold-ribbon.svg` | 红金商务、年度成果、正式汇报 | 适合做页眉、页脚、角标、封面局部动势纹理。 |
| `project-kanban.svg` | 项目状态、任务跟踪、行动闭环 | 适合项目页、里程碑页、问题跟踪页局部展示。 |
| `data-dashboard.svg` | 数据洞察、BI 看板、指标监控 | 适合数据页、仪表盘页、异常分析页局部装饰。 |
| `marketing-growth-funnel.svg` | 市场营销、增长漏斗、投放转化 | 适合增长页、渠道页、转化路径页局部插图。 |
| `product-mockup.svg` | 产品规划、产品亮点、SaaS 展示 | 适合产品封面、功能页、版本发布页局部 mockup。 |
| `education-learning-path.svg` | 教育培训、课程路径、学习计划 | 适合课程封面、学习路径页、培训方案页。 |
| `finance-ledger.svg` | 财务经营、预算、审计、预测 | 适合财务封面、经营复盘、预算分析页。 |
| `strategy-map.svg` | 战略咨询、路线图、市场进入 | 适合战略路径页、咨询报告封面、落地路线页。 |
| `sales-solution-architecture.svg` | 销售方案、解决方案、客户架构 | 适合售前方案页、解决方案结构页、客户价值页。 |
| `pitch-investor-story.svg` | 融资路演、投资人汇报、创业故事 | 适合 BP 封面、商业模式页、增长证据页。 |

## 当前模板配图对应关系

### 商业汇报

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 高管商务汇报 | 经典商务 | `templates/official/_shared/generated-illustrations/executive-command-center.svg` | `templates/official/business/business/classic/` | 封面右侧经营屏、内页指标页局部装饰。 |
| 高管商务汇报 | 高管深蓝 | `templates/official/_shared/generated-illustrations/executive-command-center.svg` | `templates/official/business/business/executive/` | 深色管理驾驶舱氛围图，用于封面或数据页。 |
| 高管商务汇报 | 极简灰蓝 | `templates/official/_shared/generated-illustrations/executive-command-center.svg` | `templates/official/business/business/minimal/` | 低透明度局部插图，避免破坏极简留白。 |
| 高管商务汇报 | 现代红金 | `templates/official/_shared/generated-illustrations/red-gold-ribbon.svg` | `templates/official/business/business/modern/` | 红金花纹、成果动势线、页眉页脚装饰。 |
| 项目状态汇报 | 交付跟踪 | `templates/official/_shared/generated-illustrations/project-kanban.svg` | `templates/official/business/project-status/delivery/` | 交付看板、里程碑和任务状态页。 |
| 项目状态汇报 | 例会汇报 | `templates/official/_shared/generated-illustrations/project-kanban.svg` | `templates/official/business/project-status/steering/` | 例会议题、风险事项和行动追踪页。 |
| 项目状态汇报 | 周报进展 | `templates/official/_shared/generated-illustrations/project-kanban.svg` | `templates/official/business/project-status/weekly/` | 周进度、待办列表、完成度展示。 |

### 战略咨询

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 战略咨询方案 | 董事会汇报 | `templates/official/_shared/generated-illustrations/strategy-map.svg` | `templates/official/strategy/strategy-consulting/board/` | 战略路径、市场判断、董事会决策页。 |
| 战略咨询方案 | 矩阵分类 | `templates/official/_shared/generated-illustrations/strategy-map.svg` | `templates/official/strategy/strategy-consulting/matrix/` | 象限、矩阵、优先级分类页局部辅助。 |
| 战略咨询方案 | 工作流程推进 | `templates/official/_shared/generated-illustrations/strategy-map.svg` | `templates/official/strategy/strategy-consulting/workstream/` | 工作流、阶段路线、落地节奏页。 |

### 财务经营

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 财务经营复盘 | 审计分析 | `templates/official/_shared/generated-illustrations/finance-ledger.svg` | `templates/official/finance/financial-review/audit/` | 审计清单、凭证、风险检查页。 |
| 财务经营复盘 | 预测规划 | `templates/official/_shared/generated-illustrations/finance-ledger.svg` | `templates/official/finance/financial-review/forecast/` | 收入预测、利润曲线、预算规划页。 |
| 财务经营复盘 | 季度复盘 | `templates/official/_shared/generated-illustrations/finance-ledger.svg` | `templates/official/finance/financial-review/quarterly/` | 季度指标、费用结构、现金流复盘页。 |

### 销售方案

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 销售提案方案 | 企业客户 | `templates/official/_shared/generated-illustrations/sales-solution-architecture.svg` | `templates/official/sales/sales-proposal/enterprise/` | 客户架构、价值链、方案总览页。 |
| 销售提案方案 | 续约增长 | `templates/official/_shared/generated-illustrations/sales-solution-architecture.svg` | `templates/official/sales/sales-proposal/renewal/` | 续约路径、客户健康度、增长机会页。 |
| 销售提案方案 | 解决方案 | `templates/official/_shared/generated-illustrations/sales-solution-architecture.svg` | `templates/official/sales/sales-proposal/solution/` | 技术方案、交付结构、能力模块页。 |

### 产品规划

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 产品路线规划 | 产品复盘 | `templates/official/_shared/generated-illustrations/product-mockup.svg` | `templates/official/product/product-roadmap/product-review/` | 产品结果、用户反馈、版本效果页。 |
| 产品路线规划 | 版本发布 | `templates/official/_shared/generated-illustrations/product-mockup.svg` | `templates/official/product/product-roadmap/release/` | 发布封面、功能亮点、版本内容页。 |
| 产品路线规划 | 路线图 | `templates/official/_shared/generated-illustrations/product-mockup.svg` | `templates/official/product/product-roadmap/roadmap/` | 产品路线、模块规划、阶段里程碑页。 |

### 市场营销

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 营销活动方案 | 品牌传播 | `templates/official/_shared/generated-illustrations/marketing-growth-funnel.svg` | `templates/official/marketing/marketing-campaign/brand/` | 传播路径、触点矩阵、媒介组合页。 |
| 营销活动方案 | 增长营销 | `templates/official/_shared/generated-illustrations/marketing-growth-funnel.svg` | `templates/official/marketing/marketing-campaign/growth/` | 增长漏斗、转化路径、投放复盘页。 |
| 营销活动方案 | 新品发布 | `templates/official/_shared/generated-illustrations/marketing-growth-funnel.svg` | `templates/official/marketing/marketing-campaign/launch/` | 首发节奏、卖点展示、渠道铺排页。 |
| 品牌故事叙事 | 编辑叙事 | `templates/official/_shared/generated-illustrations/red-gold-ribbon.svg` | `templates/official/marketing/brand-story/editorial/` | 叙事节奏、章节装饰、品牌故事氛围。 |
| 品牌故事叙事 | 品牌识别 | `templates/official/_shared/generated-illustrations/product-mockup.svg` | `templates/official/marketing/brand-story/identity/` | 品牌样机、视觉识别、物料展示页。 |
| 品牌故事叙事 | 高端质感 | `templates/official/_shared/generated-illustrations/red-gold-ribbon.svg` | `templates/official/marketing/brand-story/premium/` | 高端纹理、品牌质感、封面局部装饰。 |

### 数据洞察

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 数据洞察报告 | 仪表盘 | `templates/official/_shared/generated-illustrations/data-dashboard.svg` | `templates/official/data/data-insight/dashboard/` | BI 看板、指标监控、实时数据页。 |
| 数据洞察报告 | 洞察分析 | `templates/official/_shared/generated-illustrations/data-dashboard.svg` | `templates/official/data/data-insight/insight/` | 趋势分析、异常定位、洞察结论页。 |
| 数据洞察报告 | 研究报告 | `templates/official/_shared/generated-illustrations/data-dashboard.svg` | `templates/official/data/data-insight/research/` | 调研样本、统计图表、研究结论页。 |

### 教育培训

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 教育培训课件 | 课题讲授 | `templates/official/_shared/generated-illustrations/education-learning-path.svg` | `templates/official/education/education/lecture/` | 知识路径、课程结构、重点讲授页。 |
| 教育培训课件 | 简洁教学 | `templates/official/_shared/generated-illustrations/education-learning-path.svg` | `templates/official/education/education/minimal/` | 低透明度学习路径装饰，保持页面清爽。 |
| 教育培训课件 | 互动工作坊 | `templates/official/_shared/generated-illustrations/education-learning-path.svg` | `templates/official/education/education/workshop/` | 小组任务、共创流程、练习活动页。 |

### 融资路演

| 模板 | 主题风格 | 推荐配图 | 模板目录 | 配图用途 |
|---|---|---|---|---|
| 创业融资路演 | 投资人版 | `templates/official/_shared/generated-illustrations/pitch-investor-story.svg` | `templates/official/pitch/pitch/investor/` | 投资亮点、核心指标、融资计划页。 |
| 创业融资路演 | 产品亮点 | `templates/official/_shared/generated-illustrations/product-mockup.svg` | `templates/official/pitch/pitch/product/` | 产品能力、界面展示、商业化路径页。 |
| 创业融资路演 | 创业故事 | `templates/official/_shared/generated-illustrations/pitch-investor-story.svg` | `templates/official/pitch/pitch/startup/` | 创业叙事、团队使命、增长证据页。 |

## 后续开发建议

1. 如果某个模板开始正式商业化开发，优先把共享资产复制到当前主题目录的 `assets/` 下，再按模板风格微调颜色、裁切和透明度。
2. 如果资产会被多个模板长期复用，可以保留在 `_shared/generated-illustrations/`，但代码引用时要集中封装，避免路径散落。
3. 如果需要更真实的商务人物、产品场景或行业照片，应单独为该主题生成专属图片，保存到：

```text
templates/official/<category-slug>/<template-slug>/<theme-slug>/assets/
```

4. 新增模板时，应同步更新本文档，至少补充：模板名称、主题风格、推荐配图、模板目录、配图用途。
