/**
 * LineageGovernanceBridge — Unit Tests
 *
 * Tests the reactive feedback loop between lineage lifecycle events
 * and upstream systems (governance audit, economic funding, health).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LineageGovernanceBridge } from './lineage-governance-bridge.js';
import type {
  GovernanceAuditSink,
  EconomicFundingRecovery,
} from './lineage-governance-bridge.js';
import type { LineageRecord, ChildRuntimeStatus } from './lineage-contract.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<LineageRecord> = {}): LineageRecord {
  return {
    id: 'lin_1',
    parentId: 'parent-agent',
    childId: 'child-agent',
    spec: {
      name: 'test-child',
      task: 'do-work',
      genesisPrompt: 'work hard',
      fundingCents: 1000,
      parentId: 'parent-agent',
      proposalId: 'prop_1',
    },
    status: 'active',
    fundingLease: {
      id: 'lease_1',
      childId: 'child-agent',
      budgetCapCents: 1000,
      spentCents: 300,
      status: 'active',
      grantedAt: '2026-01-01T00:00:00Z',
    },
    identitySummary: {
      fingerprint: 'child-fp',
      parentFingerprint: 'parent-fp',
      lineageRoot: 'root-fp',
      generation: 1,
      inheritedFields: [],
      derivedFields: [],
      excludedFields: [],
    },
    inheritanceScope: {
      depth: 1,
      maxDepth: 5,
      capabilityWhitelist: [],
      capabilityBlacklist: [],
      inheritancePolicy: 'selective',
    },
    proposalId: 'prop_1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as LineageRecord;
}

function createMocks() {
  const audit: GovernanceAuditSink = {
    recordLineageEvent: vi.fn(),
  };
  const recovery: EconomicFundingRecovery = {
    recoverFunding: vi.fn(),
  };
  return { audit, recovery };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('LineageGovernanceBridge', () => {
  let bridge: LineageGovernanceBridge;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    bridge = new LineageGovernanceBridge(mocks.audit, mocks.recovery);
  });

  it('records governance audit on lifecycle event', () => {
    bridge.processLifecycleEvent(makeRecord(), 'active', 'degraded', 'health drop');
    expect(mocks.audit.recordLineageEvent).toHaveBeenCalledTimes(1);
    const event = vi.mocked(mocks.audit.recordLineageEvent).mock.calls[0]![0];
    expect(event.kind).toBe('child_degraded');
    expect(event.previousStatus).toBe('active');
    expect(event.newStatus).toBe('degraded');
  });

  it('recovers funding on terminal transition', () => {
    const record = makeRecord(); // 1000 budget, 300 spent → 700 remaining
    bridge.processLifecycleEvent(record, 'active', 'terminated', 'done');

    expect(mocks.recovery.recoverFunding).toHaveBeenCalledWith(
      'parent-agent', 700, expect.stringContaining('terminated'),
    );
  });

  it('does NOT recover funding on non-terminal transition', () => {
    bridge.processLifecycleEvent(makeRecord(), 'active', 'degraded', 'health drop');
    expect(mocks.recovery.recoverFunding).not.toHaveBeenCalled();
  });

  it('recovers funding on recalled status', () => {
    const effect = bridge.processLifecycleEvent(makeRecord(), 'active', 'recalled', 'parent recall');
    expect(effect.fundingReleased).toBe(true);
    expect(effect.fundingReleasedCents).toBe(700);
  });

  it('frees concurrency slot on terminal status', () => {
    const effect = bridge.processLifecycleEvent(makeRecord(), 'active', 'terminated', 'done');
    expect(effect.concurrencySlotFreed).toBe(true);
  });

  it('frees concurrency slot on orphaned status', () => {
    const effect = bridge.processLifecycleEvent(makeRecord(), 'active', 'orphaned', 'lost');
    expect(effect.concurrencySlotFreed).toBe(true);
  });

  it('does NOT free concurrency slot on degraded status', () => {
    const effect = bridge.processLifecycleEvent(makeRecord(), 'active', 'degraded', 'slow');
    expect(effect.concurrencySlotFreed).toBe(false);
  });

  it('tracks health snapshot correctly', () => {
    // Activate a child
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_1' }), 'creating', 'active', 'started');
    expect(bridge.getHealthSnapshot().activeChildren).toBe(1);
    expect(bridge.getHealthSnapshot().healthScore).toBe(100);

    // Degrade it
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_1' }), 'active', 'degraded', 'slow');
    expect(bridge.getHealthSnapshot().activeChildren).toBe(0);
    expect(bridge.getHealthSnapshot().degradedChildren).toBe(1);
    expect(bridge.getHealthSnapshot().healthScore).toBe(0); // 1/1 degraded

    // Terminate it
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_1' }), 'degraded', 'terminated', 'done');
    expect(bridge.getHealthSnapshot().degradedChildren).toBe(0);
    expect(bridge.getHealthSnapshot().healthScore).toBe(100);
  });

  it('tracks cumulative stats', () => {
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_1' }), 'creating', 'active', 'ok');
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_1' }), 'active', 'terminated', 'done');
    bridge.processLifecycleEvent(makeRecord({ id: 'lin_2' }), 'creating', 'active', 'ok');

    const stats = bridge.stats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.terminalEvents).toBe(1);
    expect(stats.totalFundingRecovered).toBe(700);
  });

  it('classifies funding_exhausted events', () => {
    const record = makeRecord();
    record.fundingLease.status = 'exhausted';
    record.fundingLease.spentCents = 1000;

    bridge.processLifecycleEvent(record, 'active', 'terminated', 'out of funds');
    const event = vi.mocked(mocks.audit.recordLineageEvent).mock.calls[0]![0];
    expect(event.kind).toBe('funding_exhausted');
  });

  it('stores event and effect history', () => {
    bridge.processLifecycleEvent(makeRecord(), 'active', 'degraded', 'test');
    expect(bridge.getEvents()).toHaveLength(1);
    expect(bridge.getEffects()).toHaveLength(1);
  });
});
