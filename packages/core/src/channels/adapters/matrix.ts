/**
 * Matrix Channel Adapter
 *
 * Implements ChannelAdapter for Matrix protocol (Element, etc).
 * Uses Matrix Client-Server API (v1.6+).
 * Requires: HOMESERVER, ACCESS_TOKEN in credentials.
 */
import type {
  ChannelAdapter, ChannelConfig, ChannelMessage,
  ChannelState, OutboundMessage, ChannelPlatform,
} from '../index.js';

export class MatrixAdapter implements ChannelAdapter {
  readonly platform: ChannelPlatform = 'matrix';
  state: ChannelState = 'disconnected';
  onMessage?: (message: ChannelMessage) => void;
  onStateChange?: (state: ChannelState) => void;

  private homeserver = '';
  private accessToken = '';
  private userId = '';
  private syncBatch = '';
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private syncIntervalMs = 5000;
  private running = false;

  async connect(config: ChannelConfig): Promise<void> {
    this.homeserver = (config.credentials?.['HOMESERVER'] ?? '').replace(/\/$/, '');
    this.accessToken = config.credentials?.['ACCESS_TOKEN'] ?? '';

    if (!this.homeserver) throw new Error('Matrix: HOMESERVER required');
    if (!this.accessToken) throw new Error('Matrix: ACCESS_TOKEN required');

    this.syncIntervalMs = config.retryDelayMs ?? 5000;
    this.setState('connecting');

    try {
      // Get user identity (whoami)
      const whoami = await this.api('GET', '/_matrix/client/v3/account/whoami');
      this.userId = whoami.user_id;
      if (!this.userId) throw new Error('Matrix: whoami failed');

      this.setState('connected');
      this.running = true;
      this.startSync();
    } catch (err) {
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.running = false;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.setState('disconnected');
  }

  async send(message: OutboundMessage): Promise<{ messageId: string }> {
    if (this.state !== 'connected') throw new Error('Matrix: not connected');

    const txnId = `m${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const roomId = encodeURIComponent(message.to);

    const body: Record<string, any> = {
      msgtype: 'm.text',
      body: message.content,
    };

    // Handle reply
    if (message.replyTo) {
      body['m.relates_to'] = {
        'm.in_reply_to': { event_id: message.replyTo },
      };
    }

    // Handle attachments
    if (message.attachments?.length) {
      const att = message.attachments[0];
      if (att.url) {
        const typeMap: Record<string, string> = {
          image: 'm.image', audio: 'm.audio', video: 'm.video', file: 'm.file',
        };
        body.msgtype = typeMap[att.type] ?? 'm.file';
        body.url = att.url;
        body.info = { mimetype: att.mimeType, size: att.size };
        if (att.filename) body.filename = att.filename;
      }
    }

    const res = await this.api(
      'PUT',
      `/_matrix/client/v3/rooms/${roomId}/send/m.room.message/${txnId}`,
      body,
    );

    return { messageId: res.event_id ?? `matrix_${Date.now()}` };
  }

  // ── Long-poll Sync ─────────────────────────────────────

  private startSync(): void {
    if (!this.running) return;

    const doSync = async () => {
      if (!this.running) return;
      try {
        const params = new URLSearchParams({
          timeout: '30000',
          ...(this.syncBatch ? { since: this.syncBatch } : {}),
          filter: JSON.stringify({
            room: {
              timeline: { limit: 20 },
              state: { lazy_load_members: true },
            },
          }),
        });

        const data = await this.api('GET', `/_matrix/client/v3/sync?${params}`);
        this.syncBatch = data.next_batch ?? this.syncBatch;

        // Process room events
        const rooms = data.rooms?.join ?? {};
        for (const [roomId, room] of Object.entries(rooms) as any[]) {
          const events = room.timeline?.events ?? [];
          for (const event of events) {
            if (event.type !== 'm.room.message') continue;
            if (event.sender === this.userId) continue; // Ignore own msgs

            const content = event.content ?? {};
            const mentioned = (content.body ?? '').includes(this.userId) ||
              content['m.mentions']?.user_ids?.includes(this.userId);

            const msg: ChannelMessage = {
              id: event.event_id ?? `matrix_in_${Date.now()}`,
              channelId: roomId,
              platform: 'matrix',
              from: event.sender ?? '',
              content: content.body ?? '',
              timestamp: event.origin_server_ts ?? Date.now(),
              groupId: roomId,
              mentioned,
            };

            this.onMessage?.(msg);
          }
        }
      } catch {
        // Sync error — will retry
      }

      if (this.running) {
        this.syncTimer = setTimeout(doSync, this.syncIntervalMs);
      }
    };

    doSync();
  }

  // ── Internal API ───────────────────────────────────────

  private async api(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.homeserver}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Matrix API ${method} ${path}: ${res.status} ${err}`);
    }
    return res.json();
  }

  private setState(state: ChannelState): void {
    this.state = state;
    this.onStateChange?.(state);
  }
}
