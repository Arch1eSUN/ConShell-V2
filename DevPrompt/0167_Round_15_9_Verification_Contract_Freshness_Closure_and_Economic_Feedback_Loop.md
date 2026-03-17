# Round 15.9 — Verification Contract, Freshness Closure, and Economic Feedback Loop

> **文件定位**：这是 Round 15.9 的正式开发提示词。  
> **前置审计结论**：Round 15.8 已完成本轮目标，并有来自 `packages/core` 工作目录下的本地测试通过证据：  
> - `economic-survival-loop.test.ts` — 90 tests  
> - `economic-integration.test.ts` — 17 tests  
> - `economic-runtime.test.ts` — 27 tests  
> - 合计 `134/134 passed`  
> 但当前系统仍存在三类高价值后续工作：  
> 1. **验证契约未工程化固定**：测试入口、路径、口径仍可能被误用；  
> 2. **freshness contract 仍偏弱**：ToolExecutor 当前 tier 更新仍较依赖 heartbeat / 外部推送；  
> 3. **economic feedback loop 尚未形成完整闭环**：`ValueEvent` 已有类型边界，但还未成为系统级执行反馈机制。  
> **本轮目标**：把 15.8 的“已接线并通过测试”的成果推进为“验证路径固定、状态刷新更强一致、执行反馈真实回流”的下一阶段能力。  
> **事实纪律**：禁止把“已有类型定义”“已有测试文件”“已有模式名”包装成“完整反馈闭环已成立”。

---

# 0. 本轮问题定义

Round 15.8 的真实成果是：
- runtime 已开始持续消费 economic state；
- `TaskQueue` 已在 enqueue 路径消费 routing decision；
- `ToolExecutor` 已在工具执行路径消费 economic policy；
- `RuntimeMode` / `EconomicPolicy` / `ValueEvent` 的基础语义已建立；
- `packages/core` 路径下已有可信的 134/134 本地测试通过证据。

但当前审计也明确：

> **系统已经能被经济状态驱动，但还没有把“验证方式”“状态新鲜度”“执行反馈回流”做成强契约。**

因此，Round 15.9 的唯一正确问题定义是：

> **如何把当前已成立的 economic runtime consumption，从“能工作”推进为“可稳定验证、刷新一致、可从执行结果持续学习”的闭环系统？**

---

# 1. 本轮唯一核心目标

本轮必须完成三件事：

# **Verification Contract Hardening + Freshness Closure + Economic Feedback Loop**

即：
1. 固定 canonical verification path，终止测试口径漂移；
2. 强化 runtime consumers 的 economic state freshness contract；
3. 让 task execution / revenue / value realization 真实形成反馈事件链，并反向进入策略与审计体系。

---

# 2. 本轮必须先回答的问题

## 2.1 Canonical verification path 到底是什么？
你必须明确写死：
- 测试应从哪里执行？
- 哪条命令是 canonical？
- 为什么 root 目录过滤运行会失败，而 `packages/core` 下运行成功？

在这个问题工程化固定之前，不允许继续让验证路径依赖“口口相传”。

## 2.2 Tool gating 的 tier / mode 真相如何刷新？
当前看起来：
- ToolExecutor 持有 `_currentTier`
- tier 更新来自 runtime 注入 / heartbeat refresh

你必须回答：
- 哪些事件应立即刷新 tier？
- 哪些场景允许 heartbeat 兜底？
- 何时按需读取 state，何时使用缓存 tier？

## 2.3 ValueEvent 谁产生、谁消费、谁记录？
现在已有：
- `RevenueEvent`
- `ValueRealizationEvent`
- `TaskCompletionEvent`

你必须明确：
- 哪个 runtime 组件发出这些事件；
- 是否进入统一 recorder；
- 是否影响 routing / audit / reporting；
- 是否可以回看最近 value history。

## 2.4 执行反馈如何影响未来策略？
如果一个任务：
- 成本高、收益低、成功率差

系统是否应该学会：
- 降低其优先级
- 在低 tier 下直接拒绝
- 在 revenue-seeking mode 中排后

如果没有这个回流，系统就还不是“会学”的经济 runtime。

---

# 3. 本轮任务顺序（强制）

## Task 1 — 固定 Canonical Verification Contract

必须新增并落实一份验证契约，至少包括：

1. **Canonical working directory**
   - 明确：`/Users/archiesun/Desktop/ConShellV2/packages/core`
   - 或以相对形式写清楚：`packages/core`

2. **Canonical commands**
   至少包含：
   - 经济相关测试命令
   - 全量 package 测试命令
   - 必要时 root → package 的转发方式

3. **Verification terminology**
   必须严格区分：
   - `implemented`
   - `tested`
   - `locally re-verified`
   - `claimed but not re-verified`

4. **Failure mode explanation**
   解释为什么此前会出现：
   - root 目录 `No test files found`
   - package 目录运行成功

### 输出要求：
- 形成正式文档或脚本（推荐 `docs/plans/...` 或 `scripts/verify-economic.sh`）
- 后续所有汇报必须引用这份契约

---

## Task 2 — 修复并强化 Test Invocation UX

当前问题不是测试本身，而是**执行入口容易错**。

### 本任务必须至少完成一种改进：

#### 方案 A：新增统一验证脚本
例如：
- `scripts/verify-economic.sh`
- 进入 `packages/core` 后运行正确命令

#### 方案 B：在 root package.json 新增脚本别名
例如：
- `pnpm test:economic`
- 内部自动切到正确 workspace/package

#### 方案 C：两者都做
推荐：**方案 C**

### 验收标准：
- 以后不需要靠人工记忆“要在 packages/core 里跑”
- 统一入口直接可执行

---

## Task 3 — 建立 Stronger Freshness Contract for Runtime Consumers

当前 `ToolExecutor` 的 gating 已成立，但 freshness 仍可能依赖 heartbeat/外部更新时间。

### 本任务必须完成至少一种更强 freshness 机制：

#### 方案 A：关键执行前按需拉当前 tier/mode
- `ToolExecutor.executeOne()` 在执行前读取最新 tier/mode

#### 方案 B：事件驱动即时刷新
- 当 spend/income/automaton evolve 发生时，主动更新 runtime consumers

#### 方案 C：混合机制
- 关键路径即时更新
- heartbeat 只做兜底和审计快照

推荐：**方案 C**

### 你必须覆盖至少以下触发点：
- spend recorded
- income recorded
- automaton tier evolve
- runtime mode change

### 验收标准：
- economic state 变化后，高成本工具 gating 不会长时间滞后
- queue/tool/loop 至少两个 consumer 刷新语义明确

---

## Task 4 — 新增 ValueEvent Recorder（轻量，不急于持久化）

当前 `value-events.ts` 只是类型边界。

### 本任务必须新增一个轻量 recorder：
例如：
- `ValueEventRecorder`
- ring buffer（建议 500~1000 条）

### Recorder 至少支持：
- `record(event)`
- `recent(limit?)`
- `byType(type)`
- `stats()`
- `clear()`

### 记录的事件至少包括：
- `TaskCompletionEvent`
- `ValueRealizationEvent`
- `RevenueEvent`（若桥接到 recorder）

### 不要求：
- 本轮不强制 SQLite 持久化
- 本轮不强制跨重启保留

目标是先让 value events 进入真实 runtime recorder，而不是永远停在类型文件里。

---

## Task 5 — 把 Task Execution 结果回流成经济事件

当前 TaskQueue 已能在 enqueue 阶段做经济路由，但执行完成后的反馈还未成体系。

### 本任务必须做到：
1. task 执行完成后产生 `TaskCompletionEvent`
2. 若交付了可计费价值，产生 `ValueRealizationEvent`
3. 若关联实际收入，能挂接到 `RevenueEvent` 引用
4. 这些事件进入 `ValueEventRecorder`

### 你必须明确定义：
- 事件由谁发（TaskQueue / task executor / adapter）
- 何时发（success / failure / billable completion）
- 事件最小字段集合

### 验收标准：
- runtime 不再只看“准备做什么”，也能看“做完后实际产生了什么经济结果”

---

## Task 6 — 把执行反馈接入至少一个未来策略入口

这是 Round 15.9 的关键：

> **反馈不能只被记录，必须至少影响一个未来决策入口。**

### 你必须实现至少一个：

#### 方案 A：任务级 feedback heuristic
- 高收益成功任务获得未来 priority bonus
- 高成本低收益任务获得 future penalty

#### 方案 B：routing feedback memory
- ValueRouter 可读取最近任务反馈摘要
- 对相似任务做更保守/更激进决策

#### 方案 C：mode-sensitive feedback
- revenue-seeking mode 下更强偏好高净值任务

推荐：
- **A + 小规模 B**

### 注意：
本轮不要试图做复杂强化学习。只要实现：
- 简单、可解释、可测试的 heuristic 回流

---

## Task 7 — 将 RuntimeMode 从“名字映射”推进到“行为契约”

当前 mode 已存在，但要更像正式 contract。

### 本任务必须明确每个 mode 至少影响哪些行为：

#### `normal`
- 标准策略

#### `revenue-seeking`
- queue priority 偏向 revenue-bearing
- costly non-revenue 更易 reject/degrade

#### `survival-recovery`
- 更严格 tool gating
- 更严格 task acceptance
- 上下文/迭代/成本压缩更强

#### `shutdown`
- 只允许极少数恢复/保命动作，或直接全阻断

### 要求：
- 这些行为要体现在至少两个 runtime consumers 中
- 行为变化必须可测试

---

## Task 8 — 新增 Freshness + Feedback + Verification Tests

本轮必须新增覆盖以下测试：

### 8.1 Verification Contract Tests / Smoke
- 统一验证脚本或命令可运行
- 正确工作目录下能发现测试

### 8.2 Freshness Tests
- spend/income 后 consumer 立即读取到新 tier/mode/state
- tool gating 不依赖长时间滞后缓存

### 8.3 ValueEvent Recorder Tests
- completion / value_realization / revenue events 可记录
- recorder stats / byType / recent 正确

### 8.4 Feedback Loop Tests
- 任务执行结果会影响后续 priority / routing heuristic
- revenue-seeking mode 下反馈会改变后续行为

### 8.5 RuntimeMode Contract Tests
- 至少两个 consumers 随 mode 改变真实行为

---

## Task 9 — 文档与交付口径统一

必须更新并统一以下内容：

1. **验证文档**
   - 正确测试路径
   - 正确命令
   - 术语定义

2. **运行时文档**
   - freshness contract
   - event flow
   - feedback loop

3. **汇报口径**
   - 哪些结果已本地复证
   - 哪些仍只是实现完成
   - 哪些仍未闭环

禁止再次出现：
- 路径不一致
- 文件名不一致
- “全通过”却不附 canonical path/command

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical verification path**
2. **What runtime consumers now have freshness guarantees**
3. **How ValueEvents are now recorded and emitted**
4. **How task execution now feeds back into future economic decisions**
5. **What RuntimeMode now changes as an explicit behavior contract**
6. **What tests were actually executed**
7. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “反馈闭环已完成”但只是新增类型和 recorder
- “freshness 已解决”但仍主要依赖 heartbeat 滞后刷新
- “验证固定完成”但没有脚本/文档/命令

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical verification path 已固定并文档化/脚本化
- [ ] root/package 测试入口差异已解释清楚
- [ ] 至少两个 runtime consumers 具备更强 freshness contract
- [ ] `ValueEventRecorder` 已建立并进入真实运行时
- [ ] task completion / value realization / revenue 至少有部分事件真实发出
- [ ] 至少一个 future decision entrypoint 消费了 execution feedback
- [ ] RuntimeMode 行为契约已在至少两个 consumers 中落实
- [ ] 新增 freshness / feedback / verification tests 已通过
- [ ] 汇报口径已严格区分已复证与未复证内容

---

# 6. 一句话结论

> **Round 15.9 的目标，不是再扩大 economic runtime 的表面积，而是把它固定为可验证、可刷新、可反馈学习的稳定系统能力。**
