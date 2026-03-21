# DevPrompt 0188 — Round 17.8
## Economic Truth Surface / Diagnostics / Reward-Claim Foundation

你现在处于 **ConShellV2 Round 17.8**。

Round 17.7 已经完成了一个非常关键的基础层：
- Economic Identity 已成立
- Economic Action Classification 已成立
- Capability Envelope 已成立
- Mandate Engine 已成立
- Economic Instruction Firewall 已成立
- Economic Audit Event foundation 已成立
- EconomicKernelFoundation 已作为统一工厂/治理包络层接入

这意味着 ConShell 的经济能力已经不再只是：
- 钱包模块
- 收支记录
- survival coupling
- 零散的 x402 结构

而是第一次具备了：

> **正式的 Economic Kernel Foundation。**

但 17.7 之后仍然存在一个明确缺口：

> **经济核心层已经成立，但它还没有被完整暴露成 diagnosis-first 的 Economic Truth Surface，也没有把 `claim_reward` 从动作语义推进成真正可治理的 reward / eligibility / claim foundation。**

所以 Round 17.8 不应直接跳去完整 ConShell 402 / payment negotiation。

正确顺序应是：
1. 17.7 建立 Economic Kernel Foundation
2. **17.8 建立 Economic Truth Surface + Reward/Claim Foundation**
3. 17.9 再进入 ConShell 402 / Payment Negotiation

---

## 一、本轮唯一主目标

**把 17.7 的 Economic Kernel Foundation 推进成 operator-facing 的 Economic Truth Surface，并建立 Reward / Claim Foundation。**

也就是让系统可以稳定回答：
- 当前有哪些 economic identities？
- 当前各主体的 capability envelopes 是什么？
- 当前有哪些 active / expired / exhausted / revoked mandates？
- 最近哪些候选经济动作被 firewall 拦截？为什么？
- 当前系统处于 receive-only 还是具备 spend-within-mandate 能力？
- 当前 rewards 如何定义？谁具备资格领取？谁已领取？是否存在重复领取？

---

## 二、当前真实缺口

### F1. Economic Kernel 可见了，但还不够“真相化”
17.7 已暴露了 foundation-level API，
但还不具备 diagnosis-first 的经济真相视图。

当前仍缺：
- unified economic summary
- identity / capability / mandate / firewall / audit 的聚合报告
- rejection reasons 的结构化可见性
- operator-friendly decision explanations

### F2. `claim_reward` 已有动作语义，但还没有完整的 reward / claim contract
当前 `claim_reward` 还主要停留在 action classification 层。

仍缺：
- RewardDefinition
- EligibilityRule
- ClaimAttempt
- ClaimReceipt
- anti-duplication semantics
- claim status lifecycle

### F3. audit event 已有基础，但尚未形成经济控制面的完整诊断层
17.8 需要把：
- mandate denied
- capability missing
- firewall blocked
- human confirmation required
- reward already claimed

这些情况都变成可检索、可展示、可断言的系统事实。

---

## 三、本轮必须完成的内容

# G1. Economic Truth Report Contract

建立正式的 economic truth / diagnostics report。

### G1.1 至少新增类似结构
- `EconomicTruthReport`
- `EconomicDiagnosticsReport`
- `EconomicKernelStatusReport`

### G1.2 至少包含
- economic identities summary
- capability envelope summary
- mandate summary
- firewall activity summary
- candidate economic actions summary
- audit summary
- reward / claim summary
- warnings
- blockers
- derived facts

### G1.3 目标
输出必须是“结论 + 证据”，而不是散乱原始列表。

---

# G2. Economic Identity / Capability / Mandate Diagnostics

把 17.7 已建立的对象变成 operator-facing diagnostics。

### G2.1 Identity diagnostics 至少应回答
- 总 economic identity 数量
- active / suspended / revoked 数量
- 哪些 runtime identities 没有关联 economic identity

### G2.2 Capability diagnostics 至少应回答
- receive-only 主体数量
- claim-capable 主体数量
- mandate-spend-capable 主体数量
- explicit-transfer-capable 主体数量

### G2.3 Mandate diagnostics 至少应回答
- active / expired / revoked / exhausted mandate 数量
- 总剩余额度
- 即将过期 mandates
- 最近 mandate denial reasons

---

# G3. Candidate Economic Actions & Firewall Diagnostics

把 candidate actions 与 firewall verdict 暴露成正式真相面。

### G3.1 至少提供
- 最近候选经济动作列表
- 各动作来源分类（internal / external_text / webpage / webhook / skill_output 等）
- 最近拦截统计
- 最近拦截原因分布
- human confirmation pending 列表

### G3.2 目标
operator 必须能直接回答：
- 系统最近为什么拦截了某个经济动作
- 哪些动作只是 pending，而不是 approved
- external economic injection 是否正在被尝试

---

# G4. Reward Definition Foundation

建立 Reward / Claim 系统的最小基础结构。

### G4.1 至少新增
- `RewardDefinition`
- `EligibilityRule`
- `ClaimAttempt`
- `ClaimReceipt`

### G4.2 RewardDefinition 至少应表达
- rewardId
- kind
- amount/value
- asset / settlement kind
- eligibility requirements
- maxClaims / perIdentityLimit / perWalletLimit
- active window
- status

### G4.3 目标
把 `claim_reward` 从“动作名”推进成真正可治理的对象层。

---

# G5. Eligibility & Anti-Duplication Rules

建立奖励资格与防重复领取基础规则。

### G5.1 至少支持以下规则表达
- 某 identity 是否有资格领取
- 是否已领取过
- 是否超过 per-identity 限制
- 是否超过 per-wallet 限制
- 是否超出 active window

### G5.2 目标
让系统可以明确回答：
- 为什么能领
- 为什么不能领
- 是资格不足、窗口过期，还是重复领取

---

# G6. Claim Attempt & Receipt Lifecycle

把 claim 行为推进成正式生命周期。

### G6.1 至少区分
- claim_requested
- claim_eligible
- claim_ineligible
- claim_duplicate
- claim_approved
- claim_settled
- claim_rejected

### G6.2 目标
后续即使 settlement 方式升级，claim lifecycle 也不需要重建。

---

# G7. API / Control Surface Upgrade

本轮必须升级 economic control surface。

### G7.1 至少新增/升级以下视图
- `/api/economic/foundation` → diagnosis-first foundation summary
- `/api/economic/mandates` → richer diagnostics
- 新增 reward / claim 视图（命名可定）
- candidate actions / firewall diagnostics 视图

### G7.2 目标
让 operator 可以直接从控制面看到：
- 当前经济层有没有风险
- 当前奖励系统处于什么状态
- 当前是否有人/文本在尝试诱导经济动作

---

# G8. Verification Matrix for 17.8

### V1. economic truth report 能正确汇总 identities / capabilities / mandates / firewall / audit 状态
### V2. receive-only / mandate-spend / explicit-transfer-capable 主体数量统计正确
### V3. mandate diagnostics 能正确反映 active / expired / revoked / exhausted 状态
### V4. firewall diagnostics 能正确反映拦截来源与原因
### V5. reward definition 可被创建 / 查询 / 列出
### V6. eligibility rules 能区分 eligible / ineligible / duplicate
### V7. claim attempt 生命周期状态转换正确
### V8. duplicate claims 会被阻止并给出结构化原因
### V9. control surface 返回 diagnosis-first 输出而不是 raw dump
### V10. 17.7 经济安全不变量无回归

### 测试要求
- 必须覆盖正向与负向路径
- 必须覆盖重复领取场景
- 必须覆盖外部来源经济动作被拦截的统计可见性
- 必须覆盖 reward / claim 与 existing economic identity / capability / mandate 体系的一致性

---

## 四、建议执行顺序

### Priority 1 — 建 Economic Truth Report
先把 17.7 的内部 foundation 变成 operator-facing truth。

### Priority 2 — 建 RewardDefinition / Eligibility / ClaimAttempt / ClaimReceipt
先把 reward/claim 基础对象建起来。

### Priority 3 — 建 duplicate / eligibility / lifecycle 规则
把 claim 行为从名字变成流程。

### Priority 4 — 升级 API / control surface / diagnostics
让系统可见、可查、可解释。

---

## 五、本轮非目标

本轮明确不做：
- 不做完整 ConShell 402 / x402 negotiation
- 不做完整 payment proof / provider execution
- 不做 unrestricted payout / automatic transfer
- 不做完整 marketplace / bounty terminal product
- 不做高权限资金自动外发

本轮目标是：

> **先把 17.7 的经济基础层变成“可见的真相层”和“可治理的 reward/claim 基础层”。**

---

## 六、验收标准

Round 17.8 只有在以下条件满足时才算完成：

1. Economic Truth Report 正式成立
2. identity / capability / mandate / firewall / audit diagnostics 正式成立
3. RewardDefinition / EligibilityRule / ClaimAttempt / ClaimReceipt 正式成立
4. claim duplication / ineligibility / lifecycle 规则成立
5. operator 可以通过控制面看到 diagnosis-first 经济真相
6. 17.7 的安全不变量无回归
7. 后续 17.9 可直接建立在本轮结果上进入 ConShell 402 / payment negotiation

---

## 七、最终输出格式

完成后必须输出：

### A. Economic Truth Surface Summary
- 新增了哪些 economic diagnostics contract
- control surface 如何升级

### B. Reward / Claim Foundation Summary
- reward definition 如何定义
- eligibility / duplication / lifecycle 如何定义

### C. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### D. Risks / Deferred
- 哪些 payment negotiation / ConShell 402 work 延后到 17.9
- 哪些 deeper marketplace concerns 延后

### E. 不得伪造
- 没有 diagnosis-first 经济真相层，不能说 economic truth surface 已成立
- 没有 reward / claim 对象层，不能说 claim system 已成立
- 没有 anti-duplication 规则，不能说 reward claiming 可治理

---

## 八、一句话任务定义

> **Round 17.8 的目标是：把 17.7 已建立的 Economic Kernel Foundation 推进成 diagnosis-first 的 Economic Truth Surface，并把 `claim_reward` 从动作语义推进成正式的 Reward / Claim Foundation，为后续 ConShell 402 / payment negotiation 做好可见性与对象层准备。**
