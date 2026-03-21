# DevPrompt 0203 — Round 19.3
## Final Closure Audit for G2 / G3 / G5 / G6 and Polish Readiness

你现在处于 **ConShellV2 Round 19.3**。

到当前最新审计基线为止，以下事实已被仓内代码与全量测试确认：
- `packages/core` 当前全量测试达到 **87/87 test files、1813/1813 tests、0 failures**
- Round 19.2 新增并已核实落地：
  - `conflict-reasoner.ts`
  - `wake-semantics.ts`
  - `session-fabric.ts`
  - `scheduled-autonomy.ts`
- `ConflictReasoner` 已接入 materializer 执行管线：
  - **Guard → Conflict → JIT Eligibility → Economic → Execute**
- 4 个新增测试文件合计 **46 tests**，与播报一致：
  - conflict-reasoner: 10
  - wake-semantics: 13
  - session-fabric: 13
  - scheduled-autonomy: 10
- 当前全局审计口径已从旧的 85% 上调到：
  - **约 88%（置信度：中）**

但是，最新真实性审计也明确给出一个关键收口判断：

> **Round 19.2 对 G1 与 G4 的推进是强成立的；但“G2 / G3 / G5 / G6 已全部完成、无需额外开发”这一口径，目前证据不足，不能直接采信。**

因此 Round 19.3 的任务不再是继续铺新主线，而是：

> **对 G2 / G3 / G5 / G6 做终局收口审计与必要补强，判断项目是否真的可以从“仍需核心开发”切换到“只剩审计 / 打磨 / 查漏补缺”。**

换句话说：
- 19.2 不是终局结论本身
- 19.3 才是“最后一次真正确认哪些已经完成、哪些还差最后一刀”的轮次

---

## 一、本轮唯一主目标

**对 G2 / G3 / G5 / G6 做终局真实性收口审计；若有缺口，当轮补齐；若无缺口，正式确认项目进入 polish / 查漏补缺阶段。**

一句话解释：

> **19.3 不是继续大规模开新功能，而是完成“最后一层不确定性清算”。**

---

## 二、本轮必须回答的核心问题

### Q1. G2 是否真的完成到“无需额外开发”的程度？
即：governed self-mod / replication / evolution 是否已形成终局级治理闭环。

### Q2. G3 是否真的完成到“无需额外开发”的程度？
即：execution-time economics 是否已经真正推进到 full-system economic brain 级别。

### Q3. G5 是否真的完成到“无需额外开发”的程度？
即：collective / distributed lifeform runtime 是否已从骨架推进到终局可用态。

### Q4. G6 是否真的完成到“无需额外开发”的程度？
即：`AgentPostureService` 与 truth surface 是否真的已经 externalized，而不仅是内部聚合器。

### Q5. 本轮结束后，ConShell 是否能被诚实地归类为：
> **“主开发已基本结束，后续只剩审计 / 打磨 / 查漏补缺”**？

---

## 三、本轮审计与补强范围

# G2 — Governed Self-Modification / Replication / Evolution Final Closure

### 必须审计
1. `GovernedSelfModGate` 是否已接入 canonical self-mod 主路径
2. self-mod proposal → evaluate → apply → verify → rollback → audit 是否真正闭环
3. pause / resume / quarantine / restore / revoke / kill 是否只是 action 面存在，还是 lifecycle 真正被治理 runtime 接管
4. replication viability 是否已与 governance / economics / lineage 三者统一
5. branch / lineage / inheritance / capability inheritance 是否仍有未收口旧路径
6. evolution changes 是否仍可能绕过治理与生存边界

### 若审计发现未闭环，必须当轮补齐

### 本线成立标准
- 不再只是“有 gate / 有 action / 有测试”
- 而是**危险能力生命周期已经被统一治理接管**

---

# G3 — Full-System Economic Brain Final Closure

### 必须审计
1. `ExecutionEconomicGate` 是否已真正进入 canonical execution path，而非可选挂件
2. survival / profitability / mandate 三层门控是否真正影响 execution admission
3. economic state 是否真实驱动 agenda / routing / execution / wake / autonomy posture
4. receive-first / spend-within-mandate / explicit transfer / viability constraints 是否仍存在语义裂口
5. operator-facing economics truth / diagnostics / explainability 是否已形成统一出口
6. lineage viability / child funding / replication budget 是否已进入 economic brain

### 若审计发现未闭环，必须当轮补齐

### 本线成立标准
- 经济层不再只是 subsystem
- 而是**全系统行动、生存、支出与演化的 canonical economic brain**

---

# G5 — Collective / Distributed Lifeform Runtime Final Closure

### 必须审计
1. collective governance 是否真实存在，还是只有 collective 模块骨架
2. distributed authority / trust / reputation / resource coupling 是否已接入真实运行时
3. child / lineage / branch / collective 之间是否已有统一约束关系
4. collective runtime truth surface 是否存在
5. delegation / cooperation / distributed control semantics 是否只是测试级存在，还是主路径可用
6. collective 与 governance / economics / autonomy 是否已深耦合

### 若审计发现未闭环，必须当轮补齐

### 本线成立标准
- collective 不再只是“有模块、有测试”
- 而是**进入群体生命体运行时可用态**

---

# G6 — Web4 / Operator Truth Externalization Final Closure

### 必须审计
1. `AgentPostureService` 是否只是内部 snapshot 聚合器，还是已形成外部可消费 truth surface
2. identity / economic / lineage / collective / governance posture 是否 machine-readable 对外可见
3. diagnosis-first truth plane 是否真实存在
4. execution audit / governance receipts / economic diagnostics 是否已统一外化
5. operator 是否能通过统一 surface 看到“生命体姿态”而不是散落内部状态
6. `/api/*` 或等价对外接口是否已真正暴露 posture / truth，而不是仅有内部 class

### 若审计发现未闭环，必须当轮补齐

### 本线成立标准
- 不再只是内部 assembled truth
- 而是**外部可读取、可验证、可操作的 lifeform truth surface**

---

## 四、本轮最终分叉目标

### Branch A — If G2/G3/G5/G6 all truly close
则本轮必须正式给出结论：

> **ConShell 已从活跃主开发阶段切换到审计 / 打磨 / 查漏补缺阶段。**

并明确：
- 后续不再需要新的主开发轮
- 只需要 closure audit / polish / consistency cleanup / release-readiness review

### Branch B — If any one of G2/G3/G5/G6 is not truly closed
则本轮必须：
1. 明确指出真实缺口
2. 当轮尽量补齐
3. 如果仍无法补齐，必须输出**最后的查漏补缺清单**，而不是再开新的模糊主线

---

## 五、本轮强制验收矩阵

### V1. G2 / G3 / G5 / G6 都已被逐条核验，不允许整体打包口头宣布完成
### V2. 每条主线都必须区分：已验证事实 / 未验证口头播报 / 仍存缺口
### V3. 若发现缺口，必须优先补 canonical path，不得再堆旁路
### V4. 全量核心测试必须继续全绿
### V5. 本轮结束后，必须能明确回答“是否正式进入 polish / 查漏补缺阶段”
### V6. 若答案是否定的，也必须把剩余项压缩为最后一版明确清单

---

## 六、本轮非目标

本轮不做：
- 不重新铺开新的大主线
- 不把发布重新抬成主目标
- 不用口头播报替代仓内事实
- 不把“有一个类/测试”误判为“终局完成”

本轮真正目标是：

> **把最后四条仍未被完全证实的关键主线做终局收口判断，并决定项目是否正式进入打磨期。**

---

## 七、真实性不变量

1. **没有主路径接线，不能算完成**
2. **只有测试，没有系统级语义闭环，也不能算终局完成**
3. **内部 truth 不等于 external truth surface**
4. **有 governance action 不等于危险能力生命周期已被治理接管**
5. **有 collective 模块不等于 distributed lifeform runtime 已成立**
6. **本轮必须给出 yes/no 级别的阶段判断，而不是继续模糊化**

---

## 八、本轮完成后必须能输出的结果

### A. Round 19.3 详细真实性审计
### B. 更新后的全局大审计结论
### C. 新的总体完成度判断
### D. 是否正式进入审计 / 打磨 / 查漏补缺阶段
### E. 若未完全进入，则输出最后一版明确的剩余缺口清单

---

## 九、一句话任务定义

> **Round 19.3 的目标是：对 G2 / G3 / G5 / G6 做最后一次终局真实性收口审计，并在必要时当轮补齐，最终明确判断 ConShell 是否已从活跃主开发阶段正式切换到审计 / 打磨 / 查漏补缺阶段。**
