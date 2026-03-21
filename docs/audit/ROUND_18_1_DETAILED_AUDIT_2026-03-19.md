# ROUND 18.1 DETAILED AUDIT — 2026-03-19

## Audit Scope
审计目标：核验运行时播报中关于 **Round 18.1** 的声明是否与仓内代码、测试、API 暴露和模块接入事实一致，并判断其相对于 `DevPrompt/0191` 的真实完成度。

审计依据：
- `DevPrompt/0191_Round_18_1_Settlement_Governance_Closure_Canonical_Ledger_Materialization_and_Profitability_Feedback.md`
- `packages/core/src/economic/settlement-governance.ts`
- `packages/core/src/economic/settlement-ledger.ts`
- `packages/core/src/economic/settlement-feedback.ts`
- `packages/core/src/economic/economic-kernel-foundation.ts`
- `packages/core/src/api/routes.ts`
- `packages/core/src/economic/economic-18-1.test.ts`
- 回归测试：`packages/core/src/economic/economic-18-0.test.ts`
- 实测命令：`pnpm vitest run src/economic/economic-18-1.test.ts src/economic/economic-18-0.test.ts`

---

## Executive Verdict
**结论：Round 18.1 基本成立，完成度明显高于 18.0，且运行时播报的主体内容大体属实。**

更准确地说：
- **属实部分**：关键文件存在；EKF 已接入；6 个新 truth-surface API 已暴露；`economic-18-1.test.ts` 的 42/42 测试与 `economic-18-0.test.ts` 的 4/4 回归我已实测复现。
- **真实价值**：18.1 确实把 18.0 的“最小 settlement 原型”推进成了**治理层 + 账本层 + 反馈层 + 诊断层**四件套。
- **核心保留意见**：18.1 目前更像是**模块级闭口**，还不是**统一编排的端到端运行时主链**。治理层、账本层、反馈层虽然都存在，但尚未看到一个正式 orchestration/service 将它们自动串成单一 canonical flow。

审计评级：
- **实现完成度：中高**
- **验收真实性：高**
- **架构方向正确性：高**
- **端到端统一度：中等**
- **继续演进价值：高**

---

## Claimed vs Verified

### 1. 声称新增文件：属实
运行时播报列出的文件：
- `settlement-governance.ts`
- `settlement-ledger.ts`
- `settlement-feedback.ts`
- `economic-kernel-foundation.ts`
- `routes.ts`
- `economic-18-1.test.ts`

实查结果：
- 以上文件均存在
- EKF 与 routes 的确出现 18.1 新接入点

### 2. 声称 6 个新 API：属实
在 `packages/core/src/api/routes.ts` 中已确认：
- `GET /api/economic/settlements`
- `GET /api/economic/settlements/pending`
- `GET /api/economic/settlements/verification`
- `GET /api/economic/ledger`
- `GET /api/economic/revenue`
- `GET /api/economic/profitability`

### 3. 声称 42/42 测试通过 + 18.0 回归 4/4：属实
实测命令：
- `pnpm vitest run src/economic/economic-18-1.test.ts src/economic/economic-18-0.test.ts`

实测结果：
- `economic-18-1.test.ts` → 42 passed
- `economic-18-0.test.ts` → 4 passed
- 合计 46 passed

所以这一条不是口头自报，而是**可复现事实**。

---

## What 18.1 Actually Delivers

## G1 — Execution Governance Re-Validation Layer
文件：`settlement-governance.ts`

已实现事实：
- `SettlementExecutionRequest`
- `SettlementExecutionAuthorization`
- `MandateSnapshot`
- `PolicySnapshot`
- `CapabilitySnapshot`
- `authorizeExecution()`

已覆盖的治理点：
- execution request 具备正式字段
- expiry 检查
- mandate drift 检查
- policy provider / amount 检查
- `requiresHumanConfirmation` 与 `settlementKind === 'transfer'` 的硬规则
- `authorized_for_execution / requires_human_confirmation / drifted_since_negotiation / expired_before_execution / forbidden_to_execute` 决策分叉

审计判断：
- **18.1 已把 execution governance closure 真实推进到执行相位**。

---

## G2 — Full Settlement Lifecycle State Machine
文件：`settlement-governance.ts`

已实现状态：
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

并且存在：
- `LEGAL_TRANSITIONS`
- `stateHistory`
- `transitionState()`

审计判断：
- 这不是 18.0 那种超简化状态机了，**状态机层面确实明显升级**。

---

## G3 — Receipt Contract + Verification Formalization
文件：`settlement-governance.ts`

已实现事实：
- `SettlementReceipt`
- `VerificationEvidenceBundle`
- `SettlementVerificationOutcome`
- `verifyReceipt()`
- duplicate receipt digest guard

已表达的验证结果：
- `verified_success`
- `verified_failure`
- `verification_inconclusive`
- `receipt_invalid`
- `receipt_duplicate`
- `provider_mismatch`
- `amount_mismatch`
- `expiry_mismatch`
- `network_mismatch`

审计结论：
- 从 contract 角度，18.1 已经把 verification 从 18.0 的 mock 风格推进为**正式结果模型**。

但仍需指出一个真实问题：
- asset mismatch 分支目前被写成 `network_mismatch`，reason 文案虽然写的是 asset mismatch，但 outcome 枚举没有单独返回 `asset_mismatch`。

这说明：
- 形式化已成立
- 但枚举语义仍有小缺口/实现瑕疵

---

## G4 / G5 — Canonical Ledger Materialization + Attribution
文件：`settlement-ledger.ts`

已实现事实：
- `SettlementLedgerEntry`
- `PendingSettlementEntry`
- `FailedSettlementEntry`
- `AttributionTarget`
- `adoptVerifiedSettlement()`
- `recordPending()`
- `recordFailed()`
- direction-aware 查询
- ledger summary / revenue summary / spend summary

已满足的关键点：
- 只有 `verified_success` 才能 adopt
- duplicate execution / duplicate receipt 被拦截
- failed settlement 不消失
- 每条 realized entry 具有 direction / attribution / verification truth

审计判断：
- **18.1 已把“adoption gate”升级为真正的账本实体层**。

---

## G6 / G7 — Profitability Feedback + Survival Feedback
文件：`settlement-feedback.ts`

已实现事实：
- `ProfitabilityAttributionRecord`
- `ProfitabilitySnapshot`
- `ProfitabilitySummary`
- `ProviderRiskSignal`
- `SettlementFeedbackEvent`
- `SurvivalFeedback`
- `recordAdoptedOutcome()`
- `recordFailedSettlement()`
- `getGlobalProfitabilitySummary()`
- `getProviderRiskSignals()`
- `getSurvivalFeedback()`

已实现能力：
- per-target income/spend aggregation
- net profit 计算
- failed settlement 不记假利润
- provider failure aggregation → risk level
- basic survival/profitability hint

审计判断：
- **18.1 已形成第一版 feedback 层**。

但仍需坦诚说明：
- 它目前更像**settlement-derived feedback subsystem**，
- 而不是已深度写回现有 `economic-state-service` / `agenda-generator` / `profitability-evaluator` 的统一系统反馈主链。

---

## G8 — Truth Surface & Operator Diagnostics
文件：`routes.ts`

已实现事实：
- `/api/economic/settlements`
- `/api/economic/settlements/pending`
- `/api/economic/settlements/verification`
- `/api/economic/ledger`
- `/api/economic/revenue`
- `/api/economic/profitability`

暴露内容也与 0191 方向基本一致：
- execution summary
- pending states
- verification summary
- ledger summary
- realized/pending/failed revenue view
- profitability + provider risk + survival feedback

审计判断：
- **truth surface 已从最低限 API 升级为 operator 可读面**。

---

## V1-V10 Reality Check

### V1. execution request / authorization / plan contracts 正式成立
**结论：部分通过偏高**
- request / authorization 已成立
- 但严格说并未看到一个独立、饱满的 `SettlementExecutionPlan` 对象成为系统核心。

### V2. settlement lifecycle state machine 覆盖主路径
**结论：通过**
- 九状态 + adopted_into_ledger 路径存在，且有状态迁移测试。

### V3. execution phase 的 mandate / policy / confirmation 边界继续成立
**结论：通过**
- 至少在 governance layer 中已真实实现。

### V4. receipt verification formalization
**结论：通过，但有细小语义缺口**
- asset mismatch outcome 未独立返回。

### V5. canonical ledger entries 可查询且含 direction / attribution / verification truth
**结论：通过**

### V6. realized / pending / failed 正式区分
**结论：通过**

### V7. profitability attribution 能绑定 task / service / agenda target
**结论：通过（第一版）**

### V8. adopted outcomes 至少完成第一版 survival / agenda feedback 接线
**结论：部分通过**
- feedback engine 成立
- 但尚未证明已深度并回既有主 runtime 决策层

### V9. truth surface 能暴露 pending / verification / ledger / revenue / profitability summaries
**结论：通过**

### V10. 18.0 最小功能与 17.7-17.9 安全边界无回归
**结论：基本通过**
- 18.0 回归实测通过
- 旧模块仍在
- 但“完全无回归”仍只应在更大集成面上继续验证，不能过度宣称

---

## Most Important Remaining Gap

**18.1 最大的真实缺口不是“模块不存在”，而是“统一编排主链尚未成立”。**

目前仓内结构更像：
- 18.0 模块：
  - `SettlementExecutionEngine`
  - `RevenueRealizationManager`
  - `CanonicalLedgerAdopter`
- 18.1 模块：
  - `SettlementGovernanceLayer`
  - `CanonicalSettlementLedger`
  - `SettlementFeedbackEngine`

这些模块已经并列挂进 EKF，
但是我没有看到一个正式的、单一的 end-to-end orchestrator / application service 去负责：

1. 从 negotiation/preparation 生成 execution request
2. 完成 governance authorization
3. 接受 receipt
4. 执行 verification
5. materialize ledger
6. record feedback
7. 更新 truth surface/audit trail

换言之：

> **18.1 把各层零件做对了，但还没有把这些零件收成唯一的 runtime settlement pipeline。**

这就是 18.2 最应该切入的地方。

---

## Audit Conclusion
**Round 18.1 应被定义为：Settlement Governance / Ledger / Feedback / Truth Surface Closure landed successfully, but Unified End-to-End Settlement Orchestration remains unfinished.**

这意味着：
- 18.1 这轮可以判定为**真实完成度较高的一轮**。
- 但它不该被误判为“settlement runtime 已终局完工”。
- 18.2 不该换题，而应顺势做：
  - **统一编排**
  - **主链收口**
  - **与既有 runtime/economic state/agenda 的真实集成**
  - **从模块成功走向系统成功**

---

## Recommended Round 18.2 Focus
18.2 最合理的主题应是：

1. **Unified Settlement Orchestration**
   - 建立正式 `SettlementRuntimeService` / orchestrator

2. **Bridge 17.9 → 18.1**
   - 从 payment negotiation / preparation 自动进入 governed execution pipeline

3. **Bridge 18.1 → Existing Runtime**
   - feedback 写回 existing economic state / agenda / profitability runtime

4. **End-to-End Truth & Audit Closure**
   - 让 operator 看到一条完整 settlement chain，而不是多个离散子系统

一句话：

> **18.2 不该再做新的零件，而该把 17.9、18.0、18.1 已有零件收成统一的 end-to-end settlement runtime 主链。**
