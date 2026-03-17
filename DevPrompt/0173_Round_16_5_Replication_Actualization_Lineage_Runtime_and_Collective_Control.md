# Round 16.5 — Replication Actualization, Lineage Runtime, and Collective Control

> **文件定位**：这是 Round 16.5 的正式开发提示词。  
> **前置审计结论**：Round 16.4 已在干净环境下通过全量本地复证：`57 files / 1143 tests passing`。  
> 当前系统已具备：  
> - runtime kernel / viability / verification；  
> - economic runtime / memory / lifecycle / adaptive routing；  
> - autonomous agenda / durable commitments / restart continuity；  
> - sovereign identity closure / claims / operational self-trust；  
> - governance workflow domain + governance runtime unification + control surface。  
> **但当前最大的剩余缺口已经从“个体内部闭环”转向“复制实际化与群体控制”**：系统已经开始像一个受治理的自主个体，但还没有真正完成 child runtime actualization、lineage lifecycle、funding/recall/termination governance、peer/collective control 等更高阶生命体能力。  
> **本轮目标**：把当前“单体自治生命体 runtime”推进为“可复制、可追踪、可治理、可回收的 lineage-aware 自治生命体 runtime”。  
> **事实纪律**：禁止把 `spawn_child` 的服务层存在包装成“replication 已实际化”；禁止把 lineage 字段存在包装成“collective runtime 已成立”。

---

# 0. 本轮问题定义

Round 16.4 解决的是：
- 高风险动作已经开始默认走治理工作流；
- governance 已从 domain/service 进入 kernel 与 control surface；
- 系统内部核心高能力模块开始被统一收口。

但现在项目进入了一个新的关键门槛：

> **它是否真的能够“生孩子”、管理子代、控制资源、维持谱系、并在群体层面保持治理和身份连续性？**

当前虽然已经有：
- `multiagent/` 骨架
- lineage 基础字段
- governance 对 replication 的 action kind
- spawn child 的部分治理语义

但仍缺失：
1. child runtime 的正式 actualization 流程；
2. lineage registry / lineage lifecycle 的正式 owner；
3. funding / budget allocation / resource leases；
4. recall / terminate / abandon / orphan 语义；
5. child identity inheritance / divergence 规则；
6. collective control plane（至少最小版）的正式 contract。

因此，Round 16.5 的唯一正确问题定义是：

> **如何让 ConShell 从“可治理的单体自治 runtime”升级为“可复制、可治理、可回收、可追踪的 lineage-aware 自治生命体 runtime”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Replication Actualization + Lineage Runtime + Collective Control**

即：
1. child runtime creation 不再只是抽象 action，而是正式 actualization flow；
2. parent/child/lineage 关系有正式 runtime owner；
3. child funding / governance / recall / termination 有正式 contract；
4. identity / commitments / governance / economy 与 lineage 被统一起来；
5. 为后续 collective evolution / peer society 奠定真实运行时基础。

---

# 2. 本轮必须先回答的问题

## 2.1 什么叫 child runtime actualization？
你必须明确：
- 只是创建一个记录？
- 启动一个子 agent/process/session？
- 还是同时创建 identity + runtime state + lineage record + funding budget？

如果没有明确 actualization 定义，就会继续停在“spawn_child exists”假闭环。

## 2.2 Lineage 的 canonical owner 是谁？
你必须明确：
- 是 `MultiAgentManager`？
- 新 `LineageService`？
- 还是扩展 `SovereignIdentityService`？

如果 lineage 没有独立 owner，就无法形成长期谱系治理。

## 2.3 Child 与 parent 的边界是什么？
你必须明确：
- child 是否继承 wallet / claims / soul / memory / policy / constitution？
- 哪些继承，哪些复制，哪些引用，哪些重新生成？
- child failure 是否反向影响 parent？

## 2.4 什么叫 collective control 的最小成立条件？
你必须定义至少以下之一：
- parent 能列出 children
- parent 能查询 child status
- parent 能 recall/terminate child
- parent 能限制 child budget / action scope
- parent 能审计 child governance receipts

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Replication / Lineage Contract

必须新增正式 contract，例如：
- `lineage/lineage-contract.ts`
- 或 `multiagent/replication-contract.ts`

### 至少定义：
- `LineageNode`
- `LineageRelation`
- `ChildRuntimeSpec`
- `ChildRuntimeStatus`（planned / creating / active / degraded / recalled / terminated / orphaned / failed）
- `FundingLease`
- `RecallPolicy`
- `TerminationReceipt`
- `ReplicationReceipt`

### 必须覆盖：
- parent identity
- child identity summary
- origin proposal / governance proposal id
- funding source / budget cap
- inherited capabilities / restricted capabilities
- createdAt / recalledAt / terminatedAt

### 强要求：
- lineage 不能只是几个字段散落在 identity records 中

---

## Task 2 — 新增 LineageService / ReplicationRuntime 作为 canonical owner

必须建立一个正式 owner，例如：
- `LineageService`
- `ReplicationRuntime`

### 最小接口建议：
- `createChild(spec)`
- `activateChild(id)`
- `listChildren(filter?)`
- `getChild(id)`
- `recallChild(id, reason)`
- `terminateChild(id, reason)`
- `orphanChild(id, reason)`
- `attachFunding(id, lease)`
- `stats()`

### 验收标准：
- lineage 成为正式运行时状态，而不是只有 governance receipt
- parent 能通过统一 owner 查询和控制子代

---

## Task 3 — 将 Governance Replication Flow 推进到真实 Child Actualization

当前 governance 已能处理 replication action kind，但还需走完“批准后真的创建 child runtime”。

### 本任务必须完成：
1. governance proposal approved → child runtime actualization
2. actualization 后生成 `ReplicationReceipt`
3. child status 从 `planned/creating` → `active` 或 `failed`
4. 失败时有 cleanup / rollback 语义

### 至少要把以下状态链跑通：
- proposal
- approval
- apply
- child created
- child active / failed

### 禁止：
- 只创建 lineage record 而不形成 child runtime status

---

## Task 4 — 建立 Child Funding / Budget Lease Contract

这是 collective runtime 的关键。

### 本任务必须新增：
- parent → child funding lease
- budget cap / spend ceiling
- lease status（active / exhausted / revoked / expired）
- funding receipts / audit trail

### 至少完成：
1. child can be created with funding lease
2. funding lease 进入 governance / economic evaluation
3. child 超预算或 lease 撤销时有明确定义

### 目标：
让 replication 不只是“复制一个 agent”，而是“在经济约束下创建一个可持续/可终止的 child runtime”。

---

## Task 5 — 建立 Recall / Termination / Orphan Semantics

child lifecycle 的关闭路径必须明确。

### 本任务必须完成：
- `recallChild()`
- `terminateChild()`
- `orphanChild()`（若 parent 无法继续承担管理责任）

### 每个动作至少要定义：
- actor identity
- reason
- governance requirement
- resulting child status
- resource/funding cleanup
- receipt generation

### 强要求：
- recall/terminate 不能只是 flag 修改
- 必须进入 lineage runtime 与 governance trail

---

## Task 6 — Identity / Claims / Inheritance 与 Lineage 统一

当前已有 sovereign identity，但本轮必须回答 child identity 如何形成。

### 本任务必须至少实现：
1. child identity summary
2. lineage root / parent reference
3. generation number
4. inherited vs fresh claims distinction
5. child operational claims 至少可被 parent 查询

### 强要求：
- child 不得既像独立个体又完全无身份边界
- 必须明确哪些 identity 属性继承，哪些重新生成

---

## Task 7 — 建立最小 Collective Control Surface

本轮必须让 collective control 不只是内部服务。

### 至少新增一组 control surface：
- `GET /api/lineage/children`
- `GET /api/lineage/children/:id`
- `POST /api/lineage/children/:id/recall`
- `POST /api/lineage/children/:id/terminate`
- `GET /api/lineage/stats`

### 最低目标：
- 能列出 children
- 能查看 child status / funding / lineage metadata
- 能执行 recall / terminate

### 安全要求：
- 必须受 governance / identity / authority 约束

---

## Task 8 — 将 Commitments 与 Child Delegation 真正接通

当前 commitments/agenda 已存在，但 child 还未成为真实 delegation target。

### 本任务必须至少实现：
1. 某些 commitment 可 materialize 为“delegate to child”动作
2. child 执行结果可回流 parent commitments
3. failed delegation 影响 parent planning / governance / funding

### 目标：
让多体运行时不只是“存在 child”，而是“child 真正参与长期承诺推进”。

---

## Task 9 — 新增 Replication / Lineage / Collective Tests

本轮必须新增覆盖以下测试：

### 9.1 Lineage Contract Tests
- node / relation / status / receipts / leases 类型与状态迁移正确

### 9.2 Lineage Service Tests
- create/list/get/recall/terminate/orphan 正常工作

### 9.3 Governance-to-Actualization Tests
- approved replication proposal 真正创建 child runtime status
- failed actualization 有 rollback/failed receipt

### 9.4 Funding Lease Tests
- lease 创建、超额、撤销、过期行为正确

### 9.5 Identity / Inheritance Tests
- child lineage metadata 正确
- inherited vs fresh claims 语义正确

### 9.6 Control Surface Tests
- lineage API 可用
- recall/terminate 走 governance / authority boundary

### 9.7 Delegation Tests
- commitment → child delegation → result feedback 路径成立

### 9.8 Regression Tests
- 原有 1143 tests 无回归

---

## Task 10 — 文档与术语统一

必须新增/更新文档，明确：
1. 什么是 child runtime actualization
2. lineage 的 canonical owner 是谁
3. funding lease / recall / termination / orphan 的语义
4. child identity 继承边界
5. parent-child collective control 的最小成立面

### 禁止：
- 用“spawn exists”描述成“replication complete”
- 用“lineage field exists”描述成“collective runtime complete”

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical lineage / replication runtime owner**
2. **How child runtime actualization now works**
3. **How funding leases and child lifecycle are now governed**
4. **How child identity / inheritance now work**
5. **What collective control surfaces now exist**
6. **How commitments can now delegate to child runtimes**
7. **What tests were actually executed**
8. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “replication complete”但 child runtime 只是记录未 actualize
- “collective control complete”但无 control surface / no recall semantics
- “lineage complete”但 inheritance/funding/governance 未统一

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical lineage / replication runtime owner 已明确
- [ ] approved replication proposal 可 actualize child runtime
- [ ] lineage runtime 可查询 child status
- [ ] funding lease contract 已建立并可审计
- [ ] recall / terminate / orphan 语义已成立
- [ ] child identity / inheritance 规则已明确并落地
- [ ] 至少一组 collective control APIs 已建立
- [ ] commitments 至少一条路径可 delegate 到 child runtime
- [ ] 新增 replication/lineage tests 已通过
- [ ] 原有 1143 tests 无回归
- [ ] 文档中 collective runtime 术语已纠偏

---

# 6. 一句话结论

> **Round 16.5 的目标，不是再强化单体自治，而是让 ConShell 真正拥有“可复制、可治理、可回收、可追踪”的 lineage-aware 生命体运行时——为后续 collective evolution 奠定真实基础。**
