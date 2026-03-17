/**
 * Peer Selector — Round 16.7
 *
 * Explainable peer selection for delegation.
 * Reads trust + reputation + capabilities + status → ranked list with reasons.
 *
 * Not a black box: every selection decision has selectionReasons[].
 */
import type { PeerRecord, PeerKind, TrustTier } from './collective-contract.js';
import type { CollectiveService } from './collective-service.js';
import type { ReputationService } from './reputation-service.js';
import type { ReputationTier, ReputationSummary } from './reputation-contract.js';

// ── Selection Criteria ───────────────────────────────────────────────

export interface PeerSelectionCriteria {
  /** Required capabilities (peer must have at least these) */
  requiredCapabilities?: string[];
  /** Minimum trust tier */
  minTrustTier?: TrustTier;
  /** Minimum reputation tier */
  minReputationTier?: ReputationTier;
  /** Peer IDs to exclude */
  excludePeerIds?: string[];
  /** Prefer specific peer kind */
  preferKind?: PeerKind;
  /** Maximum results */
  maxResults?: number;
}

// ── Selection Result ─────────────────────────────────────────────────

export interface PeerCandidate {
  peer: PeerRecord;
  /** Combined selection score (0–1) */
  score: number;
  /** Trust component */
  trustScore: number;
  /** Reputation component */
  reputationScore: number;
  /** Capability match score */
  capabilityScore: number;
  /** Why this peer was chosen / ranked this way */
  selectionReasons: string[];
}

export interface PeerSelectionResult {
  /** Ranked candidates (best first) */
  candidates: PeerCandidate[];
  /** Total peers considered */
  totalConsidered: number;
  /** Peers excluded and reasons */
  excluded: { peerId: string; reason: string }[];
  /** Timestamp */
  selectedAt: string;
}

// ── Trust Tier Scores ────────────────────────────────────────────────

const TRUST_TIER_SCORE: Record<TrustTier, number> = {
  trusted: 1.0,
  provisional: 0.6,
  degraded: 0.3,
  untrusted: 0.1,
};

const TRUST_TIER_ORDER: TrustTier[] = ['trusted', 'provisional', 'degraded', 'untrusted'];

const REPUTATION_TIER_SCORE: Record<ReputationTier, number> = {
  excellent: 1.0,
  good: 0.75,
  neutral: 0.5,
  poor: 0.25,
  terrible: 0.05,
};

const REPUTATION_TIER_ORDER: ReputationTier[] = ['excellent', 'good', 'neutral', 'poor', 'terrible'];

// ── Weights ──────────────────────────────────────────────────────────

export const SELECTION_WEIGHTS = {
  trust: 0.4,
  reputation: 0.4,
  capability: 0.2,
} as const;

/** Status / trend score adjustments (v1 heuristic — Round 16.8) */
export const SELECTION_ADJUSTMENTS = {
  statusTrusted: 0.05,
  statusDegraded: -0.10,
  trendImproving: 0.03,
  trendDeclining: -0.05,
} as const;

// ── PeerSelector ─────────────────────────────────────────────────────

export class PeerSelector {
  constructor(
    private readonly collective: CollectiveService,
    private readonly reputation: ReputationService,
  ) {}

  /**
   * Select peers for delegation based on criteria.
   * Returns ranked list with explainable reasons.
   */
  select(criteria: PeerSelectionCriteria = {}): PeerSelectionResult {
    const allPeers = this.collective.listPeers();
    const excluded: { peerId: string; reason: string }[] = [];
    const candidates: PeerCandidate[] = [];
    const maxResults = criteria.maxResults ?? 10;

    for (const peer of allPeers) {
      // Hard exclusions
      const exclusion = this.checkExclusion(peer, criteria);
      if (exclusion) {
        excluded.push({ peerId: peer.id, reason: exclusion });
        continue;
      }

      // Score the candidate
      const candidate = this.scorePeer(peer, criteria);
      candidates.push(candidate);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return {
      candidates: candidates.slice(0, maxResults),
      totalConsidered: allPeers.length,
      excluded,
      selectedAt: new Date().toISOString(),
    };
  }

  /**
   * Select the single best peer for delegation.
   */
  selectBest(criteria: PeerSelectionCriteria = {}): PeerCandidate | null {
    const result = this.select({ ...criteria, maxResults: 1 });
    return result.candidates[0] ?? null;
  }

  // ── Internal ───────────────────────────────────────────────────────

  private checkExclusion(peer: PeerRecord, criteria: PeerSelectionCriteria): string | null {
    // Hard status exclusions
    if (peer.status === 'revoked') return 'Status: revoked (terminal)';
    if (peer.status === 'quarantined') return 'Status: quarantined';
    if (peer.status === 'offline') return 'Status: offline';

    // Explicit exclusion list
    if (criteria.excludePeerIds?.includes(peer.id)) {
      return 'Explicitly excluded';
    }

    // Trust tier minimum
    if (criteria.minTrustTier) {
      const minIdx = TRUST_TIER_ORDER.indexOf(criteria.minTrustTier);
      const peerIdx = TRUST_TIER_ORDER.indexOf(peer.trust.tier);
      if (peerIdx > minIdx) {
        return `Trust tier ${peer.trust.tier} below minimum ${criteria.minTrustTier}`;
      }
    }

    // Reputation tier minimum
    if (criteria.minReputationTier) {
      const rep = this.reputation.getReputation(peer.id);
      const minIdx = REPUTATION_TIER_ORDER.indexOf(criteria.minReputationTier);
      const peerIdx = REPUTATION_TIER_ORDER.indexOf(rep.tier);
      if (peerIdx > minIdx) {
        return `Reputation tier ${rep.tier} below minimum ${criteria.minReputationTier}`;
      }
    }

    // Required capabilities
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      const missing = criteria.requiredCapabilities.filter(
        c => !peer.capabilities.declared.includes(c) && !peer.capabilities.verified.includes(c),
      );
      if (missing.length > 0) {
        return `Missing capabilities: ${missing.join(', ')}`;
      }
    }

    return null;
  }

  private scorePeer(peer: PeerRecord, criteria: PeerSelectionCriteria): PeerCandidate {
    const reasons: string[] = [];

    // Trust score
    const trustScore = TRUST_TIER_SCORE[peer.trust.tier] ?? 0.5;
    reasons.push(`Trust: ${peer.trust.tier} (${trustScore.toFixed(2)})`);

    // Reputation score
    const rep = this.reputation.getReputation(peer.id);
    const reputationScore = rep.overallScore;
    reasons.push(`Reputation: ${rep.tier} (${reputationScore.toFixed(2)}, trend: ${rep.trend})`);

    // Capability match score
    let capabilityScore = 0.5; // default if no specific requirements
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      const verified = criteria.requiredCapabilities.filter(
        c => peer.capabilities.verified.includes(c),
      ).length;
      const declared = criteria.requiredCapabilities.filter(
        c => peer.capabilities.declared.includes(c),
      ).length;
      capabilityScore = (verified * 1.0 + (declared - verified) * 0.5) / criteria.requiredCapabilities.length;
      reasons.push(`Capabilities: ${verified} verified, ${declared} declared of ${criteria.requiredCapabilities.length} required`);
    } else {
      const totalCaps = peer.capabilities.declared.length + peer.capabilities.verified.length;
      if (totalCaps > 0) {
        capabilityScore = 0.6;
        reasons.push(`Capabilities: ${totalCaps} total (no specific requirements)`);
      } else {
        reasons.push('No capabilities');
      }
    }

    // Kind bonus
    if (criteria.preferKind && peer.kind === criteria.preferKind) {
      capabilityScore = Math.min(1, capabilityScore + 0.1);
      reasons.push(`Kind bonus: preferred ${criteria.preferKind} (+0.1 to capability)`);
    }

    // Status adjustment — enters score (Round 16.8: reasons/score reconciliation)
    let statusAdjustment = 0;
    if (peer.status === 'trusted') {
      statusAdjustment = SELECTION_ADJUSTMENTS.statusTrusted;
      reasons.push(`Status adjustment: trusted (+${statusAdjustment.toFixed(2)} to score)`);
    } else if (peer.status === 'degraded') {
      statusAdjustment = SELECTION_ADJUSTMENTS.statusDegraded;
      reasons.push(`Status adjustment: degraded (${statusAdjustment.toFixed(2)} to score)`);
    }

    // Reputation trend adjustment — enters score (Round 16.8)
    let trendAdjustment = 0;
    if (rep.trend === 'improving') {
      trendAdjustment = SELECTION_ADJUSTMENTS.trendImproving;
      reasons.push(`Trend adjustment: improving (+${trendAdjustment.toFixed(2)} to score)`);
    } else if (rep.trend === 'declining') {
      trendAdjustment = SELECTION_ADJUSTMENTS.trendDeclining;
      reasons.push(`Trend adjustment: declining (${trendAdjustment.toFixed(2)} to score)`);
    }

    // Combined score (clamped to [0, 1])
    const rawScore =
      trustScore * SELECTION_WEIGHTS.trust +
      reputationScore * SELECTION_WEIGHTS.reputation +
      capabilityScore * SELECTION_WEIGHTS.capability +
      statusAdjustment +
      trendAdjustment;
    const score = Math.max(0, Math.min(1, rawScore));

    return {
      peer,
      score,
      trustScore,
      reputationScore,
      capabilityScore,
      selectionReasons: reasons,
    };
  }
}
