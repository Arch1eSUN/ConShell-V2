/**
 * Skills 路由 — 技能管理
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { SkillRegistry } from '../../skills/registry.js';
import type { Logger } from '../../types/common.js';

export function registerSkillsRoutes(
  server: HttpServer,
  registry: SkillRegistry,
  logger: Logger,
): void {
  const log = logger.child('routes/skills');

  // GET /api/skills — 列出所有技能
  server.get('/api/skills', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const skills = await registry.listAll();
    server.sendJson(res, 200, { skills, count: skills.length });
  });

  // POST /api/skills/enable — 启用技能
  server.post('/api/skills/enable', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const { name } = JSON.parse(body) as { name?: string };
      if (!name) {
        server.sendJson(res, 400, { error: 'Missing "name" field' });
        return;
      }
      await registry.enable(name);
      log.info('Skill enabled', { name });
      server.sendJson(res, 200, { enabled: name });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });

  // POST /api/skills/disable — 禁用技能
  server.post('/api/skills/disable', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const { name } = JSON.parse(body) as { name?: string };
      if (!name) {
        server.sendJson(res, 400, { error: 'Missing "name" field' });
        return;
      }
      await registry.disable(name);
      log.info('Skill disabled', { name });
      server.sendJson(res, 200, { disabled: name });
    } catch (err) {
      server.sendJson(res, 400, { error: String(err) });
    }
  });
}
