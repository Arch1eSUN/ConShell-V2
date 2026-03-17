# Round 16.8 — Collective Lifecycle Closure and Delegation Integrity Hardening

> **文件定位**：这是 Round 16.8 的正式开发提示词。  
> **前置事实**：Round 16.7 已把 collective runtime 从静态 peer registry 推进到 discovery / reputation / selector / delegation feedback 的初步形态，并新增了对应实现与专项测试。  
> **但经进一步代码审计与本地复测，16.7 仍未达到“闭环可信”标准**：存在 peer staleness 状态落地错误、refresh failure 链路未打通、selector 解释与评分不一致、delegation guard 不完整、以及若干关键失败路径缺少测试。  
> **本轮目标**：不是继续扩展 collective 表面积，而是把 16.7 已出现的 discovery / reputation / delegation runtime 从“可运行原型”推进为“状态转换真实、失败路径可信、解释与执行一致、服务层约束闭合”的系统。  
> **事实纪律**：禁止把“有 API / 有测试 happy path / 有解释文本”包装成“生命周期闭环可信”；禁止把未进入实际 score 的 bonus/penalty 描述成已影响 peer selection；禁止把 refresh failure 计数存在但未真实接外部 refresh 的逻辑包装成 failure-aware lifecycle。

---

# 0. 本轮问题定义

Round 16.7 的核心方向是正确的，但当前系统仍有几个决定性缺口，使 collective runtime 在“真实运行时语义”上不够可信：

## 0.1 Staleness degrade 路径未真正落地
当前 stale peer 被评估为 `degrade` 时，没有真实迁移到 `degraded`，反而通过 health refresh 刷新了 `lastSeen`，导致陈旧 peer 被“洗白”。

## 0.2 Refresh failure → quarantine 闭环名义存在、实际未打通
当前 refresh failure 计数没有真正建立在 provider refresh 的失败语义上，因此 repeated refresh failure 机制无法形成可信的 lifecycle pressure。

## 0.3 Selector 的解释与真实排序存在偏差
当前 status / trend bonus/penalty 有时只进入 `selectionReasons`，没有真实进入 score。解释看起来影响了选择，但实际排序未必如此。

## 0.4 Delegation 的服务层 guard 不完整
当前外层 API 主要靠 selector 做安全过滤，但 service 层本身仍可能允许对 `offline` / `degraded` peer 发起委派，造成 runtime contract 不闭合。

## 0.5 测试更偏主路径 smoke，而不是失败路径守门
已有测试证明“东西出现了”，但还没有充分证明：
- 状态迁移真实发生；
- failure accumulation 真实触发；
- selector 的可解释性与排序一致；
- peer lifecycle 的边界输入行为是确定的。

因此，Round 16.8 的唯一正确问题定义是：

> **如何把 collective runtime 的 peer lifecycle / discovery refresh / delegation integrity 从“结构存在”推进为“状态真实、失败可积累、解释与执行一致、服务层不可绕过”的可信闭环？**

---

# 1. 本轮唯一核心目标

# **Lifecycle Closure + Delegation Integrity Hardening**

即：
1. 修复 staleness 状态落地错误；
2. 打通真实 refresh failure accumulation 与 quarantine 链路；
3. 让 selector 的 reasons 与实际 score 对账；
4. 收紧 delegation service guard，防止绕过 selector 的无效委派；
5. 用失败路径测试把上述行为钉死。

---

# 2. 本轮必须先回答的问题

## 2.1 什么动作才算真实 refresh？
你必须先定义：
- refresh 是仅更新本地时间戳？
- 还是调用 provider / endpoint / registry 执行真实再探测？
- refresh failure 的语义来源是什么？

如果不先定义，failure accumulation 仍会继续漂浮在名义层。

## 2.2 degraded / offline / quarantined 的边界是什么？
你必须明确：
- `degraded` 代表“可见但不可靠”？
- `offline` 代表“当前不可达”？
- `quarantined` 代表“因异常/风险被主动隔离”？

若三者边界不清晰，状态机会继续表现为“词很多、语义很薄”。

## 2.3 selector 的“解释”是否必须与 score 一致？
答案默认必须是 **是**。  
任何写进 `selectionReasons` 的所谓 bonus / penalty，如果会让读者认为它影响排序，那么它就必须真正进入 score；否则应降级为纯说明，而非决策解释。

## 2.4 delegation 的 canonical safety boundary 在哪里？
你必须明确：
- 仅 API 层保证不可委派给坏 peer？
- 还是 service 层也必须作为最终防线？

本轮默认要求：**service 层必须是最终防线。**

---

# 3. 本轮任务顺序（强制）

## Task 1 — 修复 Staleness 落地逻辑

必须修复 `PeerDiscoveryService.markStalePeers()` 与 `CollectiveService` 的交互，使 `degrade` 真正产生状态迁移。

### 强制要求：
- `ev.action === 'degrade'` 时，不能再通过 `refreshPeerHealth()` 刷新 `lastSeen` 来伪造恢复；
- 必须引入一个正式且语义正确的 degraded transition 路径；
- 该路径必须受现有状态机约束，不得绕开 `isValidPeerTransition()`；
- 不允许 degrade 动作产生“把 stale peer 重新标为 fresh”的副作用。

### 推荐实现方向：
- 新增如 `markPeerDegraded(...)` / `degradePeer(...)` 的正式方法；
- 或扩展统一状态迁移入口，但必须确保语义清楚、可审计。

### 目标：
让 staleness evaluation 的结果真正写入 peer lifecycle，而不是停留在 reason 文本。

---

## Task 2 — 打通真实 Refresh Failure 链路

必须让 `refreshPeer()` 具备真实 refresh 语义，而不是仅更新本地 health。

### 本任务必须完成：
1. 定义 provider refresh contract（若已有 provider contract，则扩展其 refresh 能力）；
2. `refreshPeer(peerId)` 需要根据 peer/source/provider 执行真实 refresh 尝试；
3. refresh success 才能清空 failure count；
4. refresh failure 必须真实累计到 `refreshFailures`；
5. 达到阈值后，`markStalePeers()` 或 lifecycle handler 必须能触发 quarantine / degrade / offline 路径。

### 允许的现实约束：
- 若某些 source 当前不支持真实 refresh，可明确返回“not refreshable”而不是伪成功；
- manual peer / imported peer / mock registry peer 可以使用不同 refresh semantics，但必须明确。

### 目标：
让 `quarantineAfterFailures` 从纸面配置变成真实生效机制。

---

## Task 3 — 明确并收紧 Peer Lifecycle Contract

本轮必须把 `known / trusted / degraded / offline / quarantined / revoked` 的边界进一步工程化。

### 至少要完成：
- 明确 degraded 与 offline 的使用边界；
- 明确哪些状态可恢复，哪些是 terminal；
- 明确 stale-based degrade 与 refresh-failure-based quarantine 是否共享恢复路径；
- 对 `lastSeen` 缺失场景给出明确语义，而不是默认按 epoch 0 处理。

### 至低要求：
对 `lastSeen` 缺失至少选择其一：
1. 视为“unknown freshness”，单独处理；
2. 仅对已进入 refresh cycle 的 peer 使用 staleness 规则；
3. 用 `registeredAt` / `discoveredAt` 做更合理的 fallback。

### 禁止：
- `lastSeen` 缺失时直接等价为“从 1970 开始离线”，除非你明确证明这是有意设计且测试覆盖。

---

## Task 4 — 修复 Selector 解释 / 评分不一致

必须对 `PeerSelector` 做一次语义对账。

### 本任务必须完成：
1. 清点所有 `selectionReasons` 中会让读者理解为“影响排序”的因素；
2. 确认这些因素是否真的进入 score；
3. 若进入，则明确其权重或 adjustment 机制；
4. 若不进入，则修改措辞，避免伪解释；
5. 保证 `reasons` 与排序逻辑不冲突。

### 至少需覆盖：
- peer status（trusted / degraded）
- reputation trend（improving / declining）
- kind preference
- capability match

### 目标：
实现真正的 explainable selection，而不是“描述型注释”。

---

## Task 5 — 收紧 Delegation Service Guard

必须把 delegation 安全边界下沉到 service 层。

### 本任务至少完成：
- `delegateTask()` 明确拒绝对 `offline` peer 委派；
- 明确对 `degraded` peer 的策略：
  - 要么禁止；
  - 要么允许但需要显式 override / special reason；
  - 要么仅允许低优先级/降级策略任务；
- `revoked / quarantined` 仍然不可委派；
- 返回错误信息必须可用于诊断，而不是模糊失败。

### 强要求：
不能把“服务层安全”外包给 API 层或 selector。  
selector 是推荐路由，不是最终安全边界。

---

## Task 6 — 对齐 Discovery / Reputation / Delegation 的失败传播

本轮需要检查并修正：
- stale → degraded
- repeated refresh failure → quarantine
- delegation failure/timeout → reputation negative event
- reputation negative accumulation → future selection downgrade

### 本任务目标：
把三条链路打通成一致叙事：
1. **发现与刷新失败影响 peer 生命周期**
2. **peer 生命周期影响 delegation eligibility**
3. **delegation 结果再反过来影响 reputation 与后续选择**

### 强要求：
- 不允许链路中某一段只有字段存在、但无真实行为后果；
- 不允许“写了 reason 但没有 runtime effect”的伪闭环。

---

## Task 7 — 扩展 / 修正 Control Surface 语义

本轮需要审查并必要时修正现有 control surface 的语义边界。

### 至少检查并决定：
- `/api/collective/reputation/:peerId` 对 unknown peer 应返回：
  - 404
  - 还是 neutral summary + 200
- `/api/collective/delegate` 在无 eligible peer 时的错误语义是否充分；
- discovery stats 是否能真实反映 refresh failures / stale peers / quarantined peers；
- preview API 输出的 reasons 与 score 是否已对账。

### 目标：
让 control surface 反映真实 runtime contract，而不是仅把内部对象序列化出去。

---

## Task 8 — 补齐失败路径与契约测试

本轮测试必须重点补失败路径，而不是继续主要补 happy path。

### 8.1 Lifecycle Tests
必须新增或强化：
- stale peer 经 `markStalePeers()` 后真实进入 `degraded`
- offline threshold 命中后真实进入 `offline`
- repeated refresh failures 达阈值后进入 `quarantined`
- successful refresh 可按策略恢复或清除 failure count

### 8.2 Delegation Guard Tests
必须覆盖：
- 不能对 `offline` peer 委派
- 对 `degraded` peer 的策略与预期一致
- `revoked/quarantined` peer 仍不可委派

### 8.3 Selector Integrity Tests
必须覆盖：
- trend/status bonus/penalty 是否真实影响 score
- reasons 与 score 对账
- 若某因素不进 score，reasons 中不能误导性表述“bonus/penalty”

### 8.4 Boundary Tests
必须覆盖：
- `lastSeen` 缺失
- unknown peer reputation API
- unsupported refresh provider
- refresh failure count reset 逻辑

### 8.5 Contract Strictness Tests
必须减少依赖 `as any` 掩盖契约漂移。  
应尽量让测试在 tier/status/field name 漂移时立即失败，而不是通过强转静默放行。

---

## Task 9 — 文档更新：从“能力出现”改为“闭环定义”

本轮必须更新文档，明确写出：
1. stale / degraded / offline / quarantined 的正式语义；
2. 什么叫 refresh success / refresh failure；
3. delegation service guard 的最终规则；
4. selector 的 reasons 与 score 的一致性原则；
5. 当前哪些 source 支持真实 refresh，哪些仅支持 ingest。

### 禁止：
- 用“支持 staleness lifecycle”描述一个实际上 degrade 不落地的系统；
- 用“supports refresh failure quarantine”描述一个 failure 计数未接真实 refresh 的系统；
- 用“explainable selector”描述一个 reasons 与 score 分离的系统。

---

# 4. 本轮实施范围与文件级执行清单

本轮除了定义“要修什么”，还必须明确“改哪里、按什么顺序改、每一步如何验证”。  
禁止只给方向，不给落点；也禁止只列文件名，不说明修改目标。

## 4.1 优先修改文件（建议落点）

以下文件是本轮最可能需要修改的核心落点：

### Collective Runtime Core
- `packages/core/src/collective/discovery-service.ts`
- `packages/core/src/collective/collective-service.ts`
- `packages/core/src/collective/staleness-policy.ts`
- `packages/core/src/collective/peer-selector.ts`
- `packages/core/src/collective/reputation-service.ts`
- `packages/core/src/collective/collective-contract.ts`
- `packages/core/src/collective/discovery-contract.ts`
- `packages/core/src/collective/trust-model.ts`
- `packages/core/src/collective/index.ts`

### Control Surface / Kernel Wiring
- `packages/core/src/server/routes/collective.ts`
- `packages/core/src/kernel/index.ts`
- `packages/core/src/kernel/server-init.ts`

### Tests
- `packages/core/src/collective/collective-16-7.test.ts`
- `packages/core/src/collective/collective.test.ts`
- 如有必要，新增更细的专项测试文件，例如：
  - `packages/core/src/collective/collective-16-8-lifecycle.test.ts`
  - `packages/core/src/collective/collective-16-8-selector.test.ts`
  - `packages/core/src/collective/collective-16-8-delegation.test.ts`

### Documentation
- `DevPrompt/0176_Round_16_8_Collective_Lifecycle_Closure_and_Delegation_Integrity_Hardening.md`
- collective 相关 docs / planning / audit 文档（若仓内已有对应目录，则同步更新）

---

## 4.2 文件级修改目标

### A. `discovery-service.ts`
必须完成：
- 修复 `markStalePeers()` 中 degrade 分支不落地的问题；
- 让 `refreshPeer()` 具备真实 refresh 语义，或明确 unsupported 语义；
- 让 `refreshFailures` 基于真实 refresh failure 累积；
- 确保 stale scan 不会通过 refresh 把 stale peer 洗白；
- 若 contract 中声明了 `quarantined` action，则实现与 contract 对齐，或下调 contract 表述。

### B. `collective-service.ts`
必须完成：
- 新增或整理 degraded/offline/quarantined 的正式状态迁移入口；
- 收紧 `delegateTask()` 的服务层 guard；
- 明确 offline peer 不可委派；
- 明确 degraded peer 的 canonical policy；
- 保证 delegation failure / reputation feedback / lifecycle pressure 的交互不互相打架。

### C. `staleness-policy.ts`
必须完成：
- 明确 `lastSeen` 缺失时的 contract；
- 避免默认按 epoch 0 粗暴计算；
- 必要时补充 `unknown freshness` / `not-yet-observed` 语义；
- 保证阈值解释与 lifecycle transition 一致。

### D. `peer-selector.ts`
必须完成：
- 对账所有 reasons 与实际 score；
- status / trend / kind / capability 相关因素要么真实入分，要么改写 reasons 避免误导；
- capability 统计避免 declared/verified 重复计数；
- 维持 explainable selection，但禁止伪 explainability。

### E. `discovery-contract.ts` / `collective-contract.ts`
必须完成：
- 对 discovery refresh、lifecycle actions、delegation eligibility 的语义补完；
- 若现有 contract 字段与实现脱节，必须二选一：
  - 补实现；
  - 收 contract；
- 禁止 contract 假装支持某动作而实现永远不会产出。

### F. `routes/collective.ts`
必须完成：
- 明确 unknown reputation peer 的 API 语义；
- delegate API 在无 eligible peer / peer 不可委派时给出明确错误；
- preview/select diagnostics 输出与实际 selector 行为一致；
- discovery/lifecycle stats 能反映真实运行状态。

### G. 测试文件
必须完成：
- 用 failure-path tests 钉死本轮修复；
- 减少 `as any` 掩盖契约漂移；
- 让 tier/status/field mismatch 尽量在测试阶段直接暴露。

---

## 4.3 强制执行顺序

本轮必须按以下顺序推进，不允许乱序堆改：

### Step 1 — 先修 contract，再修行为
先明确：
- degraded / offline / quarantined 语义
- refresh success / failure 语义
- delegation guard 语义

### Step 2 — 修 lifecycle state transition
优先修：
- stale → degraded
- stale → offline
- refresh failure → quarantine

### Step 3 — 修 delegation service boundary
在 selector 之前，先确保 service 层本身不会接受明显非法的委派目标。

### Step 4 — 修 selector 对账
在 lifecycle 与 delegation contract 稳定后，再统一修 reasons / score 一致性。

### Step 5 — 补 failure-path tests
必须在行为修复后立刻补测试，不能最后才想起补。

### Step 6 — 最后清理 docs / diagnostics / API 语义
文档和控制面必须反映最终真实 contract，而不是中途假设。

---

## 4.4 每步最小验收动作

### 在完成 Step 1 后，至少验证：
- contract 文本与状态机语义不冲突
- 不存在“名字像支持，运行时不支持”的 action

### 在完成 Step 2 后，至少验证：
- stale peer 真正进入 degraded
- repeated refresh failures 真正进入 quarantine 或预期状态
- lastSeen 缺失不会被错误洗成极端 stale

### 在完成 Step 3 后，至少验证：
- offline peer 无法通过 service 层直接 delegate
- degraded peer 策略符合本轮定义

### 在完成 Step 4 后，至少验证：
- reasons 提到的 bonus/penalty 确实反映在排序上
- 或 reasons 被修改为不会误导读者的中性说明

### 在完成 Step 5 后，至少验证：
- failure-path tests 全部新增并通过
- collective 既有测试无回归

### 在完成 Step 6 后，至少验证：
- API 返回语义和 docs 对账
- diagnostics 字段不再输出误导性统计

---

## 4.5 本轮禁止的实现方式

禁止以下偷懒做法：
- 继续用 `refreshPeerHealth()` 充当 degraded transition
- 用日志/reason 文本冒充 runtime effect
- 在 selector 中保留“bonus/penalty”措辞但不进 score
- 只在 API 层拦 offline peer，service 层仍可直调委派
- 用 `as any` 规避状态/枚举/字段对不上的问题
- 用新增测试覆盖 happy path 来掩盖 failure-path 缺口

---

# 5. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical stale / refresh / lifecycle contract**
2. **How stale peers now transition across degraded / offline / quarantined states**
3. **How refresh is now actually executed and how failures accumulate**
4. **How delegation safety is now enforced at the service boundary**
5. **How selector reasons and scoring are now reconciled**
6. **What API semantics were clarified or changed**
7. **What failure-path tests were actually executed**
8. **What remains intentionally deferred**

### 禁止输出：
- “lifecycle complete”但 degrade 仍不落地
- “failure-aware refresh complete”但 refresh 仍只是本地时间戳更新
- “selector explainability fixed”但 reasons 仍和 score 不一致
- “delegation integrity hardened”但 service 层仍允许对 offline peer 委派

---

# 6. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] stale → degraded 已有真实状态迁移，不再通过 refresh 洗白 peer
- [ ] refreshPeer 已具备真实 refresh 语义或明确的不支持语义
- [ ] refresh failure count 会基于真实失败累计
- [ ] repeated refresh failures 可真实触发 quarantine / lifecycle pressure
- [ ] `lastSeen` 缺失场景已有明确且合理的 contract
- [ ] selector 的 reasons 与实际 score 已对账
- [ ] service 层明确拒绝对 offline peer 委派
- [ ] degraded peer delegation policy 已明确并被测试覆盖
- [ ] discovery / lifecycle / delegation / reputation 三条链路的失败传播已形成真实闭环
- [ ] API 边界语义已补清
- [ ] 新增 failure-path tests 已通过
- [ ] 原有 collective tests 无回归
- [ ] 项目级测试结论被如实表述，禁止把局部通过包装成全项目稳定

---

# 7. 一句话结论

> **Round 16.8 的目标，不是再让 collective runtime“看起来更完整”，而是让它在 peer lifecycle、refresh failure、selector explainability、delegation safety 这四个关键环节上真正变得可信。**
