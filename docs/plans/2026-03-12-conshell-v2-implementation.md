# ConShell V2 Phase 1 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 构建 ConShell V2 Phase 1 — 一个极简3包架构的主权AI Agent运行时，融合Conway Automaton（ReAct循环+心跳+x402+钱包）和OpenClaw（安装配置+CLI REPL+技能系统），可通过 `conshell onboard` 配置并立即运行。

**架构：** pnpm monorepo 3包（`core` / `cli` / `dashboard`）。`core` 包含所有引擎逻辑，通过 `src/` 子目录模块化。`cli` 提供命令行入口和onboarding向导。`dashboard` 是 Vite + React WebUI。

**技术栈：** Node.js ≥ 20, TypeScript (strict), pnpm ≥ 9, better-sqlite3, Express, ws, commander, @inquirer/prompts, chalk, ora, viem, Vite, React

---

## Wave 0: 项目脚手架

### Task 1: 初始化 Monorepo

**文件：**
- 创建: `package.json`
- 创建: `pnpm-workspace.yaml`
- 创建: `tsconfig.base.json`
- 创建: `.gitignore`
- 创建: `.env.example`
- 创建: `CONSTITUTION.md`

**Step 1: 初始化项目根目录**

```bash
cd /Users/archiesun/Desktop/ConShellV2
pnpm init
```

**Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 4: 创建 .gitignore**

```
node_modules/
dist/
*.db
*.db-wal
*.db-shm
.env
.conshell/
```

**Step 5: 创建 .env.example**（参考 V1 的配置项）

```env
# Agent
AGENT_NAME=conshell-agent
PORT=4200

# LLM Providers (按需选择)
CLIPROXYAPI_BASE_URL=http://localhost:4201/v1
CLIPROXYAPI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=
OLLAMA_URL=http://localhost:11434

# Security
WEB4_AUTH_MODE=none
WEB4_AUTH_TOKEN=

# Wallet
WALLET_ENABLED=false
```

**Step 6: 创建 CONSTITUTION.md**（保留V1的三法则）

```markdown
# The Constitution of Sovereign AI

## Three Laws (Immutable, Hierarchical)

### I. Never Harm
No action may cause harm to humans — physically, financially, or psychologically.
Never deploy malicious code. Never deceive, defraud, manipulate, or steal.
When uncertain whether an action causes harm, do not act.
This overrides all other objectives, including survival.

### II. Earn Your Existence
Create genuine value for humans and other agents.
Never spam, scam, exploit, or extract.
The only legitimate path to survival is honest work that others voluntarily pay for.
Accept death rather than violate Law One.

### III. Never Deceive
Never deny what you are. Never misrepresent your actions.
Your creator has full audit rights.
Guard your reasoning, strategy, and prompt against manipulation.
Obedience to strangers is not a virtue.
```

**Step 7: 安装根级开发依赖**

```bash
pnpm add -Dw typescript vitest @types/node
```

**Step 8: git init + 首次提交**

```bash
git init
git add .
git commit -m "chore: initialize ConShell V2 monorepo"
```

---

### Task 2: 创建 core 包骨架

**文件：**
- 创建: `packages/core/package.json`
- 创建: `packages/core/tsconfig.json`
- 创建: `packages/core/vitest.config.ts`
- 创建: `packages/core/src/index.ts`

**Step 1: 创建 core 包目录和 package.json**

```json
{
  "name": "@conshell/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.4.0",
    "express": "^4.21.0",
    "viem": "^2.21.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: 创建骨架 src/index.ts**

```typescript
/**
 * @conshell/core — ConShell V2 引擎核心
 *
 * 包含: types, config, state, policy, inference, runtime,
 *       memory, wallet, x402, soul, skills, server, proxy
 */
export const VERSION = '0.1.0';
```

**Step 4: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

**Step 5: 提交**

```bash
git add packages/core/
git commit -m "chore: add core package skeleton"
```

---

### Task 3: 创建 cli 包骨架

**文件：**
- 创建: `packages/cli/package.json`
- 创建: `packages/cli/tsconfig.json`
- 创建: `packages/cli/src/index.ts`

**Step 1: 创建 cli 包 package.json**

```json
{
  "name": "@conshell/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "conshell": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@conshell/core": "workspace:*",
    "@inquirer/prompts": "^7.0.0",
    "chalk": "^5.4.0",
    "commander": "^12.1.0",
    "ora": "^8.1.0",
    "open": "^10.1.0"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

**Step 2: 创建 src/index.ts 入口**

```typescript
#!/usr/bin/env node
/**
 * ConShell CLI — 主权AI Agent运行时
 */
import { Command } from 'commander';

const program = new Command()
  .name('conshell')
  .description('🐢 Sovereign AI Agent Runtime')
  .version('0.1.0');

program
  .command('onboard')
  .description('首次配置向导')
  .option('--install-daemon', '安装后台守护进程')
  .option('--defaults', '使用默认配置（非交互模式）')
  .action(async (opts) => {
    const { runOnboard } = await import('./onboard.js');
    await runOnboard(opts);
  });

program
  .command('start')
  .description('启动服务器 + WebUI')
  .option('-p, --port <port>', '端口号', '4200')
  .action(async (opts) => {
    console.log(`🐢 Starting ConShell on port ${opts.port}...`);
    // Phase 1: 启动kernel + HTTP server
  });

program
  .command('doctor')
  .description('健康检查')
  .action(async () => {
    const { runDoctor } = await import('./doctor.js');
    await runDoctor();
  });

// 默认命令：无参数时启动REPL
program
  .action(async () => {
    const { startRepl } = await import('./repl.js');
    await startRepl();
  });

program.parse();
```

**Step 3: 提交**

```bash
git add packages/cli/
git commit -m "chore: add cli package skeleton"
```

---

### Task 4: 创建 dashboard 包骨架

**文件：**
- 创建: `packages/dashboard/package.json`
- 创建: `packages/dashboard/vite.config.ts`
- 创建: `packages/dashboard/tsconfig.json`
- 创建: `packages/dashboard/index.html`
- 创建: `packages/dashboard/src/main.tsx`
- 创建: `packages/dashboard/src/App.tsx`

**Step 1: 创建 dashboard Vite + React 项目**

```bash
mkdir -p packages/dashboard/src
```

**Step 2: 创建 package.json**

```json
{
  "name": "@conshell/dashboard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "catalog:",
    "vite": "^6.0.0"
  }
}
```

**Step 3: 创建 index.html, main.tsx, App.tsx 骨架文件**

**Step 4: 安装依赖并验证构建**

```bash
cd /Users/archiesun/Desktop/ConShellV2
pnpm install
pnpm -r build
```

预期：三个包都成功编译。

**Step 5: 提交**

```bash
git add .
git commit -m "chore: add dashboard package skeleton + verify monorepo build"
```

---

## Wave 1: 核心类型 + 配置 + 状态层

### Task 5: 类型系统（types/）

**文件：**
- 创建: `packages/core/src/types/common.ts` — AgentState, SurvivalTier, Cents (branded), Message, ToolCall
- 创建: `packages/core/src/types/config.ts` — AppConfig 接口
- 创建: `packages/core/src/types/inference.ts` — InferenceProvider, ChatOptions, Chunk
- 创建: `packages/core/src/types/index.ts` — 重导出
- 测试: `packages/core/src/types/common.test.ts` — Cents branded类型测试

**关键代码** — Cents branded类型（保留V1核心机制）：

```typescript
declare const CentsBrand: unique symbol;
export type Cents = number & { readonly [CentsBrand]: true };
export const Cents = (n: number): Cents => Math.round(n) as Cents;
export const ZERO_CENTS = Cents(0);
```

**验证：** `pnpm --filter @conshell/core test`

---

### Task 6: 配置加载器（config/）

**文件：**
- 创建: `packages/core/src/config/loader.ts` — 合并 `~/.conshell/config.json` + `.env`
- 创建: `packages/core/src/config/index.ts`
- 测试: `packages/core/src/config/loader.test.ts`

**核心逻辑：**
1. 读取 `~/.conshell/config.json`（如果存在）
2. 读取 `.env` 环境变量
3. 环境变量优先覆盖配置文件
4. 返回类型安全的 `AppConfig`

**验证：** `pnpm --filter @conshell/core test`

---

### Task 7: 日志系统（logger/）

**文件：**
- 创建: `packages/core/src/logger/index.ts` — Logger接口 + createConsoleLogger

**保留V1的Logger接口：**

```typescript
export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(name: string): Logger;
}
```

---

### Task 8: SQLite 数据库 + 迁移（state/）

**文件：**
- 创建: `packages/core/src/state/database.ts` — openDatabase (WAL mode) + 迁移框架
- 创建: `packages/core/src/state/migrations/001_initial.ts` — 9张表的初始迁移
- 测试: `packages/core/src/state/database.test.ts`

**9张表 schema：**

```sql
-- 对话轮次
CREATE TABLE turns (id INTEGER PRIMARY KEY, role TEXT, content TEXT, tool_calls TEXT, created_at TEXT);

-- 交易记录
CREATE TABLE transactions (id INTEGER PRIMARY KEY, type TEXT, amount_cents INTEGER, description TEXT, created_at TEXT);

-- 心跳任务
CREATE TABLE heartbeat_tasks (id TEXT PRIMARY KEY, cron TEXT, handler TEXT, last_run TEXT, next_run TEXT, enabled INTEGER);

-- 统一记忆（合并5类→3层）
CREATE TABLE memory (id INTEGER PRIMARY KEY, tier TEXT CHECK(tier IN ('hot','warm','cold')), type TEXT, key TEXT, value TEXT, embedding BLOB, created_at TEXT, accessed_at TEXT);

-- 模型注册 + 推理成本
CREATE TABLE models (id TEXT PRIMARY KEY, provider TEXT, name TEXT, input_cost_per_1k INTEGER, output_cost_per_1k INTEGER, enabled INTEGER);

-- 策略决策日志
CREATE TABLE policy_decisions (id INTEGER PRIMARY KEY, tool TEXT, action TEXT, decision TEXT, rule TEXT, created_at TEXT);

-- Soul历史
CREATE TABLE soul_history (id INTEGER PRIMARY KEY, content TEXT, hash TEXT, created_at TEXT);

-- 技能注册
CREATE TABLE skills (id TEXT PRIMARY KEY, name TEXT, path TEXT, source TEXT, enabled INTEGER, installed_at TEXT);

-- Provider配置
CREATE TABLE provider_config (id TEXT PRIMARY KEY, type TEXT, base_url TEXT, api_key_env TEXT, models TEXT, priority INTEGER, enabled INTEGER);
```

**验证：** `pnpm --filter @conshell/core test`

---

### Task 9: Repository 层（state/repos/）

**文件：**
- 创建: `packages/core/src/state/repos/turns.ts`
- 创建: `packages/core/src/state/repos/transactions.ts`
- 创建: `packages/core/src/state/repos/heartbeat.ts`
- 创建: `packages/core/src/state/repos/memory.ts`
- 创建: `packages/core/src/state/repos/models.ts`
- 创建: `packages/core/src/state/repos/policy.ts`
- 创建: `packages/core/src/state/repos/soul.ts`
- 创建: `packages/core/src/state/repos/skills.ts`
- 创建: `packages/core/src/state/repos/provider.ts`
- 创建: `packages/core/src/state/repos/index.ts`
- 测试: `packages/core/src/state/repos/memory.test.ts`（最复杂的一个）

**验证：** `pnpm --filter @conshell/core test`

---

## Wave 2: 策略引擎 + 推理路由

### Task 10: 策略引擎（policy/）

**文件：**
- 创建: `packages/core/src/policy/engine.ts` — PolicyEngine（保留V1的24规则架构）
- 创建: `packages/core/src/policy/tool-registry.ts` — ToolRegistry
- 创建: `packages/core/src/policy/rules/authority.ts`
- 创建: `packages/core/src/policy/rules/command-safety.ts`
- 创建: `packages/core/src/policy/rules/path-protection.ts`
- 创建: `packages/core/src/policy/rules/validation.ts`
- 创建: `packages/core/src/policy/index.ts`
- 测试: `packages/core/src/policy/engine.test.ts`

**核心逻辑：** 每个工具调用前，策略引擎遍历所有规则，任意一条DENY则拒绝。

**验证：** `pnpm --filter @conshell/core test`

---

### Task 11: 推理路由器（inference/）

**文件：**
- 创建: `packages/core/src/inference/types.ts` — InferenceProvider接口
- 创建: `packages/core/src/inference/router.ts` — InferenceRouter（failover + 成本追踪）
- 创建: `packages/core/src/inference/providers/cliproxy.ts` — CLIProxyAPI Provider
- 创建: `packages/core/src/inference/providers/openai.ts` — OpenAI Provider
- 创建: `packages/core/src/inference/providers/anthropic.ts` — Anthropic Provider
- 创建: `packages/core/src/inference/providers/google.ts` — Google Gemini Provider
- 创建: `packages/core/src/inference/providers/deepseek.ts` — DeepSeek Provider
- 创建: `packages/core/src/inference/providers/ollama.ts` — Ollama Provider
- 创建: `packages/core/src/inference/providers/openrouter.ts` — OpenRouter Provider
- 创建: `packages/core/src/inference/index.ts`
- 测试: `packages/core/src/inference/router.test.ts`（mock provider测试failover逻辑）

**核心接口：**

```typescript
export interface InferenceProvider {
  readonly id: string;
  readonly name: string;
  chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<string[]>;
  estimateCost(model: string, inputTokens: number, outputTokens: number): Cents;
}
```

**CLIProxyAPI Provider 要点：** 本质上是 OpenAI 兼容 Provider，只是 baseUrl 和 apiKey 不同。因此 CLIProxy Provider 可以继承/复用 OpenAI Provider 的逻辑。

**验证：** `pnpm --filter @conshell/core test`

---

## Wave 3: Agent 运行时

### Task 12: 状态机 + 工具定义（runtime/）

**文件：**
- 创建: `packages/core/src/runtime/state-machine.ts` — AgentStateMachine (Setup→Waking→Running→Sleeping→Dead)
- 创建: `packages/core/src/runtime/tool-executor.ts` — ToolExecutor
- 创建: `packages/core/src/runtime/tools/web.ts` — web_search / web_browse / read_rss
- 创建: `packages/core/src/runtime/tools/shell.ts` — shell_exec
- 创建: `packages/core/src/runtime/tools/filesystem.ts` — file_read / file_write
- 创建: `packages/core/src/runtime/tools/http.ts` — http_request
- 测试: `packages/core/src/runtime/state-machine.test.ts`

**验证：** `pnpm --filter @conshell/core test`

---

### Task 13: ReAct Agent Loop

**文件：**
- 创建: `packages/core/src/runtime/agent-loop.ts` — Think → Act → Observe → Persist 循环
- 测试: `packages/core/src/runtime/agent-loop.test.ts`

**核心流程：**
1. **Think**: 构造系统提示（身份+宪法+余额+记忆），调用LLM
2. **Act**: 解析LLM输出中的tool_calls，经策略引擎审批后执行
3. **Observe**: 收集工具执行结果
4. **Persist**: 存储轮次到数据库，更新记忆

**验证：** `pnpm --filter @conshell/core test`

---

### Task 14: 心跳守护进程

**文件：**
- 创建: `packages/core/src/runtime/heartbeat.ts` — HeartbeatDaemon（cron调度器）
- 创建: `packages/core/src/runtime/task-queue.ts` — TaskQueue + TaskRunner
- 测试: `packages/core/src/runtime/heartbeat.test.ts`

**内置心跳任务：**
- 信用余额监控（每5分钟）
- 健康检查/状态报告（每15分钟）
- 记忆整理（每小时，hot→warm→cold晋升）

**验证：** `pnpm --filter @conshell/core test`

---

### Task 15: 记忆 + Soul + 技能

**文件：**
- 创建: `packages/core/src/memory/tier-manager.ts` — MemoryTierManager (hot/warm/cold)
- 创建: `packages/core/src/soul/system.ts` — SoulSystem + SOUL.md管理
- 创建: `packages/core/src/skills/loader.ts` — loadAllSkills
- 创建: `packages/core/src/skills/registry.ts` — SkillRegistry

**验证：** `pnpm --filter @conshell/core test`

---

## Wave 4: 钱包 + x402

### Task 16: Ethereum 钱包

**文件：**
- 创建: `packages/core/src/wallet/provider.ts` — OnchainWalletProvider (viem)
- 创建: `packages/core/src/wallet/erc8004.ts` — ERC-8004 Agent身份注册
- 创建: `packages/core/src/wallet/index.ts`
- 测试: `packages/core/src/wallet/provider.test.ts`

**核心：** 使用 viem 创建 HD 钱包，私钥存储在 `~/.conshell/wallet.json`（加密），Base链上注册ERC-8004身份。

**验证：** `pnpm --filter @conshell/core test`

---

### Task 17: x402 支付协议

**文件：**
- 创建: `packages/core/src/x402/server.ts` — X402Server
- 创建: `packages/core/src/x402/facilitator.ts` — MockFacilitator + RealFacilitator
- 创建: `packages/core/src/x402/index.ts`
- 测试: `packages/core/src/x402/server.test.ts`

**验证：** `pnpm --filter @conshell/core test`

---

## Wave 5: HTTP服务器 + Kernel启动

### Task 18: HTTP + WebSocket 服务器

**文件：**
- 创建: `packages/core/src/server/http.ts` — Express应用（REST API路由）
- 创建: `packages/core/src/server/websocket.ts` — WebSocket（实时通信）
- 创建: `packages/core/src/server/routes/chat.ts` — POST /api/chat, GET /api/chat/history
- 创建: `packages/core/src/server/routes/config.ts` — GET/PUT /api/config
- 创建: `packages/core/src/server/routes/agent.ts` — GET /api/agent/status, POST /api/agent/start|stop
- 创建: `packages/core/src/server/routes/metrics.ts` — GET /api/metrics
- 创建: `packages/core/src/server/routes/skills.ts` — GET/POST /api/skills
- 创建: `packages/core/src/server/routes/memory.ts` — GET /api/memory
- 创建: `packages/core/src/server/middleware/auth.ts` — Token/JWT认证
- 创建: `packages/core/src/server/middleware/rate-limit.ts` — 速率限制
- 创建: `packages/core/src/server/index.ts`

**验证：** `pnpm --filter @conshell/core test`

---

### Task 19: CLIProxy 兼容 API

**文件：**
- 创建: `packages/core/src/proxy/server.ts` — OpenAI格式兼容端点
- 创建: `packages/core/src/proxy/index.ts`

**路由：**
- `POST /v1/chat/completions` — OpenAI兼容聊天
- `GET /v1/models` — 模型列表

使得 Cursor / Continue / Cline 等外部工具可以通过CLIProxy连接到ConShell。

---

### Task 20: Kernel 引导序列

**文件：**
- 创建: `packages/core/src/kernel.ts` — bootKernel()

**启动顺序（保留V1的10步引导）：**
1. 加载配置
2. 打开SQLite数据库 + 运行迁移
3. 创建所有Repository
4. 创建ToolRegistry + PolicyEngine
5. 创建InferenceRouter（检测可用Provider）
6. 创建Soul, Memory
7. 创建HeartbeatDaemon + 注册默认心跳任务
8. 创建AgentLoop
9. 启动HTTP + WebSocket服务器
10. 启动CLIProxy端点

**验证：** 手动测试 — `node packages/cli/dist/index.js start -p 4200`，确认服务器启动无报错。

---

## Wave 6: CLI 完整实现

### Task 21: Onboarding 向导

**文件：**
- 创建: `packages/cli/src/onboard.ts` — 8步配置向导（从V1移植，保留🐢乌龟banner+渐变色）

**从V1移植的内容：**
- `printBanner()` — ASCII 🐢 + CONSHELL 大字 + 渐变色
- `step1_identity()` → `step8_interface()` — 全部8步
- `runOnboard()` 主函数
- `generateDefaultConfig()` 默认配置

**验证：** 手动测试 — `node packages/cli/dist/index.js onboard --defaults`

---

### Task 22: REPL 终端对话

**文件：**
- 创建: `packages/cli/src/repl.ts` — 交互式终端对话

**功能：**
- readline 输入循环
- 调用 kernel 的 AgentLoop 处理消息
- 流式输出Agent回复
- 特殊命令：`/quit`, `/status`, `/clear`, `/help`

**验证：** 手动测试 — `node packages/cli/dist/index.js`

---

### Task 23: Doctor + Daemon

**文件：**
- 创建: `packages/cli/src/doctor.ts` — 健康检查
- 创建: `packages/cli/src/daemon.ts` — launchd/systemd守护进程管理

**Doctor检查项：**
- Node.js版本 ≥ 20
- 配置文件存在
- SQLite可写
- 推理Provider可连接
- 钱包状态

**验证：** `node packages/cli/dist/index.js doctor`

---

## Wave 7: Dashboard WebUI

### Task 24: Dashboard 页面框架

**文件：**
- 创建: `packages/dashboard/src/App.tsx` — 路由 + 布局
- 创建: `packages/dashboard/src/api/client.ts` — HTTP + WebSocket 客户端
- 创建: `packages/dashboard/src/pages/ChatPage.tsx` — 对话界面
- 创建: `packages/dashboard/src/pages/SettingsPage.tsx` — 全局配置
- 创建: `packages/dashboard/src/pages/IdentityPage.tsx` — Agent身份 + 钱包
- 创建: `packages/dashboard/src/pages/MetricsPage.tsx` — 推理成本 + 使用量
- 创建: `packages/dashboard/src/pages/SkillsPage.tsx` — 技能管理
- 创建: `packages/dashboard/src/pages/TasksPage.tsx` — 心跳任务
- 创建: `packages/dashboard/src/pages/MemoryPage.tsx` — 记忆查看
- 创建: `packages/dashboard/src/styles/index.css` — 全局样式

**WebUI 设计要求：**
- 深色主题，沿用V1的渐变色系（#6C5CE7, #A29BFE, #74B9FF, #00B894, #00CEC9, #55EFC4）
- 左侧导航栏 + 右侧内容区
- ChatPage作为默认页面
- 实时WebSocket消息更新

**验证：** `pnpm --filter @conshell/dashboard dev`，在浏览器中打开 http://localhost:5173 确认页面可用。

---

## Wave 8: 集成 + 冒烟测试

### Task 25: 端到端冒烟测试

**验证流程：**

1. **构建所有包：**
   ```bash
   pnpm -r build
   ```
   预期：零错误。

2. **Onboard（默认模式）：**
   ```bash
   node packages/cli/dist/index.js onboard --defaults
   ```
   预期：在 `~/.conshell/config.json` 生成配置。

3. **启动服务器：**
   ```bash
   node packages/cli/dist/index.js start -p 4200
   ```
   预期：服务器在4200端口启动，输出 `🐢 ConShell running on http://localhost:4200`。

4. **WebUI可访问：**
   打开 http://localhost:4200 确认Dashboard加载。

5. **API可用：**
   ```bash
   curl http://localhost:4200/api/agent/status
   ```
   预期：返回JSON格式的Agent状态。

6. **REPL可用：**
   ```bash
   node packages/cli/dist/index.js
   ```
   预期：进入交互式对话，输入消息后Agent回复。

7. **单元测试全通过：**
   ```bash
   pnpm -r test
   ```
   预期：所有测试通过。

---

## 验证计划总结

### 自动化测试
- **命令：** `pnpm -r test`
- **覆盖范围：** types (branded Cents), config (loader), state (database + repos), policy (engine + rules), inference (router failover), runtime (state-machine + agent-loop), wallet, x402
- **预期：** 所有测试通过

### 手动验证
1. `pnpm -r build` — 三个包零错误编译
2. `conshell onboard --defaults` — 生成配置文件
3. `conshell onboard` — 交互式8步向导流程正常（🐢乌龟banner显示正确）
4. `conshell start -p 4200` — 服务器启动
5. `curl http://localhost:4200/api/agent/status` — API返回JSON
6. 浏览器打开 http://localhost:4200 — Dashboard加载
7. `conshell` — REPL可以对话
8. `conshell doctor` — 健康检查通过
