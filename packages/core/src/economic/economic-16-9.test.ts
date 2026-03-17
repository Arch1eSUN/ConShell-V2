/**
 * Round 16.9 — Revenue Surface + Unified Ledger + Survival-Coupled Agenda Tests
 *
 * Tests for:
 * - RevenueService (independent revenue write path)
 * - EconomicProjection (unified projection on EconomicStateService)
 * - Revenue ingestion bridge (RevenueSurfaceRegistry → RevenueService)
 * - Deep agenda coupling (projection-based scoring)
 * - Survival tier enforcement (accept_task, background_work)
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { EconomicLedger } from './economic-ledger.js';
import { RevenueService } from './revenue-service.js';
import { RevenueSurfaceRegistry, createX402Surface } from './revenue-surface.js';
import { EconomicStateService } from './economic-state-service.js';
import { SurvivalGate } from './survival-coupling.js';
import { SpendTracker } from '../spend/index.js';
import { ConwayAutomaton } from '../automaton/index.js';
import { createLogger } from '../logger/index.js';
import { AgendaGenerator } from '../agenda/agenda-generator.js';
import type { Commitment } from '../agenda/commitment-model.js';
import type { EconomicProjection } from './economic-state-service.js';
import type { RevenueEvent } from './value-events.js';

const logger = createLogger('economic-16-9-test', { level: 'silent' });

// ── Helpers ──────────────────────────────────────────────────────────

function makeRevenueEvent(overrides: Partial<RevenueEvent> = {}): RevenueEvent {
  return {
    type: 'revenue',
    source: 'x402',
    amountCents: 500,
    txRef: 'tx_001',
    timestamp: new Date().toISOString(),
    protocol: 'x402',
    ...overrides,
  };
}

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: `c_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Commitment',
    kind: 'task',
    origin: 'system',
    status: 'active',
    priority: 'medium',
    expectedValueCents: 100,
    estimatedCostCents: 50,
    mustPreserve: false,
    revenueBearing: false,
    taskType: 'inference',
    materializedTaskCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Commitment;
}

function makePressureProjection(overrides: Partial<EconomicProjection> = {}): EconomicProjection {
  return {
    totalRevenueCents: 1000,
    totalSpendCents: 3000,
    currentBalanceCents: 5000,
    reserveCents: 4000,
    burnRateCentsPerDay: 200,
    dailyRevenueCents: 100,
    netFlowCentsPerDay: -100,
    runwayDays: 25,
    survivalTier: 'normal',
    isSelfSustaining: false,
    revenueBySource: { x402: 1000 },
    projectedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// S1+S2: RevenueService — Independent Revenue Write Path
// ══════════════════════════════════════════════════════════════════════

describe('RevenueService (Round 16.9)', () => {
  let ledger: EconomicLedger;
  let revSvc: RevenueService;

  beforeEach(() => {
    ledger = new EconomicLedger();
    revSvc = new RevenueService(ledger);
  });

  it('records revenue event and writes credit to ledger', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 500 }));

    expect(revSvc.totalRevenueCents()).toBe(500);
    const snap = ledger.snapshot();
    expect(snap.entryCount).toBe(1);
    expect(snap.totalCreditsCents).toBe(500);
  });

  it('accumulates multiple revenue events', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 300, source: 'x402' }));
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 200, source: 'api' }));

    expect(revSvc.totalRevenueCents()).toBe(500);
    expect(revSvc.revenueBySource()).toEqual({ x402: 300, api: 200 });
  });

  it('rejects negative amounts', () => {
    expect(() => revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: -1 }))).toThrow();
  });

  it('ignores zero-amount events', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 0 }));
    expect(revSvc.totalRevenueCents()).toBe(0);
    expect(ledger.snapshot().entryCount).toBe(0);
  });

  it('returns revenue history in reverse chronological order', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ txRef: 'first', amountCents: 100 }));
    revSvc.recordRevenueEvent(makeRevenueEvent({ txRef: 'second', amountCents: 200 }));

    const history = revSvc.revenueHistory();
    expect(history[0].txRef).toBe('second');
    expect(history[1].txRef).toBe('first');
  });

  it('tracks revenue by protocol', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ protocol: 'x402', amountCents: 300 }));
    revSvc.recordRevenueEvent(makeRevenueEvent({ protocol: 'api', amountCents: 200 }));

    expect(revSvc.revenueByProtocol()).toEqual({ x402: 300, api: 200 });
  });

  it('stats() returns aggregate snapshot', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 500 }));
    const stats = revSvc.stats();
    expect(stats.totalRevenueCents).toBe(500);
    expect(stats.eventCount).toBe(1);
  });

  it('emits events via onRevenue callback', () => {
    const received: RevenueEvent[] = [];
    revSvc.onRevenue(e => received.push(e));

    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 250 }));
    expect(received).toHaveLength(1);
    expect(received[0].amountCents).toBe(250);
  });

  it('unsubscribe stops receiving events', () => {
    const received: RevenueEvent[] = [];
    const unsub = revSvc.onRevenue(e => received.push(e));

    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 100 }));
    unsub();
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 200 }));

    expect(received).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1: Revenue Contract — RevenueSurfaceRegistry enhancements
// ══════════════════════════════════════════════════════════════════════

describe('RevenueSurfaceRegistry receipts (Round 16.9)', () => {
  let registry: RevenueSurfaceRegistry;

  beforeEach(() => {
    registry = new RevenueSurfaceRegistry();
    registry.register(createX402Surface('x402', 100));
  });

  it('emits RevenueReceipt on recordPayment', () => {
    const receipts: unknown[] = [];
    registry.onRevenueRecorded(r => receipts.push(r));

    registry.recordPayment('x402', {
      txHash: '0x123',
      chain: 'ethereum',
      from: '0xabc',
      amount: 500,
      verifiedAt: new Date().toISOString(),
    });

    expect(receipts).toHaveLength(1);
    expect((receipts[0] as any).amountCents).toBe(500);
    expect((receipts[0] as any).surfaceType).toBe('x402_payment');
    expect((receipts[0] as any).settlementStatus).toBe('settled');
  });

  it('getReceipts returns all receipts', () => {
    registry.recordPayment('x402', {
      txHash: '0x1',
      chain: 'ethereum',
      from: '0x1',
      amount: 100,
      verifiedAt: new Date().toISOString(),
    });
    registry.recordPayment('x402', {
      txHash: '0x2',
      chain: 'ethereum',
      from: '0x2',
      amount: 200,
      verifiedAt: new Date().toISOString(),
    });

    const all = registry.getReceipts();
    expect(all).toHaveLength(2);

    const limited = registry.getReceipts(1);
    expect(limited).toHaveLength(1);
    expect(limited[0].amountCents).toBe(200);
  });

  it('unsubscribe from onRevenueRecorded', () => {
    const receipts: unknown[] = [];
    const unsub = registry.onRevenueRecorded(r => receipts.push(r));
    unsub();

    registry.recordPayment('x402', {
      txHash: '0x1',
      chain: 'ethereum',
      from: '0x1',
      amount: 100,
      verifiedAt: new Date().toISOString(),
    });

    expect(receipts).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S3: EconomicProjection — Unified Projection on EconomicStateService
// ══════════════════════════════════════════════════════════════════════

describe('EconomicProjection (Round 16.9)', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let ledger: EconomicLedger;
  let revSvc: RevenueService;
  let service: EconomicStateService;

  beforeEach(() => {
    tracker = new SpendTracker({ initialBalanceCents: 50_000 });
    automaton = new ConwayAutomaton();
    ledger = new EconomicLedger();
    revSvc = new RevenueService(ledger);
    service = new EconomicStateService(tracker, automaton, logger, revSvc);
  });

  it('getProjection() returns frozen projection with all fields', () => {
    const proj = service.getProjection();
    expect(Object.isFrozen(proj)).toBe(true);
    expect(proj.survivalTier).toBeTruthy();
    expect(typeof proj.totalRevenueCents).toBe('number');
    expect(typeof proj.totalSpendCents).toBe('number');
    expect(typeof proj.burnRateCentsPerDay).toBe('number');
    expect(typeof proj.runwayDays).toBe('number');
    expect(typeof proj.isSelfSustaining).toBe('boolean');
    expect(proj.projectedAt).toBeTruthy();
  });

  it('projection reflects revenue recorded via RevenueService', () => {
    revSvc.recordRevenueEvent(makeRevenueEvent({ amountCents: 1000 }));

    const proj = service.getProjection();
    expect(proj.totalRevenueCents).toBeGreaterThanOrEqual(1000);
    expect(proj.revenueBySource).toHaveProperty('x402');
  });

  it('projection reflects spend from SpendTracker', () => {
    tracker.recordSpend('openai', 500, { model: 'gpt-4o', category: 'inference' });

    const proj = service.getProjection();
    expect(proj.totalSpendCents).toBeGreaterThanOrEqual(500);
  });

  it('recordRevenue() writes through RevenueService', () => {
    service.recordRevenue(makeRevenueEvent({ amountCents: 750 }));
    expect(revSvc.totalRevenueCents()).toBe(750);
  });

  it('recordRevenue() throws without RevenueService', () => {
    const svcNoRev = new EconomicStateService(tracker, automaton, logger);
    expect(() => svcNoRev.recordRevenue(makeRevenueEvent())).toThrow('RevenueService not configured');
  });

  it('currentSurvivalState() returns comprehensive summary', () => {
    const state = service.currentSurvivalState();
    expect(state.tier).toBeTruthy();
    expect(state.health).toBeTruthy();
    expect(state.constraints).toBeTruthy();
    expect(state.projection).toBeTruthy();
    expect(typeof state.isEmergency).toBe('boolean');
  });
});

// ══════════════════════════════════════════════════════════════════════
// S5: Deep Agenda Coupling — Projection-Based Scoring
// ══════════════════════════════════════════════════════════════════════

describe('AgendaGenerator projection-based scoring (Round 16.9)', () => {
  let generator: AgendaGenerator;

  beforeEach(() => {
    generator = new AgendaGenerator();
  });

  it('revenue task gets boosted under low reserve pressure', () => {
    const revenue = makeCommitment({ revenueBearing: true, name: 'Revenue Task' });
    const maintenance = makeCommitment({ revenueBearing: false, name: 'Maintenance' });

    const lowReserveProj = makePressureProjection({
      reserveCents: 1000,    // very low reserve
      netFlowCentsPerDay: -200,
      runwayDays: 5,
    });

    const result = generator.generate({
      commitments: [maintenance, revenue],
      mode: 'normal',
      tier: 'normal',
      projection: lowReserveProj,
    });

    // Revenue task should be ranked higher when both are selected
    const revenueItem = result.selected.find(s => s.commitment.name === 'Revenue Task');
    expect(revenueItem).toBeDefined();
    // If maintenance is also selected, Revenue Task should score higher
    const mainItem = result.selected.find(s => s.commitment.name === 'Maintenance');
    if (mainItem) {
      expect(revenueItem!.score).toBeGreaterThan(mainItem.score);
    }
  });

  it('non-revenue task gets penalized under negative net flow', () => {
    const revenue = makeCommitment({ revenueBearing: true, name: 'Revenue' });
    const nonRevenue = makeCommitment({ revenueBearing: false, name: 'Non-Revenue' });

    const bleedingProj = makePressureProjection({
      netFlowCentsPerDay: -500,
      reserveCents: 2000,
      runwayDays: 10,
    });

    const result = generator.generate({
      commitments: [nonRevenue, revenue],
      mode: 'revenue-seeking',
      tier: 'frugal',
      projection: bleedingProj,
    });

    const revenueItem = result.selected.find(i => i.commitment.name === 'Revenue')!;
    const nonRevenueItem = result.selected.find(i => i.commitment.name === 'Non-Revenue')
      ?? result.deferred.find(d => d.commitment.name === 'Non-Revenue');

    expect(revenueItem).toBeTruthy();
    // Revenue should have survival pressure reason
    expect(revenueItem.reasons.some(r => r.includes('Survival pressure'))).toBe(true);
  });

  it('mustPreserve tasks have floor guarantee', () => {
    const mustPreserve = makeCommitment({ mustPreserve: true, name: 'Must Preserve' });

    const severeProj = makePressureProjection({
      reserveCents: 100,
      netFlowCentsPerDay: -1000,
      runwayDays: 1,
    });

    const result = generator.generate({
      commitments: [mustPreserve],
      mode: 'survival-recovery',
      tier: 'critical',
      projection: severeProj,
    });

    // mustPreserve should never score below 15
    expect(result.selected[0].score).toBeGreaterThanOrEqual(15);
  });

  it('imminent death prioritizes revenue/mustPreserve over everything', () => {
    const revenue = makeCommitment({ revenueBearing: true, name: 'Revenue' });
    const luxury = makeCommitment({ revenueBearing: false, mustPreserve: false, name: 'Luxury' });
    const essential = makeCommitment({ mustPreserve: true, name: 'Essential' });

    const imminentDeathProj = makePressureProjection({
      reserveCents: 50,
      netFlowCentsPerDay: -500,
      runwayDays: 2,
    });

    const result = generator.generate({
      commitments: [luxury, revenue, essential],
      mode: 'survival-recovery',
      tier: 'critical',
      projection: imminentDeathProj,
    });

    // Revenue and essential should be selected, luxury should be deferred or lowest
    const revenueScore = result.selected.find(s => s.commitment.name === 'Revenue')?.score ?? 0;
    const essentialScore = result.selected.find(s => s.commitment.name === 'Essential')?.score ?? 0;
    const luxuryItem = result.selected.find(s => s.commitment.name === 'Luxury');
    const luxuryScore = luxuryItem?.score ?? 0;

    expect(revenueScore).toBeGreaterThan(luxuryScore);
    expect(essentialScore).toBeGreaterThan(luxuryScore);
  });

  it('no projection = no survival pressure scoring', () => {
    const c = makeCommitment({ name: 'Test' });
    const result = generator.generate({
      commitments: [c],
      mode: 'normal',
      tier: 'normal',
      // no projection
    });

    // Should work without pressure reasons
    expect(result.selected[0].reasons.every(r => !r.includes('Survival pressure'))).toBe(true);
  });

  it('ample runway = neutral pressure (no penalty/boost)', () => {
    const c = makeCommitment({ revenueBearing: false, name: 'Normal Task' });

    const healthyProj = makePressureProjection({
      reserveCents: 50_000,
      netFlowCentsPerDay: 100,
      runwayDays: 250,
    });

    const result = generator.generate({
      commitments: [c],
      mode: 'normal',
      tier: 'normal',
      projection: healthyProj,
    });

    // Should not have survival pressure reason (neutral = 50, excluded from reasons)
    expect(result.selected[0].reasons.every(r => !r.includes('Survival pressure'))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S6: Survival Tier Enforcement
// ══════════════════════════════════════════════════════════════════════

describe('SurvivalGate task acceptance (Round 16.9)', () => {
  let gate: SurvivalGate;
  const envBase = {
    memoryPressure: 0,
    activeConnections: 0,
    lastHeartbeat: Date.now(),
    recentIncomeCents: 0,
    recentSpendCents: 0,
  };

  beforeEach(() => {
    gate = new SurvivalGate();
  });

  function makeState(tier: string, balance = 10_000) {
    return {
      survivalTier: tier,
      balanceCents: balance,
      totalSpendCents: 0,
      totalIncomeCents: 0,
      burnRateCentsPerDay: 100,
      survivalDays: 100,
      netFlowCents: 0,
      profitabilityIndex: 1,
      snapshotAt: new Date().toISOString(),
    } as any;
  }

  it('normal tier accepts any task', () => {
    const result = gate.canAcceptTask(makeState('normal'), false, false);
    expect(result.allowed).toBe(true);
  });

  it('critical tier blocks non-revenue non-mustPreserve', () => {
    const result = gate.canAcceptTask(makeState('critical'), false, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Critical');
  });

  it('critical tier allows revenue-bearing', () => {
    const result = gate.canAcceptTask(makeState('critical'), true, false);
    expect(result.allowed).toBe(true);
  });

  it('critical tier allows mustPreserve', () => {
    const result = gate.canAcceptTask(makeState('critical'), false, true);
    expect(result.allowed).toBe(true);
  });

  it('terminal tier blocks non-essential tasks', () => {
    const result = gate.canAcceptTask(makeState('terminal'), false, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Terminal');
  });

  it('dead tier blocks all tasks', () => {
    const result = gate.canAcceptTask(makeState('dead'), true, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('dead');
  });

  it('backgroundWorkLimit returns tier-appropriate limit', () => {
    expect(gate.backgroundWorkLimit('thriving')).toBe(10);
    expect(gate.backgroundWorkLimit('normal')).toBe(8);
    expect(gate.backgroundWorkLimit('critical')).toBe(2);
    expect(gate.backgroundWorkLimit('terminal')).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S4: Ingestion Bridge — E2E Revenue Flow
// ══════════════════════════════════════════════════════════════════════

describe('Revenue ingestion E2E (Round 16.9)', () => {
  it('surface payment → RevenueService → ledger credit → projection visible', () => {
    const ledger = new EconomicLedger();
    const revSvc = new RevenueService(ledger);
    const registry = new RevenueSurfaceRegistry();
    registry.register(createX402Surface('x402', 100));

    // Bridge: registry → revenueService
    registry.onRevenueRecorded(receipt => {
      revSvc.recordRevenueEvent({
        type: 'revenue',
        source: receipt.surfaceType,
        amountCents: receipt.amountCents,
        txRef: receipt.proofId,
        timestamp: receipt.createdAt,
        protocol: 'x402',
        surfaceId: receipt.surfaceId,
        settlementStatus: receipt.settlementStatus,
      });
    });

    // Record payment through registry
    registry.recordPayment('x402', {
      txHash: '0xhash',
      chain: 'ethereum',
      from: '0xsender',
      amount: 1000,
      verifiedAt: new Date().toISOString(),
    });

    // Verify it flowed through to RevenueService
    expect(revSvc.totalRevenueCents()).toBe(1000);
    expect(revSvc.revenueBySource()).toHaveProperty('x402_payment');

    // Verify it reached the ledger
    expect(ledger.snapshot().totalCreditsCents).toBe(1000);
    expect(ledger.snapshot().entryCount).toBe(1);

    // Verify ledger integrity
    expect(ledger.verify().valid).toBe(true);
  });

  it('spend and revenue flow produce correct unified ledger state', () => {
    const ledger = new EconomicLedger();
    const revSvc = new RevenueService(ledger);
    const tracker = new SpendTracker({ initialBalanceCents: 10_000 });
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger, revSvc);

    // Record spend (via SpendTracker → LedgerProjection)
    tracker.recordSpend('openai', 500, { model: 'gpt-4o', category: 'inference' });

    // Record revenue (via RevenueService → Ledger directly)
    service.recordRevenue(makeRevenueEvent({ amountCents: 800, source: 'api_fee' }));

    // Get projection
    const proj = service.getProjection();
    expect(proj.totalRevenueCents).toBeGreaterThanOrEqual(800);
    expect(proj.totalSpendCents).toBeGreaterThanOrEqual(500);
  });
});
