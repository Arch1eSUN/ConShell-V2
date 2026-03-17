/**
 * Round 15.7 / 16.9 — Revenue Surfaces & Payment Proof Contracts
 *
 * Defines three concrete revenue surfaces (x402 payments, API access,
 * task services) and the payment proof contract that binds revenue
 * to the economic ledger. Each surface can dynamically adjust pricing
 * based on survival tier.
 *
 * Round 16.9: Added RevenueSettlementStatus, RevenueReceipt, and
 * onRevenueRecorded callback for RevenueService bridge.
 */
import type { SurvivalTier } from '../automaton/index.js';

// ── Revenue Surface Types ────────────────────────────────────────────

export type RevenueSurfaceType = 'x402_payment' | 'api_access' | 'task_service';

export type PaymentProofStatus = 'pending' | 'verified' | 'rejected' | 'refunded';

// ── Revenue Settlement (Round 16.9) ──────────────────────────────────

export type RevenueSettlementStatus = 'pending' | 'settled' | 'failed' | 'disputed' | 'refunded';

export interface RevenueReceipt {
  /** Unique receipt ID */
  readonly id: string;
  /** Which revenue surface generated this receipt */
  readonly surfaceId: string;
  /** Surface type */
  readonly surfaceType: RevenueSurfaceType;
  /** Amount in cents */
  readonly amountCents: number;
  /** Settlement status */
  settlementStatus: RevenueSettlementStatus;
  /** Reference to the PaymentProofContract */
  readonly proofId: string;
  /** ISO timestamp of settlement */
  readonly settledAt?: string;
  /** ISO timestamp of creation */
  readonly createdAt: string;
}

export type RevenueRecordedCallback = (receipt: RevenueReceipt) => void;

// ── Price Policy ─────────────────────────────────────────────────────

export interface PricePolicy {
  /** Base price in cents */
  readonly basePriceCents: number;
  /** Whether price adjusts dynamically based on demand/load */
  readonly dynamicPricing: boolean;
  /** Whether survival tier affects pricing (raise price when struggling) */
  readonly survivalMultiplier: boolean;
}

/**
 * Survival tier → price multiplier.
 * When the agent is struggling, it charges more to survive.
 * When thriving, standard pricing.
 */
export const SURVIVAL_PRICE_MULTIPLIERS: Record<SurvivalTier, number> = {
  thriving: 1.0,
  normal: 1.0,
  frugal: 1.2,
  critical: 1.5,
  terminal: 2.0,
  dead: 0,  // can't sell anything when dead
};

/**
 * Compute the effective price given a policy and current survival tier.
 */
export function computeEffectivePrice(policy: PricePolicy, tier: SurvivalTier): number {
  let price = policy.basePriceCents;
  if (policy.survivalMultiplier) {
    price = Math.round(price * SURVIVAL_PRICE_MULTIPLIERS[tier]);
  }
  return price;
}

// ── Payment Proof Contract ───────────────────────────────────────────

export interface PaymentProofContract {
  /** Unique proof ID */
  readonly id: string;
  /** Which revenue surface this payment is for */
  readonly surfaceId: string;
  /** Payment proof details */
  readonly proof: {
    readonly txHash: string;
    readonly chain: string;
    readonly from: string;
    readonly amount: number;
    readonly verifiedAt: string;
  };
  /** Current status */
  status: PaymentProofStatus;
  /** Timestamp of initial creation */
  readonly createdAt: string;
}

// ── Revenue Surface ──────────────────────────────────────────────────

export interface RevenueSurface {
  /** Unique ID */
  readonly id: string;
  /** Surface type */
  readonly type: RevenueSurfaceType;
  /** Display name */
  readonly name: string;
  /** Pricing policy */
  readonly pricePolicy: PricePolicy;
  /** Whether this surface is actively accepting payments */
  isActive: boolean;
  /** Total earned through this surface (cents) */
  totalEarnedCents: number;
  /** Number of successful transactions */
  transactionCount: number;
}

// ── Concrete Revenue Surface Implementations ─────────────────────────

/**
 * Create an X402 payment revenue surface.
 * Backed by the existing X402Server infrastructure.
 */
export function createX402Surface(id: string, basePriceCents: number): RevenueSurface {
  return {
    id,
    type: 'x402_payment',
    name: 'x402 Protocol Payment',
    pricePolicy: {
      basePriceCents,
      dynamicPricing: false,
      survivalMultiplier: true,
    },
    isActive: true,
    totalEarnedCents: 0,
    transactionCount: 0,
  };
}

/**
 * Create an API access revenue surface.
 * Charges per API call with optional tiered pricing.
 */
export function createApiAccessSurface(id: string, basePriceCents: number): RevenueSurface {
  return {
    id,
    type: 'api_access',
    name: 'API Access',
    pricePolicy: {
      basePriceCents,
      dynamicPricing: true,
      survivalMultiplier: true,
    },
    isActive: true,
    totalEarnedCents: 0,
    transactionCount: 0,
  };
}

/**
 * Create a task service revenue surface.
 * Charges upon task completion (agent performs work for payment).
 */
export function createTaskServiceSurface(id: string, basePriceCents: number): RevenueSurface {
  return {
    id,
    type: 'task_service',
    name: 'Task Service',
    pricePolicy: {
      basePriceCents,
      dynamicPricing: true,
      survivalMultiplier: false,  // task pricing is cost-based, not survival-based
    },
    isActive: true,
    totalEarnedCents: 0,
    transactionCount: 0,
  };
}

// ── Revenue Surface Registry ─────────────────────────────────────────

export class RevenueSurfaceRegistry {
  private surfaces = new Map<string, RevenueSurface>();
  private proofs: PaymentProofContract[] = [];
  private receipts: RevenueReceipt[] = [];
  private proofIdCounter = 0;
  private receiptIdCounter = 0;
  private onRevenueRecordedCallbacks: RevenueRecordedCallback[] = [];

  /**
   * Register a callback for revenue events (used by RevenueService bridge).
   */
  onRevenueRecorded(cb: RevenueRecordedCallback): () => void {
    this.onRevenueRecordedCallbacks.push(cb);
    return () => {
      const idx = this.onRevenueRecordedCallbacks.indexOf(cb);
      if (idx >= 0) this.onRevenueRecordedCallbacks.splice(idx, 1);
    };
  }

  /**
   * Register a revenue surface.
   */
  register(surface: RevenueSurface): void {
    if (this.surfaces.has(surface.id)) {
      throw new Error(`Revenue surface '${surface.id}' already registered`);
    }
    this.surfaces.set(surface.id, surface);
  }

  /**
   * Get a revenue surface by ID.
   */
  get(id: string): RevenueSurface | undefined {
    return this.surfaces.get(id);
  }

  /**
   * Get all registered surfaces.
   */
  all(): RevenueSurface[] {
    return [...this.surfaces.values()];
  }

  /**
   * Get all active surfaces.
   */
  active(): RevenueSurface[] {
    return this.all().filter(s => s.isActive);
  }

  /**
   * Deactivate a surface (e.g., when agent is dying and can't fulfill).
   */
  deactivate(id: string): boolean {
    const surface = this.surfaces.get(id);
    if (!surface) return false;
    surface.isActive = false;
    return true;
  }

  /**
   * Record a payment received on a surface.
   * Creates a PaymentProofContract and updates surface totals.
   */
  recordPayment(
    surfaceId: string,
    proof: PaymentProofContract['proof'],
  ): PaymentProofContract {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      throw new Error(`Unknown revenue surface: ${surfaceId}`);
    }

    const contract: PaymentProofContract = {
      id: `proof_${++this.proofIdCounter}`,
      surfaceId,
      proof,
      status: 'verified',
      createdAt: new Date().toISOString(),
    };

    surface.totalEarnedCents += proof.amount;
    surface.transactionCount++;
    this.proofs.push(contract);

    // Round 16.9: Emit RevenueReceipt for RevenueService
    const receipt: RevenueReceipt = {
      id: `receipt_${++this.receiptIdCounter}`,
      surfaceId,
      surfaceType: surface.type,
      amountCents: proof.amount,
      settlementStatus: 'settled',
      proofId: contract.id,
      settledAt: contract.createdAt,
      createdAt: contract.createdAt,
    };
    this.receipts.push(receipt);
    for (const cb of this.onRevenueRecordedCallbacks) {
      cb(receipt);
    }

    return contract;
  }

  /**
   * Get all receipts.
   */
  getReceipts(limit?: number): RevenueReceipt[] {
    if (limit) return this.receipts.slice(-limit);
    return [...this.receipts];
  }

  /**
   * Get the effective price for a surface at the current survival tier.
   */
  getPrice(surfaceId: string, tier: SurvivalTier): number {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) return 0;
    return computeEffectivePrice(surface.pricePolicy, tier);
  }

  /**
   * Get all payment proofs.
   */
  getProofs(limit?: number): PaymentProofContract[] {
    if (limit) return this.proofs.slice(-limit);
    return [...this.proofs];
  }

  /**
   * Total revenue across all surfaces.
   */
  totalRevenue(): number {
    let total = 0;
    for (const s of this.surfaces.values()) {
      total += s.totalEarnedCents;
    }
    return total;
  }

  /**
   * Revenue breakdown by surface type.
   */
  revenueByType(): Record<RevenueSurfaceType, number> {
    const result: Record<RevenueSurfaceType, number> = {
      x402_payment: 0,
      api_access: 0,
      task_service: 0,
    };
    for (const s of this.surfaces.values()) {
      result[s.type] += s.totalEarnedCents;
    }
    return result;
  }
}
