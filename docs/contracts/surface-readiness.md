# ConShell Surface Readiness — WebUI / TUI API 消费清单

## Purpose

本文档列出所有 WebUI / TUI 可直接消费的 API surface，映射到具体 UI 场景。设计者可直接基于此表开始界面设计，无需穿透内部实现。

## 聚合首屏

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/system/summary` | GET | 全系统聚合摘要 | **Dashboard 首屏** — agent/posture/economic/collective/governance 一次获取 |
| `/api/health` | GET | 极简健康检查 | 心跳轮询、加载状态 |

## Agent 控制面

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/agent/status` | GET | Agent 状态 | 状态指示器 |
| `/api/agent/wake` | POST | 唤醒 Agent | 唤醒按钮 |
| `/api/agent/sleep` | POST | 休眠 Agent | 休眠按钮 |

## Posture (姿态/真相)

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/posture` | GET | 完整 posture 快照 | Posture 详情页 |
| `/api/posture/history` | GET | 历史趋势 | 趋势图 |
| `/api/posture/health` | GET | 快速健康判定 | 状态徽章、轮询 |

## 经济

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/metrics/economic` | GET | 经济指标详情 | 经济面板 |

## 治理

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/governance/proposals` | GET | 提案列表 | 治理面板 |
| `/api/governance/proposals` | POST | 创建提案 | 新提案表单 |
| `/api/governance/vote` | POST | 投票 | 投票按钮 |
| `/api/governance/diagnostics` | GET | 治理诊断 | 治理统计 |

## 集体 (Collective)

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/collective/peers` | GET | Peer 列表 | 网络拓扑、节点表 |
| `/api/collective/topology` | GET | 拓扑树 | 可视化网络图 |
| `/api/collective/diagnostics` | GET | 集体诊断 | 统计面板 |
| `/api/collective/delegate` | POST | 委托任务 | 委托按钮 |
| `/api/collective/discovery/scan` | POST | 扫描发现 | 发现新节点 |

## 血统链 (Lineage)

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/lineage/tree` | GET | 血统树 | 身份/家族页 |
| `/api/lineage/spawn` | POST | 生成子代 | 部署子代 Agent |

## 会话

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/sessions` | GET | 会话列表 | 会话管理 |
| `/api/sessions/:id` | GET | 会话详情 | 会话回放 |

## 配置

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/config` | GET | 当前配置 | 设置页 |

## 技能与记忆

| 端点 | 方法 | 用途 | UI 场景 |
|------|------|------|---------|
| `/api/skills` | GET | 已注册技能 | 技能管理 |
| `/api/memory/search` | POST | 记忆搜索 | 记忆浏览器 |

## 首屏信息需求映射

WebUI Dashboard 首屏应展示：

1. **Agent 状态徽章** ← `/api/system/summary` → `agent.state` + `agent.alive`
2. **健康分 + 判定** ← `/api/system/summary` → `posture.overallHealthScore` + `posture.healthVerdict`
3. **经济摘要** ← `/api/system/summary` → `economic.survivalTier` + `economic.runwayDays`
4. **集体概况** ← `/api/system/summary` → `collective.totalPeers`
5. **治理概况** ← `/api/system/summary` → `governance.pendingProposals`
6. **版本信息** ← `/api/system/summary` → `version`

> 所有首屏数据均可从 `/api/system/summary` 单次获取，无需多次请求。

## TUI 首屏信息映射

TUI status view 应展示（与 `conshell status` CLI 输出一致）：

```
🐢 ConShell Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Version    0.19.4
  Uptime     5m 32s
  State      alive
  Health     healthy (score: 92/100)
  Economy    tier=stable, runway=250d
  Collective 3 peers, delegation=95%
  Governance 0 pending, 5 total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Onboarding 最小路径

```
1. npm install -g @conshell/cli
2. conshell onboard          # 创建目录 + 配置 + 检查
3. conshell start             # 启动服务器
4. conshell status            # 查看状态
5. 打开 http://localhost:4200  # Dashboard
```
