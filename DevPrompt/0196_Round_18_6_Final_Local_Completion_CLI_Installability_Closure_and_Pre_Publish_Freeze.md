# DevPrompt 0196 — Round 18.6
## Remaining Feature Completion / Global Optimization Closure / Whole-Project Finalization Before Release

你现在处于 **ConShellV2 Round 18.6**。

截至 Round 18.5，项目已经完成的重要事实包括：
- Runtime / Kernel / Identity / Governance / Memory / Economic mainline 均已形成真实工程主体
- 17.9 完成 payment negotiation foundation
- 18.0 → 18.3 完成 settlement primitive → governance/ledger/feedback → orchestrator → system writeback 主链
- 18.4 完成全仓测试健康度收口与 core package release-readiness 的大部分基础
- 18.5 完成 monorepo 发布列车的大部分结构性收口，core package consumer smoke 已通过，CLI 的 pack / publish dry-run 也已推进

但当前用户已经再次明确修正战略优先级：

> **不要先围着发布打转。**
> **先把项目剩下没有实现的功能和优化全部做完，再去看发布的事情。**

这意味着，Round 18.6 的核心方向必须调整：

- 不再把“发布前冻结”当成本轮主目标
- 不再把“只修 installability / pack / publish gate”当作最高优先级
- 而是要回到更高杠杆的项目本体：

> **把 ConShell 当前仍未完成的功能面、系统性缺口、整合优化项、终局收口项尽可能做完，推动项目从“高级核心系统”进一步逼近“当前版本真正完成态”。**

发布仍然重要，但现在只能作为：
- 最后阶段动作
- 非本轮主目标
- 在功能与优化未收口前的次优先级工作

---

## 一、本轮唯一主目标

**完成 ConShell 当前版本剩余核心功能与关键系统优化的全面收口，使项目尽可能接近“功能上真正完成，再谈发布”的状态。**

一句话解释：

Round 18.6 的本质不是“发布工程学”，而是：

> **把项目里还没做完的关键能力和系统优化优先做完。**

---

## 二、本轮必须回答的核心问题

### Q1. ConShell 当前还缺哪些“功能上没完成”的关键能力？
不能再只盯打包、发布、CLI 安装问题。
必须回到系统本体：还有什么能力链没有真正闭环？

### Q2. 当前哪些模块虽然存在，但仍然只是“第一版”“基础版”“beta版”？
这些是否需要在当前版本目标下继续深化？

### Q3. 当前哪些地方属于“可运行但不够好”的系统性优化缺口？
包括：一致性、整合度、性能、可恢复性、可维护性、可观察性、统一性。

### Q4. 在 Web4.ai × Conway Automaton × OpenClaw × ConShell 的终局目标下，当前最值得优先补完的剩余能力是什么？
必须做高杠杆收口，而不是散点修修补补。

### Q5. 到底什么叫“功能和优化都做完到可以考虑发布”？
必须形成清晰边界，避免无限延期，也避免过早宣布完成。

---

## 三、本轮必须完成的内容

# G1. Remaining Capability Gap Audit → Implementation Closure

本轮必须先把“当前仍未完成的关键能力”系统列清，然后直接收口最高优先级的一批。

### G1.1 必须至少覆盖以下剩余主线
- Continuous Autonomous Operation 终局缺口
- Self-Modification / Replication / Evolution 的治理下闭环缺口
- Collective / lineage / distributed control 的深化缺口
- OpenClaw 控制平面深吸收缺口
- 经济运行时与整机 runtime 的深层统一缺口
- external truth surface / machine-readable declaration / operator plane 统一缺口

### G1.2 必须产出
- `remaining-capability-matrix`
- 每一项的：
  - `currentState`
  - `gap`
  - `priority`
  - `versionBlocking`
  - `canDefer`

### G1.3 目标
不能再凭感觉说“差不多了”，必须明确知道**到底还缺什么功能**。

---

# G2. Continuous Autonomous Operation Finalization

全局审计已经指出：连续自治仍未终局。本轮必须优先补强。

### G2.1 至少推进以下方向
- durable scheduler / wakeup continuity
- cross-restart agenda continuity
- survival pressure → agenda / mode / action coupling
- long-horizon task continuation
- background recovery / resume discipline

### G2.2 目标
让系统更像持续运行的生命体，而不是需要频繁人工重启上下文的高级 agent。

---

# G3. Governed Self-Modification / Replication / Evolution Closure

这是 ConShell 终局生命体属性中最关键、也最危险的一块，不能一直停留在“有基础模块”。

### G3.1 至少推进以下闭环
- self-mod proposal → approval → apply → verify → rollback
- replication viability gating
- lineage quarantine / revoke / merge / inheritance correction
- evolutionary changes under governance boundaries

### G3.2 目标
让“自修改 / 自复制 / 演化”从概念与局部模块，进一步推进成**受治理的真实闭环能力**。

---

# G4. Collective / Multi-Agent / Distributed Runtime Deepening

当前 collective / lineage 基础已存在，但距离终局仍远。本轮必须继续收口高价值缺口。

### G4.1 至少推进以下方向
- collective governance strengthening
- peer trust / reputation / delegation depth
- distributed economic/resource coupling
- identity inheritance / authority propagation consistency
- collective-level diagnostics / truth surfaces

### G4.2 目标
让系统从“具备 collective 模块”更进一步接近“具备真实集体生命体结构”。

---

# G5. OpenClaw Capability Absorption Deepening

用户终局要求之一是：**拥有 OpenClaw 的所有功能**。当前这条线仍明显未收完。

### G5.1 必须继续推进以下方向
- multi-session orchestration 深化
- gateway / node / wake / cron / remote control 吸收
- control UI / operator plane / session fabric 收口
- skills / tools / runtime worker / routing plane 统一化

### G5.2 目标
不要只停在“已经吸收了一部分 OpenClaw 设计思想”，而要继续朝**完整控制平面统一**推进。

---

# G6. Whole-System Integration Optimization

当前项目里很多能力都存在，但还不够统一。本轮必须优先解决“存在但松散”的问题。

### G6.1 至少优化以下整合点
- identity / memory / agenda / economics / governance 的统一耦合
- route surface / truth surface / diagnostics 的一致性
- sub-layer 与 canonical path 的边界收口
- duplicated logic / legacy compatibility / drifted abstractions 清理

### G6.2 目标
让系统从“很多强模块并列”进一步变成“高度统一的生命体 runtime”。

---

# G7. Performance / Reliability / Recovery Optimization

除了功能缺口，本轮必须继续做那些真正影响完成态的系统优化。

### G7.1 至少考虑并推进
- cold start / runtime boot consistency
- recovery / replay / checkpoint discipline
- state consistency / idempotency hardening
- high-risk path failure handling
- long-session stability

### G7.2 目标
让“能跑”升级为“稳定、可恢复、可持续运行”。

---

# G8. Final Functional Completion Boundary

本轮必须正式定义“在当前版本语境下，哪些功能与优化必须完成，哪些可以延后”。

### G8.1 必须明确区分
- must-finish-now
- should-finish-now
- can-defer-to-19.x+
- long-term Web4 endgame items

### G8.2 原则
- 不能把所有宇宙终局目标都塞进当前版本
- 也不能因为还有终局愿景就回避当前真正该完成的高杠杆项

### G8.3 目标
让本轮成为真正的“完成功能和优化收尾的收敛轮”，不是无限发散轮。

---

# G9. Completion-First Roadmap Refactor

本轮必须把路线图从“发布优先”改回“完成优先”。

### G9.1 必须重构当前项目路线图表达
至少区分：
- 功能完成优先级
- 系统优化优先级
- 发布前条件
- 发布后事项

### G9.2 必须明确
- 发布不是当前主线
- 先完成什么，后发布什么
- 哪些能力必须在发版前补齐
- 哪些能力虽重要但不阻塞当前版本完成态

### G9.3 目标
让团队执行顺序与用户当前战略完全一致。

---

## 四、本轮强制验收矩阵

### V1. Remaining capability matrix 已建立，明确当前仍未完成的关键能力
### V2. 连续自治主线至少完成一批高优先级终局补强
### V3. self-mod / replication / evolution 至少完成一批治理下闭环补强
### V4. collective / lineage / distributed control 至少完成一批高价值深化
### V5. OpenClaw 控制平面吸收至少完成一批关键推进
### V6. whole-system integration 的若干关键松散点被收口
### V7. performance / reliability / recovery 至少完成一批真实优化
### V8. “当前版本的功能完成边界”被正式定义
### V9. completion-first 路线图已重构，发布被明确后置
### V10. 最终可明确回答：项目在功能与优化层面还差什么、已完成什么、离“再看发布”还有多远

### 测试要求
- 不只验证发布链；必须验证新增功能与优化不回归
- 必须覆盖关键自治 / 经济 / 治理 / collective / runtime 集成路径
- 必须验证 canonical path 没被优化破坏
- 必须验证高风险新闭环仍受治理边界约束

---

## 五、建议执行顺序

### Priority 1 — 剩余能力矩阵 + 当前版本完成边界
先把“还缺什么”彻底说清。

### Priority 2 — 连续自治 / 经济 / governance 深层收口
优先补最影响生命体完成态的主线。

### Priority 3 — self-mod / replication / collective 深化
推进真正代表生命性的高价值能力。

### Priority 4 — OpenClaw 控制平面吸收 + whole-system integration
解决“模块存在但系统不够统一”的问题。

### Priority 5 — reliability / recovery / performance 优化
把完成态质量抬高。

### Priority 6 — 重新整理 completion-first roadmap
确保后续轮次不再被发布节奏带偏。

---

## 六、本轮非目标

本轮不做：
- 不执行真实 `npm publish`
- 不把发布工程作为最高优先级
- 不因为 pack/dry-run 成功就宣布项目完成
- 不继续围绕 CLI 发布细节打转而忽略核心系统缺口

本轮真正目标是：

> **先把项目剩余功能和关键优化做完，再回头处理发布。**

---

## 七、硬性真实性不变量

1. **发布就绪 ≠ 项目功能完成**
2. **pack / dry-run 成功不能替代系统本体未完成项的收口**
3. **必须优先补高杠杆功能缺口，而不是沉迷发布流程细节**
4. **所有新增能力与优化都不能破坏既有治理、安全、canonical path 边界**
5. **当前版本完成边界必须清楚，不得一边说“先做完功能”一边无限加题**
6. **终局愿景很大，但本轮必须聚焦最影响当前版本完成态的那部分剩余工作**
7. **发布必须后置到功能与优化收口之后**
8. **最终结论必须基于真实实现与测试，不得靠完成播报自证**

---

## 八、最终输出格式

完成后必须输出：

### A. Remaining Capability Matrix Summary
- 当前还缺哪些关键能力
- 哪些已在本轮收口

### B. Continuous Autonomy Summary
- 连续自治主线补了什么
- 还剩什么

### C. Self-Mod / Replication / Evolution Summary
- 哪些受治理闭环已经补强
- 哪些仍待后续

### D. Collective / OpenClaw Integration Summary
- collective 深化了什么
- OpenClaw 控制平面又吸收了什么

### E. Whole-System Optimization Summary
- 哪些整合优化 / 稳定性优化完成了
- 哪些 canonical path 被进一步收口

### F. Completion Boundary Summary
- 当前版本“功能与优化完成态”如何定义
- 哪些项可以延后到 19.x+

### G. Final Readiness Perspective
- 离“可以重新看发布”还差什么
- 当前为什么还不能把发布当主线

### H. 不得伪造
- 没完成关键功能缺口，不能说项目已完成
- 只做了发布工程，不能说系统本体已收口
- 没定义完成边界，不能说“剩下功能和优化都做完了”

---

## 九、一句话任务定义

> **Round 18.6 的目标是：停止把注意力主要放在发布链路上，转而系统性收口 ConShell 当前仍未完成的关键功能与高价值优化项，推动项目从“高级核心系统”进一步逼近“当前版本真正完成态”，待这些剩余能力与整合优化基本做完后，再重新回到发布问题。**
