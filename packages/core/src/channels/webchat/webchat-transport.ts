/**
 * WebChat Transport — HTTP request/response 闭环
 *
 * 🐢 ConShellV2 第一条真实 Channel 闭环的 transport 层
 *
 * 职责：
 *   1. 接受 HTTP 请求 { sessionId, message }
 *   2. 通过 WebChatAdapter.injectMessage() 注入到 channel 系统
 *   3. 等待 Gateway 路由处理产生的 outbound 消息
 *   4. 返回 HTTP JSON 响应 { reply, sessionId, platform }
 *
 * 设计约束：
 *   - 不修改 Gateway / ChannelManager 签名
 *   - 使用 Promise + outbound 事件监听模式
 *   - 全部通过 public API 类型
 */

import type {
  ChannelMessage,
  OutboundMessage,
  ChannelPlatform,
} from '../index.js';
import type { ChannelManager } from '../index.js';
import { WebChatAdapter } from '../index.js';

// ── Types ────────────────────────────────────────────────

export interface WebChatRequest {
  sessionId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface WebChatResponse {
  reply: string;
  sessionId: string;
  platform: ChannelPlatform;
  messageId: string;
  timestamp: number;
}

export interface WebChatTransportOptions {
  /** Timeout in ms for waiting on a response (default: 30000) */
  timeoutMs?: number;
}

// ── Validation ───────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { sessionId, message } = body as Record<string, unknown>;

  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, error: 'Missing or invalid "sessionId" field (must be non-empty string)' };
  }

  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Missing or invalid "message" field (must be non-empty string)' };
  }

  if (sessionId.length > 128) {
    return { valid: false, error: 'sessionId exceeds maximum length (128 chars)' };
  }

  if (message.length > 32768) {
    return { valid: false, error: 'message exceeds maximum length (32768 chars)' };
  }

  return { valid: true };
}

// ── Transport ────────────────────────────────────────────

/**
 * WebChatTransport connects HTTP requests to the channel pipeline.
 *
 * Usage:
 * ```ts
 * const transport = new WebChatTransport(channelManager);
 * const response = await transport.handleMessage({ sessionId: 'abc', message: 'hello' });
 * ```
 */
export class WebChatTransport {
  private manager: ChannelManager;
  private timeoutMs: number;

  constructor(manager: ChannelManager, opts?: WebChatTransportOptions) {
    this.manager = manager;
    this.timeoutMs = opts?.timeoutMs ?? 30000;
  }

  /**
   * Process an inbound webchat message through the full channel pipeline.
   *
   * Flow:
   *   1. Validate request
   *   2. Set up outbound listener (Promise)
   *   3. Inject message via WebChatAdapter
   *   4. Wait for Gateway to produce outbound response
   *   5. Return structured response
   */
  async handleMessage(request: WebChatRequest): Promise<WebChatResponse> {
    // ── 1. Validate ──
    const validation = validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.error}`);
    }

    // ── 2. Get webchat adapter ──
    const adapter = this.manager.getWebChat();
    if (!adapter) {
      throw new Error('WebChat adapter not available');
    }
    if (adapter.state !== 'connected') {
      throw new Error('WebChat adapter not connected');
    }

    // ── 3. Set up response listener ──
    // We'll listen for outbound messages that are replies to our injected message.
    // The Gateway's routeMessage() will send() the reply, which fires 'message:outbound'.
    const responsePromise = this.waitForOutbound(request.sessionId);

    // ── 4. Inject message ──
    adapter.injectMessage(request.sessionId, request.message, {
      groupId: request.metadata?.groupId as string | undefined,
    });

    // ── 5. Wait for response ──
    try {
      return await responsePromise;
    } catch (err) {
      if (err instanceof Error && err.message.includes('timeout')) {
        throw new Error(`WebChat response timeout after ${this.timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Wait for an outbound message targeting the given sessionId.
   * Uses the ChannelManager's event system.
   */
  private waitForOutbound(sessionId: string): Promise<WebChatResponse> {
    return new Promise<WebChatResponse>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.manager.off('message:outbound', handler);
          reject(new Error(`WebChat response timeout`));
        }
      }, this.timeoutMs);

      const handler = (msg: OutboundMessage) => {
        // Match: platform is webchat AND recipient matches sessionId
        if (msg.platform === 'webchat' && msg.to === sessionId) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this.manager.off('message:outbound', handler);
            resolve({
              reply: msg.content,
              sessionId,
              platform: 'webchat',
              messageId: `web_out_${Date.now()}`,
              timestamp: Date.now(),
            });
          }
        }
      };

      this.manager.on('message:outbound', handler);
    });
  }

  /**
   * Get transport configuration info.
   */
  getInfo(): { platform: ChannelPlatform; timeoutMs: number; adapterState: string } {
    const adapter = this.manager.getWebChat();
    return {
      platform: 'webchat',
      timeoutMs: this.timeoutMs,
      adapterState: adapter?.state ?? 'unavailable',
    };
  }
}
