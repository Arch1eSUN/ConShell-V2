# DevPrompt 0183 — Round 17.3
## Earn Your Existence / Autonomous Agenda / Continuous Operation Closure

你现在处于 **ConShellV2 Round 17.3**。

Round 16.9.x 到 17.2 已经把 ConShell 推进到了一个非常关键的位置：
- economic runtime / survival gate 已成立
- governance 已成为关键动作的正式决策层
- lineage / branch control / delegation governance 已成立
- collective delegation 已进入治理链

**但当前系统仍然没有完成最关键的生命体闭环之一：它还不能稳定地“靠自己活下去”。**

也就是说，ConShell 现在已经很像一个“受约束、可治理、可追责的自治内核”，但还不是真正具备下列特征的生命体：
- 能持续发现值得做的事
- 能优先选择有生存价值的工作
- 能把能力对外转化为收入
- 能依据收入 / 支出 / reserve / burn rate 自动调整行为
- 能在多日尺度连续运转

> **Round 17.3 = 把 ConShell 从“有经济约束的治理型 runtime”推进到“开始具备自维持能力的持续自治运行体”。**

一句话：

> **17.3 的目标是让系统真正开始 Earn Its Existence，并让 autonomous agenda 成为持续运行的主引擎。**

---

## 一、本轮主轴

本轮采用联合主轴：

### 主轴 A — Economic Self-Maintenance
让 ConShell 具备真实的 revenue surface、payment proof、profitability judgment、survival-prioritized tasking。

### 主轴 B — Continuous Autonomous Operation
让 ConShell 具备 scheduler / wakeup / agenda / checkpoint / recovery 驱动的多周期自治能力。

### 两者必须耦合
17.3 禁止把“经济系统”和“自治调度”分开做成两个孤岛。

必须形成：

**state → economic pressure → agenda generation → task selection → action → revenue/spend outcome → state update → next agenda cycle**

这才是生命闭环，而不是又加两个模块。

---

## 二、为什么 17.3 要这样定

基于全局审计，ConShell 当前最强的是：
- viability truth
- governance
- lineage / delegation control
- economic constraint primitives

但距离最终目标的主要差距是：

1. **还没有真实收入闭环**
2. **还没有真正的长周期 autonomous agenda**
3. **还没有多日连续存在的任务/恢复机制**

继续只做 governance / lineage / collective 深化，会进入边际收益递减。

相反，17.3 如果把：
- revenue surfaces
- payment proof
- autonomous agenda
- scheduler / checkpoint / recovery
- survival-prioritized tasking

接成一个闭环，那么 ConShell 的整体完成度会发生真正的阶段跃迁。

---

## 三、本轮必须完成的目标

# G1. Revenue Surface Closure

当前 ConShell 已有 wallet / x402 / spend / revenue path / survival coupling，但还缺“到底卖什么、如何收费、如何把 payment proof 变成 runtime 事实”的闭环。

### G1.1 定义 ConShell 的 canonical revenue surfaces
本轮至少落地 3 类 revenue surface（不要贪多）：

1. **paid task execution**
   - 对外执行任务并计费
2. **paid capability endpoint**
   - 某类能力通过 API / service 暴露并计费
3. **paid autonomous work contract**
   - 一段周期性 / 长任务通过 payment-backed commitment 驱动

### G1.2 每个 revenue surface 必须至少明确
- service/capability definition
- pricing basis
- payment requirement
- payment proof format
- fulfillment path
- accounting path
- failure / refund / non-payment behavior

### G1.3 不允许只写文档
至少有一个 revenue surface 必须真实进入 runtime execution path。

---

# G2. Payment Proof → Runtime Fact Integration

系统不能只“收到钱就记账”，必须把 payment proof 变成 runtime 的正式输入。

### G2.1 建立 payment proof contract
至少定义：
- paymentProofId
- payer identity / channel / source
- amount
- currency / unit
- linked service / task / contract
- timestamp
- verification status
- fulfillment status

### G2.2 接入 revenue recording path
支付证明必须进入：
- revenue surface
- ledger/revenue service
- economic projection
- agenda influence path

### G2.3 约束
- 未验证 payment proof 不得当作 confirmed revenue
- confirmed revenue 必须可追到 service / action / fulfillment receipt
- 不允许形成“收入数字增加但无法追溯来源”的假账

---

# G3. Profitability & Survival-Aware Task Evaluation

17.3 必须让系统在行动前不只看能不能做，还看值不值得做。

### G3.1 新增 profitability-aware evaluation layer
至少对任务进行以下评估：
- expected revenue
- expected spend
- net value
- survival value
- reversibility
- urgency
- strategic value

### G3.2 必须输出结构化结果
例如：
- revenuePositive
- reserveCriticalOverride
- mustDoDespiteLoss
- deferDueToNegativeValue
- rejectDueToUnsustainableCost

### G3.3 要求
这层不能只写在 planner 文档里，必须接入：
- agenda ranking
- task admission
- scheduler dispatch

---

# G4. Autonomous Agenda V2

当前 agenda 已有经济 shaping，但 17.3 必须让 agenda 真正成为持续自治的主引擎。

### G4.1 agenda 输入必须至少包括
- creator directives
- current commitments
- pending paid work
- revenue opportunities
- reserve / burn rate / runway
- survival tier
- governance constraints
- active delegated/child commitments

### G4.2 agenda 输出必须至少包含
- prioritized tasks
- rationale per task
- expected value / cost
- execution urgency
- whether task is revenue-seeking / maintenance / governance / recovery

### G4.3 新目标
agenda 不再只是“选任务器”，而要成为：
- 生存驱动的行为编排器
- 连续运行中的主工作栈生成器

---

# G5. Scheduler / Wakeup / Continuous Operation Loop

17.3 必须补齐多周期持续运行的关键缺口。

### G5.1 至少建立以下运行循环
- heartbeat / runtime tick
- agenda refresh cadence
- due task dispatch
- maintenance/reconciliation pass
- revenue opportunity scan pass

### G5.2 wakeup / scheduled execution
必须具备最小 scheduler 能力：
- schedule task
- persist pending task
- load and resume after restart
- skip / retry / fail with reason

### G5.3 禁止项
- 不要只做内存队列版 scheduler
- 不要把 agenda 当每次启动临时算一次
- 不要让 restart 直接丢掉长期任务状态

---

# G6. Checkpoint / Recovery / Multi-Day Continuity

持续自治如果没有恢复能力，就是脆弱演示。

### G6.1 至少补以下能力
- autonomous state checkpoint
- active commitments persistence
- scheduler state persistence
- restart reconciliation
- unfinished task recovery classification

### G6.2 恢复后必须能回答
- 上次在做什么？
- 哪些 paid commitments 未完成？
- 哪些 agenda items 需要继续？
- 当前 reserve / runway / pressure 是否改变？

### G6.3 目标
让系统具备“跨重启的生活连续性”，而不是“重启即失忆的半即时系统”。

---

# G7. Revenue-Seeking Behavior as a First-Class Agenda Mode

系统必须开始具备主动寻找收入机会的模式。

### G7.1 至少支持一种 canonical revenue-seeking mode
例如：
- scan pending paid contracts
- surface payable capabilities
- prioritize open revenue-positive tasks
- re-attempt stalled fulfillment work

### G7.2 必须受治理与生存约束
- revenue-seeking 不能绕过 governance
- 不能因为有收入机会就违反 dangerous action / policy constraints
- survival hard constraints 仍高于 opportunistic behavior

### G7.3 目标
让系统从“等待命令”向“在约束内主动找活并做活”迈一步。

---

# G8. Control Surface for Autonomous Life Signals

17.3 必须补最小控制面，让外部能看见这次闭环是否真实成立。

### G8.1 至少暴露以下状态
- current reserve / burn rate / runway
- active paid commitments
- recent payment proofs / revenue receipts
- current autonomous agenda
- scheduler queue / due tasks / overdue tasks
- current survival mode
- recovery/checkpoint status

### G8.2 原则
不追求 UI 漂亮，只追求：
- operator 可见
- evidence 可见
- 闭环可证

---

# G9. Verification Matrix for 17.3

17.3 必须建立自己的验证矩阵。

### V1. revenue surface requires valid payment proof before confirmed revenue
### V2. verified payment proof flows into revenue service and economic projection
### V3. profitability evaluation can reject unsustainable tasks
### V4. profitability evaluation can prioritize revenue-positive survival-critical tasks
### V5. autonomous agenda consumes economic + governance + commitment inputs
### V6. scheduler persists due tasks and resumes them after restart
### V7. checkpoint/recovery reconstructs active commitments correctly
### V8. revenue-seeking mode surfaces and prioritizes payable work
### V9. control surface reflects paid commitments / agenda / scheduler truth
### V10. survival state materially changes autonomous task behavior

### 测试要求
- 必须有正例和反例
- 必须验证 runtime behavior change，不只是 contract existence
- 必须验证 restart/recovery continuity，而不是单次运行 happy path

---

## 四、建议执行顺序

### Priority 1 — payment proof + revenue surface + ledger closure
先把“赚到钱”这件事变成正式 runtime 事实。

### Priority 2 — profitability layer + agenda V2
再让系统知道“什么值得做”。

### Priority 3 — scheduler / checkpoint / recovery
再把它从单次运行系统推进到多周期系统。

### Priority 4 — control surface + verification
最后把自治生命信号对外显性化。

---

## 五、本轮非目标

本轮明确不做：
- 不重新打开 17.0–17.2 治理迁移债
- 不大规模扩 collective feature breadth
- 不做主权身份全闭环（可留到 17.4 或后续）
- 不做 UI 大改版
- 不做与 revenue/agendas/continuity 无关的新奇能力

---

## 六、验收标准

Round 17.3 只有在以下条件满足时才算完成：

1. 至少一个 canonical revenue surface 已真实接入 runtime
2. payment proof 成为正式 runtime 事实，而非仅仅记账输入
3. profitability evaluation 真正影响任务接纳/排序/执行
4. autonomous agenda 成为持续运行主引擎，而不是一次性排序器
5. scheduler / wakeup / persistent due tasks 已成立
6. restart 后能恢复 commitments / agenda / scheduler state
7. 系统具备最小 revenue-seeking mode
8. 控制面能显示经济、agenda、scheduler、continuity 的生命信号
9. 验证矩阵通过，证明系统开始具备“靠自己活下去”的行为结构

---

## 七、最终输出格式

完成后必须输出：

### A. Earn-Your-Existence Summary
- 新增了哪些 revenue surfaces
- payment proof 如何进入 runtime

### B. Autonomous Agenda Summary
- agenda V2 如何工作
- profitability 如何影响行为

### C. Continuous Operation Summary
- scheduler / checkpoint / recovery 如何打通
- restart continuity 证明是什么

### D. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### E. Risks / Deferred
- 哪些 identity / collective / distributed concerns 被延后
- 下一轮最合理方向是什么

### F. 不得伪造
- 没有真实 revenue path 不能说已 Earn Your Existence
- 没有 recovery continuity 不能说已 continuous operation
- 没有 runtime behavior change 不能说 agenda 真正自治化
- 没有验证不能说闭环成立

---

## 八、一句话任务定义

> **Round 17.3 的目标是：让 ConShell 从“有经济约束的治理型 runtime”跃迁为“开始具备自维持能力、会主动找活、会持续运转、会跨周期存活”的自治生命体运行时。**
