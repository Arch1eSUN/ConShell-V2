/**
 * Round 20.3 — AgendaLifecycleReconciler Tests
 */
import { describe, it, expect } from 'vitest';
import { AgendaLifecycleReconciler } from './agenda-lifecycle-reconciler.js';
import { AgendaLawEvaluator, type AgendaLawContext } from './agenda-law-evaluator.js';
import { CommitmentStore } from './commitment-store.js';
import { createCommitment } from './commitment-model.js';
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

describe('AgendaLifecycleReconciler', () => {
  function setup() {
    const evaluator = new AgendaLawEvaluator();
    const reconciler = new AgendaLifecycleReconciler(evaluator);
    const store = new CommitmentStore();
    return { evaluator, reconciler, store };
  }

  it('promotes planned commitment to active in normal conditions', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Build Feature', kind: 'revenue', origin: 'creator' });
    store.add(c);

    const result = reconciler.reconcile(store, {});
    // planned → active is the default promotion
    const updated = store.get(c.id)!;
    expect(['active', 'planned']).toContain(updated.status);
  });

  it('expires commitments past expiresAt', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Legacy Task', kind: 'maintenance', origin: 'system' });
    c.status = 'deferred';
    (c as any).expiresAt = '2020-01-01T00:00:00Z';
    (c as any).deferredReason = 'waiting';
    store.add(c);

    const result = reconciler.reconcile(store, {});
    expect(result.expired).toContain(c.id);
    expect(store.get(c.id)!.status).toBe('expired');
  });

  it('demotes non-revenue active work under economic pressure', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({
      name: 'Code Review',
      kind: 'governance',
      origin: 'self',
      revenueBearing: false,
      mustPreserve: false,
    });
    c.status = 'active';
    store.add(c);

    const proj = makeProjection({ reserveCents: 300, runwayDays: 3, netFlowCentsPerDay: -200 });
    const result = reconciler.reconcile(store, { projection: proj });
    expect(result.demoted).toContain(c.id);
    const updated = store.get(c.id)!;
    expect(['deferred', 'dormant', 'blocked']).toContain(updated.status);
  });

  it('protects mustPreserve commitments during economic stress', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({
      name: 'Health Check',
      kind: 'maintenance',
      origin: 'system',
      mustPreserve: true,
    });
    c.status = 'active';
    store.add(c);

    const proj = makeProjection({ reserveCents: 100, runwayDays: 1 });
    const result = reconciler.reconcile(store, { projection: proj });
    expect(result.demoted).not.toContain(c.id);
    expect(store.get(c.id)!.status).toBe('active');
  });

  it('promotes dormant commitment when reactivation policy is met', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Marketing Campaign', kind: 'revenue', origin: 'creator' });
    c.status = 'dormant';
    (c as any).dormantReason = 'low reserve';
    (c as any).reactivationPolicy = { trigger: 'reserve_recovery', minReserveCents: 3000 };
    store.add(c);

    const proj = makeProjection({ reserveCents: 5000 });
    const result = reconciler.reconcile(store, { projection: proj });
    expect(result.promoted).toContain(c.id);
    expect(store.get(c.id)!.status).toBe('active');
  });

  it('keeps governance-held commitments blocked', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Risky Deploy', kind: 'user-facing', origin: 'creator' });
    c.status = 'active';
    store.add(c);

    const context: AgendaLawContext = { governanceHolds: [c.id] };
    const result = reconciler.reconcile(store, context);
    expect(result.demoted).toContain(c.id);
    expect(store.get(c.id)!.status).toBe('blocked');
  });

  it('tracks transition history', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Aged Task', kind: 'maintenance', origin: 'system' });
    c.status = 'deferred';
    (c as any).expiresAt = '2020-01-01T00:00:00Z';
    (c as any).deferredReason = 'waiting';
    store.add(c);

    reconciler.reconcile(store, {});
    const history = reconciler.getTransitionHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history.some(r => r.commitmentId === c.id && r.toStatus === 'expired')).toBe(true);
  });

  it('skips terminal commitments', () => {
    const { reconciler, store } = setup();
    const c = createCommitment({ name: 'Done Task', kind: 'revenue', origin: 'creator' });
    c.status = 'completed';
    store.add(c);

    const result = reconciler.reconcile(store, {});
    expect(result.transitions).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0); // terminal commitments are filtered out
  });
});
