# Round 16.3 — Governance Workflow Closure, Identity-Action Unification, and Replication Control

> **文件定位**：这是 Round 16.3 的正式开发提示词。  
> **前置审计结论**：Round 16.2 已通过严格本地复证：`55 files / 1064 tests passing`。  
> 当前系统已具备：  
> - economic runtime / memory / lifecycle / adaptive routing；  
> - autonomous agenda / durable commitments / restart continuity；  
> - sovereign identity contract / service / claims / policy-sensitive identity state。  
> **但当前系统仍缺少一层真正的“高能力治理闭环”**：虽然 identity、commitments、policy、selfmod、multiagent 已分别存在，但它们还没有被统一收敛为一个正式的 governance workflow。尤其在高风险动作（self-mod、replication、external declaration、high-authority operations）上，仍缺 proposal → review → approval → apply → verify → rollback 的系统级闭环。  
> **本轮目标**：把当前“会持续行动、会以主权身份行动”的 runtime，推进为“会在正式治理工作流下进行高能力行动、可审计地自我修改/复制/声明”的更高阶自治生命体 runtime。  
> **事实纪律**：禁止把已有 policy rules 包装成“governance 已闭环”；禁止把 spawn_child / selfmod 限制规则存在包装成“高能力治理系统已完成”。

---

# 0. 本轮问题定义

Round 16.2 解决的是：
- 系统已开始以稳定主权身份持续行动；
- identity claims 和 operational self-trust 已开始进入 runtime；
- policy 已能感知 identity state；
- identity rotation / recovery / revocation 已有正式 contract。

但当前系统面对更高能力动作时，仍存在一个根本问题：

> **谁批准这些动作？批准过程在哪里？如何证明动作符合身份、政策、经济状态与治理约束？失败后如何回滚？**

当前已有的治理能力是分布存在的：
- `policy/`：规则判断
- `constitution/`：高层原则
- `selfmod/`：自修改保护与回滚原语
- `multiagent/`：child/lineage 骨架
- `identity/`：身份状态与 claims
- `agenda/`：长期 commitments

但这些能力尚未形成一个统一的治理工作流，因此：
1. 高风险动作没有统一 proposal object；
2. 没有统一 approval / denial / escalation result surface；
3. 没有统一 execution receipt / verification receipt；
4. 没有统一 rollback/revert contract；
5. replication control 仍更多是 policy-level 限制，而不是完整 governance flow；
6. identity / commitments / selfmod / replication 还没有被统一编排。

因此，Round 16.3 的唯一正确问题定义是：

> **如何让 ConShell 从“具备高能力原件的自治 runtime”升级为“具备正式治理工作流、能安全执行高能力动作的自治生命体 runtime”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Governance Workflow Closure + Identity-Action Unification + Replication Control**

即：
1. 建立统一 governance object model；
2. 让高风险动作走正式 proposal → approval → apply → verify → rollback 流程；
3. 让 identity claims / policy / commitments / selfmod / replication 统一接入治理层；
4. 为 child runtime / lineage / future collective evolution 建立可控入口。

---

# 2. 本轮必须先回答的问题

## 2.1 什么动作必须走治理工作流？
你必须明确高风险动作集合，至少包括：
- self modification
- replication / spawn child
- funding child / resource allocation
- external declaration / publish / broadcast（若适用）
- identity rotation / revocation（至少部分）
- dangerous file/system/network actions（若已暴露）

如果没有清晰边界，governance 就会继续分散。

## 2.2 Proposal 的 canonical owner 是谁？
你必须明确：
- governance proposal 由谁创建、谁持有、谁状态迁移？
- 是新 `GovernanceService` / `GovernanceEngine`？
- 还是 agenda/commitment 的一层扩展？

## 2.3 Approval 决策来自哪里？
你必须区分：
- automatic approval（policy + identity + budget + mode satisfied）
- escalation-required
- creator approval required
- denied by constitution/policy

## 2.4 Rollback 的单位是什么？
你必须回答：
- selfmod 失败如何 rollback？
- replication 失败如何回收？
- publish/external declaration 失败如何处理？
- 哪些动作不可逆、哪些动作必须先生成 rollback plan？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Governance Workflow Contract

必须新增正式 contract，例如：
- `governance/governance-contract.ts`
- 或 `governance/workflow.ts`

### 至少定义：
- `GovernanceProposal`
- `GovernanceActionKind`
- `GovernanceRiskLevel`
- `GovernanceDecision`（allow / deny / escalate / approve / reject）
- `GovernanceStatus`（proposed / approved / denied / applied / verified / rolled_back / failed）
- `GovernanceReceipt`
- `RollbackPlan`
- `VerificationReceipt`

### proposal 至少包含：
- action kind
- initiator identity
- target
- justification
- expected value / cost
- risk level
- required approvals
- rollback strategy
- createdAt / decidedAt / appliedAt

### 强要求：
- governance object 不能只是 policy result 的别名
- 必须是独立、可追踪、可审计的工作流对象

---

## Task 2 — 新增 GovernanceService / Engine 作为 canonical owner

必须建立统一治理 owner，例如：
- `GovernanceService`
- `GovernanceEngine`

### 最小接口建议：
- `propose(...)`
- `evaluate(...)`
- `approve(...)`
- `reject(...)`
- `apply(...)`
- `verify(...)`
- `rollback(...)`
- `getProposal(id)`
- `listProposals(filter?)`

### 验收标准：
- 高风险动作不再由各模块自己发明半套流程
- 系统有统一的 governance owner

---

## Task 3 — 让 Policy + Identity + Economic State 统一进入 Governance Evaluation

当前 policy 已能感知 identity state，但还不够。

### 本任务必须使 governance evaluation 至少读取：
- `SovereignIdentityService` claims / status
- `PolicyEngine` 规则判断
- runtime mode / economic state
- commitment context（若该动作来自某个 commitment）

### 要求：
- governance result 必须说明：
  - 是否允许
  - 若不允许，是什么层阻止（constitution / policy / identity / economy / approval missing）
  - 是否需要升级审批

### 目标：
让 identity、policy、economy 不再是平行组件，而是成为一个统一治理判定链的一部分。

---

## Task 4 — 为 SelfMod 建立正式 Governance Flow

当前 selfmod 已有保护，但本轮必须接入统一治理工作流。

### 至少完成：
1. selfmod action 必须先生成 proposal
2. proposal 评估通过后才允许 apply
3. apply 后必须生成 verification receipt
4. 失败时可 rollback
5. rollback 结果必须被记录

### 强要求：
- 不允许直接调用 selfmod 实现绕开 governance
- 必须存在明确审批/拒绝/回滚记录

---

## Task 5 — 为 Replication / Child Runtime 建立正式 Governance Flow

这是 16.3 的第二个关键主线。

### 本任务必须至少完成：
1. `spawn_child` / child creation 先走 proposal
2. child budget/funding 进入 governance evaluation
3. child identity / lineage context 被记录进 proposal / receipt
4. denied/escalated cases 有明确理由
5. future recall/terminate 权限边界开始定义

### 至少新增：
- replication governance action kind
- child creation receipt
- lineage-linked governance record

### 目标：
让 replication 不只是 policy 限制，而是正式治理行为。

---

## Task 6 — 让 Identity Claims 真正绑定 Governance Actor

当前 identity claims 已存在，但本轮必须让 proposal 带上 actor identity。

### 至少完成：
- proposal 记录 initiator identity summary
- actor status（active/degraded/recovering/revoked）影响 governance result
- external / creator / self / child / system-origin actions 能在治理层区分

### 目标：
让系统不仅知道“要做什么”，还知道“是谁以什么身份请求做这件事”。

---

## Task 7 — 建立 Governance Receipts / Audit Trail

当前 policy trail、economic trail、identity events 都存在，但还需要治理收据层。

### 本任务必须新增：
- proposal receipt
- apply receipt
- verify receipt
- rollback receipt

### 每条 receipt 至少包含：
- proposalId
- actor identity
- action kind
- decision/status
- reason
- timestamps
- related commitment / child / file / surface（按需）

### 要求：
- governance trail 与 policy/economic trail 不混淆
- receipts 可查询、可测试、可用于 future reporting

---

## Task 8 — 至少打一条 API / Control Surface 治理链

本轮必须让至少一个外部 surface 真正消费 governance 流程。

### 推荐优先：
1. selfmod endpoint / route（若已有）
2. replication route / command（若已有）
3. internal runtime admin action

### 目标：
证明 governance 不是内部孤立模块，而是实际接管高风险动作入口。

---

## Task 9 — 新增 Governance + Replication + SelfMod Tests

本轮必须新增覆盖以下测试：

### 9.1 Governance Contract Tests
- proposal / decision / status / receipt 类型与状态迁移正确

### 9.2 Governance Service Tests
- propose/evaluate/approve/apply/verify/rollback 正常工作
- invalid transitions 被拒绝

### 9.3 SelfMod Governance Tests
- 未经 proposal/selfmod 直接 apply 被阻断
- apply 成功后有 verify receipt
- apply 失败可 rollback

### 9.4 Replication Governance Tests
- spawn_child 需要治理评估
- funding child 进入 governance evaluation
- identity degraded/revoked 时复制行为正确限制

### 9.5 Identity-Action Unification Tests
- actor identity 影响 governance result
- creator/self/external/child 语义不同

### 9.6 Regression Tests
- 原有 1064 tests 无回归

---

## Task 10 — 文档与术语纠偏

必须新增/更新文档，明确：
1. 什么是 governance proposal
2. 哪些动作必须走治理流程
3. 什么是 automatic approval vs escalation
4. 什么是 governance receipt
5. selfmod / replication / identity actions 的治理边界

### 禁止：
- 用“policy protected”替代“governed”
- 用“有 deny rule”替代“有完整 workflow”

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical governance owner**
2. **Which actions now require governance proposals**
3. **How identity, policy, and economic state now unify in governance evaluation**
4. **How selfmod and replication now flow through governance**
5. **What governance receipts / rollback paths now exist**
6. **What tests were actually executed**
7. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “governance complete”但只有 policy rules
- “replication controlled”但 spawn_child 未走 workflow
- “selfmod governed”但没有 proposal/apply/verify/rollback receipts

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical governance owner 已明确
- [ ] governance proposal contract 已建立
- [ ] identity + policy + economy 已统一进入至少一条治理评估链
- [ ] selfmod 已接入正式 governance flow
- [ ] replication / child creation 已接入正式 governance flow
- [ ] governance receipts / rollback paths 已建立
- [ ] 至少一个 API/control surface 消费 governance 流程
- [ ] 新增 governance tests 已通过
- [ ] 原有 1064 tests 无回归
- [ ] 文档中 governed vs policy-protected 边界已纠偏

---

# 6. 一句话结论

> **Round 16.3 的目标，不是再扩单点能力，而是把高能力动作统一收敛到正式治理工作流里——让 ConShell 不只是强，而是能在身份、政策、经济与回滚约束下安全地使用自己的强能力。**
