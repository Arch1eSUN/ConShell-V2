# DevPrompt 0179 — Round 16.9.2
## Stage Closure / Verification Truth / Workspace Hygiene / Next-Phase Gate

你现在处于 **ConShellV2 Round 16.9.2**。

Round 16.9 与 16.9.1 已经把 revenue / economic projection / survival gate / agenda shaping / control surface 的核心链路做出来了，但当前项目仍未真正形成一个**可封板、可审计、可切阶段**的里程碑。

本轮不是继续加新功能，也不是继续横向扩展主题。
**本轮唯一目标：一次性收口 16.9.x，并建立进入下一阶段（Round 17）的硬门槛。**

> **Round 16.9.2 = 把 16.9 / 16.9.1 从“功能已存在”收成“验证口径真实、契约边界一致、工作区卫生可控、提交边界清楚、阶段出口明确”的阶段终点。**

---

## 一、核心原则

### P1. 收口优先于扩展
本轮禁止新增与 16.9.x 无关的大主题功能。不得借 16.9.2 名义继续打开新的 collective / governance / lineage / replication 大面。

### P2. 真实优先于好看
不能再使用“总测试全绿”“0 回归”之类未经全量验证的说法。所有结论必须与当前环境下实际可重复验证的结果一致。

### P3. 阶段封板优先于局部优化
本轮的任务不是做更多，而是让 16.9.x 成为一个真正可以结束的阶段，避免把尾巴继续拖进 17.x。

### P4. 小范围修正允许，大重构禁止
允许为收口做必要重命名、文件清理、契约对齐、测试隔离、依赖处理。
禁止因“顺手优化”而演变为系统性重构。

---

## 二、本轮必须完成的总目标

Round 16.9.2 必须同时完成以下四个目标：

### G1. 验证口径收口
建立**真实且可重复**的测试/验证口径，修正当前“局部全绿但全仓不成立”的表述问题。

### G2. 契约与实现收口
将 control surface contracts、REST payload、dashboard 消费三者对齐，消除已知漂移。

### G3. 工作区与提交边界收口
清理足以干扰阶段判断的重复文件、命名污染、无意义副本，形成清晰提交边界。

### G4. 阶段切换门建立
明确写出：16.9.x 到此为止算完成的条件是什么；Round 17 启动前必须满足什么。

---

## 三、本轮必须完成的任务

# S1. 建立真实验证口径（Verification Truth Closure）

当前已知事实：
- 16.9.1 增量测试（23 tests）可通过
- 全仓 `pnpm -r test` 在当前环境下并不全绿
- 存在 `better-sqlite3` 导致的测试环境/依赖问题
- 因此“234 总测试 0 回归”不能继续作为无条件结论使用

本轮必须把验证口径彻底收清。

### S1.1 区分验证层级
必须把测试口径明确拆成至少三层：

1. **Round-scoped verification**
   - 仅验证 16.9 / 16.9.1 / 16.9.2 相关增量目标
2. **Package-scoped verification**
   - 相关 package 的完整测试状态
3. **Repository-scoped verification**
   - 全仓测试状态与失败原因

### S1.2 建立正式验证报告
新增或更新验证文档，明确列出：
- 哪些测试通过
- 哪些测试未通过
- 未通过属于代码回归、环境依赖、还是历史遗留
- 哪些结论可以对外说
- 哪些结论不能再说

### S1.3 处理 `better-sqlite3` 问题
必须二选一完成：

A. **修复测试环境使全量测试可运行**
或
B. **正式隔离并记录该依赖问题**，使其不再污染 16.9.x 阶段结论

要求：
- 不允许继续模糊处理
- 不允许一边全量失败，一边继续写“0 回归”

### S1.4 输出口径标准化
本轮结束后，所有总结必须遵守：
- 没跑到的不能说已验证
- 局部验证不能包装成全仓验证
- 环境失败必须明确标“环境/依赖问题”

---

# S2. 对齐控制面契约 / REST payload / Dashboard 消费

当前已知问题：control-surface contract 与 REST 实际返回 shape 存在漂移，例如 `/api/economic/snapshot` 存在额外字段未进入稳定契约。

本轮必须把三层对齐：

1. **Contract layer**
2. **REST route payload layer**
3. **Dashboard client/view consumption layer**

### S2.1 对齐 EconomicSnapshot
检查并统一：
- `control-surface-contracts.ts` 的 `EconomicSnapshot`
- `/api/economic/snapshot` 的真实 payload
- dashboard 读取字段

禁止出现：
- route 返回字段未声明进契约
- dashboard 读取隐式字段
- 契约定义与 route 语义不一致

### S2.2 对齐 Gate / Agenda contracts
同样检查并统一：
- `TaskAdmissionDecision`
- `SurvivalGateExplain`
- `AgendaFactorSummary`

要求：
- route handler 返回值必须可直接被这些契约描述
- 不允许 route 侧拼出半临时结构

### S2.3 Dashboard 强类型接线
当前 dashboard 仍大量使用 `Record<string, unknown>` / `any`。
本轮必须最少做到：
- API client 对经济控制面接口使用明确类型
- `EconomicPage` 不再依赖泛型 `any`
- 关键字段消费具备静态类型约束

注意：
- 目标是**收口类型边界**，不是大规模前端重构
- 仅收紧与 economic control surface 直接相关的类型即可

---

# S3. 工作区卫生收口（Workspace Hygiene Closure）

当前工作区仍存在大量污染：
- `* 2.ts`
- `* 2.md`
- 重复 DevPrompt
- 重复 findings/progress/task_plan
- 重复 economic/identity/spend 等实现副本

这已经影响审计、提交、回滚与下一阶段判断。

### S3.1 建立清理范围
只清理以下两类：

1. **明显重复副本 / 命名污染文件**
2. **会影响 16.9.x 阶段边界判断的噪音文件**

### S3.2 清理原则
- 若文件明确为误复制副本，应删除或归档
- 若文件仍需保留，必须改成明确命名并解释用途
- 不允许继续保留大批无说明 `* 2.*` 文件进入下一阶段

### S3.3 DevPrompt 文件夹收口
至少做到：
- 16.9 / 16.9.1 / 16.9.2 prompt 清晰存在
- 与其冲突的无意义重复稿处理掉或归档
- 不让下一阶段继续踩到旧副本

### S3.4 审计辅助文件收口
清理或整理：
- `findings 2.md`
- `progress 2.md`
- `task_plan 2.md`
等重复文件，避免后续误读。

---

# S4. 提交边界收口（Commit Boundary Closure）

当前一大问题不是有没有实现，而是**实现与提交现实脱节**。
本轮必须把 16.9.x 形成可审计边界。

### S4.1 至少建立清晰的变更批次
必须将以下内容整理成清晰边界：
- Round 16.9 runtime 主线
- Round 16.9.1 control surface 主线
- Round 16.9.2 收口主线

### S4.2 要求
- 每个提交批次有清楚语义
- 提交说明能解释“做了什么 / 为什么 / 验证了什么”
- 不允许把大量无关噪音混进阶段封板提交

### S4.3 如果当前不适合立刻 commit
则必须至少准备：
- staging 计划
- 分批 commit 方案
- 哪些文件必须先清理后才能提交

即使这轮最后不提交，也必须把**提交策略**变成明确产物。

---

# S5. 文档边界收口（Stage Narrative Closure）

更新或新增正式文档，明确写出：

### S5.1 16.9.x 阶段产出
至少覆盖：
- 16.9 做了什么
- 16.9.1 做了什么
- 16.9.2 收了什么
- 这些产出如何构成一个阶段性闭环

### S5.2 当前仍未完成项
必须明确列出：
- 哪些问题仍存在
- 哪些问题已被隔离但未消灭
- 哪些事项 defer 到 Round 17

### S5.3 禁止模糊叙事
禁止继续出现以下模糊说法：
- “基本都好了”
- “已经没问题了”
- “0 回归”
- “全部完成”
若没有对应证据支持

---

# S6. 建立 Next-Phase Gate（进入 Round 17 的硬门槛）

16.9.2 必须输出一个**明确的阶段切换门**。

### S6.1 定义 Round 17 启动前必须满足的条件
至少包括：
- 16.9.x 阶段文档已收口
- 验证口径已固定
- control surface contracts / REST / dashboard 已对齐
- 工作区主要重复污染已清理
- 提交边界已形成或已具备明确 staging 方案

### S6.2 明确 Round 17 的非继承债务
写清楚：
- 哪些债务禁止继续拖进 17.x
- 若未满足门槛，Round 17 不得开始

### S6.3 输出 Stage Exit / Stage Entry 定义
至少形成：
- **Stage Exit Criteria: 16.9.x**
- **Stage Entry Criteria: 17.0**

让下一阶段不再模糊开启。

---

## 四、本轮非目标

本轮明确不做：

- 不新增新的大功能面
- 不继续扩 governance / collective / lineage 功能深度
- 不进行大规模 UI 美化
- 不把全仓所有历史问题都试图在一轮内修干净
- 不因为清理工作区而改动无关业务逻辑

---

## 五、验收标准

Round 16.9.2 只有在以下条件全部满足时才算完成：

1. 已建立真实、分层、可重复的验证口径
2. `better-sqlite3` 相关测试问题已修复或被正式隔离说明
3. 不能再出现“局部通过却宣称全仓 0 回归”的表述
4. `EconomicSnapshot` / `SurvivalGateExplain` / `AgendaFactorSummary` 与 REST payload 对齐
5. dashboard 经济控制面不再依赖 `any` / `Record<string, unknown>` 处理核心字段
6. 主要 `* 2.*` 重复污染文件已清理、归档或解释
7. 16.9 / 16.9.1 / 16.9.2 已形成清晰阶段边界
8. 阶段文档已写明：已完成 / 未完成 / defer / next-phase gate
9. 最终输出中明确给出：
   - 当前可验证事实
   - 当前不可宣称事实
   - 进入 Round 17 的条件

---

## 六、最终输出格式

完成后必须输出：

### A. Stage Closure Summary
- 16.9.x 阶段最终收口了什么
- 哪些是本轮修正的“真实性问题”

### B. Verification Truth Report
- Round-scoped verification
- Package-scoped verification
- Repository-scoped verification
- 失败项归因

### C. Contract Alignment Report
- 哪些 contract 已对齐
- 哪些 payload 曾漂移并已修正
- dashboard 类型边界如何收紧

### D. Workspace Hygiene Report
- 清理了哪些重复文件
- 哪些仍保留以及为什么

### E. Phase Gate
- 16.9.x Exit Criteria
- 17.0 Entry Criteria
- 若未满足，明确写 `NOT READY FOR ROUND 17`

### F. 不得伪造
- 没验证的不能说验证过
- 没清理的不能说已清理
- 没提交的不能说已固化
- 没达到阶段门槛的不能说可进入下一阶段

---

## 七、执行顺序

按以下顺序推进：

1. 先修验证口径
2. 再对齐契约与 payload
3. 再收紧 dashboard 类型
4. 再清工作区污染
5. 再整理提交边界
6. 最后写阶段收口文档与 next-phase gate

---

## 八、一句话任务定义

> **Round 16.9.2 的任务不是继续开发功能，而是把 16.9.x 变成一个真实、可验证、可审计、可封板、可切阶段的终点。**
