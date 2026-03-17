/**
 * Lineage Contract — Round 16.5 → 17.0
 *
 * Canonical type definitions for the replication/lineage domain.
 * LineageService is the canonical owner; MultiAgentManager is the runtime executor.
 *
 * Lifecycle: planned → creating → active → degraded → recalled/terminated/orphaned/failed
 * Round 17.0: + quarantined, compromised statuses + InheritanceScope
 */
import type { InheritanceScope } from './inheritance-scope.js';

// ── Child Runtime Status ─────────────────────────────────────────────

export type ChildRuntimeStatus =
  | 'planned'        // governance approved, not yet created
  | 'creating'       // actualization in progress
  | 'active'         // running normally
  | 'degraded'       // running but unhealthy
  | 'quarantined'    // Round 17.0: suspended pending review
  | 'compromised'    // Round 17.0: branch flagged as tainted
  | 'recalled'       // parent requested return
  | 'terminated'     // explicitly ended
  | 'orphaned'       // parent can no longer manage
  | 'failed';        // creation or runtime failure

/** Valid status transitions */
export const CHILD_STATUS_TRANSITIONS: Record<ChildRuntimeStatus, readonly ChildRuntimeStatus[]> = {
  planned:      ['creating', 'failed'],
  creating:     ['active', 'failed'],
  active:       ['degraded', 'quarantined', 'compromised', 'recalled', 'terminated', 'orphaned'],
  degraded:     ['active', 'quarantined', 'compromised', 'recalled', 'terminated', 'orphaned', 'failed'],
  quarantined:  ['active', 'compromised', 'terminated'],  // can restore or escalate
  compromised:  ['terminated'],  // can only be terminated
  recalled:     [],  // terminal
  terminated:   [],  // terminal
  orphaned:     ['terminated'],  // can still be force-terminated
  failed:       [],  // terminal
};

export const TERMINAL_CHILD_STATUSES: readonly ChildRuntimeStatus[] = [
  'recalled', 'terminated', 'failed',
];

export function isValidChildTransition(from: ChildRuntimeStatus, to: ChildRuntimeStatus): boolean {
  return CHILD_STATUS_TRANSITIONS[from].includes(to);
}

// ── Child Runtime Spec ───────────────────────────────────────────────

/** Specification for creating a child runtime */
export interface ChildRuntimeSpec {
  /** Human-readable name */
  name: string;
  /** Task description */
  task: string;
  /** Genesis prompt for the child */
  genesisPrompt: string;
  /** Initial funding in cents */
  fundingCents: number;
  /** Parent agent ID */
  parentId: string;
  /** Governance proposal ID that authorized this */
  proposalId: string;
  /** Inheritance overrides (field → policy) */
  inheritanceOverrides?: Record<string, 'inherit' | 'derive' | 'exclude'>;
  /** Additional config for the child */
  config?: Record<string, unknown>;
}

// ── Identity Summary ─────────────────────────────────────────────────

/** Summary of a child's identity (derived from parent via InheritanceBoundary) */
export interface ChildIdentitySummary {
  /** Child's unique identity fingerprint */
  fingerprint: string;
  /** Parent identity fingerprint */
  parentFingerprint: string;
  /** Lineage root (genesis agent) */
  lineageRoot: string;
  /** Generation depth (parent.generation + 1) */
  generation: number;
  /** Fields that were inherited from parent */
  inheritedFields: string[];
  /** Fields that were derived (adapted) */
  derivedFields: string[];
  /** Fields that were excluded (fresh) */
  excludedFields: string[];
}

// ── Funding Lease ────────────────────────────────────────────────────

export type FundingLeaseStatus = 'active' | 'exhausted' | 'revoked' | 'expired';

export interface FundingLease {
  /** Unique lease ID */
  id: string;
  /** Child this lease is attached to */
  childId: string;
  /** Maximum budget in cents */
  budgetCapCents: number;
  /** Amount spent so far */
  spentCents: number;
  /** Current status */
  status: FundingLeaseStatus;
  /** When the lease was granted */
  grantedAt: string;
  /** Optional expiry time */
  expiresAt?: string;
  /** Who revoked it (if revoked) */
  revokedBy?: string;
  /** Revocation reason */
  revokedReason?: string;
}

// ── Lineage Record ───────────────────────────────────────────────────

/** The core lineage record — tracks a single parent→child relationship */
export interface LineageRecord {
  /** Unique lineage record ID */
  id: string;
  /** Parent agent ID */
  parentId: string;
  /** Child agent ID (assigned during creation) */
  childId: string;
  /** Original spec used to create this child */
  spec: ChildRuntimeSpec;
  /** Current child runtime status */
  status: ChildRuntimeStatus;
  /** Funding lease for this child */
  fundingLease: FundingLease;
  /** Child's identity summary */
  identitySummary: ChildIdentitySummary;
  /** Round 17.0: Structured inheritance scope */
  inheritanceScope: InheritanceScope;
  /** Governance proposal ID */
  proposalId: string;
  /** Governance verdict ID (Round 17.0) */
  verdictId?: string;
  /** Timestamps */
  createdAt: string;
  activatedAt?: string;
  quarantinedAt?: string;
  compromisedAt?: string;
  recalledAt?: string;
  terminatedAt?: string;
  orphanedAt?: string;
  failedAt?: string;
  /** Reason for current terminal status */
  statusReason?: string;
}

// ── Receipts ─────────────────────────────────────────────────────────

export interface ReplicationReceipt {
  /** Governance proposal ID */
  proposalId: string;
  /** Lineage record ID */
  lineageRecordId: string;
  /** Child agent ID */
  childId: string;
  /** Result */
  result: 'success' | 'failure';
  /** Reason (on failure) */
  reason?: string;
  /** Timestamp */
  timestamp: string;
}

export interface TerminationReceipt {
  /** Child agent ID */
  childId: string;
  /** Lineage record ID */
  lineageRecordId: string;
  /** Reason for termination */
  reason: string;
  /** Who initiated */
  actor: string;
  /** Remaining funding at termination */
  fundingRemainingCents: number;
  /** Timestamp */
  timestamp: string;
}

// ── Recall Policy ────────────────────────────────────────────────────

export interface RecallPolicy {
  /** Reason for recall */
  reason: string;
  /** Who is initiating the recall */
  actor: string;
  /** Whether governance approval is required */
  governanceRequired: boolean;
  /** Whether to clean up funding */
  cleanupFunding: boolean;
  /** Whether to cascade to grandchildren */
  cascadeToChildren: boolean;
}

// ── Stats ────────────────────────────────────────────────────────────

export interface LineageStats {
  /** Total children ever created */
  totalChildren: number;
  /** Breakdown by status */
  byStatus: Record<ChildRuntimeStatus, number>;
  /** Total funding allocated (cents) */
  totalFundingAllocated: number;
  /** Total funding spent (cents) */
  totalFundingSpent: number;
  /** Maximum generation depth */
  maxGenerationDepth: number;
  /** Active children count */
  activeChildren: number;
}

// ── Filter ───────────────────────────────────────────────────────────

export interface LineageFilter {
  status?: ChildRuntimeStatus;
  parentId?: string;
}
