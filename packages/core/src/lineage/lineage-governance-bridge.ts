/**
 * LineageGovernanceBridge — Round 19.4
 *
 * Reactive feedback loop between Lineage lifecycle events and
 * upstream systems (Governance, Economic, Identity).
 *
 * When a child's status changes (terminate, degrade, orphan, quarantine),
 * this bridge:
 * 1. Records a governance audit entry for traceability
 * 2. Releases/revokes funding back to parent's economic state
 * 3. Updates lineage health metrics for SurvivalGate/scheduler
 * 4. Tracks cumulative lifecycle statistics for diagnostics
 *
 * "Lineage events are not fire-and-forget — they have systemic consequences."
 */
import type {
  LineageRecord,
  ChildRuntimeStatus,
  TerminationReceipt,
  FundingLease,
  LineageStats,
} from './lineage-contract.js';

// ── Types ──────────────────────────────────────────────────────────────

export type LineageEventKind =
  | 'child_activated'
  | 'child_degraded'
  | 'child_quarantined'
  | 'child_compromised'
  | 'child_recalled'
  | 'child_terminated'
  | 'child_orphaned'
  | 'child_failed'
  | 'funding_exhausted'
  | 'funding_revoked';

export interface LineageLifecycleEvent {
  readonly eventId: string;
  readonly kind: LineageEventKind;
  readonly lineageRecordId: string;
  readonly childId: string;
  readonly parentId: string;
  readonly previousStatus: ChildRuntimeStatus;
  readonly newStatus: ChildRuntimeStatus;
  readonly reason: string;
  readonly actor: string;
  readonly fundingSnapshot: {
    readonly budgetCapCents: number;
    readonly spentCents: number;
    readonly remainingCents: number;
    readonly status: FundingLease['status'];
  };
  readonly timestamp: string;
}

export interface BridgeEffect {
  readonly eventId: string;
  readonly governanceAuditRecorded: boolean;
  readonly fundingReleased: boolean;
  readonly fundingReleasedCents: number;
  readonly concurrencySlotFreed: boolean;
  readonly healthRecalculated: boolean;
  readonly timestamp: string;
}

/** Provider interfaces — avoids circular deps */
export interface GovernanceAuditSink {
  recordLineageEvent(event: LineageLifecycleEvent): void;
}

export interface EconomicFundingRecovery {
  recoverFunding(parentId: string, amountCents: number, reason: string): void;
}

export interface LineageHealthSnapshot {
  readonly activeChildren: number;
  readonly degradedChildren: number;
  readonly totalFundingAtRisk: number;
  readonly healthScore: number; // 0-100
}

/** Round 19.4 P5: Collective peer sync — auto-updates peer status on lineage events */
export interface CollectivePeerSync {
  syncFromLineage(record: LineageRecord): void;
}

// ── LineageGovernanceBridge ────────────────────────────────────────────

export class LineageGovernanceBridge {
  private events: LineageLifecycleEvent[] = [];
  private effects: BridgeEffect[] = [];
  private idCounter = 0;

  // Live counters for health snapshot
  private activeCount = 0;
  private degradedCount = 0;
  private totalFundingAtRisk = 0;

  constructor(
    private governanceAudit: GovernanceAuditSink,
    private economicRecovery: EconomicFundingRecovery,
    private collectiveSync?: CollectivePeerSync,
  ) {}

  /**
   * Process a lineage lifecycle event and produce systemic side effects.
   */
  processLifecycleEvent(
    record: LineageRecord,
    previousStatus: ChildRuntimeStatus,
    newStatus: ChildRuntimeStatus,
    reason: string,
    actor: string = 'system',
  ): BridgeEffect {
    const eventId = `lge_${++this.idCounter}`;
    const now = new Date().toISOString();

    const lease = record.fundingLease;
    const remainingCents = Math.max(0, lease.budgetCapCents - lease.spentCents);

    const event: LineageLifecycleEvent = {
      eventId,
      kind: this.classifyEvent(newStatus, lease),
      lineageRecordId: record.id,
      childId: record.childId,
      parentId: record.parentId,
      previousStatus,
      newStatus,
      reason,
      actor,
      fundingSnapshot: {
        budgetCapCents: lease.budgetCapCents,
        spentCents: lease.spentCents,
        remainingCents,
        status: lease.status,
      },
      timestamp: now,
    };

    this.events.push(event);

    // ── Effect 1: Governance Audit ─────────────────────────────────
    this.governanceAudit.recordLineageEvent(event);

    // ── Effect 2: Funding Recovery ────────────────────────────────
    let fundingReleased = false;
    let fundingReleasedCents = 0;

    const isTerminal = ['recalled', 'terminated', 'failed', 'compromised'].includes(newStatus);
    if (isTerminal && remainingCents > 0) {
      this.economicRecovery.recoverFunding(
        record.parentId,
        remainingCents,
        `Child ${record.childId} ${newStatus}: recovering ${remainingCents}¢`,
      );
      fundingReleased = true;
      fundingReleasedCents = remainingCents;
    }

    // ── Effect 3: Concurrency Slot ────────────────────────────────
    let concurrencySlotFreed = false;
    if (isTerminal || newStatus === 'orphaned') {
      concurrencySlotFreed = true;
    }

    // ── Effect 4: Health Recalculation ─────────────────────────────
    this.updateHealthCounters(previousStatus, newStatus, lease);

    // ── Effect 5: Collective Peer Sync (P5 closure) ───────────────
    if (this.collectiveSync) {
      this.collectiveSync.syncFromLineage(record);
    }

    const effect: BridgeEffect = {
      eventId,
      governanceAuditRecorded: true,
      fundingReleased,
      fundingReleasedCents,
      concurrencySlotFreed,
      healthRecalculated: true,
      timestamp: now,
    };
    this.effects.push(effect);

    return effect;
  }

  // ── Health Snapshot ──────────────────────────────────────────────────

  getHealthSnapshot(): LineageHealthSnapshot {
    return {
      activeChildren: this.activeCount,
      degradedChildren: this.degradedCount,
      totalFundingAtRisk: this.totalFundingAtRisk,
      healthScore: this.computeHealthScore(),
    };
  }

  // ── Queries ─────────────────────────────────────────────────────────

  getEvents(): readonly LineageLifecycleEvent[] {
    return this.events;
  }

  getEffects(): readonly BridgeEffect[] {
    return this.effects;
  }

  stats(): { totalEvents: number; totalFundingRecovered: number; terminalEvents: number } {
    let totalRecovered = 0;
    let terminalEvents = 0;
    for (const e of this.effects) {
      totalRecovered += e.fundingReleasedCents;
      if (e.concurrencySlotFreed) terminalEvents++;
    }
    return { totalEvents: this.events.length, totalFundingRecovered: totalRecovered, terminalEvents };
  }

  // ── Private ─────────────────────────────────────────────────────────

  private classifyEvent(status: ChildRuntimeStatus, lease: FundingLease): LineageEventKind {
    if (lease.status === 'exhausted') return 'funding_exhausted';
    if (lease.status === 'revoked') return 'funding_revoked';

    switch (status) {
      case 'active': return 'child_activated';
      case 'degraded': return 'child_degraded';
      case 'quarantined': return 'child_quarantined';
      case 'compromised': return 'child_compromised';
      case 'recalled': return 'child_recalled';
      case 'terminated': return 'child_terminated';
      case 'orphaned': return 'child_orphaned';
      case 'failed': return 'child_failed';
      default: return 'child_terminated';
    }
  }

  private updateHealthCounters(
    prev: ChildRuntimeStatus,
    next: ChildRuntimeStatus,
    lease: FundingLease,
  ): void {
    // Decrement old status
    if (prev === 'active') this.activeCount = Math.max(0, this.activeCount - 1);
    if (prev === 'degraded') this.degradedCount = Math.max(0, this.degradedCount - 1);

    // Increment new status
    if (next === 'active') this.activeCount++;
    if (next === 'degraded') this.degradedCount++;

    // Update funding at risk
    const remaining = Math.max(0, lease.budgetCapCents - lease.spentCents);
    const isTerminal = ['recalled', 'terminated', 'failed', 'compromised', 'orphaned'].includes(next);
    if (isTerminal) {
      this.totalFundingAtRisk = Math.max(0, this.totalFundingAtRisk - remaining);
    } else if (next === 'active' || next === 'degraded' || next === 'quarantined') {
      this.totalFundingAtRisk += remaining;
    }
  }

  private computeHealthScore(): number {
    if (this.activeCount === 0 && this.degradedCount === 0) return 100; // no children = healthy
    const total = this.activeCount + this.degradedCount;
    if (total === 0) return 100;
    const degradedRatio = this.degradedCount / total;
    return Math.round((1 - degradedRatio) * 100);
  }
}
