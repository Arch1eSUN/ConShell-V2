/**
 * Channels — 多通道管理 + 事件驱动架构
 *
 * Based on OpenClaw's channel system:
 * - Platform adapters (Telegram, Discord, Slack, WhatsApp, iMessage, WebChat)
 * - Message routing with group support
 * - Typed event emitter for inbound/outbound
 * - Channel lifecycle management
 * - Credential management per channel
 */
import type { Logger } from '../types/common.js';

// ── Channel Types ───────────────────────────────────────

export type ChannelPlatform =
  | 'telegram' | 'discord' | 'slack' | 'whatsapp'
  | 'imessage' | 'web' | 'signal' | 'matrix'
  | 'irc' | 'teams' | 'feishu' | 'line'
  | 'nostr' | 'webchat';

export type ChannelState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface ChannelConfig {
  platform: ChannelPlatform;
  enabled: boolean;
  /** Platform-specific credentials */
  credentials?: Record<string, string>;
  /** webhook URL for platforms that support it */
  webhookUrl?: string;
  /** Retry count before giving up */
  maxRetries?: number;
  /** Retry delay in ms */
  retryDelayMs?: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  platform: ChannelPlatform;
  from: string;
  fromName?: string;
  content: string;
  timestamp: number;
  /** For group messages */
  groupId?: string;
  groupName?: string;
  /** Media attachments */
  attachments?: ChannelAttachment[];
  /** Reply-to reference */
  replyTo?: string;
  /** Whether agent was explicitly mentioned */
  mentioned?: boolean;
}

export interface ChannelAttachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url?: string;
  data?: Buffer;
  mimeType: string;
  filename?: string;
  size?: number;
}

export interface OutboundMessage {
  platform: ChannelPlatform;
  to: string;
  content: string;
  attachments?: ChannelAttachment[];
  replyTo?: string;
}

/** A single token/chunk in a streaming response */
export interface StreamChunk {
  platform: ChannelPlatform;
  /** Target session/user ID */
  to: string;
  /** Current token/chunk content */
  content: string;
  /** Chunk sequence number (0-based) */
  index: number;
  /** Whether this is the final chunk */
  final: boolean;
}

// ── Channel Adapter Interface ───────────────────────────

/**
 * Every platform implements this interface.
 * The ChannelManager orchestrates all adapters.
 */
export interface ChannelAdapter {
  readonly platform: ChannelPlatform;
  readonly state: ChannelState;

  connect(config: ChannelConfig): Promise<void>;
  disconnect(): Promise<void>;
  send(message: OutboundMessage): Promise<{ messageId: string }>;

  /** Event handler — set by ChannelManager */
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;
}

// ── Channel Events ──────────────────────────────────────

export type ChannelEventMap = {
  'message:inbound':  ChannelMessage;
  'message:outbound': OutboundMessage;
  'message:chunk':    StreamChunk;
  'channel:connected':    { platform: ChannelPlatform };
  'channel:disconnected': { platform: ChannelPlatform; reason?: string };
  'channel:error':        { platform: ChannelPlatform; error: string };
};

export type ChannelEventHandler<T> = (data: T) => void | Promise<void>;

// ── WebChat Adapter (built-in) ──────────────────────────

export class WebChatAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'webchat';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private messageQueue: ChannelMessage[] = [];

  async connect(_config: ChannelConfig): Promise<void> {
    this.state = 'connected';
    this.onStateChange?.('connected');
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected';
    this.onStateChange?.('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    const id = `web_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // In real implementation, this would push to WS clients
    return { messageId: id };
  }

  /**
   * Inject a message from the WebUI/WebSocket client.
   * Called by the HTTP/WS server when a user sends a message.
   */
  injectMessage(from: string, content: string, opts?: { groupId?: string }): void {
    const msg: ChannelMessage = {
      id: `web_in_${Date.now()}`,
      channelId: 'webchat',
      platform: 'webchat',
      from,
      content,
      timestamp: Date.now(),
      groupId: opts?.groupId,
      mentioned: true,
    };
    this.messageQueue.push(msg);
    this.onMessage?.(msg);
  }
}

// ── Channel Manager ─────────────────────────────────────

export class ChannelManager {
  private adapters = new Map<ChannelPlatform, ChannelAdapter>();
  private configs = new Map<ChannelPlatform, ChannelConfig>();
  private listeners = new Map<string, Array<ChannelEventHandler<any>>>();
  private inboundQueue: ChannelMessage[] = [];
  private logger: Logger;

  constructor(opts?: { logger?: Logger }) {
    this.logger = opts?.logger ?? {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
      child: () => this.logger,
    };
    // Register built-in WebChat adapter
    this.registerAdapter(new WebChatAdapter());
  }

  // ── Adapter Registration ────────────────────────────

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.platform, adapter);

    // Wire up events
    adapter.onMessage = (msg) => {
      this.inboundQueue.push(msg);
      this.emit('message:inbound', msg);
    };
    adapter.onStateChange = (state) => {
      if (state === 'connected') {
        this.emit('channel:connected', { platform: adapter.platform });
      } else if (state === 'disconnected') {
        this.emit('channel:disconnected', { platform: adapter.platform });
      } else if (state === 'error') {
        this.emit('channel:error', { platform: adapter.platform, error: 'Connection error' });
      }
    };

    this.logger.debug('Channel adapter registered', { platform: adapter.platform });
  }

  // ── Configuration ───────────────────────────────────

  configure(config: ChannelConfig): void {
    this.configs.set(config.platform, config);
  }

  // ── Lifecycle ───────────────────────────────────────

  async connect(platform: ChannelPlatform): Promise<void> {
    const adapter = this.adapters.get(platform);
    const config = this.configs.get(platform);
    if (!adapter) throw new Error(`No adapter for platform: ${platform}`);
    if (!config) throw new Error(`No config for platform: ${platform}`);
    if (!config.enabled) {
      this.logger.warn('Channel disabled, skipping connect', { platform });
      return;
    }

    this.logger.info('Connecting channel', { platform });
    await adapter.connect(config);
  }

  async disconnect(platform: ChannelPlatform): Promise<void> {
    const adapter = this.adapters.get(platform);
    if (adapter) {
      await adapter.disconnect();
      this.logger.info('Channel disconnected', { platform });
    }
  }

  async connectAll(): Promise<void> {
    for (const [platform, config] of this.configs) {
      if (config.enabled && this.adapters.has(platform)) {
        try { await this.connect(platform); }
        catch (err) { this.logger.error('Channel connect failed', { platform, error: String(err) }); }
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const platform of this.adapters.keys()) {
      try { await this.disconnect(platform); }
      catch (err) { this.logger.error('Channel disconnect failed', { platform: String(platform), error: String(err) }); }
    }
  }

  // ── Messaging ───────────────────────────────────────

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    const adapter = this.adapters.get(message.platform);
    if (!adapter) throw new Error(`No adapter for platform: ${message.platform}`);
    if (adapter.state !== 'connected') throw new Error(`Channel not connected: ${message.platform}`);

    this.emit('message:outbound', message);
    return adapter.send(message);
  }

  /** Drain and return all queued inbound messages */
  drainInbound(): ChannelMessage[] {
    const messages = [...this.inboundQueue];
    this.inboundQueue = [];
    return messages;
  }

  /** Emit a streaming chunk event (does not go through adapter.send) */
  emitChunk(chunk: StreamChunk): void {
    this.emit('message:chunk', chunk);
  }

  // ── Events ──────────────────────────────────────────

  on<K extends keyof ChannelEventMap>(event: K, handler: ChannelEventHandler<ChannelEventMap[K]>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  off<K extends keyof ChannelEventMap>(event: K, handler: ChannelEventHandler<ChannelEventMap[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  private emit<K extends keyof ChannelEventMap>(event: K, data: ChannelEventMap[K]): void {
    const handlers = this.listeners.get(event) ?? [];
    for (const handler of handlers) {
      try { handler(data); }
      catch (err) { this.logger.error('Channel event handler error', { event, error: String(err) }); }
    }
  }

  // ── Query ───────────────────────────────────────────

  list(): Array<{ platform: ChannelPlatform; state: ChannelState; enabled: boolean }> {
    return Array.from(this.adapters.entries()).map(([platform, adapter]) => ({
      platform,
      state: adapter.state,
      enabled: this.configs.get(platform)?.enabled ?? false,
    }));
  }

  getAdapter(platform: ChannelPlatform): ChannelAdapter | undefined {
    return this.adapters.get(platform);
  }

  getWebChat(): WebChatAdapter | undefined {
    return this.adapters.get('webchat') as WebChatAdapter | undefined;
  }
}
