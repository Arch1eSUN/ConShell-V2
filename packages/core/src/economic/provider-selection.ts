/**
 * Round 17.9 — G3 + G6: Provider Selection + Policy-Bound Economic Routing
 *
 * Provider-aware economic routing that:
 * - Compares multiple payment offers on cost/trust/speed/mandate-compatibility
 * - Detects no-pay alternatives
 * - Applies policy-bound constraints to routing decisions
 * - Respects mandate budget limits
 *
 * Design invariants:
 * - Provider routing CANNOT bypass mandate constraints
 * - Selection always produces structured reasoning
 * - No-pay alternatives are surfaced when available
 */

// ── Provider Profile ─────────────────────────────────────────────────

export interface ProviderProfile {
  readonly providerId: string;
  readonly name: string;
  readonly supportedAssets: readonly string[];
  readonly supportedNetworks: readonly string[];
  readonly trustScore: number; // 0-100
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly capabilities: readonly string[];
}

export interface ProviderProfileCreateInput {
  readonly name: string;
  readonly supportedAssets: readonly string[];
  readonly supportedNetworks: readonly string[];
  readonly trustScore: number;
  readonly riskLevel?: 'low' | 'medium' | 'high';
  readonly capabilities?: readonly string[];
}

// ── Selection Types ──────────────────────────────────────────────────

export type SelectionCriteria = 'cheapest' | 'safest' | 'mandate_compatible' | 'fastest';

export interface SelectionConstraint {
  readonly mandateMaxAmount?: number;
  readonly allowedAssets?: readonly string[];
  readonly allowedNetworks?: readonly string[];
  readonly requiredTrustScore?: number;
  readonly maxRiskLevel?: 'low' | 'medium' | 'high';
}

export interface OfferComparison {
  readonly offerId: string;
  readonly providerId: string;
  readonly amountCents: number;
  readonly trustScore: number;
  readonly estimatedLatencyMs: number;
  readonly mandateCompatible: boolean;
  readonly meetsConstraints: boolean;
  readonly score: number; // 0-100 composite
}

export interface ProviderSelectionResult {
  readonly selectedProviderId: string | null;
  readonly selectedOffer: import('./payment-negotiation.js').PaymentOffer | null;
  readonly alternativeOffers: readonly import('./payment-negotiation.js').PaymentOffer[];
  readonly reason: string;
  readonly policyApplied: readonly string[];
}

// ── No-Pay Alternative ───────────────────────────────────────────────

export interface NoPayAlternative {
  readonly alternativeResource: string;
  readonly reason: string;
  readonly estimatedSavingsCents: number;
}

// ── Provider Selector ────────────────────────────────────────────────

let providerCounter = 0;

const RISK_SCORE: Record<string, number> = {
  low: 90,
  medium: 60,
  high: 30,
};

export interface ProviderStats {
  readonly providerId: string;
  readonly successes: number;
  readonly failures: number;
  readonly totalPenaltyPoints: number;
  readonly totalBonusPoints: number;
  readonly originalTrustScore: number;
  readonly adjustedTrustScore: number;
}

export class ProviderSelector {
  private readonly providers = new Map<string, ProviderProfile>();
  private readonly noPayAlternatives = new Map<string, NoPayAlternative[]>();
  // G6: Runtime feedback tracking
  private readonly providerSuccesses = new Map<string, number>();
  private readonly providerFailures = new Map<string, number>();
  private readonly providerPenalties = new Map<string, number>();
  private readonly providerBonuses = new Map<string, number>();
  private readonly originalTrustScores = new Map<string, number>();

  // ── Provider Management ────────────────────────────────────────

  registerProvider(input: ProviderProfileCreateInput): ProviderProfile {
    if (input.trustScore < 0 || input.trustScore > 100) {
      throw new Error('Trust score must be between 0 and 100');
    }
    const profile: ProviderProfile = {
      providerId: `provider_${++providerCounter}`,
      name: input.name,
      supportedAssets: [...input.supportedAssets],
      supportedNetworks: [...input.supportedNetworks],
      trustScore: input.trustScore,
      riskLevel: input.riskLevel ?? 'medium',
      capabilities: [...(input.capabilities ?? [])],
    };
    this.providers.set(profile.providerId, profile);
    this.originalTrustScores.set(profile.providerId, input.trustScore);
    return profile;
  }

  getProvider(providerId: string): ProviderProfile | undefined {
    return this.providers.get(providerId);
  }

  all(): readonly ProviderProfile[] {
    return [...this.providers.values()];
  }

  // ── No-Pay Alternative Management ─────────────────────────────

  registerNoPayAlternative(resource: string, alternative: NoPayAlternative): void {
    if (!this.noPayAlternatives.has(resource)) {
      this.noPayAlternatives.set(resource, []);
    }
    this.noPayAlternatives.get(resource)!.push(alternative);
  }

  detectNoPayAlternatives(resource: string): readonly NoPayAlternative[] {
    return this.noPayAlternatives.get(resource) ?? [];
  }

  // ── Offer Selection ────────────────────────────────────────────

  selectBestOffer(
    offers: readonly import('./payment-negotiation.js').PaymentOffer[],
    constraints: SelectionConstraint,
    criteria: SelectionCriteria = 'mandate_compatible',
  ): ProviderSelectionResult {
    const policyApplied: string[] = [];
    const comparisons: OfferComparison[] = [];

    for (const offer of offers) {
      const meetsConstraints = this.checkConstraints(offer, constraints, policyApplied);
      const provider = this.providers.get(offer.providerId);

      const mandateCompatible = constraints.mandateMaxAmount !== undefined
        ? offer.amountCents <= constraints.mandateMaxAmount
        : true;

      // Composite score (0-100)
      const costScore = Math.max(0, 100 - (offer.amountCents / 100)); // lower cost = higher score
      // Round 18.3 G8: Use adjusted trust score from settlement feedback when available
      const adjustedTrust = provider ? provider.trustScore : offer.trustScore;
      const trustScoreVal = adjustedTrust;
      const speedScore = Math.max(0, 100 - (offer.estimatedLatencyMs / 100)); // lower latency = higher score
      const riskScore = provider ? (RISK_SCORE[provider.riskLevel] ?? 60) : 60;

      let score: number;
      switch (criteria) {
        case 'cheapest':
          score = costScore * 0.6 + trustScoreVal * 0.2 + riskScore * 0.2;
          break;
        case 'safest':
          score = riskScore * 0.4 + trustScoreVal * 0.4 + costScore * 0.1 + speedScore * 0.1;
          break;
        case 'fastest':
          score = speedScore * 0.5 + costScore * 0.2 + trustScoreVal * 0.2 + riskScore * 0.1;
          break;
        case 'mandate_compatible':
        default:
          score = (mandateCompatible ? 40 : 0) + costScore * 0.25 + trustScoreVal * 0.2 + riskScore * 0.15;
          break;
      }

      comparisons.push({
        offerId: offer.offerId,
        providerId: offer.providerId,
        amountCents: offer.amountCents,
        trustScore: offer.trustScore,
        estimatedLatencyMs: offer.estimatedLatencyMs,
        mandateCompatible,
        meetsConstraints,
        score,
      });
    }

    // Filter to constraint-meeting offers, then sort by score
    const eligible = comparisons.filter(c => c.meetsConstraints && c.mandateCompatible);
    eligible.sort((a, b) => b.score - a.score);

    if (eligible.length === 0) {
      // Fallback: try constraint-meeting but not mandate-compatible
      const fallback = comparisons.filter(c => c.meetsConstraints);
      fallback.sort((a, b) => b.score - a.score);

      if (fallback.length === 0) {
        return {
          selectedProviderId: null,
          selectedOffer: null,
          alternativeOffers: [],
          reason: 'No offers meet selection constraints',
          policyApplied,
        };
      }

      const selected = offers.find(o => o.offerId === fallback[0].offerId)!;
      policyApplied.push('mandate_budget_exceeded_fallback');
      return {
        selectedProviderId: selected.providerId,
        selectedOffer: selected,
        alternativeOffers: fallback.slice(1).map(c => offers.find(o => o.offerId === c.offerId)!),
        reason: `Selected ${selected.providerId} (exceeds mandate budget, requires escalation)`,
        policyApplied,
      };
    }

    const best = eligible[0];
    const selected = offers.find(o => o.offerId === best.offerId)!;
    const alternatives = eligible.slice(1).map(c => offers.find(o => o.offerId === c.offerId)!);

    return {
      selectedProviderId: selected.providerId,
      selectedOffer: selected,
      alternativeOffers: alternatives,
      reason: `Selected ${selected.providerId} (score: ${best.score.toFixed(1)}, criteria: ${criteria})`,
      policyApplied,
    };
  }

  compareOffers(
    offers: readonly import('./payment-negotiation.js').PaymentOffer[],
    constraints: SelectionConstraint = {},
  ): readonly OfferComparison[] {
    const result = this.selectBestOffer(offers, constraints);
    // Re-run to get full comparison data
    const comparisons: OfferComparison[] = [];
    for (const offer of offers) {
      const provider = this.providers.get(offer.providerId);
      const mandateCompatible = constraints.mandateMaxAmount !== undefined
        ? offer.amountCents <= constraints.mandateMaxAmount
        : true;
      const meetsConstraints = this.checkConstraints(offer, constraints, []);

      comparisons.push({
        offerId: offer.offerId,
        providerId: offer.providerId,
        amountCents: offer.amountCents,
        trustScore: offer.trustScore,
        estimatedLatencyMs: offer.estimatedLatencyMs,
        mandateCompatible,
        meetsConstraints,
        score: 0, // simplified for comparison view
      });
    }
    return comparisons;
  }

  // ── Private ────────────────────────────────────────────────────

  private checkConstraints(
    offer: import('./payment-negotiation.js').PaymentOffer,
    constraints: SelectionConstraint,
    policyApplied: string[],
  ): boolean {
    if (constraints.allowedAssets && constraints.allowedAssets.length > 0) {
      if (!constraints.allowedAssets.includes(offer.asset)) {
        policyApplied.push(`asset_filter:${offer.asset}_not_allowed`);
        return false;
      }
    }

    if (constraints.allowedNetworks && constraints.allowedNetworks.length > 0) {
      if (!constraints.allowedNetworks.includes(offer.network)) {
        policyApplied.push(`network_filter:${offer.network}_not_allowed`);
        return false;
      }
    }

    if (constraints.requiredTrustScore !== undefined) {
      if (offer.trustScore < constraints.requiredTrustScore) {
        policyApplied.push(`trust_filter:${offer.trustScore}<${constraints.requiredTrustScore}`);
        return false;
      }
    }

    if (constraints.maxRiskLevel !== undefined) {
      const provider = this.providers.get(offer.providerId);
      if (provider) {
        const riskOrder = ['low', 'medium', 'high'];
        const offerRiskIdx = riskOrder.indexOf(provider.riskLevel);
        const maxRiskIdx = riskOrder.indexOf(constraints.maxRiskLevel);
        if (offerRiskIdx > maxRiskIdx) {
          policyApplied.push(`risk_filter:${provider.riskLevel}>${constraints.maxRiskLevel}`);
          return false;
        }
      }
    }

    return true;
  }

  // ── G6: Runtime Feedback from Settlement Outcomes ──────────────

  applyRiskPenalty(providerId: string, reason: string, penaltyPoints: number): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    this.providerFailures.set(providerId, (this.providerFailures.get(providerId) ?? 0) + 1);
    this.providerPenalties.set(providerId, (this.providerPenalties.get(providerId) ?? 0) + penaltyPoints);

    // Adjust trust score downward (floor at 0)
    const newTrust = Math.max(0, provider.trustScore - penaltyPoints);
    const updatedProfile: ProviderProfile = {
      ...provider,
      trustScore: newTrust,
    };
    this.providers.set(providerId, updatedProfile);
  }

  applySuccessBonus(providerId: string, bonusPoints: number): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    this.providerSuccesses.set(providerId, (this.providerSuccesses.get(providerId) ?? 0) + 1);
    this.providerBonuses.set(providerId, (this.providerBonuses.get(providerId) ?? 0) + bonusPoints);

    // Adjust trust score upward (cap at 100)
    const newTrust = Math.min(100, provider.trustScore + bonusPoints);
    const updatedProfile: ProviderProfile = {
      ...provider,
      trustScore: newTrust,
    };
    this.providers.set(providerId, updatedProfile);
  }

  getProviderStats(providerId: string): ProviderStats | null {
    const provider = this.providers.get(providerId);
    if (!provider) return null;

    return {
      providerId,
      successes: this.providerSuccesses.get(providerId) ?? 0,
      failures: this.providerFailures.get(providerId) ?? 0,
      totalPenaltyPoints: this.providerPenalties.get(providerId) ?? 0,
      totalBonusPoints: this.providerBonuses.get(providerId) ?? 0,
      originalTrustScore: this.originalTrustScores.get(providerId) ?? provider.trustScore,
      adjustedTrustScore: provider.trustScore,
    };
  }
}
