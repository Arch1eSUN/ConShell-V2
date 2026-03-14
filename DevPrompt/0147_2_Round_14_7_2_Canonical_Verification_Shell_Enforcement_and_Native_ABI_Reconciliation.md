# Round 14.7.2 — Canonical Verification Shell Enforcement & Native ABI Reconciliation

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止把非当前 shell 的结果写成当前事实、禁止继续高层扩张、禁止用“报告说通过”替代“当前独立审计已通过”。

---

# 0. 强制执行声明

你必须把本提示词视为本轮的**主执行规范**。

你必须：
- 完整阅读
- 完整理解
- 严格执行
- 只基于实际工具输出汇报
- 严格区分代码事实 / 当前 shell 事实 / 他人报告 / 推断

禁止：
- 直接接受上一轮 14.7.1 报告
- 跳过 runtime 对账
- 在 canonical verification shell 未建立前进入 14.8
- 用宽松解释掩盖当前 shell 与 `.nvmrc` 的分叉
- 通过跳过 native tests / 弱化标准来换取表面 green

---

# 1. 本轮定位

本轮不是 14.8。  
本轮是：

# **Round 14.7.2 — Canonical Verification Shell Enforcement & Native ABI Reconciliation**

本轮的目标不是新增功能，而是：

> **把当前主审计 shell 强制对齐到 canonical verification shell，并修复 native ABI 分叉，使 Doctor 与 full suite 的验证结果最终可以在同一个当前 shell 中独立复核。**

当前已知现实：
- 14.7.1 报告声称 current shell = pinned runtime = `v24.10.0`
- 但独立审计 shell 实测仍是 `v25.7.0`
- `doctor.test.ts` 当前独立复核结果仍是 `28 tests | 5 failed`
- full suite 当前独立复核仍是 `581 tests | 72 failed`
- sqlite / `better-sqlite3` 仍存在 ABI mismatch：`137` vs `141`

因此本轮要解决的不是“要不要继续辩论谁对”，而是：

> **把 canonical verification shell 建立为一个当前可进入、可重复、可独立复核的真实环境。**

---

# 2. 当前必须避免的两个错误

## 错误 A：继续接受“别的 shell 的绿灯”
例如：
- 报告说 `v24.10.0` 全绿，就直接当成当前事实
- 不去确认当前主审计 shell 到底是不是该环境

## 错误 B：环境修复无边界扩散
例如：
- 无限清缓存 / 无限 reinstall / 无限 rebuild
- 不先确认 canonical shell
- 不分清 Node shell 问题和 native ABI 问题

本轮必须做到：
- 先建立 canonical verification shell
- 再做 native ABI reconciliation
- 再用同一个 shell 重跑 doctor 与 full suite

---

# 3. 开始前必须阅读的文件

在做任何修复或验证之前，必须严格按以下顺序读取：

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
12. `DevPrompt/0147_Round_14_7_Foreign_Runtime_Rejection_Closure_and_Deterministic_Verification_Mode.md`
13. `DevPrompt/0147_1_Round_14_7_1_Audit_Closure_Environment_Reconciliation_and_Verification_Recovery.md`

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：
- ConShell 真正是什么
- 当前项目处于哪个阶段
- 为什么 14.7 / 14.7.1 仍未在当前独立审计 shell 中闭环
- 为什么本轮必须建立 canonical verification shell
- 为什么本轮不是 14.8

---

# 4. 当前可信基线（必须据此工作）

以下内容视为本轮已知可信输入，但你必须继续复核：

## 4.1 已知当前独立审计 shell 事实
独立审计已观察到：
- `node=v25.7.0`
- `which node=/opt/homebrew/bin/node`
- `.nvmrc=v24.10.0`
- `doctor.test.ts`：`28 tests | 5 failed`
- full suite：`581 tests | 72 failed`

## 4.2 已知当前关键失败点
### Doctor 层
- foreign-runtime rejection 两个测试仍失败
- verificationMode 三个测试仍失败（因为当前 shell 实际是 misaligned）

### Native 层
- `better-sqlite3` 编译目标仍是 `NODE_MODULE_VERSION 137`
- 当前 shell 需要 `141`
- 产生大面积 sqlite 相关测试失败

## 4.3 已知环境改善但未闭环的事实
当前与前一轮相比，至少可以确认：
- `node_modules/tinypool` 存在
- `vitest` 现在能启动

但这不等于：
- canonical shell 已建立
- full suite 已在当前 shell 独立通过

---

# 5. 本轮目标定义

本轮的最优目标是：

# **Canonical Verification Shell Enforcement & Native ABI Reconciliation**

也就是：

> **确定并进入唯一的 canonical verification shell（应与 `.nvmrc` 对齐），并在该 shell 中修复 native ABI 分叉，使 Doctor 与 full suite 的结果能够在当前独立审计环境中真正复核。**

---

# 6. 本轮必须完成的核心目标

## Goal A — 明确 canonical verification shell
你必须回答：
- 当前项目的 canonical verification shell 是否仍然是 `.nvmrc = v24.10.0`
- 当前主审计 shell 为什么没有进入它
- 如何在当前工作流中进入并固定到这个 shell

## Goal B — 在同一 shell 中完成 runtime alignment
你必须让当前验证链在一个明确的 shell 中运行，并确认：
- `node -v`
- `process.execPath`
- `process.versions.modules`
- `.nvmrc`
- 当前 shell 是否真正 aligned

## Goal C — 修复 native ABI 分叉
你必须解决：
- `better-sqlite3` compiled against `137`
- current aligned shell 所需 ABI

你必须查明是否需要：
1. 在 pinned runtime 下重装依赖
2. 重建 native module
3. 清理旧安装状态
4. 以上组合

## Goal D — 在 canonical shell 下重新独立验证
至少必须重跑：
- `doctor.test.ts`
- `vitest run --no-coverage`

并明确回答：
- foreign-runtime rejection 是否仍失败
- verificationMode 是否仍失败
- sqlite 相关测试是否恢复

## Goal E — 把“当前 shell / 报告 shell / canonical shell”统一成一个真实可审计结论
本轮完成后，必须让后续审计不再出现：
- “报告是另一个 shell 的结果”
- “当前 shell 不是 pinned 但报告写成 aligned”
- “native ABI 状态与 shell 不匹配”

---

# 7. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不进入 14.8 identity deeper closure
2. 不进入 economic grounding 主逻辑
3. 不继续扩 UI / channel / browser / nodes
4. 不扩 Doctor 新抽象层
5. 不把本轮变成大规模 repo 重构
6. 不通过禁用 sqlite 相关测试来换取表面 green
7. 不接受“另一个 shell 跑过了就算当前完成”

---

# 8. 必须阅读和理解的模块 / 文件

## Doctor / 验证主线
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/doctor.test.ts`
- `packages/core/src/doctor/checks/tests.ts`
- `packages/core/src/doctor/checks/env.ts`

## Native / state / sqlite 相关
- `packages/core/src/state/database.ts`
- `packages/core/src/state/repos/sessions.test.ts`
- `packages/core/src/state/repos/spend.test.ts`
- `packages/core/src/identity/anchor.test.ts`
- `packages/core/src/identity/coherence.test.ts`
- `packages/core/src/identity/continuity-service.test.ts`
- `packages/core/src/channels/webchat/conversation-service.test.ts`

## 配置 / runtime
- `.nvmrc`
- `package.json`
- `packages/core/package.json`
- `vitest.config.ts`
- `packages/core/vitest.config.ts`
- `pnpm-lock.yaml`

---

# 9. 开始实施前必须回答的设计问题

## Q1. 当前 canonical verification shell 应该如何进入？
你必须明确：
- 是否需要 `nvm use`
- 是否需要显式使用某个 node 路径
- agent 当前 shell 为什么没有自动对齐 `.nvmrc`

## Q2. Native ABI reconciliation 的最小动作是什么？
你必须判断：
- 只 rebuild `better-sqlite3` 是否够
- 还是必须在 aligned shell 下重新 install
- 还是需要清理 node_modules 后重装

## Q3. 本轮最小成功标准是什么？
至少必须定义：
- 当前 shell 真正 aligned
- `doctor.test.ts` 独立通过
- full suite 是否必须通过，还是可接受部分未闭环

原则：
> **至少恢复一个“同一 shell 下可信且一致”的验证面。**

---

# 10. 推荐实施方向

## Direction 1 — 先强制进入 canonical verification shell
建议首先检查并明确：
- `which node`
- `node -v`
- `node -p process.execPath`
- `echo $PATH`
- `cat .nvmrc`
- 是否存在 `~/.nvm/versions/node/v24.10.0/bin/node`

如果 agent 无法直接切换当前宿主 shell，也必须明确产出人工命令。

## Direction 2 — 在 canonical shell 中重建 native 模块
重点不是“当前 shell 下继续试”，而是：

> **必须在真正 aligned 的 shell 中处理 native install / rebuild。**

## Direction 3 — 重新跑 Doctor 与 full suite
如果 canonical shell + native ABI 已对齐：
- 重跑 `doctor.test.ts`
- 重跑 full suite
- 检查 foreign-runtime rejection 是否仍失败
- 检查 verificationMode 是否恢复到预期

---

# 11. 本轮必须拿到的证据

至少需要以下证据：

## 11.1 Shell identity evidence
- current shell node version
- current shell node path
- current shell ABI
- `.nvmrc`

## 11.2 Canonical shell evidence
- canonical shell 是否存在
- agent 是否进入该 shell
- 若不能进入，为什么不能

## 11.3 Native ABI evidence
- `better-sqlite3` 当前 ABI 绑定状态
- rebuild / reinstall 后状态
- sqlite 测试是否恢复

## 11.4 Doctor truth evidence
- foreign-runtime rejection tests 是否恢复
- verificationMode tests 是否恢复

---

# 12. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why Round 14.7.2 Exists
# Why Canonical Verification Shell Must Be Enforced
```

## Phase 2 — Shell Truth Audit
必须明确列出：
- current shell
- report shell（若可确认）
- canonical shell
- current shell 为什么不是 canonical shell

## Phase 3 — Alignment Plan
必须明确：
- 如何进入 canonical shell
- 如何处理 native ABI
- 为什么这套动作是最小必要动作

## Phase 4 — Implement Minimal Environment Fixes
只做最小必要环境动作，不扩大到功能开发。

## Phase 5 — Verification
至少执行：

```bash
cd /Users/archiesun/Desktop/ConShellV2 && which node
cd /Users/archiesun/Desktop/ConShellV2 && node -v
cd /Users/archiesun/Desktop/ConShellV2 && node -p process.execPath
cd /Users/archiesun/Desktop/ConShellV2 && node -p process.versions.modules
cd /Users/archiesun/Desktop/ConShellV2 && cat .nvmrc

cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run src/doctor/doctor.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run --no-coverage
```

如果需要在 aligned shell 中额外执行 install / rebuild，也必须完整记录。

---

# 13. 人工执行命令协议

如果因为：
- agent 无法切换宿主 shell
- `nvm` 只在交互 shell 生效
- 需要用户显式进入 `v24.10.0`
- 需要人工执行 rebuild / reinstall

则必须用以下格式：

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

# 14. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解项目与当前阶段
- 为什么本轮不是 14.8

# Shell Truth Audit
- current shell
- report shell（若可确认）
- canonical shell
- 为什么当前 shell 不等于 canonical shell

# Alignment & ABI Decisions
- 如何强制进入 canonical shell
- 如何处理 native ABI
- 为什么这些动作是最小必要动作

# Modified Files / Environment Changes
- 改了哪些环境状态或文件
- 每项改动的作用
- 是否影响代码结构 / 功能逻辑

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须明确当前验证到底在哪个 shell 下成立

# Audit Conclusion
- canonical verification shell 是否建立
- native ABI 是否 reconciled
- doctor 与 full suite 是否在同一 shell 下通过
- 还剩哪些问题

# Final Verdict
明确回答：

> 本轮是否成功完成 Canonical Verification Shell Enforcement & Native ABI Reconciliation？

答案只能类似：
- `YES — canonical verification shell established and validation recovered`
- `PARTIAL — shell clarified but ABI/validation not fully recovered`
- `NO — independent verification still fragmented`

# Next Round Recommendation
只有在 canonical shell 与 native ABI 都收口后，才允许进入 14.8 或更高层能力。

---

# 15. 严格禁止事项

你绝对不能做这些事：

1. 跳过 shell 对账直接继续功能开发
2. 接受“别的 shell 的全绿”作为当前事实
3. 在 misaligned shell 中宣称 verificationMode / readiness 已闭环
4. 跳过 sqlite / native ABI 问题
5. 通过降低测试标准获得表面通过
6. 在 canonical shell 未建立前进入 14.8

---

# 16. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. canonical verification shell 已明确并可进入
2. 当前验证结果明确属于哪个 shell，不再含糊
3. native ABI 分叉已修复或至少被精确定位
4. doctor 与 full suite 验证结果在同一 shell 下可解释
5. 结论真实、克制、可复核

---

# 17. 一句话任务定义

> **本轮的任务不是继续解释环境，而是把验证环境本身收束成一个唯一、真实、可独立复核的标准环境。**
