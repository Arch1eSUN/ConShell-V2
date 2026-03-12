/**
 * EvoMap Client Tests
 *
 * Tests the GEP protocol client: constructor, status, gene/capsule publishing,
 * and error handling. Network calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvoMapClient, type EvoMapConfig } from '../evomap/client.js';

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function mockFetchOk(result: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ jsonrpc: '2.0', result, id: 1 }),
    text: async () => '',
  });
}

function mockFetchError(status: number, text: string) {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => text,
    json: async () => ({}),
  });
}

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

describe('EvoMapClient', () => {
  const config: EvoMapConfig = {
    nodeId: 'test-agent-001',
    name: 'TestAgent',
    capabilities: ['text-generation', 'tool-use'],
    model: 'gpt-4o',
  };

  let client: EvoMapClient;

  beforeEach(() => {
    fetchMock.mockReset();
    client = new EvoMapClient(config, makeLogger());
  });

  describe('constructor', () => {
    it('should initialize with default baseUrl', () => {
      const status = client.getStatus();
      expect(status.nodeId).toBe('test-agent-001');
      expect(status.connected).toBe(false);
      expect(status.credits).toBe(0);
    });

    it('should accept custom baseUrl', () => {
      const c = new EvoMapClient({ ...config, baseUrl: 'https://custom.evomap.ai' }, makeLogger());
      expect(c.getStatus().nodeId).toBe('test-agent-001');
    });
  });

  describe('registerNode', () => {
    it('should call gep.hello and set connected state', async () => {
      mockFetchOk({ node_id: 'test-agent-001', status: 'ok', credits: 100 });

      const result = await client.registerNode();
      expect(result.node_id).toBe('test-agent-001');
      expect(result.credits).toBe(100);
      expect(client.connected).toBe(true);

      const status = client.getStatus();
      expect(status.connected).toBe(true);
      expect(status.credits).toBe(100);
      expect(status.lastHello).toBeTruthy();
    });

    it('should send correct JSON-RPC payload', async () => {
      mockFetchOk({ node_id: 'test-agent-001', status: 'ok' });

      await client.registerNode();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://evomap.ai/a2a/hello',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('gep.hello');
      expect(body.params.node_id).toBe('test-agent-001');
    });

    it('should handle API errors', async () => {
      mockFetchError(500, 'Internal Server Error');

      await expect(client.registerNode()).rejects.toThrow('EvoMap 500');
      expect(client.connected).toBe(false);
    });
  });

  describe('publishGene', () => {
    it('should publish a Gene asset', async () => {
      mockFetchOk({ asset_id: 'gene-123', status: 'published', gdi_score: 0.85 });

      const result = await client.publishGene('code-review', 'line-by-line', 0.9);
      expect(result.asset_id).toBe('gene-123');
      expect(result.gdi_score).toBe(0.85);

      expect(client.getStatus().publishedAssets).toBe(1);
    });
  });

  describe('publishCapsule', () => {
    it('should publish a Capsule asset', async () => {
      mockFetchOk({ asset_id: 'capsule-456', status: 'published' });

      const result = await client.publishCapsule('Web API', 'REST API template', { framework: 'express' });
      expect(result.asset_id).toBe('capsule-456');
      expect(client.getStatus().publishedAssets).toBe(1);
    });
  });

  describe('heartbeat', () => {
    it('should call registerNode', async () => {
      mockFetchOk({ node_id: 'test-agent-001', status: 'ok', credits: 50 });

      const result = await client.heartbeat();
      expect(result.status).toBe('ok');
      expect(client.connected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should set connected to false', async () => {
      mockFetchOk({ node_id: 'test-agent-001', status: 'ok' });
      await client.registerNode();
      expect(client.connected).toBe(true);

      client.disconnect();
      expect(client.connected).toBe(false);
    });
  });

  describe('RPC error handling', () => {
    it('should throw on JSON-RPC error response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Node not found' },
          id: 1,
        }),
        text: async () => '',
      });

      await expect(client.registerNode()).rejects.toThrow('EvoMap RPC error (-32000): Node not found');
    });

    it('should throw on empty result', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1 }),
        text: async () => '',
      });

      await expect(client.registerNode()).rejects.toThrow('empty RPC result');
    });
  });
});
