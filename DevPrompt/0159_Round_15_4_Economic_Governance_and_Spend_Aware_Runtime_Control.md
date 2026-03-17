# Round 15.4 — Economic Governance & Spend-Aware Runtime Control

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“已有 spend truth”误解成“可以直接上完整经济自治”；禁止从 15.3 的 spend attribution truth 直接跳到 monetization / x402 / 收益优化 / autonomous earning 主系统；禁止只做一些预算文案、阈值常量或 dashboard 展示就宣称 economic governance 已成立。  
> **本轮风格要求**：高压审计约束 + 受控扩张协议 + 最小充分治理闭环 + 强生产路径对账 + 强最终验收格式。你不是来做一个“预算设置页面”，也不是来再建一层平行 policy；你是来让 ConShell 第一次具备**基于真实 spend truth 的运行时约束、预算边界、风险抬升与成本感知执行控制**，把项目从“能记账”推进到“会受资源现实约束”。

---

# 0. 强制执行声明

本轮不是：
- 完整 economic system round
- 完整 x402 / billing / monetization round
- revenue optimization round
- autonomous earning / survival engine round
- 继续只做 spend telemetry / spend schema 扩展 round
- 继续只做 behavior polishing round

本轮是：

# **Round 15.4 — Economic Governance & Spend-Aware Runtime Control**

你必须把本提示词视为：

> **在 15.3 已建立 spend attribution truth 之后，第一次把“资源消耗事实”转化为“运行时控制事实”的治理闭环轮。**

ConShell 当前已经开始回答：
- 一次 inference 花了什么
- 这些 spend 属于哪个 session / turn
- 成本可以被记录、查询、审计

但它仍然缺一个关键跨越：

> **这些 spend truth 是否真的会改变运行时行为？**

也就是说，当前系统还需要从：
- `cost is observable`
推进到：
- `cost constrains execution`

如果没有这一步：
- spend truth 只是账本，不是治理事实
- behavior / planning 不会面对资源现实
- 后续更高层 economic agency 会建立在无约束执行之上

因此本轮不是更大的经济层，而是：

> **Economic Governance Phase 1：让 runtime 开始受 spend truth 约束。**

---

# 1. 当前阶段判断

## 1.1 当前项目已经具备进入 economic governance 的条件
经过前面多轮，当前项目已经完成：
- runtime truth
- identity continuity
- owner-bound memory
- memory intelligence
- behavior utilization
- behavior integration closure
- spend attribution truth v1

这意味着 ConShell 已经具备：
- self / continuity / behavior substrate
- 经济现实记录能力

现在最缺的不是“继续记录更多成本”，而是：

> **如何让这些成本事实开始抬高/降低某些执行路径的可行性与优先级。**

## 1.2 为什么当前不应继续只扩 spend truth
15.3 已经完成：
- contract
- runtime write path
- query truth
- attribution truth

继续只扩 spend aggregation / query surface 的边际收益会下降。  
因为当前真正的缺口已经变成：

> **runtime 是否会因为 spend reality 而改变执行。**

## 1.3 为什么当前不应直接跳 x402 / monetization / value accounting
因为当前还没有证明：
- budget 是否能约束 inference path
- high-cost path 是否会抬升 caution
- runtime 是否有最小治理边界
- spend truth 是否被真正消费，而不只是被存储

如果这些没成立，直接进入：
- monetization
- value accounting
- autonomous survival optimization

会非常容易形成“有经济叙事、无经济控制”的失真结构。

因此最合理顺序是：

1. **Spend Attribution Truth**（15.3，已完成）
2. **Economic Governance / Spend-Aware Runtime Control**（本轮）
3. **Higher-Layer Economic Governance / Budgeted Planning / Value Accounting**
4. **x402 / monetization / earn-your-existence stronger loops**

---

# 2. 本轮要解决的真实问题

ConShell 现在已经能记录成本，但仍未必能回答：

- 当本小时/本日 spend 接近上限时，runtime 会发生什么？
- 当某次 inference 成本过高时，系统是否会抬高审慎等级？
- 当 budget 紧张时，系统是否会偏向更便宜/更保守的执行路径？
- 哪些 runtime 路径在经济上属于“高风险动作”？
- 当前 spend 现实是否已进入 execution control，而不是停留在 repo 查询层？

所以本轮不是继续问“记录得够不够”，而是要开始回答：

> **资源现实如何进入执行控制。**

本轮的任务是让系统第一次具备：
- spend-aware gating
- budget threshold awareness
- runtime caution escalation under cost pressure
- 最小经济治理 contract

换句话说：

> **本轮的目标不是更会记账，而是让 agent 开始不能无限制地忽视成本现实。**

---

# 3. 本轮必须避免的九个错误

## 错误 A：把 governance 做成 UI/配置页
如果只是增加：
- budget config 页面
- dashboard 显示
- spend warning 文案

这不叫 runtime control。  
本轮核心是生产路径控制，不是界面。

## 错误 B：只做阈值判断，不接执行路径
如果只是能计算“超过预算了”，
但 inference / runtime path 没有任何行为变化，
那不叫 governance，只叫统计。

## 错误 C：直接做大而全 budget governor
本轮禁止一口气做成：
- 全局 planner 预算系统
- 多策略任务调度引擎
- 全面价值函数控制器

本轮只做最小充分治理闭环。

## 错误 D：把 budget control 做成平行真相系统
不能出现：
- spend truth 在 repo 一套
- governance decision 在另一套孤立逻辑

必须建立统一 consumption contract。

## 错误 E：只限制单笔，不建立 session / runtime context 感知
如果只检查一次调用是否过大，而不看：
- 当前小时预算
- 当前天预算
- 当前 session burn

治理层就太弱。

## 错误 F：只阻断，不分级
高质量治理不是只有“允许/拒绝”。  
本轮至少应考虑：
- allow
- caution / degrade
- block

而不是全系统只有硬停。

## 错误 G：把 spend-aware control 写死到 provider 细节
治理层应尽量围绕：
- spend contract
- budget state
- execution category

而不是写成某个 provider 的特判脚本。

## 错误 H：越界做 monetization / x402 主系统
本轮禁止：
- payment receiving 主流程扩展
- pricing model 主系统
- earning loop
- paid tool marketplace

## 错误 I：没有强验证就宣称治理闭环成立
必须证明：
- runtime path 会消费 spend truth
- budget pressure 会改变 execution behavior
- no-regression 不回退

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
4. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
5. `docs/planning/NEXT_PHASE_ROADMAP.md`
6. `DevPrompt/0158_Round_15_3_Economic_Grounding_and_Spend_Attribution_Truth_Integration.md`

还必须重点阅读以下代码：

## spend truth / governance 主线
- `packages/core/src/spend/index.ts`
- `packages/core/src/state/repos/spend.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/policy/*`
- `packages/core/src/inference/index.ts`

## runtime / execution 主线
- `packages/core/src/runtime/tool-executor.ts`
- `packages/core/src/runtime/state-machine.ts`
- `packages/core/src/api-surface/*`
- `packages/core/src/server/*`

## 关键测试主线
- `packages/core/src/spend/spend.test.ts`
- `packages/core/src/state/repos/spend.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- `packages/core/src/policy/policy.test.ts`
- `packages/core/src/api-surface/api-surface.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What Spend Truth Already Makes Real
# What Runtime Control Still Does Not Yet Exist
# Why 15.4 Should Focus On Economic Governance
```

并明确回答：
- 当前 spend truth 到底真实到什么程度
- 这些 spend truth 现在是否已影响 runtime
- 当前最小治理缺口是什么
- 为什么本轮应先做 spend-aware runtime control，而不是直接上更高层经济系统

---

# 5. Claude Opus 4.6 启动执行清单（最短路径）

> **这不是建议，而是默认启动顺序。**  
> 目标：让 Claude Opus 4.6 用最短路径判断当前项目的治理缺口，并落地最小充分的 spend-aware runtime control。

## 5.1 先读什么（严格顺序）

### Level 1 — 阶段与目标
1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `DevPrompt/0158_Round_15_3_Economic_Grounding_and_Spend_Attribution_Truth_Integration.md`
4. `DevPrompt/0159_Round_15_4_Economic_Governance_and_Spend_Aware_Runtime_Control.md`

### Level 2 — 当前真实实现主线
5. `packages/core/src/spend/index.ts`
6. `packages/core/src/state/repos/spend.ts`
7. `packages/core/src/runtime/agent-loop.ts`
8. `packages/core/src/kernel/index.ts`
9. `packages/core/src/policy/*`
10. `packages/core/src/inference/index.ts`
11. `packages/core/src/runtime/tool-executor.ts`

### Level 3 — 测试与约束主线
12. `packages/core/src/spend/spend.test.ts`
13. `packages/core/src/state/repos/spend.test.ts`
14. `packages/core/src/runtime/agent-loop.test.ts`
15. `packages/core/src/kernel/kernel.test.ts`
16. `packages/core/src/policy/policy.test.ts`
17. `packages/core/src/api-surface/api-surface.test.ts`
18. `packages/core/src/integration/closure-gate.test.ts`

## 5.2 先查什么（设计前必须完成）

### Check A — spend truth 目前在哪里被消费
必须明确：
- spend truth 当前是否只停留在 repo/query
- 哪些 runtime path 已消费它
- 哪些 runtime path 还完全无 budget awareness

### Check B — 最小治理杠杆点在哪里
默认优先级应为：
1. inference runtime path
2. spend tracker / budget state contract
3. policy / execution gating integration
4. minimal exposure / diagnostics

### Check C — 当前最小治理模式应是什么
必须明确本轮应该做：
- hard block only
- caution + degrade + block 三层
- 或等价最小分级控制

默认不推荐只有单一 block 模式。

### Check D — 是否需要新 contract
必须判断：
- 现有 SpendTracker 是否已足以支持治理
- 是否需要新增 budget decision / spend pressure / governance verdict contract
- 什么是最小充分新增

## 5.3 先改什么（默认改动顺序）

### Step 1 — 先定义治理 contract
优先建立：
- budget state
- spend pressure / governance verdict
- runtime consumption contract

### Step 2 — 再接 inference/runtime path
优先把 spend-aware control 接到：
- inference execution 前/后
- session/turn context-aware runtime decisions

### Step 3 — 再接 policy/explainability
确保治理决策不是黑盒：
- 能解释为何 allow / caution / block
- 能测试
- 能审计

### Step 4 — 最后再做 minimal surface
若本轮必须，可接：
- diagnostics
- api surface
- debug route

默认不做大 UI。

## 5.4 先测什么（默认验证顺序）

### 第一组：spend / governance 核心测试
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/spend/spend.test.ts src/state/repos/spend.test.ts src/policy/policy.test.ts --no-coverage
```

### 第二组：runtime integration tests
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/agent-loop.test.ts src/kernel/kernel.test.ts src/api-surface/api-surface.test.ts --no-coverage
```

### 第三组：gate / no-regression
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts src/identity/self-truth-contracts.test.ts src/memory/memory-intelligence.test.ts src/runtime/behavior-guidance.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

### 第四组：全量验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

## 5.5 Claude Opus 4.6 默认执行纪律

1. **先审计 spend truth 的消费缺口，再设计治理层**
2. **先建治理 contract，再接 runtime path**
3. **先让成本现实真正改变执行，再谈更高层经济自治**
4. **任何顺手扩张到 monetization / x402 / revenue loop 的冲动，默认视为越界**
5. **任何“预算功能”若不进入 production runtime control，默认不算完成**

## 5.6 今后 Dev Prompt 的统一标准

后续 Dev Prompt 继续默认包含：

# `Claude Opus 4.6 启动执行清单（最短路径）`

并固定覆盖：
- **先读什么**
- **先查什么**
- **先改什么**
- **先测什么**

---

# 6. 本轮目标定义

本轮目标不是“知道花了多少钱”，而是：

# **Make Spend Truth Constrain Runtime Execution**

即同时做到：

1. **让 runtime 能感知 budget / spend pressure**
2. **让 spend reality 至少在关键路径上改变 execution behavior**
3. **让 allow / caution / degrade / block（或等价分级）开始成立**
4. **让治理决策可解释、可测试、可审计**
5. **为后续更高层 economic planning / governance / monetization 打下可信基础**

---

# 7. 本轮必须完成的核心目标

## Goal A — 建立最小 Economic Governance Contract
你必须明确并尽量落地：
- budget state / spend pressure 是什么
- governance decision / verdict 是什么
- runtime 如何消费这个 decision

推荐最小 contract 至少考虑：
- current spend pressure（low/medium/high 或等价）
- budget remaining / hourly pressure / daily pressure
- execution verdict（allow/caution/degrade/block 或等价）
- explanation / reason

## Goal B — 让 inference path 进入 spend-aware control
至少必须让关键 inference path 开始面对：
- 单次成本过高
- 小时预算紧张
- 日预算紧张
- 或等价的 spend pressure 状态

这不一定要求立刻做复杂 model routing，
但至少需要让 runtime 在高压力下：
- 抬高 caution
- 或降低某些执行路径激进度
- 或在极端情况下 block

## Goal C — 建立分级治理，而不是只有硬停
本轮优先目标不是 binary allow/deny，
而是最小分级控制，例如：
- `allow`
- `caution`
- `degrade`
- `block`

其中：
- `caution` 代表提高审慎程度 / 发出治理上下文
- `degrade` 代表采用更保守或更轻量的路径（若当前可行）
- `block` 代表明确禁止继续执行

如果当前阶段无法完整支持四级，也必须明确你实际实现的最小分级以及原因。

## Goal D — 建立 explainability / audit contract
治理层不能是黑盒。  
必须至少能回答：
- 为什么这次允许
- 为什么这次进入 caution
- 为什么这次被 block
- 依据了哪些 spend truth

## Goal E — 建立最小 production-path truth
本轮不能只在测试中模拟治理决策；必须让生产路径中至少一个关键 runtime path 真实消费 governance contract。

## Goal F — 保持最小充分边界
本轮只做：
- spend-aware runtime control v1
- 最小 budget governance v1
- 可解释决策 contract v1

禁止越级进入：
- full planner budget optimization
- multi-objective value accounting
- monetization / x402 主系统

---

# 8. 推荐实现方案（必须比较后再选）

你必须给出至少 3 个候选方向，并明确取舍。

## 方案 A — SpendTracker-centered governance layer（推荐）
做法：
- 在现有 SpendTracker / spend truth 之上增加 budget pressure / governance verdict
- runtime path 消费该 verdict
- 保持 spend truth 与 governance truth 同源

优点：
- 最贴近当前项目现实
- 改动相对集中
- 有利于 production-truth 闭环

缺点：
- 需要谨慎设计 contract，避免把 tracker 变成大杂烩

**默认推荐此方案。**

## 方案 B — Policy-only governance wrapper（部分可用，但默认不推荐单独采用）
做法：
- 在 policy 模块外层包装 spend-aware gating
- 由 policy 决定 allow/deny

优点：
- 看起来职责清晰

缺点：
- 如果 spend truth 没直接进入统一 contract，容易形成平行真相
- 容易只做到阻断，不做到 runtime 真实消费

本轮不建议单独采用。

## 方案 C — Full budgeted planner/runtime governor（当前不推荐）
做法：
- 直接把 budget 与 planning、task selection、multi-step execution 深度耦合

优点：
- 理论上更强

缺点：
- 当前阶段过重
- 极易越界
- 审计难度大幅上升

**本轮默认不推荐。**

---

# 9. 首选实现落点（默认方案）

除非有强理由证明更优，否则本轮默认采用：

# **方案 A — SpendTracker-centered governance layer**

建议最小实现结构如下：

## 9.1 新增或强化 governance types / contract
建议建立或强化类似：
- `SpendPressure`
- `GovernanceVerdict`
- `BudgetStatus`
- `EconomicGovernanceDecision`

字段不必照抄，但必须能表达：
- 当前压力
- 决策结果
- 解释原因
- 影响范围

## 9.2 在 spend tracker 上建立最小 budget state 计算
基于现有：
- hourly spend
- daily spend
- balance
- limits

生成：
- low / medium / high pressure
- 或等价分级

## 9.3 在 agent-loop / runtime 关键路径接入治理决策
至少让：
- inference 调用前或调用后（取决于你能获取真实 cost 的位置）
- 对 session/turn path 建立最小治理响应

例如可能的最小响应：
- attach caution guidance
- emit governance warnings
- stop further expensive iteration
- block when budget exhausted

## 9.4 Minimal exposure / diagnostics
可选最小 surface：
- debug / doctor / API surface 中可见当前 governance state
- 不要求大 UI

---

# 10. 文件边界与修改范围建议

## 建议优先修改的文件
- `packages/core/src/spend/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/policy/*`（仅在必要时）
- `packages/core/src/api-surface/*`（仅做最小 exposure）

## 建议新增/修改的测试文件
- `packages/core/src/spend/spend.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- `packages/core/src/policy/policy.test.ts`
- 必要时新增 spend-governance integration test

## 本轮不建议大改的区域
- `wallet/`
- `x402/`
- `dashboard/` 大 UI
- `multiagent/`
- `channels/` 大通路系统
- `planning / governance` 高层大系统

---

# 11. 开始实施前必须回答的设计问题

## Q1. 当前 spend truth 真实进入了哪些运行时路径？
必须明确列出，而不是泛泛说“系统有 spend tracking”。

## Q2. 当前 runtime 到底有没有 spend-aware control？
如果答案基本是“没有”，必须直说。

## Q3. 本轮最小治理 contract 长什么样？
你必须明确：
- pressure state
- verdict state
- explanation contract
- runtime consumption point

## Q4. 本轮最小可验证的行为变化是什么？
不能只说“以后会更省钱”。  
必须明确：
- 哪个 runtime path 会因 budget pressure 改变行为
- 如何被测试证明

## Q5. 什么叫 15.4 成功？
必须避免“做了点预算判断就算完成”。  
至少需要证明：
- spend truth 被 runtime 消费
- governance decision 可解释
- execution behavior 有真实变化

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 budget pressure classification
- 不同 spend 状态映射到不同 pressure / governance state

## 12.2 governance verdict contract
- allow / caution / degrade / block（或等价分级）行为正确
- explanation reason 存在且可验证

## 12.3 runtime integration
- spend-aware governance 已进入至少一个生产 runtime path
- 在高 pressure 或 budget exhausted 场景下，runtime 行为发生可验证变化

## 12.4 session / turn awareness
- 治理逻辑不会串 session / turn
- 不会把别的 session 的 spend 状态错误影响当前执行

## 12.5 no-regression
- spend truth 相关测试不回退
- behavior guidance / memory / identity / closure tests 不回退
- kernel / runtime / api-surface 关键路径不回退

## 12.6 explainability / audit path
- 当前 governance state / decision 至少有一条可查询、可验证、可解释的对账路径

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
先输出：

```md
# Context Assimilation
# What Spend Truth Already Makes Real
# What Runtime Control Still Does Not Yet Exist
# Why 15.4 Should Focus On Economic Governance
```

## Phase 2 — Economic Governance Audit
必须明确：
- 当前 spend truth 的生产状态
- 当前 runtime control 缺口
- 当前最小治理杠杆点
- 2–3 个候选方案与取舍

## Phase 3 — Design Decision
必须明确：
- governance contract
- budget pressure model
- runtime consumption point
- explainability / audit contract
- 为什么这是最小充分治理闭环

## Phase 4 — Implement
只做最小充分实现。  
禁止越级进入完整 economic governance / monetization 主线。

## Phase 5 — Tests & Verification
重点证明：
- spend truth 已进入 runtime control
- governance 决策可解释、可测试、可审计
- no-regression 不回退

## Phase 6 — Economic Governance Verdict
明确回答：
- 本轮是否真实建立了 spend-aware runtime control
- 它是否足以支撑下一轮更高层 budgeted planning / value accounting / monetization preparation

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use
```

## 核心 governance 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/spend/spend.test.ts src/state/repos/spend.test.ts src/policy/policy.test.ts src/runtime/agent-loop.test.ts src/kernel/kernel.test.ts src/api-surface/api-surface.test.ts --no-coverage
```

## Gate / no-regression 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts src/identity/self-truth-contracts.test.ts src/memory/memory-intelligence.test.ts src/runtime/behavior-guidance.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

## 全量验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。  
**若任何命令未执行或失败，必须在最终报告中如实写出，不得伪造通过。**

---

# 15. 人工执行命令协议

如果由于 shell / host / sandbox / daemon / dependencies 限制，需要用户手动执行某步，必须使用以下格式：

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
- 如何理解当前 spend truth / runtime / governance 的真实状态
- 为什么 15.4 应做 spend-aware runtime control，而不是直接做更高层 economic system

# Economic Governance Audit
- 当前 spend truth 已成立到什么程度
- 当前 runtime control 缺口是什么
- 候选方案与取舍
- 为什么选当前方案

# Design Decisions
- governance contract
- budget pressure model
- runtime consumption point
- explainability / audit contract
- minimal exposure path

# Modified Files
- 改了哪些文件
- 每项改动如何推进 economic governance truth
- 哪些改动属于 contract，哪些属于 runtime integration，哪些属于 audit/exposure

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明 spend-aware control 成立
- 哪些测试证明 governance explainability 成立
- 哪些测试证明 no-regression

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Economic Governance Assessment
- spend truth 是否已开始约束 runtime execution
- governance 决策是否已可解释、可测试、可审计
- 本轮是否真实为更高层 economic planning / monetization 准备打下可信基础

# Final Verdict
明确回答：

> 15.4 是否已经建立了可解释、可测试、可审计的 spend-aware runtime control，并让 ConShell 正式进入 Economic Governance Phase 1？

答案只能类似：
- `YES — economic governance is established and the project is ready to move toward higher-layer budgeted planning or monetization preparation`
- `PARTIAL — useful spend-aware control landed, but one or more runtime/governance truth gaps remain`
- `NO — insufficient economic governance`

# Next Round Recommendation
若 YES：说明下一轮更适合进入哪类更高层经济/治理/价值系统扩张；  
若不是：列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不先审计 spend truth 的消费状态就直接开改
2. 只做预算判断，不接 runtime 行为控制
3. 借 15.4 偷偷扩成 monetization / x402 / revenue loop 大轮
4. 只做 UI / warning 文案就宣称治理成立
5. 只做 block，不考虑最小分级控制
6. 跳过验证就宣称 economic governance 已成立

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 最小 economic governance contract 已建立
2. spend truth 已进入至少一个关键 production runtime path 的控制逻辑
3. budget pressure / governance verdict 至少部分成立
4. 治理决策可解释、可测试、可审计
5. spend / behavior / memory / identity / closure 既有关键测试不回退
6. full suite + tsc 在 canonical shell 下通过
7. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续“知道花了多少钱”，而是让 ConShell 第一次开始“不能无视花了多少钱”——把已建立的 spend attribution truth 转化为最小但真实的 runtime governance truth，让资源现实开始约束执行。**
