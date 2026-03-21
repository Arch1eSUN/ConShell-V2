# Round 20.2 审计报告
## Economic Organism Closure / Revenue Surface / Ledger-Reserve Loop / Runtime Law Deepening 真实性审计

> 审计日期：2026-03-21
> 方法：仓内代码取证 + 独立测试/类型检查/构建验证
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 20.2 的主体宣称成立，而且是强成立。**

更准确地说：
- **G1 Revenue Surface Canonicalization：成立**
- **G2 Unified Ledger Writeback / TaskSettlementBridge：成立**
- **G3 Runtime Law Deepening：成立**
- **G4 Operator Economic Truth：基本成立**
- **G5 Spawn Affordability / Child Economy Gate：成立**
- **验证口径 `packages/core 96/96 files、1916/1916 tests 全绿`：成立**
- **CLI TypeScript / Dashboard TypeScript / Dashboard build 通过：成立**

因此，20.2 不是“经济模块继续打磨”的普通一轮，而是一轮**把经济系统从 admission-aware 进一步推进到更像 runtime law / accounting loop 的强收口轮。**

---

## 2. 独立验证结果

### 2.1 Core 全量测试
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **96 passed (96)**
- **1916 passed (1916)**
- 退出码 **0**

这比 20.1 的 93/1890 再次上升，说明 20.2 不仅新增实现，也新增了相应测试覆盖。

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
build 仍然保留：
- `metamask-sdk ... 557.74 kB`
- `index ... 581.13 kB`
- `Some chunks are larger than 500 kB after minification.`

所以：
> **20.2 全绿成立，但 performance 尾债仍未消失。**

---

## 3. G1 审计：Revenue Surface Canonicalization

### 已确认事实
仓内存在并已修改：
- `packages/core/src/economic/revenue-surface.ts`
- `packages/core/src/economic/revenue-surface-canonical.test.ts`

### 核心成立点
`revenue-surface.ts` 已采用我们要求的 **C 方案**：
- 保留原有 `RevenueSurface`
- 新增 `TaskRevenueSurface extends RevenueSurface`
- 新增 `createTaskRevenueSurface()` factory
- 新增 `validateTaskRevenueSurface()` validator

`TaskRevenueSurface` 已明确具备：
- `executionCostEstimateCents`
- `marginCents`
- `riskLevel`
- `settlementMode`
- `expectedPayoffWindowMs`
- `netUtilityCents`

### 判断
**G1 成立。**
这不是粗暴破坏旧 revenue surface，而是完成了 task-based revenue canonical contract 的渐进式收口。

---

## 4. G2 审计：Unified Ledger Writeback / TaskSettlementBridge

### 已确认事实
仓内存在：
- `packages/core/src/economic/task-settlement-bridge.ts`
- `packages/core/src/economic/task-settlement-bridge.test.ts`

### 核心成立点
已新增独立协调层 `TaskSettlementBridge`，并且结构符合我们先前要求：
- 不把 writeback 塞进 `LifeCycleEngine`
- 不把 `CanonicalSettlementLedger` 做胖成业务协调器
- 而是由 bridge 负责：
  - task outcome 解释
  - revenue surface 解析
  - ledger 写入
  - revenue surface stats 更新
  - net impact summary 返回

`TaskSettlementBridge` 已具备：
- `TaskOutcome`
- `TaskSettlementResult`
- `settleTaskOutcome()`
- `diagnostics()`

### 判断
**G2 成立。**
但要保持一点审计边界：
- 当前代码证据非常强地证明了 **task outcome → ledger writeback → net impact summary** 已成立
- 但“reserve/runway/projection refresh” 在当前实现中主要仍体现在架构定位与后续服务协作意图，单从已读代码片段看，还不是 fully rich bridge orchestration

因此，最准确口径是：
> 20.2 已真实建立 canonical task economic writeback 协调层，并把 ledger writeback 主路径接通；更深的 projection auto-refresh 仍可继续加强。

---

## 5. G3 审计：Runtime Law Deepening

### 已确认事实
仓内存在并已修改：
- `packages/core/src/runtime/agenda-arbiter.ts`
- `packages/core/src/runtime/lifecycle-engine.ts`
- `packages/core/src/runtime/agenda-arbiter.test.ts`
- `packages/core/src/runtime/lifecycle.test.ts`

### 核心成立点
`AgendaArbiter.reprioritize()` 已按照我们要求接收：
- `projection?: EconomicProjection`

而不是新造特例模块或 event-only 绕法。

`computeScore()` 中已明确引入经济因子：
- under-pressure revenue bonus
- runway urgency factor
- low reserve penalty for expensive non-revenue tasks

`LifeCycleEngine.onTick()` 已明确：
- 读取 `economicService.getProjection()`
- 调用 `arbiter.reprioritize('tick', projection)`

### 判断
**G3 成立。**
而且这是 20.2 最关键的真实推进之一：

> **economic law 已不再只影响 admission，而开始影响 runtime reprioritization。**

这意味着至少两条 runtime 决策路径已可被经济状态解释：
1. admission / defer / reject
2. tick 驱动的 agenda reprioritize

---

## 6. G4 审计：Operator Economic Truth

### 已确认事实
仓内存在并已修改：
- `packages/core/src/server/routes/governance.ts`

新增路由：
- `GET /api/governance/economic-truth`

### 核心成立点
当前 `economic-truth` 端点已提供：
- inbox summary
- governance proposal count
- recent spawn outcomes
- generatedAt

### 判断
**G4 基本成立，但只能算“第一版成立”。**

原因：
- 它确实新增了 dedicated economic organism dashboard endpoint
- 但从当前代码看，它还更偏 **governance + organism summary**，而不是 fully rich economic truth panel
- 目前尚未独立看到 reserve / burn / runway / realized recent value / expected incoming value 全量在该端点中显式展开

所以最准确口径是：
> 20.2 已真实新增 operator-facing economic organism endpoint，但其经济真相表达仍偏第一版，后续仍应继续加深。

---

## 7. G5 审计：Spawn Affordability / Child Economy Gate

### 已确认事实
仓内存在：
- `packages/core/src/economic/spawn-affordability-gate.ts`
- `packages/core/src/economic/spawn-affordability.test.ts`

### 核心成立点
`SpawnAffordabilityGate` 已真实存在，并提供：
- reserve floor check
- runway floor check
- max budget check
- survival tier impact check
- payoff window / net impact 输出

这已经让 spawn proposal 更明显地接近：
- 经济可行性判断
- 资本支出审批
- child runtime affordability gate

### 判断
**G5 成立。**
这是对 20.1 governance-gated replication 的有效深化：
- 不再只是“政策是否允许”
- 而是开始问“经济上养不养得起”

---

## 8. 本轮最重要的真实增量

20.2 最重要的真实意义有 4 点：

### 8.1 revenue surface 从“已有 registry”推进成“task-based canonical contract”
这让 task-based revenue 有了更强统一语义，而不是继续散落在 evaluator / admission 推断中。

### 8.2 economic writeback 正式进入主路径
`TaskSettlementBridge` 让 admission 之后的执行结果更真实地回写到账本与经济结果语义里。

### 8.3 economic law 正式开始影响 runtime reprioritization
这是 20.2 最大的 runtime 级推进。

### 8.4 replication approval 更接近资本支出判断
spawn affordability 把 child runtime 从 governance question 更推进为 economic organism question。

---

## 9. 保留问题 / 未完成项

20.2 强成立，但仍有几项不能夸大：

1. **operator economic truth 仍是第一版**
   - 端点已存在
   - 但 economic dashboard truth 仍未达到 fully mature organism finance panel

2. **task settlement bridge 的 projection refresh 仍可继续加强**
   - 当前 bridge 已清楚建立 writeback 主路径
   - 但完整的 reserve/runway auto-refresh 深化仍可继续推进

3. **performance 尾债仍在**
   - Dashboard 仍有 >500kB chunk

4. **economic organism 仍未终局收口**
   - 20.2 已明显推进
   - 但还没到成熟 revenue ecosystem / fully autonomous market behavior 层级

---

## 10. 最终结论

**Round 20.2 主体成立，而且是一次高质量强成立轮。**

正式口径建议写为：

> **20.2 已真实完成 task-based revenue canonicalization、task economic writeback bridge、economic-aware agenda reprioritization、spawn affordability gate，并新增 operator-facing economic organism endpoint；独立验证结果为 `packages/core 96/96 files、1916/1916 tests` 全绿，CLI TypeScript 通过，Dashboard TypeScript + build 通过。**

同时保留理性约束：
- **这不等于 ConShell 已完成成熟 economic organism 终局。**
- **operator economic truth 与更深层 accounting/projection 闭环仍有后续空间。**
