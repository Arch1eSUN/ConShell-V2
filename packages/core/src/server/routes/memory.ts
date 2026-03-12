/**
 * Memory 路由 — 记忆查看
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { MemoryTierManager } from '../../memory/tier-manager.js';
import type { Logger } from '../../types/common.js';

export function registerMemoryRoutes(
  server: HttpServer,
  memory: MemoryTierManager,
  logger: Logger,
): void {
  // GET /api/memory — 记忆概览
  server.get('/api/memory', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const stats = memory.stats();
    const context = memory.buildContext();

    server.sendJson(res, 200, {
      stats,
      context: {
        sessionSummaries: context.sessionSummaries.length,
        relevantFacts: context.relevantFacts.length,
        relationships: context.relationships.length,
        skills: context.skills.length,
      },
      hot: memory.getHot().slice(-20), // 最近20条
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/memory/context — 完整记忆上下文
  server.get('/api/memory/context', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const context = memory.buildContext();
    server.sendJson(res, 200, context);
  });
}
