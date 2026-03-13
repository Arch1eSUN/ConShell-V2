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

  it('streaming: post-token failure emits error event, no fallback stitching', async () => {
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

    // Register fallback route handler — should NOT be used for post-token failure
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

    const errors: Array<{ code: string; message: string; retryable: boolean }> = [];
    gw.getManager().on('message:error', (evt) => {
      errors.push({ code: evt.code, message: evt.message, retryable: evt.retryable });
    });

    const statuses: string[] = [];
    gw.getManager().on('message:status', (evt) => statuses.push(evt.status));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'test');
    await new Promise(r => setTimeout(r, 50));

    // Post-token failure: no fallback stitching
    // Outbound fires with empty content (sendSafe for HTTP safety)
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toBe('');

    // Fallback content "emergency fallback" should NOT appear
    expect(chunks.find(c => c.content === 'emergency fallback')).toBeUndefined();

    // Error event should be emitted
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('INFERENCE_STREAM_FAILED');
    expect(errors[0].retryable).toBe(true);

    // Status lifecycle: processing → failed (not completed)
    expect(statuses).toEqual(['processing', 'failed']);

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

// ── Round 9: True Incremental Streaming Tests ──────────────

describe('Gateway — incremental streaming (Round 9)', () => {
  it('chunks are emitted during stream, not after completion', async () => {
    // A slow async generator that yields tokens with delays
    const mockRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'A' };
        await new Promise(r => setTimeout(r, 20));
        yield { type: 'text' as const, text: 'B' };
        await new Promise(r => setTimeout(r, 20));
        yield { type: 'text' as const, text: 'C' };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
    });

    await gw.start();

    const chunkTimings: Array<{ content: string; time: number }> = [];
    const startTime = Date.now();
    gw.getManager().on('message:chunk', (chunk) => {
      chunkTimings.push({ content: chunk.content, time: Date.now() - startTime });
    });

    let outboundTime = 0;
    gw.getManager().on('message:outbound', () => {
      outboundTime = Date.now() - startTime;
    });

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 150));

    // 3 chunks: A, B, C
    expect(chunkTimings).toHaveLength(3);

    // Key assertion: first chunk (A) must arrive BEFORE the outbound message
    // With old full-buffering, all chunks would arrive at the same time as outbound
    expect(chunkTimings[0].time).toBeLessThan(outboundTime);

    // Chunks arrive incrementally, not all at once
    // First chunk (A) should arrive before third chunk (C)
    expect(chunkTimings[0].time).toBeLessThan(chunkTimings[2].time);

    await gw.stop();
  });

  it('one-chunk holdback: final=true only on last chunk', async () => {
    const mockRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'X' };
        yield { type: 'text' as const, text: 'Y' };
        yield { type: 'text' as const, text: 'Z' };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
    });

    await gw.start();

    const chunks: Array<{ content: string; index: number; final: boolean }> = [];
    gw.getManager().on('message:chunk', (chunk) => {
      chunks.push({ content: chunk.content, index: chunk.index, final: chunk.final });
    });

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    expect(chunks).toEqual([
      { content: 'X', index: 0, final: false },
      { content: 'Y', index: 1, final: false },
      { content: 'Z', index: 2, final: true },
    ]);

    await gw.stop();
  });

  it('single-token stream: one chunk with final=true', async () => {
    const mockRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'Only' };
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: mockRouter as any,
    });

    await gw.start();

    const chunks: Array<{ content: string; final: boolean }> = [];
    gw.getManager().on('message:chunk', (chunk) => {
      chunks.push({ content: chunk.content, final: chunk.final });
    });

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'hello');
    await new Promise(r => setTimeout(r, 50));

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ content: 'Only', final: true });

    await gw.stop();
  });

  it('post-token failure: status lifecycle is processing → failed', async () => {
    const failingRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'begun' };
        yield { type: 'text' as const, text: 'more' };
        throw new Error('provider died');
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: failingRouter as any,
    });

    await gw.start();

    const statuses: string[] = [];
    gw.getManager().on('message:status', (evt) => statuses.push(evt.status));

    const errors: Array<{ code: string }> = [];
    gw.getManager().on('message:error', (evt) => errors.push({ code: evt.code }));

    const outbound: string[] = [];
    gw.getManager().on('message:outbound', (msg) => outbound.push(msg.content));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('user1', 'test');
    await new Promise(r => setTimeout(r, 50));

    expect(statuses).toEqual(['processing', 'failed']);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('INFERENCE_STREAM_FAILED');
    // HTTP doesn't hang — outbound was sent
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toBe('');

    await gw.stop();
  });

  it('error event is session-scoped, no cross-session leakage', async () => {
    const failingRouter = {
      async *chatStreaming() {
        yield { type: 'text' as const, text: 'data' };
        throw new Error('crash');
      },
    };

    const gw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
      inferenceRouter: failingRouter as any,
    });

    await gw.start();

    const errorTargets: string[] = [];
    gw.getManager().on('message:error', (evt) => errorTargets.push(evt.to));

    const adapter = gw.getManager().getWebChat()!;
    adapter.injectMessage('session-A', 'test');
    await new Promise(r => setTimeout(r, 50));

    // Error should only target session-A
    expect(errorTargets).toEqual(['session-A']);

    await gw.stop();
  });
});

