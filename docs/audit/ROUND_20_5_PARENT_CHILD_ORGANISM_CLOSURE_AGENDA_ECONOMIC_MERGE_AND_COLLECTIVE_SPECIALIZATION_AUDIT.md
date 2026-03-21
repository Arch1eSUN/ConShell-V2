# Round 20.5 审计报告
## Parent-Child Organism Closure / Agenda / Economic Merge / Collective Specialization 真实性审计

> 审计日期：2026-03-21
> 方法：仓内代码取证 + 独立测试/类型检查/构建验证
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 20.5 主体成立，而且是强成立。**

更准确地说：
- **G1 Child → Parent Agenda Merge / Follow-up Closure：成立（第一版）**
- **G2 Child → Parent Economic Merge / Lease Settlement Closure：成立**
- **G3 Collective Specialization Routing：成立（第一版）**
- **G4 Child Outcome Quality / Utility Absorption：成立**
- **G5 Parent-Child Organism Truth Surface：基本成立到成立之间，偏成立**
- **验证口径 `packages/core 100/100 files、1985/1985 tests 全绿`：成立**
- **CLI TypeScript / Dashboard TypeScript / Dashboard build 通过：成立**

因此，20.5 不是“childRuntime summary 再多几个字段”的表层轮，而是一轮**把 child runtime 的结果更真实地闭环回 parent organism——进入 agenda merge、economic writeback、specialization routing、quality/utility absorption 与 truth surface 的强收口轮。**

> 另外必须指出：开发侧口头播报中的 `99 files` 与独立验证结果不一致；真实结果是 **`100/100 files`**。审计以独立验证结果为准。

---

## 2. 独立验证结果

### 2.1 Core 全量测试
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **100 passed (100)**
- **1985 passed (1985)**
- 退出码 **0**

这比 20.4 的 99/1960 再次上升，并新增 `organism-closure-20-5.test.ts`，说明 20.5 的 parent-child organism closure 不是空宣称。

### 2.2 CLI TypeScript
独立执行：
```bash
cd packages/cli && npx tsc --noEmit
```
结果：退出码 **0**。

### 2.3 Dashboard TypeScript + Build
独立执行：
```bash
cd packages/dashboard && npx tsc --noEmit && npx vite build
```
结果：通过。

### 保留性能事实
Dashboard build 仍保留：
- `metamask-sdk-BrRSVcPa.js 557.74 kB`
- `index-D6Z1z34V.js 581.13 kB`
- `(!) Some chunks are larger than 500 kB after minification.`

所以：
> **20.5 全绿成立，但 dashboard performance 尾债仍在。**

---

## 3. G1 审计：Child → Parent Agenda Merge / Follow-up Closure

### 已确认事实
仓内存在并新增：
- `packages/core/src/orchestration/child-outcome-merger.ts`

### 关键成立点
`ChildOutcomeMerger` 已真实存在，且职责清晰：
1. 处理 terminal child outcomes（`completed / failed / recalled`）
2. 产出 `ChildOutcomeEvaluation`
3. 决定 `MergeType`
4. 将 evaluation + mergeResult 存入 `SessionRegistry`

其中 `MergeType` 已明确包含：
- `commitment_update`
- `follow_up`
- `remediation`
- `requeue`
- `noop`

并且根据 child 终态执行：
- `completed + mergeResult` → `commitment_update`
- `completed without mergeResult` → `follow_up` 或 `noop`
- `failed` → `remediation` 或 `noop`
- `recalled` → `requeue`

### 关键判断
这说明 child outcome 已不再只停留在 session summary，而开始被系统显式映射成：
> **parent-side follow-up / remediation / requeue closure 语义。**

### 边界
当前 `ChildOutcomeMerger` 主要产出的是 `followUpDescription` 与 `mergeType`，尚未看到它直接写入 `CommitmentStore` 或更新 parent commitment state 的更深主路径。因此，20.5 已建立了 agenda writeback coordinator，但更偏：
> **agenda merge contract + merge classification 成立，deeper commitment mutation integration 仍可继续深化。**

### 判断
**G1 成立（第一版）。**

---

## 4. G2 审计：Child → Parent Economic Merge / Lease Settlement Closure

### 已确认事实
仓内存在并已修改：
- `packages/core/src/economic/task-settlement-bridge.ts`

### 关键成立点
`TaskSettlementBridge` 已新增：
- `settleChildLease(lease, session)`

并且明确承担：
- child lease close-out type 判定（`success / failure / recall / revoke / expiry`）
- ledger spend writeback
- utility realized vs expected 计算
- effectiveness ratio 计算
- child lease diagnostics 统计

代码中明确可见：
- `utilityRealizedCents`
- `utilityExpectedCents`
- `effectivenessRatio`
- `childLeasesSettled`
- `childLeasesCostCents`
- `childLeasesUtilityRealizedCents`

这说明 child runtime 的资金消耗与效用已开始进入现有 canonical economic writeback path，而不是另造一条平行账路。

### 边界
开发目标中提到应统一 `ChildSession.trackSpend()` 与 `ChildFundingLease.recordSpend()`；从本次取证来看，`settleChildLease()` 已成立，但尚未看到 `ChildSession.trackSpend()` 完全被收口为 lease-only single truth path 的明确证据。因此最准确口径是：
> **child settlement canonical path 已成立，但 spend capture 的单一路径收口仍未完全终局。**

### 判断
**G2 成立。**

---

## 5. G3 审计：Collective Specialization Routing

### 已确认事实
仓内存在并新增：
- `packages/core/src/orchestration/specialization-router.ts`

### 关键成立点
`SpecializationRouter` 已真实存在，并提供：
- `matchSpecialization(requirement)`
- `recommendSpawnManifest(requirement)`
- `evaluateRouting(sessionId, requirement)`
- `specializationSnapshot()`

它消费：
- `SessionRegistry` 中的 manifests
- `ChildOutcomeEvaluation`

并将这些 contract 转化为：
- specialization tag match
- capability overlap
- tool category overlap
- historical quality weighting

这意味着 specialization 已从 manifest contract 明显推进到 runtime routing，而不再只是描述字段。

### 边界
当前 routing 仍偏 rule-based / score-based 第一版，尚未看到更深的 spawn/route 主路径强制接入，也尚未看到 runtime enforcement 直接阻断不合适 child。因此 20.5 的真实状态是：
> **specialization routing semantics 已成立，但仍偏 first-generation router，而非 fully pervasive routing engine。**

### 判断
**G3 成立（第一版）。**

---

## 6. G4 审计：Child Outcome Quality / Utility Absorption

### 已确认事实
仓内存在并新增：
- `packages/core/src/orchestration/child-outcome-merger.ts`
- `packages/core/src/orchestration/session-registry.ts`

### 关键成立点
`ChildOutcomeEvaluation` 已真实存在，并至少包含：
- `completionQuality`
- `mergeUsefulness`
- `failureSeverity`
- `reportingReliability`
- `utilityRealizedCents`
- `utilityExpectedCents`
- `effectivenessRatio`
- `evaluatedAt`

而且 `ChildOutcomeMerger.evaluateOutcome()` 已显式定义规则化、可测试的评估逻辑：
- completed = 80 + merge bonus
- recalled = partial quality
- failed = 0
- merge usefulness 基于 mergeResult 有无
- failure severity 基于 budget waste
- reporting reliability 基于 reports/checkpoints/heartbeats
- utility realized / effectiveness 基于 lease expected utility 与 terminal outcome

随后 `SessionRegistry` 已新增：
- `submitEvaluation()`
- `getEvaluation()`
- `listEvaluations()`

### 关键判断
这说明 child outcome 已开始被 parent organism 以结构化 quality / utility 信号吸收，而不是只看文本 summary。

### 边界
第一版 evaluation 仍是 deterministic rule-based，不是更复杂的多因子学习系统；但这不是问题，反而符合 20.5 当前轮“先要 canonical signal，再谈复杂智能”的目标。

### 判断
**G4 成立。**

---

## 7. G5 审计：Parent-Child Organism Truth Surface

### 已确认事实
仓内存在并已修改：
- `packages/core/src/orchestration/session-registry.ts`
- `packages/core/src/server/routes/governance.ts`

### 关键成立点
`SessionRegistry.childRuntimeSummary()` 已进一步增强，新增：
- `recentMergeResults`
- `utilitySummary`
  - `totalExpectedCents`
  - `totalRealizedCents`
  - `avgEffectivenessRatio`

同时 diagnostics 也已新增：
- `totalEvaluations`
- `totalMergeResults`
- `mergesByType`

且 governance route 继续暴露 `childRuntime` truth surface。

### 关键判断
这说明 truth surface 已经从“有多少 child / 花了多少钱”推进到：
> **child 最近如何合并回 parent、实现了多少 utility、merge 类型分布如何。**

### 边界
当前仍主要是 summary-level truth，而不是 fully rich parent agenda mutation / specialization routing live panel；也还没有看到更深的 parent commitment state diff 直接出现在 operator 面。因此最准确口径是：
> **parent-child organism truth surface 已显著增强，但仍偏 summary-level，不应夸大为 fully mature organism control panel。**

### 判断
**G5 基本成立到成立之间，偏成立。**

---

## 8. 测试覆盖与声明对账

开发侧声称：
- `25/25 new tests pass`
- `1985/1985 full suite pass`
- `99 files`

独立核验结果：
- **`100/100 files`**
- **`1985/1985 tests`**
- `packages/core/src/economic/organism-closure-20-5.test.ts` 实际存在，并覆盖：
  - `TaskSettlementBridge.settleChildLease`
  - `ChildOutcomeMerger + ChildOutcomeEvaluation`
  - `SpecializationRouter`
  - `SessionRegistry evaluation/merge storage`

因此：
- **full suite pass 主体成立**
- **25 个新测试的说法与 `organism-closure-20-5.test.ts` 文件内容一致**
- **但 `99 files` 不准确；真实结果是 `100 files`**

审计以独立验证为准，不能照抄开发侧播报。

---

## 9. 本轮最重要的真实增量

20.5 最重要的真实意义有 5 点：

### 9.1 child outcome 开始被系统化吸收为 agenda merge
子体终态不再只是结果文本，而开始拥有 follow-up / remediation / requeue / commitment_update 语义。

### 9.2 child lease 已进入 canonical economic writeback
子体预算消耗与效用开始进入主经济写回链，而不是平行账路。

### 9.3 specialization 开始真正参与 routing
manifest contract 开始被转化为 runtime routing decision，而不是只停留在解释层。

### 9.4 child quality / utility 成为 parent 可消费信号
系统开始拥有 completionQuality / mergeUsefulness / reportingReliability / effectivenessRatio 等第一版 organism learning signal。

### 9.5 truth surface 开始显示“子体如何改变母体”
operator 已开始看到 merge results 与 utility summary，而不是只看到 child count。

---

## 10. 保留问题 / 未完成项

20.5 强成立，但仍有几项不能夸大：

1. **agenda merge 仍偏 classification/description，不是 fully deep commitment mutation**
   - `ChildOutcomeMerger` 已成立
   - 但更深层 `CommitmentStore` 主路径写回仍可继续深化

2. **spend capture 单一路径收口仍未完全坐实**
   - `settleChildLease()` 已成立
   - 但 `ChildSession.trackSpend()` 与 lease-only truth 是否完全统一，当前证据还不够强

3. **specialization routing 仍是第一代 score-based router**
   - 已成立
   - 但仍不是 pervasive routing engine / enforcement engine

4. **truth surface 仍偏 summary-level**
   - 已增强
   - 但还不是 fully mature parent-child organism control panel

5. **dashboard performance 尾债仍在**
   - >500kB chunk 警告未消失

---

## 11. 最终结论

**Round 20.5 主体成立，而且是一次高质量强成立轮。**

正式口径建议写为：

> **20.5 已真实完成 `ChildOutcomeMerger` agenda writeback coordinator、`TaskSettlementBridge.settleChildLease()` 统一 child lease economic writeback、`SpecializationRouter` 第一代 runtime routing、`ChildOutcomeEvaluation` 结构化 quality/utility absorption，以及增强后的 `childRuntime` organism truth surface；独立验证结果为 `packages/core 100/100 files、1985/1985 tests` 全绿，CLI TypeScript 通过，Dashboard TypeScript + build 通过。**

同时保留理性边界：
- **这不等于 parent-child organism 已 fully mature closure。**
- **deep commitment mutation、single spend truth、routing enforcement 与 richer organism control panel 仍可继续深化。**
