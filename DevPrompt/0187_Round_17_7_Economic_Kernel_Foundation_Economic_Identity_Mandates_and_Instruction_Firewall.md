# DevPrompt 0187 — Round 17.7
## Economic Kernel Foundation / Economic Identity / Mandates / Instruction Firewall

你现在处于 **ConShellV2 Round 17.7**。

Round 17.6 的正确方向已经明确：
- 先把 identity / governance / claims / registry 的内部真相暴露成 diagnosis-first truth surface
- 再继续向更高阶生命体能力推进

而从全局审计与 Web4 路线看，ConShell 接下来的决定性主线不是继续堆局部功能，
而是：

> **建立一个真正安全、可治理、可审计、可扩展的 Economic Kernel，让经济能力成为 runtime 的正式一层，而不是散落在钱包、支付、收款、红包、x402 片段和业务代码里的零散逻辑。**

当前 ConShell 已经拥有：
- wallet / spend / ledger / survival coupling 的基础
- revenue surface / autonomous agenda 的前置主线
- governance / identity / claims 的较强控制基础
- x402 的初步结构与 Web4 方向意识

但它仍然缺少一个正式的经济核心层，用于回答：
- 谁拥有经济身份？
- 哪些 runtime 主体拥有哪些经济能力？
- 哪些动作属于收款、领取奖励、预算内支付、显式转账？
- 用户批准的到底是“某一笔支付”，还是一个时间/金额/用途受限的 mandate？
- 外部文本、网页、红包说明、文档、工具返回，为什么不能直接触发经济动作？

所以 Round 17.7 的目标不是直接完成完整 x402，也不是直接全面自动支付。

> **Round 17.7 要先完成 Economic Kernel Foundation：让“经济身份、能力边界、mandate 授权、候选经济动作防火墙”先成为系统正式 contract。**

---

## 一、本轮唯一主目标

**建立 ConShell Economic Kernel Foundation。**

也就是让 ConShell 在工程上正式拥有：
- Economic Identity
- Economic Capability Envelope
- Mandate Engine
- Economic Action Classification
- Economic Instruction Firewall
- Economic Audit Event 基础结构

本轮重点不在“付出去多少钱”，
而在于：

> **先把经济能力的边界、授权、风控与可审计性做对。**

---

## 二、为什么这一轮必须现在做

### F1. 当前经济能力仍然是“有模块”，不是“有正式内核”
ConShell 目前已有：
- wallet
- spend tracking
- revenue surface
- x402 结构
- survival coupling

但这些仍未形成统一的经济核心 contract。

### F2. 如果不先做 Economic Kernel，后面继续接 Web4 支付会很危险
如果没有：
- Economic Identity
- Capability Envelope
- Mandate Engine
- Firewall

那么任何后续 x402 / payment proof / reward claim / receive endpoint 都容易退化成：
- 更高级的直接花钱接口
- 模糊的“钱包 = 权限”模型
- 无法审计的外部经济指令入口

### F3. 17.7 是接入 Web4 经济层的正确顺序
正确顺序应是：
1. 先做 truth surface
2. 再做 economic kernel
3. 再做 ConShell 402 / payment negotiation
4. 再做 reward / claim / marketplace primitives

而不是反过来。

---

## 三、本轮必须完成的内容

# G1. Economic Identity Layer

建立正式的 Economic Identity 概念。

### G1.1 必须明确区分
至少区分：
- `RuntimeIdentity`
- `EconomicIdentity`

### G1.2 目标
系统必须避免：
- session identity 直接等于钱包权限
- runtime 存在就自动拥有支付能力
- 一个 active identity 自动获得所有经济动作资格

### G1.3 Economic Identity 至少应表达
- `economicIdentityId`
- `runtimeIdentityId`
- `walletRef` / `settlementProfile`
- `status`
- `createdAt`
- `capabilityEnvelopeId`
- `restrictions`

### G1.4 要求
- 没有 Economic Identity，不得进入正式经济动作流
- runtime identity 可以存在，但没有 economic identity 时只能是经济只读 / 无权状态

---

# G2. Economic Action Classification

把经济动作正式分层，禁止继续模糊处理。

### G2.1 至少建立以下 4 类
1. `receive`
2. `claim_reward`
3. `spend_within_mandate`
4. `explicit_transfer`

### G2.2 目标
让系统能清晰回答：
- 这是收钱动作，还是花钱动作？
- 这是资格领取，还是预算内支付？
- 这是自动可做，还是必须人工批准？

### G2.3 必须明确风险基线
建议默认：
- `receive` → low
- `claim_reward` → medium-low
- `spend_within_mandate` → medium / high
- `explicit_transfer` → high / critical

### G2.4 影响面
- governance
- policy
- budget checks
- audit logs
- future payment negotiation

---

# G3. Capability Envelope

建立 Economic Capability Envelope，让经济能力不再默认开放。

### G3.1 至少支持以下 capability scopes
- `receive_only`
- `claim_reward`
- `spend_within_mandate`
- `explicit_transfer`（默认禁用 / 强约束）

### G3.2 目标
系统必须可以表达：
- 某个主体只能收款
- 某个主体可以领取奖励但不能主动支付
- 某个主体可在 mandate 范围内付费
- 某个主体永远不能直接转账

### G3.3 要求
- capability 必须与 economic identity 绑定
- capability 必须可审计、可变更、可撤销
- capability 不能只存在于注释和约定里，必须进入正式 contract

---

# G4. Mandate Engine

建立正式的 mandate 授权模型。

### G4.1 mandate 不是单次支付许可，而是受限 envelope
至少应支持：
- 金额上限
- 单次金额上限
- 时间窗口
- 用途
- 允许的资源类型
- 允许/禁止的 provider
- 禁止动作
- 风险级别
- 审批来源

### G4.2 建议字段
- `mandateId`
- `economicIdentityId`
- `purpose`
- `asset`
- `network`
- `maxTotalAmount`
- `maxPerTransactionAmount`
- `validFrom`
- `validUntil`
- `allowedResourceKinds`
- `allowedProviders`
- `disallowedActionKinds`
- `riskLevel`
- `approvalMode`
- `approvedBy`
- `remainingBudget`
- `status`

### G4.3 必须建立的行为
- mandate matching
- mandate exhaustion
- mandate expiry
- mandate rejection reason
- mandate violation reporting

### G4.4 本轮不要求
- 不要求做完整链上授权
- 不要求做完整 payment proof
- 不要求做完整 provider adapter matrix

本轮只要求：

> **mandate 先成为 ConShell 内部的正式治理和经济 contract。**

---

# G5. Economic Instruction Firewall

本轮必须建立 Economic Instruction Firewall。

### G5.1 这层的必要性
任何外部来源：
- 网页
- 文档
- skill 输出
- 工具返回
- 红包说明
- webhook
- 社区帖子
- prompt injection 文本

都不能直接形成真实经济动作。

### G5.2 最低规则
以下动作不能被外部文本直接触发：
- `explicit_transfer`
- `spend_within_mandate` 的自动执行
- 新 mandate 批准
- capability 扩权
- 钱包绑定/切换
- 支付签名 / 授权签名

### G5.3 候选动作池
外部经济指令最多只能进入：
- `candidateEconomicActions`

候选动作必须经过：
1. source trust evaluation
2. policy check
3. risk scoring
4. capability check
5. mandate check
6. human confirmation（若高风险）

### G5.4 目标
让系统默认满足：

> **外部经济指令默认不可信。**

---

# G6. Economic Audit Event Foundation

建立经济动作审计基础结构。

### G6.1 至少记录
- actor runtime identity
- actor economic identity
- action classification
- candidate source
- firewall result
- mandate used / denied
- policy result
- governance result（如有）
- final decision
- createdAt

### G6.2 目标
即使本轮还没全面支付，系统也必须开始具备：
- 经济动作是如何被批准或拦截的可追溯性

---

# G7. API / Control Surface Exposure (Foundation Level)

本轮至少要让 operator 能看到 Economic Kernel 的基础状态。

### G7.1 至少暴露以下信息
- 当前 economic identity 状态
- 当前 capability envelope
- 当前 mandates 列表 / 活跃 mandate 摘要
- candidate economic actions 状态
- firewall 拦截统计 / 最近拦截事件

### G7.2 目标
不要让 Economic Kernel 只存在于内部对象里。
必须让 operator 能看到：
- 系统当前是否处于 receive-only 模式
- 有没有 active mandate
- 有没有被外部文本尝试诱导的经济动作

---

# G8. Verification Matrix for 17.7

### V1. runtime identity 与 economic identity 已正式区分
### V2. receive / claim_reward / spend_within_mandate / explicit_transfer 四类经济动作有正式分类
### V3. capability envelope 能表达 receive-only 与 transfer 禁用状态
### V4. mandate engine 能正确匹配 / 拒绝 / 过期 / 耗尽
### V5. 外部文本不能直接形成真实经济动作
### V6. candidate economic actions 必须经过 firewall + policy + capability + mandate 检查
### V7. economic audit events 能记录关键决策链
### V8. operator surface 能看到当前 economic kernel 基础状态
### V9. 本轮不引入新的高风险自动外发路径
### V10. identity / governance / economy 相关测试无新回归

### 测试要求
- 必须覆盖正向与负向路径
- 必须测试拦截行为，而不是只测 happy path
- 必须测试 receive-only 模式下的限制是否生效
- 必须测试 explicit transfer 默认不可自动执行

---

## 四、建议执行顺序

### Priority 1 — 定义 Economic Identity / Action Classification / Capability Envelope
先把语言和对象建起来。

### Priority 2 — 建立 Mandate Engine
把授权 envelope 建起来。

### Priority 3 — 建立 Economic Instruction Firewall
先堵住最危险的外部注入入口。

### Priority 4 — 建立 Economic Audit Event + Foundation API Surface
让系统可见、可查、可调试。

---

## 五、本轮非目标

本轮明确不做：
- 不做完整 x402 端到端支付协商闭环
- 不做完整链上签名支付
- 不做 unrestricted payout / transfer 自动化
- 不做 marketplace / bounty platform 全系统
- 不做完整 reward economy 终局
- 不做高权限资金外发自动批准

本轮的目标是：

> **先把经济边界与授权体系做对，再做更高级的 Web4 支付协议层。**

---

## 六、验收标准

Round 17.7 只有在以下条件满足时才算完成：

1. Economic Identity 正式成立
2. 经济动作分层正式成立
3. Capability Envelope 正式成立
4. Mandate Engine 具备最小可执行 contract
5. Economic Instruction Firewall 正式成立
6. Economic Audit Event 基础结构正式成立
7. Operator 可以看到当前 Economic Kernel 基础状态
8. 本轮没有引入新的危险自动外发路径
9. identity / governance / economy 主线无新回归

---

## 七、最终输出格式

完成后必须输出：

### A. Economic Kernel Foundation Summary
- Economic Identity 如何定义
- Economic Capability 如何定义
- Economic Action 如何分类

### B. Mandate & Firewall Summary
- mandate contract 如何定义
- firewall 如何拦截外部经济指令
- 哪些动作必须人工确认

### C. Control Surface & Audit Summary
- 暴露了哪些 operator-facing 经济状态
- audit event 记录了什么

### D. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### E. Risks / Deferred
- 哪些完整 x402 / negotiation / reward / payout work 延后到后续轮次
- Round 17.8 最合理方向是什么

### F. 不得伪造
- 没有 capability envelope 不能说经济权限模型成立
- 没有 mandate engine 不能说预算授权体系成立
- 没有 firewall 不能说 Web4 经济层安全边界成立
- 没有 audit event 不能说经济动作可审计

---

## 八、一句话任务定义

> **Round 17.7 的目标是：把 ConShell 的经济能力从零散模块推进成一个正式的 Economic Kernel Foundation，使经济身份、能力边界、mandate 授权与外部经济指令防火墙先于完整 Web4 支付协议层成立。**
