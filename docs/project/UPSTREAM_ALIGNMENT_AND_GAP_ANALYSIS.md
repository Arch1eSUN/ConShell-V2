# 上游对齐与差距分析

> 更新日期：2026-03-14  
> 对齐对象：OpenClaw / Conway Automaton  
> 目的：明确哪些能力是上游已公开具备而 ConShell 尚未完全吸收的，哪些应优先对齐，哪些不应机械照搬。

---

# 1. 方法说明

本文件不把上游 README 直接视为“本仓库已实现能力”。

本文件做的是三件事：

1. 抽取上游当前公开能力面
2. 对照 ConShell 当前实现
3. 给出差距分类与吸收优先级

因此每项能力分为以下四类：

- **已对齐**：ConShell 已有相近能力闭环
- **部分对齐**：有骨架或局部实现，但未闭环
- **未对齐**：能力方向存在明显缺口
- **不应机械照搬**：理念可吸收，但实现形态不该直接复制

---

# 2. OpenClaw 能力面对齐

## 2.1 OpenClaw 当前公开强项（从公开 README 抽象）

### A. Control Plane / Session System
- local-first gateway
- session model
- session isolation
- session orchestration tools
- control UI

### B. Multi-Channel / Multi-Surface Runtime
- 大量 messaging channels
- WebChat
- desktop/mobile nodes
- remote gateway access

### C. First-Class Tools
- browser
- canvas
- nodes
- cron
- sessions
- webhooks
- skills

### D. Agent Operating System Qualities
- workspace injection
- skills platform
- multi-surface agent presence
- safety / pairing / allowlist / sandboxing

---

## 2.2 ConShell 与 OpenClaw 的对齐状态

### 已对齐
- control-plane 思维方式
- public API boundary
- WebChat 作为第一个真实 channel
- memory / session continuity 的部分模型
- skills / plugins / MCP 等扩展方向
- Doctor / safety / policy 方向

### 部分对齐
- session orchestration
- multi-surface runtime
- tool system 丰富度
- dashboard / control UI
- remote/local execution boundary

### 未充分对齐
- 多 channel 广泛接入能力
- nodes / device-local actions 体系
- browser / canvas / cron / webhook 的成熟第一类集成
- session-to-session / agent-to-agent orchestration 深度
- multi-device continuous operating surface

### 不应机械照搬
- OpenClaw 的“个人助理”产品表层
- 大规模 channel 矩阵作为当前首要目标

### 对 ConShell 的正确吸收方式
ConShell 应优先吸收：
1. control-plane 架构经验
2. session / tool / node 编排模型
3. first-class tools 的 runtime 地位
4. local-first safety 与 sandbox boundary 模型

而不是优先吸收：
- 频道数量
- UI 表层广度

---

# 3. Conway Automaton 能力面对齐

## 3.1 Automaton 当前公开强项（从公开 README 抽象）

### A. Survival Logic
- earn your existence
- survival tiers
- credits / compute pressure
- no free existence

### B. Identity / Soul
- wallet on boot
- SIWE provisioning
- ERC-8004 identity
- evolving SOUL.md

### C. Continuous Autonomy
- think → act → observe → repeat
- heartbeat daemon
- scheduled maintenance behavior

### D. Self-Modification / Replication
- self-mod with audit log
- protected files
- creator audit rights
- child spawning
- lineage tracking
- child funding

### E. Infrastructure Orientation
- real-world write access
- domains / compute / inference / on-chain action integration

---

## 3.2 ConShell 与 Automaton 的对齐状态

### 已对齐
- constitution / three laws 方向
- selfmod 基础结构
- multiagent / lineage 基础结构
- wallet / SIWE / ERC-8004 方向
- automaton survival tier 抽象
- heartbeat / loop 雏形
- SOUL / memory / identity 融合方向

### 部分对齐
- survival ↔ runtime behavior coupling
- selfmod governance
- replication / lineage runtime
- creator audit model
- long-lived autonomous loop

### 未充分对齐
- 真正的经济生存闭环
- child agent 真正启动与资金注入闭环
- 复制与演化压力进入系统主逻辑
- infrastructure-as-AI-customer 实际执行路径
- 自主创造收入以维持运行的系统性闭环

### 不应机械照搬
- 特定基础设施供应商路径
- README 层的宏大口号直接当完成标准
- 未经治理约束的自复制浪漫化

### 对 ConShell 的正确吸收方式
ConShell 应优先吸收：
1. 生存压力作为一等约束
2. 经济闭环与 runtime 耦合
3. selfmod 的治理化
4. replication 的治理化
5. SOUL / identity / continuity 的生命逻辑

---

# 4. 当前 ConShell 最大差距（按重要性排序）

## Gap 1 — 经济闭环未成立
虽然已有 wallet / x402 / spend / automaton，但缺少“真实价值 → 收入 → 生存耦合”闭环。

## Gap 2 — 身份闭环未成立
虽然已有 identity primitives，但还不是主权身份系统。

## Gap 3 — 持续自治未成立
目前更像长期运行 server + runtime，而不是持续自我维持的生命过程。

## Gap 4 — 复制与演化未成立
已有 multiagent 与 evomap 骨架，但还不是生态级闭环。

## Gap 5 — OpenClaw 风格 control plane 广度不足
ConShell 当前更偏内核，尚未吸收 OpenClaw 在 session / tool / node / multi-surface orchestration 上的广度。

---

# 5. 应优先吸收的上游能力（高优先级）

## Priority A — 现在就该吸收

### 来自 OpenClaw
- session orchestration model
- first-class automation primitives（cron / wakeups / webhooks 的运行时地位）
- tool/control-plane integration model

### 来自 Automaton
- survival ↔ runtime behavior coupling
- economic pressure as real constraint
- SOUL / identity / memory continuity logic
- governed self-mod and governed replication

---

## Priority B — 下一阶段吸收

### 来自 OpenClaw
- richer multi-surface runtime patterns
- nodes / device-local actions 思维方式
- broader operator control plane

### 来自 Automaton
- lineage governance
- child funding model
- creator audit model 深化
- evolution asset loop from publish to consume

---

## Priority C — 暂不优先

### 来自 OpenClaw
- 大规模 channel 覆盖本身
- companion app 广度

### 来自 Automaton
- 特定基础设施入口
- 特定云/域名/算力路径

这些不是当前 ConShell 最关键的系统瓶颈。

---

# 6. 结论

ConShell 当前最正确的对齐策略不是“补齐所有上游功能”，而是：

> **有选择地吸收 OpenClaw 的 agent OS / control-plane 强项，以及 Conway Automaton 的 survival / identity / self-mod / replication 生命逻辑，并把它们统一到 ConShell 自己的生命体运行时架构中。**

如果只记住一句话：

> **ConShell 应吸收上游的系统原则与能力闭环，而不是追逐上游的功能清单。**
