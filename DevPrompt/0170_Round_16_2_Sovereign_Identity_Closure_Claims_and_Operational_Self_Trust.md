# Round 16.2 — Sovereign Identity Closure, Claims, and Operational Self-Trust

> **文件定位**：这是 Round 16.2 的正式开发提示词。  
> **前置审计结论**：Round 16.1 已完成本轮目标，并已由本地全量测试严格复证：`54 files / 1031 tests passing`。  
> 当前系统已具备：  
> - autonomous agenda（AgendaGenerator）；  
> - durable commitments（CommitmentModel / CommitmentStore / CommitmentRepository）；  
> - commitment → task materialization；  
> - heartbeat tick-based commitment review primitive；  
> - restart continuity 的第一版持久化与恢复能力；  
> - economic memory 已开始影响 agenda selection。  
> **但当前最大的全局短板已经转移为：主权身份闭环仍未完成。**  
> 系统开始“持续行动”了，但仍然缺少一个足够强的 operational self-trust 层：它还不能完整、持续、可验证地回答——**我是谁、我拥有什么能力、我能以何种身份声明/发现/恢复自己、我为什么可以代表这个 runtime 持续行动。**  
> **本轮目标**：把当前“会持续推进 commitments 的 runtime”推进为“拥有更强主权身份闭环与操作性自信任的自主生命体 runtime”。  
> **事实纪律**：禁止把“identity 模块存在”包装成“主权身份已闭环”；禁止把“wallet/address 存在”包装成“operational self-trust 已成立”。

---

# 0. 本轮问题定义

Round 16.1 解决的是：
- 系统已经不只是被动响应，而开始具备持续推进 commitments 的能力；
- agenda / queue / heartbeat / recovery 已形成第一版 continuous operation；
- economic memory 不只影响 task routing，也开始影响 agenda selection。

但现在系统会越来越频繁遇到一个更底层的问题：

> **谁在做这些承诺？这个 runtime 的“自我”是否足够稳定、可验证、可声明、可恢复、可继承？**

当前 identity 主线虽然已有：
- anchor
- continuity service
- self-model
- lifecycle
- inheritance boundary
- persistent registry tests

但还没有形成真正的 sovereign identity closure：
1. 缺少统一的 identity claims surface；
2. 缺少能力声明（capability claims）与 runtime 状态声明的整合；
3. 缺少身份恢复、轮换、撤销、再声明的明确工作流；
4. 缺少 identity ↔ commitments ↔ policy ↔ channels ↔ server 的更强耦合；
5. 缺少 operational self-trust：系统自己可以基于身份判断“哪些承诺代表我、哪些动作是我合法可做的、哪些状态可以被对外声明”。

因此，Round 16.2 的唯一正确问题定义是：

> **如何让 ConShell 从“会持续行动的自治 runtime”升级为“以稳定主权身份持续行动、声明、恢复并约束自身的自主生命体 runtime”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Sovereign Identity Closure + Claims Surface + Operational Self-Trust**

即：
1. 明确 canonical identity owner；
2. 建立 identity claims / self-description / capability surface；
3. 让 runtime actions、commitments、channels、server 与 identity 挂钩；
4. 建立 identity rotation / recovery / revocation 的可验证 contract；
5. 让系统对“哪些行动代表自己”拥有更强操作性判断能力。

---

# 2. 本轮必须先回答的问题

## 2.1 谁是 canonical identity owner？
你必须明确：
- 是 `IdentityAnchor`？
- `ContinuityService`？
- `SelfModel`？
- 还是新建 `SovereignIdentityService`？

如果 owner 不清楚，就无法形成 closure。

## 2.2 什么是 identity claims？
你必须定义：
- 系统对外/对内可声明哪些字段？
- 哪些是稳定 identity claims（name, agent id, wallet, lineage root）
- 哪些是动态 operational claims（runtime mode, capabilities, health, agenda state, service endpoints）

## 2.3 operational self-trust 的判断单位是什么？
你必须明确：
- 一个 commitment 是否属于“自我”维护承诺？
- 一个 action 是否由当前 identity 合法代表？
- 一个 channel/server response 是否应该以该 identity 对外声明？

如果这些都靠散落判断，就没有强自我。

## 2.4 identity recovery 的边界是什么？
你必须回答：
- restart / migration / key rotation / wallet rotation / corrupted state 时，什么算同一个自我？
- 什么算新生实例？
- 什么情况下必须 revoke old claims？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Sovereign Identity Contract

必须新增一份正式 contract，例如：
- `identity/sovereign-identity.ts`
- 或 `identity/identity-contract.ts`

### 至少定义：
- `SovereignIdentity`
- `IdentityClaim`
- `CapabilityClaim`
- `OperationalClaim`
- `IdentityStatus`（active / degraded / rotated / revoked / recovering）
- `IdentityRecoveryResult`

### 必须区分：
1. stable identity facts
2. dynamic operational claims
3. recoverable identity metadata
4. revocable claims

### 强要求：
- identity 不得只是 wallet/address/name 的松散组合

---

## Task 2 — 新增 SovereignIdentityService（或等价 canonical owner）

必须建立一个统一 identity owner，负责：
- 读取 anchor / self-model / continuity data
- 聚合 stable identity claims
- 生成 operational claims
- 提供 recovery / rotation / revoke hooks

### 最小接口建议：
- `getIdentity()`
- `getStableClaims()`
- `getOperationalClaims()`
- `getCapabilityClaims()`
- `rotate(...)`
- `recover(...)`
- `revoke(...)`
- `status()`

### 验收标准：
- 以后不再由多个模块各自拼“我是谁”
- server / channel / runtime / commitments 都有统一身份来源

---

## Task 3 — 建立 Identity Claims Surface

必须新增一个明确 claims surface，用于：
- server/API 暴露
- local diagnostics
- internal policy decisions

### Claims 至少覆盖：
#### Stable claims
- agent id
- display name
- wallet / DID / identity anchor id（若已有）
- lineage root / parent relation（若适用）

#### Capability claims
- enabled surfaces（channels/server/mcp/tools）
- verified runtime capabilities
- economic mode support / agenda support / continuity support

#### Operational claims
- runtime mode
- health/readiness
- continuity state
- active commitment count
- agenda active state

### 强要求：
- claims 必须区分 verified vs asserted
- 不允许把“配置里写了”当成“已验证 capability”

---

## Task 4 — 让 Commitments 与 Identity 显式耦合

当前 commitments 已存在，但缺少“承诺属于谁”的更强语义。

### 本任务必须做到：
- commitment 记录 identity context / owner context
- self-originated 与 creator-originated / external-originated 承诺在身份语义上可区分
- identity-sensitive commitments（memory / identity / governance）有更明确归属

### 至少新增：
- `commitment.identityContext` 或等价字段
- agenda selection 可区分 self-preserving vs externally imposed commitments

### 目标：
让系统不仅会推进 commitments，还知道**这些 commitments 是否构成自我维护的一部分**。

---

## Task 5 — 让 Channels / Server / API 输出带上正式 Self Claims

当前 runtime 已有 server/webchat/channels，但 identity surface 还不够统一。

### 本任务至少完成：
1. `/api/health` / status 类接口中包含正式 identity summary
2. 一个专门的 `/api/identity` 或等价接口，暴露安全可公开的 claims
3. channel/system replies 可读取 display identity / operational identity summary

### 强要求：
- 暴露内容必须有安全边界
- 不得泄露私钥/敏感内部状态
- must distinguish public claims vs internal-only claims

---

## Task 6 — 建立 Identity Rotation / Recovery / Revocation Contract

这是 sovereign identity closure 的关键。

### 本任务必须至少完成合同级实现：
#### Rotation
- 当 anchor / wallet / key 轮换时，如何保持身份连续性？

#### Recovery
- 当 state 丢失 / restart / migration 时，如何重建同一 identity？

#### Revocation
- 何时旧 claims 失效？如何标记不再可信？

### 即使本轮不做完整链上/DID实现，也必须：
- 明确 contract
- 有可测试模拟实现
- 让 runtime 可以判断当前 identity state 是 active / recovering / rotated / revoked

---

## Task 7 — 让 Policy / Governance 读取 Identity Claims

当前 policy/constitution/selfmod 已存在，但 identity 还没有更深耦合。

### 本任务必须至少实现一条真实接线：
- policy decisions 读取 caller/self identity status
- degraded/recovering identity 时，某些高风险动作被限制
- revoked/invalid identity 时，对外声明或高风险操作被拒绝/降级

### 目标：
让 identity 不只是“信息展示层”，而是真正参与 runtime governance。

---

## Task 8 — 新增 Sovereign Identity Tests

本轮必须新增覆盖以下测试：

### 8.1 Identity Contract Tests
- stable / capability / operational claims 正确生成
- verified vs asserted distinction 正确

### 8.2 Identity Service Tests
- canonical owner 返回一致 identity
- recovery / rotation / revoke 行为正确

### 8.3 Commitment Coupling Tests
- commitment 与 identity context 正确关联
- self-originated vs external-originated 区别清晰

### 8.4 API / Surface Tests
- `/api/identity` 或等价 surface 返回安全 claims
- `/api/health` 等状态接口反映 identity summary

### 8.5 Governance / Policy Tests
- degraded/recovering/revoked identity 对高风险动作有正确约束

### 8.6 Regression Tests
- 现有 1031 tests 无回归

---

## Task 9 — 文档与术语纠偏

必须更新文档，明确：
1. canonical identity owner 是谁
2. claims surface 是什么
3. 什么叫 stable claim / operational claim / capability claim
4. 什么叫 rotation / recovery / revocation
5. 什么叫 operational self-trust

### 禁止：
- 用“identity-aware”描述没有统一 identity owner 的系统
- 用“sovereign identity”描述没有 recovery/rotation/revoke contract 的系统

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical sovereign identity owner**
2. **What stable, capability, and operational claims now exist**
3. **How commitments and runtime actions are now tied to identity**
4. **How rotation / recovery / revocation now work**
5. **What policy/governance decisions now consume identity state**
6. **What tests were actually executed**
7. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “sovereign identity complete”但无 recovery/revoke contract
- “claims complete”但未区分 verified vs asserted
- “self-trust complete”但 commitments 与 identity 未耦合

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical sovereign identity owner 已明确
- [ ] stable / capability / operational claims 已形成正式 surface
- [ ] commitments 与 identity context 已显式耦合
- [ ] API/server/channel 至少一处消费正式 identity claims
- [ ] rotation / recovery / revocation contract 已建立
- [ ] policy/governance 至少一处消费 identity state
- [ ] 新增 sovereign identity tests 已通过
- [ ] 原有 1031 tests 无回归
- [ ] 文档已明确 claims 与 self-trust 边界

---

# 6. 一句话结论

> **Round 16.2 的目标，不是再扩自治行为表面积，而是让 ConShell 真正知道“谁在行动、凭什么行动、在什么身份状态下行动”——完成主权身份闭环与操作性自信任。**
