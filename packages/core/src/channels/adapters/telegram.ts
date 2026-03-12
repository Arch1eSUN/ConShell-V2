/**
 * Telegram Channel Adapter
 *
 * Implements ChannelAdapter for Telegram Bot API.
 * Uses long-polling (getUpdates) for receiving messages.
 * Requires BOT_TOKEN in credentials.
 */
import type { ChannelAdapter, ChannelConfig, ChannelMessage, ChannelState, OutboundMessage, ChannelPlatform } from '../index.js';

export class TelegramAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'telegram';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private token = '';
  private baseUrl = '';
  private pollOffset = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private pollIntervalMs = 3000;
  private maxRetries = 5;
  private retryCount = 0;

  async connect(config: ChannelConfig): Promise<void> {
    this.token = config.credentials?.['BOT_TOKEN'] ?? '';
    if (!this.token) throw new Error('Telegram: BOT_TOKEN required in credentials');

    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
    this.maxRetries = config.maxRetries ?? 5;
    this.pollIntervalMs = config.retryDelayMs ?? 3000;

    this.setState('connecting');

    // Verify token
    try {
      const me = await this.apiCall('getMe');
      if (!me?.result?.id) throw new Error('Invalid bot token');
      this.setState('connected');
      this.retryCount = 0;
      this.startPolling();
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.setState('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    const payload: Record<string, unknown> = {
      chat_id: message.to,
      text: message.content,
    };

    if (message.replyTo) {
      payload['reply_to_message_id'] = parseInt(message.replyTo, 10);
    }

    const result = await this.apiCall('sendMessage', payload);
    return { messageId: String(result?.result?.message_id ?? Date.now()) };
  }

  // ── Polling ──────────────────────────────────────────────────────

  private startPolling(): void {
    this.pollTimer = setTimeout(() => this.poll(), this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.state !== 'connected') return;

    try {
      const data = await this.apiCall('getUpdates', {
        offset: this.pollOffset,
        timeout: 30,
        limit: 100,
      });

      this.retryCount = 0;
      const updates = data?.result ?? [];

      for (const update of updates) {
        this.pollOffset = Math.max(this.pollOffset, (update.update_id ?? 0) + 1);

        const tgMsg = update.message ?? update.edited_message;
        if (!tgMsg?.text) continue;

        const msg: ChannelMessage = {
          id: `tg_${tgMsg.message_id}`,
          channelId: `telegram:${tgMsg.chat.id}`,
          platform: 'telegram',
          from: String(tgMsg.from?.id ?? 'unknown'),
          fromName: [tgMsg.from?.first_name, tgMsg.from?.last_name].filter(Boolean).join(' '),
          content: tgMsg.text,
          timestamp: (tgMsg.date ?? Math.floor(Date.now() / 1000)) * 1000,
          groupId: tgMsg.chat.type !== 'private' ? String(tgMsg.chat.id) : undefined,
          groupName: tgMsg.chat.title,
          replyTo: tgMsg.reply_to_message ? String(tgMsg.reply_to_message.message_id) : undefined,
        };

        this.onMessage?.(msg);
      }
    } catch (err) {
      this.retryCount++;
      if (this.retryCount >= this.maxRetries) {
        this.setState('error');
        return;
      }
      this.setState('reconnecting');
    }

    // Schedule next poll (state may have changed in catch block via setState)
    const st = this.state as string;
    if (st === 'connected' || st === 'reconnecting') {
      const delay = st === 'reconnecting'
        ? Math.min(this.pollIntervalMs * Math.pow(2, this.retryCount), 60000)
        : this.pollIntervalMs;
      this.pollTimer = setTimeout(() => this.poll(), delay);
      if (st === 'reconnecting') this.setState('connected');
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async apiCall(method: string, params?: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Telegram API ${res.status}: ${text.slice(0, 200)}`);
    }

    return res.json();
  }

  private setState(state: ChannelState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
