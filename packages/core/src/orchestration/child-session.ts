/**
 * Round 20.1 → 20.6 — ChildSession
 *
 * Fully realized child session with lifecycle methods, budget tracking,
 * and audit-ready timestamps. Managed by SessionRegistry as a
 * first-class runtime primitive alongside ToolInvocation.
 *
 * Round 20.4 additions:
 * - 6-state FSM (+ paused)
 * - leaseId reference to ChildFundingLease
 * - Extended manifest with specialization semantics
 * - ChildGovernanceAction audit record type
 * - pause() / resume() lifecycle methods
 * - reason parameter on recall/fail for audit trail
 *
 * Round 20.6 additions:
 * - Single spend truth: trackSpend() delegates to lease when present
 * - budgetUsedCents becomes mirror of lease.spentCents for funded sessions
 * - Local _budgetUsedCents retained only as fallback for unfunded sessions
 */
import type { ChildFundingLease } from './child-funding-lease.js';

// ── Types ───────────────────────────────────────────────────────────

export type ChildSessionStatus =
  | 'pending'     // created but not yet started
  | 'running'     // actively executing
  | 'paused'      // temporarily suspended (Round 20.4)
  | 'completed'   // successfully finished
  | 'failed'      // unrecoverable error
  | 'recalled';   // governance/parent forcibly stopped

export interface ChildSessionManifest {
  readonly role: string;
  readonly task: string;
  // Round 20.4: Specialization semantics (G4)
  readonly scope?: string;
  readonly expectedCapabilities?: string[];
  readonly allowedToolCategories?: string[];
  readonly reportingExpectation?: {
    heartbeatIntervalMs?: number;
    checkpointFrequency?: 'per-step' | 'per-milestone' | 'on-completion';
  };
  readonly specialization?: string;
}

export interface ChildSessionConfig {
  /** Human-readable name */
  name: string;
  /** What this child does */
  manifest: ChildSessionManifest;
  /** Allocated budget in cents */
  budgetCents: number;
  /** Parent session (for nesting) */
  parentSessionId?: string;
  /** Governance proposal that authorized this session */
  proposalId?: string;
  /** Funding lease ID (Round 20.4) */
  leaseId?: string;
  /** Funding lease reference for single spend truth (Round 20.6) */
  leaseRef?: ChildFundingLease;
  /** Round 20.7: Explicit linkage to parent commitment */
  targetCommitmentId?: string;
}

// ── Governance Action (Round 20.4 G3) ───────────────────────────────

export type GovernanceActionType =
  | 'recall' | 'pause' | 'resume' | 'fail'
  | 'merge' | 'revoke_funding' | 'start' | 'complete';

export type GovernanceActor = 'governance' | 'operator' | 'parent' | 'system';

export interface ChildGovernanceAction {
  readonly actionType: GovernanceActionType;
  readonly sessionId: string;
  readonly actor: GovernanceActor;
  readonly reason: string;
  readonly fromStatus: ChildSessionStatus;
  readonly toStatus: ChildSessionStatus;
  readonly leaseImpact?: string;
  readonly timestamp: string;
}

// ── ChildSession ────────────────────────────────────────────────────

export class ChildSession {
  readonly id: string;
  readonly name: string;
  readonly manifest: ChildSessionManifest;
  readonly parentSessionId?: string;
  readonly proposalId?: string;
  readonly leaseId?: string;
  /** Round 20.7: Explicit linkage to parent commitment */
  readonly targetCommitmentId?: string;
  readonly budgetCents: number;
  readonly createdAt: string;

  private _status: ChildSessionStatus = 'pending';
  private _budgetUsedCents = 0;
  private _startedAt?: string;
  private _completedAt?: string;
  private _pausedAt?: string;
  private _resultSummary?: string;
  private _mergeResult?: string;
  private _errorDetails?: string;
  private _recallReason?: string;
  /** Round 20.6: Lease reference for single spend truth */
  private _leaseRef?: ChildFundingLease;

  constructor(config: ChildSessionConfig) {
    this.id = `csn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name;
    this.manifest = config.manifest;
    this.budgetCents = config.budgetCents;
    this.parentSessionId = config.parentSessionId;
    this.proposalId = config.proposalId;
    this.leaseId = config.leaseId;
    this._leaseRef = config.leaseRef;
    this.targetCommitmentId = config.targetCommitmentId;
    this.createdAt = new Date().toISOString();
  }

  // ── Getters ─────────────────────────────────────────────────────

  get status(): ChildSessionStatus { return this._status; }
  /** Round 20.6: Single spend truth — mirrors lease when present */
  get budgetUsedCents(): number {
    return this._leaseRef ? this._leaseRef.spentCents : this._budgetUsedCents;
  }
  get startedAt(): string | undefined { return this._startedAt; }
  get completedAt(): string | undefined { return this._completedAt; }
  get pausedAt(): string | undefined { return this._pausedAt; }
  get resultSummary(): string | undefined { return this._resultSummary; }
  get mergeResult(): string | undefined { return this._mergeResult; }
  get errorDetails(): string | undefined { return this._errorDetails; }
  get recallReason(): string | undefined { return this._recallReason; }
  get budgetRemaining(): number { return this.budgetCents - this.budgetUsedCents; }
  /** Round 20.6: Whether this session's spend is backed by a canonical lease */
  get hasCanonicalSpendTruth(): boolean { return !!this._leaseRef; }

  // ── Lifecycle ───────────────────────────────────────────────────

  start(): this {
    if (this._status !== 'pending') {
      throw new Error(`Cannot start session in status: ${this._status}`);
    }
    this._status = 'running';
    this._startedAt = new Date().toISOString();
    return this;
  }

  complete(summary: string, mergeResult?: string): this {
    if (this._status !== 'running') {
      throw new Error(`Cannot complete session in status: ${this._status}`);
    }
    this._status = 'completed';
    this._resultSummary = summary;
    this._mergeResult = mergeResult;
    this._completedAt = new Date().toISOString();
    return this;
  }

  fail(error: string): this {
    if (this._status !== 'running' && this._status !== 'pending') {
      throw new Error(`Cannot fail session in status: ${this._status}`);
    }
    this._status = 'failed';
    this._errorDetails = error;
    this._completedAt = new Date().toISOString();
    return this;
  }

  recall(reason?: string): this {
    if (this._status !== 'running' && this._status !== 'pending' && this._status !== 'paused') {
      throw new Error(`Cannot recall session in status: ${this._status}`);
    }
    this._status = 'recalled';
    this._recallReason = reason;
    this._completedAt = new Date().toISOString();
    return this;
  }

  /** Round 20.4: Pause a running session */
  pause(reason?: string): this {
    if (this._status !== 'running') {
      throw new Error(`Cannot pause session in status: ${this._status}`);
    }
    this._status = 'paused';
    this._pausedAt = new Date().toISOString();
    this._recallReason = reason; // reuse for pause reason
    return this;
  }

  /** Round 20.4: Resume a paused session */
  resume(): this {
    if (this._status !== 'paused') {
      throw new Error(`Cannot resume session in status: ${this._status}`);
    }
    this._status = 'running';
    this._pausedAt = undefined;
    return this;
  }

  /**
   * Round 20.6: Single Spend Truth.
   * When lease exists → delegate to lease.recordSpend(), mirror result.
   * When no lease → local accumulation (legacy fallback).
   */
  trackSpend(cents: number): this {
    if (cents < 0) throw new Error('Spend amount must be non-negative');
    if (this._leaseRef) {
      this._leaseRef.recordSpend(cents);
      // Mirror: _budgetUsedCents syncs from lease for serialization
      this._budgetUsedCents = this._leaseRef.spentCents;
    } else {
      this._budgetUsedCents += cents;
    }
    return this;
  }

  // ── Serialization ───────────────────────────────────────────────

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      manifest: this.manifest,
      parentSessionId: this.parentSessionId,
      proposalId: this.proposalId,
      leaseId: this.leaseId,
      targetCommitmentId: this.targetCommitmentId,
      budgetCents: this.budgetCents,
      budgetUsedCents: this._budgetUsedCents,
      budgetRemaining: this.budgetRemaining,
      status: this._status,
      createdAt: this.createdAt,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      pausedAt: this._pausedAt,
      resultSummary: this._resultSummary,
      mergeResult: this._mergeResult,
      errorDetails: this._errorDetails,
      recallReason: this._recallReason,
    };
  }
}

/**
 * Factory function for creating child sessions.
 */
export function createChildSession(config: ChildSessionConfig): ChildSession {
  return new ChildSession(config);
}
