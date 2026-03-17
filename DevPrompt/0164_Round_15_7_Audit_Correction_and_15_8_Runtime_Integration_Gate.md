# Round 15.7 Audit Correction + Next-Round Gate Prompt

> **文件定位**：这是对“Round 15.7 已完成”说法的正式审计纠偏文件，同时作为下一轮开发提示词。  
> **核心目标**：阻止团队把“模块新增 + 自测文件存在”误判为“Economic Survival Loop 已接入运行时并完成闭环”。  
> **适用对象**：后续主开发代理 / 审计代理 / 子代理。  
> **风格要求**：严格事实纪律，禁止把未验证的测试结论、未接入 runtime 的模块、未落地的能力包装成已完成。  

---

# 0. 审计结论先行

对当前仓库进行实际核对后，以下结论成立：

## 0.1 可以确认成立的事实
- `packages/core/src/economic/` 目录真实存在。
- 目录下存在 8 个文件：
  - `economic-state.ts`
  - `economic-ledger.ts`
  - `revenue-surface.ts`
  - `survival-coupling.ts`
  - `value-router.ts`
  - `economic-narrator.ts`
  - `transaction-safety.ts`
  - `index.ts`
- 存在测试文件：
  - `packages/core/src/economic/economic-survival-loop.test.ts`
- 这些模块内部实现了较完整的纯模块逻辑与模块内测试。

## 0.2 不能确认、且当前应视为**未被证明**的说法
以下说法当前都**不能接受为事实**：

1. **“Round 15.7 已开发结束”**  
   不能成立。因为当前只看到新增 economic 模块与测试文件，并未看到其正式接入现有 runtime 主线。

2. **“全量测试 909/909 pass”**  
   不能成立。实际执行 `pnpm vitest run` 时出现：
   - `ERR_MODULE_NOT_FOUND`
   - 缺少 `tinyrainbow/dist/node.js`

   因此当前环境下测试**未成功执行**，更不能确认“909/909 pass”。

3. **“回归 0”**  
   不能成立。由于全量测试未在当前环境真实跑通，无法得出零回归结论。

4. **“修改已有文件 0”**  
   与实际 `git status --short` 不一致。审计时已看到多个既有文件处于修改状态，例如：
   - `packages/core/src/kernel/index.ts`
   - `packages/core/src/runtime/agent-loop.ts`
   - `packages/core/src/spend/index.ts`
   - `packages/core/src/state/repos/spend.ts`
   以及多处测试文件。  
   所以“修改已有文件 0”当前是**错误陈述**。

5. **“生存状态真实耦合已完成”**  
   不能成立。代码搜索显示新 economic 模块目前主要只在：
   - `packages/core/src/economic/`
   - `packages/core/src/economic/economic-survival-loop.test.ts`
   中被引用。  
   尚未发现它被 `kernel / runtime / spend / automaton / x402 / wallet / policy / server` 等既有运行时主线正式消费。

---

# 1. 本轮真实产出应该如何定性

当前最准确的定性不是“15.7 已完成”，而是：

> **Round 15.7 产出了一个较完整的 Economic Module Prototype / Economic Subsystem Draft，但尚未证明其已完成 runtime integration，也尚未证明测试在当前环境下通过。**

换言之，当前更接近：

## 已完成
- Economic 子模块骨架与内部逻辑原型
- 一套围绕该子模块编写的测试文件
- Economic domain 语义边界的初步收敛

## 部分完成
- canonical economic abstractions 的代码表达
- survival gate / value router / narrator / transaction safety 的独立模块实现

## 未完成
- 接入现有 runtime 主线
- 接入 spend truth / x402 revenue truth / automaton survival truth
- 运行时闭环验证
- 全量测试环境验证
- 与现有系统事实源收敛

---

# 2. 关键审计发现

## 2.1 新模块目前更像“并行经济子系统”，不是“已接入的经济主内核”
当前新增代码使用了：
- `EconomicLedger`
- `RevenueSurfaceRegistry`
- `SurvivalGate`
- `ValueRouter`
- `EconomicNarrator`
- `TransactionSafetyManager`
- `buildEconomicState()`

但审计中未看到这些类型被现有主链正式使用：
- `Kernel.boot()`
- `AgentLoop`
- `SpendTracker`
- `SpendRepository`
- `X402Server`
- `ConwayAutomaton`
- `PolicyEngine`

这意味着：

> **当前是新建了一套 economic subsystem，但还没有完成与现有 runtime 事实源和控制链的正式融合。**

## 2.2 “统一经济状态”仍停留在 pure builder 层
`buildEconomicState()` 本质上是纯函数，它消费输入并生成冻结快照。  
但当前没有证据表明：
- 它从现有 `SpendTracker + SpendRepository + X402 + Onchain + Automaton` 自动收敛事实；
- 它已成为运行时唯一 canonical economic state source。

所以现在更准确的说法应是：

> **已实现 economic state schema builder，不等于已建立 runtime canonical economic state。**

## 2.3 `EconomicLedger` 不是现有账本真相，只是新账本实现
当前 `EconomicLedger` 是一套新增的内存型哈希链账本实现。  
但未看到它与现有：
- `spend_tracking` SQLite 表
- `SpendRepository`
- `SpendTracker.recordSpend()/recordIncome()`
建立正式接线。

所以当前不能说：

> **“统一账本已成立”**

只能说：

> **“新增了一套候选 canonical ledger 实现”。**

## 2.4 `RevenueSurfaceRegistry` 尚未与真实 x402 收入链路接上
审计未看到：
- `X402Server.verifyPayment()` 成功后自动写入 `RevenueSurfaceRegistry`
- 再写入 `EconomicLedger`
- 再影响 runtime balance / reserve / survival state

所以当前不能说 revenue closure 成立。

## 2.5 `SurvivalGate` 尚未替代或接通现有 runtime enforcement
虽然 `SurvivalGate` 实现了真实限制逻辑，但未看到它接入：
- inference model 选择主线
- task intake 主线
- child spawn 主线
- feature gating 主线

所以当前不能说生存状态已真实耦合到运行时。

## 2.6 测试真实性当前不成立
当前环境执行 `pnpm vitest run` 失败，原因是：
- 缺失 `tinyrainbow/dist/node.js`

因此测试现状的准确表述应是：

> **测试文件存在，但在当前审计环境中未跑通，故“90 tests pass”“909/909 pass”均未被证明。**

---

# 3. 下一轮不应该是什么

下一轮**不应该**：
- 继续庆祝 15.7 “已完成”
- 继续写更漂亮的报告 / narrator / dashboard
- 继续扩张更多 economic surface 名词层
- 直接跳去 15.8 autonomous agenda / replication / governance full workflow

因为当前卡点不是“概念不够多”，而是：

> **新 economic 子系统尚未正式接入旧 runtime 主线。**

---

# 4. 下一轮真正目标

下一轮的目标应被重定义为：

# **15.7 Integration Closure / Runtime Adoption Gate**

也就是：

> **不是再发明更多 economic 模块，而是把已经写出来的 economic 模块接进现有系统，并证明它真的改变了运行时行为。**

---

# 5. 下一轮开发任务（必须按顺序）

## Task 1 — 建立 Economic Runtime Adoption Map
你必须先画清楚并落代码注释 / 计划：

- 当前 runtime 的经济事实从哪里来？
  - `SpendTracker`
  - `SpendRepository`
  - `X402Server`
  - `OnchainProvider`
  - `ConwayAutomaton`
- 新 economic 模块中谁要成为 canonical owner？
- 哪些旧模块是 provider，哪些旧模块应退化为 adapter？

必须明确：
- **唯一 canonical economic state owner**
- **唯一 canonical ledger owner**
- **唯一 survival enforcement owner**

## Task 2 — 把 EconomicLedger 接到现有 spend/income 主链
目标：
- `SpendTracker.recordSpend()` / `recordIncome()` 或其持久层路径必须能进入 `EconomicLedger`
- 不能继续只在新模块测试里 append
- 要么：
  - `EconomicLedger` 成为正式 ledger truth
- 要么：
  - 明确它只是 projection / audit chain，并说明 canonical owner 仍是谁

必须回答：
- 账本到底是**主事实源**还是**派生审计链**？

## Task 3 — 把 x402 verified payment 接到真实收入闭环
必须完成：
- `X402Server.verifyPayment()` 成功后 → 形成正式 revenue event
- revenue event → ledger / state update
- duplicate tx hash → 幂等处理
- payment proof → 可追溯 metadata

做到这一步前，不得再说 revenue surface 已闭环。

## Task 4 — 把 EconomicState 变成运行时真实状态，而不是纯 builder
必须完成：
- 在 `Kernel` 启动或 runtime service 初始化时建立 economic state service
- state 不应靠测试手工拼输入
- state 要从真实系统数据源构建
- 至少明确 refresh / recompute / snapshot contract

## Task 5 — 把 SurvivalGate 接入运行时行为主链
必须完成至少一项真实接线：
- inference model selection
- task intake gate
- child spawn gate
- feature use gate

并且要能证明：

> **相同请求在不同 survival tier 下会得到真实不同的 runtime 行为。**

## Task 6 — 把 ValueRouter 接到真实任务入口，而不是只停在独立模块
必须明确：
- task descriptor 从哪里来
- routing 决策在哪个 runtime 入口生效
- reject / defer / downgrade 如何反馈给现有 agent loop 或 task queue

## Task 7 — 处理测试真实性
必须补齐：
- 为什么当前 vitest 依赖缺失
- 是 lockfile / node_modules / workspace layout / package export 问题？
- 修好后重新执行：
  - economic 模块测试
  - packages/core 全量测试
- 只有真实跑通后，才能汇报 pass 数字

## Task 8 — 修正文案与审计口径
必须把以下错误叙述纠正：
- “修改已有文件 0”
- “全量测试 909/909 pass”
- “15.7 开发结束”

如果尚未完成 runtime adoption，就必须改成：
- “economic module prototype complete”
- “runtime integration pending”
- “tests not yet re-verified in current environment”

---

# 6. 下一轮必须新增的测试

## 6.1 Runtime integration tests
- `X402Server.verifyPayment()` 成功后，runtime economic state 真实变化
- spend/income 进入 ledger / state，而不是仅测试手工 append
- survival gate 真正影响 runtime 主链

## 6.2 Adoption tests
- `Kernel` 初始化后可拿到经济状态服务
- `AgentLoop` 或任务入口会读取 routing / enforcement 决策
- tier 改变 → runtime 行为改变

## 6.3 Truth convergence tests
- 没有两套 balance truth 长期并行冲突
- ledger/state/spend repo 的关键数值不会互相背离

## 6.4 Verification tests
- 修复 vitest 环境后，重新执行并记录真实结果
- 测试报告必须可复跑，而不是口头汇报

---

# 7. 输出要求

下一轮输出必须按以下结构：

1. **What was newly integrated into runtime**
2. **What remains standalone / not yet adopted**
3. **What tests were actually run**
4. **What failed and why**
5. **What is now truly closed vs still prototype**

禁止输出：
- “闭环已成立”但没有 runtime 证据
- “全量通过”但没有真实测试执行结果
- “真实耦合已完成”但没有接线点

---

# 8. 一句话结论

> **当前 15.7 的真实状态不是“经济生存闭环已完成”，而是“经济子模块原型已建立，但 runtime integration、测试重验证与系统事实收敛仍未完成”。下一轮必须先完成 integration closure，再谈进入 15.8。**
