/**
 * Reputation Service — Round 16.7
 *
 * Canonical owner of peer reputation.
 * Accumulates historical events and computes per-dimension + overall scores.
 *
 * Trust (snapshot) ≠ Reputation (accumulated history).
 * Trust consumes reputation as one input dimension.
 *
 * Uses exponential decay weighting: recent events count more.
 */
import type {
  ReputationEvent,
  ReputationEventKind,
  ReputationSummary,
  ReputationDimensionScore,
  ReputationDimension,
  ReputationTier,
  ReputationTrend,
  ReputationStats,
} from './reputation-contract.js';
import {
  EVENT_DIMENSION_MAP,
  EVENT_POLARITY,
  reputationTierFromScore,
  REPUTATION_TIER_THRESHOLDS,
} from './reputation-contract.js';
import type { Logger } from '../types/common.js';

// Re-export contract
export * from './reputation-contract.js';

// ── Options ──────────────────────────────────────────────────────────

export interface ReputationServiceOptions {
  logger: Logger;
  /** Window size for trend calculation (default 10 events) */
  trendWindowSize?: number;
  /** Decay factor for older events (0–1, default 0.95) */
  decayFactor?: number;
}

// ── ReputationService ────────────────────────────────────────────────

export class ReputationService {
  private readonly events = new Map<string, ReputationEvent[]>(); // peerId → events
  private readonly logger: Logger;
  private readonly trendWindowSize: number;
  private readonly decayFactor: number;
  private idCounter = 0;

  constructor(opts: ReputationServiceOptions) {
    this.logger = opts.logger;
    this.trendWindowSize = opts.trendWindowSize ?? 10;
    this.decayFactor = opts.decayFactor ?? 0.95;
  }

  // ── Record Event ──────────────────────────────────────────────────

  /**
   * Record a reputation event for a peer.
   * Returns the created event.
   */
  recordEvent(
    peerId: string,
    kind: ReputationEventKind,
    metadata?: Record<string, unknown>,
  ): ReputationEvent {
    const event: ReputationEvent = {
      id: `repev_${Date.now()}_${++this.idCounter}`,
      peerId,
      kind,
      timestamp: new Date().toISOString(),
      weight: 1.0,
      metadata,
    };

    if (!this.events.has(peerId)) {
      this.events.set(peerId, []);
    }
    this.events.get(peerId)!.push(event);

    this.logger.debug('Reputation event recorded', { peerId, kind });
    return event;
  }

  // ── Query ─────────────────────────────────────────────────────────

  /**
   * Get the full reputation summary for a peer.
   */
  getReputation(peerId: string): ReputationSummary {
    const peerEvents = this.events.get(peerId) ?? [];
    const dimensions = this.computeDimensions(peerEvents);
    const overallScore = this.computeOverall(dimensions);
    const trend = this.computeTrend(peerEvents);

    return {
      peerId,
      overallScore,
      tier: reputationTierFromScore(overallScore),
      trend,
      dimensions,
      totalEvents: peerEvents.length,
      lastEventAt: peerEvents.length > 0
        ? peerEvents[peerEvents.length - 1].timestamp
        : undefined,
    };
  }

  /**
   * Get top N peers by reputation score.
   */
  getTopPeers(n = 5): ReputationSummary[] {
    return this.getAllSummaries()
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, n);
  }

  /**
   * Get worst N peers by reputation score.
   */
  getWorstPeers(n = 5): ReputationSummary[] {
    return this.getAllSummaries()
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, n);
  }

  /**
   * Get trend for a specific peer.
   */
  getTrend(peerId: string): ReputationTrend {
    const peerEvents = this.events.get(peerId) ?? [];
    return this.computeTrend(peerEvents);
  }

  /**
   * Get all events for a peer (read-only).
   */
  getEvents(peerId: string): readonly ReputationEvent[] {
    return this.events.get(peerId) ?? [];
  }

  /**
   * Check if a peer has any reputation history.
   */
  hasReputation(peerId: string): boolean {
    return (this.events.get(peerId)?.length ?? 0) > 0;
  }

  // ── Stats ─────────────────────────────────────────────────────────

  stats(): ReputationStats {
    const summaries = this.getAllSummaries();
    const tierDist: Record<ReputationTier, number> = {
      excellent: 0, good: 0, neutral: 0, poor: 0, terrible: 0,
    };
    let totalScore = 0;

    for (const s of summaries) {
      tierDist[s.tier]++;
      totalScore += s.overallScore;
    }

    let totalEvents = 0;
    for (const evts of this.events.values()) {
      totalEvents += evts.length;
    }

    return {
      totalPeersTracked: this.events.size,
      tierDistribution: tierDist,
      totalEvents,
      avgScore: summaries.length > 0 ? totalScore / summaries.length : 0,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────

  private getAllSummaries(): ReputationSummary[] {
    const result: ReputationSummary[] = [];
    for (const peerId of this.events.keys()) {
      result.push(this.getReputation(peerId));
    }
    return result;
  }

  private computeDimensions(events: ReputationEvent[]): ReputationDimensionScore[] {
    const dims: ReputationDimension[] = ['reliability', 'compliance', 'availability', 'economic'];
    return dims.map(dim => this.scoreDimension(dim, events));
  }

  private scoreDimension(dim: ReputationDimension, events: ReputationEvent[]): ReputationDimensionScore {
    const dimEvents = events.filter(e => EVENT_DIMENSION_MAP[e.kind] === dim);

    if (dimEvents.length === 0) {
      return { dimension: dim, score: 0.5, eventCount: 0, positiveCount: 0, negativeCount: 0 };
    }

    let weightedPositive = 0;
    let weightedTotal = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    // Apply exponential decay: more recent events have higher weight
    for (let i = 0; i < dimEvents.length; i++) {
      const age = dimEvents.length - 1 - i; // 0 = most recent
      const decayWeight = Math.pow(this.decayFactor, age) * dimEvents[i].weight;
      const isPositive = EVENT_POLARITY[dimEvents[i].kind] === 'positive';

      if (isPositive) {
        weightedPositive += decayWeight;
        positiveCount++;
      } else {
        negativeCount++;
      }
      weightedTotal += decayWeight;
    }

    const score = weightedTotal > 0 ? weightedPositive / weightedTotal : 0.5;

    return {
      dimension: dim,
      score: Math.max(0, Math.min(1, score)),
      eventCount: dimEvents.length,
      positiveCount,
      negativeCount,
    };
  }

  private computeOverall(dimensions: ReputationDimensionScore[]): number {
    // Weighted: reliability(0.4) + compliance(0.25) + availability(0.25) + economic(0.1)
    const weights: Record<ReputationDimension, number> = {
      reliability:  0.4,
      compliance:   0.25,
      availability: 0.25,
      economic:     0.1,
    };

    let total = 0;
    for (const d of dimensions) {
      total += d.score * (weights[d.dimension] ?? 0);
    }
    return Math.max(0, Math.min(1, total));
  }

  private computeTrend(events: ReputationEvent[]): ReputationTrend {
    if (events.length < 3) return 'stable';

    const window = events.slice(-this.trendWindowSize);
    const halfIdx = Math.floor(window.length / 2);
    const firstHalf = window.slice(0, halfIdx);
    const secondHalf = window.slice(halfIdx);

    const firstPositive = firstHalf.filter(e => EVENT_POLARITY[e.kind] === 'positive').length;
    const secondPositive = secondHalf.filter(e => EVENT_POLARITY[e.kind] === 'positive').length;

    const firstRate = firstHalf.length > 0 ? firstPositive / firstHalf.length : 0.5;
    const secondRate = secondHalf.length > 0 ? secondPositive / secondHalf.length : 0.5;

    const diff = secondRate - firstRate;
    if (diff > 0.15) return 'improving';
    if (diff < -0.15) return 'declining';
    return 'stable';
  }
}
