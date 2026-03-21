/**
 * Round 20.2 — SpawnAffordabilityGate Tests (G5)
 */
import { describe, it, expect } from 'vitest';
import { SpawnAffordabilityGate, type SpawnBudgetRequest } from './spawn-affordability-gate.js';
import type { EconomicProjection } from './economic-state-service.js';

function makeProjection(overrides: Partial<EconomicProjection> = {}): EconomicProjection {
  return {
    reserveCents: 20000,
    burnRateCentsPerDay: 500,
    runwayDays: 40,
    survivalTier: 'thriving',
    projectedRevenueCentsPerDay: 800,
    netFlowCentsPerDay: 300,
    ...overrides,
  } as EconomicProjection;
}

function makeRequest(overrides: Partial<SpawnBudgetRequest> = {}): SpawnBudgetRequest {
  return {
    estimatedCostCents: 2000,
    expectedRevenueCents: 5000,
    maxBudgetCents: 10000,
    purpose: 'test spawn',
    expectedPayoffWindowMs: 120_000,
    ...overrides,
  };
}

describe('SpawnAffordabilityGate', () => {
  const gate = new SpawnAffordabilityGate();

  it('approves affordable spawn with healthy reserve', () => {
    const result = gate.evaluate(makeRequest(), makeProjection());
    expect(result.affordable).toBe(true);
    expect(result.reserveAfterSpawn).toBe(18000);
    expect(result.netImpactCents).toBe(3000); // 5000 - 2000
  });

  it('rejects spawn that depletes reserve below floor', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 19500 }),
      makeProjection({ reserveCents: 20000 }),
    );
    expect(result.affordable).toBe(false);
    expect(result.reason).toContain('below floor');
  });

  it('rejects spawn that reduces runway below floor', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 1000 }),
      makeProjection({ reserveCents: 2500, burnRateCentsPerDay: 1000 }),
    );
    expect(result.affordable).toBe(false);
    expect(result.runwayAfterSpawn).toBeLessThan(3);
  });

  it('rejects spawn exceeding max budget', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 15000, maxBudgetCents: 10000 }),
      makeProjection(),
    );
    expect(result.affordable).toBe(false);
    expect(result.reason).toContain('exceeds max budget');
  });

  it('rejects spawn that would push to critical tier', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 3000, maxBudgetCents: 5000 }),
      makeProjection({ reserveCents: 4500, burnRateCentsPerDay: 600 }),
    );
    expect(result.affordable).toBe(false);
    expect(result.survivalImpact).toBe('critical');
  });

  it('approves spawn in frugal projection that stays stable', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 500 }),
      makeProjection({ reserveCents: 8000, burnRateCentsPerDay: 200 }),
    );
    expect(result.affordable).toBe(true);
    expect(result.survivalImpact).toBe('stable');
  });

  it('calculates correct runway after spawn', () => {
    const result = gate.evaluate(
      makeRequest({ estimatedCostCents: 5000 }),
      makeProjection({ reserveCents: 20000, burnRateCentsPerDay: 1000 }),
    );
    expect(result.reserveAfterSpawn).toBe(15000);
    expect(result.runwayAfterSpawn).toBe(15);
  });

  it('reports net impact correctly for profit and loss', () => {
    const profit = gate.evaluate(
      makeRequest({ estimatedCostCents: 1000, expectedRevenueCents: 3000 }),
      makeProjection(),
    );
    expect(profit.netImpactCents).toBe(2000);

    const loss = gate.evaluate(
      makeRequest({ estimatedCostCents: 5000, expectedRevenueCents: 1000 }),
      makeProjection(),
    );
    expect(loss.netImpactCents).toBe(-4000);
  });
});
