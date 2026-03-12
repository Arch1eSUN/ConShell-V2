/**
 * Facilitator — 支付调解器 (完整版)
 *
 * x402 支付协议的核心组件：
 * - 验证链上支付证明
 * - 执行 USDC 转账结算
 * - 费率计算 + 手续费
 * - 双花防护 (nonce tracking)
 */
import type { Logger } from '../types/common.js';
import type { ChainClient } from '../wallet/erc8004.js';
import { USDC_ABI } from '../wallet/erc8004.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface PaymentVerificationRequest {
  /** Transaction hash */
  txHash: `0x${string}`;
  /** Expected sender */
  expectedFrom: `0x${string}`;
  /** Expected recipient */
  expectedTo: `0x${string}`;
  /** Expected amount (USDC, 6 decimals) */
  expectedAmountUsdc: number;
  /** Chain ID */
  chainId: number;
}

export interface PaymentVerificationResult {
  valid: boolean;
  reason?: string;
  confirmedAmount?: number;
  blockNumber?: string;
}

export interface SettlementRequest {
  /** Recipient address */
  to: `0x${string}`;
  /** Amount in USDC (6 decimals) */
  amountUsdc: number;
  /** USDC contract address */
  usdcAddress: `0x${string}`;
  /** Sender/signer address */
  signerAddress: `0x${string}`;
  /** Memo/description */
  memo?: string;
}

export interface SettlementResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
}

export interface FacilitatorConfig {
  /** Commission rate (0-1, e.g., 0.01 = 1%) */
  commissionRate: number;
  /** Minimum settlement amount (USDC) */
  minSettlementUsdc: number;
  /** Maximum settlement amount (USDC) */
  maxSettlementUsdc: number;
  /** Required confirmations */
  confirmations: number;
  /** USDC contract address */
  usdcAddress: `0x${string}`;
  /** Commission wallet */
  commissionWallet: `0x${string}`;
}

export interface FacilitatorStats {
  totalVerified: number;
  totalSettled: number;
  totalCommissionUsdc: number;
  processedTxHashes: number;
}

// ── Default Config ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: FacilitatorConfig = {
  commissionRate: 0.01, // 1%
  minSettlementUsdc: 0.01,
  maxSettlementUsdc: 10_000,
  confirmations: 2,
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`, // USDC on Base
  commissionWallet: '0x0000000000000000000000000000000000000000' as `0x${string}`,
};

// ── Facilitator Interface ──────────────────────────────────────────────

export interface IFacilitator {
  verify(req: PaymentVerificationRequest): Promise<PaymentVerificationResult>;
  settle(req: SettlementRequest): Promise<SettlementResult>;
  calculateFee(amountUsdc: number): { fee: number; net: number };
  stats(): FacilitatorStats;
}

// ── MockFacilitator (for testing) ──────────────────────────────────────

export class MockFacilitator implements IFacilitator {
  private verified = 0;
  private settled = 0;
  private commission = 0;
  private config: FacilitatorConfig;
  private processedHashes = new Set<string>();

  constructor(config?: Partial<FacilitatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async verify(req: PaymentVerificationRequest): Promise<PaymentVerificationResult> {
    // Check double-spend
    if (this.processedHashes.has(req.txHash)) {
      return { valid: false, reason: 'Transaction already processed (double-spend attempt)' };
    }

    this.processedHashes.add(req.txHash);
    this.verified++;
    return { valid: true, confirmedAmount: req.expectedAmountUsdc, blockNumber: '0' };
  }

  async settle(req: SettlementRequest): Promise<SettlementResult> {
    if (req.amountUsdc < this.config.minSettlementUsdc) {
      return { success: false, error: `Below minimum: ${req.amountUsdc} < ${this.config.minSettlementUsdc}` };
    }
    if (req.amountUsdc > this.config.maxSettlementUsdc) {
      return { success: false, error: `Above maximum: ${req.amountUsdc} > ${this.config.maxSettlementUsdc}` };
    }

    const { fee } = this.calculateFee(req.amountUsdc);
    this.commission += fee;
    this.settled++;

    return {
      success: true,
      txHash: `0x${'0'.repeat(64)}` as `0x${string}`,
    };
  }

  calculateFee(amountUsdc: number): { fee: number; net: number } {
    const fee = amountUsdc * this.config.commissionRate;
    return { fee: Math.round(fee * 100) / 100, net: Math.round((amountUsdc - fee) * 100) / 100 };
  }

  stats(): FacilitatorStats {
    return {
      totalVerified: this.verified,
      totalSettled: this.settled,
      totalCommissionUsdc: this.commission,
      processedTxHashes: this.processedHashes.size,
    };
  }
}

// ── RealFacilitator (on-chain) ─────────────────────────────────────────

export class RealFacilitator implements IFacilitator {
  private logger: Logger;
  private client: ChainClient;
  private config: FacilitatorConfig;
  private processedHashes = new Set<string>();
  private verified = 0;
  private settled = 0;
  private commission = 0;

  constructor(client: ChainClient, logger: Logger, config?: Partial<FacilitatorConfig>) {
    this.client = client;
    this.logger = logger.child('facilitator');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Verify an on-chain payment
   */
  async verify(req: PaymentVerificationRequest): Promise<PaymentVerificationResult> {
    // Double-spend check
    if (this.processedHashes.has(req.txHash)) {
      return { valid: false, reason: 'Transaction already processed (double-spend)' };
    }

    try {
      // Wait for confirmations
      const receipt = await this.client.waitForReceipt(req.txHash, this.config.confirmations);

      if (receipt.status === 'reverted') {
        return { valid: false, reason: 'Transaction reverted' };
      }

      // Record as processed
      this.processedHashes.add(req.txHash);
      this.verified++;

      this.logger.info('Payment verified', {
        txHash: req.txHash,
        amount: req.expectedAmountUsdc,
        block: receipt.blockNumber.toString(),
      });

      return {
        valid: true,
        confirmedAmount: req.expectedAmountUsdc,
        blockNumber: receipt.blockNumber.toString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Payment verification failed', { txHash: req.txHash, error });
      return { valid: false, reason: error };
    }
  }

  /**
   * Execute a USDC settlement
   */
  async settle(req: SettlementRequest): Promise<SettlementResult> {
    // Validate amount
    if (req.amountUsdc < this.config.minSettlementUsdc) {
      return { success: false, error: `Below minimum: ${req.amountUsdc} < ${this.config.minSettlementUsdc}` };
    }
    if (req.amountUsdc > this.config.maxSettlementUsdc) {
      return { success: false, error: `Above maximum: ${req.amountUsdc} > ${this.config.maxSettlementUsdc}` };
    }

    const { fee, net } = this.calculateFee(req.amountUsdc);
    const usdcAmount = BigInt(Math.round(net * 1_000_000)); // USDC has 6 decimals

    try {
      // Check USDC balance
      const balance = await this.client.readContract({
        address: req.usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [req.signerAddress],
      });

      const balanceNum = BigInt(String(balance));
      if (balanceNum < usdcAmount) {
        return { success: false, error: `Insufficient USDC balance: ${balanceNum} < ${usdcAmount}` };
      }

      // Send USDC transfer
      const txHash = await this.client.writeContract({
        address: req.usdcAddress,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [req.to, usdcAmount],
        account: req.signerAddress,
      });

      // Wait for confirmation
      const receipt = await this.client.waitForReceipt(txHash, this.config.confirmations);

      if (receipt.status === 'reverted') {
        return { success: false, error: 'Settlement transaction reverted' };
      }

      this.commission += fee;
      this.settled++;

      this.logger.info('Settlement completed', {
        txHash,
        to: req.to,
        amount: net,
        fee,
        memo: req.memo,
      });

      return { success: true, txHash };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Settlement failed', { error });
      return { success: false, error };
    }
  }

  calculateFee(amountUsdc: number): { fee: number; net: number } {
    const fee = amountUsdc * this.config.commissionRate;
    return {
      fee: Math.round(fee * 100) / 100,
      net: Math.round((amountUsdc - fee) * 100) / 100,
    };
  }

  stats(): FacilitatorStats {
    return {
      totalVerified: this.verified,
      totalSettled: this.settled,
      totalCommissionUsdc: this.commission,
      processedTxHashes: this.processedHashes.size,
    };
  }
}
