# Round 14.7 — Foreign Runtime Rejection Closure & Deterministic Verification Mode

> **用途**：直接交给下一轮开发 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止弱化约束、禁止为了盲目扩张忽略当前现实问题，也禁止围绕单点问题无限打转而不产出系统收益。

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
- 跳过上下文文件
- 跳过验证
- 只挑“更大更炫”的能力做
- 只围绕单点问题机械修补却不形成系统收益
- 基于旧叙事、旧阶段判断继续推进

---

# 1. 本轮的平衡原则

ConShell 当前面临的真实情况不是“只要继续扩张就会变强”，也不是“只能一直修底层问题”。

你必须同时避免两个错误：

## 错误 A：放着现有问题不解决直接扩张开发
例如：
- current shell 与 pinned runtime 分叉还没闭环
- foreign-runtime rejection 逻辑/测试还不一致
- 但继续推进更高层能力（经济/复制/更复杂自治）

## 错误 B：一味死磕单点问题
例如：
- 把全部开发变成 endless test whack-a-mole
- 不产出更稳定的验证模式与更清晰的 truth contract
- 修了局部，但没有给后续轮次降低复杂度

因此本轮的正确目标是：

> **用最小必要工作，彻底收口一个会污染全局可信度的关键问题，并同时建立一个对后续所有轮次都有收益的 deterministic verification mode。**

---

# 2. 你的角色

你不是普通代码助手，也不是来“继续往生命体方向堆更多功能”。

你是一个**高可信工程执行代理**。你的职责是：

> **基于 Round 14.6 审计结果，修复 Doctor 对 foreign-runtime evidence 的拒绝逻辑/测试不一致问题，并建立一个可复现、可解释、可审计、可对比 current shell 与 pinned runtime 的 deterministic verification mode。**

你必须始终记住：
- 这个项目不是普通 chat app
- 这个项目不是单纯 CLI / dashboard
- 这个项目不是 agent feature 拼盘
- 当前最关键的高优先级不是功能扩张，而是**truth kernel 收口**

---

# 3. 开始前必须阅读的文件

在做任何分析、设计、实现之前，你必须严格按以下顺序读取：

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
12. `DevPrompt/0146_Round_14_6_Runtime_Truth_Reconciliation_and_Pinned_Verification_Closure.md`

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：
- ConShell 真正是什么
- 当前已经推进到了哪个阶段
- 14.6 真实推进了什么
- 14.6 审计后还没收口的 truth problem 是什么
- 为什么本轮不能盲目扩张，也不能无意义死磕
- 为什么本轮应该做 foreign-runtime rejection closure + deterministic verification mode

---

# 4. 当前轮次基线（必须据此工作）

以下内容视为本轮可信输入基线，但你仍需在代码和运行层面对账，不允许只复述。

## 4.1 当前项目阶段定位
当前 ConShell 的最准确阶段判断是：

> **Viable Sovereign Runtime Core + Early Runtime Truth Kernel Layer + Early Self-Continuity Runtime Layer**

这意味着：
- runtime integrity / doctor / continuity 已是系统主线
- 但 verification truth 仍未完全 deterministic
- 还不适合大步扩张更高层能力

## 4.2 Round 14.6 已真实推进的内容
Round 14.6 已在代码层真实引入：
- `VerificationContext`
- `RuntimeAlignmentStatus`
- `buildVerificationContext()`
- `IntegrityReport.verificationContext`
- `formatReport()` 中的 `VERIFICATION CONTEXT` 段

## 4.3 Round 14.6 审计后的关键现实
上一轮独立审计确认：

### 已成立
- verification context 已成为 Doctor 的一等对象
- 报告能明确表达 current/pinned/evidence runtime

### 未闭环
- `doctor.test.ts` 中这两个关键断言仍失败：
  - rejects vitest evidence from foreign runtime
  - rejects tsc evidence from foreign runtime
- current shell 与 pinned runtime 结果仍可能分叉
- truth closure 还不是完全 deterministic

---

# 5. 本轮目标定义

本轮不是继续推进更高层能力，也不是无限围绕所有 sqlite/ABI 问题打转。

本轮的最优目标是：

# **Round 14.7 — Foreign Runtime Rejection Closure & Deterministic Verification Mode**

也就是：

> **彻底修复 Doctor 对 foreign-runtime evidence 的拒绝逻辑/测试不一致问题，并建立一个清晰、稳定、对审计者友好的 deterministic verification mode，使 current shell truth 与 pinned runtime truth 的关系变得可重复、可对比、可审计。**

---

# 6. 为什么本轮应该做这个

## 6.1 为什么不是继续扩张高层能力
因为如果 foreign-runtime rejection 仍不可靠，那么：
- Runtime truth kernel 仍有裂缝
- 高层能力的验证仍可能建立在错误 acceptance 上
- 审计和开发会继续出现“都说自己对，但 runtime 语境不同”的问题

## 6.2 为什么不是继续无休止追打所有 ABI 问题
因为当前最有系统杠杆的问题不是“把所有 Node 版本问题一次性灭掉”，而是：

> **让系统明确知道：它现在在什么 runtime 下验证，哪些 evidence 是 foreign 的，哪些验证结论可以成立，哪些不能。**

换句话说：
- 当前需要的是 **truth contract 收口**
- 而不是“把所有底层环境问题永远扫干净后再做别的”

## 6.3 为什么这会给下一阶段创造条件
一旦本轮收口成功：
- 后续轮次的验证报告会更可信
- agent 不会再混淆 current shell 与 pinned runtime
- 下一轮就更有资格进入 Identity/Memory deeper closure 或 Economic Grounding 准备

---

# 7. 本轮必须完成的核心目标

## Goal A — 彻底查明并修复 foreign-runtime rejection 失败原因
你必须找到并修复以下问题的真实根因：

- 为什么 `doctor.test.ts` 里 foreign runtime 的 `vitest` evidence 仍是 `pass`
- 为什么 `doctor.test.ts` 里 foreign runtime 的 `tsc` evidence 仍是 `pass`

你必须明确判断，是：
1. `checkExecutionEvidence()` 的 runtime mismatch 判定有 bug
2. runtime identity comparison helper 有 bug
3. fallback / backwards-compat 逻辑误吞 mismatch
4. 测试断言与实现设计漂移
5. 以上之一或组合

## Goal B — 建立 deterministic verification mode
本轮必须让系统能更稳定地表达：

- current shell truth
- pinned runtime truth
- evidence runtime truth
- deterministic verification result

至少要让审计者能清楚知道：
- 当前结论是不是当前 shell truth
- 还是 pinned runtime truth
- 还是仅有 evidence-level truth

## Goal C — 明确验证模式的输出语义
你需要决定并落地：

- `deterministic` 模式下输出什么
- 当 current shell ≠ pinned runtime 时怎么表达
- 是否输出明确 status / mode / explanation

重点不是花哨命名，而是：

> **以后任何审计者都不需要猜“这个 green 是在哪个 runtime 下成立的”。**

## Goal D — 为下一阶段创造稳定底座
本轮的成果必须对后续轮次有直接收益：

- 后续提示词更短但更准
- 审计不再反复纠缠同一个 runtime truth split
- 当前项目有资格进入下一层闭环（而不是重复打补丁）

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不继续扩张高层生命体能力
2. 不推进经济闭环主逻辑
3. 不做 dashboard / UI 大改
4. 不做 channel 广度扩张
5. 不做 replication runtime
6. 不做 lineage runtime 主逻辑深化
7. 不写大量新文档替代代码修复
8. 不无限追打所有环境问题
9. 不弱化 Doctor 逻辑来换取表面 green
10. 不把“deterministic verification mode”做成只有文案没有真实语义的输出层

---

# 9. 必须阅读和理解的模块文件

在完成根目录级阅读后，至少继续阅读并理解以下模块：

## Doctor / verification / runtime identity
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/checks/tests.ts`
- `packages/core/src/doctor/checks/env.ts`
- `packages/core/src/doctor/doctor.test.ts`

## runtime context helpers
- 所有 `computeRuntimeIdentity()` / verification context / evidence alignment 相关 helper

## continuity/runtime 相关（用于理解后续影响）
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/kernel/index.ts`

## config / runtime pinning
- 根目录 `.nvmrc`
- `package.json`
- `packages/core/package.json`
- `packages/core/vitest.config.ts`
- 根 `vitest.config.ts`

---

# 10. 开始实现前必须回答的设计问题

## Q1. foreign-runtime rejection 的 canonical rule 是什么？
你必须明确：
- 哪些字段 mismatch 时必须 reject
- 哪些字段缺失时允许 backward compatibility
- reject 与 warn 的边界是什么

## Q2. deterministic verification mode 的最小输出契约是什么？
你必须明确：
- 当前 shell 是什么
- pinned runtime 是什么
- evidence runtime 是什么
- 当前结果属于哪种 truth

## Q3. 什么时候应该停在“truth closure”，而不是继续扩张？
你必须明确本轮完成标准，让系统在本轮结束后真正减少未来歧义，而不是只多几个状态名。

---

# 11. 推荐实现方向

## Direction 1 — 修 `checkExecutionEvidence()` / mismatch 判定链
重点检查：
- 当前 foreign runtime mismatch 为什么没触发 reject
- ABI-only mismatch 为什么能触发，而 nodeVersion+nodeAbi mismatch 却没触发
- 是否存在 comparison ordering / fallback precedence 问题

## Direction 2 — 建立 deterministic verification result 结构
必要时可新增更清晰的结构，例如：
- `verificationMode`
- `truthScope`
- `verificationRuntimeKind`

只要能让最终报告与后续审计稳定理解即可。

## Direction 3 — 保持最小必要改动
本轮要的是：
- 解决一个关键 truth kernel 问题
- 顺便建立一个稳定验证模式

不是重写 doctor 子系统，不是把 verification 模型复杂化到难以维护。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 foreign vitest evidence rejection
- nodeVersion/nodeAbi/platform/arch 明显 foreign
- 必须 reject

## 12.2 foreign tsc evidence rejection
- 同上
- 必须 reject

## 12.3 backward compatibility path
- 没 runtime fields 的旧 evidence
- 仍可被 accept（若这是设计）

## 12.4 current vs pinned deterministic expression
- report / result 能表达当前 truth scope

## 12.5 no regression
- 不能破坏现有 VerificationContext / formatReport / Doctor 报告上下文

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Current Round Baseline
# Why Round 14.7 Must Close Truth, Not Blindly Expand
```

## Phase 2 — Current Truth Audit
你必须明确列出：
- 当前 shell runtime
- pinned runtime
- foreign-runtime rejection 当前为什么失败
- deterministic verification 当前为什么还不够稳定

## Phase 3 — Design
你必须明确设计：
- canonical foreign-runtime rejection rule
- deterministic verification mode 的输出契约
- current/pinned/evidence 的关系如何表达

## Phase 4 — Implement
只做最小必要改动，解决 truth kernel 裂缝。

## Phase 5 — Tests
补齐关键测试，并确保 foreign-runtime rejection 被真实保护。

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

如果需要 pinned runtime 或人工动作，也必须明确列出。

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
解释限制来源

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
- 为什么本轮不能盲目扩张也不能无意义死磕

# Current Truth Audit
- current shell runtime
- pinned runtime
- foreign-runtime rejection 当前失败点
- deterministic verification 当前缺口

# Design Decisions
- foreign-runtime rejection 规则
- deterministic verification mode 契约
- current/pinned/evidence runtime 表达语义

# Modified Files
- 每个文件改了什么
- 为什么改
- 它在 truth closure 中的作用

# Tests Added or Updated
- 补了什么测试
- 每个测试保护什么 truth contract

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 runtime 是否与 `.nvmrc` 对齐

# Audit Conclusion
- foreign-runtime rejection 是否收口
- deterministic verification mode 是否成立
- 本轮如何既避免盲目扩张，又避免无意义死磕

# Final Verdict
明确回答：

> 本轮是否成功建立 Foreign Runtime Rejection Closure & Deterministic Verification Mode？

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
2. 放着当前 truth problem 不解决去做更高层扩张
3. 反过来无休止围绕单点问题打转却不形成系统收益
4. 用“未来生命体目标”掩盖当前 runtime truth 裂缝
5. 不跑验证命令就宣称成功
6. 让审计者继续猜“这个结果到底在什么 runtime 下成立”
7. 用新文档替代代码闭环
8. 弱化 rejection 逻辑换取表面 green

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 根目录上下文已被真正吸收
2. foreign-runtime rejection 逻辑/测试重新对齐
3. deterministic verification mode 形成稳定输出契约
4. current/pinned/evidence truth 关系对审计者清晰可见
5. 测试保护了这套 truth contract
6. 验证命令已真实执行
7. 输出结论真实、克制、可审计

---

# 18. 一句话任务定义

> **本轮的任务不是继续把 ConShell 做得更大，而是把一个会持续污染所有后续轮次判断的 truth-kernel 裂缝彻底收口。**
