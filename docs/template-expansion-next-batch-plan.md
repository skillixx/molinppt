# 下一批 PPT 模板扩容规划

## 目标

当前官方模板扫描结果为 69 个可用模板。本轮扩容建议新增 51 个主题模板，将总量提升到 120 个左右。

本规划里的每一行都按最终可上线目录来规划：

```text
templates/official/<category>/<template>/<theme>/
  manifest.json
  template.json
  renderer.js
  thumbnail.png
  assets/
```

## 扩容原则

- 不再补同质化换色模板，每个新增模板都要有明确业务场景。
- 不能直接使用整页模板图片作为背景，主体必须用代码绘制，保证 PPTX 可编辑。
- 图片只用于局部装饰、业务场景、产品 mockup、纹理、图标或氛围资产。
- 页面里不直接显示模板名称或主题风格名称。
- 首页、目录页、内容页、数据页、分析页、行动页、结尾页至少有 4 类明显不同版式。
- 在线预览和 PPTX 导出必须使用同一套布局语义。
- 优先开发能复用版式组件的模板，例如看板、漏斗、矩阵、路线图、风险图、地图、旅程图、经营驾驶舱。

## 数量规划

| 分类 | 当前数量 | 新增数量 | 目标数量 | 补充重点 |
|---|---:|---:|---:|---|
| business | 9 | 5 | 14 | 管理汇报、组织、增长、诊断 |
| strategy | 6 | 7 | 13 | 转型、增长、竞争、市场进入 |
| finance | 9 | 5 | 14 | 成本、利润、现金流、内控 |
| sales | 6 | 8 | 14 | 大客户、渠道、售前、销售培训 |
| product | 8 | 5 | 13 | 用户研究、商业化、竞品、增长 |
| marketing | 7 | 7 | 14 | 社媒、私域、节日、整合传播 |
| data | 8 | 5 | 13 | 调研、实验、治理、渠道数据 |
| education | 8 | 5 | 13 | 知识点、公开课、研修、职业技能 |
| pitch | 8 | 4 | 12 | Pre-A、科技创业、招商融资、并购 |
| 合计 | 69 | 51 | 120 | - |

## P0 第一批优先开发

P0 先做 18 个，目标是快速补齐高频场景，并沉淀可复用的专业版式组件。

| 分类 | 模板目录 | 主题目录 | 中文名称 | 设计方向 | 需要素材 |
|---|---|---|---|---|---|
| business | business-growth-report | opportunity-map | 业务增长汇报 - 机会地图 | 机会分层地图、增长路径、关键动作卡 | 区域地图纹理、增长箭头图标 |
| business | operation-diagnosis | issue-tree | 经营问题诊断 - 问题树 | 问题树、原因链路、整改闭环 | 诊断放大镜、风险节点图标 |
| strategy | transformation-plan | digital-blueprint | 企业转型方案 - 数字化蓝图 | 蓝图底稿、阶段路线、能力升级矩阵 | 系统界面 mockup、蓝图网格 |
| strategy | growth-strategy | second-curve | 增长战略规划 - 第二曲线 | 双曲线增长模型、业务组合、阶段投资 | 曲线轨迹、业务节点图标 |
| strategy | competitor-analysis | swot-map | 竞争对手分析 - SWOT 地图 | 四象限、竞争坐标、差异定位 | 坐标轴、竞品卡片图标 |
| finance | cost-control-plan | cost-breakdown | 成本控制方案 - 成本拆解 | 成本结构树、降本动作、责任矩阵 | 成本图标、工厂或办公局部图 |
| finance | profit-analysis | profit-bridge | 利润分析报告 - 利润桥 | 利润桥、毛利结构、改善杠杆 | 财务曲线、桥形结构纹理 |
| finance | cashflow-analysis | cashflow-forecast | 现金流分析报告 - 现金流预测 | 资金流向、回款周期、风险预警 | 资金流箭头、银行场景局部图 |
| sales | key-account-plan | decision-chain | 大客户攻坚方案 - 决策链路 | 客户组织图、关键人地图、赢单路径 | 客户画像、组织关系节点 |
| sales | channel-recruitment | partner-policy | 渠道招商方案 - 合作政策 | 渠道收益模型、政策对比、招商路线 | 握手局部图、渠道网络图标 |
| product | user-research-report | interview-insight | 用户研究报告 - 访谈洞察 | 用户画像、访谈摘录、需求机会池 | 人物剪影、访谈卡片纹理 |
| product | product-commercialization | pricing-strategy | 产品商业化方案 - 定价策略 | 定价梯度、套餐权益、收入模型 | 产品 mockup、价格标签图标 |
| marketing | social-media-plan | short-video-growth | 社媒运营方案 - 短视频增长 | 内容节奏、平台矩阵、转化漏斗 | 手机界面 mockup、播放图标 |
| marketing | private-domain-plan | member-layering | 私域运营方案 - 会员分层 | 用户分层、触达路径、复购闭环 | 社群气泡、会员卡片图标 |
| data | market-research-report | survey-analysis | 市场调研报告 - 问卷分析 | 样本结构、问题结论、建议矩阵 | 调研表单、数据图标 |
| data | experiment-analysis | ab-test | 实验分析报告 - A/B 测试 | 实验路径、显著性结果、策略验证 | 实验分组图、漏斗图标 |
| education | knowledge-point-courseware | concept-breakdown | 知识点讲解课件 - 概念拆解 | 概念拆解、案例解释、练习反馈 | 黑板纹理、概念卡片图标 |
| pitch | pre-a-funding-bp | market-validation | Pre-A 融资 BP - 市场验证 | 牵引数据、市场验证、资金用途 | 产品界面、增长曲线、团队剪影 |

## P1 第二批补充

P1 做 18 个，重点扩大销售、市场、战略和教育类覆盖。

| 分类 | 模板目录 | 主题目录 | 中文名称 | 设计方向 | 需要素材 |
|---|---|---|---|---|---|
| business | department-review | team-performance | 部门述职报告 - 团队绩效 | 团队目标、绩效雷达、成果墙 | 团队剪影、奖章图标 |
| business | management-meeting | decision-agenda | 管理层会议材料 - 议题决策 | 会议议题、决策事项、行动追踪 | 会议室局部、决策印章 |
| strategy | market-entry-strategy | region-entry | 市场进入策略 - 区域进入 | 区域地图、进入节奏、渠道布局 | 区域地图、渠道图标 |
| strategy | business-model-design | value-chain | 商业模式设计 - 价值链 | 价值链、盈利模型、生态节点 | 价值链线条、平台图标 |
| finance | internal-control-report | risk-check | 内控合规报告 - 风险检查 | 风险等级、检查清单、整改闭环 | 盾牌、审计文件局部 |
| finance | investment-return-analysis | roi-model | 投资回报分析 - ROI 模型 | 投入产出、回收周期、收益曲线 | 投资图标、收益曲线 |
| sales | sales-training-course | objection-handling | 销售培训课件 - 异议处理 | 话术框架、场景演练、成交技巧 | 对话气泡、训练场景 |
| sales | presales-technical-plan | architecture-solution | 售前技术方案 - 架构方案 | 架构图、需求匹配、交付保障 | 技术架构节点、设备图标 |
| product | competitor-analysis-report | experience-gap | 竞品分析报告 - 体验差距 | 竞品矩阵、体验路径、机会洞察 | 应用窗口 mockup、对比图标 |
| product | product-growth-plan | retention-path | 产品增长方案 - 留存路径 | 激活、留存、转化、复购路径 | 用户路径线、增长节点 |
| marketing | integrated-campaign | media-mix | 整合营销传播 - 媒介组合 | 媒介矩阵、传播节奏、预算分配 | 媒体卡片、声量波纹 |
| marketing | festival-campaign | promo-rhythm | 节日营销方案 - 促销节奏 | 节点节奏、权益设计、活动转化 | 节日局部元素、优惠标签 |
| data | channel-data-analysis | traffic-quality | 渠道数据分析 - 流量质量 | 来源结构、质量评分、转化链路 | 渠道节点、数据流线 |
| data | data-governance-report | metric-standard | 数据治理汇报 - 指标口径 | 指标地图、治理路线、质量看板 | 数据库纹理、标准印章 |
| education | public-courseware | enrollment-conversion | 公开课课件 - 招生转化 | 公开课价值、内容安排、转化路径 | 直播窗口、课程海报局部 |
| education | workshop-course | practice-review | 研修工作坊 - 实践复盘 | 小组共创、练习卡、复盘画布 | 便签、白板、协作图标 |
| pitch | tech-startup-pitch | ai-saas | 科技创业路演 - AI SaaS | 技术壁垒、产品架构、商业增长 | AI 网格、产品界面 mockup |
| pitch | investment-promotion-plan | project-return | 招商融资方案 - 项目收益 | 项目价值、收益测算、合作模式 | 项目场景、收益曲线 |

## P2 第三批增强

P2 做 15 个，用来补长尾场景和行业深度。

| 分类 | 模板目录 | 主题目录 | 中文名称 | 设计方向 | 需要素材 |
|---|---|---|---|---|---|
| business | organization-management | talent-review | 组织管理汇报 - 人才盘点 | 组织结构、人才九宫格、管理动作 | 人才剪影、组织节点 |
| strategy | organization-capability | capability-model | 组织能力诊断 - 能力模型 | 能力雷达、短板诊断、提升路径 | 雷达网格、能力图标 |
| strategy | brand-strategy-consulting | brand-architecture | 品牌战略咨询 - 品牌架构 | 品牌金字塔、传播主张、品牌矩阵 | 品牌样机、色卡纹理 |
| finance | expense-analysis | department-expense | 费用分析报告 - 部门费用 | 费用结构、异常项、优化动作 | 费用票据、部门图标 |
| sales | regional-sales-plan | customer-map | 区域销售计划 - 客户地图 | 区域目标、客户地图、拜访节奏 | 地图纹理、客户点位 |
| sales | opportunity-progress-report | pipeline-stage | 商机推进汇报 - 商机阶段 | pipeline、阻塞问题、下一步动作 | 销售漏斗、阶段标签 |
| sales | customer-success-plan | renewal-growth | 客户成功方案 - 续费增长 | 健康度、使用提升、续费路径 | 健康度仪表、客户卡片 |
| product | feature-planning | version-breakdown | 功能规划方案 - 版本拆解 | 功能地图、版本节奏、价值优先级 | 产品界面、版本标签 |
| marketing | content-marketing-plan | content-calendar | 内容营销计划 - 内容日历 | 选题规划、内容日历、渠道分发 | 日历、内容卡片、平台图标 |
| marketing | brand-upgrade-plan | visual-refresh | 品牌升级方案 - 视觉升级 | 品牌定位、视觉系统、传播焕新 | 品牌板、色卡、物料 mockup |
| marketing | activity-review-report | roi-review | 活动复盘报告 - ROI 评估 | 曝光、转化、ROI、经验沉淀 | 活动现场局部、数据标签 |
| data | user-layer-analysis | rfm-model | 用户分层分析 - RFM 模型 | RFM 分群、价值层级、运营策略 | 分层气泡、用户卡片 |
| education | teacher-demo-course | teaching-process | 教师说课课件 - 教学过程 | 教学目标、过程设计、教学反思 | 课堂黑板、流程卡片 |
| education | skill-training | operation-steps | 职业技能培训 - 实操步骤 | 操作流程、案例演练、能力认证 | 工具图标、步骤示意 |
| pitch | acquisition-project-intro | synergy-value | 并购项目介绍 - 协同价值 | 标的概况、协同价值、交易结构 | 企业拼图、协同节点 |

## 开发节奏建议

1. 每次只开发 1 个最终主题模板目录，完成预览、PPTX 导出、缩略图、测试、同步后再做下一个。
2. 每 6 个模板做一次小版本验收，检查生成工作台、模板管理、资产库预览和下载 PPTX。
3. 每个分类至少先完成 2 个 P0/P1 模板，再继续补同分类的 P2。
4. 每个新模板优先创建独立 `visual.layout`，避免复用旧的 `executive`、`academy`、`marketing` 后只换颜色。
5. 对于需要图片的模板，先创建 `assets/asset-plan.md`，再生成局部素材，最后接入预览和导出。

## 第一轮推荐顺序

第一轮建议先做这 6 个，因为最容易提升平台观感，也能沉淀可复用组件：

1. `strategy/transformation-plan/digital-blueprint`
2. `sales/key-account-plan/decision-chain`
3. `marketing/social-media-plan/short-video-growth`
4. `finance/profit-analysis/profit-bridge`
5. `product/user-research-report/interview-insight`
6. `data/experiment-analysis/ab-test`

完成这 6 个后，平台模板数会从 69 增加到 75，并且会新增蓝图、决策链、短视频运营、利润桥、用户访谈、A/B 实验这 6 类明显不同的版式体系。
