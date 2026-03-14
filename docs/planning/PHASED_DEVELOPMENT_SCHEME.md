# ConShell 阶段性开发方案

> 更新日期：2026-03-14  
> 基于：`docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md` + 当前全局审计 + 当前根目录路线图  
> 目的：在“不盲目扩张，也不一味死磕单点”的原则下，把 ConShell 后续开发拆成清晰、可执行、可审计的阶段性工作方案。

---

# 1. 方法论

ConShell 的开发不能犯两个对称错误：

## 错误 A：放着现实问题不解决，直接扩张开发
表现为：
- runtime truth 未统一时继续堆更高层能力
- 验证不稳定时继续推进经济 / 复制 / 演化
- 审计现实未闭环时继续扩大产品面

## 错误 B：一味死磕单点问题，导致系统长期停滞
表现为：
- 对单个测试/单个技术点无限追打
- 不判断这个问题是否真是当前最高杠杆点
- 解决局部技术洁癖，却不推进系统闭环

因此，阶段性开发方案必须遵循：

> **先解决会污染全局可信度的关键问题，再推进会带来系统级闭环收益的能力层。**

也就是说，每一阶段都必须同时回答两个问题：

1. 当前最危险的现实问题是什么？
2. 当前最值得推进的闭环是什么？

---

# 2. 当前阶段判断

根据 Round 14.8.2 后的审计，ConShell 当前更准确的阶段是：

> **Viable Sovereign Runtime Core + Early Runtime Truth Kernel Layer + Early Self-Continuity Runtime Layer**

这意味着：

### 已经较强的层
- runtime integrity / doctor
- kernel / runtime skeleton
- memory tiering
- tool execution path
- WebChat runtime
- constitution / policy / selfmod scaffolding
- identity-memory coherence baseline
- continuity runtime integration baseline

### 仍然关键但未闭环的层
- pinned verification closure
- foreign-runtime rejection closure
- durable identity registry
- full identity continuity closure
- economic survival loop
- continuous autonomous agenda
- replication / lineage runtime closure

---

# 3. 阶段划分

本方案将后续开发拆为 6 个阶段，不是严格线性，但具有明确先后关系。

---

# Phase A — Truth Kernel Stabilization

## 目标
把当前 runtime truth / verification / Doctor 体系真正收口，避免继续出现“开发报告 reality”和“审计 shell reality”分叉。

## 当前必须优先做的事
1. current shell truth vs pinned runtime truth 明确区分
2. foreign-runtime rejection 逻辑与测试完全对齐
3. verification context 成为所有关键报告的默认组成部分
4. 当前验证结果具备稳定复现语义

## 为什么是当前阶段
因为如果这一步不稳定，后续所有闭环都会建立在不一致的真相上。

## 完成标准
- Doctor 的 truth contract 完整闭环
- 当前 / pinned / evidence runtime 语义清楚
- 审计者和开发者不再给出互相冲突的“全绿现实”

## 阶段性质
**修现实问题为主，少扩张。**

---

# Phase B — Identity & Memory Continuity Closure

## 目标
把 identity、SOUL、memory、continuity 从“雏形接入”推进到“系统闭环”。

## 应推进的内容
1. durable identity registry
2. identity-aware memory 统一边界
3. soul lifecycle 深化
4. continuity chain 与 session / memory / restart 更深整合
5. lineage inheritance boundary 明确化

## 为什么这是第二阶段
因为当前已经有：
- identity anchor
- continuity record
- continuity service
- soul advance callback

下一步应该把这些骨架闭合成更完整的“我是谁、我如何延续存在”。

## 完成标准
- agent 能审计性地证明“我是同一个 self”
- memory / soul / session / continuity 真正围绕 identity 聚合

## 阶段性质
**适度扩张，但必须围绕闭环，不扩散表层功能。**

---

# Phase C — Economic Survival Coupling

## 目标
把 wallet / spend / x402 / automaton survival 从“基础设施存在”推进到“经济生存闭环”。

## 应推进的内容
1. 收入路径定义
2. 统一收支账本
3. survival tier 与 runtime behavior 耦合
4. cost / value / reserve / burn-rate 建模
5. 创造价值 → 获得收入 → 影响生存状态 的闭环

## 为什么在 Phase B 之后
因为没有 identity continuity，就回答不了：
- 谁在赚钱
- 谁在消耗
- 谁在生存

## 完成标准
- agent 能对自身成本与收入负责
- economic pressure 真正改变 runtime 行为

## 阶段性质
**系统闭环推进，不追求功能数量。**

---

# Phase D — Autonomous Agenda & Continuous Operation

## 目标
让 ConShell 从“反应式 agent runtime”推进到“具有持续自主 agenda 的运行时”。

## 应推进的内容
1. agenda management
2. background maintenance loops
3. long-horizon task persistence
4. restart continuity deeper integration
5. scheduler / heartbeat / upkeep / earning / self-check loops

## 为什么在经济耦合之后
因为真正的 agenda 不能是凭空“我想做什么”，而应受：
- creator directives
- commitments
- survival pressure
- economics
- constitution
共同约束。

## 完成标准
- 系统不只是等输入，而开始有持续性的自治行为模式

## 阶段性质
**开始扩张，但仍需严格受治理和经济边界约束。**

---

# Phase E — Governance / Self-Modification / Replication Control

## 目标
让自修改、自复制、自主高风险行动进入治理闭环。

## 应推进的内容
1. governance engine
2. self-mod workflow（proposal → approve → apply → verify → audit → rollback）
3. replication workflow
4. lineage governance
5. creator audit boundary 深化

## 为什么不能太早做
如果 identity / memory / economy / continuity 还不稳，治理系统会建立在漂浮基础上。

## 完成标准
- powerful actions are governed, not just technically possible
- replication is controlled, not romanticized

## 阶段性质
**闭环 + 风控，并非功能扩张。**

---

# Phase F — Collective Evolution Runtime

## 目标
把多 agent / EvoMap / lineage / capability exchange 从骨架推进到生态级运行层。

## 应推进的内容
1. child runtime actualization
2. asset publish + consume loop
3. reputation / trust / discovery
4. internal specialization and task routing
5. capability inheritance / selective adaptation

## 为什么是最后阶段
因为这是最容易看起来“高级”，但也最容易建立在空心基础上的层。
只有前面几层闭环足够稳，群体与演化才不是幻觉。

## 完成标准
- collective runtime is real, not just multiple objects in memory

## 阶段性质
**高层扩张，但必须建立在前面所有真实性与治理闭环之上。**

---

# 4. 当前阶段最合理的开发策略

基于当前项目状态，当前不应采用以下极端策略：

## 不该做的
### A. 盲目扩张
例如：
- 继续扩 browser / nodes / channels / UI / dashboard / companion surfaces
- 继续加更多“看起来像更强 agent”的外层能力

### B. 无限死磕单点
例如：
- 不判断优先级，只围绕一个失败测试反复打转
- 不判断该问题是“局部实现问题”还是“全局真相问题”

## 当前应该做的
> **修复会污染整体可信度的关键问题，同时为下一层闭环做好准备。**

也就是：

### 当前阶段最佳策略
1. 先完成 Truth Kernel Stabilization
2. 然后推进 Identity & Memory Continuity Closure
3. 再进入 Economic Survival Coupling

---

# 5. 当前阶段的工作包建议

## WP-A1 — Verification Truth Closure
- 修 foreign-runtime rejection
- 修 current/pinned/evidence runtime split semantics
- 建立 deterministic verification mode

## WP-A2 — Root Context Hygiene
- 根目录文件分类明确
- agent 阅读顺序固定
- development prompt / audit prompt 模板固化

## WP-B1 — Identity Continuity Deepening
- durable identity registry
- session/soul/memory 更深 continuity integration
- inheritance boundary clearer

## WP-C1 — Economic Grounding Preparation
- unified economic ledger design
- x402 service surface mapping
- spend/income/survival coupling design

当前最推荐立即启动的是：
- **WP-A1**
- 再接 **WP-B1**

---

# 6. 阶段使用规则

之后每一轮开发都必须：

1. 明确自己属于哪个阶段
2. 明确当前是在修现实问题，还是推进闭环
3. 说明为什么当前不该盲目扩张，也不该无意义死磕
4. 说明当前轮次完成后如何影响下一阶段

---

# 7. 一句话总结

> **ConShell 的阶段性开发，不应是“总往更大能力冲”，也不应是“总被局部问题拖死”，而应是在修复关键现实问题与推进关键系统闭环之间做出高杠杆平衡。**
