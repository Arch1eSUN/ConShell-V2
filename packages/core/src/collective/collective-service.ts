/**
 * CollectiveService — Round 16.6 → 16.7
 *
 * Canonical owner of the peer registry and collective runtime.
 * Manages peer discovery, trust evaluation, delegation, topology, and diagnostics.
 *
 * Architecture: CollectiveService ⟷ LineageService (siblings in kernel)
 *               GovernanceService calls both during replication.
 */
import type {
  PeerRecord,
  PeerKind,
  PeerStatus,
  PeerFilter,
  PeerRegistrationInput,
  CollectiveDelegationReceipt,
  DelegationResult,
  CollectiveTopology,
  TopologyNode,
  CollectiveDiagnostics,
  TrustSummary,
  CapabilitySummary,
} from './collective-contract.js';
import { isValidPeerTransition, DELEGATION_BLOCKED_STATUSES } from './collective-contract.js';
import { computeTrust, defaultTrust } from './trust-model.js';
import type { TrustEvidence } from './trust-model.js';
import type { LineageRecord } from '../lineage/lineage-contract.js';
import type { Logger } from '../types/common.js';
import type { ReputationService } from './reputation-service.js';
import type { ReputationEventKind } from './reputation-contract.js';

// Re-export contract + trust
export * from './collective-contract.js';
export { computeTrust, defaultTrust, type TrustEvidence } from './trust-model.js';

// ── Options ──────────────────────────────────────────────────────────

export interface CollectiveServiceOptions {
  logger: Logger;
  /** This agent's own ID (root of topology) */
  selfAgentId?: string;
  selfName?: string;
  /** Optional ReputationService for delegation loop (injected after init) */
  reputation?: ReputationService;
}

// ── CollectiveService ────────────────────────────────────────────────

export class CollectiveService {
  private peers = new Map<string, PeerRecord>();
  private delegationLog: CollectiveDelegationReceipt[] = [];
  private readonly logger: Logger;
  private readonly selfAgentId: string;
  private readonly selfName: string;
  private reputation: ReputationService | null = null;
  private idCounter = 0;

  constructor(opts: CollectiveServiceOptions) {
    this.logger = opts.logger;
    this.selfAgentId = opts.selfAgentId ?? 'self';
    this.selfName = opts.selfName ?? 'ConShell';
    this.reputation = opts.reputation ?? null;
  }

  /**
   * Late-bind ReputationService (for circular init scenarios).
   */
  setReputationService(reputation: ReputationService): void {
    this.reputation = reputation;
  }

  // ── Registration ──────────────────────────────────────────────────

  /**
   * Register a new peer from raw input.
   */
  registerPeer(input: PeerRegistrationInput): PeerRecord {
    const id = `peer_${Date.now()}_${++this.idCounter}`;
    const now = new Date().toISOString();

    const capabilities: CapabilitySummary = {
      declared: input.capabilities ?? [],
      verified: [],
    };

    const record: PeerRecord = {
      id,
      agentId: input.agentId,
      name: input.name,
      kind: input.kind,
      status: 'known',
      identitySummary: input.fingerprint
        ? { fingerprint: input.fingerprint }
        : undefined,
      lineageRecordId: input.lineageRecordId,
      capabilities,
      trust: defaultTrust(),
      source: input.source,
      endpoint: input.endpoint,
      registeredAt: now,
      lastSeen: now,
    };

    this.peers.set(id, record);
    this.logger.info('Peer registered', { peerId: id, name: input.name, kind: input.kind });
    return record;
  }

  /**
   * Register a child lineage record as a peer.
   * Called after successful child actualization.
   */
  registerPeerFromChild(lineageRecord: LineageRecord): PeerRecord {
    // Check if already registered by childId
    const existing = this.getPeerByAgentId(lineageRecord.childId);
    if (existing) {
      this.logger.debug('Child already registered as peer', { childId: lineageRecord.childId });
      return existing;
    }

    const input: PeerRegistrationInput = {
      agentId: lineageRecord.childId,
      name: lineageRecord.spec.name,
      kind: 'child',
      source: 'lineage',
      lineageRecordId: lineageRecord.id,
      fingerprint: lineageRecord.identitySummary.fingerprint,
    };

    const peer = this.registerPeer(input);

    // Set identity summary from lineage
    peer.identitySummary = {
      fingerprint: lineageRecord.identitySummary.fingerprint,
      parentFingerprint: lineageRecord.identitySummary.parentFingerprint,
      lineageRoot: lineageRecord.identitySummary.lineageRoot,
      generation: lineageRecord.identitySummary.generation,
    };

    // Compute initial trust with lineage evidence
    peer.trust = computeTrust({
      hasVerifiedIdentity: true,
      fingerprintValid: true,
      generation: lineageRecord.identitySummary.generation,
      isOnline: lineageRecord.status === 'active',
    });

    // Auto-transition to trusted if trust is high enough
    if (peer.trust.tier === 'trusted') {
      this.transitionStatus(peer, 'trusted');
    }

    this.logger.info('Child registered as peer', {
      peerId: peer.id,
      childId: lineageRecord.childId,
      trustTier: peer.trust.tier,
    });

    return peer;
  }

  // ── Queries ────────────────────────────────────────────────────────

  getPeer(id: string): PeerRecord | undefined {
    const p = this.peers.get(id);
    return p ? { ...p } : undefined;
  }

  getPeerByAgentId(agentId: string): PeerRecord | undefined {
    for (const p of this.peers.values()) {
      if (p.agentId === agentId) return { ...p };
    }
    return undefined;
  }

  listPeers(filter?: PeerFilter): PeerRecord[] {
    let results = Array.from(this.peers.values());
    if (filter?.status) results = results.filter(p => p.status === filter.status);
    if (filter?.kind) results = results.filter(p => p.kind === filter.kind);
    if (filter?.source) results = results.filter(p => p.source === filter.source);
    if (filter?.minTrust !== undefined) {
      results = results.filter(p => p.trust.overallScore >= filter.minTrust!);
    }
    return results.map(p => ({ ...p }));
  }

  // ── Trust Updates ─────────────────────────────────────────────────

  /**
   * Recompute trust for a peer given new evidence.
   */
  updatePeerTrust(id: string, evidence: TrustEvidence): TrustSummary {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);

    peer.trust = computeTrust(evidence);

    // Auto-adjust status based on trust
    if (peer.trust.tier === 'untrusted' && peer.status === 'trusted') {
      this.transitionStatus(peer, 'degraded');
    } else if (peer.trust.tier === 'trusted' && peer.status === 'known') {
      this.transitionStatus(peer, 'trusted');
    }

    this.logger.debug('Peer trust updated', { peerId: id, tier: peer.trust.tier });
    return { ...peer.trust };
  }

  // ── Health ────────────────────────────────────────────────────────

  /**
   * Update a peer's health data and lastSeen.
   */
  refreshPeerHealth(id: string, healthData: Record<string, unknown>): void {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);

    peer.lastSeen = new Date().toISOString();
    peer.lastHealthData = healthData;

    // If peer was offline, bring back to known
    if (peer.status === 'offline') {
      this.transitionStatus(peer, 'known');
    }
  }

  // ── Status Management ─────────────────────────────────────────────

  markPeerOffline(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);
    this.transitionStatus(peer, 'offline');
    this.logger.info('Peer marked offline', { peerId: id });
  }

  /**
   * Mark a peer as degraded (Round 16.8).
   * Does NOT update lastSeen — staleness degrade must not "wash" the peer fresh.
   */
  degradePeer(id: string, reason: string, actor = 'staleness-policy'): void {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);
    this.transitionStatus(peer, 'degraded');
    peer.statusReason = reason;
    peer.statusActor = actor;
    this.logger.warn('Peer degraded', { peerId: id, reason });
  }

  quarantinePeer(id: string, reason: string, actor = 'system'): void {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);
    this.transitionStatus(peer, 'quarantined');
    peer.statusReason = reason;
    peer.statusActor = actor;
    this.logger.warn('Peer quarantined', { peerId: id, reason });
  }

  revokePeer(id: string, reason: string, actor = 'system'): void {
    const peer = this.peers.get(id);
    if (!peer) throw new Error(`Peer not found: ${id}`);
    this.transitionStatus(peer, 'revoked');
    peer.statusReason = reason;
    peer.statusActor = actor;
    this.logger.warn('Peer revoked', { peerId: id, reason });
  }

  /**
   * Sync peer status from a lineage record (called when child state changes).
   */
  syncFromLineage(lineageRecord: LineageRecord): void {
    const peer = this.getPeerByAgentIdInternal(lineageRecord.childId);
    if (!peer) return;

    // Map lineage status → peer status
    switch (lineageRecord.status) {
      case 'active':
        if (peer.status === 'offline' || peer.status === 'degraded') {
          this.transitionStatus(peer, 'known');
        }
        break;
      case 'degraded':
        if (peer.status !== 'quarantined' && peer.status !== 'revoked') {
          this.transitionStatus(peer, 'degraded');
        }
        break;
      case 'recalled':
      case 'terminated':
      case 'failed':
        if (peer.status !== 'revoked') {
          this.transitionStatus(peer, 'offline');
        }
        break;
      case 'orphaned':
        if (peer.status !== 'revoked') {
          this.transitionStatus(peer, 'offline');
          peer.statusReason = 'Orphaned from lineage';
        }
        break;
    }

    peer.lastSeen = new Date().toISOString();
  }

  // ── Delegation ────────────────────────────────────────────────────

  /**
   * Delegate a task to a specific peer.
   * Returns a delegation receipt.
   */
  delegateTask(
    peerId: string,
    taskDescription: string,
    commitmentId?: string,
    delegationScopeId?: string,
    verdictId?: string,
  ): CollectiveDelegationReceipt {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error(`Peer not found: ${peerId}`);

    // Service-layer safety boundary (Round 16.8) — final enforcer
    if ((DELEGATION_BLOCKED_STATUSES as readonly string[]).includes(peer.status)) {
      throw new Error(
        `Cannot delegate to peer '${peerId}': status is '${peer.status}'. ` +
        `Delegation requires peer status to be 'known' or 'trusted'.`,
      );
    }

    const receipt: CollectiveDelegationReceipt = {
      id: `cdel_${Date.now()}_${++this.idCounter}`,
      peerId,
      peerKind: peer.kind,
      taskDescription,
      commitmentId,
      delegationScopeId,
      verdictId,
      result: 'success', // will be updated by handleDelegationResult
      trustImpact: 'neutral',
      timestamp: new Date().toISOString(),
    };

    this.delegationLog.push(receipt);
    this.logger.info('Task delegated to peer', { peerId, taskDescription });
    return receipt;
  }

  /**
   * Handle the result of a delegation.
   * Updates the receipt and adjusts peer trust.
   */
  handleDelegationResult(
    receiptId: string,
    result: DelegationResult,
    reason?: string,
  ): void {
    const receipt = this.delegationLog.find(r => r.id === receiptId);
    if (!receipt) throw new Error(`Delegation receipt not found: ${receiptId}`);

    receipt.result = result;
    receipt.reason = reason;

    const peer = this.peers.get(receipt.peerId);
    if (!peer) return;

    // Adjust trust impact
    switch (result) {
      case 'success':
        receipt.trustImpact = 'positive';
        break;
      case 'failure':
      case 'timeout':
      case 'rejected':
        receipt.trustImpact = 'negative';
        break;
    }

    // ── Delegation → Reputation Loop (Round 16.7) ──
    if (this.reputation) {
      const kindMap: Record<DelegationResult, ReputationEventKind> = {
        success: 'delegation_success',
        failure: 'delegation_failure',
        timeout: 'delegation_timeout',
        rejected: 'delegation_rejected',
      };
      this.reputation.recordEvent(
        receipt.peerId,
        kindMap[result],
        { receiptId, taskDescription: receipt.taskDescription, reason },
      );

      // Auto-degrade on repeated failures (3+)
      if (result !== 'success') {
        const peerEvents = this.reputation.getEvents(receipt.peerId);
        const recentFailures = peerEvents
          .slice(-5)
          .filter(e => e.kind !== 'delegation_success').length;
        if (recentFailures >= 3 && peer.status === 'trusted') {
          this.transitionStatus(peer, 'degraded');
          peer.statusReason = `Auto-degraded: ${recentFailures} recent delegation failures`;
          this.logger.warn('Peer auto-degraded from delegation failures', {
            peerId: peer.id,
            recentFailures,
          });
        }
      }
    }

    this.logger.info('Delegation result recorded', {
      receiptId,
      peerId: receipt.peerId,
      result,
      trustImpact: receipt.trustImpact,
    });
  }

  delegationReceipts(): readonly CollectiveDelegationReceipt[] {
    return this.delegationLog;
  }

  // ── Topology ──────────────────────────────────────────────────────

  topology(): CollectiveTopology {
    const childPeers = this.listPeersInternal(p => p.kind === 'child');
    const externalPeers = this.listPeersInternal(
      p => p.kind === 'external' || p.kind === 'discovered',
    );

    const root: TopologyNode = {
      peerId: 'self',
      agentId: this.selfAgentId,
      name: this.selfName,
      kind: 'parent',
      status: 'trusted',
      trustTier: 'trusted',
      children: childPeers.map(p => this.peerToNode(p)),
    };

    return {
      root,
      totalPeers: this.peers.size,
      externalPeers: externalPeers.map(p => this.peerToNode(p)),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Diagnostics ───────────────────────────────────────────────────

  diagnostics(): CollectiveDiagnostics {
    const all = Array.from(this.peers.values());

    const byKind = this.initRecord<PeerKind>(['child', 'sibling', 'parent', 'external', 'discovered']);
    const byStatus = this.initRecord<PeerStatus>(['known', 'trusted', 'degraded', 'quarantined', 'revoked', 'offline']);
    const trustDist = this.initRecord<string>(['trusted', 'provisional', 'degraded', 'untrusted']);

    for (const p of all) {
      byKind[p.kind]++;
      byStatus[p.status]++;
      trustDist[p.trust.tier]++;
    }

    const totalDelegations = this.delegationLog.length;
    const successDelegations = this.delegationLog.filter(d => d.result === 'success').length;

    return {
      totalPeers: all.length,
      byKind: byKind as Record<PeerKind, number>,
      byStatus: byStatus as Record<PeerStatus, number>,
      trustDistribution: trustDist as any,
      activeChildren: all.filter(p => p.kind === 'child' && p.status !== 'offline' && p.status !== 'revoked').length,
      activeSiblings: all.filter(p => p.kind === 'sibling' && p.status !== 'offline' && p.status !== 'revoked').length,
      activeExternalPeers: all.filter(p => (p.kind === 'external' || p.kind === 'discovered') && p.status !== 'offline' && p.status !== 'revoked').length,
      degradedPeerCount: byStatus.degraded,
      quarantinedPeerCount: byStatus.quarantined,
      totalDelegations,
      delegationSuccessRate: totalDelegations > 0 ? successDelegations / totalDelegations : 0,
    };
  }

  stats() {
    return this.diagnostics();
  }

  // ── Internal ───────────────────────────────────────────────────────

  private transitionStatus(peer: PeerRecord, to: PeerStatus): void {
    if (!isValidPeerTransition(peer.status, to)) {
      throw new Error(`Invalid peer transition: ${peer.status} → ${to} (peer: ${peer.id})`);
    }
    peer.status = to;
  }

  private getPeerByAgentIdInternal(agentId: string): PeerRecord | undefined {
    for (const p of this.peers.values()) {
      if (p.agentId === agentId) return p;
    }
    return undefined;
  }

  private listPeersInternal(predicate: (p: PeerRecord) => boolean): PeerRecord[] {
    return Array.from(this.peers.values()).filter(predicate);
  }

  private peerToNode(p: PeerRecord): TopologyNode {
    return {
      peerId: p.id,
      agentId: p.agentId,
      name: p.name,
      kind: p.kind,
      status: p.status,
      trustTier: p.trust.tier,
      children: [], // flat for now, could be recursive for multi-gen
    };
  }

  private initRecord<K extends string>(keys: K[]): Record<K, number> {
    const r = {} as Record<K, number>;
    for (const k of keys) r[k] = 0;
    return r;
  }
}
