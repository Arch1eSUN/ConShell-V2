# DevPrompt 0209 — Round 19.9
## Green Recovery / Truth-Action Closure / Release Discipline

你现在处于 **ConShellV2 Round 19.9**。

Round 19.8 做对了一件关键事情：

> **Agenda 已经从“前端展示层的半真相”升级为 canonical backend truth surface。**

这是正确的主链推进。

但 19.8 也暴露出一个不可忽视的问题：

> **功能主线推进成立，但验证收口失败。**

最新独立审计结论明确显示：
- CLI TypeScript：通过
- Dashboard TypeScript：通过
- Dashboard build：通过
- 但 `packages/core` 全量测试：**1 个文件失败 / 10 个测试失败**
- 根因：`AgentPostureService` 新增 `agenda` provider contract 后，`agent-posture-service.test.ts` 的测试夹具未同步更新

因此 19.9 的第一原则非常明确：

> **不能继续在非全绿状态下往前冲。**

19.9 必须先把系统从“主线对了但验证失配”拉回到：

> **truth surface 正确 + tests 全绿 + actionability 继续收口 + release discipline 建立**

一句话：

> **Round 19.9 的目标，是完成一次 Green Recovery，把 19.8 的 canonical truth 推进修到真正 fully green，并继续把 truth → action 闭环与发布纪律收紧。**

---

## 一、本轮唯一总目标

**先恢复全绿，再继续前推。**

具体是：
1. **修复 19.8 引入的测试失配，恢复 core 全绿**
2. **建立更强的 truth-surface contract discipline，避免再出现“类型过了、核心测试炸了”的情况**
3. **继续推进 truth → action 的闭环，让关键 truth 不只是可见，而且更可操作**
4. **建立更接近 release-ready 的验证纪律与交付标准**

---

## 二、19.9 的战略判断

### P0. 现在最大的风险不是功能方向错误，而是“继续在不全绿状态下向前堆”
这会迅速制造新的验证债。

### P1. 19.9 必须把“验证纪律”提升到和“truth surface”同等重要
如果一个关键 canonical contract 变了：
- tests
- fixtures
- typed client
- docs/contracts
- CLI/TUI/UI consumers
都必须同步对账。

### P2. 19.9 不是只修测试
如果只修测试而不补 contract discipline，那么下一轮还会重复犯同类错误。

---

## 三、本轮必须一次性完成的内容

# G1. Green Recovery：恢复 `packages/core` 全量测试全绿

这是本轮第一优先级，且必须先完成。

### 当前明确失败点
- `src/api-surface/agent-posture-service.test.ts`
- 因为新增 `agenda` provider 后 fixture 未同步

### 本轮必须完成
1. 修复 posture service tests
2. 所有相关 fixture / mock provider / helper 同步补齐 `agenda`
3. 如果 posture scoring 语义因 agenda 维度引入而变化，测试断言也要按真实 contract 更新
4. 重新跑 `packages/core` 全量测试直到全绿

### 验收标准
- `packages/core` 恢复：
  - **87/87 files passed**
  - **1813/1813 tests passed**（或若测试数变化，则必须解释变化来源）

---

# G2. Truth Surface Contract Discipline

19.8 暴露的问题本质上是 contract change discipline 不够硬。

### 本轮必须完成
1. 为 posture / summary / agenda truth contract 建立更明确的更新纪律
2. 检查所有依赖 `AgentPosture` / `SystemSummary` 的消费者
3. 确保以下层全部对齐：
   - core provider contracts
   - posture service tests
   - API route payloads
   - frontend typed client
   - TUI/CLI consumers
4. 若缺 contract tests，补上最关键的一层

### 验收标准
- 下次新增 truth dimension 时，不会再出现“核心测试夹具漏跟”的低级失配

---

# G3. Truth → Action Closure 第二轮

19.8 已有 Inspect 跳转，但 actionability 仍偏轻。

### 本轮必须完成
在不引入高风险 uncontrolled write 的前提下，继续增强最小操作：
- inspect deferred commitments
- jump to doctor / diagnostics
- export posture from operator surface
- inspect agenda factors / economic gate
- context-aware actions from truth cards

### 验收标准
- 至少一组关键 truth card 达到：
  - visible
  - canonical
  - explainable
  - actionable

---

# G4. Doctor / Diagnostics / Export 的产品化接线

19.8 已把工具注册进 kernel，但还需要更好接到 control plane。

### 本轮必须完成
1. 明确 `doctor` 与 `export_posture` 在 WebUI / CLI / TUI 中的入口策略
2. 如果还只是内核工具，补一个 operator-facing path
3. 让 operator 更容易从真相面进入 diagnostics
4. 让 machine-readable posture export 有清晰用途和入口

### 验收标准
- 这两个工具不再只是“已注册”，而是更接近“可被操作者自然使用”

---

# G5. Remaining Truth Hardening

Agenda truth 已 canonicalize，但其他维度仍可继续收口。

### 本轮必须完成
检查并强化以下 truth surface：
- agenda
- economic
- governance
- continuity/identity

重点检查：
1. 是否还有隐式 fallback/default 伪装主事实来源
2. 是否还有字段漂移
3. 是否还有某个 surface 落后于 canonical contract
4. 是否还有 stale/error/degraded 语义不清的地方

### 验收标准
- truth surface 更稳定、更一致、更少临时性补丁感

---

# G6. Release Discipline / Verification Contract

从 19.9 开始，不应再接受“功能做完但测试炸了还宣称完成”。

### 本轮必须完成
1. 明确本项目 round completion 的最低验证标准
2. 建立 release checklist / audit checklist
3. 把“必须全绿”写进本轮交付纪律
4. 若有必要，补脚本或文档让验证更标准化

### 验收标准
- 后续每轮“完成”都更接近可签收状态，而不是半完成口头播报

---

## 四、本轮强制执行纪律

### D1. 不允许在 core 非全绿状态下继续宣称 fully complete
### D2. 不允许只修表面测试，不修 contract discipline
### D3. 不允许新增 truth/action 能力但不补验证
### D4. 不允许用文档解释代替真实修复
### D5. 继续保持 CLI tsc / dashboard tsc+build / core tests 全健康

---

## 五、本轮必须回答的问题

### Q1. `packages/core` 是否已恢复全绿？
### Q2. posture/summary/agenda contract 的 consumers 是否已真正对齐？
### Q3. truth → action 闭环是否比 19.8 更完整？
### Q4. doctor/export_posture 是否从“已注册”更进一步变成“可自然使用”？
### Q5. round completion 的 release discipline 是否已建立？

---

## 六、本轮强制验收矩阵

### V1. core tests 恢复全绿
### V2. CLI tsc / dashboard tsc+build 继续通过
### V3. posture/summary/agenda truth contract 对齐更完整
### V4. 至少一组 truth card 达到更完整的 actionability
### V5. doctor/export_posture 具有更清晰 operator-facing 入口
### V6. release/verification discipline 有明确产物

---

## 七、一句话任务定义

> **Round 19.9 的目标是：先完成 Green Recovery，恢复 core 全绿；再把 19.8 已 canonicalize 的 truth surface 进一步收口为可解释、可操作、可验证、可发布的 control plane 主链。**
