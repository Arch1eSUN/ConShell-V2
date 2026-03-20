/**
 * Governance Workflow — Round 16.3 Tests (migrated to verdict semantics in 17.1)
 *
 * Coverage:
 *   1. Contract types & status transitions
 *   2. GovernanceService core workflow (propose/evaluate/apply/verify/rollback)
 *   3. SelfMod governance integration
 *   4. Replication governance integration
 *   5. Identity-Action unification
 *   6. Receipts & audit trail
 *   7. Rejection paths & edge cases
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACTION_RISK_MAP,
  ACTION_ROLLBACK_MAP,
  STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidStatusTransition,
} from './governance-contract.js';
import { GovernanceService, type GovernanceServiceOptions } from './governance-service.js';

// ── Mock Factories ────────────────────────────────────────────────────

function createMockIdentity(status: string = 'active') {
  return {
    status: () => status as any,
    selfFingerprint: () => 'fp_test_12345',
  };
}

function createMockPolicy(decision: 'allow' | 'deny' | 'escalate' = 'allow', rule: string = 'default-allow') {
  return {
    evaluate: () => ({ decision, rule, reason: 'mock', category: 'security' } as const),
  };
}

function createMockSelfMod() {
  return {
    propose: vi.fn().mockResolvedValue({
      id: 'mod_001',
      file: 'test.ts',
      diff: '+ new line',
      reason: 'test mod',
      timestamp: new Date().toISOString(),
      status: 'proposed',
    }),
    approve: vi.fn(),
    apply: vi.fn().mockResolvedValue({
      id: 'mod_001',
      file: 'test.ts',
      diff: '+ new line',
      reason: 'test mod',
      timestamp: new Date().toISOString(),
      status: 'applied',
    }),
    rollback: vi.fn().mockResolvedValue(true),
    verify: vi.fn(),
    history: () => [],
    stats: () => ({ total: 0, lastHour: 0, rolledBack: 0 }),
  };
}

function createMockMultiAgent() {
  return {
    spawn: vi.fn().mockResolvedValue({
      id: 'agent_001',
      name: 'test-child',
      state: 'running',
      task: 'test task',
      parentId: 'root',
      childIds: [],
      fundedCents: 1000,
      genesisPrompt: '',
      createdAt: new Date().toISOString(),
      lastHeartbeat: Date.now(),
      generation: 1,
    }),
    terminate: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockLineage() {
  return {
    createChild: vi.fn().mockResolvedValue({
      id: 'lineage_001',
      childId: 'agent_001',
      status: 'active',
      spec: { name: 'test-child', task: 'test' },
    }),
    getByChildId: vi.fn().mockReturnValue(null),
    recallChild: vi.fn().mockResolvedValue({ success: true }),
    terminateChild: vi.fn().mockResolvedValue({ success: true }),
  };
}

const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => mockLogger,
} as any;

function createService(overrides: Partial<GovernanceServiceOptions> = {}): GovernanceService {
  return new GovernanceService({
    identity: createMockIdentity(),
    policy: createMockPolicy(),
    selfmod: createMockSelfMod() as any,
    multiagent: createMockMultiAgent() as any,
    logger: mockLogger,
    ...overrides,
  });
}

// ── 1. Contract Types & Status Transitions ────────────────────────────

describe('Governance Contract (Round 16.3)', () => {
  it('ACTION_RISK_MAP covers all action kinds', () => {
    const kinds = ['selfmod', 'replication', 'fund_child', 'identity_rotation',
      'identity_revocation', 'external_declaration', 'dangerous_action'] as const;
    for (const k of kinds) {
      expect(ACTION_RISK_MAP[k]).toBeDefined();
    }
  });

  it('ACTION_ROLLBACK_MAP maps selfmod to git-revert and replication to terminate-child', () => {
    expect(ACTION_ROLLBACK_MAP.selfmod).toBe('git-revert');
    expect(ACTION_ROLLBACK_MAP.replication).toBe('terminate-child');
    expect(ACTION_ROLLBACK_MAP.external_declaration).toBe('irreversible');
  });

  it('status transitions: proposed can only go to evaluating', () => {
    expect(isValidStatusTransition('proposed', 'evaluating')).toBe(true);
    expect(isValidStatusTransition('proposed', 'approved')).toBe(false);
    expect(isValidStatusTransition('proposed', 'denied')).toBe(false);
  });

  it('terminal statuses have no outgoing transitions', () => {
    for (const ts of TERMINAL_STATUSES) {
      expect(STATUS_TRANSITIONS[ts].length).toBe(0);
    }
  });

  it('evaluating can go to approved, denied, or escalated', () => {
    expect(isValidStatusTransition('evaluating', 'approved')).toBe(true);
    expect(isValidStatusTransition('evaluating', 'denied')).toBe(true);
    expect(isValidStatusTransition('evaluating', 'escalated')).toBe(true);
    expect(isValidStatusTransition('evaluating', 'applied')).toBe(false);
  });
});

// ── 2. GovernanceService Core Workflow ────────────────────────────────

describe('GovernanceService Core (Round 16.3)', () => {
  let svc: GovernanceService;

  beforeEach(() => {
    svc = createService();
  });

  it('propose() creates a proposal with correct fields', () => {
    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'config.ts',
      justification: 'Update config defaults',
    });
    expect(p.id).toMatch(/^gov_/);
    expect(p.actionKind).toBe('selfmod');
    expect(p.target).toBe('config.ts');
    expect(p.status).toBe('proposed');
    expect(p.riskLevel).toBe('high'); // from ACTION_RISK_MAP
    expect(p.rollbackPlan.strategy).toBe('git-revert');
    expect(p.rollbackPlan.reversible).toBe(true);
    expect(p.initiator.identityId).toBe('fp_test_12345');
    expect(p.initiator.identityStatus).toBe('active');
  });

  it('evaluate() auto-approves when all checks pass', () => {
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('allow');
    expect(svc.getProposal(p.id)?.status).toBe('approved');
  });

  it('full workflow: propose → evaluate → apply → verify', async () => {
    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'test mod',
      payload: { file: 'test.ts', content: '// modified' },
    });
    svc.evaluate(p.id);
    const applyReceipt = await svc.apply(p.id);
    expect(applyReceipt.result).toBe('success');
    expect(applyReceipt.phase).toBe('apply');
    expect(applyReceipt.relatedIds?.modRecordId).toBe('mod_001');

    const verifyReceipt = svc.verify(p.id);
    expect(verifyReceipt.result).toBe('success');
    expect(svc.getProposal(p.id)?.status).toBe('verified');
  });

  it('full workflow: propose → evaluate → apply → rollback', async () => {
    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'test mod',
      payload: { file: 'test.ts', content: '// modified' },
    });
    svc.evaluate(p.id);
    await svc.apply(p.id);

    const rollbackReceipt = await svc.rollback(p.id);
    expect(rollbackReceipt.result).toBe('success');
    expect(rollbackReceipt.phase).toBe('rollback');
    expect(svc.getProposal(p.id)?.status).toBe('rolled_back');
  });

  it('listProposals() filters by status', () => {
    svc.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'a' });
    const p2 = svc.propose({ actionKind: 'replication', target: 'child', justification: 'b' });
    svc.evaluate(p2.id);

    const proposed = svc.listProposals({ status: 'proposed' });
    expect(proposed.length).toBe(1);
    const approved = svc.listProposals({ status: 'approved' });
    expect(approved.length).toBe(1);
  });

  it('listProposals() filters by actionKind', () => {
    svc.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'a' });
    svc.propose({ actionKind: 'replication', target: 'child', justification: 'b' });

    const selfmods = svc.listProposals({ actionKind: 'selfmod' });
    expect(selfmods.length).toBe(1);
  });

  it('getReceipts() returns receipts for a specific proposal', () => {
    const p = svc.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'a' });
    svc.evaluate(p.id);
    const receipts = svc.getReceipts(p.id);
    expect(receipts.length).toBe(1);
    expect(receipts[0]!.phase).toBe('decision');
  });

  it('evaluate() throws on invalid status transition', () => {
    const p = svc.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'a' });
    svc.evaluate(p.id); // now approved
    expect(() => svc.evaluate(p.id)).toThrow('Cannot evaluate');
  });
});

// ── 3. SelfMod Governance Tests ──────────────────────────────────────

describe('SelfMod Governance (Round 16.3)', () => {
  it('selfmod must go through governance — direct bypass not possible via GovernanceService', async () => {
    const selfmod = createMockSelfMod();
    const svc = createService({ selfmod: selfmod as any });

    // Correct path: propose → evaluate → apply → calls selfmod.modify
    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'file.ts',
      justification: 'governance-required mod',
      payload: { file: 'file.ts', content: '// changed' },
    });
    svc.evaluate(p.id);
    await svc.apply(p.id);

    expect(selfmod.propose).toHaveBeenCalledOnce();
    expect(selfmod.propose).toHaveBeenCalledWith('file.ts', '// changed', 'governance-required mod');
  });

  it('apply() generates receipt with modRecordId', async () => {
    const svc = createService();
    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'test',
      payload: { file: 'test.ts', content: '// new' },
    });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    expect(receipt.relatedIds?.modRecordId).toBe('mod_001');
  });

  it('selfmod rollback calls selfmod.rollback()', async () => {
    const selfmod = createMockSelfMod();
    const svc = createService({ selfmod: selfmod as any });

    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'test',
      payload: { file: 'test.ts', content: '// new' },
    });
    svc.evaluate(p.id);
    await svc.apply(p.id);
    await svc.rollback(p.id);

    expect(selfmod.rollback).toHaveBeenCalledWith('mod_001');
  });

  it('selfmod apply failure sets status to failed', async () => {
    const selfmod = createMockSelfMod();
    selfmod.apply.mockRejectedValue(new Error('Protected file'));
    const svc = createService({ selfmod: selfmod as any });

    const p = svc.propose({
      actionKind: 'selfmod',
      target: 'SOUL.md',
      justification: 'test',
      payload: { file: 'SOUL.md', content: 'hacked' },
    });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toContain('Protected file');
    expect(svc.getProposal(p.id)?.status).toBe('failed');
  });

  it('verify fails when apply returned failure', async () => {
    const selfmod = createMockSelfMod();
    selfmod.apply.mockRejectedValue(new Error('Protected'));
    const svc = createService({ selfmod: selfmod as any });

    const p = svc.propose({
      actionKind: 'selfmod', target: 'x.ts', justification: 'test',
      payload: { file: 'x.ts', content: 'x' },
    });
    svc.evaluate(p.id);
    await svc.apply(p.id);
    // Status is 'failed', verify should throw
    expect(() => svc.verify(p.id)).toThrow('must be applied');
  });
});

// ── 4. Replication Governance Tests ──────────────────────────────────

describe('Replication Governance (Round 18.7 — canonical lineage path)', () => {
  it('replication goes through proposal → apply → creates child via lineage', async () => {
    const lineage = createMockLineage();
    const svc = createService({ lineage: lineage as any });

    const p = svc.propose({
      actionKind: 'replication',
      target: 'research-child',
      justification: 'Spawn research specialist',
      expectedCostCents: 1000,
      payload: { name: 'research-child', task: 'search papers', genesisPrompt: 'You are a researcher.' },
    });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);

    expect(receipt.result).toBe('success');
    expect(receipt.relatedIds?.childId).toBe('agent_001');
    expect(receipt.relatedIds?.lineageRecordId).toBe('lineage_001');
    expect(lineage.createChild).toHaveBeenCalledOnce();
  });

  it('replication without lineage configured fails with clear error', async () => {
    const svc = createService({ lineage: undefined, multiagent: undefined });

    const p = svc.propose({
      actionKind: 'replication',
      target: 'temp-child',
      justification: 'Temporary task',
      expectedCostCents: 500,
      payload: { name: 'temp-child', task: 'temp', genesisPrompt: '' },
    });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);

    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toMatch(/LineageService not configured/);
  });

  it('replication denied when budget exceeded', () => {
    const svc = createService({ economic: { survivalTier: () => 'thriving', isEmergency: () => false, mustPreserveActive: () => false, canAcceptAction: () => ({allowed: false, reason: 'Budget exceeded'}) } as any });
    const p = svc.propose({
      actionKind: 'replication',
      target: 'expensive-child',
      justification: 'Need more compute',
      expectedCostCents: 500,
    });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(svc.getProposal(p.id)?.denialLayer).toBe('economy');
  });

  it('replication denied when identity degraded (high risk)', () => {
    const svc = createService({ identity: createMockIdentity('degraded') });
    const p = svc.propose({
      actionKind: 'replication',
      target: 'child',
      justification: 'test',
    });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(svc.getProposal(p.id)?.denialLayer).toBe('identity');
  });

  it('fund_child is marked irreversible', () => {
    const svc = createService();
    const p = svc.propose({
      actionKind: 'fund_child',
      target: 'child_001',
      justification: 'Operational funds',
      expectedCostCents: 500,
    });
    expect(p.rollbackPlan.reversible).toBe(false);
    expect(p.rollbackPlan.strategy).toBe('irreversible');
  });
});

// ── 5. Identity-Action Unification Tests ─────────────────────────────

describe('Identity-Action Unification (Round 16.3)', () => {
  it('proposal carries actor identity info', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    expect(p.initiator.identityId).toBe('fp_test_12345');
    expect(p.initiator.identityStatus).toBe('active');
    expect(p.initiator.origin).toBe('self');
  });

  it('revoked identity marks proposal as proposal_invalid (Round 17.5)', () => {
    const svc = createService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    // Round 17.5: proposal_invalid at initiation, not deny at evaluation
    expect(p.status).toBe('proposal_invalid');
    expect(p.denialLayer).toBe('identity');
    expect(p.denialReason).toContain('revoked');
  });

  it('degraded identity allows low-risk actions', () => {
    const svc = createService({ identity: createMockIdentity('degraded') });
    const p = svc.propose({ actionKind: 'fund_child', target: 'child', justification: 'funding', expectedCostCents: 100 });
    const verdict = svc.evaluate(p.id);
    // fund_child is medium risk → degraded identity allows medium risk
    expect(verdict.code).not.toBe('deny');
  });

  it('degraded identity denies critical-risk actions', () => {
    const svc = createService({ identity: createMockIdentity('degraded') });
    const p = svc.propose({ actionKind: 'identity_rotation', target: 'self', justification: 'rotate' });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(svc.getProposal(p.id)?.denialLayer).toBe('identity');
  });
});

// ── 6. Receipts & Audit Trail Tests ──────────────────────────────────

describe('Governance Receipts (Round 16.3)', () => {
  it('decision receipt created on evaluate', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    svc.evaluate(p.id);
    const receipts = svc.getReceipts(p.id);
    expect(receipts.length).toBe(1);
    expect(receipts[0]!.phase).toBe('decision');
    expect(receipts[0]!.actionKind).toBe('selfmod');
  });

  it('apply/verify/rollback each create a receipt', async () => {
    const svc = createService();
    const p = svc.propose({
      actionKind: 'selfmod', target: 'x', justification: 'test',
      payload: { file: 'x', content: 'y' },
    });
    svc.evaluate(p.id);
    await svc.apply(p.id);
    // rollback instead of verify to get all receipt types
    await svc.rollback(p.id);

    const receipts = svc.getReceipts(p.id);
    const phases = receipts.map(r => r.phase);
    expect(phases).toContain('decision');
    expect(phases).toContain('apply');
    expect(phases).toContain('rollback');
  });

  it('proposal_invalid generates initiation receipt (Round 17.5)', () => {
    const svc = createService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    // Round 17.5: initiation receipt, not decision receipt
    const receipts = svc.getReceipts(p.id);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.phase).toBe('initiation');
    expect(receipts[0]!.result).toBe('failure');
    expect(receipts[0]!.reason).toContain('revoked');
  });

  it('allReceipts() returns all receipts across proposals', () => {
    const svc = createService();
    svc.propose({ actionKind: 'selfmod', target: 'a', justification: 'a' });
    const p2 = svc.propose({ actionKind: 'replication', target: 'b', justification: 'b' });
    svc.evaluate(p2.id);
    expect(svc.allReceipts().length).toBe(1); // only p2 was evaluated
  });
});

// ── 7. Rejection Paths & Edge Cases ─────────────────────────────────

describe('Governance Edge Cases (Round 16.3)', () => {
  it('evaluate non-existent proposal throws', () => {
    const svc = createService();
    expect(() => svc.evaluate('nonexistent')).toThrow('Proposal not found');
  });

  it('apply unapproved proposal throws', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'x' });
    await expect(svc.apply(p.id)).rejects.toThrow('must be approved');
  });

  it('verify unapplied proposal throws', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'x' });
    svc.evaluate(p.id);
    expect(() => svc.verify(p.id)).toThrow('must be applied');
  });

  it('rollback irreversible action returns failure receipt', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'fund_child', target: 'child', justification: 'test', expectedCostCents: 100 });
    svc.evaluate(p.id);
    await svc.apply(p.id);
    const receipt = await svc.rollback(p.id);
    expect(receipt.result).toBe('failure');
    expect(receipt.reason).toContain('irreversible');
  });

  it('policy deny propagates to governance denial', () => {
    const svc = createService({ policy: createMockPolicy('deny', 'test-deny-rule') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'x' });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('deny');
    expect(svc.getProposal(p.id)?.denialLayer).toBe('policy');
    expect(svc.getProposal(p.id)?.denialReason).toContain('test-deny-rule');
  });

  it('policy escalate propagates to governance escalation', () => {
    const svc = createService({ policy: createMockPolicy('escalate', 'needs-human') });
    const p = svc.propose({ actionKind: 'fund_child', target: 'child', justification: 'x', expectedCostCents: 100 });
    const verdict = svc.evaluate(p.id);
    expect(verdict.code).toBe('require_review');
    expect(svc.getProposal(p.id)?.status).toBe('escalated');
  });

  it('forceApprove an escalated proposal', () => {
    const svc = createService({ policy: createMockPolicy('escalate', 'needs-human') });
    const p = svc.propose({ actionKind: 'fund_child', target: 'child', justification: 'x', expectedCostCents: 100 });
    svc.evaluate(p.id);
    const verdict = svc.forceApprove(p.id);
    expect(verdict.code).toBe('allow');
    expect(svc.getProposal(p.id)?.status).toBe('approved');
  });

  it('forceDeny an escalated proposal', () => {
    const svc = createService({ policy: createMockPolicy('escalate', 'needs-human') });
    const p = svc.propose({ actionKind: 'fund_child', target: 'child', justification: 'x', expectedCostCents: 100 });
    svc.evaluate(p.id);
    const verdict = svc.forceDeny(p.id, 'Not approved by creator');
    expect(verdict.code).toBe('deny');
    expect(svc.getProposal(p.id)?.status).toBe('denied');
  });

  it('irreversible critical action escalates even with auto-approve policy', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'identity_rotation', target: 'self', justification: 'Rotate credentials' });
    const verdict = svc.evaluate(p.id);
    // identity_rotation is critical + irreversible → require_review
    expect(verdict.code).toBe('require_review');
  });

  it('proposalCount tracks total proposals', () => {
    const svc = createService();
    expect(svc.proposalCount).toBe(0);
    svc.propose({ actionKind: 'selfmod', target: 'a', justification: 'a' });
    svc.propose({ actionKind: 'replication', target: 'b', justification: 'b' });
    expect(svc.proposalCount).toBe(2);
  });
});
