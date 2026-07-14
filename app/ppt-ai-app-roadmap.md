# PPT AI 应用开发规划(自研轻量链路版)

> 本文替代 `ppt-ai-app-integration-design.md` 第 15 章「开发阶段」,把粗粒度阶段重做成可排期、可分配、可验收的任务级规划。
> 路线决策:**自研生成/渲染/导出链路**(不封装 Presenton,Presenton 仅作参考实现)。
> 配套契约见 `billing-integration-spec.md`、`developer-requirements.md`;架构语义见 `ppt-ai-app-integration-design.md` 第 6–13 章。

---

## 0. 现状基线(规划起点,不是待办)

当前 `ppt-ai-app/` 已具备:

- ✅ SSO 票据校验(`http-app.js#handleEnter` → `platform.verifyLaunchTicket`,校验 `app_id/product_id`)。
- ✅ 余额查询(`/api/entitlement-balance`)。
- ✅ 计费闭环 mock(`mock-generation.js`:`reserve → settle/release`,稳定幂等键 `{taskId}:ppt_generate:reserve`)。
- ✅ `PlatformClient` 封装 + `{code,message,data}` 拆包 + `PlatformError`。
- ✅ 测试:`config / http-app / platform-client` 三个 test 文件。

当前**不具备**(自研链路必须补齐):持久化(无 DB、session 是内存 `Map`)、前端框架、LLM 接入、模板/渲染、导出、异步任务、对账 worker、对象存储。

> 结论:旧规划"阶段 1 平台接入"已完成约 80%,真正的工作从"把 mock 闭环生产化"和"自研生成链路"开始。

---

## 1. 总体路线(6 个阶段,按依赖+风险排序)

| 阶段 | 目标 | 可演示里程碑 | 风险 |
|---|---|---|---|
| P0 技术选型与骨架 | 定栈、建 DB、项目结构、前端脚手架 | 服务起得来、迁移跑得通、CI 绿 | 中(决策成本) |
| P1 计费闭环生产化 | mock 闭环 → 持久化+对账可靠 | 重启不掉登录;settle/release 失败可自动重试对账 | 高(计费正确性) |
| P2 生成内核 | 异步任务 + LLM 网关 + 大纲/Slide JSON | 输入主题 → 产出符合 Schema 的 slide JSON(无界面) | 高(LLM 遵从 Schema) |
| P3 模板与渲染预览 | 模板/layout + React renderer + 前端页面 | 浏览器里看到可预览的整套 PPT | 中 |
| P4 导出保真 | PDF/PPTX 导出 + 鉴权下载 | 导出文件与预览基本一致 | **最高**(保真) |
| P5 增强能力 | 单页编辑/图片生成/文档解析/更多模板 | 上传资料生成、编辑、配图 | 中 |
| P6 上线加固 | 成本护栏/可观测/安全/并发 | 通过验收清单,可对外开量 | 中 |

> 关键风险前置:LLM Schema 可靠性(P2)和导出保真(P4)是两大技术风险,各自独立成阶段、独立验收,不再像旧规划那样压成一行。计费对账(P1)前置到生成之前,确保扣费链路在接真实生成前就已可靠。

---

## 2. 技术选型(P0 定稿,后续阶段不得再改)

| 维度 | 选型 | 理由 |
|---|---|---|
| 运行时 | Node ≥ 20,ESM | 沿用现有壳,无需重写 |
| Web 框架 | 引入轻量框架(建议 Fastify)替换裸 `http` | 自研链路路由/中间件/上传变多,裸 http 维护成本高 |
| 前端 | React(建议 Vite + React 18)+ 同构 slide renderer | 设计文档 §7.4 要求"同一套 renderer 服务预览+导出",必须 React |
| DB | 开发 SQLite,生产 PostgreSQL;用迁移工具(建议 Drizzle/Knex) | 对齐 Presenton;§9 数据表需持久化 |
| 对象存储 | 开发本地 fs,生产 S3 兼容 | 上传/图片/导出产物落地 |
| 异步任务 | DB job 表 + 进程内 worker(首版),预留 Redis/BullMQ | 生成是长任务,必须异步;首版避免引入 Redis |
| LLM | Anthropic Claude(默认 `claude-opus-4-8`,结构化用最新模型);封装 LLM Gateway | 环境默认 Claude;Gateway 隔离模型与重试 |
| 图片 | 首版 stock(Pexels/Pixabay)占位,生成 provider 留 P5 | 降低 P3 成本 |
| 文档解析 | 首版 `.txt`,`.pdf`(pdf-parse)留 P5 | 控制首版范围 |

> 安全红线(全程遵守):`INTERNAL_API_TOKEN` 不入库/不入日志;`/api/internal/*` 仅后端调;用户只能访问自己的资源;导出下载鉴权;LLM prompt/文件长度限流。

---

## 3. 阶段与任务明细

> 任务字段:**产出物 / 涉及模块 / 依赖 / 验收**。负责人用通用角色:`App后端`、`App前端`、`测试`、`运维`;平台侧配置依赖标注 `平台方`(走产品经理+billing)。

### P0 — 技术选型与项目骨架

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P0-1 | 选型定稿 | `app/tech-decisions.md`(锁定第 2 节) | — | 团队签字,后续不回炉 | App后端 |
| P0-2 | 引入 Web 框架 | `src/server.js`/`http-app.js` 迁到 Fastify,保留现有路由行为与测试 | P0-1 | 现有 3 个 test 全绿 | App后端 |
| P0-3 | 接入 DB + 迁移 | `src/db/`、迁移脚本、§9 五张表(sessions/presentations/slides/generation_tasks/assets) | P0-1 | `npm run migrate` 建表成功,SQLite/PG 双跑 | App后端 |
| P0-4 | 对象存储抽象 | `src/storage/`(`put/get/signedUrl`),本地 fs 实现 | P0-1 | 单测:存取一致、越权路径拒绝 | App后端 |
| P0-5 | 前端脚手架 | Vite+React,`/auth/launch /dashboard /create /outline /presentation /exports` 路由空壳 | P0-1 | `npm run dev` 起得来,空壳页可达 | App前端 |
| P0-6 | CI 与环境 | lint+test+migrate 流水线;`.env.example` 补全新增变量 | P0-2..5 | CI 绿;README 更新启动方式 | 运维 |

**P0 里程碑**:新栈下服务可启动、迁移可跑、前端空壳可访问、CI 绿。

### P1 — 计费闭环生产化(把 mock 变成可靠计费引擎)

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P1-1 | 会话持久化 | session 从内存 `Map` 迁到 `ppt_app_sessions` 表,带过期 | P0-3 | 重启进程后登录不丢;过期会话被拒 | App后端 |
| P1-2 | 任务持久化 | `generation_tasks` 落库:`status/hold_id/reserved/settled/idempotency_key/error` | P0-3 | mock 生成全程状态可查 | App后端 |
| P1-3 | 幂等键持久化与复用 | 幂等键随任务入库,重试读库复用,绝不重生成 | P1-2 | 同键重复 reserve 不重复扣(集成测试) | App后端 |
| P1-4 | 错误语义映射 | `PlatformClient` 把 `60005→积分不足`、`40003→登录失效`、5xx 有限重试(不换键) | — | 单测覆盖三类错误分支 | App后端 |
| P1-5 | 对账 worker | 后台 worker 扫 `settle_failed/release_failed`,按同 `hold_id` 重试;`/internal/reconcile` 运维入口 | P0-3,P1-2 | 注入 settle 失败 → worker 自动补结算;状态收敛 | App后端 |
| P1-6 | mock 接管真实计费流 | 用 P1-1..5 重写 `mock-generation.js` 调用路径(仍 mock 生成内容) | P1-1..5 | reserve→settle/release 全链路落库且幂等;失败必释放 | 测试 |

**P1 里程碑**:计费链路在接真实生成**之前**已生产级可靠(持久、幂等、可对账)。

### P2 — 生成内核(LLM,无界面)

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P2-1 | 异步任务框架 | `src/jobs/`:job 入队/worker/状态机(pending/running/succeeded/failed) | P0-3 | 提交任务立即返回 id;worker 异步推进 | App后端 |
| P2-2 | LLM Gateway | `src/llm/`:封装 Claude、超时/重试/成本统计;模型可配 | P0-1 | 单测:mock LLM 可注入;超时重试生效 | App后端 |
| P2-3 | 大纲生成 | `POST /api/presentations`(prompt/slide_count/language/instructions)→ outline JSON 落 `presentations` | P2-1,P2-2 | 给定主题产出 title+slides 大纲 | App后端 |
| P2-4 | 大纲确认/编辑 | `PUT /api/presentations/{id}/outline` | P2-3 | 编辑后大纲持久化 | App后端 |
| P2-5 | **Schema 受限 Slide JSON 生成** | 按 layout JSON Schema 生成每页;**输出校验+不合规重试+降级**;落 `slides` | P2-4,P3-1(schema 定义) | 100 次生成 schema 通过率达标(定阈值,如 ≥95%);不合规自动重试 | App后端 |
| P2-6 | 生成编排接入计费 | 生成任务 = `reserve(6) → 生成 → settle/release`,复用 P1 链路 | P1-6,P2-3,P2-5 | 成功扣 6、失败退 6、积分不足(60005)不调 LLM | 测试 |

**P2 里程碑**:输入主题 → 后台异步产出符合 Schema 的整套 slide JSON,且扣费正确(暂无可视界面)。
**风险专项**:P2-5 是核心难点,需先定"校验失败重试次数/降级策略",作为独立验收项。

### P3 — 模板与渲染预览

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P3-1 | 模板与 layout 定义 | 3–5 套模板,每 layout:`layout_id/name/description/json_schema/renderer_component` | P0-5 | Schema 可被 P2-5 消费;模板可枚举 | App前端 |
| P3-2 | LLM 选 layout | 每页由 LLM 选 layout index → `structure_json` | P2-5,P3-1 | 选择结果落库且与页数一致 | App后端 |
| P3-3 | React slide renderer | 同构组件:一份组件服务预览+(P4)导出 | P3-1 | 给定 slide JSON 渲染出页面 | App前端 |
| P3-4 | 前端主流程页面 | `/create`(主题/页数/语言/模板)、`/outline/:id`(改大纲)、`/presentation/:id`(预览) | P3-3,P2-3,P2-4 | 用户走完"建→大纲→预览"闭环 | App前端 |
| P3-5 | 余额与资产校验前置 | `/dashboard` 显示余额、列表;生成前查 `/api/my/assets` | P1-1 | 无资产/无积分时正确拦截 | App前端 |

**P3 里程碑**:用户在浏览器从主题生成一套**可预览**的 PPT,内容符合模板 Schema。

### P4 — 导出保真(最高风险,独立阶段)

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P4-1 | 导出任务接入 | `POST /api/presentations/{id}/export` → 异步 export task | P2-1,P3-3 | 返回 export_task_id,状态可查 | App后端 |
| P4-2 | PDF 导出 | Puppeteer/Chromium 渲染同构 renderer → PDF,产物入对象存储 | P3-3,P4-1 | PDF 与预览基本一致 | App后端 |
| P4-3 | PPTX 导出 | slide JSON → PPTX(可编辑元素优先,复杂页降级为图) | P4-2 | PPTX 在 PowerPoint 打开不报错、版式正确 | App后端 |
| P4-4 | 保真回归集 | 固定样例集 + 视觉/版式对比基线 | P4-2,P4-3 | 样例集导出无"预览好看导出变形"回归 | 测试 |
| P4-5 | 鉴权下载 | 签名 URL,仅所属用户可下 | P0-4 | 跨用户下载被拒(集成测试) | App后端 |
| P4-6 | 导出计费策略落地 | 首版导出免费(`ppt_export=0`),保留 consume 开关 | — | 配置开关切换扣/不扣 | App后端 |

**P4 里程碑**:导出 PDF/PPTX 与预览一致、下载鉴权、有保真回归基线。

### P5 — 增强能力

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P5-1 | 单页编辑 | `POST /api/slides/{id}/edit`:`consume(2)` → LLM 改 JSON → 存 | P2-5,P3-3 | 改单页生效、扣 2;失败策略明确(默认不退,文档说明) | App后端 |
| P5-2 | 图片生成 | `consume(N)` → provider 生成 → 存 `assets`;**失败补偿策略**(consume 先扣,失败是否退需定稿) | P0-4 | 生成配图入库;失败处理符合约定 | App后端 |
| P5-3 | 文档解析 | 上传 `.txt/.pdf` → 文本作为生成 context;大小/类型/超时限流 | P0-4,P2-3 | 上传资料影响生成结果;超限被拒 | App后端 |
| P5-4 | 更多模板 | 扩充模板库 | P3-1 | 模板数达运营目标 | App前端 |

**P5 里程碑**:支持上传资料生成、单页编辑、自动配图。

### P6 — 上线加固

| ID | 任务 | 产出物 / 涉及模块 | 依赖 | 验收 | 负责 |
|---|---|---|---|---|---|
| P6-1 | 成本护栏 | LLM/图片调用配额、prompt/文件长度上限、单用户速率限制 | P2-2 | 超限熔断,成本可控 | App后端 |
| P6-2 | 可观测 | 结构化日志、生成/导出/扣费指标、对账告警 | P1-5 | 关键链路有指标与告警 | 运维 |
| P6-3 | 并发/多实例 | 会话与 job 在多实例下正确(锁/幂等),压测 | P1-1,P2-1 | 多实例无重复扣费、无任务重跑 | 测试 |
| P6-4 | 安全审查 | 越权、上传、下载、内部接口暴露面复查 | 全部 | 通过 `/security-review` 清单 | 测试 |
| P6-5 | 验收对齐 | 跑通 `ppt-ai-app-integration-design.md` §16 应用侧清单 | 全部 | 清单逐项过 | 测试 |

**P6 里程碑**:通过验收清单,可对外开量。

---

## 4. 平台侧并行依赖(平台方,需早于 P1 联调完成)

> 这些不在 ppt-ai-app 代码内,但 P1 起就需要,必须并行推进(走 `platform-integration-tasks.md`):

- 建应用 `ppt-ai` → `app_id`;挂商品 `product_type=application` → `product_id`。
- 配 4 个积分套餐(体验/基础/专业/企业)+ 默认价 + `can_view/can_buy/can_use`。
- 配 `usage_event_types_json`、`INTERNAL_API_TOKEN`、IP 白名单。
- 提供测试账号 + 测试积分。

**阻塞点**:平台侧 ID/密钥/白名单未就绪 → P1-6 与 P2-6 的真实联调无法进行(可用 mock PlatformClient 先行,但上线前必须真联调)。

---

## 5. 关键决策清单(开工前必须拍板,避免返工)

1. **Slide 生成不合规策略**:重试次数、降级方式、阈值(P2-5 前定)。
2. **图片生成失败是否退费**:`consume` 先扣,provider 失败要不要改 `reserve`(P5-2 前定)。
3. **PPTX 复杂页降级规则**:哪些版式转可编辑元素、哪些转整页图(P4-3 前定)。
4. **前端栈与平台 Vue 体系不一致**:ppt-ai-app 用 React(§7.4 强约束),需确认团队接受双栈。
5. **异步队列是否引入 Redis**:首版 DB job 表是否够用,何时升级(P2-1 评估)。
