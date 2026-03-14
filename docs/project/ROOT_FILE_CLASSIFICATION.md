# ConShell 根目录文件分类与使用说明

> 更新日期：2026-03-14  
> 目的：整理当前根目录文件，明确每类文件的职责、优先级与使用方式，降低后续 agent / 人类协作者的上下文混乱。

---

# 1. 设计原则

当前根目录文件较多，且其中同时包含：
- 项目定义
- 审计结果
- 全局规划
- 路线图
- agent 起始上下文
- 开发提示词
- 历史日志
- 工程配置

这本身不是错误，但如果没有清晰分类，会导致两个问题：

1. agent 不知道应该先读哪个文件
2. 新旧叙事并存时，容易基于错误文件继续规划

因此本文件的目的不是“大搬家”，而是：

> **先建立清晰的文件分类与阅读顺序，让根目录在不破坏已有引用路径的前提下变得可理解、可维护。**

---

# 2. 当前根目录文件分类

## A. 项目定义层（最高优先级）

这些文件定义项目是什么、目标是什么、不能把项目误解成什么。

### 文件
- `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
- `README.md`
- `CONSTITUTION.md`

### 职责
- 定义项目真正目标
- 定义长期方向
- 定义不可违反的约束

### 读取优先级
**最高**

### 说明
- `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md` 是最权威的项目目的定义
- `README.md` 是外部/新进入者入口
- `CONSTITUTION.md` 是硬边界与治理约束

---

## B. 审计层（当前现实）

这些文件定义当前项目真实到了哪里，而不是应该到哪里。

### 文件
- `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
- `docs/audit/DEVLOG.md`

### 职责
- 说明当前实现现实
- 记录轮次推进历史
- 防止下一轮脱离当前现实

### 读取优先级
**高**

### 说明
- `docs/audit/GLOBAL_AUDIT_2026-03-14.md` 用于全局状态判断
- `docs/audit/DEVLOG.md` 用于轮次历史和近期演进脉络

---

## C. 规划层（面向未来）

这些文件定义未来如何推进，而不是当前已经做完什么。

### 文件
- `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
- `docs/planning/NEXT_PHASE_ROADMAP.md`
- `docs/planning/PHASED_DEVELOPMENT_SCHEME.md`

### 职责
- 给出系统级开发计划
- 给出阶段划分 / 优先级 / 依赖
- 指导下一轮选择“该做什么、不该做什么”

### 读取优先级
**高**

---

## D. 上游对齐层

这些文件用于吸收 OpenClaw / Conway Automaton / Web4 方向，但不能替代本仓库现实。

### 文件
- `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`

### 职责
- 区分：已对齐 / 部分对齐 / 未对齐 / 不应机械照搬
- 防止 agent 直接把上游 README 当成本仓库已完成能力

### 读取优先级
**高**

---

## E. Agent 引导层

这些文件用于约束任何未来 agent 的行为模式。

### 文件
- `AGENT_START_HERE.md`
- `DevPrompt/README.md`
- `DevPrompt/*.md`

### 职责
- 规定 agent 的起始阅读顺序
- 规定每轮开发提示词如何组织
- 规定下一轮必须基于当前轮次审计结果

### 读取优先级
**最高（对 agent 而言）**

---

## F. 工程配置层

这些文件是项目的工程运行边界。

### 文件
- `.nvmrc`
- `.npmrc`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `vitest.config.ts`
- `.pnpm-approve-builds.json`
- `.gitignore`
- `.env.example`
- `run-tests.sh`

### 职责
- 定义构建、测试、依赖、Node pin、workspace 边界

### 读取优先级
**任务相关时高优先级**

---

## G. 临时 / 残留文件层

### 文件
- `implementation_plan.md.resolved`
- `.DS_Store`

### 建议
- `.DS_Store` 属于噪音文件
- `implementation_plan.md.resolved` 需要未来确认是否仍有保留价值

### 读取优先级
**低**

---

# 3. 建议的根目录阅读顺序

## 对人类和 agent 的统一建议顺序

1. `docs/project/PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
2. `docs/audit/GLOBAL_AUDIT_2026-03-14.md`
3. `docs/planning/GLOBAL_DEVELOPMENT_PLAN.md`
4. `docs/planning/NEXT_PHASE_ROADMAP.md`
5. `docs/planning/PHASED_DEVELOPMENT_SCHEME.md`
6. `docs/project/UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`
7. `AGENT_START_HERE.md`
8. `CONSTITUTION.md`
9. `docs/audit/DEVLOG.md`
10. `README.md`
11. 与当前任务相关的 `DevPrompt/*.md`
12. 再进入模块级源码

---

# 4. 当前整理策略

## 不建议现在立刻大规模搬文件
原因：
- 现有文件已被多个提示词和 agent 起始顺序引用
- 大规模重命名/搬移会增加引用断裂风险
- 当前更高优先级是保持可理解与可执行，而不是形式整洁

## 当前推荐做法
- 保持源码、工程配置、运行入口路径稳定
- 将 project / audit / planning 文档受控归档到 `docs/` 下
- 通过本文件维持清晰的逻辑分类与阅读顺序
- 任何物理迁移都必须同步修正引用，避免打断 agent 与文档入口

---

# 5. 当前实际结构与后续建议

当前已采用受控归档结构：

- `docs/project/`：项目定义、分类、上游差距
- `docs/audit/`：全局审计、开发日志
- `docs/planning/`：开发计划、路线图、阶段方案

根目录保留：
- `README.md`
- `CONSTITUTION.md`
- `AGENT_START_HERE.md`
- `DevPrompt/`
- 工程配置与运行入口文件

后续如要进一步细分，可再按需要在 `docs/` 下增加更细目录；但前提仍是：
- 不影响源码与运行结构
- 不破坏既有文档入口
- 必须同步修正所有引用

---

# 6. 一句话总结

> **ConShell 当前根目录的问题，不是文件数量本身，而是文件层级和阅读顺序没有被显式定义；本文件的作用就是把这些文件重新组织成可理解的知识入口。**
