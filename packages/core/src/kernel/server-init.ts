/**
 * Server Initializer — HTTP/WS 服务器创建 + 中间件 + 路由注册
 *
 * 从 kernel/index.ts 拆分出来，以保持 boot 序列简洁。
 */
import type { Logger } from '../types/common.js';
import type { AppConfig } from '../types/config.js';
import type { InferenceRouter } from '../inference/index.js';
import type { AgentStateMachine } from '../runtime/state-machine.js';
import type { AgentLoop } from '../runtime/agent-loop.js';
import type { ToolExecutor } from '../runtime/tool-executor.js';
import type { SkillRegistry } from '../skills/registry.js';
import type { MemoryTierManager } from '../memory/tier-manager.js';
import type { WebChatTransport } from '../channels/webchat/webchat-transport.js';
import type { ConversationService } from '../channels/webchat/conversation-service.js';
import { HttpServer } from '../server/http.js';
import { WebSocketServer } from '../server/websocket.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface ServerInitDeps {
  config: AppConfig;
  logger: Logger;
  inference: InferenceRouter;
  stateMachine: AgentStateMachine;
  agentLoop: AgentLoop;
  toolExecutor: ToolExecutor;
  skills: SkillRegistry;
  memory: MemoryTierManager;
  /** Optional: WebChat transport for /api/webchat/message */
  webChatTransport?: WebChatTransport;
  /** Database instance for persistent state */
  db?: any;
  /** Optional: ConversationService for session persistence (Round 12) */
  conversationService?: ConversationService;
}

export interface ServerInstances {
  httpServer: HttpServer;
  wsServer: WebSocketServer;
}

// ── Helper ────────────────────────────────────────────────────────────

function cfgGet<T>(config: AppConfig, key: string, fallback: T): T {
  return (config as any)[key] ?? fallback;
}

// ── Init ──────────────────────────────────────────────────────────────

/**
 * Create, configure, and start the HTTP + WebSocket servers.
 */
export async function initServer(deps: ServerInitDeps): Promise<ServerInstances> {
  const { config, logger, inference, stateMachine, agentLoop, toolExecutor, skills, memory } = deps;

  // Dynamic import route/middleware modules
  const { createAuthMiddleware } = await import('../server/middleware/auth.js');
  const { createRateLimitMiddleware } = await import('../server/middleware/rate-limit.js');
  const { registerChatRoutes } = await import('../server/routes/chat.js');
  const { registerConfigRoutes } = await import('../server/routes/config.js');
  const { registerAgentRoutes } = await import('../server/routes/agent.js');
  const { registerMetricsRoutes } = await import('../server/routes/metrics.js');
  const { registerSkillsRoutes } = await import('../server/routes/skills.js');
  const { registerMemoryRoutes } = await import('../server/routes/memory.js');
  const { registerWebChatRoutes } = await import('../server/routes/webchat.js');
  const { registerProxyRoutes } = await import('../server/proxy.js');
  const { registerSessionRoutes } = await import('../server/routes/sessions.js');

  // Create servers
  const port = cfgGet<number>(config, 'port', 4200);
  const httpServer = new HttpServer(logger, { port, corsOrigin: '*' });
  const wsServer = new WebSocketServer(logger);

  // ── Middleware ─────────────────────────────────────────────────────
  const authMode = cfgGet<string>(config, 'authMode', 'none');
  const authTokens = cfgGet<string[] | undefined>(config, 'authTokens', undefined);
  httpServer.use(createAuthMiddleware({
    mode: authMode as 'none' | 'token' | 'basic',
    tokens: authTokens,
    publicPaths: ['/v1/', '/api/agent/status', '/api/webchat/'],
  }, logger));
  httpServer.use(createRateLimitMiddleware({ maxRequests: 120 }, logger));

  // ── Routes ────────────────────────────────────────────────────────
  registerChatRoutes(httpServer, agentLoop, logger);
  registerConfigRoutes(httpServer, () => config, logger);
  registerAgentRoutes(httpServer, stateMachine, logger);
  registerMetricsRoutes(httpServer, inference, toolExecutor, logger);
  registerSkillsRoutes(httpServer, skills, logger);
  registerMemoryRoutes(httpServer, memory, logger);
  registerWebChatRoutes(httpServer, deps.webChatTransport ?? null, logger);
  registerProxyRoutes(httpServer, inference, logger);

  // ── ConversationService + Session Routes ──────────────────────────
  // Use the ConversationService passed from kernel if available;
  // otherwise create a new one from db (backward compat).
  let conversationService = deps.conversationService ?? null;
  if (!conversationService && deps.db) {
    const { SessionsRepository } = await import('../state/repos/sessions.js');
    const { TurnsRepository } = await import('../state/repos/turns.js');
    const { ConversationService } = await import('../channels/webchat/conversation-service.js');
    const sessionsRepo = new SessionsRepository(deps.db);
    const turnsRepo = new TurnsRepository(deps.db);
    conversationService = new ConversationService(sessionsRepo, turnsRepo);
  }

  if (conversationService) {
    registerSessionRoutes(httpServer, conversationService, logger);
    logger.info('Session routes registered');
  }

  // ── Start ─────────────────────────────────────────────────────────
  await httpServer.start();

  // Attach WebSocket to HTTP server upgrade
  const raw = httpServer.rawServer;
  if (raw) wsServer.attachToServer(raw);

  // ── WebChat Push Bridge ──────────────────────────────────────────
  if (deps.webChatTransport) {
    const { WebChatPushBridge } = await import('../channels/webchat/webchat-push.js');
    const pushBridge = new WebChatPushBridge(wsServer, deps.webChatTransport.channelManager);
    pushBridge.start();
    logger.info('WebChat push bridge started');
  }

  logger.info('Server listening', { port });

  return { httpServer, wsServer };
}
