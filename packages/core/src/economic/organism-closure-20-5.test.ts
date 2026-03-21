/**
 * Round 20.5 — Organism Closure Tests
 *
 * Covers:
 * - TaskSettlementBridge.settleChildLease (Phase A)
 * - ChildOutcomeMerger + ChildOutcomeEvaluation (Phase B)
 * - SpecializationRouter (Phase C)
 * - SessionRegistry evaluation/merge storage (Phase D)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChildSession } from '../orchestration/child-session.js';
import { ChildFundingLease } from '../orchestration/child-funding-lease.js';
import { SessionRegistry } from '../orchestration/session-registry.js';
import { TaskSettlementBridge } from './task-settlement-bridge.js';
import { CanonicalSettlementLedger } from './settlement-ledger.js';
import { RevenueSurfaceRegistry, createTaskServiceSurface } from './revenue-surface.js';
import { ChildOutcomeMerger } from '../orchestration/child-outcome-merger.js';
import { SpecializationRouter } from '../orchestration/specialization-router.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeInfra() {
  const ledger = new CanonicalSettlementLedger();
  const revSurfaces = new RevenueSurfaceRegistry();
  revSurfaces.register(createTaskServiceSurface('svc-1', 1000));
  const bridge = new TaskSettlementBridge(ledger, revSurfaces);
  const registry = new SessionRegistry();
  const merger = new ChildOutcomeMerger(registry, bridge);
  const router = new SpecializationRouter(registry);
  return { ledger, revSurfaces, bridge, registry, merger, router };
}

function makeSession(overrides: {
  name?: string;
  budget?: number;
  role?: string;
  task?: string;
  specialization?: string;
  capabilities?: string[];
  toolCategories?: string[];
} = {}) {
  return new ChildSession({
    name: overrides.name ?? 'test-child',
    manifest: {
      role: overrides.role ?? 'worker',
      task: overrides.task ?? 'do-stuff',
      specialization: overrides.specialization,
      expectedCapabilities: overrides.capabilities,
      allowedToolCategories: overrides.toolCategories,
    },
    budgetCents: overrides.budget ?? 1000,
  });
}

function makeLease(sessionId: string, overrides: {
  allocated?: number;
  expectedUtility?: number;
  purpose?: string;
} = {}) {
  return new ChildFundingLease({
    sessionId,
    allocatedCents: overrides.allocated ?? 500,
    reserveFreezeCents: 0,
    spendCeilingCents: 0,
    purpose: overrides.purpose ?? 'test-lease',
    expectedUtilityCents: overrides.expectedUtility ?? 200,
  });
}

// ── Phase A: settleChildLease ───────────────────────────────────────

describe('TaskSettlementBridge.settleChildLease', () => {
  it('settles a completed child with full utility realized', () => {
    const { bridge, ledger } = makeInfra();
    const session = makeSession();
    session.start();
    const lease = makeLease(session.id, { allocated: 500, expectedUtility: 200 });
    lease.recordSpend(300);
    session.complete('done', 'merge-data');

    const result = bridge.settleChildLease(lease, session);

    expect(result.settled).toBe(true);
    expect(result.closeOutType).toBe('success');
    expect(result.totalSpendCents).toBe(300);
    expect(result.utilityRealizedCents).toBe(200);
    expect(result.utilityExpectedCents).toBe(200);
    expect(result.effectivenessRatio).toBe(1);
    expect(result.ledgerEntryIds).toHaveLength(1);
    expect(lease.status).toBe('settled');
  });

  it('settles a failed child with zero utility', () => {
    const { bridge } = makeInfra();
    const session = makeSession();
    session.start();
    const lease = makeLease(session.id, { allocated: 500, expectedUtility: 200 });
    lease.recordSpend(400);
    session.fail('OOM crash');

    const result = bridge.settleChildLease(lease, session);

    expect(result.closeOutType).toBe('failure');
    expect(result.closeOutReason).toBe('OOM crash');
    expect(result.utilityRealizedCents).toBe(0);
    expect(result.effectivenessRatio).toBe(0);
    expect(result.totalSpendCents).toBe(400);
  });

  it('settles a recalled child with partial utility', () => {
    const { bridge } = makeInfra();
    const session = makeSession();
    session.start();
    const lease = makeLease(session.id, { allocated: 1000, expectedUtility: 400 });
    lease.recordSpend(500); // 50% utilization
    session.recall('governance decision');

    const result = bridge.settleChildLease(lease, session);

    expect(result.closeOutType).toBe('recall');
    expect(result.closeOutReason).toBe('governance decision');
    // Partial: 400 * (50/100) * 0.5 = 100
    expect(result.utilityRealizedCents).toBe(100);
    expect(result.effectivenessRatio).toBe(0.25);
  });

  it('settles revoked lease', () => {
    const { bridge } = makeInfra();
    const session = makeSession();
    session.start();
    const lease = makeLease(session.id);
    lease.recordSpend(100);
    lease.revoke('budget cut');

    const result = bridge.settleChildLease(lease, session);

    expect(result.closeOutType).toBe('revoke');
    expect(result.closeOutReason).toBe('budget cut');
    expect(result.utilityRealizedCents).toBe(0);
  });

  it('tracks child lease diagnostics', () => {
    const { bridge } = makeInfra();
    const s1 = makeSession();
    s1.start();
    const l1 = makeLease(s1.id, { allocated: 500, expectedUtility: 200 });
    l1.recordSpend(200);
    s1.complete('done');
    bridge.settleChildLease(l1, s1);

    const s2 = makeSession();
    s2.start();
    const l2 = makeLease(s2.id, { allocated: 300, expectedUtility: 100 });
    l2.recordSpend(300);
    s2.fail('error');
    bridge.settleChildLease(l2, s2);

    const diag = bridge.diagnostics();
    expect(diag.childLeasesSettled).toBe(2);
    expect(diag.childLeasesCostCents).toBe(500);
    expect(diag.childLeasesUtilityRealizedCents).toBe(200);
  });
});

// ── Phase B: ChildOutcomeMerger ─────────────────────────────────────

describe('ChildOutcomeMerger', () => {
  it('merges completed child with merge result → commitment_update', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession({ budget: 500 });
    session.start();
    const lease = makeLease(session.id, { expectedUtility: 200 });
    lease.recordSpend(200);
    session.complete('analysis done', 'key-finding: X');
    registry.registerSession(session);
    registry.registerLease(lease);

    const result = merger.mergeOutcome(session, lease);

    expect(result.mergeType).toBe('commitment_update');
    expect(result.evaluation.completionQuality).toBe(95); // 80 + 15 (merge bonus)
    expect(result.evaluation.mergeUsefulness).toBeGreaterThanOrEqual(70);
    expect(result.evaluation.failureSeverity).toBe('none');
    expect(result.leaseSettlement).toBeDefined();
    expect(result.leaseSettlement!.settled).toBe(true);
  });

  it('merges completed child without merge result → follow_up', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession({ budget: 500 });
    session.start();
    session.complete('done without merge');
    registry.registerSession(session);

    const result = merger.mergeOutcome(session);

    expect(result.mergeType).toBe('follow_up');
    expect(result.evaluation.completionQuality).toBe(80);
    expect(result.evaluation.mergeUsefulness).toBe(20);
  });

  it('merges failed child with high waste → remediation', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession({ budget: 500 });
    session.start();
    const lease = makeLease(session.id, { allocated: 500 });
    lease.recordSpend(450); // 90% waste
    session.fail('critical error');
    registry.registerSession(session);
    registry.registerLease(lease);

    const result = merger.mergeOutcome(session, lease);

    expect(result.mergeType).toBe('remediation');
    expect(result.evaluation.completionQuality).toBe(0);
    expect(result.evaluation.failureSeverity).toBe('critical');
  });

  it('merges failed child with low waste → noop', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession({ budget: 500 });
    session.start();
    const lease = makeLease(session.id, { allocated: 500 });
    lease.recordSpend(50); // 10% waste
    session.fail('minor issue');
    registry.registerSession(session);
    registry.registerLease(lease);

    const result = merger.mergeOutcome(session, lease);

    expect(result.mergeType).toBe('noop');
    expect(result.evaluation.failureSeverity).toBe('low');
  });

  it('merges recalled child → requeue', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession({ budget: 500 });
    session.start();
    session.recall('budget concern');
    registry.registerSession(session);

    const result = merger.mergeOutcome(session);

    expect(result.mergeType).toBe('requeue');
    expect(result.followUpDescription).toContain('Requeue');
  });

  it('throws on non-terminal session', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession();
    session.start();
    registry.registerSession(session);

    expect(() => merger.mergeOutcome(session)).toThrow('non-terminal');
  });

  it('stores evaluation and merge result in registry', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession();
    session.start();
    session.complete('done');
    registry.registerSession(session);

    merger.mergeOutcome(session);

    expect(registry.getEvaluation(session.id)).toBeDefined();
    expect(registry.getMergeResults(session.id)).toHaveLength(1);
  });

  it('evaluates reporting reliability with checkpoints', () => {
    const { merger, registry } = makeInfra();
    const session = makeSession();
    session.start();
    registry.registerSession(session);

    registry.submitReport({
      sessionId: session.id,
      kind: 'checkpoint',
      progress: 50,
      budgetUsedCents: 100,
      checkpoint: 'mid-point',
      reportedAt: new Date().toISOString(),
    });
    registry.submitReport({
      sessionId: session.id,
      kind: 'heartbeat',
      progress: 75,
      budgetUsedCents: 200,
      reportedAt: new Date().toISOString(),
    });
    registry.submitReport({
      sessionId: session.id,
      kind: 'heartbeat',
      progress: 90,
      budgetUsedCents: 300,
      reportedAt: new Date().toISOString(),
    });

    session.complete('done');
    const result = merger.mergeOutcome(session);

    expect(result.evaluation.reportingReliability).toBe(100); // 40+30+20+10
  });

  it('tracks merger diagnostics', () => {
    const { merger, registry } = makeInfra();

    const s1 = makeSession();
    s1.start(); s1.complete('done', 'merge-data');
    registry.registerSession(s1);
    merger.mergeOutcome(s1);

    const s2 = makeSession();
    s2.start(); s2.fail('err');
    registry.registerSession(s2);
    merger.mergeOutcome(s2);

    const diag = merger.diagnostics();
    expect(diag.totalMerged).toBe(2);
    expect(diag.mergesByType['commitment_update']).toBe(1);
    expect(diag.mergesByType['noop']).toBe(1);
  });
});

// ── Phase C: SpecializationRouter ───────────────────────────────────

describe('SpecializationRouter', () => {
  it('matches specialization by tag', () => {
    const { router, registry } = makeInfra();
    const session = makeSession({
      specialization: 'data-analysis',
      capabilities: ['sql', 'visualization'],
    });
    session.start(); session.complete('done');
    registry.registerSession(session);

    const matches = router.matchSpecialization({
      task: 'analyze sales',
      preferredSpecialization: 'data-analysis',
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].specialization).toBe('data-analysis');
    expect(matches[0].score).toBeGreaterThanOrEqual(40);
  });

  it('scores capability overlap', () => {
    const { router, registry } = makeInfra();
    const session = makeSession({
      specialization: 'web-dev',
      capabilities: ['react', 'css', 'node'],
    });
    session.start(); session.complete('done');
    registry.registerSession(session);

    const matches = router.matchSpecialization({
      task: 'build UI',
      preferredSpecialization: 'web-dev',
      requiredCapabilities: ['react', 'css'],
    });

    expect(matches[0].scoreBreakdown.capabilityMatch).toBe(30); // 2/2 = 100%
  });

  it('recommends manifest from best match', () => {
    const { router, registry } = makeInfra();
    const session = makeSession({
      specialization: 'ml-training',
      capabilities: ['pytorch', 'cuda'],
      toolCategories: ['compute'],
    });
    session.start(); session.complete('done');
    registry.registerSession(session);

    const rec = router.recommendSpawnManifest({
      task: 'train model',
      preferredSpecialization: 'ml-training',
    });

    expect(rec.confidence).toBeGreaterThan(0.3);
    expect(rec.manifest.specialization).toBe('ml-training');
    expect(rec.basedOnSessions).toBe(1);
  });

  it('recommends fallback for no matches', () => {
    const { router } = makeInfra();

    const rec = router.recommendSpawnManifest({
      task: 'unknown task',
      requiredCapabilities: ['quantum-sim'],
    });

    expect(rec.confidence).toBe(0.3);
    expect(rec.basedOnSessions).toBe(0);
    expect(rec.manifest.task).toBe('unknown task');
  });

  it('evaluateRouting returns 0 for non-existent session', () => {
    const { router } = makeInfra();
    expect(router.evaluateRouting('nonexistent', { task: 'x' })).toBe(0);
  });

  it('filters by minQualityThreshold', () => {
    const { router, registry, merger } = makeInfra();
    const session = makeSession({
      specialization: 'api-dev',
      capabilities: ['rest'],
    });
    session.start(); session.fail('failed badly');
    registry.registerSession(session);
    // Create evaluation via merger
    const lease = makeLease(session.id);
    lease.recordSpend(400); // 80% waste → critical
    registry.registerLease(lease);
    merger.mergeOutcome(session, lease);

    const matches = router.matchSpecialization({
      task: 'build api',
      preferredSpecialization: 'api-dev',
      requiredCapabilities: ['rest'],
      minQualityThreshold: 50,
    });

    expect(matches).toHaveLength(0); // quality 0 < threshold 50
  });

  it('produces specialization snapshot', () => {
    const { router, registry, merger } = makeInfra();

    const s1 = makeSession({ specialization: 'data', capabilities: ['sql'] });
    s1.start(); s1.complete('done');
    registry.registerSession(s1);
    merger.mergeOutcome(s1);

    const s2 = makeSession({ specialization: 'data', capabilities: ['sql'] });
    s2.start(); s2.complete('done', 'merge');
    registry.registerSession(s2);
    merger.mergeOutcome(s2);

    const snapshot = router.specializationSnapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].specialization).toBe('data');
    expect(snapshot[0].sessionCount).toBe(2);
    expect(snapshot[0].avgQuality).toBeGreaterThan(0);
  });
});

// ── Phase D: SessionRegistry Enhancements ───────────────────────────

describe('SessionRegistry Round 20.5 Enhancements', () => {
  it('stores and retrieves evaluations', () => {
    const { registry } = makeInfra();
    const evaluation = {
      sessionId: 'sess-1',
      completionQuality: 80,
      mergeUsefulness: 70,
      failureSeverity: 'none' as const,
      reportingReliability: 60,
      utilityRealizedCents: 200,
      utilityExpectedCents: 200,
      effectivenessRatio: 1,
      evaluatedAt: new Date().toISOString(),
    };

    registry.submitEvaluation(evaluation);

    expect(registry.getEvaluation('sess-1')).toEqual(evaluation);
    expect(registry.listEvaluations()).toHaveLength(1);
  });

  it('stores and retrieves merge results', () => {
    const { registry } = makeInfra();
    const mergeResult = {
      sessionId: 'sess-1',
      mergeType: 'commitment_update' as const,
      reason: 'test',
      evaluation: {
        sessionId: 'sess-1',
        completionQuality: 80,
        mergeUsefulness: 70,
        failureSeverity: 'none' as const,
        reportingReliability: 60,
        utilityRealizedCents: 200,
        utilityExpectedCents: 200,
        effectivenessRatio: 1,
        evaluatedAt: new Date().toISOString(),
      },
      mergedAt: new Date().toISOString(),
    };

    registry.submitMergeResult(mergeResult);

    expect(registry.getMergeResults('sess-1')).toHaveLength(1);
    expect(registry.getMergeResults()).toHaveLength(1);
  });

  it('childRuntimeSummary includes organism closure data', () => {
    const { registry, merger } = makeInfra();
    const session = makeSession();
    session.start(); session.complete('done', 'merge-data');
    registry.registerSession(session);
    const lease = makeLease(session.id, { expectedUtility: 300 });
    lease.recordSpend(200);
    registry.registerLease(lease);
    merger.mergeOutcome(session, lease);

    const summary = registry.childRuntimeSummary();

    expect(summary.recentMergeResults).toHaveLength(1);
    expect(summary.utilitySummary.totalExpectedCents).toBe(300);
    expect(summary.utilitySummary.totalRealizedCents).toBe(300);
    expect(summary.utilitySummary.avgEffectivenessRatio).toBe(1);
  });

  it('diagnostics includes evaluation and merge counts', () => {
    const { registry, merger } = makeInfra();
    const session = makeSession();
    session.start(); session.complete('done');
    registry.registerSession(session);
    merger.mergeOutcome(session);

    const diag = registry.diagnostics();

    expect(diag.totalEvaluations).toBe(1);
    expect(diag.totalMergeResults).toBe(1);
    expect(diag.mergesByType).toBeDefined();
  });
});
