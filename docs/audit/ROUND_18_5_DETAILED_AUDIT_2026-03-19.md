# ROUND 18.5 DETAILED AUDIT — 2026-03-19

## Audit Scope
审计目标：核验运行时播报中关于 **Round 18.5 — Monorepo Publish Train Closure** 的声明是否与仓内真实证据一致，尤其是：
- CLI packaging 是否真的完成
- consumer smoke 是否真的通过
- release gates 是否真的足以支持“GO”

审计依据：
- `DevPrompt/0195_Round_18_5_Monorepo_Publish_Train_Closure_CLI_Packaging_and_Release_Gate_Execution.md`
- `packages/core/package.json`
- `packages/cli/package.json`
- `packages/cli/dist/*`
- `npm pack --json --dry-run`（core / cli）
- `npm publish --dry-run --tag beta --access public`（core / cli）
- `/tmp` clean-environment consumer smoke（core / cli tarball install + import / bin execution）

---

## Executive Verdict
**结论：Round 18.5 完成了“monorepo 发布列车的大部分收口”，但“全部完成、无需降级、可直接视为最终本地发布闭环完成”仍然不成立。**

更准确地说：
- **属实部分**：CLI pack 现在确实成功；CLI 产物已明显收缩；`npm publish --dry-run` 对 core 与 cli 都通过；core 的外部 tarball import smoke 成功。
- **不属实/被高估部分**：运行时消息称“Core + CLI + 完整 consumer smoke 全部通过”，这一点**不成立**。我在 `/tmp` 零 workspace 上下文中真实安装 `@conshell/cli` tarball 时，安装阶段被 `workspace:*` 依赖直接打爆：
  - `npm ERR! Unsupported URL Type "workspace:": workspace:*`

这意味着：

> **CLI 对外消费者安装性并没有完成。**

所以 18.5 最准确的定义应是：

> **Packability / Publish Dry-Run / Monorepo Role Clarity 基本成立，但 Final Consumer Installability Closure 未完成。**

审计评级：
- **core 包 RC 就绪度：高**
- **CLI pack / dry-run 就绪度：中高**
- **CLI consumer installability：未通过**
- **整体发布列车完成度：中高，但未终局**

---

## Claimed vs Verified

## 1. Phase 1 — CLI Fix
### 1.1 CLI package 现在确实可 pack：属实
已验证：
- `packages/cli/package.json` 已有 `files: ["dist"]`
- `npm pack --json --dry-run` 成功
- 产物规模约：**12.5kB / 21 files**
- `dist/` 内容清洁，未见此前 iCloud 重复文件问题

### 1.2 `workspace:*` “已解析为 0.1.0”：只对 publish metadata / pack 视角部分成立，不对消费者安装成立
这是本轮最关键的真实性问题。

表面上看：
- `npm pack` 成功
- `npm publish --dry-run` 成功

但在真实消费者场景中：
- tarball 安装 `@conshell/cli` 时，npm 仍然看到 package.json 中的：
  - `"@conshell/core": "workspace:*"`
- 结果：
  - **EUNSUPPORTEDPROTOCOL**
  - **Unsupported URL Type "workspace:"**

结论：
- **workspace 依赖并没有被转成真正可供外部 npm 消费者安装的 semver 依赖。**
- 所以运行时所说“解析成功”只是在 pack/publish dry-run 语境里部分成立，不是 consumer-install 语义上的成立。

---

## 2. Phase 2 — Consumer Smoke
### 2.1 Core consumer smoke：属实
在 `/tmp/conshell-smoke-core` 中实测：
- tarball install 成功
- `@conshell/core` import 成功
- `@conshell/core/public` import 成功
- 输出验证结果：
  - public exports：**16**
  - full exports：**111**
  - `VERSION` 存在
  - `toCents` 存在
  - `createKernel` 存在
  - `THREE_LAWS` 存在

所以：
- **core 的外部消费者视角 smoke 成功**。

### 2.2 CLI consumer smoke：不属实
在 `/tmp/conshell-smoke-cli` 中实测：
- tarball install 阶段即失败
- 还没走到 `conshell --help` / `--version`
- 原因不是 CLI bin 本身，而是安装时依赖解析失败

报错原文关键结论：
- `EUNSUPPORTEDPROTOCOL`
- `Unsupported URL Type "workspace:": workspace:*`

所以：
- 运行时消息所说：
  - `CLI: conshell --help ✅`
  - `CLI: --version ✅`
- 这些最多只能代表**仓内或 workspace 语境**成立，
- **不能代表真实外部消费者环境成立**。

结论：
- **完整 consumer smoke 并未通过。**

---

## 3. Phase 3 — Release Gates
### 3.1 build/test/pack/dry-run gates：大体属实
已验证：
- 全仓测试此前已全绿
- core/cli pack 成功
- core/cli `npm publish --dry-run` 成功

### 3.2 consumerSmokeGate：未通过
这是本轮真正没过的 gate。

因为：
- core 通过
- cli 不通过

所以如果 gate 是“首发 core + cli 联发”，那么：
- **gate 不能判通过**

### 3.3 publishApprovalGate pending：合理
用户已明确要求：
- **先不要推送到 npm**
- **先把项目整体全部完成、本地测试无误后再推送**

所以 approval pending 合理。

---

## What 18.5 Actually Achieved

## A. 发布对象矩阵更清楚了
当前真实状态已基本明确：
- root：`private: true`，不作为 publish artifact
- `@conshell/core`：最接近 RC / beta 首发主包
- `@conshell/cli`：pack / publish dry-run 可跑，但 consumer-install 尚未成立
- dashboard：web deploy only，不是 npm 首发对象

## B. CLI packability 被修到了可用水平
相比 18.4，18.5 的真实进展是：
- CLI 不再在 `npm pack --dry-run` 层面直接挂掉
- 包体收缩明显
- 发布面更像一个真正 npm package

## C. core 已经进入“可以认真讨论 beta 首发”的状态
这一点比 18.4 又前进了一小步，因为：
- core pack 成功
- core publish dry-run 成功
- core consumer install/import smoke 成功

如果只看 core，几乎已经满足首发候选条件。

---

## Most Important Remaining Gap

**18.5 最大剩余缺口非常单一而明确：CLI 的真实外部安装性没有完成。**

也就是说：
- pack ok
- publish dry-run ok
- 但 user install not ok

这是典型的“仓内发布幻觉”问题。

所以：

> **18.5 完成了发布列车的结构性收口，但没有完成最终消费者安装闭环。**

这会直接决定 18.6 的主轴。

---

## V1-V10 Reality Check

### V1. 发布对象矩阵已建立，角色无歧义
**结论：基本通过**
- root/core/cli/dashboard 的角色已相当清楚。

### V2. CLI pack failure 被修复，或被正式排除
**结论：通过（前半）**
- pack failure 确实已修复。

### V3. root package private 语义被正式收口
**结论：基本通过**
- root 不应再被视为 publish artifact。

### V4. `@conshell/core` tarball install/import/bootstrap smoke 验证通过
**结论：通过**

### V5. 若 CLI 首发，则 CLI install/bin/help smoke 验证通过
**结论：未通过**
- CLI tarball install 在 clean `/tmp` 环境中失败，未进入 bin 执行阶段。

### V6. release gates 被正式建立并有证据
**结论：部分通过**
- 但 consumer smoke gate 没有真正通过。

### V7. public exports 与 stable/beta/experimental contract 被进一步硬化
**结论：基本通过**
- 至少对 core 已有明确 public / full export 面证据。

### V8. 文档达到真实 npm 消费者可用标准
**结论：未充分证明**
- 当前核心反证在 installability，不在文档层。

### V9. publish simulation 完成，并形成 tag/version/rollback 策略
**结论：部分通过偏高**
- publish dry-run 通过；
- 但 installability 反证说明 simulation 还不够完整。

### V10. 最终可明确回答：现在允许发布哪个包、以什么级别发布、为什么
**结论：可部分回答，但不是运行时播报给出的那个答案**

更准确答案应是：
- **`@conshell/core`：已接近可 beta 发布**
- **`@conshell/cli`：暂不可与 core 一起作为“已验证可安装”的首发包发布，除非先修复 workspace 依赖归一化问题**

---

## Audit Conclusion
**Round 18.5 应被定义为：Core Release Candidate Verification succeeded, CLI Consumer Installability Closure failed, therefore Whole Publish Train Closure remains unfinished.**

这意味着：
- 18.5 不是失败轮；
- 它把问题收缩到了一个非常明确的最后 blocker；
- 但“无需降级”“全部完成”不是真实结论。

真正的现实结论是：

> **当前最接近可发布的是 `@conshell/core`，而不是“core + cli 联发已全部验证完成”。**

---

## Recommended Round 18.6 Focus
18.6 最合理的主题应是：

1. **CLI Dependency Normalization & Consumer Installability Closure**
   - 解决 `workspace:*` 对外安装失败问题

2. **Final Local Completion Gate**
   - 按用户新要求：先不推 npm，先把项目整体全部完成并本地验证无误

3. **Whole-Project Completion Before Publish**
   - 从“包可发”转向“项目整体本地完成态”

4. **No-Publish Finalization Discipline**
   - 在未达到终局本地完成态前，不执行真实 publish

一句话：

> **18.6 的任务不是立刻发布，而是完成最后一批真实本地闭环，让“以后再推 npm”变成一个无悬念动作。**
