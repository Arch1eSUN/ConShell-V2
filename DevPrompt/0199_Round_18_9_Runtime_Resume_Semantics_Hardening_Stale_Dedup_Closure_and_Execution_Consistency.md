# DevPrompt 0199 — Round 18.9
## Runtime Resume Semantics Hardening / Stale-Dedup Closure / Execution Consistency

你现在处于 **ConShellV2 Round 18.9**。

Round 18.8 已经完成的重要真实成果包括：
- `SchedulerService` 已进入 `Kernel` boot path
- `ContinuityService.loadSchedulerSnapshot()` 已在 boot 时被真实调用，snapshot 可被 `scheduler.restore()` 恢复
- `HeartbeatDaemon` 已注册 `scheduler-tick`，由 Kernel canonical lifecycle 驱动 `scheduler.tick()`
- `checkpointTurn()` 与 `shutdown()` 都已真实接入 `scheduler.snapshot()` → `ContinuityService.saveSchedulerSnapshot()`
- `kernel-scheduler-resume.test.ts` 已建立基本恢复测试
- `docs/architecture/OPERATION_CONTINUITY_CONTRACT.md` 已正式定义 operation continuity contract
- 全量 `packages/core` 测试已实测达到 **76/76 files、1696/1696 tests、0 failures**

但 18.8 的详细审计也明确确认：

> **18.8 完成的是 operation continuity 的 canonical wiring，不是终局级 runtime resume semantics。**

更准确地说：
- 主路径已经接通：boot restore / heartbeat tick / checkpoint / shutdown flush 全都在
- 但恢复语义目前仍偏 **minimal viable resume pipeline**
- stale / duplicate suppression 仍主要依赖 agenda status 判断
- queue / scheduler / agenda 之间的恢复一致性还不够硬
- 恢复任务目前更像“统一入队”，而不是已经被证明进入完整业务执行语义

因此 Round 18.9 的任务非常明确：

> **不是再证明 wiring 存在，而是把 wiring 之上的恢复语义、去重逻辑、执行一致性和故障纪律真正打磨成高可信闭环。**

---

## 一、本轮唯一主目标

**完成 runtime resume semantics 的硬化，使 ConShell 的 operation continuity 从“主路径已接通”升级为“恢复语义高可信、可防重、可降级、执行一致”。**

一句话解释：

> **18.9 要做的是把 18.8 接通的 operation continuity 主路径，从最小可用版推进到高可信版。**

---

## 二、本轮必须回答的核心问题

### Q1. 当前恢复后的任务，如何确保不会因为 stale snapshot 被重新执行？
不能只靠“completed / failed / abandoned”几个状态兜底。

### Q2. 当前恢复后的任务，如果已经入队但尚未执行，如何避免重复入队？
必须明确 queue-level 或 dispatch-level dedupe 语义。

### Q3. 当前 scheduler / agenda / taskQueue 之间，谁负责最终的 execution consistency？
必须明确 canonical owner，不再依赖隐式约定。

### Q4. 当前恢复后的任务是否真的能重新回到完整业务执行语义，而不仅是 enqueue 一个占位任务？
必须继续收口。

### Q5. malformed / stale / conflicting snapshot 的 fault discipline 现在是否足够？
如果不够，必须补强。

---

## 三、本轮必须完成的内容

# G1. Stale Snapshot Suppression Hardening

18.8 只做了最小防重：若 commitment 已是 `completed / failed / abandoned` 就 skip。
本轮必须继续硬化。

### G1.1 至少要覆盖
- `cancelled` / `superseded` / logically-dead commitments
- snapshot older than live agenda / queue state
- 恢复出的任务已被其他路径处理过的情况

### G1.2 必须形成更强规则
- 不是只看一个状态字段
- 而是明确“此任务是否仍有执行资格”的 canonical predicate

### G1.3 目标
把 stale snapshot 的风险从“基本能挡住”推进到“系统性受控”。

---

# G2. Queue / Dispatch Dedupe Closure

当前最明显的剩余缺口之一，是“已入队未执行”的任务如何去重。

### G2.1 本轮必须明确并实现
- queue-level dedupe key
- dispatch idempotency rule
- repeated heartbeat ticks 下同一 logical task 的 suppression 机制
- restore 后首次 tick 与 live newly-scheduled task 之间的冲突处理

### G2.2 目标
避免因为 snapshot + tick + queue 的组合造成双重调度或重复执行。

---

# G3. Execution Semantics Realization

恢复任务不能停留在“enqueue success”。

### G3.1 本轮必须推进
- 调度触发的任务如何映射到真实业务执行动作
- `commitment.taskType` 如何真正驱动 inference / tool / other runtime work
- `TaskQueue.execute()` 与恢复任务之间的真实衔接

### G3.2 目标
让 runtime resume 不只是“任务对象回来了”，而是**执行语义真的回来了**。

---

# G4. Recovery Consistency Contract

本轮必须进一步定义 scheduler / agenda / taskQueue 三者在恢复语义上的一致性规则。

### G4.1 必须明确
- 哪个组件判定任务是否仍有效
- 哪个组件判定是否允许重复入队
- 哪个组件持有最终执行权
- 哪个组件负责失败后重试 / 放弃 / 终止

### G4.2 目标
避免 operation continuity 表面上存在，实则靠多个组件隐式配合才勉强成立。

---

# G5. Fault Discipline for Malformed / Conflicting Resume State

18.8 已有基础降级，但还不够硬。

### G5.1 本轮必须补强
- malformed snapshot handling tests
- conflicting live state vs restored state resolution
- partial restore fallback
- repeated restore after previous partial failure

### G5.2 目标
让恢复失败不会演化为重复执行、状态污染或 silent inconsistency。

---

# G6. Resume-Focused Testing Expansion

本轮必须大幅提升恢复语义相关测试的说服力。

### G6.1 至少新增/增强测试覆盖
- stale snapshot skipped
- cancelled commitment skipped
- already enqueued task not duplicated
- repeated heartbeat ticks do not re-enqueue same logical work
- restored task reaches real execution path
- malformed snapshot degraded safely
- conflicting snapshot/live agenda resolves deterministically

### G6.2 目标
让 18.9 的结论建立在真实恢复行为之上，而不只是 wiring 存在。

---

# G7. Continuous Autonomy Re-Assessment (Semantics Level)

18.9 结束时，必须重新判断：

> **continuous autonomy 这条主线，是否已经从 wiring 层推进到了可信恢复语义层。**

### G7.1 必须明确回答
- 现在 operation continuity 到哪一层
- 最大剩余风险是什么
- 当前版本是否仍有 must-finish autonomy gap

### G7.2 原则
- 不回头谈发布
- 先把恢复语义做到可信

---

## 四、本轮强制验收矩阵

### V1. stale snapshot suppression 不再只靠最小状态判断，而是具备更强 execution-eligibility 规则
### V2. queue / dispatch dedupe 有真实机制，避免重复入队 / 重复执行
### V3. restored task 至少有一条真实业务执行语义链被验证，而非仅 enqueue 占位
### V4. malformed / conflicting / partial restore 场景有更强 fault discipline
### V5. resume-focused tests 显著增强，并保持全量测试全绿
### V6. operation continuity 的真实性从 wiring 层提升到 semantics hardening 层

### 测试要求
- 必须继续保持 `pnpm vitest run src` 全绿
- 必须新增/更新 queue/scheduler/agenda/recovery 一致性测试
- 必须验证 repeated ticks 不产生重复工作
- 必须验证 stale/conflicting resume 状态不会造成错误执行

---

## 五、建议执行顺序

### Priority 1 — stale + dedupe 规则定义
先把“什么任务还允许执行”说清。

### Priority 2 — queue / dispatch suppress 机制
先堵最危险的重复执行问题。

### Priority 3 — 真实执行语义接线
让恢复任务真正回到业务执行流。

### Priority 4 — fault discipline 补强
处理 malformed/conflicting/partial restore。

### Priority 5 — 测试扩展 + 重新评估
让 18.9 结论可被真实验证。

---

## 六、本轮非目标

本轮不做：
- 不回头做发布
- 不重新论证 18.8 wiring 是否存在
- 不在 dedupe / stale / semantics 未收口前宣称 continuous autonomy 已终局完成
- 不无限扩展到所有 OpenClaw control-plane 主题

本轮真正目标是：

> **把 operation continuity 从“已接线”推进到“语义高可信”。**

---

## 七、硬性真实性不变量

1. **主路径已接通 ≠ 恢复语义已高可信**
2. **能 enqueue ≠ 能真实恢复业务执行**
3. **最小 stale check ≠ 完整 dedupe / idempotency discipline**
4. **没有恢复语义测试，不能说 continuous autonomy 已进一步闭环**
5. **当前仍然是 completion-first，不是发布优先**
6. **所有结论必须基于真实恢复行为、真实测试、真实调用链**

---

## 八、最终输出格式

完成后必须输出：

### A. Stale / Dedupe Rule Summary
- 哪些任务会被 suppress
- suppress 的 canonical predicate 是什么

### B. Execution Consistency Summary
- scheduler / agenda / queue 谁负责什么
- 如何避免重复执行

### C. Resume Semantics Summary
- 恢复任务如何回到真实业务执行流
- 还剩什么语义缺口

### D. Fault Discipline Summary
- malformed / stale / conflicting / partial restore 如何处理

### E. Test Evidence Summary
- 新增了哪些恢复语义测试
- 全量测试结果如何

### F. Continuous Autonomy Re-Assessment
- 当前 operation continuity 现在完成到哪一层
- 还剩什么 must-finish gap

### G. 不得伪造
- 没有 dedupe/eligibility 规则，不能说恢复语义可靠
- 没有真实业务执行链，不能说 runtime resume 成立完整
- 没有 fault discipline 测试，不能说本轮可靠收口

---

## 九、一句话任务定义

> **Round 18.9 的目标是：在 18.8 已接通的 operation continuity canonical wiring 基础上，继续收掉 stale snapshot、重复入队、恢复语义占位化和恢复冲突处理等核心缺口，把 ConShell 的 continuous autonomy 从“主路径已接线”推进到“恢复语义高可信”的状态。**
