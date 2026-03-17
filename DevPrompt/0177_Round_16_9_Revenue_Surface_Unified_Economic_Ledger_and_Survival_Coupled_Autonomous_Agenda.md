# Round 16.9 — Revenue Surface, Unified Economic Ledger, and Survival-Coupled Autonomous Agenda

> **文件定位**：这是 Round 16.9 的正式开发提示词。  
> **前置事实**：Round 16.8 已对 collective lifecycle 做了关键纠偏与加固，修复了 staleness washout、fake refresh、selector explainability drift、delegation service guard 缺口与 `lastSeen` fallback 语义问题。collective 主线现在已经从“结构存在”推进到“中层行为可信”。  
> **但全局大审计同时确认：ConShell 当前的最大系统级缺口已经不在 collective 表面，而在经济闭环与持续自治闭环**。项目虽然已经具备 runtime truth、memory continuity、tool action、governance scaffold、lineage / collective 中层能力，但距离“Web4-oriented autonomous AI lifeform runtime”仍差最关键的一步：**让系统开始真实面对生存压力、真实识别收入面、真实记录经济状态，并让 agenda 在跨时间上被 survival/economy/material constraints 驱动。**  
> **本轮目标**：不是继续扩张局部 feature surface，也不是再做一轮 isolated module refinement；而是要把 ConShell 从“有 economic runtime 与 agenda primitives 的系统”推进成“开始具备收入面、统一经济账本、并由生存压力真实驱动 agenda 与行为选择”的系统。  
> **事实纪律**：禁止把 wallet / spend / x402 / survival tiers 的存在描述成“economic closure 已成立”；禁止把 commitments / heartbeat / queue 的存在描述成“continuous autonomy 已成立”；禁止把能接任务描述成“已实现 earn-your-existence”。

---

# 0. 本轮问题定义

Round 15.7 → 16.1 已经把 economic runtime、feedback、adaptive routing、agenda / commitment runtime 从“空骨架”推进到了“可工作的局部系统”。Round 16.3 → 16.8 又把 governance、lineage、collective 逐步推进成了更可信的高能力层。

但经全局审计，ConShell 现在仍有四个决定性缺口：

## 0.1 经济系统仍然更多是“支出治理”，不是“收入闭环”
当前已有：
- wallet
- spend tracking
- x402 server
- economic runtime / feedback / memory
- survival tier abstractions

但还缺：
- agent 到底**卖什么**
- 对外服务供给如何计费
- 收入事件如何进入统一账本
- 收入是否真实改变 runtime 行为

## 0.2 agenda 已存在，但还不是 survival-coupled agenda
当前已有：
- commitments
- agenda primitives
- queue / heartbeat / long-running runtime

但还缺：
- 任务是否值得做
- 哪些任务是 revenue-positive / survival-critical
- 低余额 / 高 burn / 资源压力是否真实改变 agenda prioritization

## 0.3 经济状态仍缺统一 canonical ledger
当前已有多处 economic state / spend / decision / feedback 结构，但系统还缺一个：
- 统一收入/支出/储备/现金流/ burn rate / runway owner
- 所有 runtime consumers 从同一 canonical source 读取
- agenda / governance / replication / tool routing 对同一经济事实做出一致反应

## 0.4 “Earn Your Existence” 还未进入物理级 runtime 约束
现在它更像项目方向，而不是运行时硬约束。  
ConShell 还没有真正做到：
- 收入不足 → 行为收缩 / agenda 改写 / 资源降级
- 收入健康 → 能支持更高能力任务
- 任务机会选择与生存状态直接耦合

因此，Round 16.9 的唯一正确问题定义是：

> **如何把 ConShell 从“有 economic 与 agenda 模块的自治 runtime”推进为“开始拥有真实收入面、统一经济账本，并由生存压力持续驱动自主议程”的系统？**

---

# 1. 本轮唯一核心目标

# **Revenue Surface + Unified Economic Ledger + Survival-Coupled Agenda**

即：
1. 明确定义至少一个真实 revenue surface；
2. 建立统一的 canonical economic ledger / projection owner；
3. 让 agenda / commitments / routing 从这个 canonical economic state 持续消费；
4. 让 survival pressure 真实改变 runtime 的行为选择；
5. 用 tests 和 control surface 证明这不是叙事，而是运行时事实。

---

# 2. 本轮必须先回答的问题

## 2.1 什么才算 Revenue Surface？
你必须先回答：
- 是 x402 付费 API？
- 是 tool-backed service endpoint？
- 是 task execution billing surface？
- 是 channel-specific paid service？

如果这件事不先定义，后面只能继续写抽象经济模型。

## 2.2 什么是 canonical economic truth source？
当前系统已有：wallet / spend / economic state / feedback / ledger fragments。  
你必须明确：
- 谁是唯一 canonical owner？
- 谁负责收入写入？
- 谁负责支出写入？
- 谁负责 burn / reserve / runway projection？

如果没有唯一 owner，agenda 和 policy 会继续读到分裂事实。

## 2.3 agenda 是否真的服从 survival pressure？
你必须明确：
- 哪些任务属于 `survival-critical`
- 哪些任务属于 `revenue-positive`
- 哪些任务属于 `maintenance`
- 哪些任务在低余额时必须降级或推迟

如果这件事不先定义，agenda 就只是“有优先级字段的任务列表”。

## 2.4 survival tier 如何真实改变行为？
你必须明确至少一组真实耦合：
- `normal`
- `low_compute`
- `critical`
- `dead`

这些 tier 分别会影响：
- model/tool budget
- task acceptance
- background work density
- maintenance cadence
- revenue-seeking preference

否则 survival 仍是注释，不是 runtime law。

---

# 3. 本轮任务顺序（强制）

## Task 1 — 定义 Revenue Surface Contract

本轮必须正式定义至少一个可执行的 revenue surface，而不是继续把“未来可收费”停留在方向层。

### 推荐落点
- `packages/core/src/economic/revenue-contract.ts`
- 或并入现有 `economic-ledger.ts` / `economic-state.ts` 附近，但必须保持 owner 清晰

### 至少定义：
- `RevenueSurfaceKind`
- `RevenueEvent`
- `RevenueReceipt`
- `RevenueQuote`（若支持报价）
- `RevenueSettlementStatus`

### 至少包含：
- revenue source（x402 / service / task / channel / external payment）
- amount
- currency / unit
- settledAt / pendingAt
- related task / service / channel / session context
- confidence / verification state

### 强要求：
- revenue 不能只是 spend 的负数别名
- 收入必须有独立语义
- 支持“已结算 / 待结算 / 失败 / disputed”等至少最小状态边界

### 目标：
让“agent 如何获得价值”进入正式运行时模型。

---

## Task 2 — 建立 Unified Economic Ledger / Projection Owner

本轮必须明确唯一 canonical economic owner。

### 推荐落点
- `packages/core/src/economic/economic-ledger.ts`
- `packages/core/src/economic/economic-state-service.ts`
- `packages/core/src/economic/ledger-projection.ts`
- `packages/core/src/economic/index.ts`

### 本任务必须完成：
1. 统一收入与支出写入模型；
2. 明确 ledger owner；
3. 生成 canonical projection，包括至少：
   - totalRevenue
   - totalSpend
   - currentReserve / balance
   - burnRate
   - netFlow
   - runwayEstimate（若可行）
4. agenda / policy / runtime 读取的是 projection，而不是各读各的散数据；
5. 建立 refresh / projection update contract。

### 禁止：
- 多个模块各自计算不同版本的余额
- agenda 继续直接读取零散 spend 状态而不经过 canonical projection

### 目标：
把经济系统从“多份局部事实”收敛为“一个运行时真实账本”。

---

## Task 3 — 把 Revenue / Spend / Survival 统一到 Economic State Projection

本轮不能只做 ledger storage，还要做 runtime-consumable projection。

### 至少完成：
- revenue events 写入后可更新 projection
- spend events 写入后可更新 projection
- survival tier 从 canonical projection 计算，而不是从局部变量猜测
- projection 对 consumers 暴露统一接口

### 推荐至少暴露：
- `getEconomicProjection()`
- `recordRevenueEvent(...)`
- `recordSpendEvent(...)`
- `recomputeEconomicProjection()`
- `currentSurvivalState()`

### 目标：
让 economic truth 能被 runtime 持续消费，而不是只被审计报告读取。

---

## Task 4 — 让 Agenda / Commitments 真正消费 Survival-Coupled Economics

这是本轮最关键的执行闭环。

### 推荐落点
- `packages/core/src/agenda/`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/economic/`
- `packages/core/src/runtime/behavior-guidance.ts`

### 本任务必须完成：
1. agenda prioritization 明确读取 economic projection；
2. 至少区分以下 commitment/task kinds：
   - `revenue`
   - `maintenance`
   - `governance`
   - `identity`
   - `replication`
   - `user-facing`
3. 在低储备/高 burn/critical tier 下：
   - revenue-positive work 上升优先级
   - 高成本低收益任务下降优先级
   - 可推迟 maintenance 任务被重新排序（但不能破坏核心生存维护）
4. 在经济健康时：
   - 可恢复更高能力任务
   - 可容纳更多长期建设型工作

### 强要求：
- agenda 变化必须是 runtime 行为变化，不是只在 reasons 文本中解释
- 不允许“写了 survival-aware”但实际排序没变化

### 目标：
把 agenda 从“会维护任务列表”推进为“会基于生存现实做选择”。

---

## Task 5 — 定义并实现至少一个真实 Revenue Ingestion Path

本轮必须让至少一个 revenue path 真正工作，而不是纯 contract。

### 推荐优先级
#### 方案 A（最推荐）
把现有 x402 / paid service surface 接入 revenue event ingestion：
- payment verified
- settlement success
- revenue event recorded
- projection updated
- survival/agenda consumer sees the update

#### 方案 B
task-based revenue ingestion：
- task accepted / settled / rewarded
- revenue event recorded
- projection updated

#### 方案 C
channel/service quote + settlement 模拟路径（仅在无法完成 A/B 时）

### 强要求：
- 至少一条路径必须从“外部/边界事件”进入 economic ledger
- 不允许只造一个内部 helper 然后宣布 revenue surface complete

### 目标：
证明系统不只是会花钱，而是开始会“收到价值”。

---

## Task 6 — 把 Survival Tier 变成 Runtime Law，而不是 Narration

本轮必须让 survival state 至少影响两类真实 runtime 行为。

### 至少二选二实现：
- task acceptance gating
- tool budget / model budget adjustment
- agenda re-ranking
- background maintenance frequency
- revenue-seeking preference uplift
- non-essential task shedding

### 强要求：
- `critical` 不得与 `normal` 行为完全一样
- `dead` 若当前仍未 fully implement，至少要定义严格语义并在 control surface 明确

### 目标：
让 survival tiers 真正塑造运行时，而不是写在注释里。

---

## Task 7 — 扩展 Control Surface / Diagnostics / Operator View

本轮必须让经济与 agenda 的真实状态可见。

### 推荐至少新增或强化：
- `GET /api/economic/state`
- `GET /api/economic/ledger`
- `GET /api/economic/projection`
- `GET /api/agenda/overview`
- `GET /api/runtime/survival`

### 至少展示：
- revenue / spend totals
- current survival tier
- burn rate / reserve / net flow
- top pending commitments by adjusted priority
- why agenda is preferring revenue / maintenance / deferring costly work

### 目标：
让 operator 与 audit 能看到系统正在如何被经济现实塑造。

---

## Task 8 — 补齐 Revenue / Ledger / Agenda / Survival Tests

本轮测试必须覆盖从收入事件到 runtime 行为变化的整条链路。

### 8.1 Revenue Contract Tests
- revenue event schema
- settlement state transitions
- invalid revenue payload rejection

### 8.2 Ledger / Projection Tests
- revenue + spend unified projection
- burn rate / reserve / net flow correctness
- projection refresh consistency

### 8.3 Survival Coupling Tests
- survival tier 随 projection 变化
- `critical` / `low_compute` / `normal` 对行为产生真实区别

### 8.4 Agenda Coupling Tests
- revenue-positive commitment 在低 reserve 时被上调
- high-cost low-value task 在压力态下降级
- maintenance critical tasks 不会被错误全部挤掉

### 8.5 Ingestion Path Tests
- 至少一条真实 revenue ingestion path 端到端通过
- 收入进入 ledger 后，projection 与 agenda consumer 观察到变化

### 8.6 Regression Tests
- 原有 economic suite 无回归
- 原有 agenda / runtime / policy / governance 相关测试无回归

---

## Task 9 — 文档与术语统一

本轮必须更新文档，明确以下边界：
1. 什么叫 revenue surface
2. 什么叫 canonical economic ledger
3. survival tier 如何真实影响 runtime
4. agenda 如何消费 economic projection
5. 什么情况下可以说“开始具备 earn-your-existence runtime semantics”

### 禁止：
- 用“wallet exists”描述成“economic closure complete”
- 用“agenda exists”描述成“continuous autonomy complete”
- 用“can accept payment”描述成“agent can sustain itself”

---

# 4. 本轮实施范围与文件级执行清单

本轮除了定义目标，还必须明确修改落点与顺序。禁止泛泛而谈。

## 4.1 优先修改文件（建议落点）

### Economic Core
- `packages/core/src/economic/economic-ledger.ts`
- `packages/core/src/economic/economic-state.ts`
- `packages/core/src/economic/economic-state-service.ts`
- `packages/core/src/economic/ledger-projection.ts`
- `packages/core/src/economic/adaptive-routing.ts`
- `packages/core/src/economic/economic-feedback.ts`
- `packages/core/src/economic/index.ts`
- `packages/core/src/economic/revenue-contract.ts`（若新增）
- `packages/core/src/economic/revenue-service.ts`（若新增）

### Agenda / Runtime Coupling
- `packages/core/src/agenda/agenda-service.ts`（若存在/若需新增）
- `packages/core/src/agenda/agenda-commitment.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/behavior-guidance.ts`
- `packages/core/src/automaton/index.ts`

### Control Surface / Kernel Wiring
- `packages/core/src/server/routes/economic.ts`
- `packages/core/src/server/routes/agenda.ts`（若存在/若需新增）
- `packages/core/src/kernel/index.ts`
- `packages/core/src/kernel/server-init.ts`

### Tests
- `packages/core/src/economic/economic-runtime.test.ts`
- `packages/core/src/economic/economic-feedback.test.ts`
- `packages/core/src/economic/economic-integration.test.ts`
- `packages/core/src/economic/economic-survival-loop.test.ts`
- `packages/core/src/agenda/agenda-commitment.test.ts`
- 如有必要，新增：
  - `packages/core/src/economic/economic-revenue-surface.test.ts`
  - `packages/core/src/economic/economic-ledger-projection.test.ts`
  - `packages/core/src/agenda/agenda-survival-coupling.test.ts`

### Documentation
- `DevPrompt/0177_Round_16_9_Revenue_Surface_Unified_Economic_Ledger_and_Survival_Coupled_Autonomous_Agenda.md`
- `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`（若术语需对齐）
- `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`（若需标注阶段推进）
- `docs/verification-contract.md`（若新增 test contract）

---

## 4.2 文件级修改目标

### A. `economic-ledger.ts` / `ledger-projection.ts`
必须完成：
- 统一收入与支出投影
- 明确 canonical projection owner
- 暴露 reserve / burn / net flow / survival inputs

### B. `economic-state-service.ts`
必须完成：
- 收入/支出写入入口统一
- projection refresh contract 统一
- runtime consumers 读取同一事实源

### C. `revenue-contract.ts` / `revenue-service.ts`
必须完成：
- revenue surface schema
- settlement/result contract
- 至少一条真实 ingestion path

### D. `agenda/` + `runtime/agent-loop.ts`
必须完成：
- agenda/commitment ranking 显式消费 economic projection
- survival pressure 影响任务排序与选择

### E. `automaton/index.ts`
必须完成：
- survival tier 与 economic projection 对齐
- tier 真正作用于 runtime behavior，而不是仅输出状态

### F. `routes/economic.ts` / `routes/agenda.ts`
必须完成：
- 可观察 revenue / spend / survival / agenda adjusted priorities
- API 返回真实 projection，而不是碎片 state

---

## 4.3 强制执行顺序

### Step 1 — 先确定 revenue + ledger contract
先修 contract，不允许先到处写 consumer 逻辑。

### Step 2 — 建 canonical economic projection
确保全系统从同一 economic truth 读数据。

### Step 3 — 接入至少一条真实 revenue ingestion path
让收入不是纸面字段。

### Step 4 — 再接 agenda / runtime / automaton consumers
让生存压力真正改变行为。

### Step 5 — 最后补 control surface 与 tests
证明系统变化可见、可测、可审计。

---

## 4.4 每步最小验收动作

### Step 1 后至少验证：
- revenue schema 与 spend schema 不混淆
- settlement state 清晰

### Step 2 后至少验证：
- revenue/spend 统一进入同一 projection
- multiple consumers 不再各算各的余额

### Step 3 后至少验证：
- 至少一条 revenue path 端到端写入 ledger
- projection 会因收入变化而更新

### Step 4 后至少验证：
- agenda 在低 reserve/high burn 下发生真实排序变化
- survival tier 影响至少两类 runtime 行为

### Step 5 后至少验证：
- operator 可看到当前 survival/economic/agenda truth
- 新增 tests 与原有 economic/agenda tests 一并通过

---

## 4.5 本轮禁止的实现方式

禁止以下偷懒行为：
- 把 revenue 建模为 spend 的负数
- 多个模块私自维护不同 economic truth
- agenda 只输出 reasons，不真实改变排序
- survival tier 只影响日志文本，不影响 runtime behavior
- 没有真实 ingress path 就宣称 revenue surface 已成立
- 继续把 economic closure 写成路线图口号而非运行时事实

---

# 5. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical revenue surface and settlement model**
2. **What is now the canonical economic ledger / projection owner**
3. **How revenue and spend now unify into one economic truth source**
4. **How survival tier now materially changes runtime behavior**
5. **How agenda and commitments now consume economic projection**
6. **What revenue ingestion path now actually works**
7. **What control surfaces and diagnostics now expose the economic/survival truth**
8. **What tests were actually executed**
9. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “economic closure complete”但没有真实收入面
- “survival-coupled runtime complete”但 survival 不改变行为
- “autonomous agenda complete”但 agenda 不消费经济投影
- “earn-your-existence established”但系统仍没有实际价值流入路径

---

# 6. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] 至少一个正式 revenue surface contract 已建立
- [ ] 至少一条真实 revenue ingestion path 已打通
- [ ] canonical economic ledger / projection owner 已明确
- [ ] revenue + spend 已统一进入同一 economic truth source
- [ ] survival tier 从 canonical projection 计算，而不是从局部变量猜测
- [ ] survival tier 已真实影响至少两类 runtime 行为
- [ ] agenda / commitments 已明确消费 economic projection
- [ ] revenue-positive / survival-critical work 能在压力态被真实上调
- [ ] 新增 revenue / ledger / survival / agenda coupling tests 已通过
- [ ] 原有 economic / agenda / runtime tests 无回归
- [ ] control surface 能真实展示经济与生存状态
- [ ] 文档中 “economic closure / autonomous agenda / earn-your-existence” 术语已纠偏

---

# 7. 一句话结论

> **Round 16.9 的目标，不是继续给 ConShell 增加“像生命体的模块”，而是让它第一次开始面对真正的生存现实：能识别收入面、能统一核算经济状态、并让自主议程被生存压力持续塑形。**
