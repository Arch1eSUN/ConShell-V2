/**
 * Round 16.7 Test Suite — Peer Discovery, Reputation, Selector, Staleness, Delegation Loop
 *
 * Tests for:
 * - Discovery contract types
 * - Reputation contract types and ReputationService
 * - StalenessPolicy evaluation
 * - PeerSelector ranking and explainability
 * - PeerDiscoveryService provider management
 * - Delegation → Reputation → Trust loop
 * - Trust model reputation dimension
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Reputation
import type { ReputationSummary, ReputationEvent } from './reputation-contract.js';
import { ReputationService } from './reputation-service.js';

// Staleness
import { StalenessPolicy, DEFAULT_STALENESS_CONFIG } from './staleness-policy.js';

// Selector
import { PeerSelector, SELECTION_WEIGHTS } from './peer-selector.js';

// Discovery
import {
  PeerDiscoveryService,
  ManualDiscoveryProvider,
  MockRegistryProvider,
} from './discovery-service.js';

// Trust model (updated)
import { computeTrust, TRUST_WEIGHTS, type TrustEvidence } from './trust-model.js';

// Collective service (delegation loop)
import { CollectiveService } from './collective-service.js';
import type { PeerRecord, PeerKind, PeerStatus } from './collective-contract.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeLogger(): any {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => makeLogger(),
  };
}

function makeService(): CollectiveService {
  return new CollectiveService({
    logger: makeLogger(),
    selfAgentId: 'root-agent',
    selfName: 'TestConShell',
  });
}

function makeServiceWithReputation(): { svc: CollectiveService; rep: ReputationService } {
  const rep = new ReputationService({ logger: makeLogger() });
  const svc = new CollectiveService({
    logger: makeLogger(),
    selfAgentId: 'root-agent',
    selfName: 'TestConShell',
    reputation: rep,
  });
  return { svc, rep };
}

function makePeerRecord(overrides: Partial<PeerRecord> = {}): PeerRecord {
  return {
    id: overrides.id ?? `peer_test_${Math.random().toString(36).slice(2, 8)}`,
    agentId: overrides.agentId ?? 'test-agent',
    name: overrides.name ?? 'TestPeer',
    kind: overrides.kind ?? 'external',
    status: overrides.status ?? 'provisional',
    source: overrides.source ?? 'manual',
    registeredAt: overrides.registeredAt ?? new Date().toISOString(),
    lastSeen: overrides.lastSeen ?? new Date().toISOString(),
    trust: overrides.trust ?? { overallScore: 0.5, tier: 'provisional', scores: [], evaluatedAt: '' },
    capabilities: overrides.capabilities ?? { declared: [], verified: [] },
    statusReason: overrides.statusReason,
    endpoint: overrides.endpoint,
  } as PeerRecord;
}

// ═══════════════════════════════════════════════════════════════════════
// REPUTATION SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('ReputationService (Round 16.7)', () => {
  let rep: ReputationService;

  beforeEach(() => {
    rep = new ReputationService({ logger: makeLogger() });
  });

  it('records events and accumulates history', () => {
    rep.recordEvent('peer-1', 'delegation_success', { task: 'test' });
    rep.recordEvent('peer-1', 'delegation_success', { task: 'test2' });
    rep.recordEvent('peer-1', 'delegation_failure', { task: 'test3' });
    const events = rep.getEvents('peer-1');
    expect(events).toHaveLength(3);
  });

  it('getReputation returns a summary with tier and trend', () => {
    rep.recordEvent('peer-1', 'delegation_success');
    rep.recordEvent('peer-1', 'delegation_success');
    const summary = rep.getReputation('peer-1');
    expect(summary).toBeDefined();
    expect(summary.tier).toBeDefined();
    expect(summary.trend).toBeDefined();
    expect(summary.overallScore).toBeGreaterThanOrEqual(0);
    expect(summary.overallScore).toBeLessThanOrEqual(1);
    expect(summary.totalEvents).toBe(2);
  });

  it('peer with no events gets neutral/empty summary', () => {
    const summary = rep.getReputation('unknown-peer');
    expect(summary.totalEvents).toBe(0);
    expect(summary.tier).toBe('neutral');
  });

  it('delegation failures lower reputation score', () => {
    const repGood = new ReputationService({ logger: makeLogger() });
    const repBad = new ReputationService({ logger: makeLogger() });

    for (let i = 0; i < 5; i++) repGood.recordEvent('p', 'delegation_success');
    for (let i = 0; i < 5; i++) repBad.recordEvent('p', 'delegation_failure');

    const goodScore = repGood.getReputation('p').overallScore;
    const badScore = repBad.getReputation('p').overallScore;
    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('health/compliance events affect scores', () => {
    rep.recordEvent('peer-1', 'health_check_pass');
    rep.recordEvent('peer-1', 'governance_compliance');
    const summary = rep.getReputation('peer-1');
    expect(summary.overallScore).toBeGreaterThan(0);
  });

  it('stats returns aggregate counts', () => {
    rep.recordEvent('a', 'delegation_success');
    rep.recordEvent('b', 'delegation_failure');
    const stats = rep.stats();
    expect(stats.totalPeersTracked).toBe(2);
    expect(stats.totalEvents).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STALENESS POLICY TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('StalenessPolicy (Round 16.7)', () => {
  it('has sensible defaults', () => {
    const policy = new StalenessPolicy();
    const thresholds = policy.getThresholds('external');
    expect(thresholds.degradedAfterSec).toBeGreaterThan(0);
    expect(thresholds.offlineAfterSec).toBeGreaterThan(thresholds.degradedAfterSec);
    expect(thresholds.quarantineAfterFailures).toBeGreaterThan(0);
  });

  it('fresh peer returns no-action', () => {
    const policy = new StalenessPolicy();
    const now = Date.now();
    const freshPeer = makePeerRecord({ kind: 'external', lastSeen: new Date(now - 10_000).toISOString() });
    const result = policy.evaluate(freshPeer, now);
    expect(result.action).toBe('none');
  });

  it('stale peer returns degrade', () => {
    const policy = new StalenessPolicy();
    const now = Date.now();
    // Default degrade threshold is 30min = 1800s, use 35min
    const stalePeer = makePeerRecord({ kind: 'external', lastSeen: new Date(now - (35 * 60_000)).toISOString() });
    const result = policy.evaluate(stalePeer, now);
    expect(['degrade', 'offline']).toContain(result.action);
  });

  it('very stale peer returns offline', () => {
    const policy = new StalenessPolicy();
    const now = Date.now();
    // Default offline threshold is 2h = 7200s, use 3h
    const veryStale = makePeerRecord({ kind: 'external', lastSeen: new Date(now - (3 * 3600_000)).toISOString() });
    const result = policy.evaluate(veryStale, now);
    expect(result.action).toBe('offline');
  });

  it('per-kind overrides work', () => {
    const policy = new StalenessPolicy({
      overrides: {
        child: {
          degradedAfterSec: 10,
          offlineAfterSec: 20,
          quarantineAfterFailures: 3,
        },
      },
    });
    const now = Date.now();
    // 15s ago → above child degrade (10s) but below offline (20s)
    const childPeer = makePeerRecord({ kind: 'child', lastSeen: new Date(now - 15_000).toISOString() });
    const result = policy.evaluate(childPeer, now);
    expect(result.action).toBe('degrade');
  });

  it('DEFAULT_STALENESS_CONFIG is exported', () => {
    expect(DEFAULT_STALENESS_CONFIG).toBeDefined();
    expect(DEFAULT_STALENESS_CONFIG.defaults).toBeDefined();
    expect(DEFAULT_STALENESS_CONFIG.defaults.degradedAfterSec).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PEER SELECTOR TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('PeerSelector (Round 16.7)', () => {
  it('returns empty result when no peers registered', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);
    const result = selector.select({});
    expect(result.candidates).toHaveLength(0);
    expect(result.totalConsidered).toBe(0);
  });

  it('ranks peers by combined score', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    svc.registerPeer({ agentId: 'b', name: 'B', kind: 'external', source: 'manual' });

    const result = selector.select({});
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    // Should be sorted descending by score
    if (result.candidates.length >= 2) {
      expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
    }
  });

  it('selectBest returns single top candidate', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    svc.registerPeer({ agentId: 'x', name: 'X', kind: 'external', source: 'manual' });
    const best = selector.selectBest({});
    expect(best).toBeDefined();
    expect(best!.peer.agentId).toBe('x');
    expect(best!.selectionReasons.length).toBeGreaterThan(0);
  });

  it('excludes quarantined and revoked peers', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    const p1 = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    svc.registerPeer({ agentId: 'b', name: 'B', kind: 'external', source: 'manual' });
    svc.quarantinePeer(p1.id, 'bad');

    const result = selector.select({});
    const ids = result.candidates.map(c => c.peer.id);
    expect(ids).not.toContain(p1.id);
    expect(result.excluded.length).toBeGreaterThanOrEqual(1);
  });

  it('SELECTION_WEIGHTS are exported', () => {
    expect(SELECTION_WEIGHTS).toBeDefined();
    const sum = Object.values(SELECTION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DISCOVERY SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('PeerDiscoveryService (Round 16.7)', () => {
  it('registers manual provider', () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    discovery.registerProvider(new ManualDiscoveryProvider());
    const stats = discovery.stats();
    expect(stats.registeredProviders).toContain('manual');
  });

  it('registers mock registry provider', () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    discovery.registerProvider(new MockRegistryProvider());
    const stats = discovery.stats();
    expect(stats.registeredProviders).toContain('registry');
  });

  it('discoverManual ingests a manual discovery event', () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    discovery.registerProvider(new ManualDiscoveryProvider());
    const event = discovery.discoverManual({
      agentId: 'discovered-1',
      name: 'DiscoveredAgent',
      endpoint: 'http://example.com',
      fingerprint: 'fp_disc_1',
      capabilities: ['search'],
    });

    expect(event).toBeDefined();

    // Should have registered a peer
    const peer = svc.getPeerByAgentId('discovered-1');
    expect(peer).toBeDefined();
    expect(peer!.kind).toBe('discovered');
  });

  it('stats returns event counts', () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });
    discovery.registerProvider(new ManualDiscoveryProvider());

    discovery.discoverManual({
      agentId: 'a-1', name: 'A1',
    });
    discovery.discoverManual({
      agentId: 'a-2', name: 'A2',
    });

    const stats = discovery.stats();
    expect(stats.totalEvents).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRUST MODEL + REPUTATION DIMENSION
// ═══════════════════════════════════════════════════════════════════════

describe('Trust Model — Reputation Dimension (Round 16.7)', () => {
  it('trust weights now include reputation and sum to 1.0', () => {
    expect(TRUST_WEIGHTS.reputation).toBeDefined();
    expect(TRUST_WEIGHTS.reputation).toBe(0.2);
    const sum = Object.values(TRUST_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('computeTrust now produces 6 dimension scores', () => {
    const t = computeTrust({});
    expect(t.scores).toHaveLength(6);
    const dims = t.scores.map(s => s.dimension);
    expect(dims).toContain('reputation');
  });

  it('no reputation summary → neutral 0.5 score', () => {
    const t = computeTrust({});
    const repScore = t.scores.find(s => s.dimension === 'reputation')!;
    expect(repScore.score).toBe(0.5);
    expect(repScore.reasons).toContain('No reputation history');
  });

  it('good reputation boosts trust score', () => {
    const noRep = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      isOnline: true,
    });

    const withRep = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      isOnline: true,
      reputationSummary: {
        overallScore: 0.95,
        tier: 'exemplary',
        trend: 'improving',
        totalEvents: 50,
        dimensions: {},
        lastUpdated: new Date().toISOString(),
      } as any,
    });

    expect(withRep.overallScore).toBeGreaterThan(noRep.overallScore);
  });

  it('bad reputation lowers trust score', () => {
    const noRep = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      isOnline: true,
    });

    const withBadRep = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      isOnline: true,
      reputationSummary: {
        overallScore: 0.15,
        tier: 'poor',
        trend: 'declining',
        totalEvents: 30,
        dimensions: {},
        lastUpdated: new Date().toISOString(),
      } as any,
    });

    expect(withBadRep.overallScore).toBeLessThan(noRep.overallScore);
  });

  it('low event count blends toward neutral', () => {
    const t = computeTrust({
      reputationSummary: {
        overallScore: 0.95,
        tier: 'exemplary',
        trend: 'stable',
        totalEvents: 2, // very low
        dimensions: {},
        lastUpdated: new Date().toISOString(),
      } as any,
    });
    const repScore = t.scores.find(s => s.dimension === 'reputation')!;
    // Should be less than raw 0.95 due to confidence blend
    expect(repScore.score).toBeLessThan(0.95);
    expect(repScore.reasons.some(r => r.includes('Low confidence'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DELEGATION → REPUTATION LOOP
// ═══════════════════════════════════════════════════════════════════════

describe('Delegation → Reputation Loop (Round 16.7)', () => {
  it('delegation success records positive reputation event', () => {
    const { svc, rep } = makeServiceWithReputation();
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const receipt = svc.delegateTask(peer.id, 'Test task');
    svc.handleDelegationResult(receipt.id, 'success');

    const events = rep.getEvents(peer.id);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('delegation_success');
  });

  it('delegation failure records negative reputation event', () => {
    const { svc, rep } = makeServiceWithReputation();
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const receipt = svc.delegateTask(peer.id, 'Test task');
    svc.handleDelegationResult(receipt.id, 'failure', 'Timed out');

    const events = rep.getEvents(peer.id);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('delegation_failure');
  });

  it('delegation timeout records timeout reputation event', () => {
    const { svc, rep } = makeServiceWithReputation();
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const receipt = svc.delegateTask(peer.id, 'Test task');
    svc.handleDelegationResult(receipt.id, 'timeout');

    const events = rep.getEvents(peer.id);
    expect(events[0].kind).toBe('delegation_timeout');
  });

  it('3+ consecutive failures auto-degrades trusted peer', () => {
    const { svc, rep } = makeServiceWithReputation();
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });

    // Promote to trusted first
    svc.updatePeerTrust(peer.id, {
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      isOnline: true,
      consecutiveHealthChecks: 20,
      declaredCapabilities: 3,
      verifiedCapabilities: 3,
      totalGovernedActions: 10,
      compliantActions: 10,
      totalFundingAllocated: 1000,
      totalFundingSpent: 200,
    });
    expect(svc.getPeer(peer.id)!.status).toBe('trusted');

    // Record exactly 3 failures — after 3 the peer auto-degrades.
    // With Round 16.8 delegation guard, the 4th delegateTask would reject degraded peers.
    for (let i = 0; i < 3; i++) {
      const r = svc.delegateTask(peer.id, `Failing task ${i}`);
      svc.handleDelegationResult(r.id, 'failure', 'Task failed');
    }

    // Should auto-degrade
    const updated = svc.getPeer(peer.id)!;
    expect(updated.status).toBe('degraded');
    expect(updated.statusReason).toContain('Auto-degraded');
  });

  it('without ReputationService, delegation works without loop', () => {
    const svc = makeService(); // no reputation injected
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const receipt = svc.delegateTask(peer.id, 'No rep task');
    // Should not throw
    expect(() => svc.handleDelegationResult(receipt.id, 'success')).not.toThrow();
  });

  it('setReputationService late-binds reputation', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });

    // No reputation initially
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const r1 = svc.delegateTask(peer.id, 'Before bind');
    svc.handleDelegationResult(r1.id, 'success');
    expect(rep.getEvents(peer.id)).toHaveLength(0); // not wired yet

    // Late-bind
    svc.setReputationService(rep);

    const r2 = svc.delegateTask(peer.id, 'After bind');
    svc.handleDelegationResult(r2.id, 'success');
    expect(rep.getEvents(peer.id)).toHaveLength(1); // now wired
  });
});
