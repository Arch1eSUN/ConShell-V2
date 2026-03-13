# 🐢 ConShell V2 — 开发日志 (DEVLOG)

> **最后更新**: 2026-03-13 (Round 8)
> **用途**: 提供给 LLM (GPT/Claude) 快速理解项目全貌，生成下一步开发计划。

---

## 1. 项目是什么

**ConShell V2** 是一个 **Sovereign AI Agent Runtime**（自主 AI Agent 运行时），融合了 Conway Automaton 和 OpenClaw 的设计理念。

核心定位：构建一个能够 **自我维持经济运转、自我管理身份、受宪法约束运行** 的 AI Agent。基于 Web 4.0 宣言和 x402 支付协议。

### 技术栈

- **语言**: TypeScript（strict mode）
- **包管理**: pnpm monorepo
- **测试**: vitest（28 个测试文件，429 个测试用例）
- **构建**: tsc
- **CI**: GitHub Actions

### 仓库结构

```
ConShellV2/
├── packages/
│   ├── core/          # Agent 核心引擎（40+ 模块）
│   ├── cli/           # 交互式 REPL
│   └── dashboard/     # React 监控面板
├── .github/workflows/ # CI/CD
└── package.json       # 工作区根
```

---

## 2. 开发目标

### 长期目标
- 具备完整经济闭环的自主 AI Agent
- 端到端 channel 通信（WebChat → Telegram → Discord → …）
- 带策略引擎、宪法约束、预算管理的安全运行时
- 插件生态系统（沙盒隔离）
- 多 Agent 协调

### 当前阶段目标（受控扩张阶段）
验证 runtime 的 **真实可扩展性**——不是"接口存在"，而是"能力存在"。通过逐步构建 WebChat channel 的完整闭环来证明。

---

## 3. 已完成的开发轮次（按时间顺序）

### Round 1: 工程基线恢复 `875e324`
**目标**: 从零建立可信赖的工程基础

- Git 仓库 + CI 建立
- core / cli / dashboard 三个包均可构建
- 默认测试全部通过
- TypeScript strict mode 全局启用

### Round 2: 工程清理 `52de314`
**目标**: 清理技术债务，分离关注点

- Git 忽略文件优化
- Benchmark 测试从功能测试中分离（`test:bench` 独立脚本）
- 构建产物清理

### Round 3: 扩展准备 `89bbf2d`
**目标**: 建立 API 边界，准备受控扩展

- `@conshell/core/public` — 稳定公共 API 层
- 所有外部消费者（CLI、Dashboard）切换到 public API
- 测试基线统一

### Round 4: Public API Layer `789d991`
**目标**: 固化公共接口

- `exports` map — 通过 `package.json` 的 exports 字段控制可访问性
- `api-surface.test.ts` — 自动验证 public API 不会意外变化
- 文档更新

### Round 5: 最小插件闭环 `76643a4`
**目标**: 证明 runtime 的扩展能力真实存在

- `PluginManager` — 插件生命周期管理
- VM 沙盒隔离 — 插件运行在安全沙箱中
- `validateManifest()` — 插件清单校验
- Demo 插件 E2E 测试 — 加载 → 执行 → 卸载 完整闭环通过

### Round 6: WebChat Channel Runtime 闭环 `4e4feb9`
**目标**: 第一个真实 Channel Adapter + HTTP 路由 + WebSocket Push

**6a — Channel Runtime 闭环**:
- `WebChatAdapter` — 实现 `ChannelAdapter` 接口
- `ChannelManager` — 多通道管理器 + 事件系统
- `Gateway` — 消息路由 + 速率限制
- 26 个 WebChat E2E 测试

**6b — HTTP 路由补完**:
- `POST /api/webchat/message` — 真实对外 HTTP 端点
- 请求体校验（`validateRequest()`）
- 完整请求→管道→响应闭环
- `HttpServer` + `fetch()` 集成测试

**6c — WebSocket Push 闭环**:
- `WebSocketServer` — 帧级 WS 服务器
- `WebChatPushBridge` — session 到 clientId 的映射
- WS 协议：`subscribe` / `unsubscribe` / `message` / `status` / `ping` / `pong`
- 12 个 push bridge 测试

---

### Round 7: Token-Level Streaming + Wiring 技术债清理

> **日期**: 2026-03-13

**目标**: 实现 token 级 streaming；清理 Round 6 遗留的类型安全问题。

- `WebChatTransport.channelManager` 只读 getter — 消除 `as any`
- `StreamChunk` 类型 + `message:chunk` 事件 + `emitChunk()` 方法
- `WebChatPushBridge` 监听 `message:chunk` → WS `type: "chunk"` 帧
- `Gateway.routeStreamingMessage()` — 模拟分词 streaming 路径
- 5 个新增 streaming push 测试

---

### Round 8 (最新): Streaming Protocol Hardening 流式协议加固

> **日期**: 2026-03-13

**目标**: 在不破坏 HTTP + WS 双闭环的前提下，把 streaming 路径修成协议一致、失败语义明确的稳定实现。

#### 8a — InferenceRouter.chatStreaming()

新增专用 streaming 方法，实施严格的 failover 策略：

- **Pre-token 失败** → 允许 fallback 到备选 provider（与 `chat()` 行为一致）
- **Post-token 失败** → 直接抛出错误，**不静默拼接**另一个 provider 的输出
- 通过 `textYielded` 标记追踪 failover 窗口

#### 8b — Gateway 协议收口

`routeStreamingMessage()` / `routeWithInference()` / `routeFallback()` 全部重写：

**Chunk 规则**:
- `chunk.content` 必须非空 — 不再有空 final chunk 标记
- 最后一个 content chunk 的 `final=true`，其余 `final=false`
- `chunk.index` 严格递增

**Outbound 规则**:
- 无条件发送 — 即使是 zero-text completion，也发空 content outbound
- HTTP 请求永不超时（消除 504 gateway timeout）
- `sendSafe()` 保障函数 — outbound 发送被 try/catch 包裹

**Status Lifecycle**:
- `processing` — stream 开始
- `completed` — outbound 发送成功
- `failed` — sendSafe 本身失败（极少情况）

#### 8c — StatusEvent + emitStatus()

`ChannelManager` 新增：
```typescript
interface StatusEvent {
  platform: ChannelPlatform;
  to: string;
  status: 'processing' | 'completed' | 'failed';
}

// ChannelEventMap 新增
'message:status': StatusEvent;

// ChannelManager 新增方法
emitStatus(evt: StatusEvent): void;
```

#### 8d — Push Bridge Status 事件桥接

`WebChatPushBridge` 新增 `message:status` 监听器 → 自动将 status 事件推送到对应 session 的 WS 客户端。

#### 8e — 测试矩阵更新

| 测试场景 | 状态 |
|----------|------|
| 无空 chunk / last chunk `final=true` / outbound exactly once | ✅ |
| zero-text completion — 0 chunks, 空 outbound, 不 timeout | ✅ |
| mid-stream failure — 不静默拼接 fallback | ✅ |
| pre-token failure — 干净 fallback | ✅ |
| status lifecycle: `processing → completed` | ✅ |
| status lifecycle: `processing → completed` (no-handler 空 fallback) | ✅ |
| fallback without router — outbound exactly once | ✅ |
| chatStreaming: pre-token fallback | ✅ |
| chatStreaming: post-token failure throws | ✅ |
| chatStreaming: normal path | ✅ |

#### 8f — 旧测试适配

3 个旧测试从 "no-handler = timeout" 改为 "no-handler = 200 + 空 reply"：
- `server.test.ts` — 504 → 200
- `webchat-e2e.test.ts` — rejects → resolves with empty reply

#### 8g — 验证结果

- `tsc --noEmit` → **0 errors**
- `vitest run` → **28 files, 429 tests, all passed**

---

## 4. 当前 Public API 目录

以下是 `@conshell/core/public` 导出的稳定接口：

| 分类 | 导出 |
|------|------|
| **Runtime** | `Kernel`, `createKernel`, `VERSION`, `BootStage`, `BootResult`, `KernelServices` |
| **Config** | `loadConfig`, `createLogger`, `AppConfig`, `InferenceMode`, `InterfaceMode` |
| **Core Types** | `AgentState`, `SecurityLevel`, `Cents`, `toCents`, `ZERO_CENTS`, `Message`, `ToolCallRequest`, `ToolResult` |
| **Channels** | `ChannelManager`, `WebChatAdapter`, `WebChatTransport`, `WebChatPushBridge`, `validateRequest` |
| **Channel Types** | `ChannelAdapter`, `ChannelConfig`, `ChannelMessage`, `ChannelPlatform`, `ChannelState`, `OutboundMessage`, `StreamChunk` |
| **Plugins** | `PluginManager`, `validateManifest`, `PluginManifest`, `PluginPermission`, `PluginHook`, `PluginState` |
| **Policy** | `PolicyContext`, `PolicyResult` |
| **Constitution** | `THREE_LAWS`, `CONSTITUTION_HASH`, `ConstitutionLaw` |

---

## 5. 核心模块索引（40+ 模块）

```
core/src/
├── kernel/         # 11 阶段启动序列，服务编排
├── constitution/   # 三大法则 — 不可变、分层
├── policy/         # 24 条策略引擎（6 类）
├── inference/      # 多提供商 LLM 路由 + SurvivalTier failover
│   └── providers/  # 具体 LLM 提供商
├── wallet/         # ERC-8004 链上身份 + x402 微支付
├── x402/           # x402 协议实现
├── channels/       # 多通道消息系统
│   ├── adapters/   # 平台适配器
│   └── webchat/    # WebChat 完整实现（transport + push bridge）
├── plugins/        # 沙盒插件系统（VM 隔离）
│   └── demo/       # 演示插件
├── memory/         # 分层内存（hot/warm/cold）
├── soul/           # Agent 身份 + 人格管理
├── tools/          # 50+ 内建工具（13 类）
├── mcp/            # Model Context Protocol 网关
├── multiagent/     # 多 Agent 协调
├── selfmod/        # 自我修改 + 审计追踪
├── spend/          # 预算追踪 + 成本管理
├── evomap/         # 演化能力映射
├── compute/        # 分布式算力管理
├── server/         # HTTP + WebSocket 服务器
│   ├── middleware/ # 中间件
│   └── routes/     # API 路由
├── state/          # 持久化状态（SQLite WAL）
│   └── repos/      # 类型化仓库
├── identity/       # 身份管理
├── config/         # 配置加载
├── logger/         # 结构化日志
├── runtime/        # Agent 运行时循环
│   └── tools/      # 运行时工具
├── automaton/      # Conway Automaton 核心
├── facilitator/    # 便利工具
├── git/            # Git 管理
├── observability/  # 可观测性
├── skills/         # 技能系统
├── api/            # API 层
├── api-surface/    # API 表面测试
├── dashboard/      # Dashboard 数据服务
├── integration/    # 集成测试
├── models/         # 数据模型
└── types/          # 共享类型
```

---

## 6. 测试矩阵

| 测试文件 | 测试数 | 关注领域 |
|----------|--------|----------|
| `channels.test.ts` | 37 | 适配器、ChannelManager、Gateway、Streaming 协议 |
| `webchat-e2e.test.ts` | 26 | WebChat HTTP 全栈 E2E |
| `automaton.test.ts` | 25 | Conway Automaton 核心 |
| `constitution.test.ts` | 20 | 三大法则合规 |
| `policy.test.ts` | 20 | 策略引擎 |
| `sandbox.test.ts` | 20 | 插件 VM 沙盒 |
| `server.test.ts` | 18 | HTTP + WS 服务器 |
| `spend.test.ts` | 17 | 预算管理 |
| `webchat-push.test.ts` | 17 | WS 推送 + chunk streaming |
| `plugin-e2e.test.ts` | 17 | 插件闭环 E2E |
| `inference.test.ts` | 17 | LLM 推理路由 + chatStreaming failover |
| `dashboard.test.ts` | 16 | Dashboard 数据 |
| `identity.test.ts` | 16 | 身份管理 |
| `multiagent.test.ts` | 16 | 多 Agent 协调 |
| `api-surface.test.ts` | 15 | Public API 稳定性 |
| `plugins.test.ts` | 12 | 插件管理 |
| `evomap.test.ts` | 11 | 演化映射 |
| `mcp/gateway.test.ts` | 11 | MCP 网关 |
| `config.test.ts` | 10 | 配置加载 |
| `selfmod.test.ts` | 10 | 自我修改 |
| `wallet.test.ts` | 9 | 钱包 |
| `erc8004.test.ts` | 9 | ERC-8004 |
| `logger.test.ts` | 8 | 日志 |
| `facilitator.test.ts` | 7 | 便利工具 |
| `kernel.test.ts` | 5 | 内核启动 |
| `compute.test.ts` | 4 | 算力管理 |
| `git.test.ts` | 4 | Git 操作 |
| `f4-f6.test.ts` | 32 | 集成测试 |
| **合计** | **429** | |

---

## 7. WebSocket 推送协议（当前完整版）

### 连接

```
ws://host:port/ws
```

### Client → Server

| type | payload | 说明 |
|------|---------|------|
| `subscribe` | `{ sessionId }` | 订阅某 session 的推送 |
| `unsubscribe` | `{ sessionId }` | 取消订阅 |
| `ping` | — | 心跳 |

### Server → Client

| type | payload | 说明 |
|------|---------|------|
| `subscribed` | `{ sessionId }` | 订阅确认 |
| `status` | `{ sessionId, status }` | 处理状态更新 |
| `chunk` | `{ sessionId, content, index, final }` | Token 级流式推送 |
| `message` | `{ sessionId, platform, content, ... }` | 完整消息推送 |
| `pong` | — | 心跳响应 |

### 流式推送时序

```
Client             Server
  │─── subscribe ──→ │
  │←── subscribed ──│
  │                   │ (inbound message arrives)
  │←── status ───────│  { status: "processing" }
  │←── chunk ────────│  { content: "Hello ", index: 0, final: false }
  │←── chunk ────────│  { content: "World", index: 1, final: true }
  │←── message ──────│  { content: "Hello World" }  (complete)
  │←── status ───────│  { status: "completed" }
```

---

## 8. 推荐的下一步开发方向

> 以下是基于当前进度的建议，按优先级排序。

### 高优先级

1. **Session 持久化** — 当前 session 仅在内存中。接入 `state/repos` 实现 SQLite 持久化。
2. **AgentLoop 集成** — 将 WebChat 请求接入真实 Agent 循环（而非简单 route handler）。
3. **Dashboard WebSocket 集成** — 让 React Dashboard 通过 WS 协议实时显示 Agent 对话。

### 中优先级

4. **Telegram Channel Adapter** — 第二个 channel，验证多通道架构的通用性。
5. **Plugin 事件钩子** — 让插件能监听 channel 事件（`message:inbound` / `message:chunk`）。
6. **HTTP SSE 旁路** — 为不支持 WS 的客户端提供 Server-Sent Events fallback。

### 低优先级

7. **Auth 中间件** — 为 WebSocket 连接增加认证层。
8. **Rate Limiting per-session** — 按 session 级别限流（当前是全局）。
9. **Client-side streaming SDK** — JS/TS SDK 封装 WS chunk 协议。

---

## 9. 构建和测试命令

```bash
# 全量构建
pnpm build

# 单包构建
pnpm --filter @conshell/core build
pnpm --filter @conshell/cli build
pnpm --filter @conshell/dashboard build

# 全量测试
pnpm --filter @conshell/core test

# Benchmark（独立）
pnpm --filter @conshell/core test:bench

# TypeScript 类型检查
cd packages/core && npx tsc --noEmit

# 启动 CLI
pnpm --filter @conshell/cli start

# 启动 Dashboard
pnpm --filter @conshell/dashboard dev
```

---

## 10. Git 提交历史

```
4e4feb9 feat: webchat HTTP route + WebSocket push bridge
76643a4 feat: minimal plugin extension loop — first verified expansion
789d991 feat: public API layer — stable interface boundary via exports map
89bbf2d feat: expansion readiness — API boundary, CI, test unification
52de314 chore: engineering cleanup — git hygiene + benchmark separation
875e324 feat: initial commit — engineering baseline restored
```

**最新 commit (pending)**: `feat: streaming protocol hardening`
