/**
 * HTTP 服务器 — 增强版 (无Express依赖)
 *
 * 使用Node原生http模块 + 路径参数 + 前缀匹配 + JSON工具
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export type RouteHandler = (req: EnhancedRequest, res: ServerResponse, body: string) => Promise<void>;

/** 增强的请求对象 — 包含解析后的参数和查询 */
export interface EnhancedRequest extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  pathname: string;
}

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  /** Compiled regex for path matching */
  regex: RegExp;
  /** Parameter names from the path */
  paramNames: string[];
}

export interface Middleware {
  name: string;
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>; // true=通过, false=已处理
}

export interface HttpServerOptions {
  port?: number;
  host?: string;
  corsOrigin?: string;
  maxBodyBytes?: number;
}

// ── Path Param Compiler ───────────────────────────────────────────────

function compilePath(path: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  // Convert :param to named groups, support * wildcard at end
  const pattern = path
    .replace(/:(\w+)/g, (_m, name) => { paramNames.push(name); return '([^/]+)'; })
    .replace(/\*$/, '(.*)');
  return { regex: new RegExp(`^${pattern}$`), paramNames };
}

function parseQuery(url: string): { pathname: string; query: Record<string, string> } {
  const idx = url.indexOf('?');
  if (idx === -1) return { pathname: url, query: {} };

  const pathname = url.slice(0, idx);
  const query: Record<string, string> = {};
  const qs = url.slice(idx + 1);
  for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return { pathname, query };
}

// ── HttpServer ────────────────────────────────────────────────────────

export class HttpServer {
  private logger: Logger;
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];
  private server: ReturnType<typeof createHttpServer> | null = null;
  private opts: Required<HttpServerOptions>;

  constructor(logger: Logger, opts?: HttpServerOptions) {
    this.logger = logger.child('http');
    this.opts = {
      port: opts?.port ?? 4200,
      host: opts?.host ?? '0.0.0.0',
      corsOrigin: opts?.corsOrigin ?? '*',
      maxBodyBytes: opts?.maxBodyBytes ?? 10 * 1024 * 1024, // 10MB
    };
  }

  /** 注册路由（支持 :param 路径参数和 * 通配符） */
  route(method: string, path: string, handler: RouteHandler): void {
    const { regex, paramNames } = compilePath(path);
    this.routes.push({ method: method.toUpperCase(), path, handler, regex, paramNames });
    this.logger.debug('Route registered', { method, path });
  }

  /** GET 快捷 */
  get(path: string, handler: RouteHandler): void { this.route('GET', path, handler); }
  /** POST 快捷 */
  post(path: string, handler: RouteHandler): void { this.route('POST', path, handler); }
  /** PUT 快捷 */
  put(path: string, handler: RouteHandler): void { this.route('PUT', path, handler); }
  /** DELETE 快捷 */
  delete(path: string, handler: RouteHandler): void { this.route('DELETE', path, handler); }

  /** 注册中间件 */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
    this.logger.debug('Middleware added', { name: middleware.name });
  }

  /** 启动服务器 */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createHttpServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.on('error', reject);
      this.server.listen(this.opts.port, this.opts.host, () => {
        this.logger.info('HTTP server started', { port: this.opts.port, host: this.opts.host });
        resolve();
      });
    });
  }

  /** 停止服务器 */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => {
        this.logger.info('HTTP server stopped');
        resolve();
      });
    });
  }

  /** 获取底层Node HTTP server (供WebSocket附加使用) */
  get rawServer(): ReturnType<typeof createHttpServer> | null {
    return this.server;
  }

  /** 路由信息（调试用） */
  routeList(): Array<{ method: string; path: string }> {
    return this.routes.map(r => ({ method: r.method, path: r.path }));
  }

  // ── Request handling ──────────────────────────────────────────────

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', this.opts.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-TxHash, X-Payment-Chain, X-Payment-From, X-Payment-Amount');

    // Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Run middlewares
      for (const mw of this.middlewares) {
        const passed = await mw.handle(req, res);
        if (!passed) return;
      }

      // Parse URL
      const { pathname, query } = parseQuery(req.url ?? '/');

      // Match route with params
      const match = this.matchRoute(req.method ?? 'GET', pathname);
      if (!match) {
        this.sendJson(res, 404, { error: 'Not Found', path: pathname });
        return;
      }

      // Enhance request
      const enhanced = req as EnhancedRequest;
      enhanced.params = match.params;
      enhanced.query = query;
      enhanced.pathname = pathname;

      // Read body
      const body = await this.readBody(req);

      // Execute handler
      await match.route.handler(enhanced, res, body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Request error', { method: req.method, url: req.url, error: msg });
      this.sendJson(res, 500, { error: 'Internal Server Error' });
    } finally {
      const elapsed = Date.now() - startTime;
      this.logger.debug('Request', {
        method: req.method, url: req.url, statusCode: res.statusCode, elapsed,
      });
    }
  }

  private matchRoute(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (m) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
        return { route, params };
      }
    }
    return null;
  }

  private readBody(req: IncomingMessage): Promise<string> {
    const max = this.opts.maxBodyBytes;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > max) {
          req.destroy(new Error(`Body exceeds ${max} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  /** JSON 响应工具 */
  sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}
