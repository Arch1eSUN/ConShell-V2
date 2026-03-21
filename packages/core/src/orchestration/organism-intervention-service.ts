/**
 * OrganismInterventionService — Round 20.7 → 20.8
 *
 * Canonical organism governance action system.
 *
 * Round 20.7: Ad-hoc intervention methods with flat records.
 * Round 20.8 G1: GovernanceAction contract + executeAction() canonical path
 * Round 20.8 G2: Lifecycle state machine (requested→executed→succeeded/failed/reverted/superseded/disputed)
 * Round 20.8 G3: Policy-coupled pre-flight via PolicyEngine.evaluate()
 *
 * Capabilities:
 * - overrideRouting: approve/deny next spawn for a specialization
 * - requeueChild: requeue a terminal child (creates commitment)
 * - holdChild: pause an active child session
 * - resumeChild: resume a paused child session
 * - repairSpendMisalignment: reconcile session↔lease spend discrepancy
 * - revertAction: revert a previously executed action
 * - supersedeAction: supersede an action with a new one
 * - disputeAction: dispute an action (requires resolution)
 */
import type { SessionRegistry } from './session-registry.js';
import type { SpecializationRouter } from './specialization-router.js';
import type { CommitmentStore } from '../agenda/commitment-store.js';
import type { PolicyEngine, PolicyResult, PolicyContext } from '../policy/index.js';
import { createCommitment } from '../agenda/commitment-model.js';

// ── Action Types ─────────────────────────────────────────────────────

export type GovernanceActionKind =
  | 'override_routing'
  | 'requeue_child'
  | 'hold_child'
  | 'resume_child'
  | 'repair_spend'
  | 'revert_action'
  | 'supersede_action'
  | 'dispute_action';

/** Round 20.8 G2: Full lifecycle states */
export type GovernanceActionStatus =
  | 'requested'
  | 'precondition_failed'
  | 'policy_denied'
  | 'executed'
  | 'succeeded'
  | 'failed'
  | 'reverted'
  | 'superseded'
  | 'disputed';

/** Round 20.8 G1: Precondition for action execution */
export interface ActionPrecondition {
  readonly description: string;
  readonly satisfied: boolean;
  readonly detail?: string;
}

/** Round 20.8 G1: Execution result with affected entities */
export interface ActionExecutionResult {
  readonly success: boolean;
  readonly affectedEntities: ReadonlyArray<{ id: string; type: string; change: string }>;
  readonly consequenceSummary: string;
}

/** Round 20.8 G1+G2: Canonical governance action */
export interface GovernanceAction {
  readonly id: string;
  readonly kind: GovernanceActionKind;
  readonly targetId: string;
  readonly reason: string;
  readonly operator: string;
  status: GovernanceActionStatus;
  readonly preconditions: readonly ActionPrecondition[];
  readonly policyResult?: PolicyResult;
  readonly executionResult?: ActionExecutionResult;
  /** G2: Link to the action this reverts/supersedes/disputes */
  readonly relatedActionId?: string;
  readonly requestedAt: string;
  executedAt?: string;
  resolvedAt?: string;
}

// ── Legacy compat types (still exported for 20.7 consumers) ──────────

export type InterventionKind = GovernanceActionKind;

export interface InterventionRecord {
  readonly id: string;
  readonly kind: InterventionKind;
  readonly targetId: string;
  readonly reason: string;
  readonly operator: string;
  readonly success: boolean;
  readonly detail: string;
  readonly timestamp: string;
}

export interface RoutingOverrideDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface InterventionSnapshot {
  readonly totalInterventions: number;
  readonly history: readonly InterventionRecord[];
  readonly byKind: Record<string, number>;
  readonly activeOverrides: ReadonlyMap<string, RoutingOverrideDecision>;
  /** Round 20.8: Full action history with lifecycle */
  readonly actions: readonly GovernanceAction[];
  readonly actionsByStatus: Record<string, number>;
}

// ── Valid lifecycle transitions (G2 state machine) ───────────────────

const VALID_TRANSITIONS: Record<GovernanceActionStatus, GovernanceActionStatus[]> = {
  requested:           ['precondition_failed', 'policy_denied', 'executed'],
  precondition_failed: [],  // terminal
  policy_denied:       [],  // terminal
  executed:            ['succeeded', 'failed'],
  succeeded:           ['reverted', 'superseded', 'disputed'],
  failed:              ['reverted', 'superseded'],
  reverted:            [],  // terminal
  superseded:          [],  // terminal
  disputed:            ['succeeded', 'reverted'],  // dispute resolution
};

/** Round 20.8 G3: Map action kind → policy tool name for PolicyEngine coupling */
const ACTION_POLICY_TOOL_MAP: Record<GovernanceActionKind, string> = {
  override_routing: 'organism_override',
  requeue_child:    'organism_requeue',
  hold_child:       'organism_hold',
  resume_child:     'organism_resume',
  repair_spend:     'organism_repair',
  revert_action:    'organism_revert',
  supersede_action: 'organism_supersede',
  dispute_action:   'organism_dispute',
};

// ── OrganismInterventionService ──────────────────────────────────────

export class OrganismInterventionService {
  private registry: SessionRegistry;
  private router: SpecializationRouter;
  private commitmentStore?: CommitmentStore;
  private policyEngine?: PolicyEngine;

  private _actions: GovernanceAction[] = [];
  /** Active routing overrides: specialization → decision */
  private _routingOverrides = new Map<string, RoutingOverrideDecision>();
  private _idCounter = 0;

  constructor(
    registry: SessionRegistry,
    router: SpecializationRouter,
    commitmentStore?: CommitmentStore,
    policyEngine?: PolicyEngine,
  ) {
    this.registry = registry;
    this.router = router;
    this.commitmentStore = commitmentStore;
    this.policyEngine = policyEngine;
  }

  // ── G1: Canonical Action Execution Path ────────────────────────────

  /**
   * Override routing for a specialization.
   * Next spawn with this specialization will be force-allowed or force-denied.
   */
  overrideRouting(
    specialization: string,
    decision: RoutingOverrideDecision,
    operator = 'operator',
  ): InterventionRecord {
    const action = this.executeAction({
      kind: 'override_routing',
      targetId: specialization,
      reason: `Override routing: ${decision.allowed ? 'ALLOW' : 'DENY'} — ${decision.reason}`,
      operator,
      preconditions: [],
      execute: () => {
        this._routingOverrides.set(specialization, decision);
        return {
          success: true,
          affectedEntities: [{ id: specialization, type: 'specialization', change: decision.allowed ? 'allowed' : 'denied' }],
          consequenceSummary: `Set routing override for '${specialization}': ${decision.allowed ? 'allowed' : 'denied'}`,
        };
      },
    });
    return this.actionToLegacyRecord(action);
  }

  /**
   * Check if there is an active routing override for a specialization.
   */
  getRoutingOverride(specialization: string): RoutingOverrideDecision | undefined {
    return this._routingOverrides.get(specialization);
  }

  /**
   * Requeue a terminal child session.
   * Creates a requeue commitment in the commitment store.
   */
  requeueChild(
    sessionId: string,
    reason: string,
    operator = 'operator',
  ): InterventionRecord {
    const session = this.registry.getSession(sessionId);

    const preconditions: ActionPrecondition[] = [
      {
        description: 'Session must exist',
        satisfied: !!session,
        detail: session ? `Found: ${session.name}` : 'Session not found',
      },
    ];

    if (session) {
      const isTerminal = session.status === 'completed' || session.status === 'failed' || session.status === 'recalled';
      preconditions.push({
        description: 'Session must be terminal',
        satisfied: isTerminal,
        detail: isTerminal ? `Terminal (${session.status})` : `Cannot requeue non-terminal session (status: ${session.status})`,
      });
    }

    const action = this.executeAction({
      kind: 'requeue_child',
      targetId: sessionId,
      reason,
      operator,
      preconditions,
      execute: () => {
        if (this.commitmentStore && session) {
          const commitment = createCommitment({
            name: `Requeue: ${session.manifest.task} [intervention]`,
            description: `Operator requeue of child ${sessionId}: ${reason}`,
            kind: 'delegation',
            origin: 'system',
            priority: 'normal',
            taskType: session.manifest.task,
            expectedValueCents: 0,
            estimatedCostCents: session.budgetCents,
            delegateChildId: sessionId,
          });
          this.commitmentStore!.add(commitment);
        }
        return {
          success: true,
          affectedEntities: [{ id: sessionId, type: 'session', change: `requeued (was: ${session!.status})` }],
          consequenceSummary: `Requeued terminal child (was: ${session!.status})`,
        };
      },
    });
    return this.actionToLegacyRecord(action);
  }

  /**
   * Hold (pause) an active child session.
   */
  holdChild(
    sessionId: string,
    reason = 'operator hold',
    operator = 'operator',
  ): InterventionRecord {
    const session = this.registry.getSession(sessionId);

    const preconditions: ActionPrecondition[] = [
      {
        description: 'Session must exist',
        satisfied: !!session,
        detail: session ? `Found: ${session.name}` : 'Session not found',
      },
    ];

    if (session) {
      preconditions.push({
        description: 'Session must be running',
        satisfied: session.status === 'running',
        detail: session.status === 'running' ? 'Running' : `Cannot hold session in status: ${session.status}`,
      });
    }

    const action = this.executeAction({
      kind: 'hold_child',
      targetId: sessionId,
      reason,
      operator,
      preconditions,
      execute: () => {
        session!.pause(reason);
        return {
          success: true,
          affectedEntities: [{ id: sessionId, type: 'session', change: 'paused' }],
          consequenceSummary: 'Session paused',
        };
      },
    });
    return this.actionToLegacyRecord(action);
  }

  /**
   * Repair spend misalignment between session and lease.
   */
  repairSpendMisalignment(
    sessionId: string,
    operator = 'operator',
  ): InterventionRecord {
    const session = this.registry.getSession(sessionId);

    const preconditions: ActionPrecondition[] = [
      {
        description: 'Session must exist',
        satisfied: !!session,
        detail: session ? `Found: ${session.name}` : 'Session not found',
      },
    ];

    if (session) {
      preconditions.push({
        description: 'Session must have canonical lease',
        satisfied: session.hasCanonicalSpendTruth,
        detail: session.hasCanonicalSpendTruth ? 'Has lease' : 'No canonical lease — no misalignment possible',
      });
    }

    const action = this.executeAction({
      kind: 'repair_spend',
      targetId: sessionId,
      reason: 'spend repair',
      operator,
      preconditions,
      execute: () => {
        return {
          success: true,
          affectedEntities: [{ id: sessionId, type: 'session', change: 'spend verified' }],
          consequenceSummary: `Spend verified: session.budgetUsedCents=${session!.budgetUsedCents} (canonical from lease)`,
        };
      },
    });
    return this.actionToLegacyRecord(action);
  }

  // ── G2: Lifecycle Operations ───────────────────────────────────────

  /**
   * Revert a previously succeeded action.
   * Creates a compensation action and marks original as 'reverted'.
   */
  revertAction(actionId: string, reason: string, operator = 'operator'): GovernanceAction {
    const original = this._actions.find(a => a.id === actionId);
    if (!original) {
      return this.executeAction({
        kind: 'revert_action',
        targetId: actionId,
        reason,
        operator,
        preconditions: [{ description: 'Original action must exist', satisfied: false, detail: 'Action not found' }],
        execute: () => ({ success: false, affectedEntities: [], consequenceSummary: 'Action not found' }),
      });
    }

    const canRevert = original.status === 'succeeded' || original.status === 'failed';
    const revertAction = this.executeAction({
      kind: 'revert_action',
      targetId: actionId,
      reason,
      operator,
      relatedActionId: actionId,
      preconditions: [
        { description: 'Original action must exist', satisfied: true },
        { description: 'Original must be in revertible state', satisfied: canRevert, detail: canRevert ? `Status: ${original.status}` : `Cannot revert action in status: ${original.status}` },
      ],
      execute: () => {
        // Undo routing override if applicable
        if (original.kind === 'override_routing') {
          this._routingOverrides.delete(original.targetId);
        }
        // Transition original to reverted
        this.transitionStatus(original, 'reverted');
        return {
          success: true,
          affectedEntities: [{ id: actionId, type: 'action', change: 'reverted' }],
          consequenceSummary: `Reverted action ${actionId} (${original.kind})`,
        };
      },
    });
    return revertAction;
  }

  /**
   * Supersede an action with a new replacement action.
   * Marks original as 'superseded', returns the new action.
   */
  supersedeAction(
    actionId: string,
    newActionKind: GovernanceActionKind,
    newTargetId: string,
    reason: string,
    operator = 'operator',
  ): GovernanceAction {
    const original = this._actions.find(a => a.id === actionId);
    const canSupersede = original && (original.status === 'succeeded' || original.status === 'failed');

    return this.executeAction({
      kind: 'supersede_action',
      targetId: newTargetId,
      reason,
      operator,
      relatedActionId: actionId,
      preconditions: [
        { description: 'Original action must exist', satisfied: !!original, detail: original ? `Found: ${original.kind}` : 'Action not found' },
        { description: 'Original must be in supersedeable state', satisfied: !!canSupersede, detail: canSupersede ? `Status: ${original!.status}` : `Cannot supersede` },
      ],
      execute: () => {
        this.transitionStatus(original!, 'superseded');
        return {
          success: true,
          affectedEntities: [
            { id: actionId, type: 'action', change: 'superseded' },
            { id: newTargetId, type: original!.kind === 'override_routing' ? 'specialization' : 'session', change: `superseded by new ${newActionKind}` },
          ],
          consequenceSummary: `Superseded action ${actionId} with new ${newActionKind} on ${newTargetId}`,
        };
      },
    });
  }

  /**
   * Dispute an action. Marks it as 'disputed' pending resolution.
   */
  disputeAction(actionId: string, reason: string, operator = 'operator'): GovernanceAction {
    const original = this._actions.find(a => a.id === actionId);
    const canDispute = original && original.status === 'succeeded';

    return this.executeAction({
      kind: 'dispute_action',
      targetId: actionId,
      reason,
      operator,
      relatedActionId: actionId,
      preconditions: [
        { description: 'Original action must exist', satisfied: !!original, detail: original ? `Found: ${original.kind}` : 'Action not found' },
        { description: 'Original must be succeeded', satisfied: !!canDispute, detail: canDispute ? 'Succeeded' : `Cannot dispute action in status: ${original?.status ?? 'unknown'}` },
      ],
      execute: () => {
        this.transitionStatus(original!, 'disputed');
        return {
          success: true,
          affectedEntities: [{ id: actionId, type: 'action', change: 'disputed' }],
          consequenceSummary: `Disputed action ${actionId}: ${reason}`,
        };
      },
    });
  }

  // ── Snapshot ────────────────────────────────────────────────────────

  interventionSnapshot(): InterventionSnapshot {
    const byKind: Record<string, number> = {};
    const actionsByStatus: Record<string, number> = {};

    for (const a of this._actions) {
      byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
      actionsByStatus[a.status] = (actionsByStatus[a.status] ?? 0) + 1;
    }

    return {
      totalInterventions: this._actions.length,
      history: this._actions.map(a => this.actionToLegacyRecord(a)),
      byKind,
      activeOverrides: new Map(this._routingOverrides),
      actions: [...this._actions],
      actionsByStatus,
    };
  }

  /** Get a specific action by ID */
  getAction(actionId: string): GovernanceAction | undefined {
    return this._actions.find(a => a.id === actionId);
  }

  /** Get all actions for the full action history */
  listActions(): readonly GovernanceAction[] {
    return [...this._actions];
  }

  // ── G1: Canonical executeAction() ──────────────────────────────────

  private executeAction(opts: {
    kind: GovernanceActionKind;
    targetId: string;
    reason: string;
    operator: string;
    preconditions: ActionPrecondition[];
    relatedActionId?: string;
    execute: () => ActionExecutionResult;
  }): GovernanceAction {
    const now = new Date().toISOString();
    const action: GovernanceAction = {
      id: `ga_${Date.now()}_${++this._idCounter}`,
      kind: opts.kind,
      targetId: opts.targetId,
      reason: opts.reason,
      operator: opts.operator,
      status: 'requested',
      preconditions: opts.preconditions,
      relatedActionId: opts.relatedActionId,
      requestedAt: now,
    };

    // Phase 1: Check preconditions
    const failedPrecondition = opts.preconditions.find(p => !p.satisfied);
    if (failedPrecondition) {
      (action as { status: GovernanceActionStatus }).status = 'precondition_failed';
      (action as { executionResult?: ActionExecutionResult }).executionResult = {
        success: false,
        affectedEntities: [],
        consequenceSummary: failedPrecondition.detail ?? failedPrecondition.description,
      };
      this._actions.push(action);
      return action;
    }

    // Phase 2: G3 — Policy pre-flight
    if (this.policyEngine) {
      const policyCtx: PolicyContext = {
        tool: ACTION_POLICY_TOOL_MAP[opts.kind],
        action: opts.kind,
        securityLevel: 'standard',
        dailyBudgetCents: 100_000,
        dailySpentCents: 0,
        constitutionAccepted: true,
        callerAuthority: opts.operator === 'creator' ? 'creator' : 'self',
      };
      const policyResult = this.policyEngine.evaluate(policyCtx);
      (action as { policyResult?: PolicyResult }).policyResult = policyResult;

      if (policyResult.decision === 'deny') {
        (action as { status: GovernanceActionStatus }).status = 'policy_denied';
        (action as { executionResult?: ActionExecutionResult }).executionResult = {
          success: false,
          affectedEntities: [],
          consequenceSummary: `Policy denied: ${policyResult.reason}`,
        };
        this._actions.push(action);
        return action;
      }
    }

    // Phase 3: Execute
    (action as { status: GovernanceActionStatus }).status = 'executed';
    (action as { executedAt?: string }).executedAt = new Date().toISOString();

    try {
      const result = opts.execute();
      (action as { executionResult?: ActionExecutionResult }).executionResult = result;
      (action as { status: GovernanceActionStatus }).status = result.success ? 'succeeded' : 'failed';
      (action as { resolvedAt?: string }).resolvedAt = new Date().toISOString();
    } catch (err) {
      (action as { executionResult?: ActionExecutionResult }).executionResult = {
        success: false,
        affectedEntities: [],
        consequenceSummary: `Execution error: ${err instanceof Error ? err.message : 'unknown'}`,
      };
      (action as { status: GovernanceActionStatus }).status = 'failed';
      (action as { resolvedAt?: string }).resolvedAt = new Date().toISOString();
    }

    this._actions.push(action);
    return action;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private transitionStatus(action: GovernanceAction, target: GovernanceActionStatus): void {
    const allowed = VALID_TRANSITIONS[action.status];
    if (!allowed?.includes(target)) {
      throw new Error(`Invalid action transition: ${action.status} → ${target}`);
    }
    (action as { status: GovernanceActionStatus }).status = target;
    (action as { resolvedAt?: string }).resolvedAt = new Date().toISOString();
  }

  /** Convert GovernanceAction to legacy InterventionRecord for backward compat */
  private actionToLegacyRecord(action: GovernanceAction): InterventionRecord {
    return {
      id: action.id,
      kind: action.kind,
      targetId: action.targetId,
      reason: action.reason,
      operator: action.operator,
      success: action.status === 'succeeded',
      detail: action.executionResult?.consequenceSummary ?? action.status,
      timestamp: action.requestedAt,
    };
  }
}
