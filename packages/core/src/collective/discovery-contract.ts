/**
 * Discovery Contract — Round 16.7
 *
 * Type definitions for the peer discovery domain.
 * PeerDiscoveryService is the canonical owner.
 *
 * Discovery ≠ Registration.
 * Discovery produces events → evaluates credibility → decides registry action.
 */

// ── Discovery Source ─────────────────────────────────────────────────

export type DiscoverySource =
  | 'manual'     // operator/API driven
  | 'lineage'    // child creation auto-bridge
  | 'evomap'     // EvoMap registry (future real, current mock)
  | 'registry'   // generic registry / directory
  | 'broadcast'; // network-level announcement

// ── Discovery Evidence ───────────────────────────────────────────────

export interface DiscoveryEvidence {
  /** Endpoint URL if reachable */
  endpoint?: string;
  /** Identity fingerprint */
  fingerprint?: string;
  /** Declared capabilities */
  capabilities?: string[];
  /** Credibility hint from source (0–1, higher = more credible) */
  credibilityHint?: number;
  /** Lineage record ID if from lineage */
  lineageRecordId?: string;
  /** Agent card / profile metadata */
  agentCard?: Record<string, unknown>;
  /** Raw source-specific payload */
  rawPayload?: Record<string, unknown>;
}

// ── Discovery Result Action ──────────────────────────────────────────

export type DiscoveryResultAction =
  | 'registered'    // new peer created
  | 'updated'       // existing peer refreshed
  | 'ignored'       // below credibility threshold or duplicate
  | 'quarantined';  // suspicious evidence

// ── Discovery Event ──────────────────────────────────────────────────

export interface DiscoveryEvent {
  /** Unique event ID */
  id: string;
  /** Source of discovery */
  source: DiscoverySource;
  /** Candidate peer summary */
  candidate: {
    agentId: string;
    name: string;
    endpoint?: string;
    fingerprint?: string;
    capabilities?: string[];
  };
  /** Evidence gathered */
  evidence: DiscoveryEvidence;
  /** Timestamp */
  timestamp: string;
  /** Action taken after evaluation */
  resultAction: DiscoveryResultAction;
  /** Peer ID if registered/updated */
  resultPeerId?: string;
  /** Reason for action */
  resultReason?: string;
}

// ── Discovery Refresh Policy ─────────────────────────────────────────

export interface DiscoveryRefreshPolicy {
  /** Refresh interval per source (milliseconds) */
  refreshIntervalMs: Partial<Record<DiscoverySource, number>>;
  /** Minimum credibility to auto-register (0–1) */
  minCredibility: number;
  /** Max consecutive refresh failures before degrading */
  maxRefreshFailures: number;
}

export const DEFAULT_REFRESH_POLICY: DiscoveryRefreshPolicy = {
  refreshIntervalMs: {
    evomap: 5 * 60 * 1000,    // 5 min
    registry: 10 * 60 * 1000, // 10 min
    broadcast: 2 * 60 * 1000, // 2 min
  },
  minCredibility: 0.3,
  maxRefreshFailures: 3,
};

// ── Discovery Provider (Adapter Pattern) ─────────────────────────────

/**
 * Adapter interface for discovery sources.
 * Implement this to add a new discovery backend.
 */
export interface DiscoveryProvider {
  /** Provider name (must match a DiscoverySource) */
  readonly source: DiscoverySource;
  /** Discover new peers from this source */
  discover(): Promise<DiscoveryCandidate[]>;
  /**
   * Refresh a specific peer from this source.
   * Returns structured result: success / failure / not-refreshable.
   * Providers that don't support refresh should return { status: 'not-refreshable' }.
   */
  refresh?(peerId: string): Promise<RefreshResult>;
  /** Whether this provider is currently available */
  isAvailable(): boolean;
}

/** Candidate returned by a provider before credibility evaluation */
export interface DiscoveryCandidate {
  agentId: string;
  name: string;
  endpoint?: string;
  fingerprint?: string;
  capabilities?: string[];
  credibilityHint?: number;
  rawPayload?: Record<string, unknown>;
}

// ── Refresh Result ───────────────────────────────────────────────────

/**
 * Structured result from a provider refresh attempt.
 * - success: peer confirmed reachable, clears failure count.
 * - failure: peer not reachable, increments failure count.
 * - not-refreshable: source doesn't support refresh (e.g., manual peers).
 */
export interface RefreshResult {
  status: 'success' | 'failure' | 'not-refreshable';
  /** Latency of the probe in ms (only on success) */
  latencyMs?: number;
  /** Human-readable reason (on failure or not-refreshable) */
  reason?: string;
}

// ── Discovery Stats ──────────────────────────────────────────────────

export interface DiscoveryStats {
  totalEvents: number;
  bySource: Partial<Record<DiscoverySource, number>>;
  byAction: Record<DiscoveryResultAction, number>;
  stalePeerCount: number;
  /** Total accumulated refresh failures across all peers */
  refreshFailureCount: number;
  lastDiscoveryAt?: string;
  registeredProviders: DiscoverySource[];
}
