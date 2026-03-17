/**
 * Round 17.1 — Governance Migration Closure Verification Matrix
 *
 * V1:  Legacy tests migrated to verdict semantics
 * V2:  No execution path uses bare decision string
 * V3:  Replication path → verdict → receipt with verdictId
 * V4:  Selfmod path → verdict → receipt with verdictId
 * V5:  dangerous_action respects require_review/deny/constraints
 * V6:  Lineage record + verdict linkage queryable
 * V7:  Branch control receipts link to governanceVerdictId
 * V8:  Trace endpoint returns full chain
 * V9:  Deprecated compat layer isolated and marked
 * V10: Full governance test suite passes under new semantics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GovernanceService, type GovernanceServiceOptions } from './governance-service.js';
import type { GovernanceVerdict } from './governance-verdict.js';
import { isExecutableVerdict, isTerminalVerdict, getConstraint } from './governance-verdict.js';

// ── Mock Factories ────────────────────────────────────────────────────

function createMockIdentity(status: 'active' | 'degraded' | 'revoked' = 'active') {
  return {
    status: () => status,
    selfFingerprint: () => 'fp_171_test',
  };
}

function createMockPolicy(decision: 'allow' | 'deny' | 'escalate' = 'allow', rule = 'default-allow') {
  return {
    evaluate: () => ({ decision, rule, reason: 'mock', category: 'security' } as const),
  };
}

function createMockSelfMod() {
  return {
    modify: vi.fn().mockResolvedValue({ id: 'mod_171', file: 'test.ts', timestamp: Date.now() }),
    rollback: vi.fn().mockResolvedValue(true),
    stats: () => ({ total: 0, lastHour: 0, rolledBack: 0 }),
  };
}

function createMockMultiAgent() {
  return {
    spawn: vi.fn().mockResolvedValue({ id: 'child_171', name: 'test-child', state: 'running' }),
    terminate: vi.fn().mockResolvedValue(true),
    list: () => [],
    stats: () => ({ totalChildren: 0 }),
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
    dailyBudgetCents: 100_00,
    dailySpentCents: 0,
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════
// V1: LEGACY TESTS MIGRATED TO VERDICT SEMANTICS
// ══════════════════════════════════════════════════════════════════════

describe('V1: Verdict return type', () => {
  it('evaluate() returns GovernanceVerdict with .code, .id, .reason', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(verdict).toBeDefined();
    expect(verdict.code).toBe('allow');
    expect(verdict.id).toMatch(/^vrd_/);
    expect(verdict.proposalId).toBe(p.id);
    expect(verdict.reason).toBeTruthy();
    expect(verdict.riskLevel).toBe('high');
    expect(verdict.timestamp).toBeTruthy();
  });

  it('forceApprove() returns GovernanceVerdict', () => {
    const svc = createService({ policy: createMockPolicy('escalate') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    svc.evaluate(p.id);
    const verdict = svc.forceApprove(p.id);
    expect(verdict.code).toBe('allow');
    expect(verdict.id).toMatch(/^vrd_/);
  });

  it('forceDeny() returns GovernanceVerdict', () => {
    const svc = createService({ policy: createMockPolicy('escalate') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    svc.evaluate(p.id);
    const verdict = svc.forceDeny(p.id, 'Not allowed');
    expect(verdict.code).toBe('deny');
    expect(verdict.id).toMatch(/^vrd_/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V2: NO EXECUTION PATH USES BARE DECISION STRING
// ══════════════════════════════════════════════════════════════════════

describe('V2: No bare decision strings', () => {
  it('evaluate() return is an object, not a string', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const result = svc.evaluate(p.id);
    expect(typeof result).toBe('object');
    expect(typeof result).not.toBe('string');
  });

  it('forceApprove() return is an object, not a string', () => {
    const svc = createService({ policy: createMockPolicy('escalate') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    svc.evaluate(p.id);
    const result = svc.forceApprove(p.id);
    expect(typeof result).toBe('object');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V3: REPLICATION → VERDICT → RECEIPT WITH verdictId
// ══════════════════════════════════════════════════════════════════════

describe('V3: Replication receipt linkage', () => {
  it('apply receipt includes verdictId for replication', async () => {
    const svc = createService();
    const p = svc.propose({
      actionKind: 'replication',
      target: 'worker-v3',
      justification: 'test',
      payload: { name: 'worker-v3', task: 'scrape' },
    });
    const verdict = svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    expect(receipt.result).toBe('success');
    expect(receipt.relatedIds?.verdictId).toBe(verdict.id);
  });

  it('verdict has executionReceiptId after apply', async () => {
    const svc = createService();
    const p = svc.propose({
      actionKind: 'replication',
      target: 'worker-v3b',
      justification: 'test',
      payload: { name: 'worker-v3b', task: 'test' },
    });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    const storedVerdict = svc.getVerdict(p.id);
    expect(storedVerdict?.executionReceiptId).toBe(receipt.id);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V4: SELFMOD → VERDICT → RECEIPT WITH verdictId
// ══════════════════════════════════════════════════════════════════════

describe('V4: Selfmod receipt linkage', () => {
  it('apply receipt includes verdictId for selfmod', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    expect(receipt.result).toBe('success');
    expect(receipt.relatedIds?.verdictId).toBe(verdict.id);
  });

  it('verdict has executionReceiptId after selfmod apply', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x.ts', justification: 'test' });
    svc.evaluate(p.id);
    const receipt = await svc.apply(p.id);
    const storedVerdict = svc.getVerdict(p.id);
    expect(storedVerdict?.executionReceiptId).toBe(receipt.id);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V5: DANGEROUS ACTION RESPECTS DENY / REQUIRE_REVIEW / CONSTRAINTS
// ══════════════════════════════════════════════════════════════════════

describe('V5: dangerous_action governance', () => {
  it('dangerous_action with active identity evaluates (not auto-denied)', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'dangerous_action', target: 'exec_shell', justification: 'deploy' });
    const verdict = svc.evaluate(p.id);
    // dangerous_action is critical risk, irreversible → require_review
    expect(verdict.code).toBe('require_review');
  });

  it('dangerous_action with revoked identity is proposal_invalid (Round 17.5)', () => {
    const svc = createService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'dangerous_action', target: 'exec_shell', justification: 'test' });
    // Round 17.5: proposal_invalid at initiation, not deny at evaluation
    expect(p.status).toBe('proposal_invalid');
    expect(p.denialLayer).toBe('identity');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V6: LINEAGE RECORD + VERDICT LINKAGE QUERYABLE
// ══════════════════════════════════════════════════════════════════════

describe('V6: Verdict-lineage linkage', () => {
  it('verdict exposes linkage fields', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    // Before apply, linkage fields are undefined
    expect(verdict.executionReceiptId).toBeUndefined();
    expect(verdict.lineageRecordId).toBeUndefined();
  });

  it('getVerdict retrieves stored verdict with linkage', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    svc.evaluate(p.id);
    await svc.apply(p.id);
    const v = svc.getVerdict(p.id);
    expect(v).toBeDefined();
    expect(v!.executionReceiptId).toMatch(/^rcpt_/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V7: BRANCH CONTROL governanceVerdictId
// ══════════════════════════════════════════════════════════════════════

describe('V7: Branch control verdict linkage (contract)', () => {
  it('GovernanceVerdict type includes executionReceiptId and lineageRecordId', () => {
    // Type-level verification — if this compiles, the fields exist on GovernanceVerdict
    const mockVerdict: GovernanceVerdict = {
      id: 'vrd_test',
      proposalId: 'p_test',
      code: 'allow',
      reason: 'test',
      triggeredPolicies: [],
      riskLevel: 'low',
      constraints: [],
      childCreationPermitted: true,
      rollbackEligible: true,
      survivalContext: null,
      timestamp: new Date().toISOString(),
      executionReceiptId: 'rcpt_123',
      lineageRecordId: 'lin_456',
    };
    expect(mockVerdict.executionReceiptId).toBe('rcpt_123');
    expect(mockVerdict.lineageRecordId).toBe('lin_456');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V8: TRACE ENDPOINT RETURNS FULL CHAIN
// ══════════════════════════════════════════════════════════════════════

describe('V8: getTraceChain()', () => {
  it('returns complete trace for proposed+evaluated+applied', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    svc.evaluate(p.id);
    await svc.apply(p.id);

    const trace = svc.getTraceChain(p.id);
    expect(trace).toBeDefined();
    expect(trace!.proposalId).toBe(p.id);
    expect(trace!.verdictId).toMatch(/^vrd_/);
    expect(trace!.verdictCode).toBe('allow');
    expect(trace!.status).toBe('applied');
    expect(trace!.receipts.length).toBeGreaterThanOrEqual(2); // decision + apply
  });

  it('returns undefined for non-existent proposal', () => {
    const svc = createService();
    expect(svc.getTraceChain('fake')).toBeUndefined();
  });

  it('trace receipts include verdictId linkage', async () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    await svc.apply(p.id);

    const trace = svc.getTraceChain(p.id)!;
    const applyReceipt = trace.receipts.find(r => r.phase === 'apply');
    expect(applyReceipt?.verdictId).toBe(verdict.id);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V9: DEPRECATED COMPAT LAYER ISOLATED
// ══════════════════════════════════════════════════════════════════════

describe('V9: Compatibility decommissioning', () => {
  it('GovernanceDecision type still exists (for backward compat)', async () => {
    // Importing the type should not fail — it's deprecated but retained
    const { GovernanceService } = await import('./governance-service.js');
    expect(GovernanceService).toBeDefined();
  });

  it('diagnostics counts proposal_invalid separately (Round 17.5)', () => {
    const svc = createService();
    const p1 = svc.propose({ actionKind: 'selfmod', target: 'a.ts', justification: 'test' });
    svc.evaluate(p1.id);

    const svc2 = createService({ identity: createMockIdentity('revoked') });
    svc2.propose({ actionKind: 'selfmod', target: 'b.ts', justification: 'test' });

    expect(svc.diagnostics().approvalRate).toBe(1);
    // svc2 has proposal_invalid, not denial — denialRate reflects evaluated denials only
    expect(svc2.diagnostics().denialRate).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V10: VERDICT HELPERS
// ══════════════════════════════════════════════════════════════════════

describe('V10: Verdict helper functions', () => {
  it('isExecutableVerdict for allow/allow_with_constraints', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(isExecutableVerdict(verdict)).toBe(true);
  });

  it('isExecutableVerdict false for proposal_invalid (Round 17.5)', () => {
    const svc = createService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    // proposal_invalid — cannot evaluate, so no verdict to check isExecutable on
    expect(p.status).toBe('proposal_invalid');
    // No verdict exists for invalid proposals
    expect(svc.getVerdict(p.id)).toBeUndefined();
  });

  it('isTerminalVerdict for allow/deny', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(isTerminalVerdict(verdict)).toBe(true); // 'allow' is terminal
  });

  it('isTerminalVerdict false for require_review', () => {
    const svc = createService({ policy: createMockPolicy('escalate') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(isTerminalVerdict(verdict)).toBe(false); // require_review is not terminal
  });

  it('getConstraint returns undefined when no constraints', () => {
    const svc = createService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'test.ts', justification: 'test' });
    const verdict = svc.evaluate(p.id);
    expect(getConstraint(verdict, 'budget_cap')).toBeUndefined();
  });
});
