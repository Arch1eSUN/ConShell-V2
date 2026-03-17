# DevPrompt 0186 — Round 17.6
## Identity Truth Surface / Consistency Diagnostics / Canonical Verification Closure

你现在处于 **ConShellV2 Round 17.6**。

Round 17.5 已经完成了关键内部闭环：
- revoked identity 不再在 governance proposal initiation 阶段直接 throw
- 正式语义已收口为 `proposal_invalid`
- initiation failure receipt 已成立
- claims lifecycle 已与 identity lifecycle 绑定
- durable registry restore hardening 已具备三层校验
- 17.4 暴露的 identity-aware governance 回归已归零

**但 17.5 还有一个明确剩余缺口：**

> **系统内部真相已经成立，但还没有被完整暴露成 operator-facing 的 truth surface / diagnostics surface / canonical verification surface。**

当前 `/api/identity/sovereign` 只提供：
- status
- fingerprint
- activeRecord
- history
- claims raw lists
- snapshot

这还不够。

它能展示“字段”，但还不能稳定回答：
- 当前 identity chain 是否健康？
- 当前 active identity 是否具备 governance initiation eligibility？
- claims 与 identity 状态是否一致？
- 当前 snapshot 如果 restore，会不会失败？为什么？
- rotate / revoke / recover 后，claims propagation 是否符合正式规则？
- proposal_invalid / deny / failed 在当前系统里各自发生了多少？为什么？

所以 Round 17.6 的目标不是继续扩张新功能面，
而是：

> **把 17.5 已经成立的 identity / governance / claims / registry 真相，推进成可观测、可解释、可诊断、可审计、可验证的正式控制面与验证入口。**

---

## 一、本轮唯一主目标

**建立 Identity Truth Surface 与 Canonical Consistency Diagnostics。**

也就是让系统不只是“内部做对了”，
而是能对外稳定说明：
- 当前状态是什么
- 为什么是这样
- 有无不一致
- 不一致在哪里
- 哪些动作当前可做 / 不可做
- 为什么不可做

---

## 二、当前真实缺口

### F1. `/api/identity/sovereign` 仍是字段暴露，不是结论暴露
当前输出更像原始信息 dump，而不是一致性诊断结果。

缺少：
- chain validity verdict
- active identity health summary
- governance initiation eligibility
- claims consistency verdict
- restore validity summary
- anomaly / warning / blocking reasons

### F2. registry integrity 能在 restore 时校验，但没有形成常驻 explainability surface
当前 `restoreRecordsHardened()` 的校验很有价值，
但它主要存在于恢复路径里。

问题不是“没校验”，而是：
- 没有统一的 diagnostics contract
- 没有稳定给 operator / API 暴露结论
- 没有把 errors / warnings / blockers 系统化输出

### F3. governance 已经有 `proposal_invalid` / `deny` / `failed` 语义分层，但控制面仍缺少 explainability 聚合
17.6 应该让系统能清晰回答：
- proposal_invalid 是多少
- deny 是多少
- escalated 是多少
- failure 是多少
- 这些量各自来自哪个层（identity / policy / economy / risk）

### F4. claims lifecycle 已收口，但尚未形成 operator-facing propagation summary
例如当前应直接能看到：
- revoke 导致多少 claims 失效
- rotate 迁移了多少 capability claims
- rotate 失效了多少 service claims
- recover 是否保留/恢复任何旧 claims（应明确没有）

### F5. canonical verification ergonomics 仍不够强
当前仓库 root `vitest.config.ts` 故意禁止 root 级直接跑测试，这是对的。
但 17.6 应该把“正确验证入口”收口成正式契约，避免误判与验证漂移。

---

## 三、本轮必须完成的内容

# G1. Identity Truth Report Contract

建立一个正式的 identity truth report contract。

### G1.1 新增正式输出结构
建议新增类似：
- `IdentityTruthReport`
- `IdentityConsistencyReport`
- 或等价命名

至少包含：
- `currentStatus`
- `activeRecord`
- `chainValidity`
- `governanceEligibility`
- `claimConsistency`
- `restoreReadiness`
- `warnings`
- `errors`
- `derivedFacts`

### G1.2 输出必须是“结论 + 证据”，不是只给原始字段
例如不要只返回 history 列表，
而要能回答：
- history chain valid / invalid
- invalid 的具体原因
- active record count 是否异常
- previous/successor link 是否断裂

---

# G2. Governance Initiation Eligibility Explainability

把当前 identity 是否可发起 proposal 的判断显式化。

### G2.1 至少明确以下状态
- eligible
- ineligible_due_to_revoked_identity
- restricted_due_to_degraded_identity_for_high_risk_actions
- inconsistent_identity_state

### G2.2 不要只返回 boolean
必须带：
- `eligible: boolean`
- `reasonCode`
- `reasonSummary`
- `blockingLayer`
- `supportedActionKinds` / `blockedActionKinds`（若可行）

### G2.3 目标
控制面必须能直接说明：
- 当前为什么不能发 proposal
- 是全部不能发，还是高风险动作不能发
- 是 identity 原因、registry 原因、claims 原因，还是状态不一致原因

---

# G3. Claims Lifecycle Diagnostics Surface

把 claims lifecycle propagation 结果变成可审计可见事实。

### G3.1 至少输出以下聚合信息
- active claim count
- revoked claim count
- claims by type
- claims by issuer
- claims invalidated by revoke event
- claims migrated by rotate event
- service claims revoked on rotate
- recover 后旧 claims 不恢复的事实说明

### G3.2 目标
让系统可以回答：
- 当前 claims 为什么有效 / 无效
- 是被 revoke 失效，还是 rotate 迁移，还是从未重签发

---

# G4. Registry Restore Readiness & Consistency Diagnostics

把 `restoreRecordsHardened()` 的能力升级成正式诊断面。

### G4.1 至少提供
- `restoreReadiness: ready | degraded | invalid`
- `integrityErrors[]`
- `integrityWarnings[]`
- `activeRecordCount`
- `chainLength`
- `lastVersion`
- `chainBreakDetected`

### G4.2 必须避免的错误
- 不要只在 restore() 调用时才发现坏状态
- 不要把 integrity error 留在底层函数里，不向上层传播
- 不要仅返回 `valid: false` 而不给结构化原因分类

---

# G5. `/api/identity/sovereign` 升级为真正的 truth surface

本轮必须升级该 API，使其成为正式 operator surface。

### G5.1 至少新增以下视图层字段
- `truthReport`
- `consistency`
- `governanceEligibility`
- `claimsSummary`
- `restoreDiagnostics`
- `chainSummary`

### G5.2 原始字段仍可保留，但必须降级为 supporting evidence
也就是：
- history / claims / snapshot 可以保留
- 但主输出应是归纳后的诊断结果

### G5.3 目标
让 `/api/identity/sovereign` 可以直接作为：
- dashboard source of truth
- audit source
- runtime health source
- operator debugging surface

---

# G6. Governance Diagnostics Enrichment

既然 17.5 已经区分 `proposal_invalid` / `deny` / `failed`，
17.6 必须把这层语义在 diagnostics 中显式化。

### G6.1 至少补齐以下聚合
- proposals by status
- proposals by denial layer
- initiation invalid count
- execution failure count
- evaluated denial count
- escalation count

### G6.2 目标
系统必须能回答：
- “最近治理失败”到底是 proposal invalid、policy deny、还是 execution failure
- 不能再把这些情况混成一个 failure bucket

---

# G7. Canonical Verification Entrypoint

17.6 必须明确正式验证入口，避免错误在“测试命令姿势”层面制造假问题。

### G7.1 至少满足以下之一
1. 提供正式脚本（推荐）
   - 如 `pnpm test:core` / `pnpm verify:identity-governance`
2. 或提供明确的 verification doc + runner
3. 或两者都做

### G7.2 目标
让任何人都清楚：
- 从哪里跑是正确的
- 哪些测试是 canonical identity/governance verification set
- 如何避免 root vitest guard 误报

---

# G8. Verification Matrix for 17.6

### V1. identity truth report accurately reflects healthy chain
### V2. broken chain produces structured diagnostics
### V3. multiple active records produce explicit inconsistency report
### V4. revoked identity shows ineligible governance initiation with structured reason
### V5. degraded identity shows risk-sensitive governance eligibility explanation
### V6. claims summary reflects revoke / rotate / recover propagation truth
### V7. restore diagnostics surface matches `restoreRecordsHardened()` reality
### V8. `/api/identity/sovereign` returns diagnosis-first structure, not raw dump only
### V9. governance diagnostics separate proposal_invalid / deny / failed / escalated
### V10. canonical verification entrypoint works and documents the correct test surface

### 测试要求
- 必须覆盖正向与负向路径
- 必须验证 explainability 结果，而不是只验证字段存在
- 必须验证 API 输出中的 derived facts 与底层 contract 一致
- 不允许只测 raw lists，不测 summary correctness

---

## 四、建议执行顺序

### Priority 1 — 建立 identity truth/consistency report contract
先定义系统要如何说真话。

### Priority 2 — 升级 `/api/identity/sovereign`
让 truth report 真正可见。

### Priority 3 — 补 claims / governance diagnostics 聚合
让 operator 可以看懂为什么出问题。

### Priority 4 — 收口 canonical verification entrypoint
减少验证误报与流程歧义。

---

## 五、本轮非目标

本轮明确不做：
- 不重开 17.5 已完成的 revoked semantics 重构
- 不进入新一轮 distributed identity federation
- 不做密码学签名网络扩张
- 不重开 collective / revenue / replication 新主线
- 不做大范围 UI 美化
- 不引入巨大新子系统取代当前 identity runtime

---

## 六、验收标准

Round 17.6 只有在以下条件满足时才算完成：

1. 系统有正式的 identity truth / consistency report contract
2. `/api/identity/sovereign` 已升级为 diagnosis-first truth surface
3. governance initiation eligibility 已可结构化解释
4. claims lifecycle propagation 已具备可见 summary 与原因说明
5. registry restore readiness / integrity diagnostics 已正式暴露
6. governance diagnostics 能区分 proposal_invalid / deny / failed / escalated
7. canonical verification entrypoint 已明确且可执行
8. 相关测试覆盖 explainability correctness，而非仅字段存在

---

## 七、最终输出格式

完成后必须输出：

### A. Truth Surface Summary
- 新增了哪些 truth / consistency report contract
- `/api/identity/sovereign` 如何升级

### B. Governance & Claims Diagnostics Summary
- eligibility explainability 如何定义
- claims lifecycle summary 如何定义
- governance status aggregation 如何定义

### C. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / 是否通过

### D. Risks / Deferred
- 哪些更深层的 distributed / crypto / UI work 延后
- 若继续推进，17.7 最合理的方向是什么

### E. 不得伪造
- 没有 diagnosis-first surface 不能说 truth surface 已成立
- 没有 explainability contract 不能说 operator diagnostics 已完成
- 没有 canonical verification entrypoint 不能说 verification closure 已成立

---

## 八、一句话任务定义

> **Round 17.6 的目标是：把 17.5 已经成立的 identity / governance / claims / registry 内部真相，升级成可解释、可诊断、可审计、可验证的正式 truth surface 与 canonical verification surface。**
