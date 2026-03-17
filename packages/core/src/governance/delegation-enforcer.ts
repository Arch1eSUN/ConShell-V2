/**
 * DelegationEnforcer — Round 17.2
 *
 * Runtime enforcement gate for delegated peer actions.
 * Holds active delegation scopes and checks every restricted action
 * against the peer's scope. Violations produce structured records
 * that trigger governance/collective accountability actions.
 */

import type { DelegationScope, ScopeViolationKind } from './delegation-scope.js';
import { checkDelegationAction, isDelegationExpired } from './delegation-scope.js';
import type { Logger } from '../types/common.js';

// ── Scope Violation Record ───────────────────────────────────────────

export interface ScopeViolation {
  /** Unique violation ID */
  readonly id: string;
  /** Peer that violated the scope */
  readonly peerId: string;
  /** Delegation scope ID */
  readonly delegationId: string;
  /** ProposalId that created this delegation */
  readonly proposalId: string;
  /** VerdictId that approved this delegation */
  readonly verdictId: string;
  /** What kind of violation */
  readonly violationKind: ScopeViolationKind;
  /** What the peer tried to do */
  readonly attemptedAction: string;
  /** What the scope limit was */
  readonly scopeLimit: string;
  /** Timestamp */
  readonly timestamp: string;
}

// ── Delegation Event ─────────────────────────────────────────────────

export type DelegationEventKind =
  | 'delegation_approved'
  | 'delegation_started'
  | 'delegation_completed'
  | 'delegation_failed'
  | 'scope_violation_detected'
  | 'peer_quarantined_from_delegation'
  | 'peer_revoked_from_delegation';

export interface DelegationEvent {
  readonly kind: DelegationEventKind;
  readonly peerId: string;
  readonly delegationId: string;
  readonly proposalId: string;
  readonly verdictId: string;
  readonly detail: string;
  readonly timestamp: string;
}

// ── Enforcement Check Result ─────────────────────────────────────────

export interface EnforcementResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly violation?: ScopeViolation;
}

// ── DelegationEnforcer ───────────────────────────────────────────────

export class DelegationEnforcer {
  /** Active delegation scopes by peerId */
  private activeScopes = new Map<string, DelegationScope>();
  /** Violation log */
  private violations: ScopeViolation[] = [];
  /** Event log */
  private events: DelegationEvent[] = [];
  /** Violation count by peerId (for threshold-based quarantine) */
  private violationCounts = new Map<string, number>();
  /** Max violations before auto-quarantine */
  private quarantineThreshold: number;
  private logger: Logger;
  private idCounter = 0;

  constructor(opts: { logger: Logger; quarantineThreshold?: number }) {
    this.logger = opts.logger;
    this.quarantineThreshold = opts.quarantineThreshold ?? 3;
  }

  // ── Scope Management ─────────────────────────────────────────────

  /**
   * Register an active delegation scope for a peer.
   * Only one delegation per peer is active at a time.
   */
  registerScope(scope: DelegationScope): void {
    this.activeScopes.set(scope.delegatedPeerId, scope);
    this.recordEvent('delegation_started', scope.delegatedPeerId, scope, 'Delegation scope activated');
    this.logger.info('Delegation scope registered', {
      peerId: scope.delegatedPeerId,
      delegationId: scope.delegationId,
    });
  }

  /**
   * Revoke a delegation scope.
   */
  revokeScope(peerId: string, reason: string): void {
    const scope = this.activeScopes.get(peerId);
    if (scope) {
      this.activeScopes.delete(peerId);
      this.recordEvent('delegation_completed', peerId, scope, `Revoked: ${reason}`);
    }
  }

  /**
   * Complete a delegation normally.
   */
  completeScope(peerId: string, success: boolean): void {
    const scope = this.activeScopes.get(peerId);
    if (scope) {
      this.activeScopes.delete(peerId);
      this.recordEvent(
        success ? 'delegation_completed' : 'delegation_failed',
        peerId,
        scope,
        success ? 'Delegation completed successfully' : 'Delegation failed',
      );
    }
  }

  /**
   * Get the active scope for a peer.
   */
  getActiveScope(peerId: string): DelegationScope | undefined {
    return this.activeScopes.get(peerId);
  }

  /**
   * Check if a peer has an active delegation.
   */
  hasDelegation(peerId: string): boolean {
    return this.activeScopes.has(peerId);
  }

  // ── Enforcement ──────────────────────────────────────────────────

  /**
   * Check if a peer action is permitted under its active delegation scope.
   * Returns structured result with optional violation record.
   */
  checkAction(
    peerId: string,
    actionKind: 'selfmod' | 'dangerous_action' | 'sub_delegation' | 'task',
    costCents?: number,
  ): EnforcementResult {
    const scope = this.activeScopes.get(peerId);
    if (!scope) {
      return { allowed: true, reason: 'No active delegation scope — unrestricted' };
    }

    const check = checkDelegationAction(scope, { kind: actionKind, costCents });
    if (check.allowed) {
      return { allowed: true, reason: check.reason };
    }

    // Record violation
    const violation = this.createViolation(peerId, scope, check.violationKind!, actionKind, costCents);
    this.logger.warn('Scope violation detected', {
      peerId,
      delegationId: scope.delegationId,
      violationKind: check.violationKind,
    });

    return {
      allowed: false,
      reason: check.reason,
      violation,
    };
  }

  // ── Violation Management ─────────────────────────────────────────

  private createViolation(
    peerId: string,
    scope: DelegationScope,
    kind: ScopeViolationKind,
    attemptedAction: string,
    costCents?: number,
  ): ScopeViolation {
    const violation: ScopeViolation = {
      id: `sviol_${Date.now()}_${++this.idCounter}`,
      peerId,
      delegationId: scope.delegationId,
      proposalId: scope.proposalId,
      verdictId: scope.verdictId,
      violationKind: kind,
      attemptedAction: `${attemptedAction}${costCents ? ` (cost: ${costCents}c)` : ''}`,
      scopeLimit: this.describeScopeLimit(scope, kind),
      timestamp: new Date().toISOString(),
    };

    this.violations.push(violation);
    this.recordEvent('scope_violation_detected', peerId, scope,
      `Violation: ${kind} — attempted ${attemptedAction}`);

    // Track violation count for threshold
    const count = (this.violationCounts.get(peerId) ?? 0) + 1;
    this.violationCounts.set(peerId, count);

    return violation;
  }

  private describeScopeLimit(scope: DelegationScope, kind: ScopeViolationKind): string {
    switch (kind) {
      case 'budget_exceeded': return `Budget cap: ${scope.budget.capCents} cents`;
      case 'forbidden_selfmod': return 'Selfmod: not permitted';
      case 'forbidden_action': return 'Dangerous action: not permitted';
      case 'forbidden_sub_delegation': return 'Sub-delegation: not permitted';
      case 'scope_expired': return `Expired at: ${scope.expiresAt}`;
      default: return 'Unknown limit';
    }
  }

  /**
   * Check if peer has exceeded the quarantine threshold.
   */
  shouldQuarantine(peerId: string): boolean {
    return (this.violationCounts.get(peerId) ?? 0) >= this.quarantineThreshold;
  }

  /**
   * Record a quarantine event from delegation violations.
   */
  recordQuarantine(peerId: string): void {
    const scope = this.activeScopes.get(peerId);
    if (scope) {
      this.recordEvent('peer_quarantined_from_delegation', peerId, scope,
        `Quarantined after ${this.violationCounts.get(peerId)} violations`);
      this.activeScopes.delete(peerId);
    }
  }

  // ── Event Management ─────────────────────────────────────────────

  private recordEvent(
    kind: DelegationEventKind,
    peerId: string,
    scope: DelegationScope,
    detail: string,
  ): void {
    this.events.push({
      kind,
      peerId,
      delegationId: scope.delegationId,
      proposalId: scope.proposalId,
      verdictId: scope.verdictId,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Query ────────────────────────────────────────────────────────

  getViolations(peerId?: string): ScopeViolation[] {
    if (peerId) return this.violations.filter(v => v.peerId === peerId);
    return [...this.violations];
  }

  getEvents(peerId?: string): DelegationEvent[] {
    if (peerId) return this.events.filter(e => e.peerId === peerId);
    return [...this.events];
  }

  getActiveDelegations(): DelegationScope[] {
    return [...this.activeScopes.values()];
  }

  getViolationCount(peerId: string): number {
    return this.violationCounts.get(peerId) ?? 0;
  }

  /**
   * Delegation governance summary for control surface.
   */
  getSummary(): {
    activeDelegations: number;
    totalViolations: number;
    totalEvents: number;
    violationsByKind: Record<string, number>;
    delegationsByPeer: Record<string, string>;
  } {
    const violationsByKind: Record<string, number> = {};
    for (const v of this.violations) {
      violationsByKind[v.violationKind] = (violationsByKind[v.violationKind] ?? 0) + 1;
    }

    const delegationsByPeer: Record<string, string> = {};
    for (const [peerId, scope] of this.activeScopes) {
      delegationsByPeer[peerId] = scope.delegationId;
    }

    return {
      activeDelegations: this.activeScopes.size,
      totalViolations: this.violations.length,
      totalEvents: this.events.length,
      violationsByKind,
      delegationsByPeer,
    };
  }
}
