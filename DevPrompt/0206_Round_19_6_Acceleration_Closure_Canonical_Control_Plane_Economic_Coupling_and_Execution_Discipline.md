# DevPrompt 0206 — Round 19.6
## Acceleration Closure / Canonical Control Plane / Economic Coupling / Execution Discipline

你现在处于 **ConShellV2 Round 19.6**。

上一轮（19.5）已经明确进入：

> **Cinematic Control Plane / WebUI / TUI / Onboarding / Terminal Experience 的统一落地轮**

但是，基于最新全局大审计，当前事实也非常明确：

> **项目推进速度仍然偏慢，且存在“设计方向已明确，但 canonical 迁移与真实落地不够快、不够硬、不够彻底”的问题。**

当前最新全局大审计结论（仓内证据基线）包括：
- `packages/core` 全量测试：**87/87 files、1813/1813 tests、0 failures**
- `packages/core` / `packages/cli` typecheck 通过
- `packages/dashboard` typecheck + build 通过
- ConShell 当前相对终局目标（Web4.ai × Conway Automaton × OpenClaw × Autonomous AI Lifeform Runtime）的总体完成度，保守真实口径约为：
  - **58%（置信度：中高）**
- 当前最大的真实问题不是“完全没有方向”，而是：
  1. **canonical product surface 迁移仍未真正完成**
  2. **TUI 仍未形成足够强的真实实现证据**
  3. **economic closure 仍未进入系统主约束地位**
  4. **continuous autonomy / agenda closure 仍不足**
  5. **项目存在“继续设计、继续描述、但关键收口动作推进不足”的风险**

因此 19.6 的任务不再是继续泛化设计、继续慢速补丁式打磨，而是：

> **进入一轮“强提速、强收口、强迁移、强落地”的执行轮。**

一句话：

> **Round 19.6 的目标，是停止温和推进，开始用系统级执行纪律把当前最关键、最卡进度、最影响最终完成度的 canonical 缺口一次性压下去。**

---

## 一、本轮唯一总目标

**以明显更高的推进速度，一次性完成 ConShell 当前最关键的 canonical 收口工作：**
1. **把 19.5 的 product surface 从“过渡态”推进到“真正 canonical 化”**
2. **把 Control Plane 的顶层 IA、命名、入口、页面结构、CLI/TUI/Onboarding 迁移做实**
3. **把 economic closure 从“高级 subsystem”推进到“系统行为主约束”**
4. **把 continuous autonomy / agenda / survival pressure 的 runtime 耦合向前推进**
5. **消灭仍在拖慢总体进度的“半完成过渡结构”**

换句话说：

> **19.6 不允许继续“只新增而不迁移”“只设计而不 canonicalize”“只补页面而不改总结构”。**

---

## 二、本轮战略定位

### P0. 这是提速轮，不是温和打磨轮
19.6 的核心不是“再优化一点”，而是：

> **用更强的执行密度，把当前最影响完成度的卡点直接打穿。**

这意味着本轮必须：
- 减少温和渐进式拖延
- 减少保守保留旧结构
- 减少“文档先于实现太多”的情况
- 减少“有计划但没有 canonical migration”的状态

如果某个旧结构已经明确是过渡态，并且新的 canonical 结构已经确定：

> **优先迁移，不要继续保留双轨。**

---

### P1. 速度提升不等于放弃真实性
提速不允许牺牲以下底线：
1. 不能伪造能力
2. 不能拿页面包装掩盖 runtime 缺口
3. 不能跳过 typecheck / build / tests
4. 不能用“先留着以后收口”继续制造 canonical debt

本轮要求的是：

> **更快，但更硬；更猛，但更实。**

---

### P2. 当前最致命的问题不是“缺一堆设计”，而是“关键 canonical debt 还没一次性清掉”
最新审计明确表明：
- WebUI 有真实推进，但 **IA 仍是过渡态**
- Presence 首页有真实实现，但 **仍带 V1 升级页残留**
- TUI 方向明确，但 **实现证据不足**
- CLI/onboarding/status/doctor/daemon 已存在，但 **还没彻底产品语言统一**
- economic subsystem 很强，但 **还没真正主宰系统行为**

所以 19.6 必须优先做的是：

> **把“半完成结构”变成“正式 canonical 结构”。**

---

## 三、本轮必须一次性完成的内容

# G1. Canonical Control Plane Migration（必须真正迁移，不再停留在过渡态）

这是本轮第一优先级，也是最重要的收口工作。

### 当前问题
仓内现状已经证明：
- dashboard 有 19.5 风格化改造
- 但顶层 IA 仍残留旧式：`Core / Agent / System`
- 路由与页面组织仍明显属于 **过渡态**
- `PresencePage` 本身仍带 “polished V1 design” 痕迹

### 本轮必须完成
1. 把 WebUI 顶层信息架构正式迁移为 canonical 6 control planes：
   - Presence
   - Runtime
   - Governance
   - Survival
   - Collective
   - Operator
2. sidebar / nav / route / labels / terminology 必须同步迁移
3. 清理旧的 `overview` / V1-style tab semantics
4. 旧结构若仍保留，必须有明确兼容理由；否则应直接替换
5. 页面层次、命名、组件入口全部对账新结构

### 本轮不接受
- “先保留旧 nav，之后再迁”
- “页面换了标题，但结构没迁”
- “文档写 canonical，代码仍是旧 IA”

### 验收标准
- WebUI 顶层 IA 真正完成 canonical migration
- 不再明显残留 V1 dashboard 骨架

---

# G2. Presence 首页从“V1 升级版”升级为“V2 canonical 首页”

### 当前问题
PresencePage 已经不是空白，但从注释、结构与语义上看，仍更接近：
- polished V1 page
- V1 overview 的高级升级版
而不是 V2 的终局首页

### 本轮必须完成
1. 把 Presence 首页变成真正的 V2 控制面首页
2. 首页必须严格完成三层 canonical 结构：
   - Hero Presence Band
   - Truth Grid
   - Recommended Interventions
3. 首页文案、层级、数据优先级必须体现：
   - 存在状态
   - posture
   - runtime truth
   - survival pressure
   - governance pressure
   - collective condition
4. 清理仍然暴露“V1 overview page”心智模型的结构痕迹
5. 若缺任何 support API / summary / intervention source，本轮补齐

### 验收标准
- 首页一眼看上去就是 V2，不再像“V1 加强版”
- 首页成为 operator truth surface，而不是传统信息卡片页

---

# G3. TUI 必须从“规划对象”变成“真实实现对象”

这是本轮第二优先级。当前最大问题之一就是：

> **TUI 已经被写进设计与目标，但真实实现证据不足。**

19.6 必须停止这种“设计存在、实现缺席”的状态。

### 本轮必须完成
1. 落地一个真实可运行的 TUI 主视图
2. 至少具备以下 section：
   - Presence
   - Runtime
   - Governance
   - Survival
   - Collective
   - Operator / Actions
3. TUI 需要能够通过真实 summary / posture / health / governance / economic surface 渲染
4. TUI 不是普通 status prettifier，而是：
   - 独立价值的 operator surface
   - SSH/server friendly 的控制面
5. 如果需要新增 CLI 入口（例如 `conshell tui` / `conshell status --tui`），本轮直接落地

### 本轮不接受
- 只写 TUI 设计文档
- 只画 ASCII 草图
- 只说未来会接 API

### 验收标准
- 仓内必须出现可审计的 TUI 实现代码与入口
- 能真实运行，哪怕是第一版

---

# G4. CLI / Onboarding / Doctor / Status / Daemon 统一产品语言与体验

当前 CLI 已有真实能力，但仍存在“可用但未 canonicalized 到产品级”的问题。

### 本轮必须完成
1. `start / status / doctor / onboard / daemon` 文案与结构统一
2. `status` 输出必须完全贴合 Presence-first 语义
3. `doctor` 输出必须更像系统真相诊断，而不是工程检查列表
4. onboarding 必须从“最小完整流程”推进到更像 first awakening experience
5. daemon/always-on 的价值表达必须清楚
6. help / next-step / failure hints 必须与 WebUI/TUI 术语一致

### 验收标准
- CLI 不再只是工程接口集合，而是统一产品控制面的一部分

---

# G5. Economic Closure 必须前推到系统主约束（不能继续只是 subsystem）

这是 19.6 的另一条主线。当前总体进度慢，不只是 UI 慢，另一个根因是：

> **经济系统虽然已经复杂，但还没有真正成为推动整个系统往终局生命体前进的核心约束。**

### 本轮必须完成
1. survival pressure 对 runtime 行为的影响继续前推
2. agenda / routing / task admission / background work 与 economic state 的耦合加强
3. economic diagnostics / operator truth 必须更加直接暴露
4. 如果存在“有经济结构但没有真正改行为”的路径，本轮补接
5. 优先打通：
   - survival tier → behavior
   - runway / reserve → policy pressure
   - value / cost / execution → agenda prioritization

### 本轮不接受
- 继续只新增 economic 类型/测试，而系统行为不变
- 继续把 economic 当 side panel 信息

### 验收标准
- 能清楚证明：economic state 已进一步成为系统行为主约束之一

---

# G6. Continuous Autonomy / Agenda Closure 继续前推

### 当前问题
heartbeat / scheduler / daemon / continuity 已有基础，但还不足以支撑“成熟生命过程”。

### 本轮必须完成
1. agenda / continuity / restored work / wake / scheduler 的闭环再前进一步
2. 更明确地区分：
   - reactive execution
   - scheduled execution
   - survival-driven execution
   - governance-gated execution
3. 如果有 canonical agenda gap，本轮优先修补
4. 将连续自治往“长期可持续 process”而不是“能后台运行”推进

### 验收标准
- 本轮之后，ConShell 更接近 agenda-driven autonomous runtime，而不只是 agent server + daemon

---

# G7. 清理过渡态遗留与重复结构

当前项目速度慢，有一部分原因不是能力不足，而是：

> **旧结构、过渡结构、双轨命名、半迁移状态在拖累推进速度。**

### 本轮必须完成
1. 清理明显已过时的页面命名 / layout 语义 / route 语义
2. 清理已被新 contract 替代但仍残留的旧文案与旧心智模型
3. 对“过渡结构”建立明确策略：
   - 要么立即迁移
   - 要么明确标记 technical debt + 为什么暂留
4. 不允许继续无代价保留大量 V1 旧骨架

### 验收标准
- 项目结构更干净
- canonical path 更明显
- 后续推进阻力下降

---

# G8. 19.6 必须留下“速度提升”的可审计证据

这是本轮的关键 meta 目标。

### 必须完成
本轮结束后，审计者应能明确看到：
1. 关键 canonical 迁移真的发生了
2. 不是只增加 1-2 个局部页面美化
3. TUI 不再缺席
4. CLI/Onboarding/Doctor/Status 的产品化明显提升
5. economic / autonomy 的系统耦合进一步强化
6. 整体完成度相对 19.5 有明显跃升，而不是小数点式推进

### 验收标准
- 19.6 审计时，不能再得到“方向正确但推进太慢”的结论

---

## 四、本轮强制执行纪律

### D1. 不允许继续只做“局部美化”
如果本轮主要成果只是：
- 改颜色
- 改标题
- 改卡片样式
- 加一点 motion

那就是失败。

### D2. 不允许继续停留在“设计先于实现太多”
设计文档可以写，但必须伴随真实落地。

### D3. 不允许继续保留明显过渡态而不给出 hard migration
凡是已经明确应 canonicalize 的地方，本轮优先迁。

### D4. 不允许继续把 TUI 当未来事项
本轮必须交付真实实现。

### D5. 不允许继续把 economic closure 当长期概念
本轮必须继续推进到行为层。

### D6. 不允许牺牲测试健康度换速度
所有关键改动后，核心测试必须继续全绿。

---

## 五、本轮必须回答的问题

### Q1. WebUI 顶层 IA 是否已真正完成 canonical migration？
### Q2. Presence 首页是否已摆脱 V1 升级页本质？
### Q3. TUI 是否已从“计划”变成“真实产品面”？
### Q4. CLI / onboarding / doctor / status / daemon 是否已真正统一成控制面的一部分？
### Q5. economic state 是否已更明显地进入系统行为主约束？
### Q6. continuous autonomy 是否有真实前推，而不是原地补描述？
### Q7. 19.6 是否在速度与收口质量上明显优于 19.5？

---

## 六、本轮强制验收矩阵

### V1. WebUI 顶层 IA 已 canonicalize 到 6 control planes
### V2. Presence 首页已成为真正 V2 首页，而不是 V1 polished variant
### V3. TUI 已有真实实现与入口
### V4. CLI / onboarding / doctor / status / daemon 语言与体验明显统一
### V5. economic closure 对行为层的耦合进一步变强
### V6. autonomy / agenda / continuity 主链进一步收口
### V7. 过渡态遗留结构被明显清理
### V8. 文档、实现、路由、命名、术语彼此对账
### V9. `packages/core` 全量测试继续全绿
### V10. 审计时能明确看出本轮推进速度显著提升

---

## 七、本轮非目标

本轮不做：
- 不回头开新的宏大主线
- 不做只讲世界观的空设计
- 不做只停留在视觉层的 polishing
- 不做没有 canonical 迁移的增量补丁堆砌
- 不做“未来会做 TUI”式拖延
- 不用文档替代实现

本轮真正目标是：

> **用更高执行密度，把当前拖慢总体完成度的关键 canonical 缺口真正打掉。**

---

## 八、真实性不变量

1. **不能因为着急提速就伪造完成度**
2. **不能因为产品感重要就牺牲 runtime truth**
3. **不能因为设计气质重要就继续容忍旧 IA 残留**
4. **不能因为 TUI 难做就继续把它往后拖**
5. **不能因为经济耦合复杂就继续让它停留在 subsystem 层**
6. **不能因为想快，就让测试与构建健康度下降**
7. **本轮必须把“推进速度偏慢”这个问题本身当作需要被解决的对象**

---

## 九、本轮完成后必须输出

### A. Round 19.6 详细真实性审计材料基础
### B. Canonical IA migration 说明
### C. 新 Presence 首页与旧结构替代关系说明
### D. TUI 实现与入口说明
### E. CLI / onboarding / doctor / status / daemon 统一产品体验说明
### F. economic closure / autonomy 前推说明
### G. 清理掉了哪些过渡态结构 / 剩余哪些 technical debt
### H. 相比 19.5，速度与完成度提升了什么

---

## 十、一句话任务定义

> **Round 19.6 的目标是：在不牺牲真实性与测试健康度的前提下，显著加快推进速度，强制完成当前最关键的 canonical control plane 迁移、TUI 实现、CLI/onboarding 统一、economic behavior coupling 与 autonomy 主链前推，消灭拖慢整体完成度的过渡态结构。**
