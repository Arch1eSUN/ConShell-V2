/**
 * Discord Channel Adapter
 *
 * Implements ChannelAdapter for the Discord Gateway (WebSocket).
 * Uses discord.js-compatible REST API for sending messages.
 * Requires BOT_TOKEN in credentials.
 */
import type { ChannelAdapter, ChannelConfig, ChannelMessage, ChannelState, OutboundMessage, ChannelPlatform } from '../index.js';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

export class DiscordAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'discord';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private token = '';
  private ws: any = null; // WebSocket instance
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval = 41250;
  private lastSequence: number | null = null;
  private sessionId: string | null = null;
  private botUserId: string | null = null;
  private maxRetries = 5;
  private retryCount = 0;

  async connect(config: ChannelConfig): Promise<void> {
    this.token = config.credentials?.['BOT_TOKEN'] ?? '';
    if (!this.token) throw new Error('Discord: BOT_TOKEN required in credentials');

    this.maxRetries = config.maxRetries ?? 5;
    this.setState('connecting');

    try {
      // Verify token via REST
      const me = await this.restCall('GET', '/users/@me');
      this.botUserId = me.id;

      // Connect to gateway
      await this.connectGateway();
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(1000, 'Graceful shutdown'); } catch { /* ignore */ }
      this.ws = null;
    }
    this.setState('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    const payload: Record<string, unknown> = {
      content: message.content,
    };

    if (message.replyTo) {
      payload['message_reference'] = { message_id: message.replyTo };
    }

    const result = await this.restCall('POST', `/channels/${message.to}/messages`, payload);
    return { messageId: result.id ?? String(Date.now()) };
  }

  // ── Gateway ──────────────────────────────────────────────────────

  private async connectGateway(): Promise<void> {
    // Dynamic import WebSocket (works in Node 18+)
    const { WebSocket } = await import('ws');
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(DISCORD_GATEWAY);

      this.ws.on('open', () => {
        // Wait for HELLO event
      });

      this.ws.on('message', (data: any) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handleGatewayEvent(payload);
          if (payload.op === 0 && payload.t === 'READY') {
            this.sessionId = payload.d?.session_id ?? null;
            this.setState('connected');
            this.retryCount = 0;
            resolve();
          }
        } catch { /* ignore parse errors */ }
      });

      this.ws.on('close', (code: number) => {
        this.stopHeartbeat();
        if (code !== 1000 && this.retryCount < this.maxRetries) {
          this.retryCount++;
          this.setState('reconnecting');
          setTimeout(() => this.connectGateway().catch(() => {}), 
            Math.min(1000 * Math.pow(2, this.retryCount), 60000));
        } else if (code !== 1000) {
          this.setState('error');
        }
      });

      this.ws.on('error', (err: Error) => {
        if (this.state === 'connecting') reject(err);
      });
    });
  }

  private handleGatewayEvent(payload: any): void {
    const { op, d, s, t } = payload;

    // Track sequence
    if (s !== null) this.lastSequence = s;

    switch (op) {
      case 10: // HELLO
        this.heartbeatInterval = d.heartbeat_interval;
        this.startHeartbeat();
        this.identify();
        break;

      case 11: // HEARTBEAT_ACK
        break;

      case 0: // DISPATCH
        this.handleDispatch(t, d);
        break;
    }
  }

  private handleDispatch(event: string, data: any): void {
    if (event !== 'MESSAGE_CREATE') return;

    // Ignore own messages
    if (data.author?.id === this.botUserId) return;

    const msg: ChannelMessage = {
      id: `discord_${data.id}`,
      channelId: `discord:${data.channel_id}`,
      platform: 'discord',
      from: data.author?.id ?? 'unknown',
      fromName: data.author?.username ?? 'Unknown',
      content: data.content ?? '',
      timestamp: new Date(data.timestamp).getTime(),
      groupId: data.guild_id,
      replyTo: data.referenced_message?.id,
      mentioned: data.mentions?.some((m: any) => m.id === this.botUserId) || 
                 data.mention_everyone === true,
    };

    this.onMessage?.(msg);
  }

  private identify(): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({
      op: 2,
      d: {
        token: this.token,
        intents: 513 | 512 | 32768, // GUILDS | GUILD_MESSAGES | MESSAGE_CONTENT
        properties: {
          os: 'linux',
          browser: 'conshell-v2',
          device: 'conshell-v2',
        },
      },
    }));
  }

  // ── Heartbeat ────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === 1) {
        this.ws.send(JSON.stringify({ op: 1, d: this.lastSequence }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── REST API ─────────────────────────────────────────────────────

  private async restCall(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        'Authorization': `Bot ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ConShell-V2 (https://web4.ai, 0.1.0)',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  private setState(state: ChannelState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
