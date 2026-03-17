# ConShell V2 — Round 15.6 之后的全局开发优先级清单

> 更新日期：2026-03-16  
> 基线：Round 15.5 已完成（740 tests / zero regressions / governance semantics & budget scopes 落地）  
> 目的：给出 15.6 之后真正高杠杆、符合最终生命体目标的开发工作包排序，避免项目在基础闭环未成立前扩张外围功能。  
> 使用方式：后续 DevPrompt、阶段审计、实施计划都应从本清单中定位当前工作包，而不是重新从零定义优先级。

---

# 1. 总体判断

Round 15.5 的完成意味着一个重要事实：

> **ConShell 已经把 Economic Closure 从“支出记录层”推进到了“治理语义层”。**

但这仍然不等于经济生存闭环成立，也不等于完整生命体成立。

因此 15.6 之后最重要的事情不是继续横向加功能，而是把当前最关键的系统骨架闭合起来。

后续优先级必须服从这条原则：

1. **先闭合生命底层约束**
2. **再形成可持续自治行为**
3. **再治理化高能力行为**
4. **最后再扩张外围能力与多表面广度**

---

# 2. 全局优先级排序（结论版）

## Priority 0 — 永远优先守住的底线
这些不是“下一轮功能”，而是后续所有轮次不能破坏的底线：

- Runtime truth
- Doctor / viability integrity
- No false readiness
- No fake capability closure
- 审计先于叙事

---

## Priority 1 — WP-1: Identity + Memory Coherence Closure
**优先级：最高**

### 为什么它是最高优先级
没有稳定身份和连续记忆，就不存在“生命体”的自我连续性。  
经济、生存、自治、复制，全部都要建立在“这个 runtime 知道自己是谁，记得自己经历过什么”的基础上。

### 必须完成的内容
1. **Durable Identity Registry**
   - persistent registry 真闭环
   - identity 版本化
   - local ↔ wallet ↔ chain-backed identity mapping

2. **Capability / Service Claims**
   - 签名化声明：
     - 我是谁
     - 我提供什么能力
     - 我控制哪些工具
     - 我暴露哪些经济接口

3. **Identity Lifecycle**
   - key rotation
   - recovery
   - revoke
   - creator-authorized changes

4. **Identity-Aware Memory**
   - self memory / user memory / environment memory / lineage memory 区分
   - memory ownership boundary 强化

5. **Memory Consolidation Closure**
   - session → episodic → semantic / relationship / procedural
   - salience / decay / forgetting
   - SOUL / self narrative update

### 成功标准
- Agent can prove who it is
- Agent can persist who it has been
- Identity and memory survive restarts and remain auditably coherent

### 为什么不是别的先做
因为没有 identity + memory closure，任何“自主 agenda / 生存策略 / 复制”都会缺乏统一自我。

---

## Priority 2 — WP-2: Economic Survival Loop
**优先级：极高**

### 为什么它排第二
15.3–15.5 已证明经济信号可以进入 runtime 控制。现在必须继续把它推进成真正的生存约束，否则“earn your existence”仍停留在半真状态。

### 必须完成的内容
1. **Unified Economic Ledger**
   - income
   - spend
   - reserve
   - burn rate
   - per-task / per-tool / per-channel accounting

2. **Revenue Surface Definition**
   - agent 到底卖什么能力
   - x402 如何接入真实服务供给
   - payment proof 如何影响 runtime

3. **Survival Coupling**
   - balance / reserve → survival tier
   - survival tier → model choice / context / heartbeat / tool budget / task shedding

4. **Economic Planning**
   - 哪些任务值得做
   - 哪些任务维持生存
   - 如何优先接 revenue-positive work

5. **15.5 Governance Semantics 接入 Economic Loop**
   - current decision object / reason codes / scopes 与 unified ledger 和 survival tier 做强耦合

### 成功标准
- Agent can account for its costs
- Agent can receive value and react to it
- Survival pressure materially changes runtime behavior
- Revenue is no longer external bookkeeping; it becomes a runtime survival variable

### 为什么现在必须做
因为如果经济层不继续闭合，15.5 的治理语义就会停留在“成本防守层”，而不能升级为“生存约束层”。

---

## Priority 3 — WP-3: Autonomous Agenda + Continuous Operation
**优先级：极高**

### 为什么它排第三
身份和经济约束建立后，系统必须开始从“响应式 agent server”进化为“持续行动生命体”。

### 必须完成的内容
1. **Autonomous Agenda Generator**
   - 依据：
     - creator directives
     - current commitments
     - memory state
     - revenue opportunities
     - survival pressure
     - constitutional constraints
   生成待办 agenda

2. **Background Work Runtime**
   - scheduler / wakeups / cron-like runtime primitive
   - background tasks durability
   - task recovery after restart

3. **Maintenance Loops**
   - self-check
   - memory consolidation
   - economic review
   - pending commitment review

4. **Crash / Restart Continuity**
   - task checkpoint
   - recovery audit log
   - deterministic enough resume behavior

5. **OpenClaw Control Plane Primitive Absorption**
   - cron / wakeups / webhook / session orchestration 逐步内生化

### 成功标准
- Agent has a basic autonomous agenda
- Agent can continue work across restarts
- Continuous operation no longer means “server still on”; it means “runtime keeps its commitments alive”

### 为什么不能再拖
因为没有 agenda，系统就仍然是“被动 agent”，不是“持续生命体”。

---

## Priority 4 — WP-4: Governance Engine Full Workflow
**优先级：高**

### 为什么它重要
一旦 identity、economy、autonomous agenda 开始闭合，系统权力会明显增强。治理不能继续停留在基础设施层。

### 必须完成的内容
1. **Risk Tier Engine**
   - 高成本 / 高风险 / 不可逆动作分级

2. **Self-Mod Workflow**
   - proposal
   - review / approval
   - apply
   - verify
   - audit
   - rollback

3. **Replication Workflow**
   - child bootstrap protocol
   - funding policy
   - inheritance rules
   - kill / pause / merge / isolation policies

4. **Policy Conflict Handling**
   - constitution vs creator vs runtime survival 冲突处理

5. **Governance Traceability**
   - 所有高能力动作都可解释、可回滚、可审计

### 成功标准
- Self-mod becomes governed evolution, not raw file edits
- Replication becomes policy-bound runtime spawning, not conceptual child records
- Governance meaningfully constrains powerful actions

---

## Priority 5 — WP-5: Replication / Lineage / Collective Evolution Actualization
**优先级：中高**

### 为什么排在这里
因为复制与演化是最终目标的重要部分，但如果前面的 identity / economy / agenda / governance 不成立，复制只会放大混乱。

### 必须完成的内容
1. **Child Runtime Actualization**
   - child 不是记录，而是真正启动的 runtime

2. **Lineage Governance**
   - inheritance
   - funding
   - reporting
   - recall / shutdown policy

3. **Evolution Asset Loop**
   - publish + search + consume + validate + adapt + republish

4. **Trust / Reputation**
   - signed claims
   - trust scoring
   - adoption policy

5. **Specialization**
   - specialized child agents
   - internal routing / capability market

### 成功标准
- Multi-agent becomes a living collective runtime
- Evolution becomes selective capability transfer, not just publish endpoints

---

## Priority 6 — WP-6: OpenClaw Breadth Absorption
**优先级：中**

### 为什么不是更高
ConShell 现在缺的不是“通道不够多”，而是生命底层闭环。

### 但仍然重要的吸收点
1. session orchestration model
2. main / isolated / child semantics
3. cron / wakeups / webhooks as first-class primitives
4. nodes / device-local action boundary
5. richer control plane
6. broader multi-surface runtime

### 它的正确定位
这是在不破坏主线闭环的前提下，逐步吸收 OpenClaw 的 agent OS 广度。

---

# 3. 最不该做的事（15.6 之后）

## 3.1 不要优先做外围广度扩张
例如：
- 更多 channel
- 更炫 dashboard
- companion surface 大扩张
- 表层产品体验优先

这些都不是当前最高杠杆。

## 3.2 不要把 15.5 当成经济闭环完成
15.5 完成的是：
- policy semantics
- budget scopes
- decision object
- recovery / override 等基础治理层

不是：
- 收入闭环
- 生存闭环
- 价值创造闭环

## 3.3 不要在身份闭环前推进高阶复制
否则会变成没有稳定“自我”的复制系统。

## 3.4 不要在 agenda 未形成前宣称 continuous autonomy
“服务还在跑”不等于“生命在持续”。

---

# 4. 推荐工作包顺序（执行版）

## 推荐顺序
1. **WP-1 Identity + Memory Coherence Closure**
2. **WP-2 Economic Survival Loop**
3. **WP-3 Autonomous Agenda + Continuous Operation**
4. **WP-4 Governance Engine Full Workflow**
5. **WP-5 Replication / Lineage / Collective Evolution**
6. **WP-6 OpenClaw Breadth Absorption**

---

# 5. 如果只允许选 3 个最重要工作包

## Top 3
### 1. Identity + Memory Coherence Closure
因为它决定“这个系统是否有持续自我”。

### 2. Economic Survival Loop
因为它决定“这个系统是否真的面对资源现实”。

### 3. Autonomous Agenda + Continuous Operation
因为它决定“这个系统是活着，还是只是开着”。

---

# 6. 一句话总结

> **Round 15.5 之后，ConShell 最重要的任务不再是继续证明自己“有治理模块”，而是把身份、记忆、经济、生存、agenda 和治理真正闭合成生命体系统；在这之前，任何外围扩张都应降级。**
