/**
 * 内置工具: HTTP请求
 * 通用网络请求工具
 */
import type { ToolHandler } from '../tool-executor.js';

/** HTTP请求工具 */
export const httpRequestTool: ToolHandler = {
  name: 'http_request',
  description: 'Make an HTTP request. Supports GET, POST, PUT, DELETE, PATCH.',
  async execute(args) {
    const url = String(args['url'] ?? '');
    const method = String(args['method'] ?? 'GET').toUpperCase();
    const body = args['body'] ? JSON.stringify(args['body']) : undefined;
    const headersInput = args['headers'] as Record<string, string> | undefined;

    if (!url) return 'Error: url is required';

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'ConShell-V2/0.1.0',
        ...headersInput,
      };

      if (body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(15000),
      });

      const contentType = res.headers.get('content-type') ?? '';
      let responseBody: string;

      if (contentType.includes('application/json')) {
        const json = await res.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await res.text();
      }

      return `HTTP ${res.status} ${res.statusText}\n\n${responseBody.slice(0, 4000)}`;
    } catch (err) {
      return `HTTP request failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const httpTools: ToolHandler[] = [httpRequestTool];
