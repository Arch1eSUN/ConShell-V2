# Cinematic Control Plane Design — Round 19.5

> Date: 2026-03-20
> Status: Pending Approval
> Scope: G1-G10 WebUI/TUI/Onboarding/Terminal Unification

---

## 1. Design Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Implementation Strategy | 混合策略 | 设计系统先行 + 首页完整重做 + 其余渐进迁移，兼顾视觉跨越与测试安全 |
| 2 | Visual Identity | 混合信号色系 | 深色基底 + 五维 posture 各有专属信号色，信息分层明确 |
| 3 | TUI Technology | 纯 ANSI 自研 | chalk + box-drawing，零依赖，SSH 友好，与现有 CLI 统一 |
| 4 | Priority | 首页旗舰优先 | G1 设计系统 → G3 Presence 首页 → G4 视觉 → G5 TUI → G6/G7 体验 |

---

## 2. Design Language Specification

### 2.1 Color System

```
Surface Hierarchy:
  --surface-0: #08080f    /* 深渊黑 — 全局背景 */
  --surface-1: #0e0e18    /* 面板背景 */
  --surface-2: #14142a    /* 卡片背景 */
  --surface-3: #1c1c3a    /* 悬浮/高亮 */

Signal Colors (per Truth dimension):
  Posture/Presence  → cyan/teal   #00e5cc
  Runtime           → electric blue #3b82f6
  Survival          → amber/gold   #f59e0b
  Governance        → violet       #8b5cf6
  Collective        → emerald      #10b981

Status Semantic Colors:
  Operational       → #22c55e
  Degraded          → #f59e0b
  Recovery          → #3b82f6
  Governance Hold   → #8b5cf6
  Survival Critical → #ef4444
  Dormant           → #6b7280
```

### 2.2 Typography

- Hero: Inter 3rem/48px bold
- H1: Inter 1.75rem/28px semibold
- H2: Inter 1.25rem/20px medium
- Body: Inter 0.875rem/14px regular
- Caption: Inter 0.75rem/12px regular
- Mono/Data: JetBrains Mono 0.875rem

### 2.3 Surface & Panel

- Glass Panel: `backdrop-filter: blur(12px)` + `border: 1px solid rgba(255,255,255,0.06)` + `bg: rgba(14,14,24,0.8)`
- Luminous Edge: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.05)`
- Card Radius: 12px (card), 16px (panel), 6px (chip/badge)

### 2.4 Motion Principles

| Pattern | Duration | Use |
|---|---|---|
| Heartbeat pulse | 2s ease-in-out | 存活信号指示 |
| Signal shimmer | 4s linear | 数据流动/更新 |
| Element enter | 0.3s cubic-bezier(0.16,1,0.3,1) | 页面切换/组件进入 |
| Hover glow | 0.15s ease | 交互反馈 |

---

## 3. Information Architecture

### WebUI 一级导航（6 控制面）

```
┌─ Presence ──── 首页：存在状态 / 总体姿态 / 系统真相
├─ Runtime ───── 调度 / 执行 / 任务 / 技能 / 记忆 / 指标
├─ Governance ── 提案 / 审批 / 隔离 / 谱系 / 自修改治理
├─ Survival ──── 经济 / runway / 价值流 / 生存可行性 / 钱包
├─ Collective ── 节点 / 子体 / 委派 / 分布式运行时
└─ Operator ──── 配置 / Doctor / 日志 / 守护进程 / Chat / 设置
```

### 旧页面映射

| V1 Tab | → V2 位置 |
|---|---|
| Overview | PresencePage (替代) |
| Chat | Operator > Chat |
| Identity | Presence > Identity Detail |
| Metrics | Runtime > Metrics |
| Skills | Runtime > Skills |
| Tasks | Runtime > Tasks |
| Memory | Runtime > Memory |
| Economic | Survival > Detail |
| Wallet | Survival > Wallet |
| Logs | Operator > Logs |
| Health | Operator > Doctor |
| Settings | Operator > Settings |

---

## 4. Presence Homepage — Three-Layer Structure

### Layer 1 — Hero Presence Band

```
┌──────────────────────────────────────────────────────────┐
│  ◉ Agent Presence                         OPERATIONAL ●  │
│                                                          │
│  Running · 42h uptime · 12.3d runway · 0 governance hold │
│                                                          │
│  ┏━━━━━━━┓  ┏━━━━━━━━┓  ┏━━━━━━━┓  ┏━━━━━━━━━┓        │
│  ┃ 92/100 ┃  ┃ 42h    ┃  ┃ 12.3d ┃  ┃ 3 peers ┃        │
│  ┃ Score  ┃  ┃ Uptime ┃  ┃ Runway┃  ┃ Online  ┃        │
│  ┗━━━━━━━┛  ┗━━━━━━━━┛  ┗━━━━━━━┛  ┗━━━━━━━━━┛        │
└──────────────────────────────────────────────────────────┘
```

### Layer 2 — Truth Grid

```
┌─ Identity ──────┐ ┌─ Runtime ───────┐ ┌─ Survival ─────┐
│ ● Operational    │ │ ● Operational   │ │ ⚠ Low Compute  │
│ Chain: valid     │ │ Queue: 3 tasks  │ │ Balance: $42   │
│ Soul: coherent   │ │ Exec: idle      │ │ Burn: $3.4/day │
│                  │ │ Skills: 12      │ │ Runway: 12.3d  │
└──────────────────┘ └─────────────────┘ └────────────────┘

┌─ Governance ────┐ ┌─ Collective ────┐
│ ● No issues     │ │ ● Healthy       │
│ Pending: 0      │ │ Peers: 3/3      │
│ Quarantine: No  │ │ Delegated: 87%  │
└─────────────────┘ └─────────────────┘
```

### Layer 3 — Recommended Interventions

```
┌──────────────────────────────────────────────────────────┐
│ Suggested Actions                                        │
│                                                          │
│ ⚠ Review economic posture — runway below 14 days  [→]   │
│ ○ Install daemon for persistent runtime            [→]   │
│ ○ Complete skill discovery scan                    [→]   │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Terminology Contract

| 术语 | 定义 | 使用场景 |
|---|---|---|
| Presence | 总体存在状态 + 当前姿态 | 首页标题、TUI 主视图 |
| Posture | 系统姿态得分（0-100） | 指标、诊断 |
| Operational | 所有子系统正常 | 状态 badge |
| Degraded | 部分子系统异常 | 状态 badge |
| Critical | 多个子系统异常 | 状态 badge |
| Terminal | 系统不可持续 | 状态 badge |
| Governance Hold | 待审治理事项阻塞 | 状态 badge |
| Survival Critical | 经济不可持续 | 状态 badge |
| Runway | 剩余可运行天数 | 经济指标 |
| Intervention | 推荐的操作建议 | 首页 Layer 3 |
| Control Plane | 控制面（WebUI/TUI/CLI 的统称） | 产品定义 |
| Operator | 操作者（人类用户） | 权限、交互 |

---

## 6. Data Source Mapping

| UI 组件 | 数据源 | API 端点 |
|---|---|---|
| Hero verdict | `AgentPosture.healthVerdict` | `GET /api/posture` |
| Hero score | `AgentPosture.overallHealthScore` | `GET /api/posture` |
| Identity card | `AgentPosture.identity` | `GET /api/posture` |
| Runtime card | Scheduler + Execution state | `GET /api/posture` + existing APIs |
| Survival card | `AgentPosture.economic` | `GET /api/posture` |
| Governance card | `AgentPosture.governance` | `GET /api/posture` |
| Collective card | `AgentPosture.collective` | `GET /api/posture` |
| Uptime | `HealthResponse.uptime` | `GET /api/health` |
| Interventions | Auto-generated from posture | `GET /api/interventions` (new) |
