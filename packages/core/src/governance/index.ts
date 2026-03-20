/**
 * Governance Module — Round 16.3
 *
 * Unified governance workflow for high-risk actions.
 * GovernanceService is the canonical governance owner.
 */

// Contract types
export type {
  GovernanceActionKind,
  GovernanceRiskLevel,
  GovernanceDenialLayer,
  GovernanceStatus,
  GovernanceProposal,
  GovernanceReceipt,
  GovernanceReceiptPhase,
  GovernanceActor,
  RollbackPlan,
  RollbackStrategyKind,
  ProposalInput,
  GovernanceDiagnostics,
} from './governance-contract.js';

export {
  ACTION_RISK_MAP,
  ACTION_ROLLBACK_MAP,
  STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  isValidStatusTransition,
} from './governance-contract.js';

// Service
export {
  GovernanceService,
  type GovernanceIdentityProvider,
  type GovernancePolicyProvider,
  type GovernanceServiceOptions,
} from './governance-service.js';
