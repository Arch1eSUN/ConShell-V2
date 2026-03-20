/**
 * Round 18.1 — Settlement Feedback Engine (G6, G7)
 *
 * Wires adopted settlement outcomes into:
 * - Per-task/service/agenda profitability tracking (G6)
 * - Survival / agenda feedback signals (G7)
 * - Provider risk signal aggregation
 *
 * Design invariants:
 * - Profitability is based ONLY on adopted outcomes, not negotiation
 * - Failed settlements do NOT generate fake profit
 * - Provider risk signals are derived from verification failures
 * - Feedback events are immutable audit records
 */

import type { AttributionTarget, SettlementLedgerEntry, FailedSettlementEntry } from './settlement-ledger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface ProfitabilityAttributionRecord {
  readonly recordId: string;
  readonly attributionTarget: AttributionTarget;
  readonly direction: 'income' | 'spend';
  readonly amountCents: number;
  readonly sourceEntryId: string;
  readonly recordedAt: string;
}

export interface ProfitabilitySnapshot {
  readonly targetId: string;
  readonly targetKind: string;
  readonly totalIncomeCents: number;
  readonly totalSpendCents: number;
  readonly netProfitCents: number;
  readonly entryCount: number;
}

export interface ProfitabilitySummary {
  readonly globalIncomeCents: number;
  readonly globalSpendCents: number;
  readonly globalNetProfitCents: number;
  readonly snapshotsByTarget: readonly ProfitabilitySnapshot[];
  readonly topProfitable: readonly ProfitabilitySnapshot[];
  readonly topLosing: readonly ProfitabilitySnapshot[];
}

export interface ProviderRiskSignal {
  readonly providerId: string;
  readonly totalSettlements: number;
  readonly failedSettlements: number;
  readonly failureRate: number;
  readonly recentFailureReasons: readonly string[];
  readonly riskLevel: 'low' | 'medium' | 'high';
}

export type SettlementFeedbackEventKind =
  | 'realized_income'
  | 'realized_spend'
  | 'failed_settlement'
  | 'provider_risk_updated';

export interface SettlementFeedbackEvent {
  readonly eventId: string;
  readonly kind: SettlementFeedbackEventKind;
  readonly amountCents: number;
  readonly targetId: string | null;
  readonly providerId: string;
  readonly timestamp: string;
}

export interface SurvivalFeedback {
  readonly totalRealizedIncomeCents: number;
  readonly totalRealizedSpendCents: number;
  readonly netResultCents: number;
  readonly hasFailedSettlements: boolean;
  readonly providerRiskSignals: readonly ProviderRiskSignal[];
  readonly profitabilityHint: 'profitable' | 'break_even' | 'losing';
}

// ── Feedback Engine Class ───────────────────────────────────────────

let feedbackCounter = 0;

export class SettlementFeedbackEngine {
  private readonly attributionRecords: ProfitabilityAttributionRecord[] = [];
  private readonly feedbackEvents: SettlementFeedbackEvent[] = [];
  // per-target accumulator: key = `${kind}:${targetId}`
  private readonly targetIncome = new Map<string, number>();
  private readonly targetSpend = new Map<string, number>();
  private readonly targetEntryCount = new Map<string, number>();
  // provider risk tracking
  private readonly providerTotalCount = new Map<string, number>();
  private readonly providerFailCount = new Map<string, number>();
  private readonly providerRecentFailures = new Map<string, string[]>();

  // ── G6: Record Adopted Outcome ──────────────────────────────────

  recordAdoptedOutcome(entry: SettlementLedgerEntry): ProfitabilityAttributionRecord {
    const key = `${entry.attributionTarget.kind}:${entry.attributionTarget.targetId}`;
    const recordId = `prof_${++feedbackCounter}`;

    const record: ProfitabilityAttributionRecord = {
      recordId,
      attributionTarget: entry.attributionTarget,
      direction: entry.direction,
      amountCents: entry.amountCents,
      sourceEntryId: entry.entryId,
      recordedAt: new Date().toISOString(),
    };

    this.attributionRecords.push(record);

    // Update per-target accumulators
    if (entry.direction === 'income') {
      this.targetIncome.set(key, (this.targetIncome.get(key) ?? 0) + entry.amountCents);
    } else {
      this.targetSpend.set(key, (this.targetSpend.get(key) ?? 0) + entry.amountCents);
    }
    this.targetEntryCount.set(key, (this.targetEntryCount.get(key) ?? 0) + 1);

    // Provider success tracking
    this.providerTotalCount.set(entry.providerId, (this.providerTotalCount.get(entry.providerId) ?? 0) + 1);

    // Emit feedback event
    this.feedbackEvents.push({
      eventId: `fb_${feedbackCounter}`,
      kind: entry.direction === 'income' ? 'realized_income' : 'realized_spend',
      amountCents: entry.amountCents,
      targetId: entry.attributionTarget.targetId,
      providerId: entry.providerId,
      timestamp: record.recordedAt,
    });

    return record;
  }

  // ── G6: Record Failed Settlement ────────────────────────────────

  recordFailedSettlement(entry: FailedSettlementEntry, providerId: string): void {
    // Provider failure tracking
    this.providerTotalCount.set(providerId, (this.providerTotalCount.get(providerId) ?? 0) + 1);
    this.providerFailCount.set(providerId, (this.providerFailCount.get(providerId) ?? 0) + 1);

    const failures = this.providerRecentFailures.get(providerId) ?? [];
    failures.push(entry.failureReason);
    this.providerRecentFailures.set(providerId, failures);

    this.feedbackEvents.push({
      eventId: `fb_${++feedbackCounter}`,
      kind: 'failed_settlement',
      amountCents: entry.amountCents,
      targetId: entry.attributionTarget?.targetId ?? null,
      providerId,
      timestamp: new Date().toISOString(),
    });
  }

  // ── G6: Profitability Queries ───────────────────────────────────

  getProfitabilitySnapshot(targetId: string, targetKind: string): ProfitabilitySnapshot {
    const key = `${targetKind}:${targetId}`;
    const income = this.targetIncome.get(key) ?? 0;
    const spend = this.targetSpend.get(key) ?? 0;
    return {
      targetId,
      targetKind,
      totalIncomeCents: income,
      totalSpendCents: spend,
      netProfitCents: income - spend,
      entryCount: this.targetEntryCount.get(key) ?? 0,
    };
  }

  getGlobalProfitabilitySummary(): ProfitabilitySummary {
    const allKeys = new Set([...this.targetIncome.keys(), ...this.targetSpend.keys()]);
    const snapshots: ProfitabilitySnapshot[] = [];

    for (const key of allKeys) {
      const [kind, ...idParts] = key.split(':');
      const targetId = idParts.join(':');
      const income = this.targetIncome.get(key) ?? 0;
      const spend = this.targetSpend.get(key) ?? 0;
      snapshots.push({
        targetId,
        targetKind: kind,
        totalIncomeCents: income,
        totalSpendCents: spend,
        netProfitCents: income - spend,
        entryCount: this.targetEntryCount.get(key) ?? 0,
      });
    }

    const globalIncome = snapshots.reduce((s, p) => s + p.totalIncomeCents, 0);
    const globalSpend = snapshots.reduce((s, p) => s + p.totalSpendCents, 0);

    const sorted = [...snapshots].sort((a, b) => b.netProfitCents - a.netProfitCents);

    return {
      globalIncomeCents: globalIncome,
      globalSpendCents: globalSpend,
      globalNetProfitCents: globalIncome - globalSpend,
      snapshotsByTarget: snapshots,
      topProfitable: sorted.filter(s => s.netProfitCents > 0).slice(0, 5),
      topLosing: sorted.filter(s => s.netProfitCents < 0).slice(0, 5),
    };
  }

  // ── G6: Provider Risk Signals ───────────────────────────────────

  getProviderRiskSignals(): readonly ProviderRiskSignal[] {
    const signals: ProviderRiskSignal[] = [];
    for (const [providerId, total] of this.providerTotalCount) {
      const failed = this.providerFailCount.get(providerId) ?? 0;
      const rate = total > 0 ? failed / total : 0;
      signals.push({
        providerId,
        totalSettlements: total,
        failedSettlements: failed,
        failureRate: rate,
        recentFailureReasons: this.providerRecentFailures.get(providerId) ?? [],
        riskLevel: rate >= 0.5 ? 'high' : rate >= 0.2 ? 'medium' : 'low',
      });
    }
    return signals;
  }

  // ── G7: Survival / Agenda Feedback ──────────────────────────────

  getSurvivalFeedback(): SurvivalFeedback {
    const summary = this.getGlobalProfitabilitySummary();
    const risks = this.getProviderRiskSignals();
    const hasFailures = this.feedbackEvents.some(e => e.kind === 'failed_settlement');

    let hint: 'profitable' | 'break_even' | 'losing';
    if (summary.globalNetProfitCents > 0) hint = 'profitable';
    else if (summary.globalNetProfitCents === 0) hint = 'break_even';
    else hint = 'losing';

    return {
      totalRealizedIncomeCents: summary.globalIncomeCents,
      totalRealizedSpendCents: summary.globalSpendCents,
      netResultCents: summary.globalNetProfitCents,
      hasFailedSettlements: hasFailures,
      providerRiskSignals: risks,
      profitabilityHint: hint,
    };
  }

  // ── Queries ─────────────────────────────────────────────────────

  allAttributionRecords(): readonly ProfitabilityAttributionRecord[] {
    return [...this.attributionRecords];
  }

  allFeedbackEvents(): readonly SettlementFeedbackEvent[] {
    return [...this.feedbackEvents];
  }
}
