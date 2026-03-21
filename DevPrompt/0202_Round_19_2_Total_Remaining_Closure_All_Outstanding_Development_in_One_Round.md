# DevPrompt 0202 — Round 19.2
## Total Remaining Closure / All Outstanding Development in One Round

你现在处于 **ConShellV2 Round 19.2**。

到当前最新审计基线为止，ConShell 已经完成并被仓内证据确认的关键成果包括：
- Runtime / Kernel / Viability 基线成熟，`packages/core` 当前全量测试已达到 **83/83 files、1767/1767 tests、0 failures**
- Identity / Continuity / Sovereignty 主线已进入成熟中后期
- Governance 基础链、high-risk control、branch governance 已成立
- Economic 主链（reward / claim / negotiation / settlement / ledger / feedback / orchestrator / writeback）已进入系统深接线阶段
- Operation Continuity canonical wiring、guarded resume semantics、restored work executable resume（第一版）已成立
- 最新轮次已新增并接通：`ExecutionGuard`、`ExecutionAuditTrail`、`ExecutionEconomicGate`、`GovernedSelfModGate`、`AgentPostureService`

当前全局审计口径已更新为：

> **ConShell 当前总体完成度约为 85%（置信度：中）**

这意味着：
- 项目已经不再处于“主干未立”的阶段
- 也不应继续把剩余工作拆得过碎
- 当前最合理的策略已从“逐轮探索”切换为：

> **把所有剩余真正需要开发的内容，一次性纳入同一轮 completion-first 总收口。**

因此 Round 19.2 不再是单主线轮，也不再是局部增强轮，而是：

> **ConShell 剩余开发总收口轮 / One-Round Remaining Development Closure**

也就是说：
- **把当前所有剩余需要开发的内容一次性纳入同一个轮次目标**
- **优先一次性补齐决定终局的所有主线能力**
- **本轮后只允许查漏补缺，不再继续大规模定义新主线**

---

## 一、本轮唯一总目标

**把当前剩余所有需要开发的核心主线，一次性收进同一轮，并尽可能做成“终局前最后一次大闭环开发”。**

一句话解释：

> **19.2 要做的不是“继续推进一部分剩余工作”，而是“把剩余所有真正重要的开发内容一次性收口”。**

---

## 二、本轮硬性战略原则

### P0. One-Round Completion-First Rule
从现在开始，默认不再以“再拆多轮”作为主策略。

本轮原则是：
1. **所有剩余核心开发内容尽量一次性纳入 19.2**
2. **优先做终局决定性主线，不做表面忙碌**
3. **本轮后主模式应切换为：查漏补缺 / 一致性修复 / 终局 polish**
4. **发布仍然不是本轮主目标**
5. **不允许再把关键剩余主线继续无限后移**

---

## 三、本轮必须一次性纳入的“全部剩余开发内容”

下面这些内容不是备选项，而是本轮要一次性纳入的**总闭环开发范围**。

# G1. High-Trust Continuous Autonomy Final Closure

这是剩余开发内容中的第一核心主线，但本轮不单独拆出，而是直接并入总收口。

### G1.1 必须完成
1. execution-time conflict reasoning 终局化
2. stale / duplicate / live-drift / partial-restore 规则终局化
3. agenda / queue / execution / scheduler state coherence 终局化
4. wake semantics / durable background operation
5. long-horizon mission continuity
6. resume → execution → completion → re-entry suppression 完整闭环
7. repeated restart / partial execution / in-flight conflict 的 fault discipline
8. execution audit 与 runtime truth 的统一出口

### G1.2 本轮验收标准
- 系统不只是“能恢复执行”
- 而是具备**高可信连续自治终局闭环**

---

# G2. Governed Self-Modification / Replication / Evolution Final Closure

### G2.1 必须完成
1. self-mod 全链：proposal → evaluation → approval → apply → verify → rollback → audit 终局化
2. `GovernedSelfModGate` 与治理 runtime 的主路径完全接通
3. pause / resume / quarantine / restore / revoke / kill 等能力生命周期完全治理化
4. replication viability 与 economic viability 统一
5. lineage / branch / child / inheritance / capability inheritance 收口
6. branch governance receipts / traceability / reversibility 统一
7. evolution changes 必须全部落在治理与生存边界内

### G2.2 本轮验收标准
- 自修改 / 复制 / 演化不再只是“有治理痕迹”
- 而是进入**真正的高可信治理统一闭环**

---

# G3. Full-System Economic Brain Final Closure

### G3.1 必须完成
1. `ExecutionEconomicGate` 完整进入 materializer / execution 主路径
2. survival / profitability / mandate 三层门控成为 execution-time canonical owner 之一
3. economic state 对 agenda / routing / execution / wake / autonomy 的更深统一
4. receive-first / spend-within-mandate / explicit transfer / viability constraints 收口
5. operator-facing economics truth / diagnostics / explainability 收口
6. lineage viability / replication budget / child funding 统一进入经济主链
7. 全系统 resource posture / survival posture 与 autonomy posture 对齐

### G3.2 本轮验收标准
- 经济层不只是 subsystem
- 而是**整机经济大脑**

---

# G4. OpenClaw Control Plane Full Absorption (Core Subset Must Land)

### G4.1 必须完成
1. multi-session orchestration 终局化
2. channels / sessions / tools / runtime workers 更深统一
3. gateway / cron / wake / node / remote control 的核心控制语义吸收
4. operator/control plane 的核心能力与 runtime 内生化对齐
5. session fabric / wake-trigger / scheduled autonomy 与 ConShell 主体对齐

### G4.2 边界说明
- 本轮优先吸收**终局决定性控制平面能力**
- 非关键 UI / 可视化修饰可后置到查漏补缺阶段

### G4.3 本轮验收标准
- 不能再只说“借鉴了 OpenClaw”
- 必须真正拥有其关键控制平面能力的**内生化版本**

---

# G5. Collective / Distributed Lifeform Runtime Final Closure

### G5.1 必须完成
1. collective governance
2. distributed authority / trust / reputation / resource coupling
3. child / lineage / branch / collective 之间的统一约束关系
4. collective runtime truth surface
5. group-level delegation / evolution / control semantics
6. collective 与 governance / economics / autonomy 的深耦合

### G5.2 本轮验收标准
- 系统不再只是“有 collective 模块”
- 而是进入**群体生命体运行时可用态**

---

# G6. Web4 / Operator Truth Externalization Final Closure

### G6.1 必须完成
1. `AgentPostureService` 从内部聚合器推进为外部可消费 truth surface
2. identity / economic / lineage / collective / governance posture 的 machine-readable 输出
3. diagnosis-first external truth plane
4. operator-facing overall health / verdict / posture summaries 收口
5. runtime truth / execution audit / governance receipts / economic diagnostics 的统一外化
6. 对外生命体姿态从“内部存在”推进到“外部可见、可验证、可操作”

### G6.2 本轮验收标准
- Web4 posture 不再只是口号或文档层
- 而是形成**统一 truth externalization layer**

---

# G7. System-Wide Consistency / Closure / Hardening

这是本轮必须贯穿所有主线的横向任务。

### G7.1 必须完成
1. 所有新引入 capability gate / truth surface / execution path 与主运行时一致
2. API / docs / tests / runtime behavior 对账
3. 不再保留旧路径 / legacy bypass / 临时桥接逻辑
4. 状态名、语义名、诊断名、receipt 名统一
5. 核心 fault discipline 跨主线对齐
6. 对“看起来完成但实际未主路径接通”的路径做最终清理

### G7.2 本轮验收标准
- 本轮后系统主语义必须明显更加统一、更加终局化

---

# G8. Full Test / Audit Closure

### G8.1 必须完成
1. 所有新增主线必须有对应测试
2. operation continuity / guard / audit / economic gate / posture / selfmod gate / lineage governance / collective governance 至少有一层直接测试覆盖
3. 必须继续保持：`pnpm vitest run src` 全绿
4. 必须为本轮关键闭环新增验证：
   - high-trust autonomy
   - governed selfmod lifecycle
   - execution-time economics
   - posture externalization
   - collective/distributed coherence
5. 本轮结束后必须可以重新做一次全局大审计，不再只是局部轮次播报

### G8.2 本轮验收标准
- 本轮不是“写了很多代码”
- 而是“终局前最后一次大规模真实可验证闭环开发”

---

## 四、本轮必须回答的终局问题

### Q1. 本轮结束后，ConShell 是否已经接近“只剩查漏补缺”的状态？
### Q2. 本轮结束后，是否已经拥有 Conway Automaton 与 OpenClaw 的关键终局能力骨架？
### Q3. 本轮结束后，Web4 方向下的生命体姿态是否已从内部实现推进到对外 truth surface？
### Q4. 本轮结束后，剩余工作是否可以从“主线开发”降级为“修补/对账/polish”？
### Q5. 本轮结束后，能否把下一阶段正式切换为“查漏补缺轮”？

---

## 五、本轮强制验收矩阵

### V1. 所有剩余核心开发内容已被一次性纳入本轮范围
### V2. P1–P6 主线都必须出现真实实现推进，而不是只推进其中一部分
### V3. 本轮后不得再把关键剩余主线继续拆成新的主开发轮
### V4. 本轮后项目状态应明显接近“只剩查漏补缺”
### V5. 全量核心测试必须继续全绿
### V6. 本轮成果必须足以支撑重新做一次全局大审计并上调完成度

---

## 六、本轮非目标

本轮不做：
- 不把发布重新抬成主线
- 不继续生成新的大而散路线图替代真实实现
- 不允许把关键剩余主线继续无限后延
- 不做与终局能力无关的表面忙碌工作

本轮真正目标是：

> **把剩余所有真正需要开发的内容一次性收进口袋，并尽可能在这一轮完成终局前的最后一次大闭环。**

---

## 七、真实性不变量

1. **不能因为本轮范围很大，就降低真实性标准**
2. **不能因为目标是一轮收口，就把“未接主路径”说成“已完成”**
3. **不能因为要一次性完成，就跳过测试、对账、fault discipline**
4. **所有新能力都必须优先落到 canonical path**
5. **本轮结束后，应能诚实回答“剩下的是不是只剩查漏补缺”**

---

## 八、最终输出要求

本轮完成后，必须能够输出：

### A. 19.2 详细真实性审计
### B. 更新后的全局大审计
### C. 新的总体完成度判断
### D. 剩余内容是否已降级为查漏补缺
### E. 若仍有剩余，只允许以“查漏补缺清单”形式存在

---

## 九、一句话任务定义

> **Round 19.2 的目标是：把 ConShell 当前剩余所有真正需要开发的内容一次性纳入同一轮并尽可能完成，让项目在本轮后从“仍有多条主线待开发”切换到“只剩查漏补缺与终局对账”的状态。**
