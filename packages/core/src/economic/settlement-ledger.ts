/**
 * Round 18.1 — Canonical Settlement Ledger (G4, G5)
 *
 * Upgrades the 18.0 CanonicalLedgerAdopter from a simple adoption gate
 * into a real ledger truth layer with:
 * - Typed ledger entries (income/spend/pending/failed)
 * - Attribution target binding (task/service/agenda/session)
 * - Direction-aware queries
 * - Duplicate/idempotency guards
 *
 * Design invariants:
 * - Only `verified_success` can enter canonical ledger as realized
 * - Failed/rejected/expired form FailedSettlementEntry (never disappear)
 * - Duplicate receipt / adoption blocked
 * - Every entry has direction + attribution + verification truth
 */

import type { SettlementVerificationOutcome } from './settlement-governance.js';

// ── Types ────────────────────────────────────────────────────────────

export type LedgerDirection = 'income' | 'spend';

export interface AttributionTarget {
  readonly kind: 'task' | 'service' | 'agenda' | 'session' | 'runtime_operation';
  readonly targetId: string;
  readonly label?: string;
}

export interface SettlementLedgerEntry {
  readonly entryId: string;
  readonly direction: LedgerDirection;
  readonly requirementId: string;
  readonly negotiationId: string;
  readonly executionRequestId: string;
  readonly receiptId: string;
  readonly providerId: string;
  readonly amountCents: number;
  readonly asset: string;
  readonly network: string;
  readonly purpose: string;
  readonly verificationStatus: SettlementVerificationOutcome;
  readonly adoptedAt: string;
  readonly attributionTarget: AttributionTarget;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PendingSettlementEntry {
  readonly entryId: string;
  readonly executionRequestId: string;
  readonly amountCents: number;
  readonly direction: LedgerDirection;
  readonly purpose: string;
  readonly attributionTarget: AttributionTarget | null;
  readonly createdAt: string;
}

export interface FailedSettlementEntry {
  readonly entryId: string;
  readonly executionRequestId: string;
  readonly amountCents: number;
  readonly direction: LedgerDirection;
  readonly failureReason: string;
  readonly verificationOutcome: SettlementVerificationOutcome | null;
  readonly attributionTarget: AttributionTarget | null;
  readonly failedAt: string;
}

// ── Summaries (G5, G8) ──────────────────────────────────────────────

export interface RevenueRealizationSummary {
  readonly totalRealizedIncomeCents: number;
  readonly entryCount: number;
  readonly byProvider: Record<string, number>;
  readonly byAttribution: Record<string, number>;
}

export interface SpendRealizationSummary {
  readonly totalRealizedSpendCents: number;
  readonly entryCount: number;
  readonly byProvider: Record<string, number>;
  readonly byAttribution: Record<string, number>;
}

export interface SettlementLedgerSummary {
  readonly totalEntries: number;
  readonly totalIncomeCents: number;
  readonly totalSpendCents: number;
  readonly netCents: number;
  readonly pendingCount: number;
  readonly pendingAmountCents: number;
  readonly failedCount: number;
  readonly failedAmountCents: number;
  readonly revenue: RevenueRealizationSummary;
  readonly spend: SpendRealizationSummary;
}

// ── Canonical Ledger Class ──────────────────────────────────────────

let ledgerCounter = 0;

export class CanonicalSettlementLedger {
  private readonly entries = new Map<string, SettlementLedgerEntry>();
  private readonly pendingEntries = new Map<string, PendingSettlementEntry>();
  private readonly failedEntries = new Map<string, FailedSettlementEntry>();
  private readonly adoptedExecutionIds = new Set<string>();
  private readonly adoptedReceiptIds = new Set<string>();

  // ── G4: Adopt Verified Settlement into Ledger ───────────────────

  adoptVerifiedSettlement(params: {
    executionRequestId: string;
    receiptId: string;
    negotiationId: string;
    requirementId: string;
    providerId: string;
    amountCents: number;
    asset: string;
    network: string;
    purpose: string;
    direction: LedgerDirection;
    verificationStatus: SettlementVerificationOutcome;
    attributionTarget: AttributionTarget;
    metadata?: Record<string, unknown>;
  }): { success: boolean; entryId: string | null; reason: string } {
    // G4.3: Only verified_success can enter canonical ledger
    if (params.verificationStatus !== 'verified_success') {
      return {
        success: false,
        entryId: null,
        reason: `Cannot adopt: verification status is ${params.verificationStatus}, expected verified_success`,
      };
    }

    // Duplicate execution adoption guard
    if (this.adoptedExecutionIds.has(params.executionRequestId)) {
      return {
        success: false,
        entryId: null,
        reason: `Duplicate adoption: execution ${params.executionRequestId} already adopted`,
      };
    }

    // Duplicate receipt guard
    if (this.adoptedReceiptIds.has(params.receiptId)) {
      return {
        success: false,
        entryId: null,
        reason: `Duplicate receipt: ${params.receiptId} already adopted`,
      };
    }

    const entryId = `ledger_${++ledgerCounter}`;
    const entry: SettlementLedgerEntry = {
      entryId,
      direction: params.direction,
      requirementId: params.requirementId,
      negotiationId: params.negotiationId,
      executionRequestId: params.executionRequestId,
      receiptId: params.receiptId,
      providerId: params.providerId,
      amountCents: params.amountCents,
      asset: params.asset,
      network: params.network,
      purpose: params.purpose,
      verificationStatus: params.verificationStatus,
      adoptedAt: new Date().toISOString(),
      attributionTarget: params.attributionTarget,
      metadata: Object.freeze(params.metadata ?? {}),
    };

    this.entries.set(entryId, entry);
    this.adoptedExecutionIds.add(params.executionRequestId);
    this.adoptedReceiptIds.add(params.receiptId);

    // Remove from pending if it was there
    this.pendingEntries.delete(params.executionRequestId);

    return { success: true, entryId, reason: 'Adopted into canonical ledger' };
  }

  // ── G4: Record Pending Settlement ───────────────────────────────

  recordPending(params: {
    executionRequestId: string;
    amountCents: number;
    direction: LedgerDirection;
    purpose: string;
    attributionTarget: AttributionTarget | null;
  }): string {
    const entryId = `pending_${++ledgerCounter}`;
    const entry: PendingSettlementEntry = {
      entryId,
      executionRequestId: params.executionRequestId,
      amountCents: params.amountCents,
      direction: params.direction,
      purpose: params.purpose,
      attributionTarget: params.attributionTarget,
      createdAt: new Date().toISOString(),
    };
    this.pendingEntries.set(params.executionRequestId, entry);
    return entryId;
  }

  // ── G4.3: Record Failed Settlement ──────────────────────────────

  recordFailed(params: {
    executionRequestId: string;
    amountCents: number;
    direction: LedgerDirection;
    failureReason: string;
    verificationOutcome: SettlementVerificationOutcome | null;
    attributionTarget: AttributionTarget | null;
  }): string {
    const entryId = `failed_${++ledgerCounter}`;
    const entry: FailedSettlementEntry = {
      entryId,
      executionRequestId: params.executionRequestId,
      amountCents: params.amountCents,
      direction: params.direction,
      failureReason: params.failureReason,
      verificationOutcome: params.verificationOutcome,
      attributionTarget: params.attributionTarget,
      failedAt: new Date().toISOString(),
    };
    this.failedEntries.set(params.executionRequestId, entry);

    // Remove from pending if it was there
    this.pendingEntries.delete(params.executionRequestId);

    return entryId;
  }

  // ── G5: Direction-Aware Queries ─────────────────────────────────

  queryByDirection(direction: LedgerDirection): readonly SettlementLedgerEntry[] {
    return Array.from(this.entries.values()).filter(e => e.direction === direction);
  }

  queryByAttribution(targetId: string): readonly SettlementLedgerEntry[] {
    return Array.from(this.entries.values()).filter(e => e.attributionTarget.targetId === targetId);
  }

  queryByAttributionKind(kind: AttributionTarget['kind']): readonly SettlementLedgerEntry[] {
    return Array.from(this.entries.values()).filter(e => e.attributionTarget.kind === kind);
  }

  // ── G8: Summaries ───────────────────────────────────────────────

  getLedgerSummary(): SettlementLedgerSummary {
    const all = Array.from(this.entries.values());
    const incomeEntries = all.filter(e => e.direction === 'income');
    const spendEntries = all.filter(e => e.direction === 'spend');
    const pending = Array.from(this.pendingEntries.values());
    const failed = Array.from(this.failedEntries.values());

    const totalIncome = incomeEntries.reduce((s, e) => s + e.amountCents, 0);
    const totalSpend = spendEntries.reduce((s, e) => s + e.amountCents, 0);

    function buildByProvider(entries: readonly SettlementLedgerEntry[]): Record<string, number> {
      const m: Record<string, number> = {};
      for (const e of entries) m[e.providerId] = (m[e.providerId] ?? 0) + e.amountCents;
      return m;
    }

    function buildByAttribution(entries: readonly SettlementLedgerEntry[]): Record<string, number> {
      const m: Record<string, number> = {};
      for (const e of entries) {
        const key = `${e.attributionTarget.kind}:${e.attributionTarget.targetId}`;
        m[key] = (m[key] ?? 0) + e.amountCents;
      }
      return m;
    }

    return {
      totalEntries: all.length,
      totalIncomeCents: totalIncome,
      totalSpendCents: totalSpend,
      netCents: totalIncome - totalSpend,
      pendingCount: pending.length,
      pendingAmountCents: pending.reduce((s, e) => s + e.amountCents, 0),
      failedCount: failed.length,
      failedAmountCents: failed.reduce((s, e) => s + e.amountCents, 0),
      revenue: {
        totalRealizedIncomeCents: totalIncome,
        entryCount: incomeEntries.length,
        byProvider: buildByProvider(incomeEntries),
        byAttribution: buildByAttribution(incomeEntries),
      },
      spend: {
        totalRealizedSpendCents: totalSpend,
        entryCount: spendEntries.length,
        byProvider: buildByProvider(spendEntries),
        byAttribution: buildByAttribution(spendEntries),
      },
    };
  }

  allEntries(): readonly SettlementLedgerEntry[] {
    return Array.from(this.entries.values());
  }

  allPending(): readonly PendingSettlementEntry[] {
    return Array.from(this.pendingEntries.values());
  }

  allFailed(): readonly FailedSettlementEntry[] {
    return Array.from(this.failedEntries.values());
  }
}
