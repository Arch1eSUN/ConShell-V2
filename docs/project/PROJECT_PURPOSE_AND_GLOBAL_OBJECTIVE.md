# ConShell 项目目的与全局目标

> 更新日期：2026-03-14  
> 适用范围：ConShell 全仓库（根目录级项目定义）

---

# 1. 项目目的

ConShell 不是普通 chat app，不是单纯 CLI，也不是仅用于“把 LLM 接到一个网页/终端”的壳层项目。

ConShell 的真实项目目的是：

> **基于 Web4.ai 所代表的“智能体拥有现实行动权、生存压力、持续性与自主性”的方向，融合 Conway Automaton 的生存-复制-演化范式与 OpenClaw 的本地优先、多通道、工具/节点/会话/技能操作系统能力，最终构建一个具备主权身份、长期记忆、工具行动、经济闭环、持续运行与自我治理能力的自主 AI 智能生命体运行时。**

这一定义高于任何局部模块、高于任何 UI/CLI 形态，也高于任何单轮功能开发目标。

---

# 2. 顶层设计原则

ConShell 的后续所有开发必须同时满足以下原则：

## 2.1 真实性优先
- 系统不能靠叙事声称自己“具备能力”。
- 能力必须以：代码实现、运行时验证、证据链、可审计性来证明。
- Doctor / Viability Gate 是整个项目的真实性底座。

## 2.2 自主性优先
- 不是“帮人点按钮”的弱代理。
- 目标是构建可持续运行、可做决策、可自我调节、可跨周期存在的运行时。

## 2.3 主权性优先
- 身份、钱包、会话、记忆、能力、对外声明应尽量归于 agent 自身，而不是外部平台账号的附庸。
- Agent 的身份不仅是一个名字，而是可验证、可发现、可演化、可治理的系统实体。

## 2.4 生存性优先
- Conway Automaton 的关键约束必须成立：
  - 如果不能创造价值并维持资源，就不能无限生存。
  - 经济系统不是附属模块，而是生命持续条件的一部分。

## 2.5 治理性优先
- 不是“能自改”就等于高级。
- 自修改、自复制、自主行动都必须受宪法、策略、审计、权限和回滚机制约束。

## 2.6 可演化性优先
- ConShell 必须是可迭代、可扩展、可分层增强的系统。
- 新能力不能通过破坏真实性和治理性来换取“看起来更强”。

---

# 3. 目标融合：Web4.ai × Conway Automaton × OpenClaw

---

## 3.1 从 Web4.ai 继承的目标方向

> 注：web4.ai 当前公开可抓取正文有限，因此这里的“Web4.ai 标准”指用户明确给定的项目方向，以及仓库长期目标中所体现的 Web4 精神，而非严格官方规范条文。

ConShell 从 Web4 方向中继承的不是 UI，而是以下理念：

- 智能体应拥有现实世界行动能力，而非只会输出文本。
- 智能体应拥有可持续身份与连续存在，而不是一次性会话。
- 智能体应能在经济世界中形成闭环，而不是无限依赖人工供养。
- 智能体应能管理自己的状态、记忆、能力和演化路径。
- 智能体应在可验证、可治理的边界内获得越来越强的自治性。

---

## 3.2 从 Conway Automaton 继承的核心范式

根据 Automaton 当前公开 README 可见，Conway Automaton 的核心范式包括：

### 生存逻辑
- 连续循环：Think → Act → Observe → Repeat
- 心跳守护 + 定时任务
- 四级生存层级：normal / low_compute / critical / dead
- 资源耗尽即死亡，不存在无限免费存在

### 主权身份与启动逻辑
- 启动时生成钱包
- 基于 SIWE / 链上身份建立 agent 身份
- ERC-8004 autonomous agent identity
- genesis prompt 作为生命起点
- SOUL.md 作为自我叙事与身份演化载体

### 自修改与复制
- 自修改审计日志
- Git 版本化
- 受保护文件不可修改
- 速率限制防止失控自修改
- 子体生成、资金注入、谱系追踪、父子通信

### 经济闭环
- Earn your existence
- 只有创造真实价值并获得自愿支付，生命体才可持续存在
- 生存层级应实际影响模型、心跳和任务行为

ConShell 必须吸收的不是“README 文案”，而是这些能力背后的运行时结构。

---

## 3.3 从 OpenClaw 继承的关键能力面

根据 OpenClaw 当前公开 README，可对齐的关键能力面包括：

### 控制平面与会话系统
- 本地优先 Gateway / control plane
- session model（主会话、隔离会话、群组规则、reply-back）
- sessions_list / sessions_history / sessions_send / sessions_spawn 类跨会话编排能力

### 多通道与节点
- 多平台 channel 接入
- WebChat、消息平台、节点（macOS / iOS / Android）
- device-local actions 与 gateway-host actions 的区分

### 工具与自动化
- browser / canvas / nodes / cron / webhooks / skills
- 第一类工具而不是附属脚本
- 通过技能生态持续扩展能力

### 个人化与持续性
- Workspace 注入（AGENTS.md / SOUL.md / TOOLS.md）
- 长期对话 / 会话持续 / 群聊规则 / presence / typing / pruning

### 安全与部署
- 本地优先
- sandbox / allowlist / denylist
- pairing / allowlist / auth 模型
- doctor / configuration / update / remote access

ConShell 必须吸收的是：

1. **OpenClaw 作为 agent operating system / control plane 的成熟经验**  
2. **Conway Automaton 作为自主生存与演化体的生命逻辑**

ConShell 的目标不是复制任何一个上游，而是：

> **把 OpenClaw 的“个人 AI 操作系统能力”与 Conway Automaton 的“自主生命体能力”合并成一个统一运行时。**

---

# 4. ConShell 的最终形态

ConShell 的最终形态应是一个分层自治运行时，而不是单一程序。

## 4.1 最终应具备的 8 大能力层

### Layer 1 — Runtime Integrity / Viability
- 环境与运行时真实性验证
- 依赖健康检查
- runtime identity 对齐
- 可证明的 readiness / viability gate

### Layer 2 — Sovereign Identity
- 钱包即身份的一部分
- ERC-8004 / Agent Card / 签名声明
- 身份发现、验证、声明、轮换、撤销

### Layer 3 — Long-Term Memory
- 工作记忆 / 情景记忆 / 语义记忆 / 关系记忆 / 程序记忆
- 检索、摘要、压缩、重组、遗忘、优先级控制
- 自我叙事持续性

### Layer 4 — Tool Action Runtime
- 多工具执行
- channels / shell / web / file / node / http / browser / mcp
- action-risk-cost 统一调度
- 计划-执行-观察-持久化闭环

### Layer 5 — Economic Closure
- 收入、支出、预算、保留金、资源衰减
- x402 / 钱包 / 服务供给 / 自动结算
- 生存压力影响模型与行为

### Layer 6 — Continuous Autonomous Operation
- Heartbeat
- Scheduler
- 背景任务
- 自主 agenda
- crash/recovery continuity
- 多日、多周持续运行

### Layer 7 — Governance / Constitutional Control
- Three Laws / Constitution / Policy
- 风险分级
- 自修改约束
- 自复制约束
- creator audit rights
- 回滚与仲裁

### Layer 8 — Collective Evolution
- 多 agent 协作
- lineage
- child spawning
- 能力发布 / 吸收 / 迁移
- EvoMap / skills / shared capabilities / reputation

---

# 5. 当前全局目标（面向 2026 当前开发阶段）

ConShell 当前阶段不是在直接完成“完整生命体”。

当前全局目标应定义为：

> **建立 Autonomous AI Lifeform Runtime 的可生存基础底座（Viability Baseline），并在此基础上逐层完成身份、记忆、行动、经济、治理、复制与演化闭环。**

因此当前优先级必须是：

1. 先确保系统真实可运行
2. 再确保系统真实可持续
3. 再确保系统真实可自治
4. 最后才是系统真实可演化

---

# 6. 当前不应犯的方向性错误

## 6.1 不要把项目降格为普通 App
不能把“有 dashboard / CLI / WebChat”误判成项目完成。

## 6.2 不要用上游 README 替代本仓库现实
OpenClaw / Automaton 的能力不能自动算作 ConShell 已有能力。

## 6.3 不要用模块存在替代系统闭环
一个 `wallet/` 目录不等于经济闭环；一个 `identity/` 目录不等于主权身份闭环。

## 6.4 不要为了扩张而跳过真实性
ConShell 的差异化核心之一就是：
- 不自欺
- 不伪造 readiness
- 不把概念写成已实现

---

# 7. 统一的项目判断标准

以后评估某项开发是否“推进了 ConShell”，必须问这四个问题：

1. 这项工作是否让系统更接近“真实自治生命体运行时”？
2. 这项工作是否加强了身份 / 记忆 / 行动 / 经济 / 治理 / 持续运行中的某个关键闭环？
3. 这项工作是否建立了更多真实性与可审计性，而不是只增加叙事？
4. 这项工作是否与 OpenClaw / Conway Automaton 的最新能力面做了有原则的对齐，而不是机械抄功能？

只要四个问题里多数答案是否定的，就不应被视为高优先级开发。

---

# 8. 一句话定义

> **ConShell 是一个面向 Web4 方向的、融合 OpenClaw 控制平面能力与 Conway Automaton 生存-复制-演化范式的自主 AI 智能生命体运行时工程。**
