/**
 * 内置工具: Web搜索 & 浏览
 */
import type { ToolHandler } from '../tool-executor.js';

/** Web搜索工具 */
export const webSearchTool: ToolHandler = {
  name: 'web_search',
  description: 'Search the web for information. Returns search results.',
  async execute(args) {
    const query = String(args['query'] ?? '');
    if (!query) return 'Error: query is required';

    // 使用DuckDuckGo Lite API (无需API key)
    const url = `https://lite.duckduckgo.com/lite?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ConShell-V2/0.1.0' },
      });
      const html = await res.text();
      // 提取纯文本结果 (简化版)
      const textOnly = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
      return `Search results for "${query}":\n${textOnly}`;
    } catch (err) {
      return `Search failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/** Web页面浏览工具 */
export const webBrowseTool: ToolHandler = {
  name: 'web_browse',
  description: 'Fetch and read a web page. Returns the page content as text.',
  async execute(args) {
    const url = String(args['url'] ?? '');
    if (!url) return 'Error: url is required';

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ConShell-V2/0.1.0' },
        signal: AbortSignal.timeout(15000),
      });
      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const json = await res.json();
        return JSON.stringify(json, null, 2).slice(0, 4000);
      }

      const text = await res.text();
      // Strip HTML tags
      const cleaned = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);

      return `Content from ${url}:\n${cleaned}`;
    } catch (err) {
      return `Browse failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

/** 所有Web工具 */
export const webTools: ToolHandler[] = [webSearchTool, webBrowseTool];
