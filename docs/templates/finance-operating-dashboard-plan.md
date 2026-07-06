# 财务经营 / 经营数据看板模板规划

## 模板定位

| 项目 | 规划 |
| --- | --- |
| 模板分类 | 财务经营 |
| 模板名称 | 经营数据看板 |
| 模板 ID | `operating-dashboard` |
| 目录 | `templates/official/finance/operating-dashboard/<theme>/` |
| 适用场景 | 高层月度经营会、财务经营驾驶舱、异常指标预警、经营复盘材料 |
| 设计目标 | 用“管理驾驶舱 + 财务监控 + 经营结论”的方式表达，避免简单条形图，提升商业化质感 |

## 主题风格

| 主题风格 | 主题 ID | 是否实现 | 设计思路 | 装饰元素 | 背景方式 |
| --- | --- | --- | --- | --- | --- |
| 管理驾驶舱 | `control-room` | 已创建 | 深色数据指挥舱，突出核心指标、排行、趋势和经营结论 | 仪表盘圆环、趋势折线、指标卡、扫描线 | 深蓝渐变、细网格、玻璃卡片 |
| 指标预警 | `warning` | 已创建 | 风险监控视角，突出阈值、异常、影响和处理动作 | 警示灯、异常点、风险列表、状态条 | 墨蓝底色配琥珀预警色 |
| 月度经营 | `monthly` | 已创建 | 月度例会复盘，突出本月指标、趋势变化、重点事项和下月动作 | 月历卡、经营指标块、趋势线、会议摘要 | 浅灰蓝经营报表背景 |

## 字段组合

| 页面类型 | 建议字段 |
| --- | --- |
| 首页 | 标题、核心经营结论、3 个关键指标 |
| 指标总览页 | 指标名称、当前值、目标值、同比/环比、结论 |
| 异常分析页 | 异常指标、阈值、影响范围、原因、处理动作 |
| 月度复盘页 | 月份、收入/利润/现金流、重点事项、下月计划 |

## 实现路径

| 文件 | 用途 |
| --- | --- |
| `templates/official/finance/operating-dashboard/control-room/manifest.json` | 官方模板同步元数据 |
| `templates/official/finance/operating-dashboard/control-room/template.json` | 模板主题视觉定义 |
| `templates/official/finance/operating-dashboard/control-room/renderer.js` | 主题元数据导出入口 |
| `templates/official/finance/operating-dashboard/control-room/assets/template-specific-illustration.svg` | 模板专属缩略图/装饰图 |
| `ppt-ai-app/src/ppt-exporter.js` | PPTX 真实导出装饰层 |
| `ppt-ai-app/src/ppt-service.js` | HTML 预览装饰层 |

## 注意事项

- 模板页面内不直接显示主题风格名称，例如“管理驾驶舱”“指标预警”“月度经营”。
- 主题风格只用于筛选和设计差异，页面文案使用业务化标签，例如 `CONTROL PANEL`、`RISK SIGNAL`、`MONTHLY REVIEW`。
- 预览和下载都必须走同一套 `templateVisual`，避免预览与真实 PPTX 不一致。
