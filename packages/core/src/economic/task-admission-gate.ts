/**
 * Round 20.1 — TaskAdmissionGate
 *
 * Independent admission gate that determines whether an incoming task
 * is worth accepting BEFORE it enters the AgendaArbiter for scheduling.
 *
 * Combines SurvivalGate (tier-based hard constraints) with
 * ProfitabilityEvaluator (economic merit assessment) to produce
 * a unified admit / defer / reject verdict.
 *
 * Architecture Decision AD-1: TaskAdmissionGate is separate from
 * AgendaArbiter. "Is it worth taking?" vs "How to schedule it?"
 * are distinct concerns.
 */
import { SurvivalGate, type EnforcementResult } from './survival-coupling.js';
import { ProfitabilityEvaluator, type ProfitabilityResult } from './profitability-evaluator.js';
import type { EconomicProjection } from './economic-state-service.js';
import type { EconomicState } from './economic-state.js';
import type { Commitment } from '../agenda/commitment-model.js';

// ── Request / Result Contracts ──────────────────────────────────────

export interface TaskAdmissionRequest {
  /** Unique task identifier */
  readonly taskId: string;
  /** Estimated execution cost in cents */
  readonly estimatedCostCents: number;
  /** Estimated revenue from this task in cents */
  readonly estimatedRevenueCents: number;
  /** Whether this task is expected to generate revenue */
  readonly revenueBearing: boolean;
  /** Whether this task must be preserved even under pressure */
  readonly mustPreserve: boolean;
  /** Time sensitivity of the task */
  readonly timeSensitivity: 'immediate' | 'scheduled' | 'flexible';
  /** Risk level of the task */
  readonly riskLevel: 'low' | 'medium' | 'high';
  /** Where the task originated */
  readonly source: 'external' | 'internal' | 'governance';
}

export type SuggestedPriority =
  | 'immediate'
  | 'high'
  | 'normal'
  | 'deferred'
  | 'survival-driven'
  | 'opportunity-driven';

export interface TaskAdmissionResult {
  /** Final admission verdict */
  readonly verdict: 'admit' | 'defer' | 'reject';
  /** Human-readable reason for the verdict */
  readonly reason: string;
  /** Net utility = estimated revenue - estimated cost */
  readonly netUtilityCents: number;
  /** Suggested priority for AgendaArbiter */
  readonly suggestedPriority: SuggestedPriority;
  /** Whether survival pressure caused priority elevation */
  readonly survivalOverride: boolean;
  /** ISO timestamp of admission decision */
  readonly admissionTimestamp: string;
  /** Underlying survival gate result */
  readonly survivalGateResult: EnforcementResult;
  /** Underlying profitability result (if evaluated) */
  readonly profitabilityResult?: ProfitabilityResult;
}

// ── TaskAdmissionGate ───────────────────────────────────────────────

export class TaskAdmissionGate {
  private survivalGate: SurvivalGate;
  private profitabilityEvaluator: ProfitabilityEvaluator;

  constructor(
    survivalGate?: SurvivalGate,
    profitabilityEvaluator?: ProfitabilityEvaluator,
  ) {
    this.survivalGate = survivalGate ?? new SurvivalGate();
    this.profitabilityEvaluator = profitabilityEvaluator ?? new ProfitabilityEvaluator();
  }

  /**
   * Evaluate a task admission request against the current economic state.
   *
   * Decision flow:
   * 1. SurvivalGate hard check → if blocked, reject/defer immediately
   * 2. ProfitabilityEvaluator → economic merit assessment
   * 3. Combine verdicts + compute suggested priority
   */
  evaluate(
    request: TaskAdmissionRequest,
    economicState: EconomicState,
    projection: EconomicProjection,
  ): TaskAdmissionResult {
    const now = new Date().toISOString();
    const netUtility = request.estimatedRevenueCents - request.estimatedCostCents;

    // ── Step 1: Survival gate hard check ──
    const survivalResult = this.survivalGate.canAcceptTask(
      economicState,
      request.revenueBearing,
      request.mustPreserve,
    );

    if (!survivalResult.allowed) {
      // Survival gate blocked → reject or defer based on severity
      const isFatal = economicState.survivalTier === 'dead';
      return {
        verdict: isFatal ? 'reject' : 'defer',
        reason: survivalResult.reason ?? 'Blocked by survival gate',
        netUtilityCents: netUtility,
        suggestedPriority: 'deferred',
        survivalOverride: false,
        admissionTimestamp: now,
        survivalGateResult: survivalResult,
      };
    }

    // ── Step 2: Profitability evaluation ──
    // Build a lightweight Commitment for the evaluator
    const pseudoCommitment = this.buildPseudoCommitment(request);
    const profitResult = this.profitabilityEvaluator.evaluate(pseudoCommitment, projection);

    // ── Step 3: Map profitability verdict to admission result ──
    if (profitResult.verdict === 'reject') {
      return {
        verdict: 'reject',
        reason: profitResult.reason,
        netUtilityCents: netUtility,
        suggestedPriority: 'deferred',
        survivalOverride: false,
        admissionTimestamp: now,
        survivalGateResult: survivalResult,
        profitabilityResult: profitResult,
      };
    }

    if (profitResult.verdict === 'defer') {
      return {
        verdict: 'defer',
        reason: profitResult.reason,
        netUtilityCents: netUtility,
        suggestedPriority: 'deferred',
        survivalOverride: false,
        admissionTimestamp: now,
        survivalGateResult: survivalResult,
        profitabilityResult: profitResult,
      };
    }

    // ── Step 4: Admitted → compute priority ──
    const survivalOverride = this.shouldSurvivalOverride(request, projection);
    const suggestedPriority = this.computePriority(request, profitResult, projection, survivalOverride);

    return {
      verdict: 'admit',
      reason: profitResult.reason,
      netUtilityCents: netUtility,
      suggestedPriority,
      survivalOverride,
      admissionTimestamp: now,
      survivalGateResult: survivalResult,
      profitabilityResult: profitResult,
    };
  }

  /**
   * Batch evaluate multiple requests. Returns results partitioned by verdict.
   */
  evaluateBatch(
    requests: readonly TaskAdmissionRequest[],
    economicState: EconomicState,
    projection: EconomicProjection,
  ): {
    admitted: TaskAdmissionResult[];
    deferred: TaskAdmissionResult[];
    rejected: TaskAdmissionResult[];
  } {
    const admitted: TaskAdmissionResult[] = [];
    const deferred: TaskAdmissionResult[] = [];
    const rejected: TaskAdmissionResult[] = [];

    for (const req of requests) {
      const result = this.evaluate(req, economicState, projection);
      switch (result.verdict) {
        case 'admit': admitted.push(result); break;
        case 'defer': deferred.push(result); break;
        case 'reject': rejected.push(result); break;
      }
    }

    return { admitted, deferred, rejected };
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * Determine if survival pressure should override normal priority.
   * When the agent is under pressure and a revenue-bearing task arrives,
   * it gets boosted to survival-driven priority.
   */
  private shouldSurvivalOverride(
    request: TaskAdmissionRequest,
    projection: EconomicProjection,
  ): boolean {
    const underPressure = projection.survivalTier === 'critical' ||
      projection.survivalTier === 'terminal' ||
      projection.runwayDays <= 7;

    return underPressure && request.revenueBearing;
  }

  /**
   * Compute suggested priority based on all signals.
   */
  private computePriority(
    request: TaskAdmissionRequest,
    profitResult: ProfitabilityResult,
    projection: EconomicProjection,
    survivalOverride: boolean,
  ): SuggestedPriority {
    // Survival override: revenue under pressure → top priority
    if (survivalOverride) return 'survival-driven';

    // Immediate time-sensitive tasks
    if (request.timeSensitivity === 'immediate') return 'immediate';

    // High revenue opportunity
    if (profitResult.netValueCents > 0 && profitResult.strategicValue >= 70) {
      return 'opportunity-driven';
    }

    // Must-preserve tasks
    if (request.mustPreserve) return 'high';

    // Revenue-positive tasks
    if (profitResult.revenuePositive) return 'high';

    // Standard tasks
    if (profitResult.netValueCents >= 0) return 'normal';

    // Negative but admitted (within thresholds)
    return 'deferred';
  }

  /**
   * Build a pseudo-Commitment from a TaskAdmissionRequest so that
   * the existing ProfitabilityEvaluator can evaluate it.
   */
  private buildPseudoCommitment(request: TaskAdmissionRequest): Commitment {
    const now = new Date().toISOString();
    return {
      id: request.taskId,
      name: `task-${request.taskId}`,
      kind: request.revenueBearing ? 'revenue' : 'user-facing',
      origin: request.source === 'external' ? 'external' : (request.source === 'governance' ? 'system' : 'self'),
      status: 'planned',
      priority: request.timeSensitivity === 'immediate' ? 'critical' :
        (request.riskLevel === 'high' ? 'high' : 'normal'),
      expectedValueCents: request.estimatedRevenueCents,
      estimatedCostCents: request.estimatedCostCents,
      mustPreserve: request.mustPreserve,
      revenueBearing: request.revenueBearing,
      taskType: 'admission',
      materializedTaskCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}
