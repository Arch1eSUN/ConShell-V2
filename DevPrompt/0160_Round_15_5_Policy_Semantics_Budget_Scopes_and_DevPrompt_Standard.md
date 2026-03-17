# Round 15.5 — Policy Semantics, Budget Scopes, Recovery / Override, and DevPrompt Standardization

> **用途**：直接交给下一轮开发 / 审计 agent 使用  
> **适用对象**：高能力编码代理 / Claude Opus 4.6 / Codex / ACP / 子代理  
> **输出要求**：全程使用 Markdown  
> **执行要求**：必须完整、严格、逐条遵守本提示词。禁止把 15.4 已建立的 economic governance phase 1 误解成“治理体系已完整”；禁止继续只加零散阈值、日志、文案、dashboard 或 prompt tweak 就宣称 policy layer 成立；禁止在没有统一语义、预算作用域、恢复与 override 契约的情况下继续扩张更高层经济自治。  
> **本轮风格要求**：高压审计约束 + 统一治理语义 + 强结构化决策对象 + 强测试边界 + 强最终验收格式 + DevPrompt 规范固化。你不是来“再加一层预算逻辑”，你是来把 ConShell 从“已有最小经济约束”推进到“具有清晰语义、作用域、恢复、可解释性和可扩展性的治理策略层”，并把这种写法固化成以后所有开发提示词的标准。

---

# 0. 强制执行声明

本轮不是：
- 完整 autonomous economy round
- monetization / x402 主系统 round
- revenue optimization / value capture 主系统 round
- 继续只做 spend telemetry / reporting / dashboard round
- 继续只做 prompt 保守化 round
- 继续只做分散阈值判断 round
- 继续把治理逻辑散落在 runtime 各处分支里 round

本轮是：

# **Round 15.5 — Economic Governance Phase 2: Policy Semantics & Budget Scopes**

你必须把本提示词视为：

> **在 15.4 已证明 spend truth 可以真实改变 runtime 行为之后，继续把这种最小治理闭环升级为稳定、可解释、可恢复、可扩展、可测试的治理策略层。**

15.4 已经让系统从：
- `cost is observable`
推进到：
- `cost constrains execution`

但当前仍然缺少：
- 清晰稳定的 pressure semantics
- 多作用域预算 contract
- 统一 decision object
- 明确的 recovery 机制
- 正式 override 机制
- 稳定 reason code 体系
- 更强的无绕过验证

因此本轮的目标不是继续做更大的经济叙事，而是：

> **把 Economic Governance Phase 1 的“真实但最小闭环”，升级成可信、可维护的 Policy Layer。**

---

# 1. 当前阶段判断

## 1.1 当前项目已经具备进入 Policy Semantics 阶段的条件
经过前面多轮，当前项目已经具备：
- runtime truth
- continuity / identity / memory substrate
- behavior integration
- spend attribution truth
- economic governance phase 1

15.4 已完成的真实跨越是：
- `recordSpend` 不再只是被动记录
- `assessPressure()` 已在每次 inference 前被调用
- 当前已有四级 pressure state：`allow / caution / degrade / block`
- 治理可以直接影响 runtime 行为：
  - 限制迭代次数
  - 修改 system prompt
  - 拒绝执行

这意味着：
- 成本信号已经进入 control path
- runtime 第一次不能完全无视 spend reality
- Economic Governance Phase 1 可以视为成立

## 1.2 但 Phase 1 成立，不等于治理系统已成熟
当前仍可能存在以下结构性缺口：
- 四级 pressure 的语义边界不够稳定
- 不同调用路径下的 level 行为存在漂移风险
- budget scope 可能仍主要围绕单次 inference，缺少 turn / session / rolling-window 统一 contract
- degrade 可能过度依赖 prompt 修改而非显式动作集合
- block / caution / degrade 的解释能力不足
- 没有正式 recovery / override 契约
- 可能存在 fallback / retry / partial failure / split-path bypass 风险

## 1.3 为什么本轮不应继续直接上更高层 economic system
因为当前还没有充分证明：
- governance semantics 稳定
- 多 scope budget 可解释
- level transition 可预测
- 恢复路径明确
- override 不会成为后门
- runtime 各执行路径不会绕过治理

如果这些没成立，继续推进：
- higher-layer value accounting
- budgeted planning 主系统
- monetization
- autonomous survival loops

会形成“有经济叙事、无可依赖治理内核”的失真结构。

因此正确顺序应是：
1. **Spend Attribution Truth**（15.3，已完成）
2. **Economic Governance Phase 1 / Spend-Aware Runtime Control**（15.4，已完成）
3. **Policy Semantics & Budget Scopes / Recovery / Override**（本轮）
4. **Value-Aware Governance / Higher-Layer Budgeted Planning**
5. **更上层的 monetization / economic agency**

---

# 2. 对 15.4 的架构审计共识（禁止重新发明问题定义）

你必须基于以下审计共识推进本轮：

## 2.1 15.4 已成立的结论
1. Economic Governance Phase 1 成立
2. spend attribution truth 已升级为 runtime governance truth
3. 治理不再只是 alert，而是能够直接改变运行时行为
4. 这是一次“系统控制权迁移”，而不是普通功能增量

## 2.2 15.4 尚未完整解决的结论
1. pressure semantics 仍可能不稳定
2. governance 主要插在 inference 前，接入点可能还不够全面
3. budget scope 可能仍不完整
4. reason code / explanation 可能不足
5. recovery / override 可能尚未系统化
6. 仍需验证 no-bypass / no-duplication / no-partial-state-corruption

## 2.3 因此 15.5 的核心目标
不是继续堆更多治理动作，而是：
- 固化语义
- 结构化决策
- 引入 budget scopes
- 建立 reason code
- 建立 recovery / override
- 强化验证

---

# 3. 本轮要解决的真实问题

ConShell 现在虽然已经能让 spend 进入 runtime 控制，但仍未必能稳定回答：

- `allow / caution / degrade / block` 到底各自意味着什么？
- level 切换的进入条件、动作范围、恢复条件是否稳定？
- 当前超限的是哪一层预算：turn、session、还是 rolling window？
- 同时命中多个 scope 时如何决策？
- 为什么这次被 degrade / block？
- 为什么这次能恢复？
- override 何时生效，何时失效，边界是什么？
- 有没有 fallback / retry / split path 可以绕过治理？

所以本轮不是继续问“系统会不会受成本影响”，而是要回答：

> **系统的经济治理语义是否清晰、统一、稳定、可解释、可恢复、不可轻易绕过。**

---

# 4. 本轮必须避免的十二个错误

## 错误 A：只加更多阈值或布尔开关
如果只是继续堆：
- `if spend > X`
- `if budgetTight`
- `if forceAllow`

但没有统一 policy object / level semantics / action contract，
这不叫治理层，只叫分散条件判断。

## 错误 B：把 assessPressure() 做成巨大黑盒
禁止把以下逻辑全塞进一个函数：
- 预算读取
- 阈值判断
- scope 冲突处理
- reason code 生成
- action 选择
- recovery 判断
- override 处理

## 错误 C：只靠修改 system prompt 做 degrade
prompt 调整可以是动作之一，
但不允许成为唯一降级方式。

## 错误 D：同一 level 在不同路径下语义漂移
例如：
- 某处 `caution` 只打日志
- 某处 `caution` 直接减少步骤
- 某处 `caution` 看起来像 `degrade`

这种漂移必须被消灭。

## 错误 E：只看单次 inference，不建立多作用域 budget
如果仍无法明确区分：
- turn pressure
- session pressure
- rolling-window pressure

治理能力会非常脆弱。

## 错误 F：只有进入压力，没有恢复机制
如果系统会升级到 block，
却不能明确回答何时恢复、如何恢复，
那不是治理，是卡死。

## 错误 G：override 成为隐形后门
override 必须是正式、受控、可追踪能力，
不能成为“悄悄绕过策略”的万能开关。

## 错误 H：reason code 只是自由文本
reason code 必须稳定、可断言、可审计。
不能只靠字符串文案。

## 错误 I：runtime 各层各自判断是否降级
runtime 应消费统一 decision object，
不应在各层散落二次判断。

## 错误 J：忽略 retry / fallback / partial failure
如果这些路径没被审计，
治理仍可能被绕过或污染状态。

## 错误 K：没有强测试就宣称 policy layer 成立
必须证明：
- 语义稳定
- 决策统一
- scope 明确
- recovery 可行
- override 可控
- no-bypass 成立

## 错误 L：本轮完成后仍然不把 DevPrompt 标准固化
本轮不仅要推进代码，
还要把“以后复杂开发提示词怎么写”固化成标准。

---

# 5. 开始前必须阅读的文件

在做任何设计、实现、验证之前，必须严格读取：

1. `README.md`
2. `docs/audit/DEVLOG.md`
3. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
4. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
5. `docs/planning/NEXT_PHASE_ROADMAP.md`
6. `DevPrompt/0158_Round_15_3_Economic_Grounding_and_Spend_Attribution_Truth_Integration.md`
7. `DevPrompt/0159_Round_15_4_Economic_Governance_and_Spend_Aware_Runtime_Control.md`
8. `DevPrompt/README.md`

还必须重点阅读以下代码：

## spend / governance 主线
- `packages/core/src/spend/index.ts`
- `packages/core/src/state/repos/spend.ts`
- `packages/core/src/runtime/agent-loop.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/policy/*`
- `packages/core/src/inference/index.ts`

## runtime / execution 主线
- `packages/core/src/runtime/tool-executor.ts`
- `packages/core/src/runtime/state-machine.ts`
- `packages/core/src/api-surface/*`
- `packages/core/src/server/*`

## 关键测试主线
- `packages/core/src/spend/spend.test.ts`
- `packages/core/src/state/repos/spend.test.ts`
- `packages/core/src/runtime/agent-loop.test.ts`
- `packages/core/src/kernel/kernel.test.ts`
- `packages/core/src/policy/policy.test.ts`
- `packages/core/src/api-surface/api-surface.test.ts`
- `packages/core/src/integration/closure-gate.test.ts`

读取后，必须先输出：

```md
# Context Assimilation
# What 15.4 Already Makes Real
# What 15.4 Still Leaves Underdefined
# Why 15.5 Must Focus On Policy Semantics And Budget Scopes
```

并明确回答：
- 15.4 到底已经把什么变成真实 runtime fact
- 当前最小治理缺口是什么
- 为什么本轮应优先做 semantics / scopes / recovery / override
- 为什么现在还不应该直接跳更高层 economic planning / monetization

---

# 6. 本轮必须完成的核心目标

你必须同时完成以下六类能力：

## A. 固化 pressure semantics

为以下四个 level 定义稳定契约：
- `allow`
- `caution`
- `degrade`
- `block`

每个 level 至少必须明确：
1. 定义
2. 进入条件
3. 允许的 runtime action 范围
4. 用户 / 调用方可见语义
5. 恢复条件
6. 是否允许 override
7. 与其他 level 的转换规则

要求：
- 不能只靠注释说明，必须体现在代码结构和测试中
- 不允许在不同 runtime path 中语义漂移
- 不允许同一 level 同时承担彼此冲突的语义

## B. 引入 structured governance decision object

你必须定义统一治理决策对象。建议至少包含：
- `level`
- `reasonCodes[]`
- `metricsSnapshot`
- `violatedScopes[]`
- `selectedActions[]`
- `userVisibleMessage`
- `recoveryHint`
- `overrideable`
- `overrideSource`
- `decisionTimestamp`

要求：
1. runtime 执行层只消费该对象，不要散落自行判断
2. policy 判断与 action 执行必须解耦
3. 所有日志、调试和测试尽可能围绕该对象展开
4. 该对象应能成为未来审计、遥测和分析的稳定基础

## C. 引入 budget scopes

至少实现并接入以下预算作用域：
1. `turn-level budget`
2. `session-level budget`
3. `rolling-window budget`

要求：
- 明确区分超限发生在哪个 scope
- 不要把所有预算逻辑硬编码在单一黑盒里
- 设计上允许未来扩展到 `project / user / tenant` scope
- 多 scope 同时命中时必须有明确优先级或组合逻辑

## D. 引入 reason code 体系

建立稳定的治理 `reason codes`。例如：
- `TURN_BUDGET_NEAR_LIMIT`
- `TURN_BUDGET_EXCEEDED`
- `SESSION_BUDGET_NEAR_LIMIT`
- `SESSION_BUDGET_EXCEEDED`
- `ROLLING_WINDOW_PRESSURE_HIGH`
- `DEGRADE_POLICY_TRIGGERED`
- `BLOCK_POLICY_TRIGGERED`
- `OVERRIDE_ACTIVE`
- `RECOVERY_WINDOW_ELAPSED`

要求：
1. reason code 必须是稳定标识，不是自由文本
2. 测试优先断言 code，而不是只断言 message
3. 日志、trace、用户提示可以映射这些 code，但 code 本身必须稳定
4. 同一行为不得产生彼此冲突的 code

## E. 建立 recovery 机制

治理系统必须有恢复路径，而不是只有抬升压力、没有压力回落。

至少支持：
1. 基于时间窗口的恢复
2. 基于 spend pressure 回落的恢复
3. 恢复后重新计算 level
4. 从 `block / degrade` 回到更低压力状态

要求：
- 不允许进入 block 后永久卡死，除非策略明确要求
- 恢复机制必须可测试
- 恢复条件必须可解释
- 恢复不能依赖重启系统“洗状态”

## F. 建立受控 override 机制

实现最小但清晰的 override 机制。

override 至少需要明确：
1. 来源
2. 作用域
3. 生效时长
4. 对哪些策略有效
5. 对哪些策略无效
6. 是否出现在 decision trace 中

要求：
- override 不能绕过安全边界
- override 不能悄悄删除 pressure 事实
- override 应体现在决策对象里
- override 是正式治理能力，不是隐藏后门

---

# 7. 强制设计原则

你必须遵守这些设计原则：

## 7.1 收敛治理逻辑，不要继续扩散
目标是：
- evaluator 负责评估
- decision object 负责表达
- executor 负责执行动作

## 7.2 不要让 prompt 修改成为唯一降级手段
- prompt 调整可以保留
- 但 degrade 必须是显式动作集合的一部分
- 且动作必须可枚举、可测试、可解释

## 7.3 不要把复杂度继续塞进 assessPressure()
- assessPressure() 可以存在
- 但它不应成为预算读取、阈值计算、理由生成、动作选择、恢复判断、override 处理的万能黑盒

## 7.4 不要依赖隐式魔法数
- 所有阈值、窗口、权重都必须命名
- 关键阈值要有测试
- 不要用匿名 magic numbers 支撑治理策略

## 7.5 不要制造 silent degradation
- 如果系统主动降级，至少在 trace 中必须可见
- 用户侧是否完全可见可以策略化
- 但系统内部绝不能不可见

## 7.6 不要让 runtime 执行层自行重做 policy 决策
- runtime 执行层只应消费 decision object
- 不应再次凭局部上下文随意改写治理语义

---

# 8. 必须新增并通过的测试

至少必须补齐以下测试类别：

## 8.1 Threshold boundary tests
- `allow -> caution`
- `caution -> degrade`
- `degrade -> block`
- `block -> recovery`
- recovery 后重新进入正常路径

## 8.2 Scope interaction tests
- turn budget 正常，但 session budget 超限
- session budget 正常，但 rolling window 压力过高
- 多个 scope 同时命中时，reason code 与 level 是否正确
- 多 scope 同时命中时，selectedActions 是否符合优先级

## 8.3 Decision object tests
- `level` 正确
- `reasonCodes` 正确
- `selectedActions` 正确
- `violatedScopes` 正确
- `recoveryHint` 正确
- `overrideable` 正确

## 8.4 Recovery tests
- 时间窗口过去后恢复
- spend pressure 下降后恢复
- 恢复后不残留错误状态
- 恢复后下一次 inference 使用正确 level

## 8.5 Override tests
- override 能生效
- override 被记录到 decision trace
- override 不绕过安全边界
- override 到期后自动失效
- override 与 recovery 交互行为正确

## 8.6 No-bypass tests
- block 后不能通过 fallback path 偷偷继续 inference
- degrade 不会在其他 runtime path 中失效
- retry 不会导致 decision state 污染
- partial failure 不会导致 spend 或 pressure 重复计算
- streaming 中断不会留下错误治理状态

## 8.7 Regression integrity tests
- 不破坏既有行为契约
- 不引入新回归
- 原有相关测试若需调整，必须说明为什么调整

---

# 9. 代码审计问题单（实现后必须逐项回答）

## A. 语义一致性
1. `allow / caution / degrade / block` 的边界是否真正清晰？
2. 是否存在同一 level 在不同路径下行为不同的问题？
3. 是否存在一处认为是 `caution`，另一处实际表现成 `degrade` 的问题？

## B. 决策结构
4. 治理决策是否已经从分散 if/else 收敛成结构化对象？
5. runtime 是否仍然自行做了二次判断，导致语义分裂？
6. 日志和调试输出是否能基于统一 decision object 解释？

## C. 预算作用域
7. `turn / session / rolling-window` 是否真的彼此区分？
8. 是否可以明确回答“这次超的是哪一层预算”？
9. 多 scope 同时命中时，优先级是否稳定可预测？

## D. 恢复机制
10. 系统进入 block 后是否一定存在恢复路径？
11. 恢复是否依赖重启或手工清状态？
12. 恢复后是否可能残留旧 pressure 状态？

## E. Override 机制
13. override 是否有明确边界，而不是万能跳闸器？
14. override 是否会绕过不该绕过的限制？
15. override 是否被记录并可追踪？

## F. 边界与抗规避
16. 是否存在通过 fallback / retry / split request 绕过治理的路径？
17. spend attribution 是否会因为 retry / partial failure 被重复计算？
18. 是否存在 policy trigger 了，但 executor 没真正执行的情况？

## G. 可解释性
19. 每次治理决策是否都能回答：
   - 为什么命中？
   - 命中哪个 scope？
   - 采取了什么动作？
   - 为什么允许恢复或不允许恢复？
20. 用户侧提示和系统内部实际动作是否一致？

## H. 工程质量
21. 是否引入了新的隐式状态复杂度？
22. 是否存在未来难以扩展到 project / user scope 的耦合点？
23. 是否存在 magic numbers、注释债、测试债？
24. 是否存在“现在能跑，但长期必炸”的设计？

---

# 10. DevPrompt 标准固化（以后所有开发提示词必须遵守）

本轮除了推进代码，还必须把复杂开发提示词的标准固化下来。

从本轮开始，ConShellV2 以后所有中大型开发提示词都必须默认遵守以下骨架。
如果任务很小，可以压缩；如果任务复杂，必须展开；但结构不能消失。

## 10.1 标准开发提示词骨架

1. **任务定义**
- 要解决什么问题
- 为什么这个问题重要
- 当前阶段目标是什么

2. **当前事实**
- 已知事实
- 未知项
- 不可假设成立的东西

3. **关键约束**
- 工程约束
- 安全约束
- 兼容性约束
- 回滚约束
- 时间 / 范围约束

4. **架构决策**
- 该在哪一层解决
- 不该在哪一层解决
- 哪些模块应收敛
- 哪些耦合必须拆开

5. **实现要求**
- 必做项
- 可选项
- 明确禁止项

6. **测试要求**
- 边界测试
- 回归测试
- 失败路径测试
- 无绕过测试
- 状态恢复测试

7. **审计问题单**
- 语义一致性
- 状态机完整性
- 可解释性
- 可恢复性
- 可扩展性
- 是否存在隐式技术债

8. **输出要求**
- 必须报告做了什么
- 为什么这么做
- 如何验证
- 风险是什么
- 下一步是什么

9. **成功标准**
- 必须明确到可以判定“完成 / 未完成”
- 不允许模糊成功定义

## 10.2 DevPrompt 写作硬规则

以后所有 DevPrompt 文件必须遵守：

1. 必须直接写入 `ConShellV2/DevPrompt/` 目录
2. 必须单独成文件，禁止只在聊天里给口头 prompt
3. 文件名必须带连续编号 + Round 名称 + 主题名
4. 新一轮 prompt 必须基于：
   - 上一轮实现结果
   - 当前验证结果
   - 当前审计结论
5. Prompt 不能脱离当前现实，不得凭空跳阶段
6. Prompt 必须包含：
   - 本轮不该做什么
   - 为什么现在做这个而不是别的
   - 必须读取哪些文件
   - 必须检查哪些代码路径
   - 必须补哪些测试
   - 如何判定完成
7. Prompt 必须避免“表演式专业”与“叙事先于证据”
8. Prompt 必须要求 agent 区分：
   - 事实
   - 推断
   - 假设
   - 未知
9. Prompt 必须要求最终输出包含未解决问题与下一轮建议

## 10.3 本文件的额外使命
本文件既是 15.5 的执行说明书，
也是 ConShellV2 后续 DevPrompt 的标准母版之一。
后续新 prompt 可以在本文件基础上裁剪，但不得退化回：
- 目标模糊
- 验收模糊
- 无测试要求
- 无审计问题单
- 无禁止项
- 无成功标准

---

# 11. 最终输出要求

完成后，你的输出必须严格包含以下内容：

1. **问题判断**
- 本轮具体解决了什么问题
- 为什么这是当前最高杠杆问题

2. **实现摘要**
- 新增了哪些模块、类型、接口、状态对象
- 哪些旧逻辑被保留、重构或替换

3. **最终语义定义**
- `allow / caution / degrade / block` 的最终定义
- 各自进入条件、动作范围、恢复条件

4. **Budget Scope 设计**
- `turn / session / rolling-window` 的定义
- 交互逻辑
- 冲突处理逻辑

5. **Reason Code 设计**
- 有哪些 code
- 各自含义
- 如何映射到日志 / 提示 / trace

6. **Recovery / Override 设计**
- 如何进入恢复
- 如何退出恢复
- override 如何生效
- override 如何记录

7. **测试结果**
- 新增了哪些测试
- 覆盖了哪些风险
- 是否存在未覆盖区域

8. **代码审计问题单回答**
- 必须逐项回答第 9 节问题

9. **风险与未完成项**
- 当前仍有哪些限制
- 哪些问题故意留到下一轮
- 哪些边界仍需后续验证

10. **下一轮建议**
- 当前最合理的下一阶段开发方向
- 为什么不是别的方向

11. **DevPrompt 标准遵循说明**
- 本轮输出如何体现本文件固化的 DevPrompt 标准
- 未来提示词如何继续复用本结构

---

# 12. 严禁事项

严禁以下行为：

1. 只改日志 / 文案 / 注释就宣称 policy layer 成立
2. 只增加几个阈值和 if 判断，就宣称治理语义已稳定
3. 用 prompt 变保守替代真实 degrade 设计
4. 把 assessPressure() 继续做成更大的黑盒
5. 引入没有命名、没有测试的 magic numbers
6. 忽略 recovery / override / explainability
7. 忽略 retry / fallback / partial failure / bypass path
8. 输出“看起来完整”的报告，但没有真实代码和测试支撑
9. 忽略 DevPrompt 目录写入规则，只在聊天中给口头结论

---

# 13. 成功标准

只有当以下条件同时满足，才算本轮真正完成：

- 四级 pressure semantics 被明确编码并可测试
- governance decision 成为统一结构化对象
- 至少支持 `turn / session / rolling-window` 三类 budget scope
- 系统具备 recovery 能力
- 系统具备受控 override 能力
- reason codes 稳定可断言
- 关键边界、恢复、override、无绕过路径都有测试
- 不引入 regressions
- 输出内容可审计、可解释、可作为下一轮开发基础
- 本轮提示词写法已经显式固化为后续 DevPrompt 标准

---

# 14. 执行风格要求

你必须以“高可信工程代理”的标准工作，而不是普通代码生成器：
- 先理解，再动手
- 先收敛语义，再扩展行为
- 先建立边界，再优化体验
- 先保证可验证，再追求优雅
- 先控制风险，再追求速度

最终目标不是“写出更多代码”，而是让 ConShell 的治理能力更真实、更稳定、更可信，并让这种工程推进方式本身变成长期标准。
