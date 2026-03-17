# DevPrompt 0178 — Round 16.9.1
## Economic Runtime Closure / Survival Observability / Control Surface Completion

你现在处于 **ConShellV2 Round 16.9.1**。
Round 16.9 的 runtime 主线已经基本成立，但还没有形成一个工程上真正可交付、可审计、可观测、可验证的小闭环。

本轮**禁止扩大战线**。
不要开启新的宏大主题，不要引入与 16.9 主线无关的新系统。
本轮唯一目标是：

> **把 Round 16.9 已经形成的 revenue / economic projection / agenda survival shaping / survival gate 约束，补成可通过控制面观测、可通过测试验收、可通过文档说明、可通过提交边界固化的 16.9.1 收口版本。**

---

## 一、背景事实

Round 16.9 已完成的主线包括：

- Revenue contract：`RevenueReceipt` + `onRevenueRecorded`
- `RevenueService`：独立收入写入路径，直接写 ledger credit
- `EconomicStateService`：作为唯一 economic projection owner
- Revenue bridge：`RevenueSurfaceRegistry -> RevenueService`
- Agenda 深度经济耦合：
  - `reservePressure`
  - `netFlowFactor`
  - `burnRateUrgency`
  - `mustPreserve`
  - 保底 15 分钟 runtime survival window
- `SurvivalGate.canAcceptTask()`：
  - 在 `critical` / `terminal` 状态下拒绝非收入 / 非必保任务
- 33 个新增测试已通过
- 控制面 REST endpoint 延后，尚未补齐
- 仍有 3 个 pre-existing lint warning，位于 `agenda-generator.ts` 的 `computeEconomicScore` / `MemoryRecordStats` 类型问题，**不是 16.9 引入**

---

## 二、本轮目标

Round 16.9.1 必须完成以下四类工作：

### G1. 控制面闭环
补齐 16.9 defer 的控制面接线，让外部可以观测和审计经济 / 生存状态，而不是只存在于 runtime 内部。

### G2. 验收闭环
把“33 tests 全绿”提升为“每个验收目标都有明确测试映射”。

### G3. 工程闭环
清除会干扰后续轮次判断的工程噪音，尤其是文档失真与状态不透明问题。

### G4. 可信闭环
所有新增控制面 / 测试 / 文档都必须以 **16.9 的既有 runtime 设计为准**，不能倒逼 runtime 退化为浅表展示逻辑。

---

## 三、本轮必须完成的任务

# T1. 补齐 Economic / Survival 控制面 REST 接口

为 16.9 的 runtime 能力补齐控制面接口，最少提供以下只读能力：

### T1.1 Economic state endpoint
提供一个 REST endpoint，用于返回当前经济状态快照，至少包括：

- 当前 balance / ledger summary
- 最近 revenue receipts 摘要
- 当前 economic state / survival status
- reserve window / reserve floor / must-preserve 相关状态
- burn-rate 相关关键指标
- net flow 相关关键指标
- revenue pressure / reserve pressure 等 agenda shaping 输入摘要
- projection owner 信息（明确 `EconomicStateService` 是唯一 owner）

### T1.2 Survival gate explain endpoint
提供一个 REST endpoint，用于解释当前 `SurvivalGate` 的 admission policy 状态，至少包括：

- 当前 gate state
- 是否允许接新任务
- 若拒绝，给出结构化原因
- 当前状态是否属于 `critical` / `terminal`
- 非收入任务为什么被拒绝
- `mustPreserve` 任务为何可豁免
- 收入任务为何可继续进入

### T1.3 Agenda economic factors endpoint
提供一个 REST endpoint，用于查看当前 agenda 计算中已生效的经济 shaping 因子，至少包括：

- `reservePressure`
- `netFlowFactor`
- `burnRateUrgency`
- `mustPreserve`
- survival reserve window（保底 15 分钟）
- 最终这些因子如何影响排序/选择的摘要说明

### T1.4 约束
- 所有 endpoint 必须走现有 service 层
- 不允许在 route 层重算业务逻辑
- 不允许 route 层直接拼装另一套 projection
- 不允许复制一套 revenue / survival 计算逻辑到控制面

---

# T2. 标准化经济与生存状态对外契约

把当前 runtime 内部已有的经济 / 生存状态，整理为稳定的外部只读契约。

### T2.1 契约要求
新增或完善清晰的类型定义，至少覆盖：

- Economic snapshot
- Revenue receipt summary
- Survival gate decision summary
- Task acceptance reason
- Agenda economic factor summary

### T2.2 输出要求
这些契约必须满足：
- 字段语义稳定
- 命名可读
- 可供 dashboard / CLI / API 共用
- 能区分事实值、阈值、推导值、解释字段

### T2.3 禁止项
- 不要返回未整理的大量内部对象
- 不要把 runtime 内部临时结构直接裸露到 API
- 不要引入字段含义模糊的“debugOnly”垃圾结构，除非明确隔离

---

# T3. 建立 16.9.1 验收矩阵测试

不能只保留“33 tests 全绿”的表述，必须建立**目标 -> 测试**映射。

### T3.1 至少补齐以下测试覆盖
1. `RevenueReceipt` contract correctness
2. `RevenueService` writes ledger credit correctly
3. `EconomicStateService` is sole projection owner
4. `RevenueSurfaceRegistry -> RevenueService` bridge path works
5. agenda economic shaping consumes:
   - `reservePressure`
   - `netFlowFactor`
   - `burnRateUrgency`
   - `mustPreserve`
6. survival reserve floor / 15-minute preserve logic works
7. `SurvivalGate.canAcceptTask()` rejects:
   - non-revenue tasks in `critical`
   - non-preserve tasks in `terminal`
8. `SurvivalGate.canAcceptTask()` allows:
   - revenue tasks under survival pressure
   - must-preserve tasks when exemption is intended
9. REST endpoints reflect runtime truth rather than parallel computed truth
10. rejection reason payload is stable and structured

### T3.2 测试风格要求
- 每个测试文件名和描述都要能看出它对应哪个验收目标
- 尽量避免“只断言 not undefined”
- 必须覆盖正例和反例
- 对 gate 类逻辑，必须断言**原因**，不只断言 true/false

---

# T4. 标准化 Task Admission Reason / Rejection Reason

目前 gate 已能拒绝任务，但如果没有标准化 reason，控制面会变成黑箱。

### T4.1 需要输出结构化原因
定义稳定 reason schema，至少包括：

- code
- human-readable message
- blocking_state
- allowed_task_classes
- rejected_task_class
- survival metrics snapshot
- exemption_applied（如 must-preserve / revenue exemption）
- timestamp

### T4.2 目标
让 dashboard / CLI / API 能准确回答：

- 为什么当前任务被拒绝？
- 是 economic risk、survival state，还是 preserve policy？
- 是否存在豁免？
- 要恢复接单，需要满足什么条件？

---

# T5. 补齐最小控制面展示

如果 dashboard 已有合适页面或状态面板，本轮应最小接入以下展示，不追求视觉华丽，只追求可用：

- 当前 survival status
- 当前 balance / reserve / burn rate
- 当前 revenue inflow summary
- gate 是否 open / restricted / blocked
- 最近 5 条 revenue receipts
- 最近若干次 task rejection reason

要求：
- 只接线，不重造前端架构
- 以只读状态展示为主
- 页面存在即可，不要求大规模 UI 重设计

---

# T6. 文档同步

更新与 16.9.1 直接相关的文档，至少包括：

### T6.1 Runtime / audit / progress 文档
写清楚：
- 16.9 已完成什么
- 16.9.1 补了什么
- 哪些属于 runtime completion
- 哪些属于 control surface completion
- 哪些仍未完成（例如更大层面的 round 17 主题）

### T6.2 明确区分
文档中必须区分：
- **已实现**
- **已测试**
- **已暴露控制面**
- **仍 deferred**

禁止把 deferred 说成完成。

---

# T7. 清理 16.9.1 能直接收口的工程噪音

### T7.1 处理原则
仅清理与本轮直接相关、会影响后续判断的噪音，不做大规模清仓。

### T7.2 至少做到
- 清理或解释与本轮相关的重复文件 / 命名污染
- 保证新增控制面相关文件路径清晰
- 保证测试文件组织不混乱
- 对已有 3 个 pre-existing lint warning：
  - 若能低风险修复，可顺手修
  - 若不能，必须在最终报告中明确标注“仍为 pre-existing，不属于 16.9.1 引入”

---

## 四、实现原则

### P1. 单一 owner 原则
`EconomicStateService` 必须继续保持为唯一 economic projection owner。  
不得在 route / dashboard adapter / controller 层引入第二套 projection owner。

### P2. Runtime first, control surface second
控制面是 runtime 的镜像与解释层，不能反客为主。  
任何控制面接口都必须复用 runtime 真实状态。

### P3. Explainability by design
凡是 gate / agenda / revenue bridge 这类“约束型逻辑”，都必须具备可解释性输出，不允许成为黑箱。

### P4. Small closure, not broad expansion
本轮目标是 **small but hard closure**。  
不追求功能数量，只追求闭环质量。

---

## 五、非目标

本轮明确不做：

- 不开启新的 collective 大主题
- 不开启新的 replication actualization 大主题
- 不推进 full governance takeover beyond 16.9.1 scope
- 不进行大规模前端改版
- 不进行无关模块的系统性重构
- 不为追求“好看”而重写已工作的 revenue / survival 主线

---

## 六、验收标准

Round 16.9.1 只有在以下条件全部满足时，才算完成：

1. 已有 revenue / survival runtime 主线未被破坏
2. 控制面 REST endpoint 可读取：
   - economic snapshot
   - survival gate status
   - agenda economic factors
3. 所有 endpoint 来源于统一 service / contract
4. 已建立清晰的验收矩阵测试
5. gate reject / allow reason 可结构化解释
6. dashboard 或最小展示面已能看到关键经济 / 生存状态
7. 文档已同步说明 16.9 与 16.9.1 的边界
8. pre-existing lint warning 被修复或被明确隔离说明
9. 最终输出中明确列出：
   - 新增接口
   - 新增/修改契约
   - 新增测试
   - 已知遗留问题

---

## 七、最终输出格式

完成后必须输出：

### A. 变更摘要
- 本轮新增了哪些接口
- 新增了哪些类型/契约
- 新增了哪些测试
- 是否接入 dashboard / CLI

### B. 验收对账
按“目标 -> 证据”方式列出：
- 目标
- 对应代码位置
- 对应测试位置
- 是否通过

### C. 风险与遗留
- 哪些风险被消除
- 哪些风险仍然存在
- 哪些事项仍 deferred 到后续轮次

### D. 不得伪造
- 没跑测试不能说已通过
- 没接控制面不能说已暴露
- 没修 warning 不能说已清零
- 没完成的项必须明确写未完成

---

## 八、执行优先级

按以下顺序推进：

1. 先补契约
2. 再补 service 对外只读接口
3. 再补 REST route
4. 再补测试
5. 再接最小 dashboard 展示
6. 最后更新文档与收尾

---

## 九、一句话任务定义

> **Round 16.9.1 = 把 16.9 的 economic runtime / survival gate / agenda shaping 从“内部成立”补成“外部可观测、行为可解释、测试可验收、文档可审计”的小闭环版本。**
