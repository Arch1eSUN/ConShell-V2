# 🐢 ConShell V2 — 开发日志（DEVLOG）

> **最后更新**: 2026-03-14  
> **用途**: 作为项目历史记录、轮次上下文与下一轮开发输入的事实源之一。  
> **注意**: 下一轮开发计划必须基于“当前轮次实现 + 当前轮次验证 + 当前轮次审计结论”，不能基于旧叙事直接续写。

---

# 1. 项目是什么（校正版）

**ConShell V2** 不是普通 chat app，不是单纯 CLI，也不是只把 LLM 接进网页/终端的壳层系统。

ConShell 的真实定位是：

> **一个面向 Web4 方向的自主 AI 智能生命体运行时工程。**

它试图融合：

- **OpenClaw** 的 control plane / session / tool / node / skill / multi-surface agent operating system 能力
- **Conway Automaton** 的 survival / earn-your-existence / self-modification / replication / lineage / sovereign identity 范式
- **Web4** 所强调的：具备现实行动能力、连续存在、经济约束与主权性的智能体方向

因此，ConShell 的长期目标不是“多一个界面”或“多一个 channel”，而是：

> **构建一个具备主权身份、长期记忆、工具行动、经济闭环、持续运行与自我治理能力的自主 AI 智能生命体运行时。**

---

# 2. 当前项目阶段（校正版）

## 长期目标
- Sovereign identity
- Long-term memory continuity
- Real-world tool action
- Economic closure / earn-your-existence
- Continuous autonomous runtime
- Governance / constitution / self-regulation
- Replication / lineage / evolutionary growth

## 当前阶段目标
当前阶段不是普通 feature expansion，而是：

> **先建立 Autonomous AI Lifeform Runtime 的 Viability Baseline，并在此基础上逐步闭合身份、记忆、行动、经济、治理与演化系统。**

也就是说，当前阶段的核心问题不是“接口是否存在”，而是：

- runtime 是否真实可运行
- 依赖与环境是否真实对齐
- Doctor / viability gate 是否可靠
- 已有模块是否只是雏形，还是已经形成闭环

---

# 3. 当前全局判断（截至本轮）

根据当前全局审计：

> **ConShell 目前已经完成了真实性底座、运行时骨架、部分记忆/工具/通道闭环与治理雏形，但仍未完成系统级生命闭环。**

当前更准确的项目定位是：

> **Autonomous AI Lifeform Runtime Foundation / Viable Sovereign Runtime Core**

而不是完整生命体本身。

---

# 4. 根目录级事实文件（必须优先参考）

当前根目录新增了以下全局上下文文件，后续任何 agent 在制定下一轮计划前都应优先阅读：

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
6. `AGENT_START_HERE.md`

这些文件的优先级高于 DEVLOG 顶部的旧摘要。

---

# 5. 已完成开发轮次（历史保留）

> 下文保留历史开发记录，用于追踪演进路径。历史轮次描述不应覆盖新的全局项目定义。

### Round 1: 工程基线恢复 `875e324`
**目标**: 从零建立可信赖的工程基础

- Git 仓库 + CI 建立
- core / cli / dashboard 三个包均可构建
- 默认测试全部通过
- TypeScript strict mode 全局启用

### Round 2: 工程清理 `52de314`
**目标**: 清理技术债务，分离关注点

- Git 忽略文件优化
- Benchmark 测试从功能测试中分离（`test:bench` 独立脚本）
- 构建产物清理

### Round 3: 扩展准备 `89bbf2d`
**目标**: 建立 API 边界，准备受控扩展

- `@conshell/core/public` — 稳定公共 API 层
- 所有外部消费者（CLI、Dashboard）切换到 public API
- 测试基线统一

### Round 4: Public API Layer `789d991`
**目标**: 固化公共接口

- `exports` map — 通过 `package.json` 的 exports 字段控制可访问性
- `api-surface.test.ts` — 自动验证 public API 不会意外变化
- 文档更新

### Round 5: 最小插件闭环 `76643a4`
**目标**: 证明 runtime 的扩展能力真实存在

- `PluginManager` — 插件生命周期管理
- VM 沙盒隔离 — 插件运行在安全沙箱中
- `validateManifest()` — 插件清单校验
- Demo 插件 E2E 测试 — 加载 → 执行 → 卸载 完整闭环通过

### Round 6: WebChat Channel Runtime 闭环 `4e4feb9`
**目标**: 第一个真实 Channel Adapter + HTTP 路由 + WebSocket Push

- `WebChatAdapter`
- `ChannelManager`
- `Gateway`
- HTTP route 闭环
- WebSocket push 闭环

### Round 7–9
- Token streaming
- push bridge 协议完善
- failure semantics 收敛
- streaming 真增量路径建立

### Round 10–13
- 记忆、会话、状态、仓储层逐步深化
- spend / repos / sqlite 路径强化
- runtime 证据化与结构化验证意识逐步建立

### Round 14.1
- Doctor 结构纠偏
- EvidenceType / ReadinessGate / sqlite 4-stage probe
- tests inventory 与 execution truth 拆分
- integration claims 分层

### Round 14.2
- ExecutionEvidence / ExecutionResult / DiagnosticsOptions
- insufficient-evidence verdict
- execution evidence 绑定进入 Doctor 模型

### Round 14.3
- Runtime Reality Alignment & Viability Baseline
- runtime pinning / runtime identity alignment / stale evidence & foreign runtime rejection（按当前轮次报告）
- 当前阶段性判断：Runtime Viability Baseline 已进入可用状态

### Round 14.4–14.5
- Canonical Verification Shell 制度化 (v24.10.0 / ABI 137)
- foreign-runtime rejection 逻辑完善
- VerificationContext 与 VerificationMode 成为 IntegrityReport 标准字段

### Round 14.6
- Identity-Memory Coherence Baseline
- IdentityAnchor + ContinuityRecord hash chain + verifyContinuityChain()
- SelfState 运行时自模型 (genesis/continuing/forked/unknown)
- Doctor identity checks: anchor-exists / chain-valid / soul-anchor-aligned / self-state-consistent

### Round 14.7
- Canonical Verification Shell enforcement
- VerificationMode (deterministic / degraded-no-evidence) 进入 Doctor
- Native ABI reconciliation for Round 14.6 identity infrastructure

### Round 14.8–14.8.2
- Identity-memory deeper closure
- ContinuityService production wiring via Kernel.startSession()
- Session lifecycle integration: AgentLoop.processMessage() → Kernel.startSession()
- Owner write/read boundary: upsert(ownerId) → findRecentByOwner() for session_summaries
- Kernel.getDiagnosticsOptions() — runtime-doctor truth contract bridge
- MEMORY_OWNERSHIP_CONTRACT.md formalized
- 627/627 tests, tsc --noEmit zero errors

### Round 15.0.1
- Final gap closure, documentation reconciliation & release readiness
- /api/health endpoint wiring: getDiagnosticsOptions() → runDiagnostics() production path
- IDENTITY_CONTINUITY_CONTRACT.md + SESSION_LIFECYCLE_CONTRACT.md formalized
- README / DEVLOG / GLOBAL_AUDIT / PHASED_DEVELOPMENT_SCHEME reconciled to 14.8.2 baseline


---

# 6. 接下来写 DEVLOG 的规则

从现在开始，后续轮次必须遵守：

## 规则 1：先审计再定下一轮
每次新一轮开发前，必须明确：
- 当前轮次做了什么
- 当前轮次验证了什么
- 当前轮次审计结论是什么
- 下一轮依赖这些结论中的哪一部分

## 规则 2：不能再把项目缩写成普通 app 叙事
任何新轮次日志都不能把 ConShell 重新定义成：
- chat app
- dashboard app
- LLM shell
- 普通 sovereign bot

## 规则 3：明确区分四类状态
每轮日志尽量区分：
- 已实现
- 部分实现
- 雏形 / 骨架
- 未实现

## 规则 4：上游能力不自动算已完成
OpenClaw / Automaton 的能力只能作为对齐输入，不能直接计入 ConShell 已完成项。

---

# 7. 当前最重要的事实提醒

如果后续 agent 只能记住一件事，那就是：

> **ConShell 现在最需要的不是继续堆更多功能，而是把身份、记忆、行动、经济、治理、复制这些能力真正做成系统级闭环。**
