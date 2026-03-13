/**
 * Phase 3 Tests — Channel Adapters + Gateway
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelManager, WebChatAdapter } from './index.js';
import { WhatsAppAdapter } from './adapters/whatsapp.js';
import { SlackAdapter } from './adapters/slack.js';
import { MatrixAdapter } from './adapters/matrix.js';
import { Gateway } from './gateway.js';
import type { ChannelMessage, OutboundMessage, ChannelConfig } from './index.js';

// ── WebChat Adapter ───────────────────────────────────────

describe('WebChatAdapter', () => {
  it('connects and disconnects', async () => {
    const adapter = new WebChatAdapter();
    expect(adapter.state).toBe('disconnected');

    await adapter.connect({ platform: 'webchat', enabled: true });
    expect(adapter.state).toBe('connected');

    await adapter.disconnect();
    expect(adapter.state).toBe('disconnected');
  });

  it('injects messages', () => {
    const adapter = new WebChatAdapter();
    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);

    adapter.injectMessage('user1', 'Hello agent');
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('user1');
    expect(messages[0].content).toBe('Hello agent');
    expect(messages[0].platform).toBe('webchat');
  });

  it('sends messages and returns id', async () => {
    const adapter = new WebChatAdapter();
    await adapter.connect({ platform: 'webchat', enabled: true });

    const result = await adapter.send({
      platform: 'webchat',
      to: 'user1',
      content: 'Hi there',
    });
    expect(result.messageId).toMatch(/^web_/);
  });
});

// ── WhatsApp Adapter ──────────────────────────────────────

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;

  beforeEach(() => {
    adapter = new WhatsAppAdapter();
  });

  it('has correct platform', () => {
    expect(adapter.platform).toBe('whatsapp');
  });

  it('throws without ACCESS_TOKEN', async () => {
    await expect(adapter.connect({
      platform: 'whatsapp',
      enabled: true,
      credentials: {},
    })).rejects.toThrow('ACCESS_TOKEN');
  });

  it('throws without PHONE_NUMBER_ID', async () => {
    await expect(adapter.connect({
      platform: 'whatsapp',
      enabled: true,
      credentials: { ACCESS_TOKEN: 'test' },
    })).rejects.toThrow('PHONE_NUMBER_ID');
  });

  it('handles webhook verify', () => {
    // Use internal method via type assertion
    const wa = adapter as any;
    wa.verifyToken = 'my-verify-token';

    const result = adapter.handleWebhookVerify({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-verify-token',
      'hub.challenge': 'challenge-abc',
    });
    expect(result).toBe('challenge-abc');
  });

  it('rejects invalid webhook verify', () => {
    const result = adapter.handleWebhookVerify({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-abc',
    });
    expect(result).toBeNull();
  });

  it('processes webhook payload', () => {
    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);

    adapter.handleWebhookPayload({
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.123',
              from: '8613800138000',
              timestamp: '1700000000',
              type: 'text',
              text: { body: '你好' },
            }],
            contacts: [{ profile: { name: 'Test User' } }],
          },
        }],
      }],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('8613800138000');
    expect(messages[0].content).toBe('你好');
    expect(messages[0].fromName).toBe('Test User');
    expect(messages[0].platform).toBe('whatsapp');
  });

  it('ignores empty webhook payload', () => {
    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);
    adapter.handleWebhookPayload({ entry: [{ changes: [{ value: {} }] }] });
    expect(messages).toHaveLength(0);
  });
});

// ── Slack Adapter ─────────────────────────────────────────

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
  });

  it('has correct platform', () => {
    expect(adapter.platform).toBe('slack');
  });

  it('throws without BOT_TOKEN', async () => {
    await expect(adapter.connect({
      platform: 'slack',
      enabled: true,
      credentials: {},
    })).rejects.toThrow('BOT_TOKEN');
  });

  it('handles url_verification event', () => {
    const result = adapter.handleEvent({
      type: 'url_verification',
      challenge: 'abc123',
    });
    expect(result).toBe('abc123');
  });

  it('processes message event', () => {
    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);

    adapter.handleEvent({
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'U123',
        text: 'Hello bot',
        channel: 'C456',
        ts: '1700000000.123',
      },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('U123');
    expect(messages[0].content).toBe('Hello bot');
    expect(messages[0].groupId).toBe('C456');
  });

  it('ignores bot own messages', () => {
    const slack = adapter as any;
    slack.botUserId = 'B999';

    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);

    adapter.handleEvent({
      type: 'event_callback',
      event: {
        type: 'message',
        user: 'B999',
        text: 'my own message',
        channel: 'C456',
      },
    });

    expect(messages).toHaveLength(0);
  });
});

// ── Matrix Adapter ────────────────────────────────────────

describe('MatrixAdapter', () => {
  let adapter: MatrixAdapter;

  beforeEach(() => {
    adapter = new MatrixAdapter();
  });

  it('has correct platform', () => {
    expect(adapter.platform).toBe('matrix');
  });

  it('throws without HOMESERVER', async () => {
    await expect(adapter.connect({
      platform: 'matrix',
      enabled: true,
      credentials: {},
    })).rejects.toThrow('HOMESERVER');
  });

  it('throws without ACCESS_TOKEN', async () => {
    await expect(adapter.connect({
      platform: 'matrix',
      enabled: true,
      credentials: { HOMESERVER: 'https://matrix.org' },
    })).rejects.toThrow('ACCESS_TOKEN');
  });
});

// ── Channel Manager ───────────────────────────────────────

describe('ChannelManager', () => {
  let manager: ChannelManager;

  beforeEach(() => {
    manager = new ChannelManager();
  });

  it('has webchat adapter by default', () => {
    const list = manager.list();
    const webchat = list.find(c => c.platform === 'webchat');
    expect(webchat).toBeDefined();
  });

  it('registers custom adapter', () => {
    manager.registerAdapter(new WhatsAppAdapter());
    const list = manager.list();
    expect(list.find(c => c.platform === 'whatsapp')).toBeDefined();
  });

  it('connects and sends via adapter', async () => {
    manager.configure({ platform: 'webchat', enabled: true });
    await manager.connect('webchat');

    const result = await manager.send({
      platform: 'webchat',
      to: 'user1',
      content: 'Test',
    });
    expect(result.messageId).toBeTruthy();
  });

  it('throws when sending to unknown platform', async () => {
    await expect(manager.send({
      platform: 'telegram',
      to: 'user1',
      content: 'Test',
    })).rejects.toThrow('No adapter');
  });

  it('emits events', async () => {
    const events: any[] = [];
    manager.on('message:inbound', (msg) => events.push(msg));

    manager.configure({ platform: 'webchat', enabled: true });
    await manager.connect('webchat');

    const webchat = manager.getWebChat()!;
    webchat.injectMessage('user1', 'Hello');

    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('Hello');
  });

  it('drains inbound queue', async () => {
    manager.configure({ platform: 'webchat', enabled: true });
    await manager.connect('webchat');

    const webchat = manager.getWebChat()!;
    webchat.injectMessage('user1', 'Msg 1');
    webchat.injectMessage('user2', 'Msg 2');

    const drained = manager.drainInbound();
    expect(drained).toHaveLength(2);
    expect(manager.drainInbound()).toHaveLength(0);
  });

  it('connects and disconnects all', async () => {
    manager.registerAdapter(new WhatsAppAdapter());
    manager.configure({ platform: 'webchat', enabled: true });

    await manager.connectAll();
    const list = manager.list();
    expect(list.find(c => c.platform === 'webchat')?.state).toBe('connected');

    await manager.disconnectAll();
    expect(manager.list().find(c => c.platform === 'webchat')?.state).toBe('disconnected');
  });
});

// ── Gateway ───────────────────────────────────────────────

describe('Gateway', () => {
  it('creates with config', () => {
    const gw = new Gateway({
      channels: [
        { platform: 'webchat', enabled: true },
      ],
    });
    expect(gw).toBeDefined();
  });

  it('starts and stops', async () => {
    const gw = new Gateway({
      channels: [
        { platform: 'webchat', enabled: true },
      ],
    });

    await gw.start();
    const stats = gw.getStats();
    expect(stats.channelStates['webchat']).toBe('connected');
    expect(stats.uptime).toBeGreaterThanOrEqual(0);

    await gw.stop();
  });

  it('routes messages to handler', async () => {
    const gw = new Gateway({
      channels: [
        { platform: 'webchat', enabled: true },
      ],
    });

    const responses: string[] = [];
    gw.route({
      handler: async (msg) => {
        responses.push(msg.content);
        return `Echo: ${msg.content}`;
      },
    });

    await gw.start();

    const webchat = gw.getManager().getWebChat()!;
    webchat.injectMessage('user1', 'Hello');

    // Allow async route processing
    await new Promise(r => setTimeout(r, 50));
    expect(responses).toContain('Hello');

    await gw.stop();
  });

  it('enforces rate limit', async () => {
    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      globalRateLimit: 2,
    });

    await gw.start();

    // First 2 should succeed
    await gw.send({ platform: 'webchat', to: 'u1', content: 'msg1' });
    await gw.send({ platform: 'webchat', to: 'u1', content: 'msg2' });

    // 3rd should be rate limited
    await expect(
      gw.send({ platform: 'webchat', to: 'u1', content: 'msg3' })
    ).rejects.toThrow('rate limit');

    await gw.stop();
  });

  it('tracks stats', async () => {
    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
    });

    await gw.start();
    await gw.send({ platform: 'webchat', to: 'u1', content: 'test' });

    const stats = gw.getStats();
    expect(stats.totalOutbound).toBe(1);
    expect(stats.errors).toBe(0);

    await gw.stop();
  });

  // ── Streaming Protocol Hardening Tests ────────────────────

  it('streaming: no empty chunks, last content chunk is final, outbound once', async () => {
    const mockRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'Hello' };
        yield { type: 'text' as const, text: ' World' };
        yield { type: 'done' as const };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
      defaultModel: 'test-model',
    });

    await gw.start();

    const chunks: Array<{ content: string; index: number; final: boolean }> = [];
    gw.getManager().on('message:chunk', (chunk) => {
      chunks.push({ content: chunk.content, index: chunk.index, final: chunk.final });
    });

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => {
      outbound.push(msg.content);
    });

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    // No empty chunks exist
    expect(chunks.every(c => c.content.length > 0)).toBe(true);

    // Last content chunk is final=true, all others final=false
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ content: 'Hello', index: 0, final: false });
    expect(chunks[1]).toEqual({ content: ' World', index: 1, final: true });

    // Outbound fires exactly once with complete text
    expect(outbound).toEqual(['Hello World']);

    await gw.stop();
  });

  it('streaming: zero-text completion sends outbound, no timeout, no chunks', async () => {
    const mockRouter = {
      async *chatStreaming() {
        // Provider returns only usage/done — no text
        yield { type: 'usage' as const, usage: { inputTokens: 5, outputTokens: 0, cost: { amount: 0, currency: '' } } };
        yield { type: 'done' as const };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
    });

    await gw.start();

    const chunks: any[] = [];
    gw.getManager().on('message:chunk', (chunk) => chunks.push(chunk));

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'no text');
    await new Promise(r => setTimeout(r, 50));

    // No chunks emitted (zero-text)
    expect(chunks).toHaveLength(0);

    // Outbound still fires with empty content (HTTP doesn't hang)
    expect(outbound).toEqual(['']);

    await gw.stop();
  });

  it('streaming: mid-stream failure does not silently stitch fallback', async () => {
    const failingRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'partial' };
        throw new Error('connection reset');
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: failingRouter as any,
    });

    // Register fallback route handler
    gw.route({
      handler: async () => 'emergency fallback',
    });

    await gw.start();

    const chunks: Array<{ content: string; final: boolean }> = [];
    gw.getManager().on('message:chunk', (chunk) => {
      chunks.push({ content: chunk.content, final: chunk.final });
    });

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'test');
    await new Promise(r => setTimeout(r, 50));

    // Mid-stream error: chatStreaming throws, Gateway catches and does fallback
    // Fallback handler produces clean output (no mix of partial + fallback)
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toBe('emergency fallback');

    // The fallback chunk should be clean
    const fallbackChunk = chunks.find(c => c.content === 'emergency fallback');
    expect(fallbackChunk).toBeDefined();

    await gw.stop();
  });

  it('streaming: pre-token failure allows clean fallback', async () => {
    const failingRouter = {
      async *chatStreaming() {
        // Fails before any text yields
        throw new Error('inference provider unreachable');
        yield; // make it a generator
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: failingRouter as any,
    });

    gw.route({
      handler: async () => 'recovered via fallback',
    });

    await gw.start();

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    expect(outbound).toEqual(['recovered via fallback']);

    await gw.stop();
  });

  it('streaming: status lifecycle processing → completed', async () => {
    const mockRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'ok' };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
    });

    await gw.start();

    const statuses: string[] = [];
    gw.getManager().on('message:status', (evt) => statuses.push(evt.status));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    expect(statuses).toEqual(['processing', 'completed']);

    await gw.stop();
  });

  it('streaming: status lifecycle processing → completed on no-handler fallback', async () => {
    const failingRouter = {
      async *chatStreaming() {
        throw new Error('dead');
        yield;
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: failingRouter as any,
    });

    // No route handlers — falls through to empty outbound
    await gw.start();

    const statuses: string[] = [];
    gw.getManager().on('message:status', (evt) => statuses.push(evt.status));

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    // Empty outbound is still a valid completion
    expect(statuses).toEqual(['processing', 'completed']);
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toBe('');

    await gw.stop();
  });

  it('streaming: fallback without inference router sends outbound exactly once', async () => {
    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
    });

    gw.route({
      handler: async () => 'fallback reply',
    });

    await gw.start();

    const chunks: Array<{ content: string; final: boolean }> = [];
    gw.getManager().on('message:chunk', (chunk) => {
      chunks.push({ content: chunk.content, final: chunk.final });
    });

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ content: 'fallback reply', final: true });
    expect(outbound).toEqual(['fallback reply']);

    await gw.stop();
  });
});

