/**
 * WhatsApp Channel Adapter
 *
 * Implements ChannelAdapter for WhatsApp Cloud API (Meta Business Platform).
 * Uses webhook for receiving messages and REST API for sending.
 * Requires: ACCESS_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN in credentials.
 */
import type {
  ChannelAdapter, ChannelConfig, ChannelMessage,
  ChannelState, OutboundMessage, ChannelPlatform,
} from '../index.js';

const WA_API_BASE = 'https://graph.facebook.com/v19.0';

export class WhatsAppAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'whatsapp';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private accessToken = '';
  private phoneNumberId = '';
  private verifyToken = '';

  async connect(config: ChannelConfig): Promise<void> {
    this.accessToken = config.credentials?.['ACCESS_TOKEN'] ?? '';
    this.phoneNumberId = config.credentials?.['PHONE_NUMBER_ID'] ?? '';
    this.verifyToken = config.credentials?.['VERIFY_TOKEN'] ?? 'conshell-verify';

    if (!this.accessToken) throw new Error('WhatsApp: ACCESS_TOKEN required');
    if (!this.phoneNumberId) throw new Error('WhatsApp: PHONE_NUMBER_ID required');

    this.setState('connecting');

    try {
      // Verify token by fetching phone number info
      const url = `${WA_API_BASE}/${this.phoneNumberId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!res.ok) throw new Error(`WhatsApp API verify failed: ${res.status}`);
      this.setState('connected');
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.setState('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    if (this.state !== 'connected') throw new Error('WhatsApp: not connected');

    const url = `${WA_API_BASE}/${this.phoneNumberId}/messages`;
    const body: Record<string, any> = {
      messaging_product: 'whatsapp',
      to: message.to,
      type: 'text',
      text: { body: message.content },
    };

    // Handle media attachments
    if (message.attachments?.length) {
      const att = message.attachments[0];
      if (att.type === 'image' && att.url) {
        body.type = 'image';
        body.image = { link: att.url, caption: message.content };
        delete body.text;
      } else if (att.type === 'file' && att.url) {
        body.type = 'document';
        body.document = { link: att.url, caption: message.content, filename: att.filename };
        delete body.text;
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`WhatsApp send failed: ${res.status} ${errText}`);
    }

    const data = await res.json() as any;
    return { messageId: data.messages?.[0]?.id ?? `wa_${Date.now()}` };
  }

  // ── Webhook Handlers ───────────────────────────────────

  /** Verify webhook endpoint (GET request from Meta) */
  handleWebhookVerify(query: Record<string, string>): string | null {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }

  /** Process incoming webhook payload (POST from Meta) */
  handleWebhookPayload(payload: any): void {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) return;

    for (const msg of value.messages) {
      const message: ChannelMessage = {
        id: msg.id ?? `wa_in_${Date.now()}`,
        channelId: this.phoneNumberId,
        platform: 'whatsapp',
        from: msg.from ?? '',
        fromName: value.contacts?.[0]?.profile?.name,
        content: msg.text?.body ?? msg.caption ?? '',
        timestamp: parseInt(msg.timestamp ?? '0') * 1000 || Date.now(),
        mentioned: true,
      };

      // Handle media messages
      if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video') {
        message.attachments = [{
          type: msg.type === 'document' ? 'file' : msg.type,
          mimeType: msg[msg.type]?.mime_type ?? 'application/octet-stream',
          filename: msg[msg.type]?.filename,
        }];
      }

      this.onMessage?.(message);
    }
  }

  // ── Internal ───────────────────────────────────────────

  private setState(state: ChannelState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
