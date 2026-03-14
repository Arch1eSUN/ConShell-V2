# Round 15.1 — Memory Intelligence Expansion & Identity-Relevant Retrieval

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“更多记忆”误当成“更高质量记忆”；禁止在 retrieval relevance 未提升前盲目扩充 memory surface；禁止把 noise 扩大器包装成 memory intelligence；禁止在当前轮次中越级进入 economic grounding 主实现。  
> **本轮风格要求**：扩张开发第一轮，但依然保持高压审计约束、精准实施协议、强最终验收格式。你不是来重新收口旧 closure，而是来**真正消费前面已经收稳的 identity / continuity / owner-boundary 基础设施，把它转化为更强的记忆质量与更聪明的 retrieval 行为**。

---

# 0. 强制执行声明

本轮是 expansion round。  
但它不是“随便开始扩张”。  
它是：

# **Round 15.1 — Memory Intelligence Expansion & Identity-Relevant Retrieval**

你必须把本提示词视为**解锁扩张后的第一轮高杠杆开发协议**。你必须：
- 先读上下文与最近几轮 closure / audit / expansion unlock 结果
- 明确当前 memory 系统已经具备哪些基础
- 明确当前 retrieval / consolidation 质量的真实瓶颈
- 设计 2–3 个候选提升方向并选择最小充分方案
- 实施真正提高质量的改动，而不是表面增添更多 memory
- 用明确测试与验证证明：
  - context 更 relevant
  - noise 更少
  - identity relevance 真正影响 retrieval
  - consolidation 更稳

禁止：
- 把“记忆条目更多”当成“记忆质量更高”
- 只加参数 / 只加开关 / 只加字段，不提升真实效果
- 让 retrieval 变得更复杂但更不可解释
- 借本轮顺手进入经济层主逻辑
- 借本轮顺手大改 UI / dashboard / channels
- 把“未来可能很厉害”的设计文案当成本轮已完成工作

---

# 1. 本轮定位

本轮不是 closure round。  
本轮也不是 economy round。  
本轮是：

> **Expansion unlocked 之后，第一轮真正兑现基础设施价值的高杠杆扩张。**

前面多轮开发已经把这些基础设施收稳到可用水平：
- continuity / checkpoint semantics
- owner-aware context boundary
- owner-scoped continuity count
- persistent identity registry
- consolidation runtime wiring
- runtime-doctor production path

现在的问题不再是“系统有没有这些结构”，而是：

> **这些结构有没有真的让 agent 记得更准、取得更准、用得更对。**

因此本轮的任务是把“结构成立”转化为“质量收益成立”。

---

# 2. 为什么 15.1 应该先做 Memory Intelligence，而不是先做 Economy

虽然当前项目已经足以进入扩张，但最合理的第一扩张方向不是经济层，而是：

> **先把 identity / memory 基础设施转成真实的认知质量杠杆。**

原因：

1. 经济层建立在身份、记忆、归因之上  
   如果 retrieval 质量还不够稳，经济语义会被噪音污染。

2. 当前基础设施最容易产生产出的位置就是 memory quality  
   这是离现在代码最近、风险最低、收益最高的扩张点。

3. Memory Intelligence 一旦做好，后续所有高层能力都会获益  
   包括：
   - planning
   - long-horizon tasks
   - self-coherence
   - spend attribution
   - agent registry utilization

所以本轮的最优定位不是“再加更多模块”，而是：

> **提高已有 memory substrate 的实际可用性与判别力。**

---

# 3. 本轮必须避免的五个错误

## 错误 A：把 memory expansion 做成 memory inflation
例如：
- 更多 episodic
- 更多 summaries
- 更多 facts
- 更多 pipeline stages

但没有提升 relevance / precision / utility。  
这是典型的“看起来更聪明，实际上更吵”。

## 错误 B：只强化 consolidation，不强化 retrieval 选择逻辑
consolidation 只是上游加工。  
如果 retrieval ranking 仍然粗糙，最终 prompt 质量不会真正提升。

## 错误 C：引入复杂排序，却无法解释为什么命中这些记忆
本轮的 memory intelligence 必须：
- 更准
- 更稳
- **仍然可解释**

## 错误 D：把 identity relevance 继续停留在 owner filter 层
owner filter 只是边界，不是 intelligence。  
本轮要做的是：

> **让 identity relevance 参与排序、裁剪、优先级决策。**

## 错误 E：提前跳到 economy 主实现
本轮允许为 economy 做准备，但禁止直接做其主逻辑。  
否则会重新打散当前最佳扩张顺序。

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
10. `docs/audit/DEVLOG.md`
11. `README.md`
12. `DevPrompt/0151_Round_15_0_1_Final_Gap_Closure_Documentation_Reconciliation_and_Release_Readiness.md`
13. `DevPrompt/0152_Round_15_0_2_Last_Closure_Before_Expansion_and_Expansion_Unlock_Criteria.md`
14. 最新 Phase 2 / 15.0.2 walkthrough 与审计结论（若项目内有记录，必须读）

还必须重点阅读这些代码：
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/memory/consolidation.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/persistent-registry.ts`
- `packages/core/src/integration/closure-gate.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What Memory Infrastructure Is Now Stable
# Where Memory Quality Is Still Weak
# Why 15.1 Should Focus On Retrieval Intelligence
```

并明确回答：
- 当前 memory 基础设施已经稳定到什么程度
- retrieval / consolidation 的真实弱点是什么
- 哪些问题是质量问题，不是结构问题
- 为什么本轮不该先做 economy
- 本轮的成功标准是什么

---

# 5. 当前可信基线（必须据此工作）

以下内容视为当前已知可信输入，但仍必须复核：

## 5.1 closure 与验证基线
- `.nvmrc = v24.10.0`
- canonical verification shell：`v24.10.0 / ABI 137`
- 15.0.2 审计结论：**YES — expansion formally unlocked**
- 最近一次可信 full suite：**659 / 659 pass**
- `tsc --noEmit`：通过

## 5.2 当前 memory substrate 已具备的能力
- `buildContext()` 在 owner-injected runtime 下已 owner-aware
- `buildContextForOwner(ownerId)` 存在
- `ConsolidationPipeline` 已进入 runtime path
- checkpoint semantics 已收正为 `checkpointTurn`
- continuity advance 已采用 owner-scoped episode count

## 5.3 当前最可能的质量瓶颈
虽然结构已成立，但仍可合理预期存在以下质量瓶颈：
- episodic retrieval 主要靠 importance + created_at，相关性仍偏粗
- session summaries 与 episodic episodes 可能存在信息重叠与 prompt 冗余
- consolidation salience 仍偏 heuristic，可能召回噪音或漏掉高价值信息
- owner-aware 只是边界，不等于 identity-relevant ranking
- shared memory tiers（semantic / procedural / relationship）的进入顺序可能仍过于静态

这些不是 closure bug，而是**expansion 值得打的第一批高杠杆质量战**。

---

# 6. 本轮目标定义

本轮的目标不是“让 memory 系统更复杂”，而是：

# **Increase Memory Relevance, Reduce Noise, And Make Identity Matter In Retrieval**

也就是同时做到：

1. **提高 retrieval relevance**
2. **降低无关记忆进入上下文的概率**
3. **让 identity relevance 真正参与排序与优先级**
4. **让 consolidation 更稳、更有价值**
5. **让 memory context 更可解释、更可审计**

---

# 7. 本轮必须完成的核心目标

## Goal A — 提升 retrieval ranking，而不是只做 owner filtering
你必须明确并尽量落地：
- 当前 `buildContext()` 的排序依据有哪些
- 哪些仍然过于静态 / 过于粗糙
- identity relevance 如何参与 ranking，而不只是参与过滤
- recent / important / owner-relevant / summary-derived signals 如何合成

本轮完成后，必须能够回答：

> **memory context 的进入顺序是否变得更相关、更可解释，而不是仅仅“属于同一个 owner”。**

## Goal B — 减少 prompt 中 memory noise 与冗余
你必须尽量降低：
- session summary 与 episodic 的重复信息
- 低价值 shared facts 挤占上下文预算
- procedural / relationship / semantic tiers 的静态噪音

重点不是让 memory 变少，而是：

> **让进入 prompt 的记忆更值钱。**

## Goal C — 提升 consolidation 质量与稳定性
你必须明确并尽量落地：
- 当前 consolidation 的 heuristic salience 弱点
- 是否需要更好的 scoring / threshold / filtering
- 是否需要更明确的 dedup / idempotency / anti-repeat contract
- consolidation 结果如何更好服务 retrieval，而不是只增加 episodic 条目数

## Goal D — 让 identity relevance 参与 retrieval intelligence
你必须让系统不仅知道“这些记忆属于谁”，还要开始知道：
- 当前 self 更应该优先看哪些记忆
- continuity / recent self changes 是否应影响 retrieval priority
- owner-local memories 与 shared knowledge 应如何竞争 token budget

## Goal E — 保持 context 可解释、可审计
本轮不能做一个“更复杂但更黑盒”的 ranking 系统。  
你必须让排序逻辑仍然能够被：
- 测试
- 注释
- 审计
- 日志（如必要）
清楚解释。

## Goal F — 为下一阶段 economy / behavior expansion 准备更强 substrate
本轮虽然不进入 economy 主逻辑，但必须让下一阶段更容易回答：
- 当前 self 真的记住了什么
- 哪些经验值得持续影响行为
- 哪些信息可用于价值、成本、承诺、长期目标归因

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止：

1. 不进入 economic grounding 主逻辑
2. 不进入钱包 / spend attribution 主实现
3. 不推进 replication / governance / collective layers
4. 不大改 UI / dashboard / channels
5. 不为了“AI 更聪明”而引入过度复杂的 vector infra（除非仓内已具备明确基础且必要）
6. 不做无边界 memory schema 重构
7. 不把扩张 round 再次拖回 closure repair

---

# 9. 必须重点阅读和理解的模块 / 文件

## Retrieval / context 主线
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/tools/memory.ts`
- `packages/core/src/server/routes/memory.ts`

## Consolidation 主线
- `packages/core/src/memory/consolidation.ts`
- `packages/core/src/memory/consolidation.test.ts`
- `packages/core/src/kernel/index.ts`

## Repositories / signals 主线
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/identity/continuity-service.ts`
- `packages/core/src/identity/persistent-registry.ts`

## 现有测试主线
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`
- `packages/core/src/runtime/agent-loop-lifecycle.test.ts`
- `packages/core/src/kernel/kernel-continuity.test.ts`
- `packages/core/src/runtime/tools/memory.test.ts`

---

# 10. 开始实施前必须回答的设计问题

## Q1. 当前 retrieval 真正按什么排序？
你必须明确：
- summary/facts/relationships/episodes/skills 的进入顺序
- 每一层内部的排序依据
- 当前最大的 relevance 缺口在哪里

## Q2. identity relevance 应如何进入 ranking？
你必须明确：
- 仅 owner-filter 是否足够（答案大概率是否）
- continuity / recent changes / owner-local recency 是否应影响排序
- shared tiers 如何与 owner-local tiers 竞争预算

## Q3. consolidation 的产物到底服务什么？
你必须明确：
- consolidation 是为了生成更多 episodic 吗
- 还是为了生成更有 retrieval 价值的 episodic
- 当前 pipeline 是否在生产有用信号，而不是只制造更多数据

## Q4. 什么叫“更智能的 retrieval”？
你必须用可验证标准回答，而不是抽象愿景。  
例如：
- 更少噪音
- 更少重复
- 更高 identity relevance
- 更稳定的 context quality

## Q5. 本轮最小成功标准是什么？
必须避免再次出现：
- 做了很多代码
- 但质量提升不可证明

---

# 11. 推荐实施方向

## Direction 1 — 先做 ranking intelligence，再做更多存储
优先提升“怎么选”，不要先提升“存更多”。

## Direction 2 — 先减少 summary / episodic 冗余
这通常是 prompt 污染的第一来源。

## Direction 3 — 让 owner-local relevance 获得优先权，但不要盲目压死 shared knowledge
目标是更聪明，不是更偏执。

## Direction 4 — consolidation 要为 retrieval 服务，而不是为数据库堆积服务
如果 consolidation 产物不提升 retrieval，就不是好扩张。

## Direction 5 — 保持可解释性
复杂度可以上升，但不可解释性不能同步上升。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 retrieval ranking quality
- 更高 relevance 的记忆优先于低价值噪音
- 不能只测“有返回”，要测“返回顺序/进入优先级”

## 12.2 owner-local vs shared competition
- owner-local 记忆在合理场景下优先
- shared memory 不会无脑淹没 context

## 12.3 summary / episodic dedup behavior
- 避免同一信息同时以多个层重复占用 context

## 12.4 consolidation quality
- 高价值 turns 更容易转化为有用 memory
- 低价值噪音不会轻易升格
- 重复运行不会制造明显重复污染

## 12.5 explainability / contract tests
- ranking / scoring / selection 的关键规则必须可测试

## 12.6 no regression
- 15.0.2 已建立的 closure / expansion unlock tests 不回退
- full suite / tsc 不回退

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# What Memory Infrastructure Is Now Stable
# Where Memory Quality Is Still Weak
# Why 15.1 Should Focus On Retrieval Intelligence
```

## Phase 2 — Retrieval Quality Audit
必须先列出：
- 当前 retrieval 排序逻辑
- 当前 memory noise 来源
- 当前 identity relevance 的缺失点
- 当前 consolidation 对 retrieval 的真实帮助与局限

## Phase 3 — Design Decision
必须明确：
- ranking model
- dedup / anti-noise strategy
- identity-relevant prioritization strategy
- consolidation quality strategy
- explainability contract

## Phase 4 — Implement
只做本轮真正提高质量的最小充分实现。  
禁止泛化扩张。

## Phase 5 — Tests & Verification
重点补 quality tests，而不是只补存在性测试。

## Phase 6 — Expansion Value Verdict
明确回答：
- 本轮 memory intelligence 是否真的产生质量提升
- 它如何为下一轮更高层 expansion 做准备

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/consolidation.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/tools/memory.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
```

你还必须新增并执行本轮真正证明以下事项的测试：
- retrieval ranking quality
- summary / episodic dedup quality
- owner-local vs shared prioritization
- consolidation anti-noise / anti-repeat
- explainability contract

然后继续：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。

---

# 15. 人工执行命令协议

如果由于 shell / host / sandbox / daemon / interactive runtime 限制，需要用户手动执行某步，必须使用以下格式：

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
- 如何理解当前 memory substrate
- 为什么 15.1 是正确的第一扩张方向

# Retrieval Quality Audit
- 当前排序逻辑
- 当前 noise 来源
- 当前 identity relevance 缺失点
- 当前 consolidation 的局限

# Design Decisions
- ranking strategy
- dedup / anti-noise strategy
- identity-relevant prioritization strategy
- consolidation quality strategy
- explainability contract

# Modified Files
- 改了哪些文件
- 每项改动如何提升 memory quality
- 哪些改动提升 relevance，哪些改动降低 noise

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明质量提升
- 哪些测试证明 explainability

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Expansion Value Assessment
- 这轮是否真实提升了 memory intelligence
- 对下一轮更高层 expansion 有什么直接帮助
- 是否已为 economy / behavior expansion 准备更强 substrate

# Final Verdict
明确回答：

> 15.1 是否成功把 identity/memory 基础设施转化为更高质量的 retrieval intelligence？

答案只能类似：
- `YES — retrieval quality improved materially and memory intelligence expansion is established`
- `PARTIAL — useful improvements landed, but quality gains remain limited or weakly proven`
- `NO — insufficient quality expansion`

# Next Round Recommendation
如果 YES，说明下一轮更适合进入哪种更高层扩张；如果不是，列出最小剩余质量缺口。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不做 retrieval audit 直接开始堆功能
2. 不证明质量提升，只证明代码存在
3. 继续让 owner relevance 停留在纯过滤层
4. 用更多 memory 替代更好 memory
5. 让 consolidation 继续制造噪音
6. 借本轮偷偷推进 economy 主逻辑
7. 输出一种无法被测试和命令回溯的“memory intelligence 已提升”结论

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. retrieval ranking 比当前更相关、更可解释
2. summary / episodic 冗余明显降低或得到明确控制
3. owner-local relevance 真正进入 prioritization，而不是只停留在 filter
4. consolidation 对 retrieval 的帮助更强、噪音更低
5. quality tests 与 explainability tests 建立并通过
6. closure / expansion unlock 既有测试不回退
7. full suite + tsc 在 canonical shell 下通过
8. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续扩 memory 的表面积，而是把已经收稳的 identity / continuity / owner-boundary 基础设施真正转化为更高质量的 retrieval intelligence，让 agent 在“记什么、取什么、用什么”上开始体现实质性变聪明。**
