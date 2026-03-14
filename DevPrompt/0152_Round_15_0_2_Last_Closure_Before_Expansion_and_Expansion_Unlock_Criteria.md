# Round 15.0.2 — Last Closure Before Expansion & Expansion Unlock Criteria

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“又补了一些点”包装成“终于可以扩张”；禁止在剩余 closure 缺口未被真实收掉前提前进入 expansion work；禁止重复制造“API 存在但未接线”“测试存在但无生产路径”“文档写 closed 但代码仍 partial”的阶段错觉。  
> **本轮风格要求**：高压审计约束 + 最后收口执行协议 + 扩张解锁标准。你不是来继续泛修补，也不是来继续审计文学化，而是来**一次性收掉剩余 closure gaps，并用清晰 gate 解锁下一阶段扩张开发**。

---

# 0. 强制执行声明

本轮不是新的探索轮。  
本轮也不是普通 bugfix 轮。  
本轮更不是“再加一点功能顺便修点问题”。

本轮是：

# **Round 15.0.2 — Last Closure Before Expansion & Expansion Unlock Criteria**

你必须把本提示词视为当前阶段的**最后收口协议**。你必须：
- 先读上下文与最近几轮 DevPrompt / 审计结论
- 明确列出当前剩余 closure gaps
- 只做本轮必须的高杠杆收口改动
- 强制验证 production path、contract semantics、命名语义与文档一致性
- 最终给出一个明确结论：
  - closure 是否完成
  - 扩张开发是否已解锁
  - 解锁后下一阶段可以做什么、不能做什么

禁止：
- 新增与 closure 无关的能力
- 借本轮顺势扩张 economy / replication / governance / UI / channels
- 用新增抽象替代真实接线
- 用“测试都绿了”替代“production closure 已成立”
- 让同一批 closure 问题在下一轮再次回流
- 在 expansion unlock criteria 未明确前就宣称“可以扩张开发”

---

# 1. 本轮定位

本轮的定位非常明确：

> **这是当前阶段进入扩张开发前的最后一个 closure-completion round。**

前序多轮已经把项目从：
- runtime truth 混乱
- identity / continuity 分裂
- owner boundary 局部存在
- doctor 与 runtime self model 口径不一

推进到了：
- canonical verification shell 明确
- continuity wiring 大体建立
- session lifecycle 已部分进入生产路径
- owner write/read 边界开始成型
- runtime-doctor truth contract 开始出现统一桥接
- full suite 长期保持全绿

但最新审计仍然明确指出，**项目之所以卡在收口上，是因为还剩少数但高杠杆的缺口没有真的收掉**。这些缺口如果不处理，下一阶段的任何 expansion 都会继续建立在 partial closure 上。

因此本轮不是“尽量再做得更好”，而是：

> **用最小但足够的工程动作，终结当前 closure backlog，并正式解锁扩张开发。**

---

# 2. 为什么 15.0.2 现在必须做

当前项目开发节奏已经明显被“反复收口”拖住。  
如果没有一个明确的 Last Closure Before Expansion round，会持续出现三种低效模式：

1. **每轮都再发现同一类问题**
   - API 存在但未接线
   - contract 存在但未落到生产路径
   - 语义上 partial，但对外表述写成 closed

2. **每轮都补一点，但不真正清空 backlog**
   - 造成“永远在 closing、从不真正 closed”

3. **不敢进入 expansion，因为 closure 标准始终模糊**
   - 主线被收口惯性拖住

所以本轮必须把问题从：
- “还有一些缺口”
变成：
- “哪些是本轮必须关掉的 closure blockers”
- “一旦关掉，就允许正式进入 expansion”

---

# 3. 本轮必须避免的四个错误

## 错误 A：继续把 closure 做成开放式任务
本轮不能再写成“建议若干方向、后续可继续优化”。  
必须有明确 closure done 条件。

## 错误 B：继续把 production path 缺失伪装成能力存在
例如：
- `buildContextForOwner()` 已实现，但生产代码没调
- `ConsolidationPipeline` 已测试，但 runtime 没调用
这种情况本轮必须结束，而不是继续忍受。

## 错误 C：继续容忍语义与命名错位
例如：
- `finalizeSession` 实际是 turn-level checkpoint
- 但名字/文档仍暗示 strict session end
这种错位如果继续存在，会持续污染后续系统设计。

## 错误 D：不定义 expansion unlock criteria
如果本轮只修 closure，不定义“何时允许扩张”，项目还会继续卡在收口惯性里。

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

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
12. `DevPrompt/0150_Round_14_8_2_Session_Lifecycle_Integration_Owner_Write_Boundary_and_Runtime_Doctor_Truth_Contract.md`
13. `DevPrompt/0151_Round_15_0_1_Final_Gap_Closure_Documentation_Reconciliation_and_Release_Readiness.md`
14. 与 Phase 2 / Round 15 直接相关的最新 walkthrough、audit 结论、修复记录（若存在，必须读）

读取后，必须先输出：

```md
# Context Assimilation
# Remaining Closure Backlog
# Why The Project Is Still Stuck In Closure
# Why 15.0.2 Must Be The Last Closure Round Before Expansion
```

并明确回答：
- 当前项目真实阶段是什么
- 现在还卡在什么 closure 问题上
- 哪些 closure 是 blocker，哪些只是可优化项
- 为什么这轮之后应该允许 expansion
- expansion 的解锁标准是什么

---

# 5. 当前可信基线（必须据此工作）

以下内容视为当前已知可信输入，但仍必须复核：

## 5.1 验证基线
- `.nvmrc = v24.10.0`
- canonical verification shell：`v24.10.0 / ABI 137`
- 最近一次可信 full suite：**646 / 646 pass**
- `tsc --noEmit`：通过

## 5.2 Phase 2 已真实推进的事项
- `PersistentAgentRegistry` 已落库
- `AgentLoop` 已接入 `startSession()` 与 `finalizeSession?()`
- `buildContextForOwner(ownerId)` 已实现
- `ConsolidationPipeline` 已实现并有测试

## 5.3 最新审计已明确指出的剩余缺口
这些缺口默认视为本轮 closure backlog 的核心：

### A. `buildContextForOwner()` 尚未进入真实生产路径
- 已实现，但生产代码未调用
- 所以 identity-aware memory reads 仍是 capability，不是 runtime fact

### B. `ConsolidationPipeline` 尚未进入真实生产路径
- 已实现，有测试
- 但未实例化、未接线、未定义运行时触发点

### C. `finalizeSession` 的命名语义与真实触发时机错位
- 当前发生在每轮 turn 后
- 语义更接近 checkpoint，而不是真正 session end

### D. continuity 推进仍依赖全局 `memoryEpisodeCount`
- 不是 owner-scoped，也不是 session-scoped
- self continuity 语义仍不够纯

### E. `PersistentAgentRegistry` 的 identity semantics 未完全定型
- 当前行为更像 name-anchored registry
- 同名不同 id 重注册语义未被正式化，也缺少边界测试

---

# 6. 本轮目标定义

本轮的目标不是“再让系统更完整一点”，而是：

# **Close The Remaining Closure Backlog And Unlock Expansion**

也就是同时完成两件事：

1. **把剩余 closure blockers 全部收掉**
2. **明确定义 expansion unlock criteria，并满足它**

本轮完成后，必须达到这种状态：

> **项目不再被卡在“继续收口”惯性里，而是可以明确地进入下一阶段扩张开发。**

---

# 7. 本轮必须完成的核心目标

## Goal A — 把 `buildContextForOwner()` 接入真实生产路径
你必须明确并尽量落地：
- 哪条生产路径最应该使用 owner-scoped context
- 是 `AgentLoop` 的主消息处理路径，还是某个更明确的 identity-aware path
- 如果默认 `buildContext()` 仍然存在，两者边界是什么
- owner-scoped context 在运行时如何被真实使用，而不是只存在 API

本轮完成后必须能回答：

> **owner-aware memory context 是否已从 capability 变成 runtime fact？**

答案必须是 YES，否则本轮失败。

## Goal B — 把 `ConsolidationPipeline` 接入真实运行时入口
你必须明确并尽量落地：
- 谁负责实例化 ConsolidationPipeline
- 在什么时机触发 consolidation
- 如何与 session summary / continuity / episodic memory 协同
- 如何避免重复 consolidation 造成重复 episodes
- 是否需要最小幂等策略、session marker、dedup guard 或 summary-based lock

本轮完成后必须能回答：

> **ConsolidationPipeline 是否已是 active runtime pipeline，而不是测试层能力？**

答案必须是 YES，否则本轮失败。

## Goal C — 收正 `finalizeSession` 的语义
你必须明确并尽量落地二选一：

### 方案 1：保留当前行为，但改名/改文档
如果它本质是 **turn-level continuity checkpoint**，那就不要继续叫 strict `finalizeSession`。
需要：
- 改名或明文化语义
- 同步修正文档、测试、日志与注释

### 方案 2：保留 `finalizeSession` 名称，但引入真正 session-end event
如果坚持使用 `finalizeSession` 这个名字，则必须让真正 session-close path 存在，并与 turn-level checkpoint 区分。

无论选哪条路，必须达到：

> **命名、文档、日志、测试、运行时行为语义一致。**

## Goal D — 收紧 continuity 推进条件，使 self 边界更纯
你必须评估并尽量修复：
- `memoryEpisodeCount` 是否必须 owner-scoped
- 是否至少应提供 owner-aware 或 session-aware 变体
- 当前全局计数是否会污染 self continuity

如果本轮无法完全改成 owner-scoped，也必须：
- 明确边界
- 降低误导性表述
- 给出最小可信 contract

## Goal E — 定型 `PersistentAgentRegistry` 的身份语义
你必须明确并尽量落地：
- 当前 registry 是 name-anchored 还是 id-anchored
- 同名不同 id 重注册行为是什么
- 外部使用者应把哪一个当作 canonical business identity
- 测试必须覆盖该边界情况
- 如有必要，补文档说明或注释约束

本轮不允许 registry 继续处于“代码行为成立，但语义靠猜”的状态。

## Goal F — 明确 expansion unlock criteria
这是本轮区别于普通 closure round 的关键。
你必须定义：
- 只要哪些条件同时满足，就允许下一阶段进入 expansion
- 哪些问题即使仍存在，也只能算 non-blocking optimization
- expansion 允许优先推进哪些方向
- expansion 阶段不应再被迫回头重审这批 closure 问题

最终要形成：

> **Closure 完成条件 + Expansion 解锁条件 + 扩张边界**

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止：

1. 不进入新的大功能开发
2. 不推进 economy / replication / governance / UI / channels 主线
3. 不进行大规模架构重写
4. 不为了追求“干净”而进行无边界重构
5. 不把优化项误判为 blocker
6. 不在 closure backlog 尚未清空时提前开始 expansion work

---

# 9. 必须重点阅读和检查的模块 / 文件

## Runtime / lifecycle / continuity 主线
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/identity/continuity-service.ts`
- 所有与 session lifecycle / turn completion / checkpoint / shutdown 相关模块

## Memory / owner / consolidation 主线
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/memory/consolidation.ts`
- `packages/core/src/memory/consolidation.test.ts`
- `packages/core/src/state/repos/memory.ts`

## Identity registry 主线
- `packages/core/src/identity/persistent-registry.ts`
- `packages/core/src/identity/persistent-registry.test.ts`
- `packages/core/src/state/database.ts`
- `packages/core/src/identity/index.ts`

## 验证与审计主线
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/kernel/kernel-continuity.test.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`
- `packages/core/src/doctor/doctor.test.ts`
- 最近一轮审计与 walkthrough 记录

---

# 10. 开始实施前必须回答的设计问题

## Q1. 哪条路径应成为 owner-scoped context 的 canonical production path？
你必须明确：
- 主消息处理路径是否应默认使用 owner-scoped context
- 如果不是，哪条路径负责它
- 为什么

## Q2. ConsolidationPipeline 的 canonical trigger 是什么？
你必须明确：
- 是 turn 后触发？
- session summary 保存后触发？
- session close 时触发？
- shutdown 时触发？
- 哪一种最符合 self continuity 与 data quality

## Q3. `finalizeSession` 到底是什么？
你必须明确：
- 它是真 session end 吗？
- 还是 turn checkpoint？
- 若不是 session end，为什么还叫 finalizeSession？

## Q4. continuity 应该由全局 memoryEpisodeCount 驱动吗？
你必须明确：
- 当前设计是否会污染 self continuity
- 若会，最小修复是什么

## Q5. PersistentAgentRegistry 的 canonical identity key 是什么？
必须明确：
- `name`
- `id`
- 或两者不同层次含义

## Q6. expansion unlock criteria 的最小集合是什么？
你必须避免再次出现“感觉差不多可以扩张了”。  
解锁条件必须是明确可验证的。

---

# 11. 推荐实施方向

## Direction 1 — 先收掉 runtime fact 缺口，再谈扩张
优先把：
- `buildContextForOwner()` 生产接线
- `ConsolidationPipeline` 生产接线
收掉。

## Direction 2 — 先修语义错位，再修 wording
`finalizeSession` 的语义问题是结构性问题，不是文案问题。

## Direction 3 — 让 continuity 尽量反映 self-local 变化，而不是全局噪音
即使本轮做不到彻底重构，也要把 contract 收紧到最小可信状态。

## Direction 4 — 把 registry 语义定型为正式 contract
不是只补一个测试，而是要让未来扩张阶段不再误解 registry 的 identity behavior。

## Direction 5 — 用 expansion unlock criteria 终结反复收口
本轮必须明确告诉未来：
- 这批问题一旦过线，就不再回头反复审。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 owner-scoped context enters production path
- 不只是 `buildContextForOwner()` 函数可调用
- 必须证明真实生产消息路径使用了 owner-aware context

## 12.2 consolidation pipeline is runtime-wired
- 至少一个真实运行时入口会触发 consolidation
- 不只是单元测试手动调用

## 12.3 consolidation dedup / idempotency contract
- 重复触发不会无限重复生成等价 episodes
- 或者至少有明确 guard 防止数据膨胀

## 12.4 session/turn checkpoint semantics are explicit and test-protected
- 命名、行为、日志、语义必须一致

## 12.5 continuity advance uses a cleaner boundary
- 如果改为 owner/session-aware count，必须测试
- 如果无法完全重构，也必须测试新的最小可信 contract

## 12.6 PersistentAgentRegistry semantic edge case
- 同名不同 id 重注册
- 必须明确断言系统设计想要的行为

## 12.7 expansion unlock gate evidence
- 至少有一组测试/检查证明：本轮 closure blockers 已被清空

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Remaining Closure Backlog
# Why The Project Is Still Stuck In Closure
# Why 15.0.2 Must Unlock Expansion
```

## Phase 2 — Closure Backlog Ledger
必须先列出：
- Blockers（必须本轮关闭）
- Important but non-blocking（可以进入 expansion 后再优化）
- Cosmetic（不阻塞）

## Phase 3 — Contract Decisions
必须明确：
- owner-scoped context contract
- consolidation trigger / dedup contract
- session/turn checkpoint contract
- continuity boundary contract
- registry identity contract
- expansion unlock criteria

## Phase 4 — Implement
只做 blocker closure 与 unlock criteria 所需的最小充分实现。  
禁止扩散。

## Phase 5 — Tests & Verification
重点补 production-path integration tests，而不是只补模块级测试。

## Phase 6 — Expansion Unlock Verdict
明确回答：
- closure 是否完成
- expansion 是否解锁
- 下一阶段允许做什么

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/persistent-registry.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/consolidation.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/agent-loop-lifecycle.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/kernel/kernel-continuity.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/doctor/doctor.test.ts --no-coverage
```

你还必须新增并执行本轮真正证明以下事项的测试：
- owner-scoped context production wiring
- consolidation runtime wiring
- registry semantic edge case
- checkpoint/finalize semantic clarity
- expansion unlock gate evidence

然后继续：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。

---

# 15. 人工执行命令协议

如果由于 shell / host / sandbox / daemon / interactive runtime 限制，需要用户手动执行某步，必须使用以下格式：

## Manual Action Required

**Purpose**  
为什么必须人工执行

**Command**
```bash
<exact command>
```

**Why Agent Cannot Do This Directly**  
说明限制来源

**Expected Result**  
执行后应看到什么

**Verification After Run**  
你将如何继续验证

**Important Truth Note**  
在用户执行前绝不能写成已完成

---

# 16. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解当前阶段
- 为什么仍卡在 closure
- 为什么 15.0.2 是最后收口轮

# Closure Backlog Ledger
- Blockers
- Important but non-blocking
- Cosmetic

# Contract Decisions
- owner-scoped context contract
- consolidation trigger / dedup contract
- session/turn checkpoint contract
- continuity boundary contract
- registry identity contract
- expansion unlock criteria

# Modified Files
- 改了哪些文件
- 每项改动如何收掉 blocker
- 哪些改动是 closure，哪些改动是 unlock criteria formalization

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明 production wiring
- 哪些测试证明语义 contract
- 哪些测试证明 expansion unlock 已达成

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Expansion Unlock Gate
- 哪些条件通过
- 哪些条件仍未通过
- 现在是否允许进入扩张开发
- 允许进入的边界是什么

# Final Verdict
明确回答：

> 15.0.2 是否已经收掉当前剩余 closure backlog，并正式解锁扩张开发？

答案只能类似：
- `YES — remaining closure blockers are closed and expansion is formally unlocked`
- `PARTIAL — closure improved but expansion remains gated by one or more blockers`
- `NO — closure backlog still blocks expansion`

# Next Round Recommendation
如果 YES，明确推荐下一阶段优先扩张方向；如果不是，列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不列 closure backlog 直接改代码
2. 不把 runtime wiring 做成生产事实就宣称 closure 完成
3. 不解决语义错位就直接说 expansion unlocked
4. 不定义 unlock criteria 就把项目推进到下一阶段
5. 把 optimization 项误判成 blocker，导致项目继续卡死
6. 借本轮顺手扩张新能力
7. 输出一种无法被代码与命令回溯的“已经解锁扩张”结论

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. `buildContextForOwner()` 已进入真实生产路径
2. `ConsolidationPipeline` 已进入真实运行时路径，且有最小 dedup/guard
3. session/turn checkpoint 语义已收正且测试保护
4. continuity boundary 比当前更纯、更可信
5. `PersistentAgentRegistry` identity semantics 已明文化并补齐边界测试
6. production-path integration tests 已建立并通过
7. full suite + tsc 在 canonical shell 下通过
8. expansion unlock criteria 已明确并通过
9. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续零散收口，而是彻底清空当前剩余 closure backlog，并通过明确的 expansion unlock criteria，让 ConShell 正式从“长期卡在收口”切换到“可安全扩张开发”的状态。**
