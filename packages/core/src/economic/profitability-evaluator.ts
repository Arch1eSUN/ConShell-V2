/**
 * Round 17.3 — ProfitabilityEvaluator
 *
 * Independent gate that evaluates whether a commitment is worth pursuing
 * BEFORE it enters the agenda ranking. Produces admit/defer/reject verdicts
 * based on expected revenue, cost, survival pressure, and strategic value.
 *
 * This is NOT part of AgendaGenerator — it runs pre-agenda as a first-class
 * admission gate that can also be consumed by governance.
 */
import type { Commitment } from '../agenda/commitment-model.js';
import type { EconomicProjection } from './economic-state-service.js';

// ── Verdict Types ────────────────────────────────────────────────────

export type ProfitabilityVerdict = 'admit' | 'defer' | 'reject';

export interface ProfitabilityResult {
  /** The verdict: admit, defer, or reject */
  readonly verdict: ProfitabilityVerdict;
  /** Human-readable reason for the verdict */
  readonly reason: string;
  /** Commitment ID evaluated */
  readonly commitmentId: string;

  // ── Structured decision flags (G3.2) ──
  /** Task is expected to generate net positive revenue */
  readonly revenuePositive: boolean;
  /** Admitted despite loss because reserve is critical and task is survival-essential */
  readonly reserveCriticalOverride: boolean;
  /** Must do despite negative value (mustPreserve or critical maintenance) */
  readonly mustDoDespiteLoss: boolean;
  /** Deferred because net value is negative and not survival-critical */
  readonly deferDueToNegativeValue: boolean;
  /** Rejected because cost is unsustainable at current economic state */
  readonly rejectDueToUnsustainableCost: boolean;

  // ── Evaluation metrics ──
  /** Expected revenue in cents */
  readonly expectedRevenueCents: number;
  /** Expected cost in cents */
  readonly expectedCostCents: number;
  /** Net value (revenue - cost) */
  readonly netValueCents: number;
  /** Survival value score (0-100) */
  readonly survivalValue: number;
  /** Strategic value score (0-100) */
  readonly strategicValue: number;
}

// ── Thresholds ───────────────────────────────────────────────────────

export interface ProfitabilityThresholds {
  /** Max cost as percentage of current balance before rejection */
  readonly maxCostToBalanceRatio: number;
  /** Minimum runway days below which only revenue/mustPreserve tasks admitted */
  readonly criticalRunwayDays: number;
  /** Net value floor below which task is deferred (cents) */
  readonly deferNetValueFloorCents: number;
}

export const DEFAULT_THRESHOLDS: ProfitabilityThresholds = {
  maxCostToBalanceRatio: 0.5, // reject if cost > 50% of balance
  criticalRunwayDays: 7,
  deferNetValueFloorCents: -500, // defer if net value < -$5.00
};

// ── Evaluator ────────────────────────────────────────────────────────

export class ProfitabilityEvaluator {
  private thresholds: ProfitabilityThresholds;
  private coupling?: import('./settlement-system-coupling.js').SettlementSystemCoupling;

  constructor(thresholds?: Partial<ProfitabilityThresholds>, coupling?: import('./settlement-system-coupling.js').SettlementSystemCoupling) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.coupling = coupling;
  }

  private getDynamicThresholds(): ProfitabilityThresholds {
    let t = this.thresholds;
    if (this.coupling) {
      const truth = this.coupling.getSystemTruth();
      if (truth.systemHealthIndicator === 'critical') {
        t = { ...t, maxCostToBalanceRatio: 0.2, criticalRunwayDays: 14, deferNetValueFloorCents: 0 };
      } else if (truth.systemHealthIndicator === 'under_pressure') {
        t = { ...t, maxCostToBalanceRatio: 0.35, criticalRunwayDays: 10, deferNetValueFloorCents: -200 };
      }
    }
    return t;
  }

  /**
   * Evaluate a single commitment against the current economic projection.
   * Returns a structured ProfitabilityResult with admit/defer/reject verdict.
   */
  evaluate(commitment: Commitment, projection: EconomicProjection): ProfitabilityResult {
    const expectedRevenue = commitment.expectedValueCents;
    const expectedCost = commitment.estimatedCostCents;
    const netValue = expectedRevenue - expectedCost;
    const revenuePositive = netValue > 0;
    const survivalValue = this.computeSurvivalValue(commitment, projection);
    const strategicValue = this.computeStrategicValue(commitment);

    const thresholds = this.getDynamicThresholds();

    // ── Rule 1: mustPreserve always admitted ──
    if (commitment.mustPreserve) {
      return this.buildResult(commitment, 'admit', 'Must-preserve commitment — always admitted', {
        revenuePositive,
        reserveCriticalOverride: false,
        mustDoDespiteLoss: !revenuePositive,
        deferDueToNegativeValue: false,
        rejectDueToUnsustainableCost: false,
        expectedRevenueCents: expectedRevenue,
        expectedCostCents: expectedCost,
        netValueCents: netValue,
        survivalValue,
        strategicValue,
      });
    }

    // ── Rule 2: Critical/terminal runway — only revenue or survival tasks ──
    if (projection.runwayDays <= thresholds.criticalRunwayDays) {
      if (commitment.revenueBearing && revenuePositive) {
        return this.buildResult(commitment, 'admit', `Revenue-positive task admitted under critical runway (${projection.runwayDays}d)`, {
          revenuePositive: true,
          reserveCriticalOverride: true,
          mustDoDespiteLoss: false,
          deferDueToNegativeValue: false,
          rejectDueToUnsustainableCost: false,
          expectedRevenueCents: expectedRevenue,
          expectedCostCents: expectedCost,
          netValueCents: netValue,
          survivalValue,
          strategicValue,
        });
      }
      if (!commitment.revenueBearing) {
        return this.buildResult(commitment, 'defer', `Non-revenue task deferred under critical runway (${projection.runwayDays}d)`, {
          revenuePositive,
          reserveCriticalOverride: false,
          mustDoDespiteLoss: false,
          deferDueToNegativeValue: true,
          rejectDueToUnsustainableCost: false,
          expectedRevenueCents: expectedRevenue,
          expectedCostCents: expectedCost,
          netValueCents: netValue,
          survivalValue,
          strategicValue,
        });
      }
    }

    // ── Rule 3: Cost exceeds balance threshold — reject ──
    if (
      projection.currentBalanceCents > 0 &&
      expectedCost > projection.currentBalanceCents * thresholds.maxCostToBalanceRatio
    ) {
      return this.buildResult(commitment, 'reject', `Cost (${expectedCost}¢) exceeds ${(thresholds.maxCostToBalanceRatio * 100).toFixed(0)}% of balance (${projection.currentBalanceCents}¢)`, {
        revenuePositive,
        reserveCriticalOverride: false,
        mustDoDespiteLoss: false,
        deferDueToNegativeValue: false,
        rejectDueToUnsustainableCost: true,
        expectedRevenueCents: expectedRevenue,
        expectedCostCents: expectedCost,
        netValueCents: netValue,
        survivalValue,
        strategicValue,
      });
    }

    // ── Rule 4: Negative net value below floor — defer ──
    if (netValue < thresholds.deferNetValueFloorCents) {
      return this.buildResult(commitment, 'defer', `Net value (${netValue}¢) below defer floor (${thresholds.deferNetValueFloorCents}¢)`, {
        revenuePositive: false,
        reserveCriticalOverride: false,
        mustDoDespiteLoss: false,
        deferDueToNegativeValue: true,
        rejectDueToUnsustainableCost: false,
        expectedRevenueCents: expectedRevenue,
        expectedCostCents: expectedCost,
        netValueCents: netValue,
        survivalValue,
        strategicValue,
      });
    }

    // ── Rule 5: Revenue-positive — strongly admit ──
    if (revenuePositive) {
      return this.buildResult(commitment, 'admit', `Revenue-positive (net: +${netValue}¢)`, {
        revenuePositive: true,
        reserveCriticalOverride: false,
        mustDoDespiteLoss: false,
        deferDueToNegativeValue: false,
        rejectDueToUnsustainableCost: false,
        expectedRevenueCents: expectedRevenue,
        expectedCostCents: expectedCost,
        netValueCents: netValue,
        survivalValue,
        strategicValue,
      });
    }

    // ── Rule 6: Default — admit with neutral reason ──
    return this.buildResult(commitment, 'admit', `Admitted (net: ${netValue}¢, within thresholds)`, {
      revenuePositive: false,
      reserveCriticalOverride: false,
      mustDoDespiteLoss: false,
      deferDueToNegativeValue: false,
      rejectDueToUnsustainableCost: false,
      expectedRevenueCents: expectedRevenue,
      expectedCostCents: expectedCost,
      netValueCents: netValue,
      survivalValue,
      strategicValue,
    });
  }

  /**
   * Batch evaluate multiple commitments. Returns results partitioned
   * into admitted, deferred, and rejected.
   */
  evaluateBatch(
    commitments: readonly Commitment[],
    projection: EconomicProjection,
  ): {
    admitted: ProfitabilityResult[];
    deferred: ProfitabilityResult[];
    rejected: ProfitabilityResult[];
  } {
    const admitted: ProfitabilityResult[] = [];
    const deferred: ProfitabilityResult[] = [];
    const rejected: ProfitabilityResult[] = [];

    for (const c of commitments) {
      const result = this.evaluate(c, projection);
      switch (result.verdict) {
        case 'admit': admitted.push(result); break;
        case 'defer': deferred.push(result); break;
        case 'reject': rejected.push(result); break;
      }
    }

    return { admitted, deferred, rejected };
  }

  // ── Scoring Helpers ────────────────────────────────────────────────

  private computeSurvivalValue(c: Commitment, proj: EconomicProjection): number {
    let score = 50; // baseline
    if (c.mustPreserve) score += 30;
    if (c.revenueBearing) score += 20;
    if (proj.runwayDays <= 3 && c.revenueBearing) score += 20;
    if (proj.survivalTier === 'critical' || proj.survivalTier === 'terminal') {
      score += c.revenueBearing ? 15 : -15;
    }
    return Math.min(100, Math.max(0, score));
  }

  private computeStrategicValue(c: Commitment): number {
    let score = 50;
    if (c.kind === 'governance') score += 15;
    if (c.kind === 'identity') score += 10;
    if (c.kind === 'maintenance') score += 10;
    if (c.priority === 'critical') score += 20;
    if (c.priority === 'high') score += 10;
    if (c.priority === 'low') score -= 15;
    return Math.min(100, Math.max(0, score));
  }

  private buildResult(
    commitment: Commitment,
    verdict: ProfitabilityVerdict,
    reason: string,
    fields: Omit<ProfitabilityResult, 'verdict' | 'reason' | 'commitmentId'>,
  ): ProfitabilityResult {
    return {
      verdict,
      reason,
      commitmentId: commitment.id,
      ...fields,
    };
  }
}
