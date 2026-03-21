/**
 * CommitmentStore — runtime cache + SQLite-backed persistence.
 *
 * Provides in-memory Map for fast access, synced to CommitmentRepository
 * when available. Supports boot recovery via loadFromRepo().
 */
import type {
  Commitment,
  CommitmentStatus,
  CommitmentKind,
} from './commitment-model.js';
import {
  isValidTransition,
  TERMINAL_STATUSES,
  isSelfPreserving,
} from './commitment-model.js';
import type { CommitmentRepository, CommitmentRow } from '../state/repos/commitment.js';
import type { SovereignIdentityStatus } from '../identity/sovereign-identity-contract.js';

// ── Filter ────────────────────────────────────────────────────────────

export interface CommitmentStoreFilter {
  status?: CommitmentStatus[];
  kind?: CommitmentKind[];
}

// ── Row ↔ Commitment conversion ──────────────────────────────────────

function rowToCommitment(row: CommitmentRow): Commitment {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    kind: row.kind as CommitmentKind,
    origin: row.origin as Commitment['origin'],
    status: row.status as CommitmentStatus,
    priority: row.priority as Commitment['priority'],
    dueAt: row.due_at ?? undefined,
    lastEvaluatedAt: row.last_evaluated_at ?? undefined,
    nextReviewAt: row.next_review_at ?? undefined,
    expectedValueCents: row.expected_value_cents,
    estimatedCostCents: row.estimated_cost_cents,
    mustPreserve: row.must_preserve === 1,
    revenueBearing: row.revenue_bearing === 1,
    taskType: row.task_type,
    blockedReason: row.blocked_reason ?? undefined,
    failedReason: row.failed_reason ?? undefined,
    materializedTaskCount: row.materialized_tasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function commitmentToRow(c: Commitment): CommitmentRow {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    kind: c.kind,
    origin: c.origin,
    status: c.status,
    priority: c.priority,
    due_at: c.dueAt ?? null,
    last_evaluated_at: c.lastEvaluatedAt ?? null,
    next_review_at: c.nextReviewAt ?? null,
    expected_value_cents: c.expectedValueCents,
    estimated_cost_cents: c.estimatedCostCents,
    must_preserve: c.mustPreserve ? 1 : 0,
    revenue_bearing: c.revenueBearing ? 1 : 0,
    task_type: c.taskType,
    blocked_reason: c.blockedReason ?? null,
    failed_reason: c.failedReason ?? null,
    materialized_tasks: c.materializedTaskCount,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// ── CommitmentStore ───────────────────────────────────────────────────

export class CommitmentStore {
  private items = new Map<string, Commitment>();
  private repo?: CommitmentRepository;

  constructor(repo?: CommitmentRepository) {
    this.repo = repo;
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  add(commitment: Commitment): void {
    this.items.set(commitment.id, { ...commitment });
    this.repo?.insert(commitmentToRow(commitment));
  }

  update(id: string, patch: Partial<Commitment>): void {
    const existing = this.items.get(id);
    if (!existing) return;

    // If status changing, validate transition
    if (patch.status && patch.status !== existing.status) {
      if (!isValidTransition(existing.status, patch.status)) {
        throw new Error(
          `Invalid commitment transition: ${existing.status} → ${patch.status}`,
        );
      }
    }

    const updated: Commitment = {
      ...existing,
      ...patch,
      id: existing.id,          // immutable
      createdAt: existing.createdAt, // immutable
      updatedAt: new Date().toISOString(),
    };
    this.items.set(id, updated);
    this.repo?.update(commitmentToRow(updated));
  }

  get(id: string): Commitment | undefined {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }

  list(filter?: CommitmentStoreFilter): readonly Commitment[] {
    let result = Array.from(this.items.values());

    if (filter?.status) {
      const statuses = new Set(filter.status);
      result = result.filter(c => statuses.has(c.status));
    }
    if (filter?.kind) {
      const kinds = new Set(filter.kind);
      result = result.filter(c => kinds.has(c.kind));
    }

    return result;
  }

  // ── Status shortcuts ────────────────────────────────────────────────

  markCompleted(id: string): void {
    this.update(id, { status: 'completed' });
    this.repo?.markStatus(id, 'completed');
  }

  markBlocked(id: string, reason: string): void {
    this.update(id, { status: 'blocked', blockedReason: reason });
    this.repo?.markStatus(id, 'blocked', reason);
  }

  markFailed(id: string, reason: string): void {
    this.update(id, { status: 'failed', failedReason: reason });
    this.repo?.markStatus(id, 'failed', reason);
  }

  markActive(id: string): void {
    this.update(id, { status: 'active' });
    this.repo?.markStatus(id, 'active');
  }

  markAbandoned(id: string): void {
    this.update(id, { status: 'abandoned' });
    this.repo?.markStatus(id, 'abandoned');
  }

  // ── Round 20.3: Long-horizon status shortcuts ───────────────────────

  markDeferred(id: string, reason: string): void {
    this.update(id, { status: 'deferred', deferredReason: reason, lastStateTransitionAt: new Date().toISOString() });
    this.repo?.markStatus(id, 'deferred', reason);
  }

  markDormant(id: string, reason: string): void {
    this.update(id, { status: 'dormant', dormantReason: reason, lastStateTransitionAt: new Date().toISOString() });
    this.repo?.markStatus(id, 'dormant', reason);
  }

  markScheduled(id: string): void {
    this.update(id, { status: 'scheduled', lastStateTransitionAt: new Date().toISOString() });
    this.repo?.markStatus(id, 'scheduled');
  }

  markExpired(id: string): void {
    this.update(id, { status: 'expired', lastStateTransitionAt: new Date().toISOString() });
    this.repo?.markStatus(id, 'expired');
  }

  // ── Queries ─────────────────────────────────────────────────────────

  /** Commitments whose dueAt <= now and still actionable */
  due(now: string): readonly Commitment[] {
    return Array.from(this.items.values()).filter(
      c =>
        c.dueAt !== undefined &&
        c.dueAt <= now &&
        !TERMINAL_STATUSES.includes(c.status),
    );
  }

  /** Commitments whose nextReviewAt <= now and still actionable */
  nextReviewable(now: string): readonly Commitment[] {
    return Array.from(this.items.values()).filter(
      c =>
        c.nextReviewAt !== undefined &&
        c.nextReviewAt <= now &&
        !TERMINAL_STATUSES.includes(c.status),
    );
  }

  // ── Execution Eligibility (Round 18.9, enhanced Round 19.2) ─────────

  /**
   * Canonical predicate for stale snapshot suppression.
   * Determines if a commitment from the scheduler is still eligible for execution.
   *
   * @param id - Commitment ID to check
   * @param snapshotUpdatedAt - Optional: the commitment's updatedAt value at scheduler dispatch time.
   *   If provided, the commitment must not have been modified since then (drift detection).
   */
  isExecutionEligible(id: string, snapshotUpdatedAt?: string): { eligible: boolean; reason?: string } {
    const commitment = this.items.get(id);
    if (!commitment) {
      return { eligible: false, reason: 'Commitment not found in active store' };
    }

    if (TERMINAL_STATUSES.includes(commitment.status)) {
      return { eligible: false, reason: `Commitment is in terminal state: ${commitment.status}` };
    }

    if (commitment.status === 'blocked') {
      return { eligible: false, reason: `Commitment is blocked: ${commitment.blockedReason || 'unknown'}` };
    }

    // Round 19.2: Stale snapshot drift detection
    if (snapshotUpdatedAt && commitment.updatedAt > snapshotUpdatedAt) {
      return {
        eligible: false,
        reason: `Stale snapshot: commitment modified since dispatch (dispatch=${snapshotUpdatedAt}, current=${commitment.updatedAt})`,
      };
    }

    return { eligible: true };
  }

  /**
   * Check if a commitment has been modified since a given timestamp.
   * Utility for scheduler and materializer to detect live-drift.
   */
  isStaleSnapshot(id: string, scheduledAt: string): boolean {
    const commitment = this.items.get(id);
    if (!commitment) return true; // Not found = treat as stale
    return commitment.updatedAt > scheduledAt;
  }

  // ── Boot recovery ───────────────────────────────────────────────────

  /**
   * Load active commitments from SQLite repo (boot recovery).
   * - active → reset to planned (await next review)
   * - blocked → preserved as-is
   * - completed/failed/abandoned → NOT loaded
   */
  loadFromRepo(): number {
    if (!this.repo) return 0;

    const rows = this.repo.loadActive();
    let loaded = 0;

    for (const row of rows) {
      const commitment = rowToCommitment(row);
      // Reset active to planned on restart
      if (commitment.status === 'active') {
        commitment.status = 'planned';
        commitment.recoveredFromCrash = true;
        commitment.updatedAt = new Date().toISOString();
      }
      this.items.set(commitment.id, commitment);
      loaded++;
    }

    return loaded;
  }

  // ── Identity re-evaluation (Round 16.2) ──────────────────────────────

  /**
   * Re-evaluate all active commitments when identity status changes.
   *
   * - revoked → abandon all non-self-preserving active commitments
   * - degraded/recovering → block non-essential/non-mustPreserve commitments
   * - active (restored) → unblock previously identity-blocked commitments
   */
  reEvaluateForIdentityChange(newStatus: SovereignIdentityStatus): number {
    let affected = 0;
    const now = new Date().toISOString();

    for (const [id, commitment] of this.items) {
      // Skip terminal commitments
      if (TERMINAL_STATUSES.includes(commitment.status)) continue;

      if (newStatus === 'revoked') {
        // Revoked: abandon everything except self-preserving commitments
        if (!isSelfPreserving(commitment)) {
          commitment.status = 'abandoned';
          commitment.failedReason = 'identity-revoked';
          commitment.updatedAt = now;
          this.items.set(id, commitment);
          this.repo?.markStatus(id, 'abandoned', 'identity-revoked');
          affected++;
        }
      } else if (newStatus === 'degraded' || newStatus === 'recovering') {
        // Degraded/recovering: block non-essential commitments
        if (!commitment.mustPreserve && !isSelfPreserving(commitment) && commitment.status !== 'blocked') {
          commitment.status = 'blocked';
          commitment.blockedReason = `identity-${newStatus}`;
          commitment.updatedAt = now;
          this.items.set(id, commitment);
          this.repo?.markStatus(id, 'blocked', `identity-${newStatus}`);
          affected++;
        }
      } else if (newStatus === 'active') {
        // Active (restored): unblock commitments that were identity-blocked
        if (
          commitment.status === 'blocked' &&
          commitment.blockedReason?.startsWith('identity-')
        ) {
          commitment.status = 'planned';
          commitment.blockedReason = undefined;
          commitment.updatedAt = now;
          this.items.set(id, commitment);
          this.repo?.markStatus(id, 'planned');
          affected++;
        }
      }
    }

    return affected;
  }

  /** Get all commitments created with a specific identity */
  getByIdentityId(identityId: string): readonly Commitment[] {
    return Array.from(this.items.values()).filter(
      c => c.identityContext?.identityId === identityId,
    );
  }

  // ── Diagnostics ─────────────────────────────────────────────────────

  get size(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }
}
