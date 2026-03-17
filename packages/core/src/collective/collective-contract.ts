/**
 * Collective Contract — Round 16.6
 *
 * Canonical type definitions for the collective/peer domain.
 * CollectiveService is the canonical owner of the peer registry.
 *
 * Peer lifecycle: known → trusted → degraded → quarantined/revoked/offline
 */

// ── Peer Kind ────────────────────────────────────────────────────────

export type PeerKind =
  | 'child'       // spawned via lineage
  | 'sibling'     // same parent in lineage
  | 'parent'      // immediate parent
  | 'external'    // manually registered
  | 'discovered'; // auto-discovered (EvoMap, broadcast, etc.)

// ── Peer Status ──────────────────────────────────────────────────────

/**
 * Canonical peer lifecycle states (Round 16.8 semantics):
 *
 * - **known**: Registered but not yet trust-evaluated.
 * - **trusted**: Passed trust evaluation, eligible for delegation.
 * - **degraded**: Visible but unreliable — stale lastSeen, trust drop, or
 *   repeated minor failures. NOT eligible for delegation (16.8+).
 * - **offline**: Currently unreachable. NOT eligible for delegation.
 * - **quarantined**: Isolated due to policy violation, anomalous behaviour,
 *   or repeated refresh failures. May be rehabilitated by admin.
 * - **revoked**: Terminal. Permanently removed from collective.
 */
export type PeerStatus =
  | 'known'        // registered but not yet evaluated
  | 'trusted'      // passed trust evaluation
  | 'degraded'     // visible but unreliable (stale / trust issues)
  | 'quarantined'  // isolated due to policy violation
  | 'revoked'      // permanently removed from collective (terminal)
  | 'offline';     // currently unreachable

/** Valid status transitions */
export const PEER_STATUS_TRANSITIONS: Record<PeerStatus, readonly PeerStatus[]> = {
  known:       ['trusted', 'degraded', 'offline', 'quarantined', 'revoked'],
  trusted:     ['degraded', 'offline', 'quarantined', 'revoked'],
  degraded:    ['trusted', 'offline', 'quarantined', 'revoked'],
  quarantined: ['trusted', 'degraded', 'revoked'],  // can be rehabilitated
  revoked:     [],  // terminal
  offline:     ['known', 'trusted', 'degraded', 'quarantined', 'revoked'],
};

export const TERMINAL_PEER_STATUSES: readonly PeerStatus[] = ['revoked'];

export function isValidPeerTransition(from: PeerStatus, to: PeerStatus): boolean {
  return PEER_STATUS_TRANSITIONS[from].includes(to);
}

// ── Trust ────────────────────────────────────────────────────────────

export type TrustDimension =
  | 'identity'
  | 'capability'
  | 'governance'
  | 'economic'
  | 'uptime'
  | 'reputation';

export type TrustTier =
  | 'trusted'      // ≥ 0.8
  | 'provisional'  // ≥ 0.5
  | 'degraded'     // ≥ 0.3
  | 'untrusted';   // < 0.3

export interface TrustScore {
  dimension: TrustDimension;
  score: number;  // 0.0 – 1.0
  reasons: string[];
}

export interface TrustSummary {
  tier: TrustTier;
  overallScore: number;  // weighted average
  scores: TrustScore[];
  lastUpdatedAt: string;
}

// ── Capability ───────────────────────────────────────────────────────

export interface CapabilitySummary {
  /** Capabilities the peer claims to have */
  declared: string[];
  /** Capabilities that have been verified */
  verified: string[];
}

// ── Peer Discovery Source ────────────────────────────────────────────

export type PeerDiscoverySource =
  | 'lineage'    // created through lineage actualization
  | 'manual'     // manually registered via API
  | 'evomap'     // discovered via EvoMap
  | 'broadcast'; // discovered via network broadcast

// ── Peer Record ──────────────────────────────────────────────────────

export interface PeerRecord {
  /** Unique peer ID */
  id: string;
  /** Agent ID of this peer (e.g., child agent ID) */
  agentId: string;
  /** Display name */
  name: string;
  /** Classification */
  kind: PeerKind;
  /** Current status */
  status: PeerStatus;
  /** Identity summary (fingerprint, generation, lineage root) */
  identitySummary?: {
    fingerprint: string;
    parentFingerprint?: string;
    lineageRoot?: string;
    generation?: number;
  };
  /** Lineage record ID, if this peer is a lineage member */
  lineageRecordId?: string;
  /** Capability claims */
  capabilities: CapabilitySummary;
  /** Current trust evaluation */
  trust: TrustSummary;
  /** How this peer was discovered */
  source: PeerDiscoverySource;
  /** Connection endpoint (for external/discovered peers) */
  endpoint?: string;
  /** When this peer was registered */
  registeredAt: string;
  /** Last time we received a health signal */
  lastSeen?: string;
  /** Last health check data */
  lastHealthData?: Record<string, unknown>;
  /** Reason for quarantine/revoke */
  statusReason?: string;
  /** Who triggered the status change */
  statusActor?: string;
}

// ── Delegation ───────────────────────────────────────────────────────

export type DelegationResult = 'success' | 'failure' | 'timeout' | 'rejected';

/**
 * Statuses that block delegation at the service layer (final safety boundary).
 * Selector is a recommendation engine; service layer is the enforcer.
 */
export const DELEGATION_BLOCKED_STATUSES: readonly PeerStatus[] = [
  'revoked', 'quarantined', 'offline', 'degraded',
] as const;

/**
 * Options for delegateTask().
 * In 16.8, degraded peers are always blocked.
 * Reserved for 16.9+: allowDegraded + overrideReason to permit degraded delegation.
 */
export interface DelegationOptions {
  /** Allow delegation to degraded peers (default: false, reserved for 16.9+) */
  allowDegraded?: boolean;
  /** Required reason when overriding degraded block */
  overrideReason?: string;
}

export interface CollectiveDelegationReceipt {
  /** Unique receipt ID */
  id: string;
  /** Target peer ID */
  peerId: string;
  /** Peer kind at time of delegation */
  peerKind: PeerKind;
  /** Task description */
  taskDescription: string;
  /** Commitment ID (if linked) */
  commitmentId?: string;
  /** Delegation scope ID (Round 17.2 — governance-issued scope) */
  delegationScopeId?: string;
  /** Governance verdict ID (Round 17.2) */
  verdictId?: string;
  /** Governance proposal ID (Round 17.2) */
  proposalId?: string;
  /** Result of the delegation */
  result: DelegationResult;
  /** Impact on peer trust after this delegation */
  trustImpact: 'positive' | 'negative' | 'neutral';
  /** Error reason (on failure) */
  reason?: string;
  /** Timestamp */
  timestamp: string;
}

// ── Topology ─────────────────────────────────────────────────────────

export interface TopologyNode {
  peerId: string;
  agentId: string;
  name: string;
  kind: PeerKind;
  status: PeerStatus;
  trustTier: TrustTier;
  children: TopologyNode[];
}

export interface CollectiveTopology {
  /** Root node (self) */
  root: TopologyNode;
  /** Total peer count */
  totalPeers: number;
  /** Flat list of external/discovered (non-tree) peers */
  externalPeers: TopologyNode[];
  /** Generation timestamp */
  generatedAt: string;
}

// ── Diagnostics ──────────────────────────────────────────────────────

export interface CollectiveDiagnostics {
  totalPeers: number;
  byKind: Record<PeerKind, number>;
  byStatus: Record<PeerStatus, number>;
  trustDistribution: Record<TrustTier, number>;
  activeChildren: number;
  activeSiblings: number;
  activeExternalPeers: number;
  degradedPeerCount: number;
  quarantinedPeerCount: number;
  totalDelegations: number;
  delegationSuccessRate: number;
}

// ── Peer Filter ──────────────────────────────────────────────────────

export interface PeerFilter {
  status?: PeerStatus;
  kind?: PeerKind;
  minTrust?: number;
  source?: PeerDiscoverySource;
}

// ── Peer Registration Input ──────────────────────────────────────────

export interface PeerRegistrationInput {
  /** Agent ID */
  agentId: string;
  /** Display name */
  name: string;
  /** Peer kind */
  kind: PeerKind;
  /** Discovery source */
  source: PeerDiscoverySource;
  /** Capability claims */
  capabilities?: string[];
  /** Connection endpoint */
  endpoint?: string;
  /** Identity fingerprint */
  fingerprint?: string;
  /** Lineage record ID (for child peers) */
  lineageRecordId?: string;
}
