/**
 * Round 20.1 — TaskAdmissionGate tests
 */
import { describe, it, expect } from 'vitest';
import { TaskAdmissionGate, type TaskAdmissionRequest } from './task-admission-gate.js';
import { SurvivalGate } from './survival-coupling.js';
import { ProfitabilityEvaluator } from './profitability-evaluator.js';
import { buildEconomicState, type EconomicState } from './economic-state.js';
import type { EconomicProjection } from './economic-state-service.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<TaskAdmissionRequest> = {}): TaskAdmissionRequest {
  return {
    taskId: overrides.taskId ?? 'task-1',
    estimatedCostCents: overrides.estimatedCostCents ?? 100,
    estimatedRevenueCents: overrides.estimatedRevenueCents ?? 500,
    revenueBearing: overrides.revenueBearing ?? true,
    mustPreserve: overrides.mustPreserve ?? false,
    timeSensitivity: overrides.timeSensitivity ?? 'flexible',
    riskLevel: overrides.riskLevel ?? 'low',
    source: overrides.source ?? 'external',
  };
}

function makeEconomicState(overrides: Partial<Parameters<typeof buildEconomicState>[0]> = {}): EconomicState {
  return buildEconomicState({
    balanceCents: overrides.balanceCents ?? 50_000,
    totalSpendCents: overrides.totalSpendCents ?? 10_000,
    totalIncomeCents: overrides.totalIncomeCents ?? 60_000,
    burnRateCentsPerDay: overrides.burnRateCentsPerDay ?? 500,
    dailyIncomeCents: overrides.dailyIncomeCents ?? 800,
    survivalTier: overrides.survivalTier ?? 'normal',
  });
}

function makeProjection(overrides: Partial<EconomicProjection> = {}): EconomicProjection {
  return {
    totalRevenueCents: overrides.totalRevenueCents ?? 60_000,
    totalSpendCents: overrides.totalSpendCents ?? 10_000,
    currentBalanceCents: overrides.currentBalanceCents ?? 50_000,
    reserveCents: overrides.reserveCents ?? 49_000,
    burnRateCentsPerDay: overrides.burnRateCentsPerDay ?? 500,
    dailyRevenueCents: overrides.dailyRevenueCents ?? 800,
    netFlowCentsPerDay: overrides.netFlowCentsPerDay ?? 300,
    runwayDays: overrides.runwayDays ?? 100,
    survivalTier: overrides.survivalTier ?? 'normal',
    isSelfSustaining: overrides.isSelfSustaining ?? true,
    revenueBySource: overrides.revenueBySource ?? {},
    projectedAt: overrides.projectedAt ?? new Date().toISOString(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('TaskAdmissionGate', () => {
  const gate = new TaskAdmissionGate();

  describe('healthy state admission', () => {
    it('admits revenue-bearing task with high priority', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: true, estimatedRevenueCents: 1000, estimatedCostCents: 200 }),
        makeEconomicState(),
        makeProjection(),
      );
      expect(result.verdict).toBe('admit');
      expect(result.netUtilityCents).toBe(800);
      expect(result.survivalOverride).toBe(false);
    });

    it('admits must-preserve task even with negative net utility', () => {
      const result = gate.evaluate(
        makeRequest({ mustPreserve: true, revenueBearing: false, estimatedRevenueCents: 0, estimatedCostCents: 100 }),
        makeEconomicState(),
        makeProjection(),
      );
      expect(result.verdict).toBe('admit');
      expect(result.suggestedPriority).toBe('high');
    });

    it('admits non-revenue task in healthy state', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: false, estimatedRevenueCents: 0, estimatedCostCents: 50 }),
        makeEconomicState(),
        makeProjection(),
      );
      expect(result.verdict).toBe('admit');
    });
  });

  describe('survival gate blocking', () => {
    it('defers non-revenue task in critical tier', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: false, mustPreserve: false }),
        makeEconomicState({ survivalTier: 'critical', balanceCents: 500 }),
        makeProjection({ survivalTier: 'critical', runwayDays: 1 }),
      );
      expect(result.verdict).toBe('defer');
      expect(result.reason).toContain('Critical');
    });

    it('rejects all tasks when dead', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: true }),
        makeEconomicState({ survivalTier: 'dead', balanceCents: 0 }),
        makeProjection({ survivalTier: 'dead', runwayDays: 0 }),
      );
      expect(result.verdict).toBe('reject');
    });

    it('admits revenue-bearing task in terminal tier (survival gate exemption)', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: true, estimatedRevenueCents: 500, estimatedCostCents: 10 }),
        makeEconomicState({ survivalTier: 'terminal', balanceCents: 100 }),
        makeProjection({ survivalTier: 'terminal', runwayDays: 0 }),
      );
      // Survival gate allows revenue-bearing in terminal, then profitability evaluates
      expect(result.verdict).toBe('admit');
      expect(result.survivalOverride).toBe(true);
      expect(result.suggestedPriority).toBe('survival-driven');
    });
  });

  describe('profitability evaluation', () => {
    it('rejects task whose cost exceeds balance threshold', () => {
      const result = gate.evaluate(
        makeRequest({ estimatedCostCents: 30_000, estimatedRevenueCents: 0, revenueBearing: false }),
        makeEconomicState({ balanceCents: 50_000 }),
        makeProjection({ currentBalanceCents: 50_000 }),
      );
      expect(result.verdict).toBe('reject');
      expect(result.reason).toContain('exceeds');
    });

    it('defers task with deeply negative net value', () => {
      const result = gate.evaluate(
        makeRequest({ estimatedCostCents: 1000, estimatedRevenueCents: 100, revenueBearing: false }),
        makeEconomicState(),
        makeProjection(),
      );
      // Net = 100 - 1000 = -900 which is below deferNetValueFloorCents (-500)
      expect(result.verdict).toBe('defer');
    });
  });

  describe('survival override priority', () => {
    it('boosts revenue task to survival-driven when under pressure', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: true, estimatedRevenueCents: 500, estimatedCostCents: 100 }),
        makeEconomicState({ survivalTier: 'frugal', balanceCents: 3000, burnRateCentsPerDay: 500 }),
        makeProjection({ survivalTier: 'frugal', runwayDays: 6 }),
      );
      expect(result.verdict).toBe('admit');
      expect(result.survivalOverride).toBe(true);
      expect(result.suggestedPriority).toBe('survival-driven');
    });

    it('does not boost non-revenue task even under pressure', () => {
      const result = gate.evaluate(
        makeRequest({ revenueBearing: false, estimatedRevenueCents: 0, estimatedCostCents: 50 }),
        makeEconomicState({ survivalTier: 'frugal', balanceCents: 3000, burnRateCentsPerDay: 500 }),
        makeProjection({ survivalTier: 'frugal', runwayDays: 6 }),
      );
      // Non-revenue task under critical runway (≤7d) is correctly deferred by ProfitabilityEvaluator
      expect(result.verdict).toBe('defer');
      expect(result.survivalOverride).toBe(false);
    });
  });

  describe('priority computation', () => {
    it('assigns immediate priority to time-sensitive tasks', () => {
      const result = gate.evaluate(
        makeRequest({ timeSensitivity: 'immediate' }),
        makeEconomicState(),
        makeProjection(),
      );
      expect(result.verdict).toBe('admit');
      expect(result.suggestedPriority).toBe('immediate');
    });
  });

  describe('batch evaluation', () => {
    it('partitions results by verdict', () => {
      const requests: TaskAdmissionRequest[] = [
        makeRequest({ taskId: 'admit-1', revenueBearing: true, estimatedRevenueCents: 500 }),
        makeRequest({ taskId: 'costly-1', estimatedCostCents: 30_000, estimatedRevenueCents: 0, revenueBearing: false }),
      ];

      const { admitted, deferred, rejected } = gate.evaluateBatch(
        requests,
        makeEconomicState(),
        makeProjection(),
      );

      expect(admitted.length).toBeGreaterThanOrEqual(1);
      expect(admitted.some(r => r.netUtilityCents > 0)).toBe(true);
      expect(rejected.length + deferred.length).toBeGreaterThanOrEqual(1);
    });
  });
});
