/**
 * Round 20.3 — AgendaLawEvaluator Tests
 */
import { describe, it, expect } from 'vitest';
import { AgendaLawEvaluator, type AgendaLawContext } from './agenda-law-evaluator.js';
import { createCommitment, type Commitment } from './commitment-model.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

function makeProjection(overrides: Partial<EconomicProjection> = {}): EconomicProjection {
  return {
    reserveCents: 5000,
    runwayDays: 30,
    burnRateCentsPerDay: 100,
    netFlowCentsPerDay: 50,
    survivalTier: 'normal',
    projectedAt: new Date().toISOString(),
    ...overrides,
  } as EconomicProjection;
}

function makeCommitment(overrides: Partial<Parameters<typeof createCommitment>[0]> & Record<string, unknown> = {}): Commitment {
  const { status, expiresAt, reactivationPolicy, deferredReason, dormantReason, lastStateTransitionAt, ...createInput } = overrides as any;
  const c = createCommitment({
    name: 'Test Task',
    kind: 'revenue',
    origin: 'creator',
    ...createInput,
  });
  if (status) c.status = status;
  if (expiresAt) (c as any).expiresAt = expiresAt;
  if (reactivationPolicy) (c as any).reactivationPolicy = reactivationPolicy;
  if (deferredReason) (c as any).deferredReason = deferredReason;
  if (dormantReason) (c as any).dormantReason = dormantReason;
  if (lastStateTransitionAt) (c as any).lastStateTransitionAt = lastStateTransitionAt;
  return c;
}

describe('AgendaLawEvaluator', () => {
  const evaluator = new AgendaLawEvaluator();

  it('returns expire verdict when commitment has passed expiresAt', () => {
    const c = makeCommitment({ expiresAt: '2020-01-01T00:00:00Z', status: 'deferred' });
    const verdict = evaluator.evaluate(c, {});
    expect(verdict.verdict).toBe('expire');
    expect(verdict.recommendedStatus).toBe('expired');
    expect(verdict.confidence).toBe(1.0);
  });

  it('returns hold verdict when commitment is governance-held', () => {
    const c = makeCommitment({ status: 'active' });
    const context: AgendaLawContext = { governanceHolds: [c.id] };
    const verdict = evaluator.evaluate(c, context);
    expect(verdict.verdict).toBe('hold');
    expect(verdict.recommendedStatus).toBe('blocked');
  });

  it('boosts commitment matching creator directive', () => {
    const c = makeCommitment({ name: 'Deploy API', status: 'planned' });
    const context: AgendaLawContext = { creatorDirectives: ['Deploy API immediately'] };
    const verdict = evaluator.evaluate(c, context);
    expect(verdict.creatorDirectiveMatch).toBeDefined();
    expect(verdict.reasons.some(r => r.source === 'creator')).toBe(true);
  });

  it('demotes non-revenue work under high economic pressure', () => {
    const c = makeCommitment({
      kind: 'maintenance',
      revenueBearing: false,
      mustPreserve: false,
      status: 'active',
    });
    const proj = makeProjection({ reserveCents: 500, runwayDays: 5, netFlowCentsPerDay: -200 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(['dormant', 'defer']).toContain(verdict.verdict);
  });

  it('protects mustPreserve commitments from demotion', () => {
    const c = makeCommitment({
      kind: 'maintenance',
      revenueBearing: false,
      mustPreserve: true,
      status: 'active',
    });
    const proj = makeProjection({ reserveCents: 100, runwayDays: 2, netFlowCentsPerDay: -500 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(verdict.verdict).not.toBe('dormant');
    expect(verdict.reasons.some(r => r.source === 'survival')).toBe(true);
  });

  it('promotes dormant commitment when reactivation policy is met', () => {
    const c = makeCommitment({
      status: 'dormant',
      dormantReason: 'low reserve',
      reactivationPolicy: {
        trigger: 'reserve_recovery',
        minReserveCents: 3000,
      },
    });
    const proj = makeProjection({ reserveCents: 5000 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(verdict.verdict).toBe('promote');
    expect(verdict.recommendedStatus).toBe('active');
  });

  it('does not promote dormant commitment when reactivation condition unmet', () => {
    const c = makeCommitment({
      status: 'dormant',
      dormantReason: 'low reserve',
      reactivationPolicy: {
        trigger: 'reserve_recovery',
        minReserveCents: 10000,
      },
    });
    const proj = makeProjection({ reserveCents: 2000 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(verdict.verdict).not.toBe('promote');
  });

  it('provides economic factors in verdict', () => {
    const c = makeCommitment({ status: 'active' });
    const proj = makeProjection({ reserveCents: 1000, runwayDays: 10, netFlowCentsPerDay: -50 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(verdict.economicFactors).toBeDefined();
    expect(verdict.economicFactors.reservePressure).toBeGreaterThan(0);
    expect(verdict.economicFactors.runwayUrgency).toBeGreaterThan(0);
  });

  it('evaluateBatch processes multiple commitments', () => {
    const c1 = makeCommitment({ name: 'Task A' });
    const c2 = makeCommitment({ name: 'Task B', kind: 'governance' });
    const verdicts = evaluator.evaluateBatch([c1, c2], {});
    expect(verdicts).toHaveLength(2);
    expect(verdicts[0].commitmentId).toBe(c1.id);
    expect(verdicts[1].commitmentId).toBe(c2.id);
  });

  it('promotes revenue-bearing work in healthy economy', () => {
    const c = makeCommitment({
      kind: 'revenue',
      revenueBearing: true,
      expectedValueCents: 5000,
      estimatedCostCents: 500,
      status: 'planned',
    });
    const proj = makeProjection({ reserveCents: 8000, runwayDays: 60, netFlowCentsPerDay: 100 });
    const verdict = evaluator.evaluate(c, { projection: proj });
    expect(verdict.recommendedStatus).toBe('active');
  });
});
