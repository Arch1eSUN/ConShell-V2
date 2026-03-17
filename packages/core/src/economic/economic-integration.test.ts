/**
 * Round 15.7B — Economic Integration Tests
 *
 * Truth Convergence: verifies data flows correctly across
 * SpendTracker → LedgerProjection → EconomicStateService.
 *
 * All components use REAL implementations — no mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { SpendTracker } from '../spend/index.js';
import { LedgerProjection } from './ledger-projection.js';
import { EconomicStateService } from './economic-state-service.js';
import { ConwayAutomaton } from '../automaton/index.js';
import { createLogger } from '../logger/index.js';

// ── Real Logger ──────────────────────────────────────────────────────

const logger = createLogger('economic-integration-test', { level: 'silent' });

// ══════════════════════════════════════════════════════════════════════
// T3 verification: LedgerProjection ← SpendTracker event feed
// ══════════════════════════════════════════════════════════════════════

describe('LedgerProjection ← SpendTracker', () => {
  let tracker: SpendTracker;
  let projection: LedgerProjection;

  beforeEach(() => {
    tracker = new SpendTracker();
    projection = new LedgerProjection();
    projection.wire(tracker);
  });

  it('projects spend events as debit entries', () => {
    tracker.recordSpend('openai', 42, { model: 'gpt-4o', category: 'inference' });
    const snap = projection.getSnapshot();
    expect(snap.entryCount).toBe(1);
    expect(snap.totalDebitsCents).toBe(42);
    expect(snap.totalCreditsCents).toBe(0);
  });

  it('projects income events as credit entries', () => {
    tracker.recordIncome('x402', 200, '0xabc');
    const snap = projection.getSnapshot();
    expect(snap.entryCount).toBe(1);
    expect(snap.totalCreditsCents).toBe(200);
    expect(snap.totalDebitsCents).toBe(0);
  });

  it('maintains hash chain integrity across mixed events', () => {
    tracker.recordSpend('openai', 100, { model: 'gpt-4o', category: 'inference' });
    tracker.recordIncome('x402', 500, '0x1');
    tracker.recordSpend('anthropic', 75, { model: 'claude-4', category: 'inference' });
    tracker.recordIncome('api', 300);

    expect(projection.verify()).toBe(true);

    const snap = projection.getSnapshot();
    expect(snap.entryCount).toBe(4);
    expect(snap.totalDebitsCents).toBe(175); // 100 + 75
    expect(snap.totalCreditsCents).toBe(800); // 500 + 300
    expect(snap.balanceCents).toBe(625); // 800 - 175
  });

  it('SpendTracker and LedgerProjection totals converge', () => {
    tracker.recordSpend('openai', 100, { model: 'gpt-4o', category: 'inference' });
    tracker.recordSpend('openai', 50, { category: 'inference' });
    tracker.recordIncome('x402', 300, '0x1');

    const agg = tracker.aggregates();
    const ledgerSnap = projection.getSnapshot();

    // Total spend must converge
    expect(Number(agg.totalSpendCents)).toBe(ledgerSnap.totalDebitsCents);
    // Total income must converge
    expect(Number(agg.totalIncomeCents)).toBe(ledgerSnap.totalCreditsCents);
  });

  it('disconnect stops receiving events', () => {
    tracker.recordSpend('openai', 100, { category: 'inference' });
    expect(projection.getSnapshot().entryCount).toBe(1);

    projection.disconnect();

    tracker.recordSpend('openai', 50, { category: 'inference' });
    // Should NOT have received the second event
    expect(projection.getSnapshot().entryCount).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// T4 verification: EconomicStateService Facade
// ══════════════════════════════════════════════════════════════════════

describe('EconomicStateService', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let service: EconomicStateService;

  beforeEach(() => {
    tracker = new SpendTracker({ initialBalanceCents: 50_000 });
    automaton = new ConwayAutomaton();
    service = new EconomicStateService(tracker, automaton, logger);
  });

  it('snapshot() aggregates SpendTracker + ConwayAutomaton', () => {
    tracker.recordIncome('x402', 1000);
    const snap = service.snapshot();
    expect(snap.totalIncomeCents).toBe(1000);
    expect(snap.survivalTier).toBe('normal'); // ConwayAutomaton default tier is 'normal'
    expect(snap.snapshotAt).toBeTruthy();
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('getGateDecision() allows at normal tier', () => {
    const decision = service.getGateDecision();
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('allow');
  });

  it('getGateDecision() blocks at dead tier', () => {
    // Evolve automaton to dead state using real EnvironmentSnapshot
    automaton.evolve({
      budgetRemainingPct: 0,
      memoryPressure: 0,
      activeConnections: 0,
      lastHeartbeat: Date.now(),
      recentIncomeCents: 0,
      recentSpendCents: 0,
    });
    const decision = service.getGateDecision();
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe('block');
    expect(decision.reason).toContain('dead');
  });

  it('getGateDecision() restricts model at critical tier', () => {
    // Evolve automaton to critical
    automaton.evolve({
      budgetRemainingPct: 8,
      memoryPressure: 0,
      activeConnections: 0,
      lastHeartbeat: Date.now(),
      recentIncomeCents: 0,
      recentSpendCents: 0,
    });
    const decision = service.getGateDecision('claude-4-opus');
    expect(['restrict', 'block']).toContain(decision.action);
  });

  it('getHealth() returns valid health classification', () => {
    const health = service.getHealth();
    expect(['thriving', 'stable', 'stressed', 'critical', 'dying']).toContain(health);
  });

  it('verifyLedger() returns true for fresh service', () => {
    expect(service.verifyLedger()).toBe(true);
  });

  it('verifyLedger() remains true after events flow through', () => {
    tracker.recordSpend('openai', 50, { model: 'gpt-4o', category: 'inference' });
    tracker.recordIncome('x402', 200);
    expect(service.verifyLedger()).toBe(true);
  });

  it('getNarrative() returns structured narrative', () => {
    const narrative = service.getNarrative();
    expect(narrative.health).toBeTruthy();
    expect(narrative.summary).toBeTruthy();
  });

  it('getTaskRouting() returns routing decision', () => {
    const decision = service.getTaskRouting({
      id: 'test_task',
      type: 'inference',
      complexity: 3,
      isRevenueBearing: false,
    });
    expect(decision.action).toBeTruthy();
    expect(typeof decision.priority).toBe('number');
  });
});

// ══════════════════════════════════════════════════════════════════════
// T5 verification: SurvivalGate decision matrix
// ══════════════════════════════════════════════════════════════════════

describe('SurvivalGate decision matrix', () => {
  const envBase = {
    memoryPressure: 0,
    activeConnections: 0,
    lastHeartbeat: Date.now(),
    recentIncomeCents: 0,
    recentSpendCents: 0,
  };

  it('terminal tier blocks all inference', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    // terminalPct threshold is 2, so budgetRemainingPct: 1 puts us in terminal
    automaton.evolve({ ...envBase, budgetRemainingPct: 1 });

    const decision = service.getGateDecision();
    expect(decision.allowed).toBe(false);
    expect(decision.tier).toBe('terminal');
  });

  it('critical tier allows but restricts', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    automaton.evolve({ ...envBase, budgetRemainingPct: 8 });

    const decision = service.getGateDecision();
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('restrict');
    expect(decision.suggestedModel).toBeTruthy();
  });

  it('thriving tier allows fully', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    const decision = service.getGateDecision();
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe('allow');
  });
});
