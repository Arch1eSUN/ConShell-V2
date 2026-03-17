/**
 * InheritanceScope — Round 17.0
 *
 * First-class auditable scope structure for lineage inheritance.
 * Defines what a child/descendant can do, see, spend, and modify.
 *
 * Default stance: minimal inheritance, minimal privilege, explicit upgrade.
 */

import type { GovernanceActionKind } from '../governance/governance-contract.js';

// ── Scope Policy Levels ──────────────────────────────────────────────

export type ScopePolicy = 'full' | 'restricted' | 'isolated' | 'none';

// ── Authority Scope ──────────────────────────────────────────────────

export interface AuthorityScope {
  /** How much authority is inherited */
  readonly level: ScopePolicy;
  /** Which governance action kinds the child can initiate */
  readonly maxActions: readonly GovernanceActionKind[];
  /** Whether the child can create its own children */
  readonly canReplicate: boolean;
  /** Whether the child can self-modify */
  readonly canSelfmod: boolean;
  /** Whether the child can perform dangerous actions */
  readonly canDangerousAction: boolean;
}

// ── Memory Scope ─────────────────────────────────────────────────────

export interface MemoryScope {
  /** How much memory access is inherited */
  readonly level: ScopePolicy;
  /** Which memory namespaces the child can read */
  readonly visibleNamespaces: readonly string[];
  /** Which memory namespaces the child can write */
  readonly writeableNamespaces: readonly string[];
}

// ── Policy Scope ─────────────────────────────────────────────────────

export interface PolicyScope {
  /** How much of parent's policy set is inherited */
  readonly level: ScopePolicy;
  /** Which policy rules are inherited by name/id */
  readonly inheritedRules: readonly string[];
  /** Whether the child can override inherited policies */
  readonly overrideable: boolean;
}

// ── Budget Scope ─────────────────────────────────────────────────────

export interface BudgetScope {
  /** Budget inheritance level */
  readonly level: ScopePolicy;
  /** Maximum total budget in cents */
  readonly capCents: number;
  /** Maximum daily spend in cents */
  readonly dailyLimitCents: number;
}

// ── Runtime Scope ────────────────────────────────────────────────────

export interface RuntimeScope {
  /** Execution privileges granted */
  readonly executionPrivileges: readonly string[];
  /** Runtime mode restrictions */
  readonly modeRestrictions: readonly string[];
}

// ── Full InheritanceScope ────────────────────────────────────────────

export interface InheritanceScope {
  readonly authority: AuthorityScope;
  readonly memory: MemoryScope;
  readonly policy: PolicyScope;
  readonly budget: BudgetScope;
  readonly runtime: RuntimeScope;
}

// ── Default Scope Factory ────────────────────────────────────────────

/**
 * Creates a minimal-privilege default scope.
 * Children start with nothing and must be explicitly granted capabilities.
 */
export function createDefaultScope(): InheritanceScope {
  return {
    authority: {
      level: 'restricted',
      maxActions: [],
      canReplicate: false,
      canSelfmod: false,
      canDangerousAction: false,
    },
    memory: {
      level: 'isolated',
      visibleNamespaces: [],
      writeableNamespaces: [],
    },
    policy: {
      level: 'restricted',
      inheritedRules: [],
      overrideable: false,
    },
    budget: {
      level: 'restricted',
      capCents: 0,
      dailyLimitCents: 0,
    },
    runtime: {
      executionPrivileges: [],
      modeRestrictions: [],
    },
  };
}

/**
 * Creates a scope from verdict constraints.
 * Starts from default and applies constraints as grants.
 */
export function createScopeFromConstraints(
  baseFundingCents: number,
  constraints: readonly { kind: string; value: Readonly<Record<string, unknown>> }[],
): InheritanceScope {
  const scope = createDefaultScope();

  // Budget from funding
  const budget: BudgetScope = {
    ...scope.budget,
    level: baseFundingCents > 0 ? 'restricted' : 'none',
    capCents: baseFundingCents,
    dailyLimitCents: Math.min(baseFundingCents, 50_00), // default daily = min(total, $50)
  };

  // Apply constraint overrides
  let canReplicate = false;
  let canSelfmod = false;
  let canDangerous = false;

  for (const c of constraints) {
    if (c.kind === 'replication_block') canReplicate = false;
    if (c.kind === 'selfmod_block') canSelfmod = false;
    if (c.kind === 'budget_cap' && typeof c.value['capCents'] === 'number') {
      (budget as any).capCents = Math.min(budget.capCents, c.value['capCents'] as number);
    }
  }

  return {
    authority: {
      ...scope.authority,
      canReplicate,
      canSelfmod,
      canDangerousAction: canDangerous,
    },
    memory: scope.memory,
    policy: scope.policy,
    budget,
    runtime: scope.runtime,
  };
}

// ── Scope Validation ─────────────────────────────────────────────────

/**
 * Check if a child scope exceeds a parent scope.
 * Returns list of violations (empty = valid).
 */
export function validateScopeNotExceedsParent(
  child: InheritanceScope,
  parent: InheritanceScope,
): string[] {
  const violations: string[] = [];

  if (child.authority.canReplicate && !parent.authority.canReplicate) {
    violations.push('Child cannot replicate when parent cannot');
  }
  if (child.authority.canSelfmod && !parent.authority.canSelfmod) {
    violations.push('Child cannot self-modify when parent cannot');
  }
  if (child.authority.canDangerousAction && !parent.authority.canDangerousAction) {
    violations.push('Child cannot perform dangerous actions when parent cannot');
  }
  if (child.budget.capCents > parent.budget.capCents) {
    violations.push(`Child budget cap (${child.budget.capCents}) exceeds parent (${parent.budget.capCents})`);
  }

  return violations;
}
