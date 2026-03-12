/**
 * Server 模块导出
 */
export { HttpServer } from './http.js';
export type { RouteHandler, Route, Middleware, HttpServerOptions } from './http.js';

export { WebSocketServer } from './websocket.js';
export type { WSClient, WSMessage } from './websocket.js';

// Routes
export { registerChatRoutes } from './routes/chat.js';
export { registerConfigRoutes } from './routes/config.js';
export { registerAgentRoutes } from './routes/agent.js';
export { registerMetricsRoutes } from './routes/metrics.js';
export { registerSkillsRoutes } from './routes/skills.js';
export { registerMemoryRoutes } from './routes/memory.js';
export { registerWebChatRoutes } from './routes/webchat.js';

// Middleware
export { createAuthMiddleware } from './middleware/auth.js';
export type { AuthMiddlewareOptions } from './middleware/auth.js';
export { createRateLimitMiddleware } from './middleware/rate-limit.js';
export type { RateLimitOptions } from './middleware/rate-limit.js';

// Proxy
export { registerProxyRoutes } from './proxy.js';
