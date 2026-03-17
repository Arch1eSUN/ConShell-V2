/**
 * PeerDiscoveryService — Round 16.7
 *
 * Canonical discovery runtime owner.
 * Uses adapter/provider pattern for discovery sources.
 * Discovery ≠ Registration: events are evaluated → credibility checked → then ingested.
 *
 * Built-in providers:
 * - ManualDiscoveryProvider (always available)
 * - MockRegistryProvider (simulates external registry)
 */
import type {
  DiscoveryEvent,
  DiscoverySource,
  DiscoveryEvidence,
  DiscoveryResultAction,
  DiscoveryProvider,
  DiscoveryCandidate,
  DiscoveryRefreshPolicy,
  DiscoveryStats,
  RefreshResult,
} from './discovery-contract.js';
import { DEFAULT_REFRESH_POLICY } from './discovery-contract.js';
import type { CollectiveService } from './collective-service.js';
import type { StalenessPolicy, StalenessAction } from './staleness-policy.js';
import type { Logger } from '../types/common.js';

// Re-export contract
export * from './discovery-contract.js';

// ── Options ──────────────────────────────────────────────────────────

export interface PeerDiscoveryServiceOptions {
  logger: Logger;
  collective: CollectiveService;
  stalenessPolicy: StalenessPolicy;
  refreshPolicy?: Partial<DiscoveryRefreshPolicy>;
}

// ── PeerDiscoveryService ─────────────────────────────────────────────

export class PeerDiscoveryService {
  private readonly providers = new Map<DiscoverySource, DiscoveryProvider>();
  private readonly eventLog: DiscoveryEvent[] = [];
  private readonly refreshFailures = new Map<string, number>(); // peerId → failure count
  private readonly logger: Logger;
  private readonly collective: CollectiveService;
  private readonly stalenessPolicy: StalenessPolicy;
  private readonly refreshPolicy: DiscoveryRefreshPolicy;
  private idCounter = 0;

  constructor(opts: PeerDiscoveryServiceOptions) {
    this.logger = opts.logger;
    this.collective = opts.collective;
    this.stalenessPolicy = opts.stalenessPolicy;
    this.refreshPolicy = {
      ...DEFAULT_REFRESH_POLICY,
      ...opts.refreshPolicy,
    };
  }

  // ── Provider Registry ─────────────────────────────────────────────

  /**
   * Register a discovery provider (adapter pattern).
   */
  registerProvider(provider: DiscoveryProvider): void {
    this.providers.set(provider.source, provider);
    this.logger.info('Discovery provider registered', { source: provider.source });
  }

  getRegisteredSources(): DiscoverySource[] {
    return Array.from(this.providers.keys());
  }

  // ── Discovery ─────────────────────────────────────────────────────

  /**
   * Run discovery from all registered providers.
   * Returns all generated events.
   */
  async discoverAll(): Promise<DiscoveryEvent[]> {
    const events: DiscoveryEvent[] = [];

    for (const [source, provider] of this.providers) {
      if (!provider.isAvailable()) {
        this.logger.debug('Discovery provider unavailable, skipping', { source });
        continue;
      }

      try {
        const candidates = await provider.discover();
        for (const c of candidates) {
          const event = this.ingestCandidate(c, source);
          events.push(event);
        }
      } catch (err) {
        this.logger.warn('Discovery provider failed', { source, error: String(err) });
      }
    }

    return events;
  }

  /**
   * Discover from a specific source.
   */
  async discoverFromSource(source: DiscoverySource): Promise<DiscoveryEvent[]> {
    const provider = this.providers.get(source);
    if (!provider) throw new Error(`No provider registered for source: ${source}`);
    if (!provider.isAvailable()) throw new Error(`Provider not available: ${source}`);

    const candidates = await provider.discover();
    return candidates.map(c => this.ingestCandidate(c, source));
  }

  /**
   * Manual discovery — create a peer from provided data.
   * This is the non-alias discovery path (evaluates credibility first).
   */
  discoverManual(candidate: DiscoveryCandidate): DiscoveryEvent {
    return this.ingestCandidate(
      { ...candidate, credibilityHint: candidate.credibilityHint ?? 0.8 },
      'manual',
    );
  }

  // ── Ingest ────────────────────────────────────────────────────────

  /**
   * Ingest a candidate: evaluate credibility → decide action → register or ignore.
   */
  private ingestCandidate(
    candidate: DiscoveryCandidate,
    source: DiscoverySource,
  ): DiscoveryEvent {
    const credibility = candidate.credibilityHint ?? 0.5;
    let action: DiscoveryResultAction;
    let resultPeerId: string | undefined;
    let resultReason: string;

    // Check if peer already exists
    const existing = this.collective.getPeerByAgentId(candidate.agentId);

    if (credibility < this.refreshPolicy.minCredibility) {
      action = 'ignored';
      resultReason = `Credibility ${credibility.toFixed(2)} below threshold ${this.refreshPolicy.minCredibility}`;
    } else if (existing) {
      // Update existing peer's health
      this.collective.refreshPeerHealth(existing.id, {
        discoverySource: source,
        discoveredAt: new Date().toISOString(),
      });
      this.refreshFailures.delete(existing.id);
      action = 'updated';
      resultPeerId = existing.id;
      resultReason = `Updated existing peer (credibility: ${credibility.toFixed(2)})`;
    } else {
      // Register new peer
      const peer = this.collective.registerPeer({
        agentId: candidate.agentId,
        name: candidate.name,
        kind: source === 'lineage' ? 'child' : 'discovered',
        source: source as any,
        endpoint: candidate.endpoint,
        fingerprint: candidate.fingerprint,
        capabilities: candidate.capabilities,
      });
      action = 'registered';
      resultPeerId = peer.id;
      resultReason = `New peer registered from ${source} (credibility: ${credibility.toFixed(2)})`;
    }

    const event: DiscoveryEvent = {
      id: `disc_${Date.now()}_${++this.idCounter}`,
      source,
      candidate: {
        agentId: candidate.agentId,
        name: candidate.name,
        endpoint: candidate.endpoint,
        fingerprint: candidate.fingerprint,
        capabilities: candidate.capabilities,
      },
      evidence: {
        endpoint: candidate.endpoint,
        fingerprint: candidate.fingerprint,
        capabilities: candidate.capabilities,
        credibilityHint: credibility,
        rawPayload: candidate.rawPayload,
      },
      timestamp: new Date().toISOString(),
      resultAction: action,
      resultPeerId,
      resultReason,
    };

    this.eventLog.push(event);
    this.logger.info('Discovery event', { source, action, agentId: candidate.agentId });
    return event;
  }

  // ── Refresh ───────────────────────────────────────────────────────

  /**
   * Refresh a peer's discovery data via its source provider (Round 16.8).
   * Uses structured RefreshResult: success / failure / not-refreshable.
   */
  async refreshPeer(peerId: string): Promise<RefreshResult> {
    const peer = this.collective.getPeer(peerId);
    if (!peer) throw new Error(`Peer not found: ${peerId}`);

    // Find provider for this peer's source
    const provider = this.providers.get(peer.source as DiscoverySource);
    if (!provider?.refresh) {
      this.logger.debug('Peer source does not support refresh', { peerId, source: peer.source });
      return { status: 'not-refreshable', reason: `Source '${peer.source}' does not support refresh` };
    }

    try {
      const result = await provider.refresh(peerId);

      switch (result.status) {
        case 'success':
          // Genuine refresh success: update lastSeen and clear failures
          this.collective.refreshPeerHealth(peerId, {
            refreshedAt: new Date().toISOString(),
            latencyMs: result.latencyMs,
          });
          this.refreshFailures.delete(peerId);
          this.logger.debug('Peer refresh succeeded', { peerId });
          break;

        case 'failure':
          // Genuine failure: accumulate
          const failures = (this.refreshFailures.get(peerId) ?? 0) + 1;
          this.refreshFailures.set(peerId, failures);
          this.logger.warn('Peer refresh failed', { peerId, failures, reason: result.reason });
          break;

        case 'not-refreshable':
          this.logger.debug('Peer refresh not supported by provider', { peerId });
          break;
      }

      return result;
    } catch (err) {
      // Provider threw unexpectedly — treat as failure
      const failures = (this.refreshFailures.get(peerId) ?? 0) + 1;
      this.refreshFailures.set(peerId, failures);
      this.logger.warn('Peer refresh threw unexpectedly', { peerId, failures, error: String(err) });
      return { status: 'failure', reason: String(err) };
    }
  }

  // ── Staleness ─────────────────────────────────────────────────────

  /**
   * Scan all peers for staleness and apply lifecycle transitions.
   * Returns the actions taken.
   */
  markStalePeers(): { peerId: string; action: StalenessAction; reason: string }[] {
    const peers = this.collective.listPeers();
    const nowMs = Date.now();
    const evaluations = this.stalenessPolicy.evaluateAll(peers, nowMs, this.refreshFailures);
    const actions: { peerId: string; action: StalenessAction; reason: string }[] = [];

    for (const ev of evaluations) {
      if (ev.action === 'none' || ev.action === 'unobserved') continue;

      try {
        switch (ev.action) {
          case 'degrade':
            // Round 16.8 fix: use degradePeer() — does NOT touch lastSeen
            this.collective.degradePeer(ev.peerId, ev.reason, 'staleness-policy');
            break;
          case 'offline':
            this.collective.markPeerOffline(ev.peerId);
            break;
          case 'quarantine':
            this.collective.quarantinePeer(ev.peerId, ev.reason, 'staleness-policy');
            break;
        }
        actions.push({ peerId: ev.peerId, action: ev.action, reason: ev.reason });
      } catch (err) {
        this.logger.debug('Staleness action skipped', { peerId: ev.peerId, error: String(err) });
      }
    }

    if (actions.length > 0) {
      this.logger.info('Staleness scan complete', { actionsCount: actions.length });
    }

    return actions;
  }

  // ── Stats ─────────────────────────────────────────────────────────

  stats(): DiscoveryStats {
    const bySource: Partial<Record<DiscoverySource, number>> = {};
    const byAction: Record<DiscoveryResultAction, number> = {
      registered: 0, updated: 0, ignored: 0, quarantined: 0,
    };

    for (const e of this.eventLog) {
      bySource[e.source] = (bySource[e.source] ?? 0) + 1;
      byAction[e.resultAction]++;
    }

    // Count stale peers
    const peers = this.collective.listPeers();
    const stalePeerCount = peers.filter(p =>
      p.status === 'offline' || p.status === 'degraded',
    ).length;

    // Sum up all refresh failures across peers
    let refreshFailureCount = 0;
    for (const count of this.refreshFailures.values()) {
      refreshFailureCount += count;
    }

    return {
      totalEvents: this.eventLog.length,
      bySource,
      byAction,
      stalePeerCount,
      refreshFailureCount,
      lastDiscoveryAt: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].timestamp
        : undefined,
      registeredProviders: this.getRegisteredSources(),
    };
  }

  /**
   * Get all discovery events (read-only).
   */
  events(): readonly DiscoveryEvent[] {
    return this.eventLog;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BUILT-IN PROVIDERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Manual Discovery Provider — always available.
 * Does not auto-discover; ingestion happens via discoverManual().
 */
export class ManualDiscoveryProvider implements DiscoveryProvider {
  readonly source: DiscoverySource = 'manual';

  discover(): Promise<DiscoveryCandidate[]> {
    return Promise.resolve([]); // Manual discovery doesn't auto-discover
  }

  async refresh(_peerId: string): Promise<RefreshResult> {
    return { status: 'not-refreshable', reason: 'Manual peers do not support refresh' };
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Mock Registry Provider — simulates external registry for testing.
 * Provide a list of mock peers to "discover".
 */
export class MockRegistryProvider implements DiscoveryProvider {
  readonly source: DiscoverySource = 'registry';
  private readonly mockPeers: DiscoveryCandidate[];
  private available = true;
  private refreshBehaviour: 'not-refreshable' | 'success' | 'failure' = 'not-refreshable';

  constructor(mockPeers: DiscoveryCandidate[] = []) {
    this.mockPeers = mockPeers;
  }

  discover(): Promise<DiscoveryCandidate[]> {
    return Promise.resolve(this.mockPeers.map(p => ({
      ...p,
      credibilityHint: p.credibilityHint ?? 0.7,
    })));
  }

  async refresh(_peerId: string): Promise<RefreshResult> {
    switch (this.refreshBehaviour) {
      case 'success':
        return { status: 'success', latencyMs: 10 };
      case 'failure':
        return { status: 'failure', reason: 'Mock refresh failure' };
      default:
        return { status: 'not-refreshable', reason: 'Mock registry does not support refresh' };
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  setAvailable(v: boolean): void {
    this.available = v;
  }

  /** Configure refresh behaviour for testing */
  setRefreshBehaviour(b: 'not-refreshable' | 'success' | 'failure'): void {
    this.refreshBehaviour = b;
  }

  addPeer(peer: DiscoveryCandidate): void {
    this.mockPeers.push(peer);
  }
}
