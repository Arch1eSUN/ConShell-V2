# DevPrompt 0195 — Round 18.5
## Monorepo Publish Train Closure / CLI Packaging / Consumer Smoke / Release Gate Execution

你现在处于 **ConShellV2 Round 18.5**。

Round 18.4 已经完成了非常关键的一步：
- 全仓测试已从非全绿推进到 **76 files / 1726 tests / 0 failures**
- 依赖与旧 route-count 问题已不再阻塞主线
- `@conshell/core` 已可 build 且可 `npm pack --dry-run`
- stable / beta / experimental / internal-only 的模块分级方向已出现
- 18.x economic chain 被标记为 `beta`，这是合理的

但 18.4 的详细审计也得出了一个关键现实结论：

> **18.4 更准确地说是“core package release readiness 基本成立”，而不是“整个 monorepo 已经 fully GO for npm publish”。**

原因非常明确：
- 根仓库包仍然 `private: true`
- 根目录 pack 出来的是仓库级大包，不是面向消费者的干净发布物
- `packages/cli` 的 `npm pack --dry-run` 仍然失败
- “到底首发发什么、哪些包发、哪些包不发、发包顺序是什么”还没有被真正收口
- consumer install/import/run smoke 还没有被完整证明

这意味着：

> **ConShell 离“可以发 npm”还差最后一个现实层：真正的发布列车闭口。**

因此，Round 18.5 的任务不是再做新的功能主线，
而是要把：

- core
- cli
- root
- dashboard
- docs
- 发布流程
- install smoke
- release gates

收成一个真实可执行的 npm 发布方案。

---

## 一、本轮唯一主目标

**完成 Monorepo Publish Train Closure，使 ConShell 从“core package 接近 RC”推进到“发布对象、发布顺序、发布验证、发布门禁全部清晰且可执行”的真实上线状态。**

一句话解释：

18.4 解决的是“系统能不能测通、build 通、core pack 通”；
18.5 必须解决的是：

> **到底什么能发、怎么发、先发哪个、谁不该发、以及发出去以后用户能不能真的装起来跑。**

---

## 二、本轮必须回答的核心问题

### Q1. 本次 npm 首发的真正发布对象是什么？
是：
- 只发 `@conshell/core`
- 发 `@conshell/core` + CLI
- 还是还有其他包

如果这个问题不先收口，发布动作就会持续含混。

### Q2. `packages/cli` 为什么 pack 失败？
如果 CLI 要首发，这就是 release blocker。
如果 CLI 不首发，也必须正式写进发布策略，而不是默认含糊带过。

### Q3. 根包是否永远保持 `private: true`？
如果是，就必须在 release train 中正式定义为：
- monorepo orchestrator package only
- not a publish artifact

### Q4. Dashboard / docs / DevPrompt / audit 是否应该进入任何 npm 发布工件？
如果不应该，必须从发布语义上彻底隔离，而不是仅依赖“没被碰巧带进去”。

### Q5. npm 首发的 consumer 契约到底是什么？
用户安装之后：
- 怎么 import
- 怎么 run
- 什么是 stable
- 什么是 beta
- 哪些面是 experimental

都必须清楚。

---

## 三、本轮必须完成的内容

# G1. Publish Target Matrix

本轮必须建立正式的发布对象矩阵。

### G1.1 至少明确以下对象的发布角色
- monorepo root
- `packages/core`
- `packages/cli`
- `packages/dashboard`
- docs / audit / DevPrompt artifacts

### G1.2 每个对象必须标注
- `publishable: yes/no`
- `packageName`
- `targetChannel`（npm / internal / web deploy / none）
- `releaseTier`（stable / beta / experimental / internal-only）
- `currentStatus`（blocked / candidate / ready）

### G1.3 原则
不允许再出现“代码看起来能发，但实际上没人说清到底哪个包要发”。

### G1.4 目标
让发布对象边界一次性收口。

---

# G2. CLI Packaging Closure

如果 CLI 要进入首发发布列车，本轮必须把 CLI packaging 真正修通。

### G2.1 必须定位并解决
- `packages/cli` `npm pack --dry-run` 失败问题
- bin / exports / shebang / dependency / files / dist layout 问题
- clean install 后 CLI 是否可执行

### G2.2 如果决定 CLI 不首发
则必须：
- 正式把 CLI 标记为 non-release / deferred package
- 从当前 RC 判定中移除
- 在文档与 blocker manifest 中明确说明原因

### G2.3 目标
CLI 不能继续处于“默认也算要发，但实际又打不出来”的模糊状态。

---

# G3. Consumer Smoke Verification

本轮必须从“仓内自测成功”升级到“消费者视角可用”。

### G3.1 至少完成以下 smoke tests
#### 对 core 包
- tarball install smoke
- import smoke
- minimal runtime bootstrap smoke
- selected public APIs smoke

#### 对 CLI（若进入首发）
- tarball/global install smoke
- bin invocation smoke
- `--help` / minimal command smoke
- config resolution smoke（若适用）

### G3.2 必须在 clean temp 环境中验证
- 不依赖当前仓内隐式上下文
- 不依赖未声明本地模块
- 不依赖 workspace magic 才能运行

### G3.3 目标
证明发布出去后用户不是装一个炸一个。

---

# G4. Release Gate Formalization

本轮必须把 RC / publish gate 形式化。

### G4.1 至少建立 gate 对象
- `buildGate`
- `testGate`
- `packGate`
- `consumerSmokeGate`
- `docsGate`
- `publishApprovalGate`

### G4.2 每个 gate 至少记录
- `status`
- `evidence`
- `owner`
- `lastVerifiedAt`
- `blocking`

### G4.3 必须输出
- 当前对 `@conshell/core` 是否达到 RC
- 当前对 CLI 是否达到 RC
- 当前是否允许执行 `npm publish --tag beta` 或等价流程

### G4.4 目标
把“GO / NO-GO”从口头判断变成证据化 gate。

---

# G5. Root Package & Monorepo Semantics Closure

必须明确根包的最终语义。

### G5.1 若 root 继续 `private: true`
则必须明确：
- root 仅作为 monorepo orchestrator / workspace shell
- root 不参与 npm 发布
- root pack 结果不作为 release 证据

### G5.2 必须避免
- 把仓库级文档 / DevPrompt / 审计文件意外视为发布物
- 因为根目录 pack 成功而误判“整个项目已可发布”

### G5.3 目标
彻底切断“根仓打包成功 ≠ 产品包可发布”的误导。

---

# G6. Public Contract Hardening for `@conshell/core`

如果 core 是首发主包，本轮必须把它的 public contract 再收一层。

### G6.1 必须明确
- 哪些 exports 是 public
- 哪些 exports 属于 beta
- 哪些内部模块不能再通过 package surface 暴露

### G6.2 建议新增/完善
- `public-api-manifest`
- stable/beta export map
- smoke-tested import list

### G6.3 目标
避免 npm 发布后 public API 继续漂移过快或意外暴露深层 internal modules。

---

# G7. Release Documentation for Real Consumers

本轮必须把文档从“内部项目文档”升级到“真实 npm 消费者文档”。

### G7.1 至少要有
- `@conshell/core` 安装说明
- 最小 import / bootstrap 示例
- 若 CLI 首发，则 CLI 安装与使用说明
- stable / beta / experimental 使用边界
- known limitations
- release notes draft

### G7.2 必须明确
- 首发版本承诺什么
- 不承诺什么
- 经济链为何是 beta
- 哪些高级生命体能力仍未稳定

### G7.3 目标
不要让外部用户安装后才发现项目预期与实际能力边界完全不清楚。

---

# G8. Publish Simulation

本轮必须尽可能接近真实发布动作。

### G8.1 至少完成
- `npm pack` / tarball installation simulation
- publish metadata verification
- package name / version / files / access / tag strategy 检查

### G8.2 若允许，可准备但不一定执行真实 publish
- `npm publish --dry-run` 或等价验证
- beta tag strategy
- rollback / yank / deprecate strategy draft

### G8.3 目标
让“上线”从抽象口号变成具体可执行剧本。

---

# G9. Release Strategy for 19.x+

18.5 除了完成当前 RC gate，还必须给后续版本策略留好口。

### G9.1 至少明确
- `0.1.0-beta` / `0.1.0-rc` / `0.1.0` 的节奏
- 哪些高级能力留到 19.x
- 哪些 experimental surfaces 保持不稳定

### G9.2 目标
防止为了“快上线”把后续 roadmap 彻底打乱。

---

## 四、本轮强制验收矩阵

### V1. 发布对象矩阵已建立，core / cli / root / dashboard 的发布角色无歧义
### V2. CLI pack failure 被修复，或被正式排除出当前首发发布列车
### V3. root package 的 private / non-publish 语义被正式收口
### V4. `@conshell/core` tarball install/import/bootstrap smoke 验证通过
### V5. 若 CLI 首发，则 CLI install/bin/help smoke 验证通过
### V6. release gates（build/test/pack/smoke/docs/approval）被正式建立并有证据
### V7. public exports 与 stable/beta/experimental contract 被进一步硬化
### V8. 文档达到真实 npm 消费者可用标准
### V9. publish simulation 完成，并形成明确 tag/version/rollback 策略
### V10. 最终可明确回答：现在允许发布哪个包、以什么级别发布、为什么

### 测试要求
- 不只看仓内 vitest；必须做外部消费 smoke
- 必须验证 tarball install / import / CLI invocation
- 必须验证发布对象矩阵与 gate manifest 一致
- 必须验证不存在 root pack 成功却子包不可发的语义混淆

---

## 五、建议执行顺序

### Priority 1 — 发布对象矩阵 + root/core/cli 语义收口
先把“到底发什么”定死。

### Priority 2 — CLI packaging closure
把当前最现实的发布 blocker 收掉，或明确延期。

### Priority 3 — consumer smoke
证明包对外可装可用。

### Priority 4 — release gates + publish simulation
把 GO/NO-GO 证据化。

### Priority 5 — docs / release notes / version strategy
最后完成首发消费者文档与版本剧本。

---

## 六、本轮非目标

本轮不做：
- 不再新增大功能面
- 不把 monorepo 内部包全部强行一起首发
- 不把仓内 build 通过误当成消费者可用
- 不在 CLI 仍失败时宣称整个发布列车 ready

本轮真正目标是：

> **把 ConShell 的发布口径从“core 看起来差不多能发”推进到“整条发布列车清晰、严谨、可执行”。**

---

## 七、硬性真实性与发布不变量

1. **core ready 不等于 whole monorepo ready**
2. **CLI pack 失败时，不能笼统宣称整体发布 ready**
3. **root package private 语义必须明确，不得混入发布证据**
4. **没有 consumer smoke，不能说对外可用**
5. **没有明确 publish target matrix，不能执行模糊发布**
6. **beta / experimental 必须真实标注，不得伪装 stable**
7. **发布门禁必须基于证据，不得基于乐观口头结论**
8. **若当前只允许发布 `@conshell/core`，必须明确写清，而不是暗示“整个项目都能发了”**

---

## 八、最终输出格式

完成后必须输出：

### A. Publish Target Matrix
- root / core / cli / dashboard / docs 的发布角色与当前状态

### B. CLI Packaging Summary
- CLI 是否修通
- 若未修通，是否延期，原因是什么

### C. Consumer Smoke Summary
- core tarball install/import/bootstrap 结果
- CLI install/run 结果（若适用）

### D. Release Gate Summary
- build/test/pack/smoke/docs/approval 各 gate 状态
- 哪些已通过，哪些仍阻塞

### E. Public Contract Summary
- `@conshell/core` 哪些 exports 是 stable / beta / experimental
- 哪些 internal exports 被收口

### F. Publish Simulation Summary
- npm pack / publish dry-run / tag strategy / rollback strategy

### G. Final Go/No-Go
- 当前允许发布哪个包
- 允许以什么 tag / tier 发布
- 若不允许，剩余 blocker 是什么

### H. Risks / Deferred
- 哪些高级能力留到 19.x+
- 哪些包延后发布

### I. 不得伪造
- 没有 consumer smoke，不能说可对外发布
- 没有 CLI closure 或正式延期，不能说发布列车已收口
- 没有 target matrix，不能说 npm strategy 已明确
- 没有 gate evidence，不能说 RC 资格已成立

---

## 九、一句话任务定义

> **Round 18.5 的目标是：把 18.4 已达成的“全仓测试全绿 + core 包接近 RC”进一步推进成真正可执行的 monorepo 发布列车，通过明确发布对象矩阵、修复或延期 CLI 包、完成消费者视角 smoke 验证、建立 release gates 与 publish simulation，最终把 npm 上线从仓内自证推进到真实可执行的发布策略。**
