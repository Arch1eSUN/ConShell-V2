# Round 15.2 — Identity-Aware Behavior Utilization & Recall Policy Integration

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“memory quality 已经够好了”当成无需验证的前提；禁止在 15.1.2 最低可靠门未成立时盲目无视问题继续扩张；也禁止继续停留在 endless hardening 中，让项目长期卡死在 memory heuristics 微调层。  
> **本轮风格要求**：高压审计约束 + 受控扩张协议 + 精准实现边界 + 强最终验收格式。你不是来继续修 prompt 文案，也不是来发散式造一个更大的行为框架；你是来把已经收稳的 identity / continuity / owner-boundary / memory intelligence substrate，第一次真正转化为**行为层价值**，并且让这种价值是**可解释、可测试、可审计、可作为下一阶段扩张基础**的。

---

# 0. 强制执行声明

本轮不是：
- 15.1.x 的继续无上限修补
- 直接跳到 economy / spend attribution / value accounting 主实现
- 为了“看起来进入新阶段”而堆一个表面行为系统
- 再造一个复杂 planner / governor / personality engine

本轮是：

# **Round 15.2 — Identity-Aware Behavior Utilization & Recall Policy Integration**

你必须把本提示词视为：

> **ConShell 在完成 runtime truth、identity continuity、owner boundary 与 memory intelligence 第一轮质量闭环后，第一次把“记得更好”推进为“行动更像同一个 self、会从经验中收敛、会让稳定偏好与教训真实影响行为”的受控扩张轮。**

这轮的关键不是“继续让 memory 更聪明”，也不是“直接让 agent 更自治”，而是：

> **让记忆与身份开始决定行为，而不是仅仅决定 prompt 里显示什么。**

本轮必须同时满足两个原则：

1. **不忽略问题**：如果 15.1.2 最低 Gate 不成立，必须先做最小补强
2. **不拖慢推进**：如果 Gate 已成立，禁止继续把本轮拖回 memory-only 修补

因此本轮执行模式是：

# **Expansion With Gate**

即：
- 先验证 15.1.2 是否足以支撑行为层扩张
- 若不足，只修直接阻断本轮的最小 blocker
- 一旦满足最低门槛，立刻进入本轮主实现
- 禁止“因为还能更完美”而无限拖延

---

# 1. 当前阶段判断

## 1.1 当前已经不再是 closure-first 阶段
前面多轮已经建立并收稳：
- canonical verification shell
- doctor / runtime truth contract
- self-state / identity continuity
- session lifecycle → continuity wiring
- owner read/write boundary
- consolidation runtime wiring
- memory retrieval intelligence 的第一版质量层

这意味着：

> **当前项目已经不是“先证明能不能运行”的阶段，而是“如何把已收稳基础设施变成上层能力收益”的阶段。**

## 1.2 当前也不适合继续只做 memory hardening
15.1 / 15.1.1 / 15.1.2 的意义已经不是“memory 能不能用”，而是：
- episodic memory 已真实进入 runtime context
- owner-aware retrieval 已进入生产路径
- relevance / dedup / anti-noise 已达到第一版可用质量
- prompt 中的经验上下文已开始结构化

如果继续只做 memory 微调：
- 项目会陷入基础层永远不出结果的循环
- 无法验证这些基础设施是否真的能改变 agent 行为
- 后续更高层能力将缺乏真实落点

因此：

> **当前最合理的下一步，不是继续死磕 15.1.x，也不是直接跳 economy，而是进入 Identity-Aware Behavior Utilization。**

## 1.3 为什么不是直接进入 Economy
原因不是 economy 不重要，而是：
- economy / spend attribution / value accounting 需要更稳定的 self-consistent behavior substrate
- 如果 agent 还不能稳定利用 preference / lesson / continuity 改变行为，那么经济层会建立在薄弱的行为语义上
- identity-aware behavior 是 memory/identity substrate 与 economy 之间最自然的中间层

因此最优顺序是：

1. **Memory Intelligence Hardening**（15.1.x，已到第一版可用质量）
2. **Identity-Aware Behavior Utilization**（本轮）
3. **Economic Grounding / Spend Attribution**（下一阶段）

---

# 2. 本轮要解决的真实问题

ConShell 现在已经开始：
- 记住更多 identity-relevant 的内容
- 更有选择地取回记忆
- 更少噪音地组织经验上下文

但它仍然缺少一个关键跨越：

> **这些记忆与身份信息，是否真正改变了 agent 的行为？**

当前系统仍极可能停留在：
- memory 被取回了
- memory 被展示了
- memory 被放进 prompt 了

但尚未形成明确、可解释、可测试的：
- preference influence
- lesson influence
- warning/caution influence
- continuity-aware recall influence
- durable vs transient behavior influence boundaries

所以本轮要解决的问题是：

> **如何让“被看见的记忆”变成“会影响行为的记忆”，并且这种影响是结构化的，而不是偶发的 prompt 运气。**

---

# 3. 本轮必须避免的七个错误

## 错误 A：把 behavior utilization 做成 prompt inflation
例如：
- 只是把 system prompt 写得更长
- 只是新增“请考虑用户偏好”一类软指令
- 但没有 behavior influence model / recall policy / 可测试规则

这不叫 behavior utilization，只叫提示词堆砌。

## 错误 B：把本轮重新做成 memory-only 修补轮
本轮允许最小 blocker 修复，
但禁止：
- 大面积重写 tier-manager 排序
- 再次主攻 dedup / echo / overlap / budget 机制
- 把本轮退化成 15.1.3 / 15.1.4

## 错误 C：把 retrieval 当成 utilization
retrieval 回来并不等于会影响行为。  
本轮必须显式建立从：
- retrieved memory
到：
- behavior guidance / influence
的转换层。

## 错误 D：把行为层做成不可解释黑盒
禁止上来就做：
- 隐式复杂打分器
- 无法解释的“行为偏向”
- 无法通过测试验证的内部启发式

本轮必须追求：
- clear rules
- explainability
- auditable transformations

## 错误 E：过早进入 economy 主实现
本轮禁止：
- spend attribution 主路径
- value accounting 主系统
- wallet-linked behavior economics
- earn-your-existence 主循环

可做 economy-compatible substrate，但不能越级实现。

## 错误 F：做成“大而全行为框架”
你不是来一次性实现：
- 完整人格系统
- 完整 planning/governor
- 复杂长期 agenda 层
- 通用 agent constitution interpreter

你只做：

> **最小充分行为层利用闭环**

## 错误 G：只证明“看起来更合理”，不证明行为真的受影响
本轮必须新增测试来证明：
- stable preference 确实进入行为指导层
- lessons / warnings 确实形成约束
- transient information 不会长期压制 durable guidance
- owner-local / continuity signals 真正影响行为层表达

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/planning/PHASED_DEVELOPMENT_SCHEME.md`
6. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
7. `docs/project/ROOT_FILE_CLASSIFICATION.md`
8. `AGENT_START_HERE.md`
9. `CONSTITUTION.md`
10. `README.md`
11. `docs/audit/DEVLOG.md`
12. `DevPrompt/0153_Round_15_1_Memory_Intelligence_Expansion_and_Identity_Relevant_Retrieval.md`
13. `DevPrompt/0154_Round_15_1_1_Memory_Intelligence_Hardening_Strategic_Brief.md`
14. `DevPrompt/0155_Round_15_1_2_Memory_Intelligence_Quality_Closure.md`
15. 若仓内存在 15.1.2 walkthrough / audit 记录，也必须读取

还必须重点阅读以下代码：

## Retrieval / memory substrate 主线
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/memory/consolidation.ts`
- `packages/core/src/memory/memory-intelligence.test.ts`

## Behavior / runtime 主线
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/tool-executor.ts`
- `packages/core/src/runtime/tools/memory.ts`
- `packages/core/src/runtime/state-machine.ts`
- `packages/core/src/kernel/index.ts`

## Identity / continuity 主线
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/persistent-registry.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`

## Integration / no-regression 主线
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/kernel/kernel.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What 15.1.x Made Real
# What Still Does Not Yet Influence Behavior
# Why 15.2 Should Focus On Identity-Aware Behavior Utilization
```

并明确回答：
- 当前 memory substrate 已经真实到什么程度
- 哪些 identity-relevant memory 现在只是被看见，还没有真正被使用
- 当前最值得打的 leverage point 是什么
- 为什么现在既不该继续死磕 memory，也不该直接跳 economy

---

# 5. Claude Opus 4.6 启动执行清单（最短路径）

> **这不是可选建议，而是本轮默认启动顺序。**  
> 目标：让 Claude Opus 4.6 用最短路径进入正确工作状态，避免一上来发散、重复读无关文件、或直接开改错误方向。

## 5.1 先读什么（严格顺序）

### Level 1 — 阶段与目标
1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `DevPrompt/0155_Round_15_1_2_Memory_Intelligence_Quality_Closure.md`
4. `DevPrompt/0156_Round_15_2_Identity_Aware_Behavior_Utilization_and_Recall_Policy_Integration.md`

### Level 2 — 当前真实实现主线
5. `packages/core/src/runtime/agent-loop.ts`
6. `packages/core/src/memory/tier-manager.ts`
7. `packages/core/src/state/repos/memory.ts`
8. `packages/core/src/identity/continuity-service.ts`
9. `packages/core/src/kernel/index.ts`

### Level 3 — 关键测试与约束主线
10. `packages/core/src/memory/memory-intelligence.test.ts`
11. `packages/core/src/runtime/tools/memory.test.ts`
12. `packages/core/src/integration/closure-gate.test.ts`
13. `packages/core/src/identity/self-truth-contracts.test.ts`
14. `packages/core/src/runtime/agent-loop.test.ts`
15. `packages/core/src/runtime/agent-loop-lifecycle.test.ts`

## 5.2 先查什么（开始设计前必须完成）

在任何实现前，必须先明确以下 4 件事：

### Check A — Gate 现状
确认 15.1.2 的最低 Gate 是否成立：
- memory intelligence tests 是否真实可跑
- no-regression tests 是否真实可跑
- `tsc --noEmit` 是否通过

### Check B — retrieval 与 behavior 的断层点
必须明确：
- 当前哪些 memory 只是被取回 / 被展示
- 当前哪些内容已经在行为层产生真实影响
- 如果几乎没有行为层影响，断层点具体在什么位置

### Check C — 最小 leverage point
必须确定最值得切入的单点，不允许一上来大而全：
优先级默认应在：
1. behavior influence extraction
2. recall policy
3. behavior guidance rendering
4. tests / explainability contract

### Check D — 现有结构是否足够承载最小实现
判断是否真的需要新增模块；
若已有结构足够承载，就不要平地起新框架。

## 5.3 先改什么（默认改动顺序）

### Step 1 — 先建行为影响层
优先新增一个轻量 behavior influence / guidance 模块，职责要单一：
- 输入：memory / identity / continuity 相关上下文
- 输出：结构化 behavior guidance

### Step 2 — 再接 agent-loop
把 behavior guidance 接入 `agent-loop.ts` 的 system prompt 构造，形成独立 section。  
禁止跳过 influence 层，直接在 `agent-loop.ts` 里散写一堆拼接逻辑。

### Step 3 — 再补最小 bridge 调整
仅在必要时调整：
- `tier-manager.ts`
- `runtime/tools/memory.ts`
- 少量类型定义

原则：
- 优先 bridge 层最小改动
- 禁止顺手重构 memory 主干

### Step 4 — 最后再补测试
不是改完再随便补几个 case，
而是围绕本轮目标补：
- preference utilization
- lesson / warning utilization
- transient vs durable separation
- identity / continuity-aware behavior
- explainability contract

## 5.4 先测什么（默认验证顺序）

### 第一组：Gate 验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/memory-intelligence.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/tools/memory.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

### 第二组：本轮新增行为层测试
必须新增并优先执行：
- behavior guidance / influence extraction tests
- preference utilization tests
- lesson / warning utilization tests
- transient vs durable influence separation tests
- continuity-aware behavior tests

### 第三组：关键 runtime 回归
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/agent-loop.test.ts src/runtime/agent-loop-lifecycle.test.ts --no-coverage
```

### 第四组：全量验证
```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

## 5.5 Claude Opus 4.6 默认执行纪律

Claude Opus 4.6 在本轮必须遵守：

1. **先过 Gate，再进入主实现**
2. **先建 influence model，再改 prompt 呈现**
3. **先解决 retrieval→utilization 的桥，再谈更高层行为智能**
4. **先补行为层测试，再声称 behavior value 已建立**
5. **如果发现需要大改 policy / planner / economy，默认说明“越界”，并回到本轮边界**

## 5.6 今后 Dev Prompt 的统一标准

从这轮开始，后续 Dev Prompt 默认都应包含一个：

# `Claude Opus 4.6 启动执行清单（最短路径）`

并至少固定覆盖四部分：
- **先读什么**
- **先查什么**
- **先改什么**
- **先测什么**

目的不是重复文档，而是：
- 降低启动噪音
- 防止模型偏离主线
- 防止一上来错误实现
- 提升不同轮次之间的执行一致性

---

# 6. 本轮的 Expansion Gate（必须先过）

本轮不允许无门槛扩张。  
在开始主实现前，必须先判断 15.1.2 是否达到**足以支撑行为层扩张的最低可靠门**。

## Gate 通过标准（最低门槛）
以下条件必须被复核并在报告中明确写出：

1. `memory-intelligence.test.ts` 关键质量测试可真实执行通过
2. `runtime/tools/memory.test.ts` 不回退
3. `closure-gate.test.ts` 不回退
4. `self-truth-contracts.test.ts` 不回退
5. `tsc --noEmit` 通过
6. 当前 15.1.2 的剩余问题，不足以阻断行为层最小扩张

## Gate 未通过时的处理规则
如果 Gate 未通过：
- 只允许修复**直接阻断本轮行为层实现**的最小 blocker
- 修完后立刻重新验证 Gate
- 禁止将本轮重命名回 memory hardening round
- 禁止发散性地继续修一堆“顺手问题”

## Gate 通过后的规则
如果 Gate 通过：
- 立即进入本轮主目标
- 不允许再以“可能还能更好”为理由继续拖延

---

# 6. 本轮目标定义

本轮的目标不是：
- 让 memory 更多
- 让 prompt 更长
- 让行为描述更花哨

而是：

# **Make Identity And Memory Actually Change Behavior**

即同时做到：

1. **让 stable preference 真正影响行为倾向**
2. **让 lesson / failure memory 真正影响风险抑制与行为约束**
3. **让 continuity / recent self change 真正影响 recall policy 或行为优先级**
4. **让 transient observation 与 durable guidance 在行为影响层被明确区分**
5. **让 identity-aware behavior 可解释、可测试、可审计**

---

# 7. 本轮必须完成的核心目标

## Goal A — 建立 Behavior Influence Model
你必须明确并尽量落地：
- memory context 中哪些内容只用于“背景参考”
- 哪些内容应进入“行为影响层”
- 行为影响层最小必须覆盖哪些 influence type

推荐最小 influence taxonomy：
- `stable_preference`
- `lesson`
- `warning`
- `continuity_priority`
- `transient_context`

本轮结束后，系统至少必须能区分：
- **短期上下文信息**
- **应持续影响 agent 行为的稳定信息**

禁止继续把所有记忆都当成同一层 prompt 素材。

## Goal B — 让 Preference 真正影响行为
你必须让系统开始体现：
- 用户长期偏好
- agent 已知稳定配置偏好
- 风格 / 输出 / tool-use 偏好

本轮不要求做成完整 personalization engine，
但至少要让：
- 高价值 preference 不只是显示在 memory section 里
- 它能被提炼成 behavior guidance
- 它能以**明确规则**影响当前 agent 的行为构造

优先考虑的实际落点：
- response style / brevity / explicitness
- tool-use preference / caution bias
- stable formatting / structure preference
- high-confidence operator preference

## Goal C — 让 Lesson / Failure Memory 真正影响行为约束
你必须让系统开始体现：
- 历史失败经验
- 已知风险提醒
- 已验证教训

对行为的真实影响，例如：
- 提高高风险操作前的审慎等级
- 避免重复已知失败路径
- 在多个方案中优先 safer / previously successful path
- 将高价值 lesson 提炼成 action guardrail

重点不是展示 lesson，
而是：

> **让教训开始改变默认行为策略。**

## Goal D — 建立 Recall Policy，而不是只做 Retrieval
当前 retrieval 解决的是“取什么”；
本轮要回答的是：

> **取到之后，如何决定它对当前行为影响多大？**

你必须尽量设计并落地一个最小 recall policy，例如：
- `stable_preference` → 高持续影响
- `lesson` / `warning` → 高约束影响
- `continuity_priority` → 中高优先行为偏向
- `transient_context` → 仅当前回合短期影响
- low-confidence / echo / low-salience shared memory → 仅参考，不主导行为

Recall policy 必须：
- 可解释
- 可测试
- 可审计
- 不黑盒

## Goal E — 将 Identity / Continuity 纳入行为利用
你必须尽量让系统开始体现：
- 当前 self 的 continuity 状态
- recent high-value owner-local experiences
- continuity / durable self traits 对当前行为优先级的影响

不要求实现完整 self-governance，
但至少必须让系统能回答：
- 当前 self 是否应更遵守稳定偏好和稳定教训
- 当前 recent high-value experience 是否应抬高某类 caution 或 preference
- owner-local durable guidance 与 shared generic knowledge 在行为层如何竞争

## Goal F — 保持扩张边界克制
本轮实现必须是：
- **最小充分行为层扩张**
- 能真实消费 15.1.x 的 memory / identity substrate
- 为下一阶段 economy / planning / higher-order behavior expansion 打下更强 substrate

禁止一口气做成复杂自治行为系统。

---

# 8. 推荐实现方案（必须比较后再选）

你必须先给出至少 3 个候选方向，并明确取舍；不能直接拍脑袋开改。

## 方案 A — Prompt-only behavior section（不推荐，通常不足）
做法：
- 仅在 `agent-loop.ts` 中新增 `Behavior Guidance` 文本分区
- 从 memory context 中抽取 preference / lesson / warning 文案
- 拼进 system prompt

优点：
- 改动小
- 风险低
- 容易落地

缺点：
- 容易退化为 prompt inflation
- 缺乏独立行为影响模型
- 很难证明“真的利用了”，而不是“只是显示了”

默认不推荐作为最终方案，除非你证明其结构足够明确且测试足够强。

## 方案 B — Lightweight Behavior Influence Layer（推荐）
做法：
- 在 runtime / memory 与 agent-loop 之间增加一层轻量 behavior influence extraction
- 从 memory context / event_type / owner-local / continuity signals 中提炼出：
  - stable preferences
  - lessons / warnings
  - continuity priorities
  - transient context
- 由该层生成结构化 behavior guidance，再进入 agent-loop

优点：
- 改动范围适中
- 行为利用逻辑独立、可测试、可审计
- 能清楚区分 retrieval 与 utilization
- 是当前最小充分扩张方案

缺点：
- 需要新增明确的模型/类型/转换逻辑
- 需要补较多测试

**默认推荐此方案。**

## 方案 C — Full policy-integrated behavior engine（当前不推荐）
做法：
- 直接把 preference / lesson / continuity 接入 policy engine 或 planner-style decision engine
- 构建更完整的行为决策层

优点：
- 理论上更系统
- 与长远自治方向更一致

缺点：
- 过重
- 当前阶段改动面过大
- 极易越级进入 agenda / governance / planner 主线
- 风险明显高于本轮所需最小充分解

**本轮默认不推荐。**

---

# 9. 首选实现落点（默认方案）

除非有强理由证明更优，否则本轮默认采用：

# **方案 B — Lightweight Behavior Influence Layer**

建议最小实现结构如下：

## 9.1 新增轻量类型 / 模型
建议新增一个轻量行为影响模型，例如：
- `BehaviorInfluence`
- `BehaviorGuidance`
- `BehaviorInfluenceType`

可能的字段示意：
- `type`
- `source`
- `strength`
- `durability`
- `guidanceText`
- `explainabilityTag`

不要求完全照此命名，但必须达到这类可解释粒度。

## 9.2 新增 influence extraction 逻辑
建议从以下来源提炼：
- `sessionSummaries`
- `recentEpisodes`
- `relevantFacts`
- `echoContext`（默认低优先）
- continuity / owner-local signals

提炼出：
- stable preferences
- lessons / warnings
- continuity priorities
- transient context

## 9.3 在 agent-loop 中引入独立 Behavior Guidance section
你应考虑在 `buildSystemPrompt()` 中加入独立结构，例如：
- `## Behavior Guidance`
- `## Stable Preferences`
- `## Lessons And Warnings`
- `## Current Continuity Priorities`

重点：
- 来源必须来自结构化影响层，而不是散乱字符串
- 每个区块都必须有规则来源
- 不允许只是“原 memory section 的另一种换皮输出”

## 9.4 Recall Policy 最小规则化
至少明确：
- 哪类 influence 持续存在
- 哪类 influence 仅对当前回合有效
- 哪类 influence 是硬 caution，哪类只是 soft preference
- shared / owner-local / continuity 在行为层如何排序

---

# 10. 文件边界与修改范围建议

## 建议优先修改的文件
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/memory/tier-manager.ts`（仅当确实需要暴露更适合 behavior extraction 的结构）
- `packages/core/src/runtime/tools/memory.ts`（仅当需要暴露新结构或对外调试）
- 可新增一个轻量模块，例如：
  - `packages/core/src/runtime/behavior-guidance.ts`
  - 或 `packages/core/src/memory/behavior-influence.ts`
  - 或等价位置

## 建议新增/修改的测试文件
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/memory/memory-intelligence.test.ts`（若需要补 bridge-level case）
- 新增一份专门测试 behavior utilization 的文件，强烈建议，例如：
  - `packages/core/src/runtime/behavior-guidance.test.ts`
  - 或同等职责文件

## 不建议本轮大改的文件
- `policy/` 大体系
- `wallet/`
- `spend/`
- `x402/`
- `dashboard/` 大规模交互逻辑
- `channels/` 大规模通道能力
- `governance / planner / economy` 相关高层系统

---

# 11. 开始实施前必须回答的设计问题

## Q1. 当前 memory 到 behavior 的桥在哪里？
如果答案是“没有，只有 system prompt 拼接”，必须明确承认。  
你不能把 retrieval 误写成 utilization。

## Q2. 哪些记忆应该持续影响行为？
你必须明确区分：
- durable preference
- learned lesson / warning
- continuity priority
- transient observation
- generic shared context

## Q3. Recall Policy 的最小可行版本是什么？
你必须明确：
- 优先级
- 持久性
- 衰减边界（如有）
- explainability contract

## Q4. continuity / identity 现在最自然的行为切入点是什么？
你必须回答：
- 是影响 response style？
- 是影响 caution level？
- 是影响 tool-use stance？
- 是影响 planning bias？
- 哪个是当前最小充分落点？

## Q5. 什么叫“行为真正受到了影响”？
你必须用可验证标准回答，而不是抽象叙事。  
例如：
- stable preference 进入独立 behavior guidance block
- lesson / warning 转成 caution guidance
- transient info 不再和 durable guidance 同权
- owner-local continuity signal 能改变行为指导优先级

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 preference utilization
- stable preference 不只是存在于 memory context
- 它能进入 behavior influence layer
- 它能形成可测试的 behavior guidance

## 12.2 lesson / warning utilization
- failure / lesson 类型记忆被提炼成 caution / guidance
- 不再只是展示给模型看

## 12.3 transient vs durable separation
- transient observation 不会长期压制 durable preference / lesson
- durable guidance 的行为影响更稳定

## 12.4 owner-local identity-aware behavior
- owner-local relevant memory 比 shared generic memory 更容易进入 behavior guidance
- 但 shared context 仍可作为补充，不被粗暴清空

## 12.5 continuity-aware behavior
- continuity / recent self-relevant experiences 能进入 behavior guidance
- 至少一条可解释规则和测试必须覆盖

## 12.6 explainability contract
- behavior influence / guidance 的生成必须可解释
- 测试应验证类别、排序或文本区块来源，而不是仅凭肉眼感受

## 12.7 no regression
- `memory-intelligence.test.ts`
- `runtime/tools/memory.test.ts`
- `closure-gate.test.ts`
- `self-truth-contracts.test.ts`
- 关键 runtime tests
全部不得回退

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
先输出：

```md
# Context Assimilation
# What 15.1.x Made Real
# What Still Does Not Yet Influence Behavior
# Why 15.2 Should Focus On Identity-Aware Behavior Utilization
```

## Phase 2 — Expansion Gate Check
必须先明确：
- Gate 是否通过
- 如果不通过，阻断本轮的最小 blocker 是什么
- 最小补强是什么
- 为什么不应把本轮重新拖回 memory-only round

## Phase 3 — Behavior Utilization Audit
必须列出：
- 当前 retrieval 与 utilization 的差距
- 当前行为层缺失点
- 2–3 个候选实现方向
- 推荐方向与放弃其他方向的原因

## Phase 4 — Design Decision
必须明确：
- behavior influence model
- recall policy
- preference utilization strategy
- lesson / warning utilization strategy
- identity / continuity utilization strategy
- explainability contract

## Phase 5 — Implement
只做最小充分实现。  
禁止越级扩成 agenda / planner / economy 主线。

## Phase 6 — Tests & Verification
重点证明：
- identity / memory 不只是被看见，而是真正开始影响行为
- influence model 可解释、可测试、可审计

## Phase 7 — Expansion Value Verdict
明确回答：
- 本轮是否成功把 identity/memory substrate 转成 behavior-layer value
- 是否为下一轮 economy / planning / broader behavior expansion 建立更强 substrate

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use
```

## Gate 验证（先执行）

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/memory-intelligence.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/tools/memory.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

## 本轮新增验证（必须新增并执行）
你还必须新增并执行真正证明以下事项的测试：
- behavior influence extraction
- preference utilization
- lesson / warning utilization
- transient vs durable influence separation
- identity / continuity-aware behavior guidance
- explainability contract

然后继续：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。  
**若依赖缺失或环境问题导致验证无法完成，必须在最终报告中写为未完成验证，不得伪造通过。**

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
- 如何理解当前 15.1.x 的真实状态
- 为什么当前进入 15.2 合理

# Expansion Gate Check
- Gate 是否通过
- 若未通过，最小 blocker 是什么
- 你做了哪些最小补强（若有）

# Behavior Utilization Audit
- 当前 retrieval 与 utilization 的差距
- 当前行为层缺失点
- 候选方案与取舍
- 为什么选当前方案

# Design Decisions
- behavior influence model
- recall policy
- preference utilization strategy
- lesson / warning utilization strategy
- identity / continuity utilization strategy
- explainability contract

# Modified Files
- 改了哪些文件
- 每项改动如何把 memory/identity 转化为 behavior value
- 哪些改动影响 preference，哪些影响 lesson / warning，哪些影响 continuity

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明行为层利用真实成立
- 哪些测试证明 explainability 与 no-regression

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Expansion Value Assessment
- 本轮是否真实建立了 identity-aware behavior utilization
- 它如何降低下一轮 economy / planning / behavior expansion 的成本
- 它是否真的消费了 15.1.x 的 substrate，而不是表面拼接

# Final Verdict
明确回答：

> 15.2 是否成功把 identity / memory substrate 转化为可解释、可测试、可审计的 behavior-layer value？

答案只能类似：
- `YES — identity-aware behavior utilization is established and the project is ready to move toward higher-layer expansion`
- `PARTIAL — useful behavior-layer utilization landed, but one or more critical gaps still limit higher-layer expansion`
- `NO — insufficient behavior-layer utilization`

# Next Round Recommendation
若 YES：说明下一轮更适合进入哪类高层扩张（优先考虑 economic grounding / spend attribution 或更高层 planning utilization）；  
若不是：列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不做 Expansion Gate 就直接开始扩张
2. 不区分 retrieval 与 utilization，就声称 behavior 层已成立
3. 借本轮偷偷推进 economy / agenda / planner 主线
4. 用更长 prompt 伪装 behavior utilization
5. 不补行为层验证，只靠存在性测试
6. 明知 Gate 不成立还继续写成“可直接进入高层扩张”
7. 输出一种无法被代码与命令回溯的 expansion success 结论

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. 15.1.2 最低 Gate 成立，或仅经最小补强后成立
2. stable preference 开始真实影响行为指导
3. lesson / warning 开始真实影响行为约束
4. transient 与 durable influence 被明确区分
5. identity / continuity 开始对行为层产生可解释影响
6. 行为层影响被测试证明，而不是仅靠 prompt 叙事
7. memory / identity / closure 既有关键测试不回退
8. full suite + tsc 在 canonical shell 下通过
9. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续只让 agent “记得更好”，也不是过早进入经济主线，而是把已经收稳的 identity / continuity / owner-boundary / memory intelligence substrate 真正转化为第一版可解释、可测试、可审计的 behavior-layer value，让 ConShell 开始在“如何根据自己是谁、记得什么、学到了什么来行动”上体现真实的系统进化。**
