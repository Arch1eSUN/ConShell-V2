import { describe, it, expect, beforeEach } from 'vitest';
import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { EconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { SettlementExecutionRequest, SettlementReceipt, MandateSnapshot, PolicySnapshot, CapabilitySnapshot } from './settlement-governance.js';
import type { Mandate } from './mandate-engine.js';

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

function makeActiveMandateFor(snapshot: MandateSnapshot, amountNeeded: number): Mandate {
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

function createRequest(f: EconomicKernelFoundation, overrides?: Partial<Parameters<typeof f.governanceLayer.createExecutionRequest>[0]>) {
  return f.governanceLayer.createExecutionRequest({
    negotiationId: 'neg_1',
    requirementId: 'req_1',
    selectedOfferId: 'offer_1',
    providerId: 'stripe',
    amountCents: 5_000,
    asset: 'USD',
    network: 'mainnet',
    settlementKind: 'payment',
    purpose: 'API service fee',
    riskLevel: 'low',
    requiresHumanConfirmation: false,
    mandateSnapshot: defaultMandateSnapshot(),
    policySnapshot: defaultPolicySnapshot(),
    capabilitySnapshot: defaultCapabilitySnapshot(),
    ...overrides,
  });
}

function makeReceipt(req: SettlementExecutionRequest): Omit<SettlementReceipt, 'receiptId'> {
  return {
    executionRequestId: req.executionRequestId,
    providerId: req.providerId,
    externalReference: 'ext_ref_123',
    amountCents: req.amountCents,
    asset: req.asset,
    network: req.network,
    receivedAt: new Date().toISOString(),
    rawPayloadDigest: `digest_${req.executionRequestId}`,
    statusHint: 'success',
  };
}

// ── V1: Execution Request / Authorization / Plan Contracts ──────────

describe('V1: Execution Request & Authorization Contracts', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should create a formal execution request with all required fields', () => {
    const req = createRequest(f);
    expect(req.executionRequestId).toMatch(/^exec_req_/);
    expect(req.negotiationId).toBe('neg_1');
    expect(req.mandateSnapshot).toBeTruthy();
    expect(req.policySnapshot).toBeTruthy();
    expect(req.capabilitySnapshot).toBeTruthy();
    expect(req.expiresAt).toBeTruthy();
    expect(req.confirmationState).toBe('not_required');
  });

  it('should set confirmation state to pending when human confirmation required', () => {
    const req = createRequest(f, { requiresHumanConfirmation: true });
    expect(req.confirmationState).toBe('pending');
  });

  it('should authorize execution when all governance checks pass', () => {
    const req = createRequest(f);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(auth.decision).toBe('authorized_for_execution');
    expect(auth.mandateStillValid).toBe(true);
    expect(auth.policyStillValid).toBe(true);
    expect(auth.providerStillAllowed).toBe(true);
  });

  it('should generate an authorization with authorizedAt timestamp', () => {
    const req = createRequest(f);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(auth.authorizedAt).toBeTruthy();
  });
});

// ── V2: Settlement Lifecycle State Machine ──────────────────────────

describe('V2: Settlement Lifecycle State Machine', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should track full happy path: planned → authorized → submitted → proof_pending → verified → adopted', () => {
    const req = createRequest(f);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);

    // planned → authorized
    f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(f.governanceLayer.getRecord(req.executionRequestId)!.currentState).toBe('authorized_for_execution');

    // authorized → submitted → proof_pending
    f.governanceLayer.submitForExecution(req.executionRequestId);
    expect(f.governanceLayer.getRecord(req.executionRequestId)!.currentState).toBe('proof_pending');

    // proof_pending → receive receipt → verify → verified
    const receipt = makeReceipt(req);
    f.governanceLayer.receiveReceipt(req.executionRequestId, receipt);
    const vResult = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(vResult.outcome).toBe('verified_success');
    expect(f.governanceLayer.getRecord(req.executionRequestId)!.currentState).toBe('verified');

    // verified → adopted
    f.governanceLayer.markAdopted(req.executionRequestId);
    expect(f.governanceLayer.getRecord(req.executionRequestId)!.currentState).toBe('adopted_into_ledger');
  });

  it('should block submitting an unauthorized request', () => {
    const req = createRequest(f);
    const result = f.governanceLayer.submitForExecution(req.executionRequestId);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('planned');
  });

  it('should block adopting an unverified record', () => {
    const req = createRequest(f);
    const result = f.governanceLayer.markAdopted(req.executionRequestId);
    expect(result.success).toBe(false);
  });

  it('should maintain state history', () => {
    const req = createRequest(f);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    const record = f.governanceLayer.getRecord(req.executionRequestId)!;
    expect(record.stateHistory.length).toBeGreaterThanOrEqual(2);
    expect(record.stateHistory[0].state).toBe('planned');
    expect(record.stateHistory[1].state).toBe('authorized_for_execution');
  });
});

// ── V3: Mandate / Policy / Confirmation Boundary in Execution ───────

describe('V3: Governance Boundary Enforcement at Execution', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should detect mandate drift when mandate is revoked', () => {
    const req = createRequest(f);
    // Pass null mandate − simulates revoked
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, null, false);
    expect(auth.decision).toBe('drifted_since_negotiation');
    expect(auth.mandateStillValid).toBe(false);
  });

  it('should detect mandate drift when budget insufficient', () => {
    const req = createRequest(f, { amountCents: 60_000 });
    const snapshot = defaultMandateSnapshot();
    const mandate = makeActiveMandateFor(snapshot, req.amountCents);
    // mandate has 50k budget, request is 60k
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(auth.decision).toBe('drifted_since_negotiation');
    expect(auth.mandateStillValid).toBe(false);
  });

  it('should require human confirmation for explicit_transfer', () => {
    const req = createRequest(f, { settlementKind: 'transfer', requiresHumanConfirmation: true });
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(auth.decision).toBe('requires_human_confirmation');
    expect(auth.humanConfirmationPresent).toBe(false);
  });

  it('should authorize explicit_transfer when human confirmed', () => {
    const req = createRequest(f, { settlementKind: 'transfer', requiresHumanConfirmation: true });
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, true);
    expect(auth.decision).toBe('authorized_for_execution');
    expect(auth.humanConfirmationPresent).toBe(true);
  });

  it('should detect policy drift when amount exceeds limit', () => {
    const req = createRequest(f, {
      amountCents: 5_000,
      policySnapshot: { ...defaultPolicySnapshot(), maxAmountCents: 1_000 },
    });
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    const auth = f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    expect(auth.decision).toBe('drifted_since_negotiation');
    expect(auth.policyStillValid).toBe(false);
  });
});

// ── V4: Receipt Verification ────────────────────────────────────────

describe('V4: Receipt Verification Layer', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  function setupToProofPending(overrides?: any) {
    const req = createRequest(f, overrides);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    f.governanceLayer.submitForExecution(req.executionRequestId);
    return req;
  }

  it('should verify a valid receipt as verified_success', () => {
    const req = setupToProofPending();
    f.governanceLayer.receiveReceipt(req.executionRequestId, makeReceipt(req));
    const result = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(result.outcome).toBe('verified_success');
    expect(result.evidence).toBeTruthy();
    expect(result.evidence!.amountMatches).toBe(true);
  });

  it('should detect amount mismatch', () => {
    const req = setupToProofPending();
    const receipt = { ...makeReceipt(req), amountCents: 999, rawPayloadDigest: 'amismatch' };
    f.governanceLayer.receiveReceipt(req.executionRequestId, receipt);
    const result = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(result.outcome).toBe('amount_mismatch');
  });

  it('should detect provider mismatch', () => {
    const req = setupToProofPending();
    const receipt = { ...makeReceipt(req), providerId: 'unknown_provider', rawPayloadDigest: 'pmismatch' };
    f.governanceLayer.receiveReceipt(req.executionRequestId, receipt);
    const result = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(result.outcome).toBe('provider_mismatch');
  });

  it('should detect network mismatch', () => {
    const req = setupToProofPending();
    const receipt = { ...makeReceipt(req), network: 'devnet', rawPayloadDigest: 'nmismatch' };
    f.governanceLayer.receiveReceipt(req.executionRequestId, receipt);
    const result = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(result.outcome).toBe('network_mismatch');
  });

  it('should detect duplicate receipt', () => {
    const req1 = setupToProofPending();
    f.governanceLayer.receiveReceipt(req1.executionRequestId, makeReceipt(req1));
    f.governanceLayer.verifyReceipt(req1.executionRequestId);

    // Second request reusing the same digest
    const req2 = setupToProofPending();
    const dupReceipt = { ...makeReceipt(req2), rawPayloadDigest: `digest_${req1.executionRequestId}` };
    const res = f.governanceLayer.receiveReceipt(req2.executionRequestId, dupReceipt);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Duplicate');
  });

  it('should detect verification_inconclusive when statusHint is pending', () => {
    const req = setupToProofPending();
    const receipt = { ...makeReceipt(req), statusHint: 'pending' as const, rawPayloadDigest: 'inconclusive' };
    f.governanceLayer.receiveReceipt(req.executionRequestId, receipt);
    const result = f.governanceLayer.verifyReceipt(req.executionRequestId);
    expect(result.outcome).toBe('verification_inconclusive');
  });
});

// ── V5: Canonical Ledger Entries ────────────────────────────────────

describe('V5: Canonical Ledger Entries', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should adopt a verified settlement into the canonical ledger', () => {
    const result = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'exec_1',
      receiptId: 'rcpt_1',
      negotiationId: 'neg_1',
      requirementId: 'req_1',
      providerId: 'stripe',
      amountCents: 5_000,
      asset: 'USD',
      network: 'mainnet',
      purpose: 'API fee',
      direction: 'income',
      verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 'task_42' },
    });
    expect(result.success).toBe(true);
    expect(result.entryId).toMatch(/^ledger_/);
  });

  it('should reject non-verified_success into canonical ledger', () => {
    const result = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'exec_2',
      receiptId: 'rcpt_2',
      negotiationId: 'neg_2',
      requirementId: 'req_2',
      providerId: 'stripe',
      amountCents: 5_000,
      asset: 'USD',
      network: 'mainnet',
      purpose: 'API fee',
      direction: 'income',
      verificationStatus: 'amount_mismatch',
      attributionTarget: { kind: 'task', targetId: 'task_43' },
    });
    expect(result.success).toBe(false);
  });

  it('should block duplicate execution adoption', () => {
    const params = {
      executionRequestId: 'exec_dup',
      receiptId: 'rcpt_dup1',
      negotiationId: 'neg_1',
      requirementId: 'req_1',
      providerId: 'stripe',
      amountCents: 5_000,
      asset: 'USD',
      network: 'mainnet',
      purpose: 'fee',
      direction: 'income' as const,
      verificationStatus: 'verified_success' as const,
      attributionTarget: { kind: 'task' as const, targetId: 'task_1' },
    };
    f.settlementLedger.adoptVerifiedSettlement(params);
    const dup = f.settlementLedger.adoptVerifiedSettlement({ ...params, receiptId: 'rcpt_dup2' });
    expect(dup.success).toBe(false);
    expect(dup.reason).toContain('Duplicate');
  });

  it('should record failed settlements that dont disappear', () => {
    f.settlementLedger.recordFailed({
      executionRequestId: 'exec_fail',
      amountCents: 3_000,
      direction: 'income',
      failureReason: 'provider_mismatch',
      verificationOutcome: 'provider_mismatch',
      attributionTarget: { kind: 'task', targetId: 'task_fail' },
    });
    expect(f.settlementLedger.allFailed().length).toBe(1);
    expect(f.settlementLedger.allFailed()[0].failureReason).toBe('provider_mismatch');
  });

  it('should support direction-aware queries', () => {
    f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'exec_inc', receiptId: 'rcpt_inc',
      negotiationId: 'n1', requirementId: 'r1', providerId: 'stripe',
      amountCents: 10_000, asset: 'USD', network: 'mainnet', purpose: 'income',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'service', targetId: 'svc_1' },
    });
    f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'exec_spd', receiptId: 'rcpt_spd',
      negotiationId: 'n2', requirementId: 'r2', providerId: 'solana',
      amountCents: 2_000, asset: 'USD', network: 'mainnet', purpose: 'spend',
      direction: 'spend', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 'task_1' },
    });
    expect(f.settlementLedger.queryByDirection('income').length).toBe(1);
    expect(f.settlementLedger.queryByDirection('spend').length).toBe(1);
  });
});

// ── V6: Realized Income/Spend vs Pending/Failed Distinction ─────────

describe('V6: Realized vs Pending vs Failed Distinction', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should formally distinguish realized, pending, and failed in ledger summary', () => {
    // Realized
    f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e1', receiptId: 'r1',
      negotiationId: 'n1', requirementId: 'rq1', providerId: 'stripe',
      amountCents: 10_000, asset: 'USD', network: 'mainnet', purpose: 'api',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 't1' },
    });
    // Pending
    f.settlementLedger.recordPending({
      executionRequestId: 'e2', amountCents: 3_000, direction: 'income',
      purpose: 'pending api', attributionTarget: { kind: 'task', targetId: 't2' },
    });
    // Failed
    f.settlementLedger.recordFailed({
      executionRequestId: 'e3', amountCents: 1_000, direction: 'income',
      failureReason: 'verification_timeout', verificationOutcome: 'verification_inconclusive',
      attributionTarget: null,
    });

    const summary = f.settlementLedger.getLedgerSummary();
    expect(summary.totalEntries).toBe(1); // only realized
    expect(summary.totalIncomeCents).toBe(10_000);
    expect(summary.pendingCount).toBe(1);
    expect(summary.pendingAmountCents).toBe(3_000);
    expect(summary.failedCount).toBe(1);
    expect(summary.failedAmountCents).toBe(1_000);
  });
});

// ── V7: Profitability Attribution ───────────────────────────────────

describe('V7: Profitability Attribution', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should attribute income to a task target', () => {
    const entry = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_prof', receiptId: 'r_prof',
      negotiationId: 'n_prof', requirementId: 'rq_prof', providerId: 'stripe',
      amountCents: 8_000, asset: 'USD', network: 'mainnet', purpose: 'api',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 'task_profit' },
    });
    expect(entry.success).toBe(true);

    const ledgerEntry = f.settlementLedger.allEntries().find(e => e.entryId === entry.entryId!);
    f.feedbackEngine.recordAdoptedOutcome(ledgerEntry!);

    const snap = f.feedbackEngine.getProfitabilitySnapshot('task_profit', 'task');
    expect(snap.totalIncomeCents).toBe(8_000);
    expect(snap.netProfitCents).toBe(8_000);
  });

  it('should track spend and compute net profit correctly', () => {
    // Income
    const inc = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_inc', receiptId: 'r_inc',
      negotiationId: 'n1', requirementId: 'rq1', providerId: 'stripe',
      amountCents: 10_000, asset: 'USD', network: 'mainnet', purpose: 'api',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'service', targetId: 'svc_A' },
    });
    // Spend
    const spd = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_spd', receiptId: 'r_spd',
      negotiationId: 'n2', requirementId: 'rq2', providerId: 'solana',
      amountCents: 3_000, asset: 'USD', network: 'mainnet', purpose: 'infra',
      direction: 'spend', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'service', targetId: 'svc_A' },
    });

    f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === inc.entryId!)!);
    f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === spd.entryId!)!);

    const snap = f.feedbackEngine.getProfitabilitySnapshot('svc_A', 'service');
    expect(snap.totalIncomeCents).toBe(10_000);
    expect(snap.totalSpendCents).toBe(3_000);
    expect(snap.netProfitCents).toBe(7_000);
  });

  it('should bind profitability to agenda target', () => {
    const res = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_agenda', receiptId: 'r_agenda',
      negotiationId: 'n_a', requirementId: 'rq_a', providerId: 'stripe',
      amountCents: 5_000, asset: 'USD', network: 'mainnet', purpose: 'agenda',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'agenda', targetId: 'agenda_1' },
    });
    f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === res.entryId!)!);
    const snap = f.feedbackEngine.getProfitabilitySnapshot('agenda_1', 'agenda');
    expect(snap.totalIncomeCents).toBe(5_000);
  });
});

// ── V8: Survival / Agenda Feedback ──────────────────────────────────

describe('V8: Survival & Agenda Feedback Wiring', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should compute survival feedback from adopted outcomes', () => {
    const inc = f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_sv1', receiptId: 'r_sv1',
      negotiationId: 'n1', requirementId: 'rq1', providerId: 'stripe',
      amountCents: 20_000, asset: 'USD', network: 'mainnet', purpose: 'api',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 't_sv' },
    });
    f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === inc.entryId!)!);

    const feedback = f.feedbackEngine.getSurvivalFeedback();
    expect(feedback.totalRealizedIncomeCents).toBe(20_000);
    expect(feedback.netResultCents).toBe(20_000);
    expect(feedback.profitabilityHint).toBe('profitable');
    expect(feedback.hasFailedSettlements).toBe(false);
  });

  it('should generate provider risk signals from failed settlements', () => {
    f.settlementLedger.recordFailed({
      executionRequestId: 'e_fl1', amountCents: 1_000, direction: 'income',
      failureReason: 'verification_timeout', verificationOutcome: 'verification_inconclusive',
      attributionTarget: null,
    });
    f.feedbackEngine.recordFailedSettlement(f.settlementLedger.allFailed()[0], 'flaky_provider');
    f.feedbackEngine.recordFailedSettlement(f.settlementLedger.allFailed()[0], 'flaky_provider');

    const signals = f.feedbackEngine.getProviderRiskSignals();
    const flaky = signals.find(s => s.providerId === 'flaky_provider');
    expect(flaky).toBeTruthy();
    expect(flaky!.failedSettlements).toBe(2);
    expect(flaky!.riskLevel).toBe('high');
  });

  it('should not count failed settlements as profit', () => {
    f.settlementLedger.recordFailed({
      executionRequestId: 'e_nopr', amountCents: 50_000, direction: 'income',
      failureReason: 'provider_mismatch', verificationOutcome: 'provider_mismatch',
      attributionTarget: { kind: 'task', targetId: 't_nopr' },
    });
    const summary = f.feedbackEngine.getGlobalProfitabilitySummary();
    expect(summary.globalIncomeCents).toBe(0);
    expect(summary.globalNetProfitCents).toBe(0);
  });
});

// ── V9: Truth Surface ───────────────────────────────────────────────

describe('V9: Truth Surface Summaries', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should expose execution summary with state counts', () => {
    createRequest(f);
    createRequest(f);
    const summary = f.governanceLayer.getExecutionSummary();
    expect(summary.total).toBe(2);
    expect(summary.byState['planned']).toBe(2);
  });

  it('should expose verification summary', () => {
    const req = createRequest(f);
    const mandate = makeActiveMandateFor(defaultMandateSnapshot(), req.amountCents);
    f.governanceLayer.authorizeExecution(req.executionRequestId, mandate, false);
    f.governanceLayer.submitForExecution(req.executionRequestId);
    f.governanceLayer.receiveReceipt(req.executionRequestId, makeReceipt(req));
    f.governanceLayer.verifyReceipt(req.executionRequestId);

    const summary = f.governanceLayer.getVerificationSummary();
    expect(summary.total).toBe(1);
    expect(summary.byOutcome['verified_success']).toBe(1);
  });

  it('should expose ledger summary with income/spend/pending/failed', () => {
    f.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: 'e_ts', receiptId: 'r_ts',
      negotiationId: 'n_ts', requirementId: 'rq_ts', providerId: 'stripe',
      amountCents: 7_000, asset: 'USD', network: 'mainnet', purpose: 'api',
      direction: 'income', verificationStatus: 'verified_success',
      attributionTarget: { kind: 'task', targetId: 't_ts' },
    });
    f.settlementLedger.recordPending({
      executionRequestId: 'e_tsp', amountCents: 2_000, direction: 'spend',
      purpose: 'pending', attributionTarget: null,
    });

    const summary = f.settlementLedger.getLedgerSummary();
    expect(summary.totalIncomeCents).toBe(7_000);
    expect(summary.pendingCount).toBe(1);
    expect(summary.revenue.totalRealizedIncomeCents).toBe(7_000);
  });

  it('should expose profitability summary with top profitable/losing targets', () => {
    // Multiple targets
    for (const [id, income, spend] of [['t1', 10_000, 2_000], ['t2', 1_000, 5_000]] as const) {
      const incRes = f.settlementLedger.adoptVerifiedSettlement({
        executionRequestId: `ei_${id}`, receiptId: `ri_${id}`,
        negotiationId: `n_${id}`, requirementId: `r_${id}`, providerId: 'stripe',
        amountCents: income, asset: 'USD', network: 'mainnet', purpose: 'api',
        direction: 'income', verificationStatus: 'verified_success',
        attributionTarget: { kind: 'task', targetId: id },
      });
      f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === incRes.entryId!)!);

      const spdRes = f.settlementLedger.adoptVerifiedSettlement({
        executionRequestId: `es_${id}`, receiptId: `rs_${id}`,
        negotiationId: `ns_${id}`, requirementId: `rs_${id}`, providerId: 'stripe',
        amountCents: spend, asset: 'USD', network: 'mainnet', purpose: 'infra',
        direction: 'spend', verificationStatus: 'verified_success',
        attributionTarget: { kind: 'task', targetId: id },
      });
      f.feedbackEngine.recordAdoptedOutcome(f.settlementLedger.allEntries().find(e => e.entryId === spdRes.entryId!)!);
    }

    const summary = f.feedbackEngine.getGlobalProfitabilitySummary();
    expect(summary.topProfitable.length).toBeGreaterThanOrEqual(1);
    expect(summary.topLosing.length).toBeGreaterThanOrEqual(1);
    expect(summary.topProfitable[0].netProfitCents).toBeGreaterThan(0);
    expect(summary.topLosing[0].netProfitCents).toBeLessThan(0);
  });
});

// ── V10: Non-Regression ─────────────────────────────────────────────

describe('V10: 18.0 Non-Regression & Safety Boundary', () => {
  let f: EconomicKernelFoundation;
  beforeEach(() => { f = makeFoundation(); });

  it('should still expose 18.0 settlement execution engine', () => {
    expect(f.settlementExecutionEngine).toBeTruthy();
    expect(f.settlementExecutionEngine.allSettlements()).toHaveLength(0);
  });

  it('should still expose 18.0 revenue realization manager', () => {
    expect(f.revenueRealizationManager).toBeTruthy();
    expect(f.revenueRealizationManager.allRealizations()).toHaveLength(0);
  });

  it('should still expose 18.0 canonical ledger adopter', () => {
    expect(f.canonicalLedgerAdopter).toBeTruthy();
  });

  it('should still support core governance: identity + envelope + mandate + firewall', () => {
    expect(f.identityRegistry).toBeTruthy();
    expect(f.envelopeManager).toBeTruthy();
    expect(f.mandateEngine).toBeTruthy();
    expect(f.firewall).toBeTruthy();
  });

  it('should still support 17.8 reward + claim', () => {
    expect(f.rewardRegistry).toBeTruthy();
    expect(f.claimEngine).toBeTruthy();
  });

  it('should still support 17.9 negotiation', () => {
    expect(f.negotiationEngine).toBeTruthy();
    expect(f.providerSelector).toBeTruthy();
    expect(f.preparationManager).toBeTruthy();
    expect(f.negotiationAuditLog).toBeTruthy();
  });

  it('should coexist 18.1 modules with 18.0 modules', () => {
    expect(f.governanceLayer).toBeTruthy();
    expect(f.settlementLedger).toBeTruthy();
    expect(f.feedbackEngine).toBeTruthy();
  });
});
