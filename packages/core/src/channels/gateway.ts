/**
 * Gateway Control Plane — 多通道统一网关
 *
 * 职责：
 * - 统一管理所有通道适配器的生命周期
 * - 消息路由和优先级排序
 * - 通道健康检查和自动重连
 * - 消息速率限制
 * - 统一日志和指标
 */
import type { Logger, Message } from '../types/common.js';
import type { InferenceRouter } from '../inference/index.js';
import type {
  ChannelPlatform, ChannelConfig, ChannelMessage, OutboundMessage,
  ChannelAdapter, ChannelState,
} from './index.js';
import { ChannelManager } from './index.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { DiscordAdapter } from './adapters/discord.js';
import { WhatsAppAdapter } from './adapters/whatsapp.js';
import { SlackAdapter } from './adapters/slack.js';
import { MatrixAdapter } from './adapters/matrix.js';

// ── Types ────────────────────────────────────────────────

export interface GatewayConfig {
  channels: ChannelConfig[];
  /** Max messages per second across all channels */
  globalRateLimit?: number;
  /** Health check interval in ms */
  healthCheckIntervalMs?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts per channel */
  maxReconnectAttempts?: number;
  /** Optional inference router for real streaming (when absent, falls back to route handlers) */
  inferenceRouter?: InferenceRouter;
  /** Default model for inference streaming (default: 'gpt-4') */
  defaultModel?: string;
  /** Default system prompt for inference streaming */
  defaultSystemPrompt?: string;
}

export interface GatewayStats {
  totalInbound: number;
  totalOutbound: number;
  channelStates: Record<string, ChannelState>;
  uptime: number;
  errors: number;
}

export interface MessageRoute {
  /** Source platform filter — null = all */
  from?: ChannelPlatform | null;
  /** Pattern match on content */
  pattern?: RegExp;
  /** Handler function */
  handler: (msg: ChannelMessage) => Promise<string | null>;
}

// ── Gateway ──────────────────────────────────────────────

export class Gateway {
  private manager: ChannelManager;
  private logger: Logger;
  private config: GatewayConfig;
  private routes: MessageRoute[] = [];
  private healthTimer: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private stats = { inbound: 0, outbound: 0, errors: 0 };
  private inferenceRouter: InferenceRouter | null;

  // Rate limiting
  private messageTimestamps: number[] = [];
  private rateLimitWindowMs = 1000;

  constructor(config: GatewayConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger ?? {
      debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
      child: function() { return this; },
    };
    this.manager = new ChannelManager({ logger: this.logger });
    this.inferenceRouter = config.inferenceRouter ?? null;
  }

  // ── Lifecycle ──────────────────────────────────────────

  async start(): Promise<void> {
    this.startTime = Date.now();
    this.logger.info('Gateway starting', { channels: this.config.channels.length });

    // Register adapters for configured channels
    for (const cfg of this.config.channels) {
      // webchat is already registered by ChannelManager constructor
      if (cfg.platform === 'webchat') {
        this.manager.configure(cfg);
        continue;
      }
      const adapter = this.createAdapter(cfg.platform);
      if (adapter) {
        this.manager.registerAdapter(adapter);
        this.manager.configure(cfg);
      } else {
        this.logger.warn('No adapter for platform', { platform: cfg.platform });
      }
    }

    // Subscribe to inbound messages
    this.manager.on('message:inbound', (msg) => {
      this.stats.inbound++;
      this.routeMessage(msg);
    });

    // Connect all enabled channels
    await this.manager.connectAll();

    // Start health checks
    if (this.config.healthCheckIntervalMs) {
      this.startHealthChecks();
    }

    this.logger.info('Gateway started', { active: this.manager.list().filter(c => c.state === 'connected').length });
  }

  async stop(): Promise<void> {
    if (this.healthTimer) clearTimeout(this.healthTimer);
    await this.manager.disconnectAll();
    this.logger.info('Gateway stopped');
  }

  // ── Routing ────────────────────────────────────────────

  /** Add a message route */
  route(route: MessageRoute): void {
    this.routes.push(route);
  }

  /** Send a message through the gateway (with rate limiting) */
  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    if (!this.checkRateLimit()) {
      throw new Error('Gateway: rate limit exceeded');
    }

    try {
      this.stats.outbound++;
      return await this.manager.send(message);
    } catch (err) {
      this.stats.errors++;
      throw err;
    }
  }

  /** Broadcast a message to all connected channels */
  async broadcast(content: string, opts?: { exclude?: ChannelPlatform[] }): Promise<number> {
    const channels = this.manager.list().filter(c =>
      c.state === 'connected' && !opts?.exclude?.includes(c.platform)
    );

    let sent = 0;
    for (const ch of channels) {
      try {
        await this.send({
          platform: ch.platform,
          to: '', // broadcast — adapter handles default target
          content,
        });
        sent++;
      } catch {
        this.stats.errors++;
      }
    }
    return sent;
  }

  // ── Health Checks ──────────────────────────────────────

  private startHealthChecks(): void {
    const check = () => {
      if (!this.config.autoReconnect) return;

      for (const ch of this.manager.list()) {
        if (ch.enabled && ch.state === 'disconnected') {
          this.logger.warn('Attempting reconnect', { platform: ch.platform });
          this.manager.connect(ch.platform).catch(err => {
            this.stats.errors++;
            this.logger.error('Reconnect failed', { platform: ch.platform, error: String(err) });
          });
        }
      }

      this.healthTimer = setTimeout(check, this.config.healthCheckIntervalMs ?? 30000);
    };

    this.healthTimer = setTimeout(check, this.config.healthCheckIntervalMs ?? 30000);
  }

  // ── Rate Limiting ──────────────────────────────────────

  private checkRateLimit(): boolean {
    const limit = this.config.globalRateLimit;
    if (!limit) return true;

    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter(t => now - t < this.rateLimitWindowMs);

    if (this.messageTimestamps.length >= limit) return false;
    this.messageTimestamps.push(now);
    return true;
  }

  // ── Message Routing ────────────────────────────────────

  private async routeMessage(msg: ChannelMessage): Promise<void> {
    // For webchat, use streaming path to emit chunks
    if (msg.platform === 'webchat') {
      return this.routeStreamingMessage(msg);
    }

    for (const route of this.routes) {
      // Platform filter
      if (route.from && route.from !== msg.platform) continue;
      // Pattern filter
      if (route.pattern && !route.pattern.test(msg.content)) continue;

      try {
        const reply = await route.handler(msg);
        if (reply) {
          await this.send({
            platform: msg.platform,
            to: msg.groupId ?? msg.from,
            content: reply,
            replyTo: msg.id,
          });
        }
      } catch (err) {
        this.stats.errors++;
        this.logger.error('Route handler error', { error: String(err) });
      }
    }
  }

  /**
   * Stream-aware message routing.
   *
   * When inferenceRouter is available → real token-level streaming via
   * InferenceRouter.chat() AsyncIterable. Each inference text chunk is
   * emitted as a channel chunk event for WS push.
   *
   * When inferenceRouter is absent → falls back to route.handler() and
   * emits a single synthetic chunk + final message.
   *
   * In both paths the HTTP loop resolves with the complete message.
   */
  private async routeStreamingMessage(msg: ChannelMessage): Promise<void> {
    const target = msg.groupId ?? msg.from;

    // ── Real inference streaming path ──
    if (this.inferenceRouter) {
      try {
        await this.routeWithInference(msg, target);
      } catch (err) {
        this.stats.errors++;
        this.logger.error('Inference streaming error', { error: String(err) });
        // Fallback: try route handlers
        await this.routeFallback(msg, target);
      }
      return;
    }

    // ── Fallback: no inference router ──
    await this.routeFallback(msg, target);
  }

  /**
   * Real inference-backed streaming.
   * Consumes InferenceRouter.chat() AsyncIterable and emits channel chunks.
   */
  private async routeWithInference(msg: ChannelMessage, target: string): Promise<void> {
    const router = this.inferenceRouter!;
    const messages: Message[] = [];

    // Add system prompt if configured
    if (this.config.defaultSystemPrompt) {
      messages.push({ role: 'system', content: this.config.defaultSystemPrompt });
    }

    messages.push({ role: 'user', content: msg.content });

    const model = this.config.defaultModel ?? 'gpt-4';
    let fullText = '';
    let chunkIndex = 0;

    for await (const chunk of router.chat(messages, { model })) {
      if (chunk.type === 'text' && chunk.text) {
        fullText += chunk.text;
        this.manager.emitChunk({
          platform: msg.platform,
          to: target,
          content: chunk.text,
          index: chunkIndex++,
          final: false,
        });
      }
      // usage/tool_call/done chunks are consumed but not forwarded as channel chunks
    }

    // Emit final chunk marker
    if (chunkIndex > 0) {
      this.manager.emitChunk({
        platform: msg.platform,
        to: target,
        content: '',
        index: chunkIndex,
        final: true,
      });
    }

    // Send complete outbound message (resolves HTTP + fires outbound event)
    if (fullText) {
      await this.send({
        platform: msg.platform,
        to: target,
        content: fullText,
        replyTo: msg.id,
      });
    }
  }

  /**
   * Fallback path: use route handlers (non-streaming).
   * Emits a single synthetic chunk then the full message.
   */
  private async routeFallback(msg: ChannelMessage, target: string): Promise<void> {
    for (const route of this.routes) {
      if (route.from && route.from !== msg.platform) continue;
      if (route.pattern && !route.pattern.test(msg.content)) continue;

      try {
        const reply = await route.handler(msg);
        if (reply) {
          // Emit single synthetic chunk (replaces old word-splitting mock)
          this.manager.emitChunk({
            platform: msg.platform,
            to: target,
            content: reply,
            index: 0,
            final: true,
          });

          // Send complete message
          await this.send({
            platform: msg.platform,
            to: target,
            content: reply,
            replyTo: msg.id,
          });
        }
      } catch (err) {
        this.stats.errors++;
        this.logger.error('Fallback route handler error', { error: String(err) });
      }
    }
  }

  // ── Adapter Factory ────────────────────────────────────

  private createAdapter(platform: ChannelPlatform): ChannelAdapter | null {
    switch (platform) {
      case 'telegram': return new TelegramAdapter();
      case 'discord':  return new DiscordAdapter();
      case 'whatsapp': return new WhatsAppAdapter();
      case 'slack':    return new SlackAdapter();
      case 'matrix':   return new MatrixAdapter();
      default: return null;
    }
  }

  // ── Query ──────────────────────────────────────────────

  getStats(): GatewayStats {
    const states: Record<string, ChannelState> = {};
    for (const ch of this.manager.list()) {
      states[ch.platform] = ch.state;
    }
    return {
      totalInbound: this.stats.inbound,
      totalOutbound: this.stats.outbound,
      channelStates: states,
      uptime: Date.now() - this.startTime,
      errors: this.stats.errors,
    };
  }

  getManager(): ChannelManager {
    return this.manager;
  }
}
