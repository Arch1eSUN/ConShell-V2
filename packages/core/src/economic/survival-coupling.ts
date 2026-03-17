/**
 * Round 15.7 — Survival State ↔ Runtime Coupling
 *
 * Enforces REAL constraints based on survival tier.
 * This is not advisory — in terminal/dead states, disallowed actions
 * are genuinely refused. The GovernanceOverride mechanism (from 15.5)
 * serves as the only safety valve (and it cannot bypass balance=0).
 *
 * "不要假装面对经济压力" — DevPrompt 15.7
 */
import type { SurvivalTier } from '../automaton/index.js';
import { MODEL_TIERS, CONTEXT_WINDOW_TIERS } from '../automaton/index.js';
import type { EconomicState } from './economic-state.js';
import { isEconomicEmergency, classifyHealth } from './economic-state.js';
import type { TaskAdmissionDecision, SurvivalGateExplain, AdmissionCode } from './control-surface-contracts.js';

// ── Survival Constraints ─────────────────────────────────────────────

export interface SurvivalConstraints {
  /** Models allowed at this tier */
  readonly allowedModels: readonly string[];
  /** Maximum context window tokens */
  readonly maxContextTokens: number;
  /** Features that are enabled at this tier */
  readonly enabledFeatures: ReadonlySet<string>;
  /** Whether child agent spawning is allowed */
  readonly canSpawnChild: boolean;
  /** Whether scheduled tasks are allowed */
  readonly canScheduleTasks: boolean;
  /** Whether media processing is allowed */
  readonly canProcessMedia: boolean;
  /** Maximum concurrent operations */
  readonly maxConcurrentOps: number;
}

// ── All Features ─────────────────────────────────────────────────────

const ALL_FEATURES = new Set([
  'inference', 'tool_execution', 'browser', 'media_processing',
  'child_spawn', 'scheduled_tasks', 'income_seek', 'replication',
]);

const ESSENTIAL_FEATURES = new Set([
  'inference', 'tool_execution', 'income_seek',
]);

const MINIMAL_FEATURES = new Set([
  'income_seek',
]);

// ── Tier Constraints Map ─────────────────────────────────────────────

export const TIER_CONSTRAINTS: Record<SurvivalTier, SurvivalConstraints> = {
  thriving: {
    allowedModels: MODEL_TIERS.thriving,
    maxContextTokens: CONTEXT_WINDOW_TIERS.thriving,
    enabledFeatures: ALL_FEATURES,
    canSpawnChild: true,
    canScheduleTasks: true,
    canProcessMedia: true,
    maxConcurrentOps: 10,
  },
  normal: {
    allowedModels: [...MODEL_TIERS.thriving, ...MODEL_TIERS.normal],
    maxContextTokens: CONTEXT_WINDOW_TIERS.normal,
    enabledFeatures: ALL_FEATURES,
    canSpawnChild: true,
    canScheduleTasks: true,
    canProcessMedia: true,
    maxConcurrentOps: 8,
  },
  frugal: {
    allowedModels: [...MODEL_TIERS.normal, ...MODEL_TIERS.frugal],
    maxContextTokens: CONTEXT_WINDOW_TIERS.frugal,
    enabledFeatures: new Set([
      'inference', 'tool_execution', 'browser',
      'scheduled_tasks', 'income_seek',
    ]),
    canSpawnChild: false,
    canScheduleTasks: true,
    canProcessMedia: false,
    maxConcurrentOps: 4,
  },
  critical: {
    allowedModels: MODEL_TIERS.critical,
    maxContextTokens: CONTEXT_WINDOW_TIERS.critical,
    enabledFeatures: ESSENTIAL_FEATURES,
    canSpawnChild: false,
    canScheduleTasks: false,
    canProcessMedia: false,
    maxConcurrentOps: 2,
  },
  terminal: {
    allowedModels: MODEL_TIERS.terminal,
    maxContextTokens: CONTEXT_WINDOW_TIERS.terminal,
    enabledFeatures: MINIMAL_FEATURES,
    canSpawnChild: false,
    canScheduleTasks: false,
    canProcessMedia: false,
    maxConcurrentOps: 1,
  },
  dead: {
    allowedModels: [],
    maxContextTokens: 0,
    enabledFeatures: new Set<string>(),
    canSpawnChild: false,
    canScheduleTasks: false,
    canProcessMedia: false,
    maxConcurrentOps: 0,
  },
};

// ── Enforcement Result ───────────────────────────────────────────────

export interface EnforcementResult {
  /** Whether the action is allowed */
  readonly allowed: boolean;
  /** If disallowed, the reason */
  readonly reason?: string;
  /** If the model was downgraded, the substitute model */
  readonly substitute?: string;
  /** The constraint tier that was applied */
  readonly enforcedTier: SurvivalTier;
}

// ── Survival Gate ────────────────────────────────────────────────────

export class SurvivalGate {
  /**
   * Check if a specific model is allowed at the given tier.
   * REAL ENFORCEMENT: returns false for disallowed models.
   */
  canInfer(model: string, tier: SurvivalTier): boolean {
    const constraints = TIER_CONSTRAINTS[tier];
    if (constraints.allowedModels.length === 0) return false;
    return constraints.allowedModels.includes(model);
  }

  /**
   * Get the effective model: if requested model is not allowed,
   * return the first allowed model as a substitute.
   */
  getEffectiveModel(requestedModel: string, tier: SurvivalTier): string | null {
    if (this.canInfer(requestedModel, tier)) return requestedModel;
    const constraints = TIER_CONSTRAINTS[tier];
    return constraints.allowedModels[0] ?? null;
  }

  /**
   * Check if executing a task with a given estimated cost is safe.
   * Refuses if the cost would push the agent into a worse survival state.
   */
  canExecuteTask(estimatedCostCents: number, state: EconomicState): boolean {
    // Dead agents can't do anything
    if (state.survivalTier === 'dead') return false;
    // If cost would reduce balance to 0, refuse
    if (state.balanceCents - estimatedCostCents <= 0) return false;
    // In terminal state, only allow very cheap tasks
    if (state.survivalTier === 'terminal' && estimatedCostCents > 10) return false;
    // In critical state, only allow affordable tasks
    if (state.survivalTier === 'critical' && estimatedCostCents > 100) return false;
    return true;
  }

  /**
   * Check if spawning a child agent is allowed.
   */
  canSpawnChild(state: EconomicState): boolean {
    return TIER_CONSTRAINTS[state.survivalTier].canSpawnChild;
  }

  /**
   * Check if a specific feature is enabled at the current tier.
   */
  isFeatureEnabled(feature: string, tier: SurvivalTier): boolean {
    return TIER_CONSTRAINTS[tier].enabledFeatures.has(feature);
  }

  /**
   * Unified enforcement entry point.
   * Checks all constraints and returns a structured result.
   */
  enforce(
    action: 'infer' | 'execute_task' | 'spawn_child' | 'use_feature' | 'accept_task' | 'background_work',
    state: EconomicState,
    params?: {
      model?: string;
      estimatedCost?: number;
      feature?: string;
      /** Round 16.9: accept_task params */
      revenueBearing?: boolean;
      mustPreserve?: boolean;
    },
  ): EnforcementResult {
    const tier = state.survivalTier;
    const constraints = TIER_CONSTRAINTS[tier];

    switch (action) {
      case 'infer': {
        const model = params?.model;
        if (!model) {
          return { allowed: false, reason: 'No model specified', enforcedTier: tier };
        }
        if (tier === 'dead') {
          return { allowed: false, reason: 'Agent is dead — no inference possible', enforcedTier: tier };
        }
        if (this.canInfer(model, tier)) {
          return { allowed: true, enforcedTier: tier };
        }
        const substitute = this.getEffectiveModel(model, tier);
        if (substitute) {
          return {
            allowed: false,
            reason: `Model '${model}' not allowed at tier '${tier}'. Use '${substitute}' instead.`,
            substitute,
            enforcedTier: tier,
          };
        }
        return { allowed: false, reason: `No models available at tier '${tier}'`, enforcedTier: tier };
      }

      case 'execute_task': {
        const cost = params?.estimatedCost ?? 0;
        if (this.canExecuteTask(cost, state)) {
          return { allowed: true, enforcedTier: tier };
        }
        if (tier === 'dead') {
          return { allowed: false, reason: 'Agent is dead — cannot execute tasks', enforcedTier: tier };
        }
        return {
          allowed: false,
          reason: `Task cost ${cost}¢ exceeds safe threshold at tier '${tier}' (balance: ${state.balanceCents}¢)`,
          enforcedTier: tier,
        };
      }

      case 'spawn_child': {
        if (constraints.canSpawnChild) {
          return { allowed: true, enforcedTier: tier };
        }
        return {
          allowed: false,
          reason: `Child spawning disabled at tier '${tier}'`,
          enforcedTier: tier,
        };
      }

      case 'use_feature': {
        const feature = params?.feature;
        if (!feature) {
          return { allowed: false, reason: 'No feature specified', enforcedTier: tier };
        }
        if (this.isFeatureEnabled(feature, tier)) {
          return { allowed: true, enforcedTier: tier };
        }
        return {
          allowed: false,
          reason: `Feature '${feature}' disabled at tier '${tier}'`,
          enforcedTier: tier,
        };
      }

      default:
        return { allowed: false, reason: `Unknown action: ${action as string}`, enforcedTier: tier };
    }
  }

  // ── Round 16.9: Task acceptance enforcement ──────────────────────────

  /**
   * Whether accepting a new task/commitment is allowed.
   * In survival pressure tiers, only revenue-bearing or mustPreserve
   * tasks are accepted — all others are rejected.
   */
  canAcceptTask(
    state: EconomicState,
    revenueBearing: boolean,
    mustPreserve: boolean,
  ): EnforcementResult {
    const tier = state.survivalTier;

    if (tier === 'dead') {
      return { allowed: false, reason: 'Agent is dead — cannot accept tasks', enforcedTier: tier };
    }

    if (tier === 'terminal') {
      if (!revenueBearing && !mustPreserve) {
        return {
          allowed: false,
          reason: 'Terminal tier: only revenue-bearing or must-preserve tasks accepted',
          enforcedTier: tier,
        };
      }
    }

    if (tier === 'critical') {
      if (!revenueBearing && !mustPreserve) {
        return {
          allowed: false,
          reason: 'Critical tier: only revenue-bearing or must-preserve tasks accepted',
          enforcedTier: tier,
        };
      }
    }

    return { allowed: true, enforcedTier: tier };
  }

  /**
   * Get the maximum allowed concurrent background operations for a tier.
   */
  backgroundWorkLimit(tier: SurvivalTier): number {
    return TIER_CONSTRAINTS[tier].maxConcurrentOps;
  }

  /**
   * Get the full constraints for a tier (for inspection/UI).
   */
  getConstraints(tier: SurvivalTier): SurvivalConstraints {
    return TIER_CONSTRAINTS[tier];
  }

  // ── Round 16.9.1: Structured admission decision ────────────────────

  /**
   * Like canAcceptTask() but returns a fully structured decision
   * suitable for control surface / dashboard / API consumers.
   */
  canAcceptTaskDetailed(
    state: EconomicState,
    revenueBearing: boolean,
    mustPreserve: boolean,
  ): TaskAdmissionDecision {
    const tier = state.survivalTier;
    const now = new Date().toISOString();
    const metrics = {
      balanceCents: state.balanceCents,
      burnRateCentsPerDay: state.burnRateCentsPerDay,
      runwayDays: state.survivalDays,
      tier,
    };

    const makeDecision = (
      allowed: boolean,
      code: AdmissionCode,
      message: string,
      rejectedTaskClass: TaskAdmissionDecision['rejectedTaskClass'],
      exemptionApplied: TaskAdmissionDecision['exemptionApplied'],
      recoveryCondition: string | null,
    ): TaskAdmissionDecision => ({
      allowed,
      code,
      message,
      blockingState: tier,
      allowedTaskClasses: this.getAllowedTaskClasses(tier),
      rejectedTaskClass,
      exemptionApplied,
      survivalMetrics: metrics,
      recoveryCondition,
      timestamp: now,
    });

    if (tier === 'dead') {
      return makeDecision(
        false, 'GATE_BLOCKED_DEAD',
        'Agent is dead — cannot accept tasks',
        'all', null,
        'Agent must be revived with sufficient balance',
      );
    }

    if (tier === 'terminal') {
      if (revenueBearing) {
        return makeDecision(true, 'GATE_EXEMPT_REVENUE',
          'Revenue-bearing task accepted under terminal exemption',
          null, 'revenue', null);
      }
      if (mustPreserve) {
        return makeDecision(true, 'GATE_EXEMPT_PRESERVE',
          'Must-preserve task accepted under terminal exemption',
          null, 'must-preserve', null);
      }
      return makeDecision(false, 'GATE_BLOCKED_TERMINAL',
        'Terminal tier: only revenue-bearing or must-preserve tasks accepted',
        'non-revenue', null,
        `Balance must recover above terminal threshold (current: ${metrics.balanceCents}¢)`);
    }

    if (tier === 'critical') {
      if (revenueBearing) {
        return makeDecision(true, 'GATE_EXEMPT_REVENUE',
          'Revenue-bearing task accepted under critical exemption',
          null, 'revenue', null);
      }
      if (mustPreserve) {
        return makeDecision(true, 'GATE_EXEMPT_PRESERVE',
          'Must-preserve task accepted under critical exemption',
          null, 'must-preserve', null);
      }
      return makeDecision(false, 'GATE_BLOCKED_CRITICAL',
        'Critical tier: only revenue-bearing or must-preserve tasks accepted',
        'non-revenue', null,
        `Balance must recover above critical threshold (current: ${metrics.balanceCents}¢)`);
    }

    return makeDecision(true, 'GATE_ALLOWED',
      'Task accepted — no survival restrictions active',
      null, null, null);
  }

  // ── Round 16.9.1: Gate policy explanation ──────────────────────────

  /**
   * Explain current gate policy state for control surface consumers.
   */
  explain(state: EconomicState): SurvivalGateExplain {
    const tier = state.survivalTier;
    const health = classifyHealth(state);
    const constraints = TIER_CONSTRAINTS[tier];

    let accepting: SurvivalGateExplain['accepting'];
    const restrictions: string[] = [];
    const activeExemptions: string[] = [];

    if (tier === 'dead') {
      accepting = 'none';
      restrictions.push('Agent is dead — all tasks blocked');
    } else if (tier === 'terminal' || tier === 'critical') {
      accepting = 'revenue-and-preserve-only';
      restrictions.push(`${tier} tier: non-revenue, non-preserve tasks blocked`);
      activeExemptions.push('Revenue-bearing tasks bypass gate');
      activeExemptions.push('Must-preserve tasks bypass gate');
      if (!constraints.canSpawnChild) restrictions.push('Child agent spawning disabled');
      if (!constraints.canScheduleTasks) restrictions.push('Scheduled tasks disabled');
      if (!constraints.canProcessMedia) restrictions.push('Media processing disabled');
    } else {
      accepting = 'all';
      if (tier === 'frugal') {
        restrictions.push('Frugal tier: model selection restricted');
        if (!constraints.canProcessMedia) restrictions.push('Media processing disabled');
      }
    }

    return {
      isOpen: accepting !== 'none',
      tier,
      health,
      accepting,
      restrictions,
      activeExemptions,
      backgroundWorkLimit: constraints.maxConcurrentOps,
      timestamp: new Date().toISOString(),
    };
  }

  private getAllowedTaskClasses(tier: SurvivalTier): string[] {
    if (tier === 'dead') return [];
    if (tier === 'terminal' || tier === 'critical') return ['revenue-bearing', 'must-preserve'];
    return ['all'];
  }
}
