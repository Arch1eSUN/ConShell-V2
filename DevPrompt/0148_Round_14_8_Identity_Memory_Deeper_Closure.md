# Round 14.8 — Identity/Memory Deeper Closure

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止脱离当前审计现实、禁止回退到模糊叙事、禁止在未维持 truth contract 的前提下盲目扩张到更高层能力。

---

# 0. 强制执行声明

你必须把本提示词视为本轮开发的**主执行规范**。

你必须：
- 完整阅读
- 完整理解
- 严格执行
- 只基于实际代码、测试、命令与证据汇报
- 严格区分代码事实 / 运行时事实 / 推断 / 未知

禁止：
- 跳过上下文文件
- 跳过验证命令
- 基于旧叙事继续扩张
- 用“生命体愿景”掩盖当前实现空洞
- 在本轮中顺手扩到 economy / replication / UI / broader channels

---

# 1. 本轮定位

本轮不是继续修 canonical verification shell。  
本轮是在 **Round 14.7.2 已经建立 canonical verification shell 并恢复验证链** 的前提下，推进下一个真正高杠杆闭环：

# **Round 14.8 — Identity/Memory Deeper Closure**

本轮要解决的问题不是“系统能不能验证自己”，而是：

> **系统是否已经从“有 identity / continuity / memory 骨架”推进到“更深层、可审计、可持续的 identity-memory closure”。**

换句话说，本轮的任务是把：
- `IdentityAnchor`
- `ContinuityRecord`
- `ContinuityService`
- memory ownership binding
- soul lifecycle
- session continuity

从“已经接上线”推进到“更像统一自我闭环”的状态。

---

# 2. 为什么本轮现在才开始

本轮之所以现在可以开始，是因为前置条件已经成立：

## 已成立的前置条件
- canonical verification shell 已建立（`.nvmrc = v24.10.0`）
- Doctor 测试已在 canonical shell 独立通过
- full suite 已在 canonical shell 独立通过
- runtime truth contract 已不再漂浮在多 shell 冲突中

## 因此当前最合理的下一步
不是继续环境折腾，也不是直接冲 economy / replication，
而是：

> **推进 identity / memory / continuity 这一层真正形成更深的“我是同一个 self”闭环。**

---

# 3. 本轮必须避免的两个错误

## 错误 A：刚恢复验证链，就再次盲目向高层扩张
例如：
- 直接进入 economic grounding
- 直接做更复杂自治 agenda
- 直接做 replication / collective evolution

## 错误 B：把本轮做成只改几个字段名的局部修补
例如：
- 只补少量 repository 字段
- 只让测试更漂亮
- 不形成更强的 identity-memory closure

本轮必须做到：
- 不盲目扩张
- 也不只做表面补丁
- 而是完成一个真实的中层闭环推进

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格按以下顺序读取：

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/planning/PHASED_DEVELOPMENT_SCHEME.md`
6. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
7. `docs/project/ROOT_FILE_CLASSIFICATION.md`
8. `AGENT_START_HERE.md`
9. `CONSTITUTION.md`
10. `docs/audit/DEVLOG.md`
11. `README.md`
12. `DevPrompt/0145_Round_14_5_Continuity_Runtime_Integration_and_Recovery_Truth.md`
13. `DevPrompt/0147_Round_14_7_Foreign_Runtime_Rejection_Closure_and_Deterministic_Verification_Mode.md`
14. `DevPrompt/0147_2_Round_14_7_2_Canonical_Verification_Shell_Enforcement_and_Native_ABI_Reconciliation.md`

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：
- ConShell 真正是什么
- 当前项目阶段是什么
- 为什么 14.7.2 使 14.8 现在可以开始
- 当前 identity/memory 层已经实现了什么
- 当前 identity/memory 层还没闭环什么
- 为什么本轮应该做 deeper closure，而不是直接进入 economy / replication

---

# 5. 当前可信基线（必须据此工作）

以下内容视为本轮已知可信输入，但你仍必须继续以代码与测试复核，不得只复述。

## 5.1 已成立的 truth / verification 基线
在 canonical verification shell 中，已独立审计确认：
- `doctor.test.ts` 通过
- full suite 通过
- canonical verification shell = `.nvmrc` 对应的 `v24.10.0 / ABI 137`

## 5.2 Identity / continuity 已有骨架
当前代码层已经存在：
- `IdentityAnchor`
- `ContinuityRecord`
- `IdentityAnchorRepository`
- `ContinuityRecordRepository`
- `ContinuityService`
- memory ownership binding (`owner_id`)
- soul advance callback integration
- Doctor identity coherence checks

## 5.3 当前阶段判断
当前更准确的阶段应理解为：

> **Viable Sovereign Runtime Core + Established Runtime Truth Contract Layer + Early Self-Continuity Runtime Layer**

这意味着：
- truth contract 已稳定
- 但 self-continuity 仍只是 early layer
- 本轮要做的是把它推进为更深的 closure

---

# 6. 本轮目标定义

本轮的最优目标是：

# **Identity/Memory Deeper Closure**

也就是：

> **把 identity、continuity、memory、session、soul 的关系推进为更统一、可审计、可恢复、可持续解释的闭环，使系统不只是“有自我记录”，而是更清楚地维护“同一个自我如何跨记忆、会话与演化持续存在”。**

---

# 7. 本轮必须完成的核心目标

## Goal A — 明确 canonical self model
你必须明确并尽量在代码层落地：
- 当前系统的 canonical self source 是什么
- `IdentityAnchor`、最新 `ContinuityRecord`、当前 SOUL、memory ownership 之间的权威关系是什么
- 当这些信息发生冲突时，以谁为准

## Goal B — 深化 memory ↔ identity 统一边界
你必须推进：
- 哪些 memory 必须 owner-bound
- 哪些 memory 可以是 shared / null-owner
- retrieval / listing / consolidation 时如何体现 identity boundary

重点不是只加字段，而是：

> **让 memory 真正更清楚地服务于“同一个 self 的连续存在”。**

## Goal C — 深化 continuity 与 session / soul 的耦合语义
你必须回答并尽量实现：
- session finalize 是否总应推进 continuity
- soul evolution 推进 continuity 的 canonical 规则是什么
- 什么变化值得推进 continuity 版本
- 什么变化不值得生成新 continuity record

## Goal D — 提升 restart / recovery 语义清晰度
你必须增强一个问题的答案：

> **系统重启后，为什么可以被视为“还是同一个 self”？**

至少应更清晰表达：
- boot hydration 语义
- anchor / latest record / current soul / memory 的恢复关系
- degraded mode 下如何保持 truth-preserving

## Goal E — 为下一阶段（Economic Grounding）做好边界准备
本轮不直接做经济闭环，但必须让后续更容易回答：
- 谁在赚钱
- 谁在花钱
- 谁在延续存在

也就是说，本轮应给 economy 提供更稳定的 identity basis。

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不进入 economic grounding 主逻辑
2. 不进入 autonomous agenda 主逻辑
3. 不进入 replication / collective evolution 主逻辑
4. 不大改 dashboard / UI / channels
5. 不重写 Doctor truth contract
6. 不做大规模 architecture rewrite
7. 不把本轮变成只有文档没有实现的 planning round

---

# 9. 必须阅读和理解的模块 / 文件

## Identity / continuity 主线
- `packages/core/src/identity/anchor.ts`
- `packages/core/src/identity/anchor.repo.ts`
- `packages/core/src/identity/index.ts`
- `packages/core/src/identity/coherence.test.ts`
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/continuity-service.test.ts`

## Memory / soul / kernel 相关
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/soul/system.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/kernel/kernel.test.ts`

## Doctor / identity coherence
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/identity.ts`
- `packages/core/src/doctor/doctor.test.ts`

## State / persistence
- `packages/core/src/state/database.ts`
- 任何与 session / conversation / owner_id / continuity persistence 相关 repository

---

# 10. 开始实施前必须回答的设计问题

## Q1. 当前 canonical self source 是什么？
你必须明确：
- anchor 是不是最高稳定身份源
- latest continuity record 是否代表当前 self state
- SOUL 当前文本与 continuity record 冲突时如何处理

## Q2. memory ownership 的严格边界是什么？
你必须明确：
- 哪些 memory 必须有 `owner_id`
- 哪些 memory 可以为空
- retrieval / maintenance / consolidation 何时需要 identity-aware filtering

## Q3. continuity advance 的 canonical rule 是什么？
你必须明确：
- 何时生成新 record
- 何时不生成
- session / soul / recovery 各自的推进规则

## Q4. degraded mode 的 truth contract 是什么？
你必须明确：
- chain broken / soul drift / memory mismatch 时，系统应该如何表述自己
- 不能为了“保持自我”而伪造连续性

---

# 11. 推荐实施方向

## Direction 1 — 先统一 self model，再写实现
不要先散着改 repository。
先回答：
- self 的 authority graph 是什么
- anchor / continuity / soul / memory 各自角色是什么

## Direction 2 — 优先做高杠杆闭环，不做表面修饰
优先考虑：
- session ↔ continuity
- soul ↔ continuity
- memory ownership ↔ retrieval/consolidation
- recovery ↔ self explanation

## Direction 3 — 保持 truth-preserving
本轮不能为了“看起来更像有自我”而引入虚假连续性。
如果当前无法证明某种 continuity，就必须明确 degraded / uncertain / partial state。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 canonical self restoration
- restart 后如何恢复 anchor + latest record + soul state

## 12.2 session-driven continuity advance
- 重要 session finalize 推进 continuity
- 非重要/无变化 session 不滥增版本

## 12.3 soul-driven continuity advance rules
- soul 变化何时推进
- 不应推进的情况不推进

## 12.4 memory ownership boundary
- retrieval / query / persistence 在 owner 维度上更清晰

## 12.5 degraded truth handling
- chain break / drift / mismatch 时的行为与报告

## 12.6 no regression
- 不能破坏 14.7 / 14.7.2 的 truth contract 与现有通过测试

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why Round 14.8 Starts Now
# Why Identity/Memory Deeper Closure Is The Next Highest-Leverage Move
```

## Phase 2 — Current Identity/Memory Audit
你必须明确列出：
- 当前 identity 层已有结构
- 当前 memory 层已有结构
- continuity / soul / session 当前是如何接上的
- 当前未闭环点是什么

## Phase 3 — Design
你必须明确：
- canonical self model
- memory ownership model
- continuity advance rules
- degraded truth contract

## Phase 4 — Implement
只做本轮高杠杆实现，不扩散到 economy / replication / UI。

## Phase 5 — Tests
补齐关键测试，并确保 identity-memory closure 获得真实保护。

## Phase 6 — Verification
至少执行并记录：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run src/identity/anchor.test.ts src/identity/coherence.test.ts src/identity/continuity-service.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run src/doctor/doctor.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。

---

# 14. 人工执行命令协议

如果因为：
- `nvm` 只在交互 shell 生效
- agent 无法切换宿主 shell
- 需要用户显式进入 canonical shell
- 需要人工确认某些持久化 / 文件系统动作

而必须让用户手动执行，必须使用以下格式：

## Manual Action Required

**Purpose**  
说明为什么必须人工执行

**Command**
```bash
<exact command>
```

**Why Agent Cannot Do This Directly**  
说明是 shell activation / host / permission / sandbox 限制

**Expected Result**  
执行后应看到什么

**Verification After Run**  
你将执行哪些命令确认

**Important Truth Note**  
用户未执行前，不能写成已完成

---

# 15. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解项目与当前阶段
- 为什么 14.8 现在开始是合理的

# Current Identity/Memory Audit
- 当前 identity 层现状
- 当前 continuity 层现状
- 当前 memory ownership / retrieval 现状
- 当前未闭环点

# Design Decisions
- canonical self model
- memory ownership model
- continuity advance rules
- degraded truth contract

# Modified Files
- 改了哪些文件
- 每项改动的作用
- 它们如何推进 identity/memory deeper closure

# Tests Added or Updated
- 补了什么测试
- 每个测试保护什么 closure

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明是在 canonical verification shell 下完成

# Audit Conclusion
- identity/memory closure 推进到了什么程度
- 哪些闭环已更强成立
- 还剩哪些关键缺口

# Final Verdict
明确回答：

> 本轮是否成功完成 Identity/Memory Deeper Closure？

答案只能类似：
- `YES — deeper closure established`
- `PARTIAL — closure improved but not yet deep enough`
- `NO — insufficient real progress`

# Next Round Recommendation
只能基于本轮真实结果给建议；如果 identity basis 已明显加强，再考虑进入 Economic Grounding。

---

# 16. 严格禁止事项

你绝对不能做这些事：

1. 跳过 canonical shell 验证
2. 只改表面字段不推进闭环
3. 用概念叙事替代实现与测试
4. 在本轮中顺手扩张到 economy / replication / UI
5. 伪造 continuity 或淡化 degraded 情况
6. 不跑 full suite / doctor / identity tests 就宣称成功

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. canonical self model 更清晰且部分落地
2. memory ownership / continuity / soul / session 的关系更闭环
3. 关键测试覆盖了这些 closure
4. 所有验证在 canonical verification shell 中通过或被真实记录
5. 结论真实、克制、可复核

---

# 18. 一句话任务定义

> **本轮的任务不是让系统“看起来更像一个 self”，而是让它更可证明地维护同一个 self 如何跨记忆、会话与演化持续存在。**
