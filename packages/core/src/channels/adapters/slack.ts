/**
 * Slack Channel Adapter
 *
 * Implements ChannelAdapter for Slack using Web API + Events API.
 * Uses Socket Mode or webhook for receiving messages.
 * Requires: BOT_TOKEN, APP_TOKEN in credentials.
 */
import type {
  ChannelAdapter, ChannelConfig, ChannelMessage,
  ChannelState, OutboundMessage, ChannelPlatform,
} from '../index.js';

const SLACK_API = 'https://slack.com/api';

export class SlackAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'slack';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private botToken = '';
  private appToken = '';
  private botUserId = '';
  private ws: any = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxRetries = 5;
  private retryCount = 0;

  async connect(config: ChannelConfig): Promise<void> {
    this.botToken = config.credentials?.['BOT_TOKEN'] ?? '';
    this.appToken = config.credentials?.['APP_TOKEN'] ?? '';
    if (!this.botToken) throw new Error('Slack: BOT_TOKEN required');

    this.maxRetries = config.maxRetries ?? 5;
    this.setState('connecting');

    try {
      // Verify token & get bot identity
      const auth = await this.apiCall('auth.test');
      if (!auth.ok) throw new Error(`Slack auth failed: ${auth.error}`);
      this.botUserId = auth.user_id;
      this.setState('connected');
      this.retryCount = 0;

      // If APP_TOKEN provided, open Socket Mode connection
      if (this.appToken) {
        await this.openSocketMode();
      }
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.setState('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    if (this.state !== 'connected') throw new Error('Slack: not connected');

    const body: Record<string, any> = {
      channel: message.to,
      text: message.content,
    };

    if (message.replyTo) {
      body.thread_ts = message.replyTo;
    }

    const res = await this.apiCall('chat.postMessage', body);
    if (!res.ok) throw new Error(`Slack send failed: ${res.error}`);

    return { messageId: res.ts ?? `slack_${Date.now()}` };
  }

  // ── Events API Webhook Handler ─────────────────────────

  /** Handle Slack Events API payload (for webhook mode) */
  handleEvent(payload: any): string | null {
    // URL verification challenge
    if (payload.type === 'url_verification') {
      return payload.challenge;
    }

    if (payload.type !== 'event_callback') return null;

    const event = payload.event;
    if (!event) return null;

    // Ignore bot's own messages
    if (event.bot_id || event.user === this.botUserId) return null;

    if (event.type === 'message' || event.type === 'app_mention') {
      const mentioned = event.type === 'app_mention' ||
        (event.text?.includes(`<@${this.botUserId}>`));

      const msg: ChannelMessage = {
        id: event.ts ?? `slack_in_${Date.now()}`,
        channelId: event.channel ?? '',
        platform: 'slack',
        from: event.user ?? '',
        content: this.cleanMentions(event.text ?? ''),
        timestamp: parseFloat(event.ts ?? '0') * 1000 || Date.now(),
        groupId: event.channel,
        replyTo: event.thread_ts,
        mentioned,
      };

      this.onMessage?.(msg);
    }

    return null;
  }

  // ── Socket Mode ────────────────────────────────────────

  private async openSocketMode(): Promise<void> {
    try {
      const res = await fetch(`${SLACK_API}/apps.connections.open`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.appToken}` },
      });
      const data = await res.json() as any;
      if (!data.ok) throw new Error(`Socket Mode open failed: ${data.error}`);

      // In a real implementation, connect to data.url via WebSocket
      // For now we mark as connected — production would use ws library
    } catch (err) {
      // Socket Mode is optional — fall back to Events API
    }
  }

  // ── Internal ───────────────────────────────────────────

  private async apiCall(method: string, body?: Record<string, any>): Promise<any> {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  private cleanMentions(text: string): string {
    return text.replace(/<@[A-Z0-9]+>/g, '').trim();
  }

  private setState(state: ChannelState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
