# ROUND 18.8 DETAILED AUDIT — 2026-03-20

## Audit Scope
审计目标：核验运行时所称 **Round 18.8 — Operation Continuity** 是否与仓内真实证据一致，并判断：
- SchedulerService 是否已真正进入 Kernel canonical path
- boot restore / heartbeat tick / checkpoint / shutdown flush 是否真实接通
- runtime resume semantics 是否已经达到“真实闭环”，还是仍属最小可用版本
- 18.9 应继续收什么

审计依据：
- `DevPrompt/0198_Round_18_8_Operation_Continuity_Wiring_Scheduler_Canonicalization_and_Runtime_Resume_Closure.md`
- `pnpm vitest run src`
- `git diff` / `rg` 对 kernel / scheduler / continuity / docs 的检索
- 关键文件：
  - `packages/core/src/kernel/index.ts`
  - `packages/core/src/kernel/kernel-scheduler-resume.test.ts`
  - `packages/core/src/scheduler/scheduler-service.ts`
  - `packages/core/src/identity/continuity-service.ts`
  - `docs/architecture/OPERATION_CONTINUITY_CONTRACT.md`

---

## Executive Verdict
**结论：Round 18.8 主体真实成立，而且这次比 18.7 明显更扎实。**

更准确地说：

> **18.8 已把 scheduler snapshot persistence 从“底层 API 存在”推进到“Kernel canonical path 真接通”。**

这意味着：
- **boot restore：属实**
- **heartbeat 驱动 scheduler tick：属实**
- **checkpoint 保存 snapshot：属实**
- **shutdown flush snapshot：属实**
- **operation continuity contract 文档化：属实**
- **全量测试继续全绿：属实，而且实际口径比播报更强**

但也必须明确降温：

> **18.8 完成的是 operation continuity 的 canonical wiring 主体，而不是终局级 runtime resume semantics。**

也就是说：
- 主路径已经接通
- 但恢复语义仍偏最小闭环
- stale/duplicate suppression 仍主要依赖 agenda 状态检查，而不是更完整的 queue-level / dispatch-level recovery discipline

---

## 1. Test Baseline

### 1.1 全量测试真实结果：比播报更强
我实测：

`cd /Users/archiesun/Desktop/ConShellV2/packages/core && pnpm vitest run src`

结果：
- **76 test files passed (76)**
- **1696 tests passed (1696)**
- **0 failures**

因此运行时播报里的：
- `75 passed (76)`
- `1681 passed (1696)`

是**自相矛盾且不应采信**的口径。

真实基线应更新为：

> **76/76 files、1696/1696 tests、0 failures。**

这说明：
- 18.8 新增的 scheduler wiring + recovery test 没有打破全量基线；
- 还新增了 `kernel-scheduler-resume.test.ts`，把全量测试数从 75/1693 提升到 76/1696。

---

## 2. Scheduler Canonical Wiring

### 2.1 Boot resume：属实
从 `kernel/index.ts` 可见：
- 在 Step 7.5（Agenda & Scheduler）中，Kernel 真实实例化：
  - `MemorySchedulerBackend`
  - `SchedulerService`
- 随后调用：
  - `identityResult.continuity.loadSchedulerSnapshot()`
- 如果存在 snapshot：
  - `sched.restore(snapshot)`
  - 并记录 `Scheduler snapshot restored`

这说明：

> **18.8 已经修复了 18.7 最大缺口：scheduler snapshot 不再只是 ContinuityService 的孤立 API，而是正式进入了 Kernel boot path。**

### 2.2 Heartbeat-driven tick：属实
仍在 `kernel/index.ts` 中可见：
- `HeartbeatDaemon` 注册了新 phase：
  - `scheduler-tick`
- 周期：
  - `10 * 1000`
- 执行体：
  - `scheduler.tick()`

这说明：
- 18.8 采用的是 **Kernel/Heartbeat-driven executive**，而不是让 Scheduler 自己持有私有定时器。
- 这与前面的架构决策完全一致：
  - **Kernel 是 operation continuity canonical owner**
  - `SchedulerService` 是被管理组件，而非独立自治 owner

### 2.3 Checkpoint persistence：属实
从 `kernel/index.ts` 检索结果可见：
- `checkpointTurn()` 内：
  - `const schedSnap = this.services.scheduler.snapshot();`
  - `continuity.saveSchedulerSnapshot(schedSnap);`

这说明：

> **snapshot 的保存已经接入 per-turn checkpoint 主路径。**

### 2.4 Shutdown flush：属实
从 `kernel/index.ts` 可见：
- `shutdown()` 内部先执行：
  - `this.checkpointTurn()`
- 之后又显式再次：
  - `scheduler.snapshot()`
  - `continuity.saveSchedulerSnapshot(schedSnap)`

因此：
- 18.8 的 shutdown flush 不是口头设计，而是真正代码落地。
- 这一点与 `kernel-scheduler-resume.test.ts` 的预期也一致：
  - shutdown 期间会触发两次 snapshot save（一次 checkpoint，一次显式 flush）

结论：

> **G1 Scheduler Snapshot Canonical Wiring：主体强成立。**

---

## 3. Runtime Resume Semantics

### 3.1 Dispatch handler 已真实存在：属实
从 `kernel/index.ts` 可见：
- 在 automaton 阶段，Kernel 给 `scheduler` 设置了 `setHandler(...)`
- handler 逻辑会：
  1. 用 `task.commitmentId` 去 `agenda.get()` 找 commitment
  2. 若不存在 → failure
  3. 若状态是 `completed / abandoned / failed` → 直接 skip success
  4. 否则 `agenda.markActive(commitment.id)`
  5. 再向 `taskQueue.enqueue(...)`

这说明：
- scheduler 不直接执行任务
- 而是把 due task 转为统一的 runtime queue item
- 这与 `OPERATION_CONTINUITY_CONTRACT.md` 中“Scheduler 不直接执行，而是通过 `taskQueue` 进入主执行流”的定义一致

### 3.2 “恢复出来的任务变成活执行流”：部分属实，偏最小闭环
这次比 18.7 强很多，因为：
- snapshot restore 已进入 boot
- tick 已进入 heartbeat
- handler 已接 taskQueue

所以至少已经不是“死数据回读”。

但仍必须实话实说：
- 当前 handler 的 `execute()` 仍只是：
  - 返回 `{ commitmentId, status: 'dispatched' }`
- 也就是说，它把任务推入队列了，但并未证明“恢复后的 commitment 已完整回到真实业务执行器”
- 更像是：
  - **runtime resume 的 canonical dispatch path 建立了**
  - 但“恢复后如何继续到具体业务动作”仍偏简化实现

### 3.3 防重逻辑：有，但仍是最小版
目前已看到的 stale/duplicate 防护是：
- 若 agenda 中该 commitment 已是：
  - `completed`
  - `abandoned`
  - `failed`
  则直接 skip

这比 18.7 没有主路径时已经强很多，但仍有明显边界：
- 未见 queue-level dedupe key
- 未见“已入队但未执行”状态的专门 suppress 机制
- 未见 `cancelled` / `superseded` 等更细粒度状态防重
- 未见 snapshot generation / epoch 对比
- 未见 restore-vs-live-state 的冲突解决策略超出 agenda status 级别

所以这部分的准确判断应该是：

> **18.8 已建立 runtime resume 的最小可用语义，但还不是终局级 idempotency / duplicate suppression / stale snapshot discipline。**

---

## 4. Recovery Testing

### 4.1 `kernel-scheduler-resume.test.ts`：属实
确实存在，并覆盖了三件事：
1. boot restore from snapshot
2. checkpoint save snapshot
3. shutdown flush snapshot

这正是 18.8 最该补的 recovery tests。

### 4.2 但测试范围仍偏骨架级
当前这些测试主要验证：
- wiring 是否存在
- save/load 是否被调用
- snapshot 数据结构是否被传递

尚未覆盖得足够深的点包括：
- malformed snapshot during kernel boot 的降级行为
- stale snapshot + completed commitment 的重复触发抑制
- 已入队未执行任务的去重
- 多次 heartbeat tick 下的竞态边界
- runtime resume 后 queue 消费与 agenda 状态联动的完整一致性

因此：

> **18.8 的测试证明 wiring 主体成立，但对 resume semantics 的深层可靠性覆盖仍不充分。**

---

## 5. Operation Continuity Contract

### 裁定：属实，且有价值
文档 `docs/architecture/OPERATION_CONTINUITY_CONTRACT.md` 已存在，并且内容与实际代码主路径基本一致：
- Boot Hydration
- Turn Checkpointing
- Safe Shutdown
- Scheduler through `taskQueue`
- malformed snapshot defensive fallback

这份文档的价值在于：
- 它第一次把 `Operation Continuity` 明确区分为：
  - identity continuity
  - commitment recovery
  - execution continuity（scheduler-based）

这是好的架构澄清。

但也要注意：
- 文档中有些强表述仍应以后续更强测试和更完整语义闭环来支撑；
- 当前最硬证据仍然是代码和测试，不是 contract 文档本身。

---

## 6. What 18.8 Actually Achieved

### A. 修复了 18.7 最关键的真实性缺口
18.7 最大问题是：
- snapshot API 存在
- 但未进主路径

18.8 已真正解决这一点。

### B. 明确了 canonical owner
通过当前实现可以清楚看出：
- **Kernel / HeartbeatDaemon** 是 operation continuity 的主 owner
- `ContinuityService` 负责 persistence substrate
- `SchedulerService` 负责 snapshot/restore + tick dispatch

这比此前分散状态清晰得多。

### C. 建立了最小可用的 runtime resume pipeline
链路已形成：
- boot restore snapshot
- heartbeat tick due tasks
- handler consult agenda
- enqueue into taskQueue

这说明“恢复后重新进入执行流”已不再只是口头目标。

### D. 测试与文档都补上了最关键骨架
这是一次真实的 architecture-to-runtime 收口，不是纯代码散点修改。

---

## 7. What 18.8 Did NOT Finish

### 7.1 没有完成终局级 runtime resume semantics
目前更像 minimal viable resume pipeline，而不是 fully hardened execution continuity。

### 7.2 没有完成更强的 stale/duplicate/idempotency discipline
当前防重仍主要依赖 agenda status 判断，尚不够完备。

### 7.3 没有完成 queue / scheduler / agenda 的更深 canonical owner 清理
虽然 owner 已明显收束，但更细粒度的 conflict resolution 和 execution ownership 仍可继续收口。

### 7.4 没有证明恢复任务已能完整触发真实业务执行，而不仅是统一入队
当前 `execute()` 仍偏占位式 dispatch success。

---

## Formal Verdict

### 对运行时播报逐项裁定

#### 1. “Wire Scheduler into Kernel Boot”
**裁定：属实**
- Kernel 确已实例化 `SchedulerService`
- 确已在 boot 阶段 restore snapshot

#### 2. “Implement Persistence Hooks”
**裁定：属实**
- `checkpointTurn()` / `shutdown()` 均已接 snapshot save

#### 3. “Recovery Testing”
**裁定：主体属实，但测试深度有限**
- `kernel-scheduler-resume.test.ts` 存在并覆盖骨架
- 但还没覆盖更深恢复语义

#### 4. “Operation Continuity Boundary Document”
**裁定：属实**
- 文档已存在，且与主路径基本一致

#### 5. “Runtime Resume / Operation Continuity fully established”
**裁定：主体成立，但必须降温表述**
- canonical wiring 主体成立
- semantics hardening 仍未终局

#### 6. 播报中的测试数字
**裁定：不采信，使用实测替代**
- 实测应以 **76/76 files、1696/1696 tests、0 failures** 为准

---

## Audit Conclusion
**Round 18.8 的真实定义应该是：Operation Continuity Canonical Wiring 成立，Runtime Resume Pipeline 最小闭环成立，但 Resume Semantics Hardening 尚未完成。**

一句话总结：

> **18.8 真正完成了“把 scheduler continuity 接进主运行时”，但还没有完成“把恢复语义打磨到终局级可靠”。**

因此 18.9 不应回头谈发布；
18.9 最合理的主轴应是继续收：
- stale/duplicate suppression
- queue/scheduler/agenda 恢复一致性
- resume 后真实业务执行语义
- malformed/conflicting snapshot 的更强 fault discipline

---

## Suggested Round 18.9 Direction
一句话：

> **18.9 应该从“主路径已接通”继续推进到“恢复语义已硬化”，把 operation continuity 从最小可用闭环推进到高可信闭环。**
