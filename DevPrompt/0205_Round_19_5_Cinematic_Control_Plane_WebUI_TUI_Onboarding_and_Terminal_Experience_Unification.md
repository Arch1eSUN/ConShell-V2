# DevPrompt 0205 — Round 19.5
## Cinematic Control Plane / WebUI / TUI / Onboarding / Terminal Experience Unification

你现在处于 **ConShellV2 Round 19.5**。

到当前最新审计基线为止，ConShell V2 已完成从“核心生命体运行时主开发”向“可设计、可打磨、可建立完整 operator surface”的阶段切换。

上一轮（19.4）的真实目标是：

> **把系统打磨到可以正式开始 WebUI 设计、TUI 设计、onboarding 设计、terminal 安装与使用体验设计。**

现在 19.5 不再停留在 readiness 判断，而是正式进入：

> **统一设计语言 + 控制面信息架构 + WebUI/TUI/Onboarding/Terminal Experience 的一体化落地轮。**

注意：
- 本轮不是回到老式 dashboard 拼装
- 也不是做一个普通 SaaS admin panel
- 更不是把 V1 原样搬运到 V2

本轮要做的是：

> **参考 ConShell V1 的已有设计资产、参考 `web4.ai` 的视觉气质与叙事张力，并结合当前 V2 已真实存在的 runtime / posture / governance / economic / collective / continuity 能力，构建一个真正属于 V2 的下一代控制平面。**

也就是说：
- **V1 是参考，不是模板**
- **web4.ai 是气质参考，不是页面照抄对象**
- **V2 的真实能力边界、真实控制面、真实 truth surface，才是最终设计的锚点**

---

## 一、本轮唯一总目标

**一次性完成 ConShell V2 的统一控制平面设计与首批实现，使其具备：**
1. **WebUI 的新一代 cinematic operator console**
2. **TUI 的高可信终端控制面**
3. **Onboarding 的统一首次唤醒体验**
4. **Terminal 安装 / first-run / doctor / status / daemon 的完整产品化体验**
5. **统一设计语言、统一信息架构、统一系统术语、统一视觉与交互哲学**

一句话：

> **19.5 的目标是把 ConShell 从“可以开始设计”推进到“已经拥有一套真正属于 V2 的完整控制面方案与首批落地实现”。**

---

## 二、本轮设计战略定位

### P0. V2 不是普通 Dashboard
ConShell V2 不是：
- chatbot 壳子
- admin 后台
- 单纯 metrics 仪表盘
- 传统 AI 助手控制台

ConShell V2 应被设计成：

> **Sovereign Autonomous Lifeform Runtime Control Plane**

中文语义：

> **主权自治生命体运行时控制平面**

这意味着本轮所有设计与实现都必须同时满足两件事：

1. **像一个正在运行、可感知、可持续、可治理的生命体系统**
2. **像一个严肃、可信、可观测、可干预、可操作的 operator control plane**

两者缺一不可。

---

### P1. 参考 V1，但不能继承其局限
必须系统性审阅并吸收 ConShell V1 中值得保留的设计资产，包括但不限于：
- dashboard / operator panel 的功能分层
- CLI / onboard / daemon / doctor 的用户旅程
- 多 surface（CLI / Web / channel / operator）之间的统一性尝试
- 与产品叙事相关的视觉资产、命名、信息组织经验

但必须明确：

> **V1 不是终局设计。**

V1 的不足包括但不限于：
- 信息架构可能偏分散、偏“功能页拼盘”
- 不足以承载当前 V2 的高可信 runtime truth
- 对 posture / governance / continuity / economic survival 的中心化表达不够强
- 设计气质、控制面层级、生命体运行感仍不够完整、不够高级、不够统一

因此：
- 可以保留骨架经验
- 但必须大幅重构
- 不能因迁移成本而保留低质量旧结构

---

### P2. 参考 web4.ai 的气质，但不能空心化
`web4.ai` 只能作为如下方面的参考：
- 视觉氛围
- 概念张力
- 空间感
- 仪式感
- 未来感
- 生命体叙事的高级气场
- 黑暗背景 + 发光系统 + 宣言式排版 + 高级感 motion 的组合方式

不能照抄：
- 页面结构
- 纯 marketing landing page 逻辑
- 只讲概念不讲系统真相的表现方式
- 用视觉包装掩盖信息架构不足

本轮要实现的是：

> **视觉上达到 web4.ai 那类世界观气质；产品上则必须是一个真实可用的 runtime operator console。**

---

### P3. 首页主语采用 Hybrid
首页与整套产品语义统一采用：

- **叙事主语：Agent / Lifeform**
- **信息主语：System / Control Plane**

也就是说：
- 看上去它是一个正在存活和演化的数字生命体
- 用起来它是一个严肃可靠的高可信系统控制面

这是硬性设计原则。

---

## 三、本轮必须一次性完成的内容

# G1. Unified Design Language System（统一设计语言系统）

本轮必须正式建立 ConShell V2 的统一设计语言，不允许 WebUI / TUI / onboarding / terminal 各说各话。

### 必须完成
1. 定义 V2 的设计哲学：
   - cinematic operator console
   - sovereign runtime
   - observable truth
   - governed intelligence
   - survival-aware system
2. 定义统一视觉语言：
   - 色彩体系
   - 背景体系
   - 发光 / 边框 / 面板样式
   - typography 层级
   - spacing / density / radius / surface tokens
3. 定义统一状态语义颜色：
   - operational
   - degraded
   - recovery
   - governance hold
   - survival critical
   - dormant / paused / booting 等
4. 定义统一 icon / badge / chip / panel / graph / alert / CTA 语言
5. 定义 motion 原则：
   - heartbeat pulse
   - signal shimmer
   - recovery transition
   - governance pending subtle emphasis
   - 不得过度炫技
6. 输出可供后续长期使用的 UI 语言基础规范

### 验收标准
- WebUI / TUI / onboarding / terminal 可共享同一套产品语义与视觉原则
- 不再是“做一个页面算一个页面”

---

# G2. WebUI Information Architecture Rebuild（WebUI 信息架构重构）

必须对 V2 的 WebUI 顶层 IA 做系统重构，不能沿用 V1 式散点功能堆叠。

### 顶层原则
WebUI 不是“很多页的集合”，而是：

> **围绕生命体存在状态、系统真相、治理约束、经济生存、群体协作与 operator 干预而组织的统一控制平面。**

### 建议一级结构（可按实现需要微调，但原则不能丢）
1. **Presence**
   - 首页 / 存在状态 / 当前总体姿态
2. **Runtime**
   - scheduler / queue / execution / wake / activity / recovered work
3. **Governance**
   - proposals / approvals / quarantine / lineage / self-mod governance
4. **Survival**
   - economic posture / runway / value flow / viability / settlement
5. **Collective**
   - peers / children / delegation / distributed runtime / branch posture
6. **Operator**
   - config / doctor / daemon / logs / control actions / integration readiness

### 必须完成
1. 重构 WebUI 的顶层导航、页面分组、主视图层级
2. 明确哪些信息属于首页首屏，哪些属于 drill-down
3. 避免首页沦为卡片墙或功能入口九宫格
4. 让首页成为 **Presence / Truth / Intervention** 三位一体的控制平面首页
5. 输出页面与数据面映射，确保 UI 不需要穿透内部实现细节

### 验收标准
- WebUI IA 能体现 V2 的真实系统定位
- 不再像传统 SaaS dashboard
- 不再像 V1 的旧式功能拼盘

---

# G3. Presence 首页重构（Hero Presence + Truth Grid + Intervention Strip）

这是本轮的核心界面。

### 首页必须完成三层结构

## Layer 1 — Hero Presence Band
必须用更高质量的系统叙事表达“这个生命体正在运行”。

应包含：
- 大标题
- 当前系统状态词
- 一句简短但可信的副标题
- heartbeat / signal / live indication
- posture / uptime / runway / governance / peer summary 的高优先级呈现

标题不应是平庸的 “Dashboard”。
应更接近：
- Presence
- Agent Presence
- System Presence
- Control Plane

文案必须克制，不得中二堆词。

## Layer 2 — Truth Grid
必须以 5 大真相模块为首页中核：
- posture
- runtime
- survival
- governance
- collective

每个模块必须：
- 显示 verdict
- 显示 1–3 个最高价值指标
- 显示异常或风险摘要
- 可 drill-down

## Layer 3 — Recommended Interventions
必须把“现在最该做什么”以产品化方式给出：
- review pending governance proposal
- fix degraded provider readiness
- resolve stalled execution
- install daemon
- finish onboarding
- inspect recovery issue

### 验收标准
- 首页打开时，用户第一眼就能判断：
  1. 系统是否活着
  2. 当前是否健康
  3. 风险在哪
  4. 下一步最重要的动作是什么

---

# G4. WebUI 视觉与交互高级化（Cinematic Operator Console）

本轮必须把视觉层级拉升到真正符合 ConShell V2 叙事高度的水平。

### 必须完成
1. 建立深色高级基底：
   - graphite / obsidian / deep violet / electric cyan 等系统色系
2. 面板风格升级：
   - glass / translucent / luminous edge / restrained gradients
3. 标题与排版升级：
   - 更强层次、更大 hero typography、更清晰的系统信息优先级
4. 图表与 signal 组件升级：
   - runway / health / active commitments / governance pressure / collective posture 等
5. 动效升级：
   - subtle, alive, system-like
6. 严禁：
   - 炫技式噪音
   - 低质量赛博朋克模板化 UI
   - 视觉强于信息真相

### 验收标准
- WebUI 必须看起来比 V1 明显更高级、更完整、更统一
- 同时保留 operator-grade 的可读性与严肃性

---

# G5. TUI Control Plane 设计与实现

TUI 不能是 WebUI 的低配复刻，也不能只是 status 文本输出。

它应是：

> **V2 的终端版高可信控制面。**

### 必须完成
1. 定义 TUI 的一级结构，与 WebUI 共享语义：
   - Presence
   - Runtime
   - Governance
   - Survival
   - Collective
   - Operator
2. 实现 TUI 的首页 / 主视图结构：
   - 状态摘要
   - posture
   - survival
   - governance pending
   - collective peers
   - recent events
   - interventions
3. 设计 TUI 交互原语：
   - pane / tab / section / expand / drill-down / action hints
4. 让 TUI 既适合：
   - 本地 operator
   - SSH / server 场景
   - 快速诊断与管理
5. 避免做成花哨 terminal toy

### 验收标准
- TUI 具备独立价值，不只是“把 status 命令排版好看一点”
- TUI 与 WebUI 共享核心语义，但形式适配终端

---

# G6. Onboarding 统一体验重构（First Awakening Experience）

Onboarding 不能只是“创建配置文件”。

它应成为：

> **用户第一次唤醒并理解 ConShell 这一主权智能体运行时的过程。**

### 必须完成
1. 把 onboarding 设计为完整流程，而不是零散步骤：
   - welcome
   - local home / identity / role
   - inference readiness
   - security / auth / operator mode
   - first doctor / first status
   - daemon / keep-alive
   - first useful action
2. 把 onboarding 文案统一到 V2 设计语言中
3. 让 onboarding 能解释：
   - 这是什么
   - 当前系统状态如何
   - 下一步怎么做
4. 支持不同入口：
   - terminal onboarding
   - WebUI onboarding
   - future TUI onboarding
5. 统一初次体验的系统文案、状态反馈、错误提示、下一步建议

### 验收标准
- 新用户首次接触时，不会感觉只是装了个工具
- 而是完成一次“受控、可解释、可信”的 runtime 启动体验

---

# G7. Terminal Install / First-Run / Doctor / Status / Daemon Experience 重构

这是产品化体验的重要一环。

### 必须完成
1. 统一命令体验：
   - install
   - onboard
   - start
   - status
   - doctor
   - daemon install/status/uninstall
2. 统一 help / usage / next-step / error hint 文案
3. 打磨 first-run output，使其足够清晰、可信、有产品感
4. 让 status 输出更符合 Presence-first 语义
5. 让 doctor 输出更像系统真相诊断，而不是原始检查列表
6. 让 daemon 相关体验更清楚地表达 keep-alive / always-on 的意义

### 验收标准
- terminal 路径可被真实用于安装体验设计与 operator 日常使用
- CLI 文案与 WebUI/TUI/onboarding 风格不冲突

---

# G8. Unified System Copy / Terminology Contract

必须建立全产品统一术语系统，避免 V1 / V2 / UI / CLI / docs 各自命名。

### 必须完成
统一以下至少这些术语的最终用法与展示语义：
- Presence
- Posture
- Health
- Operational
- Degraded
- Recovery
- Governance Hold
- Survival Critical
- Runtime
- Collective
- Viability
- Runway
- Wake
- Commitments
- Intervention
- Control Plane
- Onboarding
- Operator

### 验收标准
- UI / TUI / CLI / onboarding / docs 可引用同一份语义源
- 设计不会因为命名漂移返工

---

# G9. Implementation Scope（必须至少落地首批高价值实现）

本轮不是只写设计文档，必须有真实落地。

### 至少必须落地的高价值实现
1. WebUI：
   - 新 Presence 首页 / 或对应主控制面首屏
   - 至少 1~2 个高价值子页或高价值模块重构
2. TUI：
   - 主视图 / status console / section navigation 的第一版
3. Onboarding：
   - 流程与文案、状态输出、下一步建议的重构
4. Terminal：
   - status / doctor / first-run / daemon 体验至少部分升级
5. Design system：
   - 至少建立 token / component / surface 的初版结构

### 验收标准
- 不是只有计划、没有界面
- 至少要出现可审计的真实 UI / TUI / onboarding / CLI 产品化变化

---

# G10. Documentation / Design Artifacts / Readability Contracts

### 必须完成
1. 输出新的 UI / TUI / onboarding / terminal 设计文档
2. 输出 IA / page map / surface map / copy contract
3. 若有设计图、线框、组件草图、状态图，尽量一并落地
4. 为下一轮审计提供可核对文档依据

### 验收标准
- 后续审计时能区分：
  - 宣称实现了什么
  - 实际界面有什么
  - 数据来自哪里
  - 交互路径如何成立

---

## 四、强制设计要求

### D1. 必须“明显优于 V1”
不是轻微美化，而是：
- 更完整
- 更统一
- 更高级
- 更符合 V2 的系统层级
- 更像 Web4 runtime control plane

### D2. 必须“明显适配 V2 当前功能现实”
不能为了视觉而伪造能力：
- 没有的能力不能装作有
- 没有的控制路径不能用 UI 硬演
- 没有的 summary / truth source 不得假设存在

### D3. 必须“更像 web4.ai 的气质，但不是 marketing page”
即：
- 高级
- 未来感
- 生命体叙事
- 仪式感
- 强存在感
但同时：
- 高信息密度
- 强控制面
- 可观测
- 可操作
- 可验证

### D4. 必须“WebUI / TUI / onboarding / terminal 是一体的”
不是四条互不相干的设计线。

### D5. 必须“首页是 Presence，不是功能汇总”
这是本轮核心约束。

---

## 五、本轮必须回答的问题

### Q1. V2 的控制平面是否已经从 V1 式旧 dashboard 结构真正升级？
### Q2. 新 WebUI 是否已经具备属于 V2 的独特系统气质？
### Q3. TUI 是否已经从“文本状态页”升级为独立的 control plane？
### Q4. onboarding 是否已经从“配置过程”升级为“首次唤醒体验”？
### Q5. terminal install / status / doctor / daemon 是否已经具备产品级体验？
### Q6. WebUI / TUI / onboarding / terminal 是否真的共享同一套设计语言与系统语义？

---

## 六、本轮强制验收矩阵

### V1. V1 已被参考吸收，但未被原样继承
### V2. web4.ai 只被作为气质参考，而不是结构照抄
### V3. 新首页已具备 Presence / Truth / Intervention 三层结构
### V4. WebUI IA 已重构为符合 V2 的控制平面结构
### V5. TUI 已具备独立控制面价值
### V6. onboarding 已形成统一首次体验路径
### V7. terminal 体验已显著升级
### V8. 至少有一批真实可审计实现落地
### V9. 文档、界面、命令、术语彼此对账
### V10. 全量核心测试必须继续保持全绿

---

## 七、本轮非目标

本轮不做：
- 不回头大规模重开核心生命体能力主线
- 不把发布包装重新抬成唯一目标
- 不做纯概念视觉 demo
- 不做只有图没有产品结构的空设计
- 不用伪实现替代真实可审计界面

本轮真正目标是：

> **把 ConShell V2 的 operator surface 真正做出来，并让它在视觉、信息架构、交互、终端体验、首次体验上形成统一的新一代控制平面。**

---

## 八、真实性不变量

1. **视觉升级不等于产品升级，必须有真实 IA 与真实交互改造**
2. **参考 V1 不等于继承 V1 的局限**
3. **参考 web4.ai 不等于做 marketing page**
4. **首页必须先表达“存在状态”，再表达“功能入口”**
5. **UI 不能伪造 runtime truth；必须绑定真实 surface**
6. **TUI 必须是独立产品面，不是附属状态输出**
7. **onboarding 必须解释系统，不只是写配置**
8. **terminal 体验必须具有产品感，而不是工程师内部工具感**
9. **本轮必须留下足够强的可审计证据：代码、界面、文档、命令输出、测试**

---

## 九、本轮完成后必须输出

### A. Round 19.5 详细真实性审计材料基础
### B. WebUI 新信息架构与首屏控制面说明
### C. TUI 主控制面设计与实现说明
### D. onboarding 统一体验说明
### E. terminal install / first-run / doctor / status / daemon 体验说明
### F. 统一设计语言 / 术语 / 组件与页面映射说明
### G. 若仍有不足，最后一版 UI / UX / interaction polish gap list

---

## 十、一句话任务定义

> **Round 19.5 的目标是：参考 V1 的设计资产、吸收 web4.ai 的视觉与叙事气质，并结合 V2 当前真实运行时能力，打造并落地一个真正属于 ConShell V2 的 cinematic operator control plane，统一完成 WebUI、TUI、onboarding 与 terminal 安装/使用体验的设计与首批实现。**
