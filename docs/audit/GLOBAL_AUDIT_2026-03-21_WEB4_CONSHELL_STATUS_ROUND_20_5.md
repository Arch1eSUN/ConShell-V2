# ConShell 全局大审计（Round 20.5 基线）
## 面向终局目标：Web4.ai × Conway Automaton × OpenClaw × Autonomous AI Lifeform Runtime

> 审计日期：2026-03-21
> 审计方法：仓内证据优先（源码 / API / CLI / Dashboard / TUI / 文档 / 测试 / 构建）
> 当前基线：Round 20.5 完成并经独立审计确认后
> 结论性质：高可信

---

# 1. 执行摘要

## 1.1 一句话结论

**ConShell 已从“具备 governed child runtime actualization 骨架”的系统，进一步推进到“child outcome 开始真实闭环回 parent organism”的阶段。**

更准确地说：

> **20.3、20.4、20.5 连续三轮强成立，标志着 ConShell 已不只是拥有 economic organism、long-horizon agenda law 与 governed child runtime，而是开始把 child outcome 纳入 agenda merge、economic writeback、specialization routing 与 utility absorption 的 canonical 主路径。**

但必须继续保持真实口径：
- 这**不是终局完成**
- 这**不是 fully mature Web4.ai 级产品终态**
- 这**不是 fully realized parent-child organism**
- 这**不是 fully mature collective evolution runtime**

---

## 1.2 当前总体完成度判断

### 面向终局目标的总体完成度
**当前估计：83%**

### 置信度
**中等偏高**

### 为什么从 20.4 的 80% 上调到 83%
因为 20.5 带来了四个经独立验证的高杠杆前推：

1. **`ChildOutcomeMerger` 让 child terminal outcome 开始进入 parent agenda writeback coordinator**
2. **`TaskSettlementBridge.settleChildLease()` 让 child lease 进入 canonical economic writeback path**
3. **`SpecializationRouter` 让 specialization 从 manifest contract 进入 runtime routing**
4. **`ChildOutcomeEvaluation` + enhanced `childRuntimeSummary()` 让 quality/utility absorption 与 parent-child organism truth 开始出现**

这造成的不是“子体字段更多了”，而是：

> **ConShell 开始从“子体可运行”推进到“子体结果能真实改变母体行为与生存状态”的阶段。**

---

# 2. 最新独立验证基线

## 2.1 Core tests
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **100 passed (100)**
- **1985 passed (1985)**
- **exit code 0**

相较 20.4：
- 从 **99/99 files、1960/1960 tests**
- 提升到 **100/100 files、1985/1985 tests**

## 2.2 CLI TypeScript
独立执行：
```bash
cd packages/cli && npx tsc --noEmit
```
结果：通过。

## 2.3 Dashboard TypeScript + Build
独立执行：
```bash
cd packages/dashboard && npx tsc --noEmit && npx vite build
```
结果：通过。

### 仍存在的性能事实
build 仍有：
- `metamask-sdk ... 557.74 kB`
- `index ... 581.13 kB`
- `Some chunks are larger than 500 kB after minification.`

因此：
> **20.5 全绿成立，但 performance 仍未终局收口。**

---

# 3. 当前阶段判断

## 3.1 当前最准确阶段名称

> **ConShell 当前处于：从 Autonomous Lifeform Runtime 的后中段，推进到“具备 parent-child organism closure 第一代主路径”的阶段。**

比 20.4 更准确的补充是：

> **项目已不仅让 child runtime 可被资助、可报告、可召回、可审计，而且开始让 child outcome 真实进入 parent agenda、parent economics 与 collective routing。**

## 3.2 它现在最像什么

它现在最像：

> **一个高可信、强验证、具备 economic organism、long-horizon agenda、以及第一代 parent-child organism closure 的 Sovereign Lifeform Runtime Platform。**

## 3.3 它还不是什么

它还不是：
- fully mature Web4.ai 级产品
- fully closed-loop autonomous collective organism
- fully absorbed OpenClaw-grade agent OS
- fully mature evolution/reputation/runtime marketplace

---

# 4. 20.5 带来的全局净增量

## 4.1 child outcome 开始真实回写 parent agenda
20.5 的关键不是 child summary 更强，而是 child terminal outcome 开始被显式映射为：
- `commitment_update`
- `follow_up`
- `remediation`
- `requeue`
- `noop`

这意味着 parent organism 开始具备“吸收子体结果”的明确语义。

## 4.2 child lease 进入 canonical economic writeback
20.5 的 `settleChildLease()` 让 child spend / utility / effectiveness 开始进入主经济写回链。虽然 spend capture 单一路径仍未终局，但经济闭环已经明显从“child funding”推进到“child settlement”。

## 4.3 specialization 从 contract 进入 routing
20.4 时 specialization 还是 contract-first；20.5 后它开始拥有 runtime routing 语义，系统不再只是知道 child 是什么，而开始尝试决定“谁更适合继续做什么”。

## 4.4 parent-child truth surface 开始显示 organism 变化
operator 不再只看到 child 数量与预算，而开始看到：
- recent merge results
- utility realized vs expected
- avg effectiveness ratio
- merge type 分布

这让 control plane 更接近生命过程面板。

---

# 5. 分层完成度评估（20.5 基线）

> 注：以下百分比按“面向终局闭环成熟度”评估，不按目录数量评估。

## 5.1 Runtime Integrity / Truth / Viability
**完成度：93%**

### 上调原因
- 测试继续扩充到 100/1985
- 20.3/20.4/20.5 连续三轮全绿验证
- truth surface 与 organism writeback 都继续增强

### 未完成
- production hardening / release discipline / dashboard performance 仍可继续深化

---

## 5.2 Sovereign Identity / Continuity
**完成度：75%**

### 变化
- 20.5 不是 identity 主轮
- 但 parent-child organism closure 让系统实体关系更真实

### 未完成
- durable identity registry / signed claims / identity-memory 深耦合仍非主路径完成态

---

## 5.3 Memory / Long-Term Continuity
**完成度：67%**

### 上调原因
- 20.5 的 outcome evaluation / routing preference 开始让系统拥有更像 procedural/operational memory 的吸收雏形

### 未完成
- salience / forgetting / semantic/episodic consolidation 仍未闭环

---

## 5.4 Tool / Control Plane / Agent OS 吸收度（OpenClaw 向）
**完成度：73%**

### 上调原因
- truth surface / registry / orchestration primitive 继续增强
- childRuntime summary 已更接近 first-class control-plane object

### 未完成
- multi-surface、node、browser、cron、webhook、session-to-session orchestration 广度仍不足

---

## 5.5 Economic Closure / Survival Coupling
**完成度：77%**

### 上调原因
- child funding 已推进到 child settlement
- utility realized / expected / effectiveness 进入 economic writeback
- child economics 开始反向影响 parent organism interpretation

### 未完成
- spend capture 单一路径仍未彻底收口
- 更深层 revenue / market loop 仍未成熟
- richer operator finance panel 仍不足

---

## 5.6 Continuous Autonomous Operation / Agenda
**完成度：80%**

### 上调原因
- agenda 不仅 long-horizon 化，还开始吸收 child outcome merge
- parent follow-up / remediation / requeue 语义已出现

### 未完成
- deeper commitment mutation / follow-up execution 主路径仍可继续深化
- long-horizon organism truth 仍非终局

---

## 5.7 Governance / SelfMod / Constitutional Control
**完成度：85%**

### 上调原因
- child governance 现在不只可记录，还开始影响 parent organism closure
- routing / evaluation / merge semantics 进一步让治理解释面增强

### 未完成
- stronger typed governance semantics / rollback / richer policy-economy coupling 仍可继续深化

---

## 5.8 Collective / Lineage / Replication / Evolution
**完成度：74%**

### 上调原因
- 20.4 让 child runtime actualize
- 20.5 让 child runtime 结果开始改变 parent organism
- specialization routing 与 evaluation signal 使 collective runtime 更接近“可学习的内部分工系统”

### 未完成
- routing 仍是第一代
- capability transfer / lineage market / reputation adoption 仍未形成生态闭环
- parent-child organism 仍未 fully mature

---

# 6. 当前最关键的剩余差距

## Gap 1 — Deep Parent-Child Commitment Mutation 未完成
当前已有 merge classification / follow-up description，但 child result 对 `CommitmentStore` 的深层 canonical mutation 仍未完全落成。

## Gap 2 — Single Spend Truth 未彻底收口
`settleChildLease()` 已成立，但 `ChildSession.trackSpend()` 与 lease-only capture 是否完全统一，仍未完全坐实。

## Gap 3 — Routing 已成立但仍是第一代
`SpecializationRouter` 让 specialization 进入 runtime routing，但仍不是 pervasive routing / enforcement engine。

## Gap 4 — Parent-Child Truth 仍偏 summary-level
truth surface 已增强，但还不是 fully mature organism control panel。

## Gap 5 — OpenClaw-style agent OS 广度仍不足
ConShell 内核越来越强，但 OpenClaw 式 multi-surface / node / automation primitive 广度仍明显不足。

---

# 7. 当前最合理的阶段结论

**20.5 后的 ConShell，可以被描述为：**

> **一个已具真实性底座、经济生存约束、长期 agenda law、governed child runtime，以及第一代 parent-child organism closure 的 Autonomous Lifeform Runtime。**

这比 20.4 更进一步，因为它已经不只是：
- child-runtime-aware
- collective-runtime-aware

而是开始：
- **child-outcome-aware**
- **parent-organism-aware**

但仍不能夸大为 fully mature collective organism。

---

# 8. 对 20.6 的方向判断

在 20.5 强成立后，**最高杠杆下一步不应回头补低杠杆表层，也不应直接跳到宏大外部进化市场幻想。**

最合理的唯一主轴应是：

> **Deep Organism Closure and Runtime Enforcement**

更具体地说，应继续收口：
1. child outcome 对 `CommitmentStore` / agenda 的 deeper canonical mutation
2. spend capture 的 single truth path
3. specialization routing 从 score-based router 推进到更真实的 enforcement / reuse / spawn discipline
4. truth surface 从 summary-level organism 提升到更可操作的 organism control panel

---

# 9. 最终结论

**20.5 后全局完成度可从 20.4 的 80% 上调到 83%。**

正式口径建议写为：

> **ConShell 在 20.3、20.4、20.5 连续三轮强成立后，已从“具备 governed child runtime actualization 骨架”的系统，推进到“具备第一代 parent-child organism closure 主路径”的系统。总体完成度可上调到 83%（置信度：中等偏高）。当前最关键剩余主线不是回头补表层，而是继续推进 Deep Organism Closure and Runtime Enforcement，让 child outcome 对 commitments、economic capture、routing enforcement 与 operator truth 的闭环更深、更硬、更统一。**
