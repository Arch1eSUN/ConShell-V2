# DevPrompt 0182 — Round 17.2
## Collective Governance / Delegation Authority / Peer Boundary Enforcement

你现在处于 **ConShellV2 Round 17.2**。

Round 17.0 与 17.1 已经完成了两个关键跃迁：
- governance 已从“存在”变为关键动作的正式决策层
- `GovernanceVerdict` 已成为正式治理语义
- replication / selfmod / dangerous_action 已进入治理链
- verdict / receipt / lineage / traceability 已经形成最小闭环

**接下来如果还继续只在单体治理层打磨，就会进入边际收益递减。**
17.2 最值得推进的方向，是把这套 authoritative governance 模型扩展到：

> **collective runtime / delegated execution / peer authority boundary**

一句话：

> **Round 17.2 = 让治理不只约束“自己做什么”，还正式约束“委派给谁做、在什么边界内做、出了问题如何追责与隔离”。**

---

## 一、本轮战略目标

17.2 要解决的问题不是“还能不能再做判断”，而是：

1. **当系统把任务交给 peer / child / delegatee 时，治理是否仍然掌握 authority？**
2. **collective runtime 的 delegation 是否受治理约束，而不是只看 peer selector / availability？**
3. **peer 被委派时，是否存在清晰的 capability / budget / scope ceiling？**
4. **delegate 执行失败、偏离、违规时，是否能沿 governance + lineage/peer graph 回溯和隔离？**

当前系统已经有：
- collective peer lifecycle
- discovery / reputation / staleness / quarantine
- lineage / inheritance / branch control
- governance verdict / trace chain

17.2 的任务是把这些点接成：

> **Delegation Governance Loop**

即：
**task delegation request → governance verdict → delegated scope issuance → execution tracking → peer/branch accountability → quarantine/revoke/rollback**

---

## 二、本轮核心原则

### P1. Delegation is authority transfer, not just scheduling
委派不是“把任务扔给一个 peer”，而是一次受限 authority transfer。必须由治理显式批准、约束与记录。

### P2. Peer trust is not enough
trusted / healthy / available peer 不等于自动有资格执行任何任务。peer selector 只能提供候选，不能替代 governance approval。

### P3. Delegation must be scope-bound
每一次委派都必须带 scope：
- 可做什么
- 不能做什么
- 最多花多少
- 是否允许二次委派
- 是否允许 selfmod / dangerous action
- 可访问哪些 memory / policy / runtime privileges

### P4. Accountability must survive delegation
一旦任务被委派，系统必须还能追问：
- 为什么委派给这个 peer？
- 是谁批准的？
- 给了哪些权限？
- 执行结果如何？
- 若出错，责任落在哪个 peer / branch / verdict？

### P5. Reuse existing governance/lineage/collective structures
17.2 禁止再造一套平行治理系统。必须尽可能复用：
- `GovernanceVerdict`
- `InheritanceScope`
- `LineageBranchControl`
- collective peer lifecycle/status
- trace chain 思路

---

## 三、本轮必须完成的目标

# G1. Governance-Controlled Delegation Proposal Path

把 delegation 正式纳入 governance action 模型。

### G1.1 至少接管以下 delegation 动作
优先只做三种高杠杆 delegation 类型：

1. **delegate_task** — 将任务委派给 peer 执行
2. **delegate_selfmod** — 将修改类任务委派给 peer
3. **delegate_dangerous_action** — 将高风险操作型任务委派给 peer

### G1.2 governance proposal 必须至少包含
- target peer id
- task/action description
- expected cost / budget impact
- requested authority scope
- requested runtime privileges
- whether sub-delegation is requested
- rollback expectation / reversibility

### G1.3 governance verdict 必须能回答
- 是否允许委派
- 是否仅允许带 constraints 的委派
- 是否 require_review
- peer 是否因 status / reputation / policy / survival constraints 被拒绝

---

# G2. DelegationScope Contract

当前已有 `InheritanceScope` 用于 child/lineage。17.2 需要为 peer delegation 建立正式 scope contract。

### G2.1 设计原则
可以选择：
- 基于 `InheritanceScope` 派生 delegation 专用 contract
- 或创建兼容映射层

但禁止完全平行重造。

### G2.2 DelegationScope 至少覆盖
- authority ceiling
- memory access scope
- policy scope
- budget cap / daily limit
- runtime privilege scope
- dangerous action permission
- selfmod permission
- sub-delegation permission
- expiry / time limit

### G2.3 目标
让 peer delegation 与 lineage inheritance 共享同一套“受限能力边界”思想，而不是一个有 scope、一个没 scope。

---

# G3. Collective Selector → Governance Approval → Delegation Execution

当前 collective runtime 已有 peer selector / lifecycle / reputation 基础。17.2 必须把它们接到治理链里。

### G3.1 正式链路
形成最少闭环：

1. peer selector 选出候选 peer
2. governance 对 delegation request 进行裁决
3. verdict 附带 delegation scope / constraints
4. delegated execution 启动
5. execution receipt 记录 peer / verdict / scope linkage
6. 若失败或越权，进入 quarantine/revoke/escalation 路径

### G3.2 重要边界
- selector 只给候选，不负责最终授权
- governance 是最终 authority
- execution 不得绕过 verdict 直接委派

---

# G4. Peer Boundary Enforcement

17.2 不能只“记录给了什么权限”，必须 enforce peer 执行边界。

### G4.1 至少 enforce 以下边界
- budget cap
- dangerous action allow/deny
- selfmod allow/deny
- sub-delegation allow/deny
- runtime privileges ceiling

### G4.2 执行要求
- 如果 peer 试图越权，必须产生结构化 violation 记录
- violation 必须能触发 governance/collective 的后续动作

### G4.3 默认原则
peer 默认只拿到：
- 当前任务所需最小 scope
- 明确有效期
- 不可无限传播的 delegation authority

---

# G5. Delegation Accountability & Violation Handling

一旦委派，就必须具备真正的责任追踪与故障处理。

### G5.1 至少支持以下事件
- delegation approved
- delegation started
- delegation completed
- delegation failed
- scope violation detected
- peer quarantined due to delegated execution
- peer revoked / branch compromised due to delegated execution

### G5.2 记录要求
每个 delegated execution 至少可追到：
- proposal id
- verdict id
- delegated peer id
- delegation scope id / snapshot
- execution receipt id
- outcome
- quarantine/revoke linkage（如发生）

### G5.3 目标
让 delegated execution 不再是 collective 子系统里的“黑盒任务分发”，而成为 governance 监督下的可审计 authority transfer。

---

# G6. Control Surface for Delegation Governance

17.2 必须补最小控制面，证明治理已经覆盖 collective delegation。

### G6.1 至少暴露以下信息
- recent delegation verdicts
- delegation by peer summary
- active delegated executions
- scope violations
- quarantined/revoked peers caused by delegated execution
- high-risk delegation approvals / denials

### G6.2 endpoint 方向
可新增专门 delegation governance endpoints，或在现有 governance/collective surface 上增量扩展。

### G6.3 原则
只做最小可用，不追求重做整个 dashboard。

---

# G7. Verification Matrix for 17.2

17.2 必须建立自己的验证矩阵。

### V1. selector candidate ≠ automatic approval
### V2. governance can deny delegation to unhealthy/degraded/quarantined/revoked peer
### V3. approved delegation carries explicit scope/constraints
### V4. delegated execution receipt links to proposal + verdict + peer + scope
### V5. peer cannot perform forbidden dangerous action under restricted scope
### V6. peer cannot selfmod when delegation scope forbids it
### V7. peer cannot sub-delegate when delegation scope forbids it
### V8. scope violation produces structured governance/accountability event
### V9. violation can trigger quarantine/revoke/escalation path
### V10. control surface reflects delegation governance truth

### 测试要求
- 必须有正例和反例
- 必须验证 enforcement，不只是 contract shape
- 必须验证 peer status 和 governance verdict 联动

---

## 四、建议实现顺序

### Priority 1 — delegation proposal + verdict + scope
先把 governance 对 delegation 的 authority 建起来。

### Priority 2 — execution receipt + violation accounting
再让 delegated execution 不再是黑盒。

### Priority 3 — peer quarantine / revoke linkage + control surface
最后补审计与响应闭环。

---

## 五、本轮非目标

本轮明确不做：
- 不做 fully distributed consensus governance
- 不把 entire collective runtime 全部重写
- 不做跨机器网络协议大扩展
- 不重新设计 reputation system
- 不做新的前端大重构
- 不重新打开 17.0 / 17.1 迁移债

---

## 六、验收标准

Round 17.2 只有在以下条件满足时才算完成：

1. delegation 已正式进入 governance 决策链
2. delegation scope 已有明确 contract 且与 lineage/inheritance 思想对齐
3. peer selector 不再直接决定授权，governance 为最终 authority
4. delegated execution receipt 可追到 proposal/verdict/peer/scope
5. 至少 budget / dangerous action / selfmod / sub-delegation 边界被真实 enforce
6. scope violation 可被记录并触发后续治理/collective动作
7. collective governance control surface 能展示 delegation truth
8. 验证矩阵通过，能够证明“委派已被治理化”

---

## 七、最终输出格式

完成后必须输出：

### A. Delegation Governance Summary
- 哪些 delegation 类型已纳入治理
- governance 如何决定 allow/deny/constrain

### B. Scope & Enforcement Summary
- delegation scope 如何定义
- 哪些边界已 enforce

### C. Accountability Summary
- 如何追到 peer / verdict / receipt / violation
- quarantine/revoke 如何联动

### D. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### E. Deferred / Risks
- 哪些 distributed / collective concerns 被继续 defer
- 下一轮最合理方向是什么

### F. 不得伪造
- 没纳入治理的 delegation 不能说已治理化
- 没 enforce 的 scope 不能说已受控
- 没有 receipt linkage 的不能说可追责
- 没触发 quarantine/revoke 联动的不能说已闭环

---

## 八、一句话任务定义

> **Round 17.2 的目标是：把 collective delegation 从“调度行为”升级为“受治理批准、受 scope 约束、可追责、可隔离”的正式 authority transfer。**
