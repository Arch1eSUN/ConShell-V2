/**
 * Metrics 路由 — 推理成本 + 使用量
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpServer } from '../http.js';
import type { InferenceRouter } from '../../inference/index.js';
import type { ToolExecutor } from '../../runtime/tool-executor.js';
import type { Logger } from '../../types/common.js';

export function registerMetricsRoutes(
  server: HttpServer,
  router: InferenceRouter,
  toolExecutor: ToolExecutor,
  logger: Logger,
): void {
  // GET /api/metrics — 综合指标
  server.get('/api/metrics', async (_req: IncomingMessage, res: ServerResponse, _body: string) => {
    const inference = router.stats();
    const tools = toolExecutor.stats();

    server.sendJson(res, 200, {
      inference: {
        totalCost: inference.totalCost,
        totalInputTokens: inference.totalInputTokens,
        totalOutputTokens: inference.totalOutputTokens,
        requestCount: inference.requestCount,
        survivalTier: inference.survivalTier,
        providerCount: inference.providerCount,
      },
      tools: {
        executionCount: tools.executionCount,
        errorCount: tools.errorCount,
        registeredTools: tools.registeredTools,
      },
      system: {
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
    });
  });
}
