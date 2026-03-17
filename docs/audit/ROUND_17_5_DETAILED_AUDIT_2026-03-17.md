# Round 17.5 Detailed Audit — 2026-03-17

## 1. 审计结论

**结论：Round 17.5 可以按“已完成且闭环成立”验收。**

但需要严格区分两个层面：

1. **已完成的部分**：identity → governance 语义迁移闭环、claims 生命周期绑定、registry restore hardening、关键回归归零。
2. **仍未完成的部分**：17.5 在 DevPrompt 中承诺的 **identity control surface consistency** 只完成了基础暴露，**尚未 fully productize 成正式一致性诊断面**。

因此准确表述应为：

> **17.5 的核心工程目标已完成，关键回归已归零；但围绕 identity truth surface / explainability / operator diagnostics 的最后一层暴露仍不够强，这应成为 17.6 主线。**

---

## 2. 审计依据

本审计基于以下证据源：

### 2.1 代码取证
已直接检查：
- `packages/core/src/governance/governance-service.ts`
- `packages/core/src/governance/governance-contract.ts`
- `packages/core/src/identity/sovereign-identity.ts`
- `packages/core/src/identity/identity-lifecycle.ts`
- `packages/core/src/__tests__/identity-17-5.test.ts`
- `packages/core/src/governance/governance.test.ts`
- `packages/core/src/governance/governance-integration.test.ts`
- `packages/core/src/api/routes.ts`
- `packages/core/src/identity/index.ts`

### 2.2 实际测试验证
已独立复跑以下关键测试入口（在 **正确路径 `packages/core`** 下执行）：

```bash
pnpm exec vitest run \
  src/__tests__/identity-17-5.test.ts \
  src/governance/governance.test.ts \
  src/governance/governance-integration.test.ts \
  --reporter=dot
```

结果：
- **Test Files: 3 passed**
- **Tests: 96 passed**
- 用时约 **224ms**

### 2.3 需要明确的事实约束
先前从仓库 root 运行 `vitest` 会得到 `No test files found`，这**不是项目失败**，而是仓库根 `vitest.config.ts` 明确禁止 root 级运行，正确入口是 `packages/core`。这一点已确认，属于验证入口约束，不属于 17.5 缺陷。

### 2.4 用户提供的上层验证结果
用户提供的全量结果为：
- **V1-V10: 17/17 ✅**
- **Governance: 152/152 ✅**
- **全量: 1219 passed, 2 failed**
- 2 个失败为 **pre-existing better-sqlite3**，与 17.5 无关
- **新回归: 0**

该组结果本次未由我独立全量复跑，因此下文会标注为 **用户报告结果**，不伪装为我本人全量执行结论。

---

## 3. Round 17.5 目标对账

对照 `DevPrompt/0185_Round_17_5_Identity_Governance_Migration_Closure_Revocation_Semantics_and_Durable_Registry_Hardening.md`：

### G1. Identity-Governance Semantics Clarification
**结论：完成。**

证据：
- `packages/core/src/governance/governance-service.ts`
- `packages/core/src/governance/governance-contract.ts`

已落地事实：
- revoked identity 不再在 `propose()` 阶段直接 throw
- 而是创建 **`proposal_invalid`** 状态 proposal
- 同时记录：
  - `denialLayer = 'identity'`
  - `denialReason = 'Identity is revoked — proposal initiation rejected'`
- 并生成 **initiation / failure receipt**

这说明系统正式把 revoked identity 归类为：

> **可审计的 proposal initiation invalidation，而不是异常控制流。**

这是 17.5 的最关键收口点，也是 17.4 的真实回归源头修复点。

---

### G2. Fix Legacy Governance Tests and Receipt Expectations
**结论：完成。**

证据：
- `packages/core/src/governance/governance.test.ts`
- `packages/core/src/governance/governance-integration.test.ts`
- `packages/core/src/governance/governance-17-0.test.ts`
- `packages/core/src/governance/governance-17-1.test.ts`
- `packages/core/src/__tests__/identity-17-5.test.ts`

已验证事实：
- 旧测试已经从 “revoked → throw / deny 流程” 迁移为：
  - revoked at initiation → `proposal_invalid`
  - `proposal_invalid` 是 terminal
  - 生成 initiation failure receipt
- 关键统计语义也已更新：
  - `proposal_invalid` **单独计数**
  - **不并入 denial rate**

这说明 17.5 不是表面 suppress 失败，而是正式迁移了 surrounding contract。

---

### G3. Proposal Failure vs Governance Denial Contract Separation
**结论：完成。**

证据：
- `packages/core/src/governance/governance-contract.ts`
- `packages/core/src/governance/governance-verdict.ts`
- `packages/core/src/__tests__/identity-17-5.test.ts`

已成立边界：
- `proposal_invalid`：没有资格进入正常提案评估流
- `deny`：进入治理评估后被拒绝
- `failed` / execution failure：执行期失败

这是一个非常重要的建模改进，因为它避免了：
- 把 initiation invalidity 假装成 governance denial
- 把业务语义错误继续放进异常控制流

---

### G4. Durable Registry Hardening
**结论：基本完成。**

证据：
- `packages/core/src/identity/identity-lifecycle.ts`
- `packages/core/src/__tests__/identity-17-5.test.ts`

`restoreRecordsHardened(snapshot)` 已具备三层硬化：

#### Layer 1 — 格式校验
- snapshot 必须是 object
- version 必须为 `1`
- `records` 必须为 array
- record 必须具备必要字段：
  - `id`
  - `version`
  - `status`
  - `anchorId`
  - `name`
  - `soulHash`
  - `createdAt`
- status 只能是：
  - `active`
  - `rotated`
  - `revoked`
  - `recovered`

#### Layer 2 — 链完整性
- version 必须严格递增
- `previousRecordId` 必须与前一个 record 对齐

#### Layer 3 — 状态一致性
- active record 数量不得超过 1

评价：
- 对于当前阶段，这已经足够称为 **durable restore hardening**
- 但它仍然是 **restore-time validator**，不是更高阶的持续完整性子系统

所以最准确说法是：

> **17.5 已把 registry 从“能存能读”推进到“可拒绝坏快照、可发现链断裂、可发现 active 状态冲突”的硬化阶段。**

---

### G5. Claim Revocation Propagation Rules
**结论：完成。**

证据：
- `packages/core/src/identity/sovereign-identity.ts`
- `packages/core/src/identity/identity-claims.ts`
- `packages/core/src/__tests__/identity-17-5.test.ts`

已落地规则：

#### revoke
- `SovereignIdentityService.revoke()` 调用后
- 若绑定 `ClaimRegistry`
- 会执行 `revokeByIssuer(current.id)`
- 即：**该 identity 发出的 claims 全部立即失效**

#### rotate
- capability claims 会被 `reassignIssuer(oldId, newId, 'capability')`
- service claims 不继承，而是被 revoke

即：
- **capability 可继承**
- **service 必须重签发**

#### recover
从实现与现有设计取向看：
- recover 不会自动恢复旧 claims
- 这与 17.5 的审计推荐一致，即：
  - recovery 恢复身份链连续性
  - **不恢复旧 claim 活性**

这使 identity lifecycle 与 claims lifecycle 的绑定不再是松散并列，而是有正式传播语义。

---

### G6. Identity Control Surface Consistency
**结论：部分完成。**

证据：
- `packages/core/src/api/routes.ts`
- `/api/identity/sovereign`

当前控制面已暴露：
- `status`
- `fingerprint`
- `activeRecord`
- `history`
- `claims.active`
- `claims.capabilities`
- `claims.services`
- `snapshot`

这说明 17.5 已经把 identity surface 接出来了。

但它**还没有真正达到 0185 中写的 consistency truth surface 水平**。当前仍缺：
- history chain validity verdict
- restore integrity / snapshot validity summary
- governance initiation eligibility（当前是否可发 proposal）
- active claims vs revoked claims summary 的正式统计而非原始列表
- claim invalidation by identity event 的结构化解释
- identity inconsistency / anomaly reasons

因此这里必须诚实给出结论：

> **17.5 的 control surface 是“基础暴露已成立”，不是“系统真相诊断面已完成”。**

这也是 17.6 最合理的切入点。

---

### G7. Verification Matrix for 17.5
**结论：核心矩阵成立。**

基于代码与已复跑测试，以下判断成立：

| 项 | 结论 | 依据 |
|---|---|---|
| V1 revoked identity governance behavior | 通过 | `identity-17-5.test.ts`, `governance.test.ts` |
| V2 legacy governance tests migrated | 通过 | `governance.test.ts`, `governance-integration.test.ts` |
| V3 proposal failure vs denial distinction | 通过 | `governance-contract.ts`, `governance-verdict.ts`, tests |
| V4 receipt semantics | 通过 | `governance-service.ts`, `identity-17-5.test.ts` |
| V5 restore invalid snapshot rejection | 通过 | `identity-lifecycle.ts`, tests |
| V6 chain integrity validation | 通过 | `restoreRecordsHardened`, tests |
| V7 revoke invalidates claims | 通过 | `sovereign-identity.ts`, tests |
| V8 rotate/recover claim behavior | 通过 | `sovereign-identity.ts`, tests |
| V9 control surface reflects consistency | 部分通过 | 仅基础字段暴露，未完成高阶一致性诊断 |
| V10 package tests pass without new regressions | 按用户报告通过 | 用户报告：新回归 0；我本人未全量复跑 |

---

## 4. 关键实现评价

## 4.1 做对了什么

### A. 选对了 revoked 语义模型
17.5 选择 `proposal_invalid` 而不是 throw / auto-deny，是正确的。

原因：
- throw 是异常控制流，不适合作为稳定治理语义
- deny 会误导为“已进入审议后被拒绝”
- `proposal_invalid` 最符合“发起资格不成立”的本质

### B. 选对了 receipt 边界
`initiation failure receipt` 让系统可观测、可审计、可断言。

这比“什么都不返回”更适合作为长期 runtime contract。

### C. claims 生命周期收得足够硬
`revoke → 全部失效`
`rotate → capability 继承 + service 失效`
`recover → 不自动复活旧 claims`

这套规则简单、可解释、可验证，且避免恢复路径造成历史 claim 污染。

### D. registry hardening 足够克制
17.5 没有急着造新 `IntegrityChecker` 子系统，而是先把 restore validator 做硬。

这是正确的增量演进方式。

---

## 4.2 仍然存在的真实缺口

### Gap 1 — 17.5 的真相没有被完整暴露给操作者
控制面目前还是偏“原始数据输出”，而不是“诊断结论输出”。

系统还不能直接回答：
- identity chain 是否健康？
- 为什么当前 identity 不可发起 governance？
- claims 与 identity 状态是否一致？
- 当前 snapshot 若恢复会不会失败？

### Gap 2 — consistency checking 仍偏 restore-time，而非 runtime explainability
当前完整性检查主要在 `restoreRecordsHardened()` 里。

这说明：
- 验证能力存在
- 但不够“随手可用 / 面向运维 / 面向控制面”

### Gap 3 — 测试入口约束容易误导使用者
root `vitest.config.ts` 的 guard 是对的，
但如果没有统一验证脚本或明确文档，使用者仍容易误判“项目测试挂了”。

这不是核心产品能力缺陷，但属于 **verification ergonomics debt**。

---

## 5. 最合理的 17.6 方向

基于审计，**17.6 不应该回到广度扩展**，也不应该直接跳去新领域。

最合理的下一轮是：

> **把 17.5 已经成立的 identity / governance / claims / registry 语义，升级成真正可观察、可解释、可诊断、可作为 operator truth source 的控制面与诊断契约。**

也就是从：
- internal semantics closure

推进到：
- externalized truth surface
- operator diagnostics
- runtime consistency explanation
- canonical verification entrypoint

---

## 6. 审计结论摘要（可直接对外引用）

### 结论一句话版
**17.5 已完成。**
它真实修复了 17.4 暴露的 identity-aware governance 回归，把 revoked identity 从异常控制流改成了 `proposal_invalid + initiation failure receipt` 的正式语义，并把 claims lifecycle 与 durable registry hardening 收口到了可验收水平。

### 但必须保留的诚实限定
**17.5 尚未把这些真相完整升级为 operator-facing consistency diagnostics surface。**
所以 17.6 应聚焦：
- truth surface
- explainability
- diagnostics
- verification ergonomics

而不是盲目扩新能力面。

---

## 7. 最终判定

### Round 17.5 验收判定
**YES — can be accepted as completed.**

### 判定理由
- 17.4 的 8 个真实回归根因已被正确修复
- 核心 contract 已统一
- 关键测试入口已独立复跑通过
- registry / claims / governance 语义已形成闭环
- 未发现新的 17.5 级逻辑回归证据

### 下轮建议
**Round 17.6 应聚焦：Identity Truth Surface / Governance Eligibility Explainability / Registry-Claims Consistency Diagnostics / Canonical Verification Entrypoint。**
