/**
 * Round 20.1 — Governance Inbox Tests
 */
import { describe, it, expect } from 'vitest';
import { GovernanceInbox } from './governance-inbox.js';
import { GovernanceService, type GovernanceServiceOptions } from './governance-service.js';

// ── Helpers ─────────────────────────────────────────────────────────

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
} as any;

function makeGovernanceService(): GovernanceService {
  const opts: GovernanceServiceOptions = {
    identity: {
      status: () => 'active' as any,
      selfFingerprint: () => 'fp-test',
    },
    policy: {
      evaluate: () => ({ decision: 'allow' as any, rule: 'test-rule', reason: 'OK', category: 'constitution' as any }),
    },
    economic: {
      survivalTier: () => 'normal',
      isEmergency: () => false,
      mustPreserveActive: () => false,
      currentBalanceCents: () => 50_000,
      canAcceptAction: () => ({ allowed: true }),
    } as any,
    logger: noopLogger,
  };
  return new GovernanceService(opts);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('GovernanceInbox', () => {
  it('returns empty inbox when no pending proposals', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    const result = inbox.getInbox();
    expect(result.totalCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('collects replication proposals as spawn category', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    gov.propose({
      actionKind: 'replication',
      target: 'child-worker-1',
      justification: 'Need worker for indexing',
      expectedCostCents: 500,
    });

    const result = inbox.getInbox();
    expect(result.totalCount).toBe(1);
    expect(result.items[0].category).toBe('spawn');
    expect(result.items[0].actionKind).toBe('replication');
  });

  it('collects selfmod proposals as blocked category', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    gov.propose({
      actionKind: 'selfmod',
      target: 'core/engine.ts',
      justification: 'Improve performance',
    });

    const result = inbox.getInbox();
    expect(result.totalCount).toBe(1);
    expect(result.items[0].category).toBe('blocked');
  });

  it('includes escalated (deferred) proposals as hold', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    // Create a non-replication/non-selfmod proposal and defer it
    const proposal = gov.propose({
      actionKind: 'external_declaration',
      target: 'announcement',
      justification: 'Public notice',
    });

    gov.deferProposal(proposal.id, 'Wait for review');

    const result = inbox.getInbox();
    expect(result.totalCount).toBe(1);
    expect(result.items[0].category).toBe('hold');
    expect(result.items[0].status).toBe('escalated');
  });

  it('filters by category', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    gov.propose({ actionKind: 'replication', target: 'child-1', justification: 'spawn' });
    gov.propose({ actionKind: 'selfmod', target: 'file.ts', justification: 'mod' });

    const onlySpawn = inbox.getInbox({ category: 'spawn' });
    expect(onlySpawn.totalCount).toBe(1);
    expect(onlySpawn.items[0].category).toBe('spawn');

    const onlyBlocked = inbox.getInbox({ category: 'blocked' });
    expect(onlyBlocked.totalCount).toBe(1);
    expect(onlyBlocked.items[0].category).toBe('blocked');
  });

  it('sorts critical items first', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    gov.propose({ actionKind: 'replication', target: 'low-risk', justification: 'worker' });
    gov.propose({ actionKind: 'dangerous_action', target: 'critical-op', justification: 'urgent' });

    const result = inbox.getInbox();
    // dangerous_action has critical risk level, should sort first
    expect(result.items[0].priority).toBe('critical');
  });

  it('counts urgent and category breakdown', () => {
    const gov = makeGovernanceService();
    const inbox = new GovernanceInbox(gov);

    gov.propose({ actionKind: 'replication', target: 'a', justification: 'spawn' });
    gov.propose({ actionKind: 'fund_child', target: 'b', justification: 'fund' });
    gov.propose({ actionKind: 'dangerous_action', target: 'c', justification: 'danger' });

    const result = inbox.getInbox();
    expect(result.totalCount).toBe(3);
    expect(result.countByCategory['spawn']).toBe(2); // replication + fund_child
    expect(result.countByCategory['blocked']).toBe(1);
  });
});
