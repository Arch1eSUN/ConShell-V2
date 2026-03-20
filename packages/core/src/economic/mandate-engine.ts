/**
 * Round 17.7 — G4: Mandate Engine
 *
 * Authorization system for economic actions that require pre-approval.
 * A Mandate is a bounded, time-limited, purpose-specific authorization
 * to spend or transfer assets.
 *
 * Design invariants:
 * - Mandates have explicit budgets, expiry, and scope limits
 * - spend_within_mandate requires a matching active mandate
 * - explicit_transfer always requires human confirmation mandate
 * - Budget is decremented atomically on consumption
 * - Expired / exhausted mandates are never matched
 */

import type { EconomicActionKind, EconomicRiskLevel, CandidateEconomicAction } from './economic-action-classification.js';

// ── Types ────────────────────────────────────────────────────────────

export type MandateStatus = 'active' | 'exhausted' | 'expired' | 'revoked';

export interface Mandate {
  readonly mandateId: string;
  readonly economicIdentityId: string;
  readonly purpose: string;
  readonly asset: string;
  readonly network: string;
  readonly maxTotalAmount: number;      // cents
  readonly maxPerTransactionAmount: number; // cents
  readonly validFrom: string;
  readonly validUntil: string;
  readonly allowedActionKinds: readonly EconomicActionKind[];
  readonly allowedProviders: readonly string[];
  readonly riskLevel: EconomicRiskLevel;
  readonly approvalMode: 'auto' | 'human_required';
  readonly approvedBy: string;
  readonly status: MandateStatus;
  readonly remainingBudget: number;     // mutable tracking
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MandateCreateInput {
  readonly economicIdentityId: string;
  readonly purpose: string;
  readonly asset?: string;
  readonly network?: string;
  readonly maxTotalAmount: number;
  readonly maxPerTransactionAmount: number;
  readonly validFrom?: string;
  readonly validUntil: string;
  readonly allowedActionKinds: readonly EconomicActionKind[];
  readonly allowedProviders?: readonly string[];
  readonly riskLevel?: EconomicRiskLevel;
  readonly approvalMode?: 'auto' | 'human_required';
  readonly approvedBy: string;
}

export interface MandateMatchResult {
  readonly matched: boolean;
  readonly mandateId: string | null;
  readonly rejectionReason: string | null;
  readonly remainingBudget: number;
  readonly violations: readonly string[];
}

// ── Engine ────────────────────────────────────────────────────────────

export class MandateEngine {
  private mandates = new Map<string, Mandate>();
  private byEconomicId = new Map<string, Set<string>>(); // econId → mandateIds
  private idCounter = 0;

  /** Create a new mandate. */
  create(input: MandateCreateInput): Mandate {
    if (input.maxTotalAmount <= 0) {
      throw new Error('Mandate maxTotalAmount must be positive');
    }
    if (input.maxPerTransactionAmount <= 0) {
      throw new Error('Mandate maxPerTransactionAmount must be positive');
    }
    if (input.maxPerTransactionAmount > input.maxTotalAmount) {
      throw new Error('maxPerTransactionAmount cannot exceed maxTotalAmount');
    }

    const now = new Date().toISOString();
    const mandateId = `mandate_${++this.idCounter}`;

    const mandate: Mandate = {
      mandateId,
      economicIdentityId: input.economicIdentityId,
      purpose: input.purpose,
      asset: input.asset ?? 'USDC',
      network: input.network ?? 'base',
      maxTotalAmount: input.maxTotalAmount,
      maxPerTransactionAmount: input.maxPerTransactionAmount,
      validFrom: input.validFrom ?? now,
      validUntil: input.validUntil,
      allowedActionKinds: [...input.allowedActionKinds],
      allowedProviders: input.allowedProviders ? [...input.allowedProviders] : [],
      riskLevel: input.riskLevel ?? 'medium',
      approvalMode: input.approvalMode ?? 'auto',
      approvedBy: input.approvedBy,
      status: 'active',
      remainingBudget: input.maxTotalAmount,
      createdAt: now,
      updatedAt: now,
    };

    this.mandates.set(mandateId, mandate);

    if (!this.byEconomicId.has(input.economicIdentityId)) {
      this.byEconomicId.set(input.economicIdentityId, new Set());
    }
    this.byEconomicId.get(input.economicIdentityId)!.add(mandateId);

    return mandate;
  }

  /**
   * Match a candidate action against available mandates for the given identity.
   * Returns the first matching mandate (by remaining budget, within limits).
   */
  match(action: CandidateEconomicAction, economicIdentityId: string): MandateMatchResult {
    const mandateIds = this.byEconomicId.get(economicIdentityId);
    if (!mandateIds || mandateIds.size === 0) {
      return {
        matched: false,
        mandateId: null,
        rejectionReason: 'No mandates exist for this economic identity',
        remainingBudget: 0,
        violations: [],
      };
    }

    const violations: string[] = [];
    const now = new Date().toISOString();

    for (const mId of mandateIds) {
      const mandate = this.mandates.get(mId)!;

      // Skip non-active
      if (mandate.status !== 'active') {
        violations.push(`Mandate ${mId}: status=${mandate.status}`);
        continue;
      }

      // Check expiry
      if (now > mandate.validUntil) {
        this.expire(mId);
        violations.push(`Mandate ${mId}: expired`);
        continue;
      }
      if (now < mandate.validFrom) {
        violations.push(`Mandate ${mId}: not yet valid`);
        continue;
      }

      // Check action kind
      if (!mandate.allowedActionKinds.includes(action.actionKind)) {
        violations.push(`Mandate ${mId}: action kind '${action.actionKind}' not allowed`);
        continue;
      }

      // Check per-transaction limit
      if (action.amountCents > mandate.maxPerTransactionAmount) {
        violations.push(
          `Mandate ${mId}: amount ${action.amountCents} exceeds per-transaction limit ${mandate.maxPerTransactionAmount}`,
        );
        continue;
      }

      // Check remaining budget
      if (action.amountCents > mandate.remainingBudget) {
        violations.push(
          `Mandate ${mId}: amount ${action.amountCents} exceeds remaining budget ${mandate.remainingBudget}`,
        );
        continue;
      }

      // All checks passed
      return {
        matched: true,
        mandateId: mId,
        rejectionReason: null,
        remainingBudget: mandate.remainingBudget,
        violations: [],
      };
    }

    return {
      matched: false,
      mandateId: null,
      rejectionReason: 'No matching mandate found',
      remainingBudget: 0,
      violations,
    };
  }

  /**
   * Consume budget from a mandate.
   * Returns true if successful, false if insufficient budget.
   */
  consume(mandateId: string, amountCents: number): boolean {
    const mandate = this.mandates.get(mandateId);
    if (!mandate || mandate.status !== 'active') return false;
    if (amountCents > mandate.remainingBudget) return false;

    const newRemaining = mandate.remainingBudget - amountCents;
    const newStatus: MandateStatus = newRemaining === 0 ? 'exhausted' : 'active';

    const updated: Mandate = {
      ...mandate,
      remainingBudget: newRemaining,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    this.mandates.set(mandateId, updated);
    return true;
  }

  /** Check and expire mandates past their validUntil. */
  checkExpiry(now?: string): Mandate[] {
    const cutoff = now ?? new Date().toISOString();
    const expired: Mandate[] = [];

    for (const mandate of this.mandates.values()) {
      if (mandate.status === 'active' && cutoff > mandate.validUntil) {
        this.expire(mandate.mandateId);
        expired.push(this.mandates.get(mandate.mandateId)!);
      }
    }
    return expired;
  }

  /** Revoke a mandate. */
  revoke(mandateId: string, _reason: string): boolean {
    const mandate = this.mandates.get(mandateId);
    if (!mandate || mandate.status === 'revoked') return false;

    const updated: Mandate = {
      ...mandate,
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    };
    this.mandates.set(mandateId, updated);
    return true;
  }

  /** Get active mandates for an economic identity. */
  getActiveMandates(economicIdentityId: string): ReadonlyArray<Mandate> {
    const ids = this.byEconomicId.get(economicIdentityId);
    if (!ids) return [];
    return [...ids]
      .map(id => this.mandates.get(id)!)
      .filter(m => m.status === 'active');
  }

  /** Get by mandateId. */
  get(mandateId: string): Mandate | undefined {
    return this.mandates.get(mandateId);
  }

  /** List all mandates. */
  all(): ReadonlyArray<Mandate> {
    return [...this.mandates.values()];
  }

  // ── Internal ─────────────────────────────────────────────────────────

  private expire(mandateId: string): void {
    const mandate = this.mandates.get(mandateId);
    if (!mandate || mandate.status !== 'active') return;

    const updated: Mandate = {
      ...mandate,
      status: 'expired',
      updatedAt: new Date().toISOString(),
    };
    this.mandates.set(mandateId, updated);
  }
}
