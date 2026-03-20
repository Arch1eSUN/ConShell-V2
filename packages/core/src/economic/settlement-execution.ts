/**
 * Round 18.0 — Settlement Execution & Verification
 *
 * Implements Option A (Decoupled & Asynchronous) for processing
 * external payment settlements.
 *
 * Stage 1: Execution (Raw Proof -> Pending Settlement)
 * Stage 2: Verification (Pending -> Verified/Rejected)
 *
 * Design Invariants:
 * - A settlement cannot be adopted (Ledger) until it is Verified.
 * - Duplicate proofs are rejected immediately in Stage 1.
 * - Stale/Expired negotiations cannot be settled.
 */

import type { PaymentNegotiationResult } from './payment-negotiation.js';

// ── Types ────────────────────────────────────────────────────────────

export type SettlementStatus = 'pending_verification' | 'verified' | 'rejected' | 'adopted';

export interface SettlementRecord {
  readonly settlementId: string;
  readonly negotiationId: string;
  readonly requirementId: string;
  readonly providerId: string;
  readonly externalProofId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly status: SettlementStatus;
  readonly rejectionReason: string | null;
  readonly createdAt: string;
  readonly verifiedAt: string | null;
}

export interface RawExternalProof {
  readonly providerId: string;
  readonly externalProofId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly rawData: Readonly<Record<string, unknown>>;
}

export interface SettlementExecutionResult {
  readonly success: boolean;
  readonly settlementId: string | null;
  readonly reason: string | null;
  readonly record: SettlementRecord | null;
}

export interface SettlementVerificationResult {
  readonly success: boolean;
  readonly settlementId: string;
  readonly finalStatus: SettlementStatus;
  readonly reason: string | null;
}

// ── Settlement Engine ────────────────────────────────────────────────

let settlementCounter = 0;

export class SettlementExecutionEngine {
  private readonly settlements = new Map<string, SettlementRecord>();
  private readonly proofIdToSettlementId = new Map<string, string>(); // Double-spend prevention

  /**
   * Stage 1: Execute Settlement (Proof -> Pending Record)
   * Validates the proof against the negotiation context and creates a pending record.
   */
  executeSettlement(
    proof: RawExternalProof,
    negotiation: PaymentNegotiationResult
  ): SettlementExecutionResult {
    // 1. Double-spend prevention: Has this proof been used?
    const existingSettlementId = this.proofIdToSettlementId.get(proof.externalProofId);
    if (existingSettlementId) {
      return {
        success: false,
        settlementId: existingSettlementId,
        reason: 'Proof has already been submitted',
        record: this.settlements.get(existingSettlementId) ?? null,
      };
    }

    // 2. Validate against negotiation
    if (!negotiation.selectedOffer) {
      return {
        success: false,
        settlementId: null,
        reason: 'Negotiation did not have a selected offer',
        record: null,
      };
    }

    if (negotiation.selectedOffer.providerId !== proof.providerId) {
      return {
        success: false,
        settlementId: null,
        reason: 'Provider mismatch between negotiation and proof',
        record: null,
      };
    }

    if (negotiation.selectedOffer.amountCents !== proof.amountCents) {
      return {
        success: false,
        settlementId: null,
        reason: 'Amount mismatch between negotiation and proof',
        record: null,
      };
    }

    if (negotiation.selectedOffer.asset !== proof.asset || negotiation.selectedOffer.network !== proof.network) {
      return {
        success: false,
        settlementId: null,
        reason: 'Asset/Network mismatch',
        record: null,
      };
    }

    // 3. Create Pending Record
    const settlementId = `settlement_${++settlementCounter}`;
    const record: SettlementRecord = {
      settlementId,
      negotiationId: negotiation.negotiationId,
      requirementId: negotiation.requirementId,
      providerId: proof.providerId,
      externalProofId: proof.externalProofId,
      amountCents: proof.amountCents,
      asset: proof.asset,
      network: proof.network,
      status: 'pending_verification',
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      verifiedAt: null,
    };

    this.settlements.set(settlementId, record);
    this.proofIdToSettlementId.set(proof.externalProofId, settlementId);

    return {
      success: true,
      settlementId,
      reason: null,
      record,
    };
  }

  /**
   * Stage 2: Asynchronous Verification
   * In a real system, this talks to Stripe/Solana to verify the proof.
   * Here we mock the outcome.
   */
  verifySettlement(
    settlementId: string,
    mockOutcome: 'valid' | 'invalid' | 'timeout' = 'valid'
  ): SettlementVerificationResult {
    const record = this.settlements.get(settlementId);
    if (!record) {
      return { success: false, settlementId, finalStatus: 'rejected', reason: 'Settlement not found' };
    }

    if (record.status !== 'pending_verification') {
      return {
        success: false,
        settlementId,
        finalStatus: record.status,
        reason: `Settlement is currently ${record.status}, expected pending_verification`,
      };
    }

    let finalStatus: SettlementStatus;
    let reason: string | null = null;

    if (mockOutcome === 'valid') {
      finalStatus = 'verified';
    } else if (mockOutcome === 'invalid') {
      finalStatus = 'rejected';
      reason = 'External provider reported proof as invalid or falsified';
    } else {
      finalStatus = 'rejected';
      reason = 'External verification timed out';
    }

    const updatedRecord: SettlementRecord = {
      ...record,
      status: finalStatus,
      rejectionReason: reason,
      verifiedAt: new Date().toISOString(),
    };

    this.settlements.set(settlementId, updatedRecord);

    return {
      success: finalStatus === 'verified',
      settlementId,
      finalStatus,
      reason,
    };
  }

  markAsAdopted(settlementId: string): boolean {
    const record = this.settlements.get(settlementId);
    if (!record || record.status !== 'verified') {
      return false;
    }

    this.settlements.set(settlementId, {
      ...record,
      status: 'adopted',
    });

    return true;
  }

  getPendingSettlements(): readonly SettlementRecord[] {
    return Array.from(this.settlements.values()).filter(s => s.status === 'pending_verification');
  }

  getSettlement(settlementId: string): SettlementRecord | undefined {
    return this.settlements.get(settlementId);
  }

  allSettlements(): readonly SettlementRecord[] {
    return Array.from(this.settlements.values());
  }
}
