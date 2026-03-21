# DevPrompt 0207 — Round 19.7
## Product Polish / Performance / Parity / Lifeform Closure

你现在处于 **ConShellV2 Round 19.7**。

Round 19.6 已完成一次真实的 canonical closure：
- 顶层 6-plane control plane IA 已迁移
- Presence 首页已成为 V2 canonical 首页
- `conshell tui` 已真实落地
- CLI 的 Presence-first 语言已统一
- V1 旧首页骨架已清理
- core 测试 / CLI typecheck / dashboard build 全通过

这意味着：

> **ConShell 已经从“过渡结构尚未收口”推进到“canonical product surface 已基本成立”的阶段。**

因此 19.7 不再继续解决“顶层结构有没有迁完”的问题。
19.7 要做的是更难的一步：

> **把已经成立的 canonical product surface，继续打磨成更成熟、更快、更一致、更接近终局生命体产品的控制平面。**

一句话：

> **Round 19.7 的目标不是再做大迁移，而是把 19.6 已收口的主骨架，推进到产品完成度、跨 surface 一致性、性能、自治闭环可见性和 operator 体验的下一层。**

---

## 一、本轮唯一总目标

**在不破坏 19.6 canonical closure 成果的前提下，完成一次面向“产品成熟度 + 性能 + parity + lifeform closure visibility”的强化轮。**

重点是 5 件事：
1. **Product polish：把 canonical 控制面打磨到更成熟的产品完成度**
2. **Performance：解决 dashboard 明显的 bundle/chunk 膨胀问题**
3. **Parity：增强 WebUI / TUI / CLI / onboarding 的语义与能力对齐**
4. **Lifeform closure visibility：把 economic / agenda / governance / continuity 终局主线更清楚地暴露给 operator**
5. **Remaining debt cleanup：清掉 19.6 后仍残留的次级结构债与一致性债**

---

## 二、19.7 的战略判断

### P0. 19.6 的问题已经不是“没迁”，而是“迁完后还不够成熟”
19.6 之后，项目的主要矛盾已经变化：
- 顶层结构已经基本对了
- 现在更重要的是：
  - 页面内部是否足够成熟
  - 多 surface 是否真的对齐
  - 性能是否达标
  - 生命体核心闭环是否能被 operator 更清楚地观察和控制

### P1. 19.7 不是 cosmetic polish
本轮不允许退化成：
- 改点边角样式
- 调几句文案
- 补几张卡片

本轮要做的是：
- **成熟度提升**
- **性能提升**
- **产品一致性提升**
- **终局主线可见性提升**

### P2. 19.7 也不是新开宏大主线
本轮不要再无节制开新系统。
本轮要优先做的是：
- 强化已有主链
- 暴露已有真相
- 优化已有产品面
- 收掉已有 debt

---

## 三、本轮必须一次性完成的内容

# G1. Dashboard Performance & Bundle Discipline

19.6 构建已通过，但当前 dashboard build 明确出现：
- **chunk > 500kB** 告警
- 主 bundle 体积偏大

这已经不是可忽略的小问题。

### 本轮必须完成
1. 分析 dashboard 当前 bundle 膨胀来源
2. 通过 dynamic import / route-level split / manual chunks / provider lazyization 等手段显著优化包体
3. 尽量减少非首页关键路径的首屏负担
4. 如果 web3 / wallet / heavy component 不是首屏必需，应延迟加载
5. 产出明确的优化前后对比证据

### 验收标准
- 构建仍通过
- chunk warning 明显改善，或至少有实质性下降并有合理解释
- 首页关键路径更轻

---

# G2. Product Parity Across WebUI / TUI / CLI / Onboarding

19.6 已经打通了这些 surface，但还未证明它们达到了成熟 parity。

### 本轮必须完成
1. 对齐 WebUI / TUI / CLI 的术语、状态词、字段优先级
2. 确保 Presence / Runtime / Governance / Survival / Collective / Operator 语义贯穿所有入口
3. onboarding 完成度继续前推，使其与现有 control plane 语言一致
4. status / tui / dashboard 首页 的真相排序应高度一致
5. 找出并消除术语漂移、字段漂移、文案冲突

### 验收标准
- 同一事实在不同 surface 的表达不再显著割裂
- Onboarding 不再像孤立的安装流程，而是 control plane 的第一入口

---

# G3. Presence & Plane Interior Polish（不是顶层迁移，而是内部成熟度）

顶层 IA 已收口，下一步是每个 plane 内部质量提升。

### 本轮必须完成
1. Presence 页面进一步提高层次、节奏、信息压缩效率
2. 检查 Runtime / Governance / Survival / Collective / Operator 各 plane 的内部一致性
3. 对 still-rough 的二级页面进行必要打磨
4. 明确哪些页面仍是“旧内容挂到新 plane 下”，并提升其质量
5. 完善空状态、错误状态、加载状态、降级状态

### 验收标准
- 不再只是“顶层分组是对的”，而是 plane 内部也更像完整产品

---

# G4. Lifeform Closure Visibility

这是 19.7 的高杠杆项。当前很多生命体主线已经有实现，但 operator 仍未必看得够清楚。

### 本轮必须完成
把以下主线在 control plane 上暴露得更清楚：
1. **Economic closure**
   - survival pressure
   - runway / burn / reserve / self-sustaining
   - settlement influence / agenda influence
2. **Agenda / autonomy**
   - what is scheduled
   - what is deferred
   - what is being prioritized
   - why
3. **Governance pressure**
   - pending proposals
   - self-mod status
   - quarantine / risk / approval trace
4. **Continuity / identity**
   - whether the same self is persisting
   - whether memory/continuity is healthy

### 验收标准
- operator 不仅知道系统“活着”，还更清楚知道它为什么这样行动、受什么约束、在朝什么方向推进

---

# G5. TUI 第二层成熟度

19.6 已经证明 TUI exists。19.7 要证明 TUI is useful.

### 本轮必须完成
1. 提升 TUI 的信息布局与可读性
2. 增加更明确的 operator cues / hints / refresh feedback
3. 如有必要，增加视图切换或小规模交互增强
4. 保持 TUI SSH-friendly，不做噪音炫技
5. 尽量让 TUI 不只是 summary mirror，而是具备独立日常使用价值

### 验收标准
- TUI 从“已实现第一版”升级到“有明显实用价值的控制面”

---

# G6. Onboarding 继续从“可用”走向“可信首次唤醒体验”

19.6 主要收口了控制面主骨架；19.7 需要把 onboarding 进一步纳入整套体验。

### 本轮必须完成
1. 用 canonical 6-plane 语义重检 onboarding 文案与流程
2. 强化 first-run 解释：
   - 系统是什么
   - 当前状态是什么
   - 下一步做什么
3. 补强失败路径 / 降级提示 / next-step 引导
4. 让 onboarding 与 dashboard / tui / status 的语言一致

### 验收标准
- onboarding 更像正式的 lifeform activation experience

---

# G7. Debt Cleanup After Canonical Migration

19.6 做了大量迁移，19.7 必须处理迁移后的遗留细节债。

### 本轮必须完成
1. 检查残留旧命名、旧标签、旧路由心智模型
2. 检查注释、文档、contracts 是否已同步
3. 检查页面、组件、API 字段是否存在迁移后不一致
4. 列出仍不能一轮解决的真实 debt，并明确标记

### 验收标准
- canonical migration 不只是看上去完成，而是后续维护成本明显下降

---

## 四、本轮强制执行纪律

### D1. 不允许破坏 19.6 已完成的 canonical structure
### D2. 不允许为了性能优化把控制面语义打散
### D3. 不允许为了“快”引入新一轮结构混乱
### D4. 不允许忽视 bundle 警告
### D5. 不允许只做表层 polish 而不提升 operator clarity
### D6. 核心测试、typecheck、dashboard build 继续必须通过

---

## 五、本轮必须回答的问题

### Q1. Dashboard 性能是否明显改善？
### Q2. WebUI / TUI / CLI / onboarding 是否更接近真正 parity？
### Q3. 各 plane 内部是否比 19.6 更成熟？
### Q4. economic / agenda / governance / continuity 是否更清楚地暴露给 operator？
### Q5. TUI 是否从“已存在”升级为“更有用”？
### Q6. canonical migration 之后的残余 debt 是否被有效收口？

---

## 六、本轮强制验收矩阵

### V1. Dashboard build 继续通过，且性能/包体有明确优化证据
### V2. 各 surface 术语与状态表达更一致
### V3. Presence 与其他 planes 的内部成熟度明显提升
### V4. TUI 有第二层实用性提升
### V5. Onboarding 更像正式 first awakening experience
### V6. economic/agenda/governance/continuity 可见性明显增强
### V7. 残余迁移 debt 被系统清理
### V8. core tests / cli typecheck / dashboard build 继续健康

---

## 七、一句话任务定义

> **Round 19.7 的目标是：在 19.6 canonical closure 的基础上，把 ConShell 的 control plane 推向更成熟的产品完成度、更好的性能、更强的跨 surface parity，以及更清晰的生命体闭环可见性。**
