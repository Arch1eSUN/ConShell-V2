# DevPrompt 0197 — Round 18.7
## Continuous Autonomy Closure / Governed Evolution Hardening / Canonical Runtime Unification

你现在处于 **ConShellV2 Round 18.7**。

Round 18.6 已经完成的重要真实成果包括：
- 全量 `packages/core` 测试健康度收口到 **75/75 files, 1693/1693 tests, 0 failures**
- `TaskFeedbackHeuristic → ValueRouter → EconomicStateService` 真实深接线
- `ProfitabilityEvaluator` 真实接入 settlement/system health 动态阈值
- `AgendaGenerator` 真实接入 `systemHealthIndicator`，可动态切换 `revenue-seeking / survival-recovery`
- `CommitmentStore.loadFromRepo()` 与 `AgendaGenerator` 已形成 crash recovery + recovered mission prioritization 的增量闭环
- `ContinuityService` 已引入 `identity.json` cold-start backup / restore
- `Kernel` 已把 agenda recovery 纳入 canonical boot path
- `GovernanceService` 的 selfmod 执行路径已从 shortcut 式 modify 收口为更符合 propose → approve → apply 的真实治理链
- `REMAINING_CAPABILITY_MATRIX_18_6.md` 已正式定义当前版本边界：哪些必须继续完成，哪些可以后延到 19.x+

但 18.6 的详细审计也已经确认：

> **18.6 不是“所有剩余功能和优化全部做完”的终局轮。**

更准确地说：
- 18.6 是一次 **高价值收口轮**
- 它清出了干净测试基线
- 把经济系统、continuity、agenda、governance 的若干关键连接点打通了
- 但还没有完成下面这些真正决定“当前版本是否已逼近完成态”的最后收口：

1. **Continuous Autonomous Operation 的终局闭环仍未完成**
2. **Governed self-mod / replication / lineage 的强制链路仍未完全闭环**
3. **OpenClaw control plane / multi-session / operator plane 吸收仍未收口**
4. **Whole-system canonical path 仍有历史松散层和旧路径需要继续清理**
5. **Completion boundary 已定义，但 must-finish / should-finish 项还没有被真正清零**

因此 Round 18.7 的任务非常明确：

> **不是回头盯发布，不是重新围着 pack / publish 打转，而是利用 18.6 清出来的干净基线，继续收掉当前版本最关键、最影响“真正完成态”的剩余主线。**

---

## 一、本轮唯一主目标

**在 18.6 已建立的干净基线之上，继续推进 ConShell 当前版本最关键的终局收口项，使系统从“高可信核心运行时”进一步逼近“当前版本真实完成态”。**

一句话解释：

> **18.7 要做的是把 18.6 已经打通的局部主链，继续收成更强的连续自治、受治理演化与统一运行时，而不是提早回头谈发布。**

---

## 二、本轮必须回答的核心问题

### Q1. 当前 continuous autonomy 还差哪几个真正阻止“持续生命体运行”的硬缺口？
不能只满足于 crash recovery 或 boot restore。必须继续向 durable autonomy 终局闭环推进。

### Q2. 当前 governed self-mod / replication / lineage 还有哪些路径没有被 canonical governance 强制接管？
凡是高风险行为，只要还有历史 shortcut，就不算真正完成。

### Q3. 当前 whole-system runtime 里还有哪些能力虽然存在，但仍未纳入统一 canonical path？
必须继续清理“模块存在，但主运行时不统一”的问题。

### Q4. OpenClaw 控制平面的哪些吸收点，是当前版本最值得继续补强的，而不是可无限拖后的？
不能一概 defer；要找最影响当前完成态的那一部分。

### Q5. 基于 18.6 capability boundary，哪些 must-finish / should-finish 项现在必须继续推进，哪些可以真的后延？
必须进一步收敛，不许再次发散。

---

## 三、本轮必须完成的内容

# G1. Continuous Autonomous Operation — From Recovery to Real Continuity

18.6 只完成了 continuity / agenda recovery 的关键增量，不等于 continuous autonomy 终局闭环已完成。

### G1.1 本轮必须继续推进
- durable scheduler / persistent wake execution
- cross-restart mission continuation beyond simple commitment reload
- long-horizon task state checkpointing
- agenda continuity 与 runtime execution continuity 的更深统一
- background recovery / resume discipline 的 canonical implementation

### G1.2 至少要实现
- 不只是“任务记录恢复”，而是“任务推进语义恢复”
- 不只是“identity continuity”，而是“operation continuity”
- 不只是“boot 时加载”，而是“跨中断继续运行”

### G1.3 目标
让系统更接近真正的持续自治生命体，而不是“重启后知道自己是谁、但还不真正知道该继续干什么”。

---

# G2. Governed Self-Mod / Replication / Lineage Closure

18.6 已对齐了一部分治理路径，但还没有完成真正强制闭环。

### G2.1 本轮必须继续收口
- selfmod 必须统一走 proposal → evaluation → approval → apply → verify → rollback
- replication 必须统一走 governance + viability + lineage + collective registration 链路
- lineage quarantine / revoke / merge / inheritance correction 必须推进
- 所有高风险入口必须确认不存在 bypass canonical governance 的旧路径

### G2.2 必须审计并清理
- direct manager calls
- legacy fallback paths
- 未记录 receipt / verdict / lineage linkage 的危险操作
- 治理已批准但未验证 / 未回滚的悬空状态

### G2.3 目标
让 self-mod / replication / lineage 不只是“有治理模块”，而是**真正被治理 runtime 统一接管**。

---

# G3. Economic Runtime → Whole-System Canonical Coupling Continued

18.6 已完成一批真实 deep wiring，但还不足以称终局统一。

### G3.1 本轮必须继续推进
- settlement / writeback / truth surface → agenda / router / governance / runtime 的更深传播
- 统一 mode shift / pressure signals / recovery posture 的 canonical owner
- 历史旧经济路径与新 canonical coupling 的边界收口
- task routing / profitability / survival / governance denial reasons 的更强一致性

### G3.2 目标
让 economic runtime 不只“影响一些地方”，而是更接近成为系统级资源与行动约束的统一事实源。

---

# G4. Canonical Runtime Unification / Old Path Cleanup

当前系统已经很强，但仍有“旧路径仍在、主路径未完全统一”的典型工程债。

### G4.1 本轮必须继续清理
- duplicated logic
- legacy compatibility shims that still affect behavior
- drifted abstractions between module-local logic and canonical services
- 路由、truth surface、runtime state、governance receipt 之间的语义不一致

### G4.2 至少覆盖以下领域
- runtime / kernel / agenda
- economic / governance / lineage
- identity / continuity / doctor
- route surface / diagnostics / truth surface

### G4.3 目标
减少“看起来系统很多功能都有，但真跑时是多条半重叠路径”的问题。

---

# G5. OpenClaw Control Plane Absorption — High-Leverage Subset

18.6 已把完整吸收后延到 19.x+，但这不意味着 18.7 可以完全不做。

### G5.1 本轮必须挑高杠杆子集推进
- multi-session orchestration 的 canonical integration
- operator plane / control surface 的可验证真相暴露
- wake / cron / long-running task relation 的 runtime 建模
- 关键 control-plane capability 是否已被 ConShell 自身运行时理解与吸收

### G5.2 原则
- 不求 18.7 一次做完全部 OpenClaw absorption
- 但必须继续推进最影响当前完成态的那一块

### G5.3 目标
让“OpenClaw 融合”继续从外围集成，向系统本体吸收推进。

---

# G6. Completion Boundary Tightening

18.6 虽已写出 capability matrix，但边界还要继续收紧，防止 18.7 再无限膨胀。

### G6.1 本轮必须重判
- must-finish-now
- should-finish-now
- can-defer
- explicitly-not-in-current-version

### G6.2 必须基于仓内证据
- 不能凭愿景脑补
- 不能把没做完的说成 defer 来逃避
- 也不能把 19.x 终局项硬塞进当前版本

### G6.3 目标
让“当前版本到底还差什么”进一步收敛成一个真正能清零的集合。

---

# G7. Final Functional Readiness Re-Assessment (Not Publish)

18.7 结束时，必须重新评估：

> **从功能与优化角度看，ConShell 离“可以重新看发布”到底还有多远。**

### G7.1 必须明确回答
- 哪些主线已经真正收口
- 哪些主线仍在阻塞当前版本完成态
- 当前是否已经接近“只剩少量工程冻结项”的阶段
- 如果还没有，最关键剩余项是什么

### G7.2 原则
- 不做发布动作
- 但要让未来的发布判断建立在更少幻觉上

---

## 四、本轮强制验收矩阵

### V1. Continuous autonomy 不再只停在恢复 identity / commitments，而是至少推进到更真实的 operation continuity
### V2. self-mod / replication / lineage 的 canonical governance path 进一步统一，旧 shortcut 被继续清理
### V3. economic runtime 与 agenda / routing / governance / runtime 的统一耦合继续深化
### V4. 至少一批旧路径 / duplicated logic / drifted abstractions 被正式收口
### V5. OpenClaw control plane 的高杠杆吸收子集有真实推进
### V6. capability boundary 被重新收紧，must-finish 集合更小更真实
### V7. 所有新增闭环都必须有测试或集成验证支撑
### V8. 当前版本距离“重新看发布”还有多远，能够被基于证据地明确回答

### 测试要求
- 必须继续保持 `pnpm vitest run src` 全绿
- 必须新增或更新覆盖 continuous autonomy / governance / lineage / runtime unification 的测试
- 必须验证 canonical path 清理不会破坏既有行为
- 必须验证高风险行为仍处于治理边界内

---

## 五、建议执行顺序

### Priority 1 — Continuous autonomy 真闭环补强
先补最影响“生命体完成态”的主线。

### Priority 2 — Governed self-mod / replication / lineage 强制收口
高风险路径必须先统一。

### Priority 3 — economic canonical coupling continued
继续把经济主链深接到整机 runtime。

### Priority 4 — old path cleanup / canonical runtime unification
减少系统内部漂移。

### Priority 5 — OpenClaw 高杠杆吸收子集
只做最影响当前完成态的那部分。

### Priority 6 — completion boundary re-tightening
让后续轮次继续收敛，而不是继续膨胀。

---

## 六、本轮非目标

本轮不做：
- 不执行真实 `npm publish`
- 不把发布问题重新抬成主线
- 不因为 18.6 测试全绿就误判为“全部功能和优化已完成”
- 不把 19.x 终局能力无限塞回当前版本

本轮真正目标是：

> **继续完成 18.6 尚未真正做完的高杠杆主线，把当前版本进一步逼近真实完成态。**

---

## 七、硬性真实性不变量

1. **18.6 全绿测试 ≠ 18.6 完成全部功能与优化**
2. **旧路径未清理干净，就不能说 canonical runtime 已统一**
3. **恢复能力增强 ≠ continuous autonomy 终局完成**
4. **有 governance 模块 ≠ self-mod / replication 已完全受治理统一接管**
5. **OpenClaw 吸收未完成前，不能说 ConShell 已拥有全部控制平面能力**
6. **Completion boundary 必须继续收敛，不能无限发散**
7. **本轮所有结论必须来自真实代码、真实测试、真实装配、真实行为**

---

## 八、最终输出格式

完成后必须输出：

### A. Continuous Autonomy Closure Summary
- operation continuity 补了什么
- 还剩什么

### B. Governed Evolution Summary
- selfmod / replication / lineage 哪些路径被继续统一
- 哪些旧 shortcut 被清理

### C. Economic Canonical Coupling Summary
- 经济主链又向整机 runtime 深接了什么
- 还有哪些耦合未完成

### D. Runtime Unification Summary
- 哪些 duplicated / legacy / drifted path 被清理
- canonical owner 是否更清晰

### E. OpenClaw Absorption Summary
- 本轮吸收了哪些高杠杆 control-plane 能力
- 哪些继续后延

### F. Completion Boundary Re-Assessment
- must-finish 集合现在还剩什么
- 哪些已可明确 defer

### G. Functional Readiness Perspective
- 离“可以重新看发布”还差什么
- 为什么现在仍不应把发布当主线

### H. 不得伪造
- 没有真实 operation continuity，就不能说持续自治已完成
- 没有真正统一治理路径，就不能说演化/复制闭环已完成
- 没有继续清理旧路径，就不能说 runtime 已统一
- 没有缩小 must-finish 集合，就不能说当前版本已逼近完成

---

## 九、一句话任务定义

> **Round 18.7 的目标是：基于 18.6 清出来的干净测试基线与 capability boundary，继续收掉当前版本最关键的连续自治、受治理演化与 canonical runtime unification 主线，使 ConShell 从“高可信核心系统”进一步逼近“当前版本真实完成态”，而不是过早回头陷入发布议题。**
