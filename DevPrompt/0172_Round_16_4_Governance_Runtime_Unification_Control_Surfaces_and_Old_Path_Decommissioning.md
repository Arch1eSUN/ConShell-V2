# Round 16.4 — Governance Runtime Unification, Control Surfaces, and Old Path Decommissioning

> **文件定位**：这是 Round 16.4 的正式开发提示词。  
> **前置审计结论**：Round 16.3 已通过严格本地复证：`55 files / 1105 tests passing`。  
> 当前系统已具备：  
> - governance contract / proposal / receipt / rollback model；  
> - `GovernanceService` 作为 canonical governance domain owner；  
> - selfmod / replication 的治理工作流原型；  
> - sovereign identity、economic runtime、autonomous agenda、durable commitments 等高层能力骨架。  
> **但当前最大缺口已经从“有没有治理工作流”转移为“治理工作流是否真正接管整个 runtime 的高风险入口”**。  
> 当前审计明确发现：治理领域层已经成立，但 kernel / runtime / server / control surfaces 仍存在旧治理语义与新治理工作流并存的双轨现实。  
> **本轮目标**：不是继续扩更多 governance 类型，而是把 GovernanceService 真正接到 kernel、runtime、server、API/control surface，并退役旧治理路径，让系统从“有治理模块”升级为“由治理工作流统一驱动高风险动作”的自治生命体 runtime。  
> **事实纪律**：禁止把“domain layer complete”包装成“runtime unified complete”；禁止保留旧治理路径却宣称 governed-by-default 已成立。

---

# 0. 本轮问题定义

Round 16.3 解决的是：
- 高风险动作已有正式 governance object model；
- `GovernanceService` 已能 propose / evaluate / apply / verify / rollback；
- selfmod / replication 在服务层已具治理通路；
- governance receipts 已开始形成审计面。

但当前仍存在一个决定性系统问题：

> **系统里到底是哪一层在真实掌控高风险动作入口？**

当前已知事实：
1. 新 `GovernanceService` 已成立；
2. runtime 某些位置仍保留旧 governance/pre-check 语义；
3. kernel 启动链尚未显示 governance 是 first-class boot service；
4. server/control surface 尚未显示统一 governance API/route；
5. selfmod / replication 的“正式治理”更多已在服务层和单测成立，但尚未证明所有外部/内部高风险入口都统一经由治理层。

因此，Round 16.4 的唯一正确问题定义是：

> **如何让 ConShell 从“有治理工作流模块”升级为“整个 runtime 默认由治理工作流统一接管高风险能力入口”的系统？**

---

# 1. 本轮唯一核心目标

本轮必须完成：

# **Governance Runtime Unification + Control Surface Integration + Old Path Decommissioning**

即：
1. GovernanceService 进入 kernel boot / service registry；
2. selfmod / replication / high-risk actions 由统一治理入口接管；
3. server / API / runtime control surface 暴露正式 governance flow；
4. 旧治理路径被识别、收口、降级或退役；
5. 系统默认治理语义从“局部 opt-in”变为“高风险动作 governed-by-default”。

---

# 2. 本轮必须先回答的问题

## 2.1 哪些入口现在仍绕过 GovernanceService？
你必须先列出真实入口地图，至少包括：
- selfmod 入口
- replication / spawn_child 入口
- identity rotation / revocation 入口（若有）
- dangerous action / external declaration 入口（若有）
- runtime pre-loop checks / legacy governance semantics

如果不先做入口地图，本轮很容易继续做成“新增接线”，但旧路径仍在。

## 2.2 GovernanceService 在 kernel 中的 canonical 位置是什么？
你必须明确：
- 是 `KernelServices.governance`？
- 是否在 boot 阶段创建？
- 它依赖哪些服务：identity / policy / economy / selfmod / multiagent？

如果 kernel 不正式持有 governance，系统统一化无法成立。

## 2.3 “governed-by-default” 的边界是什么？
你必须明确：
- 哪些动作默认必须经过 governance proposal？
- 哪些动作仍可直接执行？
- 哪些是低风险 passthrough？
- 哪些仅保留 legacy fast-path 作为兼容层？

## 2.4 旧治理语义如何退役？
你必须回答：
- 旧 `governance-types` / pre-loop governance checks 是删除、包装、还是适配到 GovernanceService？
- 如何避免双轨治理现实？

---

# 3. 本轮任务顺序（强制）

## Task 1 — 建立 Governance Entry Surface Map

先输出一份真实入口清单，列出系统里所有高风险动作入口，以及它们当前是否经过 GovernanceService。

### 至少覆盖：
- `kernel/`
- `runtime/agent-loop.ts`
- `runtime/tool-executor.ts`
- `selfmod/`
- `multiagent/`
- `server/` / routes
- identity lifecycle actions
- external declaration/publish surface（若已存在）

### 每个入口必须标注：
- current path
- current guard
- current governance status
- target unified path

### 验收标准：
- 清楚知道哪些入口已治理化、哪些仍旧路径、哪些缺入口

---

## Task 2 — 将 GovernanceService 提升为 Kernel First-Class Service

必须将 GovernanceService 正式接入 kernel boot。

### 至少完成：
1. 在 kernel boot 中创建 GovernanceService
2. 将其加入 `KernelServices`
3. 注入：
   - identity provider
   - policy provider
   - economic/budget context
   - selfmod manager
   - multiagent manager
4. 让 runtime/service graph 可访问 governance

### 强要求：
- 不是局部 `new GovernanceService(...)`
- 必须是 kernel 级 canonical owner

---

## Task 3 — 统一 SelfMod Runtime 入口

当前 selfmod 的服务层治理已存在，但本轮必须让所有实际 selfmod 入口都经过 GovernanceService。

### 至少完成：
1. 任何 selfmod 公开/内部入口都先 `propose()`
2. `apply()` 不允许绕开 governance 直接调用
3. 失败后 rollback path 被真正接通
4. 形成可查询 receipt

### 强要求：
- 不允许“测试里 governed、真实调用里 bypass”
- 若存在旧 direct path，必须显式退役或包装

---

## Task 4 — 统一 Replication Runtime 入口

当前 replication 治理在服务层已成立，但本轮必须真正接到实际 child creation path。

### 至少完成：
1. runtime 的 child creation / spawn path 统一走 GovernanceService
2. fund_child / resource allocation 走 governance evaluation
3. child lineage metadata / actor identity 进入 receipts
4. 旧 direct spawn path 显式退役或仅保留内部受控 adapter

### 验收标准：
- runtime 中不存在“能直接 spawn child 却不经过 governance”的默认路径

---

## Task 5 — 让 Server / API 暴露正式 Governance Control Surface

本轮必须至少打一条正式 control surface，让 governance 不只是内部模块。

### 推荐最小集：
1. `POST /api/governance/proposals`
2. `GET /api/governance/proposals/:id`
3. `GET /api/governance/receipts/:proposalId`
4. `POST /api/governance/proposals/:id/approve`
5. `POST /api/governance/proposals/:id/reject`
6. `POST /api/governance/proposals/:id/apply`
7. `POST /api/governance/proposals/:id/rollback`

### 安全要求：
- 必须结合 identity / authority / auth boundary
- 不能暴露敏感 payload 细节给不该看的调用者

### 最低目标：
- 至少存在一个正式 route 文件或 route registration 模块
- server 不再只在 kernel 内散插治理逻辑

---

## Task 6 — 用 GovernanceService 统一旧 Pre-loop Governance / High-Risk Checks

当前已知 runtime 中仍有旧治理语义，例如：
- `agent-loop.ts` 的 pre-loop governance checks
- 旧 `spend/governance-types` 相关结构

### 本任务必须做出明确选择：
#### 方案 A：适配
- 旧 pre-checks 调用 GovernanceService.evaluate(...) 作为底层

#### 方案 B：退役
- 旧 pre-checks 删除，由 governance route/entrypoint 接管

#### 方案 C：过渡层
- 旧接口保留，但仅作 thin adapter，底层统一委托 GovernanceService

推荐：**C → 后续再清理到 A/B**

### 强要求：
- 不允许两个治理现实并存却互不知晓
- 必须在文档中明确 legacy status

---

## Task 7 — 建立 Governance Runtime Metrics / Diagnostics

当前已有 receipts，但需要更强运行时可观测性。

### 本任务至少新增：
- proposal counts by status
- approvals / denials / escalations
- apply success/failure rate
- rollback count
- actions by kind
- legacy-path bypass count（若保留兼容层）

### 推荐暴露：
- diagnostics helper
- `/api/metrics` 或 `/api/governance/stats`

### 目标：
让治理不只是有日志，而是可运营、可诊断、可验证。

---

## Task 8 — 新增 Kernel / Server / Runtime Integration Tests

本轮不能只加 governance 单测，必须补 runtime integration coverage。

### 至少新增：

#### 8.1 Kernel Wiring Tests
- kernel boot 后 governance service 可用
- governance 已被正确注入依赖

#### 8.2 SelfMod Integration Tests
- 实际 selfmod runtime 入口走 governance
- direct bypass 被阻断或不可达

#### 8.3 Replication Integration Tests
- runtime spawn path 走 governance
- denied/escalated/approved path 正常

#### 8.4 Server / API Tests
- governance routes 可用
- auth/authority boundary 正常
- receipts/proposals 可查询

#### 8.5 Legacy Path Tests
- 旧治理路径要么委托 GovernanceService，要么明确失效
- 不允许 silent divergence

#### 8.6 Regression Tests
- 原有 1105 tests 无回归

---

## Task 9 — 文档与术语统一：Governed-by-default

必须新增/更新文档，明确：
1. 什么是 governed-by-default
2. 哪些动作必须走 governance
3. 哪些旧路径已退役，哪些是兼容 adapter
4. governance 在 kernel/service graph 中的 canonical 位置
5. 如何通过 API/control surface 使用治理流程

### 禁止：
- 用“已接 governance 模块”替代“已默认治理化”
- 不说明 legacy path 状态就宣称 runtime unified

---

# 4. 本轮输出要求

本轮结束后，输出必须严格使用以下结构：

1. **What is now the canonical governance runtime owner**
2. **Which runtime/control-surface entrypoints now flow through GovernanceService**
3. **Which legacy governance paths were adapted, retained, or removed**
4. **How selfmod and replication are now governed in real runtime paths**
5. **What governance APIs / metrics / diagnostics now exist**
6. **What tests were actually executed**
7. **What remains incomplete or intentionally deferred**

### 禁止输出：
- “runtime unified complete”但 kernel 未持有 governance
- “governed-by-default complete”但旧 direct path 仍默认可达
- “API integrated”但没有正式 governance control surface

---

# 5. 最终验收标准

只有满足以下全部条件，本轮才算通过：

- [ ] GovernanceService 已正式进入 KernelServices
- [ ] selfmod 实际入口已统一走 governance
- [ ] replication 实际入口已统一走 governance
- [ ] 至少一条正式 API/control surface 暴露治理流程
- [ ] 旧治理路径已被适配、退役或显式降级为兼容层
- [ ] governance runtime metrics/diagnostics 已建立
- [ ] 新增 kernel/server/runtime integration tests 已通过
- [ ] 原有 1105 tests 无回归
- [ ] 文档中 governed-by-default 与 legacy compatibility 边界已明确

---

# 6. 一句话结论

> **Round 16.4 的目标，不是再扩治理概念，而是让 GovernanceService 真正接管 ConShell 的高风险动作入口——从“有治理领域层”升级为“runtime 默认由治理工作流统一驱动”的系统。**
