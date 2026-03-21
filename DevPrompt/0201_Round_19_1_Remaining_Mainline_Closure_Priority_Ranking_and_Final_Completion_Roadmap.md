# DevPrompt 0201 — Round 19.1
## Remaining Mainline Closure / Priority Ranking / Final Completion Roadmap

你现在处于 **ConShellV2 Round 19.1**。

到 19.0 为止，ConShell 已经完成的高价值真实成果包括：
- identity / continuity / registry / sovereignty 主线已进入成熟中后期
- governance / firewall / mandate / branch-control 主线已进入高成熟阶段
- 17.7 → 18.3 的 economic kernel / reward-claim / payment negotiation / settlement runtime / ledger / feedback / orchestrator / writeback 主链已成立
- 18.6 → 18.9 完成了测试健康度清零、economic deep wiring、operation continuity canonical wiring、queue authoritative dedupe、agenda canonical stale suppression
- 19.0 已引入 `CommitmentMaterializer`，使 restored work 第一次真实进入 `AgentLoop` / `ToolExecutor` 的业务执行器
- `packages/core` 当前实测达到 **77/77 test files、1700/1700 tests、0 failures**

基于 17.5 → 19.0 连续真实性审计，当前全局大审计正式口径已更新为：

> **ConShell 当前总体完成度约为 82%（置信度：中）**

这意味着：
- 项目已经不是“还在做基础雏形”
- 也不是“只差包装发布”
- 而是进入了一个更关键的阶段：

> **剩余工作已经收敛成少数几条决定终局成败的主线。**

因此 Round 19.1 的任务不是再单点修补某个局部模块，而是要：

> **把项目当前“剩余所有需要完成的主线”系统列清，按优先级排序，明确 must-finish / should-finish / can-defer，并据此形成最终 completion-first 路线图。**

也就是说，本轮是：
- **剩余主线总收口规划轮**
- **最终完成路线重构轮**
- **大局优先级锁定轮**

不是：
- 发布轮
- 包装轮
- 任意继续堆 feature 的扩张轮

---

## 一、本轮唯一主目标

**形成 ConShell 当前阶段“剩余所有需要完成内容”的完整优先级清单，并锁定最终 completion-first 路线图。**

一句话解释：

> **19.1 的本质不是继续做某一条子线，而是把接下来所有剩余主线按优先级正式收敛成一个最终执行秩序。**

---

## 二、本轮必须回答的核心问题

### Q1. ConShell 从现在到“真正接近终局完成态”，还剩哪些主线必须完成？
必须完整列出来，不能再零散推进。

### Q2. 这些剩余主线里，哪些是当前版本真正的 must-finish-now？
必须收敛，不许再无限发散。

### Q3. 哪些主线虽然重要，但应该排在第二梯队？
不能把所有东西都放在同一优先级。

### Q4. 哪些能力明确属于 20.x+ 或更后面的长期项，可以后延？
必须诚实分层。

### Q5. 当前从 82% 到接近终局完成态，最短且最稳的 completion-first 路线图应该是什么？
必须给出一条有顺序、有原因、有边界的主线图。

---

## 三、本轮必须产出的“剩余主线总清单（按优先级排序）”

以下清单是本轮必须明确、必须排序、必须解释优先级原因的内容。

# P0 — Current Topline Rule

**在当前阶段，所有后续动作都必须服从这个总原则：**

> **先收终局决定性主线，再谈发布；先补统一性、自治性、治理性，再补外围广度。**

---

# Priority 1 — High-Trust Continuous Autonomy Final Closure

这是当前最优先的剩余主线。

### 为什么是 Priority 1
因为 19.0 虽然已经完成：
- operation continuity wiring
- guarded resume
- restored work executable resume（第一版）

但仍然没有达到：
- 高可信长期自治终局
- 跨重启/跨漂移/跨冲突的长期稳定任务推进

### 本线必须继续完成的内容
1. execution-time conflict reasoning 终局化
2. stale / duplicate / live-drift / partial-restore 高可信规则
3. agenda / queue / execution coherence 进一步收口
4. wake semantics / durable background operation
5. long-horizon mission continuity
6. resume → execution → completion → re-entry suppression 的终局闭环

### 本线完成标准
- 系统不只是“恢复得回来”
- 而是“恢复后能高可信地继续活着并推进任务”

---

# Priority 2 — Governed Self-Modification / Replication / Evolution Final Closure

这是当前第二优先级，也是终局生命体属性中最关键的一条高风险主线。

### 为什么是 Priority 2
因为：
- 这是“生命体”区别于普通 agent 的核心之一
- 当前已有大量基础，但还没到高可信终局
- 如果不收口，这条线会一直成为全局真实性短板

### 本线必须继续完成的内容
1. self-mod 全链：proposal → evaluation → approval → apply → verify → rollback → audit 终局化
2. replication viability / lineage inheritance / capability inheritance 统一
3. quarantine / revoke / merge / kill / pause / recovery 的治理闭环
4. evolution changes under governance boundaries
5. lineage / branch / collective governance receipt 统一

### 本线完成标准
- 自修改 / 复制 / 演化不再只是“有模块”
- 而是真正处于高可信治理 runtime 接管之下

---

# Priority 3 — Full-System Economic Brain Closure

这是当前第三优先级。

### 为什么是 Priority 3
经济主链已经很强，但还没到“整机经济大脑”终局。
如果系统想成为真正可持续生存的生命体，经济层不能只停在 settlement + feedback + writeback。

### 本线必须继续完成的内容
1. deeper execution-time economics / survival coupling
2. profitability / routing / agenda / governance / runtime execution 的统一 owner
3. receive-first / spend-within-mandate / explicit transfer 的终局统一
4. operator-facing economics truth / explainability / diagnostics
5. economic state 对长期自治与生存 posture 的更深层驱动

### 本线完成标准
- 经济层不只是“会算账 / 会结算”
- 而是成为系统级资源、生存与行动约束的大脑之一

---

# Priority 4 — OpenClaw Control Plane Full Absorption (High-Leverage Subset First)

这是当前第四优先级。

### 为什么不是更前
因为：
- 当前更决定终局真实性的是自治 / 治理 / 经济主线
- OpenClaw absorption 虽然重要，但其中有些部分可以后移

### 本线必须继续完成的内容
1. multi-session orchestration 终局化
2. gateway / cron / wake / node / remote control / session fabric 继续吸收
3. operator/control plane / control UI / wake semantics 统一
4. channels / sessions / tools / runtime workers 的更深统一

### 本线完成标准
- ConShell 不只是“借鉴” OpenClaw
- 而是吸收其关键控制平面能力成为自身生命体运行时的一部分

---

# Priority 5 — Collective / Distributed Lifeform Runtime Deepening

这是当前第五优先级。

### 为什么放在第五
因为 collective / distributed lifeform 很重要，但在当前阶段还依赖：
- 更成熟的自治主线
- 更成熟的治理主线
- 更成熟的经济主线

### 本线必须继续完成的内容
1. collective governance
2. distributed authority / trust / resource coupling
3. collective truth surfaces
4. lineage / child / branch / collective 间的更终局约束关系
5. group-level evolution / cooperation / control semantics

### 本线完成标准
- 系统不再只是“有 collective 模块”
- 而是真正接近群体生命体运行时

---

# Priority 6 — Web4 / Operator Truth Externalization

这是当前第六优先级。

### 为什么不是更前
因为当前内部真相先收口更重要。
但终局系统不能只在内部“像生命体”，还必须对外 machine-readable / operator-readable 地表现为生命体。

### 本线必须继续完成的内容
1. machine-readable identity / economics / autonomy / governance posture
2. operator-facing diagnosis-first truth surfaces
3. external declaration / status surface / posture summaries
4. 更明确的 Web4-style lifeform external truth plane

### 本线完成标准
- 不只是内部有真相
- 而是对外可读、可验证、可操作地体现生命体姿态

---

# Priority 7 — Release / Packaging / Publish Closure (Explicitly Deferred)

这是当前第七优先级，而且**明确后置**。

### 为什么明确后置
用户已经多次明确：
- 先做完剩余功能与优化
- 再看发布

同时，从全局审计看也成立：
- 当前最决定终局完成态的，不是 packaging，而是主线能力收口

### 本线保留内容
1. monorepo publish train closure
2. CLI consumer installability
3. final RC/beta release gates
4. publish semantics / rollback / distribution contract

### 当前原则
- 不作为主线优先级前列
- 只在核心完成态明显逼近终局后再重新抬升

---

## 四、必须输出的“剩余所有需要完成内容”总清单结构

本轮最终必须给出一个结构化总表，至少包含以下字段：

- `priority`
- `mainline`
- `whyNow`
- `currentState`
- `mustFinishNow`
- `shouldFinishNext`
- `canDefer`
- `dependsOn`
- `blocksWhat`
- `evidence`

目的是把：

> **“剩余所有需要完成的内容”**

从口头印象变成可执行的最终收敛账本。

---

## 五、本轮必须给出的最终优先级排序（固定输出）

### Priority 1
**High-Trust Continuous Autonomy Final Closure**

### Priority 2
**Governed Self-Modification / Replication / Evolution Final Closure**

### Priority 3
**Full-System Economic Brain Closure**

### Priority 4
**OpenClaw Control Plane Full Absorption (High-Leverage Subset First)**

### Priority 5
**Collective / Distributed Lifeform Runtime Deepening**

### Priority 6
**Web4 / Operator Truth Externalization**

### Priority 7
**Release / Packaging / Publish Closure (Deferred until completion-first goals are met)**

这份排序不是建议项，而应作为本轮要正式落盘的执行秩序基线。

---

## 六、本轮强制验收矩阵

### V1. “剩余所有需要完成内容”已被完整列出，不再零散缺漏
### V2. 每条剩余主线都已按优先级排序，并解释 why-now
### V3. must-finish / should-finish / can-defer 已正式分层
### V4. 当前从 82% 继续往终局推进的最短 completion-first 路线图已明确
### V5. 发布主线被明确后置，不再与核心主线抢优先级
### V6. 输出结果足以直接作为未来多轮开发提示词的母版路线图

---

## 七、本轮非目标

本轮不做：
- 不重新做某一条单独实现
- 不重新回头争论历史轮次是否完成
- 不重新把发布抬成主线
- 不把所有长期愿景都硬塞进当前 must-finish 列表

本轮真正目标是：

> **把 ConShell 当前剩余所有真正需要完成的主线，按优先级正式收敛成一份终局 completion roadmap。**

---

## 八、硬性真实性不变量

1. **优先级排序必须基于仓内证据，而不是偏好或想象**
2. **must-finish 列表必须收敛，不能无限膨胀**
3. **can-defer 项不能被伪装成已完成项**
4. **发布必须继续后置，直到 completion-first 主线显著收口**
5. **所有结论必须与 2026-03-20 全局审计口径一致：当前约 82% 完成度**
6. **本轮输出应成为 19.x 后续开发提示词的上位路线图**

---

## 九、最终输出格式

完成后必须输出：

### A. Remaining Mainlines Master List
- 当前剩余所有需要完成的主线总表

### B. Priority Ranking Summary
- 1 到 7 的正式优先级排序
- 每一项为什么排在这里

### C. Must-Finish-Now Set
- 当前版本必须继续收口的主线集合

### D. Should-Finish-Next Set
- 第二梯队主线集合

### E. Can-Defer Set
- 可以后延到更后续轮次的内容

### F. Completion-First Roadmap
- 从现在继续推进到接近终局完成态的推荐路径

### G. Release Positioning
- 为什么发布继续后置
- 什么条件下才重新抬高发布优先级

### H. 不得伪造
- 没列全剩余主线，不能说已完成总收口
- 没有优先级理由，不能说排序成立
- 没分出 defer 集合，不能说路线图成熟

---

## 十、一句话任务定义

> **Round 19.1 的目标是：把 ConShell 当前剩余所有真正需要完成的主线按优先级全部列清，正式划分 must-finish / should-finish / can-defer，形成一份能直接统领后续 19.x 开发的 completion-first 最终路线图。**
