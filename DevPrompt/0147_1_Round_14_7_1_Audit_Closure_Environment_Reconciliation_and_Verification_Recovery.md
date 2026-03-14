# Round 14.7.1 — Audit Closure, Environment Reconciliation & Verification Recovery

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止跳步、禁止把别的 shell 的绿灯写成当前 shell 事实、禁止为了继续扩张而跳过当前审计裂缝，也禁止围绕单点问题无限打转却不形成闭环。

---

# 0. 强制执行声明

你必须把本提示词视为本轮的**主执行规范**，不是可选建议。

你必须：
- 完整阅读
- 完整理解
- 严格遵守
- 分阶段执行
- 只基于实际证据汇报
- 严格区分代码事实 / 当前 shell 事实 / 推断 / 他人报告

禁止：
- 跳过上下文文件
- 跳过验证命令
- 直接相信上一轮执行报告
- 把“某个环境里通过”写成“当前独立审计已通过”
- 一边环境没对齐一边继续扩张到更高层能力
- 用文档叙事掩盖运行时现实裂缝

---

# 1. 本轮定位

本轮不是 Round 14.8。  
本轮是：

# **Round 14.7.1 — 审计补闭环 / 环境对账 / 验证恢复**

它的目的不是继续做更大能力，而是：

> **把 Round 14.7 的代码推进，与当前独立审计 shell 的运行时现实重新对齐。**

当前最重要的问题不是“Doctor 还要不要继续扩功能”，而是：

1. 14.7 执行报告声称：
   - current shell = `v24.10.0`
   - `.nvmrc = v24.10.0`
   - alignment = `ALIGNED`
   - `vitest doctor.test.ts` / full suite 全绿
2. 但独立审计 shell 复核得到：
   - current shell = `v25.7.0`
   - `.nvmrc = v24.10.0`
   - `vitest` 启动失败：`ERR_MODULE_NOT_FOUND` / `tinypool`

因此本轮任务不是扩张，而是：

> **回答“到底哪个环境是真的当前环境、哪个环境跑出了绿灯、当前审计 shell 为什么起不来，以及如何恢复可独立复核的验证链”。**

---

# 2. 本轮必须避免的两个错误

## 错误 A：放着环境裂缝不补，继续推进 14.8 及更高层能力
例如：
- 直接进入 identity deeper closure
- 直接进入 economic grounding
- 继续往自治生命体高层扩张

这会把环境/验证债继续滚大。

## 错误 B：把本轮变成无意义的环境折腾
例如：
- 只反复 reinstall / rebuild / clear cache
- 只做 node_modules 清理，不形成清晰 truth contract
- 最后只能说“我试了很多次”却没有明确结论

本轮必须同时做到：
- 修复会阻断独立审计的环境/验证问题
- 形成清晰、可复述、可重复的环境 truth 结论

---

# 3. 开始前必须阅读的文件

在做任何实现、修复、验证之前，你必须严格按以下顺序读取：

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

读取后，你必须先输出：

```md
# Context Assimilation
```

并明确回答：
- ConShell 真正是什么
- 当前项目处在哪个阶段
- Round 14.7 在代码层推进了什么
- 为什么 14.7 报告不能直接等于当前独立审计事实
- 为什么本轮必须先做环境对账与验证恢复
- 为什么本轮不是继续扩张 14.8

---

# 4. 当前可信基线（必须据此工作）

以下内容视为本轮已知可信输入，但你仍必须用代码与命令复核，不得只复述。

## 4.1 已成立的代码层事实
Round 14.7 的代码层推进已观察到：
- `VerificationMode`
- `IntegrityReport.verificationMode`
- `computeVerificationMode()`
- `formatReport()` 输出 `Verification Mode`
- `doctor.test.ts` 中存在 14.7 新增测试

## 4.2 未完成的独立审计闭环
在独立审计 shell 下，已观察到：
- current shell = `v25.7.0`
- `.nvmrc = v24.10.0`
- `vitest` 启动报错：
  - `ERR_MODULE_NOT_FOUND`
  - `Cannot find package '/Users/archiesun/Desktop/ConShellV2/node_modules/tinypool/index.js'`

因此当前不能把：
- `28/28 pass`
- `581/581 pass`
- `truth closure established`

直接视为当前独立审计已确认成立。

## 4.3 当前阶段判断
当前更准确的阶段判断仍应是：

> **Viable Sovereign Runtime Core + Developing Runtime Truth Contract Layer + Early Self-Continuity Runtime Layer**

还不能因为 14.7 报告就直接升格为“truth kernel fully closed”。

---

# 5. 本轮目标定义

本轮的最优目标是：

# **Audit Closure, Environment Reconciliation & Verification Recovery**

也就是：

> **查明 Round 14.7 报告与当前独立审计 shell 之间的环境差异；恢复当前 shell 的最小可验证能力；重新建立当前 shell / pinned runtime / report runtime 之间的清晰真相关系。**

---

# 6. 本轮必须完成的核心目标

## Goal A — 明确“报告 runtime”与“当前审计 runtime”是否是同一个
你必须回答：
- 14.7 报告中的 `v24.10.0` 结果，是在哪个 shell / node 路径 / 环境下产生的？
- 当前独立审计 shell 为什么仍是 `v25.7.0`？
- 当前 shell 与报告 shell 是同一个环境，还是不同环境？

如果无法完全确认，也必须清楚写出：
- 已知事实
- 未知项
- 最合理推断

## Goal B — 修复当前独立审计 shell 的最小验证阻塞
你必须优先处理：
- `vitest` 启动失败
- `tinypool` 缺失

你必须查明这到底是：
1. `node_modules` 不完整
2. 当前 runtime 与安装依赖环境不匹配
3. lockfile / install state 漂移
4. OpenClaw/Node 升级后依赖状态未同步
5. 以上之一或组合

## Goal C — 恢复最小可信验证链
至少恢复并独立跑通：
- `node -v`
- `node -p process.versions.modules`
- `cat .nvmrc`
- `npx vitest run src/doctor/doctor.test.ts --no-coverage`
- 如可能，再跑：`npx vitest run --no-coverage`

如果 full suite 仍因环境问题不成立，也必须至少恢复 doctor 子系统级验证。

## Goal D — 形成环境 truth contract
本轮必须产出一套明确结论：
- 当前审计 shell truth 是什么
- pinned runtime truth 是什么
- 报告 runtime truth 是什么
- 当前系统是否具备独立审计可复核性
- 后续轮次应该以哪个环境为 canonical verification environment

## Goal E — 为后续继续开发创造真实基础
本轮完成后，后续轮次必须不再卡在以下问题：
- “为什么你说全绿，我这里起不来？”
- “这个 green 到底是哪个 shell 的？”
- “当前环境是不是已经是 pinned runtime？”

---

# 7. 非目标

除非完成本轮目标必须依赖，否则本轮禁止扩散到：

1. 不进入 14.8 的 identity deeper closure
2. 不推进 economic grounding 主逻辑
3. 不继续扩 dashboard / UI / channel / browser / nodes
4. 不继续增加 Doctor 新概念，只做最小必要修复
5. 不把环境问题无限扩展成大规模工程重构
6. 不把重点从“恢复可独立验证能力”转移成“顺手做更多功能”
7. 不通过删测试、降标准、跳过检查来换取 green
8. 不把“另一个 shell 的通过结果”包装成当前 shell 的通过结果

---

# 8. 必须阅读和理解的模块 / 文件

除了上面的根目录/文档阅读，必须继续阅读并理解：

## Doctor / 验证主线
- `packages/core/src/doctor/index.ts`
- `packages/core/src/doctor/doctor.test.ts`
- `packages/core/src/doctor/checks/tests.ts`
- `packages/core/src/doctor/checks/env.ts`

## Runtime / 配置 / 测试执行边界
- `.nvmrc`
- `package.json`
- `packages/core/package.json`
- `vitest.config.ts`
- `packages/core/vitest.config.ts`
- `pnpm-lock.yaml`

## 依赖问题排查所需
- 当前 `node_modules/vitest`、`node_modules/tinypool` 的存在状态
- 任何与 `vitest` worker / pool / coverage chunk 相关的依赖路径

---

# 9. 开始实施前必须回答的设计问题

## Q1. 当前 canonical verification environment 应该是什么？
你必须明确：
- 当前项目的 canonical verification environment 是否仍是 `.nvmrc = v24.10.0`
- 如果是，那么为什么当前审计 shell 不在该环境中
- 如果不是，必须说明变更证据

## Q2. `tinypool` 缺失是 runtime mismatch 问题还是安装状态问题？
你必须判断：
- 是 Node 版本造成模块解析异常
- 还是包本身未安装/损坏
- 还是 install state 与 lockfile 漂移

## Q3. 本轮的最小成功标准是什么？
你必须明确定义：
- 是恢复 doctor.test.ts 可运行
- 还是恢复 full suite 可运行
- 还是先恢复环境 truth contract 清晰可说明

原则：
> **优先恢复最小可信验证链，而不是贪大。**

---

# 10. 推荐实施方向

## Direction 1 — 先查环境事实，不要先重装一切
建议先检查：
- `which node`
- `node -v`
- `node -p process.execPath`
- `.nvmrc`
- `node_modules/tinypool`
- `npm/pnpm ls vitest tinypool`

先知道问题是什么，再决定是否需要 reinstall / rebuild。

## Direction 2 — 把“环境对账”和“验证恢复”分开
本轮应该分两层推进：

### Layer A：环境对账
回答：
- 为什么报告说 `v24.10.0`
- 为什么当前 shell 是 `v25.7.0`
- 两者关系是什么

### Layer B：验证恢复
回答：
- 如何让当前 shell 至少恢复 doctor.test.ts 级别验证
- full suite 是否也能恢复

## Direction 3 — 如需重装依赖，必须最小化且可解释
如果需要：
- `pnpm install`
- `pnpm rebuild`
- 删除局部损坏依赖
- 在 pinned runtime 下重新 install

必须说明：
- 为什么做
- 影响范围
- 是否可回滚
- 为什么这是最小必要动作

---

# 11. 本轮必须新增或强化的验证内容

至少要拿到以下事实证据：

## 11.1 runtime identity facts
- current shell runtime
- pinned runtime
- node path / execPath

## 11.2 dependency integrity facts
- `tinypool` 是否存在
- `vitest` / `tinypool` 安装关系是否完整
- lockfile / install state 是否一致

## 11.3 doctor verification recovery
- `src/doctor/doctor.test.ts` 是否可在当前环境下运行
- 如果可运行，实际结果是什么

## 11.4 full suite recovery status
- 是否能跑 full suite
- 如果不能，卡在哪一层：
  - install integrity
  - runtime mismatch
  - sqlite ABI
  - 其他依赖损坏

---

# 12. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why Round 14.7.1 Exists
# Why This Is Audit Closure, Not Feature Expansion
```

## Phase 2 — Environment Truth Audit
必须明确列出：
- current shell
- pinned runtime
- report runtime（若可推定）
- `vitest` 当前为何起不来
- `tinypool` 缺失是否真实存在

## Phase 3 — Repair Plan
必须明确：
- 要不要切换到 pinned runtime
- 要不要修复 install state
- 要不要重装依赖
- 每一步为什么必要

## Phase 4 — Implement Minimal Fixes
只做最小必要修复，不扩大范围。

## Phase 5 — Verification Recovery
至少执行：

```bash
cd /Users/archiesun/Desktop/ConShellV2 && which node
cd /Users/archiesun/Desktop/ConShellV2 && node -v
cd /Users/archiesun/Desktop/ConShellV2 && node -p process.execPath
cd /Users/archiesun/Desktop/ConShellV2 && node -p process.versions.modules
cd /Users/archiesun/Desktop/ConShellV2 && cat .nvmrc

cd /Users/archiesun/Desktop/ConShellV2 && ls node_modules/tinypool
cd /Users/archiesun/Desktop/ConShellV2 && npm ls vitest tinypool || true
cd /Users/archiesun/Desktop/ConShellV2 && pnpm ls vitest tinypool || true

cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run src/doctor/doctor.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx vitest run --no-coverage
```

如果必须切换到 pinned runtime 或人工修复依赖，也必须明确写出。

---

# 13. 人工执行命令协议

如果因为：
- SIP
- sandbox
- host policy
- nvm shell activation
- 全局 Node / 当前 shell 不能被 agent 切换
- 需要用户在交互 shell 中激活 `.nvmrc`

而必须让用户手动执行，必须使用以下格式：

## Manual Action Required

**Purpose**  
说明为什么必须人工执行

**Command**
```bash
<exact command>
```

**Why Agent Cannot Do This Directly**  
说明是 shell activation / host / sandbox / permission 限制

**Expected Result**  
执行后应看到什么

**Verification After Run**  
你后续将执行哪些命令验证

**Important Truth Note**  
用户未执行前，不能写成已完成

---

# 14. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解项目与当前阶段
- 为什么本轮不是 14.8 而是 14.7.1

# Environment Truth Audit
- current shell runtime
- pinned runtime
- report runtime（若可确认）
- `tinypool` / vitest 当前状态
- 当前独立审计链为什么断

# Repair Decisions
- 做了哪些最小必要修复
- 为什么做
- 为什么没扩大范围

# Modified Files / Environment Changes
- 改了哪些文件或依赖状态
- 每项改动的作用
- 是否影响代码结构 / 功能运行

# Verification Commands
- 实际跑了哪些命令
- 真实结果
- 不能省略失败
- 必须说明当前 shell 是否与 `.nvmrc` 对齐

# Audit Conclusion
- 当前独立审计链是否恢复
- 14.7 报告是否终于能在当前审计环境中复核
- 还剩哪些未解决问题

# Final Verdict
明确回答：

> 本轮是否成功完成 Audit Closure, Environment Reconciliation & Verification Recovery？

答案只能类似：
- `YES — audit chain restored`
- `PARTIAL — environment truth clarified but verification recovery incomplete`
- `NO — insufficient real progress`

# Next Round Recommendation
只有在当前环境 truth 与验证链恢复后，才允许进入 14.8。
必须基于本轮真实结果给建议，不允许预设剧情。

---

# 15. 严格禁止事项

你绝对不能做这些事：

1. 跳过环境对账直接继续功能开发
2. 把 14.7 报告直接当成当前独立审计已确认事实
3. 只重装依赖却不解释原因
4. 为了追求 green 而删测试 / 弱化标准 / 跳过 Doctor
5. 不说明当前 shell 与 `.nvmrc` 关系就宣称验证已恢复
6. 不区分 report runtime 与 audit runtime
7. 在审计链没恢复前直接进入 14.8

---

# 16. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 已明确 current shell / pinned runtime / report runtime 的关系
2. 已解释 `tinypool` / vitest 启动失败的真实原因
3. 当前独立审计环境至少恢复 doctor 级验证能力
4. 所有结论都有命令证据支撑
5. 输出结论真实、克制、可复核

---

# 17. 一句话任务定义

> **本轮的任务不是继续定义 truth，而是恢复一个能够独立验证 truth 的现实环境。**
