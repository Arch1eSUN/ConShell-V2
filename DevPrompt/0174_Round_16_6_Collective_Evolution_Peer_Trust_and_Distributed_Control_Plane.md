# Round 16.6 — Collective Evolution, Peer Trust, and Distributed Control Plane

> **文件定位**：这是 Round 16.6 的正式开发提示词。  
> **前置审计结论**：Round 16.5 已通过严格本地复证：`78/78 lineage + governance-integration tests passing`，且 lineage runtime 的第一版正式闭环已成立。  
> 当前系统已具备：  
> - runtime kernel / viability / verification；  
> - economic runtime / memory / lifecycle / adaptive routing；  
> - autonomous agenda / commitments / restart continuity；  
> - sovereign identity / claims / operational self-trust；  
> - governance workflow + runtime unification；  
> - lineage runtime / child actualization / funding lease / recall / termination / lineage control surface。  
> **但当前最大的剩余缺口已经从“单体与谱系管理”转向“群体层运行时”**：系统已能创建和管理 child runtime，但还没有形成真正的 peer society、trust model、distributed control plane、collective coordination 与跨节点/跨实例的群体进化结构。  
> **本轮目标**：把当前“可管理谱系”的 lineage-aware runtime，推进为“可发现、可评估、可协作、可治理的 collective runtime”。  
> **事实纪律**：禁止把多个 child runtime 的存在包装成“collective evolution 已成立”；禁止把 lineage control surface 包装成“distributed control plane 已成立”。

---

# 0. 本轮问题定义

Round 16.5 解决的是：
- child runtime 已能被正式 actualize；
- parent/child lineage lifecycle 已有 canonical owner；
- funding / recall / terminate / orphan 语义已成立；
- 最小 lineage control surface 已出现；
- commitments 已开始触及 child delegation 语义。

但现在系统还停留在“parent 管 child”的阶段，尚未真正进入“群体层运行时”。

当前缺口包括：
1. 没有正式 peer/agent registry beyond direct lineage；
2. 没有 trust / reputation / capability verification model；
3. 没有跨 lineage / sibling / peer coordination protocol；
4. 没有 distributed control plane（跨实例/跨节点管理）最低实现；
5. 没有 collective-level agenda / delegation / discovery；
6. 没有正式 collective diagnostics / topology view。

因此，Round 16.6 的唯一正确问题定义是：

> **如何让 ConShell 从“可复制并管理子代的 lineage runtime”升级为“可发现、可评估、可协作、可治理的 collective runtime”？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Collective Evolution + Peer Trust + Distributed Control Plane**

即：
1. 建立 peer/agent registry 与 trust model；
2. 让 child/sibling/peer 不只是 lineage records，而是可被发现、评估、选择和协作的运行时主体；
3. 建立最小 distributed control plane / collective control surface；
4. 让 collective 级 delegation / discovery / diagnostics 开始成立；
5. 为 future society layer / reputation economy / multi-node orchestration 打底。

---

# 2. 本轮必须先回答的问题

## 2.1 什么是 peer？
你必须明确：
- peer 是否只包括 child runtime？
- sibling 是否视为 peer？
- external discovered agents 是否也算 peer？
- peer 与 lineage member 的边界是什么？

## 2.2 trust 的最小判断单位是什么？
你必须明确：
- trust 是基于 identity claim？
- governance receipts？
- economic performance？
- capability verification？
- uptime/health？

如果 trust 只是一个数字字段，就不算真正模型。

## 2.3 distributed control plane 的最小成立条件是什么？
你必须定义至少一组跨实例/跨 agent 的控制能力，例如：
- 列出 peers
- 查询 peer status / claims / capabilities
- 查询 peer trust summary
- 分派任务到 peer
- 撤回/停用 peer relationship

## 2.4 collective evolution 的第一步是什么？
你必须回答：
- 先做 peer registry + trust，还是先做 distributed delegation？
- 如何避免直接跳到“群体智能”口号？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Peer / Collective Contract

必须新增正式 contract，例如：
- `collective/collective-contract.ts`
- 或 `peers/peer-contract.ts`

### 至少定义：
- `PeerRecord`
- `PeerKind`（child / sibling / parent / external / discovered）
- `PeerStatus`（known / trusted / degraded / quarantined / revoked / offline）
- `TrustSummary`
- `CapabilitySummary`
- `PeerDiscoverySource`
- `CollectiveDelegationReceipt`
- `CollectiveTopology`

### PeerRecord 至少包含：
- identity summary
- lineage relation（如有）
- capability claims
- trust summary
- lastSeen / lastHealth
- source / discoveredBy

### 强要求：
- peer 不能只是 lineageRecord 的别名
- collective 不能只是 children 列表

---

## Task 2 — 新增 PeerRegistry / CollectiveService 作为 canonical owner

必须建立正式 owner，例如：
- `PeerRegistry`
- `CollectiveService`

### 最小接口建议：
- `registerPeer(record)`
- `getPeer(id)`
- `listPeers(filter?)`
- `updatePeerTrust(id, patch)`
- `markPeerOffline(id)`
- `quarantinePeer(id, reason)`
- `revokePeer(id, reason)`
- `topology()`
- `stats()`

### 验收标准：
- lineage member + discovered peer 进入统一 collective registry
- 系统有正式 owner 管理群体视图

---

## Task 3 — 建立 Peer Trust Model

这是 16.6 的核心之一。

### 本任务必须至少把 trust 分成若干可解释维度：
- identity confidence
- capability verification confidence
- governance compliance confidence
- economic reliability
- uptime/health confidence

### TrustSummary 至少输出：
- overall score or tier
- component breakdown
- reasons / evidence
- lastUpdatedAt

### 强要求：
- trust 必须可解释
- 不允许只给一个 opaque number

---

## Task 4 — 将 Child Runtime 自动注册为 Peer

当前 child runtime 已能 actualize，但还只是 lineage 语义。

### 本任务必须完成：
1. child actualization 成功后自动进入 peer registry
2. child identity/capability summary 可查询
3. child health/status 更新能反映到 peer state
4. child recall/terminate/orphan 会影响 peer status

### 目标：
把 child 从“lineage object”推进为“collective runtime member”。

---

## Task 5 — 建立最小 Peer Discovery / Registration 路径

除了 child 之外，本轮必须允许至少一种非-child peer 被注册。

### 至少实现一条路径：
#### 方案 A：manual peer registration
- 通过 API / local config / internal service 注册 external peer

#### 方案 B：EvoMap / registry-derived peer discovery
- 从现有 discovery source 导入 peer summary

推荐：**A 为必做，B 为可选加分**

### 目标：
让 collective 不只等于 family tree。

---

## Task 6 — 建立 Distributed Delegation / Peer Assignment Primitive

当前已有 child delegation contract，但 collective delegation 还没有。

### 本任务必须至少完成：
- 选择一个 peer 作为 delegation target
- 记录 collective delegation receipt
- 区分：
  - delegated to child
  - delegated to sibling/external peer
- delegation failure 会影响 peer trust / routing preference

### 最低实现：
- 不要求真正远程执行复杂任务
- 但至少要把“选择 peer + 记录派发 + 回写结果”做成正式原语

---

## Task 7 — 建立 Collective Control Surface

本轮必须让 collective runtime 有正式对外 control surface。

### 至少新增：
- `GET /api/collective/peers`
- `GET /api/collective/peers/:id`
- `GET /api/collective/topology`
- `GET /api/collective/stats`
- `POST /api/collective/peers/:id/quarantine`
- `POST /api/collective/peers/:id/revoke`

### 若做 delegation，可再加：
- `POST /api/collective/delegate`

### 目标：
让群体运行时不只是内部表结构，而是有正式可观察、可操作的最小控制面。

---

## Task 8 — 建立 Collective Diagnostics / Topology Reporting

本轮必须至少能输出：
- total peers
- peers by kind
- peers by status
- trust distribution
- active children / siblings / external peers
- degraded/quarantined peer count
- topology summary（root → lineage → peers）

### 推荐产物：
- `CollectiveDiagnostics`
- `CollectiveTopologyReport`

### 要求：
- 能解释为什么某个 peer 被 quarantine / revoked
- topology 不只是 raw list

---

## Task 9 — 新增 Collective / Trust / Delegation Tests

本轮必须新增覆盖以下测试：

### 9.1 Collective Contract Tests
- peer/trust/topology types 和状态迁移正确

### 9.2 Peer Registry Tests
- register/list/update/quarantine/revoke 正确工作

### 9.3 Child-to-Peer Integration Tests
- child actualization 后自动注册为 peer
- child state changes 更新 peer status

### 9.4 Trust Model Tests
- trust breakdown / reasons / evidence 正确
- degraded/revoked peer trust 正确变化

### 9.5 Delegation Tests
- 可选择 peer 进行 delegation
- delegation 结果会影响 peer trust / receipts

### 9.6 Control Surface Tests
- collective APIs 可用
- quarantine/revoke 有正确约束

### 9.7 Regression Tests
- 原有 1143 tests 无回归
- 原有 78 lineage/governance-integration tests 无回归

---

## Task 10 — 文档与术语统一

必须新增/更新文档，明确：
1. 什么是 peer / collective / lineage member
2. trust model 的维度和证据来源
3. child 与 peer 的关系
4. collective delegation 与 child delegation 的区别
5. distributed control plane 的最小成立面

### 禁止：
- 用“多个 agent 存在”描述成“collective runtime complete”
- 用“有 lineage + routes”描述成“distributed control plane complete”

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical collective/peer runtime owner**
2. **How peers are now registered, classified, and tracked**
3. **How trust is now computed and explained**
4. **How child runtimes now become collective members**
5. **What collective control surfaces and topology views now exist**
6. **How delegation to peers now works**
7. **What tests were actually executed**
8. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “collective evolution complete”但只有 peer registry
- “distributed control plane complete”但没有 real control surface
- “trust complete”但只有一个 score 无解释

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical collective/peer runtime owner 已明确
- [ ] child runtime 可自动注册为 peer
- [ ] 至少一种 non-child peer registration 路径已建立
- [ ] trust summary 已有可解释维度与证据
- [ ] 至少一条 collective delegation 原语已建立
- [ ] 至少一组 collective control APIs 已建立
- [ ] collective diagnostics / topology report 已可输出
- [ ] 新增 collective/trust/delegation tests 已通过
- [ ] 原有 1143 tests 无回归
- [ ] 文档中 collective / lineage / peer 术语已统一

---

# 6. 一句话结论

> **Round 16.6 的目标，不是再强化 parent-child 管理，而是让 ConShell 真正拥有“可发现、可评估、可协作、可治理”的 collective runtime——从 lineage-aware 个体系统迈向群体生命体系统。**
