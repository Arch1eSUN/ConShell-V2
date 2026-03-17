# Round 15.8 — Economic Runtime Consumption and Autonomous Value Execution

> **文件定位**：这是 Round 15.8 的正式开发提示词。  
> **前置审计结论**：Round 15.7B 已经把 economic subsystem 向 runtime integration 推进了一步，出现了真实接线迹象，包括：  
> - `EconomicStateService` 已建立；  
> - `LedgerProjection` 已从 `SpendTracker` 实时投影；  
> - `X402Server.verifyPayment()` 已能桥接到 `SpendTracker.recordIncome()`；  
> - `Kernel` 已初始化并注入 `EconomicStateService`；  
> - `AgentLoop` 已出现 survival gate 预检接线。  
> 但当前审计同样确认：  
> - `107/107 pass` 仍未在当前环境复证；  
> - `walkthrough.md` 不存在；  
> - `runtime-adoption-map.md` 实际位于 `DevPrompt/runtime-adoption-map.md`，与汇报位置不一致；  
> - 现有接线仍偏向“pre-loop gating + facade exposure”，还没有形成真正的 autonomous value execution 闭环。  
> **本轮目标**：不是重复做模块实现，也不是继续写说明文档，而是让 economic subsystem 被 runtime 更深度消费，形成真实的“价值优先执行、收益优先调度、生存约束驱动行为”的运行时机制。  
> **事实纪律**：禁止把“facade 暴露”包装成“runtime 已全面经济化”。

---

# 0. 本轮问题定义

Round 15.7B 解决的是：

> **economic subsystem 已不再完全孤立，开始接入运行时。**

但当前还没有证明以下更高阶能力已经成立：

1. **Runtime 真的持续消费 economic state，而不是只在少数入口偶尔读取**；
2. **任务执行策略真的由 value-aware routing 主导，而不是仅暴露一个 `getTaskRouting()` 方法**；
3. **收入导向行为真的进入系统调度主链，而不是仅支持 x402 收入入账**；
4. **survival constraints 不只是“拦截推理”，而是系统级资源调度规则**；
5. **economic truth 已经开始反向塑造系统执行计划、任务优先级、资源分配与恢复策略。**

因此，Round 15.8 的唯一正确问题定义是：

> **如何让 economic state 不仅被 runtime 看见，而且被 runtime 持续消费，并据此驱动 autonomous value execution？**

---

# 1. 本轮唯一核心目标

本轮必须推进：

# **Economic Runtime Consumption → Autonomous Value Execution**

即：
1. 让 runtime 中的关键行为链持续读取并执行 economic decisions；
2. 让 value router 真正进入任务调度/排队/优先级体系；
3. 让“收益任务优先、亏损任务降级、濒危时主动求生”变成系统行为，而不只是模块能力；
4. 为后续 agenda / worker / autonomous operation 打下真实执行底座。

---

# 2. 本轮必须回答的核心问题

在写代码前，必须先回答以下问题：

## 2.1 Runtime 哪些路径必须持续消费 EconomicStateService？
不能只说“AgentLoop 接了”。你必须明确：
- 推理前
- 工具前
- 任务入队前
- 任务出队前
- 收入事件后
- 心跳/周期性状态刷新时

哪些路径必须重新读取 economic state？

## 2.2 ValueRouter 的消费点到底在哪里？
当前它已有逻辑，但本轮必须明确：
- 决策发生在入队前？
- 出队前？
- loop 内？
- server 层？
- worker 层？

没有消费点，value router 仍然只是模块能力，不是 runtime 规则。

## 2.3 收益导向行为如何在 runtime 中落地？
本轮必须定义：
- 什么算 revenue-bearing task？
- 什么算 strategic-but-non-immediate-revenue task？
- 什么算 purely costly task？
- 在不同 tier 下如何区别处理？

## 2.4 Survival constraints 的作用范围多大？
本轮必须明确 survival 不仅影响：
- model selection

还要决定是否影响：
- task acceptance
- queue priority
- feature access
- child work delegation
- background jobs / autonomous actions

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Economic Consumption Matrix

先输出一个矩阵，明确 runtime 中哪些组件会消费哪些 economic 信号。

### 必须覆盖以下维度：
- 组件：
  - `AgentLoop`
  - `TaskQueue`
  - `Kernel`
  - `X402Server`
  - heartbeat / scheduler（若存在）
  - worker/task intake（若存在）
- economic signals：
  - `survivalTier`
  - `health`
  - `balanceCents`
  - `survivalDays`
  - `routingDecision`
  - `gateDecision`
- 动作结果：
  - allow
  - restrict
  - reject
  - reprioritize
  - degrade
  - income-seek

### 输出要求：
你必须让这张表回答一个问题：

> **系统到底在哪些真实路径上“被经济状态驱动”？**

在完成这个矩阵前，不要继续扩实现。

---

## Task 2 — 让 ValueRouter 真正进入 TaskQueue / 执行调度链

当前问题：`EconomicStateService.getTaskRouting()` 已存在，但未证明任务系统持续消费它。

### 本任务必须完成至少一种真实接线：

#### 方案 A：入队前路由
- task 进入 queue 前调用 `getTaskRouting()`
- reject / defer / downgrade / accept 在入队层落地

#### 方案 B：出队前再评估
- task 入队后，出队执行前再次按最新 economic state 评估
- 允许 queue 中的 task 因状态变化被重排/降级/丢弃

#### 方案 C：双阶段路由
- 入队时粗分流
- 执行前再精细判断

### 必须实现：
- revenue-bearing task 优先级真实提高
- costly non-revenue task 在 critical/terminal 下真实降级或拒绝
- routing 结果能被审计（why / priority / action）

### 禁止：
- 只在 facade 里暴露 `getTaskRouting()`
- 测试里手动调 `getTaskRouting()` 就宣称系统已 value-aware

---

## Task 3 — 让 SurvivalGate 覆盖工具与高成本动作，而不是只拦推理

当前问题：AgentLoop 有 pre-loop survival gate，但系统级资源约束还不够。

### 本任务必须把 survival constraints 扩展到至少两个新动作域：
1. **高成本工具调用**
2. **child/worker delegation** 或 **background/autonomous actions**
3. **上下文窗口/迭代深度**
4. **长链工具循环**

### 必须实现：
- 在 critical/terminal/dead 下，高成本动作真的被限制
- 限制不是只靠 prompt 注入，而是 runtime rule
- blocked/restricted 时有结构化原因

### 推荐方向：
- 将 survival gate 抽象成 runtime policy enforcement helper
- 把 tool cost class / action class 纳入 gating contract

---

## Task 4 — 建立 Revenue-Seeking Mode / Survival Recovery Mode

这是 Round 15.8 的关键新增能力之一。

当前系统能“知道自己穷”，但未证明会“主动求生”。

### 本任务必须新增一种 runtime 模式：

#### 模式 A：Revenue-Seeking Mode
当系统进入 `critical` / `terminal` 时：
- 优先接 revenue-bearing tasks
- 主动拒绝纯消耗任务
- 允许有限的 income-seeking operations
- 提供清晰的 mode 标识

#### 模式 B：Survival Recovery Mode
当经济状态恶化时：
- 降低模型和上下文成本
- 偏好短回答
- 偏好直接变现/节流行为
- 避免高投入低回报行为

### 必须明确：
- 进入条件
- 退出条件
- 对 runtime 行为的具体影响
- 如何记录/解释模式切换

### 禁止：
- 只在 narrator 里说“进入求生模式”但行为不变

---

## Task 5 — 把 EconomicState 刷新机制做成真实 runtime contract

当前 `snapshot()` 可用，但还缺少“系统什么时候刷新、谁负责刷新、刷新后谁会消费”的明确契约。

### 本任务必须明确：
1. **刷新触发点**
   - spend after-record
   - income after-record
   - automaton tier evolve
   - task queue decision point
   - heartbeat / periodic tick（若适合）
2. **刷新方式**
   - lazy snapshot
   - eager recompute
   - cached snapshot + invalidation
3. **并发语义**
   - 多事件连续到来时如何保证状态一致

### 验收标准：
- runtime 在关键决策点不会长期使用过时 economic state
- 不会每次都重算到影响性能，也不会缓存到失真

---

## Task 6 — 建立 Economic Decision Audit Trail

当前已有 narrator / ledger / projection，但缺一个清晰的“经济决策审计轨”。

### 本任务必须为以下决策提供审计记录能力：
- 为什么某个任务被拒绝
- 为什么某个模型被替换
- 为什么某个高成本工具被阻断
- 为什么某个任务被提升优先级
- 为什么系统进入/退出 revenue-seeking mode

### 要求：
- 审计记录要区分：
  - state fact
  - decision
  - enforcement action
  - resulting behavior
- 不能只给字符串，要有结构化字段

### 推荐产物：
- economic decision event type
- runtime log schema
- optional persisted audit records

---

## Task 7 — 收敛 X402 收入桥接与 value execution 的语义边界

当前 `X402Server.verifyPayment() → recordIncome()` 已出现真实桥接。

但本轮必须回答：

> **收入记录是“经济事实”，还是“价值执行完成”的充分条件？**

### 你必须区分：
1. **Revenue Event**：钱进来了
2. **Value Realization Event**：系统完成了可计费价值交付
3. **Task Completion Event**：任务做完了

### 本任务必须做的事：
- 定义这些事件的边界
- 避免把“收到钱”与“完成价值交付”混为一谈
- 为 task-service / API access / x402 payment 建立清晰语义

这是后续 autonomous monetization 的基础，不允许含糊。

---

## Task 8 — 建立更强的真相对账测试

Round 15.7B 已开始有 convergence tests，但还不够。

### 本轮必须新增以下测试：

#### 8.1 Queue / Routing Integration Tests
- task 进入 queue 时会被 value router 处理
- 同一任务在不同 tier 下优先级不同
- revenue task 在 critical 下优先于 non-revenue task

#### 8.2 Enforcement Breadth Tests
- survival gate 不只拦推理，还能拦高成本工具/动作
- dead/terminal 下相关路径真实不可执行

#### 8.3 Recovery Mode Tests
- 进入 critical/terminal 后系统进入 revenue-seeking / survival recovery mode
- 状态恢复后可退出该模式

#### 8.4 Truth Boundary Tests
- revenue event / task completion / value realization 不被混淆
- state/projection/repo/decision trail 关键值对账一致

#### 8.5 Runtime Freshness Tests
- 新收入/新支出后，关键决策能读取到更新后的 state
- 不会用 stale snapshot 做关键决策

---

## Task 9 — 测试真实性与环境修复必须继续追到底

当前审计已再次证明：
- `pnpm vitest run` 仍然因为 `tinyrainbow/dist/node.js` 缺失而失败
- 所以任何 “107/107 pass” 仍未在当前环境中成立

### 本任务必须推进：
1. 明确该依赖缺失的根因；
2. 判断是：
   - lockfile 损坏
   - install 不完整
   - vitest 版本/导出问题
   - node_modules 异常
3. 给出稳定修复路径；
4. 修复后真实重跑：
   - economic tests
   - runtime integration tests
   - 至少一组受影响回归测试

### 严格要求：
- 在测试未真实复证前，所有 pass 数字都不能写进“完成声明”；
- 可以写“claimed / previously reported / not re-verified in current environment”，但不能写成既定事实。

---

## Task 10 — 文档对账，不允许再出现“汇报文件不存在”

当前审计已发现：
- `runtime-adoption-map.md` 不在仓库根，而在 `DevPrompt/runtime-adoption-map.md`
- `walkthrough.md` 缺失

### 本任务必须完成：
1. 所有汇报提到的文件必须真实存在；
2. 文件路径必须和汇报一致；
3. walkthrough 文档若要作为交付件，必须真实创建；
4. 文档要标明：
   - what is implemented
   - what is runtime-consumed
   - what remains partial
   - what is not yet verified

### 禁止：
- 汇报里引用不存在的文件
- 用“walkthrough complete”代替真实文档

---

# 4. 本轮输出要求

本轮结束后，输出必须采用以下结构：

1. **What runtime paths now consume economic state continuously**
2. **Where value routing is now enforced in execution flow**
3. **What survival constraints now affect beyond inference**
4. **Whether revenue-seeking / survival recovery mode is now real**
5. **What remains facade-only or partial**
6. **What tests were actually executed**
7. **What environment issues still block full verification**
8. **What files/documents were actually created**

### 禁止输出：
- “已完成 autonomous value execution”但没有真实执行链
- “已完成全面 runtime economicization”但 queue/tool/background path 没接
- “全量测试通过”但当前环境仍未复证

---

# 5. 最终验收标准

只有满足以下条件，本轮才算通过：

- [ ] Economic consumption matrix 已明确并落地
- [ ] ValueRouter 至少进入一条真实调度链（queue/intake/execution）
- [ ] SurvivalGate 至少扩展到两个动作域，而不只推理
- [ ] Revenue-seeking / survival recovery mode 已成为真实行为模式
- [ ] Economic state 刷新机制已形成 runtime contract
- [ ] Economic decision audit trail 已建立
- [ ] Revenue / value realization / task completion 边界已明确
- [ ] 新增测试覆盖 queue/routing/enforcement/recovery/freshness
- [ ] 测试真实性问题已继续推进，不再口头复用旧 pass 数字
- [ ] 汇报文件与实际文件完全对齐

---

# 6. 一句话结论

> **Round 15.8 的目标，不是再证明系统“知道经济状态”，而是证明系统会持续消费经济状态，并据此真实地调度任务、限制资源、优先收益、执行求生。**
