/**
 * Round 17.9 — G1 + G2 + G4: Payment Negotiation Contracts + Decision Engine + 402 Model
 *
 * Machine-readable payment requirement contracts, negotiation decision engine,
 * and ConShell-native 402 response model.
 *
 * The negotiation engine evaluates payment requirements against:
 * - Economic identity status
 * - Capability envelope (spend_within_mandate scope)
 * - Mandate budget/purpose matching
 * - Firewall policy
 * - Provider selection results
 * - Risk-based human confirmation gates
 *
 * Design invariants:
 * - Payment negotiation CANNOT bypass firewall
 * - explicit_transfer always requires human confirmation
 * - All decisions produce structured rejection reasons
 * - Every negotiation is auditable
 */

import type { EconomicIdentityRegistry } from './economic-identity.js';
import type { CapabilityEnvelopeManager } from './capability-envelope.js';
import type { MandateEngine } from './mandate-engine.js';
import type { EconomicInstructionFirewall } from './economic-instruction-firewall.js';
import type { ProviderSelector, ProviderSelectionResult } from './provider-selection.js';
import { createCandidate } from './economic-action-classification.js';
import type { EconomicActionKind } from './economic-action-classification.js';

// ── Pricing & Settlement Types ───────────────────────────────────────

export type PricingMode = 'exact' | 'capped' | 'quote';

export type SettlementKind = 'x402' | 'lightning' | 'onchain' | 'offchain' | 'credit';

// ── Payment Requirement ──────────────────────────────────────────────

export interface PaymentRequirement {
  readonly requirementId: string;
  readonly resource: string;
  readonly purpose: string;
  readonly providerId: string;
  readonly asset: string;
  readonly network: string;
  readonly amountCents: number;
  readonly amountAtomic?: string;
  readonly pricingMode: PricingMode;
  readonly expiresAt: string;
  readonly allowedSettlementKinds: readonly SettlementKind[];
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PaymentRequirementCreateInput {
  readonly resource: string;
  readonly purpose: string;
  readonly providerId: string;
  readonly asset: string;
  readonly network: string;
  readonly amountCents: number;
  readonly amountAtomic?: string;
  readonly pricingMode: PricingMode;
  readonly expiresAt: string;
  readonly allowedSettlementKinds: readonly SettlementKind[];
  readonly riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ── Payment Offer ────────────────────────────────────────────────────

export interface PaymentOffer {
  readonly offerId: string;
  readonly requirementId: string;
  readonly providerId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly settlementKind: SettlementKind;
  readonly estimatedLatencyMs: number;
  readonly trustScore: number; // 0-100
}

// ── Negotiation Request / Result ─────────────────────────────────────

export type NegotiationDecision =
  | 'allow_and_prepare'
  | 'allow_and_route'
  | 'require_human_confirmation'
  | 'switch_provider'
  | 'reject';

export type NegotiationRejectionCategory =
  | 'identity_not_found'
  | 'identity_inactive'
  | 'capability_insufficient'
  | 'mandate_mismatch'
  | 'mandate_budget_exceeded'
  | 'firewall_blocked'
  | 'policy_rejected'
  | 'requirement_expired'
  | 'requirement_invalid'
  | 'no_valid_offers'
  | 'provider_unavailable';

export interface NegotiationRejectionReason {
  readonly category: NegotiationRejectionCategory;
  readonly message: string;
  readonly evidence?: string;
}

export interface PaymentNegotiationRequest {
  readonly requirementId: string;
  readonly economicIdentityId: string;
  readonly runtimeIdentityId: string;
  readonly offers: readonly PaymentOffer[];
}

export interface PaymentNegotiationResult {
  readonly negotiationId: string;
  readonly decision: NegotiationDecision;
  readonly requirementId: string;
  readonly selectedOffer: PaymentOffer | null;
  readonly rejectionReasons: readonly NegotiationRejectionReason[];
  readonly preparationIntentId: string | null;
  readonly requiresHumanConfirmation: boolean;
  readonly alternativeOffers: readonly PaymentOffer[];
  readonly timestamp: string;
}

// ── ConShell 402 Response Model ──────────────────────────────────────

export interface ConShell402Requirement {
  readonly scheme: PricingMode;
  readonly resource: string;
  readonly providerId: string;
  readonly asset: string;
  readonly network: string;
  readonly amountAtomic: string;
  readonly amountCents: number;
  readonly purpose: string;
  readonly expiresAt: string;
}

export interface ConShell402Response {
  readonly status: 402;
  readonly requirements: readonly ConShell402Requirement[];
  readonly negotiationContext?: string;
}

// ── Negotiation Stats ────────────────────────────────────────────────

export interface NegotiationStats {
  readonly totalNegotiations: number;
  readonly allowed: number;
  readonly rejected: number;
  readonly pendingConfirmation: number;
  readonly switchedProvider: number;
}

// ── Negotiation Engine ───────────────────────────────────────────────

let negotiationCounter = 0;
let requirementCounter = 0;

export class PaymentNegotiationEngine {
  private readonly identityRegistry: EconomicIdentityRegistry;
  private readonly envelopeManager: CapabilityEnvelopeManager;
  private readonly mandateEngine: MandateEngine;
  private readonly firewall: EconomicInstructionFirewall;
  private readonly providerSelector: ProviderSelector;
  private readonly requirements = new Map<string, PaymentRequirement>();
  private readonly results: PaymentNegotiationResult[] = [];

  constructor(
    identityRegistry: EconomicIdentityRegistry,
    envelopeManager: CapabilityEnvelopeManager,
    mandateEngine: MandateEngine,
    firewall: EconomicInstructionFirewall,
    providerSelector: ProviderSelector,
  ) {
    this.identityRegistry = identityRegistry;
    this.envelopeManager = envelopeManager;
    this.mandateEngine = mandateEngine;
    this.firewall = firewall;
    this.providerSelector = providerSelector;
  }

  // ── Requirement Management ───────────────────────────────────────

  createRequirement(input: PaymentRequirementCreateInput): PaymentRequirement {
    if (input.amountCents <= 0) {
      throw new Error('Payment requirement amount must be positive');
    }
    if (new Date(input.expiresAt) <= new Date()) {
      throw new Error('Payment requirement expiresAt must be in the future');
    }

    const requirement: PaymentRequirement = {
      requirementId: `req_${++requirementCounter}`,
      resource: input.resource,
      purpose: input.purpose,
      providerId: input.providerId,
      asset: input.asset,
      network: input.network,
      amountCents: input.amountCents,
      amountAtomic: input.amountAtomic,
      pricingMode: input.pricingMode,
      expiresAt: input.expiresAt,
      allowedSettlementKinds: [...input.allowedSettlementKinds],
      riskLevel: input.riskLevel ?? 'medium',
      metadata: input.metadata,
    };

    this.requirements.set(requirement.requirementId, requirement);
    return requirement;
  }

  getRequirement(requirementId: string): PaymentRequirement | undefined {
    return this.requirements.get(requirementId);
  }

  allRequirements(): readonly PaymentRequirement[] {
    return [...this.requirements.values()];
  }

  activeRequirements(): readonly PaymentRequirement[] {
    const now = new Date();
    return [...this.requirements.values()].filter(r => new Date(r.expiresAt) > now);
  }

  // ── Negotiation ──────────────────────────────────────────────────

  negotiate(request: PaymentNegotiationRequest): PaymentNegotiationResult {
    const rejectionReasons: NegotiationRejectionReason[] = [];
    const negotiationId = `neg_${++negotiationCounter}`;

    // Step 1: Requirement validity
    const requirement = this.requirements.get(request.requirementId);
    if (!requirement) {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'requirement_invalid',
        message: 'Payment requirement not found',
      }]);
    }

    if (new Date(requirement.expiresAt) <= new Date()) {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'requirement_expired',
        message: `Payment requirement expired at ${requirement.expiresAt}`,
      }]);
    }

    // Step 2: Identity check
    const identity = this.identityRegistry.get(request.economicIdentityId);
    if (!identity) {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'identity_not_found',
        message: `Economic identity ${request.economicIdentityId} not found`,
      }]);
    }

    if (identity.status !== 'active') {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'identity_inactive',
        message: `Economic identity is ${identity.status}`,
      }]);
    }

    // Step 3: Capability check
    const envelope = this.envelopeManager.getByEconomicIdentity(request.economicIdentityId);
    if (!envelope || !envelope.grantedScopes.has('spend_within_mandate')) {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'capability_insufficient',
        message: 'Identity lacks spend_within_mandate capability',
      }]);
    }

    // Step 4: Mandate match check
    const mandates = this.mandateEngine.getActiveMandates(request.economicIdentityId);
    const matchingMandate = mandates.find(m =>
      m.remainingBudget >= requirement.amountCents &&
      m.allowedActionKinds.includes('spend_within_mandate' as any)
    );

    if (!matchingMandate) {
      // Check if it's budget exceeded vs no mandate
      const anyMandate = mandates.length > 0;
      if (anyMandate) {
        rejectionReasons.push({
          category: 'mandate_budget_exceeded',
          message: `No mandate with sufficient budget (need ${requirement.amountCents}, best available: ${Math.max(0, ...mandates.map(m => m.remainingBudget))})`,
        });
      } else {
        rejectionReasons.push({
          category: 'mandate_mismatch',
          message: 'No active mandate matches this payment requirement',
        });
      }
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, rejectionReasons);
    }

    // Step 5: Firewall evaluation
    const candidate = createCandidate({
      actionKind: 'spend_within_mandate',
      source: 'internal',
      sourceContext: `payment_negotiation:${requirement.purpose}`,
      amountCents: requirement.amountCents,
      asset: requirement.asset,
      purpose: requirement.purpose,
    });

    const verdict = this.firewall.evaluate(candidate, request.runtimeIdentityId);
    if (verdict.finalDecision === 'rejected') {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'firewall_blocked',
        message: 'Firewall rejected this payment action',
        evidence: verdict.rejectionReasons.join('; '),
      }]);
    }

    if (verdict.finalDecision === 'pending_human_confirmation') {
      return this.buildResult(negotiationId, request.requirementId, 'require_human_confirmation', null, [], true);
    }

    // Step 6: Provider selection (if multiple offers)
    if (request.offers.length === 0) {
      return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
        category: 'no_valid_offers',
        message: 'No payment offers provided',
      }]);
    }

    let selectedOffer: PaymentOffer;
    let alternativeOffers: PaymentOffer[] = [];

    if (request.offers.length === 1) {
      selectedOffer = request.offers[0];
    } else {
      const selectionResult = this.providerSelector.selectBestOffer(
        request.offers,
        {
          mandateMaxAmount: matchingMandate.remainingBudget,
          allowedAssets: [requirement.asset],
          allowedNetworks: [requirement.network],
        },
      );

      if (!selectionResult.selectedOffer) {
        return this.buildResult(negotiationId, request.requirementId, 'reject', null, [{
          category: 'provider_unavailable',
          message: 'No provider meets selection constraints',
        }]);
      }

      selectedOffer = selectionResult.selectedOffer;
      alternativeOffers = [...selectionResult.alternativeOffers];

      // If selected provider differs from requirement's original provider → switch_provider
      if (selectedOffer.providerId !== requirement.providerId) {
        return this.buildResult(
          negotiationId,
          request.requirementId,
          'switch_provider',
          selectedOffer,
          [],
          false,
          alternativeOffers,
        );
      }
    }

    // Step 7: Risk-based human confirmation
    if (requirement.riskLevel === 'critical' || requirement.riskLevel === 'high') {
      return this.buildResult(
        negotiationId,
        request.requirementId,
        'require_human_confirmation',
        selectedOffer,
        [],
        true,
        alternativeOffers,
      );
    }

    // All checks passed
    const decision: NegotiationDecision = request.offers.length > 1
      ? 'allow_and_route'
      : 'allow_and_prepare';

    return this.buildResult(
      negotiationId,
      request.requirementId,
      decision,
      selectedOffer,
      [],
      false,
      alternativeOffers,
    );
  }

  // ── 402 Response Model ───────────────────────────────────────────

  create402Response(requirements: readonly PaymentRequirement[], context?: string): ConShell402Response {
    return {
      status: 402,
      requirements: requirements.map(r => ({
        scheme: r.pricingMode,
        resource: r.resource,
        providerId: r.providerId,
        asset: r.asset,
        network: r.network,
        amountAtomic: r.amountAtomic ?? String(r.amountCents * 10000), // cents → atomic fallback
        amountCents: r.amountCents,
        purpose: r.purpose,
        expiresAt: r.expiresAt,
      })),
      negotiationContext: context,
    };
  }

  // ── Stats ────────────────────────────────────────────────────────

  stats(): NegotiationStats {
    let allowed = 0;
    let rejected = 0;
    let pendingConfirmation = 0;
    let switchedProvider = 0;

    for (const r of this.results) {
      switch (r.decision) {
        case 'allow_and_prepare':
        case 'allow_and_route':
          allowed++;
          break;
        case 'reject':
          rejected++;
          break;
        case 'require_human_confirmation':
          pendingConfirmation++;
          break;
        case 'switch_provider':
          switchedProvider++;
          break;
      }
    }

    return { totalNegotiations: this.results.length, allowed, rejected, pendingConfirmation, switchedProvider };
  }

  allResults(): readonly PaymentNegotiationResult[] {
    return [...this.results];
  }

  getRecentResults(limit: number = 10): readonly PaymentNegotiationResult[] {
    return this.results.slice(-limit);
  }

  // ── Private ──────────────────────────────────────────────────────

  private buildResult(
    negotiationId: string,
    requirementId: string,
    decision: NegotiationDecision,
    selectedOffer: PaymentOffer | null,
    rejectionReasons: NegotiationRejectionReason[],
    requiresHumanConfirmation = false,
    alternativeOffers: readonly PaymentOffer[] = [],
  ): PaymentNegotiationResult {
    const result: PaymentNegotiationResult = {
      negotiationId,
      decision,
      requirementId,
      selectedOffer,
      rejectionReasons,
      preparationIntentId: null,
      requiresHumanConfirmation,
      alternativeOffers: [...alternativeOffers],
      timestamp: new Date().toISOString(),
    };
    this.results.push(result);
    return result;
  }
}
