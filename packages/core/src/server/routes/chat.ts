/**
 * Chat 路由 — 对话API
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import type { Logger } from '../../types/common.js';

export function registerChatRoutes(server: HttpServer, agentLoop: AgentLoop, logger: Logger): void {
  const log = logger.child('routes/chat');

  // POST /api/chat — 发送消息
  server.post('/api/chat', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const { message } = JSON.parse(body) as { message?: string };
      if (!message) {
        server.sendJson(res, 400, { error: 'Missing "message" field' });
        return;
      }

      log.info('Chat request', { messageLength: message.length });
      const response = await agentLoop.processMessage(message);

      server.sendJson(res, 200, {
        response,
        turn: agentLoop.turnCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error('Chat error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Chat processing failed' });
    }
  });
}
