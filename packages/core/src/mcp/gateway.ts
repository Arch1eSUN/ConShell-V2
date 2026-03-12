/**
 * MCP Gateway — Model Context Protocol JSON-RPC 2.0 服务器
 *
 * Implements the full MCP specification:
 * - initialize / initialized handshake
 * - tools/list + tools/call
 * - resources/list + resources/read
 * - prompts/list + prompts/get
 * - notifications (progress, logs)
 * - Stdio transport (can be extended to SSE/WS)
 */
import type { Logger } from '../types/common.js';

// ── MCP Protocol Types ──────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolHandler {
  tool: McpTool;
  execute: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  isError?: boolean;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceHandler {
  resource: McpResource;
  read: () => Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }>;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpGatewayOptions {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
}

// ── JSON-RPC Error Codes ────────────────────────────────

export const RPC_ERRORS = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
} as const;

// ── Gateway Implementation ──────────────────────────────

export class McpGateway {
  private tools = new Map<string, McpToolHandler>();
  private resources = new Map<string, McpResourceHandler>();
  private prompts = new Map<string, McpPrompt>();
  private initialized = false;
  private logger: Logger;

  constructor(private opts: McpGatewayOptions, logger?: Logger) {
    this.logger = logger ?? {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
      child: () => this.logger,
    };
  }

  // ── Tool Registration ───────────────────────────────

  registerTool(handler: McpToolHandler): void {
    this.tools.set(handler.tool.name, handler);
    this.logger.debug('MCP tool registered', { name: handler.tool.name });
  }

  registerResource(handler: McpResourceHandler): void {
    this.resources.set(handler.resource.uri, handler);
  }

  registerPrompt(prompt: McpPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  // ── JSON-RPC Handler ────────────────────────────────

  async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req.id ?? null;

    try {
      switch (req.method) {
        case 'initialize':
          return this.handleInitialize(id, req.params);

        case 'initialized':
          this.initialized = true;
          return { jsonrpc: '2.0', id: id!, result: {} };

        case 'tools/list':
          return {
            jsonrpc: '2.0', id: id!,
            result: { tools: Array.from(this.tools.values()).map(h => h.tool) },
          };

        case 'tools/call':
          return this.handleToolCall(id!, req.params);

        case 'resources/list':
          return {
            jsonrpc: '2.0', id: id!,
            result: { resources: Array.from(this.resources.values()).map(h => h.resource) },
          };

        case 'resources/read':
          return this.handleResourceRead(id!, req.params);

        case 'prompts/list':
          return {
            jsonrpc: '2.0', id: id!,
            result: { prompts: Array.from(this.prompts.values()) },
          };

        case 'prompts/get':
          return this.handlePromptGet(id!, req.params);

        case 'ping':
          return { jsonrpc: '2.0', id: id!, result: {} };

        default:
          return {
            jsonrpc: '2.0', id: id!,
            error: { code: RPC_ERRORS.METHOD_NOT_FOUND, message: `Unknown method: ${req.method}` },
          };
      }
    } catch (err) {
      this.logger.error('MCP request error', { method: req.method, error: String(err) });
      return {
        jsonrpc: '2.0', id: id!,
        error: { code: RPC_ERRORS.INTERNAL_ERROR, message: String(err) },
      };
    }
  }

  // ── Protocol Handlers ───────────────────────────────

  private handleInitialize(id: number | string | null, _params?: Record<string, unknown>): JsonRpcResponse {
    const caps: Record<string, unknown> = {};
    if (this.opts.capabilities?.tools !== false)     caps.tools = {};
    if (this.opts.capabilities?.resources !== false)  caps.resources = {};
    if (this.opts.capabilities?.prompts !== false)    caps.prompts = {};
    if (this.opts.capabilities?.logging !== false)    caps.logging = {};

    return {
      jsonrpc: '2.0', id: id!,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: this.opts.name, version: this.opts.version },
        capabilities: caps,
      },
    };
  }

  private async handleToolCall(id: number | string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const name = params?.name as string;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    const handler = this.tools.get(name);
    if (!handler) {
      return {
        jsonrpc: '2.0', id,
        error: { code: RPC_ERRORS.INVALID_PARAMS, message: `Unknown tool: ${name}` },
      };
    }

    const result = await handler.execute(args);
    return { jsonrpc: '2.0', id, result };
  }

  private async handleResourceRead(id: number | string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const uri = params?.uri as string;
    const handler = this.resources.get(uri);
    if (!handler) {
      return {
        jsonrpc: '2.0', id,
        error: { code: RPC_ERRORS.INVALID_PARAMS, message: `Unknown resource: ${uri}` },
      };
    }

    const result = await handler.read();
    return { jsonrpc: '2.0', id, result };
  }

  private async handlePromptGet(id: number | string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const name = params?.name as string;
    const prompt = this.prompts.get(name);
    if (!prompt) {
      return {
        jsonrpc: '2.0', id,
        error: { code: RPC_ERRORS.INVALID_PARAMS, message: `Unknown prompt: ${name}` },
      };
    }
    return { jsonrpc: '2.0', id, result: prompt };
  }

  // ── Stdio Transport ─────────────────────────────────

  /**
   * Start listening on stdin/stdout for JSON-RPC messages.
   * This is the standard MCP transport for CLI integrations.
   */
  startStdio(): void {
    let buffer = '';

    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = JSON.parse(line) as JsonRpcRequest;
          const res = await this.handleRequest(req);
          process.stdout.write(JSON.stringify(res) + '\n');
        } catch (err) {
          const errRes: JsonRpcResponse = {
            jsonrpc: '2.0', id: null,
            error: { code: RPC_ERRORS.PARSE_ERROR, message: 'Invalid JSON' },
          };
          process.stdout.write(JSON.stringify(errRes) + '\n');
        }
      }
    });

    this.logger.info('MCP Gateway started on stdio', { name: this.opts.name });
  }
}
