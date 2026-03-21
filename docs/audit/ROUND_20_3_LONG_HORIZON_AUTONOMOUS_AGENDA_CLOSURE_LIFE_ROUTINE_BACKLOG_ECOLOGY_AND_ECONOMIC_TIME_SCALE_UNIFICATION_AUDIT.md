# Round 20.3 审计报告
## Long-Horizon Autonomous Agenda Closure / Life Routine / Backlog Ecology / Economic Time-Scale Unification 真实性审计

> 审计日期：2026-03-21
> 方法：仓内代码取证 + 独立测试/类型检查/构建验证
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 20.3 的主体宣称成立，而且是强成立。**

更准确地说：
- **G1 Long-Horizon Agenda Contract：成立**
- **G2 Agenda Persistence / State Transition：成立**
- **G3 Economic Time-Scale Unification：成立**
- **G4 Creator Directives / Governance / Survival Unification：成立**
- **G5 Operator Truth for Long-Horizon Life Process：基本成立**
- **验证口径 `packages/core 98/98 files、1934/1934 tests 全绿`：成立**
- **CLI TypeScript / Dashboard TypeScript / Dashboard build 通过：成立**

因此，20.3 不是“agenda 更复杂了一点”的普通一轮，而是一轮**把 agenda 从 tick/event + economic reprioritize 进一步推进到 long-horizon canonical lifecycle structure 的强收口轮。**

---

## 2. 独立验证结果

### 2.1 Core 全量测试
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **98 passed (98)**
- **1934 passed (1934)**
- 退出码 **0**

这比 20.2 的 96/1916 再次上升，说明 20.3 同样是“实现 + 测试覆盖同步增加”的真实推进。

### 2.2 CLI TypeScript
独立执行：
```bash
cd packages/cli && npx tsc --noEmit
```
结果：通过。

### 2.3 Dashboard TypeScript + Build
独立执行：
```bash
cd packages/dashboard && npx tsc --noEmit && npx vite build
```
结果：通过。

### 保留性能事实
build 仍保留：
- `metamask-sdk ... 557.74 kB`
- `index ... 581.13 kB`
- `Some chunks are larger than 500 kB after minification.`

所以：
> **20.3 全绿成立，但 performance 尾债仍未消失。**

---

## 3. G1 审计：Long-Horizon Agenda Contract

### 已确认事实
仓内存在并已修改：
- `packages/core/src/agenda/commitment-model.ts`
- `packages/core/src/agenda/commitment-store.ts`

### 核心成立点
`CommitmentStatus` 已真实扩展为 10-state FSM：
- `planned`
- `active`
- `scheduled`
- `deferred`
- `dormant`
- `blocked`
- `expired`
- `completed`
- `abandoned`
- `failed`

并且 `VALID_TRANSITIONS` 已同步扩展，`Commitment` 结构也新增了：
- `deferredReason`
- `dormantReason`
- `expiresAt`
- `reactivationPolicy`
- `lastStateTransitionAt`

### 判断
**G1 成立。**
这说明 agenda 的 canonical entity 仍然是 `Commitment`，并且 long-horizon 语义已经被直接吸收入主路径，而不是新造第二套 agenda 语言。

---

## 4. G2 审计：Agenda Persistence / State Transition

### 已确认事实
仓内存在并已修改：
- `packages/core/src/agenda/agenda-lifecycle-reconciler.ts`
- `packages/core/src/agenda/agenda-lifecycle-reconciler.test.ts`
- `packages/core/src/runtime/lifecycle-engine.ts`
- `packages/core/src/agenda/commitment-store.ts`

### 核心成立点
`AgendaLifecycleReconciler` 已新增并真实存在，且职责清晰：
- 消费 `AgendaLawEvaluator` verdicts
- 执行 CommitmentStore 层级的状态迁移
- 支持：
  - `dormant/deferred -> active`
  - `active -> dormant/deferred`
  - `deferred/dormant/scheduled -> expired`
  - `planned -> scheduled`

`CommitmentStore` 也已新增快捷状态方法：
- `markDeferred()`
- `markDormant()`
- `markScheduled()`
- `markExpired()`

而 `LifeCycleEngine` 已开始收口旧 `_deferredTasks` 路径：
- 当 `CommitmentStore` 存在时，deferred 查询/跟踪走 Commitment 主路径
- 仅在缺省情况下保留 `_legacyDeferredTasks`

### 判断
**G2 成立。**
这意味着 20.3 不只是新增几个状态名，而是真实建立了：
> **Commitment-level long-horizon state persistence + migration path。**

---

## 5. G3 审计：Economic Time-Scale Unification

### 已确认事实
仓内存在并已修改：
- `packages/core/src/agenda/agenda-law-evaluator.ts`
- `packages/core/src/agenda/agenda-lifecycle-reconciler.ts`
- `packages/core/src/runtime/lifecycle-engine.ts`

### 核心成立点
`AgendaLawEvaluator` 已成为独立统一推理层，并真实把经济因子纳入长期 agenda law：
- `reservePressure`
- `runwayUrgency`
- `burnRateStress`
- `opportunityCostCents`

它不只做排序解释，还会输出：
- `recommendedStatus`
- `verdict`
- `confidence`
- `reasons`

`AgendaLifecycleReconciler` 再消费这些 verdict，执行长期状态迁移。

这意味着 20.2 的“economic-aware reprioritize”在 20.3 进一步升级为：
> **economic time-scale now affects state transitions, not just rank order.**

### 判断
**G3 成立。**
当前至少已经形成多条可被经济状态解释的长期路径：
1. `deferred/dormant -> active`（条件改善时重激活）
2. `active -> dormant/deferred`（经济压力上升时降级）
3. `deferred/dormant/scheduled -> expired`（长期无效后淘汰）

---

## 6. G4 审计：Creator Directives / Governance / Survival Unification

### 已确认事实
仓内存在并新增：
- `packages/core/src/agenda/agenda-law-evaluator.ts`
- `packages/core/src/agenda/agenda-law-evaluator.test.ts`

### 核心成立点
`AgendaLawEvaluator` 的推理顺序已经清晰体现统一法则层，而不是散落在 generator 各处分支里。其内部真实综合了：
- **time / expiry**
- **governance holds**
- **creator directive match**
- **survival obligations (`mustPreserve`)**
- **economic pressure**
- **reactivation policy**
- **default capacity / steady-state**

并输出 `AgendaLawVerdict`，供：
- `AgendaGenerator`
- `AgendaLifecycleReconciler`
- operator truth / UI
共同消费。

### 判断
**G4 成立。**
这是 20.3 最核心的结构性推进之一：
> **ConShell 开始拥有统一的 agenda law，而不再只是多个模块各自局部 boost/filter。**

---

## 7. G5 审计：Operator Truth for Long-Horizon Life Process

### 已确认事实
仓内存在并已修改：
- `packages/core/src/server/routes/governance.ts`
- `packages/dashboard/src/pages/PresencePage.tsx`
- `packages/core/src/api-surface/agent-posture-service.ts`
- `packages/cli/src/tui.ts`

### 核心成立点
`GET /api/governance/economic-truth` 已新增 `agendaHorizon`：
- `totalCommitments`
- `statusCounts`
- `nextReEvaluations`

Dashboard / CLI / posture 侧也已开始显式显示：
- `scheduled`
- `deferred`
- related agenda pressure

### 判断
**G5 基本成立。**
原因：
- operator-facing long-horizon truth 已真实增强
- 但当前仍更偏第一版 horizon summary，而不是 fully rich life-process control panel
- 暂未见更深的 dormant / expired / recently reactivated / survival-driven promotions 全量 operator 面完善

所以最准确口径是：
> 20.3 已真实新增并接通 long-horizon life-process truth，但当前仍偏第一版，不应夸大为终局完成。

---

## 8. 本轮最重要的真实增量

20.3 最重要的真实意义有 4 点：

### 8.1 agenda canonical entity 已真正进入 long-horizon lifecycle
`Commitment` 不再只是中层 durable task object，而开始承载长期生命过程状态机。

### 8.2 deferred backlog 不再只是 runtime 临时数组
`LifeCycleEngine` 已开始把 deferred tracking 并回 `CommitmentStore` 主路径。

### 8.3 unified agenda law 已成立
`AgendaLawEvaluator` 让 creator / governance / survival / economic / time 约束进入同一套推理层。

### 8.4 long-horizon operator truth 开始出现
operator 已能更真实地看到：
- 有多少 scheduled/deferred commitments
- 哪些即将 re-evaluate
- agenda horizon 的总体形态

---

## 9. 保留问题 / 未完成项

20.3 强成立，但仍有几项不能夸大：

1. **operator long-horizon truth 仍是第一版**
   - 已有 horizon summary
   - 但仍不是 fully mature life-process control panel

2. **LifeCycleEngine 仍保留 `_legacyDeferredTasks` fallback**
   - 主路径已向 CommitmentStore 收口
   - 但旧兼容路径尚未彻底清零

3. **performance 尾债仍在**
   - Dashboard 仍有 >500kB chunk

4. **long-horizon agenda 仍未达到 fully mature multi-week organism level**
   - 20.3 已显著推进
   - 但 habit/routine ecology、creator directives 与 long-term economic planning 的更深层闭环仍可继续加强

---

## 10. 最终结论

**Round 20.3 主体成立，而且是一次高质量强成立轮。**

正式口径建议写为：

> **20.3 已真实完成 Commitment-level 10-state long-horizon agenda contract、AgendaLifecycleReconciler 状态迁移层、AgendaLawEvaluator 统一法则推理层，以及 operator-facing agenda horizon truth；独立验证结果为 `packages/core 98/98 files、1934/1934 tests` 全绿，CLI TypeScript 通过，Dashboard TypeScript + build 通过。**

同时保留理性约束：
- **这不等于 ConShell 已完成成熟 long-horizon autonomous life process 终局。**
- **operator truth、legacy cleanup 与更深层 life routine ecology 仍有后续空间。**
