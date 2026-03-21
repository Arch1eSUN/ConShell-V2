# ROUND 18.9 DETAILED AUDIT — 2026-03-20

## Audit Scope
审计目标：核验运行时所称 **Round 18.9 Runtime Resume Semantics Hardening** 是否与仓内真实证据一致，并判断：
- TaskQueue 是否已成为 dedupe 的 canonical enforcer
- Agenda 是否已成为 stale suppression 的 canonical owner
- Kernel scheduler handler 是否已真正完成“execution realization”，还是仍偏最小闭环
- walkthrough.md 是否真实存在
- 19.0 应继续收什么

审计依据：
- `DevPrompt/0199_Round_18_9_Runtime_Resume_Semantics_Hardening_Stale_Dedup_Closure_and_Execution_Consistency.md`
- `pnpm vitest run src`
- `packages/core/src/runtime/task-queue.ts`
- `packages/core/src/agenda/commitment-store.ts`
- `packages/core/src/kernel/index.ts`
- `docs/architecture/OPERATION_CONTINUITY_CONTRACT.md`
- `walkthrough.md` 存在性检查

---

## Executive Verdict
**结论：Round 18.9 主体属实，而且确实把 operation continuity 从“主路径已接线”继续推进到了“语义更可信”的阶段。**

更准确地说：

> **18.9 已真实完成 Queue-level dedupe canonicalization + Agenda-level execution eligibility canonicalization，并把 scheduler resume handler 从“最小 dispatch 占位”推进到“具备更清晰 lifecycle/logging 的执行过渡层”。**

但也必须明确降温：

> **18.9 还没有把恢复任务完全接入真实业务执行语义；它完成的是高价值的 semantics hardening，不是终局级 execution realization。**

因此本轮最准确的定位是：
- **G1 stale suppression：属实**
- **G2 queue authoritative dedupe：属实**
- **G4 consistency contract：属实**
- **G3 execution semantics realization：部分成立，但被说大了**
- **walkthrough.md 可用：不属实**

---

## 1. Test Baseline

### 裁定：属实，且真实口径比播报更清楚
我实测：

`cd /Users/archiesun/Desktop/ConShellV2/packages/core && pnpm vitest run src`

结果：
- **76 test files passed (76)**
- **1696 tests passed (1696)**
- **0 failures**

因此：
- 播报中“75 core integration and unit test suites / 1696 assertions”这种口径不应采信；
- 正式基线应继续使用：

> **76/76 files、1696/1696 tests、0 failures**

这也说明：
- 18.9 的 dedupe / eligibility / kernel handler 改动没有打坏 18.8 建立的主路径与测试平台。

---

## 2. Queue Authoritative Deduplication

### 裁定：**属实，且强成立**

从 `packages/core/src/runtime/task-queue.ts` 可见：
- `QueuedTask` 新增：
  - `commitmentId?: string`
- `TaskQueue` 新增：
  - `private _deduplicatedCount = 0`
  - `private activeCommitments = new Set<string>()`
- `enqueue()` 入口首先执行：
  - 如果 `task.commitmentId` 已在 `activeCommitments`
  - 则拒绝入队、增加 `_deduplicatedCount`、记录结果并返回 `false`
- 任务真正入队前，会：
  - `activeCommitments.add(task.commitmentId)`
- 任务结束时，在 `emitCompletionEvent()` 中：
  - `activeCommitments.delete(task.commitmentId)`

这说明：
- 去重已经不是 scheduler 自己猜，也不是 handler 外围临时判断；
- **TaskQueue 已经成为真正 authoritative dedupe gate。**

这与 18.9 的设计决策完全一致：
- Eligibility belongs to Agenda
- Dedupe belongs to TaskQueue
- Scheduler only dispatches

### 但仍要保留一条审计备注
当前去重键主要是：
- `commitmentId`

这对当前阶段是正确且高价值的，但仍不是最终级别：
- 若未来一个 commitment 合法地产生多种并行 execution lane，单一 `commitmentId` 去重可能过粗；
- 不过在当前阶段，这不构成反证，只是后续可能的精细化方向。

结论：

> **G2 强成立。**

---

## 3. Agenda Canonical Stale Suppression

### 裁定：**属实，且强成立**

从 `packages/core/src/agenda/commitment-store.ts` 可见：
- 新增：
  - `isExecutionEligible(id: string): { eligible: boolean; reason?: string }`
- 当前规则明确包含：
  - commitment 不存在 → ineligible
  - `TERMINAL_STATUSES` → ineligible
  - `blocked` → ineligible
  - 否则 eligible

这意味着：
- stale suppression 终于不再散落在 scheduler / kernel / queue 多处；
- **execution eligibility 的 canonical predicate 已经出现**。

从 `packages/core/src/kernel/index.ts` 可见：
- scheduler handler 第一件事就是：
  - `const eligibility = agenda.isExecutionEligible(task.commitmentId)`
- 若不满足：
  - 记录 `Scheduler skipped stale task`
  - 直接返回 success-skip

这完全符合 18.9 设计目标：
- Scheduler 不自己理解活性语义
- Agenda 成为执行资格真相源

### 但仍需实话实说
虽然方向完全正确，但当前 predicate 仍是第一版：
- 已覆盖 terminal / blocked / not-found
- 但还没有更细粒度：
  - `cancelled`
  - `superseded`
  - queue/live-state temporal drift
  - version/epoch-based resolution

所以：
- **G1 主体属实**
- 但还不是最终级 eligibility system

结论：

> **Agenda canonical suppression 已成立，但仍是 v1，不是终局版。**

---

## 4. Kernel Execution Realization

### 裁定：**部分成立，但被说大了**

从 `packages/core/src/kernel/index.ts` 可见：
- scheduler handler 现已明确：
  1. 查 `agenda.isExecutionEligible()`
  2. 获取 `commitment`
  3. 调 `taskQueue.enqueue(...)`
  4. 传入 `commitmentId`
  5. `execute()` 中记录：
     - `Realizing scheduled task execution`
     - 包含 `commitmentId / taskId / name / taskType`
  6. 返回：
     - `{ commitmentId, status: 'dispatched' }`

与 18.8 相比，这确实更前进了一步：
- 不再只是静默占位；
- 现在有更清楚的 lifecycle / dispatch logging；
- 也真正带上了 commitment identity。

### 但为什么不能说 fully realized
因为当前 `execute()` 仍然没有：
- 真正调用 `AgentLoop` 的 inference step
- 真正调用 tool execution path
- 真正 materialize 成具体业务动作

所以当前更准确的说法是：

> **execution realization 从纯 stub 前进到了带 lifecycle identity 的 dispatch realization，但还没有进入真实业务执行器。**

这点很重要，因为 18.9 DevPrompt 里的 G3 是：
- “restored task reaches real execution path”

而当前证据只支持：
- **restored task reaches canonical queue path**
- 还不支持：
- **restored task fully reaches concrete business execution semantics**

结论：

> **G3 只能判部分成立。**

---

## 5. Continuity Contract Update

### 裁定：**属实**

`docs/architecture/OPERATION_CONTINUITY_CONTRACT.md` 已新增：
- `## 5. Execution Consistency & Fault Discipline (Round 18.9)`

内容与代码基本一致：
- Queue Authoritative Dedupe
- Agenda Canonical Stale Suppression

这份文档的价值在于：
- 明确了 dual-layer boundary：
  - Queue = dedupe gate
  - Agenda = eligibility gate

这正是 18.9 最值得保留的结构化成果之一。

---

## 6. walkthrough.md Claim

### 裁定：**不属实**

我直接读取：
- `/Users/archiesun/Desktop/ConShellV2/walkthrough.md`

结果：
- `ENOENT: no such file or directory`

所以：
- 运行时所说 “The comprehensive walkthrough is available in walkthrough.md” 不成立。
- 这也再次验证一个重要模式：

> **`read ENOENT` 需要先判断文件是否本来就不存在，不能误归因给工具异常。**

---

## 7. What 18.9 Actually Achieved

### A. operation continuity 的责任边界更清楚了
现在可以明确说：
- Scheduler dispatches
- Agenda decides eligibility
- TaskQueue enforces dedupe

### B. resume semantics 从 wiring 层推进到了 policy/guard 层
18.8 的重点是 wiring，18.9 的重点是：
- suppress stale work
- suppress duplicate work
- 明确 dual-gate semantics

### C. kernel scheduler handler 更接近真实 runtime semantics
虽然 עדיין没 fully realize，但它已经不是“完全无语义的占位 enqueue”。

### D. 文档、代码、主路径三者更一致了
这说明 18.9 的价值不只是 patch，而是一次真实的 runtime consistency 收口。

---

## 8. What 18.9 Did NOT Finish

### 8.1 没有完成终局级 execution realization
恢复任务尚未真正 materialize 成 inference / tool / composite 的业务执行链。

### 8.2 没有完成更细粒度的 eligibility / staleness reasoning
当前是第一版 predicate，不是最细化版本。

### 8.3 没有完成 queue + agenda + scheduler 的更强 conflict epoch discipline
比如：
- snapshot generation
- queue reservation epoch
- live-vs-restored conflict resolution
仍未出现。

### 8.4 walkthrough artifact 没有生成
播报声称存在，但仓内不存在。

---

## Formal Verdict

### 对运行时播报逐项裁定

#### 1. “TaskQueue is authoritative dedupe enforcer”
**裁定：属实**

#### 2. “Agenda.isExecutionEligible is single source of truth”
**裁定：属实（v1 版本）**

#### 3. “Kernel execution realization completed”
**裁定：部分属实，但应降温**
- canonical dispatch/logging 更真实了
- 但还未 fully materialize into real business execution

#### 4. “Section 5 added to OPERATION_CONTINUITY_CONTRACT.md”
**裁定：属实**

#### 5. “walkthrough.md is available”
**裁定：不属实**

#### 6. 测试口径
**裁定：以实测为准**
- **76/76 files、1696/1696 tests、0 failures**

---

## Audit Conclusion
**Round 18.9 的真实定义应该是：Resume Semantics Hardening 主体成立，Dual-Gate Consistency 成立，但 Business Execution Realization 尚未完成。**

一句话总结：

> **18.9 成功把 operation continuity 从“主路径已接线”推进到了“恢复语义有 canonical guards”，但还没有把恢复任务真正推进到完整业务执行语义。**

因此 19.0 不应回头谈发布；
19.0 最合理的主轴应是：
- 把 restored task 从 queue-dispatch 进一步 materialize 到真实执行器
- 深化 eligibility / conflict reasoning
- 补 runtime resume 的完整一致性与更细故障纪律
- 若完成这些，再重新评估 continuous autonomy 是否接近“高可信闭环”

---

## Suggested Round 19.0 Direction
一句话：

> **19.0 应该从“dual-gate guards 已建立”继续推进到“restored work reaches real business execution semantics”，把 continuous autonomy 从 guarded resume 推向 truly executable resume。**
