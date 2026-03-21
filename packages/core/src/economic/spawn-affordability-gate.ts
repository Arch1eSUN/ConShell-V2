/**
 * Round 20.2 — SpawnAffordabilityGate (G5)
 *
 * Evaluates whether spawning a new child session is economically
 * feasible given the current financial state. Goes beyond governance
 * policy to check: reserve sufficiency, runway impact, survival tier,
 * and payoff window.
 */
import type { EconomicProjection } from './economic-state-service.js';

// ── Types ────────────────────────────────────────────────────────────

export interface SpawnBudgetRequest {
  /** Estimated cost of the spawn operation (cents) */
  readonly estimatedCostCents: number;
  /** Expected revenue from spawn (cents, 0 if infra-only) */
  readonly expectedRevenueCents: number;
  /** Maximum allowed budget for spawn (cents) */
  readonly maxBudgetCents: number;
  /** Purpose of spawn */
  readonly purpose: string;
  /** Expected time to payoff (ms) */
  readonly expectedPayoffWindowMs: number;
}

export type SurvivalTier = 'thriving' | 'stable' | 'frugal' | 'critical' | 'terminal';

export interface AffordabilityResult {
  /** Whether the spawn is financially feasible */
  readonly affordable: boolean;
  /** Human-readable reason for the decision */
  readonly reason: string;
  /** Reserve after spawn completes (cents) */
  readonly reserveAfterSpawn: number;
  /** Runway after spawn (days) */
  readonly runwayAfterSpawn: number;
  /** Survival tier after spawn */
  readonly survivalImpact: SurvivalTier;
  /** Expected time to payoff (ms) */
  readonly payoffWindowMs: number;
  /** Net economic impact (expected revenue - estimated cost) */
  readonly netImpactCents: number;
}

// ── Thresholds ───────────────────────────────────────────────────────

/** Minimum reserve to maintain after spawn (cents) */
const MIN_RESERVE_FLOOR_CENTS = 1000;
/** Minimum runway to maintain after spawn (days) */
const MIN_RUNWAY_FLOOR_DAYS = 3;

// ── SpawnAffordabilityGate ──────────────────────────────────────────

export class SpawnAffordabilityGate {
  /**
   * Evaluate whether a spawn is affordable given current economic projection.
   */
  evaluate(request: SpawnBudgetRequest, projection: EconomicProjection): AffordabilityResult {
    const reserveAfterSpawn = projection.reserveCents - request.estimatedCostCents;
    const netImpact = request.expectedRevenueCents - request.estimatedCostCents;

    // Estimate runway after spawn (simple: reserve / daily burn)
    const dailyBurnCents = projection.burnRateCentsPerDay || 1; // avoid div/0
    const runwayAfterSpawn = Math.max(0, reserveAfterSpawn / dailyBurnCents);

    // Determine survival tier impact
    const survivalImpact = this.estimateSurvivalTier(reserveAfterSpawn, runwayAfterSpawn);

    // ── Decision Logic ──

    // Hard reject: spawn would deplete reserve below floor
    if (reserveAfterSpawn < MIN_RESERVE_FLOOR_CENTS) {
      return {
        affordable: false,
        reason: `Spawn would reduce reserve to ${reserveAfterSpawn}¢ (below floor of ${MIN_RESERVE_FLOOR_CENTS}¢)`,
        reserveAfterSpawn,
        runwayAfterSpawn,
        survivalImpact,
        payoffWindowMs: request.expectedPayoffWindowMs,
        netImpactCents: netImpact,
      };
    }

    // Hard reject: runway would fall below minimum
    if (runwayAfterSpawn < MIN_RUNWAY_FLOOR_DAYS) {
      return {
        affordable: false,
        reason: `Spawn would reduce runway to ${runwayAfterSpawn.toFixed(1)} days (below floor of ${MIN_RUNWAY_FLOOR_DAYS} days)`,
        reserveAfterSpawn,
        runwayAfterSpawn,
        survivalImpact,
        payoffWindowMs: request.expectedPayoffWindowMs,
        netImpactCents: netImpact,
      };
    }

    // Hard reject: spawn exceeds max budget
    if (request.estimatedCostCents > request.maxBudgetCents) {
      return {
        affordable: false,
        reason: `Estimated cost ${request.estimatedCostCents}¢ exceeds max budget ${request.maxBudgetCents}¢`,
        reserveAfterSpawn,
        runwayAfterSpawn,
        survivalImpact,
        payoffWindowMs: request.expectedPayoffWindowMs,
        netImpactCents: netImpact,
      };
    }

    // Soft reject: would push into terminal/critical tier
    if (survivalImpact === 'terminal' || survivalImpact === 'critical') {
      return {
        affordable: false,
        reason: `Spawn would push survival tier to '${survivalImpact}'`,
        reserveAfterSpawn,
        runwayAfterSpawn,
        survivalImpact,
        payoffWindowMs: request.expectedPayoffWindowMs,
        netImpactCents: netImpact,
      };
    }

    // Approved
    return {
      affordable: true,
      reason: `Spawn approved: reserve ${reserveAfterSpawn}¢, runway ${runwayAfterSpawn.toFixed(1)} days, tier '${survivalImpact}'`,
      reserveAfterSpawn,
      runwayAfterSpawn,
      survivalImpact,
      payoffWindowMs: request.expectedPayoffWindowMs,
      netImpactCents: netImpact,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private estimateSurvivalTier(reserveCents: number, runwayDays: number): SurvivalTier {
    if (reserveCents <= 0 || runwayDays <= 1) return 'terminal';
    if (reserveCents < 2000 || runwayDays < 3) return 'critical';
    if (reserveCents < 5000 || runwayDays < 7) return 'frugal';
    if (reserveCents < 15000 || runwayDays < 30) return 'stable';
    return 'thriving';
  }
}
