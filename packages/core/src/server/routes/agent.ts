/**
 * Agent 路由 — 状态查看/控制
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { AgentStateMachine } from '../../runtime/state-machine.js';
import type { Logger } from '../../types/common.js';

export function registerAgentRoutes(
  server: HttpServer,
  stateMachine: AgentStateMachine,
  logger: Logger,
): void {
  const log = logger.child('routes/agent');

  // GET /api/agent/status — Agent状态
  server.get('/api/agent/status', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    server.sendJson(res, 200, {
      state: stateMachine.state,
      alive: stateMachine.isAlive,
      ready: stateMachine.isReady,
      history: stateMachine.history.slice(-10),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/agent/wake — 唤醒Agent
  server.post('/api/agent/wake', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      stateMachine.transition('wake');
      log.info('Agent woken');
      server.sendJson(res, 200, { state: stateMachine.state });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // POST /api/agent/sleep — 休眠Agent
  server.post('/api/agent/sleep', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    try {
      stateMachine.transition('sleep');
      log.info('Agent sleeping');
      server.sendJson(res, 200, { state: stateMachine.state });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });
}
