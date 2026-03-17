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

// ── Round 17.3: Payment Proof Verification ───────────────────────────

export interface PaymentProofVerificationResult {
  /** Whether the proof was successfully verified */
  readonly verified: boolean;
  /** Verification method used */
  readonly method: 'chain_confirmation' | 'receipt_match' | 'manual' | 'test';
  /** Reason for rejection (if not verified) */
  readonly rejectionReason?: string;
  /** Timestamp of verification */
  readonly verifiedAt: string;
}

// ── Round 17.3: Fulfillment Tracking ─────────────────────────────────

export type FulfillmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'refund_issued';

export interface FulfillmentRecord {
  /** Unique fulfillment ID */
  readonly id: string;
  /** Linked payment proof ID */
  readonly proofId: string;
  /** Current fulfillment status */
  status: FulfillmentStatus;
  /** Associated task/action that fulfilled the payment */
  readonly taskId?: string;
  /** Description of what was delivered */
  readonly deliverable?: string;
  /** Timestamp of fulfillment completion */
  readonly completedAt?: string;
  /** Reason for failure/refund */
  readonly failureReason?: string;
  /** ISO timestamp of creation */
  readonly createdAt: string;
  /** Round 17.4: Identity of the agent that fulfilled this */
  readonly issuerIdentityId?: string;
}

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
  /** Round 17.4: Identity that earned this revenue */
  readonly issuerIdentityId?: string;
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
  /** Round 17.3: Verification result (replaces hardcoded status) */
  readonly verification?: PaymentProofVerificationResult;
  /** Round 17.3: Linked fulfillment record */
  fulfillmentId?: string;
  /** Timestamp of initial creation */
  readonly createdAt: string;
  /** Round 17.4: Identity that this payment proof is attributed to */
  readonly issuerIdentityId?: string;
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
  /** Round 17.4: Identity that owns this revenue surface */
  issuerIdentityId?: string;
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
  private fulfillments = new Map<string, FulfillmentRecord>();
  private proofIdCounter = 0;
  private receiptIdCounter = 0;
  private fulfillmentIdCounter = 0;
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
   * Round 17.3: Accepts optional verification result; unverified
   * payments are recorded as 'pending' and do NOT count as confirmed revenue.
   */
  recordPayment(
    surfaceId: string,
    proof: PaymentProofContract['proof'],
    verification?: PaymentProofVerificationResult,
  ): PaymentProofContract {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) {
      throw new Error(`Unknown revenue surface: ${surfaceId}`);
    }

    const isVerified = verification ? verification.verified : true; // backward compat
    const status: PaymentProofStatus = isVerified ? 'verified' : (verification?.rejectionReason ? 'rejected' : 'pending');

    const contract: PaymentProofContract = {
      id: `proof_${++this.proofIdCounter}`,
      surfaceId,
      proof,
      status,
      verification,
      createdAt: new Date().toISOString(),
    };

    this.proofs.push(contract);

    // Round 17.3: ONLY verified payments count as confirmed revenue
    if (isVerified) {
      surface.totalEarnedCents += proof.amount;
      surface.transactionCount++;

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
    }

    return contract;
  }

  /**
   * Round 17.3: Verify a previously pending payment proof.
   * Transitions pending → verified and records revenue.
   */
  verifyPayment(proofId: string, verification: PaymentProofVerificationResult): boolean {
    const contract = this.proofs.find(p => p.id === proofId);
    if (!contract || contract.status !== 'pending') return false;
    if (!verification.verified) {
      contract.status = 'rejected';
      return false;
    }

    contract.status = 'verified';
    // Use Object.assign to update readonly verification field
    (contract as { verification?: PaymentProofVerificationResult }).verification = verification;

    const surface = this.surfaces.get(contract.surfaceId);
    if (surface) {
      surface.totalEarnedCents += contract.proof.amount;
      surface.transactionCount++;

      const receipt: RevenueReceipt = {
        id: `receipt_${++this.receiptIdCounter}`,
        surfaceId: contract.surfaceId,
        surfaceType: surface.type,
        amountCents: contract.proof.amount,
        settlementStatus: 'settled',
        proofId: contract.id,
        settledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.receipts.push(receipt);
      for (const cb of this.onRevenueRecordedCallbacks) {
        cb(receipt);
      }
    }
    return true;
  }

  /**
   * Round 17.3: Link a fulfillment record to a payment proof.
   */
  linkFulfillment(proofId: string, fulfillment: Omit<FulfillmentRecord, 'id' | 'proofId' | 'createdAt'>): FulfillmentRecord | undefined {
    const contract = this.proofs.find(p => p.id === proofId);
    if (!contract) return undefined;

    const record: FulfillmentRecord = {
      id: `ful_${++this.fulfillmentIdCounter}`,
      proofId,
      status: fulfillment.status,
      taskId: fulfillment.taskId,
      deliverable: fulfillment.deliverable,
      completedAt: fulfillment.completedAt,
      failureReason: fulfillment.failureReason,
      createdAt: new Date().toISOString(),
    };
    this.fulfillments.set(record.id, record);
    contract.fulfillmentId = record.id;
    return record;
  }

  /**
   * Round 17.3: Get fulfillment status for a payment proof.
   */
  getFulfillmentStatus(proofId: string): FulfillmentRecord | undefined {
    const contract = this.proofs.find(p => p.id === proofId);
    if (!contract?.fulfillmentId) return undefined;
    return this.fulfillments.get(contract.fulfillmentId);
  }

  /**
   * Round 17.3: Get all unfulfilled verified payments (pending fulfillment).
   */
  getUnfulfilledPayments(): PaymentProofContract[] {
    return this.proofs.filter(p =>
      p.status === 'verified' &&
      (!p.fulfillmentId || this.fulfillments.get(p.fulfillmentId)?.status === 'pending'),
    );
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
   * Round 17.3: Get proofs filtered by status.
   */
  getProofsByStatus(status: PaymentProofStatus): PaymentProofContract[] {
    return this.proofs.filter(p => p.status === status);
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
