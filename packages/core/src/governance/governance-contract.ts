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
  | 'dangerous_action'        // high-risk file/system/network ops
  | 'delegate_task'           // delegate a task to a peer (Round 17.2)
  | 'delegate_selfmod'        // delegate self-modification to a peer (Round 17.2)
  | 'delegate_dangerous_action' // delegate dangerous action to a peer (Round 17.2)
  | 'quarantine_branch'       // quarantine a lineage branch (Round 18.7)
  | 'revoke_branch'           // revoke/terminate a lineage branch (Round 18.7)
  | 'pause_selfmod'           // pause all self-modification capability (Round 19.3)
  | 'resume_selfmod'          // resume self-modification capability (Round 19.3)
  | 'restore_branch';         // restore a quarantined lineage branch (Round 19.3)

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
  delegate_task: 'high',
  delegate_selfmod: 'high',
  delegate_dangerous_action: 'critical',
  quarantine_branch: 'critical',
  revoke_branch: 'critical',
  pause_selfmod: 'high',
  resume_selfmod: 'medium',
  restore_branch: 'high',
};

// ── Rollback Strategy ─────────────────────────────────────────────────

export type RollbackStrategyKind = 'git-revert' | 'terminate-child' | 'irreversible' | 'revoke-delegation';

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
  delegate_task: 'revoke-delegation',
  delegate_selfmod: 'revoke-delegation',
  delegate_dangerous_action: 'revoke-delegation',
  quarantine_branch: 'irreversible',
  revoke_branch: 'irreversible',
  pause_selfmod: 'irreversible',      // pause → resume is the inverse, not rollback
  resume_selfmod: 'irreversible',     // resume → pause is the inverse, not rollback  
  restore_branch: 'irreversible',     // restore is itself a recovery action
};


/** Why a governance decision was made — which layer blocked or escalated */
export type GovernanceDenialLayer =
  | 'constitution'
  | 'policy'
  | 'identity'
  | 'economy'
  | 'risk'                // Round 17.0: risk-level escalation
  | 'approval_missing';

// ── Governance Status ─────────────────────────────────────────────────

export type GovernanceStatus =
  | 'proposed'
  | 'proposal_invalid'      // Round 17.5: initiation rejected (e.g. revoked identity)
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
  'denied', 'verified', 'rolled_back', 'proposal_invalid',
];

/** Valid status transitions */
export const STATUS_TRANSITIONS: Record<GovernanceStatus, readonly GovernanceStatus[]> = {
  proposed:          ['evaluating'],
  proposal_invalid:  [],                              // Round 17.5: terminal
  evaluating:        ['approved', 'denied', 'escalated'],
  approved:          ['applying'],
  denied:            [],
  escalated:         ['approved', 'denied'],
  applying:          ['applied', 'failed'],
  applied:           ['verifying', 'rolled_back'],
  verifying:         ['verified', 'failed'],
  verified:          [],
  failed:            ['rolled_back', 'applying'], // retry or rollback
  rolled_back:       [],
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
  /** Round 17.4: Parent identity ID for lineage tracking */
  parentIdentityId?: string;
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

export type GovernanceReceiptPhase = 'initiation' | 'decision' | 'apply' | 'verify' | 'rollback';

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
    /** Governance verdict ID (Round 17.1) */
    verdictId?: string;
    /** Delegated peer ID (Round 17.2) */
    delegatedPeerId?: string;
    /** Delegation scope ID (Round 17.2) */
    delegationScopeId?: string;
    /** Branch control receipt timestamp (Round 18.7) */
    branchControlReceiptId?: string;
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
  /** Delegation-specific fields (Round 17.2) */
  delegation?: DelegationProposalFields;
}

/** Fields required when proposing a delegation action (Round 17.2) */
export interface DelegationProposalFields {
  /** Target peer ID to delegate to */
  targetPeerId: string;
  /** Description of the delegated task/action */
  taskDescription: string;
  /** Whether sub-delegation is requested */
  subDelegationRequested: boolean;
  /** Requested authority scope restrictions */
  requestedScope?: {
    budgetCapCents?: number;
    allowSelfmod?: boolean;
    allowDangerousAction?: boolean;
    expiryMs?: number;
  };
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

// ── Governance Trace (Round 17.1) ──────────────────────────────────

export interface GovernanceTraceEntry {
  proposalId: string;
  actionKind: GovernanceActionKind;
  status: GovernanceStatus;
  verdictId?: string;
  verdictCode?: string;
  receipts: Array<{
    id: string;
    phase: GovernanceReceiptPhase;
    result: 'success' | 'failure';
    verdictId?: string;
    lineageRecordId?: string;
  }>;
  lineageRecordId?: string;
  branchControlReceiptId?: string;
  /** Delegation-specific trace info (Round 17.2) */
  delegation?: {
    targetPeerId: string;
    delegationScopeId: string;
    delegationResult?: string;
    violations?: string[];
  };
  timestamp: string;
}
