/**
 * GovernanceService — Round 16.3
 *
 * Gateway-pattern canonical governance owner.
 * All high-risk actions (selfmod, replication, identity lifecycle)
 * MUST flow through this service.
 *
 * Flow: propose → evaluate → apply → verify → (rollback if failed)
 *
 * Evaluation unifies:
 *   1. Identity status (SovereignIdentityService)
 *   2. Policy rules (PolicyEngine)
 *   3. Economic state (budget/balance)
 *   4. Risk level + rollback strategy
 */
import type { Logger } from '../types/common.js';
import type { PolicyEngine, PolicyContext, PolicyResult } from '../policy/index.js';
import type { SelfModManager, ModificationRecord } from '../selfmod/index.js';
import type { MultiAgentManager, SpawnRequest, ChildAgent } from '../multiagent/index.js';
import type { LineageService, ChildRuntimeSpec } from '../lineage/index.js';
import type { CollectiveService } from '../collective/index.js';
import type { SovereignIdentityStatus } from '../identity/sovereign-identity-contract.js';
import {
  type GovernanceActionKind,
  type GovernanceRiskLevel,
  type GovernanceDecision,
  type GovernanceDenialLayer,
  type GovernanceStatus,
  type GovernanceProposal,
  type GovernanceReceipt,
  type GovernanceReceiptPhase,
  type GovernanceActor,
  type RollbackPlan,
  type ProposalInput,
  type GovernanceDiagnostics,
  ACTION_RISK_MAP,
  ACTION_ROLLBACK_MAP,
  isValidStatusTransition,
  TERMINAL_STATUSES,
} from './governance-contract.js';

// Re-export contract types
export type {
  GovernanceActionKind,
  GovernanceRiskLevel,
  GovernanceDecision,
  GovernanceDenialLayer,
  GovernanceStatus,
  GovernanceProposal,
  GovernanceReceipt,
  GovernanceReceiptPhase,
  GovernanceActor,
  RollbackPlan,
  ProposalInput,
  GovernanceDiagnostics,
};
export { ACTION_RISK_MAP, ACTION_ROLLBACK_MAP, isValidStatusTransition, TERMINAL_STATUSES };

// ── Identity Provider Interface ────────────────────────────────────────

/** Minimal interface so governance doesn't import full SovereignIdentityService */
export interface GovernanceIdentityProvider {
  status(): SovereignIdentityStatus;
  selfFingerprint(): string;
}

// ── Policy Provider Interface ──────────────────────────────────────────

export interface GovernancePolicyProvider {
  evaluate(ctx: PolicyContext): PolicyResult;
}

// ── Service Options ────────────────────────────────────────────────────

export interface GovernanceServiceOptions {
  /** Identity provider */
  identity: GovernanceIdentityProvider;
  /** Policy provider */
  policy: GovernancePolicyProvider;
  /** Self-modification manager (optional — only needed if selfmod actions used) */
  selfmod?: SelfModManager;
  /** Multi-agent manager (optional — only needed if replication actions used) */
  multiagent?: MultiAgentManager;
  /** Lineage service (optional — canonical owner for replication lifecycle, Round 16.5) */
  lineage?: LineageService;
  /** Collective service (optional — peer registry, Round 16.6) */
  collective?: CollectiveService;
  /** Logger */
  logger: Logger;
  /** Default actor origin */
  defaultOrigin?: GovernanceActor['origin'];
  /** Economic context */
  dailyBudgetCents?: number;
  dailySpentCents?: number;
}

// ── GovernanceService ──────────────────────────────────────────────────

export class GovernanceService {
  private proposals = new Map<string, GovernanceProposal>();
  private receipts: GovernanceReceipt[] = [];
  private identity: GovernanceIdentityProvider;
  private policy: GovernancePolicyProvider;
  private selfmod?: SelfModManager;
  private multiagent?: MultiAgentManager;
  private lineage?: LineageService;
  private collective?: CollectiveService;
  private logger: Logger;
  private defaultOrigin: GovernanceActor['origin'];
  private dailyBudgetCents: number;
  private dailySpentCents: number;
  private idCounter = 0;

  constructor(opts: GovernanceServiceOptions) {
    this.identity = opts.identity;
    this.policy = opts.policy;
    this.selfmod = opts.selfmod;
    this.multiagent = opts.multiagent;
    this.lineage = opts.lineage;
    this.collective = opts.collective;
    this.logger = opts.logger;
    this.defaultOrigin = opts.defaultOrigin ?? 'self';
    this.dailyBudgetCents = opts.dailyBudgetCents ?? 100_00;
    this.dailySpentCents = opts.dailySpentCents ?? 0;
  }

  // ── Core Workflow ───────────────────────────────────────────────────

  /**
   * Step 1: Create a governance proposal for a high-risk action.
   */
  propose(input: ProposalInput): GovernanceProposal {
    const id = `gov_${Date.now()}_${++this.idCounter}`;
    const identityStatus = this.identity.status();
    const identityId = this.identity.selfFingerprint();

    const riskLevel = ACTION_RISK_MAP[input.actionKind];
    const rollbackStrategy = ACTION_ROLLBACK_MAP[input.actionKind];

    const proposal: GovernanceProposal = {
      id,
      actionKind: input.actionKind,
      initiator: {
        identityId,
        identityStatus,
        origin: this.defaultOrigin,
      },
      target: input.target,
      justification: input.justification,
      expectedCostCents: input.expectedCostCents ?? 0,
      riskLevel,
      rollbackPlan: {
        strategy: rollbackStrategy,
        reversible: rollbackStrategy !== 'irreversible',
        steps: this.generateRollbackSteps(input.actionKind, rollbackStrategy),
      },
      status: 'proposed',
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    this.proposals.set(id, proposal);
    this.logger.info('Governance proposal created', {
      id,
      actionKind: input.actionKind,
      target: input.target,
      riskLevel,
    });

    return proposal;
  }

  /**
   * Step 2: Evaluate a proposal against the unified governance chain.
   * Identity → Policy → Economy → Risk escalation.
   */
  evaluate(proposalId: string): GovernanceDecision {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (!isValidStatusTransition(proposal.status, 'evaluating')) {
      throw new Error(`Cannot evaluate proposal in status: ${proposal.status}`);
    }

    proposal.status = 'evaluating';
    proposal.evaluatedAt = new Date().toISOString();

    // ── Layer 1: Identity check ──
    const idStatus = proposal.initiator.identityStatus;
    if (idStatus === 'revoked') {
      return this.denyProposal(proposal, 'identity', 'Identity is revoked — all governance actions denied');
    }
    if (idStatus === 'degraded' && (proposal.riskLevel === 'critical' || proposal.riskLevel === 'high')) {
      return this.denyProposal(proposal, 'identity', `Degraded identity cannot perform ${proposal.riskLevel}-risk actions`);
    }

    // ── Layer 2: Policy check ──
    const policyCtx: PolicyContext = {
      tool: proposal.actionKind,
      action: proposal.actionKind,
      costCents: proposal.expectedCostCents,
      securityLevel: 'standard' as any,
      dailyBudgetCents: this.dailyBudgetCents,
      dailySpentCents: this.dailySpentCents,
      constitutionAccepted: true,
      identityStatus: idStatus,
      callerAuthority: proposal.initiator.origin === 'creator' ? 'creator' : 'self',
    };

    const policyResult = this.policy.evaluate(policyCtx);
    if (policyResult.decision === 'deny') {
      return this.denyProposal(proposal, 'policy', `Policy denied: ${policyResult.rule} — ${policyResult.reason}`);
    }

    // ── Layer 3: Economy check ──
    if (proposal.expectedCostCents > 0) {
      const remaining = this.dailyBudgetCents - this.dailySpentCents;
      if (proposal.expectedCostCents > remaining) {
        return this.denyProposal(proposal, 'economy', `Insufficient budget: need ${proposal.expectedCostCents}¢, have ${remaining}¢`);
      }
    }

    // ── Layer 4: Risk escalation ──
    // Irreversible + critical → escalate
    if (!proposal.rollbackPlan.reversible && proposal.riskLevel === 'critical') {
      return this.escalateProposal(proposal, 'Irreversible critical action requires creator approval');
    }

    // Policy escalation pass-through
    if (policyResult.decision === 'escalate') {
      return this.escalateProposal(proposal, `Policy escalated: ${policyResult.rule}`);
    }

    // ── All checks passed → auto-approve ──
    return this.approveProposal(proposal);
  }

  /**
   * Step 3: Apply an approved proposal (execute the action).
   */
  async apply(proposalId: string): Promise<GovernanceReceipt> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'approved' && proposal.status !== 'failed') {
      throw new Error(`Cannot apply proposal in status: ${proposal.status} (must be approved or failed-retry)`);
    }

    proposal.status = 'applying';

    try {
      let relatedIds: GovernanceReceipt['relatedIds'];

      switch (proposal.actionKind) {
        case 'selfmod': {
          if (!this.selfmod) throw new Error('SelfModManager not configured');
          const file = proposal.payload?.['file'] as string ?? proposal.target;
          const content = proposal.payload?.['content'] as string ?? '';
          const record = await this.selfmod.modify(file, content, proposal.justification);
          relatedIds = { modRecordId: record.id };
          break;
        }
        case 'replication': {
          // Round 16.5: Route through LineageService when available
          if (this.lineage) {
            const childSpec: ChildRuntimeSpec = {
              name: proposal.payload?.['name'] as string ?? proposal.target,
              task: proposal.payload?.['task'] as string ?? proposal.justification,
              genesisPrompt: proposal.payload?.['genesisPrompt'] as string ?? '',
              fundingCents: proposal.expectedCostCents,
              parentId: proposal.payload?.['parentId'] as string ?? 'root',
              proposalId: proposal.id,
            };
            const record = await this.lineage.createChild(childSpec);
            relatedIds = { childId: record.childId, lineageRecordId: record.id };
            // Round 16.6: Auto-register as peer
            if (this.collective && record.status === 'active') {
              this.collective.registerPeerFromChild(record);
            }
          } else if (this.multiagent) {
            // Legacy fallback
            const spawnReq: SpawnRequest = {
              name: proposal.payload?.['name'] as string ?? proposal.target,
              task: proposal.payload?.['task'] as string ?? proposal.justification,
              genesisPrompt: proposal.payload?.['genesisPrompt'] as string ?? '',
              fundCents: proposal.expectedCostCents,
            };
            const child = await this.multiagent.spawn(spawnReq);
            relatedIds = { childId: child.id };
          } else {
            throw new Error('Neither LineageService nor MultiAgentManager configured');
          }
          break;
        }
        case 'fund_child': {
          // Round 16.5: Attach funding via LineageService when available
          const fundChildId = proposal.payload?.['childId'] as string;
          if (this.lineage && fundChildId) {
            const lineageRecord = this.lineage.getByChildId(fundChildId);
            if (lineageRecord) {
              this.lineage.attachFunding(lineageRecord.id, proposal.expectedCostCents);
              relatedIds = { childId: fundChildId, lineageRecordId: lineageRecord.id };
            } else {
              relatedIds = { childId: fundChildId };
            }
          } else {
            relatedIds = { childId: fundChildId };
          }
          break;
        }
        case 'identity_rotation':
        case 'identity_revocation':
        case 'external_declaration':
        case 'dangerous_action': {
          // These are handled externally — governance records the approval
          break;
        }
      }

      proposal.status = 'applied';
      proposal.appliedAt = new Date().toISOString();

      const receipt = this.createReceipt(proposal, 'apply', 'success', 'Action applied successfully', relatedIds);
      this.logger.info('Governance action applied', { proposalId, actionKind: proposal.actionKind });
      return receipt;

    } catch (err) {
      proposal.status = 'failed';
      const reason = err instanceof Error ? err.message : String(err);
      const receipt = this.createReceipt(proposal, 'apply', 'failure', reason);
      this.logger.error('Governance action failed', { proposalId, error: reason });
      return receipt;
    }
  }

  /**
   * Step 4: Verify that a previously applied action completed correctly.
   */
  verify(proposalId: string): GovernanceReceipt {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'applied') {
      throw new Error(`Cannot verify proposal in status: ${proposal.status} (must be applied)`);
    }

    proposal.status = 'verifying';

    // Basic verification: action was applied and we have receipts
    const applyReceipts = this.receipts.filter(
      r => r.proposalId === proposalId && r.phase === 'apply',
    );

    if (applyReceipts.length === 0 || applyReceipts.some(r => r.result === 'failure')) {
      proposal.status = 'failed';
      return this.createReceipt(proposal, 'verify', 'failure', 'No successful apply receipt found');
    }

    proposal.status = 'verified';
    proposal.verifiedAt = new Date().toISOString();
    return this.createReceipt(proposal, 'verify', 'success', 'Action verified — apply receipt confirms success');
  }

  /**
   * Step 5: Rollback an applied/failed action.
   */
  async rollback(proposalId: string): Promise<GovernanceReceipt> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'applied' && proposal.status !== 'failed') {
      throw new Error(`Cannot rollback proposal in status: ${proposal.status}`);
    }

    if (!proposal.rollbackPlan.reversible) {
      return this.createReceipt(proposal, 'rollback', 'failure', 'Action is irreversible — rollback not possible');
    }

    try {
      switch (proposal.rollbackPlan.strategy) {
        case 'git-revert': {
          if (!this.selfmod) throw new Error('SelfModManager not configured for rollback');
          // Find the mod record from apply receipts
          const applyReceipt = this.receipts.find(
            r => r.proposalId === proposalId && r.phase === 'apply' && r.result === 'success',
          );
          if (applyReceipt?.relatedIds?.modRecordId) {
            const success = await this.selfmod.rollback(applyReceipt.relatedIds.modRecordId);
            if (!success) throw new Error('Git rollback failed');
          }
          break;
        }
        case 'terminate-child': {
          const applyReceipt = this.receipts.find(
            r => r.proposalId === proposalId && r.phase === 'apply' && r.result === 'success',
          );
          // Round 16.5: Route through LineageService when available
          if (this.lineage && applyReceipt?.relatedIds?.lineageRecordId) {
            await this.lineage.terminateChild(
              applyReceipt.relatedIds.lineageRecordId,
              'Governance rollback',
              'governance',
            );
          } else if (this.multiagent && applyReceipt?.relatedIds?.childId) {
            await this.multiagent.terminate(applyReceipt.relatedIds.childId, true);
          } else {
            throw new Error('Neither LineageService nor MultiAgentManager configured for rollback');
          }
          break;
        }
      }

      proposal.status = 'rolled_back';
      proposal.rolledBackAt = new Date().toISOString();
      const receipt = this.createReceipt(proposal, 'rollback', 'success', `Rolled back via ${proposal.rollbackPlan.strategy}`);
      this.logger.info('Governance action rolled back', { proposalId });
      return receipt;

    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return this.createReceipt(proposal, 'rollback', 'failure', `Rollback failed: ${reason}`);
    }
  }

  /**
   * Force-approve an escalated proposal (e.g. by creator).
   */
  forceApprove(proposalId: string): GovernanceDecision {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'escalated') {
      throw new Error(`Cannot force-approve proposal in status: ${proposal.status}`);
    }
    return this.approveProposal(proposal);
  }

  /**
   * Force-deny an escalated proposal (e.g. by creator).
   */
  forceDeny(proposalId: string, reason: string): GovernanceDecision {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'escalated') {
      throw new Error(`Cannot force-deny proposal in status: ${proposal.status}`);
    }
    return this.denyProposal(proposal, 'approval_missing', reason);
  }

  // ── Queries ─────────────────────────────────────────────────────────

  getProposal(id: string): GovernanceProposal | undefined {
    return this.proposals.get(id);
  }

  listProposals(filter?: { status?: GovernanceStatus; actionKind?: GovernanceActionKind }): GovernanceProposal[] {
    let results = Array.from(this.proposals.values());
    if (filter?.status) results = results.filter(p => p.status === filter.status);
    if (filter?.actionKind) results = results.filter(p => p.actionKind === filter.actionKind);
    return results;
  }

  getReceipts(proposalId: string): GovernanceReceipt[] {
    return this.receipts.filter(r => r.proposalId === proposalId);
  }

  allReceipts(): readonly GovernanceReceipt[] {
    return this.receipts;
  }

  get proposalCount(): number {
    return this.proposals.size;
  }

  // ── Diagnostics ─────────────────────────────────────────────────────

  /**
   * Runtime governance diagnostics — proposal/receipt counts, rates, and breakdowns.
   */
  diagnostics(): GovernanceDiagnostics {
    const proposals = Array.from(this.proposals.values());

    // Count proposals by status
    const proposalsByStatus: Record<string, number> = {};
    const proposalsByKind: Record<string, number> = {};
    for (const p of proposals) {
      proposalsByStatus[p.status] = (proposalsByStatus[p.status] ?? 0) + 1;
      proposalsByKind[p.actionKind] = (proposalsByKind[p.actionKind] ?? 0) + 1;
    }

    // Count receipts by phase
    const receiptsByPhase: Record<string, number> = {};
    for (const r of this.receipts) {
      receiptsByPhase[r.phase] = (receiptsByPhase[r.phase] ?? 0) + 1;
    }

    // Decision counts
    const decisions = proposals.filter(p => p.decision);
    const approved = decisions.filter(p => p.decision === 'auto_approved').length;
    const denied = decisions.filter(p => p.decision === 'denied').length;
    const escalated = decisions.filter(p => p.decision === 'escalated').length;
    const total = decisions.length || 1; // avoid division by zero

    return {
      totalProposals: proposals.length,
      totalReceipts: this.receipts.length,
      proposalsByStatus,
      proposalsByKind,
      receiptsByPhase,
      approvalRate: approved / total,
      denialRate: denied / total,
      escalationRate: escalated / total,
      rollbackCount: proposals.filter(p => p.status === 'rolled_back').length,
      legacyBypassCount: 0, // governed-by-default: no legacy bypasses
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  private approveProposal(proposal: GovernanceProposal): GovernanceDecision {
    proposal.status = 'approved';
    proposal.decision = 'auto_approved';
    proposal.decidedAt = new Date().toISOString();
    this.createReceipt(proposal, 'decision', 'success', 'Auto-approved by governance evaluation chain');
    this.logger.info('Proposal auto-approved', { id: proposal.id });
    return 'auto_approved';
  }

  private denyProposal(
    proposal: GovernanceProposal,
    layer: GovernanceDenialLayer,
    reason: string,
  ): GovernanceDecision {
    proposal.status = 'denied';
    proposal.decision = 'denied';
    proposal.denialLayer = layer;
    proposal.denialReason = reason;
    proposal.decidedAt = new Date().toISOString();
    this.createReceipt(proposal, 'decision', 'failure', `Denied by ${layer}: ${reason}`);
    this.logger.warn('Proposal denied', { id: proposal.id, layer, reason });
    return 'denied';
  }

  private escalateProposal(proposal: GovernanceProposal, reason: string): GovernanceDecision {
    proposal.status = 'escalated';
    proposal.decision = 'escalated';
    proposal.decidedAt = new Date().toISOString();
    this.createReceipt(proposal, 'decision', 'success', `Escalated: ${reason}`);
    this.logger.info('Proposal escalated', { id: proposal.id, reason });
    return 'escalated';
  }

  private createReceipt(
    proposal: GovernanceProposal,
    phase: GovernanceReceiptPhase,
    result: 'success' | 'failure',
    reason: string,
    relatedIds?: GovernanceReceipt['relatedIds'],
  ): GovernanceReceipt {
    const receipt: GovernanceReceipt = {
      id: `rcpt_${Date.now()}_${this.receipts.length}`,
      proposalId: proposal.id,
      phase,
      actorIdentityId: proposal.initiator.identityId,
      actionKind: proposal.actionKind,
      result,
      reason,
      timestamp: new Date().toISOString(),
      relatedIds,
    };
    this.receipts.push(receipt);
    return receipt;
  }

  private generateRollbackSteps(actionKind: GovernanceActionKind, strategy: string): string[] {
    switch (strategy) {
      case 'git-revert':
        return ['Locate modification record', 'Execute git revert on commit', 'Verify file restored'];
      case 'terminate-child':
        return ['Locate child agent by ID', 'Cascade terminate child and its descendants', 'Clean up workspace'];
      case 'irreversible':
        return ['Action is irreversible — no rollback steps available'];
      default:
        return ['Unknown rollback strategy'];
    }
  }
}
