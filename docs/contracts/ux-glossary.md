# ConShell UX Glossary — 统一术语表

## Purpose

所有 UI/TUI/CLI/onboarding 文案必须使用本表中定义的术语。避免命名漂移导致设计返工。

## Core Terms

| 英文术语 | 中文术语 | 定义 | 使用场景 |
|---------|---------|------|---------|
| **Posture** | 姿态 | Agent 全维度健康与状态的聚合快照 | Dashboard 首屏、状态页 |
| **Health Verdict** | 健康判定 | healthy / degraded / critical / terminal 四级判定 | 状态指示器、告警 |
| **Health Score** | 健康分 | 0–100 整体健康评分 | 数值展示、趋势图 |
| **Survival Tier** | 生存等级 | thriving / stable / stressed / critical / terminal | 经济状态标签 |
| **Governance** | 治理 | 提案投票、策略审批、自修改控制 | 治理面板 |
| **Collective** | 集体 | 对等体网络、peer 管理、委托 | 网络拓扑页 |
| **Peer** | 对等体 | 集体中的另一个 Agent 节点 | 节点列表 |
| **Delegation** | 委托 | 向 peer 分派任务 | 委托记录 |
| **Lineage** | 血统链 | 父子代 Agent 关系、身份延续 | 身份页 |
| **Wake** | 唤醒 | 从休眠状态激活 Agent | 控制按钮 |
| **Sleep** | 休眠 | 进入低功耗待机状态 | 控制按钮 |
| **Session** | 会话 | 一次连续的用户交互 | 会话列表 |
| **Self-Modification** | 自修改 | Agent 修改自身行为或配置的能力 | 治理面板 |
| **Quarantine** | 隔离 | 因策略违规被隔离的状态 | 状态标签 |
| **Onboard** | 首次配置 | 新用户首次安装与初始化流程 | CLI 向导 |
| **Doctor** | 健康检查 | 系统自检与诊断 | CLI 命令 |
| **Daemon** | 守护进程 | 后台常驻服务 | 安装/管理 |
| **Identity Chain** | 身份链 | 从创世到当前的身份验证链 | 身份详情 |
| **Fingerprint** | 指纹 | Agent 唯一身份标识符 | 身份页 |
| **Soul Drift** | 灵魂漂移 | 身份链断裂或核心人格偏移 | 告警 |
| **Reputation** | 信誉 | Peer 的历史行为评分 | 集体面板 |

## Status Labels

| 英文 | 中文 | 颜色建议 |
|------|------|---------|
| healthy | 健康 | 🟢 green |
| degraded | 降级 | 🟡 yellow |
| critical | 危急 | 🟠 orange |
| terminal | 终末 | 🔴 red |
| trusted | 可信 | 🟢 green |
| known | 已知 | 🔵 blue |
| offline | 离线 | ⚫ gray |
| quarantined | 已隔离 | 🟠 orange |
| revoked | 已撤销 | 🔴 red |

## CLI Command Names

| 命令 | 用途 |
|------|------|
| `conshell start` | 启动服务器 |
| `conshell status` | 查看系统状态 |
| `conshell doctor` | 健康检查 |
| `conshell onboard` | 首次配置向导 |
| `conshell configure` | 编辑配置 |
| `conshell daemon install` | 安装守护进程 |
| `conshell daemon status` | 守护进程状态 |
