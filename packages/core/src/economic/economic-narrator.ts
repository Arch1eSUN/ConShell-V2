/**
 * Round 15.7 — Economic Explainability
 *
 * Generates structured, human-readable narratives explaining
 * the agent's economic decisions. All outputs are structured JSON
 * that can be consumed by the frontend, audit trail, or logging.
 */
import type { EconomicState, EconomicHealth } from './economic-state.js';
import { classifyHealth, SURVIVAL_THRESHOLDS } from './economic-state.js';
import type { LedgerSnapshot } from './economic-ledger.js';
import type { RoutingDecision } from './value-router.js';
import type { EnforcementResult } from './survival-coupling.js';

// ── Narrative Types ──────────────────────────────────────────────────

export interface NarrativeDecision {
  /** What happened */
  readonly what: string;
  /** Why it happened */
  readonly why: string;
  /** Impact on the agent */
  readonly impact: string;
  /** Alternative actions considered */
  readonly alternatives?: readonly string[];
}

export interface EconomicNarrative {
  /** One-line summary */
  readonly summary: string;
  /** Health classification */
  readonly health: EconomicHealth;
  /** Economic decisions explained */
  readonly decisions: readonly NarrativeDecision[];
  /** ISO timestamp */
  readonly timestamp: string;
}

export interface EconomicReport {
  /** Report title */
  readonly title: string;
  /** Current health */
  readonly health: EconomicHealth;
  /** Key metrics */
  readonly metrics: {
    readonly balance: string;
    readonly runway: string;
    readonly burnRate: string;
    readonly income: string;
    readonly profitability: string;
    readonly selfSustaining: boolean;
  };
  /** Ledger summary */
  readonly ledger: {
    readonly totalEntries: number;
    readonly totalCredits: string;
    readonly totalDebits: string;
    readonly integrity: string;
  };
  /** Actionable recommendations */
  readonly recommendations: readonly string[];
  /** ISO timestamp */
  readonly generatedAt: string;
}

// ── Narrator ─────────────────────────────────────────────────────────

export class EconomicNarrator {
  /**
   * Generate a narrative about the current economic state.
   */
  narrate(state: EconomicState, recentDecisions?: NarrativeDecision[]): EconomicNarrative {
    const health = classifyHealth(state);
    const summary = this.buildSummary(state, health);
    const decisions = recentDecisions ?? [];

    return Object.freeze({
      summary,
      health,
      decisions,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Explain a routing decision in human terms.
   */
  explainRoutingDecision(
    taskId: string,
    decision: RoutingDecision,
    state: EconomicState,
  ): NarrativeDecision {
    const health = classifyHealth(state);
    const what = `Task '${taskId}' was ${decision.action}ed`;
    const why = decision.reason;
    const impact = this.describeImpact(decision, state);
    const alternatives = this.suggestAlternatives(decision, health);

    return { what, why, impact, alternatives };
  }

  /**
   * Explain an enforcement decision (survival gate).
   */
  explainEnforcement(
    action: string,
    result: EnforcementResult,
    state: EconomicState,
  ): NarrativeDecision {
    const what = result.allowed
      ? `Action '${action}' was permitted`
      : `Action '${action}' was blocked`;
    const why = result.reason ?? `Tier '${result.enforcedTier}' constraints apply`;
    const impact = result.allowed
      ? 'No economic impact — operation proceeds normally'
      : `Operation prevented to protect survival at tier '${result.enforcedTier}'`;
    const alternatives = result.substitute
      ? [`Use substitute: ${result.substitute}`]
      : undefined;

    return { what, why, impact, alternatives };
  }

  /**
   * Generate a full economic report combining state + ledger data.
   */
  generateReport(state: EconomicState, ledgerSnapshot?: LedgerSnapshot): EconomicReport {
    const health = classifyHealth(state);
    const recommendations = this.generateRecommendations(state, health);

    return {
      title: `Economic Status Report — ${health.toUpperCase()}`,
      health,
      metrics: {
        balance: `$${(state.balanceCents / 100).toFixed(2)}`,
        runway: state.survivalDays >= 999 ? '∞ (sustainable)' : `${state.survivalDays} days`,
        burnRate: `$${(state.burnRateCentsPerDay / 100).toFixed(2)}/day`,
        income: `$${(state.dailyIncomeCents / 100).toFixed(2)}/day`,
        profitability: state.profitabilityRatio === Infinity
          ? '∞ (no spend)'
          : `${(state.profitabilityRatio * 100).toFixed(1)}%`,
        selfSustaining: state.isSelfSustaining,
      },
      ledger: ledgerSnapshot
        ? {
            totalEntries: ledgerSnapshot.entryCount,
            totalCredits: `$${(ledgerSnapshot.totalCreditsCents / 100).toFixed(2)}`,
            totalDebits: `$${(ledgerSnapshot.totalDebitsCents / 100).toFixed(2)}`,
            integrity: `Chain hash: ${ledgerSnapshot.headHash.slice(0, 16)}...`,
          }
        : {
            totalEntries: 0,
            totalCredits: '$0.00',
            totalDebits: '$0.00',
            integrity: 'No ledger data',
          },
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private buildSummary(state: EconomicState, health: EconomicHealth): string {
    const balance = `$${(state.balanceCents / 100).toFixed(2)}`;
    const runway = state.survivalDays >= 999 ? 'indefinitely' : `${state.survivalDays} days`;

    switch (health) {
      case 'thriving':
        return `Agent is thriving with ${balance} balance, sustainable for ${runway}. Income exceeds burn rate.`;
      case 'stable':
        return `Agent is stable with ${balance} balance, estimated ${runway} runway.`;
      case 'stressed':
        return `Agent is under economic stress. ${balance} remaining, ~${runway} runway. Consider reducing spend or increasing revenue.`;
      case 'critical':
        return `CRITICAL: Only ${balance} remaining (~${runway} runway). Non-essential operations suspended.`;
      case 'dying':
        return `EMERGENCY: Agent is dying. ${balance} remaining. Only revenue-generating actions permitted.`;
    }
  }

  private describeImpact(decision: RoutingDecision, state: EconomicState): string {
    switch (decision.action) {
      case 'accept':
        return 'Task will be executed, consuming estimated resources from the agent\'s balance.';
      case 'reject':
        return 'Task was rejected to preserve agent survival. No resources consumed.';
      case 'defer':
        return 'Task deferred to a time when the agent has better economic standing.';
      case 'downgrade':
        return 'Task will execute with a cheaper model to conserve resources.';
      default:
        return 'Unknown impact.';
    }
  }

  private suggestAlternatives(decision: RoutingDecision, health: EconomicHealth): string[] | undefined {
    if (decision.action === 'accept') return undefined;

    const alts: string[] = [];
    if (decision.action === 'reject') {
      alts.push('Wait for agent economic recovery');
      alts.push('Add funds to agent balance');
      if (health === 'critical' || health === 'dying') {
        alts.push('Convert task to revenue-bearing (charge the requester)');
      }
    }
    if (decision.action === 'defer') {
      alts.push('Execute immediately with a cheaper model');
      alts.push('Wait for time window to advance (budget scopes reset)');
    }
    return alts.length > 0 ? alts : undefined;
  }

  private generateRecommendations(state: EconomicState, health: EconomicHealth): string[] {
    const recs: string[] = [];

    if (!state.isSelfSustaining) {
      recs.push('Income does not cover burn rate — agent is not self-sustaining');
    }
    if (state.profitabilityRatio < SURVIVAL_THRESHOLDS.BLEEDING_RATIO && state.totalSpendCents > 0) {
      recs.push('Profitability below 50% — agent is bleeding value');
    }
    if (state.survivalDays < SURVIVAL_THRESHOLDS.SAFE_RUNWAY_DAYS && state.survivalDays < 999) {
      recs.push(`Runway below ${SURVIVAL_THRESHOLDS.SAFE_RUNWAY_DAYS} days — increase income or reduce spend`);
    }
    if (health === 'critical' || health === 'dying') {
      recs.push('Activate all revenue surfaces');
      recs.push('Disable non-essential features');
    }
    if (health === 'thriving') {
      recs.push('Consider expanding capabilities or investing in infrastructure');
    }
    if (recs.length === 0) {
      recs.push('Economic position is healthy — no immediate action required');
    }

    return recs;
  }
}
