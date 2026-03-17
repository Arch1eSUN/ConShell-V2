/**
 * Governance Workflow Contract — Round 16.3
 *
 * Canonical type definitions for the unified governance workflow.
 * All high-risk actions (selfmod, replication, identity rotation,
 * external declarations) flow through this contract.
 *
 * Governance objects are independent, trackable, auditable workflow
 * entities — NOT aliases for policy results.
 */

// ── Action Kinds ──────────────────────────────────────────────────────

/** The kinds of actions that require governance approval */
export type GovernanceActionKind =
  | 'selfmod'                 // self-modification of agent files
  | 'replication'             // spawning a child agent
  | 'fund_child'              // allocating funds to a child
  | 'identity_rotation'       // rotating identity credentials
  | 'identity_revocation'     // revoking identity
  | 'external_declaration'    // publishing or broadcasting externally
  | 'dangerous_action';       // high-risk file/system/network ops

// ── Risk Levels ───────────────────────────────────────────────────────

export type GovernanceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Map action kinds to their default risk levels */
export const ACTION_RISK_MAP: Record<GovernanceActionKind, GovernanceRiskLevel> = {
  selfmod: 'high',
  replication: 'high',
  fund_child: 'medium',
  identity_rotation: 'critical',
  identity_revocation: 'critical',
  external_declaration: 'high',
  dangerous_action: 'critical',
};

// ── Rollback Strategy ─────────────────────────────────────────────────

export type RollbackStrategyKind = 'git-revert' | 'terminate-child' | 'irreversible';

export interface RollbackPlan {
  strategy: RollbackStrategyKind;
  reversible: boolean;
  steps: string[];
}

/** Map action kinds to their rollback strategies */
export const ACTION_ROLLBACK_MAP: Record<GovernanceActionKind, RollbackStrategyKind> = {
  selfmod: 'git-revert',
  replication: 'terminate-child',
  fund_child: 'irreversible',         // funds transferred cannot be auto-recalled
  identity_rotation: 'irreversible',
  identity_revocation: 'irreversible',
  external_declaration: 'irreversible',
  dangerous_action: 'irreversible',
};

// ── Governance Decision ───────────────────────────────────────────────

export type GovernanceDecision = 'auto_approved' | 'escalated' | 'denied';

/** Why a governance decision was made — which layer blocked or escalated */
export type GovernanceDenialLayer =
  | 'constitution'
  | 'policy'
  | 'identity'
  | 'economy'
  | 'approval_missing';

// ── Governance Status ─────────────────────────────────────────────────

export type GovernanceStatus =
  | 'proposed'
  | 'evaluating'
  | 'approved'
  | 'denied'
  | 'escalated'
  | 'applying'
  | 'applied'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'rolled_back';

/** Terminal statuses — no further transitions allowed */
export const TERMINAL_STATUSES: readonly GovernanceStatus[] = [
  'denied', 'verified', 'rolled_back',
];

/** Valid status transitions */
export const STATUS_TRANSITIONS: Record<GovernanceStatus, readonly GovernanceStatus[]> = {
  proposed:    ['evaluating'],
  evaluating:  ['approved', 'denied', 'escalated'],
  approved:    ['applying'],
  denied:      [],
  escalated:   ['approved', 'denied'],
  applying:    ['applied', 'failed'],
  applied:     ['verifying', 'rolled_back'],
  verifying:   ['verified', 'failed'],
  verified:    [],
  failed:      ['rolled_back', 'applying'], // retry or rollback
  rolled_back: [],
};

export function isValidStatusTransition(
  from: GovernanceStatus,
  to: GovernanceStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Actor Identity ────────────────────────────────────────────────────

export interface GovernanceActor {
  identityId: string;
  identityStatus: 'active' | 'degraded' | 'recovering' | 'rotated' | 'revoked';
  origin: 'creator' | 'self' | 'child' | 'peer' | 'external' | 'system';
}

// ── Governance Proposal ───────────────────────────────────────────────

export interface GovernanceProposal {
  /** Unique proposal ID */
  id: string;
  /** What kind of action */
  actionKind: GovernanceActionKind;
  /** Who is requesting this action */
  initiator: GovernanceActor;
  /** What is being acted upon (e.g. file path, child name, identity ID) */
  target: string;
  /** Why this action is needed */
  justification: string;
  /** Expected cost in cents */
  expectedCostCents: number;
  /** Risk level (defaults from ACTION_RISK_MAP) */
  riskLevel: GovernanceRiskLevel;
  /** How this can be undone */
  rollbackPlan: RollbackPlan;
  /** Current status */
  status: GovernanceStatus;
  /** Decision (set after evaluation) */
  decision?: GovernanceDecision;
  /** If denied, which layer and why */
  denialLayer?: GovernanceDenialLayer;
  denialReason?: string;
  /** Payload for apply phase */
  payload?: Record<string, unknown>;
  /** Timestamps */
  createdAt: string;
  evaluatedAt?: string;
  decidedAt?: string;
  appliedAt?: string;
  verifiedAt?: string;
  rolledBackAt?: string;
}

// ── Governance Receipt ────────────────────────────────────────────────

export type GovernanceReceiptPhase = 'decision' | 'apply' | 'verify' | 'rollback';

export interface GovernanceReceipt {
  /** Unique receipt ID */
  id: string;
  /** Which proposal this receipt belongs to */
  proposalId: string;
  /** Which phase of the workflow */
  phase: GovernanceReceiptPhase;
  /** Who performed this phase */
  actorIdentityId: string;
  /** Action kind (from proposal) */
  actionKind: GovernanceActionKind;
  /** Outcome */
  result: 'success' | 'failure';
  /** Human-readable reason/details */
  reason: string;
  /** When this receipt was created */
  timestamp: string;
  /** Related entity IDs */
  relatedIds?: {
    commitmentId?: string;
    childId?: string;
    modRecordId?: string;
    /** Lineage record ID (Round 16.5) */
    lineageRecordId?: string;
  };
}

// ── Proposal Input ────────────────────────────────────────────────────

export interface ProposalInput {
  actionKind: GovernanceActionKind;
  target: string;
  justification: string;
  expectedCostCents?: number;
  /** Action-specific payload (e.g. file content for selfmod, genesis config for replication) */
  payload?: Record<string, unknown>;
}

// ── Diagnostics ─────────────────────────────────────────────────────

export interface GovernanceDiagnostics {
  totalProposals: number;
  totalReceipts: number;
  proposalsByStatus: Record<string, number>;
  proposalsByKind: Record<string, number>;
  receiptsByPhase: Record<string, number>;
  approvalRate: number;
  denialRate: number;
  escalationRate: number;
  rollbackCount: number;
  /** Always 0 in governed-by-default mode */
  legacyBypassCount: number;
}
