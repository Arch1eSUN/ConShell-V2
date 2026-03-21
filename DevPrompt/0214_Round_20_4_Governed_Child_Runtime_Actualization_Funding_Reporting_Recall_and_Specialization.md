# DevPrompt 0214 — Round 20.4
## Governed Child Runtime Actualization / Funding / Reporting / Recall / Specialization

你现在处于 **ConShellV2 Round 20.4**。

Round 20.1、20.2、20.3 已连续被独立真实性审计确认为**强成立轮**。

当前已经被确认的关键现实包括：
- `TaskAdmissionGate` 已让 economic truth 进入 admission path
- `LifeCycleEngine` 已让 agenda 进入 Tick/Event 生命周期结构
- `TaskSettlementBridge` 已建立 task outcome → economic writeback 主路径
- `SpawnAffordabilityGate` 已让 child spawn 进入 affordability 判断
- `Commitment` 已升级为 10-state long-horizon agenda entity
- `AgendaLawEvaluator` / `AgendaLifecycleReconciler` 已让 creator / governance / survival / economic / time 进入统一 agenda law
- 独立验证已达：**98/98 files、1934/1934 tests 全绿**

最新阶段判断已经很清楚：

> **ConShell 已从“拥有生命体控制平面”的系统，推进到“开始受经济生存规律和长期 agenda law 共同驱动并改变自身行为”的系统。**

但现在最关键的剩余主线也已经收敛：

> **系统已经拥有 child proposal / governance inbox / what-if / affordability / session primitive，但 child runtime 仍未形成真正的 governed actualization 闭环。**

也就是说，现在已经有：
- spawn proposal
- governance inbox
- what-if projection
- affordability gate
- ChildSession / SessionRegistry 骨架
- governance 与 economic 主路径的前置约束

但仍没有真正完成：
- child funding discipline
- child reporting contract
- recall / pause / merge / failure handling
- child specialization semantics
- parent-child runtime accountability
- child outcome 回写到 governance / economic / agenda truth

因此 Round 20.4 的唯一主轴，不再分散：

> **把 ConShell 从“能提出 child proposal 并判断养不养得起”的系统，继续推进成“child runtime 真正可被批准、被资助、被追踪、被召回、被审计”的系统。**

---

## 一、本轮唯一总目标

**完成 Governed Child Runtime Actualization 的第一轮强收口，让 child runtime 不再只是 proposal + affordability + primitive skeleton，而成为真正受治理、受预算、可报告、可召回、可审计的执行闭环。**

这轮不是做更大的 collective 幻想层，也不是简单再加几个 lineage 字段。

这轮要做的是：

1. 建立更明确的 **child funding / budget lease** 结构
2. 建立 **child reporting / checkpoint / outcome** 主路径
3. 建立 **recall / pause / fail / merge** 的治理动作语义
4. 让 **child specialization** 进入 canonical runtime semantics
5. 让 parent-child 关系真实回写到 governance / economic / agenda truth

---

## 二、本轮核心判断

20.1 已证明：
- spawn proposal / governance inbox / what-if 成立

20.2 已证明：
- spawn affordability gate 成立
- child runtime 开始受经济可行性约束

20.3 已证明：
- long-horizon agenda law 已成形
- 系统开始具备更长期的生命过程结构

20.4 必须继续前推到：

> **proposal 批准 → child funding → child activation → reporting / checkpoint / outcome → recall / merge / failure handling → parent truth writeback**

如果 20.4 只是继续停留在：
- proposal 字段更丰富
- lineage 结构更复杂
- UI 上多几个 child 卡片

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Child Funding Contract / Budget Lease

## 目标
让 child runtime 的启动不只是“被批准”，而是“被分配可追踪的预算/租约”。

## 必须实现
1. 建立或收口 **Child Funding Contract** / **Budget Lease**，至少能表达：
   - child session id / proposal id
   - parent id
   - allocated budget
   - reserve freeze / spend ceiling
   - duration / expiry
   - purpose / expected utility
   - funding status
2. child runtime 不能只是拿到一个数字预算，而要具备：
   - lease active / exhausted / revoked / expired 等状态语义
3. affordability gate 与实际 funding contract 必须接线，不能各说各话
4. funding contract 要能被 governance / economic truth 消费

## 验收标准
- child funding 不再只是 proposal 文案，而是 runtime 可追踪资源边界

---

# G2. Child Reporting / Checkpoint / Outcome Contract

## 目标
让 child runtime 有真正的可审计执行回报路径，而不是只留下完成/失败终态。

## 必须实现
1. 建立或收口 **Child Report Contract**，至少能表达：
   - status
   - progress
   - budget used
   - current checkpoint
   - last activity
   - risk / issue
   - interim findings / result summary
2. child runtime 至少要支持：
   - heartbeat-like progress report
   - checkpoint report
   - terminal outcome report
3. 若已有 SessionRegistry / ChildSession / spawn outcome 结构，优先沿现有主路径深化
4. 报告数据必须可被：
   - governance truth
   - economic truth
   - operator control surface
   消费

## 验收标准
- child runtime 从“黑盒执行单元”推进为“可观测、可审计执行单元”

---

# G3. Recall / Pause / Merge / Failure Semantics

## 目标
让 child runtime 不只是能生出来，还要能被安全治理和回收。

## 必须实现
1. 至少定义并接通这些治理动作语义：
   - recall
   - pause / resume（如当前结构允许）
   - fail / abort
   - merge result / close out
2. 对每种动作明确：
   - 何时允许触发
   - 对预算与 funding lease 有何影响
   - 对 agenda / governance / economic truth 有何影响
3. recall / failure 不能只是状态改一下，必须保留原因链与时间点
4. 若某些动作当前轮无法 fully materialize，也要至少把 canonical contract 与 truth path 先接通

## 验收标准
- child runtime 开始具备“受治理的生命周期”，而不是“spawn once then hope for the best”

---

# G4. Child Specialization Semantics

## 目标
把 child runtime 从 generic subtask executor 推进成更像具有职责边界的 specialized runtime role。

## 必须实现
1. child contract / manifest 中至少能更清晰表达：
   - role
   - scope
   - expected capability
   - allowed tools / action bounds（如当前主路径已有相关语义）
2. specialization 不应只是一段描述，而应影响：
   - reporting expectations
   - governance interpretation
   - operator understanding
3. 如果当前已有 childName / childRole / genesisPrompt 等字段，优先深化，不另造平行抽象

## 验收标准
- child runtime 更像“受治理的专门化子体”，而不是无差别克隆执行器

---

# G5. Parent-Child Truth Writeback

## 目标
让 child runtime 的存在与结果真正回写到系统 truth surfaces，而不是只停留在局部对象。

## 必须实现
1. 至少把以下结果更明确地回写到 truth surfaces：
   - child count / active children
   - lease status / budget used
   - recent child outcomes
   - recalled / failed / merged children
   - parent-child relation summary
2. 如果 governance/economic-truth/posture/agenda 里已有相关 surface，优先深接线
3. child runtime 的失败或成功，应至少开始影响：
   - governance summary
   - economic summary
   - parent agenda / follow-up state

## 验收标准
- child runtime 不再是 hidden side path，而是 operator 可见的 canonical system truth 组成部分

---

# G6. Discipline Continuation

## 目标
继续保持 20.1 / 20.2 / 20.3 建立起来的高质量纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 child runtime / funding / reporting / recall contract 必须同步：
   - tests
   - fixtures
   - API consumers
   - dashboard/CLI/TUI 消费面
3. 不允许把“有 child runtime”写成已完成，除非 funding/reporting/recall 至少主路径成立

---

## 四、本轮建议实现顺序

建议按以下顺序推进：

1. **先收口 Child Funding Contract / Budget Lease**
2. **再收口 Child Reporting / Checkpoint / Outcome Contract**
3. **再补 Recall / Pause / Merge / Failure Semantics**
4. **再补 Child Specialization Semantics**
5. **最后做 Parent-Child Truth Writeback 与 tests / typecheck / build**

这样可以保证：
- 先有资源边界
- 再有执行回报
- 再有治理动作
- 再有专门化语义
- 最后统一 truth surface 与验证面

---

## 五、本轮必须回答的问题

### Q1. child funding / budget lease 是否已成为 canonical runtime contract？
### Q2. child runtime 是否已具备可审计 reporting / checkpoint / outcome path？
### Q3. recall / pause / fail / merge 是否已有真实治理语义？
### Q4. child specialization 是否已不只是文案字段？
### Q5. parent-child truth writeback 是否已进入 governance / economic / agenda truth surfaces？
### Q6. 20.4 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. child funding / lease contract 成立
### V4. child reporting / checkpoint / outcome 主路径成立
### V5. recall / failure / merge 等治理动作至少主路径成立
### V6. child specialization semantics 成立
### V7. parent-child truth writeback 明显增强
### V8. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不直接把 full collective evolution 一次性做完
- 不把 EvoMap / external market / lineage economy 全部强行塞进一轮
- 不把 UI cosmetic 扩张当进展
- 不在未全绿时宣称完成
- 不把 child runtime 的“存在”偷换成 actualization 已完成

本轮真正目标是：

> **让 ConShell 更真实地拥有可被批准、资助、追踪、召回、审计的子体运行时。**

---

## 八、一句话任务定义

> **Round 20.4 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备 spawn proposal / affordability / child session primitive 的系统，继续推进成具备 governed child runtime actualization 的系统——通过 child funding lease、reporting/checkpoint/outcome、recall/pause/merge/failure semantics、specialization semantics、以及 parent-child truth writeback，建立更真实的 child runtime 主路径。**
