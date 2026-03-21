# DevPrompt 0208 — Round 19.8
## Truth Surface Completion / Operator Actions / Production Hardening

你现在处于 **ConShellV2 Round 19.8**。

Round 19.7 已经真实完成了：
- canonical control plane 之后的一轮产品成熟度推进
- dashboard route-level split / manualChunks / Web3 defer loading
- TUI 第二层交互增强
- onboarding 向 Lifeform Activation 升级
- 多页面 skeleton / loading / empty-state 打磨

但最新审计也明确指出一个关键事实：

> **当前最重要的缺口，已经不再是顶层 IA，也不再是 TUI 是否存在，而是：某些生命体关键真相已经开始在 UI 上展示，但还没有全部完成“canonical truth surface → backend aggregation → multi-surface parity → operator actionability”的闭环。**

尤其是：
- **Agenda / Lifeform Closure Visibility 目前仅部分成立**
- Presence 首页已出现 `Agenda Truth` 卡片
- 但 `/api/system/summary` 尚未完成对应 agenda truth 的完整后端聚合
- 前端仍有 fallback/default 展示痕迹

这意味着：

> **19.8 的任务，不是继续一般意义上的 polish，而是把“显示出来的真相”变成“真正 canonical、可审计、可驱动操作的真相 surface”。**

一句话：

> **Round 19.8 的目标，是完成 lifeform-critical truth surfaces 的后端聚合闭环、跨 surface 对账、operator action 接线，以及进一步向 production-grade hardening 推进。**

---

## 一、本轮唯一总目标

**把当前已经进入产品控制面的关键生命体真相，真正收口为可信的 canonical truth surface，并让它们可被 WebUI / TUI / CLI / onboarding 一致消费、解释和驱动 operator 行动。**

本轮重点：
1. **Truth Surface Completion**
2. **Cross-Surface Parity Hardening**
3. **Operator Actionability**
4. **Production Hardening**
5. **Remaining performance/debt cleanup**

---

## 二、19.8 的战略判断

### P0. 不能继续“前端先展示、后端后补”太久
如果 UI 已经把某个维度当成关键 truth card，那么它必须尽快升级为：
- 后端真实聚合
- 有明确来源
- 可审计
- 可跨 surface 复用
- 可驱动动作

否则 control plane 会逐渐出现“视觉真相 > 系统真相”的风险。

### P1. 19.8 的重点是把 truth 与 action 绑紧
不够的是：
- 只让 operator 看见

必须升级成：
- operator 看得懂
- 知道为什么
- 知道下一步做什么
- 能执行最小动作

### P2. 19.8 是 production-hardening 开始轮
现在已经不是“先做出来再说”的阶段。
19.8 要开始系统性处理：
- truth surface completeness
- action flow completeness
- fallback/default 占位清理
- build/bundle/weight 继续治理
- 关键 surface 的错误/降级/空态一致性

---

## 三、本轮必须一次性完成的内容

# G1. Agenda / Lifeform Closure Truth Surface Canonicalization

这是本轮第一优先级。

### 当前问题
- Presence 首页已有 Agenda Truth 卡片
- 但 `/api/system/summary` 尚未完整提供 agenda truth
- 前端仍存在 `(p as any).agenda?.x ?? fallback` 形式

### 本轮必须完成
1. 在 core 侧把 agenda truth 正式纳入 canonical summary / truth surface
2. 至少完整暴露：
   - scheduled
   - deferred
   - next item / next commitment
   - priority reason
   - admission / deferral reason（若可行）
3. 不能继续依赖前端 fallback/default 作为主事实来源
4. 页面、TUI、CLI 使用同一来源字段
5. 若现有 `/api/system/summary` 不合适，新增更清晰的 canonical route 也可以，但必须统一消费策略

### 验收标准
- Agenda Truth 成为真正 backend-backed 的 canonical truth surface
- 不再只是首页上的“看起来像有”

---

# G2. Lifeform Closure Visibility 扩展到真正可审计的 4 条主链

当前可见性还不够完整。

### 本轮必须让以下四条主链更真实、更清楚：
1. **Agenda / scheduling / deferral**
2. **Economic pressure / runway / reserve / self-sustaining state**
3. **Governance pressure / self-mod / pending proposals / quarantine**
4. **Continuity / identity / memory health**

### 本轮必须完成
1. 明确每条主链的 canonical data source
2. 明确每条主链在 WebUI/TUI/CLI 中如何呈现
3. 明确 operator 应如何解读
4. 明确下一步 action 建议与触发条件

### 验收标准
- control plane 更像一个生命体真相面，而不是信息拼盘

---

# G3. Operator Actions：从“看到问题”到“能做最小动作”

当前 control plane 更强于“观测”，仍弱于“最小干预”。

### 本轮必须完成
至少为关键 truth surface 接入一批真正的 operator actions，例如：
- refresh / retry / inspect details
- open diagnostics
- jump to relevant plane
- run doctor
- review governance queue
- inspect deferred commitments
- inspect economic gate / agenda factors

### 要求
1. 不要求一次做成复杂工作流
2. 但必须让 control plane 不只是“读板”，而是“可采取最小行动”
3. WebUI 与 CLI/TUI 至少共享 action 语义

### 验收标准
- operator 不再只看到风险，还能立刻采取至少一小步动作

---

# G4. Cross-Surface Truth Parity Hardening

19.7 已推进 parity，但还不够硬。

### 本轮必须完成
1. 对齐 WebUI / TUI / CLI / onboarding 的关键 truth 字段
2. 对齐：
   - Presence state
   - Health score / verdict
   - survival tier / runway
   - governance pending / self-mod status
   - agenda scheduled / deferred / priority reason
3. 清除跨 surface 的 fallback / field drift / wording drift
4. 如果某 surface 暂时拿不到字段，必须明确处理策略，而不是静默默认

### 验收标准
- 同一个系统真相在不同 surface 上不再“名字一样、实际不同”

---

# G5. Production Hardening: Fallback 清理、错误路径、降级一致性

当前已经进入需要正式处理产品硬化的阶段。

### 本轮必须完成
1. 清理关键 UI 中不应长期存在的默认文案 fallback
2. 将“真实无数据”和“后端未接好”区分开
3. 统一错误状态、空状态、降级状态
4. 关键 truth card 应有：
   - loading
   - empty
   - degraded
   - unavailable
   - stale
5. 对 action 失败路径给出清楚反馈

### 验收标准
- operator 能分清：系统没有该数据、数据暂不可用、还是系统本身出了问题

---

# G6. Performance Hardening 第二轮

19.7 已显著优化，但 build 仍有 >500kB chunk。

### 本轮必须完成
1. 继续分析大 chunk 来源
2. 重点处理残余超大包（例如 metamask-sdk / wallet-related heavy deps）
3. 尽量减少与 operator control plane 无关的重量对首屏和常规页面的影响
4. 保持 canonical structure 不被性能优化破坏

### 验收标准
- build 继续通过
- 大 chunk 问题进一步改善，或至少提供更精确治理解释

---

# G7. TUI / CLI 从“展示”走向“轻操作”

TUI/CLI 目前已可用，但 actionability 仍不足。

### 本轮必须完成
1. 为 TUI 增加至少少量轻操作入口或 drill-down
2. CLI 增加对关键 truth / diagnostics / agenda 的更直接访问方式（如必要）
3. 保持 SSH-friendly、script-friendly
4. 不做花哨复杂交互，优先高价值动作

### 验收标准
- TUI/CLI 不只是观察面，也开始具备轻量操作面属性

---

## 四、本轮强制执行纪律

### D1. 不允许继续用前端 fallback 伪装 canonical truth
### D2. 不允许只加卡片，不补 backend truth source
### D3. 不允许继续只做观测，不做最小 actionability
### D4. 不允许为了 action 引入高风险写操作而无治理/无说明
### D5. 性能优化不得破坏 control plane 语义
### D6. core tests / cli tsc / dashboard tsc+build 必须继续健康

---

## 五、本轮必须回答的问题

### Q1. Agenda Truth 是否已经真正接上 canonical backend truth surface？
### Q2. Lifeform closure 的 4 条主链是否更完整可审计？
### Q3. operator 是否已经能从关键 truth card 采取最小动作？
### Q4. WebUI / TUI / CLI / onboarding 的 truth parity 是否更硬？
### Q5. fallback/default 占位是否显著减少？
### Q6. build/bundle 结果是否继续改善？

---

## 六、本轮强制验收矩阵

### V1. Agenda Truth 不再依赖前端 fallback 作为主事实来源
### V2. 至少一组关键 truth surface 完成“backend aggregation → UI/TUI/CLI parity → operator action”闭环
### V3. Lifeform closure visibility 更接近真正 canonical truth surface
### V4. 错误/空态/降级状态更一致
### V5. TUI/CLI 的轻操作能力有所增强
### V6. dashboard build 继续通过，且性能继续改善或有明确治理结论
### V7. core tests / cli tsc / dashboard tsc+build 全部健康

---

## 七、一句话任务定义

> **Round 19.8 的目标是：把当前已进入 control plane 的关键生命体真相，从“前端已可见”推进为“后端已聚合、跨 surface 一致、可驱动 operator 行动、具备 production-grade 错误与降级处理”的 canonical truth surface。**
