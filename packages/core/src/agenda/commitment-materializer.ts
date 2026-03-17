/**
 * CommitmentMaterializer — converts Commitments into executable QueuedTasks
 * and handles result callbacks to update commitment lifecycle.
 *
 * Supports 3 commitment kinds:
 * - revenue: generates revenue-bearing tasks
 * - maintenance: generates mustPreserve infrastructure tasks
 * - governance/memory/identity: generates low-cost check tasks
 */
import type { Commitment } from './commitment-model.js';
import type { CommitmentStore } from './commitment-store.js';

// ── Minimal task descriptor (compatible with TaskQueue) ───────────────

export interface MaterializedTask {
  /** Maps to QueuedTask fields */
  taskType: string;
  taskName: string;
  description: string;
  isRevenueBearing: boolean;
  estimatedCostCents: number;
  expectedRevenueCents: number;
  priority: number;
  commitmentId: string;
  /** Child agent ID for delegation tasks (Round 16.5) */
  delegateChildId?: string;
}

export type TaskResult = 'success' | 'failure' | 'blocked';

// ── CommitmentMaterializer ────────────────────────────────────────────

export class CommitmentMaterializer {

  /**
   * Materialize a commitment into a concrete task descriptor.
   * The caller is responsible for enqueuing this into TaskQueue.
   */
  materialize(commitment: Commitment): MaterializedTask {
    const base: MaterializedTask = {
      taskType: commitment.taskType,
      taskName: `cmt:${commitment.name}`,
      description: commitment.description ?? commitment.name,
      isRevenueBearing: commitment.revenueBearing,
      estimatedCostCents: commitment.estimatedCostCents,
      expectedRevenueCents: commitment.expectedValueCents,
      priority: this.computePriority(commitment),
      commitmentId: commitment.id,
    };

    // Kind-specific adjustments
    switch (commitment.kind) {
      case 'revenue':
        base.isRevenueBearing = true;
        break;
      case 'maintenance':
        // Maintenance tasks get a priority floor to avoid starvation
        base.priority = Math.max(base.priority, 40);
        break;
      case 'governance':
      case 'memory':
      case 'identity':
        // Low-cost check tasks
        base.estimatedCostCents = Math.min(base.estimatedCostCents, 10);
        break;
      case 'delegation':
        // Delegation tasks carry the child ID (Round 16.5)
        base.taskType = 'delegate-to-child';
        base.delegateChildId = commitment.delegateChildId;
        base.priority = Math.max(base.priority, 50);
        break;
      default:
        break;
    }

    return base;
  }

  /**
   * Handle the result of a materialized task execution.
   * Updates the commitment status in the store.
   */
  handleTaskResult(
    commitmentId: string,
    result: TaskResult,
    store: CommitmentStore,
    reason?: string,
  ): void {
    const commitment = store.get(commitmentId);
    if (!commitment) return;

    switch (result) {
      case 'success':
        store.markCompleted(commitmentId);
        break;
      case 'failure':
        store.markFailed(commitmentId, reason ?? 'Task execution failed');
        break;
      case 'blocked':
        store.markBlocked(commitmentId, reason ?? 'Task execution blocked');
        break;
    }
  }

  /**
   * Handle the result of a delegation task.
   * Updates commitment's delegationStatus accordingly.
   * (Round 16.5)
   */
  handleDelegationResult(
    commitmentId: string,
    result: TaskResult,
    store: CommitmentStore,
    reason?: string,
  ): void {
    const commitment = store.get(commitmentId);
    if (!commitment || commitment.kind !== 'delegation') return;

    switch (result) {
      case 'success':
        store.update(commitmentId, { delegationStatus: 'completed' });
        store.markCompleted(commitmentId);
        break;
      case 'failure':
        store.update(commitmentId, { delegationStatus: 'failed' });
        store.markFailed(commitmentId, reason ?? 'Delegation task failed');
        break;
      case 'blocked':
        store.update(commitmentId, { delegationStatus: 'pending' });
        store.markBlocked(commitmentId, reason ?? 'Delegation task blocked');
        break;
    }
  }

  // ── Internal ────────────────────────────────────────────────────────

  private computePriority(c: Commitment): number {
    const priorityMap: Record<string, number> = {
      critical: 90,
      high: 70,
      normal: 50,
      low: 30,
    };
    let priority = priorityMap[c.priority] ?? 50;

    // Revenue-bearing gets a boost
    if (c.revenueBearing) priority += 10;
    // Must-preserve gets a floor
    if (c.mustPreserve) priority = Math.max(priority, 60);

    return Math.min(100, priority);
  }
}
