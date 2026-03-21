# ROUND 18.7 DETAILED AUDIT — 2026-03-20

## Audit Scope
审计目标：核验运行时所称 **Round 18.7 全部 4 个治理缺口已完成** 是否与仓内真实证据一致，并判断：
- 这四项到底是“接口存在”还是“主路径已接通”
- 哪些是真正的 canonical governance 收口
- 哪些仍只是底层能力预留，尚未形成 operation continuity 闭环
- 18.8 应继续收什么

审计依据：
- `DevPrompt/0197_Round_18_7_Continuous_Autonomy_Governed_Evolution_Closure_and_Canonical_Runtime_Unification.md`
- `git diff` 关键文件
- `pnpm vitest run src`
- `rg` 对关键标识符的全仓检索
- 关键文件：
  - `packages/core/src/governance/governance-service.ts`
  - `packages/core/src/governance/governance-contract.ts`
  - `packages/core/src/governance/governance.test.ts`
  - `packages/core/src/governance/governance-integration.test.ts`
  - `packages/core/src/identity/continuity-service.ts`
  - `packages/core/src/identity/continuity-service.test.ts`
  - `packages/core/src/kernel/index.ts`
  - `packages/core/src/runtime/agent-loop.ts`

---

## Executive Verdict
**结论：Round 18.7 不是假完成，但它并不是“4 个缺口全部同等强度完成”的轮次。**

更准确地说：

> **18.7 在 Governance / lineage canonicalization 上收口明显且真实；但在 Continuous Autonomy 上，只完成了 scheduler snapshot persistence capability，本轮尚未证明它已接入 kernel/scheduler canonical path。**

所以更准确的裁定是：
- **Gap 3（移除 legacy multiagent.spawn fallback）：属实且强成立**
- **Gap 2（selfmod apply 后自动 verify，失败自动 rollback）：属实且强成立**
- **Gap 4（Governance 接入 BranchControl，新增 quarantine/revoke 动作）：属实且强成立**
- **Gap 1（Scheduler snapshot 跨重启持久化）：部分成立——底层 API 已落地，但“真实 operation continuity 已完成接线”证据不足**

本轮真实定义应为：

> **Governed evolution closure strengthened; continuous autonomy persistence foundation added, but not fully wired into canonical runtime flow.**

---

## 1. Full Test Baseline

### 1.1 全量测试仍全绿：属实
我实测：

`cd /Users/archiesun/Desktop/ConShellV2/packages/core && pnpm vitest run src`

结果：
- **75 test files passed (75)**
- **1693 tests passed (1693)**
- **0 failures**

这点说明：
- 18.7 至少没有为了推进 governance/continuity 继续把干净基线打坏。
- 18.6 建立的测试健康度平台仍然成立。

---

## 2. Gap 3 — 移除 `multiagent.spawn` 遗留回退

### 裁定：**属实，且是本轮最硬的 canonical governance 收口之一**

从 `governance-service.ts` diff 可见：
- 旧逻辑：当 `lineage` 不存在时，会 fallback 到 `multiagent.spawn(...)`
- 新逻辑：fallback 被直接删除
- 现在若 `lineage` 缺失，直接抛错：
  - `LineageService not configured — replication requires canonical lineage path`

这意味着：
- replication 不再允许通过 legacy runtime fallback 绕过 lineage canonical owner。
- 这正是 18.7 的 G2 核心目标之一：**去掉 bypass canonical governance 的旧路径**。

### 测试也已对齐
`governance.test.ts` 与 `governance-integration.test.ts` 都已改成：
- replication 通过 `lineage.createChild`
- 无 lineage 时明确失败
- 不再接受 `multiagent.spawn` 成功作为正确路径

结论：

> **Gap 3 强成立。**

---

## 3. Gap 2 — selfmod apply 后自动 verify，验证失败自动 rollback

### 裁定：**属实，且强成立**

从 `governance-service.ts` 可见：
- `selfmod` 现在不是旧的 `modify()` shortcut
- 而是：
  - `propose(file, content, justification)`
  - `approve(proposed.id)`
  - `apply(proposed.id)`
- 之后立即执行：
  - `this.selfmod.verify(record.id)`
- 若 verify 抛错：
  - 记录 warning
  - `await this.selfmod.rollback(record.id)`
  - 最终 apply 失败并返回 failure receipt

这条链的意义非常大：
- 它把 18.6 已经开始收口的 selfmod path，进一步推进为：
  - **apply 后自动进入 verify**
  - **verify 失败自动 rollback**

这比 18.6 更接近 18.7 DevPrompt 中要求的：
- proposal → evaluation → approval → apply → verify → rollback

### 测试也已对齐
`governance.test.ts` / `governance-integration.test.ts` 中 mock 已升级为：
- `propose`
- `approve`
- `apply`
- `verify`
- `rollback`

说明这不是只改实现，不改验证；测试契约也同步升级了。

结论：

> **Gap 2 强成立。**

---

## 4. Gap 4 — Governance 接入 BranchControl

### 裁定：**属实，且强成立**

从 `governance-contract.ts` 可见：
- 新增 action kinds：
  - `quarantine_branch`
  - `revoke_branch`
- 两者都被标记为：
  - `critical` risk
  - `irreversible` rollback strategy

从 `governance-service.ts` 可见：
- 新增 `branchControl?: LineageBranchControl`
- apply path 增加：
  - `case 'quarantine_branch'`
  - `case 'revoke_branch'`
- 若未配置 `branchControl`，则明确失败
- 若已配置，则调用：
  - `branchControl.quarantineBranch(...)`
  - `branchControl.revokeBranch(...)`
- receipt 还会回写：
  - `branchControlReceiptId`
  - `lineageRecordId`

这说明：
- branch lifecycle 不再只是 lineage 子模块的内部能力；
- 它已经被提升为 **governance-controlled branch action**。

这与 18.7 的 G2 完全一致：
- lineage quarantine / revoke 必须推进为治理可触发动作。

结论：

> **Gap 4 强成立。**

---

## 5. Gap 1 — Scheduler snapshot 跨重启持久化

### 裁定：**部分成立，不足以按“operation continuity 已完成闭环”认定**

这是本轮最需要降温判断的一项。

### 5.1 底层能力已存在：属实
从 `continuity-service.ts` 可见，确实新增了：
- `schedulerSnapshotPath`
- `saveSchedulerSnapshot(snapshot)`
- `loadSchedulerSnapshot()`

而且：
- 持久化目标文件明确是 `scheduler-snapshot.json`
- 错误处理和 malformed snapshot 容错也都在

所以：
- **scheduler snapshot persistence capability 已落地**

### 5.2 但没有看到 kernel / scheduler canonical path 真正调用它
我做了全仓检索：
- `saveSchedulerSnapshot(`
- `loadSchedulerSnapshot(`
- `scheduler-snapshot.json`

结果显示：
- 这些标识符只出现在 `continuity-service.ts` 自身
- **没有看到 `kernel`、`scheduler-service`、`agent-loop` 或其他 boot/shutdown path 调用它们**

这意味着：
- 当前证据只能支持“这个 persistence API 已经被实现”
- **不能支持“scheduler 状态跨重启恢复已经接入实际主路径”**

### 5.3 因此运行时这句被说大了
运行时原说法是：
- `在 ContinuityService 中新增 saveSchedulerSnapshot() / loadSchedulerSnapshot()，实现调度器状态跨重启持久化`

更准确的表述应该是：

> **实现了调度器状态跨重启持久化所需的底层读写能力，但尚未证明这套能力已纳入 kernel/scheduler canonical runtime flow。**

结论：

> **Gap 1 只能判“基础能力成立”，不能判“operation continuity 真实闭环完成”。**

---

## 6. What 18.7 Actually Achieved

### A. Governance canonicalization 再推进一大步
这是本轮最核心成果：
- replication 不再允许 legacy fallback
- selfmod 已进一步接近完整治理链
- branch lifecycle 进入 governance action 面

### B. 测试基线在更严格治理路径下仍然维持全绿
这很重要，因为说明：
- canonicalization 不是只靠删功能，而是有真实测试收口支撑。

### C. Continuous autonomy 新增了下一步所需的 persistence substrate
虽然未形成完整接线，但它至少把：
- scheduler snapshot persistence primitive
落地了。

---

## 7. What 18.7 Did NOT Finish

### 7.1 没有完整证明 scheduler snapshot 已纳入主路径
这是本轮最明确的未完成点。

### 7.2 没有完整证明 continuous autonomy 已从“恢复任务记录”升级到“恢复任务推进语义”
18.7 只看到 scheduler snapshot API，不足以证明真正的 operation continuity。

### 7.3 没有继续收 economic canonical owner / mode-shift owner
这在前面的方案选择中就是 deliberately deferred，所以不是意外，但确实没做。

### 7.4 OpenClaw control-plane absorption 仍未进入本轮主成果
18.7 主要收的是 governance / continuity，不是 control plane 深吸收。

---

## Formal Verdict

### 对四个 gap 逐项裁定

#### Gap 3 — 移除 legacy multiagent.spawn fallback
**裁定：强成立**

#### Gap 2 — selfmod apply 后自动 verify，失败自动 rollback
**裁定：强成立**

#### Gap 4 — Governance 接入 BranchControl，新增 quarantine/revoke 动作
**裁定：强成立**

#### Gap 1 — scheduler snapshot 跨重启持久化
**裁定：部分成立**
- persistence API 已有
- 但 canonical runtime wiring 证据不足

---

## Audit Conclusion
**Round 18.7 应被定义为：Governed Evolution Hardening 真实成立、Continuous Autonomy 只完成了底层 persistence substrate，而非完整 operation continuity closure。**

也就是说：

> **18.7 更像“3.5 项完成”，不是“4 项全部同等强度闭环完成”。**

它的最大真实价值是：
- canonical governance 再收紧一层
- lineage / branch lifecycle 进入治理动作面
- selfmod 更接近真正的治理闭环

而它最明确留下的缺口是：

> **必须把 scheduler snapshot / operation continuity 从“能力存在”推进到“真实 runtime 主路径接线”。**

---

## Suggested Round 18.8 Direction
18.8 最合理的主轴应是：

1. **Finish the wiring for operation continuity**
   - 把 `saveSchedulerSnapshot()` / `loadSchedulerSnapshot()` 真接进 kernel / scheduler / lifecycle 主路径

2. **Close the remaining continuous autonomy gap**
   - 让跨重启恢复不只是 identity / agenda / snapshot 文件存在，而是真正恢复任务推进语义

3. **Continue canonical runtime unification**
   - 尤其是与 scheduler / runtime execution / wake discipline 相关的 canonical owner 问题

4. **Only after that, reassess whether the current version is approaching functional completion**

一句话：

> **18.8 不该回头谈发布，而应该把 18.7 留下的 operation continuity 真接完。**
