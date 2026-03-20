/**
 * Round 15.7 — Value-Aware Task Routing
 *
 * Estimates task value (cost vs. revenue potential) and routes tasks
 * based on the agent's economic state. Under survival pressure, the
 * agent prioritizes revenue-generating tasks and rejects unprofitable ones.
 */
import type { EconomicState } from './economic-state.js';
import { classifyHealth } from './economic-state.js';
import type { TaskFeedbackHeuristic } from './task-feedback-heuristic.js';
import type { RuntimeMode } from './economic-policy.js';

// ── Task Value Types ─────────────────────────────────────────────────

export type TaskRiskLevel = 'safe' | 'marginal' | 'unprofitable';

export interface TaskValueEstimate {
  /** Task identifier */
  readonly taskId: string;
  /** Estimated cost to execute in cents */
  readonly estimatedCostCents: number;
  /** Estimated revenue if task completes in cents */
  readonly estimatedRevenueCents: number;
  /** Net value = revenue - cost */
  readonly netValue: number;
  /** Risk classification */
  readonly riskLevel: TaskRiskLevel;
  /** Confidence in estimate (0-1) */
  readonly confidence: number;
}

export interface RoutingDecision {
  /** Action to take */
  readonly action: 'accept' | 'reject' | 'defer' | 'downgrade';
  /** Reason for the decision */
  readonly reason: string;
  /** If downgraded, suggested cheaper model */
  readonly suggestedModel?: string;
  /** Priority score (higher = do first) */
  readonly priority: number;
}

// ── Task Type for Estimation ─────────────────────────────────────────

export interface TaskDescriptor {
  /** Unique task ID */
  id: string;
  /** Task type for cost estimation */
  type: 'inference' | 'tool_call' | 'browser' | 'media' | 'composite';
  /** Estimated complexity (1-10) */
  complexity: number;
  /** Whether this task generates revenue */
  isRevenueBearing: boolean;
  /** Expected revenue if revenue-bearing (cents) */
  expectedRevenueCents?: number;
  /** Requested model (if any) */
  requestedModel?: string;
}

// ── Cost Estimation Constants ────────────────────────────────────────

/**
 * Base cost per task type in cents.
 * These are rough estimates; real costs come from SpendTracker.
 */
const BASE_COSTS: Record<TaskDescriptor['type'], number> = {
  inference: 5,      // ~$0.05 per inference
  tool_call: 2,      // ~$0.02 per tool call
  browser: 10,       // ~$0.10 per browser action
  media: 20,         // ~$0.20 per media processing
  composite: 15,     // ~$0.15 per composite task
};

// ── Value Router ─────────────────────────────────────────────────────

export class ValueRouter {
  private readonly heuristic?: TaskFeedbackHeuristic;

  constructor(heuristic?: TaskFeedbackHeuristic) {
    this.heuristic = heuristic;
  }

  /**
   * Estimate the value of a task.
   */
  estimateTaskValue(task: TaskDescriptor): TaskValueEstimate {
    const baseCost = BASE_COSTS[task.type] ?? 5;
    const estimatedCostCents = Math.round(baseCost * task.complexity);
    const estimatedRevenueCents = task.isRevenueBearing
      ? (task.expectedRevenueCents ?? 0)
      : 0;
    const netValue = estimatedRevenueCents - estimatedCostCents;

    let riskLevel: TaskRiskLevel;
    if (netValue > 0) {
      riskLevel = 'safe';
    } else if (netValue >= -estimatedCostCents * 0.5) {
      riskLevel = 'marginal';
    } else {
      riskLevel = 'unprofitable';
    }

    // Confidence is lower for complex tasks
    const confidence = Math.max(0.3, 1 - (task.complexity * 0.08));

    return {
      taskId: task.id,
      estimatedCostCents,
      estimatedRevenueCents,
      netValue,
      riskLevel,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /**
   * Decide whether to accept a task given the economic state.
   */
  shouldAcceptTask(task: TaskDescriptor, state: EconomicState): boolean {
    const estimate = this.estimateTaskValue(task);
    const health = classifyHealth(state);

    switch (health) {
      case 'thriving':
      case 'stable':
        // Accept everything except clearly unprofitable tasks
        return estimate.riskLevel !== 'unprofitable';

      case 'stressed':
        // Only accept safe or revenue-bearing tasks
        return estimate.riskLevel === 'safe' || task.isRevenueBearing;

      case 'critical':
        // Only accept revenue-bearing tasks
        return task.isRevenueBearing && estimate.netValue > 0;

      case 'dying':
        // Only accept tasks that directly generate revenue
        return task.isRevenueBearing && estimate.netValue > 0;

      default:
        return false;
    }
  }

  /**
   * Get the base routing decision without heuristic adjustments.
   */
  private getBaseRoutingDecision(task: TaskDescriptor, state: EconomicState): RoutingDecision {
    const estimate = this.estimateTaskValue(task);
    const health = classifyHealth(state);

    // Dead → reject everything
    if (state.survivalTier === 'dead') {
      return {
        action: 'reject',
        reason: 'Agent is dead — cannot accept tasks',
        priority: 0,
      };
    }

    // Revenue-bearing tasks always get high priority
    if (task.isRevenueBearing && estimate.netValue > 0) {
      return {
        action: 'accept',
        reason: `Revenue-bearing task with net value +${estimate.netValue}¢`,
        priority: 100 + estimate.netValue,
      };
    }

    // Under stress, reject unprofitable tasks
    if ((health === 'critical' || health === 'dying') && estimate.riskLevel === 'unprofitable') {
      return {
        action: 'reject',
        reason: `Unprofitable task (net ${estimate.netValue}¢) rejected at health '${health}'`,
        priority: 0,
      };
    }

    // Under stress, defer marginal tasks
    if ((health === 'stressed' || health === 'critical') && estimate.riskLevel === 'marginal') {
      return {
        action: 'defer',
        reason: `Marginal task deferred — agent is ${health}`,
        priority: 10,
      };
    }

    // Expensive tasks can be downgraded to cheaper models
    if (estimate.estimatedCostCents > state.balanceCents * 0.1 && health !== 'thriving') {
      return {
        action: 'downgrade',
        reason: `Task cost (${estimate.estimatedCostCents}¢) is >10% of balance — suggesting cheaper execution`,
        suggestedModel: task.requestedModel ? undefined : undefined,
        priority: 30,
      };
    }

    // Default: accept
    return {
      action: 'accept',
      reason: 'Task within safe economic parameters',
      priority: 50 + estimate.netValue,
    };
  }

  /**
   * Get a full routing decision for a task, including mode-sensitive heuristic adjustments.
   */
  getRoutingDecision(task: TaskDescriptor, state: EconomicState, mode?: RuntimeMode): RoutingDecision {
    const base = this.getBaseRoutingDecision(task, state);
    
    if (!this.heuristic) {
      return base;
    }

    const adjustment = mode 
      ? this.heuristic.getPriorityAdjustmentForMode(task.type, task.id, task.isRevenueBearing, mode)
      : this.heuristic.getPriorityAdjustment(task.type, task.isRevenueBearing);

    if (adjustment === 0) {
      return base;
    }

    return {
      ...base,
      priority: base.priority + adjustment,
      reason: base.reason + ` (feedback adj: ${adjustment > 0 ? '+' : ''}${adjustment})`,
    };
  }

  /**
   * Sort and prioritize a list of tasks based on economic value.
   * Revenue-generating tasks first, then by net value.
   */
  prioritizeTasks(tasks: TaskDescriptor[], state: EconomicState, mode?: RuntimeMode): Array<{ task: TaskDescriptor; decision: RoutingDecision }> {
    return tasks
      .map(task => ({
        task,
        decision: this.getRoutingDecision(task, state, mode),
      }))
      .sort((a, b) => b.decision.priority - a.decision.priority);
  }
}
