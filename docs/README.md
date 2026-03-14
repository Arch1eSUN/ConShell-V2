# ConShell 文档目录说明

> 目的：将项目级文档从根目录受控归档到 `docs/`，在不影响源码、构建配置与运行结构的前提下，降低根目录混乱度。

---

## 目录结构

### `docs/project/`
项目定义与上游差距分析：
- `PROJECT_PURPOSE_AND_GLOBAL_OBJECTIVE.md`
- `ROOT_FILE_CLASSIFICATION.md`
- `UPSTREAM_ALIGNMENT_AND_GAP_ANALYSIS.md`

### `docs/audit/`
当前现实与历史演进记录：
- `GLOBAL_AUDIT_2026-03-14.md`
- `DEVLOG.md`

### `docs/planning/`
面向未来的系统级规划：
- `GLOBAL_DEVELOPMENT_PLAN.md`
- `NEXT_PHASE_ROADMAP.md`
- `PHASED_DEVELOPMENT_SCHEME.md`

---

## 根目录仍保留的入口

为了不影响工程结构与 agent 使用方式，以下内容继续保留在根目录：
- `README.md`
- `CONSTITUTION.md`
- `AGENT_START_HERE.md`
- `DevPrompt/`
- 工程配置与运行文件（如 `package.json`、`.nvmrc`、`vitest.config.ts` 等）

---

## 使用规则

任何未来 agent 或协作者在做重要工作前，应优先按 `AGENT_START_HERE.md` 和 `README.md` 中更新后的路径读取文档，而不是依赖旧的根目录路径记忆。
