# Economic Consumption Matrix — Round 15.8

> 本矩阵回答：**系统到底在哪些真实路径上"被经济状态驱动"？**

## 消费矩阵

| 组件 | 消费信号 | 触发时机 | 动作结果 |
|------|---------|---------|---------|
| **AgentLoop** | `gateDecision`, `runtimeMode`, `survivalTier` | 每次 `processMessage()` pre-loop | allow / restrict(model降级) / block(拒绝推理) |
| **TaskQueue** | `routingDecision`, `survivalTier`, `runtimeMode` | `enqueue()` 入队前 | accept(调优先级) / reject(拒绝入队) / reprioritize |
| **ToolExecutor** | `policyDecision`, `survivalTier` | `executeOne()` 执行前 | allow / restrict(timeout缩短) / block(拒绝高成本工具) |
| **HeartbeatDaemon** | `snapshot()`, `health` | 每 5 分钟经济刷新 tick | 刷新状态 / 触发 mode 切换 |
| **Kernel** | — | 启动时 | 初始化 + 注入（已完成于 15.7B） |
| **X402Server** | — | `verifyPayment()` 成功时 | recordIncome（已完成于 15.7B） |

## 信号 → 动作映射

| 信号 | thriving | normal | frugal | critical | terminal | dead |
|------|----------|--------|--------|----------|----------|------|
| 推理 | allow | allow | restrict(cheaper model) | restrict(cheapest) | block | block |
| 高成本工具 | allow | allow | allow | restrict | block | block |
| 低成本工具 | allow | allow | allow | allow | allow | block |
| 任务入队(revenue) | high priority | normal | high priority | highest priority | only accept these | reject |
| 任务入队(non-revenue) | normal | normal | lower priority | reject | reject | reject |
| 子进程/worker | allow | allow | deny | deny | deny | deny |

## RuntimeMode 映射

| 条件 | Mode | 行为描述 |
|------|------|---------|
| tier ∈ {thriving, normal} | `normal` | 正常运行，无特殊限制 |
| tier ∈ {frugal, critical} | `revenue-seeking` | 优先收益任务，降级非收益，限制高成本 |
| tier = terminal | `survival-recovery` | 最低成本运行，只接收入任务，拒绝一切非必要消耗 |
| tier = dead | `shutdown` | 停止一切操作 |
