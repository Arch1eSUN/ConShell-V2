/**
 * GovernanceService — Round 16.3 → 17.0
 *
 * Gateway-pattern canonical governance owner.
 * All high-risk actions (selfmod, replication, identity lifecycle)
 * MUST flow through this service.
 *
 * Flow: propose → evaluate (→ GovernanceVerdict) → apply → verify → (rollback if failed)
 *
 * Round 17.0:
 *   - evaluate() returns GovernanceVerdict (not bare GovernanceDecision)
 *   - GovernanceEconomicProvider for survival-aware Layer 3
 *   - Verdict constraints propagate through apply (replication/selfmod/dangerous_action)
 *
 * Evaluation unifies:
 *   1. Identity status (SovereignIdentityService)
 *   2. Policy rules (PolicyEngine)
 *   3. Economic state + survival tier (GovernanceEconomicProvider)
 *   4. Risk level + rollback strategy
 */
import type { Logger } from '../types/common.js';
import type { PolicyEngine, PolicyContext, PolicyResult } from '../policy/index.js';
import type { SelfModManager, ModificationRecord } from '../selfmod/index.js';
import type { MultiAgentManager, SpawnRequest, ChildAgent } from '../multiagent/index.js';
import type { LineageService, ChildRuntimeSpec } from '../lineage/index.js';
import type { CollectiveService } from '../collective/index.js';
import type { GovernedSelfModGate } from '../selfmod/governed-selfmod-gate.js';
import type { SovereignIdentityStatus } from '../identity/sovereign-identity-contract.js';
import {
  type GovernanceActionKind,
  type GovernanceRiskLevel,
  type GovernanceDenialLayer,
  type GovernanceStatus,
  type GovernanceProposal,
  type GovernanceReceipt,
  type GovernanceReceiptPhase,
  type GovernanceActor,
  type GovernanceTraceEntry,
  type RollbackPlan,
  type ProposalInput,
  type GovernanceDiagnostics,
  ACTION_RISK_MAP,
  ACTION_ROLLBACK_MAP,
  isValidStatusTransition,
  TERMINAL_STATUSES,
} from './governance-contract.js';
import type {
  GovernanceVerdict,
  VerdictCode,
  VerdictConstraint,
  VerdictSurvivalContext,
} from './governance-verdict.js';
import { isExecutableVerdict } from './governance-verdict.js';
import type { GovernanceEconomicProvider } from './governance-economic-provider.js';
import { NullEconomicProvider } from './governance-economic-provider.js';
import type { DelegationScope } from './delegation-scope.js';
import { createDelegationScope } from './delegation-scope.js';
import { DELEGATION_BLOCKED_STATUSES } from '../collective/collective-contract.js';
import type { LineageBranchControl } from '../lineage/branch-control.js';

// Re-export contract types
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
  ProposalInput,
  GovernanceDiagnostics,
};
export type { GovernanceVerdict, VerdictCode, VerdictConstraint };
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
  /** Branch control (optional — quarantine/revoke lineage branches, Round 18.7) */
  branchControl?: LineageBranchControl;
  /** Round 17.0: Economic/survival provider */
  economic?: GovernanceEconomicProvider;
  /** Round 19.3: GovernedSelfModGate for lifecycle control */
  selfModGate?: GovernedSelfModGate;
  /** Logger */
  logger: Logger;
  /** Default actor origin */
  defaultOrigin?: GovernanceActor['origin'];
}

// ── GovernanceService ──────────────────────────────────────────────────

export class GovernanceService {
  private proposals = new Map<string, GovernanceProposal>();
  private receipts: GovernanceReceipt[] = [];
  private verdicts = new Map<string, GovernanceVerdict>();
  /** Active delegation scopes by peerId (Round 17.2) */
  private activeDelegations = new Map<string, DelegationScope>();
  private identity: GovernanceIdentityProvider;
  private policy: GovernancePolicyProvider;
  private economic: GovernanceEconomicProvider;
  private selfmod?: SelfModManager;
  private multiagent?: MultiAgentManager;
  private lineage?: LineageService;
  private collective?: CollectiveService;
  private branchControl?: LineageBranchControl;
  private selfModGate?: GovernedSelfModGate;
  private logger: Logger;
  private defaultOrigin: GovernanceActor['origin'];
  private idCounter = 0;
  private verdictCounter = 0;

  constructor(opts: GovernanceServiceOptions) {
    this.identity = opts.identity;
    this.policy = opts.policy;
    this.economic = opts.economic ?? new NullEconomicProvider();
    this.selfmod = opts.selfmod;
    this.multiagent = opts.multiagent;
    this.lineage = opts.lineage;
    this.collective = opts.collective;
    this.branchControl = opts.branchControl;
    this.selfModGate = opts.selfModGate;
    this.logger = opts.logger;
    this.defaultOrigin = opts.defaultOrigin ?? 'self';
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

    // Round 17.5 (G1): revoked identity → proposal_invalid (not throw)
    // Creates an auditable, observable rejection with initiation receipt
    if (identityStatus === 'revoked') {
      proposal.status = 'proposal_invalid';
      proposal.denialLayer = 'identity';
      proposal.denialReason = 'Identity is revoked — proposal initiation rejected';
      this.proposals.set(id, proposal);
      this.createReceipt(proposal, 'initiation', 'failure',
        'Proposal initiation rejected: identity is revoked');
      this.logger.warn('Proposal initiation rejected — identity revoked', {
        id, actionKind: input.actionKind, target: input.target,
      });
      return proposal;
    }

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
   * Identity → Policy → Economy/Survival → Risk escalation.
   *
   * Round 17.0: Returns GovernanceVerdict (rich, structured) instead of bare GovernanceDecision.
   * Legacy decision is still set on proposal for backward compat.
   */
  evaluate(proposalId: string): GovernanceVerdict {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (!isValidStatusTransition(proposal.status, 'evaluating')) {
      throw new Error(`Cannot evaluate proposal in status: ${proposal.status}`);
    }

    proposal.status = 'evaluating';
    proposal.evaluatedAt = new Date().toISOString();

    // Capture survival context snapshot
    const survivalContext = this.captureSurvivalContext();

    // ── Layer 1: Identity check ──
    const idStatus = proposal.initiator.identityStatus;
    if (idStatus === 'revoked') {
      return this.buildVerdict(proposal, 'deny', 'identity', 'Identity is revoked — all governance actions denied', survivalContext);
    }
    if (idStatus === 'degraded' && (proposal.riskLevel === 'critical' || proposal.riskLevel === 'high')) {
      return this.buildVerdict(proposal, 'deny', 'identity', `Degraded identity cannot perform ${proposal.riskLevel}-risk actions`, survivalContext);
    }

    // ── Layer 2: Policy check ──
    const policyCtx: PolicyContext = {
      tool: proposal.actionKind,
      action: proposal.actionKind,
      costCents: proposal.expectedCostCents,
      securityLevel: 'standard' as any,
      dailyBudgetCents: 0,
      dailySpentCents: 0,
      constitutionAccepted: true,
      identityStatus: idStatus,
      callerAuthority: proposal.initiator.origin === 'creator' ? 'creator' : 'self',
    };

    const policyResult = this.policy.evaluate(policyCtx);
    if (policyResult.decision === 'deny') {
      return this.buildVerdict(proposal, 'deny', 'policy', `Policy denied: ${policyResult.rule} — ${policyResult.reason}`, survivalContext);
    }

    // ── Layer 3: Economy + Survival check (Round 17.0) ──
    const tier = this.economic.survivalTier();
    const isEmergency = this.economic.isEmergency();

    // Terminal/dead survival tier → deny all non-survival actions
    const tierStr = tier as string;
    if (tierStr === 'terminal' || tierStr === 'dead') {
      return this.buildVerdict(proposal, 'deny', 'economy',
        `Survival tier is '${tier}' — all non-survival actions denied`, survivalContext,
        [`survival_tier_${tier}`],
      );
    }

    // Emergency → deny all non-essential actions
    if (isEmergency && proposal.actionKind !== 'identity_rotation') {
      return this.buildVerdict(proposal, 'deny', 'economy',
        'System is in emergency survival mode — only essential actions permitted', survivalContext,
        ['emergency_mode'],
      );
    }

    // Cost check via economic provider
    if (proposal.expectedCostCents > 0) {
      const econ = this.economic.canAcceptAction(proposal.expectedCostCents, false);
      if (!econ.allowed) {
        return this.buildVerdict(proposal, 'deny', 'economy', econ.reason, survivalContext,
          ['budget_insufficient'],
        );
      }
    }

    // Must-preserve → allow_with_constraints (time-bound, resource-limited)
    const constraints: VerdictConstraint[] = [];
    if (this.economic.mustPreserveActive()) {
      constraints.push({
        kind: 'time_limit',
        description: 'Must-preserve active — action is time-limited',
        value: { maxDurationMs: 300_000 }, // 5 minutes
      });
    }

    // Critical survival tier → constrain budget
    if (tier === 'critical' || tier === 'frugal') {
      constraints.push({
        kind: 'budget_cap',
        description: `Survival tier '${tier}' — budget constrained`,
        value: { capCents: Math.min(proposal.expectedCostCents, 10_00) },
      });
    }

    // ── Layer 4: Risk escalation ──
    // Irreversible + critical → require_review
    if (!proposal.rollbackPlan.reversible && proposal.riskLevel === 'critical') {
      return this.buildVerdict(proposal, 'require_review', 'risk',
        'Irreversible critical action requires creator approval', survivalContext,
        ['irreversible_critical'], constraints,
      );
    }

    // Policy escalation pass-through
    if (policyResult.decision === 'escalate') {
      return this.buildVerdict(proposal, 'require_review', 'policy',
        `Policy escalated: ${policyResult.rule}`, survivalContext,
        [`policy_${policyResult.rule}`], constraints,
      );
    }

    // ── Layer 5: Peer eligibility check for delegation actions (Round 17.2) ──
    const isDelegation = proposal.actionKind.startsWith('delegate_');
    if (isDelegation) {
      const delFields = proposal.payload?.['delegation'] as {
        targetPeerId?: string;
        taskDescription?: string;
        subDelegationRequested?: boolean;
      } | undefined;

      if (!delFields?.targetPeerId) {
        return this.buildVerdict(proposal, 'deny', 'policy',
          'Delegation proposal missing required targetPeerId', survivalContext,
          ['delegation_fields_missing'],
        );
      }

      // Check peer exists and is eligible
      if (this.collective) {
        const peer = this.collective.getPeer(delFields.targetPeerId);
        if (!peer) {
          return this.buildVerdict(proposal, 'deny', 'policy',
            `Target peer not found: ${delFields.targetPeerId}`, survivalContext,
            ['peer_not_found'],
          );
        }
        if ((DELEGATION_BLOCKED_STATUSES as readonly string[]).includes(peer.status)) {
          return this.buildVerdict(proposal, 'deny', 'policy',
            `Peer '${delFields.targetPeerId}' ineligible for delegation: status '${peer.status}'`, survivalContext,
            [`peer_status_${peer.status}`],
          );
        }
      }

      // Sub-delegation requires explicit escalation
      if (delFields.subDelegationRequested) {
        constraints.push({
          kind: 'delegation_restriction',
          description: 'Sub-delegation requested — requires explicit review',
          value: { subDelegationAllowed: true },
        });
      }
    }

    // ── All checks passed ──
    if (constraints.length > 0) {
      return this.buildVerdict(proposal, 'allow_with_constraints', null,
        'Approved with survival-driven constraints', survivalContext,
        [], constraints,
      );
    }

    return this.buildVerdict(proposal, 'allow', null,
      'Auto-approved by governance evaluation chain', survivalContext,
    );
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
          const proposed = await this.selfmod.propose(file, content, proposal.justification);
          this.selfmod.approve(proposed.id);
          const record = await this.selfmod.apply(proposed.id);
          // Round 18.7: Auto-verify after apply — rollback on failure
          try {
            this.selfmod.verify(record.id);
          } catch (verifyErr) {
            this.logger.warn('SelfMod verify failed, rolling back', { id: record.id, error: String(verifyErr) });
            await this.selfmod.rollback(record.id);
            throw new Error(`SelfMod verify failed: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`);
          }
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
          } else {
            // Round 18.7: Legacy multiagent.spawn fallback removed.
            // All replication MUST go through LineageService for full governance chain.
            throw new Error('LineageService not configured — replication requires canonical lineage path');
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
        case 'delegate_task':
        case 'delegate_selfmod':
        case 'delegate_dangerous_action': {
          // Round 17.2: Governance-controlled delegation execution
          const delPayload = proposal.payload?.['delegation'] as {
            targetPeerId: string; taskDescription: string; subDelegationRequested?: boolean;
            requestedScope?: { budgetCapCents?: number; allowSelfmod?: boolean; allowDangerousAction?: boolean; expiryMs?: number };
          };
          if (!delPayload?.targetPeerId) throw new Error('Delegation payload missing targetPeerId');

          const verdict = this.verdicts.get(proposalId);
          const scope = createDelegationScope({
            delegatorId: proposal.initiator.identityId,
            delegatedPeerId: delPayload.targetPeerId,
            taskScope: delPayload.taskDescription || proposal.justification,
            verdictId: verdict?.id ?? 'unknown',
            proposalId: proposal.id,
            subDelegationAllowed: delPayload.subDelegationRequested ?? false,
            budgetCapCents: delPayload.requestedScope?.budgetCapCents ?? proposal.expectedCostCents,
            allowSelfmod: proposal.actionKind === 'delegate_selfmod' ? (delPayload.requestedScope?.allowSelfmod ?? true) : false,
            allowDangerousAction: proposal.actionKind === 'delegate_dangerous_action' ? (delPayload.requestedScope?.allowDangerousAction ?? true) : false,
            expiryMs: delPayload.requestedScope?.expiryMs,
          });

          this.activeDelegations.set(delPayload.targetPeerId, scope);

          if (this.collective) {
            const receipt = this.collective.delegateTask(
              delPayload.targetPeerId,
              delPayload.taskDescription || proposal.justification,
              undefined,
              scope.delegationId,
              verdict?.id,
            );
            relatedIds = {
              delegatedPeerId: delPayload.targetPeerId,
              delegationScopeId: scope.delegationId,
            };
          } else {
            relatedIds = {
              delegatedPeerId: delPayload.targetPeerId,
              delegationScopeId: scope.delegationId,
            };
          }
          break;
        }
        case 'quarantine_branch':
        case 'revoke_branch': {
          // Round 18.7: Governance-controlled branch lifecycle via BranchControl
          if (!this.branchControl) throw new Error('BranchControl not configured — branch operations require LineageBranchControl');
          const targetRecordId = proposal.payload?.['recordId'] as string ?? proposal.target;
          const reason = proposal.justification;
          const bcVerdict = this.verdicts.get(proposalId);
          if (proposal.actionKind === 'quarantine_branch') {
            const bcReceipt = this.branchControl.quarantineBranch(targetRecordId, reason, bcVerdict?.id);
            relatedIds = { branchControlReceiptId: bcReceipt.timestamp, lineageRecordId: targetRecordId };
          } else {
            const bcReceipt = this.branchControl.revokeBranch(targetRecordId, reason, bcVerdict?.id);
            relatedIds = { branchControlReceiptId: bcReceipt.timestamp, lineageRecordId: targetRecordId };
          }
          break;
        }
        case 'restore_branch': {
          // Round 19.3: Governance-controlled branch restoration
          if (!this.branchControl) throw new Error('BranchControl not configured — restore requires LineageBranchControl');
          const restoreRecordId = proposal.payload?.['recordId'] as string ?? proposal.target;
          const restoreVerdict = this.verdicts.get(proposalId);
          const restoreReceipt = this.branchControl.restoreBranch(
            restoreRecordId,
            proposal.justification,
            restoreVerdict?.id,
          );
          relatedIds = { branchControlReceiptId: restoreReceipt.timestamp, lineageRecordId: restoreRecordId };
          break;
        }
        case 'pause_selfmod': {
          // Round 19.3: Governed self-modification lifecycle
          if (this.selfModGate) {
            this.selfModGate.pause();
            this.logger.info('GovernedSelfModGate PAUSED via governance action');
          }
          break;
        }
        case 'resume_selfmod': {
          if (this.selfModGate) {
            this.selfModGate.resume();
            this.logger.info('GovernedSelfModGate RESUMED via governance action');
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

      // Round 17.1: Wire verdictId into receipt, and executionReceiptId back into verdict
      const verdict = this.verdicts.get(proposalId);
      if (verdict) {
        if (!relatedIds) relatedIds = {};
        relatedIds.verdictId = verdict.id;
      }
      const receipt = this.createReceipt(proposal, 'apply', 'success', 'Action applied successfully', relatedIds);
      // Post-execution linkage: wire receipt ID and lineage ID back into verdict
      if (verdict) {
        verdict.executionReceiptId = receipt.id;
        if (relatedIds?.lineageRecordId) {
          verdict.lineageRecordId = relatedIds.lineageRecordId;
        }
      }
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
   * Round 17.1: Returns GovernanceVerdict instead of bare GovernanceDecision.
   */
  forceApprove(proposalId: string): GovernanceVerdict {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'escalated') {
      throw new Error(`Cannot force-approve proposal in status: ${proposal.status}`);
    }
    const survivalContext = this.captureSurvivalContext();
    return this.buildVerdict(proposal, 'allow', null,
      'Force-approved by creator/admin', survivalContext);
  }

  /**
   * Force-deny an escalated proposal (e.g. by creator).
   * Round 17.1: Returns GovernanceVerdict instead of bare GovernanceDecision.
   */
  forceDeny(proposalId: string, reason: string): GovernanceVerdict {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
    if (proposal.status !== 'escalated') {
      throw new Error(`Cannot force-deny proposal in status: ${proposal.status}`);
    }
    const survivalContext = this.captureSurvivalContext();
    return this.buildVerdict(proposal, 'deny', 'approval_missing',
      reason, survivalContext);
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

  /** Round 17.0: Retrieve a verdict by proposal ID */
  getVerdict(proposalId: string): GovernanceVerdict | undefined {
    return this.verdicts.get(proposalId);
  }

  /** Round 20.0: What-If Projection */
  whatIf(proposalId: string): any {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    // Generate a trial verdict without mutating
    const survivalContext = this.captureSurvivalContext();
    const currentBalance = this.economic.currentBalanceCents();
    const newBalance = currentBalance - proposal.expectedCostCents;
    
    // Very primitive projection model
    const resultingTier = newBalance < 1000 ? 'critical' : (survivalContext?.survivalTier ?? 'normal');
    
    let blockedOps = [];
    if (proposal.actionKind === 'replication') {
      blockedOps.push(`Locks ${proposal.expectedCostCents}¢ reserve tokens`);
      blockedOps.push('May delay background indexing due to concurrent operations limit');
    }

    return {
      proposalId,
      budgetImpactCents: -proposal.expectedCostCents,
      expectedRoiCents: 0, // In full implementation, pulled from proposal payload
      resultingBalanceCents: newBalance,
      resultingSurvivalTier: resultingTier,
      blockedWarnings: blockedOps,
      timestamp: new Date().toISOString()
    };
  }

  /** Round 17.0: Get all verdicts */
  allVerdicts(): readonly GovernanceVerdict[] {
    return Array.from(this.verdicts.values());
  }

  /**
   * Round 17.1: Get the full governance trace chain for a proposal.
   * Assembles: proposal → verdict → receipts → lineage → branch linkage.
   */
  getTraceChain(proposalId: string): GovernanceTraceEntry | undefined {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return undefined;

    const verdict = this.verdicts.get(proposalId);
    const receipts = this.receipts
      .filter(r => r.proposalId === proposalId)
      .map(r => ({
        id: r.id,
        phase: r.phase,
        result: r.result,
        verdictId: r.relatedIds?.verdictId,
        lineageRecordId: r.relatedIds?.lineageRecordId,
      }));

    // Find lineage record from apply receipt
    const applyReceipt = this.receipts.find(
      r => r.proposalId === proposalId && r.phase === 'apply' && r.result === 'success',
    );

    return {
      proposalId: proposal.id,
      actionKind: proposal.actionKind,
      status: proposal.status,
      verdictId: verdict?.id,
      verdictCode: verdict?.code,
      receipts,
      lineageRecordId: applyReceipt?.relatedIds?.lineageRecordId,
      branchControlReceiptId: undefined, // linked externally via branch-control
      timestamp: proposal.createdAt,
    };
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

    // Round 17.1: Count by verdict.code (primary) with legacy fallback
    const verdictsList = Array.from(this.verdicts.values());
    const approved = verdictsList.filter(v => v.code === 'allow' || v.code === 'allow_with_constraints').length;
    const denied = verdictsList.filter(v => v.code === 'deny').length;
    const escalated = verdictsList.filter(v => v.code === 'require_review').length;
    const total = verdictsList.length || 1; // avoid division by zero

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

  // ── Round 17.0: Verdict Builders ─────────────────────────────────────

  private buildVerdict(
    proposal: GovernanceProposal,
    code: VerdictCode,
    layer: GovernanceDenialLayer | null,
    reason: string,
    survivalContext: VerdictSurvivalContext | null,
    triggeredPolicies: string[] = [],
    constraints: VerdictConstraint[] = [],
  ): GovernanceVerdict {
    const verdictId = `vrd_${Date.now()}_${++this.verdictCounter}`;

    // Update proposal state
    proposal.decidedAt = new Date().toISOString();
    if (code === 'deny') {
      proposal.status = 'denied';
      proposal.denialLayer = layer ?? undefined;
      proposal.denialReason = reason;
    } else if (code === 'require_review') {
      proposal.status = 'escalated';
    } else {
      proposal.status = 'approved';
    }

    // Create receipt
    const receiptResult = code === 'deny' ? 'failure' : 'success';
    const receiptReason = layer ? `${code} by ${layer}: ${reason}` : `${code}: ${reason}`;
    this.createReceipt(proposal, 'decision', receiptResult as 'success' | 'failure', receiptReason);

    // Build verdict
    const verdict: GovernanceVerdict = {
      id: verdictId,
      proposalId: proposal.id,
      code,
      reason,
      triggeredPolicies,
      riskLevel: proposal.riskLevel,
      constraints,
      childCreationPermitted: code !== 'deny' && code !== 'rollback_required',
      rollbackEligible: proposal.rollbackPlan.reversible,
      survivalContext,
      timestamp: new Date().toISOString(),
    };

    this.verdicts.set(proposal.id, verdict);
    this.logger.info(`Governance verdict: ${code}`, { proposalId: proposal.id, verdictId, code, layer });
    return verdict;
  }

  private captureSurvivalContext(): VerdictSurvivalContext | null {
    try {
      return {
        survivalTier: this.economic.survivalTier() as string,
        isEmergency: this.economic.isEmergency(),
        mustPreserveActive: this.economic.mustPreserveActive(),
        balanceCents: this.economic.currentBalanceCents(),
      };
    } catch {
      return null;
    }
  }
}
