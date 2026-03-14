# DevPrompt

本目录用于存放 **ConShell 每一轮开发的正式详细提示词**。

## 规则

1. 每一轮新的详细开发提示词都必须写成 **单独的 Markdown 文件**。
2. 文件名必须带有 **轮次编号**，便于排序与引用。
3. 提示词必须：
   - 完整
   - 详细
   - 准确
   - 高覆盖率
   - 精确对准项目目的与当前开发目标
4. Agent 在开始实现前，必须**完整阅读并严格遵循**对应轮次提示词。
5. 下一轮提示词必须基于**上一轮实现结果 + 验证结果 + 审计结论**制定，不能脱离当前现实。

## 命名约定

推荐格式：

```text
0145_Round_14_5_Continuity_Runtime_Integration_and_Recovery_Truth.md
```

即：
- 四位排序编号（便于字典序排序）
- 轮次名称
- 主题名称

## 当前可用提示词

- `0145_Round_14_5_Continuity_Runtime_Integration_and_Recovery_Truth.md`
- `0146_Round_14_6_Runtime_Truth_Reconciliation_and_Pinned_Verification_Closure.md`

## 重要原则

从现在开始，DevPrompt 不以“持续扩张功能”为默认目标。

每一轮提示词都必须先判断：

1. 当前项目最关键的问题到底是扩张能力，还是修复真实性/验证/运行时分叉问题
2. 当前轮次是否已经具备继续扩张的可靠基础
3. 是否会因为盲目推进高层能力而放大底层不一致

如果当前主要问题是：
- runtime truth 分叉
- pinned runtime 与 current shell 不一致
- doctor / verification / tests 不可信
- readiness / viability 结论无法稳定复现

那么下一轮提示词必须优先要求 agent 解决这些问题，而不是继续一味推进扩张开发。
