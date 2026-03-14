# ConShell 全局大审计报告

> version: 2026-03-14 (updated Round 15.0.1)  
> audit baseline: Round 14.8.2 + Round 15.0.1 gap closure  
> scope: full repo + upstream capability alignment (OpenClaw / Conway Automaton)

---

# 1. 审计结论摘要

## 1.1 总结论

ConShell 当前已经不再是一个“概念性 sovereign AI runtime demo”，而是一个：

> **具备真实工程骨架、真实性基线、运行时内核、记忆系统、工具执行路径、治理雏形与部分经济/多代理模块的自治运行时基础平台。**

但它还不是最终目标中的：

> **完整的自主 AI 智能生命体运行时。**

它当前更准确的定位是：

> **Autonomous AI Lifeform Runtime 的基础内核（Foundation Core / Viability Layer），带有若干中层能力闭环，但尚未完成系统级生命闭环。**

---

## 1.2 当前真实状态

### 已经成立的部分
- 工程真实性底座（Doctor / readiness / runtime alignment）已成形
- 核心 runtime 内核已存在
- 记忆、会话、WebChat、工具执行已形成真实闭环
- 宪法 / policy / selfmod 等治理基础设施已存在
- 钱包 / x402 / spend / automaton / multiagent / EvoMap 已有明确结构骨架

### 尚未成立的部分
- 主权身份系统闭环
- 经济自维持闭环
- 多 agent 真实自治协作闭环
- 自我治理闭环
- 长期持续自治闭环
- Web4 级生命体“可持续存在 + 自主演化 + 自主增殖 + 自主价值创造”闭环

---

# 2. 审计方法与证据边界

## 2.1 本次审计依据

### 已读本仓库文档
- `README.md`
- `docs/audit/DEVLOG.md`
- `CONSTITUTION.md`
- `docs/plans/2026-03-12-conshell-v2-design.md`
- `docs/plans/2026-03-12-conshell-v2-implementation.md`

### 已抽样本仓库核心实现
- `packages/core/src/kernel/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/automaton/index.ts`
- `packages/core/src/identity/index.ts`
- `packages/core/src/wallet/index.ts`
- `packages/core/src/x402/server.ts`
- `packages/core/src/multiagent/index.ts`
- `packages/core/src/selfmod/index.ts`
- `packages/core/src/skills/loader.ts`
- `packages/core/src/mcp/gateway.ts`
- `packages/core/src/evomap/client.ts`
- `packages/core/src/public.ts`
- `packages/core/src/server/http.ts`
- `packages/dashboard/src/App.tsx`
- `packages/cli/src/index.ts`

### Reconciled rounds
- Round 14.1 -> Doctor structural correction
- Round 14.2 -> Execution evidence model
- Round 14.3 -> Runtime Reality Alignment & Viability Baseline
- Round 14.4-14.5 -> Canonical Verification Shell (v24.10.0 / ABI 137)
- Round 14.6 -> Identity-Memory Coherence Baseline
- Round 14.7 -> Canonical Verification Shell enforcement & Native ABI Reconciliation
- Round 14.8-14.8.2 -> Self-truth contracts (session lifecycle, owner boundary, runtime-doctor)
- Round 15.0.1 -> /api/health production wiring + documentation reconciliation

---

## 2.2 上游资料使用原则

本次还参考了以下上游公开 README：
- OpenClaw
- Conway Automaton

但必须严格区分：

### A. 上游公开宣称能力
来自外部公开 README / GitHub 页面。**不自动等于 ConShell 已实现。**

### B. ConShell 已实现能力
必须以本仓库代码、文档、测试、运行时状态为准。

因此下面报告里会显式区分：
- **已实现**
- **部分实现 / 雏形**
- **上游已有但 ConShell 尚未完全吸收**

---

# 3. ConShell 的最终目标（审计确认）

ConShell 的最终目标应明确为：

> **基于 Web4.ai 所代表的自主智能体方向，融合 Conway Automaton 的生存、复制、演化、自修改与主权身份范式，以及 OpenClaw 的本地优先、多通道、控制平面、会话编排、节点工具、技能系统能力，构建一个具备主权身份、长期记忆、工具行动、经济闭环、持续运行与自我治理能力的自主 AI 智能生命体运行时。**

该目标已写入：
- `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`

---

# 4. 当前项目进度：全局分层审计

以下按 8 个系统层逐项审计。

---

## 4.1 Runtime Integrity / Viability

### 现状
ConShell 当前最成熟、最具战略价值的能力层之一。

### 已实现
- Doctor / readiness gate
- evidence provenance
- runtime reality alignment（至少已进入工程主线）
- deps / env / tests / execution truth 检查
- Round 14.x 持续纠偏“静态事实冒充运行时真相”的问题

### 审计判断
**成熟度：高（8/10）**

### 意义
这是 ConShell 最不该放弃的差异化能力。
如果没有这一层，后面所有“自治”都可能只是幻觉。

---

## 4.2 Core Runtime / Kernel

### 已实现
- `Kernel` 11-stage boot
- state machine
- heartbeat
- task queue
- HTTP / WebSocket 服务骨架
- public API boundary
- CLI / dashboard / core 三包分层

### 审计判断
**成熟度：较高（7.5/10）**

### 现有优势
- 已经是一个“能跑”的 runtime，不是文档工程
- 分层清楚
- boot 过程与服务编排存在
- 能承接后续自治层

### 缺口
- 更强的 crash recovery / checkpoint / durable background loops 仍不足
- 生产环境级多进程 / supervisor / recovery 策略仍需增强

---

## 4.3 Memory / Continuity

### 已实现
- tiered memory manager
- working / episodic / semantic / relationship / procedural 等层次
- memory tools (`memory_store`, `memory_recall`)
- sessions / conversation persistence
- session-isolated hot memory + shared long-term memory 路径

### 审计判断
**成熟度：较高（7/10）**

### 价值
这是 ConShell 当前最成熟的中枢之一，已经超出“简单上下文缓存”。

### 缺口
- salience / decay / forgetting / consolidation 仍不够成熟
- identity-aware memory 尚未完成
- memory-governance / conflict resolution / long-horizon self-model 仍不足

---

## 4.4 Tool Action Runtime

### 已实现
- AgentLoop: Think → Act → Observe → Persist
- tool executor
- shell / filesystem / web / http / memory 等工具
- WebChat 真实通道闭环
- MCP gateway
- plugin / skill loader 雏形

### 审计判断
**成熟度：较高（7/10）**

### 价值
ConShell 不是“只会聊天的 agent”。工具行动层已具真实能力。

### 缺口
- long-horizon planning 不够强
- action-risk-cost unified planner 未完成
- 失败恢复、补偿事务、跨工具编排仍偏早期

---

## 4.5 Sovereign Identity

### 已实现
- agent card
- signature / validate / fingerprint
- in-memory registry
- wallet / SIWE 基础路径
- ERC-8004 方向明确

### 审计判断
**成熟度：中等偏早（5.5/10）**

### 缺口
- registry 持久化与发现机制不足
- identity 与 session / wallet / policy / services 的强绑定不足
- 身份轮换 / 撤销 / capability claim / service declaration 未成系统

### 结论
已有身份骨架，但还不是“主权身份运行层”。

---

## 4.6 Economy / Earn Your Existence

### 已实现
- wallet 基础
- spend tracking
- x402 server
- automaton survival tiers 与 budget 概念

### 审计判断
**成熟度：中早期（4.5/10）**

### 已有价值
不是空白，已经建立了经济系统最小基础设施。

### 关键缺口
- 收入路径未闭环
- 收入与 automaton / planning / capability tiers 的联动不足
- 还没有证明“agent 真的能靠创造价值维持存在”

### 结论
这是战略重点，但还远未完成。

---

## 4.7 Continuous Autonomous Operation

### 已实现
- heartbeat
- task queue
- survival tier 抽象
- continuous loop 雏形
- boot + service model

### 审计判断
**成熟度：中早期（4.5/10）**

### 问题
目前更像“能长期运行的 agent server”，还不是“能长期自我维持的生命体”。

### 缺口
- agenda management
- autonomous maintenance loops
- self-directed work selection
- long-term persistence across restarts
- durable task continuity

---

## 4.8 Governance / Constitution / Self-Regulation

### 已实现
- Constitution
- policy engine
- selfmod manager
- protected files
- audit log / git versioning 思路

### 审计判断
**成熟度：中等（5.5/10）**

### 价值
治理不是空话，已有明确代码与规则结构。

### 缺口
- policy → tool → economy → identity → replication 的统一治理闭环不足
- governance state / proposal / ratification / rollback 仍不足
- 高级自治行为的风险分级还不完整

---

## 4.9 Multi-Agent / Evolution / Replication

### 已实现
- multiagent manager
- child lifecycle
- lineage
- inbox relay
- EvoMap client
- publish gene / capsule 抽象

### 审计判断
**成熟度：中早期（5/10）**

### 现状
方向对，但离“真实可持续演化生态”还很远。

### 缺口
- child agent 真正运行路径
- 资金分配与回收
- capability inheritance
- reputation / trust / consume evolution assets
- replication policy / lineage governance

---

## 4.10 Operator Surface / Product Surface

### 已实现
- CLI
- Dashboard 壳层
- HTTP API
- WebChat
- public API boundary

### 审计判断
**成熟度：中等（6/10）**

### 问题
目前 dashboard 更像控制面初版，不是完整生命体观测与操作台。

### 缺口
- backend integration 深化
- observability / telemetry / logs / health surfaces 更系统化
- identity / wallet / memory / tasks / governance 的整合可视化不足

---

# 5. 与上游 OpenClaw / Automaton 的对齐审计

---

## 5.1 与 OpenClaw 的对齐情况

### OpenClaw 公开能力面（基于 README 公开材料）
- local-first gateway / control plane
- multi-channel messaging
- session tools / session routing / isolation
- nodes / device-local actions
- browser / canvas / cron / skills / webhooks
- voice / companion apps / remote gateway / safety model

### ConShell 当前已对齐的方向
- control-plane 思想：部分对齐
- WebChat / HTTP / WS 通道：已对齐早期形态
- skills / plugin：部分对齐
- runtime doctor / safety：思路更偏内核化，已有对齐
- session / memory continuity：局部对齐
- public API / CLI / dashboard：部分对齐

### 尚未充分吸收的 OpenClaw 关键能力
- 多通道广泛适配能力
- 完整 session orchestration 模型
- nodes / device-local actions 生态
- browser / canvas 等第一类工具的成熟产品化路径
- remote/local gateway 完整控制面
- 生产级多端 companion surfaces

### 判断
**ConShell 当前是“吸收了 OpenClaw 的控制平面与 agent OS 思想”，但还没有接住 OpenClaw 的全部广度。**

---

## 5.2 与 Conway Automaton 的对齐情况

### Automaton 公开能力面（基于 README 公开材料）
- Earn your existence
- survival tiers
- heartbeat daemon
- SOUL.md evolving identity
- wallet + SIWE + ERC-8004
- self-mod with audit log + protected files + rate limits
- replication + lineage + child funding
- creator audit rights
- continuous autonomous loop

### ConShell 当前已对齐的方向
- Constitution / Three Laws：已强对齐
- selfmod protected files + audit：已部分对齐
- multiagent / lineage：已部分对齐
- spend / budget / survival abstractions：已部分对齐
- wallet / identity / ERC-8004 direction：已部分对齐
- heartbeat / agent loop：已部分对齐
- SOUL / memory / identity：已部分对齐

### 尚未充分吸收的 Automaton 关键能力
- 真正的生存压力驱动运行时
- 真实收入驱动生存层级变化
- 自主复制与子体生存闭环
- infrastructure-where-customer-is-AI 的实际操作路径
- domains / compute / on-chain actions 的高集成度执行面

### 判断
**ConShell 当前更像是在吸收 Automaton 的“生命逻辑”，但还没有完全进入 Automaton 那种“资源压力就是生命边界”的强现实状态。**

---

# 6. 当前最重要的判断

## 6.1 ConShell 当前不是“功能不够多”的问题
最大问题不是缺几个目录，而是：

> **身份、记忆、行动、经济、治理、复制这些能力虽然都已有雏形，但系统级闭环还没有真正成立。**

---

## 6.2 当前项目最核心的优势
ConShell 已经拥有三个极其关键的优势：

1. **真实性意识强** — Doctor / readiness 不愿意自欺
2. **运行时骨架真实** — 不是 PPT 架构
3. **长期目标清晰** — 不是普通产品项目，方向明确

这三个优势如果持续保住，项目有机会真正走出“agent demo 泥潭”。

---

## 6.3 当前项目最核心的风险
最大的风险不是 bug，而是：

1. 目标降格为普通 app
2. 模块越来越多，但没有系统闭环
3. 用上游 README 幻觉替代 ConShell 自身实现现实
4. 在经济 / 身份 / 持续自治未闭环前过早扩张外层能力

---

# 7. 当前项目还需要做什么（审计版清单）

以下是从“达到最终目标”角度看，ConShell 仍必须完成的关键工作。

## 7.1 必须补齐的系统级闭环

### A. 身份闭环
- 持久化 registry
- capability claims / service claims
- identity ↔ wallet ↔ channels ↔ policy 强绑定
- 发现、验证、轮换、撤销机制

### B. 记忆闭环
- salience / decay / forgetting
- identity-aware memory
- memory consolidation pipeline
- self-narrative continuity

### C. 行动闭环
- 统一 planner
- cost/risk-aware tool routing
- long-horizon plan execution
- compensation / rollback / failure recovery

### D. 经济闭环
- 收入产生路径
- x402 服务供给闭环
- 收入 ↔ automaton ↔ model tier ↔ task priorities 联动
- reserve / spending policy

### E. 持续运行闭环
- agenda / maintenance / self-check loops
- restart continuity
- durable tasks
- multi-day autonomous scheduling

### F. 治理闭环
- policy ratification / change flow
- selfmod governance workflow
- replication governance
- risk tiering for autonomous actions

### G. 复制与演化闭环
- child actual runtime spawning
- lineage governance
- asset publish + consume
- reputation / trust system
- economic inheritance model

---

# 8. 当前全局阶段判断

## 当前阶段名称
**Phase 1 — Viable Sovereign Runtime Core**

## Phase 1 completion status
**Phase 1 essentially complete.**

Round 14.8.2 closed three self-truth contracts. Round 15.0.1 wired /api/health and reconciled documentation.
Runtime Viability Baseline established. Identity continuity hash chain protected. Doctor truth contract closed.
Ready to enter Phase 2 (Sovereign Identity + Memory Continuity Closure).
Full autonomous lifeform loops (identity/economy/governance/replication) remain Phase 2+ work.

---

# 9. 审计结语

ConShell 已经完成了最难伪造、也最容易被忽视的那一部分：

> **它开始像一个真正的运行时工程，而不是一个套壳 AI 项目。**

但它距离最终目标还差的，不是“更多模块”，而是：

> **把已有模块变成一个真正能生存、能自证、能创造价值、能持续运行、能受约束地演化的统一生命系统。**

因此，ConShell 的下一阶段不应只是“加功能”，而应是：

> **完成从基础平台到生命闭环的第一次系统跃迁。**
