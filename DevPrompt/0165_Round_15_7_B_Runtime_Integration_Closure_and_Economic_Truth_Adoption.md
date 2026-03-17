# Round 15.7.B — Runtime Integration Closure and Economic Truth Adoption

> **文件定位**：这是 Round 15.7 的下一轮正式开发提示词。  
> **前置结论**：`packages/core/src/economic/` 已真实存在，且 economic module prototype 已产出；但当前审计仍未证明其已被现有 runtime 主线正式吸收，也未证明当前环境下测试已真实全量通过。  
> **本轮目标**：不是继续扩张更多 economic 概念层，而是把已有 economic 子系统接入现有运行时，使其成为真实的 economic truth 与 runtime behavior 的一部分。  
> **适用对象**：主开发代理 / 实现子代理 / 审计子代理。  
> **事实纪律**：禁止把“模块存在”“测试文件存在”“独立模块内集成测试存在”包装成“runtime integration complete”。

---

# 0. 本轮问题定义

Round 15.7 已经产出了以下可确认内容：
- `economic-state.ts`
- `economic-ledger.ts`
- `revenue-surface.ts`
- `survival-coupling.ts`
- `value-router.ts`
- `economic-narrator.ts`
- `transaction-safety.ts`
- `index.ts`
- `economic-survival-loop.test.ts`

这些代码说明：

> **Economic domain prototype 已建立。**

但当前审计同样确认：
- 尚未证明这些模块已经被 `Kernel / AgentLoop / SpendTracker / SpendRepository / X402Server / ConwayAutomaton / Policy / Server` 等主线正式消费；
- 尚未证明当前环境下全量测试可真实复跑通过；
- 尚未证明 survival / revenue / ledger / value routing 已改变真实 runtime 行为。

因此，本轮唯一正确的问题定义是：

> **如何把已建立的 economic subsystem，从“并行原型模块”推进为“运行时正式采用的经济真相与控制链的一部分”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Runtime Integration Closure**

即：
1. 明确系统中谁拥有 canonical economic truth；
2. 让 economic state / ledger / revenue proof / survival enforcement / value routing 至少部分进入真实运行时主链；
3. 让行为变化发生在现有 runtime 中，而不是仅发生在新模块测试里；
4. 修复并重新验证测试环境，停止使用未经复证的 pass 数字。

---

# 2. 强约束：你必须先回答的四个 owner 问题

在动手写代码前，必须先明确以下四个 owner：

## 2.1 Canonical Economic State Owner
谁是运行时唯一经济状态真相的拥有者？
候选可能包括：
- `SpendTracker`
- `SpendRepository`
- `ConwayAutomaton`
- 新 `EconomicStateService`（若你创建）
- `buildEconomicState()` 作为 builder + 其他 service 作为 owner

你必须明确：
- 谁负责聚合事实源
- 谁提供 snapshot/recompute/refresh contract
- 谁对外暴露 runtime economic state

## 2.2 Canonical Ledger Owner
谁是真正的账本 owner？
候选包括：
- `spend_tracking` / `SpendRepository`
- 新 `EconomicLedger`
- 双轨模式（其中一条必须明确是 projection 而不是 truth）

你必须明确：
- `EconomicLedger` 是主账本，还是审计投影链？
- 如果是投影链，它如何从主事实源派生？
- 如果它是主账本，持久化策略是什么？

## 2.3 Canonical Revenue Event Owner
x402 / API access / task service 的收入事实，谁负责最终记账？
你必须明确：
- verified payment 从哪里进入系统
- 谁负责幂等、防重、proof metadata、ledger append、state refresh

## 2.4 Canonical Survival Enforcement Owner
谁真正决定“当前 survival tier 会如何改变运行时行为”？
候选可能包括：
- `SurvivalGate`
- `AgentLoop`
- `InferenceRouter`
- `PolicyEngine`
- `TaskQueue`

你必须明确：
- `SurvivalGate` 是直接 owner，还是 enforcement helper
- 哪些 runtime 路径必须消费它

如果这四个 owner 问题答不清，本轮不能宣称 integration closure 完成。

---

# 3. 本轮任务顺序（强制）

必须按以下顺序推进，不允许先扩概念、后补接线。

## Task 1 — 建立 Runtime Adoption Map

先输出并落地到代码注释 / design notes / dev log：

### 你必须列清楚：
1. 当前系统的经济事实源有哪些？
   - `SpendTracker`
   - `SpendRepository`
   - `spend_tracking`
   - `X402Server`
   - `OnchainProvider`
   - `ConwayAutomaton`
2. 新 economic 模块各自承担什么角色？
3. 哪些旧模块保留为 provider / adapter？
4. 哪些新模块要成为 canonical owner？
5. 数据流、更新流、读取流、控制流分别如何走？

### 输出要求：
必须明确以下图景（文字即可）：
- **Write path**：spend/income/payment 如何写入
- **Read path**：runtime 如何读取 economic truth
- **Enforcement path**：tier 如何影响行为
- **Audit path**：如何验证 ledger/state/repo 一致性

在完成 Task 1 之前，不允许继续声称“统一经济架构已成立”。

---

## Task 2 — 让 Economic Ledger 接到真实 spend/income 主链

当前问题：`EconomicLedger` 已存在，但尚未证明它与现有 spend/income truth 正式连接。

### 本任务必须完成至少一种真实接法：

#### 方案 A：EconomicLedger 作为主账本
- `SpendTracker.recordSpend()` / `recordIncome()` 最终写入 `EconomicLedger`
- `EconomicLedger` 成为 canonical ledger truth
- 必须定义持久化/重建/恢复策略

#### 方案 B：EconomicLedger 作为审计投影链
- `SpendRepository` / `spend_tracking` 仍为 canonical persisted truth
- `EconomicLedger` 作为 deterministic projection / integrity audit chain
- 必须定义投影触发点与重建 contract

### 你必须回答：
- 当前账本是 **truth** 还是 **projection**？
- 若是 projection，如何保证 projection 与 truth 不漂移？
- 若是 truth，如何避免内存账本在重启后丢失？

### 禁止：
- 只在测试中 `ledger.append()`，runtime 永远不用它
- 不交代 canonical owner，就宣称 unified ledger complete

---

## Task 3 — 接通 x402 verified payment → revenue truth → economic state

当前问题：RevenueSurfaceRegistry 存在，但尚未证明真实收入链路已经接通。

### 本任务必须完成：
1. `X402Server.verifyPayment()` 成功后，产生正式 revenue event；
2. revenue event 通过 transaction safety 层做幂等/防重复；
3. revenue proof metadata 被保留：
   - `txHash`
   - `chain`
   - `payer/from`
   - `amount`
   - `surfaceId`
   - `verifiedAt`
4. revenue event 进入 ledger truth / projection；
5. runtime economic state 发生刷新；
6. 重复 txHash 不会二次入账。

### 验收标准：
至少能在真实运行时路径中证明：
- verifyPayment success → revenue accepted → state/ledger updated
- duplicate verify → blocked or idempotent no-op

在这一步完成前，不得再说“revenue surface closure 已成立”。

---

## Task 4 — 把 EconomicState 从 pure builder 推进为 runtime state service

当前 `buildEconomicState()` 更像 schema builder，而不是 runtime canonical state。

### 本任务必须完成：
至少实现以下其中一种：

#### 方案 A：新增 `EconomicStateService`
要求：
- 启动时初始化
- 从真实系统事实源聚合
- 提供：
  - `snapshot()`
  - `recompute()`
  - `refresh()`
  - `getHealth()`
- 被 `Kernel` 或 runtime service container 持有

#### 方案 B：在现有 runtime service 内引入 canonical economic state contract
要求：
- 明确 owner
- state 不是测试手工构造
- state 来源于真实 spend/income/payment/automaton data

### 验收标准：
- `Kernel.boot()` 完成后可取到当前 economic state
- state 不是孤立模块内局部变量
- runtime 可以读取该 state 参与决策

---

## Task 5 — 把 SurvivalGate 接入真实 runtime behavior

当前 `SurvivalGate` 有逻辑，但未证明其已改变现有运行时行为。

### 本任务至少必须接入以下之一：
1. **Inference model selection**
   - survival tier 影响允许模型 / 替代模型
2. **Task intake gate**
   - survival tier 影响任务接收 / 拒绝 / 降级
3. **Child spawn gate**
   - survival tier 影响是否允许 spawn child
4. **Feature gate**
   - survival tier 影响浏览器、高成本工具、深度推理等功能

### 硬要求：
- 同类请求在不同 tier 下产生不同 runtime 行为；
- 行为变化发生在真实运行时路径，而不是仅在单元测试 mock 路径；
- 被拦截时，必须能解释原因（reason / substitute / enforced tier）。

### 禁止：
- 仅保留 `SurvivalGate.enforce()` 而不接入任何真实入口
- 用 narrator 报告替代行为接线

---

## Task 6 — 把 ValueRouter 接入真实任务入口

当前 `ValueRouter` 逻辑存在，但尚未证明它控制真实任务流。

### 本任务必须明确：
1. task descriptor 从哪里生成？
2. routing decision 在哪里被消费？
3. reject / defer / downgrade 如何反馈给：
   - `AgentLoop`
   - `TaskQueue`
   - 外部 task intake path

### 至少必须接入以下之一：
- `AgentLoop`
- `TaskQueue`
- HTTP/API task intake
- External worker/task handler

### 验收标准：
- 至少一条真实任务入口读取 routing decision
- revenue-bearing vs non-revenue task 在不同 tier / state 下产生不同处理结果

---

## Task 7 — Truth Convergence：收敛旧经济事实与新经济模块

本任务是避免“双轨经济现实”的关键。

### 你必须审计并处理以下风险：
1. `SpendTracker` 与 `EconomicLedger` 是否可能长期背离？
2. `SpendRepository` 持久化值与 runtime state 是否可能背离？
3. x402 收入是否只进新模块而不影响旧 spend/income truth？
4. `ConwayAutomaton` / survival tier 与 `EconomicState.survivalTier` 是否可能冲突？

### 你必须明确：
- 哪个字段以哪个系统为准；
- 哪些值是 source-of-truth；
- 哪些值是 derived/projection；
- 如何在测试中对账。

### 不允许：
- 新旧两套 balance 各算各的；
- runtime 一个 truth、report 另一个 truth；
- ledger/state/repo 数据长期无对账机制。

---

## Task 8 — 修复测试环境并重新执行真实验证

当前已知问题：此前审计中出现 `ERR_MODULE_NOT_FOUND` / `tinyrainbow/dist/node.js` 缺失，说明测试环境真实性未成立。

### 本任务必须完成：
1. 调查问题根因：
   - lockfile
   - workspace install
   - package export
   - node_modules 不一致
   - path / ESM resolution
2. 修复测试环境；
3. 真实执行：
   - `packages/core/src/economic/economic-survival-loop.test.ts`
   - `packages/core` 全量测试（至少 economic 相关依赖链）
4. 输出真实结果：
   - 运行了哪些命令
   - 哪些测试通过
   - 哪些失败
   - 失败原因是什么

### 严格要求：
- 只有真实跑通，才能报告 pass 数字；
- 没跑通就明确写没跑通；
- 不得再复用旧的“909/909 pass”口头结论。

---

## Task 9 — 修正文案与完成度口径

你必须把对 15.7 的叙述从“开发结束”纠正为真实状态。

### 若本轮只完成部分接线，正确表述应类似：
- `economic module prototype complete`
- `runtime adoption partially integrated`
- `economic truth convergence in progress`
- `tests re-verified / not yet fully re-verified`

### 只有当以下条件全部满足时，才允许说“15.7 真正完成”：
1. economic state 被 runtime 主线消费；
2. ledger 与 spend/income truth 正式接通；
3. x402 verify payment 进入 revenue truth；
4. survival gate 改变真实 runtime 行为；
5. value router 接入真实任务入口；
6. 测试环境修复且结果真实复跑；
7. 输出中仍严格区分完成 / 部分完成 / 未完成。

---

# 4. 本轮必须新增的测试

## 4.1 Runtime Integration Tests
必须新增覆盖：
- spend event 真实进入 economic ledger/state
- income event 真实进入 economic ledger/state
- `X402Server.verifyPayment()` success → revenue truth / state change
- duplicate txHash → 幂等不重复计费

## 4.2 Behavior Change Tests
必须新增覆盖：
- survival tier 改变 → inference model enforcement 改变
- survival tier 改变 → task acceptance/rejection 改变
- terminal/dead tier 下高成本操作被真实阻断
- child spawn / feature usage 在低 tier 下被真实限制

## 4.3 Truth Convergence Tests
必须新增覆盖：
- ledger/state/repo 关键值对账一致
- old truth 与 new truth 不会长期漂移
- projection 重建后结果与 persisted truth 一致

## 4.4 Environment Verification Tests
必须新增覆盖：
- 修复测试环境后可稳定执行 vitest
- 输出可复跑命令
- 不允许只报告“全部通过”而不说明执行证据

---

# 5. 输出要求

本轮结束后的输出必须使用以下结构：

1. **What was actually integrated into runtime**
2. **What remains standalone / prototype-only**
3. **What became canonical truth vs projection**
4. **What tests were actually executed**
5. **What failed and why**
6. **What is now truly closed**
7. **What still remains incomplete**

### 禁止输出：
- “已闭环”但没有 runtime 接线证据
- “真实耦合完成”但未改变行为
- “全量通过”但没有真实执行结果
- “修改已有文件 0”这类与仓库状态冲突的陈述

---

# 6. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] 已明确 canonical economic state owner
- [ ] 已明确 canonical ledger owner
- [ ] 已明确 canonical revenue event owner
- [ ] 已明确 canonical survival enforcement owner
- [ ] spend/income truth 与 ledger 有真实接线
- [ ] x402 verified payment 已进入正式 revenue truth
- [ ] economic state 可在 runtime 中读取
- [ ] survival gate 至少改变一条真实 runtime 行为链
- [ ] value router 至少接入一条真实任务入口
- [ ] old truth 与 new truth 的边界已明确并有对账测试
- [ ] 测试环境已修复并真实执行验证
- [ ] 汇报口径已从 prototype 纠偏到真实完成度表达

---

# 7. 一句话结论

> **Round 15.7 的下一步不是继续扩概念，而是完成 runtime integration closure：把已写出的 economic subsystem，真正变成系统运行时的经济真相与行为控制链的一部分。**
