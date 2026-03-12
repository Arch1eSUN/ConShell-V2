/**
 * 认证中间件 — Token/Bearer 认证
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware } from '../http.js';
import type { Logger } from '../../types/common.js';

export interface AuthMiddlewareOptions {
  /** 认证模式: none=跳过, token=Bearer token, basic=Basic auth */
  mode: 'none' | 'token' | 'basic';
  /** Token列表 (mode=token时使用) */
  tokens?: string[];
  /** Basic auth用户名 (mode=basic时使用) */
  username?: string;
  /** Basic auth密码 */
  password?: string;
  /** 跳过认证的路径前缀 */
  publicPaths?: string[];
}

export function createAuthMiddleware(opts: AuthMiddlewareOptions, logger: Logger): Middleware {
  const log = logger.child('auth');

  return {
    name: 'auth',
    handle: async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
      // none模式跳过认证
      if (opts.mode === 'none') return true;

      // 公开路径跳过
      const url = req.url?.split('?')[0] ?? '/';
      if (opts.publicPaths?.some(p => url.startsWith(p))) return true;

      const authHeader = req.headers['authorization'] ?? '';

      if (opts.mode === 'token') {
        // Bearer token认证
        if (!authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Bearer token' }));
          return false;
        }

        const token = authHeader.slice(7);
        if (!opts.tokens?.includes(token)) {
          log.warn('Invalid token', { url });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token' }));
          return false;
        }

        return true;
      }

      if (opts.mode === 'basic') {
        // Basic auth
        if (!authHeader.startsWith('Basic ')) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Basic realm="ConShell"' });
          res.end(JSON.stringify({ error: 'Authentication required' }));
          return false;
        }

        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
        const [user, pass] = decoded.split(':');

        if (user !== opts.username || pass !== opts.password) {
          log.warn('Invalid credentials', { url, user });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
          return false;
        }

        return true;
      }

      return true;
    },
  };
}
