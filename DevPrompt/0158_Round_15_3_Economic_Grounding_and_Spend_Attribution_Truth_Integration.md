# Round 15.3 — Economic Grounding & Spend Attribution Truth Integration

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“进入经济层”误解成直接做复杂代币系统、自治市场、收益优化或链上交易；禁止脱离当前项目真实状态，空想式扩写 economy 叙事；禁止为了进入新阶段而跳过 production-truth、验证、边界控制与审计纪律。  
> **本轮风格要求**：高压审计约束 + 受控扩张协议 + 最小充分经济闭环起点 + 强生产路径对账 + 强最终验收格式。你不是来“做一个钱包功能”，也不是来“加个 spend 表”；你是来让 ConShell 第一次拥有**可验证的资源消耗语义、成本归因语义、行为与成本的连接语义**，从而为后续真正的 earn-your-existence / economic agency 打下可信基础。

---

# 0. 强制执行声明

本轮不是：
- 直接实现完整 economy system
- 直接实现 revenue engine / marketplace / billing platform
- 直接实现链上支付主系统
- 直接实现 autonomous optimization for profit
- 继续停留在 behavior guidance polishing

本轮是：

# **Round 15.3 — Economic Grounding & Spend Attribution Truth Integration**

你必须把本提示词视为：

> **在 15.2 / 15.2.1 已让 identity / continuity / behavior utilization 进入 production truth 之后，第一次把 agent 的“行为”与“资源消耗 / 成本归因 / 经济现实”连接起来的基础闭环轮。**

ConShell 若要走向真正的自主智能生命体运行时，不能只有：
- identity
- memory
- behavior

还必须开始回答：
- 一次推理 / 一次工具调用 / 一次工作流推进，消耗了什么资源？
- 这些消耗应归因到哪个 session / turn / task / capability？
- 当前系统是否具备最基础的“行动有成本、成本可归因、归因可审计”的现实约束？

如果没有这层经济 grounding：
- 后续 spend governance 会建立在空中楼阁上
- value accounting 无法成立
- earn-your-existence 无法具备真实约束
- autonomous planning 也无法面对资源现实

因此本轮不是高层经济系统，而是：

> **Economic Grounding Phase 1：先建立真实、可审计、可验证的 spend attribution truth。**

---

# 1. 当前阶段判断

## 1.1 当前项目已经具备进入经济 grounding 的条件
经过前面多轮，当前项目已经完成：
- runtime truth
- doctor / verification discipline
- identity continuity
- owner-bound memory
- memory intelligence v1
- behavior guidance v1
- continuity-aware behavior integration closure

这意味着 ConShell 当前已经可以回答：
- 我是谁
- 我是否连续
- 我记住了什么
- 这些记忆如何开始影响我的行为

但它仍然缺一个关键现实层：

> **我每次行动花费了什么？这些花费属于谁、属于哪次任务、属于哪条行为链？**

## 1.2 为什么当前不该继续死磕 behavior
15.2 / 15.2.1 已经完成行为层第一版闭环。  
继续只做 behavior polishing 的边际收益已经下降，因为：
- behavior 已经开始受到 identity / continuity / memory 影响
- 当前真正缺的是资源现实层
- 没有 spend attribution，行为层无法进入更真实的治理与价值判断

因此现在继续留在 behavior-only 优化，会让项目再次陷入“认知层越来越精致，但现实约束仍然缺席”的结构性停滞。

## 1.3 为什么当前不应直接跳到完整 economy / x402 / autonomous earning
因为当前还缺少更底层的真实闭环：
- spend truth 是否存在
- attribution 粒度是否清楚
- per-turn / per-session / per-task 资源账本是否真实
- inference / tool / workflow 消耗是否已被统一归因

若这些不成立，直接做：
- x402 monetization
- wallet-driven execution economics
- revenue loops
- autonomous survival accounting

都会建立在弱基础之上。

因此当前最合理顺序是：

1. **Memory Intelligence**
2. **Behavior Utilization**
3. **Economic Grounding / Spend Attribution Truth** ← 本轮
4. **Stronger Economic Governance / Value Accounting / Earn-Your-Existence**

---

# 2. 本轮要解决的真实问题

ConShell 当前已经能够：
- 执行推理
- 调用工具
- 运行多种 runtime path
- 维持 identity / continuity / memory / behavior guidance

但它仍然极可能缺少统一回答：

> **一次真实行动到底花费了什么？这些成本如何被记录、归因、查询、审计，并被未来上层能力消费？**

本轮必须从“能力存在”推进到“经济现实存在”。

也就是说，本轮需要开始解决：
- inference 成本与 token 使用如何被统一记录
- tool action 成本如何被描述和归因
- session / turn / task / capability 维度如何形成 spend truth
- 当前 spend 数据是否只是散落在各处，还是已经形成可消费的运行时事实

换句话说：

> **本轮的任务不是做一个 finance dashboard，而是让 agent runtime 第一次拥有“行动会消耗资源，并且这种消耗是可审计的”这一现实层。**

---

# 3. 本轮必须避免的八个错误

## 错误 A：把经济 grounding 做成钱包/UI 功能
如果你只是加：
- 钱包显示
- 余额文案
- 一些 finance UI

这不叫 economic grounding。  
本轮核心是 runtime spend truth，不是表层展示。

## 错误 B：把 spend attribution 做成静态日志堆积
如果只是写一些 log，没有：
- 统一结构
- 查询能力
- attribution 粒度
- runtime consumption path

那不叫 spend attribution，只叫日志增加。

## 错误 C：过早实现复杂经济系统
本轮禁止：
- 完整 billing
- payment flows
- x402 主实现
- autonomous revenue optimization
- tokenomics

## 错误 D：只记录 inference，不考虑 action attribution
只记录 token cost 不够。  
本轮至少要开始回答：
- 成本属于哪个 turn / session / task / action
- 哪些行为路径是高成本行为

## 错误 E：只做 schema，不做 runtime integration
如果只建表，不在实际 runtime path 中写入真实 spend data，仍然不能算完成。

## 错误 F：只做 runtime integration，不做可查询 truth
如果成本被写了，但无法按 session / turn / task / type 查询和审计，也不算闭环。

## 错误 G：把经济层做成另一个平行真相系统
本轮必须避免出现：
- runtime 一套 truth
- spend subsystem 另一套 truth

需要统一 contract，而不是并行叙事。

## 错误 H：顺手做成大治理系统
本轮不能顺手扩成：
- policy-based budget governor
- auto-stop / auto-throttle 全系统
- task market / work pricing engine

那些是后续更高层 round。

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
4. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
5. `docs/planning/NEXT_PHASE_ROADMAP.md`
6. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
7. `DevPrompt/0156_Round_15_2_Identity_Aware_Behavior_Utilization_and_Recall_Policy_Integration.md`
8. `DevPrompt/0157_Round_15_2_1_Behavior_Integration_Closure_and_Continuity_Wiring_Truth.md`

还必须重点阅读以下代码：

## runtime / attribution 主线
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/tool-executor.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/inference/index.ts`
- `packages/core/src/types/inference.ts`

## spend / state 主线
- `packages/core/src/spend/spend.ts`
- `packages/core/src/state/repos/spend.ts`
- `packages/core/src/state/repos/turns.ts`
- `packages/core/src/state/repos/sessions.ts`
- `packages/core/src/state/database.ts`

## wallet / economy-adjacent 主线
- `packages/core/src/wallet/*`
- `packages/core/src/evomap/*`
- `packages/core/src/policy/*`

## 关键测试主线
- `packages/core/src/spend/spend.test.ts`
- `packages/core/src/state/repos/spend.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- `packages/core/src/api-surface/api-surface.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What Runtime Truth Already Covers
# What Economic Truth Still Does Not Exist
# Why 15.3 Should Start With Spend Attribution Truth
```

并明确回答：
- 当前项目里已有的 spend / usage / wallet / cost 相关能力到底到什么程度
- 哪些是 runtime fact，哪些只是静态模块存在
- 目前最缺的经济现实层到底是什么
- 为什么本轮应该先做 spend attribution truth，而不是直接做更高层 economy

---

# 5. Claude Opus 4.6 启动执行清单（最短路径）

> **这不是建议，而是默认启动顺序。**  
> 目标：让 Claude Opus 4.6 以最短路径判断当前项目的经济 grounding 缺口，并落地最小充分 spend attribution 闭环。

## 5.1 先读什么（严格顺序）

### Level 1 — 阶段与目标
1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `DevPrompt/0157_Round_15_2_1_Behavior_Integration_Closure_and_Continuity_Wiring_Truth.md`
4. `DevPrompt/0158_Round_15_3_Economic_Grounding_and_Spend_Attribution_Truth_Integration.md`

### Level 2 — 当前真实实现主线
5. `packages/core/src/runtime/agent-loop.ts`
6. `packages/core/src/runtime/tool-executor.ts`
7. `packages/core/src/kernel/index.ts`
8. `packages/core/src/spend/spend.ts`
9. `packages/core/src/state/repos/spend.ts`
10. `packages/core/src/state/repos/turns.ts`
11. `packages/core/src/inference/index.ts`

### Level 3 — 测试与约束主线
12. `packages/core/src/spend/spend.test.ts`
13. `packages/core/src/state/repos/spend.test.ts`
14. `packages/core/src/runtime/agent-loop.test.ts`
15. `packages/core/src/kernel/kernel.test.ts`
16. `packages/core/src/integration/closure-gate.test.ts`
17. `packages/core/src/api-surface/api-surface.test.ts`

## 5.2 先查什么（设计前必须完成）

### Check A — spend truth 当前是否真的存在
必须明确：
- 哪些 runtime path 已记录 usage/spend
- 哪些只是测试模块 / helper / placeholder
- 哪些根本没有统一写入路径

### Check B — attribution 粒度断层点
必须明确当前是否缺失：
- per-session attribution
- per-turn attribution
- per-task / per-action attribution
- inference vs tool vs workflow attribution 区分

### Check C — 最小 leverage point
默认优先级应为：
1. spend event / spend record contract
2. runtime write path
3. repository query path
4. verification path

### Check D — 是否需要新表 / 新字段 / 新 contract
必须先判断最小充分实现是什么，不允许一上来扩大 schema 到过度设计。

## 5.3 先改什么（默认改动顺序）

### Step 1 — 先统一 spend attribution contract
先定义清楚最小统一结构：
- 什么叫 spend record
- attribution 维度是什么
- inference / tool / other action 如何区分

### Step 2 — 再接 runtime write path
优先把真实 spend 写入接到：
- inference path
- turn/session context
- 若合理，再接 tool execution path

### Step 3 — 再做 repository / query truth
确保这些数据不是只会被写入，还能按关键维度被读取、验证、审计。

### Step 4 — 最后再补 API / surface / dashboard exposure（若本轮必须）
默认只做最小可验证 exposure，不做大 UI。

## 5.4 先测什么（默认验证顺序）

### 第一组：spend / repository 核心测试
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/spend/spend.test.ts src/state/repos/spend.test.ts --no-coverage
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

1. **先判断 spend truth 是否已存在，再设计补强**
2. **先建立 attribution contract，再接 runtime 写入**
3. **先建立 production-truth spend path，再谈更高层经济系统**
4. **如果发现需要更大治理系统，默认视为越界，不进入本轮**
5. **任何“顺手经济扩张”若不直接支撑 spend attribution truth，默认不做**

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

本轮目标不是“做出经济系统界面”，而是：

# **Make Action Cost Real, Attributable, And Auditable**

即同时做到：

1. **让真实 runtime 行为开始产生结构化 spend truth**
2. **让 spend truth 至少可按关键 attribution 维度被记录与查询**
3. **让 inference / action / turn / session 之间的成本归因关系开始成立**
4. **让后续更高层 economy / governance / value accounting 有可信基础**
5. **让这条经济 grounding 路径可解释、可测试、可审计**

---

# 7. 本轮必须完成的核心目标

## Goal A — 建立统一 Spend Attribution Contract
你必须明确并尽量落地：
- 什么是最小 spend record
- 需要哪些最小字段
- attribution 最小维度是什么

推荐最小维度至少考虑：
- `sessionId`
- `turnId` 或 turn correlation
- `kind`（如 inference/tool/other）
- `units` / `token usage` / `estimatedCost`（取决于当前真实可得数据）
- `model` / `toolName`（若相关）
- `source` / `provider`
- `createdAt`

本轮不要求一次性完美，但必须让 contract 足够支撑 runtime truth。

## Goal B — 让 inference spend 成为生产事实
至少必须让：
- inference usage 不只是临时变量
- 而是进入统一 spend attribution 路径

如果当前 router / stream usage 已有 token 信息，本轮应优先消费它。  
如果没有完整 cost pricing，也至少要先建立：
- usage truth
- attribution truth
- pricing placeholder 或 cost estimation boundary

## Goal C — 建立 per-turn / per-session attribution
ConShell 后续高层能力不可能建立在“只知道总成本”的基础上。  
因此本轮至少要让系统开始回答：
- 这次对话花了多少
- 这次 turn 花了多少
- 这些 spend 属于哪个 session

## Goal D — 尽量为 action/tool spend 留出统一入口
本轮不一定要求完整 tool pricing，
但至少要建立结构，使未来可以接：
- tool invocation spend
- external API cost
- workflow cost

换句话说，本轮至少要避免把 spend attribution 写死成 only-inference silo。

## Goal E — 建立查询与审计真相
本轮不能只写入 spend data，必须至少具备某种查询真相：
- repository query
- aggregate by session / turn / kind
- 或等效审计路径

否则就不是 spend truth，只是 write-only telemetry。

## Goal F — 保持最小充分边界
本轮实现必须是：
- **最小充分经济 grounding**
- 不越级进入高层经济自治
- 真实消费 runtime path
- 可被后续 economy / governance 层复用

---

# 8. 推荐实现方案（必须比较后再选）

你必须给出至少 3 个候选方向，并明确取舍。

## 方案 A — Repository-first spend truth（推荐）
做法：
- 先统一 spend record contract
- 通过 repo 建立 write/read truth
- 再从 runtime path 写入 inference/turn/session attribution

优点：
- truth source 清晰
- 可测试
- 可审计
- 最适合作为下一阶段经济层基座

缺点：
- 需要较清晰的数据模型
- 需要 runtime integration 配合

**默认推荐此方案。**

## 方案 B — Runtime-only telemetry patch（不推荐）
做法：
- 直接在 runtime 中记录 usage/cost 日志
- 暂不建立统一 repo/query model

优点：
- 改动快

缺点：
- 容易沦为日志堆积
- 很难形成后续 economy substrate
- 不利于审计

本轮不推荐。

## 方案 C — Full economic ledger / policy-governed budget system（当前不推荐）
做法：
- 直接引入预算、定价、限制、工作价值判断等更高层系统

优点：
- 理论上更完整

缺点：
- 当前阶段明显过重
- 高风险越界
- 很容易破坏“最小充分”原则

**本轮默认不推荐。**

---

# 9. 首选实现落点（默认方案）

除非有强理由证明更优，否则本轮默认采用：

# **方案 A — Repository-first spend truth**

建议最小实现结构如下：

## 9.1 Spend Record / Spend Event 统一模型
建议建立或强化一个统一结构，例如：
- `SpendRecord`
- `SpendEvent`
- `SpendAttribution`

可以放在：
- `spend/`
- `types/`
- `state/repos/`

但必须形成清晰 contract。

## 9.2 Runtime write path 接入
优先接入：
- inference usage → spend record
- session / turn attribution

如果本轮时间与边界允许，可再加：
- tool execution attribution hooks

## 9.3 Repository query path
至少支持：
- 按 session 查询
- 按 turn 查询
- 按 kind / provider / model 查询或聚合（视当前最小实现而定）

## 9.4 Minimal exposure path
可选最小 exposure：
- runtime diagnostics
- api surface
- CLI / doctor / debug route

重点不是 UI，而是让 spend truth 可见、可核对。

---

# 10. 文件边界与修改范围建议

## 建议优先修改的文件
- `packages/core/src/spend/spend.ts`
- `packages/core/src/state/repos/spend.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/inference/index.ts`
- `packages/core/src/kernel/index.ts`
- 需要时补：`packages/core/src/types/*`

## 建议新增/修改的测试文件
- `packages/core/src/spend/spend.test.ts`
- `packages/core/src/state/repos/spend.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- 需要时新增 spend integration test

## 本轮不建议大改的区域
- `wallet/` 主路径
- `x402/`
- `dashboard/` 大 UI
- `policy/` 大治理系统
- `channels/` 大通路系统
- `multiagent/` 高层经济协调

---

# 11. 开始实施前必须回答的设计问题

## Q1. 当前项目里到底有没有 spend truth？
你必须明确区分：
- 模块存在
- 测试存在
- 生产写入路径存在
- 查询真相存在

## Q2. attribution 最小维度应是什么？
必须说明：
- per-session
- per-turn
- per-kind
- per-model / tool（若可得）
哪些是本轮必须，哪些可后续扩展。

## Q3. inference usage 当前如何进入 spend 系统？
如果当前答案是“没有统一进入”，就必须明确指出，这是本轮首要缺口。

## Q4. tool/action spend 本轮做到什么程度最合理？
必须回答：
- 本轮是完整接入
- 还是只建立 hook / contract / placeholder
- 为什么这样是最小充分方案

## Q5. 什么叫 15.3 成功？
必须避免“建了个 spend schema 就算完成”。  
至少需要回答：
- 真实 runtime 行为是否已产生 spend truth
- spend 是否可按关键 attribution 维度查询
- 上层系统是否已有可信基座可用

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 spend record contract
- record/event 结构正确
- attribution 字段正确
- 边界值 / 空值 /默认值有清晰行为

## 12.2 repository truth
- spend 数据可写入
- 可按 session / turn / kind / source 查询或聚合
- 不只是写入即结束

## 12.3 runtime integration
- inference path 真实产生 spend attribution
- turn/session context 真正被写入

## 12.4 mixed runtime flow
- 多个 turn / session 不混淆
- attribution 不串线

## 12.5 no-regression
- identity / memory / behavior guidance 相关测试不回退
- closure gate 不回退
- kernel/runtime 关键路径不回退

## 12.6 explainability / audit path
- spend truth 至少有一条可查询、可验证、可解释的对账路径

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
先输出：

```md
# Context Assimilation
# What Runtime Truth Already Covers
# What Economic Truth Still Does Not Exist
# Why 15.3 Should Start With Spend Attribution Truth
```

## Phase 2 — Economic Truth Audit
必须明确：
- 当前 spend 相关能力的真实状态
- 当前 runtime 路径有哪些未统一归因
- 当前最小 blocker 是什么
- 2–3 个候选方案与取舍

## Phase 3 — Design Decision
必须明确：
- spend attribution contract
- runtime write path
- query truth path
- minimal exposure path
- 为什么这是最小充分经济 grounding

## Phase 4 — Implement
只做最小充分实现。  
禁止越级进入完整 economy / governance 主线。

## Phase 5 — Tests & Verification
重点证明：
- runtime action cost 已开始变成真实 truth
- attribution 粒度已开始成立
- repository truth 可审计
- no-regression 不回退

## Phase 6 — Economic Grounding Verdict
明确回答：
- 本轮是否真实建立了 spend attribution truth
- 它是否足以支撑下一轮更高层 economic governance / value accounting / x402 preparation

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use
```

## 核心 spend truth 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/spend/spend.test.ts src/state/repos/spend.test.ts src/runtime/agent-loop.test.ts src/kernel/kernel.test.ts src/api-surface/api-surface.test.ts --no-coverage
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
- 如何理解当前 runtime / behavior / spend 的真实状态
- 为什么 15.3 应做 economic grounding，而不是直接做高层 economy

# Economic Truth Audit
- 当前 spend truth 存在到什么程度
- 当前 attribution 缺口是什么
- 候选方案与取舍
- 为什么选当前方案

# Design Decisions
- spend attribution contract
- runtime write path
- query truth path
- minimal exposure path
- explainability / audit contract

# Modified Files
- 改了哪些文件
- 每项改动如何推进 economic grounding truth
- 哪些改动属于 contract，哪些属于 runtime integration，哪些属于 audit/query

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明 spend truth 成立
- 哪些测试证明 attribution 成立
- 哪些测试证明 no-regression

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Economic Grounding Assessment
- action cost 是否已开始成为 runtime truth
- attribution 是否已开始成立
- 本轮是否真实为更高层 economy / governance 打下可信基础

# Final Verdict
明确回答：

> 15.3 是否已经建立了可解释、可测试、可审计的 spend attribution truth，并让 ConShell 正式进入 economic grounding 阶段？

答案只能类似：
- `YES — spend attribution truth is established and the project is ready to move toward higher-layer economic governance`
- `PARTIAL — useful economic grounding landed, but one or more attribution/runtime truth gaps remain`
- `NO — insufficient economic grounding`

# Next Round Recommendation
若 YES：说明下一轮更适合进入哪类更高层经济/治理扩张；  
若不是：列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不先审计当前 spend truth 就直接开改
2. 只做 schema，不接 runtime path
3. 只做 runtime log，不建 query truth
4. 借 15.3 偷偷扩成 economy / planner / governance 大轮
5. 跳过验证就宣称 economic grounding 已成立
6. 用 UI 或钱包展示冒充 spend attribution closure

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 统一 spend attribution contract 已建立
2. 真实 runtime path 已开始写入 spend truth
3. per-session / per-turn / per-kind attribution 至少部分成立
4. repository truth / query truth 已成立
5. identity / memory / behavior / closure 既有关键测试不回退
6. full suite + tsc 在 canonical shell 下通过
7. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是做一个“经济功能”，而是让 ConShell 第一次拥有“行动会消耗资源，消耗可以被真实记录、归因、查询、审计”的运行时现实层，把项目从 identity-aware behavior runtime 推进到具备 economic grounding 基座的自主智能体运行时。**
