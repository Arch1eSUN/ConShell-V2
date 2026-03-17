# Round 15.1.2 — Memory Intelligence Quality Closure

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把“又调了一些启发式参数”包装成“quality closure 已完成”；禁止在动态验证链不成立时宣称 YES；禁止继续让 retrieval quality 停留在 split+patch、regex 分类、prefix dedup 和 category bias 的第一版机制上。  
> **本轮风格要求**：高压审计约束 + 精准质量收口协议 + 强最终验收格式。你不是来继续扩张新层，而是来把 15.1 / 15.1.1 的 memory intelligence 从“可用启发式”推进到“质量更稳、收益更真、可验证更强”的 closure 状态。

---

# 0. 强制执行声明

本轮不是新的大功能轮。  
本轮也不是回到基础 closure 轮。  
本轮是：

# **Round 15.1.2 — Memory Intelligence Quality Closure**

你必须把本提示词视为当前 memory expansion 子阶段的**质量收口协议**。你必须：
- 先读上下文、15.1 审计、15.1.1 hardening 战略总纲
- 明确列出当前 memory intelligence 仍未稳固的机制问题
- 只做最小但足够的高杠杆质量修正
- 用更强的质量测试与动态验证证明收益
- 最终给出真实、克制、可审计的 quality verdict

禁止：
- 借本轮顺手进入 economy / planning / behavior 主扩张
- 只再加更多 heuristics 却不增强验证力度
- 用更复杂的逻辑掩盖质量问题
- 在测试/依赖链未完整可跑时继续写成已验证
- 输出“看起来更高级”的 ranking，而不证明实际更稳

---

# 1. 本轮定位

15.1 做成了：
- episodic memory 进入 runtime context
- 第一版 blended scoring
- 第一版 owner/shared budgeting
- 第一版 summary/episode dedup
- 第一版 categorized episode rendering

15.1.1 做成了：
- budget reflow
- soft dedup `[echo]`
- continuity bonus
- categorized rendering 强化

但最近审计的主结论很明确：

> **15.1 / 15.1.1 仍是 PARTIAL。**

原因不是“没做成”，而是：
- dynamic budget 仍偏 split+patch
- dedup 仍偏 prefix-based 且存在 echo 噪音回流
- relevance 排序从 recency bias 部分转成了 category bias
- episodic context 编排仍偏轻量，质量收益未被充分证明
- 动态验证链一度受依赖缺失影响，导致 YES 证据不足

因此本轮不是继续拓展 memory surface，而是：

> **把 Memory Intelligence 从第一版启发式推进到更稳健、可解释、可验证的质量闭环。**

---

# 2. 为什么 15.1.2 现在必须做

如果现在不做 15.1.2，而直接进入更高层扩张：
- identity-aware planning 会吃到粗糙 context
- behavior layer 会建立在 noisy retrieval 上
- economy / attribution 会继续被 memory quality 拖后腿
- 后续还是要回头修这批问题

这会导致项目再次进入低效模式：

> **高层扩张 → 发现 memory quality 不够 → 回头返工 → 再扩张**

所以本轮的真实作用是：

> **终结 Memory Intelligence 的“启发式过渡期”，让它变成可被更高层能力可靠消费的 substrate。**

---

# 3. 本轮必须避免的四个错误

## 错误 A：把 split+patch 继续包装成 dynamic allocator
如果预算仍然本质上是硬切片 + 局部补漏，就不能写成“动态预算已完成”。

## 错误 B：把 `[echo]` 继续包装成 robust dedup
如果 echo 仍然只是被重新塞回 prompt，而没有更稳健的去冗余策略，它仍然只是缓解，不是 closure。

## 错误 C：把 continuity bonus 当成真正 relevance
`event_type` 前缀 bonus 不是成熟 relevance。  
它只是第一版 continuity prior。

## 错误 D：把“机制存在测试”当成“质量收益证明”
本轮必须补足更强的质量证据，而不是继续只证明规则按当前定义工作。

---

# 4. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/planning/PHASED_DEVELOPMENT_SCHEME.md`
6. `AGENT_START_HERE.md`
7. `CONSTITUTION.md`
8. `README.md`
9. `DevPrompt/0153_Round_15_1_Memory_Intelligence_Expansion_and_Identity_Relevant_Retrieval.md`
10. `DevPrompt/0154_Round_15_1_1_Memory_Intelligence_Hardening_Strategic_Brief.md`
11. 与 15.1 / 15.1.1 对应的 walkthrough、审计结论（若存在项目内记录，必须读）

还必须重点阅读：
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/memory/consolidation.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/memory/memory-intelligence.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/runtime/tools/memory.test.ts`

读取后必须先输出：

```md
# Context Assimilation
# Why 15.1 And 15.1.1 Remained Partial
# What Still Blocks A True Memory Intelligence YES
# Why 15.1.2 Must Be A Quality Closure Round
```

并明确回答：
- 当前 memory intelligence 已经有什么
- 还差什么才算真正稳健
- 哪些问题是 blocker，哪些只是优化项
- 本轮真正成功标准是什么

---

# 5. 当前可信基线（必须据此工作）

以下内容可视为当前已知可信输入，但仍必须复核：

## 5.1 验证基线
- `.nvmrc = v24.10.0`
- canonical verification shell：`v24.10.0 / ABI 137`
- 最近一次用户汇报：`680 / 680 tests`, `45 files`, `tsc clean`
- 但最近独立审计指出：**动态验证链存在本地依赖问题（`tinypool` 缺失）**，因此“已验证通过”不能仅按汇报认定

## 5.2 当前 memory intelligence 已存在的能力
- episodic memory 已进入 runtime context
- blended scoring 已存在
- owner/shared budgeting 已存在
- budget reflow 已存在
- soft dedup `[echo]` 已存在
- continuity bonus 已存在
- categorized episode rendering 已存在

## 5.3 最近审计已指出的剩余核心问题

### A. dynamic budget 仍是 split+patch
- 不是全局动态分配
- owner / shared 的竞争仍不是真正统一竞争

### B. soft dedup 仍有噪音回流风险
- `[echo]` 只是降级，不是稳健去冗余
- overlap 规则仍偏粗

### C. relevance 仍不够成熟
- 从纯 recency bias 进步到了带 continuity prior 的 heuristic
- 但还不是更可靠的 relevance model

### D. episodic context 编排仍偏浅
- 比平铺好，但离“高质量经验上下文”还有距离

### E. 动态验证链证据不够硬
- 必须补强真实可复核的验证，不允许继续依赖单侧汇报

---

# 6. 本轮目标定义

本轮的目标不是“让 memory intelligence 更复杂”，而是：

# **Make Memory Intelligence More Stable, Less Wasteful, Less Noisy, And Better Proven**

也就是：

1. **让 budget 更接近全局动态最优，而不是 split+patch**
2. **让 dedup 更稳健，而不是粗糙 echo 回流**
3. **让 ranking 更接近真实 relevance，而不是 category bias**
4. **让 episodic context 编排更可解释、更有价值**
5. **让质量收益被更有力地证明，而不是只证明机制存在**

---

# 7. 本轮必须完成的核心目标

## Goal A — 升级 dynamic budget：从 split+patch 到更可信的动态分配
你必须明确并尽量落地：
- 当前预算是否必须继续 owner/shared 先切块
- 是否应改成统一候选池 + 分层优先级 + 剩余预算回流
- 至少要解决：
  - owner bucket 被早期 summaries 吃满后，高价值 owner episodes 无法竞争
  - shared skills 当前没有完整 skipped/reflow path
- 如果无法做成完全统一分配，也必须做到：
  - 回流路径完整
  - 浪费显著减少
  - 竞争更接近全局最优

本轮完成后必须能回答：

> **budget allocation 是否已经不再主要体现 rigid split 的结构性低效？**

## Goal B — 升级 dedup：从粗糙 echo 回流到更稳健的去冗余
你必须明确并尽量落地：
- overlap 判定是否可以比 100-char prefix 更稳健
- echo 是否应直接回到主 episodes 列表，还是需要：
  - 单独 echo 区域
  - 更低优先级区
  - 更严格数量上限
  - 降权而非回流
- dedup 的目标是：
  - 减少重复
  - 保留经验价值
  - 控制噪音回流

本轮完成后必须能回答：

> **dedup 是否已经从“粗暴删除/回流”升级为更稳健的去冗余策略？**

## Goal C — 升级 ranking：从 category heuristic 到更可信 relevance
你必须尽量引入或强化更合理的信号，例如：
- stability / durability signal
- repeat use / reinforcement signal
- continuity-relevance signal
- task-local / self-local salience signal

不要求一步做到向量检索或复杂 semantic retrieval，但必须避免继续停留在：
- `importance × 2 + recency + event_type bonus`

至少要做到：
- relevance 不再主要由 event_type 前缀决定
- 长期关键经验有更自然的保留路径
- 新近琐碎 observation 不再轻易压制真正长期重要内容

## Goal D — 升级 episodic context 编排
你必须尽量让 episode 不只是被分类显示，还能更像：
- durable preferences
- learned lessons
- current transient observations
- maybe high-value execution outcomes

要求：
- 分类应更接近结构化语义，而不是纯 regex 拼接
- prompt 中的 episodic 区块应更可解释
- 更容易让模型理解“为什么这条值得看”

## Goal E — 补强动态验证与质量证明
这是本轮极其关键的目标。
你必须：
- 确保本轮关键测试在当前环境能真实执行
- 如果依赖缺失，必须显式修复或明确人工步骤
- 新增测试不能只证明规则存在
- 必须更有力证明：
  - waste 减少
  - noise 降低
  - ordering 更合理
  - episodic 编排更稳

---

# 8. 非目标

除非完成本轮目标必须依赖，否则本轮禁止：

1. 不进入 economy 主逻辑
2. 不进入 planning / behavior expansion 主实现
3. 不引入重量级向量数据库改造
4. 不做无边界 memory schema 重构
5. 不为“更智能”而堆砌黑盒复杂度
6. 不把本轮再次变成 closure-first 大审计轮

---

# 9. 必须重点阅读和检查的模块 / 文件

## Ranking / budgeting / dedup 主线
- `packages/core/src/memory/tier-manager.ts`
- `packages/core/src/state/repos/memory.ts`
- `packages/core/src/memory/consolidation.ts`

## Prompt/context 编排主线
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/runtime/tools/memory.ts`
- `packages/core/src/server/routes/memory.ts`

## 质量测试主线
- `packages/core/src/memory/memory-intelligence.test.ts`
- `packages/core/src/memory/consolidation.test.ts`
- `packages/core/src/runtime/tools/memory.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`
- `packages/core/src/identity/self-truth-contracts.test.ts`

---

# 10. 开始实施前必须回答的设计问题

## Q1. 真正的动态预算应该长什么样？
你必须明确：
- 是完全统一池竞争？
- 还是 owner/shared 分层优先 + 全量回流？
- 为什么这是当前最小充分解？

## Q2. dedup 应该是删除、降权、延后、还是单独展示？
你必须明确：
- 现在 `[echo]` 的问题是什么
- 下一版的噪音控制逻辑是什么

## Q3. relevance 还缺什么信号？
你必须明确：
- 当前排序为什么仍然偏 category bias
- 下一版的改进信号从哪里来

## Q4. episode 编排为什么还不够？
你必须明确：
- 当前分类哪一点只是 cosmetic
- 下一版如何让模型更容易理解其语义用途

## Q5. 本轮最小成功标准是什么？
你必须避免再次出现：
- “看起来更好了”
- 但不能强证据判 YES

---

# 11. 推荐实施方向

## Direction 1 — 先修预算竞争模型
这是当前最结构性的质量问题之一。

## Direction 2 — 先把 echo 机制从“回流”变成“受控保留”
不要继续让 echo 以半普通 episode 身份回到主上下文。

## Direction 3 — 让 continuity relevance 从 event_type 前缀启发式，向更可信 signal 过渡
即使增量，也要往更真实的 relevance 方向走。

## Direction 4 — episodic 编排要更结构化，而不是继续靠 regex 标题美化

## Direction 5 — 验证链必须真实可跑
本轮不允许再出现“代码看上去更好，但动态验证仍然不可独立复核”。

---

# 12. 本轮必须新增或强化的测试

至少覆盖以下场景：

## 12.1 dynamic budget quality
- owner/shared 竞争不再依赖刚性切片
- skills / facts / relationships / episodes 都能在回流模型下被公平测试

## 12.2 dedup robustness
- overlap 但有新信息的 episode 不会被轻易抹掉
- 高重叠 echo 不会大量回流污染 prompt

## 12.3 relevance hardening
- 长期关键经验在合理场景下战胜新近琐碎 observation
- 不能只靠 event_type 前缀吃 bonus

## 12.4 episodic context quality
- 分类/编排不仅存在，而且更可解释
- prompt 中呈现更接近“经验价值”而非字符串分组

## 12.5 dynamic verification viability
- 本轮关键测试在当前环境可真实执行
- 若有依赖约束，必须被修复或显式记录

## 12.6 no regression
- 15.0.2 expansion unlock 相关测试不回退
- 15.1/15.1.1 的已有机制不被破坏
- full suite + tsc 不回退

---

# 13. 实施顺序（严格执行）

## Phase 1 — Context Assimilation
输出：

```md
# Context Assimilation
# Why 15.1 And 15.1.1 Remained Partial
# What Still Blocks A True Memory Intelligence YES
# Why 15.1.2 Must Be A Quality Closure Round
```

## Phase 2 — Quality Gap Ledger
必须列出：
- Blockers
- Important but non-blocking
- Cosmetic / optional

## Phase 3 — Design Decisions
必须明确：
- dynamic budget model
- dedup retention model
- relevance hardening signals
- episodic rendering contract
- dynamic verification plan

## Phase 4 — Implement
只做本轮必须的质量收口。禁止继续发散扩张。

## Phase 5 — Tests & Verification
重点补质量证明与动态验证可行性，不只是规则存在性。

## Phase 6 — Quality Closure Verdict
明确回答：
- 是否已足以把 PARTIAL 推到 YES
- 若仍不是，最小剩余阻塞是什么

---

# 14. 验证命令（至少执行并记录）

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/archiesun/Desktop/ConShellV2 && nvm use

cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/memory-intelligence.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/memory/consolidation.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/runtime/tools/memory.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/integration/closure-gate.test.ts --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run src/identity/self-truth-contracts.test.ts --no-coverage
```

你还必须新增并执行本轮真正证明以下事项的测试：
- budget competition quality
- dedup robustness / non-destructive overlap handling
- relevance hardening beyond category bonus
- episodic context quality / explainability
- dynamic verification viability

然后继续：

```bash
cd /Users/archiesun/Desktop/ConShellV2/packages/core && node ../../node_modules/vitest/vitest.mjs run --no-coverage
cd /Users/archiesun/Desktop/ConShellV2/packages/core && npx tsc --noEmit
```

所有验证必须在 canonical verification shell 下完成。  
**若依赖缺失导致测试无法运行，必须在最终报告中写为未完成验证，不得伪造通过。**

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
- 如何理解当前 15.1.x 状态
- 为什么仍是 PARTIAL

# Quality Gap Ledger
- Blockers
- Important but non-blocking
- Cosmetic

# Design Decisions
- dynamic budget model
- dedup retention model
- relevance hardening strategy
- episodic rendering contract
- dynamic verification plan

# Modified Files
- 改了哪些文件
- 每项改动如何提升质量而不是只增复杂度

# Tests Added or Updated
- 新增/修改了什么测试
- 哪些测试证明质量提升
- 哪些测试证明动态验证链成立

# Verification Commands
- 实际执行过的命令
- 真实结果
- 不能省略失败
- 必须说明 canonical shell

# Quality Closure Assessment
- budget 是否已足够动态
- dedup 是否已足够稳健
- relevance 是否已比 category heuristic 更可信
- episodic context 是否已更像高质量经验上下文

# Final Verdict
明确回答：

> 15.1.2 是否已经把 Memory Intelligence 从 PARTIAL 推到可判 YES 的质量收口状态？

答案只能类似：
- `YES — quality gains are materially stronger, better proven, and memory intelligence closure is established`
- `PARTIAL — useful hardening landed, but one or more quality blockers remain`
- `NO — insufficient quality closure`

# Next Round Recommendation
若 YES，说明下一阶段更适合进入哪类高层扩张；若不是，列出最小剩余阻塞清单。

---

# 17. 严格禁止事项

你绝对不能做这些事：

1. 不列 quality gaps 就直接改代码
2. 不解决动态验证可复核性就继续宣称 YES
3. 把启发式参数增加误写成“relevance 已成熟”
4. 让 echo 噪音继续无控制回流
5. 借本轮顺手推进 economy / behavior 主线
6. 输出一种无法被代码和命令回溯的 quality closure 结论

---

# 18. 本轮成功标准

只有当以下条件同时满足，本轮才算成功：

1. budget 模型比当前更接近动态最优，而不是 split+patch
2. dedup 比当前更稳健、信息损失更低、噪音回流更少
3. relevance 排序比当前更接近真实长期价值，而不主要靠 category bonus
4. episodic 编排更可解释、更有经验语义
5. 关键质量测试与动态验证可在当前环境真实执行
6. full suite + tsc 在 canonical shell 下通过
7. 最终结论真实、克制、可审计

---

# 19. 一句话任务定义

> **本轮的任务不是继续堆更多 memory heuristics，而是把 15.1 / 15.1.1 的第一版启发式 hardening 推进到更稳健、更少浪费、更少噪音、且被真实验证支撑的质量闭环，让 Memory Intelligence 真正具备被更高层能力可靠消费的资格。**
