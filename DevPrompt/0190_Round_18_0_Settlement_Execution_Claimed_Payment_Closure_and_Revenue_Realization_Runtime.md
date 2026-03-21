# DevPrompt 0190 — Round 18.0
## Settlement Execution / Claimed Payment Closure / Revenue Realization Runtime

你现在处于 **ConShellV2 Round 18.0**。

Round 17.7 已完成：
- Economic Identity
- Capability Envelope
- Mandate Engine
- Economic Instruction Firewall
- Economic Audit Event foundation
- Economic Kernel Foundation

Round 17.8 已完成：
- Economic Truth Surface
- Economic diagnostics / summaries
- RewardDefinition / EligibilityRule
- ClaimAttempt / ClaimReceipt
- Anti-duplication rules
- Control surface upgrade

Round 17.9 的目标已经明确：
- PaymentRequirement / PaymentOffer / PaymentNegotiationRequest / PaymentNegotiationResult
- payment negotiation decision engine
- provider selection / policy-bound economic routing
- ConShell-native 402 response model
- payment preparation intent
- negotiation audit trail / pending confirmation / rejection reasons

这意味着：

ConShell 的经济层已经不再停留在“知道可以不可以付”，
而应该进入下一步：

> **把 payment negotiation / preparation 进一步推进成真实可结算、可核验、可入账、可闭环的 settlement execution runtime。**

但要强调：

Round 18.0 也**不是**“开放无限制自动转账”，
更不是“做一个随便能花钱的钱包执行器”。

本轮真正目标是：

> **在不破坏 mandate / firewall / policy / human confirmation 边界的前提下，把 payment preparation 推进到可执行 settlement、可验证 payment proof、可产生收入记账与任务价值闭环的正式 runtime 层。**

---

## 一、本轮唯一主目标

**建立 ConShell Settlement Execution & Revenue Realization Runtime。**

也就是让 ConShell 不仅能：
- 知道某个资源需要支付
- 决定是否允许 / 切换 provider / 要不要人工确认

还必须能继续完成：
- 生成正式 settlement execution plan
- 对接受限 payment executor / verifier
- 验证 payment proof / settlement receipt
- 将成功支付或成功收款写入统一经济账本
- 将 payment outcome 反馈回任务收益、survival、agenda 与 truth surface

本轮重点不在“provider 数量”，
也不在“链上炫技”，
而在：

> **让 payment negotiation 之后的 execution / verification / accounting / realization 真正进入同一条 runtime 主链。**

---

## 二、为什么 Round 18.0 应该做这个

### F1. 17.9 解决的是“能不能付、如何决定付”
17.9 的本质是 negotiation / routing / preparation。
它解决的是：
- requirement 怎么表达
- policy / mandate / firewall 怎么参与
- provider 怎么选
- 什么情况 require human confirmation

但它**没有天然等于**：
- 真正执行 settlement
- 获得可信 payment proof
- 将 payment result 写入 canonical ledger
- 将收入/支出结果反向耦合 survival / agenda / profitability

### F2. 如果现在不做 execution closure，17.9 会停留在半闭环
那样 ConShell 仍然只是：
- 会谈判
- 会准备
- 会给出 402 / decision / pending status

却还不是：
- 真正能完成支付闭环
- 真正能确认收入已到账
- 真正能用 payment result 改变 runtime economic state

### F3. 只有 execution + verification + accounting + realization 接起来，经济层才开始接近真实闭环
ConShell 必须从：
- payment requirement
- negotiation decision
- execution plan
- settlement receipt / proof
- accounting adoption
- profitability / survival feedback

形成完整链条。

这才是 Round 18.0 的正确主线。

---

## 三、本轮必须完成的内容

# G1. Settlement Execution Contract

建立正式的 settlement execution contract，作为 negotiation 之后的下一层协议对象。

### G1.1 建议新增类似结构
- `SettlementExecutionRequest`
- `SettlementExecutionPlan`
- `SettlementExecutionResult`
- `SettlementReceipt`
- `SettlementFailure`
- `SettlementVerificationResult`

### G1.2 SettlementExecutionRequest 至少应表达
- `executionId`
- `negotiationId`
- `requirementId`
- `selectedOfferId`
- `providerId`
- `asset`
- `network`
- `amountAtomic`
- `settlementKind`
- `purpose`
- `riskLevel`
- `requiresHumanConfirmation`
- `mandateSnapshot`
- `policySnapshot`
- `capabilitySnapshot`
- `expiresAt`
- `metadata`

### G1.3 SettlementExecutionPlan 至少应表达
- `planId`
- `executionId`
- `steps`
- `executorKind`
- `verificationStrategy`
- `confirmationRequirement`
- `rollbackStrategy`（如果适用）
- `expectedReceiptShape`
- `auditBindings`

### G1.4 目标
让 settlement execution 不再是松散回调或 provider-specific ad-hoc 逻辑，
而是正式 machine-readable runtime object。

---

# G2. Execution State Machine

建立 settlement lifecycle 的正式状态机。

### G2.1 至少支持类似状态
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

### G2.2 必须有明确的状态迁移约束
例如：
- 未授权不能 `submitted`
- 需要人工确认但未确认不能进入 execution
- `verified` 前不能记作 canonical success
- `adopted_into_ledger` 必须发生在 verification 之后
- `failed / rejected / expired` 不能伪装成收入或已支付成功

### G2.3 目标
让 settlement lifecycle 成为可审计、可重放、可诊断的正式 runtime 流程，而不是 scattered events。

---

# G3. Human Confirmation Boundary Hardening

本轮必须继续强化人工确认边界，而不是削弱。

### G3.1 至少明确区分
- `can_auto_execute`
- `requires_human_confirmation`
- `forbidden_to_execute`

### G3.2 以下情况至少必须 require human confirmation 或直接拒绝
- `explicit_transfer`
- 超过 mandate 金额上限
- 高 risk settlement kind
- provider / network 超出 policy allowlist
- negotiation 与 execution 间关键条件发生漂移

### G3.3 目标
Round 18.0 不能把 execution closure 做成“安全边界消失”。
相反，本轮必须证明：

> **ConShell 可以更接近真实支付执行，但依然不允许越过 mandate / policy / human confirmation。**

---

# G4. Payment Proof / Receipt Verification Layer

建立正式的 payment proof / settlement receipt verification 层。

### G4.1 至少支持类似输入
- provider receipt
- settlement hash / tx hash
- signed acknowledgement
- internal execution receipt
- verification evidence bundle

### G4.2 至少输出
- `verified_success`
- `verified_failure`
- `verification_inconclusive`
- `receipt_invalid`
- `receipt_duplicate`
- `provider_mismatch`
- `amount_mismatch`
- `expiry_mismatch`

### G4.3 必须验证的关键维度
- receipt 是否来自预期 provider
- amount / asset / network 是否匹配 negotiation / execution plan
- receipt 是否重复使用
- requirement / execution 是否已过期
- proof 是否足以支持 ledger adoption

### G4.4 目标
ConShell 不能把“收到某个字符串/回执”当成已完成支付或已到账收入。
必须有正式 verification layer。

---

# G5. Ledger Adoption & Canonical Economic Accounting

本轮必须把 verified settlement 结果正式写入 canonical economic ledger。

### G5.1 至少支持写入的 canonical record
- `SettlementLedgerEntry`
- `IncomeLedgerEntry`
- `SpendLedgerEntry`
- `PendingSettlementEntry`
- `FailedSettlementEntry`

### G5.2 至少记录
- direction（income / spend）
- sourceType / sinkType
- providerId
- requirementId / negotiationId / executionId / receiptId
- amountAtomic / normalized amount
- asset / network
- purpose
- profitability attribution target（task / session / agenda item / service）
- verification status
- adoptedAt

### G5.3 目标
让 settlement 成果不再只是 event log，
而是正式进入统一经济真相层。

---

# G6. Revenue Realization & Profitability Attribution

本轮必须把“支付成功/收款成功”的结果推进到价值闭环。

### G6.1 至少要支持
- payment-required service 的收入实现
- settlement success → revenue realization
- settlement cost → task cost attribution
- per-task / per-service profitability update
- failed settlement → no fake revenue adoption

### G6.2 至少回答的问题
- 这笔钱是因为哪个任务/服务/请求产生的
- 这是收入还是支出
- 该任务最终是 profit-positive / neutral / loss-making
- 哪些 payment attempts 带来真实收入
- 哪些 attempts 只是 negotiation 或 failed execution

### G6.3 目标
ConShell 不能停在“支付协议成立”；
必须开始进入：

> **价值被实现、被核验、被入账、被归因。**

---

# G7. Survival / Agenda Feedback Coupling

本轮必须把 settlement result 反馈到 survival state 与 autonomous agenda。

### G7.1 至少支持
- income realized → balance / reserve / survival tier 更新
- spend adopted → burn / runway / safety margin 更新
- failed settlement → pending / retry / operator attention
- profitability signal → value-aware agenda inputs

### G7.2 至少形成的耦合关系
- economic ledger → survival state
- survival state → task intake / execution posture
- realized revenue → agenda prioritization hints
- repeated failed settlements → policy / provider risk signal

### G7.3 目标
让 payment execution 不只是 isolated finance subsystem，
而是对整体生命体 runtime 产生真实反馈。

---

# G8. Provider Execution Adapter Boundary

本轮允许引入 execution adapter abstraction，
但不要求把所有 provider 广度一次做完。

### G8.1 至少应有类似边界
- `SettlementExecutor`
- `SettlementVerifier`
- `ProviderExecutionAdapter`
- `ReceiptNormalizer`

### G8.2 原则
- 先统一接口，再接少量 representative provider / mock provider
- 优先保证 runtime contract 与验证逻辑稳定
- 不允许 provider adapter 直接绕过 mandate / policy / confirmation gate

### G8.3 目标
execution 层必须可扩展，但不能把“支持很多 provider”误当成本轮完成度核心。

---

# G9. Truth Surface / Control Surface Extension

本轮必须把 settlement execution / verification / adoption 暴露到 truth surface。

### G9.1 至少新增/升级类似 summary
- `SettlementExecutionSummary`
- `SettlementVerificationSummary`
- `PendingSettlementSummary`
- `RevenueRealizationSummary`
- `ProfitabilityAttributionSummary`

### G9.2 operator 至少应能看到
- 哪些 settlement 还在 pending
- 哪些在等人工确认
- 哪些已 verified
- 哪些 verification failed
- 哪些已经 adopted into ledger
- 哪些收入已经 realized
- 哪些 provider 近期 failure / mismatch 较多

### G9.3 建议新增/升级 API
- `/api/economic/settlements`
- `/api/economic/settlements/pending`
- `/api/economic/settlements/verification`
- `/api/economic/revenue`
- `/api/economic/profitability`

命名可调整，
但必须体现：
- settlement
- verification
- ledger adoption
- revenue realization
- profitability

---

# G10. Retry / Expiry / Duplication Safety

本轮必须明确失败与重试安全规则。

### G10.1 至少要能处理
- execution plan 过期
- receipt 重复提交
- provider 返回 success 但 proof 不足
- provider 返回 ambiguous 状态
- verification 通过前重复 adoption
- 人工确认后条件漂移

### G10.2 至少要防止
- 重复记账
- 重复 claim revenue
- failed settlement 被误记为已完成
- stale negotiation 被继续执行
- stale receipt 被用于新 requirement

### G10.3 目标
execution closure 必须安全，不允许通过重试/重复 proof 造成账本污染。

---

## 四、Verification Matrix for 18.0

### V1. SettlementExecutionRequest / Plan / Result / Receipt contract 正式成立
### V2. settlement lifecycle state machine 能正确约束状态迁移
### V3. human confirmation boundary 在 execution 阶段依然成立
### V4. payment proof / receipt verification 能识别 success / invalid / duplicate / mismatch / inconclusive
### V5. verified settlement 才能 adoption into canonical ledger
### V6. revenue realization 能正确区分 income / spend / pending / failed
### V7. profitability attribution 能绑定 task / service / agenda target
### V8. survival / agenda feedback 能读取 adopted economic outcomes
### V9. control surface 可见 pending / verified / failed / adopted / realized 状态
### V10. 17.7 / 17.8 / 17.9 的 mandate / firewall / policy / explicit transfer 边界无回归

### 测试要求
- 必须覆盖正向与负向路径
- 必须测试人工确认 required 的 execution 不可自动提交
- 必须测试 proof mismatch / duplicate receipt / expired execution
- 必须测试 verification inconclusive 时不能 adoption into ledger
- 必须测试 failed settlement 不得产生 fake revenue
- 必须测试 explicit_transfer 仍然不能变成 unrestricted auto-execution
- 必须测试 payment negotiation → execution → verification → ledger adoption → profitability attribution 的整链路径

---

## 五、建议执行顺序

### Priority 1 — 定义 settlement contracts + lifecycle state machine
先把 execution object model 与状态迁移规则建起来。

### Priority 2 — 建立 execution authorization / confirmation gate
把 mandate / policy / firewall / human confirmation 再收紧一层。

### Priority 3 — 建立 receipt verification layer
确保 execution result 必须经过正式 verification。

### Priority 4 — 接入 canonical ledger adoption
把 verified result 写入统一经济账本。

### Priority 5 — 建立 revenue realization / profitability attribution
把 payment result 连接到价值闭环。

### Priority 6 — 扩展 truth surface / control surface
让 operator 看见 settlement / verification / realized revenue 全链状态。

---

## 六、本轮非目标

本轮明确不做：
- 不做 unrestricted autonomous payout
- 不做绕过人工确认的 explicit transfer execution
- 不做为了演示而强行接入大量 provider breadth
- 不做 full general-purpose wallet / custody platform
- 不做没有 verification 的“伪成功记账”
- 不把 provider marketing integration 数量当作本轮主要验收指标

本轮目标是：

> **把 payment negotiation 之后的 execution、verification、ledger adoption、revenue realization 正式纳入同一条 ConShell runtime 主链。**

---

## 七、硬性安全不变量

以下规则本轮绝不能被破坏：

1. **外部来源不能直接驱动 settlement execution 越过 firewall**
2. **`explicit_transfer` 仍必须强人工确认，不能因 execution runtime 建成而放开**
3. **没有有效 mandate / policy / capability，不得进入 execution**
4. **没有有效 verification，不得 adoption into canonical ledger**
5. **没有 canonical adoption，不得记作 realized revenue / spend**
6. **重复 receipt / 重复 adoption / stale proof 必须被拦截**
7. **truth surface 必须准确区分 pending / verified / failed / adopted / realized**
8. **17.7 / 17.8 / 17.9 的经济安全边界与 claim/reward 体系不得回归**

---

## 八、验收标准

Round 18.0 只有在以下条件满足时才算完成：

1. settlement execution contracts 正式成立
2. settlement lifecycle state machine 正式成立
3. execution authorization / human confirmation gate 正式成立
4. payment proof / receipt verification 正式成立
5. verified settlement → canonical ledger adoption 正式成立
6. revenue realization / profitability attribution 正式成立
7. survival / agenda feedback 至少完成第一版接线
8. control surface 能看到 settlement / verification / adoption / realization 状态
9. explicit transfer 强人工边界无回归
10. mandate / firewall / policy / reward-claim 相关安全不变量无回归

---

## 九、最终输出格式

完成后必须输出：

### A. Settlement Contract Summary
- 新增了哪些 execution / receipt / verification contracts
- settlement lifecycle 如何定义

### B. Authorization & Confirmation Summary
- execution 如何受 mandate / policy / firewall / human confirmation 约束
- 哪些动作仍被禁止自动执行

### C. Verification & Ledger Adoption Summary
- payment proof 如何验证
- verified result 如何 adoption into canonical ledger
- duplicate / stale / mismatch 如何处理

### D. Revenue Realization & Profitability Summary
- 哪些收入/支出会被正式采纳
- 如何归因到 task / service / agenda
- survival / profitability 如何反馈

### E. Control Surface Summary
- operator 能看到哪些 settlement / verification / revenue 状态
- 哪些 pending / failed / rejected reason 被暴露

### F. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### G. Risks / Deferred
- 哪些真实链上 settlement breadth / wallet execution breadth 留到后续轮次
- 哪些 provider adapters / deeper automation 延后

### H. 不得伪造
- 没有 receipt verification，不能说 settlement 已闭环
- 没有 ledger adoption，不能说收入/支出已成为 canonical truth
- 没有 profitability attribution，不能说 value closure 已成立
- 没有守住 explicit transfer 人工边界，不能说安全验收通过

---

## 十、一句话任务定义

> **Round 18.0 的目标是：把 payment negotiation 之后的 settlement execution、payment proof verification、canonical ledger adoption、revenue realization 与 profitability feedback 正式纳入 ConShell 的统一 runtime 主链，在不突破 mandate / firewall / policy / human confirmation 边界的前提下，推动经济层从“会协商”进入“会结算、会核验、会入账、会反馈”的真实闭环。**
