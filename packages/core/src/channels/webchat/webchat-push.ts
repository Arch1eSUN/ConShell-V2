/**
 * WebChat Push Bridge — ChannelManager outbound → WebSocket push
 *
 * 职责：
 *   1. 维护 sessionId → Set<clientId> 映射
 *   2. 处理 subscribe/unsubscribe/ping 消息
 *   3. 监听 ChannelManager 的 message:outbound 事件
 *   4. 按 sessionId 推送到对应 WebSocket 连接
 *
 * 不做：
 *   - 不做 auth
 *   - 不做 persistent session
 *   - 不复制 transport 逻辑
 */
import type { WebSocketServer } from '../../server/websocket.js';
import type { ChannelManager, OutboundMessage, StreamChunk, StatusEvent, StreamErrorEvent } from '../index.js';

// ── Types ─────────────────────────────────────────────────

export interface PushBridgeOptions {
  /** Enable status (processing) push before message */
  enableStatusPush?: boolean;
}

// ── Push Bridge ───────────────────────────────────────────

export class WebChatPushBridge {
  private wsServer: WebSocketServer;
  private channelManager: ChannelManager;
  private opts: Required<PushBridgeOptions>;

  /** sessionId → Set of clientIds */
  private sessions = new Map<string, Set<string>>();
  /** clientId → sessionId (reverse index for disconnect cleanup) */
  private clientToSession = new Map<string, string>();
  /** outbound event handler reference (for cleanup) */
  private outboundHandler: ((msg: OutboundMessage) => void) | null = null;
  /** chunk event handler reference (for cleanup) */
  private chunkHandler: ((chunk: StreamChunk) => void) | null = null;
  /** status event handler reference (for cleanup) */
  private statusHandler: ((evt: StatusEvent) => void) | null = null;
  /** error event handler reference (for cleanup) */
  private errorHandler: ((evt: StreamErrorEvent) => void) | null = null;

  private started = false;

  constructor(
    wsServer: WebSocketServer,
    channelManager: ChannelManager,
    opts?: PushBridgeOptions,
  ) {
    this.wsServer = wsServer;
    this.channelManager = channelManager;
    this.opts = {
      enableStatusPush: opts?.enableStatusPush ?? true,
    };
  }

  // ── Lifecycle ────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;

    // Handle subscribe messages
    this.wsServer.onMessage('subscribe', (client, data) => {
      const sessionId = (data as any)?.sessionId;
      if (!sessionId || typeof sessionId !== 'string') {
        this.wsServer.send(client.id, 'error', { error: 'sessionId required' });
        return;
      }

      // Register session → client binding
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, new Set());
      }
      this.sessions.get(sessionId)!.add(client.id);
      this.clientToSession.set(client.id, sessionId);

      this.wsServer.send(client.id, 'subscribed', { sessionId });
    });

    // Handle unsubscribe
    this.wsServer.onMessage('unsubscribe', (client, data) => {
      const sessionId = (data as any)?.sessionId;
      if (sessionId) {
        this.removeClient(client.id, sessionId);
      }
      this.wsServer.send(client.id, 'unsubscribed', { sessionId });
    });

    // Handle ping
    this.wsServer.onMessage('ping', (client) => {
      this.wsServer.send(client.id, 'pong', null);
    });

    // Disconnect cleanup
    this.wsServer.onDisconnect((clientId) => {
      const sessionId = this.clientToSession.get(clientId);
      if (sessionId) {
        this.removeClient(clientId, sessionId);
      }
    });

    // Bridge outbound messages to WebSocket push
    this.outboundHandler = (msg: OutboundMessage) => {
      if (msg.platform !== 'webchat') return;

      const sessionId = msg.to;
      if (!sessionId) return;

      this.pushToSession(sessionId, {
        type: 'message',
        data: {
          sessionId,
          platform: 'webchat',
          content: msg.content,
          replyTo: msg.replyTo,
        },
      });
    };

    this.channelManager.on('message:outbound', this.outboundHandler);

    // Bridge chunk events to WebSocket push
    this.chunkHandler = (chunk: StreamChunk) => {
      if (chunk.platform !== 'webchat') return;
      if (!chunk.to) return;

      this.pushToSession(chunk.to, {
        type: 'chunk',
        data: {
          sessionId: chunk.to,
          content: chunk.content,
          index: chunk.index,
          final: chunk.final,
        },
      });
    };

    this.channelManager.on('message:chunk', this.chunkHandler);

    // Bridge status events to WebSocket push
    this.statusHandler = (evt: StatusEvent) => {
      if (evt.platform !== 'webchat') return;
      if (!evt.to) return;

      this.pushToSession(evt.to, {
        type: 'status',
        data: {
          sessionId: evt.to,
          status: evt.status,
        },
      });
    };

    this.channelManager.on('message:status', this.statusHandler);

    // Bridge error events to WebSocket push
    this.errorHandler = (evt: StreamErrorEvent) => {
      if (evt.platform !== 'webchat') return;
      if (!evt.to) return;

      this.pushToSession(evt.to, {
        type: 'error',
        data: {
          sessionId: evt.to,
          code: evt.code,
          message: evt.message,
          retryable: evt.retryable,
        },
      });
    };

    this.channelManager.on('message:error', this.errorHandler);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.outboundHandler) {
      this.channelManager.off('message:outbound', this.outboundHandler);
      this.outboundHandler = null;
    }
    if (this.chunkHandler) {
      this.channelManager.off('message:chunk', this.chunkHandler);
      this.chunkHandler = null;
    }
    if (this.statusHandler) {
      this.channelManager.off('message:status', this.statusHandler);
      this.statusHandler = null;
    }
    if (this.errorHandler) {
      this.channelManager.off('message:error', this.errorHandler);
      this.errorHandler = null;
    }

    this.sessions.clear();
    this.clientToSession.clear();
  }

  // ── Status Push ──────────────────────────────────────────

  /**
   * Push a status event to a session (e.g., "processing").
   * Called externally by Gateway/runtime when processing begins.
   */
  pushStatus(sessionId: string, status: string): void {
    if (!this.opts.enableStatusPush) return;

    this.pushToSession(sessionId, {
      type: 'status',
      data: { sessionId, status },
    });
  }

  // ── Internal ─────────────────────────────────────────────

  private pushToSession(sessionId: string, payload: { type: string; data: unknown }): void {
    const clients = this.sessions.get(sessionId);
    if (!clients || clients.size === 0) return;

    for (const clientId of clients) {
      this.wsServer.send(clientId, payload.type, payload.data);
    }
  }

  private removeClient(clientId: string, sessionId: string): void {
    const clients = this.sessions.get(sessionId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
    this.clientToSession.delete(clientId);
  }

  // ── Query ────────────────────────────────────────────────

  /** Get active session count */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /** Get all client IDs for a session */
  getSessionClients(sessionId: string): string[] {
    const clients = this.sessions.get(sessionId);
    return clients ? Array.from(clients) : [];
  }
}
