/**
 * Staleness Policy — Round 16.7
 *
 * Configurable peer lifecycle management.
 * Different thresholds per PeerKind.
 * Used by PeerDiscoveryService.markStalePeers().
 */
import type { PeerKind, PeerStatus, PeerRecord } from './collective-contract.js';

// ── Staleness Thresholds ─────────────────────────────────────────────

export interface StalenessThresholds {
  /** Seconds without lastSeen before marking degraded */
  degradedAfterSec: number;
  /** Seconds without lastSeen before marking offline */
  offlineAfterSec: number;
  /** Consecutive refresh failures before quarantine */
  quarantineAfterFailures: number;
}

// ── Staleness Config ─────────────────────────────────────────────────

export interface StalenessConfig {
  /** Default thresholds (used if no per-kind override) */
  defaults: StalenessThresholds;
  /** Per-kind overrides */
  overrides?: Partial<Record<PeerKind, Partial<StalenessThresholds>>>;
}

// ── Default Config ──────────────────────────────────────────────────

export const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  defaults: {
    degradedAfterSec: 30 * 60,       // 30 min
    offlineAfterSec: 2 * 60 * 60,    // 2 hours
    quarantineAfterFailures: 3,
  },
  overrides: {
    child: {
      degradedAfterSec: 10 * 60,      // 10 min (children are managed)
      offlineAfterSec: 30 * 60,       // 30 min
      quarantineAfterFailures: 3,
    },
    sibling: {
      degradedAfterSec: 15 * 60,      // 15 min
      offlineAfterSec: 60 * 60,       // 1 hour
    },
  },
};

// ── Staleness Action ─────────────────────────────────────────────────

export type StalenessAction =
  | 'none'          // peer is fresh
  | 'degrade'       // should transition to degraded
  | 'offline'       // should transition to offline
  | 'quarantine'    // should quarantine (repeated failures)
  | 'unobserved';   // no lastSeen or registeredAt — cannot evaluate staleness

export interface StalenessEvaluation {
  peerId: string;
  peerKind: PeerKind;
  currentStatus: PeerStatus;
  lastSeenAgoSec: number;
  refreshFailures: number;
  action: StalenessAction;
  reason: string;
}

// ── StalenessPolicy ──────────────────────────────────────────────────

export class StalenessPolicy {
  private readonly config: StalenessConfig;

  constructor(config?: Partial<StalenessConfig>) {
    this.config = {
      defaults: config?.defaults ?? DEFAULT_STALENESS_CONFIG.defaults,
      overrides: {
        ...DEFAULT_STALENESS_CONFIG.overrides,
        ...config?.overrides,
      },
    };
  }

  /**
   * Get resolved thresholds for a specific peer kind.
   */
  getThresholds(kind: PeerKind): StalenessThresholds {
    const override = this.config.overrides?.[kind];
    return {
      degradedAfterSec: override?.degradedAfterSec ?? this.config.defaults.degradedAfterSec,
      offlineAfterSec: override?.offlineAfterSec ?? this.config.defaults.offlineAfterSec,
      quarantineAfterFailures: override?.quarantineAfterFailures ?? this.config.defaults.quarantineAfterFailures,
    };
  }

  /**
   * Evaluate a single peer for staleness.
   */
  evaluate(
    peer: PeerRecord,
    nowMs: number,
    refreshFailures = 0,
  ): StalenessEvaluation {
    const thresholds = this.getThresholds(peer.kind);

    // Resolve lastSeen with registeredAt fallback (Round 16.8)
    const rawLastSeen = peer.lastSeen ?? peer.registeredAt;
    if (!rawLastSeen) {
      // No temporal data at all — cannot evaluate staleness
      return {
        peerId: peer.id,
        peerKind: peer.kind,
        currentStatus: peer.status,
        lastSeenAgoSec: -1,
        refreshFailures,
        action: 'unobserved',
        reason: 'Unobserved: no lastSeen or registeredAt — staleness cannot be determined',
      };
    }
    const lastSeenMs = new Date(rawLastSeen).getTime();
    const lastSeenAgoSec = (nowMs - lastSeenMs) / 1000;

    // Terminal statuses: no action
    if (peer.status === 'revoked') {
      return {
        peerId: peer.id,
        peerKind: peer.kind,
        currentStatus: peer.status,
        lastSeenAgoSec,
        refreshFailures,
        action: 'none',
        reason: 'Terminal status (revoked)',
      };
    }

    // Quarantine on repeated failures
    if (refreshFailures >= thresholds.quarantineAfterFailures) {
      return {
        peerId: peer.id,
        peerKind: peer.kind,
        currentStatus: peer.status,
        lastSeenAgoSec,
        refreshFailures,
        action: 'quarantine',
        reason: `${refreshFailures} consecutive refresh failures (threshold: ${thresholds.quarantineAfterFailures})`,
      };
    }

    // Offline threshold
    if (lastSeenAgoSec >= thresholds.offlineAfterSec && peer.status !== 'offline' && peer.status !== 'quarantined') {
      return {
        peerId: peer.id,
        peerKind: peer.kind,
        currentStatus: peer.status,
        lastSeenAgoSec,
        refreshFailures,
        action: 'offline',
        reason: `Last seen ${Math.round(lastSeenAgoSec / 60)}m ago (threshold: ${thresholds.offlineAfterSec / 60}m)`,
      };
    }

    // Degraded threshold
    if (lastSeenAgoSec >= thresholds.degradedAfterSec && peer.status !== 'degraded' && peer.status !== 'offline' && peer.status !== 'quarantined') {
      return {
        peerId: peer.id,
        peerKind: peer.kind,
        currentStatus: peer.status,
        lastSeenAgoSec,
        refreshFailures,
        action: 'degrade',
        reason: `Last seen ${Math.round(lastSeenAgoSec / 60)}m ago (threshold: ${thresholds.degradedAfterSec / 60}m)`,
      };
    }

    return {
      peerId: peer.id,
      peerKind: peer.kind,
      currentStatus: peer.status,
      lastSeenAgoSec,
      refreshFailures,
      action: 'none',
      reason: 'Peer is fresh',
    };
  }

  /**
   * Batch evaluate all peers.
   */
  evaluateAll(
    peers: PeerRecord[],
    nowMs: number,
    refreshFailuresMap?: Map<string, number>,
  ): StalenessEvaluation[] {
    return peers.map(p =>
      this.evaluate(p, nowMs, refreshFailuresMap?.get(p.id) ?? 0),
    );
  }
}
