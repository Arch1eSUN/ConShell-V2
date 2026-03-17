/**
 * DelegationScope — Round 17.2
 *
 * Extends InheritanceScope with delegation-specific semantics:
 * task context, expiry, sub-delegation control, delegator identity.
 *
 * Shares the same authority/memory/policy/budget/runtime boundary
 * model as lineage inheritance, ensuring a unified scope language.
 */

import type { InheritanceScope } from '../lineage/inheritance-scope.js';
import { createDefaultScope, validateScopeNotExceedsParent } from '../lineage/inheritance-scope.js';

// ── DelegationScope ──────────────────────────────────────────────────

export interface DelegationScope extends InheritanceScope {
  /** Unique delegation scope ID */
  readonly delegationId: string;
  /** Who issued this delegation */
  readonly delegatorId: string;
  /** Target peer ID */
  readonly delegatedPeerId: string;
  /** Task-level description of what is delegated */
  readonly taskScope: string;
  /** Whether the delegatee may sub-delegate */
  readonly subDelegationAllowed: boolean;
  /** Expiry timestamp (ISO 8601) — delegation invalid after this */
  readonly expiresAt: string;
  /** Creation timestamp */
  readonly issuedAt: string;
  /** Linked governance verdict ID */
  readonly verdictId: string;
  /** Linked governance proposal ID */
  readonly proposalId: string;
}

// ── Factory ──────────────────────────────────────────────────────────

let scopeCounter = 0;

export interface DelegationScopeInput {
  delegatorId: string;
  delegatedPeerId: string;
  taskScope: string;
  verdictId: string;
  proposalId: string;
  subDelegationAllowed?: boolean;
  expiryMs?: number;
  budgetCapCents?: number;
  dailyLimitCents?: number;
  allowSelfmod?: boolean;
  allowDangerousAction?: boolean;
  executionPrivileges?: string[];
  memoryNamespaces?: string[];
}

/**
 * Create a DelegationScope with minimal privilege defaults.
 * Only explicitly granted capabilities are enabled.
 */
export function createDelegationScope(input: DelegationScopeInput): DelegationScope {
  const base = createDefaultScope();
  const now = new Date();
  const expiryMs = input.expiryMs ?? 3600_000; // default 1 hour

  return {
    // InheritanceScope sub-scopes
    authority: {
      ...base.authority,
      canSelfmod: input.allowSelfmod ?? false,
      canDangerousAction: input.allowDangerousAction ?? false,
      canReplicate: false, // delegation never grants replication
    },
    memory: {
      ...base.memory,
      level: (input.memoryNamespaces?.length ?? 0) > 0 ? 'restricted' : 'isolated',
      visibleNamespaces: input.memoryNamespaces ?? [],
      writeableNamespaces: [], // read-only by default
    },
    policy: base.policy,
    budget: {
      level: (input.budgetCapCents ?? 0) > 0 ? 'restricted' : 'none',
      capCents: input.budgetCapCents ?? 0,
      dailyLimitCents: input.dailyLimitCents ?? Math.min(input.budgetCapCents ?? 0, 50_00),
    },
    runtime: {
      executionPrivileges: input.executionPrivileges ?? [],
      modeRestrictions: [],
    },

    // Delegation-specific fields
    delegationId: `dscope_${Date.now()}_${++scopeCounter}`,
    delegatorId: input.delegatorId,
    delegatedPeerId: input.delegatedPeerId,
    taskScope: input.taskScope,
    subDelegationAllowed: input.subDelegationAllowed ?? false,
    expiresAt: new Date(now.getTime() + expiryMs).toISOString(),
    issuedAt: now.toISOString(),
    verdictId: input.verdictId,
    proposalId: input.proposalId,
  };
}

// ── Validation ───────────────────────────────────────────────────────

/**
 * Validate that a delegation scope does not exceed the delegator's own scope.
 * Returns list of violations (empty = valid).
 */
export function validateDelegationScope(
  delegation: DelegationScope,
  parentScope: InheritanceScope,
): string[] {
  const violations = validateScopeNotExceedsParent(delegation, parentScope);

  if (delegation.subDelegationAllowed) {
    violations.push('Sub-delegation should be explicitly reviewed — high trust required');
  }

  const now = new Date();
  const expiry = new Date(delegation.expiresAt);
  if (expiry <= now) {
    violations.push('Delegation scope has already expired');
  }

  // Max expiry check: 24 hours
  const maxExpiryMs = 24 * 3600_000;
  if (expiry.getTime() - now.getTime() > maxExpiryMs) {
    violations.push('Delegation scope expiry exceeds maximum 24-hour window');
  }

  return violations;
}

/**
 * Check if a delegation scope has expired.
 */
export function isDelegationExpired(scope: DelegationScope): boolean {
  return new Date(scope.expiresAt) <= new Date();
}

// ── Scope Action Check ───────────────────────────────────────────────

export type DelegationActionCheck = {
  readonly allowed: boolean;
  readonly reason: string;
  readonly violationKind?: ScopeViolationKind;
};

export type ScopeViolationKind =
  | 'budget_exceeded'
  | 'forbidden_action'
  | 'forbidden_selfmod'
  | 'forbidden_sub_delegation'
  | 'scope_expired';

/**
 * Check if a specific action is permitted under a delegation scope.
 */
export function checkDelegationAction(
  scope: DelegationScope,
  action: {
    kind: 'selfmod' | 'dangerous_action' | 'sub_delegation' | 'task';
    costCents?: number;
  },
): DelegationActionCheck {
  // Expiry check
  if (isDelegationExpired(scope)) {
    return {
      allowed: false,
      reason: `Delegation scope expired at ${scope.expiresAt}`,
      violationKind: 'scope_expired',
    };
  }

  // Action-specific checks
  switch (action.kind) {
    case 'selfmod':
      if (!scope.authority.canSelfmod) {
        return {
          allowed: false,
          reason: 'Self-modification not permitted under delegation scope',
          violationKind: 'forbidden_selfmod',
        };
      }
      break;

    case 'dangerous_action':
      if (!scope.authority.canDangerousAction) {
        return {
          allowed: false,
          reason: 'Dangerous action not permitted under delegation scope',
          violationKind: 'forbidden_action',
        };
      }
      break;

    case 'sub_delegation':
      if (!scope.subDelegationAllowed) {
        return {
          allowed: false,
          reason: 'Sub-delegation not permitted under delegation scope',
          violationKind: 'forbidden_sub_delegation',
        };
      }
      break;
  }

  // Budget check
  if (action.costCents !== undefined && action.costCents > 0) {
    if (action.costCents > scope.budget.capCents) {
      return {
        allowed: false,
        reason: `Cost ${action.costCents} exceeds delegation budget cap ${scope.budget.capCents}`,
        violationKind: 'budget_exceeded',
      };
    }
  }

  return { allowed: true, reason: 'Action permitted under delegation scope' };
}
