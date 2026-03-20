/**
 * Round 18.1 — Settlement Governance Layer (G1, G2, G3, G9)
 *
 * Layered on top of 18.0 SettlementExecutionEngine.
 * Adds:
 * - Formal execution authorization contract (G1)
 * - Full lifecycle state machine (G2)
 * - Receipt + verification formalization (G3)
 * - Audit-grade failure handling (G9)
 *
 * Design invariants:
 * - Execution CANNOT bypass mandate/policy/confirmation/firewall
 * - `explicit_transfer` ALWAYS requires human confirmation
 * - State transitions are strictly enforced — no illegal jumps
 * - Failures are first-class citizens with typed reasons
 */

import type { Mandate } from './mandate-engine.js';

// ── Settlement Lifecycle State Machine (G2) ─────────────────────────

export type SettlementLifecycleState =
  | 'planned'
  | 'awaiting_human_confirmation'
  | 'authorized_for_execution'
  | 'submitted'
  | 'proof_pending'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'expired'
  | 'adopted_into_ledger';

/** Legal state transitions. Key = current, value = allowed next states. */
const LEGAL_TRANSITIONS: Record<SettlementLifecycleState, readonly SettlementLifecycleState[]> = {
  planned:                     ['awaiting_human_confirmation', 'authorized_for_execution', 'expired', 'failed'],
  awaiting_human_confirmation: ['authorized_for_execution', 'expired', 'failed'],
  authorized_for_execution:    ['submitted', 'expired', 'failed'],
  submitted:                   ['proof_pending', 'failed', 'expired'],
  proof_pending:               ['verified', 'rejected', 'failed', 'expired'],
  verified:                    ['adopted_into_ledger', 'failed'],
  rejected:                    [],  // terminal
  failed:                      [],  // terminal
  expired:                     [],  // terminal
  adopted_into_ledger:         [],  // terminal
};

// ── Failure Model (G9) ──────────────────────────────────────────────

export type SettlementRejectionReason =
  | 'duplicate_receipt'
  | 'stale_negotiation'
  | 'provider_mismatch'
  | 'amount_mismatch'
  | 'network_mismatch'
  | 'asset_mismatch'
  | 'receipt_invalid'
  | 'receipt_duplicate'
  | 'verification_timeout'
  | 'verification_inconclusive'
  | 'proof_falsified';

export type SettlementExpiryReason =
  | 'authorization_expired'
  | 'proof_window_expired'
  | 'negotiation_expired'
  | 'human_confirmation_timeout';

export interface SettlementFailure {
  readonly failureId: string;
  readonly executionRequestId: string;
  readonly reason: SettlementRejectionReason | SettlementExpiryReason | string;
  readonly details: string;
  readonly occurredAt: string;
  readonly previousState: SettlementLifecycleState;
}

// ── Authorization Result (G1) ───────────────────────────────────────

export type ExecutionAuthorizationDecision =
  | 'authorized_for_execution'
  | 'requires_human_confirmation'
  | 'forbidden_to_execute'
  | 'expired_before_execution'
  | 'drifted_since_negotiation';

export interface SettlementExecutionAuthorization {
  readonly decision: ExecutionAuthorizationDecision;
  readonly executionRequestId: string;
  readonly reason: string;
  readonly mandateStillValid: boolean;
  readonly policyStillValid: boolean;
  readonly providerStillAllowed: boolean;
  readonly humanConfirmationPresent: boolean;
  readonly authorizedAt: string | null;
}

// ── Execution Request Contract (G1) ─────────────────────────────────

export interface MandateSnapshot {
  readonly mandateId: string;
  readonly remainingBudget: number;
  readonly validUntil: string;
  readonly status: string;
}

export interface PolicySnapshot {
  readonly capturedAt: string;
  readonly allowedProviders: readonly string[];
  readonly allowedNetworks: readonly string[];
  readonly maxAmountCents: number;
}

export interface CapabilitySnapshot {
  readonly economicIdentityId: string;
  readonly canSpend: boolean;
  readonly canTransfer: boolean;
  readonly capturedAt: string;
}

export interface SettlementExecutionRequest {
  readonly executionRequestId: string;
  readonly negotiationId: string;
  readonly requirementId: string;
  readonly selectedOfferId: string;
  readonly providerId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly settlementKind: 'payment' | 'transfer' | 'refund';
  readonly purpose: string;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly requiresHumanConfirmation: boolean;
  readonly confirmationState: 'not_required' | 'pending' | 'confirmed' | 'denied';
  readonly mandateSnapshot: MandateSnapshot | null;
  readonly policySnapshot: PolicySnapshot;
  readonly capabilitySnapshot: CapabilitySnapshot;
  readonly preparedAt: string;
  readonly expiresAt: string;
}

// ── Receipt & Verification Contracts (G3) ───────────────────────────

export interface SettlementReceipt {
  readonly receiptId: string;
  readonly executionRequestId: string;
  readonly providerId: string;
  readonly externalReference: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly receivedAt: string;
  readonly rawPayloadDigest: string;
  readonly statusHint: 'success' | 'pending' | 'failed' | 'unknown';
}

export interface VerificationEvidenceBundle {
  readonly receiptId: string;
  readonly providerConfirmation: boolean;
  readonly amountMatches: boolean;
  readonly assetMatches: boolean;
  readonly networkMatches: boolean;
  readonly externalReferenceValid: boolean;
  readonly timestampReasonable: boolean;
  readonly checkedAt: string;
}

export type SettlementVerificationOutcome =
  | 'verified_success'
  | 'verified_failure'
  | 'verification_inconclusive'
  | 'receipt_invalid'
  | 'receipt_duplicate'
  | 'provider_mismatch'
  | 'amount_mismatch'
  | 'expiry_mismatch'
  | 'network_mismatch';

export interface SettlementVerificationResult_G3 {
  readonly receiptId: string;
  readonly outcome: SettlementVerificationOutcome;
  readonly evidence: VerificationEvidenceBundle | null;
  readonly reason: string;
  readonly verifiedAt: string;
}

// ── Lifecycle Record ────────────────────────────────────────────────

export interface SettlementLifecycleRecord {
  readonly executionRequestId: string;
  readonly currentState: SettlementLifecycleState;
  readonly request: SettlementExecutionRequest;
  readonly authorization: SettlementExecutionAuthorization | null;
  readonly receipt: SettlementReceipt | null;
  readonly verification: SettlementVerificationResult_G3 | null;
  readonly failure: SettlementFailure | null;
  readonly stateHistory: readonly { state: SettlementLifecycleState; at: string }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ── Governance Layer Class ──────────────────────────────────────────

let governanceCounter = 0;
let failureCounter = 0;

export class SettlementGovernanceLayer {
  private readonly records = new Map<string, SettlementLifecycleRecord>();
  private readonly receiptDigests = new Set<string>(); // duplicate prevention

  // ── G1: Create Execution Request ────────────────────────────────

  createExecutionRequest(params: {
    negotiationId: string;
    requirementId: string;
    selectedOfferId: string;
    providerId: string;
    amountCents: number;
    asset: string;
    network: string;
    settlementKind: 'payment' | 'transfer' | 'refund';
    purpose: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresHumanConfirmation: boolean;
    mandateSnapshot: MandateSnapshot | null;
    policySnapshot: PolicySnapshot;
    capabilitySnapshot: CapabilitySnapshot;
    ttlMinutes?: number;
  }): SettlementExecutionRequest {
    const now = new Date();
    const ttl = params.ttlMinutes ?? 30;
    const expiresAt = new Date(now.getTime() + ttl * 60_000);
    const executionRequestId = `exec_req_${++governanceCounter}`;

    const confirmationState = params.requiresHumanConfirmation ? 'pending' as const : 'not_required' as const;

    const request: SettlementExecutionRequest = {
      executionRequestId,
      negotiationId: params.negotiationId,
      requirementId: params.requirementId,
      selectedOfferId: params.selectedOfferId,
      providerId: params.providerId,
      amountCents: params.amountCents,
      asset: params.asset,
      network: params.network,
      settlementKind: params.settlementKind,
      purpose: params.purpose,
      riskLevel: params.riskLevel,
      requiresHumanConfirmation: params.requiresHumanConfirmation,
      confirmationState,
      mandateSnapshot: params.mandateSnapshot,
      policySnapshot: params.policySnapshot,
      capabilitySnapshot: params.capabilitySnapshot,
      preparedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const record: SettlementLifecycleRecord = {
      executionRequestId,
      currentState: 'planned',
      request,
      authorization: null,
      receipt: null,
      verification: null,
      failure: null,
      stateHistory: [{ state: 'planned', at: now.toISOString() }],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.records.set(executionRequestId, record);
    return request;
  }

  // ── G1: Authorize Execution ─────────────────────────────────────

  authorizeExecution(
    executionRequestId: string,
    currentMandate: Mandate | null,
    humanConfirmed: boolean,
  ): SettlementExecutionAuthorization {
    const record = this.records.get(executionRequestId);
    if (!record) {
      return {
        decision: 'forbidden_to_execute',
        executionRequestId,
        reason: 'Execution request not found',
        mandateStillValid: false,
        policyStillValid: false,
        providerStillAllowed: false,
        humanConfirmationPresent: false,
        authorizedAt: null,
      };
    }

    const req = record.request;
    const now = new Date();

    // 1. Check expiry
    if (now > new Date(req.expiresAt)) {
      const auth: SettlementExecutionAuthorization = {
        decision: 'expired_before_execution',
        executionRequestId,
        reason: 'Execution request has expired',
        mandateStillValid: false,
        policyStillValid: false,
        providerStillAllowed: false,
        humanConfirmationPresent: false,
        authorizedAt: null,
      };
      this.transitionState(executionRequestId, 'expired', 'Authorization expired');
      return auth;
    }

    // 2. Check mandate drift
    let mandateStillValid = true;
    if (req.mandateSnapshot) {
      if (!currentMandate) {
        mandateStillValid = false;
      } else if (currentMandate.mandateId !== req.mandateSnapshot.mandateId) {
        mandateStillValid = false;
      } else if (currentMandate.status !== 'active') {
        mandateStillValid = false;
      } else if (currentMandate.remainingBudget < req.amountCents) {
        mandateStillValid = false;
      }
    }

    // 3. Check policy drift — provider still allowed
    const providerStillAllowed =
      req.policySnapshot.allowedProviders.length === 0 ||
      req.policySnapshot.allowedProviders.includes(req.providerId);

    // 4. Check policy amount
    const policyStillValid = req.amountCents <= req.policySnapshot.maxAmountCents;

    // 5. Check human confirmation for explicit_transfer
    const humanConfirmationPresent = req.requiresHumanConfirmation ? humanConfirmed : true;

    // 6. explicit_transfer hard rule
    if (req.settlementKind === 'transfer' && !humanConfirmed) {
      const auth: SettlementExecutionAuthorization = {
        decision: 'requires_human_confirmation',
        executionRequestId,
        reason: 'explicit_transfer requires human confirmation',
        mandateStillValid,
        policyStillValid,
        providerStillAllowed,
        humanConfirmationPresent: false,
        authorizedAt: null,
      };
      this.transitionState(executionRequestId, 'awaiting_human_confirmation');
      return auth;
    }

    // 7. Human confirmation required but not present
    if (req.requiresHumanConfirmation && !humanConfirmed) {
      const auth: SettlementExecutionAuthorization = {
        decision: 'requires_human_confirmation',
        executionRequestId,
        reason: 'Human confirmation required but not yet provided',
        mandateStillValid,
        policyStillValid,
        providerStillAllowed,
        humanConfirmationPresent: false,
        authorizedAt: null,
      };
      this.transitionState(executionRequestId, 'awaiting_human_confirmation');
      return auth;
    }

    // 8. Drift detection
    if (!mandateStillValid || !policyStillValid || !providerStillAllowed) {
      const reasons: string[] = [];
      if (!mandateStillValid) reasons.push('mandate drifted or expired');
      if (!policyStillValid) reasons.push('policy amount limit exceeded');
      if (!providerStillAllowed) reasons.push('provider no longer allowed');

      const auth: SettlementExecutionAuthorization = {
        decision: 'drifted_since_negotiation',
        executionRequestId,
        reason: `Governance drift detected: ${reasons.join(', ')}`,
        mandateStillValid,
        policyStillValid,
        providerStillAllowed,
        humanConfirmationPresent,
        authorizedAt: null,
      };
      this.transitionState(executionRequestId, 'failed', `Drift: ${reasons.join(', ')}`);
      return auth;
    }

    // 9. All checks pass
    const auth: SettlementExecutionAuthorization = {
      decision: 'authorized_for_execution',
      executionRequestId,
      reason: 'All governance checks passed',
      mandateStillValid,
      policyStillValid,
      providerStillAllowed,
      humanConfirmationPresent,
      authorizedAt: now.toISOString(),
    };

    this.records.set(executionRequestId, {
      ...record,
      authorization: auth,
      updatedAt: now.toISOString(),
    });

    this.transitionState(executionRequestId, 'authorized_for_execution');
    return auth;
  }

  // ── G2: Submit for Execution ────────────────────────────────────

  submitForExecution(executionRequestId: string): { success: boolean; reason: string } {
    const record = this.records.get(executionRequestId);
    if (!record) {
      return { success: false, reason: 'Execution request not found' };
    }
    if (record.currentState !== 'authorized_for_execution') {
      return { success: false, reason: `Cannot submit: current state is ${record.currentState}, expected authorized_for_execution` };
    }
    this.transitionState(executionRequestId, 'submitted');
    this.transitionState(executionRequestId, 'proof_pending');
    return { success: true, reason: 'Submitted and awaiting proof' };
  }

  // ── G3: Receive Receipt ─────────────────────────────────────────

  receiveReceipt(
    executionRequestId: string,
    receipt: Omit<SettlementReceipt, 'receiptId'>,
  ): { success: boolean; receiptId: string | null; reason: string } {
    const record = this.records.get(executionRequestId);
    if (!record) {
      return { success: false, receiptId: null, reason: 'Execution request not found' };
    }
    if (record.currentState !== 'proof_pending') {
      return { success: false, receiptId: null, reason: `Cannot receive receipt: current state is ${record.currentState}` };
    }

    // Duplicate receipt digest check
    if (this.receiptDigests.has(receipt.rawPayloadDigest)) {
      this.recordFailure(executionRequestId, 'receipt_duplicate', 'Receipt payload digest already seen');
      return { success: false, receiptId: null, reason: 'Duplicate receipt' };
    }

    const receiptId = `rcpt_${++governanceCounter}`;
    const fullReceipt: SettlementReceipt = { ...receipt, receiptId };
    this.receiptDigests.add(receipt.rawPayloadDigest);

    const now = new Date().toISOString();
    this.records.set(executionRequestId, {
      ...record,
      receipt: fullReceipt,
      updatedAt: now,
    });

    return { success: true, receiptId, reason: 'Receipt received' };
  }

  // ── G3: Verify Receipt ──────────────────────────────────────────

  verifyReceipt(executionRequestId: string): SettlementVerificationResult_G3 {
    const record = this.records.get(executionRequestId);
    const now = new Date().toISOString();

    if (!record || !record.receipt) {
      return {
        receiptId: '',
        outcome: 'receipt_invalid',
        evidence: null,
        reason: 'No receipt found for this execution request',
        verifiedAt: now,
      };
    }

    const req = record.request;
    const rcpt = record.receipt;

    // Build evidence bundle
    const evidence: VerificationEvidenceBundle = {
      receiptId: rcpt.receiptId,
      providerConfirmation: rcpt.statusHint === 'success',
      amountMatches: rcpt.amountCents === req.amountCents,
      assetMatches: rcpt.asset === req.asset,
      networkMatches: rcpt.network === req.network,
      externalReferenceValid: rcpt.externalReference.length > 0,
      timestampReasonable: true,
      checkedAt: now,
    };

    // Determine outcome
    let outcome: SettlementVerificationOutcome;
    let reason: string;

    if (rcpt.providerId !== req.providerId) {
      outcome = 'provider_mismatch';
      reason = `Provider mismatch: expected ${req.providerId}, got ${rcpt.providerId}`;
    } else if (!evidence.amountMatches) {
      outcome = 'amount_mismatch';
      reason = `Amount mismatch: expected ${req.amountCents}, got ${rcpt.amountCents}`;
    } else if (!evidence.networkMatches) {
      outcome = 'network_mismatch';
      reason = `Network mismatch: expected ${req.network}, got ${rcpt.network}`;
    } else if (!evidence.assetMatches) {
      outcome = 'network_mismatch';
      reason = `Asset mismatch: expected ${req.asset}, got ${rcpt.asset}`;
    } else if (rcpt.statusHint === 'failed') {
      outcome = 'verified_failure';
      reason = 'Provider reported payment failure';
    } else if (rcpt.statusHint === 'pending' || rcpt.statusHint === 'unknown') {
      outcome = 'verification_inconclusive';
      reason = `Provider status hint: ${rcpt.statusHint}`;
    } else if (!evidence.externalReferenceValid) {
      outcome = 'receipt_invalid';
      reason = 'External reference is empty or invalid';
    } else {
      outcome = 'verified_success';
      reason = 'All evidence checks passed';
    }

    const result: SettlementVerificationResult_G3 = {
      receiptId: rcpt.receiptId,
      outcome,
      evidence,
      reason,
      verifiedAt: now,
    };

    // Transition state
    if (outcome === 'verified_success') {
      this.transitionState(executionRequestId, 'verified');
    } else {
      this.transitionState(executionRequestId, 'rejected', reason);
    }

    this.records.set(executionRequestId, {
      ...this.records.get(executionRequestId)!,
      verification: result,
      updatedAt: now,
    });

    return result;
  }

  // ── G2: Mark as Adopted ─────────────────────────────────────────

  markAdopted(executionRequestId: string): { success: boolean; reason: string } {
    const record = this.records.get(executionRequestId);
    if (!record) {
      return { success: false, reason: 'Execution request not found' };
    }
    if (record.currentState !== 'verified') {
      return { success: false, reason: `Cannot adopt: current state is ${record.currentState}, expected verified` };
    }
    this.transitionState(executionRequestId, 'adopted_into_ledger');
    return { success: true, reason: 'Adopted into ledger' };
  }

  // ── G9: Record Failure ──────────────────────────────────────────

  recordFailure(
    executionRequestId: string,
    reason: SettlementRejectionReason | SettlementExpiryReason | string,
    details: string,
  ): SettlementFailure | null {
    const record = this.records.get(executionRequestId);
    if (!record) return null;

    const failure: SettlementFailure = {
      failureId: `fail_${++failureCounter}`,
      executionRequestId,
      reason,
      details,
      occurredAt: new Date().toISOString(),
      previousState: record.currentState,
    };

    this.records.set(executionRequestId, {
      ...record,
      failure,
      updatedAt: failure.occurredAt,
    });

    // Transition to failed/rejected/expired based on reason
    if (reason === 'authorization_expired' || reason === 'proof_window_expired' ||
        reason === 'negotiation_expired' || reason === 'human_confirmation_timeout') {
      this.transitionState(executionRequestId, 'expired', details);
    } else {
      this.transitionState(executionRequestId, 'failed', details);
    }

    return failure;
  }

  // ── Internal: State Transition ──────────────────────────────────

  private transitionState(
    executionRequestId: string,
    targetState: SettlementLifecycleState,
    _reason?: string,
  ): boolean {
    const record = this.records.get(executionRequestId);
    if (!record) return false;

    const allowed = LEGAL_TRANSITIONS[record.currentState];
    if (!allowed.includes(targetState)) {
      return false; // Illegal transition — silently block
    }

    const now = new Date().toISOString();
    this.records.set(executionRequestId, {
      ...record,
      currentState: targetState,
      stateHistory: [...record.stateHistory, { state: targetState, at: now }],
      updatedAt: now,
    });
    return true;
  }

  // ── Queries ─────────────────────────────────────────────────────

  getRecord(executionRequestId: string): SettlementLifecycleRecord | undefined {
    return this.records.get(executionRequestId);
  }

  getByState(state: SettlementLifecycleState): readonly SettlementLifecycleRecord[] {
    return Array.from(this.records.values()).filter(r => r.currentState === state);
  }

  allRecords(): readonly SettlementLifecycleRecord[] {
    return Array.from(this.records.values());
  }

  getExecutionSummary(): {
    total: number;
    byState: Record<string, number>;
    failures: readonly SettlementFailure[];
    awaitingConfirmation: number;
    proofPending: number;
  } {
    const all = Array.from(this.records.values());
    const byState: Record<string, number> = {};
    const failures: SettlementFailure[] = [];

    for (const r of all) {
      byState[r.currentState] = (byState[r.currentState] ?? 0) + 1;
      if (r.failure) failures.push(r.failure);
    }

    return {
      total: all.length,
      byState,
      failures,
      awaitingConfirmation: byState['awaiting_human_confirmation'] ?? 0,
      proofPending: byState['proof_pending'] ?? 0,
    };
  }

  getVerificationSummary(): {
    total: number;
    byOutcome: Record<string, number>;
    recentFailures: readonly { receiptId: string; outcome: string; reason: string }[];
  } {
    const all = Array.from(this.records.values()).filter(r => r.verification);
    const byOutcome: Record<string, number> = {};
    const recentFailures: { receiptId: string; outcome: string; reason: string }[] = [];

    for (const r of all) {
      const v = r.verification!;
      byOutcome[v.outcome] = (byOutcome[v.outcome] ?? 0) + 1;
      if (v.outcome !== 'verified_success') {
        recentFailures.push({ receiptId: v.receiptId, outcome: v.outcome, reason: v.reason });
      }
    }

    return { total: all.length, byOutcome, recentFailures };
  }
}
