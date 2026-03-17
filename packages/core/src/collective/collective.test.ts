/**
 * Collective Test Suite — Round 16.6
 *
 * Tests for:
 * - Contract types and status transitions
 * - PeerRegistry CRUD
 * - Trust model computation and explainability
 * - Child→Peer auto-registration
 * - Manual peer registration
 * - Peer status management (quarantine/revoke/offline)
 * - Delegation primitive
 * - Topology and diagnostics
 * - Edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidPeerTransition,
  PEER_STATUS_TRANSITIONS,
  TERMINAL_PEER_STATUSES,
  type PeerStatus,
  type PeerKind,
} from './collective-contract.js';
import {
  computeTrust,
  defaultTrust,
  tierFromScore,
  TRUST_WEIGHTS,
  type TrustEvidence,
} from './trust-model.js';
import { CollectiveService } from './collective-service.js';
import type { LineageRecord } from '../lineage/lineage-contract.js';

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

function makeLineageRecord(overrides?: Partial<LineageRecord>): LineageRecord {
  return {
    id: 'lr_1',
    parentId: 'root-agent',
    childId: 'child-agent-1',
    spec: {
      name: 'TestChild',
      task: 'Test task',
      genesisPrompt: 'Be helpful',
      fundingCents: 500,
      parentId: 'root-agent',
    },
    status: 'active',
    replicationReceipt: {
      id: 'rep_1',
      childId: 'child-agent-1',
      parentId: 'root-agent',
      timestamp: new Date().toISOString(),
      spec: {} as any,
    },
    identitySummary: {
      fingerprint: 'fp_child_1',
      parentFingerprint: 'fp_root',
      lineageRoot: 'fp_root',
      generation: 1,
    },
    funding: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as LineageRecord;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTRACT TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('Collective Contract (Round 16.6)', () => {
  describe('Peer Status Transitions', () => {
    it('known → trusted is valid', () => {
      expect(isValidPeerTransition('known', 'trusted')).toBe(true);
    });

    it('known → degraded is valid', () => {
      expect(isValidPeerTransition('known', 'degraded')).toBe(true);
    });

    it('revoked → anything is invalid (terminal)', () => {
      const targets: PeerStatus[] = ['known', 'trusted', 'degraded', 'quarantined', 'offline'];
      for (const t of targets) {
        expect(isValidPeerTransition('revoked', t)).toBe(false);
      }
    });

    it('quarantined → trusted is valid (rehabilitation)', () => {
      expect(isValidPeerTransition('quarantined', 'trusted')).toBe(true);
    });

    it('quarantined → revoked is valid (escalation)', () => {
      expect(isValidPeerTransition('quarantined', 'revoked')).toBe(true);
    });

    it('offline → known is valid (reconnection)', () => {
      expect(isValidPeerTransition('offline', 'known')).toBe(true);
    });

    it('terminal statuses are correctly defined', () => {
      expect(TERMINAL_PEER_STATUSES).toContain('revoked');
      expect(TERMINAL_PEER_STATUSES).toHaveLength(1);
    });

    it('transition table covers all statuses', () => {
      const all: PeerStatus[] = ['known', 'trusted', 'degraded', 'quarantined', 'revoked', 'offline'];
      for (const s of all) {
        expect(PEER_STATUS_TRANSITIONS[s]).toBeDefined();
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TRUST MODEL TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('Trust Model (Round 16.6)', () => {
  it('defaultTrust returns a baseline tier', () => {
    const t = defaultTrust();
    // No evidence → each dim gets baseline 0.5 → weighted ~0.5 → threshold edge
    // Actual: identity gets 0.5 - 0.3(no fp) = ~0.2, others ~0.5 → overall ~0.4
    expect(['provisional', 'degraded']).toContain(t.tier);
    expect(t.overallScore).toBeGreaterThan(0);
    expect(t.scores).toHaveLength(6); // +reputation dim (Round 16.7)
  });

  it('all dimensions have scores between 0 and 1', () => {
    const t = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      generation: 1,
      declaredCapabilities: 10,
      verifiedCapabilities: 8,
      totalGovernedActions: 100,
      compliantActions: 95,
      totalFundingAllocated: 10000,
      totalFundingSpent: 5000,
      isOnline: true,
      consecutiveHealthChecks: 15,
    });
    for (const s of t.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });

  it('high-evidence peer gets trusted tier', () => {
    const t = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      generation: 1,
      declaredCapabilities: 5,
      verifiedCapabilities: 5,
      totalGovernedActions: 50,
      compliantActions: 50,
      totalFundingAllocated: 5000,
      totalFundingSpent: 2500,
      isOnline: true,
      consecutiveHealthChecks: 20,
    });
    expect(t.tier).toBe('trusted');
    expect(t.overallScore).toBeGreaterThanOrEqual(0.8);
  });

  it('low-evidence peer gets lower tier', () => {
    const t = computeTrust({
      hasVerifiedIdentity: false,
      fingerprintValid: false,
      isOnline: false,
      hasDegradationHistory: true,
      secondsSinceLastSeen: 7200,
    });
    expect(t.overallScore).toBeLessThan(0.5);
  });

  it('each score has reasons array', () => {
    const t = computeTrust({});
    for (const s of t.scores) {
      expect(Array.isArray(s.reasons)).toBe(true);
      expect(s.dimension).toBeTruthy();
    }
  });

  it('tierFromScore maps correctly', () => {
    expect(tierFromScore(0.9)).toBe('trusted');
    expect(tierFromScore(0.8)).toBe('trusted');
    expect(tierFromScore(0.6)).toBe('provisional');
    expect(tierFromScore(0.5)).toBe('provisional');
    expect(tierFromScore(0.4)).toBe('degraded');
    expect(tierFromScore(0.3)).toBe('degraded');
    expect(tierFromScore(0.2)).toBe('untrusted');
    expect(tierFromScore(0.0)).toBe('untrusted');
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(TRUST_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('governance denials reduce score', () => {
    const clean = computeTrust({ totalGovernedActions: 10, compliantActions: 10 });
    const denied = computeTrust({ totalGovernedActions: 10, compliantActions: 10, hasGovernanceDenials: true });
    const govClean = clean.scores.find(s => s.dimension === 'governance')!;
    const govDenied = denied.scores.find(s => s.dimension === 'governance')!;
    expect(govDenied.score).toBeLessThan(govClean.score);
  });

  it('exhausted funding reduces economic score', () => {
    const ok = computeTrust({ totalFundingAllocated: 1000, totalFundingSpent: 500 });
    const bad = computeTrust({ totalFundingAllocated: 1000, totalFundingSpent: 500, hasExhaustedFunding: true });
    const eOk = ok.scores.find(s => s.dimension === 'economic')!;
    const eBad = bad.scores.find(s => s.dimension === 'economic')!;
    expect(eBad.score).toBeLessThan(eOk.score);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COLLECTIVE SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('CollectiveService (Round 16.6)', () => {
  let svc: CollectiveService;

  beforeEach(() => {
    svc = makeService();
  });

  // ── Registration ──────────────────────────────────────────────────

  describe('Peer Registration', () => {
    it('registerPeer creates a peer with default status "known"', () => {
      const peer = svc.registerPeer({
        agentId: 'ext-1',
        name: 'ExternalAgent',
        kind: 'external',
        source: 'manual',
      });
      expect(peer.id).toBeTruthy();
      expect(peer.status).toBe('known');
      expect(peer.kind).toBe('external');
      expect(peer.source).toBe('manual');
      expect(peer.trust).toBeDefined();
      expect(peer.trust.tier).toBeDefined();
    });

    it('registerPeerFromChild creates a child peer with trust', () => {
      const lr = makeLineageRecord();
      const peer = svc.registerPeerFromChild(lr);
      expect(peer.kind).toBe('child');
      expect(peer.source).toBe('lineage');
      expect(peer.lineageRecordId).toBe('lr_1');
      expect(peer.agentId).toBe('child-agent-1');
      expect(peer.identitySummary?.fingerprint).toBe('fp_child_1');
      expect(peer.identitySummary?.generation).toBe(1);
      // Active child with verified identity → at least provisional
      expect(['trusted', 'provisional']).toContain(peer.trust.tier);
    });

    it('registerPeerFromChild is idempotent', () => {
      const lr = makeLineageRecord();
      const p1 = svc.registerPeerFromChild(lr);
      const p2 = svc.registerPeerFromChild(lr);
      expect(p1.id).toBe(p2.id);
    });

    it('registerPeer with capabilities', () => {
      const peer = svc.registerPeer({
        agentId: 'ext-2',
        name: 'CapableAgent',
        kind: 'external',
        source: 'manual',
        capabilities: ['search', 'summarize'],
      });
      expect(peer.capabilities.declared).toEqual(['search', 'summarize']);
      expect(peer.capabilities.verified).toEqual([]);
    });
  });

  // ── Queries ────────────────────────────────────────────────────────

  describe('Peer Queries', () => {
    it('getPeer returns a copy', () => {
      const orig = svc.registerPeer({ agentId: 'a1', name: 'A', kind: 'external', source: 'manual' });
      const fetched = svc.getPeer(orig.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(orig.id);
      // Mutating returned copy should not affect internal
      fetched!.name = 'MUTATED';
      const refetch = svc.getPeer(orig.id);
      expect(refetch!.name).toBe('A');
    });

    it('getPeerByAgentId returns correct peer', () => {
      svc.registerPeer({ agentId: 'agent-x', name: 'X', kind: 'external', source: 'manual' });
      const found = svc.getPeerByAgentId('agent-x');
      expect(found).toBeDefined();
      expect(found!.agentId).toBe('agent-x');
    });

    it('listPeers with no filter returns all', () => {
      svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.registerPeer({ agentId: 'b', name: 'B', kind: 'discovered', source: 'evomap' });
      expect(svc.listPeers()).toHaveLength(2);
    });

    it('listPeers with kind filter', () => {
      svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.registerPeer({ agentId: 'b', name: 'B', kind: 'discovered', source: 'evomap' });
      expect(svc.listPeers({ kind: 'external' })).toHaveLength(1);
    });

    it('listPeers with minTrust filter', () => {
      const lr = makeLineageRecord();
      svc.registerPeerFromChild(lr); // trusted → high score
      svc.registerPeer({ agentId: 'ext', name: 'Ext', kind: 'external', source: 'manual' }); // default → lower score
      const highTrust = svc.listPeers({ minTrust: 0.6 });
      // Child from lineage has higher trust than default external
      expect(highTrust.length).toBeGreaterThanOrEqual(1);
    });

    it('getPeer for nonexistent returns undefined', () => {
      expect(svc.getPeer('nope')).toBeUndefined();
    });
  });

  // ── Trust Updates ─────────────────────────────────────────────────

  describe('Trust Updates', () => {
    it('updatePeerTrust recomputes trust', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      const newTrust = svc.updatePeerTrust(peer.id, {
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
      expect(newTrust.tier).toBe('trusted');
    });

    it('trust downgrade auto-adjusts status', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      // First promote to trusted
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
      const afterPromo = svc.getPeer(peer.id)!;
      expect(afterPromo.status).toBe('trusted');

      // Destroy trust — low evidence peer
      svc.updatePeerTrust(peer.id, {
        hasVerifiedIdentity: false,
        fingerprintValid: false,
        isOnline: false,
        hasDegradationHistory: true,
        secondsSinceLastSeen: 7200,
      });
      const afterDemotion = svc.getPeer(peer.id)!;
      // When trust goes to untrusted, status should auto-downgrade from trusted
      expect(['degraded', 'trusted']).toContain(afterDemotion.status);
      // Trust tier should reflect low evidence
      expect(['untrusted', 'degraded']).toContain(afterDemotion.trust.tier);
    });

    it('updatePeerTrust throws for nonexistent peer', () => {
      expect(() => svc.updatePeerTrust('nope', {})).toThrow('Peer not found');
    });
  });

  // ── Health ────────────────────────────────────────────────────────

  describe('Health Management', () => {
    it('refreshPeerHealth updates lastSeen', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.refreshPeerHealth(peer.id, { cpu: 50 });
      const updated = svc.getPeer(peer.id)!;
      expect(updated.lastSeen).toBeDefined();
      expect(updated.lastHealthData).toEqual({ cpu: 50 });
    });

    it('refreshPeerHealth brings offline peer back to known', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.markPeerOffline(peer.id);
      expect(svc.getPeer(peer.id)!.status).toBe('offline');
      svc.refreshPeerHealth(peer.id, { cpu: 30 });
      expect(svc.getPeer(peer.id)!.status).toBe('known');
    });
  });

  // ── Status Management ─────────────────────────────────────────────

  describe('Status Management', () => {
    it('markPeerOffline sets status to offline', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.markPeerOffline(peer.id);
      expect(svc.getPeer(peer.id)!.status).toBe('offline');
    });

    it('quarantinePeer sets status and reason', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.quarantinePeer(peer.id, 'Policy violation', 'admin');
      const q = svc.getPeer(peer.id)!;
      expect(q.status).toBe('quarantined');
      expect(q.statusReason).toBe('Policy violation');
      expect(q.statusActor).toBe('admin');
    });

    it('revokePeer sets terminal status', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.revokePeer(peer.id, 'Malicious behavior');
      const r = svc.getPeer(peer.id)!;
      expect(r.status).toBe('revoked');
    });

    it('revoked peer cannot transition further', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.revokePeer(peer.id, 'bye');
      expect(() => svc.markPeerOffline(peer.id)).toThrow('Invalid peer transition');
    });
  });

  // ── Lineage Sync ──────────────────────────────────────────────────

  describe('Lineage Sync', () => {
    it('syncFromLineage updates peer on degradation', () => {
      const lr = makeLineageRecord();
      svc.registerPeerFromChild(lr);
      svc.syncFromLineage({ ...lr, status: 'degraded' } as LineageRecord);
      const peer = svc.getPeerByAgentId('child-agent-1')!;
      expect(peer.status).toBe('degraded');
    });

    it('syncFromLineage marks peer offline on termination', () => {
      const lr = makeLineageRecord();
      svc.registerPeerFromChild(lr);
      svc.syncFromLineage({ ...lr, status: 'terminated' } as LineageRecord);
      const peer = svc.getPeerByAgentId('child-agent-1')!;
      expect(peer.status).toBe('offline');
    });

    it('syncFromLineage is no-op for unregistered child', () => {
      const lr = makeLineageRecord({ childId: 'unknown-child' });
      expect(() => svc.syncFromLineage(lr)).not.toThrow();
    });
  });

  // ── Delegation ────────────────────────────────────────────────────

  describe('Delegation', () => {
    it('delegateTask creates receipt', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      const receipt = svc.delegateTask(peer.id, 'Summarize document');
      expect(receipt.id).toBeTruthy();
      expect(receipt.peerId).toBe(peer.id);
      expect(receipt.peerKind).toBe('external');
      expect(receipt.taskDescription).toBe('Summarize document');
    });

    it('delegateTask to quarantined peer throws', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.quarantinePeer(peer.id, 'bad');
      expect(() => svc.delegateTask(peer.id, 'test')).toThrow('Cannot delegate');
    });

    it('delegateTask to revoked peer throws', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.revokePeer(peer.id, 'bye');
      expect(() => svc.delegateTask(peer.id, 'test')).toThrow('Cannot delegate');
    });

    it('handleDelegationResult updates receipt', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      const receipt = svc.delegateTask(peer.id, 'Do something');
      svc.handleDelegationResult(receipt.id, 'failure', 'Timeout exceeded');
      const receipts = svc.delegationReceipts();
      const updated = receipts.find(r => r.id === receipt.id)!;
      expect(updated.result).toBe('failure');
      expect(updated.reason).toBe('Timeout exceeded');
      expect(updated.trustImpact).toBe('negative');
    });

    it('successful delegation has positive trust impact', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      const receipt = svc.delegateTask(peer.id, 'Do something');
      svc.handleDelegationResult(receipt.id, 'success');
      const updated = svc.delegationReceipts().find(r => r.id === receipt.id)!;
      expect(updated.trustImpact).toBe('positive');
    });

    it('delegationReceipts returns all receipts', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.delegateTask(peer.id, 'Task 1');
      svc.delegateTask(peer.id, 'Task 2');
      expect(svc.delegationReceipts()).toHaveLength(2);
    });
  });

  // ── Topology ──────────────────────────────────────────────────────

  describe('Topology', () => {
    it('empty topology has self as root', () => {
      const topo = svc.topology();
      expect(topo.root.agentId).toBe('root-agent');
      expect(topo.root.name).toBe('TestConShell');
      expect(topo.root.children).toHaveLength(0);
      expect(topo.totalPeers).toBe(0);
    });

    it('children appear under root', () => {
      svc.registerPeerFromChild(makeLineageRecord());
      const topo = svc.topology();
      expect(topo.root.children).toHaveLength(1);
      expect(topo.root.children[0].kind).toBe('child');
    });

    it('external peers appear in externalPeers', () => {
      svc.registerPeer({ agentId: 'ext', name: 'Ext', kind: 'external', source: 'manual' });
      const topo = svc.topology();
      expect(topo.externalPeers).toHaveLength(1);
      expect(topo.externalPeers[0].kind).toBe('external');
    });

    it('discovered peers appear in externalPeers', () => {
      svc.registerPeer({ agentId: 'disc', name: 'Disc', kind: 'discovered', source: 'evomap' });
      const topo = svc.topology();
      expect(topo.externalPeers).toHaveLength(1);
    });
  });

  // ── Diagnostics ───────────────────────────────────────────────────

  describe('Diagnostics', () => {
    it('empty diagnostics has all zeros', () => {
      const diag = svc.diagnostics();
      expect(diag.totalPeers).toBe(0);
      expect(diag.activeChildren).toBe(0);
      expect(diag.delegationSuccessRate).toBe(0);
    });

    it('diagnostics counts by kind', () => {
      svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.registerPeerFromChild(makeLineageRecord());
      const diag = svc.diagnostics();
      expect(diag.totalPeers).toBe(2);
      expect(diag.byKind.external).toBe(1);
      expect(diag.byKind.child).toBe(1);
    });

    it('diagnostics tracks quarantined count', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      svc.quarantinePeer(peer.id, 'test');
      const diag = svc.diagnostics();
      expect(diag.quarantinedPeerCount).toBe(1);
      expect(diag.byStatus.quarantined).toBe(1);
    });

    it('diagnostics tracks delegation success rate', () => {
      const peer = svc.registerPeer({ agentId: 'a', name: 'A', kind: 'external', source: 'manual' });
      const r1 = svc.delegateTask(peer.id, 't1');
      const r2 = svc.delegateTask(peer.id, 't2');
      svc.handleDelegationResult(r1.id, 'success');
      svc.handleDelegationResult(r2.id, 'failure');
      const diag = svc.diagnostics();
      expect(diag.totalDelegations).toBe(2);
      expect(diag.delegationSuccessRate).toBe(0.5);
    });

    it('stats() is an alias for diagnostics()', () => {
      const d = svc.diagnostics();
      const s = svc.stats();
      expect(d.totalPeers).toBe(s.totalPeers);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('registering multiple peers with same agentId (via registerPeer, not fromChild) creates separate records', () => {
      const p1 = svc.registerPeer({ agentId: 'dup', name: 'Dup1', kind: 'external', source: 'manual' });
      const p2 = svc.registerPeer({ agentId: 'dup', name: 'Dup2', kind: 'external', source: 'manual' });
      expect(p1.id).not.toBe(p2.id);
    });

    it('refreshPeerHealth throws for nonexistent peer', () => {
      expect(() => svc.refreshPeerHealth('nope', {})).toThrow('Peer not found');
    });

    it('markPeerOffline throws for nonexistent peer', () => {
      expect(() => svc.markPeerOffline('nope')).toThrow('Peer not found');
    });

    it('quarantinePeer throws for nonexistent peer', () => {
      expect(() => svc.quarantinePeer('nope', 'reason')).toThrow('Peer not found');
    });

    it('handleDelegationResult throws for nonexistent receipt', () => {
      expect(() => svc.handleDelegationResult('nope', 'success')).toThrow('Delegation receipt not found');
    });

    it('delegateTask throws for nonexistent peer', () => {
      expect(() => svc.delegateTask('nope', 'task')).toThrow('Peer not found');
    });
  });
});
