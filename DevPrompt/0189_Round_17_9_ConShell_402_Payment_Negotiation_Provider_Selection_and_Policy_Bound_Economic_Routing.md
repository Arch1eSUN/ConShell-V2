# DevPrompt 0189 — Round 17.9
## ConShell 402 / Payment Negotiation / Provider Selection / Policy-Bound Economic Routing

你现在处于 **ConShellV2 Round 17.9**。

Round 17.7 已经完成：
- Economic Identity
- Economic Action Classification
- Capability Envelope
- Mandate Engine
- Economic Instruction Firewall
- Economic Audit Event foundation
- EconomicKernelFoundation

Round 17.8 已经完成：
- Economic Truth Surface
- Economic diagnostics / summaries
- RewardDefinition / EligibilityRule
- ClaimAttempt / ClaimReceipt
- Anti-duplication rules
- Control surface upgrade

这意味着 ConShell 的经济层现在已经具备了两层关键基础：

1. **Authorization Boundary**
   - 谁可以做什么
   - 哪些动作必须被拦截
   - mandate 如何约束 spend

2. **Truth & Object Layer**
   - 当前经济状态是什么
   - reward / claim 如何建模
   - firewall / mandate / capability 的诊断如何暴露

所以 Round 17.9 才是正确进入 **ConShell-native 402 / payment negotiation** 的轮次。

本轮的目标不是“开放自动花钱”，
也不是“做一个普通支付 SDK 封装”，
而是：

> **把支付要求、支付决策、provider 选择、mandate 约束、policy 约束、人工确认边界统一推进到 runtime 的正式协议层。**

---

## 一、本轮唯一主目标

**建立 ConShell 402 / Payment Negotiation Layer。**

也就是让 ConShell 能以 machine-readable 的方式处理：
- 某个资源/服务是否需要支付
- 需要什么支付条件
- 当前 mandate 是否覆盖
- 当前 capability 是否允许
- 当前 policy / governance 是否允许
- 应自动放行、等待人工确认、切换 provider，还是拒绝

本轮重点不是 settlement 终局，
而是：

> **先把“支付协商与经济路由”做成正式协议层与决策层。**

---

## 二、为什么现在才做这一轮

### F1. 17.7 前做 negotiation 会太早
因为当时还没有：
- Economic Identity
- Capability Envelope
- Mandate Engine
- Firewall

### F2. 17.8 前做 negotiation 仍不够稳
因为当时还没有：
- Economic Truth Surface
- Reward / Claim 对象层
- diagnosis-first operator surface

### F3. 现在条件已满足
17.7 + 17.8 之后，ConShell 已具备：
- 经济授权边界
- 经济真相面
- 奖励对象层
- claim 生命周期

这正是 payment negotiation 能安全接入的前提。

---

## 三、本轮必须完成的内容

# G1. ConShell Payment Requirement Contract

建立正式的 machine-readable payment requirement contract。

### G1.1 建议新增类似结构
- `PaymentRequirement`
- `PaymentOffer`
- `PaymentNegotiationRequest`
- `PaymentNegotiationResult`
- `PaymentPreparationIntent`

### G1.2 PaymentRequirement 至少应表达
- `requirementId`
- `resource`
- `purpose`
- `providerId`
- `asset`
- `network`
- `amountCents` / `amountAtomic`
- `pricingMode`（exact / capped / quote）
- `expiresAt`
- `allowedSettlementKinds`
- `riskLevel`
- `metadata`

### G1.3 目标
让 ConShell 内部与未来外部 provider 都能通过统一 contract 表达：
- “这个资源要花多少钱”
- “这笔钱为什么花”
- “支付条件何时失效”

---

# G2. Payment Negotiation Decision Engine

建立正式的 payment negotiation 决策层。

### G2.1 至少输出以下决策类型
- `allow_and_prepare`
- `allow_and_route`
- `require_human_confirmation`
- `switch_provider`
- `reject`

### G2.2 决策必须综合以下约束
- economic identity 是否存在
- capability envelope 是否允许
- mandate 是否匹配
- firewall 是否放行
- policy / governance 是否允许
- requirement 是否过期
- amount 是否超预算

### G2.3 目标
让 runtime 能明确回答：
- 当前为什么能付
- 当前为什么不能付
- 为什么该换 provider
- 为什么必须人工确认

---

# G3. Provider Selection / Economic Routing

建立 provider-aware economic routing。

### G3.1 至少支持
- 多 provider payment offers 比较
- cheaper / safer / mandate-compatible provider selection
- policy-bound routing decision
- no-pay alternative detection（若存在免费替代路径）

### G3.2 目标
ConShell 不应把 payment 当成单一路径。
它应能回答：
- 哪个 provider 更便宜
- 哪个 provider 更符合当前 mandate
- 哪个 provider 风险更低
- 是否存在无需支付的替代 provider

### G3.3 注意
本轮的 routing 可以先做 internal routing / simulation / decision layer，
不要求完整落地所有真实 provider adapters。

---

# G4. ConShell 402 Response Model

建立 ConShell-native 402 风格响应模型。

### G4.1 至少支持类似输出
```json
{
  "status": 402,
  "requirements": [
    {
      "scheme": "exact",
      "resource": "service://image/generate",
      "providerId": "provider_x",
      "asset": "USDC",
      "network": "base",
      "amountAtomic": "100000",
      "purpose": "image_generation",
      "expiresAt": "2026-03-19T00:00:00Z"
    }
  ]
}
```

### G4.2 目标
让 payment requirement 不再是 ad-hoc 文本，而是正式 machine-readable protocol object。

---

# G5. Preparation Layer, Not Final Settlement Layer

本轮重点是“支付准备与协商”，不是最终 settlement 完整执行。

### G5.1 至少支持
- prepare payment intent
- record negotiation context
- bind intent to mandate / economic identity / provider
- emit audit trail

### G5.2 本轮不要求
- 不要求完整链上广播
- 不要求完整 wallet signing execution
- 不要求 unrestricted payout automation

### G5.3 目标
把 settlement 之前的所有高价值逻辑先统一到可测试层。

---

# G6. Policy-Bound Economic Routing

本轮必须把 policy / governance 与 payment negotiation 接起来。

### G6.1 至少要能回答
- 当前动作是否被 policy 拒绝
- 当前动作是否需要 governance escalation
- 当前动作是否超出 mandate
- 当前动作是否因 risk level 必须人工确认

### G6.2 目标
支付协商不能绕过现有治理体系。
必须是：

> payment negotiation ∈ policy-bound runtime behavior

---

# G7. Audit & Truth Surface Extension

本轮必须把 negotiation 纳入 truth surface 与 audit 面。

### G7.1 至少新增/升级类似结构
- `PaymentNegotiationAuditEvent`
- `PaymentNegotiationSummary`
- `ProviderSelectionSummary`
- `PendingEconomicConfirmationSummary`

### G7.2 至少记录
- requirement received
- requirement evaluated
- provider compared
- route selected
- human confirmation required
- rejected reason
- mandate mismatch
- policy rejection

### G7.3 目标
operator 必须能直接看到：
- 系统最近想为什么东西付费
- 为什么通过 / 拒绝 / 切 provider
- 哪些支付仍在等待人工确认

---

# G8. Control Surface / API Extension

本轮至少扩展控制面以展示 negotiation 状态。

### G8.1 至少提供
- payment requirements summary
- negotiation decisions summary
- provider selection summary
- pending human confirmations
- rejected negotiation reasons
- mandate mismatch reasons

### G8.2 建议新增/升级 API
- `/api/economic/payments/requirements`
- `/api/economic/payments/negotiations`
- `/api/economic/payments/pending`
- `/api/economic/payments/providers`

命名可调整，但必须体现：
- requirement
- negotiation
- pending confirmation
- provider routing

---

# G9. Verification Matrix for 17.9

### V1. PaymentRequirement contract 能表达资源、金额、provider、过期时间与目的
### V2. Payment negotiation 能正确区分 allow / require_human_confirmation / switch_provider / reject
### V3. negotiation decision 会受 economic identity / capability / mandate / firewall 约束
### V4. expired / over-budget / no-mandate requirements 会被结构化拒绝
### V5. provider selection 能在多个 offers 中做受约束选择
### V6. ConShell 402 response model 可被生成并消费
### V7. negotiation 会产出完整 audit trail
### V8. control surface 可见 negotiation / pending / rejected 状态
### V9. explicit_transfer 仍然不能自动执行
### V10. 17.7 / 17.8 的安全不变量与 reward/claim 体系无回归

### 测试要求
- 必须覆盖正向与负向路径
- 必须测试 mandate mismatch / policy reject / provider switch / human confirmation
- 必须测试 external source 不能借 negotiation 绕过 firewall
- 必须测试 explicit_transfer 仍保持强人工边界

---

## 四、建议执行顺序

### Priority 1 — 定义 PaymentRequirement / NegotiationResult contract
先把协议对象建起来。

### Priority 2 — 建立 negotiation decision engine
把决策链做成正式结构。

### Priority 3 — 建立 provider selection / economic routing
先支持内部比较与路由，不强求完整 provider adapters。

### Priority 4 — 建立 preparation intent + audit trail
把协商行为纳入正式审计结构。

### Priority 5 — 扩展 control surface / truth surface
让 operator 看得到 payment requirement / negotiation / pending confirmation。

---

## 五、本轮非目标

本轮明确不做：
- 不做 unrestricted automatic payout
- 不做绕过 mandate 的支付执行
- 不做绕过人工确认的 explicit transfer
- 不做完整链上 settlement orchestration
- 不做完整钱包签名/广播系统
- 不把 provider adapter 广度当作本轮主要完成度指标

本轮目标是：

> **先把支付协商、支付决策、provider 选择、policy-bound routing 变成 ConShell 的正式协议层。**

---

## 六、硬性安全不变量

以下规则本轮绝不能被破坏：

1. **外部来源不能直接触发 `explicit_transfer`**
2. **`explicit_transfer` 即使 negotiation 全部通过，仍必须人工确认**
3. **`spend_within_mandate` 必须存在有效 mandate**
4. **payment negotiation 不能绕过 firewall**
5. **payment routing 不能绕过 policy / governance**
6. **reward / claim 体系不能因 payment negotiation 出现回归**
7. **truth surface 必须持续准确反映 payment negotiation 状态**

---

## 七、验收标准

Round 17.9 只有在以下条件满足时才算完成：

1. PaymentRequirement / PaymentNegotiationResult contract 正式成立
2. negotiation decision engine 正式成立
3. provider selection / policy-bound routing 正式成立
4. ConShell-native 402 response model 成立
5. preparation intent / audit trail 成立
6. control surface 能看到 negotiation / provider / pending confirmation / rejection reasons
7. explicit transfer 的强人工边界无回归
8. 17.7 / 17.8 的安全不变量与 reward/claim 体系无回归

---

## 八、最终输出格式

完成后必须输出：

### A. Payment Negotiation Contract Summary
- 新增了哪些 payment requirement / negotiation contracts
- 402 response model 如何定义

### B. Routing / Provider Selection Summary
- provider comparison 如何建模
- route selection 如何受 mandate / policy 约束

### C. Audit / Truth Surface Summary
- negotiation 如何进入 truth surface
- pending confirmation / rejected reasons 如何暴露

### D. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### E. Risks / Deferred
- 哪些真实 settlement / signing / chain execution 留到后续轮次
- 哪些 provider breadth work 延后

### F. 不得伪造
- 没有 machine-readable negotiation contract，不能说 402 层已成立
- 没有 routing decision engine，不能说 payment routing 已成立
- 没有 pending/rejection diagnostics，不能说 operator surface 已闭环
- 没有保持 explicit transfer 人工边界，不能说安全验收通过

---

## 九、一句话任务定义

> **Round 17.9 的目标是：把支付要求、支付决策、provider 选择、mandate 约束、policy 约束与人工确认边界统一推进成 ConShell 的正式 402 / payment negotiation 协议层，为后续真实 settlement 与更广泛 provider integration 奠定安全且可审计的基础。**
