/**
 * Round 20.4 — ChildFundingLease (G1)
 *
 * Independent funding contract for child runtime sessions.
 * Separates funding lifecycle (active/exhausted/revoked/expired/settled)
 * from execution lifecycle (pending/running/paused/completed/failed/recalled).
 *
 * Consumed by:
 * - ChildSession (via leaseId reference, budget enforcement)
 * - SessionRegistry (lease management + diagnostics)
 * - Governance / Economic truth surfaces
 */

// ── Types ────────────────────────────────────────────────────────────

export type FundingLeaseStatus =
  | 'active'      // funds available, child may spend
  | 'exhausted'   // spend ceiling or allocated budget reached
  | 'revoked'     // governance/parent forcibly cut funding
  | 'expired'     // lease duration exceeded
  | 'settled';    // child completed, final accounting done

/** Terminal statuses — no further spend allowed */
export const TERMINAL_LEASE_STATUSES: readonly FundingLeaseStatus[] = [
  'exhausted', 'revoked', 'expired', 'settled',
];

export interface FundingLeaseConfig {
  /** Child session this lease funds */
  sessionId: string;
  /** Parent session (for nesting) */
  parentId?: string;
  /** Governance proposal that authorized this lease */
  proposalId?: string;
  /** Total allocated budget (cents) */
  allocatedCents: number;
  /** Amount frozen from parent reserve (cents) */
  reserveFreezeCents: number;
  /** Maximum single-spend ceiling (cents, 0 = no per-spend limit) */
  spendCeilingCents: number;
  /** ISO-8601 lease expiry */
  expiresAt?: string;
  /** Purpose / justification */
  purpose: string;
  /** Expected utility from this spend (cents) */
  expectedUtilityCents: number;
}

// ── ChildFundingLease ────────────────────────────────────────────────

export class ChildFundingLease {
  readonly leaseId: string;
  readonly sessionId: string;
  readonly parentId?: string;
  readonly proposalId?: string;
  readonly allocatedCents: number;
  readonly reserveFreezeCents: number;
  readonly spendCeilingCents: number;
  readonly expiresAt?: string;
  readonly purpose: string;
  readonly expectedUtilityCents: number;
  readonly createdAt: string;

  private _status: FundingLeaseStatus = 'active';
  private _spentCents = 0;
  private _revokedAt?: string;
  private _revokeReason?: string;
  private _settledAt?: string;

  constructor(config: FundingLeaseConfig) {
    this.leaseId = `lease_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sessionId = config.sessionId;
    this.parentId = config.parentId;
    this.proposalId = config.proposalId;
    this.allocatedCents = config.allocatedCents;
    this.reserveFreezeCents = config.reserveFreezeCents;
    this.spendCeilingCents = config.spendCeilingCents;
    this.expiresAt = config.expiresAt;
    this.purpose = config.purpose;
    this.expectedUtilityCents = config.expectedUtilityCents;
    this.createdAt = new Date().toISOString();
  }

  // ── Getters ─────────────────────────────────────────────────────

  get status(): FundingLeaseStatus { return this._status; }
  get spentCents(): number { return this._spentCents; }
  get remainingCents(): number { return Math.max(0, this.allocatedCents - this._spentCents); }
  get utilizationPercent(): number {
    return this.allocatedCents > 0 ? Math.round((this._spentCents / this.allocatedCents) * 100) : 0;
  }
  get isTerminal(): boolean { return TERMINAL_LEASE_STATUSES.includes(this._status); }
  get revokedAt(): string | undefined { return this._revokedAt; }
  get revokeReason(): string | undefined { return this._revokeReason; }
  get settledAt(): string | undefined { return this._settledAt; }

  // ── Spend ───────────────────────────────────────────────────────

  /**
   * Record a spend against this lease.
   * Enforces: lease active, per-spend ceiling, total budget.
   * Returns remaining cents after this spend.
   */
  recordSpend(cents: number): number {
    if (cents < 0) throw new Error('Spend amount must be non-negative');
    if (this._status !== 'active') {
      throw new Error(`Cannot spend on lease in status: ${this._status}`);
    }

    // Per-spend ceiling enforcement
    if (this.spendCeilingCents > 0 && cents > this.spendCeilingCents) {
      throw new Error(
        `Spend ${cents}¢ exceeds per-spend ceiling of ${this.spendCeilingCents}¢`,
      );
    }

    // Total budget enforcement
    if (this._spentCents + cents > this.allocatedCents) {
      throw new Error(
        `Spend ${cents}¢ would exceed allocated budget (${this._spentCents}¢ spent of ${this.allocatedCents}¢)`,
      );
    }

    this._spentCents += cents;

    // Auto-transition to exhausted if budget fully consumed
    if (this._spentCents >= this.allocatedCents) {
      this._status = 'exhausted';
    }

    return this.remainingCents;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /**
   * Revoke this lease (governance/parent action).
   */
  revoke(reason: string): this {
    if (this.isTerminal) {
      throw new Error(`Cannot revoke lease in terminal status: ${this._status}`);
    }
    this._status = 'revoked';
    this._revokedAt = new Date().toISOString();
    this._revokeReason = reason;
    return this;
  }

  /**
   * Expire this lease (time-triggered).
   */
  expire(): this {
    if (this.isTerminal) {
      throw new Error(`Cannot expire lease in terminal status: ${this._status}`);
    }
    this._status = 'expired';
    return this;
  }

  /**
   * Settle this lease (child completed, final accounting).
   */
  settle(): this {
    if (this._status !== 'active' && this._status !== 'exhausted') {
      throw new Error(`Cannot settle lease in status: ${this._status}`);
    }
    this._status = 'settled';
    this._settledAt = new Date().toISOString();
    return this;
  }

  /**
   * Check if lease should be auto-expired based on current time.
   */
  checkExpiry(now?: string): boolean {
    const currentTime = now ?? new Date().toISOString();
    if (this.expiresAt && this._status === 'active' && currentTime >= this.expiresAt) {
      this.expire();
      return true;
    }
    return false;
  }

  // ── Serialization ───────────────────────────────────────────────

  toJSON() {
    return {
      leaseId: this.leaseId,
      sessionId: this.sessionId,
      parentId: this.parentId,
      proposalId: this.proposalId,
      status: this._status,
      allocatedCents: this.allocatedCents,
      spentCents: this._spentCents,
      remainingCents: this.remainingCents,
      utilizationPercent: this.utilizationPercent,
      reserveFreezeCents: this.reserveFreezeCents,
      spendCeilingCents: this.spendCeilingCents,
      expiresAt: this.expiresAt,
      purpose: this.purpose,
      expectedUtilityCents: this.expectedUtilityCents,
      createdAt: this.createdAt,
      revokedAt: this._revokedAt,
      revokeReason: this._revokeReason,
      settledAt: this._settledAt,
    };
  }
}

/**
 * Factory function for creating funding leases.
 */
export function createFundingLease(config: FundingLeaseConfig): ChildFundingLease {
  return new ChildFundingLease(config);
}
