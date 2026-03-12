/**
 * Config 路由 — 配置查看/修改
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { AppConfig } from '../../types/config.js';
import type { Logger } from '../../types/common.js';

export function registerConfigRoutes(
  server: HttpServer,
  getConfig: () => AppConfig,
  logger: Logger,
): void {
  const log = logger.child('routes/config');

  // GET /api/config — 获取配置 (脱敏)
  server.get('/api/config', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const config = getConfig();
    // 脱敏: 移除API keys
    const safe = {
      agentName: config.agentName,
      inferenceMode: config.inferenceMode,
      model: config.model,
      securityLevel: config.securityLevel,
      walletEnabled: config.walletEnabled,
      channels: config.channels,
      interface: config.interface,
      port: config.port,
      logLevel: config.logLevel,
      dailyBudgetCents: config.dailyBudgetCents,
    };

    server.sendJson(res, 200, safe);
  });

  // PUT /api/config — 更新配置
  server.put('/api/config', async (_req: IncomingMessage, res: ServerResponse, body: string) => {
    try {
      const updates = JSON.parse(body) as Partial<AppConfig>;
      log.info('Config update request', { keys: Object.keys(updates) });

      // 这里只做日志记录，实际更新需要有完整的config管理系统
      server.sendJson(res, 200, { updated: Object.keys(updates), timestamp: new Date().toISOString() });
    } catch (err) {
      server.sendJson(res, 400, { error: 'Invalid JSON' });
    }
  });
}
