/**
 * ExecutionEconomicGate — Round 19.3
 *
 * Execution-time economic enforcement. Sits in the materializer's
 * execute() closure between JIT eligibility and business logic execution.
 *
 * Three-layer check:
 * 1. SurvivalGate — tier-based admission (dead/terminal/critical enforcement)
 * 2. ProfitabilityEvaluator — admit/defer/reject based on revenue, cost, survival pressure
 * 3. MandateEngine — spend authorization for cost-bearing tasks
 *
 * Any layer can veto execution. Results are recorded for audit.
 */
import type { Commitment } from '../agenda/commitment-model.js';
import type { SurvivalGate, EnforcementResult } from '../economic/survival-coupling.js';
import type { ProfitabilityEvaluator, ProfitabilityResult, ProfitabilityVerdict } from '../economic/profitability-evaluator.js';
import type { MandateEngine, MandateMatchResult } from '../economic/mandate-engine.js';
import type { EconomicState } from '../economic/economic-state.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

// ── Types ──────────────────────────────────────────────────────────────

export type EconomicAdmission = 'admit' | 'defer' | 'reject';

export interface EconomicGateDecision {
  readonly admission: EconomicAdmission;
  readonly reason: string;
  readonly commitmentId: string;
  /** Which layer produced the decision */
  readonly decidingLayer: 'survival' | 'profitability' | 'mandate' | 'passthrough';
  /** SurvivalGate result (if evaluated) */
  readonly survivalResult?: EnforcementResult;
  /** ProfitabilityEvaluator result (if evaluated) */
  readonly profitabilityResult?: ProfitabilityResult;
  /** MandateEngine match result (if evaluated) */
  readonly mandateResult?: MandateMatchResult;
  readonly timestamp: string;
}

/** Provider interface for current economic state — avoids circular deps */
export interface EconomicStateProvider {
  getCurrentState(): EconomicState;
  getCurrentProjection(): EconomicProjection;
  getEconomicIdentityId(): string;
}

// ── ExecutionEconomicGate ─────────────────────────────────────────────

export class ExecutionEconomicGate {
  private history: EconomicGateDecision[] = [];
  private lastDecision: EconomicGateDecision | null = null;

  constructor(
    private survivalGate: SurvivalGate,
    private profitability: ProfitabilityEvaluator,
    private mandates: MandateEngine,
    private stateProvider: EconomicStateProvider,
  ) {}

  /**
   * Check whether a commitment should be admitted for execution.
   *
   * Flow: SurvivalGate → ProfitabilityEvaluator → MandateEngine
   */
  checkAdmission(commitment: Commitment): EconomicGateDecision {
    const now = new Date().toISOString();
    const state = this.stateProvider.getCurrentState();
    const projection = this.stateProvider.getCurrentProjection();
    const economicId = this.stateProvider.getEconomicIdentityId();

    // ── Layer 1: Survival Gate ──────────────────────────────────────
    const survivalResult = this.survivalGate.canAcceptTask(
      state,
      commitment.revenueBearing ?? false,
      commitment.mustPreserve ?? false,
    );

    if (!survivalResult.allowed) {
      const decision: EconomicGateDecision = {
        admission: 'reject',
        reason: survivalResult.reason ?? 'Survival gate denied',
        commitmentId: commitment.id,
        decidingLayer: 'survival',
        survivalResult,
        timestamp: now,
      };
      this.record(decision);
      return decision;
    }

    // ── Layer 2: Profitability Evaluator ─────────────────────────────
    const profResult = this.profitability.evaluate(commitment, projection);

    if (profResult.verdict === 'reject') {
      const decision: EconomicGateDecision = {
        admission: 'reject',
        reason: profResult.reason,
        commitmentId: commitment.id,
        decidingLayer: 'profitability',
        survivalResult,
        profitabilityResult: profResult,
        timestamp: now,
      };
      this.record(decision);
      return decision;
    }

    if (profResult.verdict === 'defer') {
      const decision: EconomicGateDecision = {
        admission: 'defer',
        reason: profResult.reason,
        commitmentId: commitment.id,
        decidingLayer: 'profitability',
        survivalResult,
        profitabilityResult: profResult,
        timestamp: now,
      };
      this.record(decision);
      return decision;
    }

    // ── Layer 3: Mandate Check (only for cost-bearing tasks) ─────────
    if (commitment.estimatedCostCents > 0) {
      const candidateAction = {
        id: `gate_${commitment.id}`,
        actionKind: 'spend_within_mandate' as const,
        source: 'internal' as const,
        sourceContext: `materializer:${commitment.id}`,
        amountCents: commitment.estimatedCostCents,
        asset: 'USDC',
        purpose: commitment.name,
        riskLevel: 'medium' as const,
        createdAt: now,
      };
      const mandateResult = this.mandates.match(
        candidateAction,
        economicId,
      );

      if (!mandateResult.matched) {
        const decision: EconomicGateDecision = {
          admission: 'reject',
          reason: `No matching mandate: ${mandateResult.rejectionReason}`,
          commitmentId: commitment.id,
          decidingLayer: 'mandate',
          survivalResult,
          profitabilityResult: profResult,
          mandateResult,
          timestamp: now,
        };
        this.record(decision);
        return decision;
      }

      // Consume mandate budget
      this.mandates.consume(mandateResult.mandateId!, commitment.estimatedCostCents);
    }

    // ── All layers passed → Admit ────────────────────────────────────
    const decision: EconomicGateDecision = {
      admission: 'admit',
      reason: `Admitted: ${profResult.reason}`,
      commitmentId: commitment.id,
      decidingLayer: 'passthrough',
      survivalResult,
      profitabilityResult: profResult,
      timestamp: now,
    };
    this.record(decision);
    return decision;
  }

  // ── Queries ─────────────────────────────────────────────────────────

  getLastDecision(): EconomicGateDecision | null {
    return this.lastDecision;
  }

  getHistory(): readonly EconomicGateDecision[] {
    return this.history;
  }

  stats(): { total: number; admitted: number; deferred: number; rejected: number } {
    const counts = { total: 0, admitted: 0, deferred: 0, rejected: 0 };
    for (const d of this.history) {
      counts.total++;
      if (d.admission === 'admit') counts.admitted++;
      else if (d.admission === 'defer') counts.deferred++;
      else counts.rejected++;
    }
    return counts;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private record(decision: EconomicGateDecision): void {
    this.history.push(decision);
    this.lastDecision = decision;
  }
}
