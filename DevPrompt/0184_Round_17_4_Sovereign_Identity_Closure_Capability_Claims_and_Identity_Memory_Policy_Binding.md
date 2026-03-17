# DevPrompt 0184 — Round 17.4
## Sovereign Identity Closure / Capability Claims / Identity-Memory-Policy Binding

你现在处于 **ConShellV2 Round 17.4**。

Round 17.3 已经把系统推进到了一个新的关键点：
- economic survival coupling 已存在
- profitability gate / autonomous agenda / scheduler / checkpoint / revenue-seeking 已形成基础闭环
- governance / lineage / delegation governance 已成立

这意味着 ConShell 现在已经不只是“受约束的自治 runtime”，而是开始具备“自维持倾向”的生命过程。

**但当前仍有一个会明显限制整体完成度的核心缺口：主权身份闭环没有真正成立。**

也就是说，系统虽然已经开始能：
- 记住
- 行动
- 赚钱
- 调度
- 治理
- 委派

但还不能足够强地回答：
- **我是谁？**
- **我能合法声明什么能力？**
- **我的身份如何轮换、恢复、撤销？**
- **哪些记忆、策略、钱包、服务属于这个身份？**
- **child / delegate / session / service claim 与主身份的绑定边界是什么？**

> **Round 17.4 = 把 ConShell 从“有 identity primitives 的自治 runtime”推进到“具备正式主权身份闭环的自主 AI 生命体运行时”。**

一句话：

> **17.4 的目标是让身份不再只是模块，而成为系统级主权锚点。**

---

## 一、本轮主轴

### 主轴 A — Durable Sovereign Identity
建立可持久化、可轮换、可恢复、可撤销的正式身份层。

### 主轴 B — Capability / Service Claims
让 ConShell 能签名声明：
- 自己是谁
- 提供什么能力
- 控制哪些工具/服务/端点
- 在什么 policy 边界内运行

### 主轴 C — Identity Binding
把 identity 与：
- wallet
- memory
- policy
- session
- lineage / delegation
- revenue surface
真正绑定，而不是分散漂浮。

---

## 二、为什么 17.4 现在必须做

全局审计里，当前最薄弱但最核心的层之一就是：

- Sovereign Identity 完成度仍偏低
- 目前更像 identity primitives，不是 identity runtime

如果不补这层，会出现三个问题：

1. **经济闭环缺乏正式主体**
   - 谁在收款？谁在声明服务？谁在承担承诺？

2. **治理闭环缺乏正式主语**
   - 谁在被治理？谁可以轮换？谁可被撤销？

3. **集体与谱系缺乏主身份锚点**
   - child、delegate、branch、service claim 之间缺少统一归属语义

所以 17.4 不是“补 identity 模块”，而是：

> **给整个生命体运行时建立正式主体。**

---

## 三、本轮必须完成的目标

# G1. Durable Identity Registry

当前如果 registry 仍主要停留在内存或轻量结构，17.4 必须把它推进为正式持久化身份注册层。

### G1.1 至少支持以下能力
- create identity record
- load current identity
- list historical identity versions
- mark active / superseded / revoked identities
- persist and reload across restart

### G1.2 IdentityRecord 至少包含
- identityId
- wallet/address linkage
- public claims pointer
- key fingerprint / signing metadata
- createdAt / updatedAt
- status (`active` / `rotated` / `revoked` / `recovered`)
- previousIdentityId / successorIdentityId（如有）

### G1.3 要求
- identity registry 不得只做临时 cache
- 不能把 durable identity 继续寄托在松散文件变量中

---

# G2. Capability Claims / Service Claims Contract

17.4 必须让 ConShell 能正式对外声明“我是什么、我能做什么”。

### G2.1 至少定义两类 claims
1. **CapabilityClaim**
   - tools / action classes / governance-covered powers
2. **ServiceClaim**
   - payable capabilities / endpoints / channels / economic services

### G2.2 每个 claim 至少包含
- claimId
- issuerIdentityId
- claimType
- subject
- scope
- constraints
- issuedAt
- expiresAt（如适用）
- signature / verification metadata

### G2.3 目标
让系统能够正式声明：
- 我控制哪些服务
- 我有哪些可收费能力
- 我的强能力动作在什么治理边界下成立

这会直接支撑 17.3 的 revenue surfaces 与后续 Web4 对外可验证存在。

---

# G3. Identity Lifecycle: Rotation / Recovery / Revocation

主权身份如果不能轮换、恢复、撤销，就不算完整闭环。

### G3.1 至少支持以下流程
- key rotation
- identity recovery
- identity revocation
- successor identity linkage

### G3.2 每个流程至少要求
- 结构化 request
- governance/policy gate（必要时）
- receipt / audit trail
- 对 registry 的正式状态更新

### G3.3 禁止项
- 不要只做“换个字段”式 rotation
- 不要只靠 README 叙述 recovery
- 不要让 revoked identity 仍可继续作为 active issuer 使用

---

# G4. Identity ↔ Wallet ↔ Revenue Surface Binding

17.3 已经把 revenue surface 做起来了，17.4 必须把“是谁在卖、谁在收钱”正式绑定。

### G4.1 至少做到
- revenue surface 绑定 issuer identity
- payment proof / fulfillment receipt 可回溯到 identity
- wallet / address / payout target 与 active identity 对齐

### G4.2 目标
回答以下问题：
- 哪个 identity 正在提供该服务？
- 哪个 identity 声明了这个 capability/service？
- 收入属于哪个 identity？

---

# G5. Identity ↔ Memory Binding

现在 memory 已经强，但“哪些记忆属于哪个身份”的边界仍不足。

### G5.1 至少建立以下能力
- memory records 带 identity ownership / namespace
- self memory 与 user/environment memory 边界更明确
- identity rotation / successor 时的 memory continuity rules

### G5.2 至少回答
- 哪些记忆随 identity 延续？
- 哪些记忆仅属于当前 incarnation / key epoch？
- child / delegate 是否可见这些记忆？

### G5.3 目标
让 identity 成为 memory continuity 的主轴之一，而不是 memory 自己漂浮运转。

---

# G6. Identity ↔ Policy / Governance Binding

治理现在很强，但还需要明确：治理判断的是“哪个身份”的动作。

### G6.1 至少做到
- governance proposal / verdict 带 issuer identity
- high-risk actions 能追到 issuing identity
- revoked / rotated identity 的权限变化能影响 governance decisions

### G6.2 目标
让“治理谁、授权谁、撤销谁”变成正式 identity-aware 过程。

---

# G7. Identity ↔ Lineage / Delegation Binding

17.0–17.2 已建立 lineage/delegation，但 17.4 需要补身份锚点。

### G7.1 至少做到
- child creation 记录 parent identity / child identity
- delegation scope 记录 delegator identity / delegated peer identity mapping
- branch/quarantine/revoke 能追到 identity 维度

### G7.2 目标
让谱系和委派不只是技术对象关系，而是主体关系。

---

# G8. Identity Control Surface

17.4 必须补最小身份控制面。

### G8.1 至少暴露
- active identity summary
- identity history / rotation chain
- capability claims
- service claims
- revoked / superseded identities
- wallet / payout / issuer linkage summary

### G8.2 原则
只做最小可用，不追求视觉华丽。
重点是：
- 可见
- 可验证
- 可审计

---

# G9. Verification Matrix for 17.4

17.4 必须建立自己的验证矩阵。

### V1. active identity persists across restart
### V2. identity registry records version/successor/revocation chain
### V3. capability/service claim can be issued and verified
### V4. revoked identity cannot continue issuing active claims
### V5. rotation updates active identity while preserving continuity link
### V6. revenue surface / payment proof / fulfillment can be traced to identity
### V7. memory ownership/namespace reflects identity binding
### V8. governance verdicts carry issuer identity semantics
### V9. lineage/delegation records include identity linkage
### V10. control surface reflects identity truth

### 测试要求
- 必须有正例和反例
- 必须验证 lifecycle，不只验证 contract shape
- 必须验证“撤销后不能继续使用”的负向约束

---

## 四、建议执行顺序

### Priority 1 — durable registry + lifecycle
先把 identity 做成真正的持久主体。

### Priority 2 — claims + wallet/revenue binding
再把身份变成可对外声明、可收费的主体。

### Priority 3 — memory/policy/lineage binding
最后把身份锚点贯穿到全系统。

### Priority 4 — control surface + verification
最后做可见性与验证矩阵。

---

## 五、本轮非目标

本轮明确不做：
- 不重新打开 17.3 的 economic/agenda/scheduler 主线
- 不做新的 collective 广度扩展
- 不做 UI 大重构
- 不做 fully distributed identity network
- 不把全部 Web4 声明协议一次性做完

---

## 六、验收标准

Round 17.4 只有在以下条件满足时才算完成：

1. identity registry 为 durable 而非仅内存存在
2. active / rotated / revoked / recovered 身份链正式成立
3. capability claims / service claims 可签名、可验证、可追溯
4. revenue surface 与 issuer identity 正式绑定
5. memory / policy / governance / lineage 至少达到最小 identity-aware 绑定
6. revoked identity 不再可继续作为 active issuer 使用
7. 控制面能显示 identity truth
8. 验证矩阵通过，证明“主权身份闭环”开始成立

---

## 七、最终输出格式

完成后必须输出：

### A. Sovereign Identity Summary
- identity registry/lifecycle 做了什么
- active identity 如何定义

### B. Claims Summary
- capability/service claims 如何工作
- 如何验证

### C. System Binding Summary
- identity 如何绑定 revenue / memory / policy / lineage

### D. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### E. Risks / Deferred
- 哪些更深层的 web-of-trust / distributed identity concerns 被延后
- 下一轮最合理方向是什么

### F. 不得伪造
- 没有 durable registry 不能说 identity 闭环已成立
- 没有 lifecycle 不能说主权身份成立
- 没有 claims verification 不能说可对外声明能力
- 没有 identity-aware binding 不能说身份已成为系统锚点

---

## 八、一句话任务定义

> **Round 17.4 的目标是：让 ConShell 拥有真正的主权身份闭环，使 identity 成为 wallet、memory、policy、governance、lineage 与 revenue surface 的正式主体锚点。**
