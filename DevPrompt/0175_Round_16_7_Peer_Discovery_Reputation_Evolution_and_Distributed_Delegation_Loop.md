# Round 16.7 — Peer Discovery, Reputation Evolution, and Distributed Delegation Loop

> **文件定位**：这是 Round 16.7 的正式开发提示词。  
> **前置审计结论**：Round 16.6 已完成 collective runtime foundation，并通过专项本地复证：`60/60 collective tests passing`。  
> 当前系统已具备：  
> - runtime kernel / viability / verification；  
> - economic runtime / memory / lifecycle / adaptive routing；  
> - autonomous agenda / commitments / restart continuity；  
> - sovereign identity / claims / operational self-trust；  
> - governance runtime unification；  
> - lineage runtime / child actualization / funding lease / recall / termination；  
> - collective peer runtime foundation（peer registry / trust model / topology / control surface / delegation primitive）。  
> **但当前 collective 仍主要是“静态群体基础设施”**：peer 大多来自 lineage 或手工注册，trust 主要是结构化评分，delegation 也仍偏 local primitive，尚未形成真正的 peer discovery、持续 reputation 演化、以及分布式 delegation feedback loop。  
> **本轮目标**：把当前“有群体基础设施的 runtime”推进为“能持续发现 peers、逐步形成 reputation、并通过 delegation 结果驱动 collective behavior 进化”的系统。  
> **事实纪律**：禁止把 peer registry + trust score 包装成“peer society 已成立”；禁止把 delegation primitive 包装成“distributed execution loop 已闭环”。

---

# 0. 本轮问题定义

Round 16.6 解决的是：
- peer/collective contract 已正式建立；
- child runtime 可自动桥接为 peer；
- 5 维 explainable trust model 已有实现；
- collective control surface / topology / diagnostics 已出现；
- delegation primitive 已具备基础语义。

但 collective 目前仍有三个决定性缺口：

## 0.1 Peer 来源仍过窄
当前最真实的 peer 来源是：
- child auto-registration
- manual external registration

还没有形成真正的 discovery runtime：
- automatic discovery
- source credibility
- discovered peer ingestion/refresh
- stale peer pruning

## 0.2 Trust 还不是 reputation
当前 trust 更像：
- 基于静态/近时证据的结构化评价

还不是：
- 跨时间演化的 reputation system
- 基于历史 delegation 结果/治理行为/uptime 的动态信誉

## 0.3 Delegation 还不是 distributed loop
当前系统能：
- 选择 peer
- 记录 delegation receipt
- 标注 trust impact

但还没有真正闭环：
- peer selection based on reputation history
- delegation outcome → reputation evolution
- repeated assignment optimization
- peer failure / timeout / rejection feedback influencing future routing

因此，Round 16.7 的唯一正确问题定义是：

> **如何让 ConShell 从“具备 collective 基础设施”升级为“能持续发现 peer、形成动态 reputation、并通过 delegation 结果让 collective behavior 自我演化”的系统？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Peer Discovery + Reputation Evolution + Distributed Delegation Loop**

即：
1. 建立最小可用的 peer discovery runtime；
2. 让 trust 从静态评分推进到跨时间 reputation；
3. 让 delegation 结果反向塑造 future peer selection；
4. 让 collective runtime 开始具备真正的“发现 → 评估 → 协作 → 反馈 → 再选择”的闭环。

---

# 2. 本轮必须先回答的问题

## 2.1 什么是 discovery 事件？
你必须明确：
- 是手工注册外部 peer？
- 是从 EvoMap / registry / broadcast 获取 peer summary？
- 是 health ping / heartbeat 响应？
- discovery 记录包含什么证据？

## 2.2 reputation 与 trust 的边界是什么？
你必须明确：
- trust 是当前判断
- reputation 是历史累积

还是反过来？

如果不先定义边界，后面会把两个层次混成一团。

## 2.3 delegation feedback loop 的最小闭环是什么？
你必须定义至少包含：
- 选谁
- 为什么选
- 执行结果
- 结果如何改变 reputation/trust
- 下次如何改变选择

## 2.4 stale peer 怎么处理？
你必须明确：
- 多久没 seen 就 degraded/offline？
- 什么情况下 quarantine/revoke？
- discovered peer 与 lineage child 的 stale policy 是否一样？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Discovery Contract

必须新增正式 contract，例如：
- `collective/discovery-contract.ts`
- 或 `collective/peer-discovery.ts`

### 至少定义：
- `DiscoveryEvent`
- `DiscoverySource`（manual / evomap / registry / broadcast / lineage）
- `DiscoveryEvidence`
- `DiscoveryResult`
- `DiscoveryRefreshPolicy`

### 每个 discovery 事件至少包含：
- candidate peer identity summary
- source
- timestamp
- evidence
- credibility hint
- resulting registry action（new / update / ignored / quarantined）

### 强要求：
- discovery 不能只是 `registerPeer()` 的别名

---

## Task 2 — 新增 PeerDiscoveryService / DiscoveryRuntime

必须建立正式 owner，例如：
- `PeerDiscoveryService`
- `DiscoveryRuntime`

### 最小接口建议：
- `ingest(event)`
- `discoverFromManual(...)`
- `discoverFromEvoMap(...)`（若可行）
- `refreshPeer(id)`
- `markStalePeers()`
- `stats()`

### 最低实现要求：
- manual discovery 为必做
- 自动 source 至少实现一个（推荐 EvoMap ingest 或 mock registry ingest）

### 目标：
让 peer 注册从“静态操作”升级为“发现事件驱动”。

---

## Task 3 — 建立 Reputation Model（区别于 Trust）

本轮必须把 reputation 从 trust 中独立出来。

### 推荐新增：
- `ReputationRecord`
- `ReputationDimension`
- `ReputationSummary`
- `ReputationEvent`

### Reputation 至少应累计：
- delegation success/failure rate
- timeout history
- governance compliance history
- uptime consistency
- funding discipline / economic reliability

### 强要求：
- reputation 是跨时间累计量
- trust 可以消费 reputation，但两者不能等同

### 推荐结构：
- trust = 当前综合判断
- reputation = 历史表现沉淀

---

## Task 4 — 新增 ReputationStore / Service

必须建立正式 owner，例如：
- `ReputationStore`
- `PeerReputationService`

### 最小接口建议：
- `recordEvent(peerId, event)`
- `getReputation(peerId)`
- `getTopPeers()`
- `getWorstPeers()`
- `stats()`

### Reputation events 至少包含：
- delegation success
- delegation failure
- timeout
- governance denial/compliance
- stale/offline period

### 目标：
让 collective 选择 peer 时不只看“此刻分数”，还看长期信誉轨迹。

---

## Task 5 — 让 Delegation 真正消费 Reputation/Trust 进行 Peer Selection

当前 delegation primitive 已存在，但选谁还不够真实。

### 本任务必须至少完成：
1. 新增 `selectPeerForDelegation(...)`
2. 选择逻辑同时读取：
   - trust summary
   - reputation summary
   - capability claims
   - current status
3. delegation 可输出“为什么选这个 peer”

### 至少覆盖：
- trusted + high reputation peer 优先
- repeated timeout/failure peer 降级
- quarantined/revoked peer 不可选
- degraded/offline peer 默认不优先

### 强要求：
- 这不是黑箱排序，必须能解释原因

---

## Task 6 — 让 Delegation Result 反向演化 Reputation

当前 `handleDelegationResult()` 只做 trustImpact 标记，还不够。

### 本任务必须新增：
- delegation success → reputation positive event
- delegation failure / timeout / rejection → negative event
- repeated failures 触发 degrade / quarantine 倾向
- repeated successes 提升 reputation tier/weight

### 目标：
让系统真正拥有：
> **派发 → 结果 → 声誉变化 → 下次选择变化**

这才是 distributed delegation loop 的核心。

---

## Task 7 — 建立 Staleness / Refresh / Peer Lifecycle Evolution

本轮必须让 peer 生命周期更真实，而不是只靠手动改状态。

### 至少新增：
- stale peer detection
- refresh attempt contract
- automatic offline/degraded transitions
- optional rehabilitation path on successful refresh

### 推荐最小规则：
- lastSeen 超阈值 → offline/degraded
- repeated refresh failure → degraded/quarantined
- successful refresh → known/trusted recovery

### 强要求：
- child peers 与 external/discovered peers 可有不同 stale policy

---

## Task 8 — 扩展 Collective Control Surface 与 Diagnostics

当前已有 peers/topology/stats/quarantine/revoke。

### 本轮至少扩展：
- `GET /api/collective/reputation/:peerId`
- `GET /api/collective/discovery/stats`
- `POST /api/collective/discovery`（manual discovery ingest）
- 若实现 selection：`POST /api/collective/delegate`

### Diagnostics 至少新增：
- discovered peer counts by source
- stale peer counts
- reputation distribution
- delegation outcome distribution
- top trusted / top reputed peers

---

## Task 9 — 新增 Discovery / Reputation / Delegation Loop Tests

本轮必须新增覆盖以下测试：

### 9.1 Discovery Tests
- manual discovery 进入 peer registry
- 自动 source ingest（若实现）可产生 peer update/new peer
- stale detection/refresh 正确

### 9.2 Reputation Tests
- reputation events 正确累计
- top/worst peers 正确
- reputation 与 trust 边界清晰

### 9.3 Peer Selection Tests
- trusted + high reputation peer 被优先选择
- degraded / low reputation / timeout-heavy peer 被降级
- quarantined/revoked peer 不可选

### 9.4 Delegation Loop Tests
- delegation result 会改变 reputation
- reputation 改变会影响下次 selection

### 9.5 Control Surface Tests
- discovery / reputation / delegate APIs 可用
- diagnostics 输出正确

### 9.6 Regression Tests
- 原有 1143 tests 无回归
- 原有 60 collective tests 无回归

---

## Task 10 — 文档与术语统一

必须新增/更新文档，明确：
1. 什么是 discovery event
2. trust 与 reputation 的边界
3. delegation selection 如何工作
4. stale/refresh lifecycle 如何工作
5. distributed delegation loop 的最小闭环定义

### 禁止：
- 用“有 trust score”描述成“有 reputation system”
- 用“有 delegation primitive”描述成“distributed loop complete”

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical discovery runtime owner**
2. **How peers are now discovered and refreshed**
3. **How reputation is now modeled and stored**
4. **How trust and reputation are now related but distinct**
5. **How peer selection for delegation now works**
6. **How delegation outcomes now evolve future collective behavior**
7. **What control surfaces and diagnostics now exist**
8. **What tests were actually executed**
9. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “reputation complete”但只有 trust score
- “peer discovery complete”但只有 manual register
- “distributed delegation loop complete”但结果不会影响下次选择

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] canonical discovery runtime owner 已明确
- [ ] 至少一种非-child peer discovery 路径已建立并进入 registry
- [ ] reputation model 与 trust model 已明确区分
- [ ] reputation store/service 已建立
- [ ] peer selection 已消费 trust + reputation + capability + status
- [ ] delegation result 能反向改变 reputation 并影响 future selection
- [ ] stale/refresh peer lifecycle 已有正式 contract
- [ ] discovery/reputation/delegation APIs 已扩展
- [ ] 新增 discovery/reputation/delegation-loop tests 已通过
- [ ] 原有 1143 tests 无回归
- [ ] 原有 60 collective tests 无回归
- [ ] 文档中 trust vs reputation / discovery vs registration 术语已统一

---

# 6. 一句话结论

> **Round 16.7 的目标，不是再增加 collective 表面积，而是让 collective runtime 真正开始“发现、评估、协作、学习”——从静态 peer registry 迈向具备 reputation 演化与 delegation feedback 的群体生命体系统。**
