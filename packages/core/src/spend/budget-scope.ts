/**
 * Round 15.5 — Budget Scope Evaluation
 *
 * Pure functions that evaluate spend against budget limits per scope.
 * Each scope is independent; the evaluator combines results.
 */
import type { SpendRecord } from './index.js';
import type { BudgetScopeId, BudgetScopeResult } from './governance-types.js';
import { THRESHOLDS } from './governance-types.js';

// ── Scope Configs ─────────────────────────────────────────────────────

export interface BudgetScopeConfig {
  /** Scope identifier */
  scope: BudgetScopeId;
  /** Budget limit in cents */
  limitCents: number;
  /** Whether this scope is enabled */
  enabled: boolean;
}

export interface ScopeEvalContext {
  /** All spend records to evaluate against */
  records: SpendRecord[];
  /** Current turn ID (for turn scope filtering) */
  turnId?: string;
  /** Current session ID (for session scope filtering) */
  sessionId?: string;
  /** Override "now" for testability */
  now?: number;
}

// ── Default Scope Configs ─────────────────────────────────────────────

export const DEFAULT_SCOPE_CONFIGS: BudgetScopeConfig[] = [
  { scope: 'turn', limitCents: 200, enabled: true },      // $2 per turn
  { scope: 'session', limitCents: 2_000, enabled: true },  // $20 per session
  { scope: 'hourly', limitCents: 2_000, enabled: true },   // $20 per hour
  { scope: 'daily', limitCents: 10_000, enabled: true },   // $100 per day
];

// ── Scope Evaluator ───────────────────────────────────────────────────

/**
 * Evaluate all budget scopes against current spend records.
 * Returns one BudgetScopeResult per enabled scope.
 */
export function evaluateScopes(
  configs: BudgetScopeConfig[],
  ctx: ScopeEvalContext,
): BudgetScopeResult[] {
  const now = ctx.now ?? Date.now();
  const results: BudgetScopeResult[] = [];

  for (const config of configs) {
    if (!config.enabled) continue;

    const spentCents = sumSpendForScope(config.scope, ctx.records, now, ctx.turnId, ctx.sessionId);
    const utilization = config.limitCents > 0 ? spentCents / config.limitCents : 0;
    const violationThreshold = THRESHOLDS.CAUTION_UTILIZATION; // first threshold

    results.push({
      scope: config.scope,
      utilization: Math.round(utilization * 1000) / 1000,
      spentCents,
      limitCents: config.limitCents,
      violated: utilization >= violationThreshold,
      violationThreshold,
    });
  }

  return results;
}

// ── Internal: Sum spend for a specific scope ──────────────────────────

function sumSpendForScope(
  scope: BudgetScopeId,
  records: SpendRecord[],
  now: number,
  turnId?: string,
  sessionId?: string,
): number {
  switch (scope) {
    case 'turn': {
      if (!turnId) return 0;
      // Turn scope: sum records whose description contains the turnId
      // (turn attribution is stored in description field by AgentLoop)
      return records
        .filter(r => r.description?.includes(turnId))
        .reduce((s, r) => s + r.costCents, 0);
    }
    case 'session': {
      if (!sessionId) return 0;
      // Session scope: records from same session
      // Session attribution stored in description or provider field
      return records
        .filter(r => r.description?.includes(sessionId) || r.provider === sessionId)
        .reduce((s, r) => s + r.costCents, 0);
    }
    case 'hourly': {
      const hourStart = now - 3_600_000;
      return records
        .filter(r => r.timestamp >= hourStart)
        .reduce((s, r) => s + r.costCents, 0);
    }
    case 'daily': {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      return records
        .filter(r => r.timestamp >= dayStart.getTime())
        .reduce((s, r) => s + r.costCents, 0);
    }
    default:
      return 0;
  }
}
