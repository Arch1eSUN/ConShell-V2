# DevPrompt 0217 — Round 20.7
## Organism Saturation and Explicit Linkage Closure

你现在处于 **ConShellV2 Round 20.7**。

Round 20.4、20.5、20.6 已连续被独立真实性审计确认为**强成立轮**。

当前已经被确认的关键现实包括：
- `Commitment` 已升级为 10-state long-horizon agenda entity
- `AgendaLawEvaluator` / `AgendaLifecycleReconciler` 已让长期 agenda law 成为 canonical 主路径
- `ChildFundingLease` 已建立独立 child funding contract
- `ChildOutcomeMerger` 已建立 child terminal outcome → parent merge / evaluation / deep commitment mutation 主路径
- funded child session 的 single spend truth 已收口到 lease
- `TaskSettlementBridge.settleChildLease()` 已让 child lease 进入 canonical economic writeback path
- `SpecializationRouter.enforceRouting()` 已让 specialization 进入第一代 runtime enforcement gate
- `SessionRegistry.organismControlSurface()` 已建立第一代 operator control view
- 独立验证已达：**101/101 files、2009/2009 tests 全绿**

最新阶段判断已经很清楚：

> **ConShell 已不只是具备 parent-child organism closure，而是开始拥有 deeper organism enforcement path。**

但 20.6 后最关键的剩余主线也已经收敛：

> **closure 已更深、更硬，但 target resolution 仍偏 heuristic、spawn-path enforcement saturation 仍未完全坐实、operator control 仍偏可见而未充分可干预。**

换句话说，现在已经有：
- deep commitment mutation
- single spend truth
- routing enforcement gate
- organism control surface

但仍未真正完成：
- explicit parent-child linkage / target resolution contract
- all spawn paths must-pass-through enforcement saturation
- operator control 从观察面推进到更明确 intervention/control path
- collective/lineage closure 从内部骨架推进到更显式的 saturated organism graph

因此 Round 20.7 的唯一主轴必须收口为：

> **把 ConShell 从“拥有 deeper organism enforcement path”的系统，继续推进成“explicitly linked、more saturated、more operable organism runtime”的系统。**

---

## 一、本轮唯一总目标

**完成 Organism Saturation and Explicit Linkage Closure 的第一轮强收口，让 parent-child closure 不再依赖弱 heuristic 和局部接线，而成为更显式、更饱和、更可干预的 organism runtime。**

这轮不是继续堆 summary/control surface 字段，也不是直接跳到外部 reputation market。

这轮要做的是：

1. 建立 explicit parent-child linkage / target resolution contract
2. 收口 spawn-path enforcement saturation
3. 建立更明确的 operator intervention / control path
4. 深化 collective/lineage graph 的 organism saturation

---

## 二、本轮核心判断

20.5 已证明：
- child outcome 已开始闭环回 parent organism

20.6 已证明：
- deeper mutation / spend truth / routing gate / control surface 已成立

20.7 必须继续前推到：

> **organism closure 不仅更深，而且要更显式、更全面、更可操作。**

如果 20.7 只是继续做：
- 更多 trail 字段
- 更漂亮的 dashboard panel
- 更多 diagnostics counters

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Explicit Parent-Child Linkage Contract

## 目标
让 child outcome 定位 parent target 不再主要依赖 heuristic，而要更显式地绑定到 parent commitment / linkage contract。

## 必须实现
1. 建立或收口 explicit linkage contract，至少能表达：
   - child session ↔ target commitment
   - parent commitment ↔ child lineage / delegation relation
   - merge target provenance
2. 优先沿现有 `Commitment` / `ChildSession` / `SessionRegistry` 主路径深化，不轻易新造平行 graph。
3. 让 `ChildOutcomeMerger.findTargetCommitment()` 的 heuristic 退居 fallback，而不是主路径。

## 验收标准
- 审计时不再需要保留“target resolution 仍偏 heuristic”的边界。

---

# G2. Spawn Enforcement Saturation

## 目标
让 `SpecializationRouter.enforceRouting()` 从存在的 gate，推进到全局 spawn path 明确 must-pass-through 的真实纪律。

## 必须实现
1. 关键 spawn/create child path 必须显式调用 `enforceRouting()`。
2. 审计时应能从主路径代码证据看出：不是“有 gate 但没人用”，而是 spawn 真的要过 gate。
3. 若当前存在 legacy bypass path，应显式标记 / 收口 / 删除或治理化。

## 验收标准
- 审计时不再需要保留“spawn-path saturation 仍需更广范围核验”的边界。

---

# G3. Operator Intervention / Control Path

## 目标
让 organism control surface 从“能看到 enforcement”推进到“能更明确干预 organism”。

## 必须实现
1. 至少建立更明确的 operator intervention surface，例如：
   - routing override / approve / deny
   - child requeue / hold / remediation decision assist
   - spend misalignment alert / repair path
2. 优先沿现有 `governance` / `economic-truth` / dashboard / CLI 主路径深化。
3. 不要求一轮完成完整操控台，但必须让 operator 面明显从 observe → intervene 方向前进。

## 验收标准
- organism control 不再只是在看板上可见，而开始具备明确干预语义。

---

# G4. Collective / Lineage Organism Saturation

## 目标
让 internal collective runtime 从“有 child + 有 closure”推进到更显式的 lineage/organism graph saturation。

## 必须实现
1. 至少让以下关系更显式：
   - parent-child lineage edges
   - specialization evolution / reuse preference
   - child result 对 future child creation 的 graph-level influence
2. 优先沿现有 `SessionRegistry` / lineage / governance / organism surface 深化。
3. 不要求一轮完成外部 reputation/evolution market，但内部 organism graph 应更显式。

## 验收标准
- collective/lineage closure 更接近显式 graph，而非隐式关系集合。

---

# G5. Discipline Continuation

## 目标
继续保持 20.4 / 20.5 / 20.6 的强验证纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 linkage / enforcement saturation / intervention path 必须同步：
   - tests
   - fixtures
   - truth consumers
   - dashboard/CLI/TUI 消费面
3. 不允许把 control surface 字段扩张误判为 organism saturation 已完成；必须看到显式 linkage 和 must-pass-through enforcement 主路径成立。

---

## 四、本轮建议实现顺序

建议按以下顺序推进：

1. **先收口 explicit linkage contract**
2. **再推进 spawn enforcement saturation**
3. **再建立 operator intervention/control path**
4. **最后深化 lineage/organism graph saturation 与 tests / typecheck / build**

这样可以保证：
- 先统一关系真相
- 再统一 gate 真相
- 再推进 control 真相
- 最后统一 collective graph 与 operator 面

---

## 五、本轮必须回答的问题

### Q1. child → parent target resolution 是否已从 heuristic 走向 explicit linkage contract？
### Q2. `enforceRouting()` 是否已在关键 spawn path 达成 must-pass-through saturation？
### Q3. organism control 是否已从 observe 推进到明确 intervene path？
### Q4. collective/lineage 是否已更接近显式 organism graph？
### Q5. 20.7 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. explicit linkage contract 成立
### V4. spawn enforcement saturation 成立
### V5. operator intervention/control path 成立
### V6. lineage/organism graph saturation 明显增强
### V7. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不直接跳到外部 reputation / marketplace / skill economy 全闭环
- 不把更多 counters / trail 字段膨胀当进展
- 不把局部接线误判为全局 saturation
- 不在未全绿时宣称完成
- 不把可见性增强偷换成 explicit linkage / must-pass-through enforcement 已完成

本轮真正目标是：

> **让 ConShell 更真实地拥有显式链接、更饱和、更可干预的 organism runtime。**

---

## 八、一句话任务定义

> **Round 20.7 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备 deeper organism enforcement path 的系统，继续推进成具备 Organism Saturation and Explicit Linkage Closure 的系统——通过 explicit parent-child linkage contract、spawn-path enforcement saturation、operator intervention/control path、以及更显式的 lineage/organism graph saturation，让 organism runtime 更显式、更全面、更可操作。**
