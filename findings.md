# ConShell 全局大审计 Findings

## 审计原则
- 以仓内代码、测试、路由、核心服务为第一事实源
- 外部 Web4.ai 内容只作为目标/标准参考，不直接当作项目已实现事实
- 明确区分：最终目标 / 当前事实 / 推断 / 缺口

## 初始假设
- ConShell 的最终目标是：在 Web4.ai 标准下，融合 Conway Automaton 与 OpenClaw 的能力，成为具备自主运行、自治调度、身份连续性、经济闭环、群体协作、工具调用与长期演化能力的 AI 智能生命体

## 已确认事实（2026-03-17 审计）
- README / PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE / GLOBAL_DEVELOPMENT_PLAN / NEXT_PHASE_ROADMAP 对最终目标表述一致：ConShell 目标是 Web4-oriented autonomous AI lifeform runtime，而非普通聊天应用。
- Web4.ai 公开网页可抓取正文极少，因此“Web4.ai 标准”只能按仓内定义与用户给定方向解释，不能伪造官方细则。
- packages/core/src 模块规模较大的领域包括：economic(22)、server(18)、runtime(18)、identity(18)、state(16)、channels(15)、collective(13)。
- 当前测试分布最重的领域包括：identity(8 files)、runtime(5)、economic(5)、channels(4)、collective(3)、governance(2)、memory(2)、state(2)。
- 本地全量测试当前并非全绿：实际结果为 61 个测试文件中 44 通过、17 失败；1028 个测试中 1026 通过、2 失败；核心阻塞是 better-sqlite3 缺失，波及 state / memory / doctor / identity continuity / webchat e2e 等。
- 与此同时，最近轮次的局部主线测试真实很强：economic、governance、lineage、collective(16.7/16.8) 等主线均通过。
- Round 16.8 对 collective lifecycle 做了实质修复，但这不等于全项目完成，也不等于最终生命体闭环成立。
- Round 17.5 的核心工程目标已完成：revoked identity 现在以 `proposal_invalid + initiation failure receipt` 语义落地，而非 throw。
- governance contract 已正式区分 initiation invalidity、evaluated denial、execution failure。
- claims lifecycle 绑定已真实成立：revoke → 全失效；rotate → capability 继承、service 失效；recover → 不恢复旧 claims。
- `restoreRecordsHardened()` 已形成格式校验、链完整性校验、active count 校验三层硬化。
- `/api/identity/sovereign` 目前只完成基础暴露，尚未成为 diagnosis-first truth surface；这应是 Round 17.6 的主线。
