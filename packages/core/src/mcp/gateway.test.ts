/**
 * MCP Gateway tests — JSON-RPC 2.0 protocol + tool/resource handling
 */
import { describe, it, expect } from 'vitest';
import { McpGateway, RPC_ERRORS, type JsonRpcRequest, type McpToolHandler, type McpResourceHandler } from '../mcp/gateway.js';

describe('MCP Gateway', () => {
  function createGateway() {
    return new McpGateway({ name: 'test-gateway', version: '0.1.0' });
  }

  describe('initialize', () => {
    it('should return server info and capabilities', async () => {
      const gw = createGateway();
      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
      expect(res.error).toBeUndefined();
      const result = res.result as any;
      expect(result.serverInfo.name).toBe('test-gateway');
      expect(result.serverInfo.version).toBe('0.1.0');
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.capabilities).toHaveProperty('tools');
    });
  });

  describe('ping', () => {
    it('should respond to ping', async () => {
      const gw = createGateway();
      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'ping' });
      expect(res.error).toBeUndefined();
      expect(res.result).toEqual({});
    });
  });

  describe('tools', () => {
    it('should list registered tools', async () => {
      const gw = createGateway();
      gw.registerTool({
        tool: { name: 'echo', description: 'Echo a message', inputSchema: { type: 'object' } },
        execute: async (args) => ({ content: [{ type: 'text', text: String(args.message) }] }),
      });

      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
      const result = res.result as any;
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].name).toBe('echo');
    });

    it('should call a registered tool', async () => {
      const gw = createGateway();
      gw.registerTool({
        tool: { name: 'add', description: 'Add numbers', inputSchema: {} },
        execute: async (args) => ({
          content: [{ type: 'text', text: String((args.a as number) + (args.b as number)) }],
        }),
      });

      const res = await gw.handleRequest({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'add', arguments: { a: 3, b: 4 } },
      });
      const result = res.result as any;
      expect(result.content[0].text).toBe('7');
    });

    it('should return error for unknown tool', async () => {
      const gw = createGateway();
      const res = await gw.handleRequest({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'nonexistent', arguments: {} },
      });
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe(RPC_ERRORS.INVALID_PARAMS);
    });
  });

  describe('resources', () => {
    it('should list registered resources', async () => {
      const gw = createGateway();
      gw.registerResource({
        resource: { uri: 'file:///test.txt', name: 'test.txt', mimeType: 'text/plain' },
        read: async () => ({ contents: [{ uri: 'file:///test.txt', text: 'hello' }] }),
      });

      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'resources/list' });
      const result = res.result as any;
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].uri).toBe('file:///test.txt');
    });

    it('should read a resource', async () => {
      const gw = createGateway();
      gw.registerResource({
        resource: { uri: 'config://main', name: 'config' },
        read: async () => ({ contents: [{ uri: 'config://main', text: '{"key":"value"}' }] }),
      });

      const res = await gw.handleRequest({
        jsonrpc: '2.0', id: 1, method: 'resources/read',
        params: { uri: 'config://main' },
      });
      const result = res.result as any;
      expect(result.contents[0].text).toBe('{"key":"value"}');
    });

    it('should return error for unknown resource', async () => {
      const gw = createGateway();
      const res = await gw.handleRequest({
        jsonrpc: '2.0', id: 1, method: 'resources/read',
        params: { uri: 'missing://resource' },
      });
      expect(res.error).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should return METHOD_NOT_FOUND for unknown methods', async () => {
      const gw = createGateway();
      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'nonexistent/method' });
      expect(res.error!.code).toBe(RPC_ERRORS.METHOD_NOT_FOUND);
    });
  });

  describe('prompts', () => {
    it('should list registered prompts', async () => {
      const gw = createGateway();
      gw.registerPrompt({ name: 'summarize', description: 'Summarize text' });
      gw.registerPrompt({ name: 'translate', description: 'Translate text' });

      const res = await gw.handleRequest({ jsonrpc: '2.0', id: 1, method: 'prompts/list' });
      const result = res.result as any;
      expect(result.prompts).toHaveLength(2);
    });

    it('should get a specific prompt', async () => {
      const gw = createGateway();
      gw.registerPrompt({ name: 'code-review', description: 'Review code', arguments: [{ name: 'code', required: true }] });

      const res = await gw.handleRequest({
        jsonrpc: '2.0', id: 1, method: 'prompts/get',
        params: { name: 'code-review' },
      });
      const result = res.result as any;
      expect(result.name).toBe('code-review');
      expect(result.arguments).toHaveLength(1);
    });
  });
});
