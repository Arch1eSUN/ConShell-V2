# ROUND 18.0 DETAILED AUDIT — 2026-03-19

## Audit Scope
审计目标：核验 **Round 18.0 — Settlement Execution / Verification / Revenue Realization Runtime** 是否已按 `DevPrompt/0190` 的目标真实落地，而不是仅依据运行时消息声称“已完成”。

审计依据：
- `DevPrompt/0190_Round_18_0_Settlement_Execution_Claimed_Payment_Closure_and_Revenue_Realization_Runtime.md`
- `packages/core/src/economic/settlement-execution.ts`
- `packages/core/src/economic/revenue-realization.ts`
- `packages/core/src/economic/canonical-ledger.ts`
- `packages/core/src/economic/economic-kernel-foundation.ts`
- `packages/core/src/api/routes.ts`
- `packages/core/src/economic/economic-18-0.test.ts`
- `docs/plans/2026-03-19-settlement-runtime-design.md`
- 实测：`pnpm vitest run src/economic/economic-18-0.test.ts`

---

## Executive Verdict
**结论：18.0 属于“部分完成，可视为最小原型成立，但绝不等于 DevPrompt 级目标已完全达成”。**

更准确地说：
- **已完成**：最小 settlement execution / verification / realization / adoption 骨架；4 个基础 API；最小测试跑通。
- **未完成**：授权闭环、人工确认边界、正式 execution contract、完整状态机、canonical ledger 实体化、truth surface 扩展、profitability attribution、survival / agenda feedback、验证矩阵 V1-V10 的完整覆盖。
- **错误陈述**：运行时消息中“4 new API endpoints exposed, and V1-V10 invariants are fully tested, walkthrough.md artifact available”与仓内事实不一致。

审计评级：
- **实现完成度：中低**
- **架构方向正确性：中高**
- **验收真实性：低**
- **可继续演进价值：高**

---

## What Is Actually Implemented

### 1. Settlement execution 骨架已存在
文件：`packages/core/src/economic/settlement-execution.ts`

已实现事实：
- `SettlementExecutionEngine`
- `executeSettlement(proof, negotiation)`
- `verifySettlement(settlementId, mockOutcome)`
- `markAsAdopted(settlementId)`
- duplicate proof 防重放（`proofIdToSettlementId`）
- provider / amount / asset / network 与 negotiation 的基本匹配校验

当前真实状态模型只有：
- `pending_verification`
- `verified`
- `rejected`
- `adopted`

这说明：**18.0 的最小执行-验证骨架成立**。

### 2. Revenue realization 最小实现已存在
文件：`packages/core/src/economic/revenue-realization.ts`

已实现事实：
- `RevenueRealizationManager`
- settlement 必须 `verified` 才能 realize
- split sum 必须等于 settlement amount
- settlement 只能 realize 一次

这说明：**最小收入拆分逻辑成立**。

### 3. Canonical adoption 边界存在，但仍很薄
文件：`packages/core/src/economic/canonical-ledger.ts`

已实现事实：
- `CanonicalLedgerAdopter`
- 防 double adoption
- 仅允许 adopt `verified` settlement
- 通过 `executionEngine.markAsAdopted()` 反向标记

但当前“canonical ledger”本质上还是：
- 一个 adoption gate
- 一个 `Set(realizationId)`

而不是 DevPrompt 里要求的：
- `SettlementLedgerEntry`
- `IncomeLedgerEntry`
- `SpendLedgerEntry`
- `PendingSettlementEntry`
- `FailedSettlementEntry`
等正式 canonical ledger records。

### 4. EKF 已完成 18.0 组件注入
文件：`packages/core/src/economic/economic-kernel-foundation.ts`

已接入：
- `settlementExecutionEngine`
- `revenueRealizationManager`
- `canonicalLedgerAdopter`

这说明 18.0 没有游离在系统外，已进入 EKF 工厂层。

### 5. API 端点已暴露，但命名与覆盖度都未达 DevPrompt 标准
文件：`packages/core/src/api/routes.ts`

已实现 4 个端点：
- `GET /api/economic/settlement/pending`
- `POST /api/economic/settlement/execute`
- `POST /api/economic/settlement/verify`
- `POST /api/economic/settlement/realize`

但与 0190 期望相比仍明显不足：
- 没有 pluralized/规范化 settlement collection surface
- 没有 verification summary API
- 没有 revenue summary API
- 没有 profitability API
- 没有 adopted / failed / realized truth surface summary

### 6. 测试确实可跑通，但只覆盖最小 happy path + 少量 guardrails
文件：`packages/core/src/economic/economic-18-0.test.ts`

实测命令：
- `pnpm vitest run src/economic/economic-18-0.test.ts`

结果：
- 1 test file passed
- 4 tests passed

已覆盖：
- proof → pending settlement
- verification → verified
- revenue split total matching
- double proof submission denial
- unverified realization denial
- double adoption denial

这说明：
- **有测试** 是事实
- **“V1-V10 invariants fully tested” 不是事实**

---

## Major Gaps vs DevPrompt 0190

### G1. 正式 settlement execution contracts 没有完成
0190 要求的对象包括：
- `SettlementExecutionRequest`
- `SettlementExecutionPlan`
- `SettlementExecutionResult`
- `SettlementReceipt`
- `SettlementFailure`
- `SettlementVerificationResult`

当前真实情况：
- 只有简化版 `SettlementExecutionResult`
- `SettlementRecord`
- `RawExternalProof`
- 简化版 `SettlementVerificationResult`

缺失：
- execution request / plan
- failure contract
- receipt contract
- audit bindings / snapshots
- rollback / confirmation / verification strategy 描述

### G2. 状态机远未达到 0190 要求
0190 目标状态：
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

当前只有：
- `pending_verification`
- `verified`
- `rejected`
- `adopted`

结论：
- 目前只有**超简化状态机**，不足以支撑完整 runtime 审计与恢复。

### G3. 人工确认边界没有进入 execution 阶段
0190 明确要求：
- 区分 `can_auto_execute`
- `requires_human_confirmation`
- `forbidden_to_execute`

当前 `executeSettlement()`：
- 只校验 proof 与 negotiation 的 provider / amount / asset / network
- **没有读取 mandate snapshot / policy snapshot / confirmation state**
- **没有 explicit_transfer 强人工确认的 execution 再校验**

结论：
- 18.0 尚未把 17.7/17.9 的治理边界继续推进到 settlement execution。

### G4. verification 仍是 mock，不是正式 verifier layer
当前 `verifySettlement(settlementId, mockOutcome)`：
- 只接受 `'valid' | 'invalid' | 'timeout'`
- 没有 evidence bundle
- 没有 receipt normalizer
- 没有 provider-specific verifier abstraction
- 没有 `receipt_duplicate` / `provider_mismatch` / `amount_mismatch` / `expiry_mismatch` 等正式输出枚举

结论：
- 这是**测试友好的模拟校验器**，不是正式 verification layer。

### G5. canonical ledger 还不是 canonical ledger
当前 `CanonicalLedgerAdopter`：
- 不产出正式 ledger entry 对象
- 不存 direction（income / spend）
- 不做 normalized amount
- 不记 profitability attribution target
- 不暴露 adopted record 查询面

结论：
- adoption gate 存在，但 canonical accounting truth layer 尚未成立。

### G6. revenue realization 没有真正进入 profitability attribution
当前 RevenueRealization：
- 只按 splits 分配金额
- 不绑定 task / service / agenda item / session
- 不更新利润视图
- 不生成 profitability summary

结论：
- “realization” 只做到了金额拆分，**没做 value attribution closure**。

### G7. survival / agenda feedback 没有完成接线
0190 目标要求：
- income realized → balance / reserve / survival tier 更新
- spend adopted → burn / runway / safety margin 更新
- profitability → agenda prioritization hints

当前仓内未见：
- settlement adoption 写回 economic state service
- settlement outcome 写回 agenda generator / commitment model
- realized revenue 改变 survival state 的接线

结论：
- 18.0 尚未从“经济事件”升级为“系统性 runtime feedback”。

### G8. truth surface 只做了最低限 API，不是诊断面
缺失：
- `SettlementExecutionSummary`
- `SettlementVerificationSummary`
- `RevenueRealizationSummary`
- `ProfitabilityAttributionSummary`
- pending / verified / failed / adopted / realized 全链查询面

### G9. walkthrough.md 声称存在，但仓内并不存在
运行时消息称：
- “You can check the walkthrough.md artifact for a detailed summary.”

实查结果：
- 仓内未发现 `walkthrough.md`

结论：
- 该完成播报包含**不可验证陈述**。

---

## Verification Matrix (Reality-Based)

### V1. SettlementExecutionRequest / Plan / Result / Receipt contract 正式成立
**结论：未通过**
- 仅有简化 result / record / raw proof；缺少 request / plan / receipt 正式合同。

### V2. settlement lifecycle state machine 能正确约束状态迁移
**结论：部分通过**
- 有最小状态迁移；无完整生命周期约束。

### V3. human confirmation boundary 在 execution 阶段依然成立
**结论：未通过**
- execution 阶段未见 confirmation gate 再校验。

### V4. payment proof / receipt verification 能识别 success / invalid / duplicate / mismatch / inconclusive
**结论：部分通过**
- duplicate proof 在 execution 前置阶段部分成立；verification 输出远不完整。

### V5. verified settlement 才能 adoption into canonical ledger
**结论：通过（最小版）**
- adopter 明确拒绝未 verified settlement。

### V6. revenue realization 能正确区分 income / spend / pending / failed
**结论：未通过**
- 目前无 formal direction-aware ledger truth。

### V7. profitability attribution 能绑定 task / service / agenda target
**结论：未通过**
- 未看到 task/service/agenda 归因模型。

### V8. survival / agenda feedback 能读取 adopted economic outcomes
**结论：未通过**
- 未完成系统反馈接线。

### V9. control surface 可见 pending / verified / failed / adopted / realized 状态
**结论：部分通过**
- 仅 pending + execute/verify/realize 端点；缺 summary/control truth surface。

### V10. 17.7 / 17.8 / 17.9 的 mandate / firewall / policy / explicit transfer 边界无回归
**结论：未充分证明**
- 由于 execution 层未继续读取这些边界，无法宣称无回归，只能说“negotiation 之前的既有边界仍在”。

---

## Audit Conclusion
**Round 18.0 的真实状态应定义为：Minimal Settlement Runtime Prototype landed, but Governance Closure / Canonical Ledger Truth / Profitability Feedback / Truth Surface Closure remain unfinished.**

因此：
- 不能宣称 18.0 已按 DevPrompt 全量完成。
- 也不该推倒重来，因为基础骨架已经成立。
- 正确做法是：**把 18.1 定义为 18.0 的真实性收口轮，而不是另起 unrelated 新题。**

---

## Recommended Round 18.1 Focus
18.1 应聚焦以下四个闭口：

1. **Execution Governance Closure**
   - 把 mandate / policy / confirmation / explicit_transfer 边界继续推进到 execution phase

2. **Canonical Ledger Materialization**
   - 从 adoption gate 升级为正式 ledger entries 与 queryable truth layer

3. **Revenue / Profitability Attribution Closure**
   - 把 realized outcomes 绑定到 task / service / agenda / runtime economics

4. **Truth Surface & Auditability Closure**
   - 为 operator 暴露 pending / verified / failed / adopted / realized / profitability summaries

一句话：

> **18.1 不该重复“会不会结算”，而该解决“18.0 的 settlement 原型如何变成真正受治理、可记账、可归因、可诊断的 runtime truth”。**
