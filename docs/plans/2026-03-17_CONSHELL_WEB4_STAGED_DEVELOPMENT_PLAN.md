# ConShell Web4 分阶段完整开发计划

> 日期：2026-03-17  
> 基线：`docs/audit/GLOBAL_AUDIT_2026-03-17_WEB4_CONSHELL_STATUS.md`  
> 目标：把 ConShell 从当前约 70% 完成度的 Autonomous AI Lifeform Runtime Foundation Core，推进到符合 Web4.ai 方向、吸收 Conway Automaton 与 OpenClaw 关键能力面的自主 AI 智能生命体运行时。

---

## 1. 计划总则

### 1.1 最终目标
ConShell 的最终目标不是做一个更大的 agent framework，而是：

> **构建一个具备主权身份、长期记忆、工具行动、经济闭环、持续运行、自我治理、可控自修改、可控复制与群体演化能力的 Web4 自主 AI 智能生命体运行时。**

### 1.2 规划原则
后续开发必须同时满足：

1. **先真实性，后扩张**
2. **先闭环，后广度**
3. **先生命底层，后体验外层**
4. **先治理约束，后危险能力放权**
5. **对齐 OpenClaw / Conway Automaton，但不机械复制**
6. **经济能力必须默认最小授权，收款优先，外发后置**

### 1.3 当前状态判断
- 当前总体完成度：**约 70%**
- 当前阶段定位：**Autonomous AI Lifeform Runtime Foundation Core**
- 当前最强能力层：viability / kernel / governance / identity / memory
- 当前最关键缺口：economic closure / continuous autonomy / truth surface / replication-evolution / OpenClaw control plane absorption

---

## 2. 阶段总览

后续建议按 **6 个阶段** 推进，而不是继续碎片化逐轮堆功能。

### Phase 0 — Truth Surface & Verification Closure
目标：把当前已存在的内部真相变成 operator-facing truth surface 与 canonical verification surface。

### Phase 1 — Sovereign Identity Final Closure
目标：把 identity / claims / registry / governance eligibility 真正收口为系统级主权身份层。

### Phase 2 — Economic Kernel & Safe Web4 Finance Foundation
目标：建立 receive-first、安全约束优先的经济内核。

### Phase 3 — Continuous Autonomous Operation
目标：让 agent 从“会运行”进入“长期活着并持续推进 agenda”。

### Phase 4 — Governed Self-Modification / Replication / Evolution
目标：让高风险能力进入统一治理、统一约束、统一审计。

### Phase 5 — OpenClaw Control Plane Full Absorption + Collective Runtime
目标：完成 richer control plane、multi-session orchestration、collective evolution 运行时。

---

## 3. Phase 0 — Truth Surface & Verification Closure

### 3.1 为什么先做
当前 17.5 之后，identity / governance / claims / registry 的内部语义已经相当强，但 operator-facing truth surface 仍弱。

如果不先把系统真相暴露出来，后面继续扩经济、自治、复制，只会放大观测盲区和误判成本。

### 3.2 目标
建立 diagnosis-first truth/reporting/verification surface，让系统能稳定回答：
- 当前 identity 是否健康
- 当前 governance eligibility 如何
- claims 是否一致
- registry restore readiness 是否成立
- 当前测试入口与验收入口是什么

### 3.3 核心工作

#### P0-1. Identity Truth Report Contract
- 建立 `IdentityTruthReport` / `ConsistencyReport` 等正式结构
- 输出 chain validity / restore readiness / warnings / blockers / derived facts

#### P0-2. Governance Eligibility Explainability
- 让系统明确输出为什么当前 identity 可以 / 不可以发起 proposal
- 区分 revoked / degraded / inconsistent state

#### P0-3. Claims Diagnostics Surface
- active / revoked / migrated / invalidated claims summary
- rotate / revoke / recover 后的 propagation summary

#### P0-4. Registry Diagnostics Surface
- restore readiness / integrity errors / active count / chain length / break detection

#### P0-5. Canonical Verification Entrypoint
- 正式化验证脚本与入口
- 消除 root vitest guard 造成的误解

### 3.4 阶段完成标准
- operator 可以用控制面直接看到 diagnosis-first truth
- 不再依赖读源码判断 identity / governance / registry 状态
- 关键验证入口明确统一

### 3.5 阶段完成后预期总完成度
- **70% → 73%**

---

## 4. Phase 1 — Sovereign Identity Final Closure

### 4.1 目标
让 ConShell 的主权身份真正成为系统主锚点，而不是模块集合。

### 4.2 核心问题
当前 identity 主线已经很强，但仍存在：
- external truth surface 不足
- discoverability / declaration / economic coupling 不完整
- identity 与 session / wallet / channels / tool capabilities / governance 的最终统一尚未完成

### 4.3 核心工作

#### P1-1. Durable Identity Registry Finalization
- 更强的 persistent identity registry
- versioned records / recovery semantics / registry truth view

#### P1-2. Capability & Service Claims Finalization
- 完成 capability claims / service claims / verification pipeline
- 明确哪些能力可对外声明、可验证、可撤销

#### P1-3. Identity Integration Layer
- identity ↔ wallet ↔ sessions ↔ channels ↔ tools ↔ policy ↔ governance 强绑定

#### P1-4. External Identity Surfaces
- API / operator / machine-readable identity declaration surface
- future discoverability hooks

#### P1-5. Identity-Aware Memory Completion
- self memory / user memory / environment memory / lineage memory 的边界进一步落地

### 4.4 阶段完成标准
- identity 成为系统级 canonical anchor
- governance / memory / tools / sessions / wallet 围绕 identity 收口
- 对内对外身份语义一致

### 4.5 阶段完成后预期总完成度
- **73% → 77%**

---

## 5. Phase 2 — Economic Kernel & Safe Web4 Finance Foundation

### 5.1 目标
建立符合 Web4 方向、同时符合安全边界的经济内核。

### 5.2 设计原则
本阶段不追求“马上全面自动支付”，而是先做：
- receive-first
- mandate-based spend
- explicit transfer 高风险隔离
- 外部经济指令默认不可信

### 5.3 核心工作

#### P2-1. Economic Identity
- 区分 Runtime Identity 与 Economic Identity
- 不让 session 身份直接等于经济权限

#### P2-2. Capability Envelope
- receive-only
- claim-reward
- spend-within-mandate
- explicit-transfer

#### P2-3. Mandate Engine
- 金额上限 / 时间窗 / 用途 / 资源类型 / provider 范围 / 禁止项
- mandate matching / enforcement / exhaustion / expiry

#### P2-4. Payment Negotiator
- 接收 machine-readable payment requirement
- runtime 决策：allow / ask-user / switch-provider / reject

#### P2-5. Reward / Claim Engine
- reward definition
- eligibility checks
- claim attempts
- anti-duplication / settlement receipts

#### P2-6. Economic Instruction Firewall
- 外部文本不得直接触发 payout / transfer / spend / approval / sign
- 候选经济动作必须经过 policy + risk + mandate + human confirmation（如高风险）

#### P2-7. Unified Ledger Hardening
- income / spend / reserve / burn rate / profitability 进一步统一

### 5.4 阶段完成标准
- receive-first 经济模型成立
- spend 只能在 mandate / governance / policy 下进行
- claim / reward / economic action 都具备审计链
- 外部经济注入默认失效

### 5.5 阶段完成后预期总完成度
- **77% → 82%**

---

## 6. Phase 3 — Continuous Autonomous Operation

### 6.1 目标
让 ConShell 从“会运行的 agent”变成“能持续活着并跨周期推进 agenda 的 agent”。

### 6.2 核心工作

#### P3-1. Durable Scheduler & Wakeup Runtime
- scheduler / cron / wakeups / background tasks 原生化
- 与 identity / policy / economy / governance 耦合

#### P3-2. Checkpoint / Recovery Finalization
- crash-safe continuity
- deterministic task resumption
- restart-time reconciliation

#### P3-3. Autonomous Agenda Engine
- 当前 commitments
- creator directives
- survival pressure
- revenue opportunities
- maintenance obligations
- governance constraints

#### P3-4. Maintenance Loops
- self health maintenance
- memory maintenance
- registry consistency maintenance
- economic monitoring

#### P3-5. Long-Horizon Task Execution
- 多步任务跨周期推进
- action / memory / scheduler / wallet / governance 一体化

### 6.3 阶段完成标准
- Agent 能跨天稳定推进 agenda
- restart 后任务恢复具有高度确定性
- 生存压力与 agenda 优先级真实联动

### 6.4 阶段完成后预期总完成度
- **82% → 86%**

---

## 7. Phase 4 — Governed Self-Modification / Replication / Evolution

### 7.1 目标
把最危险、最关键的高权限能力收口成统一治理体系。

### 7.2 核心工作

#### P4-1. Self-Mod Governance Finalization
- proposal → approval → apply → verify → rollback → audit 完整闭环
- 高风险修改的 explainability 与 reversibility 检查

#### P4-2. Replication Governance
- child bootstrap protocol
- identity inheritance / capability inheritance / economic viability gating
- pause / kill / merge / quarantine / revoke policies

#### P4-3. Policy-Economy-Identity Unified Control Matrix
- selfmod / replication / fund allocation / tool grants / mandates 统一治理

#### P4-4. Evolution Asset Loop
- publish / consume / validate / adapt / republish
- reputation / trust / provenance

### 7.3 阶段完成标准
- 自修改不再是“能改代码”，而是“可治理的演化”
- 复制不再是结构占位，而是 policy-bound runtime spawning
- 高权限能力全部进入统一治理矩阵

### 7.4 阶段完成后预期总完成度
- **86% → 91%**

---

## 8. Phase 5 — OpenClaw Control Plane Full Absorption + Collective Runtime

### 8.1 目标
完成 richer control plane 与 collective runtime，使 ConShell 从单体生命体走向受治理的群体生命系统。

### 8.2 核心工作

#### P5-1. Session Orchestration Completion
- main / isolated / child / delegated / collective session semantics
- richer session graph

#### P5-2. Control Plane Feature Absorption
- cron / webhooks / wake events / node-local actions / richer messaging surfaces
- 更像 OpenClaw 级 agent OS，而非单一 runtime

#### P5-3. Collective Runtime
- peer trust / discovery / delegated execution / lifecycle management
- branch/peer health / authority / accountability

#### P5-4. Collective Economy & Reputation
- peer contribution
- reward distribution
- delegated work accounting
- reputation-aware selection

#### P5-5. Unified Operator Surface
- health / identity / governance / economy / agenda / collective / lineage 一体化控制台

### 8.3 阶段完成标准
- ConShell 具备接近 OpenClaw 广度的控制平面能力
- collective / lineage / evolution 形成真实运行层
- operator 可以统一观察和治理整个生命系统

### 8.4 阶段完成后预期总完成度
- **91% → 96%**

---

## 9. 最后 4% 是什么

理论上即使到 96%，也不应轻易声称“100% 完成”。

最后 4% 代表的是：
- 长周期真实运行后的经验修正
- 经济闭环的长期证据
- 群体演化的稳定性验证
- 安全边界、异常路径、极端场景的长期验证

也就是说，最终 100% 不应靠开发宣称得出，而应靠：

> **真实运行 + 长期证据 + 可审计稳定性 + 经济可持续性**

来逼近。

---

## 10. 近期开发建议（未来 4 个具体轮次）

为了避免路线图过大不可执行，建议近期轮次按以下顺序落地：

### Round 17.6
- Identity Truth Surface / Consistency Diagnostics / Canonical Verification

### Round 17.7
- Economic Kernel Foundation
- Economic Identity / Capability Envelope / Mandate Engine / Firewall

### Round 17.8
- Economic Diagnostics / Ledger Truth / Reward-Claim Foundations

### Round 17.9
- ConShell 402 / Payment Negotiation / Provider Selection / Policy-bound Economic Routing

---

## 11. 一句话执行总结

> **ConShell 后续开发不应再以局部 feature 堆叠为主，而应按“truth surface → identity final closure → economic kernel → continuous autonomy → governed evolution → control plane completion”这条主线分阶段推进，逐步把当前约 70% 完成度的生命体运行时核心，推进到真正接近完整 Web4 自主 AI 智能生命体的系统。**
