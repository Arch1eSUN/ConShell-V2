# Round 15.2.1 — Behavior Integration Closure & Continuity Wiring Truth

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把 15.2 已有的真实进展抹掉重做；禁止把本轮重新扩成新的 behavior 大轮；禁止继续停留在“看起来已经有 behavior guidance 了”的自我安慰阶段。  
> **本轮风格要求**：高压审计约束 + 最小充分补强协议 + 强生产路径对账 + 强最终验收格式。你不是来发明新路线图，也不是来继续拓展 behavior 功能表面积；你是来**把 15.2 已经搭出的 behavior influence layer 真正接入生产路径、补足 continuity wiring、修正错误门控，并用真实测试把 15.2 从 PARTIAL 推到可判 YES 的闭环状态。**

---

# 0. 强制执行声明

本轮不是：
- 新的 behavior expansion round
- economy / spend attribution round
- planner / agenda / governor round
- memory hardening round
- prompt 美化 round

本轮是：

# **Round 15.2.1 — Behavior Integration Closure & Continuity Wiring Truth**

你必须把本提示词视为：

> **对 15.2 的最小充分闭环修复。目标不是扩更多，而是把已经存在的 behavior-layer 价值真正变成生产事实。**

本轮只回答一个问题：

> **15.2 新增的 behavior guidance，到底是否已经真实进入生产路径，并且 continuity / identity 信号是否真正能在 runtime 中稳定生效？**

如果答案是否定的，就必须：
- 找出最小 blocker
- 做最小补强
- 重新验证
- 把 15.2 从 PARTIAL 推到可判 YES 的状态

禁止：
- 顺手扩更多 behavior feature
- 顺手重写 memory retrieval
- 顺手进入 economy
- 因为发现小问题就重新发明整套架构

---

# 1. 当前阶段判断

## 1.1 15.2 的真实进展必须保留
15.2 已经做成的真实成果，不允许在本轮被抹掉或重做：
- 新建了独立的 `runtime/behavior-guidance.ts`
- 建立了 5 种 influence type
- 建立了 `StructuredEpisode -> BehaviorGuidance` 的桥
- 建立了 durable / transient 区分
- 建立了 explainability contract（source / strength / durability）
- 在 `agent-loop.ts` 中新增了 `## 🎯 Behavior Guidance` section
- 新增了 `behavior-guidance.test.ts`

因此：

> **本轮不是质疑 15.2 有没有价值，而是修正 15.2 尚未闭环的生产接线问题。**

## 1.2 15.2 当前仍是 PARTIAL 的根本原因
根据当前审计，15.2 之所以仍不能直接判 YES，不是因为方向错了，而是因为存在以下两个关键缺口：

### 缺口 A — `SelfState -> AgentLoop` 生产路径未被证实真实接线
当前 `agent-loop.ts` 已有：
- `setSelfState()`
- behavior guidance 提取逻辑

但必须确认 `Kernel` 真实 boot/runtime 路径中：
- 是否调用了 `agentLoop.setSelfState(...)`
- 是否使用的是 live `selfState`
- 是否在真实运行时，而不只是测试/手工注入场景中成立

### 缺口 B — continuity guidance 被 episode 存在性错误门控
当前如果 behavior guidance 的生成被 `structuredEpisodes.length > 0` 这种条件包住，就会导致：
- 即使 `selfState` 存在
- 即使 continuity guidance 本应生成
- 只要没有 episode，也不会渲染 behavior guidance

这会让 continuity signal 不是 first-class influence，而是 episode 的附属条件。

### 次级缺口 C — 缺少“无 episode 但有 selfState 时仍应渲染 continuity guidance”的生产路径证明测试
这意味着：
- behavior guidance 目前更多是模块存在与部分 runtime path 存在
- 还不是完整的 production truth

因此本轮目标不是扩张，而是：

> **把这几个具体缺口补齐，使 15.2 的 behavior-layer integration 变成生产事实。**

---

# 2. 本轮必须避免的六个错误

## 错误 A：把本轮重新做成大规模 behavior 扩张
禁止新增：
- 新的 influence taxonomy
- 更大的 guidance hierarchy
- 更复杂的 planner / governor 接入
- 新的 high-level behavior system

本轮只补闭环，不扩表面积。

## 错误 B：把本轮退化成 memory hardening round
不要借“behavior 没完全成立”之名，回头大改：
- tier-manager ranking
- dedup
- echo
- budget reflow
- retrieval heuristics

除非直接阻断本轮 closure，否则都不应该动。

## 错误 C：只修 unit test，不修生产路径
如果只是让 `behavior-guidance.test.ts` 更好看，
但不修 `Kernel -> AgentLoop` 真接线，
那本轮仍然不能判 YES。

## 错误 D：把 continuity signal 继续当作 episode 的附属品
continuity guidance 必须是：
- 独立 influence source
- 可单独成立
- 不依赖 episode 是否存在

## 错误 E：在未验证生产路径前宣称闭环
只跑 unit tests 不足以证明本轮成功。  
必须证明：
- live selfState 进入 agent-loop
- 无 episode 时 continuity guidance 仍然生成
- runtime path 与测试 path 对账

## 错误 F：顺手解决一堆无关问题
本轮是 closure repair，不是 cleanup sprint。  
禁止顺手：
- 大量改命名
- 重排模块结构
- 重构测试体系
- 扩 UI / dashboard / channels

---

# 3. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `DevPrompt/0156_Round_15_2_Identity_Aware_Behavior_Utilization_and_Recall_Policy_Integration.md`
4. 若存在 15.2 的 walkthrough / 审计记录，必须读取

还必须重点阅读以下代码：

## 核心生产接线主线
- `packages/core/src/kernel/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/behavior-guidance.ts`
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/identity/continuity-service.ts`

## 关键测试主线
- `packages/core/src/runtime/behavior-guidance.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- `packages/core/src/memory/memory-intelligence.test.ts`
- `packages/core/src/runtime/tools/memory.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What 15.2 Already Made Real
# What Still Prevents A True YES
# Why 15.2.1 Must Be A Production-Path Closure Round
```

并明确回答：
- 15.2 已经真实做成了什么
- 当前卡住 15.2 的 blocker 是什么
- 哪些是 blocker，哪些只是可选增强
- 为什么本轮不应继续扩张，只应做最小 closure

---

# 4. Claude Opus 4.6 启动执行清单（最短路径）

> **这不是建议，而是默认启动顺序。**
> 目标：最短路径确认 15.2 的生产接线真相，然后做最小补强并验证。

## 4.1 先读什么（严格顺序）

### Level 1 — 阶段与目标
1. `DevPrompt/0156_Round_15_2_Identity_Aware_Behavior_Utilization_and_Recall_Policy_Integration.md`
2. `README.md`
3. `docs/audit/DEVLOG.md`

### Level 2 — 当前闭环问题主线
4. `packages/core/src/runtime/behavior-guidance.ts`
5. `packages/core/src/runtime/agent-loop.ts`
6. `packages/core/src/kernel/index.ts`
7. `packages/core/src/memory/tier-manager.ts`
8. `packages/core/src/identity/continuity-service.ts`

### Level 3 — 关键测试主线
9. `packages/core/src/runtime/behavior-guidance.test.ts`
10. `packages/core/src/runtime/agent-loop.test.ts`
11. `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
12. `packages/core/src/kernel/kernel.test.ts`
13. `packages/core/src/memory/memory-intelligence.test.ts`
14. `packages/core/src/runtime/tools/memory.test.ts`
15. `packages/core/src/integration/closure-gate.test.ts`
16. `packages/core/src/identity/self-truth-contracts.test.ts`

## 4.2 先查什么（设计前必须完成）

### Check A — `Kernel -> AgentLoop.setSelfState()` 是否真实存在
必须确认：
- 是否调用
- 在何时调用
- 是否使用 live selfState
- 是否会在 boot 后真实进入 runtime path

### Check B — behavior guidance 渲染门控是否错误
必须确认：
- behavior guidance 是否被 `structuredEpisodes.length > 0` 或等价条件错误门控
- continuity-only guidance 是否会被跳过

### Check C — 当前最小 blocker 是什么
优先级默认应为：
1. production wiring
2. continuity-only rendering path
3. production-path verification test

### Check D — 是否需要大改结构
默认答案应为：
- **不需要**
- 只做最小补强

除非你能证明当前结构根本无法承载 closure。

## 4.3 先改什么（默认改动顺序）

### Step 1 — 先修生产接线
优先确保：
- `Kernel` 在真实 boot 路径中把 `selfState` 传给 `AgentLoop`

### Step 2 — 再修错误门控
确保：
- 即使没有 `structuredEpisodes`
- 只要有 `selfState`
- 也能生成并渲染 continuity guidance

### Step 3 — 再补最小生产路径测试
优先新增/修改测试来证明：
- 有 selfState、无 episodes 时，behavior guidance 仍可渲染
- boot/runtime path 中 selfState 确实进入 agent-loop

### Step 4 — 最后做最小 mock 与类型对齐
只修本轮 closure 所必需的 mock / typings；
禁止顺手做大规模 cleanup。

## 4.4 先测什么（默认验证顺序）

### 第一组：本轮核心 closure tests
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/behavior-guidance.test.ts src/runtime/agent-loop.test.ts src/runtime/agent-loop-lifecycle.test.ts src/kernel/kernel.test.ts --no-coverage
```

### 第二组：原有 Gate / no-regression
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/memory-intelligence.test.ts src/runtime/tools/memory.test.ts src/integration/closure-gate.test.ts src/identity/self-truth-contracts.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

### 第三组：全量验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

## 4.5 Claude Opus 4.6 默认执行纪律

1. **先对账生产路径，再改代码**
2. **先修 wiring，再修 rendering 条件**
3. **先补证明 behavior closure 的测试，再声称 15.2 已达 YES**
4. **发现需要更大扩张时，默认视为越界，不进入**
5. **任何“顺手优化”若不直接支撑 closure，默认不做**

---

# 5. 本轮目标定义

本轮目标不是“让 behavior guidance 更复杂”，而是：

# **Make 15.2 Behavior Guidance Production-True**

也就是同时做到：

1. **让 live selfState 真实进入 agent-loop 生产路径**
2. **让 continuity guidance 成为独立 influence source，而非依赖 episode 的附属条件**
3. **让无 episode 的 continuity-only 场景也能正确渲染 behavior guidance**
4. **让生产路径测试能够证明上面 3 点真实成立**
5. **在不扩功能表面积的前提下，把 15.2 从 PARTIAL 推到可判 YES**

---

# 6. 本轮必须完成的核心目标

## Goal A — 修复 SelfState 生产接线
你必须确认并尽量落地：
- `Kernel.boot()` 或等价生产启动路径中
- `identityResult.selfState` 是否传递给 `AgentLoop`
- 若未传递，必须补齐

这一步完成后，必须能清楚回答：

> **behavior guidance 中的 continuity context，是不是已经从“模块可支持”变成了“生产路径真实存在”。**

## Goal B — 去掉 continuity guidance 的错误门控
你必须确认并尽量落地：
- behavior guidance 的生成条件不能只依赖 `structuredEpisodes.length > 0`
- 应允许：
  - `structuredEpisodes` 有值时生成
  - 或 `selfState` 有值时生成
  - 两者同时存在时合并生成

这一步完成后，必须能清楚回答：

> **continuity guidance 是否已经是 first-class influence source。**

## Goal C — 建立 continuity-only 场景的测试证明
至少要补一条关键测试：
- 无 structured episodes
- 有 selfState
- 仍能生成/render behavior guidance

如果这条测试没有，本轮很难判 YES。

## Goal D — 建立 production-path 对账测试
你必须尽量补一条或强化现有测试，证明：
- `Kernel` / runtime wiring 中，selfState 已真实交给 agent-loop
- 不是测试中手工注入、生产中缺失

## Goal E — 保持本轮最小充分
本轮只允许做 closure 所需的最小改动。  
禁止：
- 再扩更多 influence type
- 再扩更多 behavior sections
- 再重写 recall policy
- 再扩 memory substrate 覆盖面

---

# 7. 非目标

除非完成本轮目标必须依赖，否则本轮禁止：

1. 不进入 economy / spend attribution
2. 不进入 planner / agenda / governor
3. 不继续扩 memory intelligence 本体
4. 不新增复杂 behavior ranking
5. 不大改 dashboard / channels / UI
6. 不做非 closure 必需的 cleanup/refactor

---

# 8. 推荐实现方案（默认只允许最小方案）

## 方案 A — 最小生产接线补强（推荐）
做法：
- 在 `Kernel` 中真实注入 `selfState` 到 `AgentLoop`
- 在 `agent-loop.ts` 中放宽 behavior guidance 生成门槛
- 新增 continuity-only / production-path 测试

优点：
- 改动最小
- 风险最低
- 与本轮 closure 目标完全一致

缺点：
- 不会扩展 behavior 能力表面积
- 不是新功能轮

**本轮默认必须采用此方案。**

## 方案 B — 顺手扩大 behavior influence 覆盖面（不推荐）
例如：
- 把 semantic/procedural/relationship 也接入 behavior guidance
- 扩更多 influence categories

这是下一轮或更后续 round 的事情，当前不推荐。

---

# 9. 文件边界与修改范围建议

## 建议优先修改的文件
- `packages/core/src/kernel/index.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/behavior-guidance.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/kernel/kernel.test.ts`

## 通常不应修改，除非 closure 直接依赖
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/memory/memory-intelligence.test.ts`

## 本轮不应大改的区域
- `policy/`
- `wallet/`
- `spend/`
- `x402/`
- `dashboard/`
- `channels/`
- `economy / planner / governance`

---

# 10. 开始实施前必须回答的设计问题

## Q1. 当前 `selfState` 到底有没有进入 production agent-loop？
答案必须基于代码与测试，不得凭印象。

## Q2. 当前 continuity guidance 为什么会丢失？
你必须明确：
- 是因为没传 selfState？
- 还是因为渲染前置条件错误？
- 还是两者都有？

## Q3. 本轮最小补强是什么？
你必须避免“修着修着又开始扩新功能”。

## Q4. 什么叫本轮 closure 成立？
至少必须满足：
- selfState 生产接线成立
- continuity-only 场景成立
- 核心与 no-regression 测试通过

---

# 11. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 11.1 production wiring test
- Kernel/boot path 将 selfState 真实传入 AgentLoop

## 11.2 continuity-only rendering test
- 无 episodes，有 selfState → 仍渲染 Behavior Guidance

## 11.3 mixed rendering test
- 有 episodes + 有 selfState → behavior guidance 同时包含 memory-derived 与 continuity-derived 内容

## 11.4 no-regression
- 15.2 既有 behavior-guidance tests 不回退
- 15.1.2 memory tests 不回退
- closure / self-truth / runtime tools tests 不回退

---

# 12. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
先输出：

```md
# Context Assimilation
# What 15.2 Already Made Real
# What Still Prevents A True YES
# Why 15.2.1 Must Be A Production-Path Closure Round
```

## Phase 2 — Production Path Audit
必须明确：
- `Kernel -> AgentLoop.setSelfState()` 是否真实存在
- behavior guidance 渲染门控是否正确
- continuity-only 场景为何当前无法稳定成立

## Phase 3 — Minimal Closure Design
必须明确：
- 最小补强点
- 为什么这些补强足够
- 为什么不需要更大改动

## Phase 4 — Implement
只做最小充分修复。  
禁止扩张。

## Phase 5 — Tests & Verification
重点证明：
- 生产接线真实成立
- continuity guidance 可独立成立
- no-regression 不回退

## Phase 6 — Closure Verdict
明确回答：
- 15.2 是否已被 15.2.1 推到可判 YES
- 如果仍不是，剩余 blocker 是什么

---

# 13. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use
```

## 核心 closure 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/behavior-guidance.test.ts src/runtime/agent-loop.test.ts src/runtime/agent-loop-lifecycle.test.ts src/kernel/kernel.test.ts --no-coverage
```

## Gate / no-regression 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/memory-intelligence.test.ts src/runtime/tools/memory.test.ts src/integration/closure-gate.test.ts src/identity/self-truth-contracts.test.ts --no-coverage
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

# 14. 人工执行命令协议

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

# 15. 最终输出格式

完成后必须按以下 Markdown 结构输出：

# Context Assimilation
- 读取了哪些文件
- 如何理解当前 15.2 的真实状态
- 为什么 15.2.1 是 closure round 而不是 expansion round

# Production Path Audit
- `Kernel -> AgentLoop` 是否真实接线
- behavior guidance 渲染门控是否正确
- continuity-only 场景当前为何不成立

# Minimal Closure Design
- 最小补强点
- 为什么这些改动足够
- 为什么没有越界扩张

# Modified Files
- 改了哪些文件
- 每项改动如何推进 production truth

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明 production wiring 成立
- 哪些测试证明 continuity-only guidance 成立
- 哪些测试证明 no-regression

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Closure Assessment
- selfState 是否已真实进入 agent-loop 生产路径
- continuity guidance 是否已成为 first-class influence source
- 15.2 是否已可判 YES

# Final Verdict
明确回答：

> 15.2.1 是否已经把 15.2 从 PARTIAL 推到 production-true, continuity-wired, behavior-layer-closure YES？

答案只能类似：
- `YES — behavior integration closure is established and 15.2 is now production-true`
- `PARTIAL — useful closure landed, but one or more production-path blockers remain`
- `NO — insufficient closure`

# Next Round Recommendation
若 YES：说明下一轮更适合进入哪类更高层扩张；  
若不是：列出最小剩余阻塞清单。

---

# 16. 严格禁止事项

你绝对不能做这些事：

1. 不先审计生产路径就直接改代码
2. 只修 unit path，不修 production wiring
3. 继续让 continuity guidance 依赖 episodes 才出现
4. 借本轮偷偷扩 behavior 功能表面积
5. 借本轮重新进入 memory hardening / economy / planner 主线
6. 不跑验证就声称 15.2 已达 YES

---

# 17. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. live selfState 已真实进入 agent-loop 生产路径
2. continuity-only guidance 场景已成立
3. behavior guidance 不再错误依赖 episodes 才能渲染
4. 关键 closure tests 通过
5. memory / identity / no-regression tests 不回退
6. full suite + tsc 在 canonical shell 下通过
7. 最终结论真实、克制、可审计

---

# 18. 一句话任务定义

> **本轮的任务不是继续扩更多 behavior 功能，而是把 15.2 已经建立的 behavior influence layer 真正接入生产路径、补齐 continuity wiring、修正错误门控，并用真实测试把它从“模块存在”推进到“production-true behavior closure”。**
