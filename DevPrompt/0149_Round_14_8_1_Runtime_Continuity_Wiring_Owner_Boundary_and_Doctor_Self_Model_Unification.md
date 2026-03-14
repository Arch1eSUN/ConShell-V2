# Round 14.8.1 — Runtime Continuity Wiring, Owner Boundary Completion & Doctor Self-Model Unification

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止把“局部补丁”包装成“deeper closure 已完成”、禁止绕过 runtime wiring、禁止用单测绿灯替代真实闭环、禁止在 self model 未统一前盲目进入 economy / replication。  
> **本轮风格要求**：高压审计约束 + 精准实施协议 + 强最终验收格式。你不是来“继续优化一些字段”，而是来**收口 Round 14.8 被审计明确指出的三条未闭环主链**。

---

# 0. 强制执行声明

你必须把本提示词视为本轮的**主执行规范**，不是建议，不是灵感来源，也不是可自由裁剪的参考文本。

你必须：
- 完整阅读
- 完整理解
- 严格执行
- 只基于实际代码、测试、命令、搜索结果与运行证据汇报
- 严格区分：
  - 已验证事实
  - 代码层事实
  - 运行时事实
  - 推断
  - 未知
- 在关键结论前主动自审：是否存在“实现了局部能力，却宣称完成系统闭环”的倾向

禁止：
- 跳过上下文文件
- 跳过 runtime wiring 核查
- 只修测试不修真实链路
- 只修描述层（explanation / docs / report wording）不修 self-model 真相源
- 用“测试通过了”替代“目标闭环成立了”
- 在本轮中顺手扩张到 economy / replication / governance / UI / channels
- 把 owner-aware retrieval 的局部修补包装成完整 owner boundary
- 把 doctor 的平行 DB check 继续伪装成 runtime self truth

---

# 1. 本轮定位

本轮不是新的大扩张。  
本轮也不是重跑 14.8 的旧任务描述。

本轮是：

# **Round 14.8.1 — Runtime Continuity Wiring, Owner Boundary Completion & Doctor Self-Model Unification**

本轮的唯一正当性来自一个清楚的现实：

> **Round 14.8 虽然引入了 SelfExplanation、soul drift detection、session advance guard、部分 owner-aware retrieval，但独立审计已确认：它没有真正建立 identity/memory deeper closure。**

独立审计指出的三条未闭环主链是：

1. **runtime session lifecycle → continuity advance 没有被证明真实接线**
2. **owner-aware episodic retrieval → full memory owner boundary 没有成立**
3. **doctor DB checks → runtime self model truth 没有统一成同一个 canonical self model**

因此本轮不是“继续润色 14.8”，而是：

> **把 14.8 没打通的三条主闭环真正打通，并把 self model 从“多个局部实现并列存在”推进到“单一 truth-preserving runtime model + doctor verification view”。**

---

# 2. 为什么本轮现在必须开始

本轮之所以现在开始，不是因为“还可以再补几个测试”，而是因为如果不做 14.8.1，项目会进入一种危险的伪稳定状态：

- 文档与提示词会宣称 deeper closure 已前进
- 测试会显示部分新增功能已通过
- 但 runtime 的真实 self continuity 与 memory ownership 仍未闭环
- doctor 仍在检查一套平行逻辑，而不是 runtime 当前真正相信的 self state

这会直接污染后续所有更高层轮次，尤其是：
- Economic Grounding
- Wallet / spend identity attribution
- multi-self / lineage / fork 场景
- 长期连续运行中的“谁还在继续存在”问题

也就是说：

> **如果 14.8.1 不收口，那么后续更高层能力会继续建立在一个“看起来更完整、实际上还未统一”的 self basis 上。**

---

# 3. 本轮必须避免的两个错误

## 错误 A：把本轮继续做成“局部补丁轮”
例如：
- 只增加几条测试
- 只修 `SelfExplanation` 文案
- 只在某个 repository 多加一个 `owner_id`
- 只让 doctor 增加几个 status 字段

这种做法会继续制造“看起来更成熟”的错觉，但不会建立真实闭环。

## 错误 B：因为问题较深就回避真实接线
例如：
- 不去追 session finalize 的真实调用链
- 不去统一 doctor 与 runtime self model
- 不去回答哪些 memory tier 必须 owner-bound
- 不去落地 canonical self authority graph

这种做法会让 14.8.1 退化成“承认问题但没解决”的审计文学。

本轮必须做到：
- 不表面修补
- 不回避根因
- 不概念堆砌
- 不超范围扩张
- **只做真正能收口 14.8 审计缺口的高杠杆动作**

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
15. `DevPrompt/0148_Round_14_8_Identity_Memory_Deeper_Closure.md`

读取后，你必须先输出：

```md
# Context Assimilation
# Why 14.8 Was Not Enough
# Why 14.8.1 Is A Closure Round, Not A New Expansion Round
```

并明确回答：
- ConShell 真正是什么
- 当前项目阶段是什么
- 14.8 实际推进了什么
- 14.8 为什么没有达到 deeper closure
- 为什么 14.8.1 必须先修 self basis，而不是直接进入 economy / replication
- 本轮的真正成功标准是什么

---

# 5. 当前可信基线（必须据此工作）

以下内容视为本轮已知可信输入，但你仍必须继续用代码与测试复核，禁止只复述。

## 5.1 已成立的验证基线
在 canonical verification shell 中，当前已知可信事实为：
- `.nvmrc = v24.10.0`
- canonical verification shell 已确认：`v24.10.0 / ABI 137`
- `doctor.test.ts` 已通过
- full suite 已通过
- Round 14.8 的测试增量已纳入总体验证面

## 5.2 Round 14.8 已有真实增量
当前代码层已存在：
- `SelfExplanation`
- `soulDrifted`
- `shouldAdvanceForSession()`
- restart 时 soul drift detection
- episodic owner-aware retrieval（局部）

## 5.3 独立审计已确认的 14.8 未闭环点
独立审计已指出以下问题，默认视为**高优先级待验证/待收口对象**：

### A. runtime session lifecycle 未证明真实接线
- `shouldAdvanceForSession()` / `advanceForSession()` 可能只存在于 service 与测试中
- 未证明真实 session finalize 路径会调用它们

### B. owner boundary 只在局部 retrieval 层成立
- episodic memory 有 owner-aware retrieval
- 但 semantic / procedural / relationship / session summaries 等仍可能是全局共享
- 这不足以构成完整 identity boundary

### C. doctor 与 runtime self model 未统一
- `ContinuityService` 有一套 runtime self state
- `checkIdentityCoherence()` 又有一套平行 DB/SOUL 检查逻辑
- 两者未形成单一 canonical self model / verification view

### D. advance 后 runtime self state 可能陈旧
- `latestRecord` / `chainLength` 会更新
- 但 `soulDrifted` / `explanation` / 其他派生自我状态不一定同步刷新

这四条里，A/B/C 是主闭环，D 是关键一致性问题。

---

# 6. 本轮目标定义

本轮的最优目标是：

# **Close The Three Missing Identity/Memory Truth Loops**

也就是：

> **把 runtime continuity wiring、memory owner boundary、doctor self-model verification 三条链打通，并让 runtime 当前 self state 与 doctor 对该 self state 的验证建立在同一 truth source 上。**

本轮不是“让系统更会描述自己”，而是：

> **让系统更可证明地维护并验证：同一个 self 如何跨 session、memory、soul 与重启持续存在。**

---

# 7. 本轮必须完成的核心目标

## Goal A — 把 session continuity 真正接入 runtime lifecycle
你必须查明并尽量落地：
- session finalize 的真实入口在哪
- 当前 runtime 生命周期何处最适合触发 continuity advance
- `shouldAdvanceForSession()` 是否应作为唯一 guard
- `memoryEpisodeCount` / `sessionCount` 的可信来源是什么
- 真实 finalize 路径是否已经调用 continuity service；若没有，必须接上

本轮完成后，必须能够回答：

> **session-level continuity advance 是真实 runtime 行为，还是仅存在于 service/test 的局部能力？**

最终答案必须是前者，否则本轮失败。

## Goal B — 把 owner-aware retrieval 推进为更完整的 owner boundary
你必须明确并尽量落地：
- 哪些 memory tier 必须 owner-bound
- 哪些 memory tier 允许 shared / null-owner
- retrieval / listing / consolidation / context building 时哪些层必须 identity-aware
- route / API / service 返回的 memory context 是否还会混入跨 identity 内容

重点不是“给更多表加字段”本身，而是：

> **让系统对 memory 的处理真正服务于 self continuity，而不是只在 episodic retrieval 上做局部过滤。**

## Goal C — 统一 doctor 与 runtime self model
你必须明确并尽量落地：
- runtime canonical self state 是什么
- doctor 是验证这套 self state，还是继续维护另一套平行逻辑
- `ContinuityService.getCurrentState()`、`SelfState`、`SelfExplanation` 应如何被 doctor 消费、对照或转换
- doctor 最终输出应如何表达“runtime believes X, evidence supports Y / does not support Y”

本轮必须推进到：

> **doctor 不再只是查数据库，而是在验证 runtime 当前 self belief 是否被 truth-preserving evidence 支撑。**

## Goal D — 修复 post-advance self-state consistency
你必须修复或显式处理：
- advance 后 `soulDrifted` 是否应重算
- `explanation` 是否应刷新
- `mode` / `chainValid` / 其他派生字段在 advance 后如何保持一致

如果当前 `SelfState` 只是 hydrate 快照而非强一致 state，你必须：
- 明确承认
- 解释边界
- 尽量收口

## Goal E — 为下一阶段建立更可靠 self basis
本轮不进入 Economic Grounding，但必须让后续更容易回答：
- 谁持有钱包
- 谁累计支出
- 谁继承记忆
- 谁在继续存在

也就是说：

> **本轮应把“identity basis”推进到足以支撑下一轮经济语义，而不是直接实现经济逻辑。**

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不进入 economic grounding 主逻辑
2. 不进入 replication / collective evolution 主逻辑
3. 不大改 UI / dashboard / channels
4. 不重写整个 doctor 子系统
5. 不做大规模 architecture rewrite
6. 不把本轮变成纯文档轮
7. 不为了 owner boundary 一口气无边界重构所有存储层
8. 不为了“统一 self model”引入过度抽象而破坏可维护性
9. 不用报告措辞修饰替代 runtime wiring 与 truth closure

---

# 9. 必须阅读和理解的模块 / 文件

## Identity / continuity 主线
- `packages/core/src/identity/anchor.ts`
- `packages/core/src/identity/anchor.repo.ts`
- `packages/core/src/identity/index.ts`
- `packages/core/src/identity/coherence.test.ts`
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/continuity-service.test.ts`

## Kernel / runtime / session lifecycle 相关
- `packages/core/src/kernel/index.ts`
- 所有与 session finalize / conversation close / session summary / memory flush / runtime lifecycle 相关模块
- 任何会在 session 结束时写 memory / summary / continuity 的路径

## Memory / state 相关
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/state/database.ts`
- 任何与 `owner_id`、context building、memory API / retrieval 相关模块

## Doctor / self model 验证主线
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/identity.ts`
- `packages/core/src/doctor/doctor.test.ts`
- 任何构建 integrity report / self verification / runtime evidence 的模块

## Soul / integration 相关
- `packages/core/src/soul/system.ts`
- `packages/core/src/kernel/kernel.test.ts`
- 任何 soul advance callback integration 相关代码

---

# 10. 开始实施前必须回答的设计问题

## Q1. 当前 canonical self source 到底是什么？
你必须明确：
- `IdentityAnchor` 是不是最高稳定身份源
- `latest ContinuityRecord` 是否是当前 self state 的持久化账本头
- `current SOUL` 的地位是什么
- memory ownership 与 self continuity 的权威关系是什么
- 当这些对象相互冲突时，以谁为准

## Q2. session continuity 的 canonical advance rule 是什么？
你必须明确：
- 何时推进 continuity
- 何时不推进
- 仅 `sessionCount` / `memoryEpisodeCount` 是否足够
- `soulDrifted` / `degraded` / recovery 情况是否应影响 session finalize 时的推进策略

## Q3. memory owner boundary 的最小可信边界是什么？
你必须明确：
- 哪些 tier 在本轮必须纳入 owner boundary
- 哪些 tier 当前可以暂时保持 shared，但必须明确说明风险
- 当前“足以支撑下一轮”的最小边界在哪里

## Q4. doctor 应该验证什么？
你必须明确：
- doctor 是验证表状态，还是验证 runtime 当前 self belief
- doctor 如何读取或推导 runtime self state
- doctor 如何在 truth-preserving 前提下表达 mismatch / drift / degraded / stale state

## Q5. 本轮的最小成功标准是什么？
你必须写出明确标准，避免再次出现：
- 做了增量
- 测试变多
- 但闭环仍未成立

原则：

> **只有当主闭环真实接线并可验证时，本轮才算成功。**

---

# 11. 推荐实施方向

## Direction 1 — 先定位 runtime finalize 主链，再修 continuity wiring
不要先改测试。
先回答：
- runtime 里 session finalize 实际在哪发生
- continuity 当前为什么没被真实接线
- 接线后如何避免版本滥增

## Direction 2 — 先定义 owner boundary，再做最小必要 schema / query / context 变更
不要先无差别给所有表加 `owner_id`。
先回答：
- 哪些数据从 self continuity 角度必须绑定 identity
- 哪些数据当前可以共享但必须被 doctor/report 明确标注为 shared context

## Direction 3 — doctor 必须成为 runtime self truth 的验证视图，而不是平行宇宙
不要继续累加 DB check。
先定义：
- runtime self state
- doctor verification view
- 两者之间的映射关系

## Direction 4 — 修复 self-state consistency，不允许“写入真相已更新，运行态描述仍旧值”
advance / drift / recovery 之后，runtime 自我状态必须尽量自洽。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 runtime session finalize truly advances continuity
- 不是直接调用 service
- 而是通过真实 runtime / kernel / session finalize 路径触发
- 证明 wiring 是真的，不是局部 API 存在

## 12.2 redundant session finalize does not inflate versions
- 相同 sessionCount / same effective state
- 不应滥增 continuity record

## 12.3 soul drift interacts correctly with session finalize
- restart 后 `soulDrifted = true`
- session finalize 后是否应 re-anchor / advance，规则必须可验证

## 12.4 owner boundary in context building
- 至少验证本轮定义为必须 owner-bound 的 memory tiers
- context / retrieval / API 不得混入跨 identity 数据

## 12.5 shared-vs-owned memory semantics
- 如果某些 tier 暂时允许 shared
- 必须有清晰测试与明确语义，不得默默混用

## 12.6 doctor consumes unified self model
- doctor 不能只测 DB 状态
- 必须验证 runtime self state / explanation / drift / degraded 的 truth contract

## 12.7 post-advance self-state consistency
- advance 后 `SelfState` 的派生字段与 latest record 一致
- 不允许 stale explanation / stale soulDrifted

## 12.8 no regression
- 不破坏 14.7 / 14.7.2 / 14.8 已建立的 truth contract
- canonical shell 下 doctor / full suite 继续通过

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why 14.8 Did Not Establish Deeper Closure
# Why 14.8.1 Must Close The Three Missing Truth Loops
```

## Phase 2 — Current Closure Audit
你必须明确列出：
- 当前 runtime self model 已有什么
- session finalize 当前真实在哪发生
- continuity 当前是否真实接线
- memory owner boundary 当前实际到哪一层
- doctor 当前到底在验证什么
- 哪些点仍属于平行实现/局部实现/描述层增强

## Phase 3 — Design
你必须明确：
- canonical self model
- session continuity canonical rule
- owner boundary model
- doctor verification view
- post-advance self-state consistency strategy

## Phase 4 — Implement
只做本轮高杠杆闭环实现，不扩散到 economy / replication / UI。

## Phase 5 — Tests
补齐关键测试，特别是 runtime wiring 与 unified self model，而不是只补 service 内部函数测试。

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

如果新增了 runtime / kernel / memory 边界相关关键测试，也必须单独点名执行并记录。

所有验证必须在 canonical verification shell 下完成。

---

# 14. 人工执行命令协议

如果因为：
- `nvm` 只在交互 shell 生效
- agent 无法切换宿主 shell
- 需要用户显式进入 canonical shell
- 需要人工确认持久化 / schema / native 状态动作

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
- 为什么 14.8 不足
- 为什么 14.8.1 是 closure round 而不是 expansion round

# Current Closure Audit
- 当前 canonical self model 现状
- 当前 runtime continuity wiring 现状
- 当前 owner boundary 现状
- 当前 doctor self verification 现状
- 当前最关键未闭环点

# Design Decisions
- canonical self authority graph
- session continuity canonical rule
- memory owner boundary model
- doctor self-model verification view
- post-advance self-state consistency strategy

# Modified Files
- 改了哪些文件
- 每项改动的作用
- 它们如何分别推进三条主闭环

# Tests Added or Updated
- 补了什么测试
- 每个测试保护什么 closure
- 哪些测试证明“真实 wiring”，而不是“局部函数存在”

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明是在 canonical verification shell 下完成

# Audit Conclusion
- runtime continuity wiring 是否真实成立
- owner boundary 是否推进到足以支撑下一阶段
- doctor 与 runtime self model 是否已统一到同一 truth source
- 哪些闭环已成立
- 还剩哪些关键缺口

# Final Verdict
明确回答：

> 本轮是否成功完成 Runtime Continuity Wiring, Owner Boundary Completion & Doctor Self-Model Unification？

答案只能类似：
- `YES — the three missing truth loops are now materially closed`
- `PARTIAL — closure improved but one or more primary loops remain open`
- `NO — insufficient real closure`

# Next Round Recommendation
只能基于本轮真实结果给建议；只有在 self basis 已明显加强后，才允许认真讨论进入 Economic Grounding。

---

# 16. 严格禁止事项

你绝对不能做这些事：

1. 跳过上下文文件直接进入改代码
2. 不核查 runtime finalize 主链就宣称 session continuity 已接线
3. 只给 episodic retrieval 加 owner 逻辑就宣称 owner boundary 已完成
4. 继续让 doctor 只查 DB，却宣称 self model 已统一
5. 不修 post-advance stale state 就宣称 runtime self state 已可信
6. 用概念叙事替代实现、测试与验证
7. 在本轮中顺手扩到 economy / replication / UI / governance
8. 不跑 canonical shell 验证就宣称成功
9. 把“部分前进”包装成“deeper closure 已完成”

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. session continuity 已通过真实 runtime lifecycle 接线，而非仅存在于 service/test
2. owner boundary 已从局部 retrieval 推进为更完整、可说明、可验证的 identity boundary
3. doctor 与 runtime self model 已不再是两套平行真相
4. post-advance self-state 至少达到基本一致，不再明显陈旧
5. 关键测试覆盖了 wiring / boundary / self-model unification
6. 所有验证在 canonical verification shell 中通过或被真实记录
7. 结论真实、克制、可复核

---

# 18. 一句话任务定义

> **本轮的任务不是继续让系统“更像有一个 self”，而是把 14.8 尚未打通的三条自我连续性真相链真正接通，使 self continuity、memory ownership 与 doctor verification 开始建立在同一套可审计 truth source 上。**
