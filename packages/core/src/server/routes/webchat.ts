/**
 * WebChat 路由 — POST /api/webchat/message
 *
 * 🐢 Pure HTTP 外壳 — 所有业务逻辑在 WebChatTransport 中
 *
 * 职责：
 *   1. 解析 JSON body
 *   2. 调用 validateRequest() 校验
 *   3. 调用 transport.handleMessage()
 *   4. 映射结果/错误到 HTTP 状态码
 *
 * 不做：
 *   - 不复制 transport 逻辑
 *   - 不自己拼 manager/gateway 调用链
 *   - 不做 session 管理
 */
import type { ServerResponse } from 'node:http';
import type { HttpServer, EnhancedRequest } from '../http.js';
import type { Logger } from '../../types/common.js';
import type { WebChatTransport } from '../../channels/webchat/webchat-transport.js';
import { validateRequest } from '../../channels/webchat/webchat-transport.js';

// ── Error Response Helpers ───────────────────────────────

interface ErrorResponse {
  error: string;
  code: string;
}

function classifyError(err: unknown): { status: number; body: ErrorResponse } {
  const msg = err instanceof Error ? err.message : String(err);

  // Validation errors → 400
  if (msg.includes('Invalid request')) {
    return {
      status: 400,
      body: { error: msg, code: 'INVALID_REQUEST' },
    };
  }

  // Service unavailable → 503
  if (msg.includes('not available') || msg.includes('not connected')) {
    return {
      status: 503,
      body: { error: 'WebChat service is not available', code: 'SERVICE_UNAVAILABLE' },
    };
  }

  // Timeout → 504
  if (msg.includes('timeout')) {
    return {
      status: 504,
      body: { error: 'WebChat response timed out', code: 'GATEWAY_TIMEOUT' },
    };
  }

  // Everything else → 500
  return {
    status: 500,
    body: { error: 'Internal server error', code: 'INTERNAL_ERROR' },
  };
}

// ── Route Registration ───────────────────────────────────

/**
 * Register the WebChat HTTP route.
 *
 * @param server - HttpServer instance
 * @param transport - WebChatTransport instance, or null if unavailable
 * @param logger - Logger
 */
export function registerWebChatRoutes(
  server: HttpServer,
  transport: WebChatTransport | null,
  logger: Logger,
): void {
  const log = logger.child('routes/webchat');

  // POST /api/webchat/message — send a message through the WebChat channel
  server.post('/api/webchat/message', async (_req: EnhancedRequest, res: ServerResponse, body: string) => {
    // ── 1. Transport availability check ──
    if (!transport) {
      log.warn('WebChat route called but transport not available');
      server.sendJson(res, 503, {
        error: 'WebChat service is not available',
        code: 'SERVICE_UNAVAILABLE',
      } satisfies ErrorResponse);
      return;
    }

    // ── 2. Parse body ──
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      server.sendJson(res, 400, {
        error: 'Request body must be valid JSON',
        code: 'INVALID_REQUEST',
      } satisfies ErrorResponse);
      return;
    }

    // ── 3. Validate ──
    const validation = validateRequest(parsed);
    if (!validation.valid) {
      server.sendJson(res, 400, {
        error: validation.error!,
        code: 'INVALID_REQUEST',
      } satisfies ErrorResponse);
      return;
    }

    // ── 4. Forward to transport ──
    const { sessionId, message, metadata } = parsed as {
      sessionId: string;
      message: string;
      metadata?: Record<string, unknown>;
    };

    try {
      log.info('WebChat message', { sessionId, messageLength: message.length });

      const response = await transport.handleMessage({
        sessionId,
        message,
        metadata,
      });

      server.sendJson(res, 200, response);
    } catch (err) {
      const { status, body: errBody } = classifyError(err);
      log.error('WebChat error', { sessionId, status, error: String(err) });
      server.sendJson(res, status, errBody);
    }
  });
}
