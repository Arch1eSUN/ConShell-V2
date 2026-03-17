# Round 16.1 — Autonomous Agenda, Continuous Operation, and Commitment Runtime

> **文件定位**：这是 Round 16.1 的正式开发提示词。  
> **前置审计结论**：Round 16.0 已完成本轮目标，并已由本地 canonical 命令严格复证：economic suite 达到 `178/178 passing`。  
> 当前系统已具备：  
> - EconomicMemoryStore（三层长期经济记忆）；  
> - ValueLifecycleTracker（分轨价值生命周期）；  
> - EconomicPerformanceReport；  
> - TaskFeedbackHeuristic（短期 + 长期混合，mode-sensitive）；  
> - TaskQueue completion → memory / lifecycle / feedback 回流；  
> - Economic runtime 的 verification contract 已固定。  
> **但当前最大全局缺口已从“经济运行时”转移为“持续自治运行时”**：系统会根据经济状态做决策，但仍缺少真正的 autonomous agenda、durable commitments、restart continuity、background commitments 与多日持续推进能力。  
> **本轮目标**：把当前“会决策的经济 runtime”推进为“会持续推进承诺的自治生命体 runtime”。  
> **事实纪律**：禁止把“heartbeat 还在跑”包装成“continuous autonomous operation 已成立”；禁止把“task queue 能执行任务”包装成“agent 已拥有 agenda”。

---

# 0. 本轮问题定义

Round 16.0 解决的是：
- 系统已经开始拥有长期经济记忆；
- routing 已不再只靠短期反馈；
- value realization lifecycle 开始具备结构化表达；
- economic decisions 开始基于历史表现进行自适应。

但系统仍然没有回答下面这个决定性问题：

> **它是否会持续地主动推进自己的 commitments，而不是只在有外部输入时做局部决策？**

当前缺口集中在：
1. 没有正式的 autonomous agenda 生成器；
2. 没有 durable commitment runtime；
3. restart 后未证明 commitments 可恢复；
4. heartbeat/scheduler 还不是“任务承诺推进系统”；
5. economic memory 已存在，但还没有真正驱动长期 agenda 选择。

因此，Round 16.1 的唯一正确问题定义是：

> **如何让 ConShell 从“会做经济决策的 runtime”升级为“会持续维护和推进承诺的自治运行时”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Autonomous Agenda + Continuous Operation + Commitment Runtime**

即：
1. 建立正式的 agenda model；
2. 建立 durable commitments；
3. 让 heartbeat / scheduler 真正消费 commitments；
4. 让 restart 后可以恢复未完成承诺；
5. 让 economic state / memory 开始影响 agenda selection 和 commitment prioritization。

---

# 2. 本轮必须先回答的问题

## 2.1 什么是 Commitment？
你必须明确：
- commitment 是 task 的上位概念，还是 task 的持久化版本？
- 它是否包含 deadline、priority、origin、economic value、owner、status？
- 它与 queue item / value event / memory event 的关系是什么？

如果没有 commitment model，就没有 continuous operation。

## 2.2 Agenda 是如何产生的？
你必须明确 agenda 的输入来自哪里：
- creator directives
- pending commitments
- current runtime mode
- economic memory
- survival pressure
- maintenance obligations
- open opportunities

如果 agenda 只是“把 queue 里的东西列出来”，那不算 autonomous agenda。

## 2.3 Continuous operation 的最小成立条件是什么？
你必须明确至少满足：
- runtime 能持有待完成 commitments
- 无外部输入时，仍能推进至少一类 commitments
- restart 后不会完全忘记在做什么
- heartbeat 不只是健康检查，而是能驱动 commitment review

## 2.4 Economic system 如何反向塑造 agenda？
现在有 economic memory，但必须明确：
- 哪些 commitments 应被优先推进？
- 哪些 commitments 因 survival mode 被推迟/拒绝？
- 哪些 maintenance work 即使不赚钱也必须保留？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Commitment Model Contract

必须新增一个正式 contract，例如：
- `commitment.ts`
- 或 `agenda/commitment-model.ts`

### 至少定义：
- `Commitment`
- `CommitmentOrigin`（creator / self / system / child / external）
- `CommitmentStatus`（planned / active / blocked / completed / abandoned / failed）
- `CommitmentPriority`
- `CommitmentKind`（revenue / maintenance / memory / governance / replication / identity / user-facing）
- `dueAt` / `lastEvaluatedAt` / `nextReviewAt`
- `expectedValueCents` / `estimatedCostCents` / `mustPreserve` / `revenueBearing`

### 强要求：
- 必须区分 commitment 与单次 queue task
- 必须说明 commitment 如何映射成具体 execution tasks

---

## Task 2 — 新增 CommitmentStore / CommitmentRuntime

必须实现一个可测试组件，例如：
- `CommitmentStore`
- `CommitmentRuntime`

### 最小能力要求：
- `add(commitment)`
- `update(id, patch)`
- `list(filter?)`
- `get(id)`
- `markCompleted(id)`
- `markBlocked(id, reason)`
- `markFailed(id, reason)`
- `due(now)`
- `nextReviewable(now)`

### 推荐路线：
- 先 in-memory + persistence interface
- 若成本可控，可直接接 SQLite repo

### 验收标准：
- 系统存在“长期待推进事项”的正式 owner
- queue 不再是唯一待办载体

---

## Task 3 — 建立 Autonomous Agenda Generator

必须新增一个 agenda generator，例如：
- `AgendaGenerator`
- `AutonomousAgendaService`

### 输入至少包含：
- pending commitments
- runtime mode
- survival tier
- economic memory stats
- maintenance obligations
- creator directives（若存在）

### 输出至少包含：
- 本轮应推进的 top commitments
- 为什么选它们
- 为什么暂缓其他 commitments

### 选择逻辑至少覆盖：
1. revenue-positive commitments 在 `revenue-seeking` 下优先
2. critical maintenance commitments 即使不赚钱也不能完全消失
3. long-term poor performers 在低 tier 下被降级
4. must-preserve commitments 受到保护

### 禁止：
- agenda 只是简单按时间排序
- agenda 不解释选择原因

---

## Task 4 — 将 Heartbeat / Scheduler 升级为 Commitment Review Loop

当前 heartbeat 已存在，但本轮必须让它承担 commitment review 责任。

### 必须新增：
- 每个 heartbeat / tick 审视 due/reviewable commitments
- 依据 mode / economic state / memory 重新评估优先级
- 必要时把 commitment materialize 成 queue tasks

### 强要求：
- heartbeat 不只是 health ping
- 至少存在一条“无外部输入也会继续推进 commitments”的路径

---

## Task 5 — 建立 Commitment → Task Materialization

当前 queue 执行的是 tasks，但 agenda/commitment 是更高层对象。

### 本任务必须完成：
- 从 commitment 生成具体 task descriptor
- task 执行结果能回写 commitment status
- completion / failure / blockage 会影响 commitment lifecycle

### 至少覆盖：
1. maintenance commitment
2. revenue-bearing commitment
3. memory/governance style commitment（至少一种）

### 验收标准：
- queue 不再与更高层 agenda 脱节
- commitment 有真正的执行路径，而不是停在 store 里

---

## Task 6 — 建立 Restart Continuity / Commitment Recovery

这是 continuous operation 的关键。

### 必须实现至少一种：
#### 方案 A：SQLite persistence
- commitments 持久化
- restart 后 reload

#### 方案 B：structured checkpoint file
- boot 读回 commitments

#### 方案 C：混合
推荐：**A 或 C**，优先真实持久化

### 必须做到：
- restart 后 pending commitments 不丢
- completed/failed commitments 不被误重放
- active → blocked/review 状态在恢复时有清晰语义

### 禁止：
- 只是把 queue 内容序列化就宣称 restart continuity 成立

---

## Task 7 — 让 Economic Memory 真正影响 Agenda Selection

当前 economic memory 已影响 routing；本轮必须影响 agenda。

### 至少完成：
1. 高 realization / 高 net value commitment 在 `revenue-seeking` 下优先
2. 低 realization / 高成本 commitment 在 `survival-recovery` 下被降级
3. must-preserve maintenance work 不因纯经济信号被完全饿死
4. agenda selection 结果可解释

### 目标：
让系统从“会判断任务值不值得做”，升级到“会决定长期该把生命时间花在哪些 commitments 上”。

---

## Task 8 — 新增 Commitment / Agenda / Recovery Tests

本轮必须新增覆盖以下测试：

### 8.1 Commitment Model / Store Tests
- add/update/list/mark state 正确
- due/reviewable 过滤正确

### 8.2 Agenda Selection Tests
- revenue-seeking 下优先选择 revenue-positive commitments
- must-preserve maintenance commitments 在低 tier 下仍可保留
- poor historical performers 被降级

### 8.3 Materialization Tests
- commitment 可生成 task
- task completion/failure 正确回写 commitment status

### 8.4 Recovery Tests
- commitments 可跨 restart 恢复
- completed/failed 不被错误重放
- blocked/review 状态恢复语义正确

### 8.5 Continuous Operation Tests
- 无外部输入时，heartbeat/tick 可推进至少一类 commitments

### 8.6 Regression Tests
- 现有 economic 178 tests 无回归

---

## Task 9 — 文档与控制面说明

必须新增/更新文档，明确：
1. 什么是 commitment
2. agenda 如何生成
3. heartbeat 如何推进 commitments
4. restart continuity 如何保证
5. 哪些 commitments 是 revenue-driven，哪些是 must-preserve

### 禁止：
- 用“autonomous”描述没有 commitment runtime 的系统
- 用“continuous”描述无法恢复承诺的系统

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical commitment model**
2. **How commitments are stored and recovered**
3. **How agenda selection now works**
4. **How heartbeat/scheduler now advances commitments**
5. **How economic memory now affects agenda prioritization**
6. **What tests were actually executed**
7. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “continuous autonomy complete”但 restart continuity 未成立
- “autonomous agenda complete”但只是 rule list
- “commitment runtime complete”但 queue 与 commitment 没接上

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical commitment model 已明确
- [ ] `CommitmentStore/Runtime` 已建立
- [ ] `AgendaGenerator` 已建立且可解释选择理由
- [ ] heartbeat/scheduler 至少能推进一类 commitments
- [ ] commitment 能 materialize 为 task 并回写状态
- [ ] restart continuity / commitment recovery 已成立
- [ ] economic memory 至少影响一个 agenda selection 路径
- [ ] 新增 commitment/agenda/recovery tests 已通过
- [ ] 原有 economic 178 tests 无回归
- [ ] 文档中 continuous operation 的定义已纠偏并工程化

---

# 6. 一句话结论

> **Round 16.1 的目标，不是再强化局部经济智能，而是让 ConShell 真正开始持续维护自己的 commitments——从“会做局部决策的 runtime”升级为“会跨时间推进承诺的自治生命体运行时”。**
