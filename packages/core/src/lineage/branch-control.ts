/**
 * LineageBranchControl — Round 17.0
 *
 * Graph-level operations on the lineage tree.
 * Operates on the LineageService records to perform branch-wide
 * quarantine, revocation, compromise detection, and restoration.
 *
 * All operations cascade to descendants recursively.
 */

import type {
  LineageRecord,
  ChildRuntimeStatus,
} from './lineage-contract.js';
import { isValidChildTransition, TERMINAL_CHILD_STATUSES } from './lineage-contract.js';
import type { Logger } from '../types/common.js';

// ── Branch Control Receipts ──────────────────────────────────────────

export type BranchControlAction = 'quarantine' | 'revoke' | 'compromise' | 'restore';

export interface BranchControlReceipt {
  readonly action: BranchControlAction;
  readonly targetRecordId: string;
  readonly affectedDescendants: readonly string[];
  readonly reason: string;
  readonly timestamp: string;
  readonly governanceVerdictId?: string;
}

export interface BranchStatus {
  readonly recordId: string;
  readonly status: ChildRuntimeStatus;
  readonly isQuarantined: boolean;
  readonly isCompromised: boolean;
  readonly descendantCount: number;
  readonly quarantinedDescendants: number;
  readonly compromisedDescendants: number;
}

// ── Records Provider Interface ───────────────────────────────────────
// LineageBranchControl operates on records through this interface,
// avoiding circular dependency with LineageService.

export interface LineageRecordProvider {
  /** Get a single record by ID */
  getRecord(id: string): LineageRecord | undefined;
  /** Get all direct children of a parent */
  getChildrenOf(parentChildId: string): readonly LineageRecord[];
  /** Update a record's status */
  updateStatus(id: string, status: ChildRuntimeStatus, reason: string): void;
  /** Get all records */
  getAllRecords(): readonly LineageRecord[];
}

// ── LineageBranchControl ─────────────────────────────────────────────

export class LineageBranchControl {
  private readonly provider: LineageRecordProvider;
  private readonly logger: Logger;
  private readonly receiptLog: BranchControlReceipt[] = [];

  constructor(provider: LineageRecordProvider, logger: Logger) {
    this.provider = provider;
    this.logger = logger;
  }

  /**
   * Quarantine a branch — suspend all actions pending review.
   * Cascades to all descendants.
   */
  quarantineBranch(recordId: string, reason: string, verdictId?: string): BranchControlReceipt {
    const affected = this.cascadeStatusChange(recordId, 'quarantined', reason);
    const receipt = this.createReceipt('quarantine', recordId, affected, reason, verdictId);
    this.receiptLog.push(receipt);
    this.logger.info(`[BranchControl] Quarantined branch ${recordId}, affected ${affected.length} descendants`);
    return receipt;
  }

  /**
   * Revoke a branch — terminate all children in the branch.
   * Cascades to all descendants.
   */
  revokeBranch(recordId: string, reason: string, verdictId?: string): BranchControlReceipt {
    const affected = this.cascadeStatusChange(recordId, 'terminated', reason);
    const receipt = this.createReceipt('revoke', recordId, affected, reason, verdictId);
    this.receiptLog.push(receipt);
    this.logger.info(`[BranchControl] Revoked branch ${recordId}, terminated ${affected.length} descendants`);
    return receipt;
  }

  /**
   * Mark a branch as compromised — flag all descendants as tainted.
   * Cascades to all descendants.
   */
  markCompromised(recordId: string, threatDescription: string, verdictId?: string): BranchControlReceipt {
    const affected = this.cascadeStatusChange(recordId, 'compromised', threatDescription);
    const receipt = this.createReceipt('compromise', recordId, affected, threatDescription, verdictId);
    this.receiptLog.push(receipt);
    this.logger.warn(`[BranchControl] Marked branch ${recordId} as compromised: ${threatDescription}`);
    return receipt;
  }

  /**
   * Restore a quarantined branch — move back to active.
   * Only works for quarantined records (not compromised).
   */
  restoreBranch(recordId: string, justification: string, verdictId?: string): BranchControlReceipt {
    const affected = this.cascadeStatusChange(recordId, 'active', justification, true);
    const receipt = this.createReceipt('restore', recordId, affected, justification, verdictId);
    this.receiptLog.push(receipt);
    this.logger.info(`[BranchControl] Restored branch ${recordId}, restored ${affected.length} descendants`);
    return receipt;
  }

  // ── Queries ──────────────────────────────────────────────────────

  /** Get all descendant records (recursive) */
  getDescendants(recordId: string): LineageRecord[] {
    const record = this.provider.getRecord(recordId);
    if (!record) return [];

    const descendants: LineageRecord[] = [];
    const queue = [record.childId];

    while (queue.length > 0) {
      const parentChildId = queue.shift()!;
      const children = this.provider.getChildrenOf(parentChildId);
      for (const child of children) {
        descendants.push(child);
        queue.push(child.childId);
      }
    }

    return descendants;
  }

  /** Get branch status summary */
  getBranchStatus(recordId: string): BranchStatus | undefined {
    const record = this.provider.getRecord(recordId);
    if (!record) return undefined;

    const descendants = this.getDescendants(recordId);
    return {
      recordId,
      status: record.status,
      isQuarantined: record.status === 'quarantined',
      isCompromised: record.status === 'compromised',
      descendantCount: descendants.length,
      quarantinedDescendants: descendants.filter(d => d.status === 'quarantined').length,
      compromisedDescendants: descendants.filter(d => d.status === 'compromised').length,
    };
  }

  /** Get all compromised branches */
  getCompromisedBranches(): LineageRecord[] {
    return this.provider.getAllRecords().filter(r => r.status === 'compromised');
  }

  /** Get receipt log */
  getReceiptLog(): readonly BranchControlReceipt[] {
    return this.receiptLog;
  }

  // ── Internal ─────────────────────────────────────────────────────

  private cascadeStatusChange(
    recordId: string,
    targetStatus: ChildRuntimeStatus,
    reason: string,
    restoreOnly = false,
  ): string[] {
    const record = this.provider.getRecord(recordId);
    if (!record) return [];

    const affected: string[] = [];

    // Apply to root
    if (this.canTransition(record, targetStatus, restoreOnly)) {
      this.provider.updateStatus(recordId, targetStatus, reason);
      affected.push(recordId);
    }

    // Cascade to descendants
    const descendants = this.getDescendants(recordId);
    for (const desc of descendants) {
      if (this.canTransition(desc, targetStatus, restoreOnly)) {
        this.provider.updateStatus(desc.id, targetStatus, reason);
        affected.push(desc.id);
      }
    }

    return affected;
  }

  private canTransition(
    record: LineageRecord,
    targetStatus: ChildRuntimeStatus,
    restoreOnly: boolean,
  ): boolean {
    // Skip terminal records
    if ((TERMINAL_CHILD_STATUSES as readonly string[]).includes(record.status)) {
      return false;
    }
    // For restore: only quarantined can be restored
    if (restoreOnly && record.status !== 'quarantined') {
      return false;
    }
    return isValidChildTransition(record.status, targetStatus);
  }

  private createReceipt(
    action: BranchControlAction,
    targetRecordId: string,
    affected: string[],
    reason: string,
    verdictId?: string,
  ): BranchControlReceipt {
    return {
      action,
      targetRecordId,
      affectedDescendants: affected.filter(id => id !== targetRecordId),
      reason,
      timestamp: new Date().toISOString(),
      governanceVerdictId: verdictId,
    };
  }
}
