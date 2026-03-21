/**
 * Round 20.5 — ChildOutcomeMerger (G1 + G4)
 *
 * Agenda writeback coordinator: maps terminal child outcomes to parent
 * agenda follow-up actions. Symmetric with TaskSettlementBridge (economic)
 * — this module handles the agenda/commitment side.
 *
 * Responsibilities:
 * 1. Process terminal child outcomes (completed/failed/recalled)
 * 2. Produce ChildOutcomeEvaluation (quality/utility absorption)
 * 3. Determine merge action (follow-up, remediation, requeue, noop)
 * 4. Store results in SessionRegistry for truth surface consumption
 *
 * Consumed by:
 * - LifeCycleEngine (tick/event triggers)
 * - Truth surfaces (evaluation + merge result data)
 * - SpecializationRouter (evaluation data for future routing)
 */
import type { ChildSession, ChildSessionStatus } from './child-session.js';
import type { ChildFundingLease } from './child-funding-lease.js';
import type { SessionRegistry, ChildProgressReport } from './session-registry.js';
import type { TaskSettlementBridge, ChildLeaseSettlementResult } from '../economic/task-settlement-bridge.js';
import type { CommitmentStore } from '../agenda/commitment-store.js';
import { createCommitment } from '../agenda/commitment-model.js';

// ── Evaluation Types ────────────────────────────────────────────────

export type FailureSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ChildOutcomeEvaluation {
  readonly sessionId: string;
  /** 0-100. Rule: completed=80+mergeBonus, failed=0, recalled=30(partial) */
  readonly completionQuality: number;
  /** 0-100. Rule: has mergeResult=70+, no mergeResult=20 */
  readonly mergeUsefulness: number;
  /** Failure severity based on error and budget consumed */
  readonly failureSeverity: FailureSeverity;
  /** 0-100. Based on report frequency and checkpoint consistency */
  readonly reportingReliability: number;
  /** Economic utility realized vs expected */
  readonly utilityRealizedCents: number;
  readonly utilityExpectedCents: number;
  /** realized / expected, 0-1+ range */
  readonly effectivenessRatio: number;
  /** ISO timestamp */
  readonly evaluatedAt: string;
}

// ── Merge Result Types ──────────────────────────────────────────────

export type MergeType =
  | 'commitment_update'     // existing commitment updated
  | 'follow_up'             // new follow-up commitment produced
  | 'remediation'           // retry/fix commitment produced
  | 'requeue'               // parent commitment requeued/deferred
  | 'noop';                 // no parent action needed

/** Round 20.6: What canonical mutation was applied to CommitmentStore */
export type CommitmentMutationType =
  | 'completed'              // target commitment marked completed
  | 'created_follow_up'      // new follow-up commitment added
  | 'created_remediation'    // new remediation commitment added
  | 'deferred'               // target commitment deferred
  | 'dormant'                // target commitment made dormant
  | 'none';                  // no store mutation

/** Round 20.7: How target commitment was resolved */
export type LinkageResolution = 'explicit' | 'delegateChildId' | 'heuristic' | 'none';

export interface ChildMergeResult {
  readonly sessionId: string;
  readonly mergeType: MergeType;
  readonly targetCommitmentId?: string;
  /** Round 20.6: ID of newly created commitment (follow-up/remediation) */
  readonly createdCommitmentId?: string;
  /** Round 20.6: What canonical mutation was applied */
  readonly commitmentMutationType: CommitmentMutationType;
  /** Round 20.7: How target commitment was resolved */
  readonly linkageResolution: LinkageResolution;
  readonly followUpDescription?: string;
  readonly reason: string;
  readonly evaluation: ChildOutcomeEvaluation;
  readonly leaseSettlement?: ChildLeaseSettlementResult;
  readonly mergedAt: string;
}

// ── ChildOutcomeMerger ──────────────────────────────────────────────

export class ChildOutcomeMerger {
  private registry: SessionRegistry;
  private settlementBridge?: TaskSettlementBridge;
  /** Round 20.6: CommitmentStore for deep canonical mutation */
  private commitmentStore?: CommitmentStore;

  // Diagnostics
  private _totalMerged = 0;
  private _mergesByType: Record<string, number> = {};
  /** Round 20.6: commitment mutations executed */
  private _commitmentMutations = 0;

  constructor(
    registry: SessionRegistry,
    settlementBridge?: TaskSettlementBridge,
    commitmentStore?: CommitmentStore,
  ) {
    this.registry = registry;
    this.settlementBridge = settlementBridge;
    this.commitmentStore = commitmentStore;
  }

  /**
   * Process a terminal child session outcome:
   * 1. Evaluate quality/utility
   * 2. Settle lease (if exists, via TaskSettlementBridge)
   * 3. Determine merge action
   * 4. Store evaluation + merge result in registry
   */
  mergeOutcome(session: ChildSession, lease?: ChildFundingLease): ChildMergeResult {
    const now = new Date().toISOString();

    // Guard: must be terminal
    if (!this.isTerminal(session.status)) {
      throw new Error(`Cannot merge non-terminal session (status: ${session.status})`);
    }

    // 1. Evaluate quality/utility
    const evaluation = this.evaluateOutcome(session, lease);

    // 2. Settle lease if present & bridge available
    let leaseSettlement: ChildLeaseSettlementResult | undefined;
    if (lease && this.settlementBridge) {
      leaseSettlement = this.settlementBridge.settleChildLease(lease, session);
    }

    // 3. Determine merge type
    const mergeType = this.determineMergeType(session, evaluation);

    // 3.5 Round 20.6: Execute canonical commitment mutation
    const mutation = this.executeCommitmentMutation(session, mergeType, evaluation);

    // 4. Build merge result
    const mergeResult: ChildMergeResult = {
      sessionId: session.id,
      mergeType,
      targetCommitmentId: mutation.targetCommitmentId,
      createdCommitmentId: mutation.createdCommitmentId,
      commitmentMutationType: mutation.mutationType,
      linkageResolution: mutation.linkageResolution,
      followUpDescription: this.deriveFollowUp(session, mergeType),
      reason: this.buildMergeReason(session, mergeType, evaluation),
      evaluation,
      leaseSettlement,
      mergedAt: now,
    };

    // 5. Store in registry
    this.registry.submitEvaluation(evaluation);
    this.registry.submitMergeResult(mergeResult);

    // 6. Track diagnostics
    this._totalMerged++;
    this._mergesByType[mergeType] = (this._mergesByType[mergeType] ?? 0) + 1;

    return mergeResult;
  }

  // ── Evaluation Logic ─────────────────────────────────────────────

  /**
   * Produce a rule-based, deterministic ChildOutcomeEvaluation.
   * All scoring rules are explicit and testable.
   */
  private evaluateOutcome(session: ChildSession, lease?: ChildFundingLease): ChildOutcomeEvaluation {
    const now = new Date().toISOString();

    // ── Completion quality (0-100) ──
    let completionQuality: number;
    if (session.status === 'completed') {
      completionQuality = 80;
      if (session.mergeResult) completionQuality += 15;  // bonus for producing merge
      completionQuality = Math.min(100, completionQuality);
    } else if (session.status === 'recalled') {
      // Partial completion — scale by budget used
      const utilization = session.budgetCents > 0
        ? (session.budgetUsedCents / session.budgetCents)
        : 0;
      completionQuality = Math.round(30 * utilization);
    } else {
      completionQuality = 0; // failed
    }

    // ── Merge usefulness (0-100) ──
    let mergeUsefulness: number;
    if (session.status === 'completed' && session.mergeResult) {
      mergeUsefulness = 70 + Math.min(30, session.mergeResult.length);
    } else if (session.status === 'completed') {
      mergeUsefulness = 20; // completed but no merge result
    } else {
      mergeUsefulness = 0;
    }

    // ── Failure severity ──
    const failureSeverity = this.assessFailureSeverity(session, lease);

    // ── Reporting reliability (0-100) ──
    const reports = this.registry.getReports(session.id);
    const reportingReliability = this.assessReportingReliability(reports, session);

    // ── Utility ──
    const utilityExpected = lease?.expectedUtilityCents ?? 0;
    let utilityRealized: number;
    if (session.status === 'completed') {
      utilityRealized = utilityExpected;
    } else if (session.status === 'recalled') {
      const utilizationPct = lease ? lease.utilizationPercent / 100 : 0.5;
      utilityRealized = Math.round(utilityExpected * utilizationPct * 0.5);
    } else {
      utilityRealized = 0;
    }

    const effectivenessRatio = utilityExpected > 0
      ? Math.round((utilityRealized / utilityExpected) * 100) / 100
      : 0;

    return {
      sessionId: session.id,
      completionQuality,
      mergeUsefulness,
      failureSeverity,
      reportingReliability,
      utilityRealizedCents: utilityRealized,
      utilityExpectedCents: utilityExpected,
      effectivenessRatio,
      evaluatedAt: now,
    };
  }

  private assessFailureSeverity(session: ChildSession, lease?: ChildFundingLease): FailureSeverity {
    if (session.status !== 'failed') return 'none';

    const budgetWasted = lease ? lease.spentCents : session.budgetUsedCents;
    const totalBudget = lease ? lease.allocatedCents : session.budgetCents;
    const wasteRatio = totalBudget > 0 ? budgetWasted / totalBudget : 0;

    if (wasteRatio > 0.8) return 'critical';
    if (wasteRatio > 0.5) return 'high';
    if (wasteRatio > 0.2) return 'medium';
    return 'low';
  }

  private assessReportingReliability(
    reports: readonly ChildProgressReport[],
    session: ChildSession,
  ): number {
    if (reports.length === 0) return 10; // no reports = low reliability
    const hasCheckpoints = reports.some(r => r.kind === 'checkpoint');
    const hasHeartbeats = reports.some(r => r.kind === 'heartbeat');
    let score = 40; // base for having any reports
    if (hasCheckpoints) score += 30;
    if (hasHeartbeats) score += 20;
    if (reports.length >= 3) score += 10;
    return Math.min(100, score);
  }

  // ── Merge Decision Logic ─────────────────────────────────────────

  private determineMergeType(session: ChildSession, evaluation: ChildOutcomeEvaluation): MergeType {
    switch (session.status) {
      case 'completed':
        if (session.mergeResult) return 'commitment_update';
        return evaluation.completionQuality >= 80 ? 'follow_up' : 'noop';

      case 'failed':
        return evaluation.failureSeverity === 'critical' || evaluation.failureSeverity === 'high'
          ? 'remediation'
          : 'noop';

      case 'recalled':
        return 'requeue';

      default:
        return 'noop';
    }
  }

  private deriveFollowUp(session: ChildSession, mergeType: MergeType): string | undefined {
    switch (mergeType) {
      case 'commitment_update':
        return `Integrate child result: ${session.mergeResult}`;
      case 'follow_up':
        return `Follow up on child completion: ${session.resultSummary ?? 'completed'}`;
      case 'remediation':
        return `Remediate child failure: ${session.errorDetails ?? 'unknown error'}`;
      case 'requeue':
        return `Requeue child task: ${session.manifest.task} (recalled: ${session.recallReason ?? 'governance'})`;
      default:
        return undefined;
    }
  }

  private buildMergeReason(
    session: ChildSession,
    mergeType: MergeType,
    evaluation: ChildOutcomeEvaluation,
  ): string {
    const quality = `quality=${evaluation.completionQuality}`;
    const utility = `utility=${evaluation.effectivenessRatio}`;
    return `${session.status} child → ${mergeType} (${quality}, ${utility})`;
  }

  // ── Queries ──────────────────────────────────────────────────────

  private isTerminal(status: ChildSessionStatus): boolean {
    return ['completed', 'failed', 'recalled'].includes(status);
  }

  // ── Diagnostics ──────────────────────────────────────────────────

  diagnostics() {
    return {
      totalMerged: this._totalMerged,
      mergesByType: { ...this._mergesByType },
      commitmentMutations: this._commitmentMutations,
    };
  }

  // ── Round 20.6: Deep Commitment Mutation ─────────────────────────

  private executeCommitmentMutation(
    session: ChildSession,
    mergeType: MergeType,
    evaluation: ChildOutcomeEvaluation,
  ): { mutationType: CommitmentMutationType; targetCommitmentId?: string; createdCommitmentId?: string; linkageResolution: LinkageResolution } {
    if (!this.commitmentStore) {
      return { mutationType: 'none', linkageResolution: 'none' };
    }

    const store = this.commitmentStore;
    const childSource = `[child:${session.id}]`;

    switch (mergeType) {
      case 'commitment_update': {
        const { id: targetId, resolution } = this.findTargetCommitment(session);
        if (targetId) {
          const existing = store.get(targetId);
          if (existing && existing.status !== 'completed' && existing.status !== 'failed') {
            store.markCompleted(targetId);
            store.update(targetId, {
              description: `${existing.description ?? ''} | Result: ${session.resultSummary ?? session.mergeResult ?? 'completed'} ${childSource}`.trim(),
            });
            this._commitmentMutations++;
            return { mutationType: 'completed', targetCommitmentId: targetId, linkageResolution: resolution };
          }
        }
        return { mutationType: 'none', linkageResolution: resolution };
      }

      case 'follow_up': {
        const followUp = createCommitment({
          name: `Follow-up: ${session.manifest.task} ${childSource}`,
          description: `Follow up on child completion: ${session.resultSummary ?? 'completed'} ${childSource}`,
          kind: 'delegation',
          origin: 'system',
          priority: 'normal',
          taskType: session.manifest.task,
          expectedValueCents: evaluation.utilityRealizedCents,
          estimatedCostCents: 0,
        });
        store.add(followUp);
        this._commitmentMutations++;
        return { mutationType: 'created_follow_up', createdCommitmentId: followUp.id, linkageResolution: 'none' };
      }

      case 'remediation': {
        const remediation = createCommitment({
          name: `Remediation: ${session.manifest.task} ${childSource}`,
          description: `Remediate child failure: ${session.errorDetails ?? 'unknown error'} ${childSource}`,
          kind: 'delegation',
          origin: 'system',
          priority: 'high',
          taskType: session.manifest.task,
          expectedValueCents: evaluation.utilityExpectedCents,
          estimatedCostCents: 0,
        });
        store.add(remediation);
        this._commitmentMutations++;
        return { mutationType: 'created_remediation', createdCommitmentId: remediation.id, linkageResolution: 'none' };
      }

      case 'requeue': {
        const { id: targetId, resolution } = this.findTargetCommitment(session);
        if (targetId) {
          const existing = store.get(targetId);
          if (existing && existing.status !== 'completed' && existing.status !== 'failed') {
            const reason = `Recalled child: ${session.recallReason ?? 'governance'} ${childSource}`;
            if (evaluation.failureSeverity === 'critical' || evaluation.failureSeverity === 'high') {
              store.markDormant(targetId, reason);
              this._commitmentMutations++;
              return { mutationType: 'dormant', targetCommitmentId: targetId, linkageResolution: resolution };
            } else {
              store.markDeferred(targetId, reason);
              this._commitmentMutations++;
              return { mutationType: 'deferred', targetCommitmentId: targetId, linkageResolution: resolution };
            }
          }
        }
        return { mutationType: 'none', linkageResolution: resolution };
      }

      default:
        return { mutationType: 'none', linkageResolution: 'none' };
    }
  }

  /**
   * Find the parent commitment this child session was working on.
   * Uses delegation tracking on commitments.
   */
  private findTargetCommitment(session: ChildSession): { id: string | undefined; resolution: LinkageResolution } {
    if (!this.commitmentStore) return { id: undefined, resolution: 'none' };

    // Tier 1: Explicit linkage via session.targetCommitmentId (Round 20.7)
    if (session.targetCommitmentId) {
      const explicit = this.commitmentStore.get(session.targetCommitmentId);
      if (explicit) return { id: explicit.id, resolution: 'explicit' };
    }

    // Tier 2: Reverse lookup via commitment.delegateChildId
    const commitments = this.commitmentStore.list();
    const delegateMatch = commitments.find(c => c.delegateChildId === session.id);
    if (delegateMatch) return { id: delegateMatch.id, resolution: 'delegateChildId' };

    // Tier 3: Heuristic fallback by task type (legacy)
    const heuristicMatch = commitments.find(
      c => c.kind === 'delegation' && c.taskType === session.manifest.task && c.status === 'active',
    );
    if (heuristicMatch) return { id: heuristicMatch.id, resolution: 'heuristic' };

    return { id: undefined, resolution: 'none' };
  }
}
