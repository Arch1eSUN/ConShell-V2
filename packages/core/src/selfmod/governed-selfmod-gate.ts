/**
 * GovernedSelfModGate — Round 19.3
 *
 * Governance gateway for all self-modification operations.
 * Ensures every modification flows through GovernanceService's
 * propose → evaluate → apply → verify chain before SelfModManager
 * touches the filesystem.
 *
 * Features:
 * - Governance approval gate (deny / require_review / approve)
 * - Pause/resume capability (via governance actions)
 * - Closed-loop audit trail linking governance receipts to mod records
 */
import type { Logger } from '../types/common.js';
import type { SelfModManager, ModificationRecord } from './index.js';

// ── Types ──────────────────────────────────────────────────────────────

export type GateOutcome = 'approved' | 'denied' | 'escalated' | 'paused';

export interface GateResult {
  readonly outcome: GateOutcome;
  readonly reason: string;
  readonly governanceProposalId?: string;
  readonly modRecordId?: string;
}

export interface GatedModHistory {
  readonly file: string;
  readonly reason: string;
  readonly outcome: GateOutcome;
  readonly governanceProposalId?: string;
  readonly modRecordId?: string;
  readonly timestamp: string;
}

/** Minimal GovernanceService interface to avoid circular dependency */
export interface SelfModGovernanceProvider {
  propose(input: {
    actionKind: 'selfmod';
    target: string;
    justification: string;
    payload?: Record<string, unknown>;
  }): { id: string; status: string };
  evaluate(proposalId: string): { code: string; reason: string };
  apply(proposalId: string): Promise<{ result: string; reason: string; relatedIds?: { modRecordId?: string } }>;
  forceApprove(proposalId: string): { code: string };
}

// ── GovernedSelfModGate ───────────────────────────────────────────────

export class GovernedSelfModGate {
  private paused = false;
  private history: GatedModHistory[] = [];
  private logger: Logger;

  constructor(
    private governance: SelfModGovernanceProvider,
    private selfmod: SelfModManager,
    logger: Logger,
  ) {
    this.logger = logger.child('governed-selfmod-gate');
  }

  /**
   * Request a governed self-modification.
   *
   * Flow: governance.propose → evaluate → apply (which calls selfmod internally)
   */
  async requestModification(file: string, content: string, reason: string): Promise<GateResult> {
    // Check pause gate
    if (this.paused) {
      const entry = this.recordHistory(file, reason, 'paused', undefined, undefined);
      this.logger.info('Self-modification paused by governance', { file });
      return { outcome: 'paused', reason: 'Self-modification capability is currently paused by governance action' };
    }

    // Step 1: Create governance proposal
    const proposal = this.governance.propose({
      actionKind: 'selfmod',
      target: file,
      justification: reason,
      payload: { file, content },
    });

    // Step 2: Evaluate
    const verdict = this.governance.evaluate(proposal.id);

    if (verdict.code === 'deny') {
      this.recordHistory(file, reason, 'denied', proposal.id, undefined);
      this.logger.info('Self-modification denied by governance', { file, reason: verdict.reason });
      return {
        outcome: 'denied',
        reason: verdict.reason,
        governanceProposalId: proposal.id,
      };
    }

    if (verdict.code === 'require_review') {
      this.recordHistory(file, reason, 'escalated', proposal.id, undefined);
      this.logger.info('Self-modification escalated for review', { file, reason: verdict.reason });
      return {
        outcome: 'escalated',
        reason: verdict.reason,
        governanceProposalId: proposal.id,
      };
    }

    // Step 3: Apply (governance's apply will call selfmod.propose → approve → apply → verify)
    try {
      const receipt = await this.governance.apply(proposal.id);
      const modRecordId = receipt.relatedIds?.modRecordId;

      this.recordHistory(file, reason, 'approved', proposal.id, modRecordId);
      this.logger.info('Self-modification approved and applied', {
        file, proposalId: proposal.id, modRecordId,
      });
      return {
        outcome: 'approved',
        reason: 'Modification approved and applied via governance chain',
        governanceProposalId: proposal.id,
        modRecordId,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.recordHistory(file, reason, 'denied', proposal.id, undefined);
      this.logger.error('Self-modification apply failed', { file, error: errMsg });
      return {
        outcome: 'denied',
        reason: `Apply failed: ${errMsg}`,
        governanceProposalId: proposal.id,
      };
    }
  }

  /**
   * Force-approve an escalated modification (by creator/admin).
   * Requires calling governance.forceApprove, then apply.
   */
  async resolveEscalated(governanceProposalId: string): Promise<GateResult> {
    try {
      this.governance.forceApprove(governanceProposalId);
      const receipt = await this.governance.apply(governanceProposalId);
      const modRecordId = receipt.relatedIds?.modRecordId;
      return {
        outcome: 'approved',
        reason: 'Force-approved by creator and applied',
        governanceProposalId,
        modRecordId,
      };
    } catch (err) {
      return {
        outcome: 'denied',
        reason: `Force-approve failed: ${err instanceof Error ? err.message : String(err)}`,
        governanceProposalId,
      };
    }
  }

  // ── Pause/Resume ────────────────────────────────────────────────────

  /** Pause all self-modification (called by governance's pause_selfmod action) */
  pause(): void {
    this.paused = true;
    this.logger.info('Self-modification capability PAUSED');
  }

  /** Resume self-modification (called by governance's resume_selfmod action) */
  resume(): void {
    this.paused = false;
    this.logger.info('Self-modification capability RESUMED');
  }

  /** Whether modifications are currently paused */
  isPaused(): boolean {
    return this.paused;
  }

  /** Whether governance is enabled (always true for this gate) */
  isGovernanceEnabled(): boolean {
    return true;
  }

  // ── History / Audit ─────────────────────────────────────────────────

  /** Get full modification history through the gate */
  getHistory(): readonly GatedModHistory[] {
    return this.history;
  }

  /** Get modification history for a specific file */
  getFileHistory(file: string): readonly GatedModHistory[] {
    return this.history.filter(h => h.file === file);
  }

  /** Gate statistics */
  stats(): { total: number; approved: number; denied: number; escalated: number; paused: number } {
    const counts = { total: 0, approved: 0, denied: 0, escalated: 0, paused: 0 };
    for (const h of this.history) {
      counts.total++;
      counts[h.outcome]++;
    }
    return counts;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private recordHistory(
    file: string,
    reason: string,
    outcome: GateOutcome,
    governanceProposalId?: string,
    modRecordId?: string,
  ): GatedModHistory {
    const entry: GatedModHistory = {
      file,
      reason,
      outcome,
      governanceProposalId,
      modRecordId,
      timestamp: new Date().toISOString(),
    };
    this.history.push(entry);
    return entry;
  }
}
