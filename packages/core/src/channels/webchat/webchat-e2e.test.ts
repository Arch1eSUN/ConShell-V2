/**
 * WebChat Channel E2E Test
 *
 * 验证第一条真实 channel 闭环：
 *   1. Adapter contract — WebChatAdapter 符合 ChannelAdapter 接口
 *   2. Inbound/outbound flow — 消息穿系统一圈回来
 *   3. Session mapping — 相同 sessionId 关联，不同 session 不串
 *   4. Transport validation — 合法/非法请求
 *   5. Gateway integration — 完整 Gateway→route→reply 链路
 *
 * 所有 import 走 public API 或 channel public contract。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Public API imports ──────────────────────────────────
import {
  WebChatAdapter,
  ChannelManager,
} from '../../public.js';
import type {
  ChannelAdapter,
  ChannelMessage,
  ChannelConfig,
  OutboundMessage,
} from '../../public.js';

// ── Transport imports ───────────────────────────────────
import {
  WebChatTransport,
  validateRequest,
} from './webchat-transport.js';

// ── Gateway (used for full-loop test) ───────────────────
import { Gateway } from '../gateway.js';

// ═══════════════════════════════════════════════════════════
// 1. Adapter Contract Tests
// ═══════════════════════════════════════════════════════════

describe('WebChat Adapter Contract', () => {
  let adapter: WebChatAdapter;

  beforeEach(() => {
    adapter = new WebChatAdapter();
  });

  it('should implement ChannelAdapter interface', () => {
    // Type-level check: WebChatAdapter satisfies ChannelAdapter
    const _check: ChannelAdapter = adapter;
    expect(_check).toBeDefined();
  });

  it('should have platform = webchat', () => {
    expect(adapter.platform).toBe('webchat');
  });

  it('should start disconnected', () => {
    expect(adapter.state).toBe('disconnected');
  });

  it('should connect and set state to connected', async () => {
    await adapter.connect({ platform: 'webchat', enabled: true });
    expect(adapter.state).toBe('connected');
  });

  it('should disconnect and set state to disconnected', async () => {
    await adapter.connect({ platform: 'webchat', enabled: true });
    await adapter.disconnect();
    expect(adapter.state).toBe('disconnected');
  });

  it('should fire onStateChange on connect', async () => {
    const states: string[] = [];
    adapter.onStateChange = (s) => states.push(s);
    await adapter.connect({ platform: 'webchat', enabled: true });
    expect(states).toContain('connected');
  });

  it('should fire onMessage when injectMessage called', () => {
    const messages: ChannelMessage[] = [];
    adapter.onMessage = (msg) => messages.push(msg);
    adapter.injectMessage('user-1', 'hello');
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('user-1');
    expect(messages[0].content).toBe('hello');
    expect(messages[0].platform).toBe('webchat');
    expect(messages[0].channelId).toBe('webchat');
  });

  it('should return messageId from send', async () => {
    await adapter.connect({ platform: 'webchat', enabled: true });
    const result = await adapter.send({
      platform: 'webchat',
      to: 'user-1',
      content: 'reply',
    });
    expect(result.messageId).toMatch(/^web_/);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Request Validation Tests
// ═══════════════════════════════════════════════════════════

describe('WebChat Request Validation', () => {
  it('should accept valid request', () => {
    const result = validateRequest({ sessionId: 'abc', message: 'hello' });
    expect(result.valid).toBe(true);
  });

  it('should reject null body', () => {
    const result = validateRequest(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('JSON object');
  });

  it('should reject missing sessionId', () => {
    const result = validateRequest({ message: 'hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('sessionId');
  });

  it('should reject missing message', () => {
    const result = validateRequest({ sessionId: 'abc' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('message');
  });

  it('should reject empty sessionId', () => {
    const result = validateRequest({ sessionId: '', message: 'hi' });
    expect(result.valid).toBe(false);
  });

  it('should reject empty message', () => {
    const result = validateRequest({ sessionId: 'abc', message: '' });
    expect(result.valid).toBe(false);
  });

  it('should reject oversized sessionId', () => {
    const result = validateRequest({ sessionId: 'x'.repeat(200), message: 'hi' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('128');
  });

  it('should reject oversized message', () => {
    const result = validateRequest({ sessionId: 'abc', message: 'x'.repeat(40000) });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('32768');
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Transport + Gateway Full-Loop Tests
// ═══════════════════════════════════════════════════════════

describe('WebChat Full-Loop (Transport → Gateway → Response)', () => {
  let gateway: Gateway;
  let transport: WebChatTransport;

  beforeEach(async () => {
    gateway = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
    });

    // Route: echo handler
    gateway.route({
      handler: async (msg) => `Echo: ${msg.content}`,
    });

    await gateway.start();
    transport = new WebChatTransport(gateway.getManager(), { timeoutMs: 5000 });
  });

  afterEach(async () => {
    await gateway.stop();
  });

  it('should complete full inbound → processing → outbound loop', async () => {
    const response = await transport.handleMessage({
      sessionId: 'session-001',
      message: 'Hello ConShell',
    });

    expect(response.reply).toBe('Echo: Hello ConShell');
    expect(response.sessionId).toBe('session-001');
    expect(response.platform).toBe('webchat');
    expect(response.messageId).toMatch(/^web_out_/);
    expect(response.timestamp).toBeGreaterThan(0);
  });

  it('should handle multiple sequential messages on same session', async () => {
    const r1 = await transport.handleMessage({
      sessionId: 'session-002',
      message: 'First message',
    });
    expect(r1.reply).toBe('Echo: First message');
    expect(r1.sessionId).toBe('session-002');

    const r2 = await transport.handleMessage({
      sessionId: 'session-002',
      message: 'Second message',
    });
    expect(r2.reply).toBe('Echo: Second message');
    expect(r2.sessionId).toBe('session-002');
  });

  it('should isolate different sessions', async () => {
    // Send message on session A
    const rA = await transport.handleMessage({
      sessionId: 'session-A',
      message: 'From A',
    });
    expect(rA.sessionId).toBe('session-A');
    expect(rA.reply).toBe('Echo: From A');

    // Send message on session B
    const rB = await transport.handleMessage({
      sessionId: 'session-B',
      message: 'From B',
    });
    expect(rB.sessionId).toBe('session-B');
    expect(rB.reply).toBe('Echo: From B');
  });

  it('should reject invalid request', async () => {
    await expect(
      transport.handleMessage({ sessionId: '', message: 'hello' })
    ).rejects.toThrow('Invalid request');
  });

  it('should reject when adapter not connected', async () => {
    await gateway.stop();

    // Create a fresh manager without connecting
    const freshManager = new ChannelManager();
    const freshTransport = new WebChatTransport(freshManager);

    await expect(
      freshTransport.handleMessage({ sessionId: 'abc', message: 'hi' })
    ).rejects.toThrow('not connected');
  });

  it('should return empty reply when no handler matches', async () => {
    // Create gateway with no route handlers
    const emptyGw = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
    });
    await emptyGw.start();

    const emptyTransport = new WebChatTransport(emptyGw.getManager(), { timeoutMs: 2000 });

    // Protocol hardening: Gateway always sends outbound (even empty)
    // so HTTP never times out — returns empty reply instead
    const response = await emptyTransport.handleMessage({
      sessionId: 'lonely',
      message: 'hello?',
    });
    expect(response.reply).toBe('');
    expect(response.sessionId).toBe('lonely');

    await emptyGw.stop();
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Transport Info Tests
// ═══════════════════════════════════════════════════════════

describe('WebChat Transport Info', () => {
  it('should report transport info', async () => {
    const gateway = new Gateway({
      channels: [{ platform: 'webchat', enabled: true }],
    });
    await gateway.start();

    const transport = new WebChatTransport(gateway.getManager());
    const info = transport.getInfo();

    expect(info.platform).toBe('webchat');
    expect(info.timeoutMs).toBe(30000);
    expect(info.adapterState).toBe('connected');

    await gateway.stop();
  });

  it('should report unavailable when no adapter', () => {
    // Construct manager but don't register webchat manually
    // (ChannelManager auto-registers webchat, so we test the getInfo path)
    const manager = new ChannelManager();
    const transport = new WebChatTransport(manager);
    const info = transport.getInfo();

    expect(info.platform).toBe('webchat');
    expect(info.adapterState).toBe('disconnected'); // registered but not connected
  });
});

// ═══════════════════════════════════════════════════════════
// 5. ChannelManager Event Flow Tests
// ═══════════════════════════════════════════════════════════

describe('WebChat ChannelManager Event Flow', () => {
  it('should emit message:inbound when injectMessage called', async () => {
    const manager = new ChannelManager();
    manager.configure({ platform: 'webchat', enabled: true });
    await manager.connect('webchat');

    const received: ChannelMessage[] = [];
    manager.on('message:inbound', (msg) => { received.push(msg); });

    const webchat = manager.getWebChat()!;
    webchat.injectMessage('user-X', 'test event');

    expect(received).toHaveLength(1);
    expect(received[0].from).toBe('user-X');
    expect(received[0].content).toBe('test event');
  });

  it('should emit message:outbound when send called', async () => {
    const manager = new ChannelManager();
    manager.configure({ platform: 'webchat', enabled: true });
    await manager.connect('webchat');

    const outbound: OutboundMessage[] = [];
    manager.on('message:outbound', (msg) => { outbound.push(msg); });

    await manager.send({
      platform: 'webchat',
      to: 'user-X',
      content: 'response',
    });

    expect(outbound).toHaveLength(1);
    expect(outbound[0].to).toBe('user-X');
    expect(outbound[0].content).toBe('response');
  });
});
