# DevPrompt 0191 — Round 18.1
## Settlement Governance Closure / Canonical Ledger Materialization / Profitability Feedback

你现在处于 **ConShellV2 Round 18.1**。

Round 18.0 并不是“从 0 到 1 完全没做”，但经过详细审计，真实状态也绝不是“全部完成”。

已经存在的 18.0 基础：
- `SettlementExecutionEngine`
- 最小 settlement lifecycle：`pending_verification -> verified/rejected -> adopted`
- `RevenueRealizationManager`
- `CanonicalLedgerAdopter`
- 4 个基础 API
- 1 组最小测试可跑通

这说明：

> **18.0 已经把 settlement runtime 的最小骨架立起来了。**

但审计也明确发现：
- execution phase 没有继续承接 mandate / policy / confirmation / explicit transfer 边界
- 没有正式 `SettlementExecutionRequest / Plan / Receipt` contract
- canonical ledger 还只是 adoption gate，不是真正 ledger truth layer
- profitability attribution 没有闭环
- survival / agenda feedback 没有接线
- truth surface 只有最低限 API，不是 operator 级诊断面
- V1-V10 并未被完整验证

因此，Round 18.1 的目标不是推倒 18.0，
也不是重复做“能不能 settlement”。

本轮真正任务是：

> **把 18.0 的最小 settlement 原型收口成一个真正受治理、可记账、可归因、可诊断的 runtime truth layer。**

---

## 一、本轮唯一主目标

**完成 Settlement Governance Closure + Canonical Ledger Materialization + Profitability Feedback Wiring。**

一句话解释：

18.0 解决的是“最小 execution / verification / realization 骨架”；
18.1 必须解决的是：

- execution 是否真的继续受治理边界约束
- verified outcome 是否真的形成 canonical ledger truth
- realized outcome 是否真的进入 profitability / survival / agenda feedback
- operator 是否真的能看见 settlement 全链状态与失败原因

---

## 二、本轮必须回答的核心问题

### Q1. execution 是不是仍然被 mandate / policy / human confirmation 约束？
如果答案不是“是”，18.0 就只是半安全原型。

### Q2. adopted result 有没有真正进入 canonical ledger truth？
如果没有，所谓“adoption”只是布尔标记，不是真正账本。

### Q3. realized revenue / spend 有没有真正绑定 task / service / agenda / runtime economics？
如果没有，所谓“revenue realization”还没有价值闭环。

### Q4. operator 能不能直接看见 pending / verified / failed / adopted / realized / profitability 状态？
如果不能，truth surface 仍然不成立。

---

## 三、本轮必须完成的内容

# G1. Execution Governance Re-Validation Layer

把 17.7 / 17.9 的治理边界继续推进到 execution phase。

### G1.1 必须建立正式 execution authorization contract
建议新增类似对象：
- `SettlementExecutionRequest`
- `SettlementExecutionAuthorization`
- `SettlementExecutionPlan`

### G1.2 `SettlementExecutionRequest` 至少应表达
- `executionId`
- `negotiationId`
- `requirementId`
- `selectedOfferId`
- `providerId`
- `amountAtomic`
- `asset`
- `network`
- `settlementKind`
- `purpose`
- `riskLevel`
- `requiresHumanConfirmation`
- `confirmationState`
- `mandateSnapshot`
- `policySnapshot`
- `capabilitySnapshot`
- `preparedAt`
- `expiresAt`

### G1.3 execution 提交前必须再次校验
- mandate 仍有效
- policy 未漂移
- selected provider / network 仍被允许
- human confirmation（若必需）已存在
- explicit transfer 仍然不可自动执行
- negotiation 与 execution 间关键条件未发生 drift

### G1.4 execution 权限结果至少区分
- `authorized_for_execution`
- `requires_human_confirmation`
- `forbidden_to_execute`
- `expired_before_execution`
- `drifted_since_negotiation`

### G1.5 目标
让 settlement execution 不再默认信任 negotiation 结果，
而是成为一个**再次经过治理边界授权**的动作。

---

# G2. Full Settlement Lifecycle State Machine

把当前极简状态机升级为正式 lifecycle。

### G2.1 至少建立以下状态
- `planned`
- `awaiting_human_confirmation`
- `authorized_for_execution`
- `submitted`
- `proof_pending`
- `verified`
- `rejected`
- `failed`
- `expired`
- `adopted_into_ledger`

### G2.2 必须明确状态迁移约束
- 未授权不能 `submitted`
- 需要人工确认但未确认不能执行
- proof 未完成不能 `verified`
- `verified` 前不能 adoption
- `expired` / `failed` / `rejected` 不能被误标为已入账
- 已 adoption 的 execution 不得再次 adoption

### G2.3 必须支持失败原因模型
建议新增：
- `SettlementFailure`
- `SettlementRejectionReason`
- `SettlementExpiryReason`

### G2.4 目标
让 settlement 真正可审计、可恢复、可诊断，而不是只有 happy path。

---

# G3. Receipt Contract + Verification Formalization

把当前 mock verifier 升级为正式 receipt verification layer。

### G3.1 必须新增正式 contracts
- `SettlementReceipt`
- `VerificationEvidenceBundle`
- `SettlementVerificationResult`
- `VerificationFailureReason`

### G3.2 `SettlementReceipt` 至少包含
- `receiptId`
- `executionId`
- `providerId`
- `externalReference`
- `amountAtomic`
- `asset`
- `network`
- `receivedAt`
- `rawPayloadDigest`
- `statusHint`

### G3.3 `SettlementVerificationResult` 至少要区分
- `verified_success`
- `verified_failure`
- `verification_inconclusive`
- `receipt_invalid`
- `receipt_duplicate`
- `provider_mismatch`
- `amount_mismatch`
- `expiry_mismatch`
- `network_mismatch`

### G3.4 建议建立 adapter 边界
- `SettlementVerifier`
- `ReceiptNormalizer`
- `ProviderExecutionAdapter`

### G3.5 目标
verification 不能继续只是 `mockOutcome`。
本轮必须让 verification 成为正式 contract 层，即使 provider breadth 仍可先 limited。

---

# G4. Canonical Ledger Materialization

把当前 adoption gate 升级为真正 ledger truth layer。

### G4.1 必须新增正式 ledger records
- `SettlementLedgerEntry`
- `IncomeLedgerEntry`
- `SpendLedgerEntry`
- `PendingSettlementEntry`
- `FailedSettlementEntry`

### G4.2 每条 canonical ledger entry 至少要记录
- `entryId`
- `direction`（income / spend）
- `requirementId`
- `negotiationId`
- `executionId`
- `receiptId`
- `providerId`
- `amountAtomic`
- `normalizedAmount`
- `asset`
- `network`
- `purpose`
- `verificationStatus`
- `adoptedAt`
- `attributionTarget`
- `metadata`

### G4.3 adoption 规则必须明确
- 只有 `verified_success` 才能进入 canonical ledger
- duplicate receipt / duplicate adoption 必须被拦截
- `failed` / `rejected` / `expired` 应形成失败或 pending truth，而不是消失

### G4.4 目标
让 canonical ledger 成为真正可查询、可解释、可归因的经济真相层。

---

# G5. Revenue / Spend Realization Attribution Closure

把 realized outcome 正式绑定到价值归因对象。

### G5.1 至少支持 attribution target
- task
- service
- agenda item
- session
- runtime operation

### G5.2 至少明确区分
- realized income
- realized spend
- pending settlement
- failed settlement
- verification-only event

### G5.3 至少新增 summary / record
- `RevenueRealizationSummary`
- `SpendRealizationSummary`
- `ProfitabilityAttributionRecord`

### G5.4 必须回答
- 这笔钱属于哪个任务/服务
- 这是收入还是支出
- 该对象当前累计利润是多少
- 哪些事件只是 negotiation/attempt，不应算真实收入

### G5.5 目标
从“金额拆分”升级到“价值归因闭环”。

---

# G6. Profitability Feedback Wiring

本轮必须把 settlement adoption 接入 profitability 与 runtime economics。

### G6.1 至少形成以下接线
- realized income → profitability metrics update
- realized spend → cost basis update
- failed settlement → no fake profit
- repeated verification failure → provider risk signal

### G6.2 至少新增/升级能力
- per-task profitability snapshot
- per-service profitability snapshot
- revenue vs spend net result summary
- settlement-derived risk signal

### G6.3 目标
让 settlement 结果不只是静态记录，而是改变价值判断层。

---

# G7. Survival / Agenda Feedback Coupling

18.1 至少要完成第一版系统反馈接线。

### G7.1 至少支持
- realized income → balance / reserve / runway update input
- realized spend → burn / cost pressure update input
- repeated failed settlements → operator attention / provider downgrade signal
- profitability result → agenda prioritization hint

### G7.2 可接受的第一版标准
不要求一次做成完整自治优化器，
但必须让 adopted outcomes **至少进入**：
- economic state service
- or profitability evaluator
- or agenda prioritization input

### G7.3 目标
让 settlement 不再是 isolated subsystem。

---

# G8. Truth Surface & Operator Diagnostics Closure

把 18.0 的 4 个基础 API 升级为可诊断 truth surface。

### G8.1 至少新增/升级可读面
- `SettlementExecutionSummary`
- `SettlementVerificationSummary`
- `SettlementLedgerSummary`
- `RevenueRealizationSummary`
- `ProfitabilitySummary`

### G8.2 operator 至少要能看到
- 哪些 settlement 在 `awaiting_human_confirmation`
- 哪些在 `proof_pending`
- 哪些 verification 失败、为什么失败
- 哪些已 adopted into ledger
- 哪些已成为 realized income / spend
- 哪些 provider 近期 mismatch / invalid / timeout 较多

### G8.3 建议 API（命名可调，但语义必须完整）
- `GET /api/economic/settlements`
- `GET /api/economic/settlements/pending`
- `GET /api/economic/settlements/verification`
- `GET /api/economic/ledger`
- `GET /api/economic/revenue`
- `GET /api/economic/profitability`

### G8.4 目标
让 operator 直接看见 settlement 全链状态，而不是只能猜内部有没有成功。

---

# G9. Audit-Grade Failure Handling

本轮必须把失败路径产品化，而不是只在测试里断言。

### G9.1 至少处理
- duplicate receipt
- stale negotiation
- drifted execution context
- expired execution authorization
- provider mismatch
- amount mismatch
- network mismatch
- verification timeout
- verification inconclusive
- double adoption

### G9.2 必须做到
- 失败要有 typed reason
- 失败要进入 audit log / truth surface
- 失败不能污染 canonical revenue/spend truth

### G9.3 目标
让失败路径成为 runtime 的一等公民。

---

## 四、本轮强制验收矩阵

### V1. execution request / authorization / plan contracts 正式成立
### V2. settlement lifecycle state machine 覆盖 planned → confirmation → submitted → proof_pending → verified/adopted 等主路径
### V3. explicit transfer / mandate / policy / confirmation 边界在 execution phase 继续成立
### V4. receipt verification layer 能表达 duplicate / mismatch / invalid / inconclusive / success
### V5. canonical ledger entries 可查询且具有 direction / attribution / verification truth
### V6. realized income / spend 与 pending / failed 被正式区分
### V7. profitability attribution 能绑定 task / service / agenda target
### V8. adopted outcomes 至少完成第一版 survival / agenda feedback 接线
### V9. truth surface 能暴露 pending / verification / ledger / revenue / profitability summaries
### V10. 18.0 的最小功能不回归，且 17.7 / 17.8 / 17.9 安全边界无回归

### 测试要求
- 不能只测 happy path
- 必须覆盖 execution drift / expired authorization / missing human confirmation
- 必须覆盖 duplicate receipt / amount mismatch / provider mismatch / verification timeout
- 必须覆盖 failed / rejected / expired 不得 adoption
- 必须覆盖 realized spend / realized income 的方向区分
- 必须覆盖 attribution target 缺失时的拒绝或降级策略
- 必须覆盖 adopted outcome 对 profitability / economic state summary 的反馈

---

## 五、建议执行顺序

### Priority 1 — Execution authorization & lifecycle contracts
先补 execution governance closure 与完整状态机。

### Priority 2 — Receipt / verification formalization
再把 verifier 从 mock 升级为正式 receipt contract 层。

### Priority 3 — Canonical ledger materialization
把 adoption gate 升级为正式 ledger truth。

### Priority 4 — Realization attribution & profitability
把收入/支出绑定到 task / service / agenda。

### Priority 5 — Survival / agenda feedback
让 adopted outcomes 进入系统反馈层。

### Priority 6 — Truth surface / diagnostics
最后把 operator 面补齐。

---

## 六、本轮非目标

本轮不做：
- 不追求大量 provider breadth
- 不做 unrestricted autonomous payout
- 不做 general-purpose wallet platform
- 不为了“好看”把 verification mock 包装成真实 verifier
- 不在没有 attribution / ledger truth 的情况下宣称 full value closure

本轮真正目标是：

> **把 18.0 的 settlement 原型收口为受治理、可记账、可归因、可反馈、可诊断的 runtime truth layer。**

---

## 七、硬性安全不变量

以下规则本轮绝不能破：

1. **execution 不能绕过 mandate / policy / confirmation / firewall**
2. **`explicit_transfer` 仍必须强人工确认**
3. **没有 verification success，不得 adoption into canonical ledger**
4. **没有 canonical ledger adoption，不得记作 realized truth**
5. **duplicate receipt / duplicate adoption / stale proof 必须被拦截**
6. **failed / rejected / expired 不得伪装成 realized revenue 或 spend**
7. **truth surface 必须区分 pending / verified / failed / adopted / realized**
8. **profitability / survival feedback 必须基于 adopted outcomes，而不是基于猜测或 negotiation 幻觉**

---

## 八、最终输出格式

完成后必须输出：

### A. Audit Closure Summary
- 18.0 审计识别的哪些缺口已被收口
- 哪些仍延期

### B. Execution Governance Summary
- execution authorization contract 如何定义
- mandate / policy / confirmation / explicit transfer 如何继续受控

### C. Lifecycle & Verification Summary
- settlement 生命周期如何演进
- receipt / verification 如何 formalize
- duplicate / mismatch / timeout / inconclusive 如何处理

### D. Canonical Ledger Summary
- 新增了哪些 ledger records
- income / spend / pending / failed 如何区分
- adoption truth 如何查询

### E. Profitability & Feedback Summary
- revenue/spend 如何归因到 task / service / agenda
- adopted outcome 如何进入 profitability / survival / agenda feedback

### F. Truth Surface Summary
- 新增了哪些 summary / API
- operator 现在能看见哪些状态和失败原因

### G. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 通过情况

### H. Risks / Deferred
- 哪些 provider-specific execution / deeper verifier adapters 留到 18.2+
- 哪些高级自治优化延后

### I. 不得伪造
- 没有 execution governance closure，不能说 settlement 安全边界闭环
- 没有 canonical ledger entries，不能说账本真相层已成立
- 没有 attribution / feedback wiring，不能说价值闭环已成立
- 没有 operator truth surface，不能说系统可诊断已完成

---

## 九、一句话任务定义

> **Round 18.1 的目标是：把 18.0 已落地的最小 settlement runtime 原型，升级为一个真正受治理边界约束、具备正式 receipt/verification contract、拥有 canonical ledger truth、可进行 revenue/spend attribution，并能把 adopted outcomes 反馈到 profitability / survival / agenda 的可诊断运行时真相层。**
