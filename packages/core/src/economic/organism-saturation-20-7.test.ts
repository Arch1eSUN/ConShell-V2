/**
 * Round 20.7 — Organism Saturation and Explicit Linkage Closure Tests
 *
 * Covers:
 * Phase A: Explicit parent-child linkage (targetCommitmentId, findTargetCommitment)
 * Phase B: Spawn enforcement saturation (enforceRouting in governance)
 * Phase C: OrganismInterventionService operations
 * Phase D: Organism lineage graph construction
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChildSession, type ChildSessionManifest } from '../orchestration/child-session.js';
import { ChildFundingLease } from '../orchestration/child-funding-lease.js';
import { SessionRegistry } from '../orchestration/session-registry.js';
import { SpecializationRouter } from '../orchestration/specialization-router.js';
import { ChildOutcomeMerger, type ChildMergeResult, type LinkageResolution } from '../orchestration/child-outcome-merger.js';
import { CommitmentStore } from '../agenda/commitment-store.js';
import { createCommitment } from '../agenda/commitment-model.js';
import { TaskSettlementBridge } from './task-settlement-bridge.js';
import { CanonicalSettlementLedger } from './settlement-ledger.js';
import { RevenueSurfaceRegistry, createTaskServiceSurface } from './revenue-surface.js';
import { OrganismInterventionService } from '../orchestration/organism-intervention-service.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeManifest(overrides?: Partial<ChildSessionManifest>): ChildSessionManifest {
  return {
    role: 'worker',
    task: 'test-task',
    specialization: 'test-spec',
    expectedCapabilities: ['cap-a'],
    ...overrides,
  };
}

function makeSession(name: string, opts?: {
  manifest?: ChildSessionManifest;
  budgetCents?: number;
  parentSessionId?: string;
  leaseRef?: ChildFundingLease;
  targetCommitmentId?: string;
}): ChildSession {
  return new ChildSession({
    name,
    manifest: opts?.manifest ?? makeManifest(),
    budgetCents: opts?.budgetCents ?? 1000,
    parentSessionId: opts?.parentSessionId,
    leaseRef: opts?.leaseRef,
    targetCommitmentId: opts?.targetCommitmentId,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Phase A: Explicit Parent-Child Linkage
// ══════════════════════════════════════════════════════════════════════

describe('Phase A: Explicit Parent-Child Linkage', () => {
  let registry: SessionRegistry;
  let store: CommitmentStore;
  let bridge: TaskSettlementBridge;
  let merger: ChildOutcomeMerger;

  beforeEach(() => {
    registry = new SessionRegistry();
    store = new CommitmentStore();
    const ledger = new CanonicalSettlementLedger();
    const revSurfaces = new RevenueSurfaceRegistry();
    revSurfaces.register(createTaskServiceSurface('svc-1', 1000));
    bridge = new TaskSettlementBridge(ledger, revSurfaces);
    merger = new ChildOutcomeMerger(registry, bridge, store);
  });

  it('session should expose targetCommitmentId', () => {
    const session = makeSession('s1', { targetCommitmentId: 'cmt_123' });
    expect(session.targetCommitmentId).toBe('cmt_123');
  });

  it('session.toJSON() should include targetCommitmentId', () => {
    const session = makeSession('s1', { targetCommitmentId: 'cmt_456' });
    const snap = session.toJSON();
    expect(snap.targetCommitmentId).toBe('cmt_456');
  });

  it('findTargetCommitment should use explicit linkage (tier 1) first', () => {
    const commitment = createCommitment({
      name: 'target',
      description: 'test',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'test-task',
      expectedValueCents: 100,
      estimatedCostCents: 50,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    // Session explicitly targets this commitment
    const session = makeSession('s1', { targetCommitmentId: commitment.id });
    registry.registerSession(session);
    session.start();
    session.complete('done', 'update');

    const result = merger.mergeOutcome(session);
    expect(result.linkageResolution).toBe('explicit');
    expect(result.targetCommitmentId).toBe(commitment.id);
  });

  it('findTargetCommitment should fall back to delegateChildId (tier 2)', () => {
    const session = makeSession('s1');
    registry.registerSession(session);
    session.start();

    // Commitment has delegateChildId pointing to session
    const commitment = createCommitment({
      name: 'delegated',
      description: 'test',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'test-task',
      expectedValueCents: 100,
      estimatedCostCents: 50,
      delegateChildId: session.id,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    session.complete('done', 'update');

    const result = merger.mergeOutcome(session);
    expect(result.linkageResolution).toBe('delegateChildId');
    expect(result.targetCommitmentId).toBe(commitment.id);
  });

  it('findTargetCommitment should use heuristic (tier 3) as last resort', () => {
    // Commitment matches by task type but no explicit linkage
    const commitment = createCommitment({
      name: 'heuristic',
      description: 'test',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'test-task',
      expectedValueCents: 100,
      estimatedCostCents: 50,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    const session = makeSession('s1');
    registry.registerSession(session);
    session.start();
    session.complete('done', 'update');

    const result = merger.mergeOutcome(session);
    expect(result.linkageResolution).toBe('heuristic');
    expect(result.targetCommitmentId).toBe(commitment.id);
  });

  it('findTargetCommitment should return none when no match', () => {
    // No commitments at all
    const session = makeSession('s1');
    registry.registerSession(session);
    session.start();
    session.complete('done');

    const result = merger.mergeOutcome(session);
    // follow_up or noop — either way no target
    expect(result.linkageResolution).toBe('none');
    expect(result.targetCommitmentId).toBeUndefined();
  });

  it('explicit tier should take priority over delegateChildId match', () => {
    const explicitCommitment = createCommitment({
      name: 'explicit-target',
      description: 'test',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'other-task',
      expectedValueCents: 100,
      estimatedCostCents: 50,
    });
    store.add(explicitCommitment);
    store.markActive(explicitCommitment.id);

    const session = makeSession('s1', { targetCommitmentId: explicitCommitment.id });
    registry.registerSession(session);
    session.start();

    // Also add a commitment with delegateChildId pointing to this session
    const delegateCommitment = createCommitment({
      name: 'delegate-target',
      description: 'test',
      kind: 'delegation',
      origin: 'system',
      priority: 'normal',
      taskType: 'test-task',
      expectedValueCents: 100,
      estimatedCostCents: 50,
      delegateChildId: session.id,
    });
    store.add(delegateCommitment);
    store.markActive(delegateCommitment.id);

    session.complete('done', 'update');

    const result = merger.mergeOutcome(session);
    // Explicit should win
    expect(result.linkageResolution).toBe('explicit');
    expect(result.targetCommitmentId).toBe(explicitCommitment.id);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase B: Spawn Enforcement Saturation
// ══════════════════════════════════════════════════════════════════════

describe('Phase B: Spawn Enforcement Saturation', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
  });

  it('enforceRouting should allow new specialization', () => {
    const manifest = makeManifest({ specialization: 'brand-new' });
    const result = router.enforceRouting(manifest);
    expect(result.allowed).toBe(true);
  });

  it('enforceRouting should deny specialization with low quality', () => {
    // Create 2 sessions with low quality evaluations
    for (let i = 0; i < 2; i++) {
      const s = makeSession(`low-q-${i}`, {
        manifest: makeManifest({ specialization: 'poor-spec' }),
      });
      registry.registerSession(s);
      s.start();
      s.complete('mediocre');
      registry.submitEvaluation({
        sessionId: s.id,
        completionQuality: 20, // below 30 threshold
        mergeUsefulness: 10,
        failureSeverity: 'high' as const,
        reportingReliability: 20,
        utilityExpectedCents: 100,
        utilityRealizedCents: 20,
        effectivenessRatio: 0.2,
        evaluatedAt: new Date().toISOString(),
      });
    }

    const manifest = makeManifest({ specialization: 'poor-spec' });
    const result = router.enforceRouting(manifest);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('poor historical quality');
  });

  it('enforcementSnapshot should track enforcement history', () => {
    const manifest = makeManifest({ specialization: 'tracked' });
    router.enforceRouting(manifest);

    const snapshot = router.enforcementSnapshot();
    expect(snapshot.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.some(r => r.specialization === 'tracked')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase C: OrganismInterventionService
// ══════════════════════════════════════════════════════════════════════

describe('Phase C: OrganismInterventionService', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;
  let store: CommitmentStore;
  let service: OrganismInterventionService;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
    store = new CommitmentStore();
    service = new OrganismInterventionService(registry, router, store);
  });

  it('overrideRouting should record and expose override', () => {
    const record = service.overrideRouting('test-spec', {
      allowed: false,
      reason: 'operator deny',
    });

    expect(record.success).toBe(true);
    expect(record.kind).toBe('override_routing');

    const override = service.getRoutingOverride('test-spec');
    expect(override?.allowed).toBe(false);
    expect(override?.reason).toBe('operator deny');
  });

  it('requeueChild should create commitment for terminal session', () => {
    const session = makeSession('requeue-me');
    registry.registerSession(session);
    session.start();
    session.complete('done');

    const record = service.requeueChild(session.id, 'retry needed');
    expect(record.success).toBe(true);
    expect(record.kind).toBe('requeue_child');

    // Should have created a requeue commitment
    const commitments = store.list();
    expect(commitments.length).toBe(1);
    expect(commitments[0].name).toContain('Requeue');
  });

  it('requeueChild should reject non-terminal session', () => {
    const session = makeSession('still-running');
    registry.registerSession(session);
    session.start();

    const record = service.requeueChild(session.id, 'want to retry');
    expect(record.success).toBe(false);
    expect(record.detail).toContain('non-terminal');
  });

  it('requeueChild should fail for unknown session', () => {
    const record = service.requeueChild('nonexistent', 'test');
    expect(record.success).toBe(false);
    expect(record.detail).toBe('Session not found');
  });

  it('holdChild should pause running session', () => {
    const session = makeSession('hold-me');
    registry.registerSession(session);
    session.start();

    const record = service.holdChild(session.id, 'operator pause');
    expect(record.success).toBe(true);
    expect(session.status).toBe('paused');
  });

  it('holdChild should reject non-running session', () => {
    const session = makeSession('pending');
    registry.registerSession(session);

    const record = service.holdChild(session.id);
    expect(record.success).toBe(false);
  });

  it('repairSpendMisalignment should verify spend for funded session', () => {
    const lease = new ChildFundingLease({
      sessionId: 'test',
      allocatedCents: 1000,
      reserveFreezeCents: 0,
      spendCeilingCents: 0,
      purpose: 'test-lease',
      expectedUtilityCents: 500,
    });
    const session = makeSession('funded', { leaseRef: lease });
    registry.registerSession(session);

    const record = service.repairSpendMisalignment(session.id);
    expect(record.success).toBe(true);
    expect(record.detail).toContain('canonical from lease');
  });

  it('repairSpendMisalignment should reject unfunded session', () => {
    const session = makeSession('unfunded');
    registry.registerSession(session);

    const record = service.repairSpendMisalignment(session.id);
    expect(record.success).toBe(false);
    expect(record.detail).toContain('No canonical lease');
  });

  it('interventionSnapshot should aggregate all records', () => {
    const session = makeSession('s1');
    registry.registerSession(session);
    session.start();

    service.overrideRouting('spec-a', { allowed: true, reason: 'ok' });
    service.holdChild(session.id, 'test');

    const snap = service.interventionSnapshot();
    expect(snap.totalInterventions).toBe(2);
    expect(snap.byKind.override_routing).toBe(1);
    expect(snap.byKind.hold_child).toBe(1);
    expect(snap.activeOverrides.get('spec-a')?.allowed).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase D: Organism Lineage Graph
// ══════════════════════════════════════════════════════════════════════

describe('Phase D: Organism Lineage Graph', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
  });

  it('should produce empty graph for empty registry', () => {
    const graph = registry.organismLineageGraph();
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.stats.totalNodes).toBe(0);
    expect(graph.stats.maxDepth).toBe(0);
  });

  it('should create nodes for all sessions', () => {
    const s1 = makeSession('parent');
    const s2 = makeSession('child');
    registry.registerSession(s1);
    registry.registerSession(s2);

    const graph = registry.organismLineageGraph();
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.map(n => n.name)).toContain('parent');
    expect(graph.nodes.map(n => n.name)).toContain('child');
  });

  it('should create parent-child edges from parentSessionId', () => {
    const parent = makeSession('parent', {
      manifest: makeManifest({ specialization: 'parent-spec' }),
    });
    registry.registerSession(parent);

    const child = makeSession('child', {
      parentSessionId: parent.id,
      manifest: makeManifest({ specialization: 'child-spec' }),
    });
    registry.registerSession(child);

    const graph = registry.organismLineageGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].type).toBe('parent-child');
    expect(graph.edges[0].from).toBe(parent.id);
    expect(graph.edges[0].to).toBe(child.id);
    expect(graph.stats.maxDepth).toBe(1);
  });

  it('should create specialization-evolution edges', () => {
    const s1 = makeSession('v1', {
      manifest: makeManifest({ specialization: 'data-analysis' }),
    });
    registry.registerSession(s1);

    // Wait a tiny bit for different createdAt
    const s2 = makeSession('v2', {
      manifest: makeManifest({ specialization: 'data-analysis' }),
    });
    registry.registerSession(s2);

    const graph = registry.organismLineageGraph();
    const specEdges = graph.edges.filter(e => e.type === 'specialization-evolution');
    expect(specEdges.length).toBeGreaterThanOrEqual(1);
    expect(specEdges[0].label).toBe('data-analysis');
  });

  it('should create commitment-linkage edges for shared targets', () => {
    const s1 = makeSession('s1', { targetCommitmentId: 'cmt_shared' });
    const s2 = makeSession('s2', { targetCommitmentId: 'cmt_shared' });
    registry.registerSession(s1);
    registry.registerSession(s2);

    const graph = registry.organismLineageGraph();
    const linkageEdges = graph.edges.filter(e => e.type === 'commitment-linkage');
    expect(linkageEdges.length).toBe(1);
    expect(linkageEdges[0].label).toContain('cmt_shared');
  });

  it('should compute edge stats', () => {
    const parent = makeSession('parent', {
      manifest: makeManifest({ specialization: 'parent-spec' }),
    });
    registry.registerSession(parent);

    const child = makeSession('child', {
      parentSessionId: parent.id,
      manifest: makeManifest({ specialization: 'child-spec' }),
    });
    registry.registerSession(child);

    const graph = registry.organismLineageGraph();
    expect(graph.stats.edgesByType['parent-child']).toBe(1);
    expect(graph.stats.totalEdges).toBe(1);
  });

  it('should include evaluation and merge result in nodes', () => {
    const s = makeSession('evaluated');
    registry.registerSession(s);
    s.start();
    s.complete('done');

    const evaluation = {
      sessionId: s.id,
      completionQuality: 85,
      mergeUsefulness: 70,
      failureSeverity: 'none' as const,
      reportingReliability: 80,
      utilityExpectedCents: 100,
      utilityRealizedCents: 80,
      effectivenessRatio: 0.8,
      evaluatedAt: new Date().toISOString(),
    };
    registry.submitEvaluation(evaluation);

    const graph = registry.organismLineageGraph();
    const node = graph.nodes.find(n => n.sessionId === s.id);
    expect(node?.evaluation?.completionQuality).toBe(85);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Integration: Control Surface with Intervention
// ══════════════════════════════════════════════════════════════════════

describe('Integration: Control Surface with Intervention', () => {
  it('organismControlSurface should include intervention snapshot', () => {
    const registry = new SessionRegistry();
    const router = new SpecializationRouter(registry);
    const store = new CommitmentStore();
    const interventionService = new OrganismInterventionService(registry, router, store);

    interventionService.overrideRouting('test', { allowed: true, reason: 'ok' });

    const surface = registry.organismControlSurface(router, interventionService);
    expect(surface.interventionSnapshot).toBeDefined();
    expect(surface.interventionSnapshot?.totalInterventions).toBe(1);
  });

  it('organismControlSurface without intervention service should work', () => {
    const registry = new SessionRegistry();
    const surface = registry.organismControlSurface();
    expect(surface.interventionSnapshot).toBeUndefined();
  });
});
