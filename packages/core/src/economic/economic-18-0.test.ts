import { describe, it, expect, beforeEach } from 'vitest';
import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { EconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { RawExternalProof } from './settlement-execution.js';

describe('Round 18.0 — Settlement Execution & Revenue Realization Runtime', () => {
  let kernel: EconomicKernelFoundation;

  beforeEach(() => {
    kernel = createEconomicKernelFoundation();
  });

  function setupNegotiationContext() {
    const econId = kernel.identityRegistry.create({ runtimeIdentityId: 'tester' });
    
    const req = kernel.negotiationEngine.createRequirement({
      resource: 'test_resource',
      purpose: 'test_purpose',
      providerId: 'stripe',
      asset: 'USD',
      network: 'fiat',
      amountCents: 1000,
      pricingMode: 'exact',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      allowedSettlementKinds: ['credit'],
    });

    const offer = {
      offerId: 'offer_1',
      requirementId: req.requirementId,
      providerId: 'stripe',
      amountCents: 1000,
      asset: 'USD',
      network: 'fiat',
      settlementKind: 'credit' as const,
      estimatedLatencyMs: 0,
      trustScore: 100,
    };
    
    const env = kernel.envelopeManager.create(econId.economicIdentityId, []);
    kernel.envelopeManager.grantScope(env.envelopeId, 'spend_within_mandate');
    kernel.identityRegistry.bindEnvelope(econId.economicIdentityId, env.envelopeId);
    
    kernel.mandateEngine.create({
      economicIdentityId: econId.economicIdentityId,
      purpose: 'test_purpose',
      maxTotalAmount: 5000,
      maxPerTransactionAmount: 5000,
      allowedActionKinds: ['spend_within_mandate'],
      validUntil: req.expiresAt,
      approvedBy: 'tester',
    });
    
    const negotiation = kernel.negotiate(req.requirementId, econId.economicIdentityId, 'tester', [offer]);
    
    if (negotiation.decision !== 'allow_and_prepare') {
      throw new Error('Negotiation rejected: ' + JSON.stringify(negotiation.rejectionReasons, null, 2));
    }
    
    return { req, offer, negotiation, econId };
  }

  it('V1: Converts raw proof into pending settlement', () => {
    const { negotiation } = setupNegotiationContext();
    expect(negotiation.decision).toBe('allow_and_prepare');
    
    const proof: RawExternalProof = {
      providerId: 'stripe',
      externalProofId: 'pi_3MtwBwLkdIwHu7ix28a3tqPc',
      amountCents: 1000,
      asset: 'USD',
      network: 'fiat',
      rawData: { status: 'succeeded' },
    };
    
    const result = kernel.settlementExecutionEngine.executeSettlement(proof, negotiation);
    expect(result.success).toBe(true);
    expect(result.record?.status).toBe('pending_verification');
  });

  it('V2: Verification transitions settlement state to verified', () => {
    const { negotiation } = setupNegotiationContext();
    const proof: RawExternalProof = {
      providerId: 'stripe',
      externalProofId: 'proof_v2',
      amountCents: 1000,
      asset: 'USD',
      network: 'fiat',
      rawData: {},
    };
    
    const execResult = kernel.settlementExecutionEngine.executeSettlement(proof, negotiation);
    expect(execResult.success).toBe(true);

    const verifyResult = kernel.settlementExecutionEngine.verifySettlement(execResult.settlementId!, 'valid');
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.finalStatus).toBe('verified');
  });

  it('V3: Revenue Split & Realization Logic', () => {
    const { negotiation, econId } = setupNegotiationContext();
    const proof: RawExternalProof = {
      providerId: 'stripe',
      externalProofId: 'proof_v3',
      amountCents: 1000,
      asset: 'USD',
      network: 'fiat',
      rawData: {},
    };
    
    const execResult = kernel.settlementExecutionEngine.executeSettlement(proof, negotiation);
    kernel.settlementExecutionEngine.verifySettlement(execResult.settlementId!, 'valid');
    const record = kernel.settlementExecutionEngine.getSettlement(execResult.settlementId!);

    const realization = kernel.revenueRealizationManager.realizeSettlement(record!, [
      { economicIdentityId: econId.economicIdentityId, amountCents: 900, reason: 'principal', type: 'principal' },
      { economicIdentityId: 'platform_treasury', amountCents: 100, reason: 'fee', type: 'platform_fee' },
    ]);

    expect(realization.totalRealizedCents).toBe(1000);
    expect(realization.splits).toHaveLength(2);
  });

  it('V4 & V5-V10: Ledger Adoption and Security Invariants', () => {
    const { negotiation, econId } = setupNegotiationContext();
    const proof: RawExternalProof = {
      providerId: 'stripe',
      externalProofId: 'proof_v4',
      amountCents: 1000,
      asset: 'USD',
      network: 'fiat',
      rawData: {},
    };
    
    // V1
    const execResult = kernel.settlementExecutionEngine.executeSettlement(proof, negotiation);
    
    // Double-spend prevention attempt (V5)
    const execDouble = kernel.settlementExecutionEngine.executeSettlement(proof, negotiation);
    expect(execDouble.success).toBe(false);
    expect(execDouble.reason).toContain('already been submitted');

    // Unverified adoption denial (V10)
    const recordUnverified = kernel.settlementExecutionEngine.getSettlement(execResult.settlementId!);
    try {
      const realizationFail = kernel.revenueRealizationManager.realizeSettlement(recordUnverified!, [{
        economicIdentityId: econId.economicIdentityId, amountCents: 1000, reason: 'all', type: 'principal'
      }]);
      kernel.canonicalLedgerAdopter.adoptRealization(realizationFail);
      expect.fail('Should have thrown on unverified realization');
    } catch (err: any) {
      expect(err.message).toContain('Cannot realize settlement in status: pending_verification');
    }

    // V2
    kernel.settlementExecutionEngine.verifySettlement(execResult.settlementId!, 'valid');
    const recordVerified = kernel.settlementExecutionEngine.getSettlement(execResult.settlementId!);

    // V3
    const realization = kernel.revenueRealizationManager.realizeSettlement(recordVerified!, [
      { economicIdentityId: econId.economicIdentityId, amountCents: 1000, reason: 'all', type: 'principal' },
    ]);

    // V4
    const adoptResult = kernel.canonicalLedgerAdopter.adoptRealization(realization);
    expect(adoptResult.success).toBe(true);

    // Double adoption denial (V4 variant)
    const adoptDouble = kernel.canonicalLedgerAdopter.adoptRealization(realization);
    expect(adoptDouble.success).toBe(false);
    expect(adoptDouble.reason).toContain('has already been adopted');
  });
});
