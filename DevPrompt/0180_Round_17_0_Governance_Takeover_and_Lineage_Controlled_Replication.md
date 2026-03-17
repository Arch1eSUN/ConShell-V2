# DevPrompt 0180 — Round 17.0
## Governance Takeover / Lineage-Controlled Replication / Runtime Authority Unification

你现在处于 **ConShellV2 Round 17.0**。

Round 16.9.x 已完成阶段收口：
- economic runtime / survival gate / agenda shaping 已形成真实闭环
- control surface / verification truth / stage closure / next-phase gate 已建立
- 项目现在不应继续围绕 16.9.x 修边角

**Round 17.0 的任务不是继续补经济系统，而是让治理真正接管 runtime 的关键决策，并把 replication / lineage 变成治理可控、可审计、可追责的执行底座。**

> **Round 17.0 = Governance Takeover as the main axis, with Lineage-Controlled Replication as the required execution substrate.**

本轮主轴是：
- **A. Governance Takeover**（主线）
- **B. Replication / Lineage Actualization**（硬依赖）
- **C. Collective runtime** 仅保留兼容接口，不作为本轮主战场

---

## 一、Round 17.0 的战略目标

到 17.0 结束时，项目必须从：

- governance 作为“可调用模块”
- replication / lineage 作为“局部实现能力”

推进到：

- governance 成为 runtime 的**正式主决策层**
- replication 必须经过 governance policy 审批与 lineage 记录
- lineage 不再只是记录历史，而成为 replication、继承、责任归属、风险追踪的真实控制链

一句话：

> **17.0 要完成从“治理存在”到“治理接管”，以及从“可复制”到“受治理约束地复制”。**

---

## 二、本轮核心原则

### P1. Governance must become authoritative
治理不能再只是建议器、旁路评估器或审计附加层。对关键 runtime 动作，governance 必须拥有正式的 allow / deny / require-review / rollback authority。

### P2. Replication must be lineage-bound
任何 self-replication、child agent creation、identity fork、configuration inheritance、policy inheritance，都必须经过 lineage-aware governance 控制。

### P3. No shadow authority
禁止继续保留“runtime 直接做决定，governance 只是事后知道”的影子权力结构。关键动作必须明确由谁批准、谁执行、谁记录、谁可回滚。

### P4. Economic survival constraints remain upstream hard constraints
17.0 不能破坏 16.9.x 已建立的生存约束。
治理 takeover 不能绕过 survival gate / economic policy，只能在其之上统一决策，不得降级安全边界。

### P5. Small number of hard paths > broad fake coverage
本轮不追求把所有 action 全接管，而是优先接管最关键、最有杠杆、最能定义 authority model 的路径。

---

## 三、本轮必须回答的系统问题

Round 17.0 必须明确回答以下问题，并在代码中给出真实实现：

1. **哪些 runtime 动作必须经过 governance？**
2. **哪些动作允许自动批准，哪些必须 require-review，哪些直接 deny？**
3. **replication / child creation / lineage inheritance 的 authority chain 是什么？**
4. **identity / policy / memory / budget / runtime mode 的继承边界是什么？**
5. **如果治理判断错误，系统如何 rollback / quarantine / revoke descendant authority？**
6. **lineage 如何从“历史记录”升级为“控制与追责结构”？**

---

## 四、本轮必须完成的目标

# G1. Governance Takeover of Critical Runtime Actions

将 governance 从“服务能力”提升为关键 runtime action 的正式决策门。

至少接管以下动作类别：

### G1.1 Replication / child creation actions
- child agent spawn
- self-replication
- identity fork / derivative instantiation
- delegated autonomous worker creation

### G1.2 Self-modification / capability mutation actions
- selfmod apply
- skill/capability mutation that changes runtime authority or execution surface
- policy-affecting runtime reconfiguration

### G1.3 High-impact system actions
- persistent config mutation
- authority-bearing role transition
- long-lived autonomous execution grant

### G1.4 输出要求
对每类动作，必须明确：
- governance 输入是什么
- governance 决策输出是什么
- runtime 如何执行该决策
- 如何记录 decision / justification / outcome

---

# G2. Define Governance Decision Contract

把治理决策从隐式判断变成显式 contract。

### G2.1 新建正式治理决策类型
至少定义：
- action request envelope
- governance decision
- decision status
- decision reason
- approval level
- required review state
- rollback eligibility
- execution receipt

### G2.2 decision 必须至少支持以下结论
- `allow`
- `deny`
- `require_review`
- `allow_with_constraints`
- `rollback_required`

### G2.3 decision 必须可解释
返回结构中至少包含：
- decision code
- human-readable reason
- triggered policies
- risk level
- inherited constraints
- whether descendant/child creation is permitted
- timestamp / decision id

### G2.4 禁止项
- 不允许只返回 `boolean`
- 不允许只返回裸字符串 reason
- 不允许 runtime 自己再重新解释一套治理含义

---

# G3. Lineage-Controlled Replication

让 replication 真正进入 lineage governance 模型，而不是只做实例复制。

### G3.1 建立 replication request → governance → lineage → execution 流程
至少形成以下链路：

1. replication request created
2. governance evaluates request
3. lineage derives parent/child relationship + inheritance boundary
4. runtime executes only if governance allows
5. execution receipt recorded
6. descendant registered into lineage graph

### G3.2 lineage 不能只记 parentId
lineage 必须记录至少以下信息：
- parent identity
- child identity
- derivation type
- authority scope inherited
- memory scope inherited
- policy scope inherited
- budget/economic scope inherited
- creation decision id
- creation timestamp
- current status (active / revoked / quarantined / dead)

### G3.3 replication 约束必须显式化
必须明确哪些内容：
- 默认继承
- 禁止继承
- 条件继承
- 必须重置

至少覆盖：
- identity claims
- memory visibility
- policy set
- spend/budget scope
- governance authority
- runtime mode / execution privileges

---

# G4. Inheritance Boundary Enforcement

仅有 lineage 记录不够，必须有真实边界 enforcement。

### G4.1 定义继承边界 contract
对 child / replica / derivative instance 至少定义：
- what it can remember
- what it can spend
- what it can modify
- what it can delegate
- whether it can further replicate
- whether it can self-modify

### G4.2 runtime enforce
这些边界不能只写在 docs，必须进入 runtime 可执行层。

### G4.3 default stance
默认应是：
- **最小继承**
- **最小权限**
- **显式升级**
而不是把 parent 的高权限全部透传给 descendant。

---

# G5. Governance + Survival + Economic Policy Unification

17.0 不能让 governance takeover 与 16.9.x 生存约束冲突。

### G5.1 governance 必须感知 survival/economic constraints
治理在做 allow / deny / constrain 判断时，必须显式吸收：
- survival tier
- economic state
- budget scope
- must-preserve policy
- runtime mode restrictions

### G5.2 优先级原则
优先级必须明确：
1. safety / survival hard constraints
2. governance authority decision
3. execution routing / agenda scheduling

### G5.3 禁止项
- governance 不得绕过 dead / terminal / critical 生存门槛
- governance 不得强行授权违反已存在 economic hard constraints 的高风险动作

---

# G6. Revocation / Rollback / Quarantine for Descendants

如果治理允许创建 child/replica，就必须具备撤销与隔离能力。

### G6.1 至少支持以下能力
- revoke descendant authority
- quarantine descendant
- mark lineage branch as compromised
- require rollback / termination of child execution

### G6.2 记录要求
必须记录：
- why revoked/quarantined
- which governance decision caused it
- which lineage branch is affected
- whether descendants-of-descendants are impacted

### G6.3 目标
让 lineage 成为真正的责任传播结构，而不是装饰性 genealogy。

---

# G7. Control Surface for Governance + Lineage Takeover

本轮必须补齐最小控制面，让外部能看见治理接管事实。

### G7.1 Governance decision observability
至少可查看：
- recent governance decisions
- decision outcome counts
- pending review actions
- denied critical actions
- constrained approvals

### G7.2 Lineage observability
至少可查看：
- parent-child graph summary
- child status
- inheritance boundary summary
- revoked/quarantined descendants

### G7.3 只做最小可用控制面
不追求 UI 豪华，只要能审计、能 debug、能证明治理接管真实存在。

---

# G8. Verification Matrix for 17.0

17.0 必须有明确验证矩阵，不能只说“功能完成”。

### G8.1 至少覆盖以下验证主题
V1. governance evaluates replication request
V2. deny path blocks execution
V3. allow path records execution receipt
V4. allow_with_constraints carries inherited limits
V5. lineage records parent/child + scopes correctly
V6. forbidden inheritance does not leak
V7. child cannot exceed inherited authority
V8. survival/economic constraints still dominate governance decisions
V9. revocation/quarantine updates lineage branch state
V10. control surface reflects governance + lineage truth

### G8.2 测试要求
- 必须有正例和反例
- 必须验证结构化 decision，而不是只测 bool
- 必须验证 lineage 记录内容，而不是只测 child 被创建
- 必须验证“不允许继承”的边界

---

## 五、建议优先接管的关键路径

为避免本轮发散，17.0 优先级按以下顺序执行：

### Priority 1 — Replication governance path
先打通：
- replication request
- governance decision
- lineage registration
- execution / deny / rollback path

### Priority 2 — Inheritance boundary enforcement
再收口：
- identity inheritance
- policy inheritance
- budget inheritance
- descendant authority scope

### Priority 3 — Observability + docs
最后补：
- control surface
- verification matrix
- stage doc / audit notes

**Collective runtime 只保留兼容接口，不在 17.0 深挖。**

---

## 六、本轮非目标

本轮明确不做：

- 不把 entire collective runtime 做完
- 不继续大规模扩展 peer reputation surface
- 不把所有 governance related modules 全部一次性重写
- 不做无关 UI 重构
- 不重新打开 16.9.x 收口工作
- 不做与 governance takeover 无关的新业务能力

---

## 七、验收标准

Round 17.0 只有在以下条件满足时才算完成：

1. 关键 replication / child creation 动作已正式经过 governance decision
2. governance decision 不再是 bool/string，而是结构化 contract
3. runtime 真实执行 governance allow/deny/constrain 结果
4. lineage 已记录 parent/child + inheritance scopes + decision linkage
5. inheritance boundary 有真实 enforcement，不只是记录
6. descendant authority 可被 revoke / quarantine / rollback
7. governance 决策不会绕过 survival/economic hard constraints
8. 最小控制面可观测 governance + lineage 状态
9. 有明确验证矩阵与通过证据
10. 最终输出能证明：治理已从“存在”变成“接管”

---

## 八、最终输出格式

完成后必须输出：

### A. Governance Takeover Summary
- 哪些 runtime 动作已由 governance 接管
- 接管方式是什么

### B. Lineage / Replication Summary
- replication 流程如何经过 governance
- lineage 记录了哪些新增维度
- inheritance boundary 如何 enforced

### C. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### D. Risks / Deferred
- 哪些 collective / distributed concerns 被明确 defer
- 哪些治理接管还没覆盖
- 下一轮最合理扩展方向是什么

### E. 不得伪造
- 没实际接管的不能说接管
- 没 enforce 的不能说已边界控制
- 没 rollback/quarantine 的不能说已可撤销
- 没测试的不能说已验证

---

## 九、执行顺序

按以下顺序推进：

1. 定义 governance decision contract
2. 接管 replication / child creation path
3. 建立 lineage-controlled execution flow
4. 加 inheritance boundary enforcement
5. 加 revoke / quarantine / rollback
6. 补控制面
7. 补测试矩阵与文档

---

## 十、一句话任务定义

> **Round 17.0 的目标是：让治理成为 runtime 关键动作的正式权威层，并让 replication / lineage 成为受治理控制、可追责、可撤销的真实执行底座。**
