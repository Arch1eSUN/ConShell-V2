# DevPrompt 0192 — Round 18.2
## Unified Settlement Orchestration / End-to-End Runtime Integration / Canonical Economic Chain

你现在处于 **ConShellV2 Round 18.2**。

Round 18.0 已建立：
- 最小 settlement execution / verification / realization / adoption 骨架

Round 18.1 已建立：
- `SettlementGovernanceLayer`
- `CanonicalSettlementLedger`
- `SettlementFeedbackEngine`
- 6 个 truth surface API
- 42/42 的本轮测试 + 18.0 4/4 回归通过

这说明：

> **ConShell 的 settlement runtime 已经具备了“治理层 / 账本层 / 反馈层 / 诊断层”的核心零件。**

但详细审计也确认了一个新的主缺口：

> **这些零件虽然都存在，却还没有被收口为一条统一的、端到端的 settlement runtime 主链。**

也就是说，目前更像是：
- 18.0 一组模块
- 18.1 一组模块
- 它们都挂进了 EKF
- 也都有各自测试

但还没有一个明确的 **orchestrator / application service** 负责把它们自动串起来，形成从 negotiation → execution authorization → submission → receipt → verification → ledger adoption → profitability feedback → survival / agenda update → truth surface / audit 的单一 canonical flow。

因此，Round 18.2 的目标不是再做新的孤立零件，
也不是转移到无关新题。

本轮真正任务是：

> **把 17.9、18.0、18.1 已有零件收口成一个统一的、端到端、可追踪、可审计、可恢复的 settlement runtime 主链。**

---

## 一、本轮唯一主目标

**建立 Unified Settlement Runtime Orchestrator，并完成 17.9 → 18.0/18.1 → 既有 runtime economics 的端到端主链集成。**

一句话解释：

18.1 已把零件做出来；
18.2 必须把这些零件真正串成：

- 一个统一入口
- 一套 canonical orchestration
- 一条可追踪链路
- 一组真正写回现有 runtime 的反馈

---

## 二、本轮必须回答的核心问题

### Q1. settlement runtime 的唯一主入口是什么？
如果没有统一 orchestrator，系统仍是“模块拼盘”。

### Q2. 17.9 的 negotiation / preparation 结果如何自然进入 18.1 的 governed execution flow？
如果需要人工手工拼装对象，主链还没成立。

### Q3. verified / adopted settlement outcome 如何真正写回既有 runtime economics？
如果只停留在 settlement-feedback.ts 内部，就还不是系统级闭环。

### Q4. operator 能否看到同一笔 settlement 的全链路轨迹？
如果只能分别看 governance / ledger / profitability summary，就还不是单链真相面。

---

## 三、本轮必须完成的内容

# G1. Unified Settlement Runtime Service

必须建立一个明确的统一编排服务，作为 settlement runtime 的正式主入口。

### G1.1 建议新增类似组件
- `SettlementRuntimeService`
- `SettlementOrchestrator`
- `SettlementPipelineService`

命名可调，但职责必须唯一且清晰。

### G1.2 该服务至少负责
- 从 17.9 negotiation / preparation 生成 execution request
- 调用 governance authorization
- 处理 submission / receipt intake
- 调用 verification
- 进行 canonical ledger adoption
- 触发 profitability / survival / agenda feedback
- 记录全链 audit / correlation id

### G1.3 必须形成统一 correlation model
至少引入并贯穿：
- `settlementFlowId`
- `negotiationId`
- `requirementId`
- `executionRequestId`
- `receiptId`
- `ledgerEntryId`
- `feedbackEventIds`

### G1.4 目标
让 settlement runtime 从“多个好模块”升级为“一个真正的 canonical application flow”。

---

# G2. Bridge 17.9 Negotiation / Preparation → 18.2 Orchestration

必须打通 17.9 到 18.2 主链。

### G2.1 至少建立转换层
- `PaymentNegotiationResult` / `PaymentPreparationIntent`
  → `SettlementExecutionRequest`

### G2.2 转换必须保留或映射
- requirement / negotiation / selected offer
- provider / asset / network / amount
- risk level
- mandate / policy / capability snapshots
- confirmation requirement
- purpose / attribution candidate

### G2.3 必须处理的情况
- negotiation rejected → 不进入 settlement runtime
- require_human_confirmation → 进入 pending confirmation 分支
- stale preparation intent → 拒绝进入 execution
- provider drift after negotiation → 进入 governance failure

### G2.4 目标
让 settlement runtime 真正承接 17.9，而不是与 17.9 平行存在。

---

# G3. End-to-End Runtime Flow Contract

必须定义统一的 runtime flow result，而不是让调用方自己拼装多层返回值。

### G3.1 建议新增正式 contract
- `SettlementRuntimeFlowRequest`
- `SettlementRuntimeFlowResult`
- `SettlementRuntimeFlowStage`
- `SettlementFlowAuditTrail`

### G3.2 `SettlementRuntimeFlowResult` 至少应表达
- `flowId`
- `finalStage`
- `finalStatus`
- `authorizationDecision`
- `verificationOutcome`
- `ledgerAdoptionResult`
- `profitabilityEffects`
- `survivalEffects`
- `operatorActionRequired`
- `failureReason`

### G3.3 必须支持的 finalStatus 至少包括
- `blocked_before_execution`
- `awaiting_human_confirmation`
- `awaiting_receipt`
- `verification_inconclusive`
- `rejected`
- `adopted`
- `feedback_applied`
- `failed`

### G3.4 目标
让上层调用一次就能得到完整 flow 结论，而不是自己理解多子系统状态。

---

# G4. Canonical Audit Chain

必须把 settlement 全链路变成可追踪审计链。

### G4.1 至少建立 audit/correlation records
- flow started
- authorization decision
- submission accepted
- receipt received
- verification completed
- ledger adopted
- feedback applied
- flow failed / blocked / pending

### G4.2 每个事件至少带
- `flowId`
- `stage`
- `timestamp`
- `status`
- `reason`
- `linked ids`

### G4.3 目标
operator / auditor 必须能追踪“一笔 settlement 究竟发生了什么”。

---

# G5. Bridge Settlement Feedback → Existing Runtime Economics

本轮必须把 18.1 feedback engine 的结果继续写回现有 runtime，而不是只停在本地汇总。

### G5.1 至少接入一类既有系统
- `economic-state-service`
- `profitability-evaluator`
- `agenda-generator`
- `task-feedback-heuristic`
- 其他现有 runtime economics 层

### G5.2 最低可接受标准
- adopted income / spend 至少能影响一个真实现有系统的输入
- provider risk signal 至少能影响 provider selection / routing hints 或 operator diagnostics
- survival/profitability feedback 至少有一条可验证的系统接线

### G5.3 目标
让 settlement 反馈成为“全系统信号”，而不是“新模块内部统计”。

---

# G6. Provider Selection / Routing Feedback Loop

18.2 应开始把 settlement 结果反向作用于 17.9 provider selection。

### G6.1 至少支持
- provider success / failure statistics feedback
- risk-adjusted routing hint
- failure-heavy providers 的 penalty
- verification mismatch providers 的 downgrade signal

### G6.2 可接受实现
不要求一次做复杂机器学习，
但必须让：
- settlement verification outcomes
- adoption success/failure
- provider risk signal

至少有一条明确回流到 selection / routing decision 的通路。

### G6.3 目标
让 payment negotiation 不再只看静态配置，而开始看真实 settlement 后果。

---

# G7. End-to-End Truth Surface

必须把现有多个 summary 收口成面向 operator 的全链路视图。

### G7.1 至少新增或升级类似接口
- `GET /api/economic/settlement-flows`
- `GET /api/economic/settlement-flows/:id`
- `GET /api/economic/settlements/:executionRequestId/trace`

命名可调，但必须提供全链 trace 能力。

### G7.2 operator 至少应能看到
- 本 flow 是从哪个 negotiation 来的
- 为什么被授权 / 被阻止
- receipt 是否收到
- verification 结果是什么
- 是否 adopted into ledger
- 产生了哪些 profitability / survival / provider-risk effects
- 当前是否需要人工介入

### G7.3 目标
让 truth surface 从“多个 summary 页面”升级为“单笔 flow 可追踪”。

---

# G8. Failure Recovery / Replay Strategy

统一编排后，必须考虑恢复与重放，而不是一次性 happy path。

### G8.1 至少处理
- authorization 后 receipt 长时间未到
- verification inconclusive 后重试
- 已收 receipt 但 feedback 未应用
- ledger 已 adopt 但 truth surface/audit 未同步
- flow 中途失败后的 resume / replay

### G8.2 建议新增能力
- idempotent replay by flowId
- resumable stages
- safe retry boundaries
- operator-triggered recovery hooks

### G8.3 目标
统一主链不能是脆弱的一次性流水线。

---

# G9. 18.0 / 18.1 Legacy Path Consolidation

本轮必须开始处理旧路径并存问题。

### G9.1 至少明确
- 哪些路径已经 canonical
- 哪些仍是 legacy / compatibility path
- 哪些调用方应迁移到新 orchestrator

### G9.2 允许兼容，但不允许长期双真相
- 18.0 模块可以保留为底层 primitive
- 18.1 模块可以保留为 sub-layer
- 但从 18.2 开始，必须明确 **唯一主流程**

### G9.3 目标
避免未来出现：
- 一部分从 18.0 走
- 一部分从 18.1 走
- 一部分自己拼装

这会破坏 canonical truth。

---

## 四、本轮强制验收矩阵

### V1. 存在统一的 `SettlementRuntimeService` / orchestrator 主入口
### V2. 17.9 negotiation / preparation 可自动进入 governed settlement flow
### V3. flow result 能一次性表达 authorization / verification / adoption / feedback 结论
### V4. settlement 全链具有 `flowId` 级 correlation / audit trace
### V5. adopted outcomes 至少接入一个既有 runtime economics 系统
### V6. provider risk / success feedback 至少开始回流到 selection / routing
### V7. truth surface 支持单笔 settlement flow trace
### V8. failure / pending / inconclusive path 支持安全恢复或重放策略
### V9. 18.0 / 18.1 模块被收为新主链的底层 primitive，而不是继续平行主入口
### V10. 17.9 / 18.0 / 18.1 的安全边界与现有能力无回归

### 测试要求
- 必须有 end-to-end flow tests，而不只是模块单测
- 必须覆盖：negotiation → authorization → receipt → verification → ledger → feedback 全链 happy path
- 必须覆盖：human confirmation pending path
- 必须覆盖：verification inconclusive + replay/resume
- 必须覆盖：provider failure → risk feedback → routing hint update
- 必须覆盖：legacy primitives 仍可工作，但新 orchestrator 成为 canonical path
- 必须覆盖：flow trace API 返回完整链路信息

---

## 五、建议执行顺序

### Priority 1 — SettlementRuntimeService / orchestrator
先建立唯一主入口与 flow contract。

### Priority 2 — Bridge 17.9 → 18.2
打通 negotiation / preparation 到 governed execution。

### Priority 3 — Audit/correlation chain
把 flowId 与全链 trace 建起来。

### Priority 4 — Feedback write-back to existing runtime
让 adopted outcomes 真正写回现有 economics/runtime。

### Priority 5 — Routing feedback loop
让 provider risk / success 开始影响 selection。

### Priority 6 — Truth surface trace + replay/recovery
最后补 operator 可追踪与恢复能力。

---

## 六、本轮非目标

本轮不做：
- 不去追更多 provider breadth 作为主线
- 不转向 unrelated 新功能
- 不再新增一组平行 settlement 子系统
- 不用更多 summary 掩盖缺少统一 orchestration 的事实

本轮真正目标是：

> **把现有 settlement 零件收成唯一的端到端 runtime 主链。**

---

## 七、硬性安全不变量

以下规则本轮绝不能破：

1. **统一 orchestrator 不能绕过 governanceLayer 的授权边界**
2. **`explicit_transfer` 仍必须强人工确认**
3. **没有 verification success，不得 ledger adoption**
4. **没有 canonical ledger adoption，不得记作真实 feedback 或 realized truth**
5. **flow replay / recovery 必须幂等，不得制造重复 adoption / 重复 profit**
6. **provider feedback 不得基于幻觉或 negotiation 预测，必须基于真实 settlement outcomes**
7. **truth surface 必须可区分 blocked / pending / inconclusive / failed / adopted / feedback_applied**
8. **legacy path 兼容可以存在，但 canonical truth 只能有一条主链**

---

## 八、最终输出格式

完成后必须输出：

### A. Orchestration Summary
- 新增了什么统一 orchestrator / runtime service
- 为什么它是 canonical path

### B. Bridge Summary
- 17.9 negotiation / preparation 如何进入 18.2 settlement flow
- 18.0 / 18.1 primitives 如何被吸纳

### C. Audit Chain Summary
- flowId / trace / correlation 如何设计
- operator 如何追踪单笔 settlement

### D. Runtime Feedback Summary
- adopted outcome 写回了哪些现有 runtime systems
- provider feedback 如何影响 routing/selection

### E. Truth Surface Summary
- 新增了哪些 trace / flow APIs
- operator 现在能看到哪些全链状态

### F. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 通过情况

### G. Legacy Consolidation Summary
- 哪些旧路径保留为 primitives
- 哪些入口已被 canonical orchestrator 替代

### H. Risks / Deferred
- 哪些 deeper provider adapters / advanced replay orchestration 留到 18.3+

### I. 不得伪造
- 没有统一 orchestrator，不能说 runtime 主链已成立
- 没有真实 write-back 到既有 runtime，不能说系统级反馈闭环已成立
- 没有 flow trace / correlation，不能说全链可审计已成立
- legacy 多主入口若仍并存，不能说 canonical path 已完全收口

---

## 九、一句话任务定义

> **Round 18.2 的目标是：建立统一的 Settlement Runtime Orchestrator，把 17.9 的 negotiation/preparation、18.0 的 execution primitives、18.1 的 governance/ledger/feedback/truth surface 吸收到同一条端到端主链中，并让 adopted outcomes 真正写回现有 runtime economics / routing / diagnostics，形成唯一 canonical settlement flow。**
