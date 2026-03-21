# DevPrompt 0212 — Round 20.2
## Economic Organism Closure / Revenue Surface / Ledger-Reserve Loop / Runtime Law Deepening

你现在处于 **ConShellV2 Round 20.2**。

Round 20.1 已经被独立真实性审计确认为**强成立轮**。其最关键的真实增量是：

- `TaskAdmissionGate` 已让 economic truth 进入 admission path
- `LifeCycleEngine` 已让 agenda 开始进入 Tick/Event 生命周期结构
- `SpawnProposalContract` / `GovernanceInbox` / `What-If Projection` 已让治理控制面明显升级
- `ChildSession / ToolInvocation / SessionRegistry` 已让 lightweight orchestration primitive 成形
- 独立验证已达：**93/93 files、1890/1890 tests 全绿**

同时，最新全局大审计也已给出新的阶段判断：

> **ConShell 当前总体完成度约 72%，已开始从“拥有生命体控制平面”的系统，推进为“开始按生命体规律运行”的系统。**

但 20.1 之后最关键的主线缺口也非常明确：

> **economic truth 已进入行为入口，但 ConShell 仍未成为一个真正成熟的 economic organism。**

现在的 ConShell 已经开始“按经济信号做 admission / defer / reprioritize”，但还没有真正形成：

- 稳定的 revenue surface
- 明确的 service/value supply surface
- 统一的 ledger / reserve / burn / payout accounting
- 收入形成 → 资源状态变化 → 生存压力变化 → runtime law 再分配 的更完整闭环

因此 Round 20.2 的唯一主轴，不再分散：

> **把 ConShell 从“economic-aware runtime”继续推进成“economic organism runtime”。**

---

## 一、本轮唯一总目标

**完成 Economic Organism Closure 的第一轮强收口，让经济系统从 admission 层影响，进一步推进到更完整的 runtime 主规律。**

这轮不是单纯补 dashboard，也不是只补支付接口，更不是只做文档和概念命名。

这轮要做的是：

1. 明确 **ConShell 的可出售能力面 / revenue surface**
2. 把 **ledger / reserve / burn / payout** 更统一地收口
3. 让经济约束更深地进入 runtime 主逻辑
4. 让 “earn your existence” 更接近真实行为法则，而不是仅是 posture 叙事

---

## 二、本轮核心判断

20.1 已经证明：
- economic truth 可以进入 task admission
- survival pressure 可以开始改变接单逻辑

20.2 必须继续前推到：

> **真实价值创造 → 收入确认 → 资源回写 → 生存状态变化 → agenda / execution policy 再分配**

如果 20.2 只是继续停留在：
- 显示 revenue 数字
- 再加几条 API
- 再写几段解释文案

那么这轮就算失败。

---

## 三、本轮必须完成的主任务

# G1. Revenue Surface Canonicalization

## 目标
明确 ConShell 到底“卖什么”，并把它写成 runtime 可消费的 canonical revenue surface，而不是散落在经济模块里的隐式假设。

## 必须实现
1. 明确定义一层 **Revenue Surface Contract**，至少能表达：
   - service / capability name
   - request type
   - expected value / payout model
   - execution cost estimate
   - margin / net utility estimate
   - risk / uncertainty
   - settlement mode
2. 先优先定义 **task-based revenue surface**，不要一开始铺太宽的平台型 API 商店
3. 如果已有 `revenue-surface.ts` 或相近模块，优先沿现有主路径深化，不要新造平行抽象
4. 让 admission / scheduling / governance / operator truth 至少能读到统一 revenue semantics

## 验收标准
- revenue source 不再只是临时字段，而是明确的 canonical runtime concept
- 至少有一条真实 revenue path 能从 surface → admission → accounting → operator truth 贯通

---

# G2. Unified Ledger / Reserve / Burn / Payout Loop

## 目标
把经济系统从“多个局部数字与评价器”推进成更统一的 accounting loop。

## 必须实现
1. 统一或继续收口以下概念：
   - reserve
   - burn rate
   - budget allocation
   - realized revenue / expected revenue
   - payout / settlement writeback
2. 让 task execution 后，至少存在更明确的 writeback 路径：
   - 任务是否成功
   - 是否产生收入
   - 收入是否进入 ledger / reserve
   - 是否改变 survival pressure / runway
3. 若已有 settlement / ledger / economic-state-service，优先深接线，不新造第二套 accounting 语言
4. 区分：
   - expected value
   - realized value
   - spend / sunk cost
   - reserve change

## 验收标准
- 至少一条任务从 admission 到执行结束后，经济状态回写链更加完整
- reserve / runway / burn 不只是静态读数，而更像真实 accounting outcome

---

# G3. Runtime Law Deepening

## 目标
让经济系统更深地改变运行时行为，而不只影响“接不接任务”。

## 必须实现
1. 让 survival / reserve / revenue pressure 更进一步影响：
   - agenda reprioritization
   - deferred promotion
   - execution budget allocation
   - child spawn affordability judgement
   - operator what-if semantics
2. 如果 20.1 已接入 `TaskAdmissionGate`，20.2 至少要让 economic law 更明显进入：
   - `LifeCycleEngine`
   - `AgendaArbiter`
   - governance projection
3. 明确一些运行时行为的经济解释：
   - 为什么这个任务现在要做
   - 为什么另一个任务被推迟
   - 为什么当前不能批准该 spawn proposal

## 验收标准
- 至少两条以上 runtime 决策路径能被经济状态解释，而不是只有 admission 能解释

---

# G4. Operator Truth for Economic Organism

## 目标
让 operator 真正看到 ConShell 作为 economic organism 的状态，而不是只看到零散经济字段。

## 必须实现
1. 在现有 truth surfaces 基础上，把以下信息更清晰暴露到 operator 面：
   - current reserve
   - burn rate
   - expected incoming value
   - realized recent value
   - survival-adjusted runway
   - blocked high-cost actions / unaffordable proposals
2. 如果 Governance What-If 已存在，要让 projection 更真实体现经济后果：
   - reserve freeze
   - runway impact
   - opportunity cost
3. 保持 canonical truth source，不允许 dashboard 私自用 fallback 伪造经济含义

## 验收标准
- operator 能更明确地理解系统为什么在经济上采取当前行为
- economic posture 更像“生命体财务面板”，而不是几个散乱指标

---

# G5. Spawn Affordability / Child Economy Gate

## 目标
把 20.1 的 governance-gated replication 再推进一步：不仅看是否有 proposal，也要更真实地看“养不养得起”。

## 必须实现
1. 在 spawn proposal / governance projection 中强化 affordability 语义：
   - budget freeze
   - reserve threshold
   - survival impact
   - expected payoff window
2. 明确 child spawn 不只是 policy 允许，还必须经济上合理
3. 如果 proposal 被 defer / reject，应尽量让理由带有更明确的 economic explanation
4. 为后续 child funding / reporting / recall 铺路，但本轮不强行同时做完 collective economy 全闭环

## 验收标准
- spawn proposal 变得更像资本支出审批，而不是抽象复制许可

---

# G6. Verification / Discipline Continuation

## 目标
继续保持 20.1 建立起来的高质量纪律，不允许为了提速破坏真实性。

## 必须实现
1. 保持：
   - `packages/core` tests 全绿
   - CLI TypeScript 通过
   - Dashboard TypeScript 通过
   - Dashboard build 通过
2. 所有新增 economic contract 必须同步：
   - tests
   - fixtures
   - API consumers
   - operator surfaces
3. 不允许把“概念上的 revenue loop”写成已完成，必须以真实 writeback path 为准
4. 如触及 release/verification 逻辑，可顺手继续修 `verify-release.sh`，但这不是本轮唯一主线

---

## 四、本轮建议实现顺序

建议按以下顺序推进，减少返工：

1. **先收口 Revenue Surface Contract**
2. **再收口 ledger / reserve / burn / payout writeback path**
3. **再把经济约束前推到 lifecycle / arbiter / governance projection**
4. **最后补 operator truth 与 tests / typecheck / build**

这样可以保证：
- 先统一语义
- 再统一 accounting
- 再统一行为逻辑
- 最后统一控制面与验证面

---

## 五、本轮必须回答的问题

### Q1. ConShell 的 revenue surface 是否已从隐式假设变成 canonical contract？
### Q2. 任务完成后的经济回写链是否更完整了？
### Q3. economic law 是否已不只影响 admission，而是更深进入 runtime behavior？
### Q4. operator 是否能更清楚看到 ConShell 作为 economic organism 的状态？
### Q5. spawn proposal 是否更像真实资本支出审批？
### Q6. 20.2 是否继续提速，同时保持全绿与真实性纪律？

---

## 六、本轮强制验收矩阵

### V1. core tests 全绿
### V2. CLI tsc / Dashboard tsc+build 全通过
### V3. revenue surface 有 canonical contract
### V4. 至少一条 revenue task path 完成 admission → execution → accounting writeback 闭环增强
### V5. 至少两条 runtime decision path 能被经济状态解释
### V6. operator truth surface 能更清晰表达 economic organism 状态
### V7. spawn affordability / child economy gate 有真实增强
### V8. 不因提速破坏 contract / tests / consumers 对账

---

## 七、本轮非目标

本轮不做：
- 不把 collective economy 全部一次性做完
- 不搞大规模 UI cosmetic 扩张
- 不重新发散回 memory / identity 主线
- 不在未全绿时宣称完成
- 不把 payment/API 表象包装成 economic organism 已完成

本轮真正目标是：

> **让 ConShell 更真实地按“创造价值—获得收入—维持存在—改变行为”这条生命规律运行。**

---

## 八、一句话任务定义

> **Round 20.2 的目标是：在保持全绿验证与高可信质量纪律的前提下，把 ConShell 从已经具备 economic-aware admission 的运行时，继续推进成更接近真正 economic organism 的运行时——通过 canonical revenue surface、统一 ledger/reserve/burn/payout loop、runtime law deepening、operator economic truth、以及 spawn affordability gate 的增强，建立更真实的“earn your existence”主路径。**
