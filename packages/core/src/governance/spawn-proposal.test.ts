/**
 * Round 20.1 — Spawn Proposal Contract + GovernanceService spawn integration tests
 */
import { describe, it, expect } from 'vitest';
import {
  createSpawnProposal,
  createSpawnOutcome,
  extractSpawnPayload,
  validateSpawnPayload,
  type SpawnProposalPayload,
} from './spawn-proposal-contract.js';
import { GovernanceService, type GovernanceServiceOptions } from './governance-service.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeSpawnPayload(overrides: Partial<SpawnProposalPayload> = {}): SpawnProposalPayload {
  return {
    why: overrides.why ?? 'Need worker for data indexing',
    targetWork: overrides.targetWork ?? 'Index 1000 documents',
    budgetCents: overrides.budgetCents ?? 500,
    maxDurationMs: overrides.maxDurationMs ?? 300_000,
    expectedUtilityCents: overrides.expectedUtilityCents ?? 1500,
    childRole: overrides.childRole ?? 'worker',
    riskLevel: overrides.riskLevel ?? 'low',
    childName: overrides.childName ?? 'indexer-child-1',
    genesisPrompt: overrides.genesisPrompt ?? 'You are a document indexer.',
    parentId: overrides.parentId ?? 'root-agent',
    canSubSpawn: overrides.canSubSpawn ?? false,
    resourceConstraints: overrides.resourceConstraints,
  };
}

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

describe('SpawnProposalContract', () => {
  describe('createSpawnProposal', () => {
    it('creates a valid ProposalInput from SpawnProposalPayload', () => {
      const payload = makeSpawnPayload();
      const input = createSpawnProposal(payload);

      expect(input.actionKind).toBe('replication');
      expect(input.target).toBe('indexer-child-1');
      expect(input.justification).toBe('Need worker for data indexing');
      expect(input.expectedCostCents).toBe(500);
      expect(input.payload?.['spawnPayload']).toBeDefined();
    });

    it('embeds the full payload for downstream extraction', () => {
      const payload = makeSpawnPayload({ childRole: 'specialist' });
      const input = createSpawnProposal(payload);
      const extracted = extractSpawnPayload(input.payload);

      expect(extracted).toBeDefined();
      expect(extracted!.childRole).toBe('specialist');
      expect(extracted!.canSubSpawn).toBe(false);
    });
  });

  describe('createSpawnOutcome', () => {
    it('initializes outcome with created status', () => {
      const outcome = createSpawnOutcome('prop-1', 'child-1', 500);

      expect(outcome.proposalId).toBe('prop-1');
      expect(outcome.childId).toBe('child-1');
      expect(outcome.status).toBe('created');
      expect(outcome.budgetUsedCents).toBe(0);
      expect(outcome.budgetAllocatedCents).toBe(500);
      expect(outcome.revenueGeneratedCents).toBe(0);
    });
  });

  describe('extractSpawnPayload', () => {
    it('returns undefined for non-spawn payload', () => {
      expect(extractSpawnPayload(undefined)).toBeUndefined();
      expect(extractSpawnPayload({})).toBeUndefined();
      expect(extractSpawnPayload({ foo: 'bar' })).toBeUndefined();
    });

    it('extracts valid spawn payload', () => {
      const payload = makeSpawnPayload();
      const input = createSpawnProposal(payload);
      const extracted = extractSpawnPayload(input.payload);
      expect(extracted?.childName).toBe('indexer-child-1');
    });
  });

  describe('validateSpawnPayload', () => {
    it('returns no errors for valid payload', () => {
      const errors = validateSpawnPayload(makeSpawnPayload());
      expect(errors).toHaveLength(0);
    });

    it('catches missing childName', () => {
      const errors = validateSpawnPayload(makeSpawnPayload({ childName: '' }));
      expect(errors).toContain('childName is required');
    });

    it('catches negative budget', () => {
      const errors = validateSpawnPayload(makeSpawnPayload({ budgetCents: -10 }));
      expect(errors).toContain('budgetCents must be non-negative');
    });

    it('catches zero maxDuration', () => {
      const errors = validateSpawnPayload(makeSpawnPayload({ maxDurationMs: 0 }));
      expect(errors).toContain('maxDurationMs must be positive');
    });

    it('catches multiple errors at once', () => {
      const errors = validateSpawnPayload(makeSpawnPayload({
        childName: '',
        why: '',
        genesisPrompt: '',
      }));
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('GovernanceService — Spawn Outcome Tracking', () => {
  it('tracks and updates spawn outcome', () => {
    const gov = makeGovernanceService();

    // Create a replication proposal
    const payload = makeSpawnPayload();
    const input = createSpawnProposal(payload);
    const proposal = gov.propose(input);

    // Auto-create outcome via updateSpawnOutcome
    const outcome = gov.updateSpawnOutcome(proposal.id, { status: 'running' });
    expect(outcome.status).toBe('running');
    expect(outcome.startedAt).toBeDefined();
    expect(outcome.proposalId).toBe(proposal.id);

    // Complete the outcome
    const completed = gov.updateSpawnOutcome(proposal.id, {
      status: 'completed',
      budgetUsedCents: 350,
      resultSummary: 'Indexed 1000 documents successfully',
      revenueGeneratedCents: 1200,
    });

    expect(completed.status).toBe('completed');
    expect(completed.budgetUsedCents).toBe(350);
    expect(completed.revenueGeneratedCents).toBe(1200);
    expect(completed.completedAt).toBeDefined();
  });

  it('retrieves spawn outcome by proposalId', () => {
    const gov = makeGovernanceService();
    const proposal = gov.propose(createSpawnProposal(makeSpawnPayload()));

    gov.updateSpawnOutcome(proposal.id, { status: 'created' });
    const outcome = gov.getSpawnOutcome(proposal.id);
    expect(outcome).toBeDefined();
    expect(outcome!.status).toBe('created');
  });

  it('lists spawn outcomes with filter', () => {
    const gov = makeGovernanceService();
    const p1 = gov.propose(createSpawnProposal(makeSpawnPayload({ childName: 'a' })));
    const p2 = gov.propose(createSpawnProposal(makeSpawnPayload({ childName: 'b' })));

    gov.updateSpawnOutcome(p1.id, { status: 'running' });
    gov.updateSpawnOutcome(p2.id, { status: 'completed' });

    const running = gov.listSpawnOutcomes({ status: 'running' });
    expect(running.length).toBe(1);

    const all = gov.listSpawnOutcomes();
    expect(all.length).toBe(2);
  });

  it('throws when updating non-replication proposal', () => {
    const gov = makeGovernanceService();
    const proposal = gov.propose({
      actionKind: 'selfmod',
      target: 'test.ts',
      justification: 'test',
    });

    expect(() => gov.updateSpawnOutcome(proposal.id, { status: 'running' })).toThrow();
  });
});

describe('GovernanceService — Proposal Lifecycle Extensions', () => {
  it('defers a proposed proposal', () => {
    const gov = makeGovernanceService();
    const proposal = gov.propose(createSpawnProposal(makeSpawnPayload()));

    const deferred = gov.deferProposal(proposal.id, 'Insufficient budget');
    expect(deferred.status).toBe('escalated');
    expect(deferred.denialReason).toContain('DEFERRED');
    expect(deferred.denialReason).toContain('Insufficient budget');
  });

  it('expires a proposal', () => {
    const gov = makeGovernanceService();
    const proposal = gov.propose(createSpawnProposal(makeSpawnPayload()));

    const expired = gov.expireProposal(proposal.id, 'Timed out after 24h');
    expect(expired.status).toBe('denied');
    expect(expired.denialReason).toContain('EXPIRED');
  });

  it('cannot expire a terminal proposal', () => {
    const gov = makeGovernanceService();
    const proposal = gov.propose(createSpawnProposal(makeSpawnPayload()));

    // Expire it once
    gov.expireProposal(proposal.id);

    // Cannot expire again (now in terminal 'denied' status)
    expect(() => gov.expireProposal(proposal.id)).toThrow('Cannot expire terminal proposal');
  });
});
