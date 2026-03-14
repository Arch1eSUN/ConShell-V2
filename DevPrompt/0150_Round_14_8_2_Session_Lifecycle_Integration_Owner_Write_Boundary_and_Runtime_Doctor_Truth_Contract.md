# Round 14.8.2 — Session Lifecycle Integration, Owner Write Boundary & Runtime-Doctor Truth Contract

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把局部补丁包装成 closure；禁止把测试存在等价为运行时主链已接通；禁止在 owner 写入边界未闭合时宣称 owner boundary complete；禁止在 doctor 尚未通过真实运行路径消费 canonical self state 时宣称 truth contract unified。  
> **本轮风格要求**：延续上一轮的高压审计约束 + 精准实施协议 + 强最终验收格式，但这一次必须从“补缺口”升级到“**正式 contract 收口**”。

---

# 0. 强制执行声明

本轮不是自由发挥。  
本轮也不是“把 14.8.1 再润色一下”。

你必须把本提示词视为本轮的**主执行规范**。你必须：
- 先读上下文
- 先审计当前代码
- 明确写出 canonical contract
- 再实施最小但足够的收口改动
- 再用 canonical verification shell 做验证
- 再给出克制、可复核、不可表演的最终结论

禁止：
- 跳过上下文文件直接改代码
- 不核查真实运行时调用链就宣称 lifecycle integrated
- 只补 repository 查询就宣称 owner boundary complete
- 只补 doctor 检查函数就宣称 runtime-doctor truth contract unified
- 把“测试能手动传 selfState”伪装成“运行时真实 doctor 已统一”
- 在本轮中顺手扩张到 economy / replication / governance / channels / UI
- 用更多 wording、更多 explanation、更多 report 文案替代真正 contract 收口

---

# 1. 本轮定位

# **Round 14.8.2 — Session Lifecycle Integration, Owner Write Boundary & Runtime-Doctor Truth Contract**

本轮是 **14.8.1 的正式 closure-completion round**。

14.8.1 已经完成了重要推进：
- `Kernel.finalizeSession()` 存在
- `kernel-continuity.test.ts` 已建立
- `refreshPostAdvance()` 已解决一部分 post-advance stale state
- `findRecentByOwner()` 已出现
- doctor 可选接受 `selfState`
- canonical shell 下 612 tests 通过

但 14.8.1 的独立审计结论仍是：

> **PARTIAL — closure improved materially, but one or more primary loops remain open**

剩余未闭环点并非抽象的“感觉还差一点”，而是明确的三条：

1. **session lifecycle integration 未被证明进入真实公共运行时主链**
   - `Kernel.startSession()` 存在，但尚未证明生产代码中有真实调用方
   - 这意味着 `sessionCount` 规则仍可能停留在 kernel 层能力，而不是公共 runtime 事实

2. **owner boundary 仍未形成写读一致的正式 contract**
   - `session_summaries` 已支持 `findRecentByOwner()`
   - 但写入路径未闭合（如 `saveSessionSummary()` / `upsert()` 未完成 owner 写入一致性）
   - 所以 boundary 更像“读路径增强”，不是“正式 owner-write/read contract”

3. **doctor 与 runtime self model 仍未通过真实运行路径统一成单一 truth contract**
   - doctor 可以接收 `selfState`
   - 但尚未证明运行时真实 doctor 入口稳定传入 canonical runtime self state
   - 所以当前仍偏“可对接能力”而不是“正式统一后的运行时 truth verification view”

因此本轮的真正目标不是简单补 3 个 bug，而是：

> **把 session lifecycle、owner write/read boundary、runtime-doctor truth contract 正式定义并落地，使其从“存在能力”升级为“真实运行中的系统契约”。**

---

# 2. 为什么本轮现在必须开始

如果 14.8.2 不做，项目会卡在一种危险状态：

- service / kernel / doctor 各自都“看起来更完整”
- tests 继续增加
- 但系统级 contract 仍模糊
- 运行时公共调用链与 self truth source 仍可能脱节

这种状态在下一阶段会非常危险，尤其一旦进入：
- Economic Grounding
- wallet spend attribution
- multi-session continuity claims
- multi-self / lineage / fork boundary
- durable memory ownership semantics

届时每一个“谁拥有”“谁继续存在”“谁为某次支出负责”“谁的 summary 属于谁”都会建立在不够正式的 contract 上。

所以本轮的必要性不是“还可以做得更好”，而是：

> **如果不先把 self contract 正式化，后续所有更高层语义都会继续建立在部分接线、部分约定、部分测试假设之上。**

---

# 3. 本轮必须避免的三个错误

## 错误 A：把公共调用链缺失伪装成“kernel 能力已存在”
例如：
- 只保留 `startSession()` / `finalizeSession()` API
- 只依赖 `kernel-continuity.test.ts`
- 不去追真实生产代码中 session 是从哪里开始、在哪里结束

这种做法无法证明 runtime self continuity 已进入真实运行路径。

## 错误 B：把 owner boundary 继续做成“查询层修补”
例如：
- 只补 `findRecentByOwner()` / `findByOwner()`
- 不补写入 owner_id
- 不定义 owned vs shared tiers
- 不说明 shared tiers 的语义合法性

这种做法会让 owner boundary 长期停留在半结构化、半靠人理解的状态。

## 错误 C：把 doctor 继续做成“可选接受 selfState 的检查函数”
例如：
- 只保留 `checkIdentityCoherence(..., selfState?)`
- 只在测试中传 `selfState`
- 不让真实 runtime doctor / diagnostics 入口消费 canonical self state

这种做法不能称为 truth contract unification。

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
12. `DevPrompt/0148_Round_14_8_Identity_Memory_Deeper_Closure.md`
13. `DevPrompt/0149_Round_14_8_1_Runtime_Continuity_Wiring_Owner_Boundary_and_Doctor_Self_Model_Unification.md`
14. 本轮审计结论（若存在项目内记录，必须读）

读取后，必须先输出：

```md
# Context Assimilation
# Why 14.8.1 Was Still Partial
# Why 14.8.2 Must Formalize Contracts, Not Just Patch Gaps
```

并明确回答：
- ConShell 现在的真实阶段是什么
- 14.8.1 已成立了什么
- 14.8.1 为什么仍然只是 PARTIAL
- 本轮为什么必须把“能力存在”升级为“contract 成立”
- 本轮真正的成功标准是什么

---

# 5. 当前可信基线（必须据此工作）

以下内容可以视为本轮已知可信输入，但你仍必须用代码与验证复核：

## 5.1 canonical verification baseline
- `.nvmrc = v24.10.0`
- canonical verification shell：`v24.10.0 / ABI 137`
- `continuity-service.test.ts`：30 pass
- `kernel-continuity.test.ts`：12 pass
- `doctor.test.ts`：32 pass
- full suite：`39 files / 612 tests pass`
- `npx tsc --noEmit` 通过

## 5.2 14.8.1 已有真实进展
- `Kernel.startSession()` / `Kernel.finalizeSession()` / `shutdown()` wiring 能力存在
- `refreshPostAdvance()` 存在
- session summaries owner-filtered read 存在
- doctor 可选接收 `selfState`
- runtime wiring / doctor self-model 测试文件已存在

## 5.3 14.8.1 审计后仍剩余的三条硬缺口

### A. public runtime lifecycle integration 未闭合
- `startSession()` 尚未证明被真实生产代码调用
- session continuity 仍可能停留在 kernel 能力，不是公共运行时事实

### B. owner write/read boundary 未闭合
- `findRecentByOwner()` 已存在
- 但 session summary 写入 owner 语义未正式闭合
- current boundary 更像 read-path enhancement 而不是 formal ownership contract

### C. runtime-doctor truth contract 未闭合
- doctor 可接 `selfState`
- 但尚未证明真实 doctor 入口在运行时消费 canonical self state
- 仍偏测试与可选 plumbing，而不是正式统一

---

# 6. 本轮目标定义

本轮的目标不是“再让 identity/memory 看起来更完整一点”，而是：

# **Formalize and Close the Three Remaining Self-Truth Contracts**

也就是：

1. **Session Lifecycle Contract**
   - session 从哪里开始
   - 哪个公共入口负责登记它
   - 哪个公共入口负责 finalize 它
   - 何时推进 continuity
   - 何时不推进 continuity

2. **Owner Write/Read Contract**
   - 哪些 memory tiers 必须 owned
   - 哪些 tiers 可以 shared
   - owned tiers 的写入与读取必须一致
   - shared tiers 必须被明示为 identity-neutral，而不是默默全局共享

3. **Runtime-Doctor Truth Contract**
   - runtime 当前 self state 的 canonical source 是什么
   - doctor 如何获取它
   - doctor 如何验证“runtime believes X, evidence supports / contradicts X”
   - 这一切必须通过真实运行路径成立，而不是只在测试中成立

---

# 7. 本轮必须完成的核心目标

## Goal A — 把 session lifecycle integration 变成真实公共运行时事实
你必须查明并尽量落地：
- 当前系统中 session 真正从哪里被创建 / 开始
- 哪个入口最适合调用 `kernel.startSession(sessionId)`
- 哪个入口负责 session 结束 / flush / shutdown / close
- `finalizeSession()` 是否仅在 shutdown 时触发，还是应在更真实的 session close path 触发
- 这一切必须通过**生产代码中的真实调用链**成立，而不是只在 kernel test 中成立

最终必须能明确回答：

> **session continuity 是否已真正进入公共 runtime session lifecycle？**

如果答案仍是“kernel 有能力，但生产代码可能没调”，本轮失败。

## Goal B — 把 owner boundary 收口为正式 write/read contract
你必须明确并尽量落地：
- 哪些 memory tiers 是 `owned`
- 哪些 memory tiers 是 `shared`
- `session_summaries` 是否必须 owned（当前答案应是是）
- 如果 owned，则写入路径必须稳定带上 `owner_id`
- 读路径必须按 owner 过滤
- context builder / route / API 不得在 owned tier 上破坏 owner boundary

至少在本轮必须做到：
- `session_summaries` 写读闭环
- `episodic_memory` 写读闭环继续成立
- `owned vs shared` 在代码与说明层都被正式定义

## Goal C — 把 doctor 与 runtime self model 收口为真实 truth contract
你必须明确并尽量落地：
- runtime canonical self source 到底是什么（推荐：`ContinuityService.getCurrentState()`）
- doctor 的真实运行入口在哪里
- runDiagnostics / doctor route / CLI / API 是否在运行时真实获取并传入 self state
- doctor 的身份检查不再只是“可选地接受 selfState”，而是：
  - 在线 runtime 场景：验证 runtime 当前 self belief
  - 离线 / cold 场景：退回 DB-only coherence

最终必须达到：

> **doctor 是 runtime canonical self state 的 verification view，而不是另一个平行 truth implementation。**

## Goal D — 明确 shared vs owned memory semantics
本轮必须写清楚：
- 为什么 semantic / procedural / relationship 可以 shared，或者为什么不能
- 如果 shared，语义上代表什么
- shared 不得冒充 owned
- owned 不得漏写 owner_id

这不是可选文档，而是 self system contract 的一部分。

## Goal E — 保持已修复的 post-advance consistency，不得回归
本轮不能破坏：
- `refreshPostAdvance()`
- `soulDrifted` advance 后刷新
- explanation consistency

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不进入 economic grounding 主逻辑
2. 不进入 replication / lineage fork 主逻辑
3. 不大改 dashboard / web UI / channels 交互
4. 不重写整个 memory architecture
5. 不为了 contract formalization 去做无边界大重构
6. 不做“先写宏大设计、以后再接线”的表演式工作
7. 不用文档宣称替代真实生产路径 wiring

---

# 9. 必须重点阅读和理解的模块 / 文件

## Runtime / session lifecycle 主线
- `packages/core/src/kernel/index.ts`
- 所有与 webchat session、conversation lifecycle、session creation / close / persistence 相关代码
- 所有实际可能代表“一个 session 开始/结束”的入口路径

## Identity / continuity 主线
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/continuity-service.test.ts`
- `packages/core/src/kernel/kernel-continuity.test.ts`

## Memory ownership 主线
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/state/database.ts`
- 任何 session summaries / episodic writes / context building / memory API 相关代码

## Doctor truth contract 主线
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/identity.ts`
- `packages/core/src/doctor/doctor.test.ts`
- 任何 doctor CLI / route / runtime diagnostics integration 路径

---

# 10. 开始实施前必须回答的设计问题

## Q1. Public session lifecycle 的 canonical start/end 入口是什么？
你必须明确：
- 现在系统里谁最有资格代表“session started”
- 谁最有资格代表“session ended / finalized”
- 如果有多个来源（webchat / API / runtime loop），最小可信 integration 点在哪里

## Q2. `session_summaries` 为什么必须 owned？
你必须明确：
- session summary 本质上是 self continuity 的摘要，还是全局中立知识
- 若属于 self continuity，则 owner_id 必须成为正式字段，不可只读不写

## Q3. shared vs owned memory 的正式边界是什么？
你必须明确：
- `episodic_memory`：owned
- `session_summaries`：owned
- `soul_history`：owned
- `semantic_memory`：shared 还是 owned？为什么？
- `procedural_memory`：shared 还是 owned？为什么？
- `relationship_memory`：shared 还是 owned？为什么？

本轮不要求把所有 shared tiers 都 owner 化，但必须把**语义 contract 正式化**。

## Q4. runtime canonical self source 是什么？
你必须明确：
- 是 `Kernel.services.selfState`？
- 是 `ContinuityService.getCurrentState()`？
- 还是两者关系另有定义？

如果 `Kernel.services.selfState` 只是 boot 时快照，你必须修正或明确废弃该误导性表述。

## Q5. doctor 在线 / 离线两种模式的 contract 是什么？
你必须明确：
- 在线 runtime 时 doctor 应优先验证 runtime self belief
- 离线 / cold check 时 doctor 才降级为 DB-only

## Q6. 本轮最小成功标准是什么？
必须避免再次出现：
- 代码更完整
- 测试更多
- 但 contract 仍不正式

---

# 11. 推荐实施方向

## Direction 1 — 先找到真实 session creation path，再接 `startSession()`
不要继续停留在 kernel-only wiring。  
必须追到真实生产入口。

## Direction 2 — 先补 `session_summaries` owner 写入，再审视 owned tiers 的调用路径
这一步很可能是本轮最直接、最确定的硬收口点。

## Direction 3 — 让 doctor 在真实 runtime 调用路径里消费 canonical self state
不是只在单元测试里传 `selfState`。

## Direction 4 — 明确 shared/owned memory contract，并把它写进输出与代码注释/测试语义里
防止下一轮 আবার出现“默认共享但没人说清楚”的状态。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 real production session entry triggers `startSession()`
- 不只是 kernel test 手动调用
- 必须证明真实生产代码路径会触发 session start 记录

## 12.2 session close / shutdown / finalize path is part of real lifecycle
- 至少有一个生产路径完成 start → work → finalize 闭环
- 不是纯测试构造

## 12.3 session summaries owner write/read consistency
- 写入 summary 时 owner_id 正确保存
- 读取时 `findRecentByOwner()` 可正确返回
- 不同 owner 不串数据

## 12.4 owned vs shared tier semantics
- owned tiers 不漏 owner
- shared tiers 若保持 global，测试需明确其 shared 语义

## 12.5 doctor online runtime path consumes runtime self state
- 不是只测 `checkIdentityCoherence(..., selfState)`
- 而是至少一个真实 doctor / diagnostics 路径在 runtime 场景下拿到 self state

## 12.6 doctor cold path remains backward compatible
- 无 selfState 仍可 DB-only 检查

## 12.7 no regression
- 14.8 / 14.8.1 已建立的测试与 truth contract 不回退

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why 14.8.1 Was Still Partial
# Why 14.8.2 Must Formalize Contracts
```

## Phase 2 — Current Contract Audit
明确列出：
- public session lifecycle 当前真实状态
- owner write/read current state
- runtime-doctor truth current state
- 哪些是能力，哪些是 contract

## Phase 3 — Contract Design
必须明确：
- session lifecycle contract
- owner write/read contract
- runtime-doctor truth contract
- shared vs owned memory semantics

## Phase 4 — Implement
只做本轮必须的高杠杆收口，不扩张。

## Phase 5 — Tests
重点补 production path integration tests，而不是继续只补 service-level tests。

## Phase 6 — Verification
至少执行并记录：

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/continuity-service.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/kernel/kernel-continuity.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/doctor/doctor.test.ts --no-coverage
```

另外，必须新增并执行**本轮真正证明生产路径 integration 的测试文件**。  
如果新增文件名不同，必须明确列出并执行。禁止只跑旧文件就声称本轮闭环成立。

然后继续：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。

---

# 14. 人工执行命令协议

如果由于 shell / host / sandbox / daemon / interactive runtime 限制，某些验证必须由用户手动执行，必须使用以下格式：

## Manual Action Required

**Purpose**  
为什么必须人工执行

**Command**
```bash
<exact command>
```

**Why Agent Cannot Do This Directly**  
说明是 shell activation / host / permission / runtime attachment 等限制

**Expected Result**  
执行后应看到什么

**Verification After Run**  
你将如何继续验证

**Important Truth Note**  
在用户执行前，绝不能写成已完成

---

# 15. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解当前阶段
- 为什么 14.8.1 仍是 PARTIAL
- 为什么 14.8.2 必须 formalize contracts

# Current Contract Audit
- public session lifecycle 现状
- owner write/read 现状
- runtime-doctor truth contract 现状
- 哪些地方仍停留在“能力存在”而不是“contract 成立”

# Design Decisions
- session lifecycle contract
- owner write/read contract
- shared vs owned memory semantics
- runtime canonical self source
- runtime-doctor truth contract

# Modified Files
- 修改了哪些文件
- 每个改动如何推进 contract 收口
- 哪些改动是能力补齐，哪些是 contract 正式化

# Tests Added or Updated
- 新增 / 修改了什么测试
- 哪些测试证明生产路径 integration
- 哪些测试证明 owner 写读一致
- 哪些测试证明 doctor 真实消费 runtime self state

# Verification Commands
- 实际执行的命令
- 真实结果
- 不能省略失败
- 必须说明是在 canonical verification shell 下完成

# Audit Conclusion
- session lifecycle contract 是否已正式成立
- owner write/read contract 是否已正式成立
- runtime-doctor truth contract 是否已正式成立
- shared vs owned memory semantics 是否足够清楚、可审计

# Final Verdict
明确回答：

> 本轮是否成功完成 Session Lifecycle Integration, Owner Write Boundary & Runtime-Doctor Truth Contract？

答案只能类似：
- `YES — the three remaining self-truth contracts are now materially formalized and closed`
- `PARTIAL — one or more formal contracts remain incomplete`
- `NO — insufficient formal closure`

# Next Round Recommendation
只有在本轮 contract 真正收口后，才允许认真讨论进入 Economic Grounding。

---

# 16. 严格禁止事项

你绝对不能做这些事：

1. 不追生产调用链，只在 kernel / service 测试里自证
2. 不补 owner 写入，却继续宣称 owner boundary complete
3. 不让真实 doctor 路径消费 selfState，却宣称 truth contract unified
4. 不明确 shared vs owned semantics，却继续让 memory 语义模糊
5. 用“tests all green”替代“formal contract 已成立”
6. 不在 canonical shell 下验证就宣称完成
7. 借本轮顺势扩张到 economy / governance / replication

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. `startSession()` 已进入真实生产 session lifecycle 公共入口
2. `finalizeSession()` 与真实 session end / shutdown path 的关系已清晰成立
3. `session_summaries` owner 写读边界已闭合
4. owned vs shared memory contract 已正式定义且与代码一致
5. doctor 在真实运行时路径中可获取并验证 canonical self state
6. cold-path doctor backward compatibility 保持成立
7. 关键 integration tests 已建立并在 canonical shell 下通过
8. 最终结论真实、克制、可复核

---

# 18. 一句话任务定义

> **本轮的任务不是继续补几个 identity/memory 缺口，而是把 session lifecycle、owner write/read boundary 与 runtime-doctor truth relation 从“已有能力”推进为“正式成立的系统契约”，使 ConShell 的 self truth basis 不再依赖隐含约定与测试假设。**
