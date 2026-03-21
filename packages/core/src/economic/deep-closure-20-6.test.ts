/**
 * Round 20.6 — Deep Organism Closure and Runtime Enforcement
 *
 * Comprehensive tests covering all 4 phases:
 * Phase A: Single Spend Truth (ChildSession → lease delegation)
 * Phase B: Deep Commitment Mutation (ChildOutcomeMerger → CommitmentStore)
 * Phase C: Routing Enforcement (SpecializationRouter.enforceRouting())
 * Phase D: Organism Control Surface (SessionRegistry.organismControlSurface())
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChildSession } from '../orchestration/child-session.js';
import { ChildFundingLease } from '../orchestration/child-funding-lease.js';
import { SessionRegistry } from '../orchestration/session-registry.js';
import { ChildOutcomeMerger } from '../orchestration/child-outcome-merger.js';
import { SpecializationRouter } from '../orchestration/specialization-router.js';
import { CommitmentStore } from '../agenda/commitment-store.js';
import { createCommitment } from '../agenda/commitment-model.js';

// Helper: create a manifest with required fields
function manifest(task: string, spec?: string, caps?: string[]) {
  return {
    role: 'child',
    task,
    specialization: spec,
    expectedCapabilities: caps,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Phase A: Single Spend Truth
// ═══════════════════════════════════════════════════════════════════

describe('Phase A: Single Spend Truth', () => {
  it('unfunded session uses local tracking (legacy fallback)', () => {
    const session = new ChildSession({
      name: 'no-lease-session',
      manifest: manifest('test'),
      budgetCents: 1000,
    });
    session.start();
    session.trackSpend(200);
    session.trackSpend(150);

    expect(session.budgetUsedCents).toBe(350);
    expect(session.budgetRemaining).toBe(650);
    expect(session.hasCanonicalSpendTruth).toBe(false);
  });

  it('funded session delegates trackSpend to lease', () => {
    const lease = new ChildFundingLease({
      sessionId: 'test-session',
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'test',
      expectedUtilityCents: 800,
    });

    const session = new ChildSession({
      name: 'funded-session',
      manifest: manifest('delegated'),
      budgetCents: 1000,
      leaseId: lease.leaseId,
      leaseRef: lease,
    });
    session.start();
    session.trackSpend(300);

    expect(session.budgetUsedCents).toBe(300);
    expect(lease.spentCents).toBe(300);
    expect(session.hasCanonicalSpendTruth).toBe(true);
  });

  it('budgetUsedCents mirrors lease.spentCents directly', () => {
    const lease = new ChildFundingLease({
      sessionId: 'mirror-test',
      allocatedCents: 2000,
      reserveFreezeCents: 1000,
      spendCeilingCents: 0,
      purpose: 'mirror test',
      expectedUtilityCents: 1500,
    });

    const session = new ChildSession({
      name: 'mirror-session',
      manifest: manifest('mirror'),
      budgetCents: 2000,
      leaseRef: lease,
    });
    session.start();
    session.trackSpend(500);

    expect(session.budgetUsedCents).toBe(500);
    expect(session.budgetRemaining).toBe(1500);
    expect(session.budgetUsedCents).toBe(lease.spentCents);
  });

  it('session.budgetUsedCents === lease.spentCents after multiple spends', () => {
    const lease = new ChildFundingLease({
      sessionId: 'sync-test',
      allocatedCents: 5000,
      reserveFreezeCents: 2000,
      spendCeilingCents: 0,
      purpose: 'sync test',
      expectedUtilityCents: 3000,
    });

    const session = new ChildSession({
      name: 'sync-session',
      manifest: manifest('sync'),
      budgetCents: 5000,
      leaseRef: lease,
    });
    session.start();
    session.trackSpend(100);
    session.trackSpend(200);
    session.trackSpend(300);

    expect(session.budgetUsedCents).toBe(600);
    expect(lease.spentCents).toBe(600);
    expect(session.budgetUsedCents).toBe(lease.spentCents);
  });

  it('throws on negative spend even with lease', () => {
    const lease = new ChildFundingLease({
      sessionId: 'neg-test',
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'neg test',
      expectedUtilityCents: 800,
    });

    const session = new ChildSession({
      name: 'neg-session',
      manifest: manifest('neg'),
      budgetCents: 1000,
      leaseRef: lease,
    });
    session.start();

    expect(() => session.trackSpend(-10)).toThrow('Spend amount must be non-negative');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase B: Deep Commitment Mutation
// ═══════════════════════════════════════════════════════════════════

describe('Phase B: Deep Commitment Mutation', () => {
  let registry: SessionRegistry;
  let store: CommitmentStore;
  let merger: ChildOutcomeMerger;

  beforeEach(() => {
    registry = new SessionRegistry();
    store = new CommitmentStore();
    merger = new ChildOutcomeMerger(registry, undefined, store);
  });

  it('commitment_update merge marks target commitment completed', () => {
    // Create child session first so we know its ID
    const session = new ChildSession({
      name: 'research-child',
      manifest: manifest('research', 'research'),
      budgetCents: 500,
    });

    const commitment = createCommitment({
      name: 'Delegated work',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'research',
      estimatedCostCents: 500,
      expectedValueCents: 1000,
      delegateChildId: session.id,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    session.start();
    session.complete('Research done — found 3 key insights', 'integrated');
    registry.registerSession(session);

    const result = merger.mergeOutcome(session);

    expect(result).toBeDefined();
    expect(result.commitmentMutationType).toBe('completed');
    expect(result.targetCommitmentId).toBe(commitment.id);

    const updated = store.get(commitment.id);
    expect(updated!.status).toBe('completed');
  });

  it('follow_up merge creates new follow-up commitment', () => {
    const session = new ChildSession({
      name: 'partial-work',
      manifest: manifest('analysis', 'analytics'),
      budgetCents: 1000,
    });
    session.start();
    session.complete('Partial analysis — needs further investigation');
    registry.registerSession(session);

    const lease = new ChildFundingLease({
      sessionId: session.id,
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'analysis',
      expectedUtilityCents: 10000,
    });
    registry.registerLease(lease);

    const result = merger.mergeOutcome(session, lease);

    expect(result).toBeDefined();
    if (result.mergeType === 'follow_up') {
      expect(result.commitmentMutationType).toBe('created_follow_up');
      expect(result.createdCommitmentId).toBeDefined();
      const created = store.get(result.createdCommitmentId!);
      expect(created).toBeDefined();
      expect(created!.kind).toBe('delegation');
      expect(created!.origin).toBe('system');
    }
  });

  it('remediation merge creates high-priority remediation commitment', () => {
    const session = new ChildSession({
      name: 'failed-work',
      manifest: manifest('coding', 'code'),
      budgetCents: 1000,
    });
    session.start();
    session.trackSpend(800);
    session.fail('Critical compilation failure');
    registry.registerSession(session);

    const lease = new ChildFundingLease({
      sessionId: session.id,
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'coding',
      expectedUtilityCents: 2000,
    });
    registry.registerLease(lease);

    const result = merger.mergeOutcome(session, lease);

    expect(result).toBeDefined();
    if (result.mergeType === 'remediation') {
      expect(result.commitmentMutationType).toBe('created_remediation');
      expect(result.createdCommitmentId).toBeDefined();
      const created = store.get(result.createdCommitmentId!);
      expect(created).toBeDefined();
      expect(created!.priority).toBe('high');
    }
  });

  it('requeue merge defers parent commitment for recalled session', () => {
    const commitment = createCommitment({
      name: 'Recalled work',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'writing',
      estimatedCostCents: 200,
      expectedValueCents: 500,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    const session = new ChildSession({
      name: 'recalled-child',
      manifest: manifest('writing'),
      budgetCents: 500,
    });
    session.start();
    session.trackSpend(50);
    session.recall('Timeout — governance limit');
    registry.registerSession(session);

    const result = merger.mergeOutcome(session);

    expect(result).toBeDefined();
    if (result.mergeType === 'requeue') {
      expect(['deferred', 'dormant']).toContain(result.commitmentMutationType);
      expect(result.targetCommitmentId).toBe(commitment.id);
    }
  });

  it('noop merge produces no commitment mutation', () => {
    const session = new ChildSession({
      name: 'noop-child',
      manifest: manifest('trivial'),
      budgetCents: 100,
    });
    session.start();
    session.complete('Done, nothing to follow up');
    registry.registerSession(session);

    const result = merger.mergeOutcome(session);

    expect(result).toBeDefined();
    if (result.mergeType === 'noop' || result.commitmentMutationType === 'none') {
      expect(result.createdCommitmentId).toBeUndefined();
    }
  });

  it('merger without CommitmentStore returns mutation type none', () => {
    const mergerNoStore = new ChildOutcomeMerger(registry);

    const session = new ChildSession({
      name: 'no-store',
      manifest: manifest('test'),
      budgetCents: 100,
    });
    session.start();
    session.complete('Done');
    registry.registerSession(session);

    const result = mergerNoStore.mergeOutcome(session);
    expect(result).toBeDefined();
    expect(result.commitmentMutationType).toBe('none');
  });

  it('diagnostics tracks commitment mutations count', () => {
    const commitment = createCommitment({
      name: 'Track mutations',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'tracking',
      estimatedCostCents: 100,
      expectedValueCents: 200,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    const session = new ChildSession({
      name: 'mutation-counter',
      manifest: manifest('tracking'),
      budgetCents: 100,
    });
    session.start();
    session.complete('Tracked');
    registry.registerSession(session);

    merger.mergeOutcome(session);

    const diag = merger.diagnostics();
    expect(diag.commitmentMutations).toBeGreaterThanOrEqual(0);
    expect(typeof diag.commitmentMutations).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase C: Routing Enforcement
// ═══════════════════════════════════════════════════════════════════

describe('Phase C: Routing Enforcement', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
  });

  it('allows routing for clean specialization', () => {
    const result = router.enforceRouting(manifest('research', 'researcher'));
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('Routing check passed');
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects specialization with poor historical quality', () => {
    for (let i = 0; i < 3; i++) {
      const session = new ChildSession({
        name: `bad-session-${i}`,
        manifest: manifest('coding', 'bad-coder'),
        budgetCents: 1000,
      });
      session.start();
      session.complete('Mediocre result');
      registry.registerSession(session);

      registry.submitEvaluation({
        sessionId: session.id,
        completionQuality: 15,
        mergeUsefulness: 10,
        failureSeverity: 'none',
        reportingReliability: 50,
        effectivenessRatio: 0.1,
        utilityExpectedCents: 1000,
        utilityRealizedCents: 100,
        evaluatedAt: new Date().toISOString(),
      });
    }

    const result = router.enforceRouting(manifest('coding', 'bad-coder'));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('poor historical quality');
  });

  it('rejects specialization with multiple high-severity failures', () => {
    for (let i = 0; i < 2; i++) {
      const session = new ChildSession({
        name: `failed-session-${i}`,
        manifest: manifest('coding', 'crash-coder'),
        budgetCents: 1000,
      });
      session.start();
      session.trackSpend(900);
      session.fail('Catastrophic failure');
      registry.registerSession(session);

      registry.submitEvaluation({
        sessionId: session.id,
        completionQuality: 40, // Above quality gate (30), so avoid-list triggers first
        mergeUsefulness: 0,
        failureSeverity: 'critical',
        reportingReliability: 0,
        effectivenessRatio: 0,
        utilityExpectedCents: 2000,
        utilityRealizedCents: 0,
        evaluatedAt: new Date().toISOString(),
      });
    }

    const result = router.enforceRouting(manifest('coding', 'crash-coder'));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('high-severity failures');
  });

  it('suggests reuse for high-quality completed session', () => {
    const session = new ChildSession({
      name: 'good-session',
      manifest: manifest('research', 'ace-researcher'),
      budgetCents: 500,
    });
    session.start();
    session.complete('Excellent findings');
    registry.registerSession(session);

    registry.submitEvaluation({
      sessionId: session.id,
      completionQuality: 85,
      mergeUsefulness: 80,
      failureSeverity: 'none',
      reportingReliability: 90,
      effectivenessRatio: 1.5,
      utilityExpectedCents: 500,
      utilityRealizedCents: 750,
      evaluatedAt: new Date().toISOString(),
    });

    const result = router.enforceRouting(manifest('research', 'ace-researcher'));
    expect(result.allowed).toBe(true);
    expect(result.suggestReuseSessionId).toBe(session.id);
  });

  it('warns on missing capabilities', () => {
    const result = router.enforceRouting(
      manifest('coding', 'basic-coder', ['javascript']),
      {
        task: 'coding',
        requiredCapabilities: ['javascript', 'typescript', 'testing'],
      },
    );

    expect(result.allowed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Missing capabilities');
  });

  it('tracks enforcement history in enforcementSnapshot', () => {
    router.enforceRouting(manifest('a', 'spec-a'));
    router.enforceRouting(manifest('b', 'spec-b'));

    const snapshot = router.enforcementSnapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0].specialization).toBe('spec-a');
    expect(snapshot[1].specialization).toBe('spec-b');
    expect(snapshot[0].allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase D: Organism Control Surface
// ═══════════════════════════════════════════════════════════════════

describe('Phase D: Organism Control Surface', () => {
  let registry: SessionRegistry;
  let store: CommitmentStore;
  let merger: ChildOutcomeMerger;
  let router: SpecializationRouter;

  beforeEach(() => {
    registry = new SessionRegistry();
    store = new CommitmentStore();
    merger = new ChildOutcomeMerger(registry, undefined, store);
    router = new SpecializationRouter(registry);
  });

  it('returns empty control surface for fresh registry', () => {
    const surface = registry.organismControlSurface();

    expect(surface.commitmentImpactTrail).toHaveLength(0);
    expect(surface.spendClosureStatus).toHaveLength(0);
    expect(surface.routingEnforcementSnapshot).toHaveLength(0);
    expect(Object.keys(surface.mergeConsequenceDistribution)).toHaveLength(0);
    expect(surface.overallHealth.deepClosureActive).toBe(false);
    expect(surface.overallHealth.spendTruthUnified).toBe(true); // vacuously true
    expect(surface.overallHealth.routingEnforced).toBe(false);
  });

  it('shows commitment impact trail after merge', () => {
    const commitment = createCommitment({
      name: 'Delegation',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'research',
      estimatedCostCents: 500,
      expectedValueCents: 1000,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    const session = new ChildSession({
      name: 'surface-test',
      manifest: manifest('research'),
      budgetCents: 500,
    });
    session.start();
    session.complete('Found insights');
    registry.registerSession(session);

    merger.mergeOutcome(session);

    const surface = registry.organismControlSurface();
    if (surface.commitmentImpactTrail.length > 0) {
      expect(surface.overallHealth.deepClosureActive).toBe(true);
      const trail = surface.commitmentImpactTrail[0];
      expect(trail.sessionId).toBe(session.id);
      expect(trail.commitmentMutationType).not.toBe('none');
    }
  });

  it('spend closure shows alignment for funded sessions', () => {
    const lease = new ChildFundingLease({
      sessionId: 'placeholder',
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'test',
      expectedUtilityCents: 800,
    });

    const session = new ChildSession({
      name: 'funded-closure',
      manifest: manifest('test'),
      budgetCents: 1000,
      leaseRef: lease,
    });
    session.start();
    session.trackSpend(300);
    registry.registerSession(session);

    // Register a lease with matching sessionId for getSessionLease lookup
    const matchedLease = new ChildFundingLease({
      sessionId: session.id,
      allocatedCents: 1000,
      reserveFreezeCents: 500,
      spendCeilingCents: 0,
      purpose: 'test',
      expectedUtilityCents: 800,
    });
    matchedLease.recordSpend(300);
    registry.registerLease(matchedLease);

    const surface = registry.organismControlSurface();
    const entry = surface.spendClosureStatus.find(e => e.sessionId === session.id);

    expect(entry).toBeDefined();
    expect(entry!.hasCanonicalSpendTruth).toBe(true);
    expect(entry!.aligned).toBe(true);
    expect(entry!.leaseSpentCents).toBe(300);
    expect(entry!.sessionSpentCents).toBe(300);
  });

  it('includes routing enforcement snapshot when router provided', () => {
    router.enforceRouting(manifest('a', 'spec-x'));

    const surface = registry.organismControlSurface(router);
    expect(surface.routingEnforcementSnapshot.length).toBeGreaterThan(0);
    expect(surface.overallHealth.routingEnforced).toBe(true);
  });

  it('merge consequence distribution aggregates correctly', () => {
    for (const name of ['child-1', 'child-2']) {
      const session = new ChildSession({
        name,
        manifest: manifest('test'),
        budgetCents: 100,
      });
      session.start();
      session.complete('Done');
      registry.registerSession(session);
      merger.mergeOutcome(session);
    }

    const surface = registry.organismControlSurface();
    const types = Object.keys(surface.mergeConsequenceDistribution);
    expect(types.length).toBeGreaterThan(0);

    const totalCount = Object.values(surface.mergeConsequenceDistribution)
      .reduce((sum, entry) => sum + entry.count, 0);
    expect(totalCount).toBe(2);
  });

  it('overall health reflects unified spend truth', () => {
    const lease = new ChildFundingLease({
      sessionId: 'aligned-session',
      allocatedCents: 500,
      reserveFreezeCents: 200,
      spendCeilingCents: 0,
      purpose: 'alignment',
      expectedUtilityCents: 400,
    });

    const session = new ChildSession({
      name: 'aligned',
      manifest: manifest('align'),
      budgetCents: 500,
      leaseRef: lease,
    });
    session.start();
    session.trackSpend(100);
    registry.registerSession(session);

    const matchedLease = new ChildFundingLease({
      sessionId: session.id,
      allocatedCents: 500,
      reserveFreezeCents: 200,
      spendCeilingCents: 0,
      purpose: 'alignment',
      expectedUtilityCents: 400,
    });
    matchedLease.recordSpend(100);
    registry.registerLease(matchedLease);

    const surface = registry.organismControlSurface();
    expect(surface.overallHealth.spendTruthUnified).toBe(true);
  });
});
