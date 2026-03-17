# DevPrompt 0181 — Round 17.1
## Governance Migration Closure / Runtime Execution Integration / Compatibility Decommissioning

你现在处于 **ConShellV2 Round 17.1**。

Round 17.0 已经完成了最关键的架构跃迁：
- `GovernanceVerdict` 成为新的结构化治理决策模型
- `GovernanceEconomicProvider` 将 survival/economic 约束注入治理层
- `InheritanceScope` 将 child capability ceilings 明确化
- `LineageBranchControl` 提供 quarantine / compromise / revoke / restore 的分支控制能力
- governance observability 已有最小控制面

但 **17.0 还没有真正收成“全仓迁移完成”**。
当前最大的真实问题不是“能力不存在”，而是：

1. **旧测试和旧调用路径仍在按旧语义使用 governance evaluate()**
2. **新 verdict 模型已经建立，但兼容层与调用层迁移尚未彻底完成**
3. **governance authoritative model 已成立，但 runtime execution integration 还不够彻底**
4. **17.0 更像架构落地成功，但全仓语义闭环尚未完成**

> **Round 17.1 = 把 17.0 的治理接管从“架构成立”推进到“全仓迁移完成、旧语义退役、执行路径真正统一、兼容债务关闭”的闭环轮次。**

---

## 一、17.1 的唯一目标

本轮不再扩新主题。
不新增大而散的 governance feature。 
不切去 collective 主线。
不重新打开 16.9.x 问题。

**17.1 的唯一目标：关闭 17.0 留下的迁移债、兼容债、执行接线债。**

一句话：

> **17.1 要让 GovernanceVerdict 真正成为全仓唯一有效的治理决策语义，并让 runtime / lineage / observability / tests 全部对齐它。**

---

## 二、当前已知真实问题

基于 17.0 审计，当前至少存在以下事实：

### F1. 17.0 新测试可以存在并通过，但旧 governance tests 仍按旧语义断言
尤其是旧测试仍在期待：
- `evaluate()` 返回裸字符串（如 `escalated`）

但 17.0 后真实返回的是：
- `GovernanceVerdict`
- `code: 'require_review' | 'deny' | 'allow' | ...`

### F2. 这意味着全仓治理语义迁移未完成
17.0 已经改了核心模型，但：
- 旧测试
- 旧 helper
- 旧断言
- 可能还有旧 route / 旧 service 辅助逻辑

仍然在使用旧 decision model。

### F3. authoritative governance 存在，但 execution integration 仍偏局部
17.0 已经证明 governance 可以裁决 replication / selfmod / dangerous action。
但还需要确认：
- runtime 关键执行路径是否全部先吃 verdict 再执行
- legacy path 是否仍可能绕过 verdict
- lineage / branch control receipt 是否与 execution receipt 完整对账

### F4. observability 已有，但治理控制面仍更偏“查看结果”而不是“对账执行链”
17.1 应当提升为：
- request → verdict → execution → lineage receipt → branch state
的可追踪链路。

---

## 三、本轮必须完成的目标

# G1. Governance Decision Model Migration Closure

彻底完成从旧 decision model 到 `GovernanceVerdict` 的迁移。

### G1.1 全仓查清旧语义残留
至少扫描并处理以下残留：
- 仍断言 `allow/deny/escalated` 裸字符串的测试
- 仍把 evaluate() 当 string 使用的 helper / adapter / route / service
- 仍然暴露旧 decision 形态的输出点

### G1.2 明确单一真相
17.1 后必须明确：
- **`GovernanceVerdict` 是唯一正式治理决策类型**
- 旧 `GovernanceDecision` / 旧 string decision 仅可作为临时 compatibility shim（若必须）
- 不允许继续在新代码中消费旧裸语义

### G1.3 如保留兼容层，必须显式隔离
如果为了低风险迁移需要短期保留 compatibility adapter，则必须：
- 明确标注 deprecated
- 明确限定仅旧路径可用
- 提供迁移说明
- 禁止新代码继续接入该层

---

# G2. Update and Repair Legacy Governance Test Suite

当前 17.0 的最大现实问题之一，就是**旧测试套件没有迁移到新治理语义**。

### G2.1 修复旧 governance tests
将旧测试从：
- `expect(decision).toBe('escalated')`
迁移到：
- `expect(verdict.code).toBe('require_review')`
- 或其它符合 17.0 contract 的断言

### G2.2 断言升级
所有治理相关测试应优先断言：
- `verdict.code`
- `verdict.reason`
- `verdict.riskLevel`
- `verdict.constraints`
- `verdict.rollbackEligible`
- `verdict.survivalContext`

而不是只断言单一字符串。

### G2.3 测试矩阵收口
将 17.0 和 legacy governance tests 整理为同一套迁移后语义矩阵，至少保证：
- 旧能力仍被覆盖
- 新 verdict 模型被充分覆盖
- 没有“双语义并存”的测试分裂状态

---

# G3. Runtime Execution Must Consume Verdict, Not Shadow Logic

17.1 必须验证并收口：
**所有关键 runtime 动作必须基于 `GovernanceVerdict` 执行，而不是在执行层再做一套隐式决策。**

### G3.1 至少检查并接通以下路径
- replication execution path
- selfmod execution path
- dangerous action execution path

### G3.2 要求
这些执行路径必须满足：
1. 先产生 proposal
2. 再 evaluate 得到 verdict
3. 再基于 verdict 执行 / 拒绝 / require review
4. 再记录 execution receipt
5. 若涉及 lineage，则记录 lineage receipt / branch effects

### G3.3 禁止项
- 禁止执行层只看某个 bool
- 禁止再次复制 governance decision logic
- 禁止绕过 `GovernanceVerdict` 直连 runtime action

---

# G4. Execution Receipt / Verdict / Lineage Receipt 对账闭环

17.0 里 verdict、lineage、branch control 都已出现，但 17.1 必须把它们对账成一条真实链路。

### G4.1 至少形成以下链条
- request id
- proposal id
- verdict id
- execution receipt id
- lineage record id（如适用）
- branch control receipt id（如适用）

### G4.2 目标
让系统能回答：
- 某个 child 为什么被创建？
- 是哪个 verdict 允许的？
- 带了哪些 constraints？
- 当前 branch 为什么被 quarantine / compromised / restored？
- 关联的 governance decision 是什么？

### G4.3 若当前 receipt 缺字段
本轮应补齐，而不是靠日志猜。

---

# G5. Governance Control Surface V2 — From Snapshot to Traceability

17.0 控制面主要能看 decisions / lineage / branch status。
17.1 需要把它升级到“可追链”。

### G5.1 至少补以下能力之一
A. 在现有 `/api/governance/decisions` 返回中补 trace 字段
B. 新增专门 trace endpoint（推荐更清晰）

### G5.2 最少需要可观测到
- recent verdicts
- pending review actions
- denied high-risk actions
- constrained approvals
- branch control receipts
- verdict ↔ lineage ↔ branch status linkage

### G5.3 控制面仍以最小可用为原则
不追求 UI 华丽，只要求可审计、可 debug、可证明 authoritative governance 没有停留在“嘴上接管”。

---

# G6. Compatibility Decommissioning Plan

17.1 必须明确哪些旧路径可以正式退役。

### G6.1 至少列出以下对象
- 旧 decision string semantics
- 旧 governance helper 返回值假设
- 旧 route/adapter 中隐式转换逻辑
- 任何已被 `GovernanceVerdict` 取代的临时结构

### G6.2 处理策略
对每个对象必须标记为：
- removed now
- deprecated now, remove in 17.2
- intentionally retained (with reason)

### G6.3 禁止无限拖延
不能继续让旧 decision semantics 长期和新 verdict 并存。

---

# G7. Verification Matrix for 17.1

17.1 必须有自己的验证矩阵，不可只复用 17.0。

### V1. legacy governance tests migrated to verdict semantics
### V2. no execution path depends on old bare decision string
### V3. replication path consumes verdict and records receipt linkage
### V4. selfmod path consumes verdict and records receipt linkage
### V5. dangerous_action path respects require_review / deny / constraints
### V6. lineage record and verdict linkage are queryable
### V7. branch control receipts link back to governance verdict when applicable
### V8. control surface exposes traceable governance chain
### V9. deprecated compatibility layer is isolated and marked
### V10. full governance package tests pass under the new semantics

### 测试要求
- 必须同时覆盖正例和反例
- 必须验证结构，不只验证“存在”
- 必须验证 migration closure，而不是只测新 happy path

---

## 四、建议优先级

### Priority 1 — 修旧测试与旧语义残留
先把最明显的迁移断裂修掉。

### Priority 2 — 接 execution receipt / lineage receipt 对账链
让治理接管成为真实闭环。

### Priority 3 — 控制面 traceability
最后把 observability 升级到可追链级别。

---

## 五、本轮非目标

本轮明确不做：
- 不开启 collective runtime 主线
- 不做大规模 UI 改版
- 不继续扩 17.0 的 action coverage 到所有 7 类动作
- 不重新设计 whole governance architecture
- 不重新打开 16.9.x 经济主线

---

## 六、验收标准

Round 17.1 只有在以下条件满足时才算完成：

1. 旧 governance decision string 语义已不再是主语义
2. legacy governance tests 已迁移并通过
3. `GovernanceVerdict` 成为全仓唯一正式治理决策 contract
4. replication / selfmod / dangerous_action 执行路径真实消费 verdict
5. verdict / execution / lineage / branch receipts 形成可追踪链路
6. governance control surface 能对账治理链路，而不只是展示快照
7. compatibility decommissioning plan 已明确写出
8. 最终输出能证明 17.0 的“架构接管”已被 17.1 推进为“全仓迁移完成”

---

## 七、最终输出格式

完成后必须输出：

### A. Migration Closure Summary
- 修掉了哪些旧语义残留
- 哪些旧路径已退役

### B. Runtime Integration Summary
- 哪些执行路径已真实接入 verdict
- receipt 链路如何打通

### C. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### D. Compatibility / Deferred
- 哪些兼容层仍保留
- 为什么保留
- 计划何时删除

### E. 不得伪造
- 没迁移的不能说迁移了
- 没接 runtime 的不能说已 authoritative
- 没形成 receipt linkage 的不能说已闭环
- 没跑测试的不能说已验证

---

## 八、一句话任务定义

> **Round 17.1 的任务是：把 17.0 的治理接管从“架构层成立”推进到“全仓语义迁移完成、执行路径统一、兼容债关闭、治理链路可追踪”的真实闭环。**
