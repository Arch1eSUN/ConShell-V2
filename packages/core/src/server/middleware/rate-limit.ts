/**
 * 速率限制中间件 — 滑动窗口算法
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Middleware } from '../http.js';
import type { Logger } from '../../types/common.js';

export interface RateLimitOptions {
  /** 窗口时间(ms), 默认 60000 (1分钟) */
  windowMs?: number;
  /** 窗口内最大请求数, 默认 60 */
  maxRequests?: number;
  /** 排除IP列表 */
  whitelist?: string[];
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimitMiddleware(opts?: RateLimitOptions, logger?: Logger): Middleware {
  const log = logger?.child('rate-limit');
  const windowMs = opts?.windowMs ?? 60_000;
  const maxRequests = opts?.maxRequests ?? 60;
  const whitelist = new Set(opts?.whitelist ?? ['127.0.0.1', '::1']);
  const buckets = new Map<string, RateBucket>();

  // 定期清理过期桶
  setInterval(() => {
    const now = Date.now();
    for (const entry of Array.from(buckets.entries())) {
      if (entry[1].resetAt < now) buckets.delete(entry[0]);
    }
  }, windowMs * 2);

  return {
    name: 'rate-limit',
    handle: async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
      const ip = req.socket.remoteAddress ?? 'unknown';

      // 白名单跳过
      if (whitelist.has(ip)) return true;

      const now = Date.now();
      let bucket = buckets.get(ip);

      if (!bucket || bucket.resetAt < now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(ip, bucket);
      }

      bucket.count++;

      // 添加限速header
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

      if (bucket.count > maxRequests) {
        log?.warn('Rate limited', { ip, count: bucket.count });
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(windowMs / 1000)) });
        res.end(JSON.stringify({ error: 'Too many requests', retryAfterMs: windowMs }));
        return false;
      }

      return true;
    },
  };
}
