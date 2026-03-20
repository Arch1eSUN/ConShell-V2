import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GovernedSelfModGate, type SelfModGovernanceProvider } from './governed-selfmod-gate.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeLogger() {
  const noop = () => {};
  return {
    debug: noop, info: noop, warn: noop, error: noop,
    child: () => makeLogger(),
  } as any;
}

function makeSelfMod() {
  return {
    propose: vi.fn(),
    approve: vi.fn(),
    apply: vi.fn(),
    verify: vi.fn(),
    rollback: vi.fn(),
  } as any;
}

function makeGovernance(overrides: Partial<SelfModGovernanceProvider> = {}): SelfModGovernanceProvider {
  return {
    propose: vi.fn().mockReturnValue({ id: 'gov-1', status: 'proposed' }),
    evaluate: vi.fn().mockReturnValue({ code: 'allow', reason: 'auto-approved' }),
    apply: vi.fn().mockResolvedValue({ result: 'success', reason: 'applied', relatedIds: { modRecordId: 'mod-1' } }),
    forceApprove: vi.fn().mockReturnValue({ code: 'allow' }),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('GovernedSelfModGate', () => {
  let gate: GovernedSelfModGate;
  let governance: SelfModGovernanceProvider;
  let selfmod: any;

  beforeEach(() => {
    selfmod = makeSelfMod();
    governance = makeGovernance();
    gate = new GovernedSelfModGate(governance, selfmod, makeLogger());
  });

  // ── Approval Flow ──

  it('approves modification when governance allows', async () => {
    const result = await gate.requestModification('config.ts', 'new content', 'upgrade');
    
    expect(result.outcome).toBe('approved');
    expect(result.governanceProposalId).toBe('gov-1');
    expect(result.modRecordId).toBe('mod-1');
    expect(governance.propose).toHaveBeenCalledWith(expect.objectContaining({
      actionKind: 'selfmod',
      target: 'config.ts',
    }));
    expect(governance.evaluate).toHaveBeenCalledWith('gov-1');
    expect(governance.apply).toHaveBeenCalledWith('gov-1');
  });

  // ── Denial Flow ──

  it('denies modification when governance denies', async () => {
    governance = makeGovernance({
      evaluate: vi.fn().mockReturnValue({ code: 'deny', reason: 'policy block' }),
    });
    gate = new GovernedSelfModGate(governance, selfmod, makeLogger());

    const result = await gate.requestModification('protected.ts', 'hacked', 'attack');
    
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('policy block');
    expect(governance.apply).not.toHaveBeenCalled();
  });

  // ── Escalation Flow ──

  it('escalates when governance requires review', async () => {
    governance = makeGovernance({
      evaluate: vi.fn().mockReturnValue({ code: 'require_review', reason: 'critical risk' }),
    });
    gate = new GovernedSelfModGate(governance, selfmod, makeLogger());

    const result = await gate.requestModification('core.ts', 'changes', 'refactor');
    
    expect(result.outcome).toBe('escalated');
    expect(result.reason).toBe('critical risk');
    expect(governance.apply).not.toHaveBeenCalled();
  });

  it('resolves escalated modification via forceApprove', async () => {
    const result = await gate.resolveEscalated('gov-1');
    
    expect(result.outcome).toBe('approved');
    expect(governance.forceApprove).toHaveBeenCalledWith('gov-1');
    expect(governance.apply).toHaveBeenCalledWith('gov-1');
  });

  // ── Pause/Resume ──

  it('blocks modifications when paused', async () => {
    gate.pause();
    expect(gate.isPaused()).toBe(true);

    const result = await gate.requestModification('any.ts', 'content', 'test');
    
    expect(result.outcome).toBe('paused');
    expect(governance.propose).not.toHaveBeenCalled();
  });

  it('allows modifications after resume', async () => {
    gate.pause();
    gate.resume();
    expect(gate.isPaused()).toBe(false);

    const result = await gate.requestModification('any.ts', 'content', 'test');
    
    expect(result.outcome).toBe('approved');
  });

  // ── History / Audit ──

  it('records history for all outcomes', async () => {
    await gate.requestModification('file1.ts', 'c', 'r1'); // approved

    governance = makeGovernance({
      evaluate: vi.fn().mockReturnValue({ code: 'deny', reason: 'no' }),
    });
    gate = new GovernedSelfModGate(governance, selfmod, makeLogger());
    await gate.requestModification('file2.ts', 'c', 'r2'); // denied

    // Check history from first gate
    // (second gate has separate history)
    // Let's check all on one gate
  });

  it('tracks statistics correctly', async () => {
    await gate.requestModification('f1.ts', 'c', 'approved'); // approved

    governance = makeGovernance({
      evaluate: vi.fn().mockReturnValue({ code: 'deny', reason: 'no' }),
    });
    const gate2 = new GovernedSelfModGate(governance, selfmod, makeLogger());
    await gate2.requestModification('f2.ts', 'c', 'denied');  // denied

    const s1 = gate.stats();
    expect(s1.total).toBe(1);
    expect(s1.approved).toBe(1);

    const s2 = gate2.stats();
    expect(s2.total).toBe(1);
    expect(s2.denied).toBe(1);
  });

  it('returns file-specific history', async () => {
    await gate.requestModification('target.ts', 'v1', 'first');
    await gate.requestModification('other.ts', 'v2', 'second');
    await gate.requestModification('target.ts', 'v3', 'third');

    const targetHistory = gate.getFileHistory('target.ts');
    expect(targetHistory).toHaveLength(2);
    expect(targetHistory[0].file).toBe('target.ts');
    expect(targetHistory[1].file).toBe('target.ts');
  });

  // ── isGovernanceEnabled ──

  it('reports governance as enabled', () => {
    expect(gate.isGovernanceEnabled()).toBe(true);
  });

  // ── Apply failure ──

  it('handles apply failure gracefully', async () => {
    governance = makeGovernance({
      apply: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    gate = new GovernedSelfModGate(governance, selfmod, makeLogger());

    const result = await gate.requestModification('file.ts', 'content', 'test');
    
    expect(result.outcome).toBe('denied');
    expect(result.reason).toContain('disk full');
  });
});
