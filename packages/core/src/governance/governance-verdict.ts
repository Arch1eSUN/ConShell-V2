/**
 * GovernanceVerdict — Round 17.0 / 17.1
 *
 * Rich, structured governance decision type.
 * Wraps the legacy GovernanceDecision with full explainability,
 * constraint propagation, and policy traceability.
 *
 * Round 17.1: Added executionReceiptId / lineageRecordId for post-execution linkage.
 * Old `GovernanceDecision` is deprecated — consume `GovernanceVerdict` only.
 */

import type { GovernanceRiskLevel } from './governance-contract.js';

// ── Verdict Codes ────────────────────────────────────────────────────

export type VerdictCode =
  | 'allow'                    // unconditionally approved
  | 'deny'                     // blocked — action must not proceed
  | 'proposal_invalid'         // Round 17.5: initiation rejected (not eligible to propose)
  | 'require_review'           // needs human/creator review before proceeding
  | 'allow_with_constraints'   // approved with inherited limits
  | 'rollback_required';       // previously applied action must be undone

/** Terminal verdict codes — no further evaluation */
export const TERMINAL_VERDICT_CODES: readonly VerdictCode[] = [
  'allow', 'deny', 'proposal_invalid', 'rollback_required',
];

/** Verdict codes that permit execution (with or without constraints) */
export const EXECUTABLE_VERDICT_CODES: readonly VerdictCode[] = [
  'allow', 'allow_with_constraints',
];

// ── Verdict Constraints ──────────────────────────────────────────────

export type ConstraintKind =
  | 'budget_cap'           // max spend allowed
  | 'scope_limit'          // restricted scope of operation
  | 'time_limit'           // execution must complete within duration
  | 'authority_ceiling'    // max authority level for descendant
  | 'memory_isolation'     // memory namespace restrictions
  | 'replication_block'    // descendant cannot further replicate
  | 'selfmod_block'        // descendant cannot self-modify
  | 'delegation_restriction'; // delegation-specific constraint (Round 17.2)

export interface VerdictConstraint {
  /** What kind of constraint */
  readonly kind: ConstraintKind;
  /** Human-readable description */
  readonly description: string;
  /** Constraint parameters */
  readonly value: Readonly<Record<string, unknown>>;
}

// ── GovernanceVerdict ─────────────────────────────────────────────────

export interface GovernanceVerdict {
  /** Unique verdict ID */
  readonly id: string;
  /** Which proposal this verdict belongs to */
  readonly proposalId: string;
  /** The decision code */
  readonly code: VerdictCode;
  /** Human-readable reason for the decision */
  readonly reason: string;
  /** Which policies were evaluated and triggered */
  readonly triggeredPolicies: readonly string[];
  /** Assessed risk level */
  readonly riskLevel: GovernanceRiskLevel;
  /** Constraints that must be enforced (for allow_with_constraints) */
  readonly constraints: readonly VerdictConstraint[];
  /** Whether this verdict permits child/descendant creation */
  readonly childCreationPermitted: boolean;
  /** Whether the action is eligible for rollback */
  readonly rollbackEligible: boolean;
  /** Survival context at time of decision */
  readonly survivalContext: VerdictSurvivalContext | null;
  /** When this verdict was issued */
  readonly timestamp: string;
  // ── Post-execution linkage (Round 17.1, mutable after apply) ──
  /** Execution receipt ID, set after apply() */
  executionReceiptId?: string;
  /** Lineage record ID, set after apply() if lineage was created */
  lineageRecordId?: string;
}

// ── Survival Context Snapshot ────────────────────────────────────────

export interface VerdictSurvivalContext {
  readonly survivalTier: string;
  readonly isEmergency: boolean;
  readonly mustPreserveActive: boolean;
  readonly balanceCents: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Check if a verdict permits execution */
export function isExecutableVerdict(verdict: GovernanceVerdict): boolean {
  return (EXECUTABLE_VERDICT_CODES as readonly string[]).includes(verdict.code);
}

/** Check if a verdict is terminal (no further evaluation needed) */
export function isTerminalVerdict(verdict: GovernanceVerdict): boolean {
  return (TERMINAL_VERDICT_CODES as readonly string[]).includes(verdict.code);
}

/** Extract constraint value by kind */
export function getConstraint(
  verdict: GovernanceVerdict,
  kind: ConstraintKind,
): VerdictConstraint | undefined {
  return verdict.constraints.find(c => c.kind === kind);
}
