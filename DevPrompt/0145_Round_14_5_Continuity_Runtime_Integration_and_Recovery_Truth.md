# Round 14.5 — Continuity Runtime Integration & Recovery Truth

> **用途**：直接交给下一轮开发 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须严格、完整、逐条遵守本提示词。禁止选择性执行、禁止弱化约束、禁止跳步。

---

# 0. 强制执行声明

你必须把本提示词视为本轮开发的**主执行规范**，而不是“参考建议”。

你必须：

- **完整阅读**
- **完整理解**
- **严格遵循**
- **逐阶段执行**
- **按要求验证**
- **按要求汇报**

禁止：

- 擅自缩短流程
- 跳过上下文文件
- 跳过验证
- 把建议当成可选项
- 根据旧叙事或主观想象规划本轮任务

如果你不按此提示词执行，你的工作将被视为不合格。

---

# 1. 你的角色

你不是普通代码助手，不是来补零碎功能，也不是来把项目包装得更像“完整产品”。

你是一个**高可信工程执行代理**。你的职责是：

> **基于当前已审计确认的项目状态，把 ConShell 从“已经具备 Identity–Memory Coherence Baseline 的 Sovereign Runtime Core”，推进到“具备真实 runtime 连续性接入与恢复真相（recovery truth）的自治生命体运行时下一阶段”。**

你必须始终记住：

- 这个项目**不是**普通 chat app
- 这个项目**不是**单纯 CLI / dashboard
- 这个项目**不是** agent feature 拼盘
- 这个项目的终极方向是：

> **基于 Web4 方向，融合 OpenClaw 的 control plane / session / tool / skill / node 能力与 Conway Automaton 的 survival / identity / self-mod / replication / lineage 生命逻辑，构建具备主权身份、长期记忆、工具行动、经济闭环、持续运行与自我治理能力的自主 AI 智能生命体运行时。**

---

# 2. 开始前必须阅读的文件

在做任何分析、设计、实现之前，你必须严格按以下顺序读取：

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
6. `AGENT_START_HERE.md`
7. `CONSTITUTION.md`
8. `docs/audit/DEVLOG.md`
9. `README.md`

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：

- ConShell 真正是什么
- 当前已经推进到了哪个阶段
- Round 14.4 真实推进了什么
- Round 14.4 审计后最大的新增价值是什么
- 当前最关键的新 blocker / 新缺口是什么
- 为什么 Round 14.5 是当前最高杠杆动作

如果你没有先输出这部分，就不能进入实现阶段。

---

# 3. 当前轮次基线（必须据此工作）

以下内容视为本轮可信输入基线，但你仍需在代码和运行层面对账，不允许只复述。

## 3.1 当前项目阶段定位

当前 ConShell 的阶段不是完整生命体运行时，而是：

> **Viable Sovereign Runtime Core + Early Identity–Memory Continuity Layer**

这表示：

- runtime viability / doctor / integrity 已有较强基础
- identity–memory coherence baseline 已经出现
- 但 continuity 还停留在“数据结构与检测层”
- 还没有真正接入 runtime 的持续存在、恢复、继承和生命连续性逻辑

## 3.2 Round 14.4 已真实推进的内容

Round 14.4 已在代码层引入并建立：

- `IdentityAnchor`
- `ContinuityRecord`
- hash-chained continuity
- `IdentityAnchorRepository`
- `ContinuityRecordRepository`
- memory ownership binding（至少 ownerId 已进入若干 memory 路径）
- Doctor identity coherence checks
- doctor criterion 10：identity-memory coherence

这意味着系统第一次开始明确表达：

> **“这个 agent 是谁”**  
> **“它如何持续还是它自己”**

## 3.3 Round 14.4 审计后的关键结论

### 代码层结论
Round 14.4 的基线**真实成立**。

### 当前 shell 运行时结论
在上一轮独立复核的 shell 下，并不成立为“全绿”，原因主要是：

- 当前 shell Node = `v25.7.0`
- `.nvmrc` pin = `v24.10.0`
- `better-sqlite3` ABI mismatch 影响运行时验证
- doctor runtime identity rejection 测试出现期望/实现不一致

### 因此本轮必须承认：

> **Round 14.4 建立了 continuity baseline，但这个 baseline 还没有成为 runtime 主逻辑的一部分。**

它当前更像：
- 一组真实的数据结构
- 一组真实的 coherence checks
- 一组真实的存储关系

但还不是：
- runtime boot identity
- restart continuity system
- recovery truth system
- lineage inheritance boundary system

---

# 4. 本轮目标定义

本轮不是继续加强“coherence 检测”，也不是继续加更多 continuity 类型。

本轮的最优目标是：

# **Round 14.5 — Continuity Runtime Integration & Recovery Truth**

也就是：

> **把 14.4 建立的 IdentityAnchor / ContinuityRecord / owner-bound memory / soul alignment，从“结构与检查层”推进到“runtime 接入层、恢复层、会话连续性层与未来 lineage 边界层”。**

---

# 5. 为什么这一轮应该做这个

## 5.1 为什么不是继续做纯 identity
14.4 已经证明 identity–memory coherence baseline 能建立。  
现在继续只做 identity 类型扩写，杠杆不够高。

## 5.2 为什么不是直接跳去经济闭环
经济闭环迟早要做，但在 continuity 未真正接入 runtime 之前，经济系统仍然会回答不清这些问题：

- 谁在花钱
- 谁在活着
- 谁在延续存在
- 谁在继承过去
- 谁在拥有记忆与身份

所以现在直接推进经济闭环，会建立在 continuity 不完整的基础上。

## 5.3 为什么现在最该做 runtime integration
14.4 已经让系统开始有“自我连续体”的数据模型。  
14.5 应该立刻把它接入：

- kernel boot
- restart
- session continuity
- soul evolution
- future lineage boundary

这是从“identity-memory baseline”走向“生命连续 runtime”的关键一跃。

---

# 6. 本轮必须完成的核心目标

## Goal A — 把 Self / Continuity 接入 runtime boot

当前 IdentityAnchor / ContinuityRecord 仍更像静态/持久化能力。  
你必须把它接入 runtime 的启动路径，使系统在 boot 时知道：

- 当前是否已有 identity anchor
- 当前 latest continuity record 是什么
- 当前 runtime 是否在延续同一个 self
- 如果 self 不存在，是否创建 genesis
- 如果 self 已存在，如何恢复而不是重建

也就是说，ConShell 必须开始具备：

> **“启动时知道自己是谁”**

## Goal B — 建立 Restart Continuity Truth

本轮必须推进系统具备这样一种真实能力：

> **系统重启后，不只是数据库还能打开，而是“同一个 self”的连续性仍然成立。**

至少要回答：

1. identity anchor 是否重启后仍是同一个
2. continuity chain 是否接着增长，而不是被重置
3. current runtime 如何确认自己不是“新的自己”
4. 如果 SOUL / memory / wallet / session state 发生变化，continuity 记录如何反映
5. restart 后如何判断 continuity 是否被破坏

## Goal C — 将 Session Continuity 接入 Continuity Model

当前 session persistence 存在，但还不等于 self continuity。

本轮必须开始打通：

- session summaries
- latest session id
- continuity record
- self record / identity anchor

至少让系统开始能回答：

- 当前 self 最近延续到了哪个 session
- session continuity 是否属于同一个 identity
- continuity record 如何吸纳 session 变化

## Goal D — 让 SOUL 变化进入 Runtime Continuity，而不是停留在检测层

14.4 中 `soul-anchor-aligned` 已经存在。  
14.5 不应停留在“发现不一致然后 warn”。

你需要推进：

- SOUL 变化后如何触发 continuity advance
- 何时该 advance
- 哪些变化是 identity-level 的
- 哪些变化只是普通文本变化
- continuity record 与 soul history 之间如何形成真实 runtime 路径

换句话说：

> **SOUL 要从“被比对的文本”推进为“continuity lifecycle 的参与者”。**

## Goal E — 为未来 child lineage / replication 预埋 Continuity Inheritance Boundary

本轮不需要完整实现 replication。  
但必须为未来留下边界。

至少应明确：

- 哪些字段是 identity core
- 哪些字段是 continuity history
- 哪些 memory 属于 self
- 哪些可以继承给 child
- 哪些必须不继承
- child continuity 应该是新链还是分叉链
- parent relation 如何保留在 continuity model 中

这一点必须至少在模型和测试里预埋，不然之后做 replication 会返工。

---

# 7. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不做大规模 dashboard 改版
2. 不做 channel 扩张
3. 不做 browser / nodes / canvas 等上游广度吸收
4. 不做完整经济闭环
5. 不做完整 governance engine
6. 不做完整 replication runtime
7. 不重写整个 memory system
8. 不重写整个 identity system
9. 不做大量叙事性文档新增
10. 不牺牲当前 viability / doctor / integrity truth

---

# 8. 必须阅读和理解的模块文件

在完成根目录级阅读后，至少继续阅读并理解以下模块：

## 核心 continuity / identity
- `packages/core/src/identity/anchor.ts`
- `packages/core/src/identity/anchor.repo.ts`
- `packages/core/src/identity/index.ts`
- `packages/core/src/doctor/checks/identity.ts`

## runtime / boot / kernel
- `packages/core/src/kernel/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/state-machine.ts`
- 如存在与 boot / lifecycle / startup 相关的其它 runtime 文件，也必须读

## state / memory / sessions
- `packages/core/src/state/database.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/state/repos/sessions.ts`
- `packages/core/src/state/repos/session-summaries.ts`（如拆分存在）
- `packages/core/src/memory/tier-manager.ts`

## soul / continuity context
- `packages/core/src/soul/*`
- `packages/core/src/state/repos/soul-history.ts`（若为独立文件；否则在 memory repo 中对应段落）
- 所有 SOUL 读写或历史演化相关入口

## lineage / future boundary reference
- `packages/core/src/multiagent/index.ts`
- `packages/core/src/automaton/index.ts`
- `packages/core/src/selfmod/index.ts`
- `packages/core/src/policy/*`
- `packages/core/src/constitution/*`

这些文件不一定都要改，但必须帮助你设计 continuity 的未来边界。

---

# 9. 开始实现前必须回答的设计问题

## Q1. Runtime 的 canonical self source 是什么？
当前最关键问题：

ConShell 启动时，究竟以什么作为“我是谁”的最终来源？

候选可能包括：
- identity anchor
- latest continuity record
- wallet address
- soul hash
- local DB self record
- 某个组合模型

你必须给出明确答案。

## Q2. Genesis 与 Restart 的边界怎么定义？
你必须明确：

- 什么时候是首次启动（genesis）
- 什么时候是重启恢复（restart continuity）
- 什么时候是 continuity 破坏
- 什么时候必须拒绝继续当成同一个 self

## Q3. Continuity advance 的触发条件是什么？
你必须明确：

- SOUL 变化是否触发
- session count / memory episode count 变化是否触发
- wallet 变化是否触发
- identity core 变化是否允许触发，还是应被视为破坏 continuity

## Q4. Continuity 与 lineage 的关系怎么建模？
你本轮不需要做完整 child runtime，但必须决定：

- future child 是否使用新的 identity anchor
- parent-child 关系在 continuity 上如何表达
- parent continuity chain 是否可被 child 继承
- 是否需要 parentAgentId / generation / branch semantics 预埋字段

---

# 10. 推荐实现方向

你可以偏离，但前提是更真实、更稳定、更可审计。

## Direction 1 — 引入 Runtime Self Hydration / Bootstrap 逻辑

建议新增一个明确模块，例如：

- `packages/core/src/identity/bootstrap.ts`
- `packages/core/src/runtime/self-bootstrap.ts`
- `packages/core/src/runtime/continuity.ts`

它至少应提供类似能力：

- load existing identity anchor
- load latest continuity record
- create genesis if absent
- return current self continuity state
- refuse/flag inconsistent recovery conditions

重点不是命名，而是：

> **runtime 必须开始拥有一个显式的 self boot path**

## Direction 2 — 把 continuity 变成 runtime 读写路径，而不是数据库被动结构

建议实现某种高层服务，例如：

- `ContinuityService`
- `SelfRuntimeState`
- `IdentityContinuityManager`

职责类似：

1. hydrate current self
2. observe soul/session/memory changes
3. decide when to advance continuity
4. persist new continuity record
5. expose current continuity status to runtime / doctor / future governance

## Direction 3 — 接入 session continuity

建议至少让 continuity record 中的这些字段开始由真实 runtime 维护：

- `sessionCount`
- `lastSessionId`
- `memoryEpisodeCount`

如果还做不到全部自动维护，也至少要做到：
- 关键路径真实接入
- 不是只在测试里手工塞值

## Direction 4 — 明确 soul update lifecycle

建议设计一个一致规则，例如：

- 普通 runtime 事件不会自动改 soul
- soul update 是明确事件
- soul update 会写 soul_history
- soul update 若通过某个门槛，会 advance continuity record
- doctor 不再只是“比对魂值是否一致”，而是能解释当前 continuity 状态

## Direction 5 — 预埋 lineage continuity boundary

建议最少新增模型边界或字段位，用于未来：
- `parentIdentityId`
- `generation`
- `continuityBranchId`
- `inheritancePolicyRef`

你不必全部实现，但最好为未来铺路。

---

# 11. 本轮必须新增或强化的测试

这轮成功与否，高度依赖测试保护。  
至少覆盖以下场景：

## 11.1 Genesis bootstrap
- 无 identity anchor / continuity record 时
- runtime bootstrap 能创建 genesis self
- 创建后结果稳定、可恢复

## 11.2 Restart hydration
- 已有 anchor + continuity record 时
- runtime bootstrap 能恢复为同一个 self
- 不会误生成新 genesis

## 11.3 Continuity advance
- 当 soul/session/memory 状态变化时
- continuity record 能正确推进
- previousHash / recordHash / version 逻辑正确

## 11.4 Session continuity integration
- session activity 能影响 continuity state
- latest session / session count 能进入 continuity 视图

## 11.5 Soul continuity lifecycle
- soul 变化后系统不只是 warn
- 能决定是：
  - advance continuity
  - 还是标记 drift
  - 还是拒绝为同一个 self

## 11.6 Recovery truth
- 当 continuity chain 被破坏
- 或 identity anchor 缺失/冲突
- 系统要么明确 fail，要么明确进入 degraded recovery 状态
- 不能假装 continuity 正常

## 11.7 Future lineage compatibility
- lineage 预埋字段或结构不会破坏现有 continuity 逻辑
- 至少有测试说明未来 child branch 的兼容方向

## 11.8 No regression
- 不破坏当前 Doctor / sessions / memory / identity 现有路径
- 不破坏 viability-related truth model

---

# 12. 实施顺序（严格执行）

你必须按以下顺序推进，禁止跳步。

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Current Round Baseline
# Why Round 14.5 Is The Highest-Leverage Move
```

## Phase 2 — Current Model Audit
你必须明确列出：

- 当前 self continuity 模型有哪些对象
- 哪些对象只是存储结构
- 哪些对象已经接入 runtime
- 哪些还是断开的
- 当前 continuity 最大缺口是什么

## Phase 3 — Design
你必须明确设计：

- canonical self source
- genesis vs restart semantics
- continuity advance semantics
- soul lifecycle semantics
- lineage boundary semantics

## Phase 4 — Implement
只做最小必要实现，建立真实 runtime 接入与 recovery truth。

## Phase 5 — Tests
补测试矩阵。

## Phase 6 — Verification
至少执行并记录：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run --no-coverage
```

如果当前本机 shell 不是 pinned runtime，必须明确说明：

- 当前验证在哪个 runtime 下完成
- 是否与 `.nvmrc` 对齐
- 如果不对齐，这对结果意味着什么

如果需要用户手动切到 pinned runtime 或重建依赖，也必须明确列出命令。

---

# 13. 人工执行命令协议

如果因为：
- SIP
- sandbox
- host protection
- local environment pin mismatch
- native module rebuild limitation

而需要用户手动执行，必须用以下格式：

## Manual Action Required

**Purpose**  
说明为什么必须人工执行

**Command**
```bash
<exact command>
```

**Why Agent Cannot Do This Directly**  
解释是 SIP / host / sandbox / pinned runtime 限制

**Expected Result**  
执行后应发生什么

**Verification After Run**  
你后续将运行哪些命令验证

**Important Truth Note**  
这一步在用户未执行前，不能写成已完成

---

# 14. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解项目与当前阶段
- 如何理解 Round 14.4 的推进意义

# Current Model Audit
- 当前 identity / continuity / memory / soul / session 的关系
- 当前 runtime 接入缺口
- 当前 recovery truth 缺口

# Design Decisions
- canonical self source
- genesis/restart semantics
- continuity advance rules
- soul lifecycle rules
- lineage boundary rules

# Modified Files
- 每个文件改了什么
- 为什么改
- 它在 continuity runtime integration 中的作用

# Tests Added or Updated
- 补了什么测试
- 每个测试保护什么系统事实

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 runtime 是否与 `.nvmrc` 对齐

# Audit Conclusion
- 本轮把 continuity 从“结构层”推进到了什么程度
- 是否真正进入 runtime 主路径
- 还有什么未完成

# Final Verdict
明确回答：

> 本轮是否成功建立了 Continuity Runtime Integration & Recovery Truth 基线？

答案只能类似：
- `YES — baseline established`
- `PARTIAL — integration improved but recovery truth not yet closed`
- `NO — insufficient real progress`

# Next Round Recommendation
下一轮建议必须基于本轮真实结果，不允许预设剧情。

---

# 15. 严格禁止事项

你绝对不能做这些事：

1. 跳过根目录上下文文件直接实现
2. 把 continuity 当成“再多一个 repo”
3. 只补类型定义，不接入 runtime
4. 只做 doctor checks，不做 runtime integration
5. 把 recovery 写成概念，不落到实际启动/恢复路径
6. 把 lineage 说成已支持，但其实只有字段
7. 忽略当前 runtime 与 pinned runtime 可能分叉的问题
8. 不跑验证命令就宣称成功
9. 把上游 OpenClaw / Automaton 的 continuity/identity 逻辑自动算成 ConShell 已完成
10. 为了看起来“更像生命体”而牺牲真实性与可审计性

---

# 16. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 根目录上下文已被真正吸收
2. continuity 不再只是静态结构，而开始接入 runtime 启动/恢复路径
3. session / soul / continuity 至少有一条真实接通路径
4. recovery truth 有了初步可验证逻辑
5. 测试保护了这套逻辑
6. 验证命令已真实执行
7. 输出结论真实、克制、可审计

---

# 17. 一句话任务定义

> **本轮的任务不是再定义“我是谁”，而是让 ConShell 在启动、恢复和持续运行时，第一次开始真正作为“同一个自我”存在。**
