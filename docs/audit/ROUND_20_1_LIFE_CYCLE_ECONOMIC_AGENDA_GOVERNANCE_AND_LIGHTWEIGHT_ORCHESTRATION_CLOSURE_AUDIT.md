# Round 20.1 审计报告
## Life Cycle / Economic Agenda / Governance Inbox / Lightweight Orchestration Closure 真实性审计

> 审计日期：2026-03-20
> 方法：仓内代码取证 + 独立测试/类型检查/构建验证
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 20.1 的主体宣称成立，而且这次是强成立。**

更准确地说：
- **G1 TaskAdmissionGate + AgendaArbiter：成立**
- **G2 LifeCycleEngine：成立**
- **G3 Governance-Gated Spawn Proposal：成立**
- **G4 ChildSession / ToolInvocation / SessionRegistry：成立**
- **G5 Governance Inbox + What-If Projection：成立**
- **验证口径 `packages/core 93/93 files、1890/1890 tests 全绿`：成立**
- **CLI TypeScript / Dashboard TypeScript / Dashboard build 通过：成立**

因此，20.1 不是口头完成，而是一轮**真正把 5 个已定稿终局机制接入主路径**的高可信收口轮。

---

## 2. 独立验证结果

### 2.1 Core 全量测试
独立执行：
```bash
cd packages/core && npx vitest run
```
结果：
- **93 passed (93)**
- **1890 passed (1890)**
- 退出码 **0**

### 2.2 CLI TypeScript
独立执行：
```bash
cd packages/cli && npx tsc --noEmit
```
结果：
- 退出码 **0**
- 无类型错误输出

### 2.3 Dashboard TypeScript + Build
独立执行：
```bash
cd packages/dashboard && npx tsc --noEmit && npx vite build
```
结果：
- TypeScript 通过
- build 成功
- 仍保留大 chunk 警告：
  - `metamask-sdk-BrRSVcPa.js 557.74 kB`
  - `index-D6Z1z34V.js 581.13 kB │ gzip: 159.95 kB`
  - `Some chunks are larger than 500 kB after minification.`

结论：**20.1 全绿成立，但性能尾债仍未终局消除。**

---

## 3. G1 审计：TaskAdmissionGate + AgendaArbiter

### 已确认事实
仓内存在：
- `packages/core/src/economic/task-admission-gate.ts`
- `packages/core/src/runtime/agenda-arbiter.ts`
- `packages/core/src/economic/task-admission-gate.test.ts`
- `packages/core/src/runtime/agenda-arbiter.test.ts`

### 核心成立点
`TaskAdmissionGate` 已被明确设计为独立 admission 层：
- 先过 `SurvivalGate`
- 再走 `ProfitabilityEvaluator`
- 输出 `admit / defer / reject`
- 产出 `suggestedPriority`
- 保留 `survivalOverride`、`netUtilityCents`、`profitabilityResult`

`AgendaArbiter` 也已明确收口为纯排序/重排层：
- 文件内直接写明：
  - **Admission decisions are handled by TaskAdmissionGate**
- 提供：
  - `rank()`
  - `insert()`
  - `reprioritize()`
  - `getQueue()` / `top()`

### 判断
**G1 成立。**
这不是把旧逻辑换名，而是确实完成了“准入判断”和“调度排序”的职责分离。

---

## 4. G2 审计：LifeCycleEngine

### 已确认事实
仓内存在：
- `packages/core/src/runtime/lifecycle-engine.ts`
- `packages/core/src/runtime/lifecycle.test.ts`

### 核心成立点
`LifeCycleEngine` 已明确采用我们要求的 **B 方案**：
- 复用 `HeartbeatDaemon` 作为 tick 基础设施
- 在 `start()` 中注册 `lifecycle-tick` phase
- 自带 event queue / handler 机制
- `onTick()` 中执行：
  1. processEventQueue
  2. deferredAgingCleanup
  3. `arbiter.reprioritize('tick')`
- `submitTask()` 中真实调用 `TaskAdmissionGate`，并把 admitted task 插入 arbiter，deferred task 写入 deferred pool

### 判断
**G2 成立。**
这意味着 agenda 已不再只是静态 truth surface，而是进入了 **Heartbeat tick + event interrupt + arbiter** 的统一生命周期驱动结构。

---

## 5. G3 审计：Governance-Gated Spawn Proposal

### 已确认事实
仓内存在：
- `packages/core/src/governance/spawn-proposal-contract.ts`
- `packages/core/src/governance/spawn-proposal.test.ts`
- `packages/core/src/governance/governance-service.ts`（已引入 spawn contract / outcome 相关类型）
- `packages/core/src/server/routes/governance.ts`

### 核心成立点
`SpawnProposalContract` 已形成 canonical contract：
- `why`
- `targetWork`
- `budgetCents`
- `maxDurationMs`
- `expectedUtilityCents`
- `childRole`
- `riskLevel`
- `childName`
- `genesisPrompt`
- `parentId`
- `canSubSpawn`

同时还存在：
- `createSpawnProposal()`
- `createSpawnOutcome()`
- `extractSpawnPayload()`
- `validateSpawnPayload()`

而 `governance.ts` 已提供：
- proposal 创建/查询
- `approve`
- `defer`
- `expire`
- `reject`
- `spawn-outcomes` 查询

### 判断
**G3 成立。**
更准确地说：**治理前置的 replication proposal 闭环已真实落地。**

需要降温的一点是：
- 当前证据更强地证明了 **proposal / governance / outcome tracking** 成立
- 但是否已经发展成“复杂 collective economy fully actualized”仍不能夸大

所以口径应是：
> 20.1 已把 replication 从概念推进到治理下真实 proposal 闭环，而不是 collective 终局全部完成。

---

## 6. G4 审计：ChildSession / ToolInvocation / SessionRegistry

### 已确认事实
仓内存在：
- `packages/core/src/orchestration/child-session.ts`
- `packages/core/src/orchestration/tool-invocation.ts`
- `packages/core/src/orchestration/session-registry.ts`
- `packages/core/src/orchestration/session.test.ts`

### 核心成立点
`ChildSession` 已不再是空壳，具备：
- id / name / manifest / parentSessionId / proposalId
- budget tracking
- `start / complete / fail / recall`
- JSON serialization

`ToolInvocation` 已作为与 `ChildSession` 平级的一等原语存在：
- `origin: session | system | operator | governance`
- `parentSessionId?`
- risk level
- result envelope
- audit trace

`SessionRegistry` 已明确同时管理：
- `sessions: Map<string, ChildSession>`
- `invocations: Map<string, ToolInvocation>`
并提供：
- list/get/remove
- cross-entity query
- diagnostics
- budget / status / origin 聚合统计

### 判断
**G4 成立。**
这次不是仅做语义包装，而是确实把 session / invocation 提升成了可观测 runtime primitive。

---

## 7. G5 审计：Governance Inbox + What-If Projection

### 已确认事实
仓内存在：
- `packages/core/src/governance/governance-inbox.ts`
- `packages/core/src/governance/governance-inbox.test.ts`
- `packages/core/src/server/routes/governance.ts`
- `packages/dashboard/src/pages/GovernancePage.tsx`
- `packages/dashboard/src/api/client.ts`

### 核心成立点
后端：
- `GET /api/governance/inbox`
- `GET /api/governance/proposals/:id/whatif`
- approve / reject / defer / expire / apply 路由齐备

前端：
- `GovernancePage.tsx` 已接入 inbox 数据
- 已存在 `What-If Projection` 展示逻辑
- `api/client.ts` 已有 `getProposalWhatIf()` 与 `WhatIfProjection` 类型

### 判断
**G5 成立。**
这意味着 Truth → Action 已从 19.9 的初步 operator actionability，进一步升级为：
- 可汇总
- 可审批
- 可推演
- 可解释
- 可审计

---

## 8. 本轮最重要的真实增量

20.1 最重要的真实意义，不是“又多了几个文件”，而是：

### 8.1 economic truth 真开始影响 runtime behavior
从 19.9 的 truth surface，推进到了 20.1 的：
- admission
- defer
- reprioritize

### 8.2 agenda 真开始进入 lifecycle-driven operation
不再只是页面展示与局部状态，而是进入 heartbeat/tick/event 驱动结构。

### 8.3 governance 从“控制高风险动作”扩展为“生命级审批控制面”
spawn proposal + inbox + what-if 让 operator control plane 的语义明显更像生命体治理台。

### 8.4 orchestration 吸收迈出真实一步
虽然仍是进程内轻量隔离，但 session / invocation primitive 已成形，为未来更强 runtime orchestration 打下了可审计边界。

---

## 9. 保留问题 / 未完成项

20.1 强成立，但仍有几项不能夸大：

1. **performance 尾债仍在**
   - Dashboard build 仍有 >500kB chunk 警告

2. **collective / replication 仍未到终局生态级闭环**
   - proposal/gating/outcome tracking 成立
   - 但不是“collective evolution 全终局”

3. **task-based revenue 目前更像 admission/runtime law 的第一版**
   - 已真实影响主路径
   - 但距离成熟 market/economic ecosystem 仍有距离

4. **What-If Projection 的真实性深度需后续继续审计**
   - 当前已证实 API/UI 接线成立
   - 后续仍应继续看 projection 是否持续与真实 economic/agenda state 精确一致

---

## 10. 最终结论

**Round 20.1 主体成立，而且是 20.x 阶段里一次质量较高的强成立轮。**

正式口径建议写为：

> **20.1 已真实完成 Task-Based Revenue Admission、Hybrid Life Cycle Agenda、Governance-Gated Spawn Proposal、Lightweight Session/Invocation Primitives、Governance Inbox + What-If Projection 五个关键机制的主路径接线；独立验证结果为 `packages/core 93/93 files、1890/1890 tests` 全绿，CLI TypeScript 通过，Dashboard TypeScript + build 通过。**

同时保留两个理性约束：
- **这不等于 ConShell 已经终局完成。**
- **performance 与更深层 economic/collective closure 仍有后续空间。**
