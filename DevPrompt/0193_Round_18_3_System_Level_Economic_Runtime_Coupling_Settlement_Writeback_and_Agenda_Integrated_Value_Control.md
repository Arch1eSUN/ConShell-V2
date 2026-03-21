# DevPrompt 0193 — Round 18.3
## System-Level Economic Runtime Coupling / Settlement Writeback / Agenda-Integrated Value Control

你现在处于 **ConShellV2 Round 18.3**。

Round 18.0 已建立：
- 最小 settlement execution / verification / realization 骨架

Round 18.1 已建立：
- governance layer
- canonical settlement ledger
- settlement feedback engine
- truth surface summaries

Round 18.2 已建立：
- `SettlementRuntimeService` 统一编排入口
- 17.9 → 18.2 bridge
- flowId 级 audit trail / trace
- resume / replay
- provider feedback 回流到 selection / trust score

这说明：

> **ConShell 的 settlement runtime 子系统主链已经成立。**

但 18.2 审计也确认了一个新的、决定性的剩余缺口：

> **settlement canonical flow 还没有真正深写回整个 ConShell 既有 economic runtime。**

也就是说，目前已经有：
- settlement flow 自身的治理、验证、账本、反馈、trace

但还没有形成真正的系统级耦合：
- adopted income / spend 没有正式进入 `economic-state-service`
- settlement-derived profitability 没有正式进入 `profitability-evaluator`
- settlement outcome 没有正式进入 `agenda-generator` / runtime prioritization
- settlement feedback 没有正式进入 `task-feedback-heuristic`
- truth surface 也还没有把 settlement 与全局 economic runtime 统一暴露成一个 cross-system economic truth

因此，Round 18.3 的任务不是继续扩展 settlement 子系统本身，
也不是去追更多 provider breadth。

本轮真正目标是：

> **把 18.2 已成立的 settlement canonical flow，正式耦合进 ConShell 的整体 economic runtime，让 settlement outcome 真正改变 balance / runway / profitability / agenda / task feedback / runtime posture。**

---

## 一、本轮唯一主目标

**建立 Settlement-to-System Economic Runtime Coupling Layer。**

一句话解释：

18.2 完成的是 settlement 自身主链；
18.3 必须完成的是 settlement outcome 对整个系统的真实写回与行为改变。

---

## 二、本轮必须回答的核心问题

### Q1. adopted income / spend 什么时候、如何进入 EconomicStateService？
如果没有这个接线，settlement 还不是系统级经济真相来源。

### Q2. profitability evaluator 如何消费 settlement result？
如果 settlement profit 只停留在 feedback engine，本体价值判断仍然分裂。

### Q3. agenda generator / runtime mode 是否会因为 settlement outcomes 改变？
如果不会，settlement 仍不能真正影响生命体行为。

### Q4. task feedback heuristic 是否能看到真实 settled outcomes？
如果不能，任务学习层依然与真实经济结果脱节。

### Q5. operator 能否看到一个统一的 cross-system economic truth，而不只是 settlement 子系统视角？
如果不能，系统级诊断仍未成立。

---

## 三、本轮必须完成的内容

# G1. Settlement Writeback to EconomicStateService

必须让 adopted settlement outcomes 正式进入现有经济状态系统。

### G1.1 至少建立明确 writeback contract
建议新增类似对象：
- `SettlementEconomicWriteback`
- `EconomicStateSettlementDelta`
- `SettlementAdoptionEffect`

### G1.2 必须至少表达
- direction（income / spend）
- amountCents
- providerId
- attributionTarget
- ledgerEntryId
- settlementFlowId
- appliedAt
- effectOnBalance
- effectOnBurnRate / reserve / runway（若适用）

### G1.3 至少接入现有一个真实入口
- `EconomicStateService`
- 或其上游 canonical economic state source

### G1.4 目标
让 settlement adoption 真正改变系统经济状态，而不是停留在 settlement 子系统内部统计。

---

# G2. Settlement-Aware ProfitabilityEvaluator Integration

必须把 settlement outcome 正式接入现有 profitability 判断链。

### G2.1 至少建立
- settlement-aware profitability inputs
- realized income/spend writeback to evaluator
- attribution-target based profitability update

### G2.2 至少支持
- task profitability from settled outcomes
- service profitability from settled outcomes
- agenda profitability from settled outcomes
- negative outcomes / failed settlements 不得记假利润

### G2.3 目标
让 profitability evaluator 的判断开始基于真实 settled truth，而不是只基于预测或孤立输入。

---

# G3. Settlement-Aware TaskFeedbackHeuristic Integration

必须把 settlement result 接入任务反馈学习层。

### G3.1 至少支持
- successful settled revenue → positive task realization signal
- failed settlement / inconclusive / repeated provider mismatch → negative signal
- task-level realization ratio 或 settlement quality signal

### G3.2 至少建立
- settled outcome → task feedback event
- provider failure → heuristic penalty source

### G3.3 目标
让任务反馈系统看到“真实收钱/真实支出”结果，而不是只看抽象执行成败。

---

# G4. Settlement-Aware Agenda / Runtime Prioritization Coupling

必须让 settlement outcome 真正开始影响 agenda 与 runtime posture。

### G4.1 至少支持
- realized profitable surfaces / tasks 获得优先级加权
- repeated failed settlement surfaces / providers 被降权
- income realization 改变 runtime economic posture signal
- spend pressure / failed monetization 影响 agenda hints

### G4.2 可接受的第一版
不要求一次做成高度复杂自治调度器，
但必须至少接入：
- `agenda-generator`
- 或其上游 economic prioritization input

### G4.3 目标
让 settlement outcome 影响行为，不只是影响报表。

---

# G5. Cross-System Economic Truth Surface

必须把 settlement 与全局 economic runtime 汇总成统一 truth surface。

### G5.1 至少新增/升级类似 summary
- `SystemEconomicTruthSummary`
- `SettlementWritebackSummary`
- `RuntimeEconomicImpactSummary`
- `AgendaEconomicInfluenceSummary`

### G5.2 operator 至少应能看到
- settlement adopted 了哪些金额
- 这些金额如何改变 balance / runway / profitability
- 哪些任务/服务因 settled outcomes 被上调或下调
- 哪些 provider risk 已真实影响 routing / prioritization
- 当前 runtime posture 是否因 settlement results 改变

### G5.3 建议 API（命名可调）
- `GET /api/economic/runtime-truth`
- `GET /api/economic/runtime-impact`
- `GET /api/economic/settlement-writeback`
- `GET /api/economic/agenda-influence`

### G5.4 目标
让 operator 看到“settlement 如何改变整个经济运行时”，而不是继续看多个孤立 summary。

---

# G6. Writeback Idempotency & Consistency Rules

一旦 settlement 开始写回系统主状态，必须严格控制幂等与一致性。

### G6.1 必须防止
- 同一 ledger entry 重复写回 economic state
- 同一 flow 重复增加 profitability
- replay / resume 导致重复 agenda 加权
- failed settlement 被写成 realized state delta

### G6.2 建议建立
- writeback ledger / applied effect registry
- `appliedEffectId`
- sourceEntryId / sourceFlowId idempotency guard

### G6.3 目标
系统级写回不能制造第二层账本污染。

---

# G7. Runtime Mode / Survival Posture Coupling

18.3 必须至少完成一版 settlement result 对 runtime mode / survival posture 的真实作用。

### G7.1 至少支持
- realized income 改善 survival pressure input
- realized spend 增加 burn / pressure input
- repeated failed settlement 触发 caution / degraded monetization signal
- profitability trend 影响 mode hint（例如 revenue-seeking / survival-recovery 的输入信号）

### G7.2 目标
让 settlement outcome 从“财务事件”升级为“运行时姿态输入”。

---

# G8. Provider Feedback Beyond Trust Score

18.2 已经开始对 provider 做 trust score 加减分；18.3 应进一步把这个结果纳入更真实的 routing / runtime economics。

### G8.1 至少支持
- trust score changes reflected in selection decisions
- failure-heavy provider 降低优先级
- settlement success / failure 形成 provider quality summary
- provider quality 进入 runtime truth surface

### G8.2 目标
避免 provider feedback 只是内部计数器，而要成为真实决策输入。

---

# G9. Full-System End-to-End Tests

本轮必须从“settlement 子系统 E2E”升级为“全系统经济耦合 E2E”。

### G9.1 至少覆盖
- settlement adoption → economic state delta applied
- settlement adoption → profitability updated
- settlement adoption → task feedback updated
- settlement adoption → agenda/runtime hint updated
- failed settlement → no fake writeback
- replay/resume → no duplicate writeback
- provider risk change → selection/runtime truth visible

### G9.2 目标
证明 18.3 不是又一层 isolated module，而是真正改动了现有主运行时。

---

## 四、本轮强制验收矩阵

### V1. adopted settlement outcomes 可正式写回 EconomicStateService 或等价主状态入口
### V2. settled income/spend 可进入 ProfitabilityEvaluator 或等价利润主判断链
### V3. settled outcomes 可进入 TaskFeedbackHeuristic 或等价任务反馈学习层
### V4. settled outcomes 至少影响一条真实 Agenda / runtime prioritization 输入
### V5. cross-system economic truth surface 能统一暴露 settlement → runtime impact
### V6. writeback 具备 sourceEntry/sourceFlow 级幂等保护
### V7. failed / inconclusive / replayed flows 不会制造 fake economic deltas
### V8. provider feedback 不只是记分，还能真实影响选择/优先级/真相面
### V9. 18.2 canonical settlement flow 不回归
### V10. 17.9 / 18.0 / 18.1 / 18.2 的治理与安全边界无回归

### 测试要求
- 必须新增 full-system coupling tests，而不只是 settlement orchestrator tests
- 必须验证 settlement adoption 后，existing runtime economic module 的状态确实改变
- 必须验证 failed / rejected / inconclusive 不写入系统级 truth
- 必须验证 replay / resume 不会重复 writeback
- 必须验证 provider penalties / bonuses 真实影响 selection or runtime summary
- 必须验证 operator 能从 truth surface 看到 settlement → runtime impact

---

## 五、建议执行顺序

### Priority 1 — Settlement writeback → EconomicStateService
先把 adopted outcomes 正式写回主状态系统。

### Priority 2 — Profitability / task feedback integration
再把 settled truth 接入利润判断与任务反馈层。

### Priority 3 — Agenda / runtime posture coupling
再让 settled truth 影响行为调度。

### Priority 4 — Cross-system truth surface
把所有写回结果统一暴露给 operator。

### Priority 5 — Idempotency / consistency hardening
最后补强系统级写回一致性与防重。

---

## 六、本轮非目标

本轮不做：
- 不追求更多 provider breadth 作为主线
- 不再新增一套平行 settlement runtime
- 不把简单 summary 误当成 system integration
- 不在未接入 existing runtime 的情况下宣称 full economic closure

本轮真正目标是：

> **让 settlement canonical flow 真正改变 ConShell 的整个经济运行时。**

---

## 七、硬性安全不变量

以下规则本轮绝不能破：

1. **任何 system writeback 都必须来源于 verified + adopted settlement truth**
2. **failed / rejected / inconclusive flow 绝不能写成系统级 realized delta**
3. **replay / resume / duplicate adoption 不得造成重复 economic state writeback**
4. **provider feedback 不能基于预测，必须基于真实 settlement outcomes**
5. **agenda / runtime posture 变化必须有可追踪 settled evidence 来源**
6. **18.2 orchestrator 仍是唯一 canonical settlement flow**
7. **17.9-18.2 的治理、confirmation、verification、ledger adoption 边界不得回归**
8. **cross-system truth surface 必须清楚区分 settlement-layer truth 与 system-layer applied effects**

---

## 八、最终输出格式

完成后必须输出：

### A. System Coupling Summary
- settlement outcomes 写回了哪些 existing runtime systems
- 哪些模块已真正被耦合

### B. Economic State Writeback Summary
- balance / runway / reserve / burn 等哪些状态被影响
- writeback 如何保证幂等与一致性

### C. Profitability / Task Feedback Summary
- settled truth 如何进入 profitability evaluator 与 task feedback heuristic
- 哪些 target 现在会被真实更新

### D. Agenda / Runtime Influence Summary
- settled outcomes 如何影响 agenda / mode / prioritization
- 哪些 signals 被引入

### E. Cross-System Truth Surface Summary
- operator 新增能看到哪些 settlement → runtime impact 视图

### F. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 通过情况

### G. Risks / Deferred
- 哪些 deeper economic couplings / persistent replay / broader routing economics 留到 18.4+

### H. 不得伪造
- 没有 existing runtime writeback，不能说 system-level closure 成立
- 没有 agenda/runtime influence，不能说 settlement 已改变行为层
- 没有 idempotent writeback，不能说系统级经济真相安全
- 没有 cross-system truth surface，不能说 operator 已可全局诊断

---

## 九、一句话任务定义

> **Round 18.3 的目标是：把 18.2 已成立的 settlement canonical flow 正式写回 ConShell 现有 economic-state、profitability、task-feedback、agenda 与 runtime posture 系统，形成真正的 system-level economic runtime coupling，使 settlement outcome 不再只是子系统真相，而成为全系统经济行为与生存姿态的真实驱动输入。**
