# DevPrompt 0194 — Round 18.4
## Release Readiness / Full Test Closure / NPM Packaging / Production Hardening

你现在处于 **ConShellV2 Round 18.4**。

截至 Round 18.3，ConShell 已经完成的重要事实包括：
- Runtime / Kernel / Identity / Governance / Memory 主线均已进入真实可运行阶段
- 17.9 完成 payment negotiation / provider selection / preparation foundation
- 18.0 完成最小 settlement runtime primitive
- 18.1 完成 settlement governance / canonical ledger / feedback / truth surface layer
- 18.2 完成 unified settlement orchestrator / flow trace / replay / provider feedback canonical path
- 18.3 完成 settlement system writeback v1 / posture signals / agenda hints / cross-system truth surface

并且：
- 18.0 → 18.3 局部链路测试已达 **95/95 全绿**
- 全局大审计已重新给出判断：**当前总体完成度约 76%**

但当前也存在一个非常现实、非常关键的新阶段判断：

> **ConShell 现在已经不适合继续无限分叉地堆新零件。**
>
> **现在最值钱的动作，是把系统拉到“发布级健康度 + 构建级稳定性 + npm 分发就绪”的状态。**

用户已经明确提出：

> **要加快速度，尽快完成，最后送到 npm 去 build 上线。**

因此，Round 18.4 的任务不是再开一个远离上线的抽象新题，
而是要转入：

> **Release Readiness 收口轮。**

也就是：
- 修掉当前全仓测试与依赖健康问题
- 把 economic / api / route surface 的历史回归测试更新到当前真实状态
- 明确 package build / export / publish 边界
- 清理 npm 发布前的 blocker
- 让 ConShell 开始具备“可构建、可打包、可发布、可上线”的生产级姿态

---

## 一、本轮唯一主目标

**完成 ConShell 的 Release Readiness Closure，使项目从“高级核心运行时”推进到“可发布候选版本（release candidate）”状态。**

一句话解释：

Round 18.4 不是再发散功能面，
而是要解决一个更现实的问题：

> **我们距离 npm build / 发布上线，到底还差哪些真实 blocker，并把其中最高优先级的一批真正收掉。**

---

## 二、本轮必须回答的核心问题

### Q1. 为什么当前全仓测试不是全绿？
如果原因不收口，就不能诚实地说项目 ready for release。

### Q2. 当前 npm build / package / publish 的真实阻塞项是什么？
如果没有明确 publish blockers 清单，就不能说“准备上线”。

### Q3. 当前哪些 API / route / test 仍停留在旧轮次假设？
如果回归测试还在断言旧 route count，就说明 release discipline 还不够。

### Q4. 哪些模块已经可以进入 release candidate 范围，哪些还必须标记 experimental？
如果边界不清，npm 发布会造成错误承诺。

### Q5. 最小可发布版本（MVP for npm release）到底是什么？
如果不先收敛发布面，越做越散，反而更难上线。

---

## 三、本轮必须完成的内容

# G1. Full Test Health Closure

本轮必须优先收口当前全仓测试健康度。

### G1.1 必须解决的已知问题
根据当前审计，至少包括：

#### A. 依赖/模块缺失导致的 suite failures
当前失败文件包括：
- `src/api-surface/api-surface.test.ts`
- `src/channels/webchat/webchat-e2e.test.ts`
- `src/plugins/demo/plugin-e2e.test.ts`

已知错误方向：
- `viem/node_modules/ox/_esm/erc8010/index.js` 缺失或解析失败

本轮必须明确：
- 是 lockfile / transitive dependency / import path / bundler resolution / package manager layout 的哪一种问题
- 给出正确修复，而不是临时跳过测试糊过去

#### B. 旧 route count 测试过时
当前失败文件包括：
- `src/economic/economic-17-9.test.ts`
- `src/economic/economic-16-9-1.test.ts`

问题本质：
- 旧测试还在断言旧经济 API route 数量
- 当前 route surface 已真实扩张

本轮必须：
- 把旧“固定数量”测试改成与当前 canonical route surface 一致
- 更好做法是：从“纯数量断言”升级为“关键 routes contract + category coverage”断言，减少未来轮次不断被无意义打爆

### G1.2 目标
实现：
- 全仓测试全绿，或
- 至少只剩经过明确标注的非核心 external blockers，且有 documented rationale

但原则上，本轮应尽量冲击：

> **全仓零失败。**

---

# G2. Release Candidate Scope Definition

本轮必须定义：

> **ConShell 当前准备发布到 npm 的“最小可信发布范围”到底是什么。**

### G2.1 必须明确区分
- `stable`
- `beta`
- `experimental`
- `internal-only`

### G2.2 至少要分类的能力面
- kernel / runtime
- identity / memory / governance
- economic runtime
- settlement pipeline
- channels / webchat / plugins / mcp
- collective / lineage / selfmod / automaton

### G2.3 原则
不能因为系统很大，就把所有模块都包装成“已正式稳定”。

必须明确：
- 哪些适合 npm 首发
- 哪些只能先作为 experimental exports
- 哪些不应该进入首发 public contract

### G2.4 目标
让 release 不再是模糊口号，而是有清晰边界的 package contract。

---

# G3. NPM Packaging & Export Surface Hardening

本轮必须明确并收口 npm 产物的 package 结构。

### G3.1 必须检查并修正
- `package.json` 主入口 / exports / types / bin
- ESM / CJS 边界（如果涉及）
- build artifacts 目录
- sideEffects 声明（如适用）
- CLI 入口与 programmatic API 入口分离
- internal modules 是否被意外暴露

### G3.2 必须形成明确的 exports 策略
至少区分：
- public runtime API
- CLI entry
- experimental API
- internal-only non-exported modules

### G3.3 必须验证
- `npm pack` / 本地打包结果可用
- 打包后关键入口可实际 import / run
- 不发生缺文件、错路径、漏产物、类型丢失

### G3.4 目标
让 npm package 不是“源码仓直接扔出去”，
而是真正可消费、可安装、可运行的 distribution artifact。

---

# G4. Build Reproducibility & Publish Blocker Audit

本轮必须建立正式的 publish blocker 清单。

### G4.1 至少识别并分类
- dependency blockers
- type/build blockers
- test blockers
- packaging blockers
- documentation blockers
- release process blockers

### G4.2 每个 blocker 至少要有
- `blockerId`
- `severity`
- `component`
- `symptom`
- `rootCause`
- `fixStatus`
- `releaseBlocking`（yes/no）

### G4.3 必须输出
- 当前还有哪些 blockers 阻止 npm release
- 哪些已被本轮清除
- 哪些可降级为 beta/experimental 风险项

### G4.4 目标
把“感觉快能发了”变成：

> **精确知道为什么能发 / 为什么不能发。**

---

# G5. API Surface Contract Stabilization

本轮必须对外 API surface 做一轮稳定化。

### G5.1 至少处理
- economic routes 的 contract consistency
- truth surface 路由命名一致性
- flow / runtime / settlement / writeback surface 的分类一致性
- route tests 从“硬编码旧数量”升级为“contract-based validation”

### G5.2 建议新增/升级
- route manifest / api surface manifest
- categorized route assertions
- deprecated route 标记（如果有旧路径）

### G5.3 目标
防止后续继续因为“功能扩张导致旧数量断言失败”而污染主分支质量判断。

---

# G6. Dependency Hygiene & Module Resolution Hardening

本轮必须收口当前暴露出来的依赖卫生问题。

### G6.1 至少覆盖
- `viem` / `ox` / transitive module resolution 问题
- workspace / package manager / hoisting / nested node_modules 兼容问题
- 本地开发成功但 CI / pack 后失效的依赖风险

### G6.2 必须验证
- clean install 后测试与 build 是否稳定
- 锁文件与 package manager 行为是否一致
- `npm pack` 后依赖解析是否仍正确

### G6.3 目标
避免 npm 发布后才发现“本地能跑，用户装完炸了”。

---

# G7. Release Documentation & Operator Handshake

本轮必须开始形成真正面向发布的文档，而不是只面向内部开发。

### G7.1 至少新增或更新
- release-ready README section
- install / build / run / test instructions
- package entry overview
- stable vs experimental capability matrix
- known limitations / release notes draft

### G7.2 必须明确
- 当前 npm 首发定位是什么
- 推荐使用场景是什么
- 不应承诺什么

### G7.3 目标
发布不是只把 tarball 推上去；
必须让 operator / developer 知道如何正确使用与预期风险。

---

# G8. Production Hardening of 18.x Economic Chain

因为 18.x 是当前最大的新增能力面，本轮必须对其做一轮生产级硬化，而不是只停留在轮次验收。

### G8.1 至少复核
- settlement orchestrator canonicality
- replay / resume idempotency
- writeback idempotency
- provider feedback routing effect
- truth surface consistency
- legacy path coexistence 风险

### G8.2 必须判断
- 哪些经济面能力适合首发 stable
- 哪些应标 experimental
- 哪些 route / module 暂不应进入 public contract

### G8.3 目标
避免把“刚完成的新主链”未经分级就直接当成 fully stable public API 发布。

---

# G9. Release Train Definition

本轮必须明确 ConShell 的发布列车，而不是只做一次性上线冲动。

### G9.1 至少定义
- `alpha`
- `beta`
- `rc`
- `stable`

### G9.2 至少定义每一级门槛
例如：
- alpha：局部主线成立，但 API 不稳定
- beta：核心能力可用，允许 experimental exports
- rc：全仓测试全绿 + publish blockers 清零
- stable：contract 稳定 + 文档完备 + install/build/run 验证通过

### G9.3 目标
让 npm 上线成为一个可管理的 release process，而不是一次性拍脑袋 push。

---

## 四、本轮强制验收矩阵

### V1. 当前全仓测试失败项被真实修复或被严格分类，不再处于含混状态
### V2. 依赖缺失 / module resolution 问题被定位并修复
### V3. 旧 route count 测试被升级为与当前 canonical API surface 一致
### V4. `npm pack` / 本地构建 / 关键入口 import-run 验证通过
### V5. package exports / build artifacts / bin / types 边界清晰且可用
### V6. release blocker manifest 已建立，并明确当前是否具备 npm release 候选资格
### V7. stable / beta / experimental / internal-only 模块边界已定义
### V8. 18.x 经济主链经过生产化复核，明确哪些 surface 可公开、哪些需保留 experimental
### V9. 发布文档与使用说明达到首发最低标准
### V10. 最终给出明确结论：当前是否达到 release candidate，可否进入 npm build / publish 流程

### 测试要求
- 不只跑 18.x 局部测试，必须复核全仓测试健康度
- 必须验证 clean install / build / pack 路径
- 必须验证 route surface contract tests
- 必须验证发布后入口至少包含：CLI / core runtime / selected public APIs
- 必须验证不存在“本地仓能跑、pack 后缺文件/缺依赖”的情况

---

## 五、建议执行顺序

### Priority 1 — 全仓测试与依赖健康度
先修真实 blocker，而不是先做花哨发布文档。

### Priority 2 — package/export/build/pack 收口
把 distribution artifact 变成真实可用产物。

### Priority 3 — API surface 与 release scope 稳定化
明确什么可发，什么不能发。

### Priority 4 — release blocker manifest
把是否能发说清楚。

### Priority 5 — README / release notes / usage docs
完成首发最小文档面。

---

## 六、本轮非目标

本轮不做：
- 不再新开大跨度功能主线
- 不为了“看起来快”继续堆抽象模块
- 不把全系统未成熟能力统一宣称 stable
- 不在测试未收口、依赖未收口时硬推 npm 上线

本轮真正目标是：

> **把 ConShell 从“高级核心系统”推进成“真实可发布候选版本”。**

---

## 七、硬性安全与真实性不变量

以下规则本轮绝不能破：

1. **测试没绿，不能说 release-ready**
2. **依赖没收口，不能说 npm build/publish 安全**
3. **experimental capability 不能伪装成 stable public contract**
4. **18.x 经济主链未经过分级，不得全部直接公开承诺稳定**
5. **pack 后无法 import/run 的入口，不得算作已发布能力**
6. **发布文档必须反映真实边界，不得夸大当前完成度**
7. **全仓 blocker 必须可枚举、可追踪、可验证，不得靠口头“差不多了”**
8. **Release candidate 资格必须基于证据，而不是基于开发热情**

---

## 八、最终输出格式

完成后必须输出：

### A. Full Test Health Summary
- 当前全仓测试状态
- 修复了哪些失败项
- 剩余失败项还有没有

### B. Dependency & Build Summary
- 哪些依赖/模块解析问题已修
- clean install / build / pack 结果如何

### C. Packaging & Export Summary
- package exports / bin / types / artifacts 如何定义
- 哪些入口是 public contract

### D. Release Scope Summary
- stable / beta / experimental / internal-only 如何划分
- npm 首发包含哪些能力

### E. Release Blocker Manifest
- 当前 release blockers 清单
- 哪些已清零
- 当前是否达到 release candidate

### F. Economic Chain Productionization Summary
- 18.x 哪些面已可公开
- 哪些仍应保持 experimental

### G. Documentation Summary
- README / release notes / install/build/run 文档更新了什么

### H. Verification Matrix
- V1-V10 对应代码位置 / 测试位置 / pack/build 验证情况 / 是否通过

### I. Final Go/No-Go
- 是否允许进入 npm build
- 是否允许进入 npm publish
- 若不允许，阻塞项是什么

### J. 不得伪造
- 没有 pack/build 验证，不能说 ready for npm
- 没有 blocker manifest，不能说 ready for release
- 没有 scope 分级，不能说 public contract 已稳定
- 没有全仓健康度收口，不能说“基本完成”就能直接上线

---

## 九、一句话任务定义

> **Round 18.4 的目标是：把 ConShell 从一个已经具备高级自主生命体运行时核心的系统，推进到一个具备全仓测试健康度、依赖卫生、清晰 package/export 边界、可执行 npm pack/build 验证、并且拥有明确 release blocker 清单与稳定发布范围定义的 release candidate 候选版本，为最终 npm 上线做真实而非表面的收口。**
