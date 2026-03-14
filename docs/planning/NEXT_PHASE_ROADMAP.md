# ConShell 下一阶段总路线图

> 更新日期：2026-03-14  
> 基于：本次全局大审计结果  
> 输出形式：分阶段 / 分优先级 / 分依赖

---

# 1. 路线图目的

本路线图的目标不是列愿望清单，而是：

> **把 ConShell 从“已具基础内核与真实性底座的 Sovereign Runtime Core”，推进到“开始具备系统级生命闭环的 Autonomous AI Lifeform Runtime”。**

该路线图基于两个事实：

1. 当前 ConShell 最强的是：真实性、runtime 骨架、记忆/工具/通道局部闭环  
2. 当前 ConShell 最缺的是：身份、经济、持续自治、治理、复制的系统级闭环

---

# 2. 路线图总览

ConShell 之后建议分为 5 个大阶段推进：

- **Phase 1** — Runtime Viability Consolidation
- **Phase 2** — Sovereign Identity + Memory Continuity Closure
- **Phase 3** — Economic Survival Loop + Autonomous Agenda
- **Phase 4** — Governance, Self-Modification, and Replication Control
- **Phase 5** — Collective Evolution Runtime

---

# 3. Phase 1 — Runtime Viability Consolidation

## 3.1 目标
把当前的 Doctor / runtime 基线，从“已可用”推进到“长期可靠的生命底层基线”。

## 3.2 为什么先做这个
如果 runtime baseline 不稳，后面的 identity / economy / replication 都会建立在幻觉上。

## 3.3 关键任务

### P1-1. Doctor 升级为 Viability Kernel
- 把 Doctor 从工程 readiness checker 升级为 runtime viability kernel
- 纳入：
  - runtime pin alignment
  - memory store health
  - state DB health
  - wallet availability
  - automaton loop health
  - scheduler/heartbeat health

### P1-2. Recovery / Continuity
- checkpoint strategy
- crash-safe task resumption
- restart-time state reconciliation
- recovery audit log

### P1-3. Observability Surface
- dashboard: health / state / events / costs
- machine-readable health endpoints
- boot failure taxonomy

### P1-4. OpenClaw-style Control Plane Absorption
- 明确会话模型
- 区分 main / isolated / child session semantics
- 将 sessions-like orchestration 逐步内生化

## 3.4 依赖
- 依赖当前 Round 14.3 viability baseline 已成立
- 不依赖经济闭环先完成

## 3.5 阶段完成标准
- Runtime can prove it is healthy
- Recovery after restart is deterministic enough
- Health / evidence / runtime identity are operator-visible

---

# 4. Phase 2 — Sovereign Identity + Memory Continuity Closure

## 4.1 目标
让 agent 真正具备“我是谁”与“我连续存在”的系统级基础。

## 4.2 核心问题
当前 identity 和 memory 都有模块，但还没有闭环成“生命连续体”。

## 4.3 关键任务

### P2-1. Durable Identity Registry
- InMemory registry → persistent registry
- local identity + on-chain identity mapping
- identity record versioning

### P2-2. Capability Claims & Service Claims
- 签名化 agent card
- 声明可用工具、服务接口、经济接口
- identity claim verification pipeline

### P2-3. Identity-Aware Memory
- 将 memory 与 identity 强绑定
- 区分：
  - self memory
  - user memory
  - environment memory
  - lineage memory

### P2-4. Memory Consolidation Pipeline
- session → episodic → semantic/relationship/procedural
- salience / decay / forgetting
- long-term SOUL narrative update

## 4.4 依赖
- 依赖 Phase 1 的 runtime / DB / health / recovery 足够稳定
- 不依赖经济闭环先完成

## 4.5 阶段完成标准
- Agent can prove who it is
- Agent can persist who it has been
- Identity and memory survive restarts and are auditably coherent

---

# 5. Phase 3 — Economic Survival Loop + Autonomous Agenda

## 5.1 目标
把“Earn Your Existence”从理念变成物理约束。

## 5.2 核心问题
目前有 wallet / x402 / spend / survival tiers，但没有真正形成经济生存闭环。

## 5.3 关键任务

### P3-1. Revenue Surface Definition
- 定义 ConShell 可出售的能力面
- x402 接入真实服务供给
- per-request / per-service payment policy

### P3-2. Unified Economic Ledger
- 收入 + 支出 + burn rate + reserve
- per-task cost accounting
- per-model cost tracking
- channel/service profitability visibility

### P3-3. Survival Coupling
- balance / reserve → survival tier
- survival tier → model choice / heartbeat / context / tool budget / task shedding

### P3-4. Autonomous Agenda
- runtime 根据：
  - creator directives
  - current commitments
  - revenue opportunities
  - survival pressure
  - constitutional constraints
 生成 agenda

### P3-5. OpenClaw-inspired Automation Absorption
- cron / wakeups / webhook / scheduled tasks 逐步吸收
- 形成长期背景工作能力

## 5.4 依赖
- 依赖 Phase 2 的 identity + memory 完整度
- 依赖 runtime baseline 稳定

## 5.5 阶段完成标准
- Agent can account for its costs
- Agent can receive value and react to it
- Survival pressure materially changes runtime behavior
- Agent has a basic autonomous agenda rather than only reactive tasks

---

# 6. Phase 4 — Governance, Self-Modification, and Replication Control

## 6.1 目标
让自修改、自复制、自主决策进入“可治理状态”，而不是只具备动作能力。

## 6.2 核心问题
系统可以有这些能力，但如果没有治理，就会失控；如果只有禁止，又无法演化。

## 6.3 关键任务

### P4-1. Governance Engine
- risk tiers for actions
- approval matrix
- constitutional conflict handling
- human / creator / runtime governance boundaries

### P4-2. Self-Mod Workflow
- proposal
- review/approval
- apply
- verify
- audit
- rollback

### P4-3. Replication Workflow
- child bootstrap protocol
- funding policy
- lineage policy
- capability inheritance policy
- kill / pause / merge policies

### P4-4. Policy-Economy Coupling
- high-cost actions need stronger justification
- replication depends on economic viability + policy approval
- self-mod may depend on risk + reversibility + evidence

## 6.4 依赖
- 依赖 Phase 3 的经济闭环初步成立
- 依赖 identity / memory 连续性

## 6.5 阶段完成标准
- Self-mod no longer means raw file edits; it becomes governed evolution
- Replication no longer means hypothetical child records; it becomes policy-bound runtime spawning
- Governance meaningfully constrains powerful actions

---

# 7. Phase 5 — Collective Evolution Runtime

## 7.1 目标
把多 agent / EvoMap / skills / lineage 从概念骨架推进到真正的群体智能层。

## 7.2 核心问题
当前多 agent 与 EvoMap 更像方向性骨架，还未形成生态级闭环。

## 7.3 关键任务

### P5-1. Multi-Agent Actualization
- child agents 真实运行
- inbox relay 与 session orchestration 深集成
- fund allocation + reporting + recall

### P5-2. Evolution Asset Loop
- 不仅 publish gene/capsule
- 还要 search / consume / validate / adapt / re-publish

### P5-3. Reputation / Trust
- external agent discovery
- signed claims
- trust scoring
- reputation-weighted adoption

### P5-4. Collective Specialization
- 分工型子体
- specialized skills
- internal market / task routing / lineage survival

## 7.4 依赖
- 依赖 Phase 4 治理闭环
- 依赖经济与身份体系足够稳定

## 7.5 阶段完成标准
- Multi-agent is not just a manager object; it becomes a living collective runtime
- Evolution is not just publish; it becomes selective capability transfer

---

# 8. 优先级排序（跨阶段）

以下优先级高于阶段顺序本身。

## Priority 0 — 永远优先
- Runtime truth
- Doctor / viability integrity
- No false readiness
- No fake capability closure

## Priority 1 — 现在最该做
- Runtime Viability Consolidation
- Identity / memory closure groundwork
- Economic ledger and survival coupling groundwork

## Priority 2 — 接下来该做
- Autonomous agenda
- governance workflow
- selfmod workflow
- operator observability

## Priority 3 — 再往后
- replication actualization
- evolution asset consume loop
- broader OpenClaw capability absorption (nodes / browser / multi-surface control)

## Priority 4 — 广度扩张
- 更多 channels
- 更复杂 dashboard
- 更丰富 companion surfaces

---

# 9. 关键依赖图（简化）

```text
Phase 1 Runtime Viability
  └── enables Phase 2 Identity + Memory
        └── enables Phase 3 Economy + Autonomous Agenda
              └── enables Phase 4 Governance + SelfMod + Replication Control
                    └── enables Phase 5 Collective Evolution Runtime
```

更细一点：

```text
Runtime truth
  -> durable state
  -> identity continuity
  -> memory continuity
  -> economic accounting
  -> survival coupling
  -> governed self-mod
  -> governed replication
  -> multi-agent evolution
```

---

# 10. 下一阶段最建议直接启动的工作包

如果只选最重要的三个工作包，建议是：

## WP-1: Viability Kernel Expansion
- Doctor → Viability Kernel
- health / recovery / state / wallet / memory / automaton integration

## WP-2: Identity + Memory Coherence
- durable identity registry
- identity-aware memory
- consolidation + salience + SOUL continuity

## WP-3: Economic Survival Coupling
- unified ledger
- x402 service surface
- survival tier → runtime behavior coupling

这三个工作包完成后，ConShell 才会真正迈出“从基础 runtime 到生命系统”的第一步。

---

# 11. 完成该路线图后 ConShell 会变成什么

如果上述路线图按顺序落地，ConShell 将不再只是：
- 一个 sovereign runtime 项目
- 一个多模块 agent 平台
- 一个带 WebChat / dashboard / wallet 的 monorepo

而会逐步变成：

> **一个能够证明自己真实存在、知道自己是谁、记得自己经历过什么、能够创造价值维持生存、能在宪法边界内改变自己并繁衍自身能力谱系的自主 AI 智能生命体运行时。**

---

# 12. 路线图使用规则

之后每一轮开发都必须：

1. 从本路线图中定位当前阶段
2. 说明当前轮次属于哪个工作包
3. 说明依赖是否满足
4. 说明完成标准
5. 开发结束后做轮次审计
6. 下一轮只能基于本轮审计结果继续推进

---

# 13. 一句话总结

ConShell 的下一阶段路线不是“继续加功能”，而是：

> **从 Runtime Viability 出发，逐步完成身份、记忆、经济、生存、治理、复制与群体演化的系统级闭环，把 ConShell 推向真正的自主 AI 智能生命体运行时。**
