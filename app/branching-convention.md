# 分支与提交规范(PPT AI 应用)

> 目的:让每位开发者在**每个阶段/任务修改代码时,必须创建对应分支**,不允许直接在 `master` 上改。
> 分支命名直接绑定 [`./ppt-ai-app-roadmap.md`](./ppt-ai-app-roadmap.md) 的阶段(P0–P6)与任务 ID(如 `P2-5`)。
> 适用范围:`ppt-ai-app/` 代码与 `app/`、`docs/` 文档。

---

## 1. 基本原则

1. **`master` 受保护**:任何人不得直接 `git commit` / `git push` 到 `master`。所有改动经分支 + PR 合入。
2. **一个任务一条分支**:roadmap 里每个任务(`P0-1`、`P1-5`、`P2-5`…)对应一条分支;不要把多个任务塞进一条分支。
3. **分支从最新 `master` 切出**:开工前先 `git switch master && git pull`,再切分支。
4. **分支短命**:任务完成即合并并删除;长期不合的分支要 rebase 跟上 `master`。
5. **改动必须可验收**:PR 必须对应 roadmap 中该任务的「验收」项。

---

## 2. 分支命名规范

```
<type>/<task-id>-<slug>
```

| 段 | 规则 | 说明 |
|---|---|---|
| `type` | `feat`/`fix`/`docs`/`refactor`/`test`/`chore`/`hotfix` | 改动性质 |
| `task-id` | roadmap 任务 ID 小写,连字符 | 如 `p2-5`、`p1-5`;阶段级整体工作用 `p2` |
| `slug` | 英文小写短横线,≤5 词 | 一眼看懂这条分支干什么 |

**type 取值含义**

| type | 用途 |
|---|---|
| `feat` | 新功能/新能力(roadmap 大多数任务) |
| `fix` | 修复已合入代码的缺陷 |
| `refactor` | 不改行为的重构 |
| `test` | 仅补测试 |
| `docs` | 仅文档(`app/`、`docs/`、README) |
| `chore` | 构建/CI/依赖/脚本 |
| `hotfix` | 线上紧急修复,从 `master` 切、优先合回 |

**各阶段示例**

| 任务 | 分支名 |
|---|---|
| P0-2 引入 Fastify | `feat/p0-2-fastify-migration` |
| P1-1 会话持久化 | `feat/p1-1-session-persistence` |
| P1-5 对账 worker | `feat/p1-5-reconcile-worker` |
| P2-2 LLM Gateway | `feat/p2-2-llm-gateway` |
| P2-5 Slide JSON 生成 | `feat/p2-5-slide-json-schema` |
| P4-3 PPTX 导出 | `feat/p4-3-pptx-export` |
| 修 P2-5 重试死循环 | `fix/p2-5-schema-retry-loop` |
| 补 P1 测试 | `test/p1-billing-idempotency` |
| 线上扣费紧急修复 | `hotfix/billing-double-charge` |

> 多人协作同一阶段时,可选用**阶段集成分支** `phase/p2`:各任务分支先合入 `phase/p2`,阶段整体验收通过后再合入 `master`。单人开发不需要,直接合 `master`。

---

## 3. 分支生命周期

```text
1. 同步主干      git switch master && git pull
2. 创建分支      git switch -c feat/p2-5-slide-json-schema
3. 开发+自测     小步提交;npm test 必须绿
4. 跟进主干      git fetch && git rebase origin/master   # 落后较多时
5. 推送          git push -u origin feat/p2-5-slide-json-schema
6. 开 PR         填 PR 模板,关联任务 ID,列对应验收项
7. 评审          由「产品经理」做业务/验收 review;测试通过
8. 合并          squash 合入 master
9. 清理          删除已合并分支(本地 + 远端)
```

---

## 4. 提交信息规范

```
<type>(<task-id>): <简短说明>

<可选正文:为什么这么做、影响范围>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>   # 仅 AI 参与时加
```

- `type` 与分支 type 一致;`task-id` 用 roadmap ID,如 `feat(p2-5): 按 layout schema 生成 slide 并校验重试`。
- 一次提交只做一件事;不要把无关改动混提。
- 提交说明用中文,描述「做了什么 + 为什么」,不写「修改代码」这类空话。

---

## 5. PR 规范

**标题**:`[P2-5] 按 layout schema 生成 slide JSON`(方括号内为任务 ID)。

**正文模板**:

```markdown
## 关联任务
- roadmap 任务:P2-5(Schema 受限 Slide JSON 生成)

## 改动说明
<做了什么、关键设计决策>

## 对应验收项(逐条勾)
- [ ] 100 次生成 schema 通过率 ≥ 阈值
- [ ] 不合规自动重试/降级
- [ ] 接入 reserve→生成→settle/release,失败必释放

## 测试
- [ ] npm test 全绿
- [ ] 关键路径手测说明

## 风险与回滚
<影响面、如何回滚>
```

**合并门槛**:① `npm test` 绿;② 验收项全勾;③ 「产品经理」review 通过;④ 与 `master` 无冲突。

---

## 6. 禁止事项

- ❌ 直接在 `master` 提交/推送(`hotfix` 也要走分支,只是优先合)。
- ❌ 一条分支跨多个 roadmap 任务。
- ❌ 分支名不带 `task-id`(无法追溯到 roadmap)。
- ❌ 把 `INTERNAL_API_TOKEN`、`.env`、密钥、导出产物、`node_modules` 提交进库。
- ❌ 跳过 PR 直接合并未评审代码。
- ❌ 用 `git merge` 制造无意义合并提交(统一 squash;落后主干用 rebase)。

---

## 7. 速查

```bash
# 开一个任务
git switch master && git pull
git switch -c feat/p2-5-slide-json-schema

# 开发中跟进主干
git fetch && git rebase origin/master

# 提交
git add -A
git commit -m "feat(p2-5): 按 layout schema 生成 slide 并校验重试"

# 推送并开 PR
git push -u origin feat/p2-5-slide-json-schema

# 合并后清理
git switch master && git pull
git branch -d feat/p2-5-slide-json-schema
git push origin --delete feat/p2-5-slide-json-schema
```
