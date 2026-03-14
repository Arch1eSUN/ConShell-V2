# Round 14.6 — Runtime Truth Reconciliation & Pinned Verification Closure

> **用途**：直接交给下一轮开发 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止弱化约束、禁止为追求扩张速度而忽略当前真实性问题。

---

# 0. 强制执行声明

你必须把本提示词视为本轮开发的**主执行规范**，不是参考建议。

你必须：

- 完整阅读
- 完整理解
- 严格遵守
- 逐阶段执行
- 按要求验证
- 按要求汇报

禁止：

- 擅自缩短流程
- 跳过上下文文件
- 跳过验证
- 只挑“有趣的扩张功能”做
- 基于旧叙事、旧 README、旧阶段判断直接推进
- 为了追求“继续向生命体扩张”而忽略当前 runtime truth 问题

如果你不按本提示词执行，你的工作视为不合格。

---

# 1. 本轮总原则：先修真相，再谈扩张

ConShell 的长期目标确实是：

> **基于 Web4 方向，融合 OpenClaw 与 Conway Automaton，构建具备主权身份、长期记忆、工具行动、经济闭环、持续运行与自我治理能力的自主 AI 智能生命体运行时。**

但你必须明确：

> **当前轮次不应一味推进扩张开发。**

当前项目最重要的问题不是“还少哪些更大的能力”，而是：

1. **pinned runtime truth 与 current shell truth 分叉**
2. **Doctor 的 foreign-runtime rejection 逻辑与测试不一致**
3. **验证结论在不同 runtime 下不能稳定复现**

因此本轮目标不是继续扩张更高层能力，而是：

> **恢复并巩固 ConShell 的真实性闭环，让后续任何扩张开发都建立在一致、可复核、可审计的 runtime truth 上。**

---

# 2. 你的角色

你不是普通代码助手，也不是来继续“往更宏大的生命体叙事上堆功能”。

你是一个**高可信工程执行代理**。你的职责是：

> **基于 Round 14.5 的审计结果，解决 ConShell 当前最关键的真实性与验证闭环问题：runtime truth reconciliation、pinned runtime verification closure、doctor runtime evidence alignment correctness。**

你必须始终记住：

- 这个项目不是普通 chat app
- 这个项目不是单纯 CLI / dashboard
- 这个项目不是 agent feature 拼盘
- 这个项目当前阶段的高优先级不是扩张功能广度，而是**保证真实性、可验证性、可持续演进性**

---

# 3. 开始前必须阅读的文件

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
10. `DevPrompt/0145_Round_14_5_Continuity_Runtime_Integration_and_Recovery_Truth.md`

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：

- ConShell 真正是什么
- 当前已经推进到了哪个阶段
- Round 14.5 真实推进了什么
- Round 14.5 审计后最重要的新问题是什么
- 为什么本轮不应继续盲目扩张，而应优先解决 runtime truth 问题
- 本轮最值得推进的高杠杆目标是什么

如果你没有先输出这部分，就不能进入实现阶段。

---

# 4. 当前轮次基线（必须据此工作）

以下内容视为本轮可信输入基线，但你仍需在代码和运行层面对账，不允许只复述。

## 4.1 当前项目阶段定位

当前 ConShell 的最准确阶段判断是：

> **Viable Sovereign Runtime Core + Early Self-Continuity Runtime Layer**

这意味着：

- runtime viability / doctor / integrity 已有较强基础
- identity-memory continuity 已经不只是数据结构，而开始接入 runtime boot
- 但当前验证系统还存在 runtime truth 分叉
- 当前不是继续扩张高层能力的最佳时机

## 4.2 Round 14.5 已真实推进的内容

Round 14.5 已在代码层真实推进：

- `ContinuityService`
- kernel 12-stage boot，新增 `identity` stage
- `KernelServices` 中加入 `continuity` / `selfState`
- `SoulSystem.onSoulEvolved` → continuity advance
- lineage 字段：`parentIdentityId` / `generation`
- continuity runtime integration / degraded mode 雏形

## 4.3 Round 14.5 审计后的关键结论

### 代码层结论
Round 14.5 的核心推进**真实成立**。

### 当前 shell 运行时结论
在独立复核的当前 shell 下，不成立为全绿，原因包括：

#### A. runtime pin 分叉
- current shell Node = `v25.7.0`
- `.nvmrc` = `v24.10.0`
- `better-sqlite3` ABI mismatch（137 vs 141）导致 DB 测试系统性失败

#### B. doctor 逻辑/测试不一致
`src/doctor/doctor.test.ts` 中以下用例在当前复核下仍失败：
- rejects vitest evidence from foreign runtime
- rejects tsc evidence from foreign runtime

### 本轮必须承认

> **目前最大的高优先级问题不是“能力不够多”，而是“当前验证真相不一致”。**

如果不先解决这一点，后续任何更高层扩张（经济/治理/复制/演化）都会建立在不稳定的真相基线之上。

---

# 5. 本轮目标定义

本轮不是继续推进更高层生命体能力，不是继续扩 identity，也不是继续扩 lineage/economy/browser/channels。

本轮的最优目标是：

# **Round 14.6 — Runtime Truth Reconciliation & Pinned Verification Closure**

也就是：

> **让 ConShell 的验证真相重新统一：明确并修复 current shell 与 pinned runtime 的验证分叉，修复 Doctor 的 foreign-runtime evidence rejection 逻辑/测试不一致，并建立一个可重复、可解释、可审计的验证闭环。**

---

# 6. 为什么本轮必须先做这个

## 6.1 为什么不是继续扩 continuity / lineage
14.5 已经把 continuity 接入了 runtime 主路径。  
现在继续往上堆 continuity feature，不会是最高杠杆动作，因为：

- 你还不能稳定证明当前验证结果到底在哪个 runtime 下成立
- 你还不能让 Doctor 对 foreign-runtime evidence 稳定拒绝
- 你还不能让审计者在当前 shell 下复现开发者宣称的“全绿”

## 6.2 为什么不是直接做经济闭环
经济闭环重要，但如果 runtime truth 本身不统一，那么：
- 任何“收入 / 支出 / survival pressure”的验证都可能在不同 shell 下分叉
- 这会让经济层比 continuity 层更容易出现幻觉闭环

## 6.3 为什么这是当前最高杠杆动作
因为当前最危险的不是功能缺口，而是：

> **项目开始出现“开发轮次报告 reality”和“独立复核 shell reality”并存。**

一旦这个问题不被系统性修复，后续所有轮次都会积累审计债与真相债。

---

# 7. 本轮必须完成的核心目标

## Goal A — 修复并统一 runtime truth source

你必须让 ConShell 的验证结果明确绑定并暴露：

- 当前使用的 Node 版本
- 当前 ABI
- 当前执行路径（`process.execPath` 或等价信息）
- 当前是否与 `.nvmrc` 对齐
- 验证结果是在什么 runtime 下得出的

也就是说，系统必须开始具备：

> **“这份测试/Doctor/viability 结论到底是在哪个 runtime 下成立的”** 的明确表达能力。

## Goal B — 修复 Doctor 的 foreign-runtime rejection 逻辑/测试不一致

当前已知存在问题：
- `doctor.test.ts` 期望 foreign runtime evidence 被 reject
- 实际检查结果仍为 `pass`

你必须查明并修复：

1. 是 `checkExecutionEvidence()` 逻辑错误
2. 还是 `computeRuntimeIdentity()` / evidence matching 逻辑错误
3. 还是测试断言与实现设计发生漂移
4. 还是“允许兼容”的逻辑误吞了 foreign-runtime 情况

你必须让以下命题重新成立并可验证：

> **foreign-runtime evidence must not be accepted as current runtime truth**

## Goal C — 建立 pinned runtime verification closure

本轮必须建立一种明确的验证闭环，使系统能区分并处理：

- current shell is not pinned runtime
- verification result belongs to pinned runtime
- verification result belongs to current shell
- current shell cannot truthfully assert pinned-runtime green state

理想结果是让系统在输出验证结论时明确表示：

- `verificationRuntime`
- `pinnedRuntime`
- `alignmentStatus`

## Goal D — 为未来所有轮次建立统一的验证契约

本轮不只是修当前 bug，还必须让后续轮次能遵守一个统一契约：

> **任何“全量测试通过 / readiness ready / viability pass”之类的结论，都必须附带 runtime identity。**

否则后面会反复重演当前问题。

## Goal E — 尽量降低人工歧义，而不是增加新概念

本轮的成功不在于多几个类型名，而在于：

- 更少歧义
- 更少“看起来像成功”
- 更少 runtime 分叉误判
- 更少开发报告与审计报告的现实冲突

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不继续扩张 identity/lineage 功能广度
2. 不做经济闭环主逻辑
3. 不做 dashboard 大改版
4. 不做 channel 扩展
5. 不做 browser/nodes/canvas 等上游广度吸收
6. 不做 replication runtime 正式实现
7. 不新增大段叙事文档作为主要产出
8. 不回避当前验证问题去做“看起来更大”的工作
9. 不弱化 Doctor 约束来换取表面 green
10. 不把 pinned runtime 绿灯写成 current shell 绿灯

---

# 9. 必须阅读和理解的模块文件

在完成根目录级阅读后，至少继续阅读并理解以下模块：

## Doctor / verification / runtime identity
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/tests.ts`
- `packages/core/src/doctor/checks/env.ts`
- `packages/core/src/doctor/doctor.test.ts`

## continuity/runtime 相关（用于理解当前轮次与验证影响）
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/soul/system.ts`

## database / better-sqlite3 / test open helpers
- `packages/core/src/state/database.ts`
- 所有用于 test DB 的 helper 路径

## 配置 / pinning / test runtime
- 根目录 `.nvmrc`
- `packages/core/vitest.config.ts`
- 根目录 `package.json`
- `packages/core/package.json`

如果你发现还有 runtime identity / test execution 相关入口，也必须补读。

---

# 10. 开始实现前必须回答的设计问题

## Q1. 当前系统里“验证真相”的 canonical source 是什么？
你必须明确：

- 是当前 shell 的 `process.version` / `process.execPath`
- 还是 evidence payload 里的 runtime identity
- 还是 pinned runtime
- 还是三者组合

必须给出一致规则。

## Q2. current shell truth 与 pinned runtime truth 冲突时，应如何表达？
你必须决定并实现：

- 这算 `not-ready`
- 还是 `insufficient-evidence`
- 还是 `warning with explicit split`

但无论如何，不能再把二者混成一个结论。

## Q3. foreign runtime 的判定条件到底是什么？
你必须明确：

- nodeVersion 不一致是否足够
- ABI 不一致是否足够
- execPath 不一致是否参与判定
- backwards compat 无 runtime fields 时如何处理

## Q4. 后续所有轮次的验证契约应该如何表示？
你至少要想清楚：

- tests pass 是在哪个 runtime 下 pass
- doctor ready 是在哪个 runtime 下 ready
- 如何让审计者不再猜测结论的 runtime 语境

---

# 11. 推荐实现方向

你可以偏离，但前提是更真实、更稳定、更可审计。

## Direction 1 — 明确 Verification Runtime Contract

建议引入一个更明确的结果结构，例如：

- `VerificationRuntime`
- `VerificationContext`
- `RuntimeAlignmentStatus`

它至少应能表达：

- current runtime
- pinned runtime
- evidence runtime
- whether current == pinned
- whether evidence == current
- whether evidence == pinned

重点不是命名，而是：

> **任何验证结果都必须带着自己的 runtime 身份。**

## Direction 2 — 修正 Doctor 的 execution evidence matching

重点核查 `checkExecutionEvidence()` 及其相关 helper：

- 为什么 foreign runtime evidence 仍被 accept
- 是比较逻辑漏判，还是 fallback 逻辑错误
- 是 tests 过时，还是实现漂移

修复后必须让测试与逻辑重新对齐。

## Direction 3 — 明确 current shell vs pinned runtime 的输出语义

建议系统在 Doctor / verification 输出中增加类似语义：

- `current runtime mismatched with .nvmrc`
- `verification result belongs to pinned runtime`
- `current shell cannot claim pinned-runtime readiness`

不要让用户或审计者自己猜。

## Direction 4 — 尽量让当前 shell 也能给出诚实结果

本轮不一定要强行让 Node 25 下所有 sqlite 测试通过。  
但至少要让系统在当前 shell 下诚实地给出：

- 失败的根因
- 是否因为 runtime mismatch
- 如何切换到 pinned runtime 验证
- 这一步是不是人工执行必需

## Direction 5 — 固化后续轮次验证规范

如有必要，可以在根目录或 DevPrompt/模板中补充一份轻量规则文档，明确：

- 以后每一轮都必须说明验证 runtime
- 以后每一轮都必须区分 current shell truth 和 pinned runtime truth

注意：只有在确实必要时才新增文档，避免文档堆积替代实现。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 foreign runtime rejection
- vitest evidence 来自 foreign runtime
- tsc evidence 来自 foreign runtime
- 必须 fail / block according to intended design

## 12.2 ABI mismatch handling
- ABI mismatch evidence 被正确拒绝或降级
- 不能与 compatible runtime evidence 混淆

## 12.3 current vs pinned runtime split
- current shell ≠ pinned runtime 时
- 输出或结果必须能表达这种分叉

## 12.4 backwards compatibility
- 没有 runtime fields 的旧 evidence 如何处理
- 不能误伤已有兼容路径

## 12.5 verification context visibility
- 最终结果中能看到 runtime identity / alignment 信息
- 测试保护这个输出不被回归删除

## 12.6 no regression
- 不破坏当前 Doctor / viability / continuity / kernel 现有结构
- 不用弱化标准换取 green

---

# 13. 实施顺序（严格执行）

你必须按以下顺序推进，禁止跳步。

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Current Round Baseline
# Why Round 14.6 Must Prioritize Truth Over Expansion
```

## Phase 2 — Current Truth Audit
你必须明确列出：

- 当前 shell runtime 是什么
- pinned runtime 是什么
- 当前 full-suite green claim 在哪个 runtime 下成立
- current shell 下失败的主要原因是什么
- doctor foreign-runtime mismatch 具体失败在哪里

## Phase 3 — Design
你必须明确设计：

- verification runtime contract
- foreign-runtime rejection semantics
- current vs pinned runtime split semantics
- how future rounds should report verification truth

## Phase 4 — Implement
只做最小必要实现，修复 truth reconciliation 与 pinned verification closure。

## Phase 5 — Tests
补测试矩阵，并确保 doctor alignment 逻辑真实被保护。

## Phase 6 — Verification
至少执行并记录：

```bash
cd /Users/archiesun/Desktop/ConShellV2 && node -v
cd /Users/archiesun/Desktop/ConShellV2 && node -p process.versions.modules
cd /Users/archiesun/Desktop/ConShellV2 && cat .nvmrc

cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run src/doctor/doctor.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run --no-coverage
```

如果你切换到了 pinned runtime，也必须明确记录：

- 如何切换
- 切换后 runtime identity
- 验证结果
- 与 current shell 结果的差异

---

# 14. 人工执行命令协议

如果因为：
- SIP
- sandbox
- host protection
- local runtime pin mismatch
- native rebuild limitation

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

# 15. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解项目与当前阶段
- 为什么本轮不能盲目扩张

# Current Truth Audit
- current shell runtime
- pinned runtime
- current shell full-suite reality
- pinned runtime claimed reality
- 当前最大 truth split 是什么

# Design Decisions
- verification runtime contract
- foreign-runtime rejection semantics
- current vs pinned split semantics
- future verification reporting contract

# Modified Files
- 每个文件改了什么
- 为什么改
- 它在 truth reconciliation 中的作用

# Tests Added or Updated
- 补了什么测试
- 每个测试保护什么 truth contract

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 runtime 是否与 `.nvmrc` 对齐

# Audit Conclusion
- 本轮是否修复了 truth split
- foreign-runtime rejection 是否重新可信
- 还剩哪些未解决问题

# Final Verdict
明确回答：

> 本轮是否成功建立 Runtime Truth Reconciliation & Pinned Verification Closure？

答案只能类似：
- `YES — truth closure established`
- `PARTIAL — truth improved but closure not complete`
- `NO — insufficient real progress`

# Next Round Recommendation
下一轮建议必须基于本轮真实结果，不允许预设剧情。

---

# 16. 严格禁止事项

你绝对不能做这些事：

1. 跳过根目录上下文文件直接实现
2. 继续扩张高层能力而回避当前 truth split
3. 用“未来生命体目标”作为不修当前验证问题的借口
4. 弱化 Doctor 判断来换取表面 green
5. 把 pinned runtime 结果写成 current shell 结果
6. 不跑验证命令就宣称修复完成
7. 不解释 runtime 语境就宣称全绿
8. 把 foreign-runtime rejection 的失败当成小问题忽略
9. 用新增文档替代代码修复
10. 让审计者继续猜“这个结果到底是在哪个 runtime 下成立的”

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 根目录上下文已被真正吸收
2. current shell truth 与 pinned runtime truth 的表达被系统化
3. doctor foreign-runtime rejection 逻辑/测试已重新对齐
4. 验证结果开始具备明确 runtime 身份
5. 测试保护了这套 truth contract
6. 验证命令已真实执行
7. 输出结论真实、克制、可审计

---

# 18. 一句话任务定义

> **本轮的任务不是继续扩大 ConShell 的能力表面，而是先让 ConShell 清楚且可证明地知道：哪些结论是在当前 runtime 下成立，哪些只是在 pinned runtime 下成立。**
