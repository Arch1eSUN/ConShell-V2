# Round 16.0 — Economic Memory, Adaptive Routing, and Value Realization Lifecycle

> **文件定位**：这是 Round 16.0 的正式开发提示词。  
> **前置审计结论**：Round 15.9 已通过严格本地复证，economic test suite 在 canonical 路径下达到 `155/155 passing`。  
> 当前系统已具备：  
> - canonical verification contract；  
> - stronger runtime freshness（至少 ToolExecutor 按需读取 tier）；  
> - `ValueEventRecorder`；  
> - `TaskFeedbackHeuristic`；  
> - `TaskQueue` completion → feedback loop；  
> - `RuntimeMode` 行为契约在至少两个 consumers 中生效。  
> **但当前系统仍主要是短周期、轻量 heuristic 驱动**：它会记录最近发生的经济结果，也会做简单反馈调整，但还没有形成**跨时间的 economic memory**、**更稳定的 adaptive routing**、以及**完整的 value realization lifecycle**。  
> **本轮目标**：把当前“能记录、能反馈”的 economic runtime，推进为“能跨时间记忆、能基于历史表现稳定自适应、能清楚管理价值兑现生命周期”的更高阶系统能力。  
> **事实纪律**：禁止把“更多统计字段”包装成“真正 adaptive system”；禁止把“事件类型存在”包装成“生命周期已闭环”。

---

# 0. 本轮问题定义

Round 15.9 已经建立了三类关键能力：

1. **验证能力**：知道如何稳定验证经济子系统；
2. **反馈能力**：知道任务执行结果会影响未来一点点行为；
3. **记录能力**：知道最近发生了哪些 value events。

但当前系统仍存在三个核心边界：

## 0.1 经济记忆仍然过短
当前 recorder / heuristic 主要是：
- 轻量 ring buffer
- 近期样本
- taskName 级别聚合

这意味着系统还没有真正回答：
- 某类任务长期是否值得做？
- 某类任务在什么 mode 下更划算？
- 某类任务是否是“看起来赚钱，长期其实亏损”？

## 0.2 routing 仍是“轻量反馈”而不是“稳定自适应”
当前 priority adjustment 已存在，但更像：
- 局部修正
- 短期偏好
- 单点 heuristic

还不是：
- 面向任务类型簇的长期适应
- 面向不同 mode/tier 的策略差异化
- 明确可解释的长期 routing policy

## 0.3 value realization 仍然缺完整 lifecycle
现在系统已经区分：
- `RevenueEvent`
- `ValueRealizationEvent`
- `TaskCompletionEvent`

但还没有把它们组织成一个完整 lifecycle：
- 价值意图（planned value）
- 执行完成（completion）
- 价值兑现（realization）
- 收入确认（revenue recognized）
- 长期表现沉淀（economic memory)

因此，Round 16.0 的唯一正确问题定义是：

> **如何让 economic runtime 从“会记录短期反馈”升级为“有经济记忆、能稳定自适应、能完整表达价值兑现生命周期”的系统？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Economic Memory + Adaptive Routing + Value Realization Lifecycle**

即：
1. 建立跨时间可查询的 economic memory；
2. 让 routing 不只依赖短期 heuristic，而能读取长期表现；
3. 把 task/value/revenue 组织成更完整的 lifecycle；
4. 保持系统仍然可解释、可审计、可测试，不引入黑箱“智能优化”。

---

# 2. 本轮必须先回答的问题

## 2.1 什么是 Economic Memory？
你必须明确：
- 它记录的是原始事件，还是聚合后的长期统计？
- 粒度是 taskName、taskType、task family、surface，还是多层级？
- 它是 runtime memory，还是持久化知识？

如果只是在 recorder 上多几个统计字段，这不算真正的 economic memory。

## 2.2 Adaptive Routing 的最小可解释单位是什么？
你必须明确 routing 是按什么对象学习：
- 单个 task name？
- taskType？
- revenue surface？
- mode-specific task class？

没有学习单元，就没有真正的 adaptive routing。

## 2.3 Value Realization Lifecycle 的 canonical stages 是什么？
你必须明确至少一条正式生命周期：
- planned
- executed
- delivered
- realized
- monetized / recognized
- retained in memory

并解释哪些阶段可以缺失、哪些阶段必须发生。

## 2.4 长期记忆与短期反馈如何分工？
你必须明确：
- `ValueEventRecorder` 保留什么？
- `TaskFeedbackHeuristic` 保留什么？
- 新 `EconomicMemory` 保留什么？

否则会出现三套部分重叠的状态源。

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Economic Memory Contract

必须新增一份正式 contract，明确 economic memory 的边界。

### 你必须定义：
1. **Memory unit**
   - taskType / task family / revenue surface / route class / mode-context
2. **Tracked metrics**
   - attempts
   - success rate
   - average cost
   - average net value
   - realization rate
   - revenue recognition rate
   - lastSeen / sampleCount
3. **Retention model**
   - 仅内存
   - 持久化到 SQLite
   - 冷热分层（可选）
4. **Canonical owner**
   - 谁是长期经济经验的 owner？

### 强要求：
- 本轮至少要形成一个明确 owner
- 必须区分：
  - raw events
  - short-term recorder
  - long-term economic memory

---

## Task 2 — 新增 EconomicMemoryStore / Service

必须实现一个正式组件，例如：
- `EconomicMemoryStore`
- `EconomicMemoryService`

### 最小能力要求：
- `ingest(valueEvent)`
- `getStats(key)`
- `getAllStats()`
- `getTopPerformers()`
- `getWorstPerformers()`
- `clear()`（测试用）

### 推荐设计：
- 先做可测试的 in-memory implementation
- 如果成本可控，再补 SQLite persistence

### 但必须注意：
如果上持久化：
- 要定义 schema
- 要定义 migration
- 要定义 key stability

如果你不能把这些定义清楚，就先不要上持久化。

---

## Task 3 — 将 ValueEvent → EconomicMemory 真正接通

当前 `TaskQueue` 已能产生 `TaskCompletionEvent`，部分 value/revenue 语义也已存在。

### 本任务必须做到：
- `TaskCompletionEvent` 进入 EconomicMemory
- `ValueRealizationEvent` 进入 EconomicMemory
- `RevenueEvent` 至少部分进入 EconomicMemory

### 要求：
- Memory 中的聚合结果可解释
- 不允许把不同类型事件粗暴混算
- 必须能区分：
  - 做了事
  - 交付了价值
  - 真的赚到钱

---

## Task 4 — 将 Adaptive Routing 从“局部反馈”升级为“记忆驱动”

当前 `TaskFeedbackHeuristic` 已存在，但还太轻。

### 本任务必须新增一层更稳定的 routing input：
- Routing decision 不仅读取当前 economic state
- 还读取 EconomicMemory 中的长期表现

### 至少要覆盖以下场景：
1. 长期高收益高成功率任务 → 正向 routing bias
2. 长期低收益高失败率任务 → 负向 routing bias
3. 某类任务在 `revenue-seeking` 模式下收益高、在 `normal` 下一般 → mode-sensitive bias
4. 看似 revenue-bearing 但 realization rate 很低的任务 → 降权或拒绝

### 强要求：
- adaptive routing 必须仍然可解释
- 不能输出黑箱分数却无法说明为什么

---

## Task 5 — 建立 Value Realization Lifecycle Contract

本轮必须把事件从“类型枚举”推进为“阶段合同”。

### 你必须定义至少这些 canonical stages：
1. **planned**
   - 预期能产生价值/收入
2. **completed**
   - 任务执行完成
3. **realized**
   - 价值已实际交付/兑现
4. **recognized**
   - 收入已确认 / 付款已到账 / 可计入收益
5. **retained**
   - 结果已沉淀进 economic memory

### 必须说明：
- 哪些事件映射到哪些阶段
- 哪些阶段对不同 task class 是可选的
- 哪些阶段缺失时意味着什么

### 目标：
让系统能够回答：
> “这个任务做完了，但它真的创造了价值吗？价值是否兑现？收入是否确认？长期上是否值得继续做？”

---

## Task 6 — 建立 Lifecycle-aware Reporting / Diagnostics

当前已有 audit trail、value recorder、economic memory 候选。

### 本任务必须让系统至少能输出：
1. 最近完成任务统计
2. 最近 realized value 统计
3. 最近 recognized revenue 统计
4. top positive task classes
5. top negative / loss-making task classes
6. realization gap（完成很多，但兑现少）

### 推荐产物：
- `generateEconomicPerformanceReport()`
- 或 diagnostics/reporting helper

### 要求：
- 报告必须可解释
- 不能只是 raw event dump

---

## Task 7 — 将 RuntimeMode 与 EconomicMemory 结合

当前 mode 已经影响 queue/tool 行为。

### 本轮必须进一步实现：
- `revenue-seeking` 模式下更偏向长期高 realization/high net value 的任务
- `survival-recovery` 模式下更强惩罚长期低兑现率任务
- `normal` 模式下允许更多探索，但仍受历史表现约束

### 强要求：
mode 不只是影响“当前成本门控”，还要影响“历史驱动策略选择”。

---

## Task 8 — 新增 Lifecycle + Memory + Adaptive Routing Tests

本轮必须新增覆盖以下测试：

### 8.1 EconomicMemory Tests
- 正确 ingest 三类 value events
- 正确输出按 key 聚合的统计
- top/worst performers 正确

### 8.2 Adaptive Routing Tests
- 长期优质任务获得 bias
- 长期劣质任务被降权
- revenue-seeking / survival-recovery 模式下 bias 不同

### 8.3 Lifecycle Contract Tests
- planned → completed → realized → recognized → retained 的阶段逻辑可验证
- 缺失某阶段时系统语义正确

### 8.4 Reporting Tests
- performance report 含关键统计
- realization gap 计算正确

### 8.5 Regression Tests
- 现有 155 tests 不回归

---

## Task 9 — 文档与状态源对账

必须更新并明确以下状态源边界：

1. `ValueEventRecorder`
   - 短期事件窗口
2. `TaskFeedbackHeuristic`
   - 轻量实时反馈
3. `EconomicMemory`
   - 跨时间长期表现记忆
4. `EconomicPolicy` trail
   - 运行时决策审计

### 禁止：
- 让多个组件承担模糊重叠职责
- 不写 owner 边界就宣称 memory/adaptation 完成

---

# 4. 本轮输出要求

本轮结束后，输出必须严格采用以下结构：

1. **What is now the canonical long-term economic memory**
2. **How raw events, short-term feedback, and long-term memory are separated**
3. **How adaptive routing now uses historical economic performance**
4. **How the value realization lifecycle is now represented**
5. **What new reports/diagnostics are available**
6. **What tests were actually executed**
7. **What remains intentionally lightweight or deferred**

### 禁止输出：
- “已实现自适应系统”但只是多了几个 heuristic if-else
- “生命周期已闭环”但没有阶段合同与状态映射
- “长期记忆已完成”但只是 ring buffer 叠字段

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] Economic memory owner 已明确
- [ ] `EconomicMemoryStore/Service` 已建立
- [ ] 三类 value events 至少部分进入长期 memory
- [ ] adaptive routing 至少读取一种长期表现指标
- [ ] value realization lifecycle contract 已明确并被代码消费
- [ ] performance/diagnostic report 已可输出
- [ ] RuntimeMode 与 historical memory 已结合
- [ ] 新增 memory/lifecycle/routing tests 已通过
- [ ] 原有经济测试无回归
- [ ] 文档中各状态源边界已对账清楚

---

# 6. 一句话结论

> **Round 16.0 的目标，不是再堆更多 economic 概念，而是让系统真正拥有跨时间的经济记忆、基于历史表现的稳定自适应能力，以及完整可解释的价值兑现生命周期。**
