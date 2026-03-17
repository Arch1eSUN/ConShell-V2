# Round 15.7.A — Execution Refinement for Unified Economic State and Survival Coupling

> **用途**：作为 `DevPrompt/0162` 的代码级执行补充与收敛版输入文件，直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须基于当前仓库代码事实，而不是仅基于 0162 的理想目标。禁止忽略已发现的“经济事实源分裂”“survival 耦合未落地”“x402 未真正进入 runtime economic truth”这三类结构性问题。  
> **本轮风格要求**：高压审计约束 + 先统一经济真相再谈生存约束 + 严格区分已实现 / 部分实现 / 未实现 / 骨架。

---

# 0. 本文件为什么存在

`0162_Round_15_7_Economic_Survival_Loop_and_Autonomous_Value_Closure.md` 已经正确定义了 Round 15.7 的目标，但它仍是“目标导向 prompt”。

在继续实现前，必须承认一个事实：

> **当前仓库已经暴露出若干会直接阻断 15.7 落地质量的代码级断层。**

本文件的作用不是改写 0162，而是：
1. 把当前代码事实显式写清楚；
2. 把最危险的结构性断层收敛出来；
3. 把 15.7 真正的第一实施顺序钉死；
4. 防止开发代理在“已有 spend / wallet / x402 / automaton”错觉下继续平铺功能。

---

# 1. 当前代码级 Context Assimilation

## 1.1 What Economic Governance Already Makes Real

基于已读取代码，当前已成立的真实能力如下：

### A. Spend truth / governance 已有真实基础
已读取：
- `packages/core/src/spend/index.ts`
- `packages/core/src/spend/governance-types.ts`
- `packages/core/src/spend/budget-scope.ts`
- `packages/core/src/spend/governance-evaluator.ts`
- `packages/core/src/state/repos/spend.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`

可确认：
1. `AgentLoop` 在 inference usage 返回 `chunk.usage.cost` 时，已经把 spend 写入 `SpendTracker.recordSpend(...)`。
2. `SpendTracker` 已具备：
   - spend record
   - income record
   - balance
   - burn rate
   - aggregates
   - policy decision / governance verdict
3. `SpendRepository` 已把 spend/income 写入 SQLite `spend_tracking` 表。
4. `GovernanceEvaluator` 已把 scope results + balance 收敛成 `PolicyDecision`。
5. `AgentLoop` 已在 pre-loop 与 per-iteration 两处真实消费治理决策：
   - block inference
   - cap iterations
   - inject guidance

### B. 15.6 self groundwork 已为经济主体提供前提
已读取：
- `packages/core/src/identity/self-model.ts`
- `packages/core/src/identity/identity-lifecycle.ts`
- `packages/core/src/memory/memory-ownership.ts`
- `packages/core/src/soul/narrative-governance.ts`

可确认：
1. `SelfModelService.resolve()` 已能收敛 `CanonicalSelf`。
2. identity lifecycle 已有：
   - genesis
   - rotate
   - revoke
   - recover
3. memory ownership 已明确：
   - SELF
   - USER
   - ENVIRONMENT
   - SESSION
   - LINEAGE
4. narrative governance 已有基础规则，不是完全自由文本。

### C. wallet / onchain / x402 / automaton 都已有真实代码，不是空目录
已读取：
- `packages/core/src/wallet/index.ts`
- `packages/core/src/wallet/onchain.ts`
- `packages/core/src/x402/server.ts`
- `packages/core/src/automaton/index.ts`

可确认：
1. wallet 可生成、加密、加载。
2. onchain provider 可查询 Base / Ethereum 余额。
3. x402 server 可创建 payment requirement、验证 payment proof、记录 in-memory payment history。
4. automaton 已有 survival tier / adaptation 结构。

---

## 1.2 What Still Prevents Earn-Your-Existence

### 核心阻断 1：当前 economic truth 仍然分裂
当前至少存在四套经济相关事实源：

1. `SpendTracker.spendRecords / incomeRecords`（内存）
2. `SpendRepository / spend_tracking`（SQLite）
3. `X402Server.paymentHistory / processedTxHashes / totalReceived`（内存）
4. `OnchainProvider.getAggregatedBalance()`（链上快照）

结论：

> **当前没有唯一 canonical economic state。**

### 核心阻断 2：收入并未真正进入 runtime 主经济事实
虽然 `SpendTracker.recordIncome()` 存在，`X402Server.verifyPayment()` 也会统计 `totalReceived`，但两者当前没有形成正式连接：

- `X402Server.verifyPayment()` 不会调用 `SpendTracker.recordIncome()`。
- `X402Server` 的 `processedTxHashes` 与 `paymentHistory` 仅在内存中。
- 没有持久化 payment proof → ledger income event 的正式 contract。
- 没有 revenue event 类型，也没有 payment source / service type / proof metadata 的统一建模。

结论：

> **x402 当前更接近“可用支付组件”，而不是 runtime economic truth 的正式收入面。**

### 核心阻断 3：survival tier 尚未真正进入 runtime control 主路径
`ConwayAutomaton` 虽然有：
- `SurvivalTier`
- `EnvironmentSnapshot`
- `evolve()`
- model/context/task adaptation skeleton

但当前未看到以下闭环：
- `Kernel` 持续把 unified economic state 注入 automaton
- `AgentLoop` 真实消费 automaton survival constraints
- survival level 与 15.5 `PolicyDecision` 做正式映射

结论：

> **survival 目前更接近强骨架，而不是已接入 runtime 主逻辑的真实约束。**

### 核心阻断 4：turn/session attribution 在内存治理层仍不稳
`SpendRepository.insert()` 已写入：
- `session_id`
- `turn_id`
- `kind`

但 `SpendTracker` 的内存 `SpendRecord` 类型并不包含 `sessionId` / `turnId` 字段。  
`budget-scope.ts` 当前为了计算 `turn` / `session` scope，使用的是：
- `description?.includes(turnId)`
- `description?.includes(sessionId) || provider === sessionId`

这说明：

> **当前 turn/session scope 的 runtime truth 依然部分依赖字符串 hack，而非 canonical attribution fields。**

### 核心阻断 5：存在 spend 实现分叉 / 名称冲突风险
当前同时存在：
- `packages/core/src/spend/index.ts`（完整版 SpendTracker）
- `packages/core/src/spend/tracker.ts`（旧版简化 SpendTracker）

这会造成：
- 概念歧义
- 导入误用风险
- 后续经济层继续分叉的概率上升

结论：

> **15.7 必须处理或明确淘汰旧 tracker 角色，否则后续经济层会继续多真相并行。**

### 核心阻断 6：generic policy engine 与 economic governance 仍是并行体系
`packages/core/src/policy/index.ts` 的 `PolicyEngine` 仍是一套独立规则引擎，主要围绕：
- constitution
- financial
- security
- authority
- replication
- selfmod

但它与 `SpendTracker -> GovernanceEvaluator -> PolicyDecision` 之间没有清晰统一接口。

结论：

> **当前 economic governance 是一条真实但局部的控制链，不是完整 policy kernel 的统一经济语义层。**

---

## 1.3 Why 15.7 Must Prioritize Economic Survival Loop

基于当前代码现实，15.7 不应先做更炫的 agenda、UI、channel、replication，原因如下：

1. **经济真相还没有统一**：现在继续扩张，只会把更多功能接到分裂的 economic truth 上。
2. **收入面还不是真收入面**：x402 存在，但 payment proof 还不是 ledger income truth。
3. **survival 还没有真正控制 runtime**：automaton 有 tier，但行为约束主链还没接上。
4. **value-aware routing 还没有稳定输入**：没有 unified ledger，就很难判断任务到底是 positive / neutral / negative。

因此本轮真正第一优先级不是“做更多经济 feature”，而是：

> **先收敛 canonical economic state / ledger，再把 survival 作为这个 state 的解释层与控制层。**

---

# 2. 当前真实状态判定（必须承认）

## 2.1 已完成
- Spend attribution truth 已基本成立。
- Spend-aware runtime control 已基本成立。
- Policy semantics / budget scopes / decision object 已基本成立。
- Durable sovereign self groundwork 已显著成立。

## 2.2 部分完成
- income tracking：有入口，但未统一进 runtime 主账本闭环。
- x402 payment verification：有能力，但未形成 canonical revenue contract。
- survival tier：有结构，但未正式变成 runtime 主控制输入。
- session / turn attribution：已进入持久层，但内存治理链仍有 hack。

## 2.3 未完成
- unified economic ledger
- payment proof → income event → reserve/balance 正式闭环
- reserve / burn-rate / runway 的 canonical state object
- survival tier ↔ runtime selected actions 正式映射
- value-aware task intake / routing
- duplicate / refund / reversal / failure-safe canonical contract

## 2.4 仅有骨架
- earn-your-existence
- revenue-positive work routing
- autonomous value closure
- survival-aware autonomous agenda

---

# 3. 15.7 真正的第一实施顺序（强制）

## Step 1 — 收敛 Canonical Economic State
你必须首先定义并落地一个统一对象，例如：
- `EconomicLedgerEvent`
- `EconomicStateSnapshot`
- `EconomicStateService`

至少统一：
- spend events
- income events
- reserve / balance
- burn rate
- runway / survivability hint
- attribution (task / session / turn / channel / tool)

**在这一步完成前，不要继续扩 x402 细节、automaton behavior、agenda routing。**

## Step 2 — 正式建立 Revenue Event / Payment Proof Contract
必须把 `X402Server` 与 ledger 连接起来，至少完成：
- payment proof 去重 contract
- verified payment → income event
- service/resource metadata → revenue metadata
- proof source / tx hash / chain / payer / amount 的稳定持久化

**在这一步完成前，不要宣称 revenue surface 已成立。**

## Step 3 — 修正 attribution 真相源
必须停止 `description.includes(turnId)` 这类临时 attribution 方式，至少做到：
- in-memory spend event 包含 `sessionId` / `turnId`
- scope evaluator 读取 canonical attribution fields
- session / turn scope 不再依赖 provider/description hack

## Step 4 — 清理 spend implementation 分叉
必须明确：
- `spend/tracker.ts` 是否废弃
- `spend/index.ts` 是否为唯一 SpendTracker truth
- 后续导入路径是否统一

## Step 5 — 建立 Survival Coupling
当 unified economic state 成立后，再做：
- reserve / burn-rate / runway → survival state
- survival state → runtime constraints
- survival state 与 15.5 `PolicyDecision` 的关系
- automaton 如何消费 ledger state，而不是各自维护平行现实

## Step 6 — 最后才接 Value-Aware Routing
只有当前面几步完成后，才有资格进入：
- expected cost vs expected value
- survival-positive / neutral / negative classification
- task intake / routing gate

---

# 4. 本轮必须避免的新错误

## 错误 A：在 split truth 上继续叠更多字段
不要在 `SpendTracker`、`X402Server`、`OnchainProvider`、`Automaton` 各自再长更多经济字段，却不先统一事实源。

## 错误 B：把 x402 history 当成 ledger
`paymentHistory` 只是组件内历史，不是系统级 canonical ledger。

## 错误 C：把 automaton tier 当成 survival closure
有 survival enum 不等于生存闭环成立。

## 错误 D：继续使用 description/provider 充当 attribution 主索引
这是临时技巧，不是可信 economic state contract。

## 错误 E：不处理旧 tracker，继续让 spend 逻辑双轨制存在
这会让后续 15.8 / 15.9 必然返工。

## 错误 F：在 revenue contract 未成立前就急着做 value-aware routing
那会导致“值不值”判断建立在伪收入面上。

---

# 5. 本轮必须新增并通过的测试（补充版）

## 5.1 Canonical economic state tests
- spend / income / adjustment 进入同一 canonical event 模型
- current balance / reserve / burn-rate / runway 由同一 state object 输出
- 没有第二套并行 balance truth

## 5.2 Payment proof integration tests
- verified x402 payment → ledger income event
- duplicate tx hash 不重复入账
- payment metadata 可追踪
- income event 可进入 reserve/balance 计算

## 5.3 Attribution truth tests
- sessionId / turnId 通过 canonical fields 生效
- turn/session scope evaluator 不再依赖 description/provider hack
- mixed session/turn 不串线

## 5.4 Survival coupling tests
- reserve 下降触发 survival level 恶化
- income 提升改善 survival level
- survival level 变化真实影响 runtime selected actions / constraints

## 5.5 No-split-truth regression tests
- 旧 tracker 不再被误用，或被明确隔离/弃用
- balance / income / spend 没有两个不一致来源

---

# 6. 代码审计问题单（本文件专用）

1. 当前是否已经存在唯一 canonical economic state？
2. `SpendTracker` / `SpendRepository` / `X402Server` / `OnchainProvider` / `Automaton` 是否仍各自维护平行经济事实？
3. payment proof 是否真正成为 ledger income truth？
4. session / turn attribution 是否仍依赖 description/provider hack？
5. survival tier 是否真正进入 runtime 主控制链？
6. `policy/index.ts` 与 economic governance 是否仍然语义分裂？
7. `spend/tracker.ts` 是否已明确淘汰或统一角色？
8. 当前实现是否足以作为 15.8 Autonomous Agenda 的稳定经济输入？

若以上任一关键问题答案是否定，必须如实报告，不得包装成“闭环已成立”。

---

# 7. 实施要求

你必须按以下顺序执行：

1. 先做 canonical economic state / ledger 收敛设计
2. 再接 x402 verified payment → income event
3. 再修正 attribution canonical fields
4. 再处理 spend implementation 分叉
5. 再做 survival coupling
6. 最后才做 value-aware routing

任何偏离此顺序、先做外围功能或先做 narrative/reporting 的实现，都应视为低质量推进。

---

# 8. 最终验收标准

只有当以下条件同时成立，才能说 15.7 真正进入有效实施阶段：

- canonical economic state / ledger 被明确收敛
- x402 verified payment 正式进入 ledger income truth
- turn/session attribution 不再依赖字符串 hack
- spend implementation 分叉被处理或明确收敛
- survival state 开始消费 unified economic state
- 输出结果仍然明确区分：已完成 / 部分完成 / 未完成 / 骨架

---

# 9. 一句话结论

> **Round 15.7 的第一任务不是“继续做经济功能”，而是把当前分裂的 spend / income / payment / survival 信号收敛成唯一 economic truth；只有这样，ConShell 才能真正开始面对生存约束，而不是继续堆叠经济叙事。**
