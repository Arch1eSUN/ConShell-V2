/**
 * Sessions 路由 — 会话管理 + transcript API
 *
 * GET    /api/sessions              — 列出所有会话（分页）
 * GET    /api/sessions/:id          — 获取单个会话详情
 * GET    /api/sessions/:id/transcript — 获取完整 transcript
 * PATCH  /api/sessions/:id          — 更新标题
 * DELETE /api/sessions/:id          — 删除会话及其消息
 */
import type { ServerResponse } from 'node:http';
import type { HttpServer, EnhancedRequest } from '../http.js';
import type { Logger } from '../../types/common.js';
import type { ConversationService } from '../../channels/webchat/conversation-service.js';

// ── Route Registration ───────────────────────────────────

export function registerSessionRoutes(
  server: HttpServer,
  conversationService: ConversationService,
  logger: Logger,
): void {
  const log = logger.child('routes/sessions');

  // GET /api/sessions — list sessions with message counts
  server.get('/api/sessions', async (_req: EnhancedRequest, res: ServerResponse) => {
    try {
      const url = new URL(_req.url ?? '/', `http://${_req.headers.host ?? 'localhost'}`);
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
      const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

      const sessions = conversationService.listSessions(limit, offset);
      const total = conversationService.sessionCount();

      server.sendJson(res, 200, {
        sessions,
        total,
        limit,
        offset,
      });
    } catch (err) {
      log.error('List sessions error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Failed to list sessions' });
    }
  });

  // GET /api/sessions/:id — get session details
  server.get('/api/sessions/:id', async (req: EnhancedRequest, res: ServerResponse) => {
    try {
      const id = req.params?.id;
      if (!id) {
        server.sendJson(res, 400, { error: 'Missing session ID' });
        return;
      }

      const session = conversationService.getSession(id);
      if (!session) {
        server.sendJson(res, 404, { error: 'Session not found' });
        return;
      }

      server.sendJson(res, 200, { session });
    } catch (err) {
      log.error('Get session error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Failed to get session' });
    }
  });

  // GET /api/sessions/:id/transcript — get full transcript
  server.get('/api/sessions/:id/transcript', async (req: EnhancedRequest, res: ServerResponse) => {
    try {
      const id = req.params?.id;
      if (!id) {
        server.sendJson(res, 400, { error: 'Missing session ID' });
        return;
      }

      const session = conversationService.getSession(id);
      if (!session) {
        server.sendJson(res, 404, { error: 'Session not found' });
        return;
      }

      const turns = conversationService.getTranscript(id);

      server.sendJson(res, 200, {
        session,
        turns,
        count: turns.length,
      });
    } catch (err) {
      log.error('Get transcript error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Failed to get transcript' });
    }
  });

  // PATCH /api/sessions/:id — update title
  server.patch('/api/sessions/:id', async (req: EnhancedRequest, res: ServerResponse, body: string) => {
    try {
      const id = req.params?.id;
      if (!id) {
        server.sendJson(res, 400, { error: 'Missing session ID' });
        return;
      }

      let parsed: { title?: string };
      try {
        parsed = JSON.parse(body);
      } catch {
        server.sendJson(res, 400, { error: 'Request body must be valid JSON' });
        return;
      }

      if (!parsed.title || typeof parsed.title !== 'string') {
        server.sendJson(res, 400, { error: 'Missing or invalid "title" field' });
        return;
      }

      const updated = conversationService.updateTitle(id, parsed.title);
      if (!updated) {
        server.sendJson(res, 404, { error: 'Session not found' });
        return;
      }

      server.sendJson(res, 200, { ok: true });
    } catch (err) {
      log.error('Update session error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Failed to update session' });
    }
  });

  // DELETE /api/sessions/:id — delete session and all turns
  server.delete('/api/sessions/:id', async (req: EnhancedRequest, res: ServerResponse) => {
    try {
      const id = req.params?.id;
      if (!id) {
        server.sendJson(res, 400, { error: 'Missing session ID' });
        return;
      }

      const deleted = conversationService.deleteSession(id);
      if (!deleted) {
        server.sendJson(res, 404, { error: 'Session not found' });
        return;
      }

      log.info('Session deleted', { id });
      server.sendJson(res, 200, { ok: true });
    } catch (err) {
      log.error('Delete session error', { error: String(err) });
      server.sendJson(res, 500, { error: 'Failed to delete session' });
    }
  });
}
