# DevPrompt 0211 — Round 20.1
## Life Cycle / Economic Agenda / Governance Inbox / Lightweight Orchestration Closure

你现在处于 **ConShellV2 Round 20.1**。

Round 20.0 已经明确了一件事：

> **项目必须加速，但绝不能为了速度牺牲真实性、可审计性、可验证性与全绿纪律。**

而且经过本轮架构收敛，20.1 不再需要继续泛泛探索方向。
当前 5 个核心机制已经完成了明确的设计对齐：

1. **Economic (G1)** → Task-based Revenue
2. **Agenda (G2)** → Hybrid Tick/Event Arbiter
3. **Replication (G3)** → Governance-Gated Proposal
4. **Orchestration (G4)** → Lightweight Context Isolation
5. **Action (G5)** → Governance Inbox + What-If Projection

因此 Round 20.1 的目标，不再是继续讨论“应该做什么”，而是：

> **把这五个已经定稿的终局核心机制，真正拧成一套可运行、可验证、可审计、能影响系统行为的主路径闭环。**

---

## 一、本轮总目标

**将 ConShell 从“已经有强平台骨架”继续推进到“具备生命级长期调度、任务营收驱动、生育提案治理、轻量级 session 原语、以及治理审批控制面闭环”的实际运行时。**

本轮不是做 UI 漂亮化，也不是单点补丁轮。
本轮要做的是：

- 把 economic/survival 真正推进为行为规律
- 把 agenda 从快照推进为生命周期过程
- 把 replication 从概念推进为治理下真实可执行 proposal
- 把 orchestration 从松散 helper 推进为轻量级 session/runtime primitive
- 把 truth→action 从“能看见”推进为“能审批、能推演、能审计”

---

## 二、本轮必须完成的 5 大主任务

# G1. Task-Based Revenue 真正进入 runtime 主规律

## 目标
把“任务报酬 + 生存压力”真正推进到 task admission 与 agenda 排序主路径。

## 必须实现
1. 定义 **task-based revenue contract**：
   - task value / expected payout
   - execution cost estimate
   - time sensitivity
   - risk / uncertainty
   - expected net utility
2. 在任务进入 runtime 时，统一走一层 admission / scoring：
   - 是否值得接
   - 是否应立即执行
   - 是否应 deferred
   - 是否因 survival pressure 被提权
3. 将 survival pressure 更真实地接入：
   - admission
   - scheduling priority
   - background work allocation
   - opportunity-driven promotion
4. 让至少一条真实链路成立：
   - revenue opportunity → net utility evaluation → agenda reprioritization → execution/deferral
5. 若已有 economic state / reserve / cost accounting，继续与该链路深接线，而不是另起一套平行逻辑

## 验收标准
- revenue 不再只是显示信息，而会实质改变 task admission 与优先级
- 至少一个真实 revenue task path 能清晰解释“为什么接 / 为什么不接 / 为什么提权”

---

# G2. Hybrid Life Cycle Engine + Agenda Arbiter

## 目标
把 agenda 从“当前状态展示”推进为“生命时钟 + 事件打断”共同驱动的长期过程结构。

## 必须实现
1. 引入或收口一个统一的 **LifeCycleEngine**：
   - Tick 驱动生命循环
   - Event 驱动紧急打断
2. Tick 至少要负责：
   - survival state review
   - deferred aging / expiry cleanup
   - scheduled commitments activation
   - periodic agenda sweep
3. Event 至少要负责：
   - new revenue task arrival
   - major economic state change
   - governance decision outcome
   - critical runtime signal / degraded signal
4. 所有 Tick / Event 触发后的优先级重排，必须统一进入 **AgendaArbiter**，不能出现双轨调度逻辑
5. 明确区分并可被 truth surface 表达：
   - immediate
   - scheduled
   - deferred
   - survival-driven
   - opportunity-driven
6. agenda 的重排原因要可解释：
   - 为什么它被提升
   - 为什么它被推迟
   - 为什么它被清除或过期

## 验收标准
- agenda 的行为更像长期生命过程，而不是短期 UI 摘要
- Tick/Event/Arbiter 三者形成统一的 canonical reprioritization path

---

# G3. Governance-Gated Replication Proposal 闭环

## 目标
让 replication 从概念结构前进一步，形成“发现机会 → 提案 → 审批 → 执行”的真实治理闭环。

## 必须实现
1. 定义 **GovernanceProposal for Spawn** 的 canonical contract：
   - why spawn
   - target work / opportunity
   - required budget / reserve freeze
   - expected duration
   - expected utility / expected payoff
   - expected child role
   - governance risk
2. 系统检测到合适的复制机会时，不允许直接 spawn；必须先创建 proposal
3. proposal 必须可以被：
   - pending
   - approved
   - rejected
   - deferred / expired
4. 只有被批准后，才允许进入真实 child instantiation path
5. child outcome 必须至少有最小可追踪闭环：
   - created
   - running
   - completed / failed / recalled
   - budget used
   - result summary
6. 如果当前 collective / lineage / funding 已有骨架，尽量沿现有主路径深接，不新造旁路

## 验收标准
- replication 不再只是结构存在，而是有治理前置的真实执行入口
- child spawn 具备预算、目标与状态追踪边界

---

# G4. Lightweight Context Isolation / ChildSession / ToolInvocation

## 目标
把长期任务、子流、关键工具执行提升为轻量级 runtime primitives，而不是松散 async helper。

## 必须实现
1. 引入或收口 **SessionRegistry** / 类似统一容器
2. 把关键执行单元标准化为：
   - ChildSession
   - ToolInvocation
3. 每个 ChildSession 至少具备：
   - session id
   - manifest / role
   - isolated logger stream
   - scoped state / memory boundary
   - budget tracking
   - lifecycle status
4. 每个 ToolInvocation 至少具备：
   - invocation id
   - caller session / source
   - tool manifest
   - risk level
   - result envelope
   - audit trace
5. 尽量保持进程内轻量隔离，不进行大规模物理多进程/worker 重构
6. Dashboard / TUI / CLI 至少要能开始看到这些原语的存在与状态，而不只是底层对象

## 验收标准
- orchestration 吸收不是“换名字”，而是具备真实状态边界与可观测性
- 为未来更强隔离（若有）打下语义基础，但本轮不掉进重构陷阱

---

# G5. Governance Inbox + What-If Projection

## 目标
让 Truth → Action 真正形成高价值生命级闭环。

## 必须实现
1. API 层提供统一的 governance inbox 消费面，例如：
   - `GET /api/governance/inbox`
   - 必要时配合 detail/decision 路由
2. Dashboard 层新增或接入一个 **Governance Inbox** 视图
3. inbox 至少能统一汇集：
   - spawn proposals
   - budget-sensitive requests
   - blocked agenda items
   - governance-hold actions
4. 对于关键条目（至少 spawn proposal），必须支持 **What-If Projection**：
   - 批准后会冻结多少 reserve
   - 对 current agenda 有何影响
   - 是否影响 survival posture
   - 预期收益 / 预期回报窗口
5. 真正执行 Approve / Reject 前，必须保留 explainable decision context
6. 审批结果必须形成审计记录：
   - actor
   - decision
   - timestamp
   - projection snapshot / reason

## 验收标准
- operator 不再只是“看见问题”，而是能在治理控制面中作出生命级决策
- Web UI 不退化为只读板；审批动作具备解释性与审计性

---

## 三、本轮必须遵守的质量纪律

### D1. 全绿纪律不可破
本轮完成时，至少要保持：
- `packages/core` tests 全绿
- CLI TypeScript 通过
- Dashboard TypeScript 通过
- Dashboard build 通过

### D2. Contract 改动必须同步测试与消费者
严禁再出现：
- API / posture / agenda / governance contract 已变
- fixtures/tests/UI consumers 没跟上

### D3. 不能用 UI 漂亮掩盖主路径没接通
若本轮主要只是新增界面，但 runtime 主路径没形成闭环，则视为失败。

### D4. 轻量隔离不等于大重构
本轮目标是：
- 语义原语化
- 状态边界化
- auditability
- observability

不是：
- 全面 worker 化
- 大规模 process/IPC 重写

### D5. 复制仍是高风险动作
spawn proposal / budget freeze / child instantiation 必须置于治理与可审计边界内。

### D6. 真正的“完成”只能来自独立验证
任何“完成”都必须可被仓内代码、测试、构建、路由与控制面实际接线所复核。

---

## 四、本轮优先实现顺序（建议）

建议按以下顺序推进，以降低返工：

1. **先打 G1 + G2 的 runtime 主路径**
   - revenue admission
   - lifecycle tick/event
   - agenda arbiter
2. **再打 G3 的 spawn proposal contract**
   - proposal creation
   - governance state transitions
3. **再打 G4 的 ChildSession / ToolInvocation 原语化**
   - 用来承接 proposal 批准后的 child instantiation
4. **最后打 G5 的 Inbox + What-If UI/API 闭环**
   - 用控制面把 G3 显性化、可解释化
5. **最后统一补 tests / typecheck / build / docs 对账**

---

## 五、本轮必须回答的问题

### Q1. revenue opportunity 是否真正影响了 admission 与 scheduling？
### Q2. agenda 是否已进入 Tick/Event/Arbiter 的统一长期调度结构？
### Q3. spawn 是否已经从“可以想象”推进为“可审批、可执行、可追踪”？
### Q4. ChildSession / ToolInvocation 是否已经成为可观测 runtime primitive？
### Q5. Governance Inbox 是否已经把 truth→action 推进成可解释、可审计的审批流？
### Q6. 20.1 是否在继续提速的同时保持了全绿质量门槛？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. 至少一条 revenue-based admission path 成立
### V4. Tick + Event + AgendaArbiter 形成统一主路径
### V5. spawn proposal 具备 canonical contract 与状态流转
### V6. child instantiation 受 governance 批准控制
### V7. ChildSession / ToolInvocation 具备最小 runtime primitive 边界
### V8. Governance Inbox API/UI 可实际消费 proposal
### V9. 至少一个 What-If Projection 场景可工作
### V10. operator decision 具备审计记录

---

## 七、本轮非目标

本轮不做：
- 不做大规模物理隔离重构
- 不做脱离 runtime 的 UI cosmetic 扩张
- 不做宏大而无主路径接线的 collective 幻想层
- 不在未全绿时宣称 complete

本轮要做的是：

> **把 5 个已经定稿的终局关键机制，从“方向正确”推进到“主路径真实接通”。**

---

## 八、一句话任务定义

> **Round 20.1 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 Task-Based Revenue、Hybrid Life Cycle Agenda、Governance-Gated Replication、Lightweight Context Isolation、Governance Inbox + What-If Projection 五个终局关键机制真正接入 ConShell runtime 主路径，形成可运行、可审批、可解释、可审计的生命级控制闭环。**
