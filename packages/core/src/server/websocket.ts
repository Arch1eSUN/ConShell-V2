/**
 * WebSocket服务器 — 实时通信 (对话流 + 状态推送)
 *
 * 使用原生 ws-like 协议 (无依赖)
 * 基于 Node HTTP server upgrade
 */
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Logger } from '../types/common.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface WSClient {
  id: string;
  socket: Duplex;
  connectedAt: string;
}

export interface WSMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

// ── WebSocketServer ───────────────────────────────────────────────────

export class WebSocketServer {
  private logger: Logger;
  private clients = new Map<string, WSClient>();
  private handlers = new Map<string, (client: WSClient, data: unknown) => void>();
  private disconnectHandlers: Array<(clientId: string) => void> = [];
  private _messageCount = 0;

  constructor(logger: Logger) {
    this.logger = logger.child('ws');
  }

  /**
   * 附加到已有的 HTTP server
   * 监听 'upgrade' 事件处理 WebSocket 握手
   */
  attachToServer(server: { on: (event: string, cb: (...args: any[]) => void) => void }): void {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      this.handleUpgrade(req, socket, head);
    });
    this.logger.info('WebSocket server attached');
  }

  /** 注册消息处理器 */
  onMessage(type: string, handler: (client: WSClient, data: unknown) => void): void {
    this.handlers.set(type, handler);
  }

  /** 注册断连回调 */
  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandlers.push(handler);
  }

  /** 获取指定客户端 */
  getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId);
  }

  /** 广播消息给所有客户端 */
  broadcast(type: string, data: unknown): void {
    const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() } satisfies WSMessage);
    const frame = this.encodeFrame(msg);

    for (const entry of Array.from(this.clients.entries())) {
      const [id, client] = entry;
      try {
        client.socket.write(frame);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  /** 发送消息给特定客户端 */
  send(clientId: string, type: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() } satisfies WSMessage);
    const frame = this.encodeFrame(msg);

    try {
      client.socket.write(frame);
    } catch {
      this.clients.delete(clientId);
    }
  }

  /** 获取连接数 */
  get connectionCount(): number {
    return this.clients.size;
  }

  /** 统计 */
  stats(): { connections: number; totalMessages: number } {
    return { connections: this.clients.size, totalMessages: this._messageCount };
  }

  // ── WebSocket Protocol ────────────────────────────────────────────

  private handleUpgrade(req: IncomingMessage, socket: Duplex, _head: Buffer): void {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    // WebSocket accept handshake (RFC 6455)
    const acceptKey = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n');

    socket.write(response);

    const clientId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const client: WSClient = {
      id: clientId,
      socket,
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(clientId, client);
    this.logger.info('WebSocket connected', { clientId });

    socket.on('data', (buffer: Buffer) => {
      try {
        const decoded = this.decodeFrame(buffer);
        if (decoded === null) return; // close/ping frame
        this._messageCount++;

        const msg = JSON.parse(decoded) as WSMessage;
        const handler = this.handlers.get(msg.type);
        if (handler) handler(client, msg.data);
      } catch {
        // ignore malformed
      }
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      this.logger.debug('WebSocket disconnected', { clientId });
      for (const h of this.disconnectHandlers) { try { h(clientId); } catch {} }
    });

    socket.on('error', () => {
      this.clients.delete(clientId);
      for (const h of this.disconnectHandlers) { try { h(clientId); } catch {} }
    });
  }

  /** 简单 WebSocket frame 编码 (text, no mask, < 65536 bytes) */
  private encodeFrame(data: string): Buffer {
    const payload = Buffer.from(data, 'utf-8');
    const len = payload.length;

    let header: Buffer;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    return Buffer.concat([header, payload]);
  }

  /** 简单 WebSocket frame 解码 */
  private decodeFrame(buffer: Buffer): string | null {
    if (buffer.length < 2) return null;

    const opcode = buffer[0] & 0x0f;
    if (opcode === 0x08) return null; // close
    if (opcode === 0x09) return null; // ping

    const masked = (buffer[1] & 0x80) !== 0;
    let payloadLen = buffer[1] & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      payloadLen = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLen === 127) {
      payloadLen = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    if (masked) {
      const mask = buffer.subarray(offset, offset + 4);
      offset += 4;
      const payload = buffer.subarray(offset, offset + payloadLen);
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
      return payload.toString('utf-8');
    }

    return buffer.subarray(offset, offset + payloadLen).toString('utf-8');
  }
}
