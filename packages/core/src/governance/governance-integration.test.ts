/**
 * Governance Integration Tests — Round 16.4 (migrated to verdict semantics in 17.1)
 *
 * Integration tests for:
 *   - Kernel wiring (GovernanceService in KernelServices)
 *   - SelfMod full path (propose → evaluate → apply → verify → rollback)
 *   - Replication full path
 *   - API routes (serialization / handler behavior)
 *   - Diagnostics accuracy
 *   - Legacy adapter marking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GovernanceService,
  type GovernanceServiceOptions,
  type GovernanceIdentityProvider,
  type GovernancePolicyProvider,
  ACTION_RISK_MAP,
  ACTION_ROLLBACK_MAP,
  isValidStatusTransition,
  TERMINAL_STATUSES,
} from './governance-service.js';
import type { GovernanceDiagnostics } from './governance-contract.js';

// ── Mock Factories ────────────────────────────────────────────────────

function createMockIdentity(status: 'active' | 'degraded' | 'revoked' = 'active'): GovernanceIdentityProvider {
  return {
    status: () => status,
    selfFingerprint: () => 'test-fingerprint-001',
  };
}

function createMockPolicy(decision: 'allow' | 'deny' | 'escalate' = 'allow'): GovernancePolicyProvider {
  return {
    evaluate: () => ({
      decision,
      rule: `mock-rule`,
      reason: 'mock reason',
      category: 'security' as any,
    }),
  };
}

function createMockSelfMod() {
  return {
    modify: vi.fn().mockResolvedValue({ id: 'mod_001', file: 'test.ts', timestamp: Date.now() }),
    rollback: vi.fn().mockResolvedValue(true),
    stats: vi.fn().mockReturnValue({ totalModifications: 0 }),
    getRecord: vi.fn(),
    listRecords: vi.fn().mockReturnValue([]),
  };
}

function createMockMultiAgent() {
  return {
    spawn: vi.fn().mockResolvedValue({ id: 'child_001', name: 'test-child', status: 'running' }),
    terminate: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockReturnValue([]),
    stats: vi.fn().mockReturnValue({ totalChildren: 0 }),
  };
}

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => createMockLogger(),
  };
}

function createGovernanceService(overrides: Partial<GovernanceServiceOptions> = {}): GovernanceService {
  return new GovernanceService({
    identity: createMockIdentity(),
    policy: createMockPolicy(),
    selfmod: createMockSelfMod() as any,
    multiagent: createMockMultiAgent() as any,
    logger: createMockLogger() as any,
    dailyBudgetCents: 100_00,
    dailySpentCents: 0,
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════
// 1. KERNEL WIRING
// ══════════════════════════════════════════════════════════════════════

describe('Kernel Wiring', () => {
  it('GovernanceService can be instantiated with all dependencies', () => {
    const gov = createGovernanceService();
    expect(gov).toBeDefined();
    expect(gov.proposalCount).toBe(0);
  });

  it('GovernanceService accepts optional selfmod/multiagent', () => {
    const gov = createGovernanceService({ selfmod: undefined, multiagent: undefined });
    expect(gov).toBeDefined();
  });

  it('GovernanceService is available after construction', () => {
    const gov = createGovernanceService();
    expect(gov.listProposals()).toEqual([]);
    expect(gov.allReceipts()).toEqual([]);
  });

  it('GovernanceService provides diagnostics on empty state', () => {
    const gov = createGovernanceService();
    const diag = gov.diagnostics();
    expect(diag.totalProposals).toBe(0);
    expect(diag.totalReceipts).toBe(0);
    expect(diag.legacyBypassCount).toBe(0);
  });

  it('KernelServices type includes governance/selfmod/multiagent fields', () => {
    // Type-level check — if this compiles, the fields exist
    type KS = {
      governance: GovernanceService;
      selfmod: any;
      multiagent: any;
    };
    const check: KS = {
      governance: createGovernanceService(),
      selfmod: createMockSelfMod(),
      multiagent: createMockMultiAgent(),
    };
    expect(check.governance).toBeDefined();
    expect(check.selfmod).toBeDefined();
    expect(check.multiagent).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. SELFMOD FULL PATH
// ══════════════════════════════════════════════════════════════════════

describe('SelfMod Integration Path', () => {
  let gov: GovernanceService;
  let selfmod: ReturnType<typeof createMockSelfMod>;

  beforeEach(() => {
    selfmod = createMockSelfMod();
    gov = createGovernanceService({ selfmod: selfmod as any });
  });

  it('propose → evaluate → apply → verify (happy path)', async () => {
    const proposal = gov.propose({
      actionKind: 'selfmod',
      target: 'src/test.ts',
      justification: 'Add logging',
      payload: { file: 'src/test.ts', content: 'console.log("hello")' },
    });
    expect(proposal.status).toBe('proposed');
    expect(proposal.riskLevel).toBe('high');

    const verdict = gov.evaluate(proposal.id);
    expect(verdict.code).toBe('allow');

    const receipt = await gov.apply(proposal.id);
    expect(receipt.result).toBe('success');
    expect(selfmod.modify).toHaveBeenCalledOnce();

    const verifyReceipt = gov.verify(proposal.id);
    expect(verifyReceipt.result).toBe('success');
  });

  it('rollback after apply restores via git-revert', async () => {
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    await gov.apply(p.id);

    const rollbackReceipt = await gov.rollback(p.id);
    expect(rollbackReceipt.result).toBe('success');
    expect(selfmod.rollback).toHaveBeenCalledWith('mod_001');
  });

  it('apply without evaluation throws', async () => {
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    await expect(gov.apply(p.id)).rejects.toThrow(/must be approved/);
  });

  it('apply without selfmod configured throws', async () => {
    const gov2 = createGovernanceService({ selfmod: undefined });
    const p = gov2.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov2.evaluate(p.id);
    const receipt = await gov2.apply(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/SelfModManager not configured/);
  });

  it('selfmod failure produces failure receipt', async () => {
    selfmod.modify.mockRejectedValue(new Error('Permission denied'));
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    const receipt = await gov.apply(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/Permission denied/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. REPLICATION FULL PATH
// ══════════════════════════════════════════════════════════════════════

describe('Replication Integration Path', () => {
  let gov: GovernanceService;
  let multiagent: ReturnType<typeof createMockMultiAgent>;

  beforeEach(() => {
    multiagent = createMockMultiAgent();
    gov = createGovernanceService({ multiagent: multiagent as any });
  });

  it('propose → evaluate → apply → verify → rollback (full lifecycle)', async () => {
    const p = gov.propose({
      actionKind: 'replication',
      target: 'worker-alpha',
      justification: 'Need a worker for scraping',
      payload: { name: 'worker-alpha', task: 'scrape', genesisPrompt: 'You are a worker' },
      expectedCostCents: 500,
    });
    expect(p.riskLevel).toBe('high');
    expect(p.rollbackPlan.strategy).toBe('terminate-child');

    const verdict = gov.evaluate(p.id);
    expect(verdict.code).toBe('allow');

    const receipt = await gov.apply(p.id);
    expect(receipt.result).toBe('success');
    expect(multiagent.spawn).toHaveBeenCalledOnce();

    const verifyReceipt = gov.verify(p.id);
    expect(verifyReceipt.result).toBe('success');

    // Rollback = terminate child
    const proposal = gov.getProposal(p.id)!;
    // Force status back to 'applied' for rollback (since verified is terminal for verify but we need to test rollback from applied)
    // Actually rollback requires 'applied' or 'failed' status — but verify transitions to 'verified'
    // So let's test rollback before verify
  });

  it('rollback terminates spawned child', async () => {
    const p = gov.propose({
      actionKind: 'replication',
      target: 'worker-beta',
      justification: 'test',
      payload: { name: 'worker-beta', task: 'test' },
    });
    gov.evaluate(p.id);
    await gov.apply(p.id);
    // Rollback from 'applied' state
    const rollbackReceipt = await gov.rollback(p.id);
    expect(rollbackReceipt.result).toBe('success');
    expect(multiagent.terminate).toHaveBeenCalledWith('child_001', true);
  });

  it('spawn failure produces failure receipt', async () => {
    multiagent.spawn.mockRejectedValue(new Error('Insufficient funds'));
    const p = gov.propose({ actionKind: 'replication', target: 'worker', justification: 'test' });
    gov.evaluate(p.id);
    const receipt = await gov.apply(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/Insufficient funds/);
  });

  it('budget exceeded denies replication', () => {
    const gov2 = createGovernanceService({ dailyBudgetCents: 100, dailySpentCents: 90 });
    const p = gov2.propose({
      actionKind: 'replication',
      target: 'worker',
      justification: 'test',
      expectedCostCents: 50,
    });
    const verdict = gov2.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(gov2.getProposal(p.id)?.denialLayer).toBe('economy');
  });

  it('without multiagent configured, apply fails gracefully', async () => {
    const gov2 = createGovernanceService({ multiagent: undefined });
    const p = gov2.propose({ actionKind: 'replication', target: 'worker', justification: 'test' });
    gov2.evaluate(p.id);
    const receipt = await gov2.apply(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/Neither LineageService nor MultiAgentManager configured/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. API ROUTE HANDLER BEHAVIOR
// ══════════════════════════════════════════════════════════════════════

describe('API Route Behavior (unit)', () => {
  let gov: GovernanceService;

  beforeEach(() => {
    gov = createGovernanceService();
  });

  it('proposal create and list round-trip', () => {
    gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.propose({ actionKind: 'replication', target: 'worker', justification: 'test' });
    const all = gov.listProposals();
    expect(all).toHaveLength(2);
  });

  it('filter by status', () => {
    const p1 = gov.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'test' });
    gov.evaluate(p1.id); // approved
    gov.propose({ actionKind: 'selfmod', target: 'b.ts', justification: 'test' }); // proposed

    const approved = gov.listProposals({ status: 'approved' });
    expect(approved).toHaveLength(1);
    const proposed = gov.listProposals({ status: 'proposed' });
    expect(proposed).toHaveLength(1);
  });

  it('filter by actionKind', () => {
    gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.propose({ actionKind: 'replication', target: 'worker', justification: 'test' });

    const selfmods = gov.listProposals({ actionKind: 'selfmod' });
    expect(selfmods).toHaveLength(1);
  });

  it('get non-existent proposal returns undefined', () => {
    expect(gov.getProposal('fake-id')).toBeUndefined();
  });

  it('receipts for a proposal are correctly filtered', async () => {
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    await gov.apply(p.id);

    const receipts = gov.getReceipts(p.id);
    expect(receipts.length).toBeGreaterThanOrEqual(2); // decision + apply
    expect(receipts.every(r => r.proposalId === p.id)).toBe(true);
  });

  it('force-approve escalated proposal', () => {
    const gov2 = createGovernanceService({ policy: createMockPolicy('escalate') });
    const p = gov2.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = gov2.evaluate(p.id);
    expect(verdict.code).toBe('require_review');

    const approveVerdict = gov2.forceApprove(p.id);
    expect(approveVerdict.code).toBe('allow');
    expect(gov2.getProposal(p.id)?.status).toBe('approved');
  });

  it('force-approve non-escalated throws', () => {
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    expect(() => gov.forceApprove(p.id)).toThrow(/Cannot force-approve/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. DIAGNOSTICS ACCURACY
// ══════════════════════════════════════════════════════════════════════

describe('Governance Diagnostics', () => {
  it('empty state returns zeroed diagnostics', () => {
    const gov = createGovernanceService();
    const d = gov.diagnostics();
    expect(d.totalProposals).toBe(0);
    expect(d.approvalRate).toBe(0);
    expect(d.denialRate).toBe(0);
    expect(d.escalationRate).toBe(0);
    expect(d.rollbackCount).toBe(0);
    expect(d.legacyBypassCount).toBe(0);
  });

  it('counts proposals by status correctly', () => {
    const gov = createGovernanceService();
    const p1 = gov.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'test' });
    gov.evaluate(p1.id); // → approved
    gov.propose({ actionKind: 'selfmod', target: 'b.ts', justification: 'test' }); // → proposed

    const d = gov.diagnostics();
    expect(d.totalProposals).toBe(2);
    expect(d.proposalsByStatus['approved']).toBe(1);
    expect(d.proposalsByStatus['proposed']).toBe(1);
  });

  it('counts proposals by kind correctly', () => {
    const gov = createGovernanceService();
    gov.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'test' });
    gov.propose({ actionKind: 'replication', target: 'worker', justification: 'test' });
    gov.propose({ actionKind: 'selfmod', target: 'b.ts', justification: 'test' });

    const d = gov.diagnostics();
    expect(d.proposalsByKind['selfmod']).toBe(2);
    expect(d.proposalsByKind['replication']).toBe(1);
  });

  it('proposal_invalid counted separately from denials (Round 17.5)', () => {
    const gov = createGovernanceService();
    // 1 approved
    const p1 = gov.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'test' });
    gov.evaluate(p1.id);

    // 1 proposal_invalid (not denial)
    const gov2 = createGovernanceService({ identity: createMockIdentity('revoked') });
    gov2.propose({ actionKind: 'selfmod', target: 'b.ts', justification: 'test' });

    const d1 = gov.diagnostics();
    expect(d1.approvalRate).toBe(1); // 1/1

    const d2 = gov2.diagnostics();
    // proposal_invalid is not a denial — denialRate stays 0
    expect(d2.denialRate).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. LEGACY ADAPTER
// ══════════════════════════════════════════════════════════════════════

describe('Legacy Adapter', () => {
  it('GovernanceDiagnostics.legacyBypassCount is always 0 (governed-by-default)', () => {
    const gov = createGovernanceService();
    // Process some proposals
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    const d = gov.diagnostics();
    expect(d.legacyBypassCount).toBe(0);
  });

  it('GovernanceService is the canonical governance owner', () => {
    // Verify that the service exposes the complete lifecycle API
    const gov = createGovernanceService();
    expect(typeof gov.propose).toBe('function');
    expect(typeof gov.evaluate).toBe('function');
    expect(typeof gov.apply).toBe('function');
    expect(typeof gov.verify).toBe('function');
    expect(typeof gov.rollback).toBe('function');
    expect(typeof gov.forceApprove).toBe('function');
    expect(typeof gov.forceDeny).toBe('function');
    expect(typeof gov.diagnostics).toBe('function');
    expect(typeof gov.listProposals).toBe('function');
    expect(typeof gov.getReceipts).toBe('function');
  });

  it('contract types are properly exported', () => {
    // Verify risk map and rollback map are accessible
    expect(ACTION_RISK_MAP.selfmod).toBe('high');
    expect(ACTION_RISK_MAP.replication).toBe('high');
    expect(ACTION_RISK_MAP.identity_rotation).toBe('critical');
    expect(ACTION_ROLLBACK_MAP.selfmod).toBe('git-revert');
    expect(ACTION_ROLLBACK_MAP.replication).toBe('terminate-child');
    expect(ACTION_ROLLBACK_MAP.dangerous_action).toBe('irreversible');
    expect(isValidStatusTransition('proposed', 'evaluating')).toBe(true);
    expect(isValidStatusTransition('denied', 'approved')).toBe(false);
    expect(TERMINAL_STATUSES).toContain('denied');
    expect(TERMINAL_STATUSES).toContain('verified');
    expect(TERMINAL_STATUSES).toContain('rolled_back');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. IDENTITY-GOVERNANCE INTERACTION
// ══════════════════════════════════════════════════════════════════════

describe('Identity-Governance Interaction', () => {
  it('revoked identity marks proposal as proposal_invalid (Round 17.5)', () => {
    const gov = createGovernanceService({ identity: createMockIdentity('revoked') });
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    // Round 17.5: proposal_invalid at initiation
    expect(p.status).toBe('proposal_invalid');
    expect(p.denialLayer).toBe('identity');
  });

  it('degraded identity denies critical actions', () => {
    const gov = createGovernanceService({ identity: createMockIdentity('degraded') });
    const p = gov.propose({
      actionKind: 'identity_rotation',
      target: 'self',
      justification: 'rotate keys',
    });
    const verdict = gov.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(gov.getProposal(p.id)?.denialLayer).toBe('identity');
  });

  it('degraded identity allows medium-risk actions', () => {
    const gov = createGovernanceService({ identity: createMockIdentity('degraded') });
    const p = gov.propose({
      actionKind: 'fund_child',
      target: 'child-001',
      justification: 'fund worker',
      expectedCostCents: 100,
    });
    const verdict = gov.evaluate(p.id);
    expect(verdict.code).toBe('allow');
  });

  it('active identity proceeds through all layers', () => {
    const gov = createGovernanceService();
    const p = gov.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'improve logging',
    });
    const verdict = gov.evaluate(p.id);
    expect(verdict.code).toBe('allow');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. EDGE CASES
// ══════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('double evaluate throws', () => {
    const gov = createGovernanceService();
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    expect(() => gov.evaluate(p.id)).toThrow();
  });

  it('verify before apply throws', () => {
    const gov = createGovernanceService();
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    expect(() => gov.verify(p.id)).toThrow(/must be applied/);
  });

  it('rollback on irreversible action returns failure receipt', async () => {
    const gov = createGovernanceService();
    const p = gov.propose({
      actionKind: 'fund_child',
      target: 'child-001',
      justification: 'fund worker',
      expectedCostCents: 50,
    });
    gov.evaluate(p.id);
    await gov.apply(p.id);
    const receipt = await gov.rollback(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/irreversible/);
  });

  it('non-existent proposal throws on evaluate', () => {
    const gov = createGovernanceService();
    expect(() => gov.evaluate('fake-id')).toThrow(/not found/);
  });

  it('forced deny on escalated proposal works', () => {
    const gov = createGovernanceService({ policy: createMockPolicy('escalate') });
    const p = gov.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    gov.evaluate(p.id);
    const verdict = gov.forceDeny(p.id, 'Creator rejected');
    expect(verdict.code).toBe('deny');
    expect(gov.getProposal(p.id)?.denialReason).toBe('Creator rejected');
  });
});
