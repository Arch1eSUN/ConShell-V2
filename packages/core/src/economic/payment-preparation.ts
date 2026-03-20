/**
 * Round 17.9 — G5 + G7: Payment Preparation Layer + Audit Trail
 *
 * Preparation layer manages payment intents (pre-settlement lifecycle)
 * and negotiation audit trail for operator visibility.
 *
 * Intent lifecycle: created → bound → confirmed → settled
 *                                  → expired
 *                                  → cancelled
 *
 * Audit events track every negotiation step:
 * requirement_received → evaluated → provider_compared → route_selected
 * → human_required / rejected / mandate_mismatch / policy_rejection
 *
 * Design invariants:
 * - Intents bind to mandate + identity, never free-floating
 * - All negotiation events are queryable
 * - Summaries are diagnosis-first (conclusions + evidence)
 */

import type { PaymentNegotiationResult, PaymentOffer, NegotiationDecision } from './payment-negotiation.js';

// ── Payment Preparation Intent ───────────────────────────────────────

export type PreparationStatus = 'created' | 'bound' | 'confirmed' | 'expired' | 'cancelled';

export interface PaymentPreparationIntent {
  readonly intentId: string;
  readonly negotiationId: string;
  readonly requirementId: string;
  readonly selectedOffer: PaymentOffer | null;
  readonly economicIdentityId: string;
  readonly mandateId: string | null;
  status: PreparationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  boundAt: string | null;
  confirmedAt: string | null;
}

// ── Negotiation Audit Event ──────────────────────────────────────────

export type NegotiationAuditEventType =
  | 'requirement_received'
  | 'requirement_evaluated'
  | 'provider_compared'
  | 'route_selected'
  | 'human_confirmation_required'
  | 'rejected'
  | 'mandate_mismatch'
  | 'policy_rejection'
  | 'intent_created'
  | 'intent_bound'
  | 'intent_confirmed'
  | 'intent_expired'
  | 'intent_cancelled';

export interface PaymentNegotiationAuditEvent {
  readonly eventId: string;
  readonly negotiationId: string;
  readonly eventType: NegotiationAuditEventType;
  readonly timestamp: string;
  readonly details: Readonly<Record<string, unknown>>;
}

// ── Summaries ────────────────────────────────────────────────────────

export interface NegotiationSummary {
  readonly totalNegotiations: number;
  readonly allowed: number;
  readonly rejected: number;
  readonly pendingConfirmation: number;
  readonly switchedProvider: number;
  readonly recentNegotiations: ReadonlyArray<{
    readonly negotiationId: string;
    readonly decision: NegotiationDecision;
    readonly requirementId: string;
    readonly timestamp: string;
  }>;
}

export interface ProviderSelectionSummary {
  readonly totalComparisons: number;
  readonly providerUsageDistribution: Readonly<Record<string, number>>;
  readonly averageSavingsCents: number;
}

export interface PendingConfirmationSummary {
  readonly pendingCount: number;
  readonly pendingIntents: ReadonlyArray<{
    readonly intentId: string;
    readonly negotiationId: string;
    readonly requirementId: string;
    readonly amountCents: number;
    readonly createdAt: string;
  }>;
}

// ── Payment Preparation Manager ──────────────────────────────────────

let intentCounter = 0;

const INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class PaymentPreparationManager {
  private readonly intents = new Map<string, PaymentPreparationIntent>();

  createIntent(
    negotiationResult: PaymentNegotiationResult,
    economicIdentityId: string,
    mandateId?: string,
  ): PaymentPreparationIntent {
    const now = new Date();
    const intent: PaymentPreparationIntent = {
      intentId: `intent_${++intentCounter}`,
      negotiationId: negotiationResult.negotiationId,
      requirementId: negotiationResult.requirementId,
      selectedOffer: negotiationResult.selectedOffer,
      economicIdentityId,
      mandateId: mandateId ?? null,
      status: mandateId ? 'bound' : 'created',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INTENT_TTL_MS).toISOString(),
      boundAt: mandateId ? now.toISOString() : null,
      confirmedAt: null,
    };
    this.intents.set(intent.intentId, intent);
    return intent;
  }

  bindToMandate(intentId: string, mandateId: string): boolean {
    const intent = this.intents.get(intentId);
    if (!intent || intent.status !== 'created') return false;

    intent.status = 'bound';
    (intent as any).mandateId = mandateId;
    intent.boundAt = new Date().toISOString();
    return true;
  }

  confirm(intentId: string): boolean {
    const intent = this.intents.get(intentId);
    if (!intent) return false;
    if (intent.status !== 'created' && intent.status !== 'bound') return false;
    if (new Date(intent.expiresAt) <= new Date()) {
      intent.status = 'expired';
      return false;
    }

    intent.status = 'confirmed';
    intent.confirmedAt = new Date().toISOString();
    return true;
  }

  expire(intentId: string): boolean {
    const intent = this.intents.get(intentId);
    if (!intent) return false;
    if (intent.status === 'confirmed' || intent.status === 'cancelled') return false;

    intent.status = 'expired';
    return true;
  }

  cancel(intentId: string): boolean {
    const intent = this.intents.get(intentId);
    if (!intent) return false;
    if (intent.status === 'confirmed' || intent.status === 'expired') return false;

    intent.status = 'cancelled';
    return true;
  }

  get(intentId: string): PaymentPreparationIntent | undefined {
    return this.intents.get(intentId);
  }

  getPending(): readonly PaymentPreparationIntent[] {
    return [...this.intents.values()].filter(i =>
      i.status === 'created' || i.status === 'bound'
    );
  }

  getConfirmed(): readonly PaymentPreparationIntent[] {
    return [...this.intents.values()].filter(i => i.status === 'confirmed');
  }

  all(): readonly PaymentPreparationIntent[] {
    return [...this.intents.values()];
  }
}

// ── Payment Negotiation Audit Log ────────────────────────────────────

let auditEventCounter = 0;

export class PaymentNegotiationAuditLog {
  private readonly events: PaymentNegotiationAuditEvent[] = [];
  private providerUsage = new Map<string, number>();
  private totalSavings = 0;
  private comparisonCount = 0;

  record(
    negotiationId: string,
    eventType: NegotiationAuditEventType,
    details: Record<string, unknown> = {},
  ): PaymentNegotiationAuditEvent {
    const event: PaymentNegotiationAuditEvent = {
      eventId: `pna_${++auditEventCounter}`,
      negotiationId,
      eventType,
      timestamp: new Date().toISOString(),
      details,
    };
    this.events.push(event);
    return event;
  }

  recordProviderSelection(providerId: string, savingsCents: number = 0): void {
    this.providerUsage.set(providerId, (this.providerUsage.get(providerId) ?? 0) + 1);
    this.totalSavings += savingsCents;
    this.comparisonCount++;
  }

  getRecent(limit: number = 20): readonly PaymentNegotiationAuditEvent[] {
    return this.events.slice(-limit);
  }

  getByNegotiation(negotiationId: string): readonly PaymentNegotiationAuditEvent[] {
    return this.events.filter(e => e.negotiationId === negotiationId);
  }

  summary(): NegotiationSummary {
    const decisionCounts: Record<string, number> = {};
    const recentNegotiations: NegotiationSummary['recentNegotiations'] extends ReadonlyArray<infer T> ? T[] : never = [];
    const seen = new Set<string>();

    for (const e of this.events) {
      if (!seen.has(e.negotiationId) && (
        e.eventType === 'requirement_evaluated' ||
        e.eventType === 'rejected' ||
        e.eventType === 'route_selected' ||
        e.eventType === 'human_confirmation_required'
      )) {
        seen.add(e.negotiationId);
        const decision = e.details['decision'] as string ?? e.eventType;
        decisionCounts[decision] = (decisionCounts[decision] ?? 0) + 1;
        recentNegotiations.push({
          negotiationId: e.negotiationId,
          decision: (e.details['decision'] as NegotiationDecision) ?? 'reject',
          requirementId: (e.details['requirementId'] as string) ?? 'unknown',
          timestamp: e.timestamp,
        });
      }
    }

    return {
      totalNegotiations: seen.size,
      allowed: (decisionCounts['allow_and_prepare'] ?? 0) + (decisionCounts['allow_and_route'] ?? 0),
      rejected: decisionCounts['reject'] ?? decisionCounts['rejected'] ?? 0,
      pendingConfirmation: decisionCounts['require_human_confirmation'] ?? decisionCounts['human_confirmation_required'] ?? 0,
      switchedProvider: decisionCounts['switch_provider'] ?? 0,
      recentNegotiations: recentNegotiations.slice(-10),
    };
  }

  providerSummary(): ProviderSelectionSummary {
    const dist: Record<string, number> = {};
    for (const [pid, count] of this.providerUsage) {
      dist[pid] = count;
    }

    return {
      totalComparisons: this.comparisonCount,
      providerUsageDistribution: dist,
      averageSavingsCents: this.comparisonCount > 0
        ? Math.round(this.totalSavings / this.comparisonCount)
        : 0,
    };
  }

  pendingSummary(preparationManager: PaymentPreparationManager): PendingConfirmationSummary {
    const pending = preparationManager.getPending();
    return {
      pendingCount: pending.length,
      pendingIntents: pending.map(i => ({
        intentId: i.intentId,
        negotiationId: i.negotiationId,
        requirementId: i.requirementId,
        amountCents: i.selectedOffer?.amountCents ?? 0,
        createdAt: i.createdAt,
      })),
    };
  }

  allEvents(): readonly PaymentNegotiationAuditEvent[] {
    return [...this.events];
  }
}
