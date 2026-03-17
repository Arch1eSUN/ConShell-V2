/**
 * Round 15.5 — Governance Evaluator
 *
 * @deprecated Since Round 16.3. Economic governance evaluation is now unified
 * into GovernanceService (src/governance/governance-service.ts).
 * This file is retained for backward compatibility but should NOT be used
 * as the primary governance entry point.
 *
 * @legacy-adapter Adapted by GovernanceService evaluation chain (Layer 3: Economy).
 *
 * Original purpose: Consumes budget scope results + balance → emits PolicyDecision.
 * Separation: scope evaluation → level classification → reason codes →
 * action selection → override application → recovery check.
 */
import type {
  BudgetScopeResult,
  PressureLevel,
  PolicyDecision,
  ReasonCode,
  GovernanceOverride,
  GovernanceActionId,
} from './governance-types.js';
import {
  REASON_CODES,
  LEVEL_CONTRACTS,
  THRESHOLDS,
} from './governance-types.js';

// ── Evaluator Input ───────────────────────────────────────────────────

export interface EvaluatorInput {
  scopeResults: BudgetScopeResult[];
  balanceCents: number;
  balanceRemainingPct: number;
  override?: GovernanceOverride | null;
}

// ── Governance Evaluator ──────────────────────────────────────────────

export class GovernanceEvaluator {
  /**
   * Evaluate governance state and return a structured PolicyDecision.
   * This is the single convergence point for all governance logic.
   */
  evaluate(input: EvaluatorInput): PolicyDecision {
    const { scopeResults, balanceCents, balanceRemainingPct, override } = input;
    const now = new Date().toISOString();

    // 1. Collect reason codes from scope results + balance
    const reasonCodes: ReasonCode[] = [];
    const violatedScopes: string[] = [];

    for (const scope of scopeResults) {
      const codes = this.scopeReasonCodes(scope);
      reasonCodes.push(...codes);
      if (scope.violated) {
        violatedScopes.push(scope.scope);
      }
    }

    // Balance-based reason codes
    if (balanceCents <= 0) {
      reasonCodes.push(REASON_CODES.BALANCE_EXHAUSTED);
    } else if (balanceRemainingPct < THRESHOLDS.LOW_BALANCE_PCT) {
      reasonCodes.push(REASON_CODES.BALANCE_LOW);
    }

    // 2. Classify pressure level from worst scope utilization + balance
    const maxUtil = Math.max(...scopeResults.map(s => s.utilization), 0);
    let level = this.classifyLevel(maxUtil, balanceCents);

    // Add level-triggered reason codes
    if (level === 'degrade') reasonCodes.push(REASON_CODES.DEGRADE_POLICY_TRIGGERED);
    if (level === 'block') reasonCodes.push(REASON_CODES.BLOCK_POLICY_TRIGGERED);

    // 3. Apply override (if active and valid)
    let overrideSource: string | null = null;
    if (override && this.isOverrideValid(override, level, balanceCents)) {
      const overrideLevel = override.targetLevel;
      // Override can only reduce pressure, never increase
      if (this.levelSeverity(overrideLevel) < this.levelSeverity(level)) {
        level = overrideLevel;
        overrideSource = override.source;
        reasonCodes.push(REASON_CODES.OVERRIDE_ACTIVE);
      }
    }

    // 4. Check recovery (all scopes below recovery threshold)
    let recoveryHint: string | null = null;
    if (level === 'block' || level === 'degrade') {
      const allBelowRecovery = scopeResults.every(
        s => s.utilization < THRESHOLDS.RECOVERY_UTILIZATION,
      );
      if (allBelowRecovery && balanceCents > 0) {
        recoveryHint = 'All budget scopes below 50% utilization — recovery possible when time window advances';
        reasonCodes.push(REASON_CODES.RECOVERY_ACHIEVED);
        // Auto-recover: if all scopes are below recovery threshold, drop level
        level = 'allow';
      } else if (balanceCents <= 0) {
        recoveryHint = 'Balance exhausted — recovery requires income or budget increase';
      } else {
        const highScopes = scopeResults
          .filter(s => s.utilization >= THRESHOLDS.CAUTION_UTILIZATION)
          .map(s => `${s.scope}(${Math.round(s.utilization * 100)}%)`);
        recoveryHint = `Reduce spend in: ${highScopes.join(', ')} — or wait for time window to advance`;
      }
    }

    // 5. Get canonical action set from level contract
    const contract = LEVEL_CONTRACTS[level];

    // 6. Build explanation from reason codes
    const explanation = this.buildExplanation(level, reasonCodes, violatedScopes as any[]);

    return {
      level,
      reasonCodes,
      explanation,
      violatedScopes: violatedScopes as any[],
      selectedActions: [...contract.actions],
      maxIterationsCap: contract.maxIterationsCap,
      metricsSnapshot: {
        balanceCents,
        balanceRemainingPct: Math.round(balanceRemainingPct * 10) / 10,
        scopeResults,
      },
      recoveryHint,
      overrideable: contract.overrideable,
      overrideSource,
      decisionTimestamp: now,
    };
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private classifyLevel(maxUtil: number, balanceCents: number): PressureLevel {
    if (balanceCents <= 0 || maxUtil >= THRESHOLDS.BLOCK_UTILIZATION) return 'block';
    if (maxUtil >= THRESHOLDS.DEGRADE_UTILIZATION) return 'degrade';
    if (maxUtil >= THRESHOLDS.CAUTION_UTILIZATION) return 'caution';
    return 'allow';
  }

  private levelSeverity(level: PressureLevel): number {
    const map: Record<PressureLevel, number> = { allow: 0, caution: 1, degrade: 2, block: 3 };
    return map[level];
  }

  private isOverrideValid(
    override: GovernanceOverride,
    currentLevel: PressureLevel,
    balanceCents: number,
  ): boolean {
    // Override cannot bypass safety (balance = 0)
    if (balanceCents <= 0) return false;
    // Override must not be expired
    const expiresAt = new Date(override.expiresAt).getTime();
    if (Date.now() > expiresAt) return false;
    // Override bypassSafety must always be false
    if (override.bypassSafety !== false) return false;
    return true;
  }

  private scopeReasonCodes(scope: BudgetScopeResult): ReasonCode[] {
    const codes: ReasonCode[] = [];
    const { utilization } = scope;

    if (scope.scope === 'hourly') {
      if (utilization >= THRESHOLDS.BLOCK_UTILIZATION) codes.push(REASON_CODES.HOURLY_BUDGET_CRITICAL);
      else if (utilization >= THRESHOLDS.DEGRADE_UTILIZATION) codes.push(REASON_CODES.HOURLY_BUDGET_EXCEEDED);
      else if (utilization >= THRESHOLDS.CAUTION_UTILIZATION) codes.push(REASON_CODES.HOURLY_BUDGET_NEAR_LIMIT);
    } else if (scope.scope === 'daily') {
      if (utilization >= THRESHOLDS.BLOCK_UTILIZATION) codes.push(REASON_CODES.DAILY_BUDGET_CRITICAL);
      else if (utilization >= THRESHOLDS.DEGRADE_UTILIZATION) codes.push(REASON_CODES.DAILY_BUDGET_EXCEEDED);
      else if (utilization >= THRESHOLDS.CAUTION_UTILIZATION) codes.push(REASON_CODES.DAILY_BUDGET_NEAR_LIMIT);
    } else if (scope.scope === 'session') {
      if (utilization >= THRESHOLDS.DEGRADE_UTILIZATION) codes.push(REASON_CODES.SESSION_BUDGET_EXCEEDED);
      else if (utilization >= THRESHOLDS.CAUTION_UTILIZATION) codes.push(REASON_CODES.SESSION_BUDGET_NEAR_LIMIT);
    } else if (scope.scope === 'turn') {
      if (utilization >= THRESHOLDS.DEGRADE_UTILIZATION) codes.push(REASON_CODES.TURN_BUDGET_EXCEEDED);
      else if (utilization >= THRESHOLDS.CAUTION_UTILIZATION) codes.push(REASON_CODES.TURN_BUDGET_NEAR_LIMIT);
    }

    return codes;
  }

  private buildExplanation(
    level: PressureLevel,
    reasonCodes: ReasonCode[],
    violatedScopes: string[],
  ): string {
    const contract = LEVEL_CONTRACTS[level];
    const scopeStr = violatedScopes.length > 0
      ? ` Violated scopes: ${violatedScopes.join(', ')}.`
      : '';
    const codeStr = reasonCodes.length > 0
      ? ` Codes: ${reasonCodes.join(', ')}.`
      : '';
    return `${contract.description}.${scopeStr}${codeStr}`;
  }
}
