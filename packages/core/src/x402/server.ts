/**
 * x402 支付协议 — 服务端 (HTTP 402 Payment Required) — 增强版
 *
 * 流程:
 * 1. 客户端请求受保护资源
 * 2. 服务端返回 402 + PaymentRequired header
 * 3. 客户端发送支付证明
 * 4. 服务端验证支付 → 返回资源
 *
 * 增强:
 * - 使用 facilitator/index.ts 的 IFacilitator 接口
 * - 请求预算检查
 * - 中间件模式 (Express-compatible)
 * - 支付历史跟踪
 */
import type { Logger } from '../types/common.js';
import { Cents, addCents, ZERO_CENTS } from '../types/common.js';
import type { IFacilitator } from '../facilitator/index.js';
import type { SpendTracker } from '../spend/index.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface PaymentRequirement {
  /** 所需金额 (cents) */
  amount: Cents;
  /** 接收地址 */
  payTo: `0x${string}`;
  /** 支持的链 */
  chain: string;
  /** 支付Token */
  token: string;
  /** 有效期 (秒) */
  expiresInSec: number;
  /** 资源描述 */
  resource?: string;
  /** Payment requirement ID */
  id: string;
  /** Creation timestamp */
  createdAt: string;
}

export interface PaymentProof {
  /** 交易Hash */
  txHash: `0x${string}`;
  /** 链 */
  chain: string;
  /** 发送方 */
  from: `0x${string}`;
  /** 金额 */
  amount: Cents;
}

export interface PaymentVerification {
  valid: boolean;
  reason?: string;
  txHash?: `0x${string}`;
}

export interface PaymentRecord {
  proof: PaymentProof;
  verification: PaymentVerification;
  resource?: string;
  timestamp: string;
}

export interface X402ServerOptions {
  /** 默认接收地址 */
  payTo: `0x${string}`;
  /** 默认链 */
  chain?: string;
  /** 默认Token */
  token?: string;
  /** 支付有效期 (秒) */
  paymentTtlSec?: number;
  /** Facilitator instance */
  facilitator?: IFacilitator;
}

// ── Middleware types ──────────────────────────────────────────────────

export interface X402Request {
  headers: Record<string, string | undefined>;
  path: string;
}

export interface X402Response {
  status: (code: number) => X402Response;
  set: (headers: Record<string, string>) => X402Response;
  json: (body: unknown) => void;
}

export type X402Middleware = (req: X402Request, res: X402Response, next: () => void) => Promise<void>;

// ── X402Server ────────────────────────────────────────────────────────

export class X402Server {
  private logger: Logger;
  private opts: Required<X402ServerOptions>;
  private _totalReceived: Cents = ZERO_CENTS;
  private _paymentCount = 0;
  private pendingPayments = new Map<string, PaymentRequirement>();
  private paymentHistory: PaymentRecord[] = [];
  private processedTxHashes = new Set<string>();
  private facilitator: IFacilitator | null;
  private _spendTracker: SpendTracker | null = null;

  constructor(logger: Logger, opts: X402ServerOptions) {
    this.logger = logger.child('x402');
    this.facilitator = opts.facilitator ?? null;
    this.opts = {
      payTo: opts.payTo,
      chain: opts.chain ?? 'base',
      token: opts.token ?? 'USDC',
      paymentTtlSec: opts.paymentTtlSec ?? 300,
      facilitator: opts.facilitator as IFacilitator,
    };
  }

  /**
   * Wire SpendTracker for automatic income recording on verified payments.
   * Round 15.7B: Revenue bridge — closes the X402 → SpendTracker loop.
   */
  setSpendTracker(tracker: SpendTracker): void {
    this._spendTracker = tracker;
  }

  /**
   * 创建支付要求 (附在 402 response header)
   */
  createPaymentRequirement(amount: Cents, resource?: string): PaymentRequirement {
    const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const req: PaymentRequirement = {
      amount,
      payTo: this.opts.payTo,
      chain: this.opts.chain,
      token: this.opts.token,
      expiresInSec: this.opts.paymentTtlSec,
      resource,
      id,
      createdAt: new Date().toISOString(),
    };

    this.pendingPayments.set(id, req);
    this.logger.info('Payment requirement created', { id, amount, resource });

    // Cleanup expired requirements
    this.cleanupExpired();

    return req;
  }

  /**
   * 序列化支付要求为 HTTP header
   */
  serializeRequirement(req: PaymentRequirement): Record<string, string> {
    return {
      'X-Payment-Required': 'true',
      'X-Payment-Id': req.id,
      'X-Payment-Amount': String(req.amount),
      'X-Payment-PayTo': req.payTo,
      'X-Payment-Chain': req.chain,
      'X-Payment-Token': req.token,
      'X-Payment-Expires': String(req.expiresInSec),
    };
  }

  /**
   * 从请求头解析支付证明
   */
  parsePaymentProof(headers: Record<string, string | undefined>): PaymentProof | null {
    const txHash = headers['x-payment-txhash'] ?? headers['X-Payment-TxHash'];
    const chain = headers['x-payment-chain'] ?? headers['X-Payment-Chain'];
    const from = headers['x-payment-from'] ?? headers['X-Payment-From'];
    const amount = headers['x-payment-amount'] ?? headers['X-Payment-Amount'];

    if (!txHash || !chain || !from || !amount) return null;

    return {
      txHash: txHash as `0x${string}`,
      chain,
      from: from as `0x${string}`,
      amount: Cents(Number(amount)),
    };
  }

  /**
   * 验证支付证明 — 使用 IFacilitator
   */
  async verifyPayment(proof: PaymentProof): Promise<PaymentVerification> {
    this.logger.info('Verifying payment', { txHash: proof.txHash, amount: proof.amount });

    // Double-spend check
    if (this.processedTxHashes.has(proof.txHash)) {
      return { valid: false, reason: 'Transaction already processed' };
    }

    let result: PaymentVerification;

    if (this.facilitator) {
      const fResult = await this.facilitator.verify({
        txHash: proof.txHash,
        expectedFrom: proof.from,
        expectedTo: this.opts.payTo,
        expectedAmountUsdc: Number(proof.amount) / 100, // cents → USD
        chainId: proof.chain === 'base' ? 8453 : 84532,
      });
      result = {
        valid: fResult.valid,
        reason: fResult.reason,
        txHash: proof.txHash,
      };
    } else {
      // No facilitator — dev mode, auto-approve
      result = { valid: true, txHash: proof.txHash };
    }

    if (result.valid) {
      this._totalReceived = addCents(this._totalReceived, proof.amount);
      this._paymentCount++;
      this.processedTxHashes.add(proof.txHash);
      this.logger.info('Payment verified', { txHash: proof.txHash });

      // Round 15.7B: Record income in SpendTracker (revenue bridge)
      if (this._spendTracker) {
        this._spendTracker.recordIncome('x402', Number(proof.amount), proof.txHash);
        this.logger.debug('Revenue recorded in SpendTracker', { amount: proof.amount, txHash: proof.txHash });
      }
    } else {
      this.logger.warn('Payment verification failed', { txHash: proof.txHash, reason: result.reason });
    }

    // Record
    this.paymentHistory.push({
      proof,
      verification: result,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Create Express/Hono-compatible middleware
   */
  createMiddleware(pricePerRequest: Cents): X402Middleware {
    return async (req: X402Request, res: X402Response, next: () => void) => {
      // Check for payment proof in headers
      const proof = this.parsePaymentProof(req.headers as Record<string, string | undefined>);

      if (!proof) {
        // No payment — return 402
        const requirement = this.createPaymentRequirement(pricePerRequest, req.path);
        const headers = this.serializeRequirement(requirement);
        res.status(402).set(headers).json({
          error: 'Payment Required',
          requirement: {
            amount: pricePerRequest,
            payTo: this.opts.payTo,
            chain: this.opts.chain,
            token: this.opts.token,
          },
        });
        return;
      }

      // Verify payment
      const verification = await this.verifyPayment(proof);
      if (!verification.valid) {
        res.status(402).json({
          error: 'Payment Invalid',
          reason: verification.reason,
        });
        return;
      }

      // Payment valid — proceed
      next();
    };
  }

  /** 统计 */
  stats(): {
    totalReceived: Cents;
    paymentCount: number;
    pendingCount: number;
    historyCount: number;
    processedTxCount: number;
  } {
    return {
      totalReceived: this._totalReceived,
      paymentCount: this._paymentCount,
      pendingCount: this.pendingPayments.size,
      historyCount: this.paymentHistory.length,
      processedTxCount: this.processedTxHashes.size,
    };
  }

  /** Get payment history */
  getHistory(limit = 20): PaymentRecord[] {
    return this.paymentHistory.slice(-limit);
  }

  /** Cleanup expired pending payments */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, req] of this.pendingPayments) {
      const created = new Date(req.createdAt).getTime();
      if (now - created > req.expiresInSec * 1000) {
        this.pendingPayments.delete(id);
      }
    }
  }
}
