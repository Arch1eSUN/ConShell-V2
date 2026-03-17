/**
 * EconomicPolicy — Lightweight runtime policy enforcement helper
 *
 * Centralized evaluation of whether an action is allowed under current
 * economic conditions. Produces structured PolicyDecision records and
 * maintains a ring-buffer decision audit trail.
 *
 * Round 15.8 — Task 3 + Task 6
 */
import type { SurvivalTier } from '../automaton/index.js';

// ── Types ─────────────────────────────────────────────────────────────

export type CostClass = 'low' | 'medium' | 'high';
export type ActionType = 'inference' | 'tool' | 'enqueue' | 'spawn_child' | 'background';
export type RuntimeMode = 'normal' | 'revenue-seeking' | 'survival-recovery' | 'shutdown';

export interface PolicyDecision {
  allowed: boolean;
  action: 'allow' | 'restrict' | 'block';
  reason?: string;
  /** Suggested cheaper alternative (model name, tool variant, etc.) */
  substitute?: string;
}

export interface DecisionRecord {
  timestamp: string;
  component: string;
  actionType: ActionType;
  decision: 'allow' | 'restrict' | 'block' | 'reprioritize';
  reason: string;
  tier: SurvivalTier;
  mode: RuntimeMode;
  /** Optional context (task id, tool name, model, etc.) */
  context?: string;
}

// ── RuntimeMode resolution ────────────────────────────────────────────

export function resolveRuntimeMode(tier: SurvivalTier): RuntimeMode {
  switch (tier) {
    case 'thriving':
    case 'normal':
      return 'normal';
    case 'frugal':
    case 'critical':
      return 'revenue-seeking';
    case 'terminal':
      return 'survival-recovery';
    case 'dead':
      return 'shutdown';
  }
}

// ── Cost-class → tier policy matrix ───────────────────────────────────

const POLICY_MATRIX: Record<CostClass, Record<SurvivalTier, PolicyDecision>> = {
  low: {
    thriving: { allowed: true, action: 'allow' },
    normal: { allowed: true, action: 'allow' },
    frugal: { allowed: true, action: 'allow' },
    critical: { allowed: true, action: 'allow' },
    terminal: { allowed: true, action: 'allow' },
    dead: { allowed: false, action: 'block', reason: 'Agent is dead — all operations blocked' },
  },
  medium: {
    thriving: { allowed: true, action: 'allow' },
    normal: { allowed: true, action: 'allow' },
    frugal: { allowed: true, action: 'allow' },
    critical: { allowed: true, action: 'restrict', reason: 'Critical tier — medium-cost actions restricted' },
    terminal: { allowed: false, action: 'block', reason: 'Terminal tier — medium-cost actions blocked' },
    dead: { allowed: false, action: 'block', reason: 'Agent is dead' },
  },
  high: {
    thriving: { allowed: true, action: 'allow' },
    normal: { allowed: true, action: 'allow' },
    frugal: { allowed: true, action: 'allow' },
    critical: { allowed: false, action: 'block', reason: 'Critical tier — high-cost actions blocked' },
    terminal: { allowed: false, action: 'block', reason: 'Terminal tier — high-cost actions blocked' },
    dead: { allowed: false, action: 'block', reason: 'Agent is dead' },
  },
};

// ── EconomicPolicy ────────────────────────────────────────────────────

export class EconomicPolicy {
  private trail: DecisionRecord[] = [];
  private maxTrailSize: number;

  constructor(maxTrailSize = 1000) {
    this.maxTrailSize = maxTrailSize;
  }

  /**
   * Evaluate whether an action is allowed under the given conditions.
   */
  evaluateAction(
    actionType: ActionType,
    costClass: CostClass,
    tier: SurvivalTier,
  ): PolicyDecision {
    return { ...POLICY_MATRIX[costClass][tier] };
  }

  /**
   * Evaluate and record the decision in the audit trail.
   */
  evaluateAndRecord(
    component: string,
    actionType: ActionType,
    costClass: CostClass,
    tier: SurvivalTier,
    context?: string,
  ): PolicyDecision {
    const decision = this.evaluateAction(actionType, costClass, tier);
    const mode = resolveRuntimeMode(tier);

    this.record({
      timestamp: new Date().toISOString(),
      component,
      actionType,
      decision: decision.action === 'allow' ? 'allow' : decision.action,
      reason: decision.reason ?? 'Allowed by policy',
      tier,
      mode,
      context,
    });

    return decision;
  }

  /**
   * Record a decision directly (for non-policy decisions like task routing).
   */
  record(entry: DecisionRecord): void {
    this.trail.push(entry);
    if (this.trail.length > this.maxTrailSize) {
      this.trail.shift();
    }
  }

  /**
   * Get recent decision records.
   */
  getTrail(limit?: number): readonly DecisionRecord[] {
    if (limit) return this.trail.slice(-limit);
    return this.trail;
  }

  /**
   * Get decisions by component.
   */
  getByComponent(component: string): DecisionRecord[] {
    return this.trail.filter(r => r.component === component);
  }

  /**
   * Get statistics.
   */
  stats(): { total: number; allows: number; restricts: number; blocks: number } {
    let allows = 0, restricts = 0, blocks = 0;
    for (const r of this.trail) {
      if (r.decision === 'allow') allows++;
      else if (r.decision === 'restrict') restricts++;
      else if (r.decision === 'block') blocks++;
    }
    return { total: this.trail.length, allows, restricts, blocks };
  }

  /** Clear trail */
  clear(): void {
    this.trail = [];
  }
}
