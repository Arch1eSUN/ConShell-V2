/**
 * AgentPostureService — Unit Tests
 *
 * Tests unified truth surface posture aggregation,
 * health scoring, and verdict classification.
 * Covers all 6 canonical dimensions: identity, economic, lineage, collective, governance, agenda.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentPostureService } from './agent-posture-service.js';
import type {
  IdentityPostureProvider,
  EconomicPostureProvider,
  LineagePostureProvider,
  CollectivePostureProvider,
  GovernancePostureProvider,
  AgendaPostureProvider,
} from './agent-posture-service.js';

// ── Mock Providers ──────────────────────────────────────────────────

function makeProviders(overrides: {
  identity?: Partial<ReturnType<IdentityPostureProvider['getPosture']>>;
  economic?: Partial<ReturnType<EconomicPostureProvider['getPosture']>>;
  lineage?: Partial<ReturnType<LineagePostureProvider['getPosture']>>;
  collective?: Partial<ReturnType<CollectivePostureProvider['getPosture']>>;
  governance?: Partial<ReturnType<GovernancePostureProvider['getPosture']>>;
  agenda?: Partial<ReturnType<AgendaPostureProvider['getPosture']>>;
} = {}) {
  return {
    identity: {
      getPosture: () => ({
        mode: 'restart',
        chainValid: true,
        chainLength: 5,
        soulDrifted: false,
        fingerprint: 'fp-123',
        ...overrides.identity,
      }),
    },
    economic: {
      getPosture: () => ({
        survivalTier: 'normal',
        balanceCents: 10000,
        burnRateCentsPerDay: 100,
        runwayDays: 100,
        profitabilityRatio: 1.5,
        ...overrides.economic,
      }),
    },
    lineage: {
      getPosture: () => ({
        activeChildren: 2,
        degradedChildren: 0,
        totalFundingAllocated: 5000,
        totalFundingSpent: 2000,
        healthScore: 100,
        ...overrides.lineage,
      }),
    },
    collective: {
      getPosture: () => ({
        totalPeers: 3,
        trustedPeers: 2,
        degradedPeers: 0,
        delegationSuccessRate: 0.9,
        ...overrides.collective,
      }),
    },
    governance: {
      getPosture: () => ({
        pendingProposals: 0,
        recentVerdicts: 5,
        selfModQuarantined: false,
        ...overrides.governance,
      }),
    },
    agenda: {
      getPosture: () => ({
        scheduled: 2,
        deferred: 0,
        active: 1,
        blocked: 0,
        nextCommitmentHint: 'test-commitment',
        priorityReason: 'nominal',
        ...overrides.agenda,
      }),
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('AgentPostureService', () => {
  it('produces a healthy snapshot when all systems are nominal', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders());
    const posture = svc.snapshot();

    expect(posture.agentId).toBe('agent-1');
    expect(posture.version).toBe('1.0.0');
    expect(posture.overallHealthScore).toBe(100);
    expect(posture.healthVerdict).toBe('healthy');
    expect(posture.identity.chainValid).toBe(true);
    expect(posture.economic.survivalTier).toBe('normal');
  });

  it('degrades health when identity chain is broken', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      identity: { chainValid: false },
    }));
    const posture = svc.snapshot();
    expect(posture.overallHealthScore).toBe(70); // -30
    expect(posture.healthVerdict).toBe('degraded');
  });

  it('degrades health for critical survival tier', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      economic: { survivalTier: 'critical', runwayDays: 5 },
    }));
    const posture = svc.snapshot();
    expect(posture.overallHealthScore).toBe(70); // -25 critical + -5 runway
    expect(posture.healthVerdict).toBe('degraded');
  });

  it('goes terminal for dead survival tier + broken chain', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      identity: { chainValid: false, mode: 'degraded' },
      economic: { survivalTier: 'dead', runwayDays: 0 },
    }));
    const posture = svc.snapshot();
    // -30 chain + -10 soul + -20 mode + -40 dead + -15 runway
    expect(posture.overallHealthScore).toBeLessThanOrEqual(5);
    expect(posture.healthVerdict).toBe('terminal');
  });

  it('penalizes degraded children', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      lineage: { degradedChildren: 3, healthScore: 40 },
    }));
    const posture = svc.snapshot();
    // -10 (health < 50) + -15 (3 degraded × 5)
    expect(posture.overallHealthScore).toBe(75);
  });

  it('penalizes self-mod quarantine', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      governance: { selfModQuarantined: true },
    }));
    const posture = svc.snapshot();
    expect(posture.overallHealthScore).toBe(85); // -15
    expect(posture.healthVerdict).toBe('healthy');
  });

  it('penalizes low delegation success rate', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      collective: { delegationSuccessRate: 0.3, totalPeers: 5, degradedPeers: 3 },
    }));
    const posture = svc.snapshot();
    // -10 (low rate) + -5 (>2 degraded)
    expect(posture.overallHealthScore).toBe(85);
  });

  it('returns latest without recomputing', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders());
    expect(svc.latest()).toBeNull();

    const snap = svc.snapshot();
    expect(svc.latest()).toBe(snap);
  });

  it('maintains bounded history', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders());
    for (let i = 0; i < 60; i++) {
      svc.snapshot();
    }
    expect(svc.history().length).toBe(50);
  });

  it('tracks history for trend analysis', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders());
    svc.snapshot();
    svc.snapshot();
    svc.snapshot();
    expect(svc.history()).toHaveLength(3);
  });

  // ── Agenda-specific tests (Round 19.8/19.9) ────────────────────────

  it('penalizes blocked commitments', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      agenda: { blocked: 2 },
    }));
    const posture = svc.snapshot();
    // -5 × 2 blocked = -10
    expect(posture.overallHealthScore).toBe(90);
    expect(posture.agenda.blocked).toBe(2);
  });

  it('penalizes when deferred exceeds scheduled', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      agenda: { deferred: 5, scheduled: 2 },
    }));
    const posture = svc.snapshot();
    // -5 (deferred > scheduled && scheduled > 0)
    expect(posture.overallHealthScore).toBe(95);
    expect(posture.agenda.deferred).toBe(5);
  });

  it('caps blocked penalty at 3 items', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders({
      agenda: { blocked: 10 },
    }));
    const posture = svc.snapshot();
    // -5 × min(10, 3) = -15
    expect(posture.overallHealthScore).toBe(85);
  });

  // ── Contract shape test (G2: Contract Discipline) ──────────────────

  it('snapshot contains all 6 canonical truth dimensions', () => {
    const svc = new AgentPostureService('agent-1', '1.0.0', makeProviders());
    const posture = svc.snapshot();

    // All 6 dimensions must be present and typed
    expect(posture).toHaveProperty('identity');
    expect(posture).toHaveProperty('economic');
    expect(posture).toHaveProperty('lineage');
    expect(posture).toHaveProperty('collective');
    expect(posture).toHaveProperty('governance');
    expect(posture).toHaveProperty('agenda');

    // Agenda shape contract
    expect(posture.agenda).toEqual(expect.objectContaining({
      scheduled: expect.any(Number),
      deferred: expect.any(Number),
      active: expect.any(Number),
      blocked: expect.any(Number),
      nextCommitmentHint: expect.any(String),
      priorityReason: expect.any(String),
    }));

    // Meta fields
    expect(posture).toHaveProperty('overallHealthScore');
    expect(posture).toHaveProperty('healthVerdict');
    expect(posture).toHaveProperty('agentId');
    expect(posture).toHaveProperty('timestamp');
    expect(posture).toHaveProperty('version');
  });
});
