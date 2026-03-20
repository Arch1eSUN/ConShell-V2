/**
 * Lineage module — Round 16.5
 *
 * Barrel exports for the lineage domain.
 */
export { LineageService } from './lineage-service.js';
export type { LineageServiceOptions } from './lineage-service.js';

// Re-export all contract types
export type {
  ChildRuntimeStatus,
  ChildRuntimeSpec,
  LineageRecord,
  FundingLease,
  FundingLeaseStatus,
  ChildIdentitySummary,
  ReplicationReceipt,
  TerminationReceipt,
  RecallPolicy,
  LineageStats,
  LineageFilter,
} from './lineage-contract.js';

export {
  CHILD_STATUS_TRANSITIONS,
  TERMINAL_CHILD_STATUSES,
  isValidChildTransition,
} from './lineage-contract.js';

// Round 19.4: Governance bridge
export { LineageGovernanceBridge } from './lineage-governance-bridge.js';
export type {
  LineageLifecycleEvent,
  LineageEventKind,
  BridgeEffect,
  GovernanceAuditSink,
  EconomicFundingRecovery,
  LineageHealthSnapshot,
  CollectivePeerSync,
} from './lineage-governance-bridge.js';
