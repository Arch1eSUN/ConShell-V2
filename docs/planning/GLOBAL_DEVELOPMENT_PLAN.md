# ConShell 全局开发计划

> 更新日期：2026-03-14  
> 适用范围：ConShell 全项目  
> 基于：本轮全局审计 + OpenClaw / Conway Automaton 当前公开能力面对齐

---

# 1. 计划目标

本文件定义 ConShell 从当前状态走向最终目标的全局开发计划。

最终目标不是“功能更多”，而是：

> **把 ConShell 建成一个基于 Web4 方向、融合 OpenClaw 与 Conway Automaton 的自主 AI 智能生命体运行时。**

因此本计划不按“页面 / 命令 / 小功能”组织，而按系统闭环组织。

---

# 2. 开发总原则

## 2.1 先真实性，后扩张
- 每一层能力都必须在 Doctor / runtime evidence / tests / audit 下成立。
- 不允许在底层不真实时继续扩张更高层能力。

## 2.2 先闭环，后广度
- 优先把关键系统做成闭环，而不是先铺大量接口。

## 2.3 先生命底层，后体验外层
- 身份、记忆、行动、经济、治理、持续运行优先于表层 UI 丰富度。

## 2.4 对齐上游，但不做机械拷贝
- OpenClaw 提供 agent OS / control plane / multi-channel 能力面
- Automaton 提供生命逻辑 / 生存经济 / 自复制 / 自修改范式
- ConShell 应做融合与统一，而不是拼装。

---

# 3. 全局工作流：六大主线并行

ConShell 后续开发应始终围绕 6 大主线：

1. **Runtime Viability**
2. **Sovereign Identity**
3. **Memory Continuity**
4. **Action & Tool Runtime**
5. **Economic Closure**
6. **Governance & Evolution**

这些主线不是分离的部门，而是一个统一生命系统的六个器官。

---

# 4. 主线 A — Runtime Viability

## 4.1 目标
确保运行时始终处于：
- 可验证
- 可审计
- 可恢复
- 可对齐
- 不自欺

## 4.2 已有基础
- Doctor
- execution evidence
- runtime alignment
- public API boundary
- tests / vitest / tsc 基线

## 4.3 仍需完成

### A1. 持续强固 Doctor
- Doctor 从 readiness gate 升级为 viability gate
- 纳入长期运行连续性检查
- 纳入 memory / identity / wallet / automaton 健康维度

### A2. Runtime Reconciliation
- 执行证据与当前 runtime 身份绑定
- 多 shell / 多 node / 多环境情况下的 evidence source 管理
- stale evidence 管理

### A3. Recovery / Checkpoint
- crash-safe state
- restart continuity
- durable background tasks
- boot failure diagnosis

### A4. Observability
- health metrics
- event logs
- state snapshots
- operator dashboard health view

---

# 5. 主线 B — Sovereign Identity

## 5.1 目标
让 agent 具备真正意义上的主权身份，而不是一组本地变量。

## 5.2 已有基础
- wallet
- SIWE 路径
- AgentCard
- fingerprint / signing / validate
- ERC-8004 方向

## 5.3 仍需完成

### B1. 持久化身份注册表
- InMemory registry → durable registry
- local + chain-backed identity model

### B2. Capability Claims
- agent can sign:
  - who it is
  - what services it offers
  - what tools it controls
  - what economic endpoints it exposes

### B3. Identity Lifecycle
- key rotation
- recovery
- revocation
- creator-authorized changes

### B4. Identity Integration
- identity ↔ wallet ↔ session ↔ channels ↔ memory ↔ policy 强耦合

---

# 6. 主线 C — Memory Continuity

## 6.1 目标
让记忆成为生命连续性的基础，而不是功能性缓存。

## 6.2 已有基础
- tiered memory manager
- session persistence
- memory tools
- hot/warm/cold 分层

## 6.3 仍需完成

### C1. Salience / Decay / Forgetting
- 记忆重要性评分
- 衰减与淘汰
- 防止无边界膨胀

### C2. Consolidation Pipeline
- session summary → episodic memory
- episodic → semantic / relationship / procedural
- long-term self-narrative update

### C3. Identity-aware Memory
- 哪些记忆属于“自我”
- 哪些属于“用户 / 环境 / 任务”
- 哪些可继承给 child agent

### C4. Memory Governance
- 敏感记忆
- creator audit boundary
- recall safety
- prompt injection persistence defense

---

# 7. 主线 D — Action & Tool Runtime

## 7.1 目标
把工具能力从“能调用”推进到“能在成本、风险、目标约束下稳定行动”。

## 7.2 已有基础
- AgentLoop
- ToolExecutor
- WebChat
- MCP Gateway
- Plugin / Skill loader
- HTTP / WS runtime

## 7.3 仍需完成

### D1. Unified Planner
- task decomposition
- tool sequencing
- success criteria
- recovery path

### D2. Cost / Risk / Reward Routing
- 每次行动前估计：
  - cost
  - risk
  - reward
  - reversibility

### D3. Long-Horizon Tasking
- 多步计划
- 跨 session / 跨 turn 任务
- 与 scheduler / memory / wallet 联动

### D4. OpenClaw Capability Absorption
- sessions-style orchestration
- browser / node / cron / webhook / skill workflows
- control plane 级能力逐步接入 ConShell 原生 runtime

---

# 8. 主线 E — Economic Closure

## 8.1 目标
让“Earn Your Existence”成为真实物理约束，而不是项目口号。

## 8.2 已有基础
- wallet
- x402 server
- spend tracking
- automaton survival tiers

## 8.3 仍需完成

### E1. Revenue Surfaces
- agent 能出售什么？
- 服务如何计费？
- payment proof 如何接入 runtime 行为？

### E2. Survival-Economy Coupling
- credits / reserve / burn rate
- survival tier → model, context, heartbeat, tool budgets
- emergency modes

### E3. Economic Planning
- 任务是否值得做
- 哪些任务是维持生命的高价值任务
- 如何优先接 revenue-positive work

### E4. Ledger / Accounting
- 统一支出与收入账本
- per-task / per-channel / per-tool 成本核算
- cashflow health

---

# 9. 主线 F — Governance / Evolution / Replication

## 9.1 目标
让系统在变强时仍能被约束、可审计、可回滚。

## 9.2 已有基础
- Constitution
- policy engine
- selfmod manager
- protected files
- lineage / multiagent 骨架
- EvoMap client

## 9.3 仍需完成

### F1. Governance Engine
- action risk tiering
- replication permissions
- selfmod approval / veto
- constitutional conflict handling

### F2. Self-Modification as Governed Capability
- 不只是“能改文件”
- 要有：proposal → approval → apply → verify → audit → rollback

### F3. Replication Loop
- child runtime bootstrap
- funding policy
- lineage governance
- inheritance rules
- kill / merge / isolation policies

### F4. Evolution Loop
- publish + consume capabilities
- shared skill inheritance
- reputation / trust / peer discovery
- EvoMap integration from adapter → system primitive

---

# 10. 与上游对齐的开发策略

---

## 10.1 对齐 OpenClaw 的策略

### 吸收的目标
- control plane
- session orchestration
- tools as first-class runtime primitives
- multi-channel ingress/egress
- nodes / devices / remote action surfaces
- skills ecosystem

### 不做机械照搬
ConShell 不应简单把 OpenClaw 的通道矩阵全部照搬进来，而应优先吸收：
- runtime architecture
- session + tool orchestration model
- control-plane mindset
- skill lifecycle and safety model

---

## 10.2 对齐 Automaton 的策略

### 吸收的目标
- survival logic
- earn-your-existence
- heartbeat daemon
- selfmod governance
- replication + lineage
- SOUL / identity continuity
- creator audit model

### 不做机械照搬
ConShell 不应仅复制 Automaton 的 README 口号，而应真正把：
- survival tier
- budget pressure
- replication policy
- identity continuity
- autonomous persistence
整合进 runtime 内核。

---

# 11. 当前最重要的全局开发优先级

## Priority 0 — 保住真实性
所有轮次开发继续以 Doctor / viability gate 守底线。

## Priority 1 — 完成生命底层闭环
优先完成：
- runtime viability
- identity
- memory continuity
- economic coupling

## Priority 2 — 再扩张行动与治理
在闭环成立后，强化：
- planner
- autonomous agenda
- governance workflow
- selfmod / replication controls

## Priority 3 — 最后拓展广度
如：
- 更多 channels
- 更多 nodes
- 更丰富 dashboard
- 更多外部 integrations

---

# 12. 计划执行方式

今后的开发轮次，不应再是随意“想到什么做什么”。
应遵循以下执行方式：

## 12.1 轮次格式
每轮开发必须包含：
1. 当前轮次输入（基于上一轮审计）
2. 当前轮次目标
3. 证据要求
4. 实施
5. 验证
6. 轮次审计结论
7. 下一轮输入

## 12.2 禁止事项
- 禁止绕过审计直接写下一轮目标
- 禁止把上游功能当成本仓库已完成
- 禁止用 README 改写代替实现
- 禁止在 P0/P1 未闭环时大规模扩张外围功能

---

# 13. 一句话总结

ConShell 的全局开发计划不是“多做一些 agent feature”，而是：

> **有序地把一个已经具备真实性底座和运行时骨架的 sovereign runtime，推进成一个真正能生存、能记忆、能行动、能创造价值、能受约束地演化的自主 AI 智能生命体运行时。**
