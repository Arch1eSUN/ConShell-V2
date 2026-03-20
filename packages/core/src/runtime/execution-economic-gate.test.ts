/**
 * ExecutionEconomicGate — Unit Tests
 *
 * Tests three-layer execution-time economic enforcement:
 * 1. SurvivalGate → tier-based admission
 * 2. ProfitabilityEvaluator → admit/defer/reject
 * 3. MandateEngine → spend authorization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionEconomicGate } from './execution-economic-gate.js';
import type { EconomicStateProvider } from './execution-economic-gate.js';
import type { EconomicState } from '../economic/economic-state.js';
import type { SurvivalGate } from '../economic/survival-coupling.js';
import type { ProfitabilityEvaluator } from '../economic/profitability-evaluator.js';
import type { MandateEngine } from '../economic/mandate-engine.js';
import type { Commitment } from '../agenda/commitment-model.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'test-commit-1',
    name: 'Test Task',
    kind: 'task',
    origin: 'internal',
    status: 'active',
    priority: 'normal',
    expectedValueCents: 500,
    estimatedCostCents: 100,
    mustPreserve: false,
    revenueBearing: true,
    taskType: 'cognitive',
    materializedTaskCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Commitment;
}

function makeState(overrides: Partial<EconomicState> = {}): EconomicState {
  return {
    balanceCents: 10000,
    burnRateCentsPerDay: 100,
    survivalDays: 100,
    survivalTier: 'normal',
    profitabilityRatio: 1.5,
    totalRevenueCents: 5000,
    totalCostCents: 3000,
    timestamp: '2026-01-01T00:00:00Z',
    ...overrides,
  } as EconomicState;
}

function makeProjection() {
  return {
    currentBalanceCents: 10000,
    runwayDays: 100,
    survivalTier: 'normal' as const,
    burnRateCentsPerDay: 100,
  };
}

// ── Mocks ────────────────────────────────────────────────────────────

function createMocks() {
  const survivalGate = {
    canAcceptTask: vi.fn().mockReturnValue({ allowed: true, enforcedTier: 'normal' }),
    canInfer: vi.fn(),
    getEffectiveModel: vi.fn(),
    canExecuteTask: vi.fn(),
    canSpawnChild: vi.fn(),
    isFeatureEnabled: vi.fn(),
    enforce: vi.fn(),
    canAcceptTaskDetailed: vi.fn(),
    explain: vi.fn(),
    backgroundWorkLimit: vi.fn(),
    getConstraints: vi.fn(),
  } as unknown as SurvivalGate;

  const profitability = {
    evaluate: vi.fn().mockReturnValue({
      verdict: 'admit',
      reason: 'Revenue-positive (net: +400¢)',
      commitmentId: 'test-commit-1',
      revenuePositive: true,
      reserveCriticalOverride: false,
      mustDoDespiteLoss: false,
      deferDueToNegativeValue: false,
      rejectDueToUnsustainableCost: false,
      expectedRevenueCents: 500,
      expectedCostCents: 100,
      netValueCents: 400,
      survivalValue: 70,
      strategicValue: 50,
    }),
  } as unknown as ProfitabilityEvaluator;

  const mandates = {
    match: vi.fn().mockReturnValue({
      matched: true,
      mandateId: 'mandate_1',
      rejectionReason: null,
      remainingBudget: 5000,
      violations: [],
    }),
    consume: vi.fn().mockReturnValue(true),
  } as unknown as MandateEngine;

  const stateProvider: EconomicStateProvider = {
    getCurrentState: vi.fn().mockReturnValue(makeState()),
    getCurrentProjection: vi.fn().mockReturnValue(makeProjection()),
    getEconomicIdentityId: vi.fn().mockReturnValue('eco-id-1'),
  };

  return { survivalGate, profitability, mandates, stateProvider };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ExecutionEconomicGate', () => {
  let gate: ExecutionEconomicGate;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    gate = new ExecutionEconomicGate(
      mocks.survivalGate,
      mocks.profitability,
      mocks.mandates,
      mocks.stateProvider,
    );
  });

  it('admits when all layers pass', () => {
    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.admission).toBe('admit');
    expect(decision.decidingLayer).toBe('passthrough');
    expect(decision.commitmentId).toBe('test-commit-1');
  });

  it('rejects when SurvivalGate denies', () => {
    vi.mocked(mocks.survivalGate.canAcceptTask).mockReturnValue({
      allowed: false,
      reason: 'Agent is dead — cannot accept tasks',
      enforcedTier: 'dead',
    });

    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.admission).toBe('reject');
    expect(decision.decidingLayer).toBe('survival');
    expect(decision.reason).toContain('dead');
  });

  it('rejects when ProfitabilityEvaluator rejects', () => {
    vi.mocked(mocks.profitability.evaluate).mockReturnValue({
      verdict: 'reject',
      reason: 'Cost exceeds 50% of balance',
      commitmentId: 'test-commit-1',
      revenuePositive: false,
      reserveCriticalOverride: false,
      mustDoDespiteLoss: false,
      deferDueToNegativeValue: false,
      rejectDueToUnsustainableCost: true,
      expectedRevenueCents: 0,
      expectedCostCents: 6000,
      netValueCents: -6000,
      survivalValue: 30,
      strategicValue: 50,
    });

    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.admission).toBe('reject');
    expect(decision.decidingLayer).toBe('profitability');
  });

  it('defers when ProfitabilityEvaluator defers', () => {
    vi.mocked(mocks.profitability.evaluate).mockReturnValue({
      verdict: 'defer',
      reason: 'Net value below defer floor',
      commitmentId: 'test-commit-1',
      revenuePositive: false,
      reserveCriticalOverride: false,
      mustDoDespiteLoss: false,
      deferDueToNegativeValue: true,
      rejectDueToUnsustainableCost: false,
      expectedRevenueCents: 0,
      expectedCostCents: 800,
      netValueCents: -800,
      survivalValue: 50,
      strategicValue: 50,
    });

    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.admission).toBe('defer');
    expect(decision.decidingLayer).toBe('profitability');
  });

  it('rejects when MandateEngine finds no matching mandate', () => {
    vi.mocked(mocks.mandates.match).mockReturnValue({
      matched: false,
      mandateId: null,
      rejectionReason: 'No mandates exist for this economic identity',
      remainingBudget: 0,
      violations: [],
    });

    const decision = gate.checkAdmission(makeCommitment({ estimatedCostCents: 200 }));
    expect(decision.admission).toBe('reject');
    expect(decision.decidingLayer).toBe('mandate');
    expect(decision.reason).toContain('No matching mandate');
  });

  it('skips mandate check for zero-cost tasks', () => {
    const decision = gate.checkAdmission(makeCommitment({ estimatedCostCents: 0 }));
    expect(decision.admission).toBe('admit');
    expect(mocks.mandates.match).not.toHaveBeenCalled();
  });

  it('consumes mandate budget on admission', () => {
    gate.checkAdmission(makeCommitment({ estimatedCostCents: 150 }));
    expect(mocks.mandates.consume).toHaveBeenCalledWith('mandate_1', 150);
  });

  it('tracks history and stats', () => {
    gate.checkAdmission(makeCommitment({ id: 'c1' }));
    gate.checkAdmission(makeCommitment({ id: 'c2' }));

    // Force a reject on third
    vi.mocked(mocks.survivalGate.canAcceptTask).mockReturnValueOnce({
      allowed: false,
      reason: 'terminal',
      enforcedTier: 'terminal',
    });
    gate.checkAdmission(makeCommitment({ id: 'c3' }));

    const stats = gate.stats();
    expect(stats.total).toBe(3);
    expect(stats.admitted).toBe(2);
    expect(stats.rejected).toBe(1);
    expect(stats.deferred).toBe(0);

    expect(gate.getHistory()).toHaveLength(3);
    expect(gate.getLastDecision()!.commitmentId).toBe('c3');
  });

  it('returns correct survivalResult in decision', () => {
    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.survivalResult).toBeDefined();
    expect(decision.survivalResult!.allowed).toBe(true);
  });

  it('returns profitabilityResult when admitted', () => {
    const decision = gate.checkAdmission(makeCommitment());
    expect(decision.profitabilityResult).toBeDefined();
    expect(decision.profitabilityResult!.verdict).toBe('admit');
    expect(decision.profitabilityResult!.revenuePositive).toBe(true);
  });
});
