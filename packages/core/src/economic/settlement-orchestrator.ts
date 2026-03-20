/**
 * Round 18.2 — Unified Settlement Runtime Orchestrator
 *
 * THE canonical settlement entry point. Bridges:
 *  17.9 negotiation/preparation → 18.1 governance/ledger/feedback
 * into a single, end-to-end, auditable, recoverable flow.
 *
 * Design invariants:
 * - This is the ONLY canonical path for settlement execution
 * - 18.0/18.1 modules are sub-layers, NOT parallel entry points
 * - Every flow has a flowId-level audit trail
 * - Failure recovery is idempotent (no duplicate adoption/feedback)
 * - Provider feedback is based on REAL settlement outcomes only
 * - explicit_transfer still requires human confirmation (governance enforced)
 */

import type {
  PaymentNegotiationResult,
  PaymentOffer,
} from './payment-negotiation.js';
import type { PaymentPreparationIntent } from './payment-preparation.js';
import type { Mandate } from './mandate-engine.js';
import type {
  SettlementGovernanceLayer,
  SettlementExecutionRequest,
  SettlementExecutionAuthorization,
  SettlementReceipt,
  SettlementVerificationResult_G3,
  SettlementLifecycleRecord,
  MandateSnapshot,
  PolicySnapshot,
  CapabilitySnapshot,
  ExecutionAuthorizationDecision,
} from './settlement-governance.js';
import type {
  CanonicalSettlementLedger,
  AttributionTarget,
  LedgerDirection,
  SettlementLedgerEntry,
} from './settlement-ledger.js';
import type {
  SettlementFeedbackEngine,
  ProviderRiskSignal,
} from './settlement-feedback.js';
import type { ProviderSelector } from './provider-selection.js';
import type { SettlementSystemCoupling } from './settlement-system-coupling.js';

// ── Flow Stages & Status ────────────────────────────────────────────

export type SettlementFlowStage =
  | 'negotiation_bridge'
  | 'authorization'
  | 'pending_confirmation'
  | 'submission'
  | 'receipt_intake'
  | 'verification'
  | 'ledger_adoption'
  | 'feedback_applied'
  | 'provider_feedback'
  | 'system_writeback'
  | 'completed'
  | 'failed'
  | 'blocked';

export type SettlementFlowStatus =
  | 'adopted'
  | 'rejected'
  | 'failed'
  | 'blocked_before_execution'
  | 'awaiting_human_confirmation'
  | 'awaiting_receipt'
  | 'verification_inconclusive'
  | 'feedback_applied';

// ── Flow Request (bridge from 17.9) ─────────────────────────────────

export interface SettlementRuntimeFlowRequest {
  readonly flowId: string;
  readonly negotiationId: string;
  readonly requirementId: string;
  readonly selectedOffer: PaymentOffer;
  readonly providerId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly settlementKind: 'payment' | 'transfer' | 'refund';
  readonly purpose: string;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresHumanConfirmation: boolean;
  readonly mandateSnapshot: MandateSnapshot | null;
  readonly policySnapshot: PolicySnapshot;
  readonly capabilitySnapshot: CapabilitySnapshot;
  readonly direction: LedgerDirection;
  readonly attributionTarget: AttributionTarget;
  readonly createdAt: string;
}

// ── Flow Result ─────────────────────────────────────────────────────

export interface SettlementRuntimeFlowResult {
  readonly flowId: string;
  readonly finalStage: SettlementFlowStage;
  readonly finalStatus: SettlementFlowStatus;
  readonly negotiationId: string;
  readonly executionRequestId: string | null;
  readonly receiptId: string | null;
  readonly ledgerEntryId: string | null;
  readonly authorizationDecision: ExecutionAuthorizationDecision | null;
  readonly verificationOutcome: string | null;
  readonly ledgerAdoptionResult: { success: boolean; reason: string } | null;
  readonly profitabilityEffects: { recordId: string; direction: string; amountCents: number } | null;
  readonly survivalEffects: { profitabilityHint: string } | null;
  readonly providerFeedbackApplied: boolean;
  readonly systemWritebackApplied: boolean;
  readonly writebackEffectId: string | null;
  readonly operatorActionRequired: boolean;
  readonly failureReason: string | null;
  readonly auditTrail: SettlementFlowAuditTrail;
  readonly completedAt: string;
}

// ── Audit Trail ─────────────────────────────────────────────────────

export interface SettlementFlowAuditEvent {
  readonly flowId: string;
  readonly stage: SettlementFlowStage;
  readonly status: 'started' | 'completed' | 'failed' | 'skipped';
  readonly timestamp: string;
  readonly reason: string;
  readonly linkedIds: {
    readonly negotiationId?: string;
    readonly executionRequestId?: string;
    readonly receiptId?: string;
    readonly ledgerEntryId?: string;
    readonly feedbackEventId?: string;
  };
}

export interface SettlementFlowAuditTrail {
  readonly flowId: string;
  readonly events: readonly SettlementFlowAuditEvent[];
  readonly startedAt: string;
  readonly completedAt: string | null;
}

// ── Internal Flow Record ────────────────────────────────────────────

interface FlowRecord {
  readonly flowId: string;
  readonly request: SettlementRuntimeFlowRequest;
  result: SettlementRuntimeFlowResult | null;
  readonly auditEvents: SettlementFlowAuditEvent[];
  currentStage: SettlementFlowStage;
  executionRequestId: string | null;
  receiptId: string | null;
  ledgerEntryId: string | null;
  feedbackRecordId: string | null;
  receipt: Omit<SettlementReceipt, 'receiptId'> | null;
  humanConfirmed: boolean;
  startedAt: string;
}

// ── Bridge Function (G2) ────────────────────────────────────────────

let flowCounter = 0;

/**
 * Bridge 17.9 PaymentNegotiationResult + PaymentPreparationIntent
 * into a SettlementRuntimeFlowRequest.
 *
 * Returns null + reason if the negotiation result cannot enter the
 * settlement runtime (rejected, expired, stale, etc.).
 */
export function bridgeNegotiationToFlow(
  negotiation: PaymentNegotiationResult,
  intent: PaymentPreparationIntent | null,
  context: {
    mandateSnapshot: MandateSnapshot | null;
    policySnapshot: PolicySnapshot;
    capabilitySnapshot: CapabilitySnapshot;
    direction: LedgerDirection;
    attributionTarget: AttributionTarget;
  },
): { request: SettlementRuntimeFlowRequest | null; reason: string } {
  // 1. Reject if negotiation was rejected
  if (negotiation.decision === 'reject') {
    return {
      request: null,
      reason: `Negotiation rejected: ${negotiation.rejectionReasons.map(r => r.message).join('; ')}`,
    };
  }

  // 2. Must have a selected offer
  if (!negotiation.selectedOffer) {
    return {
      request: null,
      reason: 'No selected offer in negotiation result',
    };
  }

  // 3. Check intent staleness if provided
  if (intent) {
    if (intent.status === 'expired') {
      return { request: null, reason: 'Preparation intent has expired' };
    }
    if (intent.status === 'cancelled') {
      return { request: null, reason: 'Preparation intent was cancelled' };
    }
  }

  const offer = negotiation.selectedOffer;
  const flowId = `flow_${++flowCounter}`;

  // Map settlement kind from offer
  let settlementKind: 'payment' | 'transfer' | 'refund' = 'payment';
  if (offer.settlementKind === 'lightning' || offer.settlementKind === 'onchain') {
    settlementKind = 'transfer';
  }

  const request: SettlementRuntimeFlowRequest = {
    flowId,
    negotiationId: negotiation.negotiationId,
    requirementId: negotiation.requirementId,
    selectedOffer: offer,
    providerId: offer.providerId,
    amountCents: offer.amountCents,
    asset: offer.asset,
    network: offer.network,
    settlementKind,
    purpose: `Settlement for ${negotiation.requirementId}`,
    riskLevel: 'medium', // from negotiation context
    requiresHumanConfirmation: negotiation.requiresHumanConfirmation || settlementKind === 'transfer',
    mandateSnapshot: context.mandateSnapshot,
    policySnapshot: context.policySnapshot,
    capabilitySnapshot: context.capabilitySnapshot,
    direction: context.direction,
    attributionTarget: context.attributionTarget,
    createdAt: new Date().toISOString(),
  };

  return { request, reason: 'Bridge successful' };
}

// ── Settlement Runtime Service (G1) ─────────────────────────────────

export class SettlementRuntimeService {
  private readonly flows = new Map<string, FlowRecord>();
  private readonly completedFlowsByExecId = new Set<string>();

  constructor(
    private readonly governanceLayer: SettlementGovernanceLayer,
    private readonly settlementLedger: CanonicalSettlementLedger,
    private readonly feedbackEngine: SettlementFeedbackEngine,
    private readonly providerSelector: ProviderSelector,
    private readonly systemCoupling?: SettlementSystemCoupling,
  ) {}

  // ── Main Entry: Execute Full Flow ─────────────────────────────────

  executeFlow(
    request: SettlementRuntimeFlowRequest,
    currentMandate: Mandate | null,
    receiptData?: Omit<SettlementReceipt, 'receiptId'>,
    humanConfirmed: boolean = false,
  ): SettlementRuntimeFlowResult {
    const now = new Date().toISOString();

    // Initialize flow record
    const flow: FlowRecord = {
      flowId: request.flowId,
      request,
      result: null,
      auditEvents: [],
      currentStage: 'negotiation_bridge',
      executionRequestId: null,
      receiptId: null,
      ledgerEntryId: null,
      feedbackRecordId: null,
      receipt: receiptData ?? null,
      humanConfirmed,
      startedAt: now,
    };

    this.flows.set(request.flowId, flow);
    this.auditEvent(flow, 'negotiation_bridge', 'completed', 'Flow started from negotiation bridge', {
      negotiationId: request.negotiationId,
    });

    // ── Stage 1: Create Execution Request ─────────────────────────
    flow.currentStage = 'authorization';
    const execReq = this.governanceLayer.createExecutionRequest({
      negotiationId: request.negotiationId,
      requirementId: request.requirementId,
      selectedOfferId: request.selectedOffer.offerId,
      providerId: request.providerId,
      amountCents: request.amountCents,
      asset: request.asset,
      network: request.network,
      settlementKind: request.settlementKind,
      purpose: request.purpose,
      riskLevel: request.riskLevel,
      requiresHumanConfirmation: request.requiresHumanConfirmation,
      mandateSnapshot: request.mandateSnapshot,
      policySnapshot: request.policySnapshot,
      capabilitySnapshot: request.capabilitySnapshot,
    });

    flow.executionRequestId = execReq.executionRequestId;
    this.auditEvent(flow, 'authorization', 'started', 'Execution request created', {
      negotiationId: request.negotiationId,
      executionRequestId: execReq.executionRequestId,
    });

    // ── Stage 2: Authorize Execution ──────────────────────────────
    const auth = this.governanceLayer.authorizeExecution(
      execReq.executionRequestId,
      currentMandate,
      humanConfirmed,
    );

    this.auditEvent(flow, 'authorization', auth.decision === 'authorized_for_execution' ? 'completed' : 'failed',
      `Authorization: ${auth.decision} — ${auth.reason}`, {
        negotiationId: request.negotiationId,
        executionRequestId: execReq.executionRequestId,
      });

    // Check authorization result
    if (auth.decision === 'requires_human_confirmation') {
      flow.currentStage = 'pending_confirmation';
      return this.buildResult(flow, 'pending_confirmation', 'awaiting_human_confirmation',
        null, auth.decision, now);
    }

    if (auth.decision !== 'authorized_for_execution') {
      flow.currentStage = 'failed';
      const failReason = `Authorization failed: ${auth.reason}`;
      this.recordFlowFailure(flow, failReason, request.direction);
      return this.buildResult(flow, 'failed', 'blocked_before_execution',
        failReason, auth.decision, now);
    }

    // ── Stage 3: Submit for Execution ─────────────────────────────
    flow.currentStage = 'submission';
    const submitResult = this.governanceLayer.submitForExecution(execReq.executionRequestId);
    this.auditEvent(flow, 'submission', submitResult.success ? 'completed' : 'failed',
      submitResult.reason, { executionRequestId: execReq.executionRequestId });

    if (!submitResult.success) {
      flow.currentStage = 'failed';
      this.recordFlowFailure(flow, submitResult.reason, request.direction);
      return this.buildResult(flow, 'failed', 'failed', submitResult.reason, auth.decision, now);
    }

    // ── Stage 4: Receipt Intake ───────────────────────────────────
    flow.currentStage = 'receipt_intake';

    if (!receiptData) {
      // No receipt yet — mark as awaiting
      this.settlementLedger.recordPending({
        executionRequestId: execReq.executionRequestId,
        amountCents: request.amountCents,
        direction: request.direction,
        purpose: request.purpose,
        attributionTarget: request.attributionTarget,
      });
      this.auditEvent(flow, 'receipt_intake', 'started', 'Awaiting receipt', {
        executionRequestId: execReq.executionRequestId,
      });
      return this.buildResult(flow, 'receipt_intake', 'awaiting_receipt', null, auth.decision, now);
    }

    const receiptResult = this.governanceLayer.receiveReceipt(execReq.executionRequestId, receiptData);
    this.auditEvent(flow, 'receipt_intake', receiptResult.success ? 'completed' : 'failed',
      receiptResult.reason, {
        executionRequestId: execReq.executionRequestId,
        receiptId: receiptResult.receiptId ?? undefined,
      });

    if (!receiptResult.success) {
      flow.currentStage = 'failed';
      this.recordFlowFailure(flow, receiptResult.reason, request.direction);
      return this.buildResult(flow, 'failed', 'failed', receiptResult.reason, auth.decision, now);
    }

    flow.receiptId = receiptResult.receiptId;

    // ── Stage 5: Verification ─────────────────────────────────────
    flow.currentStage = 'verification';
    const verification = this.governanceLayer.verifyReceipt(execReq.executionRequestId);
    this.auditEvent(flow, 'verification',
      verification.outcome === 'verified_success' ? 'completed' : 'failed',
      `Verification: ${verification.outcome} — ${verification.reason}`, {
        executionRequestId: execReq.executionRequestId,
        receiptId: verification.receiptId,
      });

    if (verification.outcome === 'verification_inconclusive') {
      return this.buildResult(flow, 'verification', 'verification_inconclusive',
        verification.reason, auth.decision, now);
    }

    if (verification.outcome !== 'verified_success') {
      flow.currentStage = 'failed';
      this.recordFlowFailure(flow, `Verification failed: ${verification.reason}`, request.direction,
        verification.outcome);
      this.applyProviderPenalty(request.providerId, verification.outcome);
      return this.buildResult(flow, 'failed', 'rejected',
        verification.reason, auth.decision, now);
    }

    // ── Stage 6: Ledger Adoption ──────────────────────────────────
    flow.currentStage = 'ledger_adoption';
    const adoption = this.settlementLedger.adoptVerifiedSettlement({
      executionRequestId: execReq.executionRequestId,
      receiptId: verification.receiptId,
      negotiationId: request.negotiationId,
      requirementId: request.requirementId,
      providerId: request.providerId,
      amountCents: request.amountCents,
      asset: request.asset,
      network: request.network,
      purpose: request.purpose,
      direction: request.direction,
      verificationStatus: 'verified_success',
      attributionTarget: request.attributionTarget,
    });

    this.auditEvent(flow, 'ledger_adoption', adoption.success ? 'completed' : 'failed',
      adoption.reason, {
        executionRequestId: execReq.executionRequestId,
        ledgerEntryId: adoption.entryId ?? undefined,
      });

    if (!adoption.success) {
      // Duplicate or other adoption failure — not a runtime error, but a skip
      return this.buildResult(flow, 'ledger_adoption', 'failed',
        adoption.reason, auth.decision, now);
    }

    flow.ledgerEntryId = adoption.entryId;
    this.governanceLayer.markAdopted(execReq.executionRequestId);
    this.completedFlowsByExecId.add(execReq.executionRequestId);

    // ── Stage 7: Feedback ─────────────────────────────────────────
    flow.currentStage = 'feedback_applied';

    // Build ledger entry for feedback engine
    const ledgerEntry: SettlementLedgerEntry = {
      entryId: adoption.entryId!,
      direction: request.direction,
      requirementId: request.requirementId,
      negotiationId: request.negotiationId,
      executionRequestId: execReq.executionRequestId,
      receiptId: verification.receiptId,
      providerId: request.providerId,
      amountCents: request.amountCents,
      asset: request.asset,
      network: request.network,
      purpose: request.purpose,
      verificationStatus: 'verified_success',
      adoptedAt: new Date().toISOString(),
      attributionTarget: request.attributionTarget,
      metadata: {},
    };

    const profRecord = this.feedbackEngine.recordAdoptedOutcome(ledgerEntry);
    flow.feedbackRecordId = profRecord.recordId;
    this.auditEvent(flow, 'feedback_applied', 'completed', 'Profitability feedback recorded', {
      executionRequestId: execReq.executionRequestId,
      ledgerEntryId: adoption.entryId ?? undefined,
      feedbackEventId: profRecord.recordId,
    });

    // ── Stage 8: Provider Feedback (G6) ───────────────────────────
    flow.currentStage = 'provider_feedback';
    this.applyProviderSuccess(request.providerId);
    this.auditEvent(flow, 'provider_feedback', 'completed',
      `Provider ${request.providerId} success bonus applied`, {
        executionRequestId: execReq.executionRequestId,
      });

    // ── Stage 9: System Writeback (18.3) ───────────────────────────
    flow.currentStage = 'system_writeback';
    let systemWritebackApplied = false;
    let writebackEffectId: string | null = null;

    if (this.systemCoupling) {
      // Build a partial result to pass to the coupling layer
      const partialResult: any = {
        flowId: request.flowId,
        finalStatus: 'adopted',
        receiptId: verification.receiptId,
        failureReason: null,
      };
      const effect = this.systemCoupling.applyAdoptedSettlement(partialResult, request);
      systemWritebackApplied = true;
      writebackEffectId = effect.effectId;
      this.auditEvent(flow, 'system_writeback', 'completed',
        `System writeback applied: ${effect.effectId}`, {
          executionRequestId: execReq.executionRequestId,
        });
    } else {
      this.auditEvent(flow, 'system_writeback', 'skipped',
        'No system coupling configured', {
          executionRequestId: execReq.executionRequestId,
        });
    }

    // ── Stage 10: Complete ────────────────────────────────────────
    flow.currentStage = 'completed';
    const survivalFeedback = this.feedbackEngine.getSurvivalFeedback();

    const result = this.buildResult(flow, 'completed', 'adopted', null, auth.decision, now, {
      profitabilityEffects: {
        recordId: profRecord.recordId,
        direction: request.direction,
        amountCents: request.amountCents,
      },
      survivalEffects: { profitabilityHint: survivalFeedback.profitabilityHint },
      providerFeedbackApplied: true,
      systemWritebackApplied,
      writebackEffectId,
      ledgerEntryId: adoption.entryId,
      receiptId: verification.receiptId,
      verificationOutcome: verification.outcome,
      ledgerAdoptionResult: adoption,
    });

    return result;
  }

  // ── Resume Flow (G8) ──────────────────────────────────────────────

  resumeFlow(
    flowId: string,
    receiptData?: Omit<SettlementReceipt, 'receiptId'>,
    humanConfirmed?: boolean,
    currentMandate?: Mandate | null,
  ): SettlementRuntimeFlowResult {
    const flow = this.flows.get(flowId);
    if (!flow) {
      const now = new Date().toISOString();
      return {
        flowId,
        finalStage: 'failed',
        finalStatus: 'failed',
        negotiationId: '',
        executionRequestId: null,
        receiptId: null,
        ledgerEntryId: null,
        authorizationDecision: null,
        verificationOutcome: null,
        ledgerAdoptionResult: null,
        profitabilityEffects: null,
        survivalEffects: null,
        providerFeedbackApplied: false,
        systemWritebackApplied: false,
        writebackEffectId: null,
        operatorActionRequired: false,
        failureReason: `Flow ${flowId} not found`,
        auditTrail: { flowId, events: [], startedAt: now, completedAt: now },
        completedAt: now,
      };
    }

    // Update receipt if provided
    if (receiptData) flow.receipt = receiptData;
    if (humanConfirmed !== undefined) flow.humanConfirmed = humanConfirmed;

    // Re-execute from current state
    return this.executeFlow(
      flow.request,
      currentMandate ?? null,
      flow.receipt ?? undefined,
      flow.humanConfirmed,
    );
  }

  // ── Replay Flow (G8) ──────────────────────────────────────────────

  replayFlow(
    flowId: string,
    currentMandate?: Mandate | null,
  ): SettlementRuntimeFlowResult {
    const flow = this.flows.get(flowId);
    if (!flow) {
      const now = new Date().toISOString();
      return {
        flowId,
        finalStage: 'failed',
        finalStatus: 'failed',
        negotiationId: '',
        executionRequestId: null,
        receiptId: null,
        ledgerEntryId: null,
        authorizationDecision: null,
        verificationOutcome: null,
        ledgerAdoptionResult: null,
        profitabilityEffects: null,
        survivalEffects: null,
        providerFeedbackApplied: false,
        systemWritebackApplied: false,
        writebackEffectId: null,
        operatorActionRequired: false,
        failureReason: `Flow ${flowId} not found for replay`,
        auditTrail: { flowId, events: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        completedAt: new Date().toISOString(),
      };
    }

    // Idempotency: if already completed with adoption, return existing result
    if (flow.executionRequestId && this.completedFlowsByExecId.has(flow.executionRequestId)) {
      if (flow.result) return flow.result;
    }

    // Replay from scratch with existing receipt data
    return this.executeFlow(
      flow.request,
      currentMandate ?? null,
      flow.receipt ?? undefined,
      flow.humanConfirmed,
    );
  }

  // ── Flow Queries (G7) ─────────────────────────────────────────────

  getFlowTrace(flowId: string): SettlementFlowAuditTrail | null {
    const flow = this.flows.get(flowId);
    if (!flow) return null;
    return {
      flowId,
      events: [...flow.auditEvents],
      startedAt: flow.startedAt,
      completedAt: flow.result?.completedAt ?? null,
    };
  }

  getFlowById(flowId: string): SettlementRuntimeFlowResult | null {
    const flow = this.flows.get(flowId);
    return flow?.result ?? null;
  }

  listFlows(filter?: { status?: SettlementFlowStatus; stage?: SettlementFlowStage }): readonly {
    flowId: string;
    stage: SettlementFlowStage;
    status: SettlementFlowStatus | null;
    negotiationId: string;
    providerId: string;
    amountCents: number;
    startedAt: string;
  }[] {
    const all = Array.from(this.flows.values());
    let filtered = all;

    if (filter?.status) {
      filtered = filtered.filter(f => f.result?.finalStatus === filter.status);
    }
    if (filter?.stage) {
      filtered = filtered.filter(f => f.currentStage === filter.stage);
    }

    return filtered.map(f => ({
      flowId: f.flowId,
      stage: f.currentStage,
      status: f.result?.finalStatus ?? null,
      negotiationId: f.request.negotiationId,
      providerId: f.request.providerId,
      amountCents: f.request.amountCents,
      startedAt: f.startedAt,
    }));
  }

  allFlowResults(): readonly SettlementRuntimeFlowResult[] {
    return Array.from(this.flows.values())
      .filter(f => f.result !== null)
      .map(f => f.result!);
  }

  // ── Private Helpers ───────────────────────────────────────────────

  private auditEvent(
    flow: FlowRecord,
    stage: SettlementFlowStage,
    status: SettlementFlowAuditEvent['status'],
    reason: string,
    linkedIds: SettlementFlowAuditEvent['linkedIds'] = {},
  ): void {
    flow.auditEvents.push({
      flowId: flow.flowId,
      stage,
      status,
      timestamp: new Date().toISOString(),
      reason,
      linkedIds,
    });
  }

  private buildResult(
    flow: FlowRecord,
    finalStage: SettlementFlowStage,
    finalStatus: SettlementFlowStatus,
    failureReason: string | null,
    authDecision: ExecutionAuthorizationDecision | null,
    startedAt: string,
    extras?: {
      profitabilityEffects?: SettlementRuntimeFlowResult['profitabilityEffects'];
      survivalEffects?: SettlementRuntimeFlowResult['survivalEffects'];
      providerFeedbackApplied?: boolean;
      systemWritebackApplied?: boolean;
      writebackEffectId?: string | null;
      ledgerEntryId?: string | null;
      receiptId?: string;
      verificationOutcome?: string;
      ledgerAdoptionResult?: { success: boolean; reason: string };
    },
  ): SettlementRuntimeFlowResult {
    const now = new Date().toISOString();
    const result: SettlementRuntimeFlowResult = {
      flowId: flow.flowId,
      finalStage,
      finalStatus,
      negotiationId: flow.request.negotiationId,
      executionRequestId: flow.executionRequestId,
      receiptId: extras?.receiptId ?? flow.receiptId,
      ledgerEntryId: extras?.ledgerEntryId ?? flow.ledgerEntryId,
      authorizationDecision: authDecision,
      verificationOutcome: extras?.verificationOutcome ?? null,
      ledgerAdoptionResult: extras?.ledgerAdoptionResult ?? null,
      profitabilityEffects: extras?.profitabilityEffects ?? null,
      survivalEffects: extras?.survivalEffects ?? null,
      providerFeedbackApplied: extras?.providerFeedbackApplied ?? false,
      systemWritebackApplied: extras?.systemWritebackApplied ?? false,
      writebackEffectId: extras?.writebackEffectId ?? null,
      operatorActionRequired: finalStatus === 'awaiting_human_confirmation' ||
                              finalStatus === 'verification_inconclusive',
      failureReason,
      auditTrail: {
        flowId: flow.flowId,
        events: [...flow.auditEvents],
        startedAt,
        completedAt: now,
      },
      completedAt: now,
    };

    flow.result = result;
    return result;
  }

  private recordFlowFailure(
    flow: FlowRecord,
    reason: string,
    direction: LedgerDirection,
    verificationOutcome?: string,
  ): void {
    if (flow.executionRequestId) {
      this.settlementLedger.recordFailed({
        executionRequestId: flow.executionRequestId,
        amountCents: flow.request.amountCents,
        direction,
        failureReason: reason,
        verificationOutcome: (verificationOutcome as any) ?? null,
        attributionTarget: flow.request.attributionTarget,
      });

      this.feedbackEngine.recordFailedSettlement({
        entryId: `failed_flow_${flow.flowId}`,
        executionRequestId: flow.executionRequestId,
        amountCents: flow.request.amountCents,
        direction,
        failureReason: reason,
        verificationOutcome: (verificationOutcome as any) ?? null,
        attributionTarget: flow.request.attributionTarget,
        failedAt: new Date().toISOString(),
      }, flow.request.providerId);

      // Round 18.3: System coupling writeback for failures
      if (this.systemCoupling) {
        const failedResult: any = {
          flowId: flow.flowId,
          finalStatus: 'failed',
          receiptId: null,
          failureReason: reason,
        };
        this.systemCoupling.applyFailedSettlement(failedResult, flow.request);
      }
    }
  }

  private applyProviderPenalty(providerId: string, reason: string): void {
    // G6: Write back provider risk to selection layer
    if (typeof (this.providerSelector as any).applyRiskPenalty === 'function') {
      (this.providerSelector as any).applyRiskPenalty(providerId, reason, 10);
    }
  }

  private applyProviderSuccess(providerId: string): void {
    // G6: Write back provider success to selection layer
    if (typeof (this.providerSelector as any).applySuccessBonus === 'function') {
      (this.providerSelector as any).applySuccessBonus(providerId, 2);
    }
  }
}
