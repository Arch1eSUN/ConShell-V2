/**
 * Round 20.2 → 20.5 — TaskSettlementBridge (G2)
 *
 * Independent writeback coordinator that closes the economic loop:
 * task outcome → revenue surface resolution → ledger write → 
 * reserve/runway recalculation → projection refresh.
 *
 * Round 20.5 additions:
 * - settleChildLease() — canonical child lease → ledger writeback
 * - ChildLeaseSettlementResult — structured settlement outcome
 * - Utility realized vs expected tracking
 *
 * Architecture Decision: Bridge is triggered by LifeCycleEngine events
 * but owns the full writeback orchestration. CanonicalSettlementLedger
 * remains the accounting truth. EconomicStateService remains the
 * projection/state truth.
 */
import type { CanonicalSettlementLedger, LedgerDirection, AttributionTarget } from './settlement-ledger.js';
import type { RevenueSurfaceRegistry, TaskRevenueSurface } from './revenue-surface.js';
import type { ChildFundingLease } from '../orchestration/child-funding-lease.js';
import type { ChildSession } from '../orchestration/child-session.js';

// ── Types ────────────────────────────────────────────────────────────

export interface TaskOutcome {
  /** Unique task identifier (matches admission request) */
  readonly taskId: string;
  /** Whether the task completed successfully */
  readonly success: boolean;
  /** Revenue surface ID that generated this task (if revenue-bearing) */
  readonly revenueSurfaceId?: string;
  /** Actual cost incurred during execution (cents) */
  readonly actualCostCents: number;
  /** Actual revenue earned from completion (cents, 0 if failed) */
  readonly actualRevenueCents: number;
  /** Optional reason for failure */
  readonly failureReason?: string;
}

export interface TaskSettlementResult {
  /** Whether writeback succeeded */
  readonly settled: boolean;
  /** Human-readable reason */
  readonly reason: string;
  /** Task ID */
  readonly taskId: string;
  /** Net economic impact (revenue - cost, negative if loss) */
  readonly netImpactCents: number;
  /** Ledger entry IDs created */
  readonly ledgerEntryIds: string[];
  /** Whether reserve was affected */
  readonly reserveAffected: boolean;
  /** ISO timestamp of settlement */
  readonly settledAt: string;
}

export interface BridgeDiagnostics {
  readonly totalSettled: number;
  readonly totalFailed: number;
  readonly totalRevenueCents: number;
  readonly totalCostCents: number;
  readonly netCents: number;
  // Round 20.5
  readonly childLeasesSettled: number;
  readonly childLeasesCostCents: number;
  readonly childLeasesUtilityRealizedCents: number;
}

// ── Child Lease Settlement (Round 20.5 G2) ──────────────────────────

export interface ChildLeaseSettlementResult {
  /** Whether settlement succeeded */
  readonly settled: boolean;
  /** Human-readable reason */
  readonly reason: string;
  /** Lease ID */
  readonly leaseId: string;
  /** Session ID */
  readonly sessionId: string;
  /** Total spend recorded to ledger */
  readonly totalSpendCents: number;
  /** Utility realized vs expected */
  readonly utilityRealizedCents: number;
  readonly utilityExpectedCents: number;
  readonly effectivenessRatio: number;
  /** Close-out type */
  readonly closeOutType: 'success' | 'failure' | 'recall' | 'revoke' | 'expiry';
  /** Close-out reason */
  readonly closeOutReason?: string;
  /** Ledger entry IDs created */
  readonly ledgerEntryIds: string[];
  /** ISO timestamp */
  readonly settledAt: string;
}

// ── TaskSettlementBridge ────────────────────────────────────────────

export class TaskSettlementBridge {
  private ledger: CanonicalSettlementLedger;
  private revenueSurfaces: RevenueSurfaceRegistry;

  // Diagnostics tracking
  private _totalSettled = 0;
  private _totalFailed = 0;
  private _totalRevenueCents = 0;
  private _totalCostCents = 0;
  // Round 20.5: child lease tracking
  private _childLeasesSettled = 0;
  private _childLeasesCostCents = 0;
  private _childLeasesUtilityRealizedCents = 0;

  constructor(
    ledger: CanonicalSettlementLedger,
    revenueSurfaces: RevenueSurfaceRegistry,
  ) {
    this.ledger = ledger;
    this.revenueSurfaces = revenueSurfaces;
  }

  /**
   * Settle a task outcome: write revenue + cost to ledger,
   * update revenue surface stats, and return the net impact.
   */
  settleTaskOutcome(outcome: TaskOutcome): TaskSettlementResult {
    const now = new Date().toISOString();
    const entryIds: string[] = [];
    let reserveAffected = false;

    const attribution: AttributionTarget = {
      kind: 'task',
      targetId: outcome.taskId,
      label: `task-${outcome.taskId}`,
    };

    // ── Record cost (spend) — always, success or failure ──
    if (outcome.actualCostCents > 0) {
      const spendId = this.ledger.recordPending({
        executionRequestId: `spend-${outcome.taskId}`,
        amountCents: outcome.actualCostCents,
        direction: 'spend' as LedgerDirection,
        purpose: `Execution cost for task ${outcome.taskId}`,
        attributionTarget: attribution,
      });
      entryIds.push(spendId);
      this._totalCostCents += outcome.actualCostCents;
      reserveAffected = true;
    }

    // ── Record revenue (income) — only on success ──
    if (outcome.success && outcome.actualRevenueCents > 0) {
      const incomeId = this.ledger.recordPending({
        executionRequestId: `income-${outcome.taskId}`,
        amountCents: outcome.actualRevenueCents,
        direction: 'income' as LedgerDirection,
        purpose: `Revenue from task ${outcome.taskId}`,
        attributionTarget: attribution,
      });
      entryIds.push(incomeId);
      this._totalRevenueCents += outcome.actualRevenueCents;
      reserveAffected = true;

      // Update revenue surface stats if linked
      if (outcome.revenueSurfaceId) {
        const surface = this.revenueSurfaces.get(outcome.revenueSurfaceId);
        if (surface) {
          surface.totalEarnedCents += outcome.actualRevenueCents;
          surface.transactionCount++;
        }
      }
    }

    // ── Record failure ──
    if (!outcome.success) {
      this.ledger.recordFailed({
        executionRequestId: `task-${outcome.taskId}`,
        amountCents: outcome.actualCostCents,
        direction: 'spend',
        failureReason: outcome.failureReason ?? 'Task execution failed',
        verificationOutcome: null,
        attributionTarget: attribution,
      });
      this._totalFailed++;

      return {
        settled: true,
        reason: `Task ${outcome.taskId} failed: cost ${outcome.actualCostCents}¢ recorded as loss`,
        taskId: outcome.taskId,
        netImpactCents: -outcome.actualCostCents,
        ledgerEntryIds: entryIds,
        reserveAffected,
        settledAt: now,
      };
    }

    // ── Success ──
    this._totalSettled++;
    const netImpact = outcome.actualRevenueCents - outcome.actualCostCents;

    return {
      settled: true,
      reason: `Task ${outcome.taskId} settled: revenue ${outcome.actualRevenueCents}¢, cost ${outcome.actualCostCents}¢, net ${netImpact}¢`,
      taskId: outcome.taskId,
      netImpactCents: netImpact,
      ledgerEntryIds: entryIds,
      reserveAffected,
      settledAt: now,
    };
  }

  // ── Round 20.5: Child Lease Settlement ─────────────────────────────

  /**
   * Settle a child funding lease: write actual spend to ledger,
   * compute utility realized vs expected, handle close-out type.
   *
   * This is the canonical economic writeback path for child sessions.
   * ChildOutcomeMerger calls this when processing terminal child outcomes.
   */
  settleChildLease(lease: ChildFundingLease, session: ChildSession): ChildLeaseSettlementResult {
    const now = new Date().toISOString();
    const entryIds: string[] = [];

    const attribution: AttributionTarget = {
      kind: 'session',
      targetId: session.id,
      label: `child-lease-${lease.leaseId}`,
    };

    // Determine close-out type from session status
    let closeOutType: ChildLeaseSettlementResult['closeOutType'];
    let closeOutReason: string | undefined;

    switch (session.status) {
      case 'completed':
        closeOutType = 'success';
        break;
      case 'failed':
        closeOutType = 'failure';
        closeOutReason = session.errorDetails;
        break;
      case 'recalled':
        closeOutType = 'recall';
        closeOutReason = session.recallReason;
        break;
      default:
        // Non-terminal — check lease status
        if (lease.status === 'revoked') {
          closeOutType = 'revoke';
          closeOutReason = lease.revokeReason;
        } else if (lease.status === 'expired') {
          closeOutType = 'expiry';
        } else {
          closeOutType = 'success'; // fallback
        }
    }

    // ── Record spend to ledger ──
    if (lease.spentCents > 0) {
      const spendId = this.ledger.recordPending({
        executionRequestId: `child-spend-${lease.leaseId}`,
        amountCents: lease.spentCents,
        direction: 'spend' as LedgerDirection,
        purpose: `Child lease ${lease.leaseId} (${lease.purpose}): ${closeOutType}`,
        attributionTarget: attribution,
      });
      entryIds.push(spendId);
      this._totalCostCents += lease.spentCents;
      this._childLeasesCostCents += lease.spentCents;
    }

    // ── Record failure if applicable ──
    if (closeOutType === 'failure' || closeOutType === 'recall' || closeOutType === 'revoke') {
      this.ledger.recordFailed({
        executionRequestId: `child-lease-${lease.leaseId}`,
        amountCents: lease.spentCents,
        direction: 'spend',
        failureReason: closeOutReason ?? `Child lease ${closeOutType}`,
        verificationOutcome: null,
        attributionTarget: attribution,
      });
    }

    // ── Compute utility ──
    const utilityExpected = lease.expectedUtilityCents;
    // For successful completion, utility realized = expected * effectiveness
    // For failures, utility realized = 0
    // For partial (recall), utility = proportional to budget consumed
    let utilityRealized: number;
    if (closeOutType === 'success') {
      utilityRealized = utilityExpected;
    } else if (closeOutType === 'recall') {
      // Partial utility based on budget utilization
      utilityRealized = Math.round(utilityExpected * (lease.utilizationPercent / 100) * 0.5);
    } else {
      utilityRealized = 0;
    }

    const effectiveness = utilityExpected > 0 ? utilityRealized / utilityExpected : 0;

    // Settle the lease if not already terminal
    if (!lease.isTerminal) {
      lease.settle();
    }

    this._childLeasesSettled++;
    this._childLeasesUtilityRealizedCents += utilityRealized;

    return {
      settled: true,
      reason: `Child lease ${lease.leaseId} settled (${closeOutType}): spent ${lease.spentCents}¢, utility ${utilityRealized}¢/${utilityExpected}¢`,
      leaseId: lease.leaseId,
      sessionId: session.id,
      totalSpendCents: lease.spentCents,
      utilityRealizedCents: utilityRealized,
      utilityExpectedCents: utilityExpected,
      effectivenessRatio: Math.round(effectiveness * 100) / 100,
      closeOutType,
      closeOutReason,
      ledgerEntryIds: entryIds,
      settledAt: now,
    };
  }

  /**
   * Get bridge diagnostics.
   */
  diagnostics(): BridgeDiagnostics {
    return {
      totalSettled: this._totalSettled,
      totalFailed: this._totalFailed,
      totalRevenueCents: this._totalRevenueCents,
      totalCostCents: this._totalCostCents,
      netCents: this._totalRevenueCents - this._totalCostCents,
      childLeasesSettled: this._childLeasesSettled,
      childLeasesCostCents: this._childLeasesCostCents,
      childLeasesUtilityRealizedCents: this._childLeasesUtilityRealizedCents,
    };
  }
}
