# DevPrompt 0204 — Round 19.4
## Final Polish / Installability / Operator Experience / UI Design Readiness

你现在处于 **ConShellV2 Round 19.4**。

到当前最新审计基线为止，ConShell V2 的项目状态已经进入：

> **终局收口 / 审计主导 / 打磨前期阶段**

当前最新全局审计口径：
- `packages/core` 全量测试：**87/87 test files、1813/1813 tests、0 failures**
- 核心主干状态：**G1–G6 基本闭合，项目约 90% 完成（置信度：中）**
- 当前剩余问题不再主要是“核心生命体能力缺失”，而主要是：
  - 统一性
  - 对账
  - polish
  - operator experience
  - installability
  - onboarding
  - UI / TUI / Web surface readiness

因此 Round 19.4 的目标不再是继续大规模发明新主线，而是：

> **把系统一次性打磨到“可以开始前端 WebUI 设计、TUI 设计、onboard 设计、terminal 指令安装体验设计”的状态。**

更准确地说：
- 19.4 不是“前端实现轮”
- 也不是“发布轮”
- 而是：

> **UI / UX / Installability / Operator Experience Readiness Closure**

即：
- 在真正开始设计 WebUI / TUI / onboarding 之前
- 先把底层能力、接口语义、安装体验、控制面入口、operator truth、terminal 命令体验、对外 surface 统一打磨到足够稳定
- 让后续的前端与交互设计建立在**稳定、真实、统一、可安装、可操作**的基础之上

---

## 一、本轮唯一总目标

**一次性把 ConShell 打磨到可以正式开始：WebUI 设计、TUI 设计、onboard 设计、terminal 指令安装与使用体验设计。**

一句话解释：

> **19.4 的本质不是继续补核心生命体主干，而是让系统进入“可设计、可安装、可上手、可展示、可运营”的 readiness 状态。**

---

## 二、本轮战略定位

### P0. Readiness Before Interface Rule
在开始任何正式前端 / 交互 / onboarding 设计之前，必须先保证：

1. 核心 runtime truth 已统一
2. operator-facing surface 已稳定
3. terminal / CLI / installability 体验足够清晰
4. WebUI / TUI 所依赖的数据与控制面已可消费
5. onboarding 所需的系统姿态、健康状态、安装路径、首次使用路径已可被描述与验证

也就是说：

> **不要在底层语义还漂浮时直接做 UI。**

19.4 要先把“接口与体验底板”打磨好。

---

## 三、本轮必须一次性完成的内容

# G1. Final Consistency / Canonical Surface Cleanup

这是 19.4 的基础前提。

### 必须完成
1. kernel / runtime / governance / economic / collective / posture / session control 相关语义名统一
2. 状态名、receipt 名、health verdict 名、posture 名、audit event 名统一
3. 文档、测试、API surface、runtime 实际行为对账
4. 清理剩余 legacy path / bypass / 临时桥接逻辑
5. 确保 UI / TUI 不会建立在不稳定命名与漂移语义之上

### 验收标准
- 关键 surface 的命名与行为足够稳定，可被 UI / TUI 直接消费

---

# G2. Operator Truth Surface Final Polish

### 必须完成
1. `AgentPostureService` 输出结构稳定化
2. posture / history / health 三条 API 的字段对账与语义说明补齐
3. identity / governance / economics / collective / autonomy posture 的字段边界稳定化
4. 对外 truth surface 统一成可供：
   - WebUI
   - TUI
   - onboarding
   - operator dashboard
   消费的 canonical contract
5. 若缺统一 schema / response shape / typing，则本轮补齐

### 验收标准
- 前端 / TUI 设计者可以基于 posture surface 开始做界面，不需要继续猜语义

---

# G3. Installability / Terminal Command Readiness

这是你这次明确提出的重点之一。

### 必须完成
1. terminal 安装路径梳理清楚：
   - 安装前提
   - 安装命令
   - 初始化命令
   - 启动命令
   - 常用运维命令
2. `terminal 指令安装` 与 `使用入口` 形成清晰流程
3. 失败路径 / 缺依赖 / 常见错误提示打磨
4. 安装后的 first-run experience 明确
5. CLI / terminal 的控制入口要足够适合 onboarding 与 UI 文案引用
6. 若当前命令体验零散或不一致，本轮统一

### 本轮不要求
- 不是正式发布包装终局
- 但必须达到：**可进入安装体验设计与 terminal onboarding 设计**

### 验收标准
- 新用户可以被清楚引导完成安装、启动、查看状态、进入首次使用

---

# G4. TUI Design Readiness Closure

### 必须完成
1. 明确 TUI 未来需要消费的 canonical runtime surfaces：
   - posture
   - health
   - sessions
   - collective
   - governance summary
   - economic summary
   - activity / audit
2. 明确 TUI 的核心主视图信息边界
3. 明确 TUI 应使用的命令入口与交互原语
4. 若缺 TUI 所需的 summary API / status API / aggregate view，本轮补齐
5. 保证 terminal first experience 与未来 TUI 设计兼容

### 验收标准
- 19.4 后可直接开始 TUI 信息架构与交互设计，不必先补底层 surface

---

# G5. WebUI Design Readiness Closure

### 必须完成
1. 明确 WebUI 所依赖的 canonical surface：
   - posture
   - health
   - governance
   - economics
   - collective
   - session/control
   - runtime activity / audit
2. 若当前 API 对 WebUI 不友好，需要补 summary / aggregation / history / health endpoints
3. 确保 WebUI 不需要穿透内部实现细节才能展示系统状态
4. 梳理“WebUI 首屏该看到什么”的系统级信息边界
5. 为后续仪表盘 / 控制面 / operator console 设计提供稳定数据底板

### 验收标准
- 19.4 后可正式开始 WebUI 设计，而不是继续补 API 语义

---

# G6. Onboarding Design Readiness Closure

这是本轮另一个重点。

### 必须完成
1. 梳理新用户首次接触 ConShell 的最小路径：
   - 安装
   - 启动
   - 查看系统状态
   - 认识系统当前 posture
   - 完成 first useful action
2. 梳理首次启动 / 首次诊断 / 首次自检 / 首次连接控制面的路径
3. 明确 onboarding 所需的系统文案对象：
   - 你是谁
   - 系统当前健康状态如何
   - 可以做什么
   - 下一步应该做什么
4. 若缺失 onboarding 所需的 runtime summary / setup summary / doctor summary，本轮补齐
5. 为未来 WebUI onboarding、TUI onboarding、terminal onboarding 提供统一语义底板

### 验收标准
- 19.4 后可以开始真正设计 onboarding flow，而不是继续猜底层逻辑

---

# G7. API / Summary / Control Surface Readiness

### 必须完成
1. 对未来 UI / TUI / onboarding / operator 使用最重要的 surface 做 summary 化
2. 避免前端直接依赖过深内部对象
3. 若缺：
   - system summary
   - operator summary
   - runtime summary
   - health summary
   - install / readiness summary
   则本轮补齐
4. 确保控制面具备“设计友好”的可消费接口

### 验收标准
- 不需要前端去拼十几个底层接口才能画出核心界面

---

# G8. UX Copy / System Language Readiness

这不是营销 copy，而是系统级交互语言打磨。

### 必须完成
1. 统一核心术语：
   - posture
   - health
   - vitality / viability
   - autonomy
   - governance
   - collective
   - session fabric
   - wake
2. 明确终端 / UI / onboarding 中应使用的系统文案口径
3. 去掉会误导用户的术语与不一致命名
4. 建立未来 UI 文案、CLI 帮助文案、onboarding 文案的统一来源

### 验收标准
- 进入设计阶段时不会因为命名漂移而返工

---

# G9. Final Readiness Audit

### 必须完成
1. 本轮完成后重新判断：
   - 是否可以开始 WebUI 设计
   - 是否可以开始 TUI 设计
   - 是否可以开始 onboarding 设计
   - 是否可以开始 terminal 安装体验设计
2. 若答案为否，必须明确指出阻塞项
3. 若答案为是，必须正式给出 readiness 结论
4. 本轮结束后应能把下一阶段切换为：
   - WebUI design
   - TUI design
   - onboarding design
   - install/CLI experience design

### 验收标准
- 不再模糊说“差不多可以设计了”
- 而是给出明确 yes/no readiness 结论

---

## 四、本轮必须回答的问题

### Q1. ConShell 是否已经被打磨到足以开始 WebUI 设计？
### Q2. ConShell 是否已经被打磨到足以开始 TUI 设计？
### Q3. ConShell 是否已经被打磨到足以开始 onboarding 设计？
### Q4. ConShell 是否已经被打磨到足以开始 terminal 安装与命令体验设计？
### Q5. 如果还不够，最后的真实阻塞项是什么？

---

## 五、本轮强制验收矩阵

### V1. 核心 surface 命名、字段、语义已统一到可设计状态
### V2. posture / health / history / control 相关 API 已达到设计可消费状态
### V3. terminal 安装与 first-run 路径已达到可设计状态
### V4. WebUI / TUI / onboarding 设计不再依赖继续补底层语义
### V5. 全量核心测试必须继续全绿
### V6. 本轮后必须能明确切换到 UI / UX / onboarding / install design 阶段

---

## 六、本轮非目标

本轮不做：
- 不重新开生命体核心主线
- 不把发布抬成主线
- 不直接开始大规模 UI 实现
- 不在底层语义未稳前先做表面界面

本轮真正目标是：

> **把系统打磨到“可以放心开始设计界面、终端体验、onboarding、安装体验”的状态。**

---

## 七、真实性不变量

1. **不能因为想做 UI，就跳过底层 surface 稳定化**
2. **不能因为 API 存在，就误判为“设计就一定能开始”**
3. **terminal installability 必须可被真实描述与验证**
4. **WebUI / TUI / onboarding 的 readiness 必须基于真实接口与真实操作路径**
5. **本轮结束后，应给出明确 readiness verdict，而不是模糊乐观判断**

---

## 八、本轮完成后必须输出

### A. Round 19.4 详细真实性审计
### B. Installability / terminal command readiness 结论
### C. WebUI readiness 结论
### D. TUI readiness 结论
### E. onboarding readiness 结论
### F. 若仍有阻塞，最后一版 readiness blocking list

---

## 九、一句话任务定义

> **Round 19.4 的目标是：一次性把 ConShell 打磨到可以正式开始 WebUI 设计、TUI 设计、onboarding 设计、terminal 指令安装与使用体验设计的状态。**
