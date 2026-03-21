# ROUND 18.4 DETAILED AUDIT — 2026-03-19

## Audit Scope
审计目标：核验运行时播报中关于 **Round 18.4 Release Readiness** 的声明是否与仓内事实一致，并判断项目是否真的达到“GO for `@conshell/core@0.1.0 RC` / 可进入 npm build & publish”的状态。

审计依据：
- `DevPrompt/0194_Round_18_4_Release_Readiness_Full_Test_Closure_NPM_Packaging_and_Production_Hardening.md`
- 根目录 `package.json`
- `packages/core/package.json`
- `packages/cli/package.json`
- `pnpm vitest run`
- `pnpm -r build`
- `npm pack --json --dry-run`（根目录）
- `cd packages/core && npm pack --json --dry-run`
- `cd packages/cli && npm pack --json --dry-run`
- 仓内搜索：overrides / classification / files / route contract 等线索

---

## Executive Verdict
**结论：Round 18.4 属于“部分真实完成，但发布结论被高估的一轮”。**

更准确地说：
- **属实部分**：全仓测试确实已经全绿；构建可跑；核心包 `@conshell/core` 的 `npm pack --dry-run` 成功；18.x economic chain 被明确归类为 `beta`；依赖与历史 route-count 问题大概率已被收口。
- **不属实/不严谨部分**：运行时消息中的“Final: GO for `@conshell/core@0.1.0 RC`”是**过早结论**，因为：
  1. monorepo 根包仍然 `private: true`
  2. 根目录 `npm pack` 打出来的是一个把大量仓库级文档、审计、DevPrompt、规划文件统统带进去的巨大 tarball，不是干净发布包
  3. `packages/cli` 的 `npm pack --dry-run` 直接失败，说明**发布列车并未全线打通**
  4. “可以发哪个包、以什么顺序发、首发只发 core 还是 core+cli 联发”没有被严格收口成最终发布策略

审计评级：
- **测试健康度收口：高**
- **core 包发布就绪度：中高**
- **monorepo 整体发布就绪度：中低**
- **完成播报真实性：中等偏上**

一句话：

> **18.4 成功把项目从“测试不稳 + 依赖问题未收口”推进到了“核心包接近 RC”，但还没有把 monorepo 的实际 npm 发布列车彻底打通。**

---

## Claimed vs Verified

## 1. Phase A — Fixed 5 blockers
### 1.1 全仓测试全绿：属实
我实际执行：
- `pnpm vitest run`

实测结果：
- **76 test files passed**
- **1726 tests passed**
- **0 failures**

这部分与播报一致，属实。

### 1.2 旧 route count 测试已收口：大体属实
此前 17.9 / 16.9.1 的失败来自旧数量断言。当前全绿说明这部分**至少已被修正到不再阻塞主测试面**。

### 1.3 ox 依赖问题已收口：大体属实
此前依赖缺失导致 api-surface / webchat-e2e / plugin-e2e 挂掉。当前全绿说明这条 blockers 主线**已经不再阻塞测试**。

### 1.4 三个 TS 编译错误已修：大体属实
虽然我没有逐行比对每个改动点，但 `pnpm -r build` 可完成，说明这些编译级错误已不再构成当前 blocker。

结论：
- **Phase A 基本成立。**

---

## 2. Phase B — Package hardened
### 2.1 `pnpm -r build`：属实
构建可完成，说明 monorepo 至少在 build 层面已经明显健康很多。

### 2.2 core 包 `npm pack --dry-run`：属实
在 `packages/core` 目录执行：
- `npm pack --json --dry-run`

结果：
- 包名：`@conshell/core@0.1.0`
- 文件名：`conshell-core-0.1.0.tgz`
- size 约 **682kB**
- entryCount **833**

说明：
- **core 包本身确实已经能 pack 出来**。

### 2.3 根目录 `npm pack --dry-run`：不应被当成“发布就绪”的正向证据
根目录也能打包，但打出来的是：
- 仓库级大包
- 含大量 docs / audit / DevPrompt / 规划文件等仓库内容

这说明：
- 根包不是一个面向 npm 消费者的干净 distribution artifact
- 不能把它当作“package hardened 完成”的充分证据

### 2.4 `files: ["dist"] added`：只对具体子包成立，不代表 monorepo 已整体收口
对 `packages/core` 而言，pack 结果表明它确实主要输出 `dist` + `package.json`。但这不自动等价于：
- CLI 已可发
- dashboard 已可发
- 根包发布策略已清晰

### 2.5 `packages/cli` pack 失败：关键反证
在 `packages/cli` 目录执行：
- `npm pack --json --dry-run`

结果：
- **失败**
- `Unknown system error -11`

这是本轮最关键的反证之一。

它意味着：
- **monorepo 的发布链并没有全线跑通**
- 如果项目的目标是“最后送到 npm 去 build 上线”，那么现在还不能笼统地下“已 GO”结论

结论：
- **Phase B 对 core 包成立，对整个 monorepo 不成立。**

---

## 3. Phase C — Classification complete
### 3.1 分类工作大概率已存在：基本属实
仓内搜索可见与 stable / beta / experimental / internal-only 相关的发布分级语义与文档线索。

### 3.2 18.x economic chain classified as Beta：合理且与我审计判断一致
这点我认为是**正确判断**，因为：
- 18.x economic chain 虽然连续四轮高度真实
- 但仍然太新、太关键、太深层
- 不适合作为 fully stable public contract 直接承诺

结论：
- **Phase C 方向正确，且基本成立。**

---

## What 18.4 Actually Achieved

## G1 — 全仓测试健康度收口
这是 18.4 最硬的真实成果。

此前全仓状态：
- 71 passed files / 5 failed files / 1666 passed / 2 failed tests

当前状态：
- **76 passed files / 0 failed files / 1726 passed / 0 failed tests**

这说明：
- **18.4 已把全仓测试健康度真正拉到了全绿。**

这是一个实打实的 release-readiness 级进步。

---

## G2 — 依赖卫生显著改善
从测试全绿与 build 成功可以高置信度判断：
- 之前的 `ox` / `viem` transitive resolution 问题，至少已经不再阻塞主线
- 编译级错误已不再阻塞构建

但还不能说：
- 所有发布路径都因此彻底没问题

因为 `packages/cli` pack 依然失败。

---

## G3 — core 包已接近真正 RC
`packages/core` 当前具备：
- 全测试通过
- build 成功
- pack 成功
- public package identity：`@conshell/core@0.1.0`

这意味着：
- **如果只讨论 core 包，确实已经非常接近 release candidate。**

但仍需一层关键提醒：
- “接近 RC” ≠ “已完成最终 npm 发布链”
- 还需要 install smoke / import smoke / publish dry-run 级验证

---

## Most Important Remaining Gaps

## Gap 1. RC 结论被说早了：core-ready ≠ monorepo-ready
运行时播报说：
- `GO for @conshell/core@0.1.0 RC`

这在**只看 core 包**时勉强接近成立；
但在**整个项目准备 npm 上线**这个目标下，仍然过早。

原因：
- CLI 包未打包成功
- 根包语义仍是私有仓库包，不是发布工件
- 发布策略没有被严密地从 monorepo 角度收口

---

## Gap 2. 发布目标对象仍然模糊
当前至少存在三种不同层级的“发布对象”：
1. 根仓库包（当前仍 `private: true`）
2. `@conshell/core`
3. `@conshell/cli`（若存在这个发布意图）

但现在并未形成一个清晰、无歧义的最终策略：
- 首发是否只发 `@conshell/core`？
- CLI 是否延期？
- dashboard 是否完全不发 npm？
- 根包是否永远 private？

如果这些不写死，发布动作仍存在执行歧义。

---

## Gap 3. CLI 包是当前最实际的 release blocker
`packages/cli` 的 `npm pack --dry-run` 失败，是一个不能绕开的现实 blocker。

在“最终送到 npm 去 build 上线”的语境下，这意味着：
- 要么修 CLI
- 要么明确 CLI 不进入本次发布
- 但不能一边失败一边口头宣布整体验证已完成

---

## Gap 4. install smoke / consumer smoke 还未被证明
当前已证明：
- test ok
- build ok
- core pack ok

但还未被证明：
- 新用户安装 tarball / npm 包后能正确 import
- CLI 安装后可正确执行
- 稳定导出的 public API 在外部消费环境下无缺件/错路/副作用问题

这意味着：
- **18.4 更像 build-and-pack readiness，不是 final consumer-readiness。**

---

## V1-V10 Reality Check

### V1. 当前全仓测试失败项被真实修复或严格分类
**结论：通过**
- 当前全仓测试已全绿。

### V2. 依赖缺失 / module resolution 问题被定位并修复
**结论：部分通过偏高**
- 测试面已不再阻塞；
- 但 CLI pack 仍失败，说明发布路径上仍有 unresolved packaging/runtime issue。

### V3. 旧 route count 测试升级为当前 canonical API surface 一致
**结论：基本通过**
- 全绿说明问题已不再存在。

### V4. `npm pack` / 本地构建 / 关键入口 import-run 验证通过
**结论：部分通过**
- core pack 通过；
- monorepo root pack 没意义；
- CLI pack 失败；
- import-run consumer smoke 未完全证明。

### V5. package exports / build artifacts / bin / types 边界清晰且可用
**结论：部分通过**
- core 包边界相对清晰；
- 整体 monorepo 发布边界仍不够严密。

### V6. release blocker manifest 已建立，并明确当前是否具备 npm release 候选资格
**结论：部分通过**
- 从播报看有 blocker closure 思路；
- 但 CLI pack failure 说明 blocker manifest 至少没有把所有发布 blocker 清零。

### V7. stable / beta / experimental / internal-only 模块边界已定义
**结论：基本通过**
- 分类方向可信，18.x 标 beta 合理。

### V8. 18.x 经济主链经过生产化复核并完成分级
**结论：通过**
- 标 beta 是正确的。

### V9. 发布文档与使用说明达到首发最低标准
**结论：未充分证明**
- 现有证据不足以证明 install/build/run 文档已经达到真正首发最低标准。

### V10. 最终给出明确结论：当前是否达到 RC，可否进入 npm build / publish
**结论：不能完全通过**
- 更准确结论应是：
  - **`@conshell/core` 接近 RC，可进入更严格的 publish-candidate verification**
  - **整个 monorepo 尚不能笼统宣称 fully GO for npm publish**

---

## Audit Conclusion
**Round 18.4 应被定义为：Full Test Closure and Core Package Release Readiness landed, but Monorepo Publish Train Closure remains unfinished.**

这意味着：
- 18.4 不是失败轮。
- 相反，18.4 是一个非常值钱的收口轮：它把项目质量面真正拉到了全绿。
- 但 18.4 也没有彻底完成最终发布目标，因为它还没有把：
  - core / cli / root 的发布语义
  - monorepo publish strategy
  - consumer install smoke
  - CLI packability
  统一收口。

所以：

> **18.5 不该回去再做新的大型功能主线，而应继续推进真正的发布列车收口：从“core 接近 RC”走到“整个可发布面被严格定义并可执行上线”。**

---

## Recommended Round 18.5 Focus
18.5 最合理的主题应是：

1. **Monorepo Publish Train Closure**
   - 把 core / cli / root / dashboard 的发布角色一次性定义清楚

2. **CLI Packaging & Installability Closure**
   - 修复 CLI pack failure，或明确 CLI 暂不发布

3. **Consumer Smoke Verification**
   - 从“仓内 build/test/pack 成功”推进到“外部消费环境可安装、可导入、可运行”

4. **RC Gate Definition**
   - 不再口头说 ready，而是形成真正可执行的 release gate

一句话：

> **18.5 的任务不是继续堆功能，而是把“准备上线”从仓内自证推进到真实发布列车可执行。**
