/**
 * Round 17.8 — G6: Claim Lifecycle Engine
 *
 * Formal lifecycle for reward claims:
 *   requested → eligible → approved → settled
 *                        → ineligible
 *                        → duplicate
 *                        → rejected
 *
 * Design invariants:
 * - Every claim attempt is recorded (even failed ones)
 * - ClaimReceipt is created only on approval
 * - Anti-duplication enforced at claim time
 * - Structured rejection reasons for every failure
 * - Settlement-agnostic: lifecycle survives settlement upgrades
 */

import type { RewardRegistry, EligibilityCheckResult } from './reward-definition.js';
import type { EconomicIdentityRegistry } from './economic-identity.js';
import type { CapabilityEnvelopeManager } from './capability-envelope.js';

// ── Types ────────────────────────────────────────────────────────────

export type ClaimStatus =
  | 'requested'
  | 'eligible'
  | 'ineligible'
  | 'duplicate'
  | 'approved'
  | 'settled'
  | 'rejected';

export interface ClaimAttempt {
  readonly claimId: string;
  readonly rewardId: string;
  readonly economicIdentityId: string;
  readonly status: ClaimStatus;
  readonly eligibilityResult: EligibilityCheckResult | null;
  readonly rejectionReasons: readonly string[];
  readonly amountCents: number;
  readonly asset: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClaimReceipt {
  readonly receiptId: string;
  readonly claimId: string;
  readonly rewardId: string;
  readonly economicIdentityId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly issuedAt: string;
}

export interface ClaimResult {
  readonly success: boolean;
  readonly claimId: string;
  readonly status: ClaimStatus;
  readonly receipt: ClaimReceipt | null;
  readonly rejectionReasons: readonly string[];
}

export interface ClaimStats {
  readonly totalAttempts: number;
  readonly approved: number;
  readonly settled: number;
  readonly rejected: number;
  readonly ineligible: number;
  readonly duplicate: number;
}

// ── Claim Engine ─────────────────────────────────────────────────────

export class ClaimEngine {
  private claims = new Map<string, ClaimAttempt>();
  private receipts = new Map<string, ClaimReceipt>();
  private claimIdCounter = 0;
  private receiptIdCounter = 0;

  /** Claims grouped by identity for fast duplicate lookups. */
  private claimsByIdentity = new Map<string, Map<string, ClaimAttempt[]>>();

  constructor(
    private readonly rewardRegistry: RewardRegistry,
    private readonly identityRegistry: EconomicIdentityRegistry,
    private readonly envelopeManager: CapabilityEnvelopeManager,
  ) {}

  /**
   * Attempt to claim a reward.
   * Runs the full lifecycle: request → eligibility → approve/reject.
   */
  attemptClaim(
    rewardId: string,
    economicIdentityId: string,
  ): ClaimResult {
    const claimId = `claim_${++this.claimIdCounter}`;
    const now = new Date().toISOString();
    const rejectionReasons: string[] = [];

    // 1. Check reward exists
    const reward = this.rewardRegistry.get(rewardId);
    if (!reward) {
      const attempt = this.recordAttempt(claimId, rewardId, economicIdentityId, 'rejected', null, ['Reward not found'], 0, '');
      return { success: false, claimId, status: 'rejected', receipt: null, rejectionReasons: ['Reward not found'] };
    }

    // 2. Get identity context
    const identity = this.identityRegistry.get(economicIdentityId);
    if (!identity) {
      this.recordAttempt(claimId, rewardId, economicIdentityId, 'rejected', null, ['Economic identity not found'], reward.amountCents, reward.asset);
      return { success: false, claimId, status: 'rejected', receipt: null, rejectionReasons: ['Economic identity not found'] };
    }

    // 3. Get capability context
    const envelope = this.envelopeManager.getByEconomicIdentity(economicIdentityId);
    const grantedScopes: ReadonlySet<string> = envelope?.grantedScopes ?? new Set();

    // 4. Count previous claims for this identity + reward pair
    const previousClaims = this.getClaimsForIdentityReward(economicIdentityId, rewardId);
    const approvedClaims = previousClaims.filter(c =>
      c.status === 'approved' || c.status === 'settled'
    ).length;

    // 5. Run eligibility check
    const eligibilityResult = this.rewardRegistry.checkEligibility(
      rewardId,
      economicIdentityId,
      {
        identityStatus: identity.status,
        grantedScopes,
        claimsForIdentity: approvedClaims,
      },
    );

    // 6. Determine status based on eligibility
    let status: ClaimStatus;

    if (!eligibilityResult.eligible) {
      if (eligibilityResult.isDuplicate) {
        status = 'duplicate';
        rejectionReasons.push(`Duplicate: already claimed ${approvedClaims}/${reward.perIdentityLimit} times`);
      } else {
        status = 'ineligible';
        for (const f of eligibilityResult.failedRules) {
          rejectionReasons.push(`${f.ruleId}: ${f.reason}`);
        }
      }
    } else {
      status = 'approved';
    }

    // 7. Record the claim attempt
    this.recordAttempt(claimId, rewardId, economicIdentityId, status, eligibilityResult, rejectionReasons, reward.amountCents, reward.asset);

    // 8. If approved, create receipt and increment reward counter
    let receipt: ClaimReceipt | null = null;
    if (status === 'approved') {
      const receiptId = `receipt_${++this.receiptIdCounter}`;
      receipt = {
        receiptId,
        claimId,
        rewardId,
        economicIdentityId,
        amountCents: reward.amountCents,
        asset: reward.asset,
        issuedAt: now,
      };
      this.receipts.set(receiptId, receipt);
      this.rewardRegistry.incrementClaimed(rewardId);
    }

    return {
      success: status === 'approved',
      claimId,
      status,
      receipt,
      rejectionReasons,
    };
  }

  /** Settle an approved claim. */
  settle(claimId: string): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;
    if (claim.status !== 'approved') return false;
    this.claims.set(claimId, { ...claim, status: 'settled', updatedAt: new Date().toISOString() });
    return true;
  }

  /** Get a claim by ID. */
  get(claimId: string): ClaimAttempt | undefined {
    return this.claims.get(claimId);
  }

  /** Get all claims. */
  all(): ReadonlyArray<ClaimAttempt> {
    return [...this.claims.values()];
  }

  /** Get claims for a specific identity. */
  getClaimsForIdentity(economicIdentityId: string): ReadonlyArray<ClaimAttempt> {
    const byReward = this.claimsByIdentity.get(economicIdentityId);
    if (!byReward) return [];
    const result: ClaimAttempt[] = [];
    for (const claims of byReward.values()) result.push(...claims);
    return result;
  }

  /** Get claims for a specific identity + reward pair. */
  getClaimsForIdentityReward(economicIdentityId: string, rewardId: string): ReadonlyArray<ClaimAttempt> {
    return this.claimsByIdentity.get(economicIdentityId)?.get(rewardId) ?? [];
  }

  /** Get all receipts. */
  allReceipts(): ReadonlyArray<ClaimReceipt> {
    return [...this.receipts.values()];
  }

  /** Get receipts for a specific identity. */
  getReceiptsForIdentity(economicIdentityId: string): ReadonlyArray<ClaimReceipt> {
    return this.allReceipts().filter(r => r.economicIdentityId === economicIdentityId);
  }

  /** Get recent claims. */
  getRecent(limit = 20): ReadonlyArray<ClaimAttempt> {
    return [...this.claims.values()].slice(-limit);
  }

  /** Get aggregate statistics. */
  stats(): ClaimStats {
    let approved = 0;
    let settled = 0;
    let rejected = 0;
    let ineligible = 0;
    let duplicate = 0;

    for (const claim of this.claims.values()) {
      switch (claim.status) {
        case 'approved': approved++; break;
        case 'settled': settled++; break;
        case 'rejected': rejected++; break;
        case 'ineligible': ineligible++; break;
        case 'duplicate': duplicate++; break;
      }
    }

    return {
      totalAttempts: this.claims.size,
      approved,
      settled,
      rejected,
      ineligible,
      duplicate,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────

  private recordAttempt(
    claimId: string,
    rewardId: string,
    economicIdentityId: string,
    status: ClaimStatus,
    eligibilityResult: EligibilityCheckResult | null,
    rejectionReasons: readonly string[],
    amountCents: number,
    asset: string,
  ): ClaimAttempt {
    const now = new Date().toISOString();
    const attempt: ClaimAttempt = {
      claimId,
      rewardId,
      economicIdentityId,
      status,
      eligibilityResult,
      rejectionReasons,
      amountCents,
      asset,
      createdAt: now,
      updatedAt: now,
    };

    this.claims.set(claimId, attempt);

    // Index by identity + reward
    if (!this.claimsByIdentity.has(economicIdentityId)) {
      this.claimsByIdentity.set(economicIdentityId, new Map());
    }
    const byReward = this.claimsByIdentity.get(economicIdentityId)!;
    if (!byReward.has(rewardId)) {
      byReward.set(rewardId, []);
    }
    byReward.get(rewardId)!.push(attempt);

    return attempt;
  }
}
