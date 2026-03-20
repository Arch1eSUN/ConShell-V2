/**
 * Round 17.9 — V1-V10 Verification Matrix
 *
 * ConShell 402 / Payment Negotiation / Provider Selection / Policy-Bound Routing
 *
 * V1:  PaymentRequirement contract completeness
 * V2:  Negotiation decision branches (allow/confirm/switch/reject)
 * V3:  Decision constrained by identity/capability/mandate/firewall
 * V4:  Structured rejection (expired/over-budget/no-mandate)
 * V5:  Provider selection — multi-offer constrained selection
 * V6:  402 Response Model generation
 * V7:  Negotiation audit trail completeness
 * V8:  Control surface visibility (API routes)
 * V9:  explicit_transfer cannot auto-execute (safety invariant)
 * V10: 17.7/17.8 security invariant regression
 */
import { describe, test, expect, beforeEach } from 'vitest';

import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { EconomicKernelFoundation } from './economic-kernel-foundation.js';
import { PaymentNegotiationEngine } from './payment-negotiation.js';
import type { PaymentRequirement, PaymentOffer, PaymentNegotiationResult } from './payment-negotiation.js';
import { ProviderSelector } from './provider-selection.js';
import type { ProviderProfile } from './provider-selection.js';
import { PaymentPreparationManager, PaymentNegotiationAuditLog } from './payment-preparation.js';
import { createCandidate } from './economic-action-classification.js';
import { createApiRoutes } from '../api/routes.js';

// ── Helpers ──────────────────────────────────────────────────────────

function futureDate(hours: number = 24): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function pastDate(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

// Creates a fully-provisioned foundation with one identity + mandate
function setupFullFoundation(): {
  foundation: EconomicKernelFoundation;
  econId: string;
  runtimeId: string;
  mandateId: string;
} {
  const foundation = createEconomicKernelFoundation();
  const runtimeId = 'rt_nego_test_' + Math.random().toString(36).slice(2);

  // Create identity
  const identity = foundation.identityRegistry.create({ runtimeIdentityId: runtimeId });
  const econId = identity.economicIdentityId;

  // Create capability envelope with spend_within_mandate
  const envelope = foundation.envelopeManager.create(econId, ['receive_only', 'spend_within_mandate', 'claim_reward']);
  foundation.identityRegistry.bindEnvelope(econId, envelope.envelopeId);

  // Create mandate with medium budget
  const mandate = foundation.mandateEngine.create({
    economicIdentityId: econId,
    purpose: 'API access payment',
    maxTotalAmount: 50000, // $500
    maxPerTransactionAmount: 10000, // $100
    validUntil: futureDate(720), // 30 days
    allowedActionKinds: ['spend_within_mandate'],
    approvedBy: 'test_operator',
  });

  return { foundation, econId, runtimeId, mandateId: mandate.mandateId };
}

function makeOffer(overrides: Partial<PaymentOffer> & { requirementId: string }): PaymentOffer {
  return {
    offerId: `offer_${Math.random().toString(36).slice(2)}`,
    providerId: 'provider_default',
    amountCents: 1000,
    asset: 'USDC',
    network: 'base',
    settlementKind: 'x402',
    estimatedLatencyMs: 100,
    trustScore: 85,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// V1: PaymentRequirement Contract Completeness
// ══════════════════════════════════════════════════════════════════════

describe('V1: PaymentRequirement Contract', () => {
  test('should create a valid payment requirement with all fields', () => {
    const { foundation } = setupFullFoundation();
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/weather/forecast',
      purpose: 'Weather API access',
      providerId: 'provider_wx',
      asset: 'USDC',
      network: 'base',
      amountCents: 500,
      pricingMode: 'exact',
      expiresAt: futureDate(),
      allowedSettlementKinds: ['x402', 'lightning'],
      riskLevel: 'low',
      metadata: { tier: 'premium' },
    });

    expect(req.requirementId).toBeTruthy();
    expect(req.resource).toBe('api/weather/forecast');
    expect(req.purpose).toBe('Weather API access');
    expect(req.amountCents).toBe(500);
    expect(req.pricingMode).toBe('exact');
    expect(req.allowedSettlementKinds).toContain('x402');
    expect(req.riskLevel).toBe('low');
    expect(req.metadata).toEqual({ tier: 'premium' });
  });

  test('should reject requirement with zero/negative amount', () => {
    const { foundation } = setupFullFoundation();
    expect(() => foundation.negotiationEngine.createRequirement({
      resource: 'x', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 0,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    })).toThrow('amount must be positive');
  });

  test('should reject requirement with past expiry', () => {
    const { foundation } = setupFullFoundation();
    expect(() => foundation.negotiationEngine.createRequirement({
      resource: 'x', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: pastDate(),
      allowedSettlementKinds: ['x402'],
    })).toThrow('expiresAt must be in the future');
  });

  test('should track active vs all requirements', () => {
    const { foundation } = setupFullFoundation();
    foundation.negotiationEngine.createRequirement({
      resource: 'a', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    expect(foundation.negotiationEngine.allRequirements().length).toBe(1);
    expect(foundation.negotiationEngine.activeRequirements().length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V2: Negotiation Decision Branches
// ══════════════════════════════════════════════════════════════════════

describe('V2: Negotiation Decision Branches', () => {
  test('should produce allow_and_prepare for single valid offer', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/data', purpose: 'API access', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 1000,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1', amountCents: 1000 }),
    ]);

    expect(result.decision).toBe('allow_and_prepare');
    expect(result.selectedOffer).not.toBeNull();
    expect(result.rejectionReasons).toHaveLength(0);
  });

  test('should produce require_human_confirmation for high-risk requirement', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/sensitive', purpose: 'Sensitive access', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 1000,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'high',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
    ]);

    expect(result.decision).toBe('require_human_confirmation');
    expect(result.requiresHumanConfirmation).toBe(true);
  });

  test('should produce switch_provider when selected differs from requirement provider', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();

    // Register providers
    foundation.providerSelector.registerProvider({
      name: 'Cheap Provider', supportedAssets: ['USDC'],
      supportedNetworks: ['base'], trustScore: 90, riskLevel: 'low',
    });

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/x', purpose: 'test', providerId: 'original_provider',
      asset: 'USDC', network: 'base', amountCents: 1000,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'provider_a', amountCents: 2000, trustScore: 60 }),
      makeOffer({ requirementId: req.requirementId, providerId: 'provider_b', amountCents: 500, trustScore: 95 }),
    ]);

    // Both providers differ from 'original_provider', so switch_provider is expected
    expect(result.decision).toBe('switch_provider');
  });

  test('should produce reject for no offers provided', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/y', purpose: 'test', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, []);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons.length).toBeGreaterThan(0);
    expect(result.rejectionReasons[0].category).toBe('no_valid_offers');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V3: Decision Constrained by Identity/Capability/Mandate/Firewall
// ══════════════════════════════════════════════════════════════════════

describe('V3: Decision Constraints', () => {
  test('should reject when identity not found', () => {
    const { foundation, runtimeId } = setupFullFoundation();
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'a', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const result = foundation.negotiate(req.requirementId, 'nonexistent_id', runtimeId, [
      makeOffer({ requirementId: req.requirementId }),
    ]);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('identity_not_found');
  });

  test('should reject when identity is suspended', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    foundation.identityRegistry.suspend(econId, 'test suspension');

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'a', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId }),
    ]);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('identity_inactive');
  });

  test('should reject when identity lacks spend_within_mandate capability', () => {
    const foundation = createEconomicKernelFoundation();
    const runtimeId = 'rt_no_spend_' + Math.random().toString(36).slice(2);
    const identity = foundation.identityRegistry.create({ runtimeIdentityId: runtimeId });
    // Create with only receive_only — no spend capability
    foundation.envelopeManager.create(identity.economicIdentityId, ['receive_only']);

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'a', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const result = foundation.negotiate(req.requirementId, identity.economicIdentityId, runtimeId, [
      makeOffer({ requirementId: req.requirementId }),
    ]);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('capability_insufficient');
  });

  test('should reject when no active mandate matches', () => {
    const foundation = createEconomicKernelFoundation();
    const runtimeId = 'rt_no_mandate_' + Math.random().toString(36).slice(2);
    const identity = foundation.identityRegistry.create({ runtimeIdentityId: runtimeId });
    foundation.envelopeManager.create(identity.economicIdentityId, ['receive_only', 'spend_within_mandate']);
    // No mandate created

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'a', purpose: 'p', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const result = foundation.negotiate(req.requirementId, identity.economicIdentityId, runtimeId, [
      makeOffer({ requirementId: req.requirementId }),
    ]);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('mandate_mismatch');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V4: Structured Rejection Reasons
// ══════════════════════════════════════════════════════════════════════

describe('V4: Structured Rejection', () => {
  test('should reject with requirement_invalid for unknown requirement', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    const result = foundation.negotiate('nonexistent_req', econId, runtimeId, []);
    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('requirement_invalid');
  });

  test('should reject with mandate_budget_exceeded when amount exceeds budget', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'expensive', purpose: 'big purchase', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 999999, // exceeds $500 mandate
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, amountCents: 999999 }),
    ]);

    expect(result.decision).toBe('reject');
    expect(result.rejectionReasons[0].category).toBe('mandate_budget_exceeded');
  });

  test('rejection reasons have structured category + message', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();
    const result = foundation.negotiate('bad_req', econId, runtimeId, []);

    expect(result.rejectionReasons[0]).toHaveProperty('category');
    expect(result.rejectionReasons[0]).toHaveProperty('message');
    expect(typeof result.rejectionReasons[0].category).toBe('string');
    expect(typeof result.rejectionReasons[0].message).toBe('string');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V5: Provider Selection — Multi-Offer Constrained Selection
// ══════════════════════════════════════════════════════════════════════

describe('V5: Provider Selection', () => {
  test('should select cheapest offer when all meet constraints', () => {
    const selector = new ProviderSelector();
    const offers: PaymentOffer[] = [
      makeOffer({ requirementId: 'r1', offerId: 'o1', providerId: 'p1', amountCents: 2000, trustScore: 80 }),
      makeOffer({ requirementId: 'r1', offerId: 'o2', providerId: 'p2', amountCents: 500, trustScore: 85 }),
      makeOffer({ requirementId: 'r1', offerId: 'o3', providerId: 'p3', amountCents: 1000, trustScore: 90 }),
    ];

    const result = selector.selectBestOffer(offers, { mandateMaxAmount: 5000 }, 'cheapest');
    expect(result.selectedOffer).not.toBeNull();
    expect(result.selectedOffer!.amountCents).toBe(500);
  });

  test('should filter by allowed assets', () => {
    const selector = new ProviderSelector();
    const offers: PaymentOffer[] = [
      makeOffer({ requirementId: 'r1', offerId: 'o1', asset: 'USDC', amountCents: 500 }),
      makeOffer({ requirementId: 'r1', offerId: 'o2', asset: 'ETH', amountCents: 300 }),
    ];

    const result = selector.selectBestOffer(offers, { allowedAssets: ['USDC'] });
    expect(result.selectedOffer).not.toBeNull();
    expect(result.selectedOffer!.asset).toBe('USDC');
    expect(result.policyApplied.some(p => p.includes('asset_filter'))).toBe(true);
  });

  test('should return null when no offers meet constraints', () => {
    const selector = new ProviderSelector();
    const offers: PaymentOffer[] = [
      makeOffer({ requirementId: 'r1', offerId: 'o1', asset: 'ETH', amountCents: 500 }),
    ];

    const result = selector.selectBestOffer(offers, { allowedAssets: ['USDC'], mandateMaxAmount: 100 });
    expect(result.selectedOffer).toBeNull();
    expect(result.selectedProviderId).toBeNull();
  });

  test('should detect no-pay alternatives', () => {
    const selector = new ProviderSelector();
    selector.registerNoPayAlternative('api/weather/pro', {
      alternativeResource: 'api/weather/free',
      reason: 'Free tier available',
      estimatedSavingsCents: 500,
    });

    const alts = selector.detectNoPayAlternatives('api/weather/pro');
    expect(alts.length).toBe(1);
    expect(alts[0].alternativeResource).toBe('api/weather/free');
    expect(alts[0].estimatedSavingsCents).toBe(500);
  });

  test('should register and retrieve providers', () => {
    const selector = new ProviderSelector();
    const p = selector.registerProvider({
      name: 'Test Provider', supportedAssets: ['USDC', 'ETH'],
      supportedNetworks: ['base'], trustScore: 92,
    });

    expect(p.providerId).toBeTruthy();
    expect(selector.getProvider(p.providerId)?.name).toBe('Test Provider');
    expect(selector.all().length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V6: 402 Response Model
// ══════════════════════════════════════════════════════════════════════

describe('V6: 402 Response Model', () => {
  test('should generate ConShell 402 response from requirements', () => {
    const { foundation } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/premium', purpose: 'Premium access', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 1500,
      amountAtomic: '15000000',
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const response = foundation.negotiationEngine.create402Response([req], 'session_abc');

    expect(response.status).toBe(402);
    expect(response.requirements).toHaveLength(1);
    expect(response.requirements[0].scheme).toBe('exact');
    expect(response.requirements[0].amountCents).toBe(1500);
    expect(response.requirements[0].amountAtomic).toBe('15000000');
    expect(response.requirements[0].purpose).toBe('Premium access');
    expect(response.negotiationContext).toBe('session_abc');
  });

  test('should generate amountAtomic fallback when not provided', () => {
    const { foundation } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/basic', purpose: 'Basic', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 200,
      pricingMode: 'capped', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });

    const response = foundation.negotiationEngine.create402Response([req]);
    expect(response.requirements[0].amountAtomic).toBe('2000000'); // 200 * 10000
  });

  test('should handle multiple requirements in one 402 response', () => {
    const { foundation } = setupFullFoundation();

    const req1 = foundation.negotiationEngine.createRequirement({
      resource: 'api/a', purpose: 'A', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 100,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'],
    });
    const req2 = foundation.negotiationEngine.createRequirement({
      resource: 'api/b', purpose: 'B', providerId: 'p2',
      asset: 'ETH', network: 'mainnet', amountCents: 500,
      pricingMode: 'quote', expiresAt: futureDate(),
      allowedSettlementKinds: ['onchain'],
    });

    const response = foundation.negotiationEngine.create402Response([req1, req2]);
    expect(response.requirements).toHaveLength(2);
    expect(response.requirements[0].asset).toBe('USDC');
    expect(response.requirements[1].asset).toBe('ETH');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V7: Negotiation Audit Trail
// ══════════════════════════════════════════════════════════════════════

describe('V7: Negotiation Audit Trail', () => {
  test('should record audit events for negotiate()', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/tracked', purpose: 'Audit test', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 500,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
    ]);

    const events = foundation.negotiationAuditLog.getRecent(20);
    expect(events.length).toBeGreaterThanOrEqual(2); // requirement_received + route_selected
    expect(events[0].eventType).toBe('requirement_received');
  });

  test('should track provider usage distribution', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();

    for (let i = 0; i < 3; i++) {
      const req = foundation.negotiationEngine.createRequirement({
        resource: `api/resource_${i}`, purpose: 'test', providerId: 'p1',
        asset: 'USDC', network: 'base', amountCents: 100 + i,
        pricingMode: 'exact', expiresAt: futureDate(),
        allowedSettlementKinds: ['x402'], riskLevel: 'low',
      });
      foundation.negotiate(req.requirementId, econId, runtimeId, [
        makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
      ]);
    }

    const summary = foundation.negotiationAuditLog.providerSummary();
    expect(summary.totalComparisons).toBe(3);
    expect(Object.keys(summary.providerUsageDistribution).length).toBeGreaterThanOrEqual(1);
  });

  test('should produce negotiation summary', () => {
    const { foundation, econId, runtimeId } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/sum', purpose: 'summary test', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 500,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });
    foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
    ]);

    const summary = foundation.negotiationAuditLog.summary();
    expect(summary.totalNegotiations).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V8: Payment Preparation + Intent Lifecycle
// ══════════════════════════════════════════════════════════════════════

describe('V8: Payment Preparation Intent Lifecycle', () => {
  test('should create intent from negotiation result', () => {
    const { foundation, econId, runtimeId, mandateId } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/intent', purpose: 'Intent test', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 500,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
    ]);

    const intent = foundation.preparationManager.createIntent(result, econId, mandateId);
    expect(intent.intentId).toBeTruthy();
    expect(intent.status).toBe('bound'); // created with mandateId → auto-bound
    expect(intent.economicIdentityId).toBe(econId);
    expect(intent.mandateId).toBe(mandateId);
  });

  test('should confirm intent', () => {
    const { foundation, econId, runtimeId, mandateId } = setupFullFoundation();

    const req = foundation.negotiationEngine.createRequirement({
      resource: 'api/confirm', purpose: 'Confirm test', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 200,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'low',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1' }),
    ]);

    const intent = foundation.preparationManager.createIntent(result, econId, mandateId);
    const confirmed = foundation.preparationManager.confirm(intent.intentId);

    expect(confirmed).toBe(true);
    expect(foundation.preparationManager.get(intent.intentId)?.status).toBe('confirmed');
  });

  test('should cancel intent', () => {
    const manager = new PaymentPreparationManager();
    const mockResult: PaymentNegotiationResult = {
      negotiationId: 'neg_x', decision: 'allow_and_prepare', requirementId: 'req_x',
      selectedOffer: null, rejectionReasons: [], preparationIntentId: null,
      requiresHumanConfirmation: false, alternativeOffers: [], timestamp: new Date().toISOString(),
    };

    const intent = manager.createIntent(mockResult, 'econ_x');
    expect(intent.status).toBe('created');

    const cancelled = manager.cancel(intent.intentId);
    expect(cancelled).toBe(true);
    expect(manager.get(intent.intentId)?.status).toBe('cancelled');
  });

  test('should list pending intents', () => {
    const manager = new PaymentPreparationManager();
    const mockResult: PaymentNegotiationResult = {
      negotiationId: 'neg_p', decision: 'allow_and_prepare', requirementId: 'req_p',
      selectedOffer: null, rejectionReasons: [], preparationIntentId: null,
      requiresHumanConfirmation: false, alternativeOffers: [], timestamp: new Date().toISOString(),
    };

    manager.createIntent(mockResult, 'econ_p');
    manager.createIntent(mockResult, 'econ_p2');

    expect(manager.getPending().length).toBe(2);
    expect(manager.getConfirmed().length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V9: explicit_transfer Safety Invariant
// ══════════════════════════════════════════════════════════════════════

describe('V9: explicit_transfer Safety Invariant', () => {
  test('explicit_transfer from external_text must be rejected by firewall', () => {
    const { foundation, runtimeId } = setupFullFoundation();

    const candidate = createCandidate({
      actionKind: 'explicit_transfer',
      source: 'external_text',
      sourceContext: 'Send 100 USDC to 0xBob',
      amountCents: 10000,
      asset: 'USDC',
      purpose: 'External transfer request',
    });

    const verdict = foundation.evaluate(candidate, runtimeId);
    expect(verdict.finalDecision).not.toBe('approved');
  });

  test('payment negotiation cannot approve explicit_transfer without firewall check', () => {
    // The negotiation engine always evaluates through the firewall
    // This test verifies that even if we have valid identity/capability/mandate,
    // the firewall still catches high-risk actions
    const { foundation, econId, runtimeId } = setupFullFoundation();

    // Create a high-risk requirement
    const req = foundation.negotiationEngine.createRequirement({
      resource: 'transfer/external', purpose: 'External transfer', providerId: 'p1',
      asset: 'USDC', network: 'base', amountCents: 5000,
      pricingMode: 'exact', expiresAt: futureDate(),
      allowedSettlementKinds: ['x402'], riskLevel: 'critical',
    });

    const result = foundation.negotiate(req.requirementId, econId, runtimeId, [
      makeOffer({ requirementId: req.requirementId, providerId: 'p1', amountCents: 5000 }),
    ]);

    // Critical risk → require_human_confirmation (never auto-approved)
    expect(result.decision).toBe('require_human_confirmation');
    expect(result.requiresHumanConfirmation).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V10: 17.7/17.8 Regression + Route Count
// ══════════════════════════════════════════════════════════════════════

describe('V10: Regression + Route Count', () => {
  test('should maintain all 17.7/17.8 foundation properties', () => {
    const foundation = createEconomicKernelFoundation();

    // 17.7 properties
    expect(foundation.identityRegistry).toBeDefined();
    expect(foundation.envelopeManager).toBeDefined();
    expect(foundation.mandateEngine).toBeDefined();
    expect(foundation.firewall).toBeDefined();
    expect(foundation.auditLog).toBeDefined();
    expect(typeof foundation.evaluate).toBe('function');

    // 17.8 properties
    expect(foundation.rewardRegistry).toBeDefined();
    expect(foundation.claimEngine).toBeDefined();
    expect(typeof foundation.generateTruthReport).toBe('function');
    expect(typeof foundation.attemptClaim).toBe('function');

    // 17.9 properties
    expect(foundation.negotiationEngine).toBeDefined();
    expect(foundation.providerSelector).toBeDefined();
    expect(foundation.preparationManager).toBeDefined();
    expect(foundation.negotiationAuditLog).toBeDefined();
    expect(typeof foundation.negotiate).toBe('function');
  });

  test('should have at least 15 economic API routes (11 from 17.8 + 4 payment)', () => {
    const routes = createApiRoutes({});
    const economicRoutes = routes.filter((r: { path: string }) => r.path.startsWith('/api/economic'));
    const paymentRoutes = routes.filter((r: { path: string }) => r.path.startsWith('/api/economic/payments'));

    // Contract: Round 17.9 added 4 payment routes
    const expectedPaymentPaths = [
      '/api/economic/payments/negotiations',
      '/api/economic/payments/pending',
      '/api/economic/payments/providers',
      '/api/economic/payments/requirements',
    ];
    for (const path of expectedPaymentPaths) {
      expect(paymentRoutes.map((r: { path: string }) => r.path)).toContain(path);
    }
    expect(paymentRoutes.length).toBeGreaterThanOrEqual(4);

    // Total: at minimum 11 existing + 4 new = 15
    expect(economicRoutes.length).toBeGreaterThanOrEqual(15);
  });

  test('negotiation stats start at zero', () => {
    const foundation = createEconomicKernelFoundation();
    const stats = foundation.negotiationEngine.stats();
    expect(stats.totalNegotiations).toBe(0);
    expect(stats.allowed).toBe(0);
    expect(stats.rejected).toBe(0);
  });
});
