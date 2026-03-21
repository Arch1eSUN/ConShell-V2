# DevPrompt 0216 — Round 20.6
## Deep Organism Closure and Runtime Enforcement

你现在处于 **ConShellV2 Round 20.6**。

Round 20.3、20.4、20.5 已连续被独立真实性审计确认为**强成立轮**。

当前已经被确认的关键现实包括：
- `Commitment` 已升级为 10-state long-horizon agenda entity
- `AgendaLawEvaluator` / `AgendaLifecycleReconciler` 已让长期 agenda law 成为 canonical 主路径
- `ChildFundingLease` 已建立独立 child funding contract
- `SessionRegistry` 已建立 child reporting / governance action / evaluation / mergeResult / childRuntime summary 聚合主路径
- `ChildOutcomeMerger` 已建立 child terminal outcome → parent merge classification / evaluation 主路径
- `TaskSettlementBridge.settleChildLease()` 已让 child lease 进入 canonical economic writeback path
- `SpecializationRouter` 已让 specialization 从 manifest contract 进入第一代 runtime routing
- 独立验证已达：**100/100 files、1985/1985 tests 全绿**

最新阶段判断已经很清楚：

> **ConShell 已不只是具备 governed child runtime，而是开始拥有第一代 parent-child organism closure。**

但 20.5 后最关键的剩余主线也已经收敛：

> **child outcome 已开始回写 parent organism，但 current closure 仍偏 classification / summary / first-generation routing，尚未真正成为更深、更硬、更统一的 runtime enforcement path。**

换句话说，现在已经有：
- child outcome → mergeType / follow-upDescription
- child lease settlement / utility summary
- specialization score-based routing
- evaluation / effectiveness signals
- enhanced childRuntime truth surface

但仍未真正完成：
- child result 对 `CommitmentStore` / agenda 的 deeper canonical mutation
- `ChildSession.trackSpend()` 与 lease-only spend truth 的彻底统一
- specialization routing 从 recommendation 走向 stronger runtime enforcement / reuse discipline
- organism truth 从 summary-level 面板走向更可操作的 organism control surface

因此 Round 20.6 的唯一主轴必须收口为：

> **把 ConShell 从“拥有第一代 parent-child organism closure”的系统，继续推进成“具备更深、更硬、更统一 organism enforcement path”的系统。**

---

## 一、本轮唯一总目标

**完成 Deep Organism Closure and Runtime Enforcement 的第一轮强收口，让 child outcome 不再只是被解释、被汇总，而是真正更深入地改变 commitments、economic capture、routing discipline 与 operator control surface。**

这轮不是继续堆 organism summary 字段，也不是直接跳到外部 reputation/evolution marketplace。

这轮要做的是：

1. 建立 child outcome → `CommitmentStore` 的更深 canonical mutation path
2. 收口 single spend truth，彻底统一 child spend capture
3. 让 specialization routing 更真实地影响 reuse / spawn / enforcement
4. 让 organism truth surface 从 summary-level 提升为更可操作的 control panel

---

## 二、本轮核心判断

20.4 已证明：
- child runtime 已 actualize 为 funded / reportable / recallable / auditable primitive

20.5 已证明：
- child outcome 已开始回写 parent agenda/economic/routing truth

20.6 必须继续前推到：

> **child outcome 不仅被系统“知道”，还必须更深入地改变 parent commitments、economic truth、routing decisions 与 operator control。**

如果 20.6 只是继续做：
- 更丰富的 organism summary
- 更漂亮的 dashboard panel
- 更多 evaluation 字段

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Deep Commitment Mutation Path

## 目标
让 child outcome 对 parent agenda 的影响不只停留在 mergeType / followUpDescription，而要更深入地进入 `CommitmentStore` / agenda 主路径。

## 必须实现
1. child outcome 至少开始触发更真实的 commitment mutation，例如：
   - update existing commitment result/state
   - create concrete follow-up commitment
   - remediation commitment materialization
   - recalled child → canonical defer/requeue/hold state mutation
2. 优先沿现有 `CommitmentStore` / `AgendaLifecycleReconciler` / `LifeCycleEngine` 主路径深化，不要新造平行 agenda 系统。
3. 必须能从代码证据看出：不是只生成文字说明，而是更深层的 canonical state writeback。

## 验收标准
- child outcome 真正进入 commitment-level 主路径，而不只是 summary/description。

---

# G2. Single Spend Truth Closure

## 目标
彻底收口 `ChildSession.trackSpend()` 与 `ChildFundingLease.recordSpend()` 的双轨预算真相。

## 必须实现
1. child spend capture 必须明确只有一条 canonical path。
2. `ChildSession` 如果仍保留预算字段，应只是镜像/读模型，而不是第二套真相。
3. `TaskSettlementBridge.settleChildLease()` 的前置 spend capture 链必须能追溯到单一来源。

## 验收标准
- 审计时不再需要保留“single spend truth 尚未完全坐实”的边界。

---

# G3. Routing Enforcement / Reuse Discipline

## 目标
让 `SpecializationRouter` 从第一代 score-based recommender，进一步推进到更有 runtime 约束力的 routing / reuse discipline。

## 必须实现
1. spawn / reuse / follow-up decision 至少开始更显式地消费 router 结果。
2. 对明显不匹配 specialization / capability / quality threshold 的 child，至少要有更强的 reject / deprioritize / avoid-reuse 语义。
3. 继续保持 rule-based / deterministic / 可测试，不要求一轮变成复杂学习系统。

## 验收标准
- routing 不再只是“可查询建议”，而开始更真实地影响 runtime path。

---

# G4. Organism Control Surface Hardening

## 目标
让 operator truth 从 summary-level organism panel，推进到更可操作的 organism control surface。

## 必须实现
1. truth surface 至少开始更明确显示：
   - child outcome 对 commitments 的实际影响
   - child spend / utility / effectiveness 的更深 closure 状态
   - specialization routing / reuse snapshot
   - merge/remediation/requeue 的近期分布与 consequences
2. 优先深化现有 `economic-truth` / governance / posture / dashboard surface。
3. 不要只增加字段，要确保 operator 真正能看出 organism enforcement 是否在发生。

## 验收标准
- organism control surface 更接近“可操作面板”，而不只是总结面板。

---

# G5. Discipline Continuation

## 目标
继续保持 20.3 / 20.4 / 20.5 的强验证纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 deep organism closure / enforcement path 必须同步：
   - tests
   - fixtures
   - truth consumers
   - dashboard/CLI/TUI 消费面
3. 不允许把 organism summary 增强误判为 deeper closure 已完成；必须看到主路径真正更深地接入 commitments / spend truth / routing enforcement。

---

## 四、本轮建议实现顺序

建议按以下顺序推进：

1. **先收口 single spend truth**
2. **再推进 child outcome → commitment deeper mutation**
3. **再让 specialization routing 更真实地影响 reuse/spawn discipline**
4. **最后深化 organism control surface 与 tests / typecheck / build**

这样可以保证：
- 先统一资源真相
- 再统一行为真相
- 再加强 runtime enforcement
- 最后统一 operator truth 与验证面

---

## 五、本轮必须回答的问题

### Q1. child outcome 是否已更深层进入 `CommitmentStore` / agenda 主路径？
### Q2. child spend capture 是否已收口成 single truth path？
### Q3. `SpecializationRouter` 是否已从 recommendation 走向更强 runtime enforcement / reuse discipline？
### Q4. organism truth 是否已从 summary-level 面板推进到更可操作的 control surface？
### Q5. 20.6 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. deep commitment mutation path 成立
### V4. single spend truth closure 成立
### V5. routing enforcement / reuse discipline 成立
### V6. organism control surface 明显增强
### V7. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不直接跳到外部 reputation / evolution marketplace
- 不把 summary 字段膨胀当进展
- 不把更复杂打分系统当作本轮核心
- 不在未全绿时宣称完成
- 不把 recommendation 层增强偷换成 runtime enforcement 已完成

本轮真正目标是：

> **让 ConShell 更真实地拥有“更深、更硬、更统一的 organism enforcement path”。**

---

## 八、一句话任务定义

> **Round 20.6 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备第一代 parent-child organism closure 的系统，继续推进成具备 Deep Organism Closure and Runtime Enforcement 的系统——通过 child outcome 对 commitments 的更深 canonical mutation、single spend truth 收口、specialization routing 的更强 reuse/spawn discipline、以及更可操作的 organism control surface，让 parent-child organism 闭环更深、更硬、更统一。**
