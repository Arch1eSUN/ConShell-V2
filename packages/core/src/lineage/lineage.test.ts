/**
 * Lineage Tests — Round 16.5
 *
 * 40 tests covering:
 *   1. Contract types + status transitions
 *   2. LineageService CRUD (create/list/get/recall/terminate/orphan)
 *   3. Funding lease lifecycle (active → exhausted/revoked/expired)
 *   4. Governance → actualization path
 *   5. Child identity via InheritanceBoundary
 *   6. Commitment delegation round-trip
 *   7. Edge cases (double-recall, orphan-then-terminate, etc.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidChildTransition,
  CHILD_STATUS_TRANSITIONS,
  TERMINAL_CHILD_STATUSES,
  type ChildRuntimeStatus,
  type ChildRuntimeSpec,
  type FundingLease,
  type RecallPolicy,
} from './lineage-contract.js';
import { LineageService, type LineageServiceOptions } from './lineage-service.js';
import { MultiAgentManager } from '../multiagent/index.js';
import { DEFAULT_INHERITANCE_MANIFEST } from '../identity/inheritance-boundary.js';
import { CommitmentMaterializer } from '../agenda/commitment-materializer.js';
import { createCommitment } from '../agenda/commitment-model.js';
import { CommitmentStore } from '../agenda/commitment-store.js';

// ── Test Logger ─────────────────────────────────────────────────────
const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

// ── Helpers ─────────────────────────────────────────────────────────
function makeSpec(overrides?: Partial<ChildRuntimeSpec>): ChildRuntimeSpec {
  return {
    name: 'test-child',
    task: 'test task',
    genesisPrompt: 'You are a test child agent.',
    fundingCents: 5000,
    parentId: 'root',
    proposalId: 'gov_test_1',
    ...overrides,
  };
}

function makeService(overrides?: Partial<LineageServiceOptions>): LineageService {
  return new LineageService({
    multiagent: new MultiAgentManager(),
    inheritanceManifest: DEFAULT_INHERITANCE_MANIFEST,
    logger: noopLogger as any,
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════
// T1: Contract — Status Transitions
// ══════════════════════════════════════════════════════════════════════

describe('Lineage Contract — Status Transitions', () => {
  it('planned → creating is valid', () => {
    expect(isValidChildTransition('planned', 'creating')).toBe(true);
  });

  it('planned → active is invalid', () => {
    expect(isValidChildTransition('planned', 'active')).toBe(false);
  });

  it('creating → active is valid', () => {
    expect(isValidChildTransition('creating', 'active')).toBe(true);
  });

  it('creating → failed is valid', () => {
    expect(isValidChildTransition('creating', 'failed')).toBe(true);
  });

  it('active → recalled is valid', () => {
    expect(isValidChildTransition('active', 'recalled')).toBe(true);
  });

  it('active → orphaned is valid', () => {
    expect(isValidChildTransition('active', 'orphaned')).toBe(true);
  });

  it('recalled is terminal', () => {
    expect(TERMINAL_CHILD_STATUSES).toContain('recalled');
    expect(CHILD_STATUS_TRANSITIONS.recalled).toHaveLength(0);
  });

  it('terminated is terminal', () => {
    expect(TERMINAL_CHILD_STATUSES).toContain('terminated');
  });

  it('orphaned → terminated is valid (force-terminate)', () => {
    expect(isValidChildTransition('orphaned', 'terminated')).toBe(true);
  });

  it('degraded → active is valid (recovery)', () => {
    expect(isValidChildTransition('degraded', 'active')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// T2: LineageService — CRUD Lifecycle
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Create', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('creates a child and transitions to active', async () => {
    const record = await svc.createChild(makeSpec());
    expect(record.status).toBe('active');
    expect(record.childId).toBeTruthy();
    expect(record.activatedAt).toBeTruthy();
  });

  it('creates a funding lease with correct budget', async () => {
    const record = await svc.createChild(makeSpec({ fundingCents: 8000 }));
    expect(record.fundingLease.budgetCapCents).toBe(8000);
    expect(record.fundingLease.spentCents).toBe(0);
    expect(record.fundingLease.status).toBe('active');
  });

  it('builds identity summary from inheritance manifest', async () => {
    const record = await svc.createChild(makeSpec());
    expect(record.identitySummary.inheritedFields.length).toBeGreaterThan(0);
    expect(record.identitySummary.derivedFields.length).toBeGreaterThan(0);
    expect(record.identitySummary.excludedFields.length).toBeGreaterThan(0);
  });

  it('logs a replication receipt on success', async () => {
    await svc.createChild(makeSpec());
    const receipts = svc.replicationReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].result).toBe('success');
  });

  it('listChildren returns all records', async () => {
    await svc.createChild(makeSpec({ name: 'child-a' }));
    await svc.createChild(makeSpec({ name: 'child-b' }));
    expect(svc.listChildren()).toHaveLength(2);
  });

  it('listChildren filters by status', async () => {
    const record = await svc.createChild(makeSpec({ name: 'child-a' }));
    await svc.createChild(makeSpec({ name: 'child-b' }));
    await svc.terminateChild(record.id, 'test', 'test');
    expect(svc.listChildren({ status: 'active' })).toHaveLength(1);
    expect(svc.listChildren({ status: 'terminated' })).toHaveLength(1);
  });

  it('getRecord returns the record by lineage ID', async () => {
    const record = await svc.createChild(makeSpec());
    expect(svc.getRecord(record.id)).toBe(record);
  });

  it('getByChildId returns record by child agent ID', async () => {
    const record = await svc.createChild(makeSpec());
    expect(svc.getByChildId(record.childId)?.id).toBe(record.id);
  });
});

// ══════════════════════════════════════════════════════════════════════
// T3: Recall / Terminate / Orphan
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Recall', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('recalls a child and transitions to recalled', async () => {
    const record = await svc.createChild(makeSpec());
    const policy: RecallPolicy = {
      reason: 'Task complete',
      actor: 'parent',
      governanceRequired: false,
      cleanupFunding: true,
      cascadeToChildren: true,
    };
    const receipt = await svc.recallChild(record.id, policy);
    expect(record.status).toBe('recalled');
    expect(receipt.reason).toBe('Task complete');
  });

  it('cleans up funding on recall when policy says so', async () => {
    const record = await svc.createChild(makeSpec());
    await svc.recallChild(record.id, {
      reason: 'Done',
      actor: 'parent',
      governanceRequired: false,
      cleanupFunding: true,
      cascadeToChildren: false,
    });
    expect(record.fundingLease.status).toBe('revoked');
  });

  it('preserves funding on recall when cleanupFunding is false', async () => {
    const record = await svc.createChild(makeSpec());
    await svc.recallChild(record.id, {
      reason: 'Pause',
      actor: 'parent',
      governanceRequired: false,
      cleanupFunding: false,
      cascadeToChildren: false,
    });
    expect(record.fundingLease.status).toBe('active');
  });
});

describe('LineageService — Terminate', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('terminates a child and revokes funding', async () => {
    const record = await svc.createChild(makeSpec());
    const receipt = await svc.terminateChild(record.id, 'No longer needed');
    expect(record.status).toBe('terminated');
    expect(record.fundingLease.status).toBe('revoked');
    expect(receipt.fundingRemainingCents).toBe(5000);
  });

  it('logs a termination receipt', async () => {
    const record = await svc.createChild(makeSpec());
    await svc.terminateChild(record.id, 'Done');
    expect(svc.terminationReceipts()).toHaveLength(1);
  });
});

describe('LineageService — Orphan', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('orphans a child', async () => {
    const record = await svc.createChild(makeSpec());
    svc.orphanChild(record.id, 'Parent died');
    expect(record.status).toBe('orphaned');
    expect(record.orphanedAt).toBeTruthy();
  });

  it('orphaned child can be force-terminated', async () => {
    const record = await svc.createChild(makeSpec());
    svc.orphanChild(record.id, 'Parent died');
    await svc.terminateChild(record.id, 'Cleanup');
    expect(record.status).toBe('terminated');
  });
});

// ══════════════════════════════════════════════════════════════════════
// T4: Funding Lease Lifecycle
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Funding Lease', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('records spend against a lease', async () => {
    const record = await svc.createChild(makeSpec({ fundingCents: 1000 }));
    svc.recordSpend(record.id, 300);
    expect(record.fundingLease.spentCents).toBe(300);
    expect(record.fundingLease.status).toBe('active');
  });

  it('exhausts a lease when spend reaches cap', async () => {
    const record = await svc.createChild(makeSpec({ fundingCents: 100 }));
    svc.recordSpend(record.id, 100);
    expect(record.fundingLease.status).toBe('exhausted');
  });

  it('revokes a funding lease', async () => {
    const record = await svc.createChild(makeSpec());
    svc.revokeFunding(record.id, 'Policy violation', 'governance');
    expect(record.fundingLease.status).toBe('revoked');
    expect(record.fundingLease.revokedBy).toBe('governance');
  });

  it('attachFunding updates the budget cap', async () => {
    const record = await svc.createChild(makeSpec({ fundingCents: 1000 }));
    svc.attachFunding(record.id, 5000);
    expect(record.fundingLease.budgetCapCents).toBe(5000);
  });

  it('cannot spend on a revoked lease', async () => {
    const record = await svc.createChild(makeSpec());
    svc.revokeFunding(record.id, 'Test');
    expect(() => svc.recordSpend(record.id, 1)).toThrow(/lease status/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// T5: Degrade / Recover
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Degrade / Recover', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('degrades an active child', async () => {
    const record = await svc.createChild(makeSpec());
    svc.degradeChild(record.id, 'High latency');
    expect(record.status).toBe('degraded');
  });

  it('recovers a degraded child', async () => {
    const record = await svc.createChild(makeSpec());
    svc.degradeChild(record.id, 'Test');
    svc.recoverChild(record.id);
    expect(record.status).toBe('active');
  });
});

// ══════════════════════════════════════════════════════════════════════
// T6: Stats
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Stats', () => {
  it('returns correct stats after multiple operations', async () => {
    const svc = makeService();
    await svc.createChild(makeSpec({ name: 'a', fundingCents: 1000 }));
    const b = await svc.createChild(makeSpec({ name: 'b', fundingCents: 2000 }));
    await svc.terminateChild(b.id, 'Test');

    const stats = svc.stats();
    expect(stats.totalChildren).toBe(2);
    expect(stats.activeChildren).toBe(1);
    expect(stats.byStatus.terminated).toBe(1);
    expect(stats.totalFundingAllocated).toBe(3000);
  });
});

// ══════════════════════════════════════════════════════════════════════
// T7: Commitment Delegation
// ══════════════════════════════════════════════════════════════════════

describe('CommitmentMaterializer — Delegation (Round 16.5)', () => {
  it('materializes a delegation commitment with delegate-to-child taskType', () => {
    const mat = new CommitmentMaterializer();
    const c = createCommitment({
      name: 'Delegated task',
      kind: 'delegation',
      origin: 'self',
      taskType: 'general',
    });
    c.delegateChildId = 'agent_123';

    const task = mat.materialize(c);
    expect(task.taskType).toBe('delegate-to-child');
    expect(task.delegateChildId).toBe('agent_123');
  });

  it('handleDelegationResult marks completed on success', () => {
    const mat = new CommitmentMaterializer();
    const store = new CommitmentStore();
    const c = createCommitment({ name: 'Delegated', kind: 'delegation', origin: 'self' });
    c.delegateChildId = 'agent_456';
    store.add(c);
    store.markActive(c.id);

    mat.handleDelegationResult(c.id, 'success', store);
    expect(store.get(c.id)?.status).toBe('completed');
    expect(store.get(c.id)?.delegationStatus).toBe('completed');
  });

  it('handleDelegationResult marks failed on failure', () => {
    const mat = new CommitmentMaterializer();
    const store = new CommitmentStore();
    const c = createCommitment({ name: 'Delegated', kind: 'delegation', origin: 'self' });
    store.add(c);
    store.markActive(c.id);

    mat.handleDelegationResult(c.id, 'failure', store, 'Child crashed');
    expect(store.get(c.id)?.status).toBe('failed');
  });
});

// ══════════════════════════════════════════════════════════════════════
// T8: Edge Cases
// ══════════════════════════════════════════════════════════════════════

describe('LineageService — Edge Cases', () => {
  let svc: LineageService;

  beforeEach(() => {
    svc = makeService();
  });

  it('throws on invalid status transition', async () => {
    const record = await svc.createChild(makeSpec());
    await svc.terminateChild(record.id, 'Done');
    // terminated is terminal — cannot recall
    expect(() => svc.orphanChild(record.id, 'Late')).toThrow(/Invalid lineage transition/);
  });

  it('throws on recalling a terminated child', async () => {
    const record = await svc.createChild(makeSpec());
    await svc.terminateChild(record.id, 'Done');
    await expect(svc.recallChild(record.id, {
      reason: 'Too late',
      actor: 'parent',
      governanceRequired: false,
      cleanupFunding: true,
      cascadeToChildren: false,
    })).rejects.toThrow(/Invalid lineage transition/);
  });

  it('throws on unknown record ID', async () => {
    await expect(svc.terminateChild('nonexistent', 'Test')).rejects.toThrow(/not found/);
  });

  it('handles creation failure gracefully', async () => {
    // Create a multiagent with max gen depth 0 to force spawn failure
    const multiagent = new MultiAgentManager({ maxGenerationDepth: 0 });
    const failSvc = makeService({ multiagent });
    const record = await failSvc.createChild(makeSpec());
    expect(record.status).toBe('failed');
    expect(record.statusReason).toContain('generation depth');
    const receipts = failSvc.replicationReceipts();
    expect(receipts[0].result).toBe('failure');
  });
});
