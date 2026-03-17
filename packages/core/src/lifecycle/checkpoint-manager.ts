/**
 * Round 17.3 — CheckpointManager
 *
 * Selective checkpointing of durable contracts for cross-restart recovery.
 * Captures scheduler state, active commitments, latest agenda, and
 * economic snapshot into a single serializable CheckpointData.
 *
 * Recovery produces a reconciliation report showing what was in-flight
 * and what needs to resume.
 */
import type { SchedulerSnapshot } from '../scheduler/scheduler-contract.js';
import type { AgendaResult } from '../agenda/agenda-generator.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

// ── Checkpoint Data ──────────────────────────────────────────────────

export interface CheckpointData {
  /** Scheduler state at checkpoint time */
  readonly schedulerSnapshot: SchedulerSnapshot;
  /** Latest agenda result */
  readonly agendaResult?: AgendaResult;
  /** Economic projection snapshot */
  readonly economicSnapshot?: EconomicProjection;
  /** IDs of active (non-terminal) commitments */
  readonly activeCommitmentIds: string[];
  /** IDs of paid but unfulfilled commitments */
  readonly unfulfilledPaidIds: string[];
  /** Checkpoint creation timestamp */
  readonly timestamp: string;
  /** Checkpoint sequence number (monotonically increasing) */
  readonly sequenceNumber: number;
}

// ── Recovery Report ──────────────────────────────────────────────────

export interface RecoveryReport {
  /** Checkpoint that was used for recovery */
  readonly checkpoint: CheckpointData;
  /** What was the system doing at checkpoint time */
  readonly lastActivity: string;
  /** Scheduler tasks that were in-flight (dispatched but not completed) */
  readonly inFlightTaskIds: string[];
  /** Paid commitments that need fulfillment */
  readonly pendingFulfillment: string[];
  /** Agenda items that need re-evaluation */
  readonly requiresReEvaluation: boolean;
  /** Whether economic state has significantly changed since checkpoint */
  readonly economicDrift: boolean;
  /** Recovery actions taken */
  readonly actions: string[];
}

// ── CheckpointManager ────────────────────────────────────────────────

export class CheckpointManager {
  private checkpoints: CheckpointData[] = [];
  private sequenceCounter = 0;
  private maxCheckpoints: number;

  constructor(maxCheckpoints = 10) {
    this.maxCheckpoints = maxCheckpoints;
  }

  /**
   * Create a checkpoint from current service state.
   */
  createCheckpoint(params: {
    schedulerSnapshot: SchedulerSnapshot;
    agendaResult?: AgendaResult;
    economicSnapshot?: EconomicProjection;
    activeCommitmentIds: string[];
    unfulfilledPaidIds?: string[];
  }): CheckpointData {
    const checkpoint: CheckpointData = {
      schedulerSnapshot: params.schedulerSnapshot,
      agendaResult: params.agendaResult,
      economicSnapshot: params.economicSnapshot,
      activeCommitmentIds: params.activeCommitmentIds,
      unfulfilledPaidIds: params.unfulfilledPaidIds ?? [],
      timestamp: new Date().toISOString(),
      sequenceNumber: ++this.sequenceCounter,
    };

    this.checkpoints.push(checkpoint);

    // Evict oldest if over limit
    while (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift();
    }

    return checkpoint;
  }

  /**
   * Get the latest checkpoint.
   */
  loadLatestCheckpoint(): CheckpointData | null {
    if (this.checkpoints.length === 0) return null;
    return this.checkpoints[this.checkpoints.length - 1]!;
  }

  /**
   * Get checkpoint by sequence number.
   */
  getCheckpoint(sequenceNumber: number): CheckpointData | undefined {
    return this.checkpoints.find(c => c.sequenceNumber === sequenceNumber);
  }

  /**
   * Reconcile a checkpoint with current state — produce a recovery report.
   * This tells you what was happening before shutdown and what needs to resume.
   */
  reconcile(
    checkpoint: CheckpointData,
    currentState: {
      currentCommitmentIds: string[];
      currentProjection?: EconomicProjection;
    },
  ): RecoveryReport {
    const actions: string[] = [];

    // 1. Identify in-flight tasks (dispatched but not completed)
    const inFlightTaskIds = checkpoint.schedulerSnapshot.tasks
      .filter(t => t.status === 'dispatched')
      .map(t => t.id);

    if (inFlightTaskIds.length > 0) {
      actions.push(`Reset ${inFlightTaskIds.length} in-flight task(s) to pending`);
    }

    // 2. Identify pending fulfillment
    const pendingFulfillment = checkpoint.unfulfilledPaidIds;
    if (pendingFulfillment.length > 0) {
      actions.push(`${pendingFulfillment.length} paid commitment(s) need fulfillment`);
    }

    // 3. Check if agenda needs re-evaluation
    const requiresReEvaluation = checkpoint.agendaResult !== undefined;
    if (requiresReEvaluation) {
      actions.push('Agenda requires re-generation with current economic state');
    }

    // 4. Check economic drift
    let economicDrift = false;
    if (checkpoint.economicSnapshot && currentState.currentProjection) {
      const balanceDiff = Math.abs(
        currentState.currentProjection.currentBalanceCents -
        checkpoint.economicSnapshot.currentBalanceCents,
      );
      economicDrift = balanceDiff > 100; // > $1 drift
      if (economicDrift) {
        actions.push(`Economic drift detected: balance changed by ${balanceDiff}¢`);
      }
    }

    // 5. Determine last activity description
    let lastActivity = 'Unknown — no agenda at checkpoint time';
    if (checkpoint.agendaResult && checkpoint.agendaResult.selected.length > 0) {
      const topItem = checkpoint.agendaResult.selected[0]!;
      lastActivity = `Working on: ${topItem.commitment.name} (${topItem.taskCategory})`;
    }

    return {
      checkpoint,
      lastActivity,
      inFlightTaskIds,
      pendingFulfillment,
      requiresReEvaluation,
      economicDrift,
      actions,
    };
  }

  /**
   * Export all checkpoints (for external storage).
   */
  exportAll(): CheckpointData[] {
    return [...this.checkpoints];
  }

  /**
   * Import checkpoints (from external storage).
   */
  importAll(checkpoints: CheckpointData[]): void {
    this.checkpoints = [...checkpoints];
    const maxSeq = checkpoints.reduce((max, c) => Math.max(max, c.sequenceNumber), 0);
    this.sequenceCounter = maxSeq;
  }

  /**
   * Get checkpoint count.
   */
  get count(): number {
    return this.checkpoints.length;
  }
}
