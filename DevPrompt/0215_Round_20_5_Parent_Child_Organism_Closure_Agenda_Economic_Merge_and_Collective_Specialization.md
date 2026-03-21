# DevPrompt 0215 — Round 20.5
## Parent-Child Organism Closure / Agenda / Economic Merge / Collective Specialization

你现在处于 **ConShellV2 Round 20.5**。

Round 20.3 与 20.4 已连续被独立真实性审计确认为**强成立轮**。

当前已经被确认的关键现实包括：
- `Commitment` 已升级为 10-state long-horizon agenda entity
- `AgendaLawEvaluator` / `AgendaLifecycleReconciler` 已让长期 agenda law 成为 canonical 主路径
- `ChildFundingLease` 已建立独立 child funding contract
- `SessionRegistry` 已建立 child reporting / governance action / childRuntime summary 聚合主路径
- `ChildSession` 已扩为 6-state FSM，并已具备 pause / resume / mergeResult / recall / fail 等语义
- `economic-truth` 已开始显示 `agendaHorizon` 与 `childRuntime`
- 独立验证已达：**99/99 files、1960/1960 tests 全绿**

最新阶段判断也已经收敛：

> **ConShell 已不只是 economic-aware + agenda-aware runtime，而是开始拥有 governed child runtime actualization 骨架。**

但 20.4 后最关键的剩余主线同样已经非常清楚：

> **child runtime 已能被资助、被追踪、被召回、被审计，但 child 结果仍未真正闭环进入 parent organism。**

换句话说，现在已经有：
- child funding lease
- child reporting
- child governance actions
- childRuntime truth surface
- specialization manifest contract

但仍未真正完成：
- child spend / lease / outcome 对 parent economic closure 的深层写回
- child mergeResult 对 parent agenda / commitment / follow-up 的 canonical merge
- parent-child specialization routing 的真实 runtime 作用
- child outcome 对 collective / lineage / task routing 的可复用影响
- parent organism 对 child performance / utility / completion quality 的系统性吸收

因此 Round 20.5 的唯一主轴必须收口为：

> **把 ConShell 从“拥有可治理子体运行时”的系统，继续推进成“子体结果真正改变母体 agenda、经济状态与 collective specialization 行为”的系统。**

---

## 一、本轮唯一总目标

**完成 Parent-Child Organism Closure 的第一轮强收口，让 child runtime 不再只是可运行、可报告、可召回的 side organism，而成为真正能改变 parent agenda、economic closure 与 collective specialization routing 的 canonical runtime path。**

这轮不是继续堆 child 局部字段，也不是直接去做宏大 EvoMap 市场幻想层。

这轮要做的是：

1. 建立 child → parent 的 **agenda merge / follow-up closure**
2. 建立 child → parent 的 **economic merge / lease settlement / utility writeback**
3. 建立 **collective specialization routing** 的第一版 runtime semantics
4. 建立 child outcome 的 **quality / utility / effectiveness absorption**
5. 让 parent-child organism 关系更完整地进入 truth surfaces

---

## 二、本轮核心判断

20.3 已证明：
- agenda 已进入 long-horizon organism structure

20.4 已证明：
- child runtime 已 actualize 为 funded / reportable / recallable / auditable primitive

20.5 必须继续前推到：

> **child runtime 不仅存在，而且它的结果真正改变 parent organism 的下一步行为、资源状态与分工结构。**

如果 20.5 只是继续做：
- 更多 child summary 字段
- 更漂亮的 dashboard child 卡片
- 更多 child manifest metadata

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Child → Parent Agenda Merge / Follow-up Closure

## 目标
让 child 的完成、失败、召回、merge result 真正进入 parent agenda / commitment 主路径，而不是只停留在 session summary。

## 必须实现
1. 建立或收口 child outcome → parent follow-up contract，至少能表达：
   - child result 触发的 parent follow-up
   - child failure 触发的 remediation / retry / downgrade
   - child recall 触发的 parent backlog / hold / requeue
   - child merge result 触发的 commitment update / next action
2. 优先沿现有 `Commitment` / `AgendaLawEvaluator` / `LifeCycleEngine` 主路径深化，不轻易新造平行 agenda 抽象。
3. child outcome 不应只写到日志，而要真实改变 parent-side agenda state 或 follow-up queue。

## 验收标准
- child runtime 的终态开始真实影响 parent agenda，而不是只停留在 reporting surface。

---

# G2. Child → Parent Economic Merge / Lease Settlement Closure

## 目标
让 child runtime 的资金消耗与结果价值真正进入 parent organism 的 economic closure。

## 必须实现
1. 收口 `ChildSession.trackSpend()` 与 `ChildFundingLease.recordSpend()` 的 canonical spend path，避免双轨预算真相。
2. 建立 child lease close-out / settlement / utility writeback 主路径，至少能表达：
   - spent / remaining / settled
   - expected vs realized utility
   - revoked / recalled / failed close-out
   - parent reserve / runway / cost summary 影响
3. 如果当前已有 economic truth / revenue surface / settlement path，优先深接线，不另造平行 ledger。

## 验收标准
- child runtime 不再只是“花了预算”，而是其 spend / settle / utility 会真实进入 parent economic state。

---

# G3. Collective Specialization Routing

## 目标
让 specialization 不只停留在 manifest contract，而开始影响 collective runtime 的任务分派与解释。

## 必须实现
1. 至少让这些 specialization 语义开始影响 runtime 行为：
   - role / specialization
   - expectedCapabilities
   - allowedToolCategories
   - reportingExpectation
2. parent 在 spawn / route / follow-up 时，应至少开始利用 specialization 做更合理的 child selection / reuse / interpretation。
3. 如果当前已有 spawn proposal / session registry / agenda flow，优先在现有主路径上深化。

## 验收标准
- specialization 开始从 contract-first 走向 runtime-meaningful routing。

---

# G4. Child Outcome Quality / Utility Absorption

## 目标
让 child 的完成质量、失败质量、报告质量开始成为 parent organism 可学习的运行时信号。

## 必须实现
1. 建立或收口 child outcome evaluation / quality signal，至少能表达：
   - completion quality
   - merge usefulness
   - failure severity
   - reporting reliability
   - utility realized vs expected
2. 这些信号至少开始影响：
   - parent follow-up choice
   - future routing / specialization preference
   - governance interpretation
3. 不要求一轮完成复杂 reputation economy，但必须建立第一版可消费信号面。

## 验收标准
- child runtime 的结果开始被 parent organism“吸收”，而不是看完就结束。

---

# G5. Parent-Child Organism Truth Surface

## 目标
让 operator / governance / economic truth 不只是显示 child summary，而要更真实地显示 parent-child organism closure 状态。

## 必须实现
1. truth surface 至少开始显示：
   - child outcome 对 parent commitments 的影响
   - child lease settlement / utility summary
   - specialization usage / routing snapshot
   - recent merge / recall / fail consequences
2. 优先深化 `economic-truth` / governance / posture / dashboard 现有 surface。
3. 不要只增加字段，要确保 operator 能看到“child runtime 如何改变 organism”。

## 验收标准
- operator truth 从“有 child”升级到“child 如何改变 organism”。

---

# G6. Discipline Continuation

## 目标
继续保持 20.3 / 20.4 的强验证纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 parent-child closure contract 必须同步：
   - tests
   - fixtures
   - truth consumers
   - dashboard/CLI/TUI 消费面
3. 不允许把 childRuntime summary 增强误判为 parent-child organism closure 已完成；必须看到主路径实际写回。

---

## 四、本轮建议实现顺序

建议按以下顺序推进：

1. **先收口 child spend / lease settlement canonical path**
2. **再收口 child outcome → parent agenda merge / follow-up path**
3. **再让 specialization 真正进入 routing / spawn interpretation**
4. **再接 child outcome quality / utility absorption**
5. **最后统一 truth surface 与 tests / typecheck / build**

这样可以保证：
- 先统一资源真相
- 再统一行为真相
- 再深化 collective routing
- 最后做 operator truth 收口

---

## 五、本轮必须回答的问题

### Q1. child spend / lease / settlement 是否已形成单一 canonical economic path？
### Q2. child outcome 是否已真实改变 parent agenda / follow-up state？
### Q3. specialization 是否已开始真实影响 routing，而不只停留在 manifest contract？
### Q4. child outcome quality / utility 是否已开始被 parent organism 吸收？
### Q5. truth surface 是否已从 child summary 升级到 parent-child organism closure summary？
### Q6. 20.5 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. child spend / lease / settlement canonical path 成立
### V4. child → parent agenda merge / follow-up 主路径成立
### V5. specialization routing semantics 成立
### V6. child outcome quality / utility absorption 成立
### V7. parent-child organism truth surface 明显增强
### V8. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不直接把 full collective evolution marketplace 一次性做完
- 不把 reputation economy / external capability market / EvoMap 全部硬塞进一轮
- 不把 UI 可视化膨胀当进展
- 不在未全绿时宣称完成
- 不把 childRuntime summary 的增强偷换成 organism closure 已完成

本轮真正目标是：

> **让 ConShell 更真实地拥有“子体结果改变母体”的 organism 主路径。**

---

## 八、一句话任务定义

> **Round 20.5 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备 governed child runtime actualization 的系统，继续推进成具备 parent-child organism closure 的系统——通过 child→parent agenda merge / follow-up、child lease settlement / economic utility writeback、specialization-driven routing、child outcome quality absorption，以及更真实的 parent-child organism truth surface，让子体运行时真正改变母体行为与生存状态。**
