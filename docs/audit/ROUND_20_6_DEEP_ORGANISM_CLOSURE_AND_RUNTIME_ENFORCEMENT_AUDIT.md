# Round 20.6 审计报告
## Deep Organism Closure and Runtime Enforcement 真实性审计

> 审计日期：2026-03-21
> 方法：仓内代码取证 + 独立测试/类型检查/构建验证
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 20.6 主体成立，而且是强成立。**

更准确地说：
- **G1 Deep Commitment Mutation Path：成立**
- **G2 Single Spend Truth Closure：成立**
- **G3 Routing Enforcement / Reuse Discipline：成立（第一版）**
- **G4 Organism Control Surface Hardening：成立（第一版）**
- **验证口径 `packages/core 101/101 files、2009/2009 tests 全绿`：成立**
- **CLI TypeScript / Dashboard TypeScript / Dashboard build 通过：成立**

因此，20.6 不是“20.5 的 organism summary 再加一点字段”，而是一轮**把 parent-child organism closure 从 classification / summary / recommendation，推进到更深 commitment mutation、更硬 spend truth、更真实 routing enforcement 与更可操作 control surface 的强收口轮。**

---

## 2. 独立验证结果

### 2.1 Core 全量测试
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **101 passed (101)**
- **2009 passed (2009)**
- 退出码 **0**

开发侧播报为：
- `24 new tests`
- `2009/2009 total green`

独立验证确认：
- `2009/2009 total green` 成立
- 新增 `deep-closure-20-6.test.ts (24 tests)` 实际存在
- 文件数真实结果为 **101/101 files**

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
> **20.6 全绿成立，但 dashboard performance 尾债仍在。**

---

## 3. G1 审计：Deep Commitment Mutation Path

### 已确认事实
仓内存在并已修改：
- `packages/core/src/orchestration/child-outcome-merger.ts`
- `packages/core/src/economic/deep-closure-20-6.test.ts`

### 关键成立点
`ChildOutcomeMerger` 已新增 `CommitmentStore` 依赖：
- constructor 第三个参数为 `commitmentStore?: CommitmentStore`

并且在 `mergeOutcome()` 中明确执行：
- `executeCommitmentMutation(session, mergeType, evaluation)`

其 mutation 路径已真实落到 `CommitmentStore`：
- `commitment_update` → `store.markCompleted(targetId)` + `store.update(...)`
- `follow_up` → `store.add(createCommitment(...))`
- `remediation` → `store.add(createCommitment(...))`
- `requeue` → `store.markDeferred(...)` 或 `store.markDormant(...)`

并且 `ChildMergeResult` 已新增：
- `commitmentMutationType`
- `targetCommitmentId`
- `createdCommitmentId`

### 关键判断
这说明 20.6 已真实把 child outcome 从：
- classification / description

推进到：
> **canonical commitment mutation path。**

这正是 20.5 审计里保留的最重要边界之一，而 20.6 已将其真实推进。

### 边界
目前 `findTargetCommitment()` 仍主要依赖：
- `delegateChildId === session.id`
- 或 `delegation + taskType match + active status`

这意味着 target resolution 仍是第一版 heuristic，而不是更强的 explicit linkage graph。但这不影响“deeper mutation path 已成立”的主体判断。

### 判断
**G1 成立。**

---

## 4. G2 审计：Single Spend Truth Closure

### 已确认事实
仓内存在并已修改：
- `packages/core/src/orchestration/child-session.ts`
- `packages/core/src/economic/deep-closure-20-6.test.ts`

### 关键成立点
`child-session.ts` 已明确写明：
- `Round 20.6: Single Spend Truth — trackSpend() delegates to lease when present`
- `budgetUsedCents becomes mirror of lease.spentCents for funded sessions`

其具体实现为：
- getter `budgetUsedCents`：有 `_leaseRef` 时直接返回 `lease.spentCents`
- `trackSpend(cents)`：有 `_leaseRef` 时调用 `this._leaseRef.recordSpend(cents)`，然后将 `_budgetUsedCents` 同步为 mirror；无 lease 时才使用 legacy local accumulation
- `hasCanonicalSpendTruth` 明确暴露 canonical spend backing 状态

测试也明确覆盖：
- funded session delegates trackSpend to lease
- `session.budgetUsedCents === lease.spentCents` after multiple spends
- unfunded session 仍可走 legacy fallback

### 关键判断
这意味着 20.5 审计里保留的边界：
> `ChildSession.trackSpend()` 与 lease-only capture 是否完全统一，证据仍不够强

已经在 20.6 得到真实收口。

对于 funded child sessions：
> **lease 已成为 canonical spend truth，session 侧只剩 mirror/read model。**

### 边界
仍保留 legacy/unfunded fallback；但这不影响 20.6 的目标，因为 20.6 要求的是 funded/organism-relevant path 的 single spend truth closure，而不是删除所有非 lease session 支持。

### 判断
**G2 成立。**

---

## 5. G3 审计：Routing Enforcement / Reuse Discipline

### 已确认事实
仓内存在并已修改：
- `packages/core/src/orchestration/specialization-router.ts`
- `packages/core/src/economic/deep-closure-20-6.test.ts`

### 关键成立点
`SpecializationRouter` 已新增：
- `enforceRouting(manifest, requirement?)`
- `RoutingEnforcementResult`
- `enforcementSnapshot()`

并且 `enforceRouting()` 不是 advisory metadata，而是明确执行 rule-based gate：
1. avg quality < 30 + enough history → reject
2. ≥2 recent high/critical failures → reject
3. capability mismatch → warning
4. high-quality same specialization completed sessions → suggest reuse
5. below-average quality → warning + suggested alternative

同时每次 enforcement 都会：
- `recordEnforcement(...)`
- 进入 `_enforcementHistory`

### 关键判断
这说明 routing 已从：
- recommendation / query only

推进到：
> **真实的 pre-flight enforcement gate。**

20.6 这里不是更换了“建议措辞”，而是新增了 `allowed / reason / warnings / suggestReuseSessionId / suggestedAlternative` 这类真正能进入 runtime gate 的结构。

### 边界
当前还没看到 spawn flow 全局接线的完整取证链路，代码注释中写了 “must be called before creating a new child session”，测试也覆盖 enforcement 本身，但“所有 spawn call site 已无遗漏地接入 enforceRouting()”这一点，仍需要更广范围主路径审计才能完全宣称全局收口。

因此最准确口径是：
> **routing enforcement contract 与 first-generation gate 已成立；全局 spawn-path saturation 仍可继续深化。**

### 判断
**G3 成立（第一版）。**

---

## 6. G4 审计：Organism Control Surface Hardening

### 已确认事实
仓内存在并已修改：
- `packages/core/src/orchestration/session-registry.ts`
- `packages/core/src/economic/deep-closure-20-6.test.ts`

### 关键成立点
`SessionRegistry` 已新增独立：
- `organismControlSurface(router?: SpecializationRouter): OrganismControlSurface`

这不是给 `childRuntimeSummary()` 再堆字段，而是明确区分出的 operator control view。

该控制面已聚合：
1. `commitmentImpactTrail`
   - child outcome 导致的 commitment mutation trail
2. `spendClosureStatus`
   - `sessionSpentCents`
   - `leaseSpentCents`
   - `aligned`
   - `hasCanonicalSpendTruth`
3. `routingEnforcementSnapshot`
4. `mergeConsequenceDistribution`
5. `overallHealth`
   - `deepClosureActive`
   - `spendTruthUnified`
   - `routingEnforced`

### 关键判断
这说明 operator 面已经从：
- 有多少 child
- 花了多少钱

推进到：
> **closure 是否真的发生、spend truth 是否真的统一、routing enforcement 是否真的执行。**

这已经明显超出 summary-level 面板，而进入更可操作的 control surface。

### 边界
当前 control surface 仍主要是 registry 聚合视图，尚未形成更丰富的 dashboard/operator interactive surface；不过 20.6 的目标本来就是“从 summary-level 推进到更可操作 control surface”，而不是一轮完成 fully mature cockpit。当前成果已满足本轮目标。

### 判断
**G4 成立（第一版）。**

---

## 7. 测试覆盖与声明对账

开发侧声称：
- `24 new tests`
- `2009/2009 total green`

独立核验结果：
- **`101/101 files`**
- **`2009/2009 tests`**
- `packages/core/src/economic/deep-closure-20-6.test.ts` 实际存在，且为 **24 tests**

该测试真实覆盖：
- Phase A: Single Spend Truth
- Phase B: Deep Commitment Mutation
- Phase C: Routing Enforcement
- Phase D: Organism Control Surface

因此：
- **24 new tests 主体成立**
- **2009/2009 total green 成立**
- 文件数真实结果为 **101/101 files**

---

## 8. 本轮最重要的真实增量

20.6 最重要的真实意义有 4 点：

### 8.1 child outcome 终于落到 deeper commitment mutation
20.5 的 merge classification 在 20.6 被推进为真实的 `CommitmentStore` mutation path。

### 8.2 funded child spend truth 终于真实统一
lease 成为 funded sessions 的 canonical spend truth，session 侧降级为 mirror/read model。

### 8.3 routing 开始拥有真实 gate
`SpecializationRouter` 不再只是推荐器，而开始拥有 allow/reject/warn/reuse-suggest 的 enforcement 结构。

### 8.4 organism truth 开始具备 control surface 语义
operator 已能看到：
- 哪些 mutation 真发生了
- spend 是否对齐
- routing enforcement 是否执行

---

## 9. 保留问题 / 未完成项

20.6 强成立，但仍有几项不能夸大：

1. **target commitment resolution 仍是第一版 heuristic**
   - `delegateChildId` + `taskType` match 仍偏启发式

2. **routing enforcement 的 spawn-path 全局接线饱和度仍需更广范围核验**
   - gate 已成立
   - 但“所有 spawn flow 均已强制调用”还需要更大范围取证

3. **organism control surface 仍偏 runtime aggregation，不是 fully mature operator cockpit**
   - 已具 control 语义
   - 但交互面、可操作面仍可继续深化

4. **dashboard performance 尾债仍在**
   - >500kB chunk 警告未消失

---

## 10. 最终结论

**Round 20.6 主体成立，而且是一次高质量强成立轮。**

正式口径建议写为：

> **20.6 已真实完成 `ChildOutcomeMerger` → `CommitmentStore` 的 deep commitment mutation、funded child session 的 single spend truth closure、`SpecializationRouter.enforceRouting()` 第一代 runtime enforcement gate，以及 `SessionRegistry.organismControlSurface()` 的 operator control view；独立验证结果为 `packages/core 101/101 files、2009/2009 tests` 全绿，CLI TypeScript 通过，Dashboard TypeScript + build 通过。**

同时保留理性边界：
- **这不等于 parent-child organism 已 fully mature closure。**
- **target resolution、spawn-path saturation、control surface richness 与 performance 尾债仍可继续深化。**
