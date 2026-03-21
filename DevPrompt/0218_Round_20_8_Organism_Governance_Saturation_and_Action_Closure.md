# DevPrompt 0218 — Round 20.8
## Organism Governance Saturation and Action Closure

你现在处于 **ConShellV2 Round 20.8**。

Round 20.4、20.5、20.6、20.7 已连续被独立真实性审计确认为**强成立轮**。

当前已经被确认的关键现实包括：
- `ChildFundingLease` 已建立 child funding contract
- `ChildOutcomeMerger` 已建立 child terminal outcome → parent merge / evaluation / deep commitment mutation 主路径
- funded child session 的 single spend truth 已收口到 lease
- `SpecializationRouter.enforceRouting()` 已进入 canonical governance replication spawn path，形成 must-pass-through gate
- `ChildSession.targetCommitmentId` + `ChildOutcomeMerger.findTargetCommitment()` 已建立 explicit linkage 主路径（explicit → delegateChildId → heuristic）
- `OrganismInterventionService` 已作为独立 intervention primitive 出现
- `SessionRegistry.organismControlSurface()` 已建立第一代 operator control view
- `SessionRegistry.organismLineageGraph()` 已建立第一代 explicit organism graph topology
- 独立验证已达：**102/102 files、2037/2037 tests 全绿**

最新阶段判断已经很清楚：

> **ConShell 已不只是拥有 deeper organism enforcement path，而是开始拥有 explicit linkage、mandatory spawn gate、operator intervention primitive 与第一版 organism graph saturation。**

但 20.7 后最关键的剩余主线也已经收敛：

> **现在最需要收口的，不再是“能不能看见 organism runtime”，而是“organism governance action 能不能真正闭环、回滚、审计、并形成更完整的 action system”。**

换句话说，现在已经有：
- explicit linkage
- canonical spawn gate
- intervention primitive
- graph topology

但仍未真正完成：
- intervention → canonical action execution closure
- rollback / undo / dispute / override lifecycle
- operator action 与 governance / policy / economic consequence 的一致闭环
- organism graph 从 topology 推进到 action/consequence semantics
- mandatory linkage / global spawn saturation 的治理级收口证明

因此 Round 20.8 的唯一主轴必须收口为：

> **把 ConShell 从“显式可见、可干预的 organism runtime”，继续推进成“治理动作真正闭环、可回滚、可审计、可表达后果语义的 organism action system”。**

---

## 一、本轮唯一总目标

**完成 Organism Governance Saturation and Action Closure 的第一轮强收口，让 organism runtime 不只是可观察、可干预，而是让治理动作本身成为有前置条件、有执行后果、有回滚路径、有审计记录的 canonical action system。**

这轮不是继续堆 surface 字段，也不是直接跳去做外部 reputation / marketplace 终局。

这轮要做的是：

1. 建立 intervention → canonical action execution closure
2. 建立 rollback / undo / dispute / override lifecycle
3. 建立 policy-coupled operator action model
4. 让 organism graph 从 topology 推进到 action/consequence semantics
5. 继续收口 mandatory linkage / spawn gate saturation 的治理纪律

---

## 二、本轮核心判断

20.6 已证明：
- deeper mutation / spend truth / routing gate / control surface 已成立

20.7 已证明：
- explicit linkage / intervention primitive / graph topology 已成立

20.8 必须继续前推到：

> **organism governance 不仅能发起动作，而且这些动作要进入 canonical runtime、产生明确后果、支持回滚/争议/审计，并能被 graph 与 control surface 真实表达。**

如果 20.8 只是继续做：
- 更多 intervention 字段
- 更漂亮的 dashboard panel
- 更多 diagnostics counters
- 更多 topology 可视化

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Governance Action Closure

## 目标
让 intervention primitive 不再只是记录/局部 mutation，而要进入 canonical organism action execution path。

## 必须实现
1. 至少为核心 operator action 建立 canonical execution closure，例如：
   - routing override
   - requeue child
   - hold / resume child
   - spend repair / spend verification action
2. action 必须具备：
   - preconditions
   - execution result
   - affected entities
   - consequence summary
3. action 不应停留在 ad hoc helper；要能被治理/registry/control surface 稳定消费。

## 验收标准
- 审计时能明确看到：operator intervention 已从“服务方法调用”推进到“canonical action execution path”。

---

# G2. Rollback / Undo / Dispute Lifecycle

## 目标
让治理动作具备更成熟的生命周期，而不是一旦执行就只有静态 history。

## 必须实现
1. 至少收口以下一种或多种能力：
   - rollback
   - undo
   - dispute
   - override supersession
2. 行动生命周期要能表达：
   - requested
   - executed
   - reverted / superseded / disputed / failed
3. 优先沿现有 governance / intervention / commitment / session 主路径深化，不轻易新造平行 action ledger。

## 验收标准
- 审计时不再只能说“有 intervention history”，而能说“治理动作具备生命周期与回滚/争议能力”。

---

# G3. Policy-Coupled Operator Action Model

## 目标
让 operator action 不只是人工命令，而是与 policy / governance / organism safety 边界真实耦合。

## 必须实现
1. 至少让关键 action 与 policy/guard 发生真实耦合，例如：
   - 某些 action 需要更高权限或 proposal 才能执行
   - 某些 action 会被 policy deny / warn / require approval
   - action 结果进入 governance/economic truth surface
2. 不要把 action system 变成“任何 operator call 都直接改 runtime”的裸写接口。
3. 优先沿现有 governance-service / routes / control surface / policy primitives 深化。

## 验收标准
- operator action 明显从“便利工具”推进到“受治理约束的 organism action model”。

---

# G4. Organism Graph Action / Consequence Semantics

## 目标
让 graph 不再只是 topology，而要开始表达 action/consequence semantics。

## 必须实现
1. 至少让以下一种或多种关系进入 graph edges / graph-facing truth：
   - override
   - requeue consequence
   - hold/resume consequence
   - rollback / supersession / dispute relation
   - routing enforcement consequence
2. graph 应尽量从 canonical action / session / commitment / intervention truth 投射，不新增平行事实源。
3. 优先沿现有 `organismLineageGraph()` / `organismControlSurface()` 深化，而不是另造 graph runtime。

## 验收标准
- 审计时 graph 不再只是 lineage topology，而开始具备 organism action semantics。

---

# G5. Mandatory Linkage / Global Spawn Saturation Continuation

## 目标
继续收口 20.7 留下的两个硬边界：
- spawn-time mandatory linkage saturation
- global spawn-path routing saturation

## 必须实现
1. 尽量让 delegated / organism-relevant child spawn 默认携带 `targetCommitmentId`。
2. 继续收口 child creation path，使 routing gate 不再只是 canonical governance replication path 成立，而尽量向“全局无遗漏 must-pass-through”逼近。
3. 若仍有 legacy bypass path，必须显式治理化：
   - 标记
   - 限制
   - 记录
   - 审计可见

## 验收标准
- 20.8 后审计时，20.7 留下的这两个保留边界至少应明显缩小，最好其中一项完全收口。

---

# G6. Discipline Continuation

## 目标
继续保持 20.4 / 20.5 / 20.6 / 20.7 的强验证纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 action lifecycle / rollback / policy coupling / graph consequence path 必须同步：
   - tests
   - fixtures
   - truth consumers
   - dashboard/CLI/TUI 消费面
3. 不允许把更多 control/action 字段误判为 action closure 已完成；必须看到真实 canonical action path、rollback/dispute semantics、policy coupling 与 graph consequence semantics。

---

## 四、本轮建议实现顺序

建议按以下顺序推进：

1. **先收口 governance action contract / execution closure**
2. **再补 rollback / undo / dispute lifecycle**
3. **再接 policy-coupled operator action model**
4. **最后把 graph 提升到 action/consequence semantics，并同步 tests / typecheck / build**
5. **同时持续治理 mandatory linkage / global spawn saturation 尾债**

这样可以保证：
- 先统一 action 真相
- 再统一 action 生命周期真相
- 再统一治理约束真相
- 最后统一 graph semantics 与 operator 面

---

## 五、本轮必须回答的问题

### Q1. intervention 是否已从 service method 推进到 canonical organism action execution path？
### Q2. action 是否已具备 rollback / undo / dispute / supersession 等生命周期能力？
### Q3. operator action 是否已与 governance / policy / safety 边界真实耦合？
### Q4. organism graph 是否已从 topology 推进到 action/consequence semantics？
### Q5. mandatory linkage / global spawn saturation 是否继续显著收口？
### Q6. 20.8 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. canonical governance action closure 成立
### V4. rollback / undo / dispute / supersession lifecycle 成立
### V5. policy-coupled operator action model 成立
### V6. organism graph action / consequence semantics 明显增强
### V7. mandatory linkage / global spawn saturation 至少缩小一个关键边界
### V8. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不直接跳到外部 reputation / marketplace / capability economy 全闭环
- 不把更多 counters / trail / action badges 膨胀当进展
- 不把局部 rollback helper 误判为 governance action closure 已完成
- 不在未全绿时宣称完成
- 不把 topology 更漂亮偷换成 action/consequence semantics 已完成

本轮真正目标是：

> **让 ConShell 更真实地拥有闭环治理动作、回滚能力、政策耦合和可表达后果语义的 organism action system。**

---

## 八、一句话任务定义

> **Round 20.8 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备 explicit linkage、mandatory spawn gate、operator intervention primitive 与第一版 organism graph topology 的系统，继续推进成具备 Organism Governance Saturation and Action Closure 的系统——通过 canonical governance action execution、rollback/undo/dispute lifecycle、policy-coupled operator action model、以及 action/consequence-aware organism graph，让 organism runtime 更闭环、更可回滚、更可审计、更接近终局。**
