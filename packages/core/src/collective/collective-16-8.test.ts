/**
 * Round 16.8 Test Suite — Collective Lifecycle Closure & Delegation Integrity Hardening
 *
 * Failure-path tests for all 5 bugs identified in Round 16.7:
 * 1. Staleness Degrade Washout — degradePeer() does NOT touch lastSeen
 * 2. Fake Refresh — refreshPeer() now uses provider.refresh() with RefreshResult
 * 3. Selector Score/Reason Discrepancy — status/trend adjustments enter score
 * 4. Delegation Guard — blocks offline/degraded/quarantined/revoked
 * 5. lastSeen Missing Fallback — uses registeredAt, or returns 'unobserved'
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Contract
import { DELEGATION_BLOCKED_STATUSES } from './collective-contract.js';
import type { PeerRecord } from './collective-contract.js';

// Services
import { CollectiveService } from './collective-service.js';
import { ReputationService } from './reputation-service.js';
import { PeerSelector, SELECTION_WEIGHTS, SELECTION_ADJUSTMENTS } from './peer-selector.js';
import {
  PeerDiscoveryService,
  ManualDiscoveryProvider,
  MockRegistryProvider,
} from './discovery-service.js';
import { StalenessPolicy } from './staleness-policy.js';

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

function makePeerRecord(overrides: Partial<PeerRecord> & { lastSeen?: string | undefined; registeredAt?: string | undefined } = {}): PeerRecord {
  const record = {
    id: overrides.id ?? `peer_test_${Math.random().toString(36).slice(2, 8)}`,
    agentId: overrides.agentId ?? 'test-agent',
    name: overrides.name ?? 'TestPeer',
    kind: overrides.kind ?? 'external',
    status: overrides.status ?? 'known',
    source: overrides.source ?? 'manual',
    registeredAt: 'registeredAt' in overrides ? overrides.registeredAt : new Date().toISOString(),
    lastSeen: 'lastSeen' in overrides ? overrides.lastSeen : new Date().toISOString(),
    trust: overrides.trust ?? { overallScore: 0.5, tier: 'provisional', scores: [], evaluatedAt: '' },
    capabilities: overrides.capabilities ?? { declared: [], verified: [] },
    statusReason: overrides.statusReason,
    endpoint: overrides.endpoint,
  };
  return record as PeerRecord;
}

// ═══════════════════════════════════════════════════════════════════════
// BUG 1: Staleness Degrade Washout Fix
// ═══════════════════════════════════════════════════════════════════════

describe('Bug 1: Staleness Degrade Washout (Round 16.8)', () => {
  it('degradePeer() does NOT update lastSeen', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
    const originalLastSeen = svc.getPeer(peer.id)!.lastSeen;

    // Wait a tiny bit to ensure timestamp would differ
    svc.degradePeer(peer.id, 'test degrade', 'staleness-policy');

    const updated = svc.getPeer(peer.id)!;
    expect(updated.status).toBe('degraded');
    expect(updated.lastSeen).toBe(originalLastSeen); // KEY ASSERTION
    expect(updated.statusReason).toBe('test degrade');
    expect(updated.statusActor).toBe('staleness-policy');
  });

  it('markStalePeers uses degradePeer() for degrade action', () => {
    const svc = makeService();
    const policy = new StalenessPolicy({
      overrides: {
        external: { degradedAfterSec: 1, offlineAfterSec: 3600, quarantineAfterFailures: 10 },
      },
    });
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });
    discovery.registerProvider(new ManualDiscoveryProvider());

    // Register a peer then backdate its timestamps.
    // IMPORTANT: getPeer()/listPeers() return shallow copies, so we must
    // access the internal Map entry directly for markStalePeers to see it.
    const peer = svc.registerPeer({ agentId: 'stale-peer', name: 'Stale', kind: 'external', source: 'manual' });
    const oldTime = new Date(Date.now() - 10_000).toISOString();
    const internalPeer = (svc as any).peers.get(peer.id);
    internalPeer.lastSeen = oldTime;
    internalPeer.registeredAt = oldTime;

    const actions = discovery.markStalePeers();

    // Peer should be degraded
    expect(actions.length).toBeGreaterThanOrEqual(1);
    const degradeAction = actions.find(a => a.peerId === peer.id && a.action === 'degrade');
    expect(degradeAction).toBeDefined();

    // lastSeen must NOT have been updated (no washout)
    const updated = svc.getPeer(peer.id)!;
    expect(updated.status).toBe('degraded');
    expect(updated.lastSeen).toBe(oldTime);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BUG 2: Fake Refresh
// ═══════════════════════════════════════════════════════════════════════

describe('Bug 2: Fake Refresh Fix (Round 16.8)', () => {
  it('refreshPeer returns not-refreshable for manual provider', async () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });
    discovery.registerProvider(new ManualDiscoveryProvider());

    const peer = svc.registerPeer({ agentId: 'manual-peer', name: 'Manual', kind: 'external', source: 'manual' });
    const result = await discovery.refreshPeer(peer.id);
    expect(result.status).toBe('not-refreshable');
  });

  it('refreshPeer success clears failure count', async () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    const provider = new MockRegistryProvider([{
      agentId: 'reg-peer', name: 'RegPeer',
    }]);
    discovery.registerProvider(provider);

    // Discover via registry provider so peer.source = 'registry'
    await discovery.discoverAll();
    const peer = svc.getPeerByAgentId('reg-peer')!;
    expect(peer.source).toBe('registry');

    // Simulate failures first
    provider.setRefreshBehaviour('failure');
    await discovery.refreshPeer(peer.id);
    await discovery.refreshPeer(peer.id);

    // Check failure count reflected in stats
    let stats = discovery.stats();
    expect(stats.refreshFailureCount).toBe(2);

    // Now succeed
    provider.setRefreshBehaviour('success');
    const result = await discovery.refreshPeer(peer.id);
    expect(result.status).toBe('success');

    // Failures should be cleared
    stats = discovery.stats();
    expect(stats.refreshFailureCount).toBe(0);
  });

  it('refreshPeer failure accumulates failure count', async () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    const provider = new MockRegistryProvider([{
      agentId: 'fail-peer', name: 'FailPeer',
    }]);
    discovery.registerProvider(provider);

    // Discover via registry so peer.source = 'registry'
    await discovery.discoverAll();
    const peer = svc.getPeerByAgentId('fail-peer')!;

    provider.setRefreshBehaviour('failure');
    await discovery.refreshPeer(peer.id);
    await discovery.refreshPeer(peer.id);
    await discovery.refreshPeer(peer.id);

    const stats = discovery.stats();
    expect(stats.refreshFailureCount).toBe(3);
  });

  it('refreshPeer throws for unknown peer', async () => {
    const svc = makeService();
    const policy = new StalenessPolicy();
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    await expect(discovery.refreshPeer('nonexistent')).rejects.toThrow('Peer not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BUG 3: Selector Score/Reason Discrepancy
// ═══════════════════════════════════════════════════════════════════════

describe('Bug 3: Selector Score/Reason Reconciliation (Round 16.8)', () => {
  it('SELECTION_ADJUSTMENTS are exported', () => {
    expect(SELECTION_ADJUSTMENTS).toBeDefined();
    expect(SELECTION_ADJUSTMENTS.statusTrusted).toBe(0.05);
    expect(SELECTION_ADJUSTMENTS.statusDegraded).toBe(-0.10);
    expect(SELECTION_ADJUSTMENTS.trendImproving).toBe(0.03);
    expect(SELECTION_ADJUSTMENTS.trendDeclining).toBe(-0.05);
  });

  it('trusted peer score is higher than known peer (same everything else)', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    const p1 = svc.registerPeer({ agentId: 'known-p', name: 'Known', kind: 'external', source: 'manual' });
    const p2 = svc.registerPeer({ agentId: 'trusted-p', name: 'Trusted', kind: 'external', source: 'manual' });

    // Promote p2 to trusted
    svc.updatePeerTrust(p2.id, {
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
    expect(svc.getPeer(p2.id)!.status).toBe('trusted');

    const result = selector.select({});
    const knownScore = result.candidates.find(c => c.peer.id === p1.id)?.score ?? 0;
    const trustedScore = result.candidates.find(c => c.peer.id === p2.id)?.score ?? 0;

    expect(trustedScore).toBeGreaterThan(knownScore);
  });

  it('selector reasons mention exact adjustment values', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    const p = svc.registerPeer({ agentId: 'trusted-reason', name: 'TR', kind: 'external', source: 'manual' });
    svc.updatePeerTrust(p.id, {
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

    const result = selector.select({});
    const candidate = result.candidates.find(c => c.peer.id === p.id)!;

    // Reasons should contain the exact status adjustment value
    const statusReason = candidate.selectionReasons.find(r => r.includes('Status adjustment'));
    expect(statusReason).toBeDefined();
    expect(statusReason).toContain('+0.05');
  });

  it('score is clamped to [0, 1]', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    svc.registerPeer({ agentId: 'clamp-test', name: 'CT', kind: 'external', source: 'manual' });

    const result = selector.select({});
    for (const c of result.candidates) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BUG 4: Delegation Guard
// ═══════════════════════════════════════════════════════════════════════

describe('Bug 4: Delegation Guard Hardening (Round 16.8)', () => {
  it('DELEGATION_BLOCKED_STATUSES includes offline and degraded', () => {
    expect(DELEGATION_BLOCKED_STATUSES).toContain('offline');
    expect(DELEGATION_BLOCKED_STATUSES).toContain('degraded');
    expect(DELEGATION_BLOCKED_STATUSES).toContain('quarantined');
    expect(DELEGATION_BLOCKED_STATUSES).toContain('revoked');
  });

  it('delegation to offline peer throws', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'off', name: 'Off', kind: 'external', source: 'manual' });
    svc.markPeerOffline(peer.id);

    expect(() => svc.delegateTask(peer.id, 'task')).toThrow(/Cannot delegate/);
  });

  it('delegation to degraded peer throws', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'deg', name: 'Deg', kind: 'external', source: 'manual' });
    svc.degradePeer(peer.id, 'test degrade');

    expect(() => svc.delegateTask(peer.id, 'task')).toThrow(/Cannot delegate/);
  });

  it('delegation to quarantined peer throws', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'qua', name: 'Qua', kind: 'external', source: 'manual' });
    svc.quarantinePeer(peer.id, 'quarantine test');

    expect(() => svc.delegateTask(peer.id, 'task')).toThrow(/Cannot delegate/);
  });

  it('delegation to revoked peer throws', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'rev', name: 'Rev', kind: 'external', source: 'manual' });
    svc.revokePeer(peer.id, 'revoke test');

    expect(() => svc.delegateTask(peer.id, 'task')).toThrow(/Cannot delegate/);
  });

  it('delegation to known peer succeeds', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'ok', name: 'OK', kind: 'external', source: 'manual' });

    const receipt = svc.delegateTask(peer.id, 'task');
    expect(receipt).toBeDefined();
    expect(receipt.peerId).toBe(peer.id);
  });

  it('delegation to trusted peer succeeds', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'tr', name: 'Tr', kind: 'external', source: 'manual' });
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

    const receipt = svc.delegateTask(peer.id, 'task');
    expect(receipt).toBeDefined();
  });

  it('error message mentions required status', () => {
    const svc = makeService();
    const peer = svc.registerPeer({ agentId: 'msg', name: 'Msg', kind: 'external', source: 'manual' });
    svc.markPeerOffline(peer.id);

    try {
      svc.delegateTask(peer.id, 'task');
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.message).toContain("status is 'offline'");
      expect(e.message).toContain("'known' or 'trusted'");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BUG 5: lastSeen Missing Fallback
// ═══════════════════════════════════════════════════════════════════════

describe('Bug 5: lastSeen Missing Fallback (Round 16.8)', () => {
  it('uses registeredAt when lastSeen is missing', () => {
    const policy = new StalenessPolicy({
      overrides: {
        external: { degradedAfterSec: 5, offlineAfterSec: 10, quarantineAfterFailures: 3 },
      },
    });
    const now = Date.now();
    const peer = makePeerRecord({
      kind: 'external',
      registeredAt: new Date(now - 3_000).toISOString(), // 3s ago
      lastSeen: undefined,
    });

    const result = policy.evaluate(peer, now);
    // 3 seconds < 5 second degrade threshold → should be fresh
    expect(result.action).toBe('none');
    expect(result.lastSeenAgoSec).toBeCloseTo(3, 0);
  });

  it('returns unobserved when both lastSeen and registeredAt are missing', () => {
    const policy = new StalenessPolicy();
    const now = Date.now();
    const peer = makePeerRecord({
      kind: 'external',
      registeredAt: undefined,
      lastSeen: undefined,
    });
    // Double-check they are truly absent
    delete (peer as any).lastSeen;
    delete (peer as any).registeredAt;

    const result = policy.evaluate(peer, now);
    expect(result.action).toBe('unobserved');
    expect(result.lastSeenAgoSec).toBe(-1);
    expect(result.reason).toContain('Unobserved');
  });

  it('unobserved peer does not trigger stale action in markStalePeers', () => {
    const svc = makeService();
    const policy = new StalenessPolicy({
      overrides: {
        external: { degradedAfterSec: 1, offlineAfterSec: 2, quarantineAfterFailures: 3 },
      },
    });
    const discovery = new PeerDiscoveryService({
      logger: makeLogger(),
      collective: svc,
      stalenessPolicy: policy,
    });

    // Register peer then wipe temporal data
    const peer = svc.registerPeer({ agentId: 'unobs', name: 'Unobs', kind: 'external', source: 'manual' });
    // Must modify internal Map entry since getPeer() returns shallow copy
    const internalPeer = (svc as any).peers.get(peer.id);
    delete internalPeer.lastSeen;
    delete internalPeer.registeredAt;

    const actions = discovery.markStalePeers();
    // Should NOT have any action for this peer
    const peerActions = actions.filter(a => a.peerId === peer.id);
    expect(peerActions).toHaveLength(0);

    // Peer should remain unchanged
    expect(svc.getPeer(peer.id)!.status).not.toBe('degraded');
    expect(svc.getPeer(peer.id)!.status).not.toBe('offline');
  });

  it('registeredAt fallback correctly calculates staleness', () => {
    const policy = new StalenessPolicy({
      overrides: {
        external: { degradedAfterSec: 5, offlineAfterSec: 10, quarantineAfterFailures: 3 },
      },
    });
    const now = Date.now();
    // registeredAt was 8 seconds ago, no lastSeen
    const peer = makePeerRecord({
      kind: 'external',
      registeredAt: new Date(now - 8_000).toISOString(),
      lastSeen: undefined,
    });

    const result = policy.evaluate(peer, now);
    // 8 seconds > 5 second degrade threshold → degrade
    expect(result.action).toBe('degrade');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION: End-to-end lifecycle flow
// ═══════════════════════════════════════════════════════════════════════

describe('Integration: Lifecycle + Delegation Flow (Round 16.8)', () => {
  it('full cycle: register → discover → delegate → fail → degrade → block delegation', () => {
    const rep = new ReputationService({ logger: makeLogger() });
    const svc = new CollectiveService({
      logger: makeLogger(),
      selfAgentId: 'root',
      selfName: 'Test',
      reputation: rep,
    });

    // Register and promote to trusted
    const peer = svc.registerPeer({ agentId: 'lifecycle', name: 'LC', kind: 'external', source: 'manual' });
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

    // Successful delegation
    const r1 = svc.delegateTask(peer.id, 'Good task');
    svc.handleDelegationResult(r1.id, 'success');
    expect(rep.getEvents(peer.id)).toHaveLength(1);

    // Three failures → auto-degrade
    for (let i = 0; i < 3; i++) {
      const r = svc.delegateTask(peer.id, `Bad task ${i}`);
      svc.handleDelegationResult(r.id, 'failure', 'Failed');
    }
    expect(svc.getPeer(peer.id)!.status).toBe('degraded');

    // Now delegation should be blocked
    expect(() => svc.delegateTask(peer.id, 'Should fail')).toThrow(/Cannot delegate/);
  });

  it('selector penalizes degraded peers in score but still includes them', () => {
    const svc = makeService();
    const rep = new ReputationService({ logger: makeLogger() });
    const selector = new PeerSelector(svc, rep);

    const p1 = svc.registerPeer({ agentId: 'good', name: 'Good', kind: 'external', source: 'manual' });
    const p2 = svc.registerPeer({ agentId: 'bad', name: 'Bad', kind: 'external', source: 'manual' });
    svc.degradePeer(p2.id, 'test');

    const result = selector.select({});
    const goodCandidate = result.candidates.find(c => c.peer.id === p1.id);
    const badCandidate = result.candidates.find(c => c.peer.id === p2.id);
    
    // Degraded peer should be present but with lower score
    expect(goodCandidate).toBeDefined();
    expect(badCandidate).toBeDefined();
    expect(goodCandidate!.score).toBeGreaterThan(badCandidate!.score);
    
    // But delegation at service layer should still block it
    expect(() => svc.delegateTask(p2.id, 'task')).toThrow(/Cannot delegate/);
  });
});
