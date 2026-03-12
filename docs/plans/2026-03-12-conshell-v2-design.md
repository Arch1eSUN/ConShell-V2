# ConShell V2 设计文档

> 🐢 Sovereign AI Agent Runtime — Conway Automaton + OpenClaw 融合项目

## 背景

ConShell V1 是一个融合了 [Conway Automaton](https://github.com/Conway-Research/automaton)（自主AI运行时）和 [OpenClaw](https://github.com/openclaw/openclaw)（个人AI助手）的项目，基于 [web4.ai](https://web4.ai) 定义的标准构建。V1采用了19个包的pnpm monorepo架构，因功能铺得太多、逻辑纠缠难以继续开发而停止。

V2的目标是**保留V1所有已验证的核心逻辑，但用极简3包架构重新组织**，避免V1的复杂度爆炸。

## 设计决策总结

| 决策项 | 选择 |
|--------|------|
| 开发优先级 | Phase 1: 核心融合 → Phase 2: 新功能 → Phase 3: 安全升级 |
| 包结构 | 极简3包：`core` + `cli` + `dashboard` |
| 推理接入 | 多Provider（CLIProxyAPI为低成本入口，同时支持OpenAI/Anthropic/Google/DeepSeek/Ollama） |
| Phase 1 渠道 | CLI REPL + WebUI Dashboard（消息渠道放Phase 2） |
| 钱包/x402 | 真实上链（Base链 + ERC-8004） |
| 安装方式 | npm/brew，`conshell onboard` 命令启动配置向导 |
| 方法论 | 渐进重构（从V1提取核心代码合并到3个包） |

---

## 架构总览

```
用户
 │
 ├─ CLI REPL ──────┐
 │                  ▼
 │          ┌─────────────────┐        LLM Providers
 │          │   ConShell      │   ←──→ CLIProxyAPI / OpenAI / Anthropic
 └─ WebUI ──│   (core)        │        / Google / DeepSeek / Ollama
            │   :4200         │
            └────────┬────────┘
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
   SQLite         Ethereum       x402
   (状态/记忆)    (ERC-8004)    (Machine Payment)
```

---

## 包结构

### `packages/core/` — 引擎核心（合并V1的16个包）

所有核心逻辑在一个包里，通过 `src/` 子目录来分模块，零跨包依赖。

```
packages/core/src/
├── types/           # 共享类型、branded money (Cents)、错误码、AgentState
├── config/          # 配置加载器（~/.conshell/config.json + .env 合并）
├── logger/          # 控制台日志（带级别过滤）
├── state/           # SQLite (WAL mode) + 迁移 + 精简Repository
│   ├── database.ts      # openDatabase + 迁移
│   ├── repos/           # 8-10个Repository（合并V1的18个）
│   │   ├── turns.ts         # 对话轮次
│   │   ├── transactions.ts  # 交易记录
│   │   ├── heartbeat.ts     # 心跳任务
│   │   ├── memory.ts        # 统一记忆存储（合并5类→3层：hot/warm/cold）
│   │   ├── models.ts        # 模型注册 + 推理成本
│   │   ├── policy.ts        # 策略决策日志
│   │   ├── soul.ts          # Soul历史
│   │   ├── skills.ts        # 技能注册
│   │   └── provider.ts      # Provider配置 + 路由配置 + 能力配置
│   └── index.ts
├── policy/          # 24规则策略引擎（保留V1）
│   ├── engine.ts        # PolicyEngine
│   ├── rules/           # authority / command-safety / path-protection / validation
│   └── tool-registry.ts # ToolRegistry
├── inference/       # 多Provider推理路由
│   ├── router.ts        # InferenceRouter（failover + 成本追踪）
│   ├── providers/       # 可插拔Provider
│   │   ├── cliproxy.ts      # CLIProxyAPI（OpenAI兼容格式）
│   │   ├── openai.ts        # OpenAI 直连
│   │   ├── anthropic.ts     # Anthropic 直连
│   │   ├── google.ts        # Gemini 直连
│   │   ├── deepseek.ts      # DeepSeek 直连
│   │   ├── ollama.ts        # 本地Ollama
│   │   └── openrouter.ts    # OpenRouter
│   └── index.ts
├── runtime/         # Agent运行时
│   ├── agent-loop.ts    # ReAct循环（Think → Act → Observe → Persist）
│   ├── heartbeat.ts     # 心跳守护进程（信用监控、健康检查）
│   ├── state-machine.ts # Agent状态机（Setup→Waking→Running→Sleeping→Dead）
│   ├── tool-executor.ts # 工具执行器
│   ├── task-queue.ts    # 异步任务队列
│   └── tools/           # 内置工具定义
│       ├── web.ts           # web_search / web_browse / read_rss
│       ├── shell.ts         # shell_exec
│       ├── filesystem.ts    # file_read / file_write
│       └── http.ts          # http_request
├── memory/          # 分层记忆系统（简化为3层）
│   ├── tier-manager.ts  # hot (会话) / warm (事实) / cold (归档)
│   └── index.ts
├── wallet/          # Ethereum钱包
│   ├── provider.ts      # OnchainWalletProvider (viem)
│   ├── erc8004.ts       # ERC-8004注册
│   └── index.ts
├── x402/            # HTTP 402支付协议
│   ├── server.ts        # X402Server
│   ├── facilitator.ts   # 真实/Mock Facilitator
│   └── index.ts
├── soul/            # 身份与对齐
│   ├── system.ts        # SoulSystem + SOUL.md 管理
│   └── index.ts
├── skills/          # 技能系统
│   ├── loader.ts        # 技能加载器
│   ├── registry.ts      # SkillRegistry
│   └── index.ts
├── server/          # HTTP + WebSocket 服务器
│   ├── http.ts          # Express路由（REST API）
│   ├── websocket.ts     # WebSocket（实时通信）
│   ├── routes/          # API路由定义
│   └── middleware/      # 认证、限速
├── proxy/           # CLIProxy兼容API端点
│   ├── server.ts        # OpenAI格式兼容 /v1/chat/completions
│   └── index.ts
├── kernel.ts        # 引导序列（合并V1的 kernel.ts）
└── index.ts         # 公开API
```

### `packages/cli/` — 命令行界面

```
packages/cli/src/
├── index.ts         # CLI 入口（commander）
├── onboard.ts       # 8步配置向导（保留V1的🐢乌龟banner + 渐变色）
├── repl.ts          # 终端REPL对话
├── daemon.ts        # 后台守护（launchd/systemd）
├── doctor.ts        # 健康检查
├── admin.ts         # 管理命令
└── login.ts         # OAuth登录
```

### `packages/dashboard/` — WebUI

```
packages/dashboard/
├── index.html
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── api/             # HTTP + WebSocket 客户端
    ├── pages/
    │   ├── ChatPage.tsx     # 对话界面
    │   ├── SettingsPage.tsx # 全局配置
    │   ├── IdentityPage.tsx # Agent身份 + 钱包
    │   ├── MetricsPage.tsx  # 推理成本 + 使用量
    │   ├── SkillsPage.tsx   # 技能管理
    │   ├── TasksPage.tsx    # 心跳任务
    │   └── MemoryPage.tsx   # 记忆查看
    ├── components/      # 共享UI组件
    └── styles/          # CSS
```

---

## V1 → V2 关键简化

### Repository精简（18 → 9）

| V1 (18个) | V2 (9个) | 说明 |
|-----------|----------|------|
| WorkingMemory + EpisodicMemory + SemanticMemory + ProceduralMemory + RelationshipMemory | **MemoryRepository** | 统一存储，用 `tier` + `type` 字段区分 |
| ModelRegistry + InferenceCosts | **ModelsRepository** | 合并模型注册和成本追踪 |
| ProviderConfig + RoutingConfig + CapabilityConfig | **ProviderRepository** | 合并Provider相关配置 |
| Turns | **TurnsRepository** | 保留 |
| Transactions | **TransactionsRepository** | 保留 |
| Heartbeat | **HeartbeatRepository** | 保留 |
| PolicyDecisions | **PolicyRepository** | 保留 |
| SoulHistory | **SoulRepository** | 保留 |
| Skills (新增) | **SkillsRepository** | 新增，管理已安装技能 |
| Children + Spend + Modifications | 暂不实现 | Phase 2再做（自我复制、花费追踪、自我修改） |

### 记忆系统简化（5层 → 3层）

| V1 (5层) | V2 (3层) |
|----------|----------|
| Working (会话) | **Hot** — 当前会话上下文 |
| Episodic (轮次日志) + Relationship (信任) | **Warm** — 事实 + 关系 + 近期事件 |
| Semantic (事实) + Procedural (技能) | **Cold** — 长期知识 + 习得技能 |

---

## Onboarding 流程（保留V1设计）

完全保留V1的8步向导流程和UI设计（🐢乌龟ASCII art、渐变色进度条、inquirer提示）：

```
1/8  🧬 Agent Identity     — 名字 + genesis prompt
2/8  🧠 Inference Engine   — 选择推理模式（Ollama/CLIProxy/Direct API/Conway Cloud）
3/8  🛡️ Security           — 宪法确认 + 安全等级
4/8  💳 Wallet             — 生成Ethereum钱包
5/8  📡 Channels           — 选择消息渠道（Phase 1可跳过）
6/8  🔧 Skills             — 技能目录 + ClawHub
7/8  🌐 Browser            — Playwright / CDP / None
8/8  🖥️ Interface          — REPL 或 WebUI
```

**安装方式**（参考OpenClaw）：
```bash
# npm 安装
npm install -g conshell@latest

# 首次配置
conshell onboard --install-daemon

# 常用命令
conshell              # 交互式REPL
conshell start        # 启动服务器 + WebUI
conshell login        # 连接AI Provider（OAuth）
conshell doctor       # 健康检查
conshell configure    # 编辑设置
```

---

## 推理层设计

```typescript
interface InferenceProvider {
  readonly id: string;           // 'cliproxy' | 'openai' | 'anthropic' | ...
  readonly name: string;
  chat(messages: Message[], options: ChatOptions): AsyncIterable<Chunk>;
  listModels(): Promise<string[]>;
  estimateCost(model: string, tokens: number): Cents;
}

class InferenceRouter {
  private providers: Map<string, InferenceProvider>;
  private primaryId: string;
  private fallbackOrder: string[];
  
  // Failover: primary失败 → 按顺序尝试fallback
  async chat(messages, options): AsyncIterable<Chunk>;
}
```

**CLIProxyAPI接入**：因为CLIProxyAPI本身就是OpenAI兼容格式，所以CLIProxy Provider只需要设置不同的 `baseUrl` + `apiKey`，复用OpenAI的SDK即可。

---

## Phase 1 交付物

完成后用户可以做到：

1. ✅ `npm install -g conshell` 安装
2. ✅ `conshell onboard` 完成配置（🐢乌龟界面）
3. ✅ `conshell` 进入终端REPL与Agent对话
4. ✅ `conshell start` 打开WebUI Dashboard
5. ✅ Agent通过ReAct循环自主思考和行动
6. ✅ 心跳守护持续运行（信用监控、健康检查）
7. ✅ 真实Ethereum钱包 + ERC-8004身份
8. ✅ x402支付协议
9. ✅ 多Provider推理（CLIProxyAPI + OpenAI + Anthropic + Google + DeepSeek + Ollama）
10. ✅ 24规则策略引擎
11. ✅ 3层记忆系统
12. ✅ WebUI中可自由配置、修改设置、对话

---

## Phase 2 / Phase 3 路线图（不在本次范围）

**Phase 2（新功能扩展）**：
- 消息渠道（Telegram / Discord / Slack / WhatsApp / iMessage）
- 自我修改引擎
- 自我复制
- Agent Federation（联邦发现 + 协作）
- 语音管道（STT + TTS）
- MCP Server 暴露

**Phase 3（安全升级）**：
- Plugin沙箱
- JWT认证
- Vault密钥存储
- E2E集成测试

---

## 技术栈

| 层 | 技术 |
|---|------|
| 运行时 | Node.js ≥ 20, TypeScript (strict) |
| 包管理 | pnpm workspaces |
| 数据库 | better-sqlite3 (WAL mode) |
| HTTP | Express |
| WebSocket | ws |
| CLI | commander + @inquirer/prompts + chalk + ora |
| 钱包 | viem (Ethereum) |
| Dashboard | Vite + React + TypeScript |
| 测试 | vitest |
