/**
 * Round 18.3 — Settlement System Coupling Layer
 *
 * THE canonical writeback channel from settlement canonical flow
 * into ConShell runtime economic systems. Responsibilities:
 *
 * G1. EconomicStateService writeback (via SpendTracker)
 * G2. TaskFeedbackHeuristic writeback (via TaskCompletionEvent)
 * G3. AgendaGenerator influence (via settlement agenda hints)
 * G4. ProfitabilityEvaluator indirect benefit (through SpendTracker delta)
 * G5. Cross-System Economic Truth Surface
 * G6. Idempotency guard (no duplicate writebacks)
 * G7. Runtime posture signals (income/spend/failure → posture drift)
 * G8. Provider quality surface (success/failure aggregation)
 *
 * Safety invariants:
 * - Only adopted settlements write economic deltas (income/spend)
 * - Failed/rejected settlements NEVER write false economic deltas
 * - Each flowId can only produce one writeback effect (idempotent)
 * - Audit trail captures every writeback attempt
 */

import type { TaskCompletionEvent } from './value-events.js';
import type {
  SettlementRuntimeFlowResult,
  SettlementRuntimeFlowRequest,
  SettlementFlowStage,
} from './settlement-orchestrator.js';

// ── Interfaces for injected systems ──────────────────────────────────

/**
 * Minimal interface for SpendTracker writeback.
 * Matches SpendTracker from spend/index.ts without importing the full module.
 */
export interface SpendTrackerWriteback {
  recordIncome(source: string, amountCents: number, txHash?: string): void;
  recordSpend(
    provider: string,
    costCents: number,
    opts?: { category?: string; description?: string },
  ): boolean;
}

/**
 * Minimal interface for TaskFeedbackHeuristic writeback.
 */
export interface TaskFeedbackWriteback {
  ingest(event: TaskCompletionEvent): void;
}

/**
 * Minimal interface for ProviderSelector quality surface.
 */
export interface ProviderQualityWriteback {
  getProviderStats?(providerId: string): {
    originalTrustScore: number;
    adjustedTrustScore: number;
    penaltyCount: number;
    bonusCount: number;
  } | null;
}

// ── Writeback Effect Record (G6) ─────────────────────────────────────

export interface SettlementWritebackEffect {
  readonly effectId: string;
  readonly sourceFlowId: string;
  readonly effectType: 'adopted' | 'failed';
  readonly economicDelta: {
    readonly direction: string;
    readonly amountCents: number;
    readonly appliedToSpendTracker: boolean;
  };
  readonly taskFeedback: {
    readonly ingested: boolean;
    readonly taskName: string;
    readonly success: boolean;
    readonly netValueCents: number;
  };
  readonly agendaHint: SettlementAgendaHint | null;
  readonly postureSignal: SettlementPostureSignal;
  readonly providerQuality: {
    readonly providerId: string;
    readonly outcome: 'success' | 'failure';
  };
  readonly appliedAt: string;
}

// ── Agenda Hint (G3) ─────────────────────────────────────────────────

export interface SettlementAgendaHint {
  readonly sourceFlowId: string;
  /** Direction of settlement: income boosts, spend constrains */
  readonly influenceDirection: 'boost' | 'constrain' | 'neutral';
  /** Magnitude 0-100 (how much to influence prioritization) */
  readonly influenceMagnitude: number;
  /** Which requirementId was this for */
  readonly requirementId: string;
  /** Settlement amount that drove this hint */
  readonly amountCents: number;
  /** Timestamp */
  readonly createdAt: string;
}

// ── Posture Signal (G7) ──────────────────────────────────────────────

export type PostureDirection = 'relief' | 'pressure' | 'caution' | 'neutral';

export interface SettlementPostureSignal {
  readonly sourceFlowId: string;
  readonly direction: PostureDirection;
  /** Magnitude 0-100 */
  readonly magnitude: number;
  readonly reason: string;
  readonly createdAt: string;
}

// ── Summary Surfaces (G5) ────────────────────────────────────────────

export interface SettlementWritebackSummary {
  readonly totalWritebacks: number;
  readonly adoptedWritebacks: number;
  readonly failedWritebacks: number;
  readonly totalIncomeWrittenCents: number;
  readonly totalSpendWrittenCents: number;
  readonly netEconomicDeltaCents: number;
  readonly effects: readonly SettlementWritebackEffect[];
}

export interface RuntimeEconomicImpactSummary {
  readonly totalSettlementIncomeCents: number;
  readonly totalSettlementSpendCents: number;
  readonly netDeltaCents: number;
  readonly taskFeedbackEventsIngested: number;
  readonly agendaHintsGenerated: number;
  readonly postureSignals: {
    readonly relief: number;
    readonly pressure: number;
    readonly caution: number;
  };
  readonly providerQuality: {
    readonly successCount: number;
    readonly failureCount: number;
  };
}

export interface AgendaEconomicInfluenceSummary {
  readonly totalHints: number;
  readonly boostHints: number;
  readonly constrainHints: number;
  readonly neutralHints: number;
  readonly hints: readonly SettlementAgendaHint[];
}

export interface SystemEconomicTruthSummary {
  readonly generatedAt: string;
  readonly writebackSummary: SettlementWritebackSummary;
  readonly runtimeImpact: RuntimeEconomicImpactSummary;
  readonly agendaInfluence: AgendaEconomicInfluenceSummary;
  readonly postureSignals: readonly SettlementPostureSignal[];
  readonly systemHealthIndicator: 'healthy' | 'under_pressure' | 'critical';
}

// ── Settlement System Coupling (Main Class) ──────────────────────────

let effectCounter = 0;

export class SettlementSystemCoupling {
  // G6: Idempotency registry — prevents duplicate writebacks per flowId
  private readonly appliedEffects = new Map<string, SettlementWritebackEffect>();
  private readonly agendaHints: SettlementAgendaHint[] = [];
  private readonly postureSignals: SettlementPostureSignal[] = [];

  // Counters for impact summary
  private totalIncomeWrittenCents = 0;
  private totalSpendWrittenCents = 0;
  private taskFeedbackEventsIngested = 0;
  private providerSuccessCount = 0;
  private providerFailureCount = 0;

  constructor(
    private readonly spendTracker: SpendTrackerWriteback | null,
    private readonly taskFeedback: TaskFeedbackWriteback | null,
    private readonly providerQuality: ProviderQualityWriteback | null,
  ) {}

  // ── G1: Apply Adopted Settlement ───────────────────────────────────

  applyAdoptedSettlement(
    flowResult: SettlementRuntimeFlowResult,
    request: SettlementRuntimeFlowRequest,
  ): SettlementWritebackEffect {
    // G6: Idempotency check
    const existing = this.appliedEffects.get(flowResult.flowId);
    if (existing) return existing;

    // Safety invariant: only adopted settlements write economic deltas
    if (flowResult.finalStatus !== 'adopted') {
      return this.applyFailedSettlement(flowResult, request);
    }

    const now = new Date().toISOString();
    const effectId = `effect_${++effectCounter}`;

    // ── G1: EconomicStateService writeback via SpendTracker ─────────
    let appliedToSpendTracker = false;
    if (this.spendTracker) {
      if (request.direction === 'income') {
        this.spendTracker.recordIncome(
          `settlement:${flowResult.flowId}`,
          request.amountCents,
          flowResult.receiptId ?? undefined,
        );
        this.totalIncomeWrittenCents += request.amountCents;
        appliedToSpendTracker = true;
      } else if (request.direction === 'spend') {
        const accepted = this.spendTracker.recordSpend(
          `settlement:${request.providerId}`,
          request.amountCents,
          {
            category: 'settlement',
            description: `Settlement ${flowResult.flowId}: ${request.purpose}`,
          },
        );
        if (accepted) {
          this.totalSpendWrittenCents += request.amountCents;
          appliedToSpendTracker = true;
        }
      }
    }

    // ── G2: TaskFeedbackHeuristic writeback ─────────────────────────
    let taskFeedbackIngested = false;
    const netValue = request.direction === 'income'
      ? request.amountCents
      : -request.amountCents;

    if (this.taskFeedback) {
      const event: TaskCompletionEvent = {
        type: 'task_completion',
        taskId: `settlement_${flowResult.flowId}`,
        taskName: `settlement:${request.settlementKind}`,
        success: true,
        actualCostCents: request.direction === 'spend' ? request.amountCents : 0,
        revenueGenerated: request.direction === 'income',
        netValueCents: netValue,
        timestamp: now,
      };
      this.taskFeedback.ingest(event);
      this.taskFeedbackEventsIngested++;
      taskFeedbackIngested = true;
    }

    // ── G3: Agenda Hint generation ─────────────────────────────────
    const hint: SettlementAgendaHint = {
      sourceFlowId: flowResult.flowId,
      influenceDirection: request.direction === 'income' ? 'boost' : 'constrain',
      influenceMagnitude: Math.min(100, Math.round(request.amountCents / 10)),
      requirementId: request.requirementId,
      amountCents: request.amountCents,
      createdAt: now,
    };
    this.agendaHints.push(hint);

    // ── G7: Posture Signal ─────────────────────────────────────────
    const posture: SettlementPostureSignal = {
      sourceFlowId: flowResult.flowId,
      direction: request.direction === 'income' ? 'relief' : 'pressure',
      magnitude: Math.min(100, Math.round(request.amountCents / 10)),
      reason: `Adopted ${request.direction} settlement: ${request.amountCents}¢`,
      createdAt: now,
    };
    this.postureSignals.push(posture);

    // ── G8: Provider quality ───────────────────────────────────────
    this.providerSuccessCount++;

    // ── Build effect record ────────────────────────────────────────
    const effect: SettlementWritebackEffect = {
      effectId,
      sourceFlowId: flowResult.flowId,
      effectType: 'adopted',
      economicDelta: {
        direction: request.direction,
        amountCents: request.amountCents,
        appliedToSpendTracker,
      },
      taskFeedback: {
        ingested: taskFeedbackIngested,
        taskName: `settlement:${request.settlementKind}`,
        success: true,
        netValueCents: netValue,
      },
      agendaHint: hint,
      postureSignal: posture,
      providerQuality: {
        providerId: request.providerId,
        outcome: 'success',
      },
      appliedAt: now,
    };

    this.appliedEffects.set(flowResult.flowId, effect);
    return effect;
  }

  // ── G1 (safety): Apply Failed Settlement ───────────────────────────

  applyFailedSettlement(
    flowResult: SettlementRuntimeFlowResult,
    request: SettlementRuntimeFlowRequest,
  ): SettlementWritebackEffect {
    // G6: Idempotency check
    const existing = this.appliedEffects.get(flowResult.flowId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const effectId = `effect_${++effectCounter}`;

    // Safety invariant #2: failed settlements do NOT write economic deltas:
    // NO spendTracker.recordIncome() or recordSpend()

    // G2: Negative task feedback (task failure signal)
    let taskFeedbackIngested = false;
    if (this.taskFeedback) {
      const event: TaskCompletionEvent = {
        type: 'task_completion',
        taskId: `settlement_failed_${flowResult.flowId}`,
        taskName: `settlement:${request.settlementKind}`,
        success: false,
        actualCostCents: 0, // No cost for failed settlement
        revenueGenerated: false,
        netValueCents: 0,
        timestamp: now,
      };
      this.taskFeedback.ingest(event);
      this.taskFeedbackEventsIngested++;
      taskFeedbackIngested = true;
    }

    // G7: Caution posture signal
    const posture: SettlementPostureSignal = {
      sourceFlowId: flowResult.flowId,
      direction: 'caution',
      magnitude: Math.min(100, Math.round(request.amountCents / 5)), // higher magnitude for failures
      reason: `Failed settlement: ${flowResult.failureReason ?? 'unknown'}`,
      createdAt: now,
    };
    this.postureSignals.push(posture);

    // G8: Provider failure
    this.providerFailureCount++;

    const effect: SettlementWritebackEffect = {
      effectId,
      sourceFlowId: flowResult.flowId,
      effectType: 'failed',
      economicDelta: {
        direction: request.direction,
        amountCents: 0, // No delta for failed
        appliedToSpendTracker: false,
      },
      taskFeedback: {
        ingested: taskFeedbackIngested,
        taskName: `settlement:${request.settlementKind}`,
        success: false,
        netValueCents: 0,
      },
      agendaHint: null, // No agenda hint for failed settlements
      postureSignal: posture,
      providerQuality: {
        providerId: request.providerId,
        outcome: 'failure',
      },
      appliedAt: now,
    };

    this.appliedEffects.set(flowResult.flowId, effect);
    return effect;
  }

  // ── G5: Cross-System Truth Surfaces ────────────────────────────────

  getWritebackSummary(): SettlementWritebackSummary {
    const effects = Array.from(this.appliedEffects.values());
    return {
      totalWritebacks: effects.length,
      adoptedWritebacks: effects.filter(e => e.effectType === 'adopted').length,
      failedWritebacks: effects.filter(e => e.effectType === 'failed').length,
      totalIncomeWrittenCents: this.totalIncomeWrittenCents,
      totalSpendWrittenCents: this.totalSpendWrittenCents,
      netEconomicDeltaCents: this.totalIncomeWrittenCents - this.totalSpendWrittenCents,
      effects,
    };
  }

  getRuntimeImpactSummary(): RuntimeEconomicImpactSummary {
    return {
      totalSettlementIncomeCents: this.totalIncomeWrittenCents,
      totalSettlementSpendCents: this.totalSpendWrittenCents,
      netDeltaCents: this.totalIncomeWrittenCents - this.totalSpendWrittenCents,
      taskFeedbackEventsIngested: this.taskFeedbackEventsIngested,
      agendaHintsGenerated: this.agendaHints.length,
      postureSignals: {
        relief: this.postureSignals.filter(s => s.direction === 'relief').length,
        pressure: this.postureSignals.filter(s => s.direction === 'pressure').length,
        caution: this.postureSignals.filter(s => s.direction === 'caution').length,
      },
      providerQuality: {
        successCount: this.providerSuccessCount,
        failureCount: this.providerFailureCount,
      },
    };
  }

  getAgendaInfluenceSummary(): AgendaEconomicInfluenceSummary {
    return {
      totalHints: this.agendaHints.length,
      boostHints: this.agendaHints.filter(h => h.influenceDirection === 'boost').length,
      constrainHints: this.agendaHints.filter(h => h.influenceDirection === 'constrain').length,
      neutralHints: this.agendaHints.filter(h => h.influenceDirection === 'neutral').length,
      hints: [...this.agendaHints],
    };
  }

  getSystemTruth(): SystemEconomicTruthSummary {
    const impact = this.getRuntimeImpactSummary();

    // Derive system health from posture signals
    const cautionCount = this.postureSignals.filter(s => s.direction === 'caution').length;
    const reliefCount = this.postureSignals.filter(s => s.direction === 'relief').length;
    let healthIndicator: 'healthy' | 'under_pressure' | 'critical';

    if (cautionCount >= 3) {
      healthIndicator = 'critical';
    } else if (cautionCount > reliefCount) {
      healthIndicator = 'under_pressure';
    } else {
      healthIndicator = 'healthy';
    }

    return {
      generatedAt: new Date().toISOString(),
      writebackSummary: this.getWritebackSummary(),
      runtimeImpact: impact,
      agendaInfluence: this.getAgendaInfluenceSummary(),
      postureSignals: [...this.postureSignals],
      systemHealthIndicator: healthIndicator,
    };
  }

  // ── Getters for individual surfaces ────────────────────────────────

  getAgendaHints(): readonly SettlementAgendaHint[] {
    return [...this.agendaHints];
  }

  getPostureSignals(): readonly SettlementPostureSignal[] {
    return [...this.postureSignals];
  }

  getEffectByFlowId(flowId: string): SettlementWritebackEffect | null {
    return this.appliedEffects.get(flowId) ?? null;
  }

  isFlowWrittenBack(flowId: string): boolean {
    return this.appliedEffects.has(flowId);
  }
}
