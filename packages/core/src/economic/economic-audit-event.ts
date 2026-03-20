/**
 * Round 17.7 — G6: Economic Audit Event Foundation
 *
 * Structured audit log for all economic action evaluations.
 * Every action that enters the firewall produces an audit event
 * recording the complete decision chain.
 *
 * Design invariants:
 * - Every firewall evaluation produces exactly one audit event
 * - Audit events are append-only and immutable
 * - Sufficient for post-hoc forensic analysis
 */

import type { EconomicActionKind, ActionSource } from './economic-action-classification.js';
import type { FirewallDecision } from './economic-instruction-firewall.js';

// ── Types ────────────────────────────────────────────────────────────

export interface EconomicAuditEvent {
  readonly eventId: string;
  readonly runtimeIdentityId: string;
  readonly economicIdentityId: string | null;
  readonly actionClassification: EconomicActionKind;
  readonly candidateId: string;
  readonly candidateSource: ActionSource;
  readonly amountCents: number;
  readonly firewallResult: FirewallDecision;
  readonly mandateUsed: string | null;
  readonly mandateDenied: boolean;
  readonly mandateDenialReason: string | null;
  readonly capabilityCheckPassed: boolean;
  readonly sourceTrustPassed: boolean;
  readonly rejectionReasons: readonly string[];
  readonly finalDecision: FirewallDecision;
  readonly createdAt: string;
}

export type EconomicAuditEventInput = Omit<EconomicAuditEvent, 'eventId' | 'createdAt'>;

export interface AuditStats {
  readonly total: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pendingHuman: number;
}

// ── Audit Log ────────────────────────────────────────────────────────

export class EconomicAuditLog {
  private events: EconomicAuditEvent[] = [];
  private idCounter = 0;

  /** Record an audit event. Returns the created event with assigned ID. */
  record(input: EconomicAuditEventInput): EconomicAuditEvent {
    const event: EconomicAuditEvent = {
      eventId: `econ_audit_${++this.idCounter}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  /** Get recent audit events. */
  getRecent(limit = 20): ReadonlyArray<EconomicAuditEvent> {
    return this.events.slice(-limit);
  }

  /** Get audit events by economic identity. */
  getByIdentity(economicIdentityId: string): ReadonlyArray<EconomicAuditEvent> {
    return this.events.filter(e => e.economicIdentityId === economicIdentityId);
  }

  /** Get audit events by runtime identity. */
  getByRuntimeId(runtimeIdentityId: string): ReadonlyArray<EconomicAuditEvent> {
    return this.events.filter(e => e.runtimeIdentityId === runtimeIdentityId);
  }

  /** Get aggregate statistics. */
  stats(): AuditStats {
    let approved = 0;
    let rejected = 0;
    let pendingHuman = 0;

    for (const event of this.events) {
      switch (event.finalDecision) {
        case 'approved': approved++; break;
        case 'rejected': rejected++; break;
        case 'pending_human_confirmation': pendingHuman++; break;
      }
    }

    return {
      total: this.events.length,
      approved,
      rejected,
      pendingHuman,
    };
  }

  /** Get all events (for testing / debugging). */
  all(): ReadonlyArray<EconomicAuditEvent> {
    return [...this.events];
  }
}
