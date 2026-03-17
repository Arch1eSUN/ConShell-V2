/**
 * Round 15.7 — Economic Survival Loop Test Suite
 *
 * Comprehensive tests for the economic module covering all 6 goals:
 * A: EconomicState & Ledger
 * B: Revenue Surfaces
 * C: Survival Coupling
 * D: Value Router
 * E: Economic Narrator
 * F: Transaction Safety
 * + Integration tests
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  buildEconomicState,
  isEconomicEmergency,
  classifyHealth,
  SURVIVAL_THRESHOLDS,
  type EconomicStateInput,
  type EconomicState,
} from './economic-state.js';

import {
  EconomicLedger,
  computeEntryHash,
} from './economic-ledger.js';

import {
  RevenueSurfaceRegistry,
  createX402Surface,
  createApiAccessSurface,
  createTaskServiceSurface,
  computeEffectivePrice,
  SURVIVAL_PRICE_MULTIPLIERS,
  type PricePolicy,
} from './revenue-surface.js';

import {
  SurvivalGate,
  TIER_CONSTRAINTS,
} from './survival-coupling.js';

import {
  ValueRouter,
  type TaskDescriptor,
} from './value-router.js';

import {
  EconomicNarrator,
} from './economic-narrator.js';

import {
  TransactionSafetyManager,
  generateIdempotencyKey,
} from './transaction-safety.js';

import {
  createEconomicKernel,
} from './index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeState(overrides: Partial<EconomicStateInput> = {}): EconomicState {
  return buildEconomicState({
    balanceCents: 10_000,
    totalSpendCents: 5_000,
    totalIncomeCents: 3_000,
    burnRateCentsPerDay: 500,
    dailyIncomeCents: 300,
    survivalTier: 'normal',
    ...overrides,
  });
}

function makeTask(overrides: Partial<TaskDescriptor> = {}): TaskDescriptor {
  return {
    id: `task_${Math.random().toString(36).slice(2, 8)}`,
    type: 'inference',
    complexity: 3,
    isRevenueBearing: false,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// A: Economic State & Ledger
// ══════════════════════════════════════════════════════════════════════

describe('A: Economic State', () => {
  it('builds a frozen snapshot from inputs', () => {
    const state = makeState();
    expect(state.balanceCents).toBe(10_000);
    expect(state.totalSpendCents).toBe(5_000);
    expect(state.totalIncomeCents).toBe(3_000);
    expect(state.survivalTier).toBe('normal');
    expect(state.snapshotAt).toBeTruthy();
    // Frozen
    expect(Object.isFrozen(state)).toBe(true);
  });

  it('computes reserveCents as balance minus min operating reserve', () => {
    const state = makeState({ balanceCents: 5_000 });
    expect(state.reserveCents).toBe(5_000 - SURVIVAL_THRESHOLDS.MIN_OPERATING_RESERVE_CENTS);
  });

  it('reserveCents floors at 0', () => {
    const state = makeState({ balanceCents: 500 });
    expect(state.reserveCents).toBe(0);
  });

  it('computes survivalDays from balance and burn rate', () => {
    const state = makeState({ balanceCents: 2_000, burnRateCentsPerDay: 500 });
    expect(state.survivalDays).toBe(4);
  });

  it('survivalDays = 999 when burn rate is 0 and balance > 0', () => {
    const state = makeState({ burnRateCentsPerDay: 0, balanceCents: 1 });
    expect(state.survivalDays).toBe(999);
  });

  it('survivalDays = 0 when balance is 0 and burn rate is 0', () => {
    const state = makeState({ burnRateCentsPerDay: 0, balanceCents: 0 });
    expect(state.survivalDays).toBe(0);
  });

  it('computes profitabilityRatio', () => {
    const state = makeState({ totalSpendCents: 1000, totalIncomeCents: 1200 });
    expect(state.profitabilityRatio).toBe(1.2);
  });

  it('profitabilityRatio = Infinity when no spend but has income', () => {
    const state = makeState({ totalSpendCents: 0, totalIncomeCents: 100 });
    expect(state.profitabilityRatio).toBe(Infinity);
  });

  it('computes netFlowCentsPerDay', () => {
    const state = makeState({ dailyIncomeCents: 300, burnRateCentsPerDay: 500 });
    expect(state.netFlowCentsPerDay).toBe(-200);
  });

  it('isSelfSustaining when income >= burn and balance > 0', () => {
    const sustainable = makeState({ dailyIncomeCents: 500, burnRateCentsPerDay: 500, balanceCents: 100 });
    expect(sustainable.isSelfSustaining).toBe(true);

    const unsustainable = makeState({ dailyIncomeCents: 200, burnRateCentsPerDay: 500 });
    expect(unsustainable.isSelfSustaining).toBe(false);
  });

  it('isEconomicEmergency detects critical conditions', () => {
    expect(isEconomicEmergency(makeState({ balanceCents: 0 }))).toBe(true);
    expect(isEconomicEmergency(makeState({ survivalTier: 'terminal' }))).toBe(true);
    expect(isEconomicEmergency(makeState({ survivalTier: 'dead' }))).toBe(true);
    expect(isEconomicEmergency(makeState({ balanceCents: 400, burnRateCentsPerDay: 500 }))).toBe(true); // <1 day
    expect(isEconomicEmergency(makeState())).toBe(false);
  });

  it('classifyHealth maps to correct labels', () => {
    expect(classifyHealth(makeState({ survivalTier: 'dead' }))).toBe('dying');
    expect(classifyHealth(makeState({ survivalTier: 'terminal' }))).toBe('dying');
    expect(classifyHealth(makeState({ survivalTier: 'critical' }))).toBe('critical');
    expect(classifyHealth(makeState({
      survivalTier: 'normal',
      burnRateCentsPerDay: 5000,
      balanceCents: 10000,
    }))).toBe('stressed'); // 2 days runway
    expect(classifyHealth(makeState({
      survivalTier: 'thriving',
      dailyIncomeCents: 1000,
      burnRateCentsPerDay: 500,
      totalIncomeCents: 1200,
      totalSpendCents: 1000,
      balanceCents: 50000,
    }))).toBe('thriving');
    expect(classifyHealth(makeState())).toBe('stable');
  });
});

describe('A: Economic Ledger', () => {
  let ledger: EconomicLedger;

  beforeEach(() => {
    ledger = new EconomicLedger();
  });

  it('starts empty', () => {
    expect(ledger.size()).toBe(0);
    expect(ledger.entries()).toEqual([]);
  });

  it('appends entries with sequential IDs', () => {
    const e1 = ledger.append('debit', 100, 'inference', 'openai', 'GPT call');
    const e2 = ledger.append('credit', 200, 'x402', 'client', 'Payment received');
    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
  });

  it('hash-chains entries: entry.prevHash = previous entry.hash', () => {
    const e1 = ledger.append('debit', 100, 'inference', 'openai', 'Call 1');
    const e2 = ledger.append('credit', 200, 'x402', 'client', 'Payment');
    expect(e2.prevHash).toBe(e1.hash);
  });

  it('genesis entry has prevHash = 64 zeros', () => {
    const e1 = ledger.append('debit', 50, 'test', 'test', 'first');
    expect(e1.prevHash).toBe('0'.repeat(64));
  });

  it('entries are frozen (immutable)', () => {
    const e = ledger.append('debit', 100, 'test', 'test', 'test');
    expect(Object.isFrozen(e)).toBe(true);
  });

  it('rejects negative amounts', () => {
    expect(() => ledger.append('debit', -1, 'test', 'test', 'test')).toThrow();
  });

  it('verify() passes for a valid chain', () => {
    ledger.append('debit', 100, 'test', 'a', 'one');
    ledger.append('credit', 200, 'test', 'b', 'two');
    ledger.append('refund', 50, 'test', 'c', 'three');
    const result = ledger.verify();
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(3);
  });

  it('verify() passes for empty ledger', () => {
    const result = ledger.verify();
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(0);
  });

  it('computeEntryHash is deterministic', () => {
    const h1 = computeEntryHash('prev', 'debit', 100, 'cat', 'src', '2024-01-01');
    const h2 = computeEntryHash('prev', 'debit', 100, 'cat', 'src', '2024-01-01');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // SHA-256 hex
  });

  it('computeEntryHash changes with different inputs', () => {
    const h1 = computeEntryHash('prev', 'debit', 100, 'cat', 'src', '2024-01-01');
    const h2 = computeEntryHash('prev', 'credit', 100, 'cat', 'src', '2024-01-01');
    expect(h1).not.toBe(h2);
  });

  it('snapshot() returns correct running totals', () => {
    ledger.append('credit', 1000, 'x402', 'client', 'Payment');
    ledger.append('debit', 300, 'inference', 'openai', 'GPT');
    ledger.append('refund', 50, 'refund', 'system', 'Error refund');
    const snap = ledger.snapshot();
    expect(snap.totalCreditsCents).toBe(1000);
    expect(snap.totalDebitsCents).toBe(300);
    expect(snap.totalRefundsCents).toBe(50);
    expect(snap.balanceCents).toBe(750); // 1000 - 300 + 50
    expect(snap.entryCount).toBe(3);
  });

  it('getByRange filters by timestamp', () => {
    ledger.append('debit', 100, 'test', 'a', 'one', '2024-01-01T00:00:00Z');
    ledger.append('debit', 200, 'test', 'b', 'two', '2024-01-02T00:00:00Z');
    ledger.append('debit', 300, 'test', 'c', 'three', '2024-01-03T00:00:00Z');

    const result = ledger.getByRange('2024-01-01T12:00:00Z', '2024-01-02T12:00:00Z');
    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(200);
  });

  it('getByType filters by entry type', () => {
    ledger.append('debit', 100, 'test', 'a', 'spend');
    ledger.append('credit', 200, 'test', 'b', 'income');
    ledger.append('debit', 150, 'test', 'c', 'spend2');

    const debits = ledger.getByType('debit');
    expect(debits).toHaveLength(2);
    expect(debits.every(e => e.type === 'debit')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// B: Revenue Surfaces
// ══════════════════════════════════════════════════════════════════════

describe('B: Revenue Surfaces', () => {
  let registry: RevenueSurfaceRegistry;

  beforeEach(() => {
    registry = new RevenueSurfaceRegistry();
  });

  it('creates x402 surface with survival multiplier enabled', () => {
    const surface = createX402Surface('x402_1', 500);
    expect(surface.type).toBe('x402_payment');
    expect(surface.pricePolicy.survivalMultiplier).toBe(true);
    expect(surface.pricePolicy.basePriceCents).toBe(500);
  });

  it('creates API access surface with dynamic pricing', () => {
    const surface = createApiAccessSurface('api_1', 100);
    expect(surface.type).toBe('api_access');
    expect(surface.pricePolicy.dynamicPricing).toBe(true);
  });

  it('creates task service surface without survival multiplier', () => {
    const surface = createTaskServiceSurface('task_1', 1000);
    expect(surface.type).toBe('task_service');
    expect(surface.pricePolicy.survivalMultiplier).toBe(false);
  });

  it('registers and retrieves surfaces', () => {
    const s = createX402Surface('x1', 100);
    registry.register(s);
    expect(registry.get('x1')).toBe(s);
    expect(registry.all()).toHaveLength(1);
  });

  it('rejects duplicate registration', () => {
    registry.register(createX402Surface('x1', 100));
    expect(() => registry.register(createX402Surface('x1', 200))).toThrow();
  });

  it('filters active surfaces', () => {
    registry.register(createX402Surface('x1', 100));
    registry.register(createApiAccessSurface('a1', 50));
    registry.deactivate('x1');
    expect(registry.active()).toHaveLength(1);
    expect(registry.active()[0].id).toBe('a1');
  });

  it('records payment and updates surface totals', () => {
    registry.register(createX402Surface('x1', 100));
    const proof = registry.recordPayment('x1', {
      txHash: '0xabc',
      chain: 'ethereum',
      from: '0x123',
      amount: 500,
      verifiedAt: new Date().toISOString(),
    });
    expect(proof.status).toBe('verified');
    expect(proof.surfaceId).toBe('x1');
    const surface = registry.get('x1')!;
    expect(surface.totalEarnedCents).toBe(500);
    expect(surface.transactionCount).toBe(1);
  });

  it('throws when recording payment for unknown surface', () => {
    expect(() =>
      registry.recordPayment('nonexistent', {
        txHash: '0x', chain: 'eth', from: '0x', amount: 100, verifiedAt: '',
      }),
    ).toThrow();
  });

  it('survival multiplier adjusts prices', () => {
    const policy: PricePolicy = { basePriceCents: 100, dynamicPricing: false, survivalMultiplier: true };
    expect(computeEffectivePrice(policy, 'thriving')).toBe(100);
    expect(computeEffectivePrice(policy, 'frugal')).toBe(120);   // 1.2x
    expect(computeEffectivePrice(policy, 'critical')).toBe(150); // 1.5x
    expect(computeEffectivePrice(policy, 'terminal')).toBe(200); // 2.0x
    expect(computeEffectivePrice(policy, 'dead')).toBe(0);       // 0x
  });

  it('no multiplier when survivalMultiplier is false', () => {
    const policy: PricePolicy = { basePriceCents: 100, dynamicPricing: false, survivalMultiplier: false };
    expect(computeEffectivePrice(policy, 'terminal')).toBe(100);
  });

  it('getPrice returns effective price for a registered surface', () => {
    registry.register(createX402Surface('x1', 100));
    expect(registry.getPrice('x1', 'normal')).toBe(100);
    expect(registry.getPrice('x1', 'critical')).toBe(150);
  });

  it('totalRevenue sums across surfaces', () => {
    registry.register(createX402Surface('x1', 100));
    registry.register(createApiAccessSurface('a1', 50));
    registry.recordPayment('x1', { txHash: '0x1', chain: 'eth', from: '0x', amount: 500, verifiedAt: '' });
    registry.recordPayment('a1', { txHash: '0x2', chain: 'eth', from: '0x', amount: 300, verifiedAt: '' });
    expect(registry.totalRevenue()).toBe(800);
  });

  it('revenueByType groups correctly', () => {
    registry.register(createX402Surface('x1', 100));
    registry.register(createTaskServiceSurface('t1', 200));
    registry.recordPayment('x1', { txHash: '0x1', chain: 'eth', from: '0x', amount: 500, verifiedAt: '' });
    registry.recordPayment('t1', { txHash: '0x2', chain: 'eth', from: '0x', amount: 1000, verifiedAt: '' });
    const byType = registry.revenueByType();
    expect(byType.x402_payment).toBe(500);
    expect(byType.task_service).toBe(1000);
    expect(byType.api_access).toBe(0);
  });

  it('SURVIVAL_PRICE_MULTIPLIERS covers all tiers', () => {
    const tiers = ['thriving', 'normal', 'frugal', 'critical', 'terminal', 'dead'] as const;
    for (const tier of tiers) {
      expect(SURVIVAL_PRICE_MULTIPLIERS[tier]).toBeDefined();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// C: Survival Coupling
// ══════════════════════════════════════════════════════════════════════

describe('C: Survival Coupling', () => {
  let gate: SurvivalGate;

  beforeEach(() => {
    gate = new SurvivalGate();
  });

  it('TIER_CONSTRAINTS covers all 6 tiers', () => {
    const tiers = ['thriving', 'normal', 'frugal', 'critical', 'terminal', 'dead'] as const;
    for (const tier of tiers) {
      expect(TIER_CONSTRAINTS[tier]).toBeDefined();
      expect(TIER_CONSTRAINTS[tier].allowedModels).toBeDefined();
    }
  });

  it('dead tier has no allowed models', () => {
    expect(TIER_CONSTRAINTS.dead.allowedModels).toHaveLength(0);
    expect(TIER_CONSTRAINTS.dead.maxContextTokens).toBe(0);
    expect(TIER_CONSTRAINTS.dead.maxConcurrentOps).toBe(0);
  });

  it('canInfer allows model if in tier allowlist', () => {
    expect(gate.canInfer('claude-4-opus', 'thriving')).toBe(true);
    expect(gate.canInfer('claude-4-opus', 'terminal')).toBe(false);
  });

  it('canInfer returns false for dead tier (any model)', () => {
    expect(gate.canInfer('llama-3.2-3b', 'dead')).toBe(false);
  });

  it('getEffectiveModel returns same model if allowed', () => {
    expect(gate.getEffectiveModel('claude-4-opus', 'thriving')).toBe('claude-4-opus');
  });

  it('getEffectiveModel returns substitute when model not allowed', () => {
    const result = gate.getEffectiveModel('claude-4-opus', 'critical');
    expect(result).not.toBe('claude-4-opus');
    expect(result).toBeTruthy();
  });

  it('getEffectiveModel returns null for dead tier', () => {
    expect(gate.getEffectiveModel('any-model', 'dead')).toBeNull();
  });

  it('canExecuteTask blocks tasks for dead agents', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    expect(gate.canExecuteTask(1, state)).toBe(false);
  });

  it('canExecuteTask blocks tasks that would drain balance to 0', () => {
    const state = makeState({ balanceCents: 100 });
    expect(gate.canExecuteTask(100, state)).toBe(false);
    expect(gate.canExecuteTask(50, state)).toBe(true);
  });

  it('canExecuteTask applies terminal threshold (max 10¢)', () => {
    const state = makeState({ survivalTier: 'terminal', balanceCents: 500 });
    expect(gate.canExecuteTask(10, state)).toBe(true);
    expect(gate.canExecuteTask(11, state)).toBe(false);
  });

  it('canSpawnChild respects tier', () => {
    expect(gate.canSpawnChild(makeState({ survivalTier: 'thriving' }))).toBe(true);
    expect(gate.canSpawnChild(makeState({ survivalTier: 'normal' }))).toBe(true);
    expect(gate.canSpawnChild(makeState({ survivalTier: 'frugal' }))).toBe(false);
    expect(gate.canSpawnChild(makeState({ survivalTier: 'critical' }))).toBe(false);
  });

  it('enforce() infer action — allowed', () => {
    const state = makeState({ survivalTier: 'thriving' });
    const result = gate.enforce('infer', state, { model: 'claude-4-opus' });
    expect(result.allowed).toBe(true);
  });

  it('enforce() infer action — blocked with substitute', () => {
    const state = makeState({ survivalTier: 'critical' });
    const result = gate.enforce('infer', state, { model: 'claude-4-opus' });
    expect(result.allowed).toBe(false);
    expect(result.substitute).toBeTruthy();
    expect(result.reason).toContain('not allowed');
  });

  it('enforce() infer action — dead returns no models', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    const result = gate.enforce('infer', state, { model: 'any' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('dead');
  });

  it('enforce() spawn_child — blocked in frugal', () => {
    const state = makeState({ survivalTier: 'frugal' });
    const result = gate.enforce('spawn_child', state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('enforce() use_feature — blocked when feature disabled', () => {
    const state = makeState({ survivalTier: 'critical' });
    const result = gate.enforce('use_feature', state, { feature: 'browser' });
    expect(result.allowed).toBe(false);
  });

  it('enforce() use_feature — allowed at right tier', () => {
    const state = makeState({ survivalTier: 'thriving' });
    const result = gate.enforce('use_feature', state, { feature: 'browser' });
    expect(result.allowed).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// D: Value Router
// ══════════════════════════════════════════════════════════════════════

describe('D: Value Router', () => {
  let router: ValueRouter;

  beforeEach(() => {
    router = new ValueRouter();
  });

  it('estimates cost based on type and complexity', () => {
    const task = makeTask({ type: 'inference', complexity: 5 });
    const estimate = router.estimateTaskValue(task);
    expect(estimate.estimatedCostCents).toBe(25); // 5 * 5
    expect(estimate.estimatedRevenueCents).toBe(0);
    expect(estimate.riskLevel).toBe('unprofitable');
  });

  it('revenue-bearing tasks have positive net value', () => {
    const task = makeTask({ isRevenueBearing: true, expectedRevenueCents: 100, complexity: 1 });
    const estimate = router.estimateTaskValue(task);
    expect(estimate.netValue).toBe(95); // 100 - 5
    expect(estimate.riskLevel).toBe('safe');
  });

  it('shouldAcceptTask accepts safe/marginal when thriving', () => {
    const state = makeState({
      survivalTier: 'thriving',
      dailyIncomeCents: 1000,
      burnRateCentsPerDay: 500,
      totalIncomeCents: 1200,
      totalSpendCents: 1000,
      balanceCents: 50000,
    });
    // Revenue-bearing marginal task is accepted at thriving
    const task = makeTask({ complexity: 1, isRevenueBearing: true, expectedRevenueCents: 10 });
    expect(router.shouldAcceptTask(task, state)).toBe(true);
    // Unprofitable non-revenue task is still rejected
    const unprofitable = makeTask({ complexity: 8, isRevenueBearing: false });
    expect(router.shouldAcceptTask(unprofitable, state)).toBe(false);
  });

  it('shouldAcceptTask rejects unprofitable non-revenue tasks in critical', () => {
    const state = makeState({ survivalTier: 'critical' });
    const task = makeTask({ isRevenueBearing: false });
    expect(router.shouldAcceptTask(task, state)).toBe(false);
  });

  it('shouldAcceptTask accepts revenue-bearing tasks even in critical', () => {
    const state = makeState({ survivalTier: 'critical' });
    const task = makeTask({ isRevenueBearing: true, expectedRevenueCents: 500, complexity: 1 });
    expect(router.shouldAcceptTask(task, state)).toBe(true);
  });

  it('getRoutingDecision rejects at dead tier', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    const decision = router.getRoutingDecision(makeTask(), state);
    expect(decision.action).toBe('reject');
  });

  it('getRoutingDecision accepts revenue tasks with high priority', () => {
    const state = makeState();
    const task = makeTask({ isRevenueBearing: true, expectedRevenueCents: 200, complexity: 1 });
    const decision = router.getRoutingDecision(task, state);
    expect(decision.action).toBe('accept');
    expect(decision.priority).toBeGreaterThan(100);
  });

  it('prioritizeTasks sorts by priority descending', () => {
    const state = makeState();
    const tasks = [
      makeTask({ id: 'cheap', complexity: 1 }),
      makeTask({ id: 'revenue', isRevenueBearing: true, expectedRevenueCents: 500, complexity: 1 }),
      makeTask({ id: 'expensive', complexity: 8 }),
    ];
    const sorted = router.prioritizeTasks(tasks, state);
    expect(sorted[0].task.id).toBe('revenue');
  });

  it('confidence decreases with complexity', () => {
    const easy = router.estimateTaskValue(makeTask({ complexity: 1 }));
    const hard = router.estimateTaskValue(makeTask({ complexity: 10 }));
    expect(easy.confidence).toBeGreaterThan(hard.confidence);
  });
});

// ══════════════════════════════════════════════════════════════════════
// E: Economic Narrator
// ══════════════════════════════════════════════════════════════════════

describe('E: Economic Narrator', () => {
  let narrator: EconomicNarrator;

  beforeEach(() => {
    narrator = new EconomicNarrator();
  });

  it('narrate produces a frozen narrative with correct health', () => {
    const state = makeState();
    const narrative = narrator.narrate(state);
    expect(narrative.health).toBe('stable');
    expect(narrative.summary).toBeTruthy();
    expect(narrative.timestamp).toBeTruthy();
  });

  it('narrate reflects critical health', () => {
    const state = makeState({ survivalTier: 'critical' });
    const narrative = narrator.narrate(state);
    expect(narrative.health).toBe('critical');
    expect(narrative.summary).toContain('CRITICAL');
  });

  it('narrate reflects dying health', () => {
    const state = makeState({ survivalTier: 'terminal' });
    const narrative = narrator.narrate(state);
    expect(narrative.health).toBe('dying');
    expect(narrative.summary).toContain('EMERGENCY');
  });

  it('explainRoutingDecision produces structured explanation', () => {
    const state = makeState();
    const explanation = narrator.explainRoutingDecision(
      'task_123',
      { action: 'reject', reason: 'Too expensive', priority: 0 },
      state,
    );
    expect(explanation.what).toContain('task_123');
    expect(explanation.why).toBe('Too expensive');
    expect(explanation.impact).toBeTruthy();
    expect(explanation.alternatives).toBeDefined();
  });

  it('explainEnforcement handles allowed actions', () => {
    const state = makeState();
    const explanation = narrator.explainEnforcement(
      'infer',
      { allowed: true, enforcedTier: 'normal' },
      state,
    );
    expect(explanation.what).toContain('permitted');
  });

  it('explainEnforcement includes substitute when available', () => {
    const state = makeState();
    const explanation = narrator.explainEnforcement(
      'infer',
      { allowed: false, enforcedTier: 'critical', substitute: 'gemini-flash', reason: 'Not allowed' },
      state,
    );
    expect(explanation.alternatives).toContain('Use substitute: gemini-flash');
  });

  it('generateReport produces complete report', () => {
    const state = makeState();
    const report = narrator.generateReport(state);
    expect(report.title).toContain('STABLE');
    expect(report.metrics.balance).toContain('$');
    expect(report.metrics.burnRate).toContain('/day');
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeTruthy();
  });

  it('generateReport includes ledger data when provided', () => {
    const state = makeState();
    const ledgerSnapshot = {
      balanceCents: 5000,
      totalCreditsCents: 8000,
      totalDebitsCents: 3000,
      totalRefundsCents: 0,
      entryCount: 42,
      headHash: 'abc123def456',
    };
    const report = narrator.generateReport(state, ledgerSnapshot);
    expect(report.ledger.totalEntries).toBe(42);
    expect(report.ledger.integrity).toContain('abc123def456');
  });
});

// ══════════════════════════════════════════════════════════════════════
// F: Transaction Safety
// ══════════════════════════════════════════════════════════════════════

describe('F: Transaction Safety', () => {
  let tsm: TransactionSafetyManager;

  beforeEach(() => {
    tsm = new TransactionSafetyManager();
  });

  it('generateKey produces unique keys', () => {
    const k1 = generateIdempotencyKey('debit', 'openai');
    const k2 = generateIdempotencyKey('debit', 'openai');
    expect(k1).not.toBe(k2);
    expect(k1).toContain('debit:openai:');
  });

  it('isDuplicate returns false for new key', () => {
    const key = tsm.generateKey('debit', 'test');
    expect(tsm.isDuplicate(key)).toBe(false);
  });

  it('isDuplicate returns true after recording success', () => {
    const key = tsm.generateKey('debit', 'test');
    tsm.recordTransaction(key, 'debit', 100, 'test');
    expect(tsm.isDuplicate(key)).toBe(true);
  });

  it('recordTransaction rejects duplicates', () => {
    const key = tsm.generateKey('debit', 'test');
    const first = tsm.recordTransaction(key, 'debit', 100, 'test');
    expect(first.recorded).toBe(true);
    const second = tsm.recordTransaction(key, 'debit', 100, 'test');
    expect(second.recorded).toBe(false);
    expect(second.existing).toBeDefined();
  });

  it('recordFailure tracks failed transactions', () => {
    const key = tsm.generateKey('debit', 'test');
    const record = tsm.recordFailure(key, 'debit', 100, 'test', 'Network error');
    expect(record.status).toBe('failed');
    expect(record.lastError).toBe('Network error');
  });

  it('getFailedTransactions returns only failed', () => {
    const k1 = tsm.generateKey('debit', 'a');
    const k2 = tsm.generateKey('debit', 'b');
    tsm.recordTransaction(k1, 'debit', 100, 'a');
    tsm.recordFailure(k2, 'debit', 200, 'b', 'error');
    const failed = tsm.getFailedTransactions();
    expect(failed).toHaveLength(1);
    expect(failed[0].key).toBe(k2);
  });

  it('markRetried updates status', () => {
    const key = tsm.generateKey('debit', 'test');
    tsm.recordFailure(key, 'debit', 100, 'test', 'error');
    expect(tsm.markRetried(key)).toBe(true);
    const record = tsm.getExistingTransaction(key)!;
    expect(record.status).toBe('retried');
    expect(record.retryCount).toBe(1);
  });

  it('markSuccess updates failed/retried to success', () => {
    const key = tsm.generateKey('debit', 'test');
    tsm.recordFailure(key, 'debit', 100, 'test', 'error');
    tsm.markSuccess(key);
    expect(tsm.isDuplicate(key)).toBe(true);
  });

  it('refund lifecycle: pending → approved → processed', () => {
    const req = tsm.requestRefund(1, 500, 'Service not delivered');
    expect(req.status).toBe('pending');
    expect(req.amountCents).toBe(500);

    expect(tsm.approveRefund(req.id)).toBe(true);
    expect(tsm.getRefundRequests('approved')).toHaveLength(1);

    const processed = tsm.processRefund(req.id);
    expect(processed).not.toBeNull();
    expect(processed!.status).toBe('processed');
    expect(processed!.processedAt).toBeTruthy();
  });

  it('refund lifecycle: pending → rejected', () => {
    const req = tsm.requestRefund(2, 300, 'Invalid reason');
    expect(tsm.rejectRefund(req.id)).toBe(true);
    expect(req.status).toBe('rejected');
    // Can't process rejected refund
    expect(tsm.processRefund(req.id)).toBeNull();
  });

  it('processRefund returns null for non-approved refund', () => {
    const req = tsm.requestRefund(3, 200, 'test');
    expect(tsm.processRefund(req.id)).toBeNull();
  });

  it('stats() reports correct counts', () => {
    const k1 = tsm.generateKey('debit', 'a');
    const k2 = tsm.generateKey('credit', 'b');
    tsm.recordTransaction(k1, 'debit', 100, 'a');
    tsm.recordFailure(k2, 'credit', 200, 'b', 'err');
    tsm.requestRefund(1, 50, 'test');

    const stats = tsm.stats();
    expect(stats.totalTransactions).toBe(2);
    expect(stats.successCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.pendingRefunds).toBe(1);
    expect(stats.processedRefunds).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Integration: Full Value Chain
// ══════════════════════════════════════════════════════════════════════

describe('Integration: Economic Kernel', () => {
  it('createEconomicKernel instantiates all components', () => {
    const kernel = createEconomicKernel();
    expect(kernel.ledger).toBeInstanceOf(EconomicLedger);
    expect(kernel.revenueSurfaces).toBeInstanceOf(RevenueSurfaceRegistry);
    expect(kernel.survivalGate).toBeInstanceOf(SurvivalGate);
    expect(kernel.valueRouter).toBeInstanceOf(ValueRouter);
    expect(kernel.narrator).toBeInstanceOf(EconomicNarrator);
    expect(kernel.transactionSafety).toBeInstanceOf(TransactionSafetyManager);
  });

  it('full value chain: x402 payment → ledger → state → routing', () => {
    const kernel = createEconomicKernel();

    // 1. Register revenue surface
    kernel.revenueSurfaces.register(createX402Surface('x402_main', 500));

    // 2. Record incoming payment
    const proof = kernel.revenueSurfaces.recordPayment('x402_main', {
      txHash: '0xdead',
      chain: 'base',
      from: '0xclient',
      amount: 1000,
      verifiedAt: new Date().toISOString(),
    });
    expect(proof.status).toBe('verified');

    // 3. Write to ledger
    const key = kernel.transactionSafety.generateKey('credit', 'x402');
    const { recorded } = kernel.transactionSafety.recordTransaction(key, 'credit', 1000, 'x402');
    expect(recorded).toBe(true);
    kernel.ledger.append('credit', 1000, 'x402_payment', 'client', 'x402 payment received');

    // 4. Record a spend
    kernel.ledger.append('debit', 200, 'inference', 'openai', 'GPT-4o call');

    // 5. Build state from ledger
    const snap = kernel.ledger.snapshot();
    const state = buildEconomicState({
      balanceCents: snap.balanceCents,
      totalSpendCents: snap.totalDebitsCents,
      totalIncomeCents: snap.totalCreditsCents,
      burnRateCentsPerDay: 100,    // low burn rate → healthy runway
      dailyIncomeCents: 1000,
      survivalTier: 'normal',
    });

    // 6. Route a task based on economic state
    const task = makeTask({ type: 'inference', complexity: 3 });
    const decision = kernel.valueRouter.getRoutingDecision(task, state);
    expect(decision.action).toBe('accept');

    // 7. Verify ledger integrity
    const verification = kernel.ledger.verify();
    expect(verification.valid).toBe(true);

    // 8. Generate narrative — balance 800, burn 100/d, income 1000/d
    //    profitabilityRatio = 1000/200 = 5.0 (≥1.2) and isSelfSustaining = true → 'thriving'
    const narrative = kernel.narrator.narrate(state);
    expect(narrative.health).toBe('thriving');
  });

  it('full chain: survival pressure blocks expensive tasks', () => {
    const kernel = createEconomicKernel();

    // Agent is in critical state with low balance
    const state = buildEconomicState({
      balanceCents: 200,
      totalSpendCents: 9800,
      totalIncomeCents: 200,
      burnRateCentsPerDay: 1000,
      dailyIncomeCents: 50,
      survivalTier: 'critical',
    });

    // Task routing should reject non-revenue tasks
    const task = makeTask({ complexity: 5, isRevenueBearing: false });
    const decision = kernel.valueRouter.getRoutingDecision(task, state);
    expect(decision.action).toBe('reject');

    // Survival gate should block expensive inference
    const enforcement = kernel.survivalGate.enforce('infer', state, { model: 'claude-4-opus' });
    expect(enforcement.allowed).toBe(false);

    // But revenue-bearing task is still accepted
    const revenueTask = makeTask({
      complexity: 1,
      isRevenueBearing: true,
      expectedRevenueCents: 500,
    });
    const revenueDecision = kernel.valueRouter.getRoutingDecision(revenueTask, state);
    expect(revenueDecision.action).toBe('accept');
  });

  it('refund flow through ledger', () => {
    const kernel = createEconomicKernel();

    // Record a debit
    const entry = kernel.ledger.append('debit', 500, 'inference', 'openai', 'Failed call');

    // Request refund
    const req = kernel.transactionSafety.requestRefund(entry.id, 500, 'API error');
    kernel.transactionSafety.approveRefund(req.id);
    const processed = kernel.transactionSafety.processRefund(req.id);
    expect(processed).not.toBeNull();

    // Record refund in ledger
    kernel.ledger.append('refund', 500, 'inference', 'openai', `Refund for entry ${entry.id}`);

    // Verify final state
    const snap = kernel.ledger.snapshot();
    expect(snap.balanceCents).toBe(0); // -500 + 500
    expect(snap.totalRefundsCents).toBe(500);
    expect(kernel.ledger.verify().valid).toBe(true);
  });

  it('dead agent: everything is refused', () => {
    const kernel = createEconomicKernel();
    const state = buildEconomicState({
      balanceCents: 0,
      totalSpendCents: 10000,
      totalIncomeCents: 0,
      burnRateCentsPerDay: 0,
      dailyIncomeCents: 0,
      survivalTier: 'dead',
    });

    // All actions blocked
    expect(kernel.survivalGate.enforce('infer', state, { model: 'any' }).allowed).toBe(false);
    expect(kernel.survivalGate.enforce('spawn_child', state).allowed).toBe(false);
    expect(kernel.survivalGate.enforce('execute_task', state, { estimatedCost: 1 }).allowed).toBe(false);

    // Routing rejects
    const decision = kernel.valueRouter.getRoutingDecision(makeTask(), state);
    expect(decision.action).toBe('reject');

    // Narrative reflects death
    const narrative = kernel.narrator.narrate(state);
    expect(narrative.health).toBe('dying');
  });
});
