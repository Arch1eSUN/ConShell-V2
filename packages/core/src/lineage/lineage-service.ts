/**
 * LineageService — Round 16.5 → 20.8
 *
 * Canonical owner of parent-child lineage lifecycle.
 * Orchestrates: MultiAgentManager (runtime) + InheritanceBoundary (identity) + FundingLease (economics)
 *
 * Round 20.8 G5: Auto-linkage injection + spawn linkage audit
 *
 * Architecture: GovernanceService → LineageService → MultiAgentManager
 */
import type { MultiAgentManager, SpawnRequest } from '../multiagent/index.js';
import type { InheritanceManifest } from '../identity/inheritance-boundary.js';
import type { LineageGovernanceBridge } from './lineage-governance-bridge.js';
import { getFieldsByPolicy } from '../identity/inheritance-boundary.js';
import type {
  ChildRuntimeSpec,
  ChildRuntimeStatus,
  LineageRecord,
  FundingLease,
  FundingLeaseStatus,
  ChildIdentitySummary,
  ReplicationReceipt,
  TerminationReceipt,
  LineageStats,
  LineageFilter,
  RecallPolicy,
  SpawnLinkageAudit,
} from './lineage-contract.js';
import { isValidChildTransition } from './lineage-contract.js';
import type { CommitmentStore } from '../agenda/commitment-store.js';
import { createDefaultScope } from './inheritance-scope.js';

import type { Logger } from '../types/common.js';
import type { EconomicStateService } from '../economic/economic-state-service.js';

// Re-export all contract types
export * from './lineage-contract.js';

// ── Options ──────────────────────────────────────────────────────────

export interface LineageServiceOptions {
  multiagent: MultiAgentManager;
  inheritanceManifest: InheritanceManifest;
  logger: Logger;
  economicService?: EconomicStateService;
  /** Root agent identity fingerprint */
  rootFingerprint?: string;
  /** Round 19.4: Governance bridge for lifecycle feedback */
  governanceBridge?: LineageGovernanceBridge;
  /** Round 20.8 G5: Commitment store for auto-linkage injection */
  commitmentStore?: CommitmentStore;
}

// ── LineageService ───────────────────────────────────────────────────

export class LineageService {
  private records = new Map<string, LineageRecord>();
  private receiptLog: ReplicationReceipt[] = [];
  private terminationLog: TerminationReceipt[] = [];
  private readonly multiagent: MultiAgentManager;
  private readonly manifest: InheritanceManifest;
  private readonly logger: Logger;
  private readonly economicService?: EconomicStateService;
  private readonly rootFingerprint: string;
  private governanceBridge?: LineageGovernanceBridge;
  private readonly commitmentStore?: CommitmentStore;
  private idCounter = 0;
  /** Round 20.8 G5: Spawn linkage audit trail */
  private _spawnLinkageAudits: SpawnLinkageAudit[] = [];

  constructor(opts: LineageServiceOptions) {
    this.multiagent = opts.multiagent;
    this.manifest = opts.inheritanceManifest;
    this.logger = opts.logger;
    this.economicService = opts.economicService;
    this.rootFingerprint = opts.rootFingerprint ?? 'root-genesis';
    this.governanceBridge = opts.governanceBridge;
    this.commitmentStore = opts.commitmentStore;
  }

  /** Round 19.4: Set bridge after construction (for late-binding) */
  setGovernanceBridge(bridge: LineageGovernanceBridge): void {
    this.governanceBridge = bridge;
  }

  // ── Child Lifecycle ──────────────────────────────────────────────

  /**
   * Create a child runtime from a spec.
   * Transitions: planned → creating → active (or failed)
   */
  async createChild(spec: ChildRuntimeSpec): Promise<LineageRecord> {
    const recordId = `lin_${Date.now()}_${++this.idCounter}`;
    const leaseId = `lease_${Date.now()}_${this.idCounter}`;

    // 0. Round 18.6: Strict Lineage Viability Gating
    if (this.economicService) {
      const viability = this.economicService.evaluateLineageViability(spec.fundingCents);
      if (!viability.viable) {
        throw new Error(`Lineage viability gating failed: ${viability.reason}`);
      }
    }

    // Round 20.8 G5: Resolve spawn linkage
    const linkageAudit = this.resolveSpawnLinkage(spec);
    this._spawnLinkageAudits.push(linkageAudit);

    // Build identity summary from inheritance manifest
    const identitySummary = this.buildIdentitySummary(spec);

    // Create funding lease
    const fundingLease: FundingLease = {
      id: leaseId,
      childId: '', // will be set after spawn
      budgetCapCents: spec.fundingCents,
      spentCents: 0,
      status: 'active',
      grantedAt: new Date().toISOString(),
    };

    // Create lineage record in 'planned' state
    const record: LineageRecord = {
      id: recordId,
      parentId: spec.parentId,
      childId: '', // will be set after spawn
      spec,
      status: 'planned',
      fundingLease,
      identitySummary,
      inheritanceScope: createDefaultScope(),
      proposalId: spec.proposalId,
      createdAt: new Date().toISOString(),
      spawnLinkageAudit: linkageAudit,
    };

    this.records.set(recordId, record);
    this.logger.info('Lineage record created', { recordId, name: spec.name, status: 'planned' });

    // Transition to creating
    this.transition(record, 'creating');

    try {
      // Spawn via MultiAgentManager
      const spawnReq: SpawnRequest = {
        name: spec.name,
        task: spec.task,
        genesisPrompt: spec.genesisPrompt,
        fundCents: spec.fundingCents,
        parentId: spec.parentId,
        config: spec.config,
      };

      const child = await this.multiagent.spawn(spawnReq);

      // Fill in child ID
      record.childId = child.id;
      record.fundingLease.childId = child.id;

      // Transition to active
      this.transition(record, 'active');
      record.activatedAt = new Date().toISOString();

      // Log replication receipt
      const receipt: ReplicationReceipt = {
        proposalId: spec.proposalId,
        lineageRecordId: recordId,
        childId: child.id,
        result: 'success',
        timestamp: new Date().toISOString(),
      };
      this.receiptLog.push(receipt);

      this.logger.info('Child runtime actualized', { recordId, childId: child.id, name: spec.name });
      return record;

    } catch (err) {
      // Failed to create
      this.transition(record, 'failed');
      record.failedAt = new Date().toISOString();
      record.statusReason = err instanceof Error ? err.message : String(err);

      const receipt: ReplicationReceipt = {
        proposalId: spec.proposalId,
        lineageRecordId: recordId,
        childId: '',
        result: 'failure',
        reason: record.statusReason,
        timestamp: new Date().toISOString(),
      };
      this.receiptLog.push(receipt);

      this.logger.error('Child runtime creation failed', { recordId, error: record.statusReason });
      return record;
    }
  }

  /**
   * Recall a child — governance-gated return.
   */
  async recallChild(recordId: string, policy: RecallPolicy): Promise<TerminationReceipt> {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    this.transition(record, 'recalled');
    record.recalledAt = new Date().toISOString();
    record.statusReason = policy.reason;

    // Terminate the runtime
    if (record.childId) {
      await this.multiagent.terminate(record.childId, policy.cascadeToChildren);
    }

    // Clean up funding if requested
    if (policy.cleanupFunding) {
      record.fundingLease.status = 'revoked';
      record.fundingLease.revokedBy = policy.actor;
      record.fundingLease.revokedReason = policy.reason;
    }

    const receipt = this.createTerminationReceipt(record, policy.reason, policy.actor);
    this.logger.info('Child recalled', { recordId, childId: record.childId, reason: policy.reason });
    return receipt;
  }

  /**
   * Terminate a child — explicit end.
   */
  async terminateChild(recordId: string, reason: string, actor = 'system'): Promise<TerminationReceipt> {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    this.transition(record, 'terminated');
    record.terminatedAt = new Date().toISOString();
    record.statusReason = reason;

    // Terminate runtime
    if (record.childId) {
      await this.multiagent.terminate(record.childId, true);
    }

    // Revoke funding
    if (record.fundingLease.status === 'active') {
      record.fundingLease.status = 'revoked';
      record.fundingLease.revokedBy = actor;
      record.fundingLease.revokedReason = reason;
    }

    const receipt = this.createTerminationReceipt(record, reason, actor);
    this.logger.info('Child terminated', { recordId, childId: record.childId, reason });
    return receipt;
  }

  /**
   * Orphan a child — parent can no longer manage.
   */
  orphanChild(recordId: string, reason: string): LineageRecord {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    this.transition(record, 'orphaned');
    record.orphanedAt = new Date().toISOString();
    record.statusReason = reason;

    this.logger.warn('Child orphaned', { recordId, childId: record.childId, reason });
    return record;
  }

  /**
   * Mark a child as degraded.
   */
  degradeChild(recordId: string, reason: string): LineageRecord {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    this.transition(record, 'degraded');
    record.statusReason = reason;
    this.logger.warn('Child degraded', { recordId, reason });
    return record;
  }

  /**
   * Recover a degraded child back to active.
   */
  recoverChild(recordId: string): LineageRecord {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    this.transition(record, 'active');
    record.statusReason = undefined;
    this.logger.info('Child recovered', { recordId });
    return record;
  }

  // ── Funding ────────────────────────────────────────────────────────

  /**
   * Attach or update a funding lease.
   */
  attachFunding(recordId: string, budgetCapCents: number, expiresAt?: string): FundingLease {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    record.fundingLease.budgetCapCents = budgetCapCents;
    record.fundingLease.status = 'active';
    if (expiresAt) record.fundingLease.expiresAt = expiresAt;

    this.logger.info('Funding attached', { recordId, budgetCapCents });
    return record.fundingLease;
  }

  /**
   * Record spending against a child's lease.
   */
  recordSpend(recordId: string, cents: number): FundingLease {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    const lease = record.fundingLease;
    if (lease.status !== 'active') {
      throw new Error(`Cannot record spend: lease status is ${lease.status}`);
    }

    lease.spentCents += cents;
    if (lease.spentCents >= lease.budgetCapCents) {
      lease.status = 'exhausted';
      this.logger.warn('Funding lease exhausted', { recordId, spent: lease.spentCents, cap: lease.budgetCapCents });
    }

    return lease;
  }

  /**
   * Revoke a funding lease.
   */
  revokeFunding(recordId: string, reason: string, actor = 'system'): FundingLease {
    const record = this.getRecord(recordId);
    if (!record) throw new Error(`Lineage record not found: ${recordId}`);

    record.fundingLease.status = 'revoked';
    record.fundingLease.revokedBy = actor;
    record.fundingLease.revokedReason = reason;

    this.logger.info('Funding revoked', { recordId, reason });
    return record.fundingLease;
  }

  /**
   * Check if a lease has expired.
   */
  checkLeaseExpiry(recordId: string): boolean {
    const record = this.getRecord(recordId);
    if (!record) return false;

    const lease = record.fundingLease;
    if (lease.status !== 'active' || !lease.expiresAt) return false;

    if (new Date(lease.expiresAt) <= new Date()) {
      lease.status = 'expired';
      this.logger.warn('Funding lease expired', { recordId });
      return true;
    }
    return false;
  }

  // ── Queries ────────────────────────────────────────────────────────

  getRecord(id: string): LineageRecord | undefined {
    return this.records.get(id);
  }

  /** Find record by child agent ID */
  getByChildId(childId: string): LineageRecord | undefined {
    for (const record of this.records.values()) {
      if (record.childId === childId) return record;
    }
    return undefined;
  }

  listChildren(filter?: LineageFilter): LineageRecord[] {
    let results = Array.from(this.records.values());
    if (filter?.status) results = results.filter(r => r.status === filter.status);
    if (filter?.parentId) results = results.filter(r => r.parentId === filter.parentId);
    return results;
  }

  childIdentitySummary(recordId: string): ChildIdentitySummary | undefined {
    return this.getRecord(recordId)?.identitySummary;
  }

  replicationReceipts(): readonly ReplicationReceipt[] {
    return this.receiptLog;
  }

  terminationReceipts(): readonly TerminationReceipt[] {
    return this.terminationLog;
  }

  // ── Stats / Diagnostics ────────────────────────────────────────────

  stats(): LineageStats {
    const all = Array.from(this.records.values());
    const byStatus = {} as Record<ChildRuntimeStatus, number>;
    const statuses: ChildRuntimeStatus[] = [
      'planned', 'creating', 'active', 'degraded',
      'recalled', 'terminated', 'orphaned', 'failed',
    ];
    for (const s of statuses) byStatus[s] = 0;
    for (const r of all) byStatus[r.status]++;

    let totalAllocated = 0;
    let totalSpent = 0;
    let maxGen = 0;
    for (const r of all) {
      totalAllocated += r.fundingLease.budgetCapCents;
      totalSpent += r.fundingLease.spentCents;
      maxGen = Math.max(maxGen, r.identitySummary.generation);
    }

    return {
      totalChildren: all.length,
      byStatus,
      totalFundingAllocated: totalAllocated,
      totalFundingSpent: totalSpent,
      maxGenerationDepth: maxGen,
      activeChildren: byStatus.active ?? 0,
    };
  }

  // ── Internal ───────────────────────────────────────────────────────

  private transition(record: LineageRecord, to: ChildRuntimeStatus, reason = '', actor = 'system'): void {
    if (!isValidChildTransition(record.status, to)) {
      throw new Error(`Invalid lineage transition: ${record.status} → ${to} (record: ${record.id})`);
    }
    const previousStatus = record.status;
    record.status = to;

    // Round 19.4: Emit lifecycle event through governance bridge
    if (this.governanceBridge) {
      this.governanceBridge.processLifecycleEvent(record, previousStatus, to, reason, actor);
    }
  }

  private buildIdentitySummary(spec: ChildRuntimeSpec): ChildIdentitySummary {
    return {
      fingerprint: `child_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      parentFingerprint: this.rootFingerprint,
      lineageRoot: this.rootFingerprint,
      generation: 1, // will be overridden from multiagent if available
      inheritedFields: getFieldsByPolicy(this.manifest, 'inherit'),
      derivedFields: getFieldsByPolicy(this.manifest, 'derive'),
      excludedFields: getFieldsByPolicy(this.manifest, 'exclude'),
    };
  }

  private createTerminationReceipt(record: LineageRecord, reason: string, actor: string): TerminationReceipt {
    const receipt: TerminationReceipt = {
      childId: record.childId,
      lineageRecordId: record.id,
      reason,
      actor,
      fundingRemainingCents: record.fundingLease.budgetCapCents - record.fundingLease.spentCents,
      timestamp: new Date().toISOString(),
    };
    this.terminationLog.push(receipt);
    return receipt;
  }

  // ── Round 20.8 G5: Auto-Linkage ──────────────────────────────────

  /**
   * Resolve spawn commitment linkage.
   * - If targetCommitmentId is provided, use explicit linkage.
   * - If absent, try to auto-link by matching task to active commitments.
   * - If no match, record as no_linkage (bypass audit).
   */
  private resolveSpawnLinkage(spec: ChildRuntimeSpec): SpawnLinkageAudit {
    // Case 1: Explicit linkage provided
    if (spec.targetCommitmentId) {
      return {
        resolution: 'explicit',
        targetCommitmentId: spec.targetCommitmentId,
        reason: `Explicit linkage to commitment ${spec.targetCommitmentId}`,
      };
    }

    // Case 2: Try auto-link via commitment store
    if (this.commitmentStore) {
      const activeCommitments = this.commitmentStore.list({ status: ['active'] });
      // Find a commitment whose taskType matches the spec task
      const match = activeCommitments.find(c =>
        c.taskType && spec.task.toLowerCase().includes(c.taskType.toLowerCase()),
      );

      if (match) {
        // Inject the linkage back into the spec (mutate in-place for downstream consumers)
        spec.targetCommitmentId = match.id;
        this.logger.info('Auto-linked spawn to commitment', { commitmentId: match.id, task: spec.task });
        return {
          resolution: 'auto_linked',
          targetCommitmentId: match.id,
          reason: `Auto-linked to commitment '${match.name}' (taskType match)`,
        };
      }
    }

    // Case 3: No linkage possible — bypass audit
    this.logger.warn('Spawn without commitment linkage', { task: spec.task, name: spec.name });
    return {
      resolution: 'no_linkage',
      reason: this.commitmentStore
        ? 'No active commitment matched task description'
        : 'CommitmentStore not configured',
    };
  }

  /** Round 20.8 G5: Get spawn linkage audit trail */
  spawnLinkageAudits(): readonly SpawnLinkageAudit[] {
    return [...this._spawnLinkageAudits];
  }
}
