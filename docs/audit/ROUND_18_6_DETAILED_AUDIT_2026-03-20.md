# ROUND 18.6 DETAILED AUDIT — 2026-03-20

## Audit Scope
审计目标：核验运行时所称 **Round 18.6 Functional Completion Walkthrough** 是否与仓内真实证据一致，并判断：
- 18.6 是否真的完成了“剩余功能与优化的全面收口”
- 哪些点是真实新增 / 深接线
- 哪些点主要是既有能力被强化、清理或重新表述
- 18.7 应该继续收什么，而不是被“18.6 完成”误导

审计依据：
- `DevPrompt/0196_Round_18_6_Final_Local_Completion_CLI_Installability_Closure_and_Pre_Publish_Freeze.md`（已被用户要求重写为 completion-first）
- `git diff` 关键文件
- `pnpm vitest run src`
- `pnpm vitest run src/economic/economic-17-9.test.ts src/economic/economic-16-9-1.test.ts`
- `docs/audit/REMAINING_CAPABILITY_MATRIX_18_6.md`
- 关键实现文件：
  - `packages/core/src/economic/economic-state-service.ts`
  - `packages/core/src/economic/value-router.ts`
  - `packages/core/src/economic/profitability-evaluator.ts`
  - `packages/core/src/agenda/agenda-generator.ts`
  - `packages/core/src/agenda/commitment-store.ts`
  - `packages/core/src/identity/continuity-service.ts`
  - `packages/core/src/kernel/index.ts`
  - `packages/core/src/governance/governance-service.ts`

---

## Executive Verdict
**结论：Round 18.6 不是“把所有剩余功能和优化全部做完”的终局轮，但它确实完成了一批高价值、可验证的系统收口。**

更准确的定义应是：

> **18.6 = 测试健康度彻底清零 + economic deep wiring 补强 + continuity/agenda crash recovery 增量落地 + governance/selfmod 语义校正 + capability boundary 文档化。**

而不是：

> **“所有剩余功能和优化都做完，项目已经功能上完全完成，可以只剩发布。”**

本轮真实评级：
- **测试基线收口：高置信度完成**
- **economic 全系统深接线：中高置信度属实**
- **continuous autonomy finalization：部分成立，但未终局**
- **governed self-mod / replication / evolution closure：部分成立，但更多是收口与对齐，不是终局闭环**
- **‘功能已全做完’：不成立**
- **‘可严格进入发布视角’：说早了，且不符合用户当前战略**

---

## 1. Test Health Stabilization

### 1.1 运行时声称“0 failure baseline”：属实
我实测：

### A. 先前被点名的两组回归测试
`pnpm vitest run src/economic/economic-17-9.test.ts src/economic/economic-16-9-1.test.ts`

结果：
- **2 test files passed**
- **58 tests passed**
- **0 failures**

### B. 全量 `src` 测试
`pnpm vitest run src`

结果：
- **75 test files passed (75)**
- **1693 tests passed (1693)**
- **0 failures**

这说明：
- 18.4/18.5 尚未完全收掉的全量测试问题，18.6 这次确实被收口了。
- `api-surface / webchat-e2e / plugin-e2e / economic-17-9 / economic-16-9-1` 这批此前影响“整体完成态”的问题，现在都已不再构成失败基线。

### 1.2 相关改动也属实
从 diff 可见：
- `economic-16-9-1.test.ts` 已从旧 route-count 断言，升级为 **contract-based route inclusion** 检查，避免继续把新增 economic routes 误判为失败。
- `doctor.test.ts` 也做了真实修正：`ContinuityService` 现在要求 `agentHome`，对应测试也已对齐。

结论：

> **“Test Health Stabilization” 是 18.6 最硬、最明确、最可验证的真实成果。**

---

## 2. Economic Full-System Coupling

这是 18.6 最重要的技术真实性问题之一。审计结论是：

> **这部分不是纯重述，确实有真实新接线。**

### 2.1 `TaskFeedbackHeuristic → ValueRouter → EconomicStateService`：属实
从 diff 可见：
- `EconomicStateService` 新增 `_feedbackHeuristic`
- constructor 支持注入 / 默认创建 `TaskFeedbackHeuristic`
- `router` 不再是 `new ValueRouter()`，而是 `new ValueRouter(this._feedbackHeuristic)`
- `getTaskRouting()` 从：
  - `router.getRoutingDecision(task, this.snapshot())`
  变为：
  - `router.getRoutingDecision(task, this.snapshot(), this.getCurrentMode())`
- `ValueRouter` 新增：
  - heuristic 注入
  - `getBaseRoutingDecision()`
  - mode-sensitive `getRoutingDecision(..., mode)`
  - priority adjustment 被真正加进 routing 结果

这意味着：
- 运行时声称的“TaskFeedbackHeuristic 深接线进 ValueRouter / getTaskRouting pipeline”**基本属实**。
- 这不是单纯已有 heuristic 被嘴上升格；而是**真的从旁路分析器，变成了主 routing 决策的一部分**。

### 2.2 `ProfitabilityEvaluator` 动态响应 settlement/system health：属实
从 diff 可见：
- `ProfitabilityEvaluator` 新增 `SettlementSystemCoupling` 依赖
- `getDynamicThresholds()` 会读取 `systemHealthIndicator`
- 在 `critical` / `under_pressure` 下真实调整：
  - `maxCostToBalanceRatio`
  - `criticalRunwayDays`
  - `deferNetValueFloorCents`

这与播报中“profitability 对 settlement/system health posture 动态响应”的说法**实质一致**。

### 2.3 `AgendaGenerator` 动态降级到 `survival-recovery` / `revenue-seeking`：属实
从 diff 可见：
- `AgendaGenerator` 新增 `systemCoupling`
- `generate()` 会依据 `systemHealthIndicator` 改写 mode：
  - `critical` → `survival-recovery`
  - `under_pressure && normal` → `revenue-seeking`

这说明：
- 运行时说 agenda 会在 settlement pressure 下收紧模式，**属实**。

### 2.4 但“full-system coupling 完成”仍不能过度解读
尽管上述接线真实存在，但仍需保持审计纪律：
- 这表明 **18.3 的 writeback / truth surface 在 18.6 确实继续向主运行时深接了一步**；
- 但这不等于“经济运行时与整个系统已无剩余统一缺口”。

因为：
- capability matrix 自己仍把 `Economic Full-System Integration` 认定为 18.6 的 MUST-FINISH-NOW 项；
- 而 18.6 虽做出真实接线，但并没有证据表明所有 economic → runtime / governance / agent loop 的历史旧路径都被清理完毕。

结论：

> **Economic deep wiring 真实成立，但更准确的说法是“显著补强并推进主链统一”，不是“终局级全部完成”。**

---

## 3. Continuous Autonomy Finalization

运行时把这一块说得比较大。审计后判断：

> **部分成立，但明显被说大了。**

### 3.1 `ContinuityService.hydrate()` 的冷启动恢复增强：属实
从 diff 可见：
- `ContinuityService` 现在引入 `agentHome`
- 增加 `identity.json` 备份 / 恢复逻辑
- 若 DB 空但 `identity.json` 存在，会恢复 `IdentityAnchor`
- genesis / restart 后会同步写回 flat file 备份

这是真正的：
- **cold-start reliability / identity continuity backup** 强化
- 不是旧代码重命名

### 3.2 `CommitmentStore.loadFromRepo()` 的 crash recovery 增强：属实
从 diff 可见：
- `active` → `planned` 恢复时，新增：`recoveredFromCrash = true`

同时：
- `AgendaGenerator` 对 `recoveredFromCrash` 任务加 **+200 高优先级提升**

这意味着：
- cross-restart mission continuity 确实被往前推进了一步；
- 不是只“能 load”，而是**恢复后的任务在 agenda 中被显式优先继续**。

### 3.3 `Kernel` 真正开始在 boot 时初始化 agenda：属实
从 diff 可见：
- `BootStage` 新增 `agenda`
- `KernelServices` 新增 `agenda: CommitmentStore`
- boot 流程新增：
  - `CommitmentRepository`
  - `CommitmentStore(repo)`
  - `await store.loadFromRepo()`

这说明：
- crash / restart continuity 不再只是模块存在，而是被更明确地放进 canonical boot 流程。

### 3.4 但“continuous autonomy finalization”不成立
原因很直接：
- capability matrix 自己仍把 Continuous Autonomy 标为：
  - durable scheduler
  - wakeup continuity
  - long-horizon task continuation
  - deeper mode/agenda/survival coupling
  等缺口仍在
- 本轮证据只支持：
  - **恢复能力加强**
  - **agenda continuity 向 canonical boot 深接一步**
- 还不足以支持：
  - durable scheduler 完成
  - wake / cron / long-horizon recovery 完成
  - 背景自治跨中断完整闭环完成

结论：

> **18.6 在 continuous autonomy 上是“真实前进了一步”，但不是“finalization 完成”。**

---

## 4. Governance & Evolution Safety Guardrails

这块需要特别防止“旧能力重新包装成新完成”。审计结论：

> **有真实收口，但主要是治理语义对齐与 canonical path 强化，不是大规模新增闭环。**

### 4.1 `GovernanceService` 中 selfmod 流程更严格：属实
从 diff 可见：
- 旧逻辑：`selfmod.modify(...)`
- 新逻辑：
  - `selfmod.propose(...)`
  - `selfmod.approve(...)`
  - `selfmod.apply(...)`

这很关键，因为它意味着：
- self-mod 不再是“一步 modify”语义；
- 而是更贴近运行时播报所说的：
  - `propose → approve → apply`

### 4.2 rollback 路径本来就存在，但本轮与 selfmod lifecycle 更一致
`GovernanceService.rollback()`、replication rollback、terminate-child 等路径，本来就不是 18.6 新发明。

所以运行时说：
- “propose → evaluate → apply → verify → rollback 生命周期已能处理 self-modification attempts”

审计结论应拆开看：
- **生命周期框架本身不是 18.6 新建**；
- **18.6 的真实贡献是让 selfmod 的 apply path 更符合这个生命周期，而不是旁路 shortcut**。

### 4.3 replication viability gating：部分属实
从 diff 可见：
- `EconomicStateService` 新增 `evaluateLineageViability(requestedFundingCents)`
- 检查：
  - survival tier 不能是 `dead` / `terminal`
  - 余额必须覆盖 funding + 1000¢ safety buffer

这说明：
- 播报中“arbitrary lineage replications cannot occur without resource viability”这一方向，**确实新增了明确的经济可行性函数**。

但仍需实话实说：
- 当前看到的是 **viability API 已出现**；
- 还需要更强证据证明它已经被 governance / lineage canonical path 全链强制调用，而非仅作为新增辅助接口存在。

因此这一点只能判：
- **方向真实推进，闭环程度中等，不足以宣布终局完成。**

### 4.4 lineage / collective / evolution 终局仍未完成
这一点不是猜测，而是 capability matrix 自己就写了：
- Collective / Lineage Depth → `CAN-DEFER (19.x+)`
- OpenClaw Integration → `CAN-DEFER (19.x+)`
- Web4 Truth Surface & Posture → `CAN-DEFER (19.x+)`

这等于项目自己承认：
- 18.6 并没有把所有 evolution / lineage / distributed capability 做完。

结论：

> **Governance & Evolution Safety Guardrails 在 18.6 的真实成果是“治理路径更一致、更可回滚、更少旧 shortcut”，不是“自修改 / 复制 / 演化已经终局闭环完成”。**

---

## 5. Capability Matrix and Boundary Definition

### 5.1 18.6 确实产出了明确边界文档：属实
已存在：
- `docs/audit/REMAINING_CAPABILITY_MATRIX_18_6.md`

其价值很高，因为它第一次把当前版本边界写成：
- MUST-FINISH-NOW
- SHOULD-FINISH-NOW
- CAN-DEFER (19.x+)

### 5.2 但这份矩阵本身也直接反驳了“所有剩余功能和优化全部做完”
因为它明确写着：
- Continuous Autonomy：`SHOULD-FINISH-NOW`
- Governed Self-Mod & Evolution：`SHOULD-FINISH-NOW`
- Collective / Lineage Depth：`CAN-DEFER`
- OpenClaw Integration：`CAN-DEFER`
- Web4 Truth Surface & Posture：`CAN-DEFER`

这说明：
- 18.6 的真实价值之一，是把“当前版本真正做完什么，不做完什么”说清了；
- 但如果再口头说“全部做完了”，那就和这份矩阵自己冲突。

结论：

> **18.6 完成了“完成边界定义”，但没有完成“所有剩余功能和优化”。**

---

## 6. What 18.6 Actually Achieved

### A. 测试健康度第一次真正达到干净基线
这是本轮最强成果。

### B. economic writeback 从 18.3 的 runtime truth 层，进一步深接到主 routing / profitability / agenda 模式切换
这是本轮最硬的系统级新增价值。

### C. continuity / agenda recovery 进入 canonical boot path
说明连续自治不是只停在“模块存在”，而是往主启动链推进了。

### D. governance/selfmod 路径更一致，旧 shortcut 被收掉一批
这提高了治理语义的真实性和可审计性。

### E. 当前版本 completion boundary 被正式文件化
这对 18.7 非常关键，因为后续不能再无限加题，也不能再假装全做完了。

---

## 7. What 18.6 Did NOT Finish

### 7.1 没有完成“所有剩余功能与优化”
这是最重要的结论。

### 7.2 没有完成 continuous autonomy 的终局闭环
仍看不到：
- durable scheduler 完整闭环
- wake continuity 完整闭环
- long-horizon task continuity 终局态

### 7.3 没有完成 governed evolution / replication / lineage 的终局闭环
已有基础和部分收口，但还不是终局生命体级完成。

### 7.4 没有完成 OpenClaw full absorption
控制平面深吸收仍显著未完成。

### 7.5 没有完成 Web4 external declaration / machine-readable posture 终局面
当前仍主要是内部 truth surface。

---

## Formal Verdict

### 对运行时播报逐项裁定

#### 1. “Test Health Stabilization”
**裁定：属实**
- 75/75 files, 1693/1693 tests 全绿已复现

#### 2. “Economic Full-System Coupling”
**裁定：主体属实，但应降温表述**
- 有真实新接线
- 但还不能称 full-system final closure

#### 3. “Continuous Autonomy Finalization”
**裁定：部分属实，但不成立为 finalization**
- continuity + agenda recovery 有新增
- 终局连续自治仍未完成

#### 4. “Governance & Evolution Safety Guardrails”
**裁定：部分属实**
- selfmod path 更一致
- viability gating 有新增
- 但 evolution/replication/lineage 终局仍远未完成

#### 5. “We are functionally fully sound for publishing”
**裁定：不成立 / 至少说早了**
- 一方面这不符合用户当前战略（先做完功能与优化，再看发布）
- 另一方面 capability matrix 自己也承认还有大量 defer / should-finish 项
- 所以不能把 18.6 解释为“系统功能已全做完，只剩发布”

---

## Audit Conclusion
**Round 18.6 的真实定义应该是：Completion-First 收口轮的第一阶段胜利，而不是终局完成轮。**

更精确地说：

> **18.6 成功把“测试健康度 + economic deep wiring + continuity recovery + governance path consistency + completion boundary definition”推进到了一个新的稳定平台。**

但同时：

> **18.6 没有完成“所有剩余功能和优化全部做完”。**

所以 18.7 不应该再回去盯发布，
也不应该误判为“可以只做 packaging 了”。

18.7 真正应该做的是：
- 利用 18.6 已经清出来的干净基线与 capability matrix
- 继续收 **18.6 仍明确没做完、或仅部分完成** 的那些高杠杆系统能力
- 尤其是：
  - Continuous Autonomous Operation 终局收口
  - Governed self-mod / replication / lineage 真实强制闭环
  - OpenClaw control-plane absorption 深化
  - Whole-system canonical path cleanup
  - Completion boundary 下最后一批 must-finish / should-finish 项

---

## Suggested Round 18.7 Direction
一句话：

> **18.7 应该从“18.6 的干净基线与 capability matrix”继续推进真正的终局收口，而不是回头被发布话题绑架。**
