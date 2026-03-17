/**
 * Reputation Contract — Round 16.7
 *
 * Type definitions for the reputation domain.
 * ReputationService is the canonical owner.
 *
 * Key distinction:
 *   Trust = current snapshot judgment (evidence-based)
 *   Reputation = historical performance accumulation (event-based)
 *   Trust CONSUMES reputation as one input dimension.
 */

// ── Reputation Event Kind ────────────────────────────────────────────

export type ReputationEventKind =
  | 'delegation_success'
  | 'delegation_failure'
  | 'delegation_timeout'
  | 'delegation_rejected'
  | 'governance_compliance'
  | 'governance_denial'
  | 'stale_period'
  | 'online_restored'
  | 'health_check_pass';

// ── Reputation Event ─────────────────────────────────────────────────

export interface ReputationEvent {
  /** Unique event ID */
  id: string;
  /** Target peer ID */
  peerId: string;
  /** Event kind */
  kind: ReputationEventKind;
  /** Timestamp */
  timestamp: string;
  /** Weight of this event (default 1.0, recent events decay less) */
  weight: number;
  /** Extra metadata */
  metadata?: Record<string, unknown>;
}

// ── Reputation Dimension ─────────────────────────────────────────────

export type ReputationDimension =
  | 'reliability'    // delegation success/failure/timeout
  | 'compliance'     // governance compliance/denial
  | 'availability'   // uptime, stale periods, online restorations
  | 'economic';      // funding discipline (future)

// ── Reputation Tier ──────────────────────────────────────────────────

export type ReputationTier =
  | 'excellent'   // ≥ 0.85
  | 'good'        // ≥ 0.65
  | 'neutral'     // ≥ 0.45
  | 'poor'        // ≥ 0.25
  | 'terrible';   // < 0.25

export const REPUTATION_TIER_THRESHOLDS: { tier: ReputationTier; min: number }[] = [
  { tier: 'excellent', min: 0.85 },
  { tier: 'good',      min: 0.65 },
  { tier: 'neutral',   min: 0.45 },
  { tier: 'poor',      min: 0.25 },
  { tier: 'terrible',  min: 0.0 },
];

export function reputationTierFromScore(score: number): ReputationTier {
  for (const t of REPUTATION_TIER_THRESHOLDS) {
    if (score >= t.min) return t.tier;
  }
  return 'terrible';
}

// ── Reputation Trend ─────────────────────────────────────────────────

export type ReputationTrend = 'improving' | 'stable' | 'declining';

// ── Reputation Summary ───────────────────────────────────────────────

export interface ReputationDimensionScore {
  dimension: ReputationDimension;
  score: number;   // 0.0 – 1.0
  eventCount: number;
  positiveCount: number;
  negativeCount: number;
}

export interface ReputationSummary {
  /** Peer ID */
  peerId: string;
  /** Overall reputation score (weighted average of dimensions) */
  overallScore: number;
  /** Overall tier */
  tier: ReputationTier;
  /** Trend over recent window */
  trend: ReputationTrend;
  /** Per-dimension scores */
  dimensions: ReputationDimensionScore[];
  /** Total events recorded */
  totalEvents: number;
  /** Last event timestamp */
  lastEventAt?: string;
}

// ── Event → Dimension Mapping ────────────────────────────────────────

export const EVENT_DIMENSION_MAP: Record<ReputationEventKind, ReputationDimension> = {
  delegation_success:    'reliability',
  delegation_failure:    'reliability',
  delegation_timeout:    'reliability',
  delegation_rejected:   'reliability',
  governance_compliance: 'compliance',
  governance_denial:     'compliance',
  stale_period:          'availability',
  online_restored:       'availability',
  health_check_pass:     'availability',
};

/** Is this event kind positive for reputation? */
export const EVENT_POLARITY: Record<ReputationEventKind, 'positive' | 'negative'> = {
  delegation_success:    'positive',
  delegation_failure:    'negative',
  delegation_timeout:    'negative',
  delegation_rejected:   'negative',
  governance_compliance: 'positive',
  governance_denial:     'negative',
  stale_period:          'negative',
  online_restored:       'positive',
  health_check_pass:     'positive',
};

// ── Reputation Stats ─────────────────────────────────────────────────

export interface ReputationStats {
  totalPeersTracked: number;
  tierDistribution: Record<ReputationTier, number>;
  totalEvents: number;
  avgScore: number;
}
