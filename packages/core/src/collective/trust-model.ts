/**
 * Trust Model — Round 16.6 → 16.7
 *
 * Computes explainable, multi-dimensional trust scores for peers.
 * Each dimension produces a 0–1 score with reasons.
 * Overall tier is derived from weighted average.
 *
 * Weights: identity(0.25) + capability(0.15) + governance(0.15) + economic(0.15) + uptime(0.1) + reputation(0.2)
 */
import type {
  TrustSummary,
  TrustScore,
  TrustTier,
  TrustDimension,
  PeerRecord,
} from './collective-contract.js';
import type { ReputationSummary } from './reputation-contract.js';

// ── Evidence Input ───────────────────────────────────────────────────

export interface TrustEvidence {
  /** Does the peer have a verified identity chain? */
  hasVerifiedIdentity?: boolean;
  /** Is the fingerprint valid and chains to a known root? */
  fingerprintValid?: boolean;
  /** Generation depth (lower = closer to root = more trusted) */
  generation?: number;

  /** Number of declared capabilities */
  declaredCapabilities?: number;
  /** Number of verified capabilities */
  verifiedCapabilities?: number;

  /** Total governance-governed actions */
  totalGovernedActions?: number;
  /** Actions that were compliant */
  compliantActions?: number;
  /** Has the peer ever been denied by governance? */
  hasGovernanceDenials?: boolean;

  /** Total funding allocated */
  totalFundingAllocated?: number;
  /** Total funding spent */
  totalFundingSpent?: number;
  /** Has funding ever been exhausted unexpectedly? */
  hasExhaustedFunding?: boolean;

  /** Is the peer currently reachable? */
  isOnline?: boolean;
  /** Consecutive health check successes */
  consecutiveHealthChecks?: number;
  /** Has the peer ever been degraded? */
  hasDegradationHistory?: boolean;
  /** Seconds since last seen */
  secondsSinceLastSeen?: number;

  /** Reputation summary (injected from ReputationService) */
  reputationSummary?: ReputationSummary;
}

// ── Dimension Weights ────────────────────────────────────────────────

export const TRUST_WEIGHTS: Record<TrustDimension, number> = {
  identity:   0.25,
  capability: 0.15,
  governance: 0.15,
  economic:   0.15,
  uptime:     0.1,
  reputation: 0.2,
};

// ── Tier Thresholds ──────────────────────────────────────────────────

export const TRUST_TIER_THRESHOLDS: { tier: TrustTier; min: number }[] = [
  { tier: 'trusted',     min: 0.8 },
  { tier: 'provisional', min: 0.5 },
  { tier: 'degraded',    min: 0.3 },
  { tier: 'untrusted',   min: 0.0 },
];

export function tierFromScore(score: number): TrustTier {
  for (const t of TRUST_TIER_THRESHOLDS) {
    if (score >= t.min) return t.tier;
  }
  return 'untrusted';
}

// ── Dimension Scorers ────────────────────────────────────────────────

function scoreIdentity(ev: TrustEvidence): TrustScore {
  let score = 0.5; // baseline for known peer
  const reasons: string[] = [];

  if (ev.hasVerifiedIdentity) {
    score += 0.3;
    reasons.push('Identity chain verified');
  } else {
    reasons.push('Identity not verified');
  }

  if (ev.fingerprintValid) {
    score += 0.2;
    reasons.push('Fingerprint valid');
  } else if (ev.fingerprintValid === false) {
    score -= 0.3;
    reasons.push('Fingerprint invalid or missing');
  }

  if (ev.generation !== undefined) {
    if (ev.generation <= 1) {
      reasons.push('Direct child (generation 1)');
    } else if (ev.generation <= 3) {
      reasons.push(`Generation ${ev.generation} — close lineage`);
    } else {
      score -= 0.1;
      reasons.push(`Generation ${ev.generation} — distant lineage`);
    }
  }

  return { dimension: 'identity', score: clamp(score), reasons };
}

function scoreCapability(ev: TrustEvidence): TrustScore {
  const reasons: string[] = [];
  const declared = ev.declaredCapabilities ?? 0;
  const verified = ev.verifiedCapabilities ?? 0;

  if (declared === 0) {
    return { dimension: 'capability', score: 0.5, reasons: ['No capabilities declared'] };
  }

  const ratio = verified / declared;
  const score = 0.3 + ratio * 0.7; // 0.3 baseline for declaring, up to 1.0

  reasons.push(`${verified}/${declared} capabilities verified (${(ratio * 100).toFixed(0)}%)`);
  if (ratio >= 1.0) reasons.push('All capabilities verified');
  else if (ratio < 0.5) reasons.push('Most capabilities unverified');

  return { dimension: 'capability', score: clamp(score), reasons };
}

function scoreGovernance(ev: TrustEvidence): TrustScore {
  const reasons: string[] = [];
  const total = ev.totalGovernedActions ?? 0;
  const compliant = ev.compliantActions ?? 0;

  if (total === 0) {
    return { dimension: 'governance', score: 0.5, reasons: ['No governance history'] };
  }

  const rate = compliant / total;
  let score = rate;
  reasons.push(`${compliant}/${total} actions compliant (${(rate * 100).toFixed(0)}%)`);

  if (ev.hasGovernanceDenials) {
    score -= 0.1;
    reasons.push('Has governance denials');
  }

  return { dimension: 'governance', score: clamp(score), reasons };
}

function scoreEconomic(ev: TrustEvidence): TrustScore {
  const reasons: string[] = [];
  const allocated = ev.totalFundingAllocated ?? 0;
  const spent = ev.totalFundingSpent ?? 0;

  if (allocated === 0) {
    return { dimension: 'economic', score: 0.5, reasons: ['No funding history'] };
  }

  const utilization = spent / allocated;
  let score = 0.8; // baseline for having funding

  if (utilization > 0.95) {
    score -= 0.3;
    reasons.push('Near or at budget exhaustion');
  } else if (utilization > 0.8) {
    score -= 0.1;
    reasons.push('High budget utilization');
  } else {
    reasons.push('Budget within healthy range');
  }

  if (ev.hasExhaustedFunding) {
    score -= 0.2;
    reasons.push('Has exhausted funding before');
  }

  return { dimension: 'economic', score: clamp(score), reasons };
}

function scoreUptime(ev: TrustEvidence): TrustScore {
  const reasons: string[] = [];
  let score = 0.5;

  if (ev.isOnline) {
    score += 0.3;
    reasons.push('Currently online');
  } else if (ev.isOnline === false) {
    score -= 0.3;
    reasons.push('Currently offline');
  }

  const checks = ev.consecutiveHealthChecks ?? 0;
  if (checks >= 10) {
    score += 0.2;
    reasons.push(`${checks} consecutive health checks passed`);
  } else if (checks >= 3) {
    score += 0.1;
    reasons.push(`${checks} consecutive health checks passed`);
  } else if (checks === 0) {
    reasons.push('No health check history');
  }

  if (ev.hasDegradationHistory) {
    score -= 0.1;
    reasons.push('Has degradation history');
  }

  if (ev.secondsSinceLastSeen !== undefined) {
    if (ev.secondsSinceLastSeen > 3600) {
      score -= 0.2;
      reasons.push('Last seen > 1 hour ago');
    } else if (ev.secondsSinceLastSeen > 300) {
      score -= 0.1;
      reasons.push('Last seen > 5 minutes ago');
    }
  }

  return { dimension: 'uptime', score: clamp(score), reasons };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Compute a full trust summary for a peer given evidence.
 */
export function computeTrust(evidence: TrustEvidence): TrustSummary {
  const scores: TrustScore[] = [
    scoreIdentity(evidence),
    scoreCapability(evidence),
    scoreGovernance(evidence),
    scoreEconomic(evidence),
    scoreUptime(evidence),
    scoreReputation(evidence),
  ];

  let overallScore = 0;
  for (const s of scores) {
    overallScore += s.score * TRUST_WEIGHTS[s.dimension];
  }
  overallScore = clamp(overallScore);

  return {
    tier: tierFromScore(overallScore),
    overallScore,
    scores,
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Create a default trust summary for a newly registered peer.
 */
export function defaultTrust(): TrustSummary {
  return computeTrust({});
}

// ── Reputation Scorer (Round 16.7) ──────────────────────────────────

function scoreReputation(ev: TrustEvidence): TrustScore {
  const reasons: string[] = [];

  if (!ev.reputationSummary) {
    return { dimension: 'reputation' as TrustDimension, score: 0.5, reasons: ['No reputation history'] };
  }

  const rep = ev.reputationSummary;
  let score = rep.overallScore;
  reasons.push(`Reputation: ${rep.tier} (${rep.overallScore.toFixed(2)})`);

  // Trend adjustment
  if (rep.trend === 'improving') {
    score += 0.05;
    reasons.push('Trend: improving (+0.05)');
  } else if (rep.trend === 'declining') {
    score -= 0.05;
    reasons.push('Trend: declining (-0.05)');
  }

  // Event volume confidence
  if (rep.totalEvents >= 20) {
    reasons.push(`High confidence: ${rep.totalEvents} events`);
  } else if (rep.totalEvents >= 5) {
    reasons.push(`Moderate confidence: ${rep.totalEvents} events`);
  } else {
    score = score * 0.7 + 0.5 * 0.3; // blend toward neutral when low evidence
    reasons.push(`Low confidence: ${rep.totalEvents} events`);
  }

  return { dimension: 'reputation' as TrustDimension, score: clamp(score), reasons };
}

// ── Helpers ──────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}
