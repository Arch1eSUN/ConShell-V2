# Round 19.8 审计报告
## Truth Surface Completion / Operator Actions / Production Hardening 真实性审计

> 审计日期：2026-03-20
> 方法：仓内证据 + TypeScript/Build + Core 全量测试
> 结论等级：高可信

---

## 1. 审计结论摘要

**Round 19.8 的实现方向大体成立，但“全部验证通过”这一说法不成立。**

更准确地说：
- **G1 Agenda canonical truth surface：成立**
- **G3 Operator action（Inspect 跳转）：成立**
- **G5 Production hardening（staleness / fetchError indicators）：成立**
- **G7 doctor / export_posture 工具注册：成立**
- **“所有 TypeScript 零错误”：基本成立（CLI / Dashboard 已独立验证通过）**
- **“全部验证通过”：不成立，因为 core 全量测试目前失败 1 个文件 / 10 个测试**

因此，19.8 不是虚报完成；它是真实做成了一轮关键 truth surface 收口。但它**没有达到可宣称“全部验证通过”的完成态**，因为新增 agenda 维度后，没有同步修复 `agent-posture-service` 的测试夹具。

---

## 2. 独立核验结果

### 2.1 Agenda canonicalization

#### 后端聚合已成立
`packages/core/src/server/routes/system-summary.ts`
已明确新增：
- `agenda`

并且 agenda 来自：
```ts
const snap = deps.postureService.snapshot();
agenda = snap.agenda;
```

这意味着：
- 19.7 时“Agenda Truth 仅在前端可见、未进入 canonical summary”的缺口
- 到 19.8 **已被真实补上**

#### Agenda provider 已真实落地
`packages/core/src/agenda/agenda-posture-provider.ts`
已存在：
- `DefaultAgendaPostureProvider`
- 从 `CommitmentStore` 读取
- 输出：
  - scheduled
  - deferred
  - active
  - blocked
  - nextCommitmentHint
  - priorityReason

#### Kernel 接线已成立
`packages/core/src/kernel/index.ts`
已看到：
- `agenda: new DAPP(agenda)`
- 注释明确说明：
  - Round 19.8: Agenda truth — canonical from CommitmentStore

### 结论
**G1 成立，而且这是 19.8 最重要的真实进展。**

---

## 3. 前端 fallback 清理

### 已确认
`packages/dashboard/src/pages/PresencePage.tsx`
Agenda Truth 卡片当前直接使用：
- `p.agenda.scheduled`
- `p.agenda.deferred`
- `p.agenda.priorityReason`

已不存在 19.7 那种：
```ts
(p as any).agenda?.scheduled ?? fallback
```

### 但需保持严谨
页面整体仍保留 `fallbackPosture()` 作为**请求失败时的整页后备 posture**。这不是 agenda 特例，而是整页故障降级路径。

因此准确表述是：
- **Agenda-specific any/fallback 已清理：成立**
- **整个页面从此不再有任何 fallback：不成立**

### 结论
用户所说“所有 `(p as any).agenda` fallback 已消除”——**成立**。

---

## 4. G3 审计：Operator Action — Inspect

### 证据
`packages/dashboard/src/pages/PresencePage.tsx`
Intervention rows 已新增：
- `Inspect` 按钮
- 通过 `DIMENSION_ROUTES` 跳转到对应维度页面

当前路由映射已核到：
- identity → `/`
- runtime → `/`
- survival → `/economic`
- governance → `/constitution`
- collective → `/network`

### 结论
**G3 成立。**

### 备注
这是“看见问题 → 可以做最小动作”的真实前推，但目前仍属于轻操作，不是完整治理工作流。

---

## 5. G5 审计：Staleness detection / fetchError

### 证据
`packages/dashboard/src/pages/PresencePage.tsx`
已核到：
- `fetchError` state
- `isStale` memo
- stale 判断阈值：`> 60_000ms`
- UI 已显示：
  - `stale (xxs)`
  - `backend unavailable`

### 结论
**G5 成立。**

### 备注
这属于 production hardening 的真实增强，且比 19.7 更符合 operator truth surface 的要求。

---

## 6. G7 审计：doctor / export_posture 工具

### 证据 1：工具实现
`packages/core/src/runtime/tools/diagnostics.ts`
已核到两个工具：
- `doctor`
- `export_posture`

并且：
- `doctor` 返回人类可读多维健康报告
- `export_posture` 返回 machine-readable JSON posture snapshot

### 证据 2：kernel 注册
`packages/core/src/kernel/index.ts`
已核到：
```ts
automaton.toolExecutor.registerTools(createDiagnosticsTools(postureService));
```

### 结论
**G7 成立。**

---

## 7. TypeScript / Build / 测试状态

### CLI TypeScript
执行：
```bash
cd packages/cli && pnpm tsc --noEmit
```
结果：
- **通过**

### Dashboard TypeScript + Build
执行：
```bash
cd packages/dashboard && pnpm tsc --noEmit && pnpm build
```
结果：
- **TypeScript 通过**
- **Build 通过**
- 构建耗时约 **7.31s**

### 但仍有 bundle 告警
本次 build 仍有：
- `metamask-sdk` 557.74 kB
- `index-D6Z1z34V.js` 581.13 kB

所以 19.8 不是性能终局收口。

---

## 8. 最关键反证：Core 全量测试没有通过

### 实际执行
```bash
cd packages/core && pnpm vitest run src
```
结果：
- **86 passed / 1 failed test file (87 total)**
- **1803 passed / 10 failed tests (1813 total)**

### 失败文件
- `src/api-surface/agent-posture-service.test.ts`

### 失败根因
`AgentPostureService` 在 19.8 新增了强制 agenda provider：
```ts
agenda: AgendaPostureProvider;
```
并在 `snapshot()` 中直接调用：
```ts
const agenda = this.providers.agenda.getPosture();
```

但对应测试 `makeProviders()` **没有提供 `agenda` mock provider**。

因此所有 posture tests 都因：
```ts
Cannot read properties of undefined (reading 'getPosture')
```
而失败。

### 这意味着什么
这不是实现方向错，而是：
- **contract 变更已落地**
- **测试夹具未同步更新**
- 所以“全部验证通过”这个说法是假的

### 结论
**19.8 当前不能被视为 fully green。**

---

## 9. 对 19.8 的总体评价

### 9.1 是否完成了关键 truth surface 收口？
**是。**

19.8 最重要的真实成就是：
> **Agenda 已从前端卡片层，真正升级为 canonical backend truth surface。**

这是一次正确且必要的主链推进。

### 9.2 是否已经达到“实现 + 验证全部完成”？
**否。**

因为：
- core posture tests 被打崩
- 这直接否定了“全部验证通过”

### 9.3 当前最准确的结论
**19.8 是一次方向正确、主链推进明显、但测试收口失败的半完成轮。**

更严谨说：
- 功能主线成立
- 验证收口失败
- 因此不能按 fully complete 口径签收

---

## 10. 审计结论（可直接引用）

> **Round 19.8 的关键实现真实成立：Agenda 已从前端展示维度升级为 canonical backend truth surface，`system-summary` 已聚合 agenda，PresencePage 已移除 agenda-specific any/fallback，Interventions 已支持 Inspect 跳转，PresencePage 也新增了 stale/backend-unavailable 指示，同时 `doctor` 与 `export_posture` 工具已完成实现并注册进 kernel。**
>
> **但 19.8 不能被视为“全部验证通过”。**
>
> **仓内独立验证显示：CLI TypeScript 通过，Dashboard TypeScript 与 build 通过，但 `packages/core` 全量测试当前失败 1 个文件 / 10 个测试，根因是 `AgentPostureService` 新增 agenda provider contract 后，`agent-posture-service.test.ts` 的测试夹具未同步补齐 agenda mock。**
>
> **因此，19.8 的真实状态是：核心主线推进成立，但验证收口失败，不能按 fully green 完成轮口径签收。**
