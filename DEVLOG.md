# 🐢 ConShell V2 — 开发日志 (DEVLOG)

> **最后更新**: 2026-03-14 (Round 14.1)
> **用途**: 提供给 LLM (GPT/Claude) 快速理解项目全貌，生成下一步开发计划。

---

## 1. 项目是什么

**ConShell V2** 是一个 **Sovereign AI Agent Runtime**（自主 AI Agent 运行时），融合了 Conway Automaton 和 OpenClaw 的设计理念。

核心定位：构建一个能够 **自我维持经济运转、自我管理身份、受宪法约束运行** 的 AI Agent。基于 Web 4.0 宣言和 x402 支付协议。

### 技术栈

- **语言**: TypeScript（strict mode）
- **包管理**: pnpm monorepo
- **测试**: vitest（35 个测试文件（含 benchmark + doctor），522 个测试用例）
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

### Round 9 — True Incremental Streaming + Terminal Failure Semantics

**目标**: 实现真实增量 streaming（token 级实时推送）+ 显式终止失败语义，消除 Round 8 的 buffer-then-emit 模式。

#### 9a — One-Chunk Holdback 策略

`routeWithInference()` 完整重写：

- **策略**: 持有一个 pending chunk，当下一个 chunk 到达时立刻 emit 前一个（`final=false`）
- 流结束时，emit 最后一个 pending chunk（`final=true`）
- 实现了真正的增量推送（对比 Round 8 的 collect-all-then-emit）
- 单 token 流 → 直接 `final=true`
- 零 text → 0 chunks + 空 outbound

#### 9b — Pre/Post-Token 失败分离

`routeStreamingMessage()` 重写为两条分支：

**Pre-token failure**（chunksEmitted = 0 且无 pendingChunk）:
- 允许 fallback 到 route handlers
- 用户无感知

**Post-token failure**（有 token 被观测到）:
- ❌ 不允许 fallback stitching（防止混合输出）
- ✅ emit `StreamErrorEvent`（`message:error` 事件）
- ✅ 发送空 outbound（HTTP 不 hang）
- ✅ status → `failed`

通过 `_chunksEmitted` 属性附加到 error 对象上实现分支判断，包含 holdback 中未 flush 的 pending chunk 计数。

#### 9c — StreamErrorEvent + emitError()

新增类型与方法：

```typescript
type StreamStatus = 'processing' | 'completed' | 'failed';
type StreamErrorCode = 'INFERENCE_STREAM_FAILED' | 'PROVIDER_UNAVAILABLE';

interface StreamErrorEvent {
  platform: ChannelPlatform;
  to: string;
  code: StreamErrorCode;
  message: string;
  retryable: boolean;
}

// ChannelEventMap 新增
'message:error': StreamErrorEvent;

// ChannelManager 新增方法
emitError(event: StreamErrorEvent): void;
```

`StatusEvent.status` 从 `string` 收窄为 `StreamStatus` literal union。

#### 9d — Push Bridge Error 桥接

`WebChatPushBridge` 新增 `message:error` 监听器 → 自动将 error 事件推送到对应 session 的 WS 客户端。

包含 `errorHandler` 字段和完整的 cleanup 生命周期。

#### 9e — Public API 导出

新增 4 个类型导出：`StatusEvent`, `StreamStatus`, `StreamErrorEvent`, `StreamErrorCode`

#### 9f — 测试矩阵更新

| 测试场景 | 状态 |
|----------|------|
| 增量推送时序 — chunks 在 stream 期间而非完成后到达 | ✅ |
| one-chunk holdback — `final=true` 仅在最后一个 chunk | ✅ |
| 单 token stream — 1 chunk `final=true` | ✅ |
| post-token failure — error event + `status:failed` + 空 outbound | ✅ |
| post-token failure — 不触发 fallback stitching | ✅ |
| error event session 隔离 — 无跨 session 泄漏 | ✅ |
| pre-token failure — 干净 fallback（保持 Round 8 行为）| ✅ |
| zero-text / no-handler / fallback 测试（保持 Round 8 通过）| ✅ |

#### 9g — 验证结果

- `tsc --noEmit` → **0 errors**
- `vitest run` → **28 files, 434 tests, all passed**（+5 新增、1 更新）

---

## 4. 当前 Public API 目录

以下是 `@conshell/core/public` 导出的稳定接口：

| 分类 | 导出 |
|------|------|
| **Runtime** | `Kernel`, `createKernel`, `VERSION`, `BootStage`, `BootStageResult`, `BootResult`, `KernelServices` |
| **Config** | `loadConfig`, `createLogger`, `AppConfig`, `InferenceMode`, `InterfaceMode` |
| **Core Types** | `AgentState`, `SecurityLevel`, `Cents`, `toCents`, `ZERO_CENTS`, `Message`, `ToolCallRequest`, `ToolResult` |
| **Channels** | `ChannelManager`, `WebChatAdapter`, `WebChatTransport`, `WebChatPushBridge`, `validateRequest`, `WebChatRequest`, `WebChatResponse` |
| **Channel Types** | `ChannelAdapter`, `ChannelConfig`, `ChannelMessage`, `ChannelPlatform`, `ChannelState`, `OutboundMessage`, `StreamChunk`, `StatusEvent`, `StreamStatus`, `StreamErrorEvent`, `StreamErrorCode` |
| **Plugins** | `PluginManager`, `validateManifest`, `PluginManifest`, `PluginPermission`, `PluginHook`, `PluginState`, `PluginInstance`, `ValidationResult` |
| **Policy** | `PolicyContext`, `PolicyResult` |
| **Constitution** | `THREE_LAWS`, `CONSTITUTION_HASH` (values), `ConstitutionLaw` (type) |

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
├── tools/          # 9 内建工具（5 类: shell, filesystem, web, http, memory）
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
| `channels.test.ts` | 42 | 适配器、ChannelManager、Gateway、Streaming 协议 |
| `f4-f6.test.ts` | 32 | 集成测试 |
| `webchat-e2e.test.ts` | 26 | WebChat HTTP 全栈 E2E |
| `automaton.test.ts` | 25 | Conway Automaton 核心 |
| `constitution.test.ts` | 20 | 三大法则合规 |
| `policy.test.ts` | 20 | 策略引擎 |
| `sandbox.test.ts` | 20 | 插件 VM 沙盒 |
| `server.test.ts` | 18 | HTTP + WS 服务器 |
| `spend.test.ts` (spend/) | 17 | 预算管理 |
| `webchat-push.test.ts` | 17 | WS 推送 + chunk streaming |
| `plugin-e2e.test.ts` | 17 | 插件闭环 E2E |
| `inference.test.ts` | 17 | LLM 推理路由 + chatStreaming failover |
| `dashboard.test.ts` | 16 | Dashboard 数据 |
| `identity.test.ts` | 16 | 身份管理 |
| `multiagent.test.ts` | 16 | 多 Agent 协调 |
| `api-surface.test.ts` | 15 | Public API 稳定性 |
| `conversation-service.test.ts` | 14 | 会话服务（Round 10） |
| `sessions.test.ts` | 13 | Session 持久化（Round 10） |
| `plugins.test.ts` | 12 | 插件管理 |
| `evomap.test.ts` | 11 | 演化映射 |
| `mcp/gateway.test.ts` | 11 | MCP 网关 |
| `memory.test.ts` (tools/) | 12 | 记忆工具（Round 11） |
| `config.test.ts` | 10 | 配置加载 |
| `selfmod.test.ts` | 10 | 自我修改 |
| `builtin.test.ts` | 10 | 内建工具集成（Round 11） |
| `wallet.test.ts` | 9 | 钱包 |
| `erc8004.test.ts` | 9 | ERC-8004 |
| `agent-loop.test.ts` | 9 | AgentLoop session 隔离 + 流式 + 工具调用（Round 12） |
| `spend.test.ts` (repos/) | 8 | Spend 持久化（Round 11） |
| `logger.test.ts` | 8 | 日志 |
| `kernel.test.ts` | 8 | 内核启动 + 记忆工具注册（Round 12） |
| `facilitator.test.ts` | 7 | 便利工具 |
| `compute.test.ts` | 4 | 算力管理 |
| `git.test.ts` | 4 | Git 操作 |
| `perf.test.ts` | — | Benchmark（独立运行） |
| **合计** | **507** | **34 文件（含 benchmark）** |

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
| `status` | `{ sessionId, status }` | 处理状态更新 (`processing`/`completed`/`failed`) |
| `chunk` | `{ sessionId, content, index, final }` | Token 级流式推送（增量实时）|
| `message` | `{ sessionId, platform, content, ... }` | 完整消息推送 |
| `error` | `{ sessionId, code, message, retryable }` | 流式错误通知 |
| `pong` | — | 心跳响应 |

### 流式推送时序

```
Client             Server
  │─── subscribe ──→ │
  │←── subscribed ──│
  │                   │ (inbound message arrives)
  │←── status ───────│  { status: "processing" }
  │←── chunk ────────│  { content: "Hello ", index: 0, final: false }  ← 增量实时推送
  │←── chunk ────────│  { content: "World", index: 1, final: true }
  │←── message ──────│  { content: "Hello World" }  (complete)
  │←── status ───────│  { status: "completed" }

--- 失败场景 ---
  │←── status ───────│  { status: "processing" }
  │←── chunk ────────│  { content: "partial", index: 0, final: false }
  │       ⚡ inference provider 崩溃
  │←── error ────────│  { code: "INFERENCE_STREAM_FAILED", retryable: true }
  │←── status ───────│  { status: "failed" }
```

---

## 8. 推荐的下一步开发方向

> 以下是基于当前进度（Round 11 完成后）的建议，按优先级排序。

### 高优先级

1. ~~**Session 持久化**~~ ✅ 已在 Round 10 完成（SessionsRepository + ConversationService）
2. ~~**AgentLoop 集成**~~ ✅ 已在 Round 12 完成（session-isolated AgentLoop + memory tools wiring + Gateway 路由）
3. **Dashboard 真实数据集成** — 让 Dashboard 各页面使用 real backend data 而非 mock。

### 中优先级

4. **第二个 Channel Adapter** — 验证多通道架构的通用性（如 Telegram）。
5. **Auth 中间件** — 为 HTTP + WebSocket 增加认证层（当前无 auth）。
6. **Plugin 事件钩子** — 让插件能监听 channel 事件（`message:inbound` / `message:chunk`）。

### 低优先级

7. **HTTP SSE 旁路** — 为不支持 WS 的客户端提供 Server-Sent Events fallback。
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
875e324 feat: initial commit — engineering baseline restored
52de314 chore: engineering cleanup — git hygiene + benchmark separation
89bbf2d feat: expansion readiness — API boundary, CI, test unification
789d991 feat: public API layer — stable interface boundary via exports map
76643a4 feat: minimal plugin extension loop — first verified expansion
4e4feb9 feat: webchat HTTP route + WebSocket push bridge
4f3cdc0 feat: token-level streaming + wiring cleanup + DEVLOG
617942f chore: remove accidental symlink entries from tracking
9e65fe2 feat: replace mock streaming with real InferenceRouter-driven token streaming
fb81e7f feat: streaming protocol hardening
c3b71a6 feat: true incremental streaming + terminal failure semantics
6566c0e docs: reconcile README + DEVLOG to match Round 9 code reality
21e04c2 feat(state): Round 10 — persistent conversation state
18bcb98 docs(audit): Round 10 reconciliation — fix docs, CI, test count
257a7d5 fix(dashboard): export SessionItem/TurnItem from api barrel
ce7d0fa feat(tools): Round 11 — memory tools + spend persistence
41d3f25 docs: update README/DEVLOG for Round 11 — 490 tests
```

---

## Round 10 — Persistent Conversation State (2026-03-13)

**目标**: 实现 session-scoped 持久对话状态，让 runtime 从「streaming chat transport 可用」推进到「runtime 拥有持久化会话状态和可用的 session 界面」。

**Commit**: `21e04c2`

### 交付物

| 组件 | 文件 | 说明 |
|------|------|------|
| Migration v5 | `state/database.ts` | sessions 表 + 2 个索引 |
| SessionsRepository | `state/repos/sessions.ts` | CRUD / upsert / cascade delete / listWithCount |
| ConversationService | `channels/webchat/conversation-service.ts` | appendTurn + buildContext + auto-title |
| Session REST API | `server/routes/sessions.ts` | GET /api/sessions, GET /api/sessions/:id/transcript, DELETE, PATCH |
| Gateway 注入 | `channels/gateway.ts` | ConversationService 注入，persist user/assistant turns |
| server-init 注册 | `kernel/server-init.ts` | 条件注入 db → registerSessionRoutes |
| Dashboard Session UI | `dashboard/src/pages/ChatPage.tsx` | session sidebar + transcript loading + delete |
| API Client | `dashboard/src/api/client.ts` | SessionItem/TurnItem types + 4 methods |
| repos re-export | `state/repos/index.ts` | SessionsRepository export |

### 测试

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `sessions.test.ts` | 13 | ✅ |
| `conversation-service.test.ts` | 14 | ✅ |
| **总计** | **461 / 461** | **✅ 全通过** |

---

## Round 11 — Memory Tools + Spend Persistence (2026-03-13)

**目标**: 修复 G1（工具空壳）和 G2（Spend纯内存不持久化），让 Agent 具备真实的记忆操作能力和经济追踪持久性。

### 交付物

| 组件 | 文件 | 说明 |
|------|------|------|
| memory_store 工具 | `runtime/tools/memory.ts` [NEW] | 存储 fact/episode/relationship 到 MemoryTierManager |
| memory_recall 工具 | `runtime/tools/memory.ts` [NEW] | 从 3 层记忆构建上下文并返回给 LLM |
| createMemoryTools 工厂 | `runtime/tools/memory.ts` [NEW] | 需 runtime 注入 MemoryTierManager 实例 |
| SpendRepository | `state/repos/spend.ts` [NEW] | 连接 spend_tracking 表 (migration v2)，支持 insert/total/daily/hourly/breakdown |
| SpendTracker 持久化 | `spend/index.ts` | 接受可选 SpendRepository，recordSpend/recordIncome 自动写入 SQLite |
| 工具导出更新 | `runtime/tools/index.ts` | 添加 createMemoryTools 导出 |
| Repo 导出更新 | `state/repos/index.ts` | 添加 SpendRepository 导出 |

### 测试

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `spend.test.ts` [NEW] | 8 | ✅ |
| `memory.test.ts` [NEW] | 11 | ✅ |
| `builtin.test.ts` [NEW] | 10 | ✅ |
| **总计** | **490 / 490** | **✅ 全通过** |



### 关键设计决策

1. **Memory 工具使用工厂模式**: `createMemoryTools(memory)` 而非全局导出，因为 MemoryTierManager 需要 runtime（db实例）才能创建
2. **SpendTracker 向后兼容**: repo 参数可选，不传则退回纯内存模式
3. **SpendRepository 复用已有表**: spend_tracking 表已在 migration v2 创建，无需新增 migration

---

## Round 12 — Session-Isolated AgentLoop Integration + Runtime Memory Tool Wiring (2026-03-13)

**目标**: 将 WebChat 请求接入完整 Agent 循环（ReAct Think→Act→Observe→Persist），实现 session-isolated 上下文 + 记忆工具运行时注册 + 流式 AgentLoop 输出。

### 交付物

| 组件 | 文件 | 说明 |
|------|------|------|
| T1: Kernel 记忆工具注册 | `kernel/index.ts` | Step 8 调用 `createMemoryTools(memory)` 并注册到 ToolExecutor |
| T2: Session-scoped hot buffer | `memory/tier-manager.ts` | `hotBuffer` → `hotBuffers: Map<string, HotEntry[]>`, pushHot/getHot/clearHot 接受 sessionId |
| T2: AgentLoop session 感知 | `runtime/agent-loop.ts` | `processMessage(msg, sessionId?)` + `processMessageStream()` async generator |
| T2: ConversationService 注入 | `runtime/agent-loop.ts` | 可选 ConversationService 用于持久化上下文构建 |
| T3: Gateway AgentLoop 路由 | `channels/gateway.ts` | `routeWithAgentLoop()` — AgentLoop streaming + one-chunk holdback + 持久化 |
| T3: Gateway 配置扩展 | `channels/gateway.ts` | GatewayConfig 新增 `agentLoop` 字段 |
| T4: Kernel wiring | `kernel/index.ts` | ConversationService 在 Step 8 创建并传入 AgentLoop + server-init |
| T4: ServerInitDeps 扩展 | `kernel/server-init.ts` | 新增 `conversationService` 可选字段 |
| Memory API 适配 | `server/routes/memory.ts` | `getHot()` → `hotSessions` 统计 |

### 关键设计决策

1. **Hot buffer per-session, warm/cold 全局共享**: 每个 session 有独立的 working memory (hot buffer), 但长期记忆 (facts, episodes, relationships) 是全局的——一个 agent 一个大脑、多个会话窗口
2. **持久化所有权在 Gateway 侧**: Gateway 负责写入 user/assistant turns (通过 ConversationService), AgentLoop 只用 ConversationService 做上下文 read, 避免 double-write
3. **processMessageStream() async generator**: 让 Gateway 能实时获取 text/tool_call/tool_result 事件, 保持与已有 WS chunk 协议的兼容
4. **向后兼容**: `processMessage()` 在无 sessionId 时使用 `'__default__'` 键, 不破坏已有测试

### 测试

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `agent-loop.test.ts` [NEW] | 9 | ✅ |
| `kernel.test.ts` [UPDATED] | 8 (+3) | ✅ |
| **总计** | **507 / 507** | **✅ 全通过** |

---

## Round 13 — Engineering Integrity Audit (2026-03-14)

**目标**: 恢复工程证据链可信度。验证 Round 12 所有声明的真实性，定位并修复任何测试失败，确保 README/DEVLOG 与代码现实对齐。

### 审计方法

1. 独立逐文件核查 T1-T4 关键路径
2. 运行 `tsc --noEmit` + `vitest run` 全量验证
3. AgentReplicator `should propagate constitution` 专项复现
4. `node_modules` EPERM 根因分析

### 审计结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| TypeScript 类型检查 | `npx tsc --noEmit` | ✅ 0 errors |
| 全量测试 | `TMPDIR=/tmp npx vitest run --no-coverage` | ✅ 34 files, 507/507 passed |
| AgentReplicator constitution | `npx vitest run src/multiagent/multiagent.test.ts` | ✅ 16/16 passed, failure NOT reproducible |
| pnpm ls / pnpm build | `pnpm ls --depth 0` | ❌ EPERM (macOS 系统权限) |

### 根因分析

#### A. AgentReplicator 疑似失败 → 不可复现

- 测试 `should propagate constitution` 在当前 HEAD (`0eec891`) 上 **通过**
- 代码逻辑审查：`propagateConstitution()` 在 `constitutionPath` 不存在时正确 fallback 到 `EMBEDDED_CONSTITUTION`
- 测试构造正确：`constitutionPath: '/nonexistent/CONSTITUTION.md'` → 使用嵌入宪法 → 验证 `Law I` + `Never Harm` 存在
- 结论：先前报告的 `The "path" argument must be of type string. Received undefined` 可能是环境污染（异常 node_modules 副本或 ABI 不匹配）导致的间歇性失败，而非代码缺陷

#### B. node_modules EPERM → macOS 系统级权限

- **根因**: `node_modules/` 目录被 macOS 附加了 SIP (System Integrity Protection) 相关的不可变属性
- **症状**: `ls`, `pnpm ls`, `pnpm build`, `chflags`, `xattr` 均返回 `Operation not permitted`
- **影响范围**: 仅影响直接访问 `node_modules` 的命令（pnpm build, pnpm install, pnpm ls）
- **不影响**: `tsc --noEmit`（TS 类型检查）、`vitest run`（测试执行）
- **修复方式**: 需要 `sudo chflags -R nouchg node_modules && sudo xattr -cr node_modules`，或删除后重新 `pnpm install`

### 代码变更

**无。** 本轮为纯审计轮次，代码层面 0 修改。

### 文档变更

| 文件 | 变更 | 原因 |
|------|------|------|
| DEVLOG.md | 添加 Round 13 条目 | 记录审计结论 |
| DEVLOG.md | 更新 "最后更新" 日期 | 日期对齐 |
| README.md | 无变更 | 测试数/功能描述均未改变 |

### 已知风险

| 风险 | 分类 | 影响 |
|------|------|------|
| node_modules EPERM | 环境 | 阻塞 `pnpm build` / `pnpm install`, 需 `sudo` 修复 |
| better-sqlite3 ABI | 环境 | node_modules 不可访问时 native module 无法加载；测试通过因 vitest mock |

---

## Round 14 — Runtime Integrity Doctor + Engineering Truth Infrastructure (2026-03-14)

**目标**: 建立运行时自检能力。使 ConShell 能够可靠地判断自身是否健康、是否退化、以及原因。

### 核心发现

| 发现 | 置信度 | 证据 |
|------|--------|------|
| 从仓库根目录运行 vitest 发现 355 文件 / 2971 测试（包含被污染的 node_modules 副本） | 高 | `npx vitest run` root 输出: `113 failed \| 242 passed (355)` |
| 从 `packages/core` 运行 vitest 发现 35 文件 / 520 测试（干净）| 高 | `npx vitest run` core 输出: `35 passed (35), 520 passed (520)` |
| 存在编号 `node_modules` 副本目录: `node_modules 2`, `node_modules 3`, `node_modules 4` | 高 | `find` 输出 |
| `better-sqlite3` 在 `state/database.ts` 有值导入，`spend.test.ts` 直接实例化 | 高 | 代码审查 |
| EvoMap 只有 2 个端点（`/a2a/hello`, `/a2a/publish`），无 worker claim | 高 | `evomap/client.ts` 代码审查 |
| 无 `.nvmrc` 文件，存在 Node 版本漂移风险 | 高 | `cat .nvmrc` → not found |

### 代码变更

| 文件 | 类型 | 用途 |
|------|------|------|
| `vitest.config.ts` (根目录) | NEW | 防止从根目录运行 vitest 导致污染测试结果 |
| `packages/core/src/doctor/index.ts` | NEW | 完整性诊断主模块 — `runDiagnostics()` + `formatReport()` |
| `packages/core/src/doctor/checks/env.ts` | NEW | 环境检查: Node 版本, .nvmrc, 工作区根目录 |
| `packages/core/src/doctor/checks/deps.ts` | NEW | 依赖检查: node_modules 可访问性, 编号副本, native 模块 |
| `packages/core/src/doctor/checks/tests.ts` | NEW | 测试边界: vitest 配置, 文件清点, 基准隔离, 根防护 |
| `packages/core/src/doctor/checks/build.ts` | NEW | 构建就绪: tsconfig, dist 目录, 构建脚本 |
| `packages/core/src/doctor/checks/integrations.ts` | NEW | 集成健康: EvoMap 端点探测 + 合约状态 |
| `packages/core/src/doctor/doctor.test.ts` | NEW | 13 个测试覆盖所有检查类别 |
| `docs/FAILURE-PATTERNS.md` | NEW | 10 个已知失败模式的症状/触发/恢复/预防 |

### 标准命令面板

| 用途 | 命令 | 可信度 |
|------|------|--------|
| 类型检查 | `cd packages/core && npx tsc --noEmit` | ✅ 高 |
| 功能测试 | `cd packages/core && npx vitest run --no-coverage` | ✅ 高 |
| Doctor 自检 | `cd packages/core && npx vitest run src/doctor/doctor.test.ts` | ✅ 高 |
| **禁止使用** | `npx vitest run` (仓库根目录) | ❌ 已污染 |

### 测试矩阵更新

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `doctor.test.ts` [NEW] | 13 | ✅ |
| **总计** | **520 / 520** | **✅ 全通过 (35 文件)** |

### 扩展就绪评估

**判定: 有条件可以进行功能扩展。**

**可继续的条件:**
- ✅ 类型系统完整 (tsc 0 errors)
- ✅ 测试覆盖真实可信（从 `packages/core` 运行 = 35 文件 / 520 测试）
- ✅ Doctor 诊断子系统可用
- ✅ 根 vitest 防护已到位

**剩余风险（不阻塞功能开发）:**
- ⚠️ node_modules EPERM 需要 `sudo` 修复才能 `pnpm build`
- ⚠️ 编号 node_modules 副本应该被清理
- ⚠️ 无 `.nvmrc` — Node 版本漂移风险

---

## Round 14.1 — Audit the Doctor Itself (2026-03-14)

**目标**: 审计 Round 14 Doctor 的结论可信度，修复虚假置信度，将 Doctor 从报告工具升级为工程真实性守门人。

### Round 14 审计结论

| Round 14 声明 | 裁定 | 证据 |
|---------------|------|------|
| "better-sqlite3 is loadable" | ✅ **正确** | `require` 成功，`new Database(':memory:')` 可工作，查询返回 `{x:42}` |
| "spend.test.ts passes with real DB" | ✅ **正确** | 8/8 通过，无 mock（grep 搜索确认 0 个 vi.mock 用于 sqlite）|
| "35 files / 520 tests" | ✅ **执行数据正确** | 静态清点 36 文件（含 1 个 benchmark），vitest 执行 35 文件 |
| "EvoMap has exactly 2 endpoints" | ❌ **过度声明** | 这只是客户端实现的 ≠ 平台暴露的 |
| "Conditionally ready" | ⚠️ **需要精确化** | 结论有效但缺乏明确的 Gate 标准 |

### 修正内容

| 修正 | 详情 |
|------|------|
| `evidenceType` | 所有 CheckResult 现在包含来源类型：code-inspection / fs-scan / runtime-probe / network-observation / historical-claim |
| ReadinessGate | 新增显式扩展准备度门控，包含 5 个可验证标准 |
| EvoMap 真实性模型 | 拆分为 `integ-evomap-implemented`（代码确认）和 `integ-evomap-observed`（历史观测）|
| better-sqlite3 4 阶段探针 | resolve → require → instantiate → query，精确报告失败阶段 |
| 测试边界诚实化 | `tests-file-count` → `tests-file-inventory`（标注为静态清点非执行真相），新增 `tests-execution-note` |

### 测试矩阵更新

| 测试文件 | 用例数 | 状态 |
|----------|--------|------|
| `doctor.test.ts` [UPDATED] | 15 (+2) | ✅ |
| **总计** | **522 / 522** | **✅ 全通过 (35 文件)** |

