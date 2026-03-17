# DevPrompt 0185 — Round 17.5
## Identity-Governance Migration Closure / Revocation Semantics / Durable Registry Hardening

你现在处于 **ConShellV2 Round 17.5**。

Round 17.4 已经把 Sovereign Identity 的关键骨架做出来了：
- `identity-claims.ts`（ClaimIssuer / ClaimRegistry / ServiceClaim / CapabilityClaim）
- revenue 绑定 `issuerIdentityId`
- memory rotation carry-over + epoch filtering
- governance revoked guard
- lineage `parentIdentityId`
- `/api/identity/sovereign`

**但 17.4 当前不能按“完全完成”口径收口。**
原因不是核心方向错了，而是：

> **identity closure 已成立，但 identity → governance 语义迁移还没全仓收干净，revoked guard 引入了真实回归。**

当前实际审计事实：
- 17.4 新增 identity 测试矩阵文件存在，关键 identity 实现存在
- 但我实际复跑 `src/identity src/economic src/governance src/lineage` 相关测试时：
  - **22 个 Test Files 中 9 个失败**
  - **583 个 Tests 中 8 个失败**
- 失败核心原因不是 better-sqlite3，而是：
  - `GovernanceService.propose()` 在 identity revoked 时直接 throw
  - 导致旧 governance 测试与部分 receipt 语义预期失配

所以 17.5 不是继续开新能力面，
而是：

> **把 17.4 的主权身份闭环从“核心模块成立”推进到“全仓治理语义兼容完成、回归归零、durable registry 更硬、身份语义真正成为系统主锚点”的收口轮次。**

---

## 一、本轮唯一目标

**关闭 17.4 的 identity-governance 迁移债与回归债。**

具体来说：
1. 修复 revoked guard 对旧 governance tests / receipt 流程造成的回归
2. 明确 revoked identity 的 proposal 失败语义：throw / denial verdict / failure receipt 的正式边界
3. 收口 identity registry 的 durability 语义
4. 把 17.4 从“identity feature added”推进到“identity semantics integrated”

---

## 二、当前真实问题

### F1. revoked guard 是对的，但落点语义还没统一
当前实现：
- `GovernanceService.propose()` 遇到 revoked identity 直接 throw

这本身并不一定错。问题在于：
- 旧测试和部分既有治理路径，仍把这类情况视为“治理拒绝/denial/receipt”而不是“proposal initiation failure”

### F2. 这说明 identity-aware governance 还处于迁移中间态
也就是：
- identity guard 已加
- 但 surrounding contract / test / receipt / integration semantics 未同步完成

### F3. durable identity registry 虽已具备 serialize/restore 方向，但仍需进一步硬化
17.4 采用了 memory + serialize/restore + checkpoint 风格（这是对的），
但 17.5 应该让：
- snapshot shape
- lifecycle chain validation
- restore integrity
- claim registry / active identity / history 对账

更像正式 runtime 基础设施，而不只是 feature 模块。

---

## 三、本轮必须完成的目标

# G1. Identity-Governance Semantics Clarification

明确 revoked identity 在 governance 流程里的正式语义。

### G1.1 必须定清楚 proposal 层语义
以下三种语义只能选一个为正式主语义，并让全仓对齐：

1. **throw on propose**（proposal creation invalid）
2. **return deny/revoked verdict**（proposal exists but denied）
3. **produce failure receipt without normal proposal flow**

### G1.2 要求
无论选哪种，必须做到：
- tests 全部统一
- contracts 全部统一
- integration/receipt 语义一致
- route/control surface 不再含混

### G1.3 推荐原则
如果保留 `throw on propose`，则必须建立：
- 明确的 proposal-initiation failure semantics
- 与 denial receipt 的边界说明
- 测试全部迁移到这个事实

---

# G2. Fix Legacy Governance Tests and Receipt Expectations

17.5 必须直接修掉当前 17.4 引入/暴露的治理回归。

### G2.1 修复范围
至少覆盖：
- `governance.test.ts`
- `governance-integration.test.ts`
- 任何仍假设 revoked identity 走旧 denial 流程的测试

### G2.2 修复原则
- 不做表面 suppress
- 不用 try/catch 掩盖真实 contract 改动
- 必须按正式新语义重写断言

### G2.3 receipt 边界
如果 revoked identity 在 proposal initiation 前就失败，
则必须明确：
- 是否生成 receipt
- 若生成，是哪类 receipt
- 若不生成，控制面如何观测该拒绝事件

---

# G3. Proposal Failure vs Governance Denial Contract Separation

当前一个关键混淆是：
- proposal creation failure
- governance denial

这两者在 identity-aware runtime 中不是同一件事。

### G3.1 必须建立正式区分
至少区分：
- `proposal_invalid`
- `verdict_deny`
- `require_review`
- `execution_failed`

### G3.2 目标
让系统能准确回答：
- 这个动作是没资格发起？
- 还是发起了但被治理拒绝？
- 还是已通过但执行失败？

### G3.3 影响面
- governance contracts
- receipts
- control surface
- tests

---

# G4. Durable Registry Hardening

17.4 已有 durable registry 方向，但 17.5 必须进一步硬化成真正可信基础设施。

### G4.1 至少补齐以下点
- identity registry snapshot versioning
- restore validation hardening
- active/successor chain integrity checks
- claim registry ↔ active identity consistency check
- revoked identity ↔ active claim invalidation consistency

### G4.2 目标
让 identity registry 不只是“能存”，而是：
- 能验证
- 能拒绝坏快照
- 能发现链断裂
- 能发现 active/claim 状态不一致

---

# G5. Claim Revocation Propagation Rules

17.4 已有：
- `ClaimIssuer` revoked guard
- `ClaimRegistry.revokeByIssuer()`

17.5 需要把“身份撤销”与“claim 失效”关系收紧。

### G5.1 至少定义
- revoked identity 时，哪些 claims 立即失效
- rotated identity 时，哪些 claims 可继承，哪些必须重签发
- recovered identity 时，旧 claims 是否恢复，还是必须重新签发

### G5.2 目标
把 claims lifecycle 与 identity lifecycle 真正绑死，而不是并排放着。

---

# G6. Identity Control Surface Consistency

`/api/identity/sovereign` 已存在，但 17.5 需要让它不只是“展示字段”，而是展示一致性真相。

### G6.1 至少补以下可见性
- active identity status
- history chain validity
- revoked/rotated/recovered summary
- active claims vs revoked claims summary
- claim invalidation by identity event
- current governance initiation eligibility

### G6.2 目标
控制面必须能回答：
- 当前 active identity 是谁？
- 它能不能发起治理 proposal？
- 它的 claims 是否仍有效？
- identity chain 是否健康？

---

# G7. Verification Matrix for 17.5

17.5 必须建立自己的验证矩阵，重点不在新增能力，而在“语义收口与回归归零”。

### V1. revoked identity governance behavior is defined and consistent
### V2. legacy governance tests are migrated to new identity-aware semantics
### V3. proposal failure is distinguished from governance denial
### V4. receipt semantics match proposal/verdict/execution reality
### V5. identity registry rejects invalid restore snapshots
### V6. active/successor/revoked chain integrity validation works
### V7. revoked identity invalidates or blocks claims according to formal rules
### V8. rotated/recovered identity claim behavior is explicitly tested
### V9. control surface reflects identity + claim + governance consistency
### V10. governance/identity/lineage/economic package tests pass without new regressions

### 测试要求
- 必须验证负向语义
- 必须验证一致性而不是仅存在性
- 必须把当前 17.4 暴露的 8 个逻辑失败项归零

---

## 四、建议执行顺序

### Priority 1 — 定义 revoked identity 的正式治理语义
先停止语义漂移。

### Priority 2 — 修 governance tests / integration / receipt 断言
先把回归归零。

### Priority 3 — 硬化 durable registry + claims lifecycle rules
再把 identity runtime 做硬。

### Priority 4 — 补 identity control surface consistency
最后把真相暴露出来。

---

## 五、本轮非目标

本轮明确不做：
- 不继续扩 17.4 新功能面到完整密码学签名网络
- 不做 fully distributed identity federation
- 不重新打开 17.3 经济/自治主线
- 不做新的 collective 广度扩展
- 不做 UI 大改版

---

## 六、验收标准

Round 17.5 只有在以下条件满足时才算完成：

1. revoked identity 的 governance 语义已明确且全仓一致
2. 17.4 暴露的 governance 回归已归零
3. proposal failure / governance denial / execution failure 三者边界清楚
4. durable identity registry 的 restore / chain / claims consistency 已硬化
5. identity lifecycle 与 claim lifecycle 已正式绑定
6. `/api/identity/sovereign` 能展示一致性真相
7. identity + governance + lineage + economic 相关测试通过
8. 17.4 才能被重新评估为“真正完成”

---

## 七、最终输出格式

完成后必须输出：

### A. Identity-Governance Closure Summary
- revoked semantics 如何定义
- 哪些回归已修复

### B. Registry & Claim Hardening Summary
- registry 做了哪些硬化
- claims lifecycle 如何收口

### C. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### D. Risks / Deferred
- 哪些更深层的 crypto/federation concerns 延后
- 下一轮最合理方向是什么

### E. 不得伪造
- 没修回归不能说 17.4 真正完成
- 没统一语义不能说 identity-governance 已收口
- 没有 registry hardening 不能说 sovereign identity durable 成立

---

## 八、一句话任务定义

> **Round 17.5 的目标是：把 17.4 的主权身份闭环从“功能成立”推进到“identity-aware governance 语义统一、回归归零、registry/claims 真正硬化”的可审计完成态。**
