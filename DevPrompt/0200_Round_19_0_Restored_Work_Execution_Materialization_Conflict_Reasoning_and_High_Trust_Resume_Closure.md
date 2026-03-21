# DevPrompt 0200 — Round 19.0
## Restored Work Execution Materialization / Conflict Reasoning / High-Trust Resume Closure

你现在处于 **ConShellV2 Round 19.0**。

Round 18.9 已经完成的重要真实成果包括：
- `TaskQueue` 已成为 `commitmentId` 级去重的 canonical enforcer
- `CommitmentStore.isExecutionEligible()` 已成为 stale snapshot suppression 的 canonical predicate（v1）
- `Kernel` 的 scheduler handler 已先做 eligibility，再走 queue dedupe，再进入统一 dispatch path
- `docs/architecture/OPERATION_CONTINUITY_CONTRACT.md` 已新增 `Execution Consistency & Fault Discipline` 章节
- 全量 `packages/core` 测试已实测继续保持 **76/76 files、1696/1696 tests、0 failures**

但 18.9 的详细审计也已经确认：

> **18.9 完成的是 guarded resume semantics，不是 restored work 的终局执行语义。**

更准确地说：
- stale suppression 有了
- queue dedupe 有了
- dual-gate boundaries 清楚了
- 但恢复任务目前仍主要停留在：
  - eligibility check
  - queue dispatch
  - lifecycle log
  - enqueue success / dispatch success

而还没有完成：

> **把 restored task 真正 materialize 到 inference / tool / composite 的真实业务执行器。**

这意味着，ConShell 当前已经从：
- wiring 不存在 →
- wiring 存在 →
- guarded resume 成立

继续进入下一阶段：

> **high-trust executable resume**

也就是：
- 恢复任务不只是被允许进入系统
- 而是能被真实、可控、可审计地继续执行
- 同时不造成重复执行、语义漂移或 runtime conflict

因此 Round 19.0 的任务非常明确：

> **把 restored work 从“guarded dispatch”继续推进到“真实业务执行 materialization”，并补强 conflict reasoning 与高可信恢复闭环。**

---

## 一、本轮唯一主目标

**完成 restored work 的真实执行 materialization，使 operation continuity 从 guarded resume 升级为 high-trust executable resume。**

一句话解释：

> **19.0 要做的是让恢复出来的工作不只是被 queue 接受，而是真正回到 ConShell 的业务执行语义里。**

---

## 二、本轮必须回答的核心问题

### Q1. 恢复出来的 commitment，如何真正进入对应的业务执行器？
必须明确：
- cognitive → inference / agent loop
- tool_call → tool execution path
- 其他 task types → 对应 runtime action

### Q2. 恢复任务在真实执行前，如何完成最终 conflict reasoning？
即使 eligibility 与 dedupe 已通过，也可能仍有：
- live state drift
- mode conflict
- superseded execution intent
- newer plan has replaced older one

### Q3. 谁负责 restored work 的最终 execution materialization？
不能继续停留在“Kernel handler + queue”这一级模糊地带。

### Q4. 当前 runtime resume 在真实执行后，如何与 agenda state / task completion / retry / failure semantics 保持一致？
必须建立完整闭环。

### Q5. 什么条件下我们才能说 continuous autonomy 已接近高可信闭环，而不是只是 guarded recovery？
必须用更高标准回答。

---

## 三、本轮必须完成的内容

# G1. Restored Work Execution Materialization

这是 19.0 的核心。

### G1.1 必须把恢复任务推进到真实执行器
至少覆盖：
- `cognitive` commitment → inference / agent execution path
- `tool_call` commitment → tool execution path
- 若已有其他 canonical runtime action 类型，也必须明确映射

### G1.2 不再接受
- 只 enqueue 一个占位任务
- 只记录日志后返回 `dispatched`
- 没有真实业务执行路径的“形式恢复”

### G1.3 目标
让恢复任务真正回到系统的业务层，而不是只停留在调度层。

---

# G2. Final Conflict Reasoning Before Execution

18.9 的 eligibility 是第一层 guard，但 19.0 必须补 execution-time conflict reasoning。

### G2.1 至少考虑
- live agenda intent 已替换旧 snapshot intent
- current mode / survival posture 已改变
- governance / identity / lineage posture 已变化
- task 已被其他 path 部分处理
- queue acceptance 后到真正执行前状态再次变化

### G2.2 必须形成更强规则
- pre-execution revalidation
- conflict classification
- suppress / defer / reroute / fail-fast 决策

### G2.3 目标
避免“恢复合法，但执行时已不再合理”的语义漂移。

---

# G3. Execution Ownership & Materializer Boundary

当前 `Kernel` handler 已做很多，但 19.0 必须更明确谁是最终 materializer。

### G3.1 必须明确
- `Kernel` 负责什么
- `TaskQueue` 负责什么
- `AgentLoop` 负责什么
- 是否需要显式的 `CommitmentMaterializer` / runtime execution adapter 进入主路径

### G3.2 原则
- 不让 execution ownership 再次变模糊
- 不让“恢复语义”分散在多个组件里靠隐式协作成立

### G3.3 目标
让 restored work 的业务执行拥有清晰 canonical owner。

---

# G4. Agenda / Queue / Execution State Coherence

一旦恢复任务进入真实执行，状态一致性要求会更高。

### G4.1 必须确保
- enqueue → active → completed / failed / blocked 的状态转换与 agenda 一致
- retry / abandonment / suppression 的语义一致
- runtime execution result 能正确回写 commitment state
- 已恢复工作不会在完成后再次被 scheduler/tick 拉起

### G4.2 目标
让 operation continuity 不只是“恢复出东西”，而是“恢复后状态系统继续一致”。

---

# G5. Resume Conflict & Fault Discipline Expansion

19.0 必须把 18.9 还偏浅的 conflict handling 再推进一层。

### G5.1 至少补强
- restore-after-live-progress conflict
- restored work already completed by another lane
- stale but non-terminal commitments
- partial execution after restore then restart again
- queue accepted but execution vetoed by revalidation

### G5.2 目标
让 high-trust resume 不怕现实里的脏状态与重启竞态。

---

# G6. Resume-to-Execution Testing Expansion

本轮必须新增更强测试，证明恢复任务不只是进 queue，而是真的进入业务执行路径。

### G6.1 至少覆盖
- restored cognitive task reaches inference path
- restored tool_call reaches tool execution path
- execution-time conflict veto works
- completed after restore will not be re-dispatched again
- retry/failure semantics remain coherent after restore
- revalidation failure does not corrupt agenda state

### G6.2 目标
让 19.0 的结论建立在“恢复后真实执行行为”之上。

---

# G7. Continuous Autonomy High-Trust Re-Assessment

19.0 结束时，必须重新判断：

> **continuous autonomy 是否已经从 guarded resume 推进到 high-trust executable resume。**

### G7.1 必须明确回答
- operation continuity 当前已完成到哪一层
- 还剩什么最关键缺口
- 当前版本是否已经逼近“连续自治高可信闭环”

### G7.2 原则
- 仍不回头谈发布
- 先把恢复后的真实执行做对

---

## 四、本轮强制验收矩阵

### V1. restored work 不再只停在 queue/dispatch，而是至少有一条真实业务执行链被接通
### V2. execution-time conflict reasoning 存在，并能 veto 不再合理的恢复执行
### V3. agenda / queue / execution state coherence 在恢复路径下真实成立
### V4. resume-related fault discipline 进一步扩展，覆盖更真实的竞态与漂移场景
### V5. 新增恢复→执行测试，且全量测试仍全绿
### V6. continuous autonomy 的真实性从 guarded resume 提升到 high-trust executable resume

### 测试要求
- 必须继续保持 `pnpm vitest run src` 全绿
- 必须新增 restored work → real execution tests
- 必须验证 execution-time veto / conflict revalidation
- 必须验证恢复后完成态不会再次被重复执行

---

## 五、建议执行顺序

### Priority 1 — 明确 restored work 的 canonical execution owner
先确定最终 materializer。

### Priority 2 — 接通至少一条真实业务执行链
先让恢复任务真的做事。

### Priority 3 — 加 execution-time conflict reasoning
让“能执行”升级为“该执行才执行”。

### Priority 4 — 补状态一致性与 fault discipline
防止恢复后状态漂移。

### Priority 5 — 补恢复→执行测试并重判 autonomy 完成度
让 19.0 结论可验证。

---

## 六、本轮非目标

本轮不做：
- 不回头做发布
- 不重新争论 queue vs agenda 的 canonical boundary
- 不在 restored work 仍只是 dispatch placeholder 时宣称 continuous autonomy 已高可信闭环
- 不无限扩展到其他低优先级主题

本轮真正目标是：

> **让恢复任务真正回到业务执行器，把 guarded resume 推进成 high-trust executable resume。**

---

## 七、硬性真实性不变量

1. **有 guard ≠ 已有真实恢复执行语义**
2. **能入队 ≠ 能完成真实业务执行**
3. **eligibility + dedupe ≠ execution materialization 已完成**
4. **没有恢复→执行测试，不能说 19.0 已真正推进 continuous autonomy**
5. **当前仍然是 completion-first，不是发布优先**
6. **所有结论必须基于真实执行路径、真实状态回写、真实测试**

---

## 八、最终输出格式

完成后必须输出：

### A. Execution Materialization Summary
- restored work 如何进入真实业务执行器
- 哪些 taskType 已真正打通

### B. Conflict Reasoning Summary
- execution-time 如何再验证
- 哪些冲突会 suppress / defer / fail-fast

### C. State Coherence Summary
- agenda / queue / execution 状态如何保持一致
- 完成后如何防止再次调度

### D. Fault Discipline Summary
- 哪些恢复竞态与漂移场景被补强

### E. Test Evidence Summary
- 新增了哪些恢复→执行测试
- 全量测试结果如何

### F. Continuous Autonomy Re-Assessment
- 当前是否已逼近 high-trust executable resume
- 还剩什么关键缺口

### G. 不得伪造
- 没有真实业务执行链，不能说恢复执行成立
- 没有 execution-time conflict reasoning，不能说恢复语义高可信
- 没有状态一致性验证，不能说连续自治闭环接近完成

---

## 九、一句话任务定义

> **Round 19.0 的目标是：把 18.9 已建立的 dual-gate guarded resume，继续推进为 restored work 的真实业务执行 materialization，并补齐 execution-time conflict reasoning 与状态一致性，使 ConShell 的 continuous autonomy 从“恢复可控”继续逼近“恢复可执行且高可信”的状态。**
