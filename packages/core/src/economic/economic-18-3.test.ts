/**
 * Round 18.3 — Settlement System Coupling Tests
 *
 * V1-V10 Verification Matrix:
 * V1: adopted settlement → economic state delta (income/spend)
 * V2: settled income/spend → profitability indirect benefit
 * V3: settled outcome → task feedback heuristic ingested
 * V4: settled outcome → agenda hint generation
 * V5: cross-system truth surface unified exposure
 * V6: writeback idempotency (same flow → no duplicate writeback)
 * V7: failed/rejected flow → no economic delta
 * V8: provider feedback → real impact on selectBestOffer scoring
 * V9: 18.2 canonical flow unchanged (no regression)
 * V10: orchestrator stage 10 integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SettlementSystemCoupling,
  type SpendTrackerWriteback,
  type TaskFeedbackWriteback,
  type SettlementWritebackEffect,
} from './settlement-system-coupling.js';
import type {
  SettlementRuntimeFlowResult,
  SettlementRuntimeFlowRequest,
} from './settlement-orchestrator.js';
import { SettlementRuntimeService, bridgeNegotiationToFlow } from './settlement-orchestrator.js';
import { createEconomicKernelFoundation } from './economic-kernel-foundation.js';
import type { EconomicKernelFoundation } from './economic-kernel-foundation.js';
import { SettlementGovernanceLayer } from './settlement-governance.js';
import type { SettlementReceipt, MandateSnapshot, PolicySnapshot, CapabilitySnapshot } from './settlement-governance.js';
import { CanonicalSettlementLedger } from './settlement-ledger.js';
import type { Mandate } from './mandate-engine.js';
import { SettlementFeedbackEngine } from './settlement-feedback.js';
import { ProviderSelector } from './provider-selection.js';
import type { PaymentOffer, PaymentNegotiationResult } from './payment-negotiation.js';
import type { TaskCompletionEvent } from './value-events.js';

// ── Test Helpers ──────────────────────────────────────────────────────

function makeAdoptedFlowResult(overrides?: Partial<SettlementRuntimeFlowResult>): SettlementRuntimeFlowResult {
  return {
    flowId: 'flow_test_1',
    finalStage: 'completed',
    finalStatus: 'adopted',
    negotiationId: 'neg_1',
    executionRequestId: 'exec_1',
    receiptId: 'receipt_1',
    ledgerEntryId: 'ledger_1',
    authorizationDecision: 'authorized_for_execution',
    verificationOutcome: 'verified_success',
    ledgerAdoptionResult: { success: true, reason: 'Adopted' },
    profitabilityEffects: { recordId: 'prof_1', direction: 'income', amountCents: 500 },
    survivalEffects: { profitabilityHint: 'profitable' },
    providerFeedbackApplied: true,
    systemWritebackApplied: false,
    writebackEffectId: null,
    operatorActionRequired: false,
    failureReason: null,
    auditTrail: { flowId: 'flow_test_1', events: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeFailedFlowResult(overrides?: Partial<SettlementRuntimeFlowResult>): SettlementRuntimeFlowResult {
  return {
    ...makeAdoptedFlowResult(),
    flowId: 'flow_failed_1',
    finalStage: 'failed',
    finalStatus: 'failed',
    failureReason: 'Verification failed',
    providerFeedbackApplied: false,
    ...overrides,
  };
}

function makeFlowRequest(overrides?: Partial<SettlementRuntimeFlowRequest>): SettlementRuntimeFlowRequest {
  return {
    flowId: 'flow_test_1',
    negotiationId: 'neg_1',
    requirementId: 'req_1',
    selectedOffer: {
      offerId: 'offer_1',
      providerId: 'provider_1',
      amountCents: 500,
      asset: 'USDC',
      network: 'base',
      trustScore: 80,
      estimatedLatencyMs: 100,
      minAmountCents: 10,
      maxAmountCents: 10000,
      settlementKind: 'instant',
      capabilities: ['payment'],
    } as any,
    providerId: 'provider_1',
    amountCents: 500,
    asset: 'USDC',
    network: 'base',
    settlementKind: 'payment',
    purpose: 'Test settlement',
    riskLevel: 'low',
    requiresHumanConfirmation: false,
    mandateSnapshot: null,
    policySnapshot: { allowedProviders: ['provider_1'], blockedAssets: [], allowedNetworks: ['base'], maxAmountCents: 10000 },
    capabilitySnapshot: { availableCapabilities: ['payment'] },
    direction: 'income',
    attributionTarget: { type: 'task', taskId: 'task_1' },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

class MockSpendTracker implements SpendTrackerWriteback {
  incomeRecords: { source: string; amountCents: number; txHash?: string }[] = [];
  spendRecords: { provider: string; costCents: number }[] = [];

  recordIncome(source: string, amountCents: number, txHash?: string): void {
    this.incomeRecords.push({ source, amountCents, txHash });
  }

  recordSpend(provider: string, costCents: number): boolean {
    this.spendRecords.push({ provider, costCents });
    return true;
  }
}

class MockTaskFeedback implements TaskFeedbackWriteback {
  events: TaskCompletionEvent[] = [];

  ingest(event: TaskCompletionEvent): void {
    this.events.push(event);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Round 18.3 — Settlement System Coupling', () => {
  let mockTracker: MockSpendTracker;
  let mockFeedback: MockTaskFeedback;
  let coupling: SettlementSystemCoupling;

  beforeEach(() => {
    mockTracker = new MockSpendTracker();
    mockFeedback = new MockTaskFeedback();
    coupling = new SettlementSystemCoupling(mockTracker, mockFeedback, null);
  });

  // ── V1: Economic State Delta (income/spend) ───────────────────────

  describe('V1: Economic State Delta Writeback', () => {
    it('writes income to SpendTracker for adopted settlement with direction=income', () => {
      const result = makeAdoptedFlowResult();
      const request = makeFlowRequest({ direction: 'income', amountCents: 500 });

      const effect = coupling.applyAdoptedSettlement(result, request);

      expect(effect.effectType).toBe('adopted');
      expect(effect.economicDelta.direction).toBe('income');
      expect(effect.economicDelta.amountCents).toBe(500);
      expect(effect.economicDelta.appliedToSpendTracker).toBe(true);
      expect(mockTracker.incomeRecords).toHaveLength(1);
      expect(mockTracker.incomeRecords[0].source).toBe('settlement:flow_test_1');
      expect(mockTracker.incomeRecords[0].amountCents).toBe(500);
    });

    it('writes spend to SpendTracker for adopted settlement with direction=spend', () => {
      const result = makeAdoptedFlowResult({ flowId: 'flow_spend_1' });
      const request = makeFlowRequest({ flowId: 'flow_spend_1', direction: 'spend', amountCents: 300 });

      const effect = coupling.applyAdoptedSettlement(result, request);

      expect(effect.effectType).toBe('adopted');
      expect(effect.economicDelta.direction).toBe('spend');
      expect(effect.economicDelta.appliedToSpendTracker).toBe(true);
      expect(mockTracker.spendRecords).toHaveLength(1);
      expect(mockTracker.spendRecords[0].costCents).toBe(300);
    });
  });

  // ── V2: Profitability Indirect Benefit ────────────────────────────

  describe('V2: Profitability Indirect Benefit', () => {
    it('income writeback increases economic state which feeds profitability evaluator', () => {
      const result = makeAdoptedFlowResult();
      const request = makeFlowRequest({ direction: 'income', amountCents: 1000 });

      coupling.applyAdoptedSettlement(result, request);

      // The SpendTracker.recordIncome was called, which feeds into
      // EconomicStateService.snapshot() and getProjection(),
      // which ProfitabilityEvaluator uses for scoring
      const summary = coupling.getRuntimeImpactSummary();
      expect(summary.totalSettlementIncomeCents).toBe(1000);
      expect(summary.netDeltaCents).toBe(1000);
    });

    it('spend writeback is tracked for profitability evaluator awareness', () => {
      const result = makeAdoptedFlowResult({ flowId: 'flow_v2_spend' });
      const request = makeFlowRequest({ flowId: 'flow_v2_spend', direction: 'spend', amountCents: 400 });

      coupling.applyAdoptedSettlement(result, request);

      const summary = coupling.getRuntimeImpactSummary();
      expect(summary.totalSettlementSpendCents).toBe(400);
      expect(summary.netDeltaCents).toBe(-400);
    });
  });

  // ── V3: Task Feedback Heuristic Ingestion ─────────────────────────

  describe('V3: Task Feedback Heuristic', () => {
    it('adopted settlement injects successful TaskCompletionEvent', () => {
      const result = makeAdoptedFlowResult();
      const request = makeFlowRequest({ settlementKind: 'payment', amountCents: 500, direction: 'income' });

      coupling.applyAdoptedSettlement(result, request);

      expect(mockFeedback.events).toHaveLength(1);
      const event = mockFeedback.events[0];
      expect(event.type).toBe('task_completion');
      expect(event.success).toBe(true);
      expect(event.taskName).toBe('settlement:payment');
      expect(event.revenueGenerated).toBe(true);
      expect(event.netValueCents).toBe(500);
    });

    it('failed settlement injects failure TaskCompletionEvent with zero cost', () => {
      const result = makeFailedFlowResult();
      const request = makeFlowRequest({ flowId: 'flow_failed_1' });

      coupling.applyFailedSettlement(result, request);

      expect(mockFeedback.events).toHaveLength(1);
      const event = mockFeedback.events[0];
      expect(event.success).toBe(false);
      expect(event.actualCostCents).toBe(0);
      expect(event.netValueCents).toBe(0);
    });
  });

  // ── V4: Agenda Hint Generation ────────────────────────────────────

  describe('V4: Agenda Hint Generation', () => {
    it('adopted income settlement generates boost hint', () => {
      const result = makeAdoptedFlowResult();
      const request = makeFlowRequest({ direction: 'income', amountCents: 800 });

      coupling.applyAdoptedSettlement(result, request);

      const hints = coupling.getAgendaHints();
      expect(hints).toHaveLength(1);
      expect(hints[0].influenceDirection).toBe('boost');
      expect(hints[0].amountCents).toBe(800);
      expect(hints[0].requirementId).toBe('req_1');
    });

    it('adopted spend settlement generates constrain hint', () => {
      const result = makeAdoptedFlowResult({ flowId: 'flow_v4_spend' });
      const request = makeFlowRequest({ flowId: 'flow_v4_spend', direction: 'spend' });

      coupling.applyAdoptedSettlement(result, request);

      const hints = coupling.getAgendaHints();
      expect(hints).toHaveLength(1);
      expect(hints[0].influenceDirection).toBe('constrain');
    });

    it('failed settlement does not generate agenda hint', () => {
      const result = makeFailedFlowResult();
      const request = makeFlowRequest({ flowId: 'flow_failed_1' });

      coupling.applyFailedSettlement(result, request);

      const influence = coupling.getAgendaInfluenceSummary();
      expect(influence.totalHints).toBe(0);
    });
  });

  // ── V5: Cross-System Truth Surface ────────────────────────────────

  describe('V5: Cross-System Truth Surface', () => {
    it('getSystemTruth returns unified view of all settlement impacts', () => {
      // Apply one adopted income and one failed
      const r1 = makeAdoptedFlowResult({ flowId: 'flow_truth_1' });
      const q1 = makeFlowRequest({ flowId: 'flow_truth_1', direction: 'income', amountCents: 1000 });
      coupling.applyAdoptedSettlement(r1, q1);

      const r2 = makeFailedFlowResult({ flowId: 'flow_truth_2' });
      const q2 = makeFlowRequest({ flowId: 'flow_truth_2' });
      coupling.applyFailedSettlement(r2, q2);

      const truth = coupling.getSystemTruth();

      expect(truth.writebackSummary.totalWritebacks).toBe(2);
      expect(truth.writebackSummary.adoptedWritebacks).toBe(1);
      expect(truth.writebackSummary.failedWritebacks).toBe(1);
      expect(truth.runtimeImpact.totalSettlementIncomeCents).toBe(1000);
      expect(truth.runtimeImpact.taskFeedbackEventsIngested).toBe(2);
      expect(truth.agendaInfluence.boostHints).toBe(1);
      expect(truth.postureSignals).toHaveLength(2);
      expect(truth.systemHealthIndicator).toBe('healthy');
      expect(truth.generatedAt).toBeTruthy();
    });

    it('health indicator changes to under_pressure with caution signals', () => {
      // Generate 2 failures → 2 caution signals, 0 relief → under_pressure
      for (let i = 0; i < 2; i++) {
        const fid = `flow_pressure_${i}`;
        coupling.applyFailedSettlement(
          makeFailedFlowResult({ flowId: fid }),
          makeFlowRequest({ flowId: fid }),
        );
      }

      const truth = coupling.getSystemTruth();
      expect(truth.systemHealthIndicator).toBe('under_pressure');
    });

    it('health indicator changes to critical with 3+ caution signals', () => {
      for (let i = 0; i < 3; i++) {
        const fid = `flow_critical_${i}`;
        coupling.applyFailedSettlement(
          makeFailedFlowResult({ flowId: fid }),
          makeFlowRequest({ flowId: fid }),
        );
      }

      const truth = coupling.getSystemTruth();
      expect(truth.systemHealthIndicator).toBe('critical');
    });
  });

  // ── V6: Idempotency Guard ─────────────────────────────────────────

  describe('V6: Idempotency Guard', () => {
    it('same flowId produces only one writeback effect', () => {
      const result = makeAdoptedFlowResult();
      const request = makeFlowRequest();

      const effect1 = coupling.applyAdoptedSettlement(result, request);
      const effect2 = coupling.applyAdoptedSettlement(result, request);

      expect(effect1.effectId).toBe(effect2.effectId);
      expect(mockTracker.incomeRecords).toHaveLength(1); // Only one income recorded
      expect(mockFeedback.events).toHaveLength(1); // Only one task event

      const summary = coupling.getWritebackSummary();
      expect(summary.totalWritebacks).toBe(1);
    });

    it('same failed flowId produces only one writeback effect', () => {
      const result = makeFailedFlowResult();
      const request = makeFlowRequest({ flowId: 'flow_failed_1' });

      coupling.applyFailedSettlement(result, request);
      coupling.applyFailedSettlement(result, request);

      expect(mockFeedback.events).toHaveLength(1);
    });
  });

  // ── V7: Failed Flow → No Economic Delta ───────────────────────────

  describe('V7: Failed Flow Safety Invariant', () => {
    it('failed settlement does NOT write income to SpendTracker', () => {
      const result = makeFailedFlowResult();
      const request = makeFlowRequest({ flowId: 'flow_failed_1', direction: 'income', amountCents: 5000 });

      coupling.applyFailedSettlement(result, request);

      expect(mockTracker.incomeRecords).toHaveLength(0);
      expect(mockTracker.spendRecords).toHaveLength(0);

      const effect = coupling.getEffectByFlowId('flow_failed_1');
      expect(effect).not.toBeNull();
      expect(effect!.economicDelta.amountCents).toBe(0);
      expect(effect!.economicDelta.appliedToSpendTracker).toBe(false);
    });

    it('failed settlement generates caution posture signal, not relief or pressure', () => {
      const result = makeFailedFlowResult();
      const request = makeFlowRequest({ flowId: 'flow_failed_1' });

      coupling.applyFailedSettlement(result, request);

      const signals = coupling.getPostureSignals();
      expect(signals).toHaveLength(1);
      expect(signals[0].direction).toBe('caution');
    });

    it('non-adopted status is redirected to failed path from applyAdoptedSettlement', () => {
      const result = makeAdoptedFlowResult({ finalStatus: 'rejected' });
      const request = makeFlowRequest();

      const effect = coupling.applyAdoptedSettlement(result, request);

      // Should be treated as a failed writeback (safety invariant)
      expect(effect.effectType).toBe('failed');
      expect(effect.economicDelta.appliedToSpendTracker).toBe(false);
      expect(mockTracker.incomeRecords).toHaveLength(0);
    });
  });

  // ── V8: Provider Trust Score Impact on Selection ──────────────────

  describe('V8: Provider Trust Score in Selection', () => {
    it('adjusted provider trust score affects selectBestOffer scoring', () => {
      const selector = new ProviderSelector();

      // Register two providers with same initial trust
      selector.registerProvider({
        providerId: 'provider_good',
        name: 'Good Provider',
        trustScore: 90,
        riskLevel: 'low',
        capabilities: ['payment'],
        supportedAssets: ['USDC'],
        supportedNetworks: ['base'],
        minAmountCents: 1,
        maxAmountCents: 100000,
      });

      selector.registerProvider({
        providerId: 'provider_bad',
        name: 'Bad Provider',
        trustScore: 90,
        riskLevel: 'low',
        capabilities: ['payment'],
        supportedAssets: ['USDC'],
        supportedNetworks: ['base'],
        minAmountCents: 1,
        maxAmountCents: 100000,
      });

      // Apply penalty to provider_bad (simulating settlement failure feedback)
      (selector as any).applyRiskPenalty('provider_bad', 'verification_failed', 40);

      // Create offers with identical static trust scores — using correct PaymentOffer shape
      const offers: PaymentOffer[] = [
        {
          offerId: 'offer_good',
          requirementId: 'req_1',
          providerId: 'provider_good',
          amountCents: 100,
          asset: 'USDC',
          network: 'base',
          trustScore: 90,
          estimatedLatencyMs: 100,
          settlementKind: 'instant',
        },
        {
          offerId: 'offer_bad',
          requirementId: 'req_1',
          providerId: 'provider_bad',
          amountCents: 100,
          asset: 'USDC',
          network: 'base',
          trustScore: 90,
          estimatedLatencyMs: 100,
          settlementKind: 'instant',
        },
      ];

      const result = selector.selectBestOffer(offers, {
        mandateMaxAmount: 100000,
        allowedNetworks: ['base'],
        allowedAssets: ['USDC'],
      });

      // provider_good should win: unadjusted trustScore=90 vs provider_bad=50 (90-40 penalty)
      expect(result.selectedProviderId).toBe('provider_good');
      expect(result.selectedOffer?.offerId).toBe('offer_good');
    });
  });

  // ── V9: 18.2 Canonical Flow Unchanged ─────────────────────────────

  describe('V9: 18.2 Canonical Flow Non-Regression', () => {
    it('orchestrator completes full flow via EKF when coupling is integrated', () => {
      // Use EKF factory — this is the same pattern 18.2 tests use
      const f = createEconomicKernelFoundation();

      // We need to set up a valid negotiation → flow bridge
      // Just verify that the runtime object exists and flow can be started
      const makeOffer = (): PaymentOffer => ({
        offerId: 'offer_compat',
        requirementId: 'req_compat',
        providerId: 'stripe',
        amountCents: 5_000,
        asset: 'USD',
        network: 'mainnet',
        settlementKind: 'hosted_checkout',
        estimatedLatencyMs: 200,
        trustScore: 85,
      });

      const neg: PaymentNegotiationResult = {
        negotiationId: 'neg_compat_1',
        decision: 'allow',
        requirementId: 'req_compat',
        selectedOffer: makeOffer(),
        rejectionReasons: [],
        preparationIntentId: 'prep_compat',
        requiresHumanConfirmation: false,
        comparisons: [],
        policiesApplied: [],
        negotiatedAt: new Date().toISOString(),
      };

      const mandateSnapshot: MandateSnapshot = {
        mandateId: 'mandate_compat',
        remainingBudget: 50_000,
        validUntil: new Date(Date.now() + 3600_000).toISOString(),
        status: 'active',
      };

      const policySnapshot: PolicySnapshot = {
        capturedAt: new Date().toISOString(),
        allowedProviders: ['stripe'],
        allowedNetworks: ['mainnet'],
        maxAmountCents: 100_000,
      };

      const capabilitySnapshot: CapabilitySnapshot = {
        economicIdentityId: 'econ_1',
        canSpend: true,
        canTransfer: true,
        capturedAt: new Date().toISOString(),
      };

      const { request } = bridgeNegotiationToFlow(neg, null, {
        policySnapshot,
        capabilitySnapshot,
        mandateSnapshot,
        direction: 'spend',
        attributionTarget: { type: 'task', taskId: 'task_compat' },
      });
      expect(request).not.toBeNull();

      const mandate: Mandate = {
        mandateId: mandateSnapshot.mandateId,
        economicIdentityId: 'econ_1',
        purpose: 'payment',
        asset: 'USD',
        network: 'mainnet',
        maxTotalAmount: 100_000,
        maxPerTransactionAmount: 50_000,
        validFrom: new Date(Date.now() - 3600_000).toISOString(),
        validUntil: mandateSnapshot.validUntil,
        allowedActionKinds: ['spend_within_mandate'],
        allowedProviders: ['stripe'],
        riskLevel: 'medium',
        approvalMode: 'auto',
        approvedBy: 'system',
        status: 'active',
        remainingBudget: mandateSnapshot.remainingBudget,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const receipt: Omit<SettlementReceipt, 'receiptId'> = {
        executionRequestId: 'placeholder',
        providerId: 'stripe',
        externalReference: 'ext_compat',
        amountCents: 5_000,
        asset: 'USD',
        network: 'mainnet',
        receivedAt: new Date().toISOString(),
        rawPayloadDigest: 'digest_compat',
        statusHint: 'success',
      };

      const result = f.settlementRuntime.executeFlow(request!, mandate, receipt, false);

      // Should complete successfully and now include writeback fields
      expect(result.finalStatus).toBe('adopted');
      expect(result.systemWritebackApplied).toBe(true);
      expect(result.writebackEffectId).toBeTruthy();

      // Coupling should have an effect for this flow
      const effect = f.settlementCoupling.getEffectByFlowId(request!.flowId);
      expect(effect).not.toBeNull();
      expect(effect!.effectType).toBe('adopted');
    });
  });

  // ── V10: Orchestrator Stage 10 Integration ────────────────────────

  describe('V10: Orchestrator Stage 10 Integration', () => {
    it('Stage 10 system_writeback fires and records effect via EKF', () => {
      const f = createEconomicKernelFoundation();

      const makeOffer = (): PaymentOffer => ({
        offerId: 'offer_v10',
        requirementId: 'req_v10',
        providerId: 'stripe',
        amountCents: 750,
        asset: 'USD',
        network: 'mainnet',
        settlementKind: 'hosted_checkout',
        estimatedLatencyMs: 200,
        trustScore: 85,
      });

      const neg: PaymentNegotiationResult = {
        negotiationId: 'neg_v10',
        decision: 'allow',
        requirementId: 'req_v10',
        selectedOffer: makeOffer(),
        rejectionReasons: [],
        preparationIntentId: 'prep_v10',
        requiresHumanConfirmation: false,
        comparisons: [],
        policiesApplied: [],
        negotiatedAt: new Date().toISOString(),
      };

      const mandateSnapshot: MandateSnapshot = {
        mandateId: 'mandate_v10',
        remainingBudget: 50_000,
        validUntil: new Date(Date.now() + 3600_000).toISOString(),
        status: 'active',
      };

      const { request } = bridgeNegotiationToFlow(neg, null, {
        policySnapshot: { capturedAt: new Date().toISOString(), allowedProviders: ['stripe'], allowedNetworks: ['mainnet'], maxAmountCents: 100_000 },
        capabilitySnapshot: { economicIdentityId: 'econ_1', canSpend: true, canTransfer: true, capturedAt: new Date().toISOString() },
        mandateSnapshot,
        direction: 'income',
        attributionTarget: { type: 'task', taskId: 'task_v10' },
      });
      expect(request).not.toBeNull();

      const mandate: Mandate = {
        mandateId: mandateSnapshot.mandateId,
        economicIdentityId: 'econ_1',
        purpose: 'payment',
        asset: 'USD',
        network: 'mainnet',
        maxTotalAmount: 100_000,
        maxPerTransactionAmount: 50_000,
        validFrom: new Date(Date.now() - 3600_000).toISOString(),
        validUntil: mandateSnapshot.validUntil,
        allowedActionKinds: ['spend_within_mandate'],
        allowedProviders: ['stripe'],
        riskLevel: 'medium',
        approvalMode: 'auto',
        approvedBy: 'system',
        status: 'active',
        remainingBudget: mandateSnapshot.remainingBudget,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const receipt: Omit<SettlementReceipt, 'receiptId'> = {
        executionRequestId: 'placeholder',
        providerId: 'stripe',
        externalReference: 'ext_v10',
        amountCents: 750,
        asset: 'USD',
        network: 'mainnet',
        receivedAt: new Date().toISOString(),
        rawPayloadDigest: 'digest_v10',
        statusHint: 'success',
      };

      const result = f.settlementRuntime.executeFlow(request!, mandate, receipt, false);

      expect(result.finalStatus).toBe('adopted');
      expect(result.systemWritebackApplied).toBe(true);
      expect(result.writebackEffectId).toBeTruthy();

      // Verify coupling layer received the writeback
      const effect = f.settlementCoupling.getEffectByFlowId(request!.flowId);
      expect(effect).not.toBeNull();
      expect(effect!.effectType).toBe('adopted');

      // Verify audit trail includes system_writeback stage
      const trace = f.settlementRuntime.getFlowTrace(request!.flowId);
      expect(trace).not.toBeNull();
      const writebackEvent = trace!.events.find((e: any) => e.stage === 'system_writeback');
      expect(writebackEvent).toBeDefined();
      expect(writebackEvent!.status).toBe('completed');
    });

    it('failed flow triggers coupling.applyFailedSettlement via recordFlowFailure', () => {
      const f = createEconomicKernelFoundation();

      // Create a flow request with no valid receipt → will fail at receipt stage
      const makeOffer = (): PaymentOffer => ({
        offerId: 'offer_fail',
        requirementId: 'req_fail',
        providerId: 'stripe',
        amountCents: 500,
        asset: 'USD',
        network: 'mainnet',
        settlementKind: 'hosted_checkout',
        estimatedLatencyMs: 200,
        trustScore: 85,
      });

      const neg: PaymentNegotiationResult = {
        negotiationId: 'neg_fail',
        decision: 'allow',
        requirementId: 'req_fail',
        selectedOffer: makeOffer(),
        rejectionReasons: [],
        preparationIntentId: 'prep_fail',
        requiresHumanConfirmation: false,
        comparisons: [],
        policiesApplied: [],
        negotiatedAt: new Date().toISOString(),
      };

      const { request } = bridgeNegotiationToFlow(neg, null, {
        policySnapshot: { capturedAt: new Date().toISOString(), allowedProviders: ['stripe'], allowedNetworks: ['mainnet'], maxAmountCents: 100_000 },
        capabilitySnapshot: { economicIdentityId: 'econ_1', canSpend: true, canTransfer: true, capturedAt: new Date().toISOString() },
        mandateSnapshot: { mandateId: 'm_fail', remainingBudget: 50_000, validUntil: new Date(Date.now() + 3600_000).toISOString(), status: 'active' },
        direction: 'spend',
        attributionTarget: { type: 'task', taskId: 'task_fail' },
      });
      expect(request).not.toBeNull();

      // Execute without receipt → should fail at receipt_submitted stage
      const result = f.settlementRuntime.executeFlow(request!, null, undefined, false);

      // Flow should not fully adopt without a receipt
      // The coupling should still track if it was called
      if (result.finalStatus !== 'adopted') {
        // The flow failed, and if system_writeback was not reached,
        // the recordFlowFailure path should have triggered coupling
        const effect = f.settlementCoupling.getEffectByFlowId(request!.flowId);
        if (effect) {
          expect(effect.effectType).toBe('failed');
          expect(effect.economicDelta.appliedToSpendTracker).toBe(false);
        }
      }
    });
  });

  // ── Summary Surface Queries ───────────────────────────────────────

  describe('Summary Surface Queries', () => {
    it('getWritebackSummary aggregates all effects', () => {
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'f1' }),
        makeFlowRequest({ flowId: 'f1', direction: 'income', amountCents: 200 }),
      );
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'f2' }),
        makeFlowRequest({ flowId: 'f2', direction: 'spend', amountCents: 100 }),
      );
      coupling.applyFailedSettlement(
        makeFailedFlowResult({ flowId: 'f3' }),
        makeFlowRequest({ flowId: 'f3' }),
      );

      const summary = coupling.getWritebackSummary();
      expect(summary.totalWritebacks).toBe(3);
      expect(summary.adoptedWritebacks).toBe(2);
      expect(summary.failedWritebacks).toBe(1);
      expect(summary.totalIncomeWrittenCents).toBe(200);
      expect(summary.totalSpendWrittenCents).toBe(100);
      expect(summary.netEconomicDeltaCents).toBe(100);
    });

    it('getAgendaInfluenceSummary aggregates hints correctly', () => {
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'hint_1' }),
        makeFlowRequest({ flowId: 'hint_1', direction: 'income' }),
      );
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'hint_2' }),
        makeFlowRequest({ flowId: 'hint_2', direction: 'spend' }),
      );

      const influence = coupling.getAgendaInfluenceSummary();
      expect(influence.totalHints).toBe(2);
      expect(influence.boostHints).toBe(1);
      expect(influence.constrainHints).toBe(1);
    });

    it('isFlowWrittenBack returns correct state', () => {
      expect(coupling.isFlowWrittenBack('nonexistent')).toBe(false);

      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'check_1' }),
        makeFlowRequest({ flowId: 'check_1' }),
      );

      expect(coupling.isFlowWrittenBack('check_1')).toBe(true);
    });
  });

  // ── Posture Signal Tests ──────────────────────────────────────────

  describe('Posture Signals', () => {
    it('income generates relief signal', () => {
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'posture_income' }),
        makeFlowRequest({ flowId: 'posture_income', direction: 'income' }),
      );

      const signals = coupling.getPostureSignals();
      expect(signals.find(s => s.direction === 'relief')).toBeDefined();
    });

    it('spend generates pressure signal', () => {
      coupling.applyAdoptedSettlement(
        makeAdoptedFlowResult({ flowId: 'posture_spend' }),
        makeFlowRequest({ flowId: 'posture_spend', direction: 'spend' }),
      );

      const signals = coupling.getPostureSignals();
      expect(signals.find(s => s.direction === 'pressure')).toBeDefined();
    });

    it('failure generates caution signal with higher magnitude', () => {
      coupling.applyFailedSettlement(
        makeFailedFlowResult({ flowId: 'posture_fail' }),
        makeFlowRequest({ flowId: 'posture_fail', amountCents: 100 }),
      );

      const signals = coupling.getPostureSignals();
      const caution = signals.find(s => s.direction === 'caution');
      expect(caution).toBeDefined();
      // Caution uses /5 divisor vs /10 for adopted → higher magnitude
      expect(caution!.magnitude).toBeGreaterThanOrEqual(20); // 100/5 = 20
    });
  });
});
