# Round 15.0.1 — Final Gap Closure, Documentation Reconciliation & Release Readiness

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“又多修了几个点”包装成“项目已准备好进入下一阶段”；禁止在文档、测试、运行时事实、对外表述不一致时宣称 ready；禁止绕过最终对账、最终验证、最终收口。  
> **本轮风格要求**：高压审计约束 + 精准实施协议 + 发布前收口视角。你不是来扩张能力，而是来做 **15 轮次开发后的最后查漏补缺 + 文档/实现/验证/结论对账 + readiness gate 收口**。

---

# 0. 强制执行声明

本轮不是新能力开发轮。  
本轮也不是“随手再优化一点”。

本轮是：

> **Round 15.0.1 — Final Gap Closure, Documentation Reconciliation & Release Readiness**

你必须把本提示词视为当前阶段的**最终收口协议**。你必须：
- 先读上下文与最近几轮 DevPrompt
- 先审计 15 轮次当前真实状态
- 明确列出剩余缺口
- 只做最后必要的高杠杆补漏
- 强制对账：代码 / 测试 / 文档 / audit 结论 / 对外表述
- 强制验证：canonical verification shell 下的完整验证链
- 最终给出**克制、可复核、可审计**的 readiness verdict

禁止：
- 新增与当前 closure 无关的能力
- 顺手推进 economy / replication / governance / UI / channels / growth
- 只修代码不修文档对账
- 只修文档不修运行时事实
- 用“full suite 绿了”替代“项目 readiness 已成立”
- 继续制造“局部能力存在，但对外表述写成系统闭环已成立”的不一致
- 忽略路径错误、文件不存在、命名漂移、汇报与仓内事实不一致的问题

---

# 1. 本轮定位

本轮是 **15 轮次开发完成后的最后查漏补缺开发轮**。  
它的职责不是继续推进主线，而是确保当前阶段不会带着未清点的事实债进入下个阶段。

也就是说，本轮要回答的不是：
- “还能做什么新东西？”

而是：
- “15 轮次真正完成了什么？”
- “还有哪些残留缺口没有收口？”
- “文档、代码、测试、审计结论是否一致？”
- “当前是否真的具备进入下一阶段的 readiness？”

---

# 2. 为什么 15.0.1 现在必须做

如果没有 15.0.1，项目很容易进入一种非常危险的阶段错觉：

- 代码已经堆到足够复杂
- 测试数量持续增长
- 文档也越来越多
- 审计轮次越来越密
- 但仍存在：
  - 文件路径错误
  - contract 文档缺失
  - 生产调用链未闭合
  - doctor / runtime / docs 三方表述不一致
  - “实现已存在”和“正式成立”混在一起

这种状态最大的风险不是 bug，而是：

> **团队会误以为自己已经准备好进入下一阶段，实际上仍在背着未清点的真相债。**

所以本轮的目标，是把当前阶段从：
- “大体可用”
推进到
- “已完成收口、可被审计地进入下一阶段”。

---

# 3. 本轮必须避免的四个错误

## 错误 A：把 15.0.1 当成普通 bugfix 轮
这会导致：
- 只修代码点
- 不做系统对账
- 不给最终 readiness verdict

## 错误 B：把 15.0.1 当成新功能轮
这会稀释目标，把“最后收口”重新变成“继续扩张”。

## 错误 C：只看测试，不看事实一致性
测试通过很重要，但这轮还必须对账：
- 仓内文件是否真的存在
- 文档是否真的指向正确路径
- 汇报是否真的与代码一致
- 审计指出的问题是否真的被收掉

## 错误 D：把 readiness 写成一种鼓励性话术
本轮最终 verdict 必须是：
- 真实的
- 可审计的
- 可反驳的
- 能被后续代码与命令验证的

不是鼓舞士气，不是项目庆典，不是“看起来差不多可以了”。

---

# 4. 开始前必须阅读的文件

在做任何实现、修补、验证之前，必须严格读取：

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
14. `DevPrompt/0150_Round_14_8_2_Session_Lifecycle_Integration_Owner_Write_Boundary_and_Runtime_Doctor_Truth_Contract.md`
15. 与 Round 15 直接相关的最新 DevPrompt / audit / walkthrough / 修复记录（若存在，必须全部读）

读取后，必须先输出：

```md
# Context Assimilation
# What Round 15 Actually Established
# What Still Remains Unreconciled
# Why 15.0.1 Is A Final Closure-and-Readiness Round
```

并明确回答：
- Round 15 当前真实阶段是什么
- 已经成立的 contract / runtime truths 有哪些
- 还有哪些残余缺口
- 当前最危险的不一致来自哪里
- 为什么本轮是“最后查漏补缺 + readiness gate”，而不是继续扩张

---

# 5. 当前可信基线（必须据此工作）

以下视为当前已知可信输入，但你仍必须复核：

## 5.1 canonical verification baseline
- `.nvmrc = v24.10.0`
- canonical verification shell：`v24.10.0 / ABI 137`
- 当前已出现的关键测试集合包括：
  - `continuity-service.test.ts`
  - `kernel-continuity.test.ts`
  - `agent-loop-lifecycle.test.ts`
  - `self-truth-contracts.test.ts`
  - `doctor.test.ts`
- full suite 最近一次可信结果：**627/627 pass**
- `npx tsc --noEmit` 通过

## 5.2 近期已明确推进的真实事项
- Session lifecycle 不再只是 kernel 能力，已接入 `AgentLoop.processMessage()`
- session summaries owner 写读边界已明显前进
- `Kernel.getDiagnosticsOptions()` 已出现，尝试作为 runtime-doctor truth contract 的桥
- 多轮审计已把“能力存在”和“contract 成立”的区分压得更明确

## 5.3 已被反复指出的风险类型
- 真实生产调用链未完全打通
- contract 文档路径/文件存在性与汇报不一致
- doctor 的运行时消费路径不一定真正成立
- 文档与实现之间的表述可能超前于仓内事实

---

# 6. 本轮目标定义

本轮的目标不是继续增加能力，而是：

# **Final Closure Before Stage Transition**

也就是同时完成四件事：

1. **剩余实现缺口收口**
2. **剩余 contract 缺口收口**
3. **文档 / 代码 / 测试 / 审计结论对账**
4. **给出最终 readiness verdict**

你必须把当前项目视为一个正在接受最终阶段审计的系统，而不是一个还在随意生长的实验仓库。

---

# 7. 本轮必须完成的核心目标

## Goal A — 列出并收掉 15 轮次剩余的真实缺口
你必须先明确列出当前剩余缺口，至少覆盖：
- 生产路径 integration 是否还有未闭环处
- doctor / diagnostics 真实消费路径是否还有断点
- 文档声称存在但仓内不存在的文件/路径
- contract 文档是否缺失或放错位置
- README / docs / DevPrompt / 审计结论之间是否存在表述漂移

原则：

> **本轮先做“剩余缺口清单”，再做补漏，禁止边看边猜、边改边编。**

## Goal B — 对账 contract 文档与真实实现
你必须明确并修正：
- 哪些 contract 文档应该存在
- 它们实际应该放在哪
- 仓内是否真的有这些文件
- 文档里的描述是否与代码一致
- 是否存在“文档声称 closed，但代码只实现了 partial”的情况

尤其要检查：
- ownership contract 文档
- identity / continuity / doctor 相关 contract 说明
- README / docs/audit / docs/project 中对当前状态的表述

## Goal C — 最终校验 doctor / runtime / audit 三方口径统一
你必须确认：
- runtime 当前 self truth 是什么
- doctor 当前验证的对象是什么
- audit 当前如何描述它们
- 三者是否已经对齐

如果没有对齐，本轮必须修正。  
因为这会直接决定项目是否能安全进入下一阶段。

## Goal D — 建立发布前 / 阶段切换前 readiness gate
本轮必须形成一套明确 gate，至少包含：
- canonical verification shell 对齐
- typecheck 通过
- targeted tests 通过
- full suite 通过
- 关键 contract 文档存在且内容与实现一致
- 关键 production path 已真实接通
- 审计结论与仓内事实无冲突

## Goal E — 输出“可进入下一阶段 / 不可进入下一阶段”的最终结论
不能只输出“修了什么”，必须输出：
- 当前 readiness verdict
- 还剩哪些 blocking items（如果有）
- 若 ready，ready 的边界是什么
- 若 not-ready，缺什么

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止：

1. 不进入新的大能力轮
2. 不扩张 economy / replication / multi-agent governance
3. 不做大规模架构重写
4. 不为了“显得完整”而发散重构
5. 不新增与 readiness 无关的 abstraction
6. 不写漂亮但不约束行为的文档
7. 不把“未来应该做什么”混进“本轮已完成什么”

---

# 9. 必须重点阅读和检查的模块 / 文件

## Runtime / identity / continuity / doctor 主线
- `packages/core/src/kernel/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/identity.ts`

## Memory / ownership / contract 主线
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/database.ts`
- 所有 ownership / contract 文档

## 验证与审计主线
- `packages/core/src/doctor/doctor.test.ts`
- `packages/core/src/kernel/kernel-continuity.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`
- `README.md`
- `docs/audit/*`
- `docs/project/*`
- `docs/planning/*`

---

# 10. 开始实施前必须回答的设计问题

## Q1. 当前阶段切换前真正的 blocking items 是什么？
你必须明确：
- 哪些是 cosmetic
- 哪些是 important but non-blocking
- 哪些是 release/readiness blocking

## Q2. 现在最危险的不一致在哪？
你必须明确：
- 是代码 vs 文档？
- 是 runtime vs doctor？
- 是 audit verdict vs 仓内事实？
- 是路径错误 / 文件不存在？

## Q3. 哪些 contract 已经可以视为正式成立？
你必须明确列出：
- 已 closed
- 仍 partial
- 尚未开始 formalize

## Q4. readiness gate 的最小通过条件是什么？
必须明示，避免最后又出现“感觉差不多可以”。

## Q5. 如果本轮结束后仍不 ready，最小剩余清单是什么？
这能防止输出一种模糊的“还差一些”。

---

# 11. 推荐实施方向

## Direction 1 — 先做 gap ledger，再动手修
先列出剩余缺口，不要直接补。  
防止遗漏和重复劳动。

## Direction 2 — 先修阻塞性不一致，再修叙述性问题
例如：
- 文件不存在
- 路径错误
- 生产调用链缺失
- runtime/doctor truth mismatch
这些优先级高于文案润色。

## Direction 3 — 文档必须服务于真实 contract，而不是粉饰当前状态
如果实现仍 partial，文档就必须写 partial，不得超前。

## Direction 4 — readiness 结论必须由 gate 推出，而不是由情绪推出
所有 ready / not-ready / partial 的结论必须能回指到明确证据。

---

# 12. 本轮必须新增或强化的测试 / 检查

至少覆盖以下类型：

## 12.1 production path integration checks
- 关键生产路径是否真实接线
- 不是只存在 API / helper / test-only wiring

## 12.2 contract doc existence / path correctness
- 若某份 contract 文档是 blocker，必须检查其存在性与正确位置
- 必要时补充自动化检查或至少在测试/doctor/audit 中有明确 evidence

## 12.3 runtime-doctor-audit consistency
- doctor 读到的 self truth
- runtime 当前 self state
- audit 对它们的表述
必须一致

## 12.4 no regression
- 已建立的 targeted tests 不回退
- full suite 不回退
- tsc 不回退

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# What Round 15 Actually Established
# What Still Remains Unreconciled
# Why 15.0.1 Is A Final Closure-and-Readiness Round
```

## Phase 2 — Gap Ledger
必须先列出：
- Blockers
- Important but non-blocking issues
- Cosmetic / wording issues

## Phase 3 — Contract & Documentation Reconciliation
逐项对账：
- 文件存在性
- 正确路径
- 文档与实现一致性
- 审计表述与代码一致性

## Phase 4 — Implement Final Fixes
只修本轮真正必要的缺口。  
禁止范围蔓延。

## Phase 5 — Tests & Verification
先跑 targeted tests，再跑 full suite，再跑 typecheck。  
所有结果必须真实记录。

## Phase 6 — Release Readiness Verdict
基于 gate 给出最终 verdict，而不是基于主观印象。

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/agent-loop-lifecycle.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/continuity-service.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/kernel/kernel-continuity.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/doctor/doctor.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

如果本轮新增了额外的 readiness / reconciliation 测试，也必须点名执行。  
所有验证必须在 canonical verification shell 下完成。

---

# 15. 人工执行命令协议

如果因为 shell / host / sandbox / daemon / interactive runtime 限制，需要用户手动执行某步，必须使用以下格式：

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
- 如何理解 15 轮次当前状态
- 为什么需要 15.0.1

# Gap Ledger
- Blockers
- Important but non-blocking
- Cosmetic / wording

# Reconciliation Decisions
- 文档与实现如何对账
- 哪些 contract 已正式成立
- 哪些仍 partial
- 哪些文件被修正 / 新增 / 移动 / 删除

# Modified Files
- 改了哪些文件
- 每项改动的作用
- 是修 blocker、修 contract、还是修叙述一致性

# Tests Added or Updated
- 新增/修改了什么测试或检查
- 它们保护什么 readiness 条件

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Readiness Gate
- 哪些条件通过
- 哪些条件未通过
- 当前 ready / conditionally ready / not ready 的证据

# Final Verdict
明确回答：

> 15 轮次在经过 15.0.1 的最后查漏补缺后，是否已达到可进入下一阶段的状态？

答案只能类似：
- `YES — final gaps closed, documentation reconciled, and stage-transition readiness established`
- `PARTIAL — major closure achieved, but one or more readiness blockers remain`
- `NO — insufficient closure for stage transition`

# Next Round Recommendation
如果 ready，说明下一阶段应如何开始；如果不 ready，列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不列 gap ledger 直接开始改代码
2. 不做文档对账就宣称 ready
3. 不核查文件存在性就复述 walkthrough
4. 不区分 blocker 与非 blocker
5. 用“测试都绿了”替代“stage-transition readiness 已成立”
6. 在本轮偷偷扩张新能力
7. 输出一种无法被代码和命令回溯的 readiness 结论

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 15 轮次剩余 blocker 已被明确列出并处理或真实保留
2. 文档 / 代码 / 测试 / audit 结论已完成对账
3. 关键 contract 文档存在且路径正确
4. 关键 production path 已真实接通
5. targeted tests + full suite + tsc 全部通过
6. readiness gate 明确、可复核
7. 最终 verdict 克制、真实、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续生长系统，而是对 15 轮次当前成果做最后一次面向阶段切换的查漏补缺、事实对账与 readiness 收口，确保项目进入下一阶段时不再背着未清点的真相债。**
