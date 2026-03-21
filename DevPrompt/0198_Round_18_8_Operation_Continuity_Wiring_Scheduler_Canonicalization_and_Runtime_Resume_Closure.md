# DevPrompt 0198 — Round 18.8
## Operation Continuity Wiring / Scheduler Canonicalization / Runtime Resume Closure

你现在处于 **ConShellV2 Round 18.8**。

Round 18.7 已经完成的重要真实成果包括：
- replication 的 legacy `multiagent.spawn` fallback 已被移除，复制必须通过 `LineageService`
- selfmod apply 后已自动进入 verify，verify 失败会自动 rollback
- governance 已新增 `quarantine_branch / revoke_branch`，并通过 `BranchControl` 触发 lineage branch lifecycle 动作
- 全量 `packages/core` 测试仍维持 **75/75 files、1693/1693 tests、0 failures**

但 18.7 的详细审计也已经确认：

> **18.7 并没有把 continuous autonomy 真正收成 operation continuity。**

更准确地说：
- `ContinuityService` 已新增：
  - `saveSchedulerSnapshot()`
  - `loadSchedulerSnapshot()`
- 这说明 scheduler snapshot persistence capability 已经存在
- **但目前没有足够证据证明它已经被 kernel / scheduler / lifecycle canonical path 真正调用**

这意味着，18.7 在 Continuous Autonomy 这条主线上只完成了：

> **底层持久化能力到位**

但还没有完成：

> **跨重启的真实 operation continuity wiring**

因此 Round 18.8 的目标非常明确：

> **把 18.7 留下的 scheduler snapshot / runtime resume / operation continuity 主路径真正接完。**

这不是新功能扩张，而是：
- 把已经存在的 persistence substrate 接入真实运行时
- 把 continuity 从“identity continuity + agenda recovery”推进到“runtime execution continuity”
- 继续收 canonical runtime owner 与恢复语义

---

## 一、本轮唯一主目标

**完成 scheduler snapshot / runtime resume / operation continuity 的 canonical wiring，使 ConShell 在连续自治主线上真正从“恢复能力存在”升级为“恢复语义接通”。**

一句话解释：

> **18.8 要做的是把 18.7 只做到一半的 continuous autonomy 主线真正接完。**

---

## 二、本轮必须回答的核心问题

### Q1. `saveSchedulerSnapshot()` / `loadSchedulerSnapshot()` 具体应该由谁在什么时候调用？
必须明确 canonical owner：
- kernel?
- scheduler-service?
- shutdown / checkpoint hook?
- resume hook?

### Q2. 当前“恢复”到底恢复到了哪一层？
必须明确区分：
- identity continuity
- agenda continuity
- scheduler snapshot continuity
- runtime execution continuity

### Q3. 如何避免 snapshot 恢复只是“数据回读”，而没有真正恢复任务推进语义？
必须把 restore 的后续动作接完整。

### Q4. scheduler / wake / runtime loop / agenda 之间，到底谁是 operation continuity 的 canonical owner？
不能继续分散。

### Q5. 在不引入大规模新风险的前提下，如何让 continuous autonomy 明显更接近真正闭环？
必须小步、稳、可验证。

---

## 三、本轮必须完成的内容

# G1. Scheduler Snapshot Canonical Wiring

18.7 只实现了 snapshot API，本轮必须把它接进真实主路径。

### G1.1 必须明确接入点
至少明确：
- snapshot 保存发生在什么时机
- snapshot 恢复发生在什么时机
- 恢复失败时如何降级
- snapshot 过旧 / 损坏 / 与当前状态冲突时如何处理

### G1.2 必须实现真实调用链
不能只保留在 `ContinuityService` 内部 API 层。
必须让：
- kernel boot
- scheduler init
- shutdown / checkpoint / safe-stop
中的至少一部分真正调用它

### G1.3 目标
把“有 snapshot API”升级为“snapshot 真进入 runtime 主路径”。

---

# G2. Runtime Resume Semantics

恢复不能只停在数据层。

### G2.1 必须推进
- restored scheduler tasks 如何重新进入执行语义
- restored commitments / agenda / wake items 如何重新取得下一步动作资格
- runtime resume 时如何避免重复执行 / 双重调度 / state corruption

### G2.2 必须考虑
- idempotency
- duplicate suppression
- stale snapshot handling
- partial restore fallback

### G2.3 目标
让“恢复”真正意味着系统知道**接下来继续做什么**，而不是仅仅把旧对象读回来。

---

# G3. Operation Continuity Boundary Definition

本轮必须正式定义：

> **ConShell 当前版本的 operation continuity 到底覆盖到哪一层。**

### G3.1 至少区分
- identity continuity
- session continuity
- agenda continuity
- scheduler continuity
- runtime execution continuity

### G3.2 必须说明
- 当前已经完成到哪层
- 本轮完成后预计到哪层
- 哪些仍然后延

### G3.3 目标
防止后续再把“恢复了某个文件”误说成“持续自治已完成”。

---

# G4. Scheduler / Wake / Agenda Canonical Owner Cleanup

当前 continuous autonomy 相关职责仍容易分散。

### G4.1 本轮必须继续收口
- scheduler-service
- continuity-service
- agenda store
- kernel boot / shutdown lifecycle
- wake / checkpoint / resume discipline

### G4.2 目标
让 operation continuity 不再依赖多个半重叠 owner，而是有更清晰的 canonical runtime authority。

---

# G5. Recovery Testing and Fault Discipline

既然要做恢复 wiring，就必须有更针对性的验证。

### G5.1 必须新增或增强测试
至少覆盖：
- snapshot saved on checkpoint/shutdown
- snapshot loaded on restart
- malformed snapshot ignored safely
- resumed tasks 不重复执行
- snapshot 与 live state 冲突时降级合理

### G5.2 目标
让 continuous autonomy 的推进有真实测试闭环，而不是只靠代码阅读判断。

---

# G6. Functional Completion Re-Assessment After Wiring

18.8 结束后必须重新判断：

> **continuous autonomy 这条主线到底还剩什么，当前版本距离“真正完成态”还有多远。**

### G6.1 必须明确回答
- operation continuity 现在是否已真正进入 canonical runtime
- continuous autonomy 是否仍有 must-finish gap
- 若仍未完成，最核心剩余缺口是什么

### G6.2 原则
- 不回头谈发布
- 先把 continuous autonomy 的真实性说清楚

---

## 四、本轮强制验收矩阵

### V1. `saveSchedulerSnapshot()` / `loadSchedulerSnapshot()` 已被真实主路径调用，而非仅停留在 API 存在
### V2. scheduler / agenda / runtime resume 至少有一条真实 operation continuity 链被接通
### V3. malformed / stale / conflicting snapshot 有明确降级逻辑
### V4. recovery 相关测试被新增或增强，并保持全量测试全绿
### V5. operation continuity 的层级边界被正式定义，不再把“数据恢复”误报成“自治闭环完成”
### V6. continuous autonomy 剩余缺口被进一步缩小并可基于证据描述

### 测试要求
- 必须继续保持 `pnpm vitest run src` 全绿
- 必须新增/更新 continuity / kernel / scheduler / runtime 恢复相关测试
- 必须验证恢复不会造成重复执行或状态污染
- 必须验证异常 snapshot 能安全忽略或降级

---

## 五、建议执行顺序

### Priority 1 — 明确 canonical owner 与 snapshot 调用点
先定谁负责保存、谁负责恢复。

### Priority 2 — 接 runtime resume 主路径
让恢复不只是读文件。

### Priority 3 — 补 recovery fault discipline
处理 stale/corrupt/conflict 场景。

### Priority 4 — 补测试并重跑全量
确保不是纸面闭环。

### Priority 5 — 重判 continuous autonomy 剩余缺口
给后续轮次继续收敛。

---

## 六、本轮非目标

本轮不做：
- 不回头做 npm 发布
- 不重新扩大量 OpenClaw control-plane 主题
- 不把 scheduler snapshot API 存在误报成 continuous autonomy 已终局完成
- 不在 canonical wiring 未完成前宣称 operation continuity 已闭环

本轮真正目标是：

> **把 scheduler snapshot / runtime resume / operation continuity 这条线真正接完。**

---

## 七、硬性真实性不变量

1. **有 snapshot API ≠ operation continuity 已完成**
2. **没接入 kernel/scheduler/lifecycle 主路径，就不能说恢复链已闭环**
3. **读回 snapshot ≠ 恢复任务推进语义**
4. **没有恢复测试，就不能说 continuous autonomy 已更进一步成立**
5. **当前阶段仍然是功能真实性收口，不是发布主线**
6. **所有结论必须基于真实调用链、真实测试、真实行为**

---

## 八、最终输出格式

完成后必须输出：

### A. Scheduler Wiring Summary
- snapshot 在哪里保存
- 在哪里恢复
- 谁是 canonical owner

### B. Runtime Resume Summary
- 恢复后如何回到执行语义
- 如何避免重复执行

### C. Recovery Fault Discipline Summary
- malformed / stale / conflict snapshot 如何处理

### D. Test Evidence Summary
- 新增了哪些恢复测试
- 全量测试结果如何

### E. Continuous Autonomy Re-Assessment
- continuous autonomy 现在完成到哪一层
- 还差什么

### F. 不得伪造
- 没有主路径 wiring，不能说 operation continuity 完成
- 没有恢复语义，不能说持续自治闭环成立
- 没有恢复测试，不能说本轮完成可靠

---

## 九、一句话任务定义

> **Round 18.8 的目标是：把 18.7 仅完成到底层能力层的 scheduler snapshot persistence，真正接入 kernel / scheduler / runtime lifecycle 的 canonical 主路径，使 ConShell 在 continuous autonomy 主线上从“具备恢复原语”推进到“具备真实 operation continuity wiring”的状态。**
