/**
 * @conshell/core — ConShell V2 引擎核心（全量导出）
 *
 * 🐢 Sovereign AI Agent Runtime
 *
 * ⚠️  外部消费者（CLI、dashboard、plugin、channel）应使用：
 *       import { ... } from '@conshell/core/public'
 *
 *     本文件导出全部内部实现，仅供 core 内部模块和测试使用。
 *     内部导出随时可能变更，不保证向后兼容。
 *
 * Modules:
 *   types/      — 共享类型、branded Cents
 *   config/     — 配置加载器
 *   logger/     — 日志系统
 *   state/      — SQLite + Repository
 *   policy/     — 策略引擎（24规则）
 *   inference/  — 多Provider推理路由
 *   runtime/    — ReAct循环 + 心跳 + 工具
 *   memory/     — 分层记忆（hot/warm/cold）
 *   wallet/     — Ethereum钱包 + ERC-8004
 *   x402/       — HTTP 402支付协议
 *   soul/       — 身份与对齐
 *   skills/     — 技能系统
 *   server/     — HTTP + WebSocket
 *   proxy/      — CLIProxy兼容API
 */

export const VERSION = '0.1.0';

// ═══════════════════════════════════════════════════════════════════════
// @public — Stable interfaces for CLI, dashboard, and external consumers
// ═══════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────
export type {
  AgentState,
  SecurityLevel,
  Cents,
  Message,
  ToolCallRequest,
  ToolResult,
} from './types/index.js';

export {
  toCents,
  ZERO_CENTS,
} from './types/index.js';

// ── Config ─────────────────────────────────────────────────────────────
export type { AppConfig, InferenceMode, InterfaceMode, ApiProvider, BrowserProvider } from './types/config.js';
export { loadConfig, saveConfig } from './config/index.js';

// ── Logger ─────────────────────────────────────────────────────────────
export { createLogger } from './logger/index.js';

// ── State ──────────────────────────────────────────────────────────────
export { openDatabase, openTestDatabase, nowISO, DB_FILENAME } from './state/index.js';
export type { DatabaseOptions, Migration } from './state/index.js';
export {
  TurnsRepository,
  TransactionsRepository,
  HeartbeatRepository,
  WorkingMemoryRepository,
  EpisodicMemoryRepository,
  SemanticMemoryRepository,
  ProceduralMemoryRepository,
  RelationshipMemoryRepository,
  SoulHistoryRepository,
  SessionSummariesRepository,
  PolicyDecisionsRepository,
  ModelRegistryRepository,
  InferenceCostsRepository,
  SkillsRepository,
  ProviderConfigRepository,
} from './state/index.js';

// ── Policy ─────────────────────────────────────────────────────────────
export { PolicyEngine } from './policy/index.js';
export type { PolicyContext, PolicyResult, PolicyDecision } from './policy/index.js';

// ── Inference ──────────────────────────────────────────────────────────
export {
  InferenceRouter,
  setupInferenceRouter,
  createOpenAIProvider,
  createAnthropicProvider,
  createGoogleProvider,
  createDeepSeekProvider,
  createOllamaProvider,
  createOpenRouterProvider,
  createCLIProxyProvider,
} from './inference/index.js';
export type { SurvivalTier } from './inference/index.js';

// ── Runtime ────────────────────────────────────────────────────────────
export {
  AgentStateMachine,
  ToolExecutor,
  AgentLoop,
  HeartbeatDaemon as RuntimeHeartbeatDaemon,
  TaskQueue,
  allBuiltinTools,
} from './runtime/index.js';
export type {
  AgentLifecycleState, LifecycleEvent, StateTransition,
  ToolHandler, ToolExecutorOptions,
  AgentLoopOptions, TurnRecord,
  HeartbeatTask as RuntimeHeartbeatTask,
  QueuedTask, TaskResult, TaskQueueOptions,
} from './runtime/index.js';

// ── Server ─────────────────────────────────────────────────────────────
export {
  HttpServer,
  WebSocketServer,
  registerChatRoutes, registerConfigRoutes, registerAgentRoutes,
  registerMetricsRoutes, registerSkillsRoutes, registerMemoryRoutes,
  createAuthMiddleware, createRateLimitMiddleware,
  registerProxyRoutes,
} from './server/index.js';
export type {
  RouteHandler, Middleware, HttpServerOptions,
  WSClient, WSMessage,
  AuthMiddlewareOptions, RateLimitOptions,
} from './server/index.js';

// ── Constitution ──────────────────────────────────────────────────────
export {
  THREE_LAWS,
  CONSTITUTION_HASH,
  validateConstitutionHash,
  getConstitutionText,
  checkConstitutionalViolation,
} from './constitution/index.js';
export type { ConstitutionLaw, ConstitutionValidationResult } from './constitution/index.js';

// ── EvoMap ─────────────────────────────────────────────────────────────
export { EvoMapClient } from './evomap/index.js';
export type {
  EvoMapConfig, GepHelloResponse, GepPublishResponse,
  EvolutionAsset, EvoMapNodeStatus,
} from './evomap/index.js';

// ── Identity ──────────────────────────────────────────────────────────
export {
  createAgentCard,
  signAgentCard,
  validateAgentCard,
  cardFingerprint,
  InMemoryAgentRegistry,
  createSiweAuth,
} from './identity/index.js';
export type { AgentCard, AgentService, AgentCardValidation, AgentRegistry } from './identity/index.js';

// ── Channels ──────────────────────────────────────────────────────────
export { ChannelManager, WebChatAdapter } from './channels/index.js';
export type { ChannelAdapter, ChannelConfig, ChannelMessage, ChannelPlatform, ChannelState, OutboundMessage } from './channels/index.js';

// ── Plugins ───────────────────────────────────────────────────────────
export { PluginManager, validateManifest, pluginManifestSchema } from './plugins/index.js';
export type { PluginManifest, PluginInstance, PluginHook, PluginPermission, PluginState } from './plugins/index.js';

// (kernel exports → see bottom of file)

// ── Wallet ─────────────────────────────────────────────────────────────
export {
  generateWallet,
  loadWallet,
  loadOrGenerateWallet,
  encryptPrivateKey,
  decryptPrivateKey,
  createSiweMessage,
  signSiweMessage,
  generateNonce,
} from './wallet/index.js';
export type { WalletAccount, TypedDataParams, EncryptedWallet, SiweMessage } from './wallet/index.js';

// ═══════════════════════════════════════════════════════════════════════
// @internal — Implementation details, may change without notice.
//             CLI and dashboard should not depend on these directly.
// ═══════════════════════════════════════════════════════════════════════

// ── Wallet Connector ──────────────────────────────────────────────────
export {
  LocalWalletConnector,
  ExternalWalletConnector,
  WalletManager,
} from './wallet/connector.js';
export type {
  WalletType, WalletEvent, ConnectedWallet, WalletConnector,
} from './wallet/connector.js';

// ── Onchain Provider ──────────────────────────────────────────────────
export { OnchainProvider, createDefaultOnchainProvider, DEFAULT_CHAINS } from './wallet/onchain.js';
export type { ChainConfig, ChainBalance, AggregatedBalance } from './wallet/onchain.js';

// ── Wallet ERC-8004 ──────────────────────────────────────────────────
export { ERC8004Registry, JsonRpcChainClient, ERC8004_ABI, USDC_ABI } from './wallet/erc8004.js';
export type { AgentIdentity, ERC8004Options, ChainClient } from './wallet/erc8004.js';

// ── Facilitator ───────────────────────────────────────────────────────
export {
  MockFacilitator as FacilitatorMock,
  RealFacilitator as FacilitatorReal,
} from './facilitator/index.js';
export type {
  IFacilitator,
  PaymentVerificationRequest,
  PaymentVerificationResult,
  SettlementRequest,
  SettlementResult,
  FacilitatorConfig,
  FacilitatorStats,
} from './facilitator/index.js';

// ── x402 ──────────────────────────────────────────────────────────────
export {
  X402Server,
} from './x402/index.js';
export type {
  PaymentRequirement, PaymentProof, PaymentVerification,
  X402ServerOptions, PaymentRecord, X402Middleware,
} from './x402/index.js';

// ── MCP Gateway ───────────────────────────────────────────────────────
export { McpGateway } from './mcp/gateway.js';
export type {
  McpTool,
  McpResource,
  McpGatewayOptions,
  JsonRpcRequest,
  JsonRpcResponse,
} from './mcp/gateway.js';

// ── 5-Tier Memory ─────────────────────────────────────────────────────
export { MemoryTierManager } from './memory/index.js';
export type { MemoryContext, TierManagerOptions } from './memory/index.js';

// ── SpendTracker ──────────────────────────────────────────────────────
export { SpendTracker } from './spend/tracker.js';
export type { SpendAggregates, SpendBreakdown } from './spend/tracker.js';

// ── ModelRegistry ─────────────────────────────────────────────────────
export { ModelRegistry } from './models/registry.js';
export type { ModelEntry, InferenceTaskType, ModelPreference } from './models/registry.js';

// ── Soul ──────────────────────────────────────────────────────────────
export { SoulSystem } from './soul/index.js';
export type { SoulData, SoulSystemOptions } from './soul/index.js';

// ── SelfMod ───────────────────────────────────────────────────────────
export { SelfModManager, ProtectedFileError, SelfModRateLimitError } from './selfmod/index.js';
export type { ModificationRecord, SelfModOptions } from './selfmod/index.js';

// ── Git Versioning ────────────────────────────────────────────────────
export { GitManager } from './git/index.js';
export type { GitCommit, GitStatus } from './git/index.js';

// ── Observability ─────────────────────────────────────────────────────
export { ObservabilityManager } from './observability/index.js';
export type { MetricType, MetricValue, AlertRule, AlertEvent, MetricSnapshot } from './observability/index.js';

// ── Conway Automaton ──────────────────────────────────────────────────
export { ConwayAutomaton } from './automaton/index.js';
export type {
  CellState, CellConfig, SurvivalThresholds,
  EnvironmentSnapshot, GenerationResult, AutomatonStats,
} from './automaton/index.js';

// ── Multi-Agent ───────────────────────────────────────────────────────
export { MultiAgentManager } from './multiagent/index.js';
export type {
  ChildState, ChildAgent, AgentMessage as AgentInboxMessage,
  SpawnRequest, MultiAgentStats,
} from './multiagent/index.js';

// ── Compute Provider ──────────────────────────────────────────────────
export { LocalProcessProvider, DockerProvider } from './compute/index.js';
export type { ComputeProvider, ComputeInstance } from './compute/index.js';

// ── Skills ────────────────────────────────────────────────────────────
export { SkillLoader, SkillRegistry } from './skills/index.js';
export type { SkillMeta, RegisteredSkill } from './skills/index.js';

// ── Kernel ────────────────────────────────────────────────────────────
export { Kernel, createKernel } from './kernel/index.js';
export type { BootStage, BootStageResult, BootResult, KernelServices } from './kernel/index.js';

// ── Tool Registry ─────────────────────────────────────────────────────
export { ToolRegistry, createBuiltinTools } from './tools/registry.js';
export type {
  ToolCategory, RiskLevel, AuthorityLevel,
  ToolInputSchema, ToolDefinitionFull,
} from './tools/registry.js';

// ── API Routes ────────────────────────────────────────────────────────
export { createApiRoutes } from './api/routes.js';
export type { ApiHandler, ApiServices } from './api/routes.js';

// ── Re-exports ────────────────────────────────────────────────────────
export type { PolicyCategory } from './policy/index.js';


