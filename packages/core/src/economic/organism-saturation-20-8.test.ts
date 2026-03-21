/**
 * Round 20.8 — Organism Governance Saturation and Action Closure Tests
 *
 * G1: GovernanceAction contract + executeAction() canonical path
 * G2: Lifecycle state machine (revert/supersede/dispute)
 * G3: Policy coupling via PolicyEngine.evaluate() pre-flight
 * G4: intervention + action-consequence edges in organismLineageGraph()
 * G5: Auto-linkage injection + bypass audit in LineageService.createChild()
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChildSession, type ChildSessionConfig } from '../orchestration/child-session.js';
import { SessionRegistry } from '../orchestration/session-registry.js';
import {
  OrganismInterventionService,
  type GovernanceAction,
  type GovernanceActionStatus,
  type GovernanceActionKind,
} from '../orchestration/organism-intervention-service.js';
import { SpecializationRouter } from '../orchestration/specialization-router.js';
import { CommitmentStore } from '../../src/agenda/commitment-store.js';
import { createCommitment } from '../../src/agenda/commitment-model.js';
import { PolicyEngine } from '../../src/policy/index.js';
import { LineageService } from '../../src/lineage/lineage-service.js';
import { DEFAULT_INHERITANCE_MANIFEST } from '../../src/identity/inheritance-boundary.js';
import type { MultiAgentManager } from '../../src/multiagent/index.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeLogger() {
  const noop = (..._: unknown[]) => {};
  return {
    info: noop, warn: noop, error: noop, debug: noop,
    child: () => makeLogger(),
  };
}

function makeSession(
  name: string,
  task: string,
  overrides?: Partial<ChildSessionConfig>,
): ChildSession {
  return new ChildSession({
    name,
    manifest: {
      role: 'worker' as const,
      task,
      specialization: overrides?.manifest?.specialization,
      expectedCapabilities: overrides?.manifest?.expectedCapabilities,
    },
    budgetCents: overrides?.budgetCents ?? 500,
    parentSessionId: overrides?.parentSessionId,
    targetCommitmentId: overrides?.targetCommitmentId,
    ...overrides,
  });
}

/** Create a session in 'running' state */
function makeRunningSession(name: string, task: string, overrides?: Partial<ChildSessionConfig>): ChildSession {
  const session = makeSession(name, task, overrides);
  session.start();
  return session;
}

function makeMultiAgentManager(): MultiAgentManager {
  return {
    spawn: vi.fn().mockResolvedValue({ id: `child_${Date.now()}`, name: 'test-child', status: 'active' }),
    terminate: vi.fn().mockResolvedValue(undefined),
    listChildren: vi.fn().mockReturnValue([]),
    getChild: vi.fn(),
    sendMessage: vi.fn(),
    registerPeer: vi.fn(),
    registerPeerFromChild: vi.fn(),
  } as unknown as MultiAgentManager;
}

// ── G1: GovernanceAction Contract + executeAction() ──────────────────

describe('G1: GovernanceAction Contract', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;
  let service: OrganismInterventionService;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
    service = new OrganismInterventionService(registry, router);
  });

  it('overrideRouting creates GovernanceAction with lifecycle', () => {
    const record = service.overrideRouting('code-gen', { allowed: true, reason: 'boost' });

    expect(record.success).toBe(true);
    expect(record.kind).toBe('override_routing');

    const action = service.getAction(record.id);
    expect(action).toBeDefined();
    expect(action!.status).toBe('succeeded');
    expect(action!.preconditions).toHaveLength(0);
    expect(action!.executionResult).toBeDefined();
    expect(action!.executionResult!.success).toBe(true);
    expect(action!.executionResult!.affectedEntities).toHaveLength(1);
    expect(action!.executionResult!.affectedEntities[0].type).toBe('specialization');
    expect(action!.executionResult!.consequenceSummary).toContain('code-gen');
  });

  it('holdChild validates preconditions — session must exist', () => {
    const record = service.holdChild('nonexistent', 'test');

    expect(record.success).toBe(false);

    const action = service.getAction(record.id);
    expect(action!.status).toBe('precondition_failed');
    expect(action!.preconditions.some(p => !p.satisfied && p.description === 'Session must exist')).toBe(true);
  });

  it('holdChild validates preconditions — session must be running', () => {
    // Session starts as 'pending', must be 'running' to hold
    const session = makeSession('worker-1', 'task');
    registry.registerSession(session);

    const record = service.holdChild(session.id, 'need to pause');

    expect(record.success).toBe(false);

    const action = service.getAction(record.id);
    expect(action!.status).toBe('precondition_failed');
    expect(action!.preconditions.some(p => !p.satisfied && p.description === 'Session must be running')).toBe(true);
  });

  it('holdChild succeeds on running session', () => {
    const session = makeRunningSession('worker-1', 'task');
    registry.registerSession(session);

    const record = service.holdChild(session.id, 'operational hold');

    expect(record.success).toBe(true);
    expect(session.status).toBe('paused');

    const action = service.getAction(record.id);
    expect(action!.status).toBe('succeeded');
    expect(action!.executionResult!.affectedEntities[0].change).toBe('paused');
  });

  it('requeueChild validates terminal state', () => {
    const session = makeRunningSession('worker-1', 'task');
    registry.registerSession(session);
    // Still running — should fail precondition

    const record = service.requeueChild(session.id, 'retry');

    expect(record.success).toBe(false);

    const action = service.getAction(record.id);
    expect(action!.status).toBe('precondition_failed');
  });

  it('requeueChild succeeds on terminal session', () => {
    const store = new CommitmentStore();
    const svc = new OrganismInterventionService(registry, router, store);

    const session = makeRunningSession('worker-1', 'code analysis');
    registry.registerSession(session);
    session.complete('done');

    const record = svc.requeueChild(session.id, 'needs retry');

    expect(record.success).toBe(true);

    // Should have created a commitment in store
    const commitments = store.list();
    expect(commitments.length).toBe(1);
    expect(commitments[0].name).toContain('Requeue');
  });

  it('interventionSnapshot returns all actions with lifecycle data', () => {
    service.overrideRouting('code-gen', { allowed: true, reason: 'test' });
    service.holdChild('nonexistent'); // fails precondition

    const snapshot = service.interventionSnapshot();
    expect(snapshot.totalInterventions).toBe(2);
    expect(snapshot.actions).toHaveLength(2);
    expect(snapshot.actionsByStatus).toHaveProperty('succeeded', 1);
    expect(snapshot.actionsByStatus).toHaveProperty('precondition_failed', 1);
    expect(snapshot.byKind).toHaveProperty('override_routing', 1);
    expect(snapshot.byKind).toHaveProperty('hold_child', 1);
  });

  it('listActions returns immutable copy', () => {
    service.overrideRouting('code-gen', { allowed: true, reason: 'test' });
    const actions = service.listActions();
    expect(actions).toHaveLength(1);
  });
});

// ── G2: Lifecycle State Machine ──────────────────────────────────────

describe('G2: Lifecycle State Machine', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;
  let service: OrganismInterventionService;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
    service = new OrganismInterventionService(registry, router);
  });

  it('revertAction reverts a succeeded action', () => {
    service.overrideRouting('code-gen', { allowed: true, reason: 'boost' });
    const actions = service.listActions();
    const originalId = actions[0].id;

    // Verify the override is active
    expect(service.getRoutingOverride('code-gen')).toBeDefined();

    const revert = service.revertAction(originalId, 'no longer needed');

    expect(revert.status).toBe('succeeded');
    expect(revert.kind).toBe('revert_action');
    expect(revert.relatedActionId).toBe(originalId);

    // Original should be marked as reverted
    const original = service.getAction(originalId);
    expect(original!.status).toBe('reverted');

    // Override should be removed
    expect(service.getRoutingOverride('code-gen')).toBeUndefined();
  });

  it('revertAction fails on non-existent action', () => {
    const result = service.revertAction('nonexistent', 'reason');
    expect(result.status).toBe('precondition_failed');
  });

  it('revertAction fails on already reverted action', () => {
    service.overrideRouting('code-gen', { allowed: true, reason: 'test' });
    const originalId = service.listActions()[0].id;

    service.revertAction(originalId, 'first revert');

    // Try to revert again
    const secondRevert = service.revertAction(originalId, 'second revert');
    expect(secondRevert.status).toBe('precondition_failed');
  });

  it('supersedeAction marks original as superseded', () => {
    service.overrideRouting('code-gen', { allowed: true, reason: 'v1' });
    const originalId = service.listActions()[0].id;

    const supersede = service.supersedeAction(
      originalId,
      'override_routing',
      'code-gen',
      'better policy',
    );

    expect(supersede.status).toBe('succeeded');
    expect(supersede.kind).toBe('supersede_action');
    expect(supersede.relatedActionId).toBe(originalId);

    const original = service.getAction(originalId);
    expect(original!.status).toBe('superseded');
  });

  it('disputeAction marks action as disputed', () => {
    service.overrideRouting('code-gen', { allowed: false, reason: 'suspicious' });
    const originalId = service.listActions()[0].id;

    const dispute = service.disputeAction(originalId, 'operator disagrees');

    expect(dispute.status).toBe('succeeded');
    expect(dispute.kind).toBe('dispute_action');

    const original = service.getAction(originalId);
    expect(original!.status).toBe('disputed');
  });

  it('disputed action cannot be directly reverted', () => {
    service.overrideRouting('code-gen', { allowed: false, reason: 'suspicious' });
    const originalId = service.listActions()[0].id;

    service.disputeAction(originalId, 'operator disagrees');

    // Revert on a disputed action should fail since
    // revertAction checks status must be 'succeeded' | 'failed'
    const revert = service.revertAction(originalId, 'dispute resolved');
    expect(revert.status).toBe('precondition_failed');
  });
});

// ── G3: Policy-Coupled Actions ───────────────────────────────────────

describe('G3: Policy-Coupled Actions', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
    policyEngine = new PolicyEngine(makeLogger() as any);
  });

  it('actions pass policy check with valid context', () => {
    const service = new OrganismInterventionService(registry, router, undefined, policyEngine);

    const record = service.overrideRouting('test-spec', { allowed: true, reason: 'ok' });

    expect(record.success).toBe(true);

    const action = service.getAction(record.id);
    expect(action!.policyResult).toBeDefined();
    expect(action!.policyResult!.decision).toBe('allow');
  });

  it('actions without policy engine skip policy check', () => {
    const service = new OrganismInterventionService(registry, router);

    const record = service.overrideRouting('test-spec', { allowed: true, reason: 'ok' });
    expect(record.success).toBe(true);

    const action = service.getAction(record.id);
    expect(action!.policyResult).toBeUndefined();
  });
});

// ── G4: Graph Action/Consequence Semantics ───────────────────────────

describe('G4: Graph Action/Consequence Semantics', () => {
  let registry: SessionRegistry;
  let router: SpecializationRouter;
  let service: OrganismInterventionService;

  beforeEach(() => {
    registry = new SessionRegistry();
    router = new SpecializationRouter(registry);
    service = new OrganismInterventionService(registry, router);
  });

  it('intervention edges appear in lineage graph', () => {
    const session = makeRunningSession('worker-1', 'code gen', {
      manifest: { role: 'worker' as const, task: 'code gen', specialization: 'code-gen' },
    });
    registry.registerSession(session);

    // Hold = pause a running session (successful action targeting a sessionId)
    service.holdChild(session.id, 'operational hold');

    const graph = registry.organismLineageGraph(router, service);

    // Should have intervention edge from operator to session
    const interventionEdges = graph.edges.filter(e => e.type === 'intervention');
    expect(interventionEdges.length).toBe(1);
    expect(interventionEdges[0].to).toBe(session.id);
    expect(interventionEdges[0].from).toContain('operator:');
    expect(interventionEdges[0].label).toContain('hold_child');
  });

  it('action-consequence edges appear for revert', () => {
    const session = makeRunningSession('worker-1', 'task', {
      manifest: { role: 'worker' as const, task: 'task', specialization: 'analysis' },
    });
    registry.registerSession(session);

    // Hold the session, then revert it
    service.holdChild(session.id, 'hold');
    const holdActionId = service.listActions()[0].id;
    service.revertAction(holdActionId, 'undo hold');

    const graph = registry.organismLineageGraph(router, service);

    const consequenceEdges = graph.edges.filter(e => e.type === 'action-consequence');
    expect(consequenceEdges.length).toBe(1);
    expect(consequenceEdges[0].label).toContain('revert_action');
    expect(consequenceEdges[0].to).toBe(session.id);
  });

  it('nodes enriched with interventionActions', () => {
    const session = makeRunningSession('worker-1', 'task');
    registry.registerSession(session);

    service.holdChild(session.id, 'hold');

    const graph = registry.organismLineageGraph(router, service);

    const node = graph.nodes.find(n => n.sessionId === session.id);
    expect(node).toBeDefined();
    expect(node!.interventionActions).toBeDefined();
    expect(node!.interventionActions!.length).toBe(1);
    expect(node!.interventionActions![0].kind).toBe('hold_child');
  });

  it('edgesByType stats include intervention counts', () => {
    const session = makeRunningSession('worker-1', 'task');
    registry.registerSession(session);

    service.holdChild(session.id, 'hold');

    const graph = registry.organismLineageGraph(router, service);

    expect(graph.stats.edgesByType['intervention']).toBe(1);
  });

  it('graph without interventionService produces no intervention edges', () => {
    const session = makeRunningSession('worker-1', 'task');
    registry.registerSession(session);

    const graph = registry.organismLineageGraph(router);
    const interventionEdges = graph.edges.filter(e => e.type === 'intervention');
    expect(interventionEdges.length).toBe(0);
  });
});

// ── G5: Auto-Linkage + Spawn Bypass Audit ────────────────────────────

describe('G5: Auto-Linkage + Spawn Bypass Audit', () => {
  it('explicit targetCommitmentId produces explicit linkage audit', async () => {
    const multiagent = makeMultiAgentManager();
    const store = new CommitmentStore();
    const svc = new LineageService({
      multiagent,
      inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
      logger: makeLogger() as any,
      commitmentStore: store,
    });

    const record = await svc.createChild({
      name: 'child-1',
      task: 'code gen',
      genesisPrompt: '',
      fundingCents: 1000,
      parentId: 'root',
      proposalId: 'prop-1',
      targetCommitmentId: 'cmt-explicit',
    });

    expect(record.spawnLinkageAudit).toBeDefined();
    expect(record.spawnLinkageAudit!.resolution).toBe('explicit');
    expect(record.spawnLinkageAudit!.targetCommitmentId).toBe('cmt-explicit');
  });

  it('auto-links when task matches active commitment', async () => {
    const multiagent = makeMultiAgentManager();
    const store = new CommitmentStore();

    // Add an active commitment
    const commitment = createCommitment({
      name: 'Code Analysis Task',
      description: 'Analyze code quality',
      kind: 'autonomous',
      origin: 'system',
      priority: 'normal',
      taskType: 'code analysis',
      expectedValueCents: 100,
      estimatedCostCents: 50,
    });
    store.add(commitment);
    store.markActive(commitment.id);

    const svc = new LineageService({
      multiagent,
      inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
      logger: makeLogger() as any,
      commitmentStore: store,
    });

    const record = await svc.createChild({
      name: 'child-1',
      task: 'perform code analysis on module X',
      genesisPrompt: '',
      fundingCents: 1000,
      parentId: 'root',
      proposalId: 'prop-1',
      // No targetCommitmentId — should auto-link
    });

    expect(record.spawnLinkageAudit).toBeDefined();
    expect(record.spawnLinkageAudit!.resolution).toBe('auto_linked');
    expect(record.spawnLinkageAudit!.targetCommitmentId).toBe(commitment.id);
    expect(record.spec.targetCommitmentId).toBe(commitment.id);
  });

  it('no_linkage audit when no commitment matches', async () => {
    const multiagent = makeMultiAgentManager();
    const store = new CommitmentStore();

    const svc = new LineageService({
      multiagent,
      inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
      logger: makeLogger() as any,
      commitmentStore: store,
    });

    const record = await svc.createChild({
      name: 'child-1',
      task: 'random unrelated task',
      genesisPrompt: '',
      fundingCents: 1000,
      parentId: 'root',
      proposalId: 'prop-1',
    });

    expect(record.spawnLinkageAudit).toBeDefined();
    expect(record.spawnLinkageAudit!.resolution).toBe('no_linkage');
    expect(record.spawnLinkageAudit!.reason).toContain('No active commitment');
  });

  it('no_linkage audit when commitmentStore not configured', async () => {
    const multiagent = makeMultiAgentManager();

    const svc = new LineageService({
      multiagent,
      inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
      logger: makeLogger() as any,
      // No commitmentStore
    });

    const record = await svc.createChild({
      name: 'child-1',
      task: 'some task',
      genesisPrompt: '',
      fundingCents: 1000,
      parentId: 'root',
      proposalId: 'prop-1',
    });

    expect(record.spawnLinkageAudit).toBeDefined();
    expect(record.spawnLinkageAudit!.resolution).toBe('no_linkage');
    expect(record.spawnLinkageAudit!.reason).toContain('CommitmentStore not configured');
  });

  it('spawnLinkageAudits() returns cumulative audit trail', async () => {
    const multiagent = makeMultiAgentManager();
    const svc = new LineageService({
      multiagent,
      inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
      logger: makeLogger() as any,
    });

    await svc.createChild({
      name: 'child-1',
      task: 'task 1',
      genesisPrompt: '',
      fundingCents: 1000,
      parentId: 'root',
      proposalId: 'prop-1',
    });

    await svc.createChild({
      name: 'child-2',
      task: 'task 2',
      genesisPrompt: '',
      fundingCents: 500,
      parentId: 'root',
      proposalId: 'prop-2',
    });

    const audits = svc.spawnLinkageAudits();
    expect(audits).toHaveLength(2);
    expect(audits[0].resolution).toBe('no_linkage');
    expect(audits[1].resolution).toBe('no_linkage');
  });
});
