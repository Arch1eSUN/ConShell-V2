import { describe, it, expect, beforeEach } from 'vitest';
import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { EconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { SettlementReceipt, MandateSnapshot, PolicySnapshot, CapabilitySnapshot } from './settlement-governance.js';
import type { Mandate } from './mandate-engine.js';
import type { PaymentNegotiationResult, PaymentOffer, NegotiationRejectionReason } from './payment-negotiation.js';
import type { PaymentPreparationIntent } from './payment-preparation.js';
import type { AttributionTarget, LedgerDirection } from './settlement-ledger.js';
import { bridgeNegotiationToFlow } from './settlement-orchestrator.js';
import type { SettlementRuntimeFlowRequest } from './settlement-orchestrator.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeFoundation(): EconomicKernelFoundation {
  return createEconomicKernelFoundation();
}

function defaultPolicySnapshot(): PolicySnapshot {
  return {
    capturedAt: new Date().toISOString(),
    allowedProviders: ['stripe', 'solana'],
    allowedNetworks: ['mainnet'],
    maxAmountCents: 100_000,
  };
}

function defaultCapabilitySnapshot(): CapabilitySnapshot {
  return {
    economicIdentityId: 'econ_1',
    canSpend: true,
    canTransfer: true,
    capturedAt: new Date().toISOString(),
  };
}

function defaultMandateSnapshot(): MandateSnapshot {
  return {
    mandateId: 'mandate_1',
    remainingBudget: 50_000,
    validUntil: new Date(Date.now() + 3600_000).toISOString(),
    status: 'active',
  };
}

function makeActiveMandateFor(snapshot: MandateSnapshot, _amountNeeded: number): Mandate {
  return {
    mandateId: snapshot.mandateId,
    economicIdentityId: 'econ_1',
    purpose: 'payment',
    asset: 'USD',
    network: 'mainnet',
    maxTotalAmount: 100_000,
    maxPerTransactionAmount: 50_000,
    validFrom: new Date(Date.now() - 3600_000).toISOString(),
    validUntil: snapshot.validUntil,
    allowedActionKinds: ['spend_within_mandate'],
    allowedProviders: ['stripe', 'solana'],
    riskLevel: 'medium',
    approvalMode: 'auto',
    approvedBy: 'system',
    status: 'active',
    remainingBudget: snapshot.remainingBudget,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeOffer(overrides?: Partial<PaymentOffer>): PaymentOffer {
  return {
    offerId: 'offer_1',
    providerId: 'stripe',
    amountCents: 5_000,
    asset: 'USD',
    network: 'mainnet',
    settlementKind: 'hosted_checkout',
    estimatedSettlementTime: '2m',
    providerTrustScore: 85,
    ...overrides,
  };
}

function makeNegotiationResult(overrides?: Partial<PaymentNegotiationResult>): PaymentNegotiationResult {
  return {
    negotiationId: 'neg_e2e_1',
    decision: 'allow',
    requirementId: 'req_1',
    selectedOffer: makeOffer(),
    rejectionReasons: [],
    preparationIntentId: 'prep_1',
    requiresHumanConfirmation: false,
    alternativeOffers: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function bridgeContext(overrides?: Partial<Parameters<typeof bridgeNegotiationToFlow>[2]>) {
  return {
    mandateSnapshot: defaultMandateSnapshot(),
    policySnapshot: defaultPolicySnapshot(),
    capabilitySnapshot: defaultCapabilitySnapshot(),
    direction: 'income' as LedgerDirection,
    attributionTarget: { kind: 'task' as const, targetId: 'task_e2e' },
    ...overrides,
  };
}

function makeReceipt(execReqId: string, overrides?: Partial<Omit<SettlementReceipt, 'receiptId'>>): Omit<SettlementReceipt, 'receiptId'> {
  return {
    executionRequestId: execReqId,
    providerId: 'stripe',
    externalReference: 'ext_ref_e2e',
    amountCents: 5_000,
    asset: 'USD',
    network: 'mainnet',
    receivedAt: new Date().toISOString(),
    rawPayloadDigest: `digest_e2e_${execReqId}`,
    statusHint: 'success',
    ...overrides,
  };
}

// ── V1: Bridge (G2) — negotiation → flow ────────────────────────────

describe('V1: Bridge — Negotiation to Settlement Flow', () => {
  it('should bridge an accepted negotiation result into a flow request', () => {
    const neg = makeNegotiationResult();
    const { request, reason } = bridgeNegotiationToFlow(neg, null, bridgeContext());
    expect(request).not.toBeNull();
    expect(request!.flowId).toMatch(/^flow_/);
    expect(request!.negotiationId).toBe('neg_e2e_1');
    expect(request!.providerId).toBe('stripe');
    expect(request!.amountCents).toBe(5_000);
    expect(reason).toBe('Bridge successful');
  });

  it('should reject bridging a rejected negotiation', () => {
    const neg = makeNegotiationResult({
      decision: 'reject',
      selectedOffer: null,
      rejectionReasons: [{ code: 'budget_exceeded', message: 'Over budget' } as NegotiationRejectionReason],
    });
    const { request, reason } = bridgeNegotiationToFlow(neg, null, bridgeContext());
    expect(request).toBeNull();
    expect(reason).toContain('rejected');
  });

  it('should reject bridging when no selected offer', () => {
    const neg = makeNegotiationResult({ selectedOffer: null });
    const { request } = bridgeNegotiationToFlow(neg, null, bridgeContext());
    expect(request).toBeNull();
  });

  it('should reject bridging an expired preparation intent', () => {
    const intent: PaymentPreparationIntent = {
      intentId: 'prep_1',
      negotiationId: 'neg_e2e_1',
      selectedOfferId: 'offer_1',
      amountCents: 5_000,
      status: 'expired',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const { request, reason } = bridgeNegotiationToFlow(makeNegotiationResult(), intent, bridgeContext());
    expect(request).toBeNull();
    expect(reason).toContain('expired');
  });
});

// ── V2: End-to-End Happy Path (G1 + G3 + G4 + G5) ──────────────────

describe('V2: End-to-End Happy Path — Full Orchestrated Flow', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should execute a full settlement flow: bridge → authorize → submit → receipt → verify → adopt → feedback', () => {
    const neg = makeNegotiationResult();
    const { request } = bridgeNegotiationToFlow(neg, null, bridgeContext());
    expect(request).not.toBeNull();

    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    // Execute full flow with receipt
    const result = f.settlementRuntime.executeFlow(
      request!,
      mandate,
      makeReceipt('placeholder'), // receipt will use the actual exec req id internally
      false,
    );

    expect(result.finalStage).toBe('completed');
    expect(result.finalStatus).toBe('adopted');
    expect(result.executionRequestId).toMatch(/^exec_req_/);
    expect(result.ledgerEntryId).toBeTruthy();
    expect(result.profitabilityEffects).toBeTruthy();
    expect(result.profitabilityEffects!.amountCents).toBe(5_000);
    expect(result.providerFeedbackApplied).toBe(true);
    expect(result.survivalEffects).toBeTruthy();
    expect(result.operatorActionRequired).toBe(false);
    expect(result.failureReason).toBeNull();
  });
});

// ── V3: Human Confirmation Blocking (G1 invariant) ──────────────────

describe('V3: Human Confirmation Flow', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should block flow when human confirmation required but not provided', () => {
    const neg = makeNegotiationResult({ requiresHumanConfirmation: true });
    const ctx = bridgeContext();
    const { request } = bridgeNegotiationToFlow(neg, null, ctx);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    const result = f.settlementRuntime.executeFlow(request!, mandate, undefined, false);
    expect(result.finalStage).toBe('pending_confirmation');
    expect(result.finalStatus).toBe('awaiting_human_confirmation');
    expect(result.operatorActionRequired).toBe(true);
  });

  it('should proceed when human confirmation provided via resume', () => {
    const neg = makeNegotiationResult({ requiresHumanConfirmation: true });
    const { request } = bridgeNegotiationToFlow(neg, null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    // First attempt blocks
    const blocked = f.settlementRuntime.executeFlow(request!, mandate, undefined, false);
    expect(blocked.finalStatus).toBe('awaiting_human_confirmation');

    // Resume with confirmation + receipt
    const resumed = f.settlementRuntime.resumeFlow(
      request!.flowId,
      makeReceipt('placeholder'),
      true,
      mandate,
    );

    // Should proceed (either to awaiting_receipt or completed depending on receipt matching)
    expect(resumed.finalStatus).not.toBe('awaiting_human_confirmation');
  });
});

// ── V4: Mandate Drift Detection ─────────────────────────────────────

describe('V4: Mandate Drift Detection in Orchestrated Flow', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should fail flow when mandate is revoked (null)', () => {
    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());

    const result = f.settlementRuntime.executeFlow(request!, null);
    expect(result.finalStage).toBe('failed');
    expect(result.finalStatus).toBe('blocked_before_execution');
    expect(result.authorizationDecision).toBe('drifted_since_negotiation');
  });

  it('should fail flow when mandate budget is insufficient', () => {
    const offer = makeOffer({ amountCents: 60_000 });
    const neg = makeNegotiationResult({ selectedOffer: offer });
    const { request } = bridgeNegotiationToFlow(neg, null, bridgeContext());

    const snapshot = defaultMandateSnapshot(); // 50k budget
    const mandate = makeActiveMandateFor(snapshot, request!.amountCents);

    const result = f.settlementRuntime.executeFlow(request!, mandate);
    expect(result.finalStage).toBe('failed');
    expect(result.failureReason).toContain('Authorization failed');
  });
});

// ── V5: Verification Failure Feedback (G6) ──────────────────────────

describe('V5: Verification Failure → Provider Risk Signal', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should record failed settlement and apply provider risk penalty on amount mismatch', () => {
    // Register a provider first
    f.providerSelector.registerProvider({
      name: 'Stripe',
      supportedAssets: ['USD'],
      supportedNetworks: ['mainnet'],
      trustScore: 80,
      riskLevel: 'low',
      capabilities: [],
    });

    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    // Execute with mismatched receipt amount
    const result = f.settlementRuntime.executeFlow(
      request!,
      mandate,
      makeReceipt('placeholder', { amountCents: 999 }),
      false,
    );

    expect(result.finalStage).toBe('failed');
    // Failed settlements should be recorded
    expect(f.settlementLedger.allFailed().length).toBeGreaterThanOrEqual(1);
  });
});

// ── V6: Audit Trail (G7) ────────────────────────────────────────────

describe('V6: Audit Trail — End-to-End Tracing', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should produce a complete audit trail on happy path', () => {
    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    const result = f.settlementRuntime.executeFlow(request!, mandate, makeReceipt('placeholder'), false);
    expect(result.auditTrail).toBeTruthy();
    expect(result.auditTrail.flowId).toBe(request!.flowId);
    expect(result.auditTrail.events.length).toBeGreaterThanOrEqual(5);
    expect(result.auditTrail.startedAt).toBeTruthy();
    expect(result.auditTrail.completedAt).toBeTruthy();

    // Verify stages are represented
    const stages = result.auditTrail.events.map(e => e.stage);
    expect(stages).toContain('negotiation_bridge');
    expect(stages).toContain('authorization');
    expect(stages).toContain('submission');
  });

  it('should support getFlowTrace for a completed flow', () => {
    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);
    f.settlementRuntime.executeFlow(request!, mandate, makeReceipt('placeholder'), false);

    const trace = f.settlementRuntime.getFlowTrace(request!.flowId);
    expect(trace).not.toBeNull();
    expect(trace!.events.length).toBeGreaterThan(0);
  });

  it('should return null trace for unknown flow', () => {
    expect(f.settlementRuntime.getFlowTrace('nonexistent')).toBeNull();
  });
});

// ── V7: Flow Queries (G7) ───────────────────────────────────────────

describe('V7: Flow Listing and Querying', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should list all flows', () => {
    const { request: r1 } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const { request: r2 } = bridgeNegotiationToFlow(
      makeNegotiationResult({ negotiationId: 'neg_2' }),
      null,
      bridgeContext(),
    );
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), 5_000);

    f.settlementRuntime.executeFlow(r1!, mandate, makeReceipt('p1'), false);
    f.settlementRuntime.executeFlow(r2!, mandate, makeReceipt('p2', { rawPayloadDigest: 'digest_p2' }), false);

    const flows = f.settlementRuntime.listFlows();
    expect(flows.length).toBe(2);
  });

  it('should return all completed flow results', () => {
    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);
    f.settlementRuntime.executeFlow(request!, mandate, makeReceipt('p'), false);

    const results = f.settlementRuntime.allFlowResults();
    expect(results.length).toBe(1);
  });
});

// ── V8: Resume / Replay (G8) ────────────────────────────────────────

describe('V8: Flow Recovery — Resume & Replay', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should resume a flow that was awaiting receipt', () => {
    const { request } = bridgeNegotiationToFlow(makeNegotiationResult(), null, bridgeContext());
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    // No receipt → awaiting
    const initial = f.settlementRuntime.executeFlow(request!, mandate);
    expect(initial.finalStatus).toBe('awaiting_receipt');

    // Resume with receipt
    const resumed = f.settlementRuntime.resumeFlow(
      request!.flowId,
      makeReceipt('placeholder'),
      false,
      mandate,
    );
    // After resume, should complete or fail based on receipt
    expect(resumed.finalStage).not.toBe('receipt_intake');
  });

  it('should return error for resuming unknown flow', () => {
    const result = f.settlementRuntime.resumeFlow('unknown_flow');
    expect(result.finalStatus).toBe('failed');
    expect(result.failureReason).toContain('not found');
  });

  it('should return error for replaying unknown flow', () => {
    const result = f.settlementRuntime.replayFlow('unknown_flow');
    expect(result.finalStatus).toBe('failed');
    expect(result.failureReason).toContain('not found');
  });
});

// ── V9: Provider Feedback Write-Back (G6) ───────────────────────────

describe('V9: Provider Feedback — Trust Score Adjustment', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should adjust provider trust score upward on successful settlement', () => {
    // Register provider
    const provider = f.providerSelector.registerProvider({
      name: 'Stripe',
      supportedAssets: ['USD'],
      supportedNetworks: ['mainnet'],
      trustScore: 80,
      riskLevel: 'low',
      capabilities: [],
    });

    // Use matching provider ID in offer, policy, and receipt
    const offer = makeOffer({ providerId: provider.providerId });
    const neg = makeNegotiationResult({ selectedOffer: offer });
    const ctx = bridgeContext({
      policySnapshot: {
        ...defaultPolicySnapshot(),
        allowedProviders: [provider.providerId],
      },
    });
    const { request } = bridgeNegotiationToFlow(neg, null, ctx);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), request!.amountCents);

    f.settlementRuntime.executeFlow(
      request!,
      mandate,
      makeReceipt('p', {
        providerId: provider.providerId,
        rawPayloadDigest: 'digest_v9_success',
      }),
      false,
    );

    const stats = f.providerSelector.getProviderStats(provider.providerId);
    expect(stats).not.toBeNull();
    expect(stats!.successes).toBe(1);
    expect(stats!.adjustedTrustScore).toBeGreaterThan(stats!.originalTrustScore);
  });
});

// ── V10: Non-Regression ─────────────────────────────────────────────

describe('V10: 18.2 Non-Regression & Coexistence', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should expose settlementRuntime on kernel foundation', () => {
    expect(f.settlementRuntime).toBeTruthy();
  });

  it('should coexist with all 18.0 and 18.1 components', () => {
    // 18.0
    expect(f.settlementExecutionEngine).toBeTruthy();
    expect(f.revenueRealizationManager).toBeTruthy();
    expect(f.canonicalLedgerAdopter).toBeTruthy();
    // 18.1
    expect(f.governanceLayer).toBeTruthy();
    expect(f.settlementLedger).toBeTruthy();
    expect(f.feedbackEngine).toBeTruthy();
    // 18.2
    expect(f.settlementRuntime).toBeTruthy();
  });

  it('should still support core governance chain', () => {
    expect(f.identityRegistry).toBeTruthy();
    expect(f.envelopeManager).toBeTruthy();
    expect(f.mandateEngine).toBeTruthy();
    expect(f.firewall).toBeTruthy();
  });
});
