/**
 * Round 20.3 — AgendaLifecycleReconciler
 *
 * Projection-driven state transition coordinator.
 * Called by LifeCycleEngine on each tick to reconcile commitment states
 * against the current economic projection and agenda law verdicts.
 *
 * Consumes AgendaLawEvaluator verdicts to execute state migrations:
 * - dormant/deferred → active (promotion)
 * - active → dormant/deferred (demotion)
 * - deferred/dormant/scheduled → expired (expiry)
 * - planned → scheduled (time-triggered)
 */
import type { Commitment, CommitmentStatus } from './commitment-model.js';
import { isValidTransition, TERMINAL_STATUSES } from './commitment-model.js';
import type { CommitmentStore } from './commitment-store.js';
import type { AgendaLawEvaluator, AgendaLawContext, AgendaLawVerdict } from './agenda-law-evaluator.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

// ── Result Types ──────────────────────────────────────────────────────

export interface StateTransitionRecord {
  commitmentId: string;
  commitmentName: string;
  fromStatus: CommitmentStatus;
  toStatus: CommitmentStatus;
  reason: string;
  verdict: AgendaLawVerdict;
  transitionedAt: string;
}

export interface ReconcileResult {
  promoted: string[];           // dormant/deferred → active
  demoted: string[];            // active → dormant/deferred
  expired: string[];            // → expired
  scheduled: string[];          // planned → scheduled
  unchanged: string[];          // no transition needed
  transitions: StateTransitionRecord[];
  reconciledAt: string;
}

// ── AgendaLifecycleReconciler ─────────────────────────────────────────

export class AgendaLifecycleReconciler {
  private lawEvaluator: AgendaLawEvaluator;
  private transitionHistory: StateTransitionRecord[] = [];

  constructor(lawEvaluator: AgendaLawEvaluator) {
    this.lawEvaluator = lawEvaluator;
  }

  /**
   * Reconcile all non-terminal commitments against the current context.
   * Executes state migrations via CommitmentStore.
   */
  reconcile(
    store: CommitmentStore,
    context: AgendaLawContext,
  ): ReconcileResult {
    const now = new Date().toISOString();
    const promoted: string[] = [];
    const demoted: string[] = [];
    const expired: string[] = [];
    const scheduled: string[] = [];
    const unchanged: string[] = [];
    const transitions: StateTransitionRecord[] = [];

    // Get all non-terminal commitments
    const commitments = store.list().filter(
      c => !TERMINAL_STATUSES.includes(c.status),
    );

    // Evaluate each commitment against the unified law
    const verdicts = this.lawEvaluator.evaluateBatch(commitments, context);

    for (const verdict of verdicts) {
      const commitment = commitments.find(c => c.id === verdict.commitmentId);
      if (!commitment) continue;

      // Skip if recommended status is same as current
      if (verdict.recommendedStatus === commitment.status) {
        unchanged.push(commitment.id);
        continue;
      }

      // Validate the transition is legal
      if (!isValidTransition(commitment.status, verdict.recommendedStatus)) {
        unchanged.push(commitment.id);
        continue;
      }

      // Execute the transition
      const record = this.executeTransition(store, commitment, verdict, now);
      if (record) {
        transitions.push(record);
        this.transitionHistory.push(record);

        // Classify the transition
        switch (verdict.verdict) {
          case 'promote':
            promoted.push(commitment.id);
            break;
          case 'defer':
          case 'dormant':
            demoted.push(commitment.id);
            break;
          case 'expire':
            expired.push(commitment.id);
            break;
          case 'hold':
            // hold → blocked, classified as demoted
            demoted.push(commitment.id);
            break;
          default:
            if (verdict.recommendedStatus === 'scheduled') {
              scheduled.push(commitment.id);
            } else {
              unchanged.push(commitment.id);
            }
        }
      } else {
        unchanged.push(commitment.id);
      }
    }

    return {
      promoted,
      demoted,
      expired,
      scheduled,
      unchanged,
      transitions,
      reconciledAt: now,
    };
  }

  /**
   * Get recent transition history.
   */
  getTransitionHistory(limit = 50): readonly StateTransitionRecord[] {
    return this.transitionHistory.slice(-limit);
  }

  // ── Private ─────────────────────────────────────────────────────────

  private executeTransition(
    store: CommitmentStore,
    commitment: Commitment,
    verdict: AgendaLawVerdict,
    now: string,
  ): StateTransitionRecord | null {
    const primaryReason = verdict.reasons[0]?.explanation ?? 'agenda law reconciliation';

    try {
      switch (verdict.recommendedStatus) {
        case 'active':
          store.markActive(commitment.id);
          break;
        case 'deferred':
          store.markDeferred(commitment.id, primaryReason);
          break;
        case 'dormant':
          store.markDormant(commitment.id, primaryReason);
          break;
        case 'expired':
          store.markExpired(commitment.id);
          break;
        case 'scheduled':
          store.markScheduled(commitment.id);
          break;
        case 'blocked':
          store.markBlocked(commitment.id, primaryReason);
          break;
        default:
          return null;
      }

      return {
        commitmentId: commitment.id,
        commitmentName: commitment.name,
        fromStatus: commitment.status,
        toStatus: verdict.recommendedStatus,
        reason: primaryReason,
        verdict,
        transitionedAt: now,
      };
    } catch {
      // Invalid transition — already validated but store.update may still throw
      return null;
    }
  }
}
