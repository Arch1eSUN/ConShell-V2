# Round 15.1.1 — Memory Intelligence Hardening Strategic Brief

> **用途**：这是一个**理解优先的总纲文件**，用于帮助开发 / 审计 agent 在进入下一轮执行前，先统一对当前阶段、问题本质、优先级、风险、成功标准的理解。  
> **它不是普通 walkthrough，也不是直接替代 DevPrompt 的执行清单。**  
> 它的作用是把：
> 1. 当前阶段判断  
> 2. 扩张优先级路线图  
> 3. 15.1 审计结论  
> 4. 下一轮应解决的问题  
> 5. 为什么先做这些而不是直接进入 economy  
> 融合成一个单一、高密度、可执行前统一认知的战略总纲。

---

# 0. 一句话定位

> **ConShell 已完成 Phase 2 closure 并正式解锁扩张开发，但 Round 15.1 只把 Memory Intelligence 从“0 到 1”推了起来，尚未达到“质量显著提升且机制稳健”的标准；因此下一轮的最高优先级不是新层扩张，而是对 memory intelligence 做一次高杠杆 hardening，让系统真正开始在“记什么、取什么、用什么”上体现认知质量优势。**

---

# 1. 当前阶段判断

## 1.1 当前不再处于 closure-first 阶段
前面多轮已经完成了决定性的收口：
- canonical verification shell 已锁定
- doctor / continuity / runtime self model 的基本闭环已经建立
- session lifecycle 与 turn checkpoint 语义已收正
- owner boundary 已进入生产路径
- consolidation 已进入 runtime path
- expansion unlock gate 已在 15.0.2 中被判定为通过

这意味着：

> **项目不再被“收口本身”阻塞。**

因此，当前阶段不是：
- 再次回到“能否闭环”的阶段

而是：
- **如何消费已闭环基础设施，产出真正的上层能力收益。**

---

## 1.2 当前也还不适合直接跳 economy 主实现
虽然 expansion 已解锁，但最合理的第一扩张方向不是：
- 钱包 / spend attribution
- economic grounding
- 多代理治理
- 更大范围自治

原因不是这些方向不重要，而是：

> **当前最值钱、最确定、最靠近现有代码基础、最能立刻产生质量收益的扩张方向，是 Memory Intelligence。**

如果在 retrieval / consolidation / context quality 仍偏第一版启发式时，过早进入 economy：
- 高层语义会被低质量 context 污染
- 经济/归因判断会建立在粗糙记忆上
- 后续仍会被迫回头修基础质量问题

所以：

> **现在最优解不是跳更高层，而是先把已解锁的 memory/identity substrate 变成真正的认知质量杠杆。**

---

# 2. 15.1 实际推进了什么

Round 15.1 不是失败，也不是空转。  
它做成了几个此前没有做到的关键进展：

## 2.1 episodic memory 终于进入 runtime context
这是 15.1 最大的真实成果。  
在这之前，episodic memory 很大程度上更像“数据库里有，但 prompt 中不真正使用”。

现在：
- `buildContext()` 会产出 `recentEpisodes`
- `agent-loop.ts` 的 system prompt 明确包含 `## Recent Experiences`

这意味着：

> **episodic memory 从死数据变成了活上下文。**

---

## 2.2 retrieval 至少从纯 importance 走向了 importance + recency
15.1 引入了第一版 blended scoring：

- `score = importance × 2 + recency_bonus`
- recency tiers：
  - `<1h => 5`
  - `<1d => 3`
  - `<7d => 1`
  - older => 0

这不是真正成熟的 relevance ranking，但它至少说明系统开始从：
- “只按静态重要度抓记忆”
变成
- “开始考虑记忆的新近性”

这是从 0 到 1 的必要步骤。

---

## 2.3 consolidation 有了最小 dedup guard
15.1 让 consolidation 不再是“重复触发就重复插入”。

通过：
- `existsBySessionAndContent()`
- prefix guard

系统至少有了第一层 idempotency 防护。

---

## 2.4 owner-local vs shared 的 context budgeting 开始出现
这说明系统开始正视一个关键问题：

> **同一个 self 的局部经验，与全局共享知识，不应该在上下文里无差别竞争。**

即使当前版本还很粗糙，这个方向本身是对的。

---

# 3. 为什么 15.1 仍然只能判 PARTIAL

15.1 的问题不是“没有进步”，而是：

> **它引入了第一版 heuristic，但这些 heuristic 还不足以支撑“质量显著提升且机制稳健”的结论。**

换句话说：
- 结构开始成立
- 机制开始出现
- 质量收益开始显现
- 但系统还没有进入真正可靠的 memory intelligence 状态

---

# 4. 15.1 暴露出的核心机制问题

## 4.1 60/40 预算切片是硬切片，不会动态回流
当前 owner-local 与 shared 是严格分账：
- 60% 给 owner-local
- 40% 给 shared

问题在于：
- 一个桶没用完，预算不会借给另一个桶

这会导致：
- 有时 owner-local 明明更重要，却被硬截断
- 有时 shared 明明更重要，却被闲置预算浪费

这不是微调问题，而是：

> **当前 retrieval packing 还没有真正面向“整体上下文最优”，只是做了一个静态政策切分。**

---

## 4.2 blended scoring 本质上仍然不是“relevance”，只是“importance + age”
当前没有引入：
- query relevance
- semantic match
- reuse history
- continuity relevance
- self-state relevance

所以现在的排序更准确地说是：

> **explainable heuristic v1**

而不是：

> **robust retrieval intelligence**

它的现实问题不是“完全错误”，而是：
- 会稳定偏向较新的中高价值经验
- 对长期但仍关键的记忆不够友好
- 更像 recency bias，而非真正 relevance

---

## 4.3 summary / episodic dedup 规则过于粗糙
现在的 dedup：
- 只看前 100 字 overlap
- 命中则直接过滤掉 episode

问题在于：
- 它会误删“主题相似但经验价值不同”的 episodic
- 它依赖 prompt 中已纳入的 summary，而不是稳定语义事实
- 它是硬删除，不是降权

因此当前 dedup 更像：

> **粗暴去重**

而不是：

> **稳健去冗余**

---

## 4.4 episodes 虽然进 prompt 了，但编排方式还只是线性拼接
当前 system prompt 还是 section 式直拼：
- summaries
- facts
- relationships
- experiences
- skills

这意味着：
- episode 已经接进来了
- 但还没有被“编排成高质量认知上下文”

具体表现为：
- 没有 explainability label
- 没有 stable preference / transient event / lesson learned 等分类层
- 没有 episode 间压缩/聚合
- 没有证明它真正提升回答质量，只证明它进入了 context

---

# 5. 当前项目为什么卡在这里

项目现在不是卡在“没有能力”，而是卡在：

> **已经解锁扩张，但第一轮扩张只完成了 memory intelligence 的启蒙版，还没进入真正高质量、可持续、可放大收益的状态。**

如果此时不做 hardening，而是继续往更高层跳：
- 上层能力会建立在粗糙 retrieval 上
- 后面又会被迫回头修 memory quality
- 项目会重新进入“高层扩张 → 发现底层质量不够 → 回头返工”的低效循环

所以当前“卡住”的本质不是节奏问题，而是：

> **现在的最优推进动作，仍然是把 Memory Intelligence 从第一版 heuristic 推到工程可信的质量层。**

---

# 6. 为什么下一轮必须是 15.1.x Hardening，而不是直接 15.2 Economy

## 核心原因
当前最有杠杆的动作不是上升抽象层，而是：

> **让已经存在的 memory substrate 真的开始输出稳定质量收益。**

如果这一层不先打稳，后面无论是：
- identity-aware planning
- behavior expansion
- economic grounding
- sovereign value attribution

都会被低质量 memory context 拖后腿。

所以现在最优顺序不是：
- 15.2 economy first

而是：
- **15.1.1 / 15.1.x memory intelligence hardening**
- 然后再进入更高层扩张

---

# 7. 下一轮应该解决的四个核心问题

## 7.1 动态预算回流（Dynamic Budget Reflow）
当前 60/40 是静态切片。  
下一轮要解决的是：

- 如果 owner-local 没用满，其剩余预算能否流向 shared
- 如果 shared 没用满，其剩余预算能否流向 owner-local
- token budget 是否可以按实际内容价值动态调节，而不是固定切块

这一步的目标不是推翻 owner/shared distinction，恰恰相反：

> **保留边界区分，但去掉机械低效。**

---

## 7.2 从“硬删除 dedup”升级为“更稳健的去冗余机制”
下一轮不一定必须一步上 semantic dedup，但至少要做到：
- 不再只靠 100-char overlap 一刀切
- 尽量避免误删高价值 episodic
- 更像“降权 / 去冗余 / 压缩”，而不是“直接消失”

这一步的目标是：

> **减少重复，而不是牺牲经验价值。**

---

## 7.3 从 recency bias 走向更合理的 retrieval relevance
下一轮要让排序开始回答更有价值的问题：
- 这条记忆是否与当前 self 连续性更相关？
- 是否是长期稳定偏好？
- 是否被反复用到？
- 是否应该常驻，而不是被新近中等价值事件反复挤掉？

不一定一次做成完整 semantic retrieval，
但至少要从：
- importance + age
升级到
- **importance + recency + identity/usage continuity signal**

---

## 7.4 从“episodes 进入 prompt”升级到“episodes 被高质量编排”
下一轮应开始让 episode 不只是：
- 一行文本插进去

而是更像：
- 经验/教训
- 偏好/稳定事实
- 失败/风险提醒
- 最近变化/当前状态

换句话说：

> **不是让模型看到更多 episode，而是让模型更容易理解每条 episode 为什么值得看。**

---

# 8. 这份总纲要传达给开发 agent 的核心信息

如果让后续 agent 只记住一件事，那应该是：

> **ConShell 现在已经不再卡在 closure，但也还没到可以轻率越过 memory quality 的阶段。Round 15.1 的真实价值，是把 episodic memory 从死数据接进了 runtime；下一轮的任务不是“继续加更多 memory 功能”，而是把 retrieval / budget / dedup / context 编排从第一版启发式推进到更稳健的 Memory Intelligence Hardening。只有这样，后续更高层扩张（planning / behavior / economy）才不会建立在粗糙 context 上。**

---

# 9. 推荐优先级路线图（融合版）

## 当前最优顺序

### Priority 1 — **Memory Intelligence Hardening**
必须优先做：
1. 动态预算回流
2. 更稳健的 dedup / anti-redundancy
3. 更可信的 relevance ranking
4. 更高质量的 episodic context 编排

### Priority 2 — **Identity-Aware Behavior Utilization**
在 15.1.x 打稳后，再做：
1. identity-aware planning
2. self-coherence usage
3. 更细的 write / recall policy

### Priority 3 — **Economic Grounding / Spend Attribution**
最后再进入：
1. wallet-linked identity economics
2. spend attribution
3. long-horizon value accounting

---

# 10. 成功标准（给后续 agent 的判断尺）

下一轮如果想从 PARTIAL 推到 YES，至少要同时做到：

1. **budget 不再是刚性浪费式硬切片**
2. **dedup 不再靠粗糙二元删除主导**
3. **relevance 排序不再主要体现 recency bias**
4. **episodes 在 prompt 中不再只是列表拼接，而是更像高质量经验上下文**
5. **新增测试不只证明机制存在，还能更有力地证明质量收益**

只有满足这些，才可以说：

> **Memory Intelligence 不只是开始存在，而是开始真正可靠地提升 agent 的认知质量。**

---

# 11. 推荐与下一份执行文件的关系

这份文件的角色是：
- 统一理解
- 固化阶段判断
- 解释为什么现在先做 15.1.x hardening
- 防止后续 agent 误以为应该立刻跳 economy 或继续泛修补

与它配套的执行文件应是：

> **一个专门面向 15.1.x hardening 的 DevPrompt**

其职责应是：
- 把这里说清楚的战略问题，转成具体可执行的开发/测试/验证协议

---

# 12. 一句话任务定义（给后续 agent）

> **当前 ConShell 已完成 closure 并解锁扩张，但 Round 15.1 只完成了 Memory Intelligence 的第一版启发式接线；下一轮的最高优先级不是继续加更多能力，而是把 retrieval ranking、budget reflow、dedup 机制与 episodic context 编排从“可用”推进到“稳健且有真实质量收益”，从而为后续更高层扩张建立可信的认知底座。**
