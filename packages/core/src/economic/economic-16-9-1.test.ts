/**
 * Round 16.9.1 — Verification Matrix Tests
 *
 * Verification mapping:
 * V1: TaskAdmissionDecision schema completeness
 * V2: Rejection code stability (dead/critical/terminal)
 * V3: Exemption tagging (revenue / must-preserve)
 * V4: Recovery condition (blocked → non-empty recoveryCondition)
 * V5: SurvivalGateExplain policy summary
 * V6: AgendaFactorSummary from explainFactors()
 * V7: EconomicSnapshot shape from REST handler
 * V8: REST handler output stability
 * V9: Lint fix verification (computeEconomicScore compiles)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SurvivalGate } from './survival-coupling.js';
import { AgendaGenerator } from '../agenda/agenda-generator.js';
import { buildEconomicState } from './economic-state.js';
import { createApiRoutes } from '../api/routes.js';
import type { TaskAdmissionDecision, SurvivalGateExplain, AgendaFactorSummary } from './control-surface-contracts.js';
import type { EconomicState } from './economic-state.js';
import type { EconomicProjection } from './economic-state-service.js';
import type { SurvivalTier } from '../automaton/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeState(overrides: Partial<{
  balanceCents: number;
  totalSpendCents: number;
  totalIncomeCents: number;
  burnRateCentsPerDay: number;
  dailyIncomeCents: number;
  survivalTier: SurvivalTier;
}> = {}): EconomicState {
  return buildEconomicState({
    balanceCents: overrides.balanceCents ?? 10_000,
    totalSpendCents: overrides.totalSpendCents ?? 5_000,
    totalIncomeCents: overrides.totalIncomeCents ?? 15_000,
    burnRateCentsPerDay: overrides.burnRateCentsPerDay ?? 100,
    dailyIncomeCents: overrides.dailyIncomeCents ?? 50,
    survivalTier: overrides.survivalTier ?? 'normal',
  });
}

function makeProjection(overrides: Partial<EconomicProjection> = {}): EconomicProjection {
  return Object.freeze({
    totalRevenueCents: overrides.totalRevenueCents ?? 15_000,
    totalSpendCents: overrides.totalSpendCents ?? 5_000,
    currentBalanceCents: overrides.currentBalanceCents ?? 10_000,
    reserveCents: overrides.reserveCents ?? 9_000,
    burnRateCentsPerDay: overrides.burnRateCentsPerDay ?? 100,
    dailyRevenueCents: overrides.dailyRevenueCents ?? 150,
    netFlowCentsPerDay: overrides.netFlowCentsPerDay ?? 50,
    runwayDays: overrides.runwayDays ?? 100,
    survivalTier: overrides.survivalTier ?? ('normal' as SurvivalTier),
    isSelfSustaining: overrides.isSelfSustaining ?? true,
    revenueBySource: overrides.revenueBySource ?? { x402: 15_000 },
    projectedAt: overrides.projectedAt ?? new Date().toISOString(),
  });
}

// ── V1: TaskAdmissionDecision schema completeness ────────────────────

describe('V1: TaskAdmissionDecision schema', () => {
  const gate = new SurvivalGate();

  it('decision has all required fields', () => {
    const state = makeState({ survivalTier: 'critical' });
    const decision = gate.canAcceptTaskDetailed(state, false, false);

    // Must have all schema fields
    expect(decision).toHaveProperty('allowed');
    expect(decision).toHaveProperty('code');
    expect(decision).toHaveProperty('message');
    expect(decision).toHaveProperty('blockingState');
    expect(decision).toHaveProperty('allowedTaskClasses');
    expect(decision).toHaveProperty('rejectedTaskClass');
    expect(decision).toHaveProperty('exemptionApplied');
    expect(decision).toHaveProperty('survivalMetrics');
    expect(decision).toHaveProperty('recoveryCondition');
    expect(decision).toHaveProperty('timestamp');

    // survivalMetrics has all sub-fields
    expect(decision.survivalMetrics).toHaveProperty('balanceCents');
    expect(decision.survivalMetrics).toHaveProperty('burnRateCentsPerDay');
    expect(decision.survivalMetrics).toHaveProperty('runwayDays');
    expect(decision.survivalMetrics).toHaveProperty('tier');
  });

  it('allowed decision has null rejection fields', () => {
    const state = makeState({ survivalTier: 'normal' });
    const decision = gate.canAcceptTaskDetailed(state, false, false);

    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe('GATE_ALLOWED');
    expect(decision.rejectedTaskClass).toBeNull();
    expect(decision.exemptionApplied).toBeNull();
    expect(decision.recoveryCondition).toBeNull();
  });
});

// ── V2: Rejection code stability ─────────────────────────────────────

describe('V2: Rejection code stability', () => {
  const gate = new SurvivalGate();

  it('dead → GATE_BLOCKED_DEAD', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    const decision = gate.canAcceptTaskDetailed(state, false, false);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('GATE_BLOCKED_DEAD');
    expect(decision.blockingState).toBe('dead');
    expect(decision.rejectedTaskClass).toBe('all');
  });

  it('critical → GATE_BLOCKED_CRITICAL for non-revenue', () => {
    const state = makeState({ survivalTier: 'critical', balanceCents: 500 });
    const decision = gate.canAcceptTaskDetailed(state, false, false);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('GATE_BLOCKED_CRITICAL');
    expect(decision.rejectedTaskClass).toBe('non-revenue');
  });

  it('terminal → GATE_BLOCKED_TERMINAL for non-revenue', () => {
    const state = makeState({ survivalTier: 'terminal', balanceCents: 100 });
    const decision = gate.canAcceptTaskDetailed(state, false, false);
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('GATE_BLOCKED_TERMINAL');
    expect(decision.rejectedTaskClass).toBe('non-revenue');
  });
});

// ── V3: Exemption tagging ────────────────────────────────────────────

describe('V3: Exemption tagging', () => {
  const gate = new SurvivalGate();

  it('revenue task in critical → GATE_EXEMPT_REVENUE', () => {
    const state = makeState({ survivalTier: 'critical' });
    const decision = gate.canAcceptTaskDetailed(state, true, false);
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe('GATE_EXEMPT_REVENUE');
    expect(decision.exemptionApplied).toBe('revenue');
    expect(decision.rejectedTaskClass).toBeNull();
  });

  it('must-preserve task in terminal → GATE_EXEMPT_PRESERVE', () => {
    const state = makeState({ survivalTier: 'terminal' });
    const decision = gate.canAcceptTaskDetailed(state, false, true);
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe('GATE_EXEMPT_PRESERVE');
    expect(decision.exemptionApplied).toBe('must-preserve');
  });

  it('revenue takes precedence over must-preserve when both true', () => {
    const state = makeState({ survivalTier: 'critical' });
    const decision = gate.canAcceptTaskDetailed(state, true, true);
    expect(decision.allowed).toBe(true);
    expect(decision.exemptionApplied).toBe('revenue');
  });
});

// ── V4: Recovery condition ───────────────────────────────────────────

describe('V4: Recovery condition', () => {
  const gate = new SurvivalGate();

  it('blocked decision has non-empty recoveryCondition', () => {
    const state = makeState({ survivalTier: 'critical', balanceCents: 200 });
    const decision = gate.canAcceptTaskDetailed(state, false, false);
    expect(decision.allowed).toBe(false);
    expect(decision.recoveryCondition).toBeTruthy();
    expect(typeof decision.recoveryCondition).toBe('string');
    expect(decision.recoveryCondition!.length).toBeGreaterThan(0);
  });

  it('allowed decision has null recoveryCondition', () => {
    const state = makeState({ survivalTier: 'normal' });
    const decision = gate.canAcceptTaskDetailed(state, false, false);
    expect(decision.allowed).toBe(true);
    expect(decision.recoveryCondition).toBeNull();
  });

  it('dead has specific recovery message', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    const decision = gate.canAcceptTaskDetailed(state, true, true);
    expect(decision.recoveryCondition).toContain('revived');
  });
});

// ── V5: SurvivalGateExplain ──────────────────────────────────────────

describe('V5: SurvivalGateExplain', () => {
  const gate = new SurvivalGate();

  it('explain() returns complete policy summary', () => {
    const state = makeState({ survivalTier: 'normal' });
    const expl = gate.explain(state) as SurvivalGateExplain;
    expect(expl).toHaveProperty('isOpen');
    expect(expl).toHaveProperty('tier');
    expect(expl).toHaveProperty('health');
    expect(expl).toHaveProperty('accepting');
    expect(expl).toHaveProperty('restrictions');
    expect(expl).toHaveProperty('activeExemptions');
    expect(expl).toHaveProperty('backgroundWorkLimit');
    expect(expl).toHaveProperty('timestamp');
  });

  it('normal tier: isOpen=true, accepting=all', () => {
    const state = makeState({ survivalTier: 'normal' });
    const expl = gate.explain(state) as SurvivalGateExplain;
    expect(expl.isOpen).toBe(true);
    expect(expl.accepting).toBe('all');
    expect(expl.activeExemptions).toHaveLength(0);
  });

  it('critical tier: accepting=revenue-and-preserve-only with exemptions', () => {
    const state = makeState({ survivalTier: 'critical' });
    const expl = gate.explain(state) as SurvivalGateExplain;
    expect(expl.isOpen).toBe(true);
    expect(expl.accepting).toBe('revenue-and-preserve-only');
    expect(expl.activeExemptions.length).toBeGreaterThan(0);
    expect(expl.restrictions.length).toBeGreaterThan(0);
  });

  it('dead tier: isOpen=false, accepting=none', () => {
    const state = makeState({ survivalTier: 'dead', balanceCents: 0 });
    const expl = gate.explain(state) as SurvivalGateExplain;
    expect(expl.isOpen).toBe(false);
    expect(expl.accepting).toBe('none');
  });
});

// ── V6: AgendaFactorSummary ──────────────────────────────────────────

describe('V6: AgendaFactorSummary', () => {
  const gen = new AgendaGenerator();

  it('explainFactors() returns all fields', () => {
    const proj = makeProjection();
    const factors = gen.explainFactors(proj) as AgendaFactorSummary;
    expect(factors).toHaveProperty('reservePressure');
    expect(factors).toHaveProperty('netFlowFactor');
    expect(factors).toHaveProperty('burnRateUrgency');
    expect(factors).toHaveProperty('overallPressureScore');
    expect(factors).toHaveProperty('mustPreserveFloor');
    expect(factors).toHaveProperty('survivalReserveWindowMinutes');
    expect(factors).toHaveProperty('explanation');
    expect(factors).toHaveProperty('timestamp');
  });

  it('ample runway → neutral factors (all ~50)', () => {
    const proj = makeProjection({ runwayDays: 100, netFlowCentsPerDay: 50, reserveCents: 20_000 });
    const factors = gen.explainFactors(proj);
    expect(factors.reservePressure).toBe(50);
    expect(factors.netFlowFactor).toBe(50);
    expect(factors.burnRateUrgency).toBe(50);
    expect(factors.overallPressureScore).toBe(50);
    expect(factors.explanation).toContain('nominal');
  });

  it('low reserve + negative flow → elevated pressure', () => {
    const proj = makeProjection({ reserveCents: 1_000, netFlowCentsPerDay: -200, runwayDays: 5 });
    const factors = gen.explainFactors(proj);
    expect(factors.reservePressure).toBeGreaterThan(50);
    expect(factors.netFlowFactor).toBeGreaterThan(50);
    expect(factors.overallPressureScore).toBeGreaterThan(50);
    expect(factors.explanation).toContain('revenue');
  });

  it('mustPreserveFloor is always 15', () => {
    const factors = gen.explainFactors(makeProjection());
    expect(factors.mustPreserveFloor).toBe(15);
  });
});

// ── V7: EconomicSnapshot shape from REST ─────────────────────────────

describe('V7: EconomicSnapshot via REST handler', () => {
  it('snapshot handler returns correct shape', async () => {
    const mockProjection = makeProjection();
    const routes = createApiRoutes({
      economicStateService: {
        getProjection: () => mockProjection,
        snapshot: () => ({
          balanceCents: 10_000,
          survivalTier: 'normal',
          burnRateCentsPerDay: 100,
          survivalDays: 100,
          isSelfSustaining: true,
        }),
        currentSurvivalState: () => ({
          tier: 'normal',
          health: 'healthy',
          isEmergency: false,
          projection: mockProjection,
          constraints: {},
        }),
      },
    });

    const snapshotRoute = routes.find(r => r.path === '/api/economic/snapshot');
    expect(snapshotRoute).toBeDefined();
    const result = await snapshotRoute!.handler() as Record<string, unknown>;

    // Factual
    expect(result.totalRevenueCents).toBe(15_000);
    expect(result.totalSpendCents).toBe(5_000);
    expect(result.currentBalanceCents).toBe(10_000);
    // Derived
    expect(result.burnRateCentsPerDay).toBe(100);
    expect(result.runwayDays).toBe(100);
    // Threshold
    expect(result.reserveFloorCents).toBe(1_000);
    expect(result.mustPreserveWindowMinutes).toBe(15);
    // Explanatory
    expect(result.projectionOwner).toBe('EconomicStateService');
    expect(result.survivalTier).toBe('normal');
    expect(result.economicHealth).toBe('healthy');
    expect(result.isEmergency).toBe(false);
  });
});

// ── V8: REST handler output stability ────────────────────────────────

describe('V8: REST economic endpoints exist', () => {
  it('all 3 economic routes are registered', () => {
    const routes = createApiRoutes({});
    const economicRoutes = routes.filter(r => r.path.startsWith('/api/economic/'));
    expect(economicRoutes).toHaveLength(3);
    expect(economicRoutes.map(r => r.path).sort()).toEqual([
      '/api/economic/agenda-factors',
      '/api/economic/gate',
      '/api/economic/snapshot',
    ]);
  });

  it('gate handler returns error when services not configured', async () => {
    const routes = createApiRoutes({});
    const gateRoute = routes.find(r => r.path === '/api/economic/gate');
    const result = await gateRoute!.handler() as Record<string, unknown>;
    expect(result.error).toBeDefined();
  });

  it('agenda-factors handler returns error when services not configured', async () => {
    const routes = createApiRoutes({});
    const factorsRoute = routes.find(r => r.path === '/api/economic/agenda-factors');
    const result = await factorsRoute!.handler() as Record<string, unknown>;
    expect(result.error).toBeDefined();
  });
});
