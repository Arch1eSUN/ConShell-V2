# ROUND 18.2 DETAILED AUDIT — 2026-03-19

## Audit Scope
审计目标：核验运行时播报中关于 **Round 18.2** 的声明是否与仓内代码、测试、flow trace API、provider feedback 回流和 orchestrator 接入事实一致，并判断其相对于 `DevPrompt/0192` 的真实完成度。

审计依据：
- `DevPrompt/0192_Round_18_2_Unified_Settlement_Orchestration_End_to_End_Runtime_Integration_and_Canonical_Economic_Chain.md`
- `packages/core/src/economic/settlement-orchestrator.ts`
- `packages/core/src/economic/provider-selection.ts`
- `packages/core/src/economic/economic-kernel-foundation.ts`
- `packages/core/src/api/routes.ts`
- `packages/core/src/economic/economic-18-2.test.ts`
- 回归测试：`economic-18-1.test.ts`、`economic-18-0.test.ts`
- 实测命令：`pnpm vitest run src/economic/economic-18-2.test.ts src/economic/economic-18-1.test.ts src/economic/economic-18-0.test.ts`

---

## Executive Verdict
**结论：Round 18.2 主体真实完成，且比 18.1 更接近“canonical settlement runtime 主链”。**

更准确地说：
- **属实部分**：`settlement-orchestrator.ts` 存在；EKF 已接入 `SettlementRuntimeService`；3 条 flow API 已存在；`provider-selection.ts` 已新增 `applyRiskPenalty / applySuccessBonus`；`economic-18-2.test.ts` 存在且 22/22 通过；18.1 42/42 与 18.0 4/4 回归我已实测复现。
- **真实价值**：18.2 的确完成了 17.9 → 18.1 的统一编排、flowId 级审计链、resume/replay、provider feedback 回流，且把 settlementRuntime 标记为 **CANONICAL entry point**。
- **核心保留意见**：18.2 主要完成了 **settlement 子系统内部主链统一**，但尚未深度接入既有 `economic-state-service`、`agenda-generator`、`profitability-evaluator`、`task-feedback-heuristic` 等主运行时模块，因此“系统级经济闭环”仍未完全成立。

审计评级：
- **实现完成度：高**
- **验收真实性：高**
- **架构方向正确性：高**
- **子系统主链统一度：高**
- **全系统写回集成度：中等**

---

## Claimed vs Verified

### 1. 声称 `settlement-orchestrator.ts`：属实
文件存在，且内容明确写明：
- `THE canonical settlement entry point`
- 18.0/18.1 modules are sub-layers, NOT parallel entry points
- flowId-level audit trail
- idempotent recovery

### 2. 声称 provider-selection 新增反馈方法：属实
在 `provider-selection.ts` 中已确认：
- `applyRiskPenalty(providerId, reason, penaltyPoints)`
- `applySuccessBonus(providerId, bonusPoints)`
- `getProviderStats(providerId)`

### 3. 声称 routes 新增 3 条 flow 追踪 API：属实
在 `routes.ts` 中已确认：
- `GET /api/economic/settlement-flows`
- `GET /api/economic/settlement-flows/:id`
- `GET /api/economic/settlement-flows/:id/trace`

### 4. 声称 EKF 接入 orchestrator：属实
在 `economic-kernel-foundation.ts` 中已确认：
- 导入 `SettlementRuntimeService`
- `readonly settlementRuntime: SettlementRuntimeService`
- 工厂内实例化并挂载

### 5. 声称 68 个测试全通过：属实
实测命令：
- `pnpm vitest run src/economic/economic-18-2.test.ts src/economic/economic-18-1.test.ts src/economic/economic-18-0.test.ts`

实测结果：
- 18.2 → 22/22
- 18.1 → 42/42
- 18.0 → 4/4
- 合计 68/68

这条声明可复现，属实。

---

## What 18.2 Actually Delivers

## G1 — Unified Settlement Runtime Service
文件：`settlement-orchestrator.ts`

已实现事实：
- `SettlementRuntimeService`
- `SettlementRuntimeFlowRequest`
- `SettlementRuntimeFlowResult`
- `SettlementFlowStage`
- `SettlementFlowStatus`
- `SettlementFlowAuditTrail`
- canonical main entry: `executeFlow()`

已实现的 pipeline stages：
- `negotiation_bridge`
- `authorization`
- `pending_confirmation`
- `submission`
- `receipt_intake`
- `verification`
- `ledger_adoption`
- `feedback_applied`
- `provider_feedback`
- `completed`
- `failed`
- `blocked`

审计判断：
- **18.2 已建立单一 orchestrator 主入口**。
- 这不是再多一个模块，而是把先前模块收成主链。

---

## G2 — Bridge 17.9 Negotiation / Preparation → 18.2 Flow
文件：`settlement-orchestrator.ts`

已实现事实：
- `bridgeNegotiationToFlow()`
- 拒绝 rejected negotiation
- 要求 selected offer
- 检查 preparation intent 的 expired / cancelled
- 将 negotiation / offer / snapshots / direction / attribution 映射为 `SettlementRuntimeFlowRequest`

审计判断：
- **17.9 → 18.2 的桥接层已真实存在**。

保留意见：
- riskLevel / purpose 仍有明显默认化痕迹，例如 `riskLevel: 'medium'` 与 `purpose: Settlement for ${requirementId}`，说明桥接还偏模板化，未深挖业务来源语义。

---

## G3 — End-to-End Runtime Flow Result
文件：`settlement-orchestrator.ts`

已实现事实：
- `SettlementRuntimeFlowResult` 一次性表达：
  - `authorizationDecision`
  - `verificationOutcome`
  - `ledgerAdoptionResult`
  - `profitabilityEffects`
  - `survivalEffects`
  - `providerFeedbackApplied`
  - `operatorActionRequired`
  - `failureReason`

审计判断：
- **18.2 已把多子系统结果收口为单一 flow result。**

---

## G4 — Canonical Audit Chain
文件：`settlement-orchestrator.ts`

已实现事实：
- `SettlementFlowAuditEvent`
- `SettlementFlowAuditTrail`
- 每个 flow 有 `flowId`
- 审计事件覆盖：
  - flow started
  - authorization
  - submission
  - receipt intake
  - verification
  - ledger adoption
  - feedback applied
  - provider feedback

并提供：
- `getFlowTrace(flowId)`
- `getFlowById(flowId)`
- `listFlows()`

审计判断：
- **18.2 已形成 flowId 级可追踪审计链。**

---

## G5 — Bridge Settlement Feedback → Existing Runtime Economics
这是 18.2 最关键的“部分完成项”。

已实现事实：
- orchestrator 会调用 `feedbackEngine.recordAdoptedOutcome()`
- orchestrator 会生成 survival feedback summary
- provider risk/success 会回流到 `ProviderSelector`

但实查结果也明确显示：
- 未见直接写回 `economic-state-service`
- 未见直接接线 `agenda-generator`
- 未见直接接线 `profitability-evaluator`
- 未见直接接线 `task-feedback-heuristic`

审计判断：
- **18.2 已完成 settlement 子系统内部反馈闭环**
- **但尚未完成对既有主运行时经济层的深写回**

这是 18.3 最重要的真实切口。

---

## G6 — Provider Selection / Routing Feedback Loop
文件：`provider-selection.ts` + `settlement-orchestrator.ts`

已实现事实：
- verification failure → `applyRiskPenalty()`
- success adoption → `applySuccessBonus()`
- 可通过 `getProviderStats()` 查看 trust score 调整

审计判断：
- **provider feedback 已开始真实回流 17.9 选择层**。

保留意见：
- 目前是直接 trust score 加减分模型，仍较简化；还不是完整的 risk-aware economic routing policy 系统。

---

## G7 — End-to-End Truth Surface
文件：`routes.ts`

已实现事实：
- `GET /api/economic/settlement-flows`
- `GET /api/economic/settlement-flows/:id`
- `GET /api/economic/settlement-flows/:id/trace`

审计判断：
- **18.2 已把 truth surface 升级到单笔 flow 可追踪级别**。

---

## G8 — Failure Recovery / Replay Strategy
文件：`settlement-orchestrator.ts`

已实现事实：
- `resumeFlow()`
- `replayFlow()`
- unknown flow 返回明确失败结果
- 已完成 flow 的 replay 具备 idempotency guard：`completedFlowsByExecId`

审计判断：
- **18.2 已建立第一版 resume/replay 能力**。

保留意见：
- replay/resume 目前更偏内存态 service 语义；若未来需要跨进程/持久化恢复，还不够。

---

## G9 — 18.0 / 18.1 Legacy Path Consolidation
文件：`economic-kernel-foundation.ts` + `settlement-orchestrator.ts`

已实现事实：
- `settlementRuntime` 被明确标注为 **CANONICAL entry point**
- 18.0 / 18.1 模块仍保留，但被定位为 sub-layers / primitives
- tests 中也验证 coexistence，不再把它们当平行主入口

审计判断：
- **18.2 已在架构语义上完成 canonical path 收口。**

保留意见：
- 旧 primitives 仍公开暴露在 EKF 上；这在工程上合理，但也意味着“规范上 canonical，技术上仍可绕过”。若未来需要更强治理，可能还要做 deprecation / façade 收束。

---

## V1-V10 Reality Check

### V1. 存在统一 orchestrator 主入口
**结论：通过**

### V2. 17.9 negotiation / preparation 可自动进入 governed settlement flow
**结论：通过（第一版）**
- bridge 已成立。

### V3. flow result 一次性表达 authorization / verification / adoption / feedback
**结论：通过**

### V4. settlement 全链具有 flowId 级 correlation / audit trace
**结论：通过**

### V5. adopted outcomes 至少接入一个既有 runtime economics 系统
**结论：部分通过**
- 已接入 provider selection 层；
- 但尚未深接 economic-state / agenda / profitability 主运行时。

### V6. provider risk / success feedback 开始回流到 selection / routing
**结论：通过**

### V7. truth surface 支持单笔 settlement flow trace
**结论：通过**

### V8. failure / pending / inconclusive path 支持 resume / replay
**结论：通过（第一版）**

### V9. 18.0 / 18.1 模块被收为 primitives 而非继续平行主入口
**结论：基本通过**
- 语义与 orchestrator 设计上已经收口。

### V10. 17.9 / 18.0 / 18.1 安全边界与能力无回归
**结论：基本通过**
- 68/68 实测支持该判断；
- 但更大系统面的无回归仍应继续观察。

---

## Most Important Remaining Gap

**18.2 最大剩余缺口不是 orchestrator 没有，而是它还没有深度写回既有主运行时经济系统。**

也就是说，18.2 已经做到：
- settlement 子系统内部 canonical flow
- provider selection feedback 回流
- flow trace / replay / audit

但还没有做到：
- adopted income / spend 真正改变 `economic-state-service`
- settlement-derived profitability 真正并入既有 `profitability-evaluator`
- settlement outcome 真正影响 `agenda-generator`
- settlement feedback 真正喂给 `task-feedback-heuristic`

所以：

> **18.2 完成的是 settlement runtime 的 canonical 主链；18.3 应完成 settlement runtime 与整个 ConShell economic runtime 的系统级耦合。**

---

## Audit Conclusion
**Round 18.2 应被定义为：Unified Settlement Runtime Orchestrator landed successfully, but Full-System Economic Runtime Coupling remains unfinished.**

这意味着：
- 18.2 是目前 18.x 链路里完成度最高、最接近“主链收口”的一轮。
- 但它还不是经济层终局，因为 adopted outcomes 仍没有深写回整个 ConShell 既有经济/议程/状态主运行时。
- 18.3 最合理的主题不是再造新的 settlement 零件，而是：
  - **system write-back**
  - **economic state coupling**
  - **agenda/profitability/runtime integration**
  - **从 settlement canonical flow 进入全系统 canonical economics**

---

## Recommended Round 18.3 Focus
18.3 最合理的主题应是：

1. **Settlement → EconomicStateService Coupling**
2. **Settlement → ProfitabilityEvaluator / TaskFeedbackHeuristic Coupling**
3. **Settlement → AgendaGenerator / Runtime Prioritization Coupling**
4. **Cross-System Economic Truth Surface**

一句话：

> **18.3 不该再问“settlement flow 是否成立”，而该解决“settlement canonical flow 如何真正改变 ConShell 的整个经济运行时”。**
