/**
 * Round 20.3 — AgendaLawEvaluator
 *
 * Unified agenda law reasoning layer. Produces a structured AgendaLawVerdict
 * for each commitment, explaining WHY it should be in a particular state.
 *
 * Three consumers:
 * 1. AgendaGenerator → scoring & ranking
 * 2. AgendaLifecycleReconciler → state migrations
 * 3. Operator truth / UI → human-readable explanations
 *
 * The evaluator synthesizes:
 * - Economic projection (reserve, runway, burn rate)
 * - Governance constraints (holds, policies)
 * - Creator directives (priority overrides, must-do)
 * - Survival obligations (mustPreserve, identity)
 * - Time factors (expiry, scheduling, aging)
 */
import type { Commitment, CommitmentStatus } from './commitment-model.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

// ── Types ─────────────────────────────────────────────────────────────

export type LawVerdict = 'proceed' | 'defer' | 'dormant' | 'expire' | 'hold' | 'promote';

export type ReasonSource = 'economic' | 'governance' | 'creator' | 'survival' | 'time' | 'capacity';

export interface ReasonEntry {
  source: ReasonSource;
  factor: string;
  weight: number;
  explanation: string;
}

export interface EconomicFactors {
  reservePressure: number;      // 0-100
  runwayUrgency: number;        // 0-100
  burnRateStress: number;       // 0-100
  opportunityCostCents: number;
}

export interface GovernanceFactors {
  isHeld: boolean;
  holdReason?: string;
  policyConstraints: string[];
}

export interface AgendaLawVerdict {
  commitmentId: string;
  currentStatus: CommitmentStatus;
  recommendedStatus: CommitmentStatus;
  verdict: LawVerdict;
  confidence: number;           // 0-1
  reasons: ReasonEntry[];
  economicFactors: EconomicFactors;
  governanceFactors: GovernanceFactors;
  creatorDirectiveMatch?: string;
  evaluatedAt: string;
}

export interface AgendaLawContext {
  projection?: EconomicProjection;
  creatorDirectives?: string[];
  governanceHolds?: string[];          // commitment IDs held by governance
  governanceConstraints?: string[];
}

// ── AgendaLawEvaluator ────────────────────────────────────────────────

export class AgendaLawEvaluator {
  /**
   * Evaluate a single commitment against the unified agenda law.
   */
  evaluate(commitment: Commitment, context: AgendaLawContext): AgendaLawVerdict {
    const now = new Date().toISOString();
    const reasons: ReasonEntry[] = [];
    const economicFactors = this.computeEconomicFactors(commitment, context.projection);
    const governanceFactors = this.computeGovernanceFactors(commitment, context);

    let verdict: LawVerdict = 'proceed';
    let recommendedStatus: CommitmentStatus = commitment.status;
    let confidence = 0.5;

    // ── 1. Time-based expiry check ──
    if (commitment.expiresAt && commitment.expiresAt <= now) {
      verdict = 'expire';
      recommendedStatus = 'expired';
      confidence = 1.0;
      reasons.push({
        source: 'time',
        factor: 'expiry',
        weight: 100,
        explanation: `Time-to-live exceeded (expired at ${commitment.expiresAt})`,
      });
      return this.buildVerdict(commitment, recommendedStatus, verdict, confidence, reasons, economicFactors, governanceFactors, context, now);
    }

    // ── 2. Governance holds ──
    if (governanceFactors.isHeld) {
      verdict = 'hold';
      recommendedStatus = 'blocked';
      confidence = 0.9;
      reasons.push({
        source: 'governance',
        factor: 'governance-hold',
        weight: 90,
        explanation: `Held by governance: ${governanceFactors.holdReason ?? 'policy constraint'}`,
      });
      return this.buildVerdict(commitment, recommendedStatus, verdict, confidence, reasons, economicFactors, governanceFactors, context, now);
    }

    // ── 3. Creator directive match ──
    const directiveMatch = this.matchCreatorDirective(commitment, context.creatorDirectives);
    if (directiveMatch) {
      reasons.push({
        source: 'creator',
        factor: 'creator-directive',
        weight: 80,
        explanation: `Matches creator directive: "${directiveMatch}"`,
      });
    }

    // ── 4. Survival obligations ──
    if (commitment.mustPreserve) {
      reasons.push({
        source: 'survival',
        factor: 'must-preserve',
        weight: 70,
        explanation: 'Must-preserve commitment: protected from demotion',
      });
    }

    // ── 5. Economic pressure evaluation ──
    const overallPressure = (economicFactors.reservePressure * 0.4)
      + (economicFactors.runwayUrgency * 0.35)
      + (economicFactors.burnRateStress * 0.25);

    if (overallPressure > 70 && !commitment.revenueBearing && !commitment.mustPreserve) {
      // High economic pressure → demote non-revenue non-essential work
      verdict = 'dormant';
      recommendedStatus = 'dormant';
      confidence = Math.min(0.95, overallPressure / 100);
      reasons.push({
        source: 'economic',
        factor: 'survival-pressure',
        weight: overallPressure,
        explanation: `High economic pressure (${overallPressure.toFixed(0)}) — non-revenue work should hibernate`,
      });
    } else if (overallPressure > 50 && !commitment.revenueBearing && !commitment.mustPreserve && !directiveMatch) {
      // Moderate pressure → defer non-revenue
      verdict = 'defer';
      recommendedStatus = 'deferred';
      confidence = 0.7;
      reasons.push({
        source: 'economic',
        factor: 'moderate-pressure',
        weight: overallPressure,
        explanation: `Moderate economic pressure (${overallPressure.toFixed(0)}) — deferring non-essential work`,
      });
    } else if (overallPressure < 30 && commitment.revenueBearing) {
      // Low pressure + revenue → promote
      verdict = 'promote';
      recommendedStatus = 'active';
      confidence = 0.8;
      reasons.push({
        source: 'economic',
        factor: 'opportunity',
        weight: 60,
        explanation: 'Economy healthy — revenue opportunity should be pursued',
      });
    }

    // ── 6. Reactivation check (for dormant/deferred) ──
    if ((commitment.status === 'dormant' || commitment.status === 'deferred') && commitment.reactivationPolicy) {
      const policy = commitment.reactivationPolicy;
      const proj = context.projection;
      let shouldReactivate = false;

      if (policy.trigger === 'reserve_recovery' && proj && policy.minReserveCents !== undefined) {
        shouldReactivate = proj.reserveCents >= policy.minReserveCents;
      } else if (policy.trigger === 'runway_extension' && proj && policy.minRunwayDays !== undefined) {
        shouldReactivate = proj.runwayDays >= policy.minRunwayDays;
      } else if (policy.trigger === 'time_elapsed' && policy.reevaluateAfter) {
        shouldReactivate = now >= policy.reevaluateAfter;
      }

      if (shouldReactivate) {
        verdict = 'promote';
        recommendedStatus = 'active';
        confidence = 0.85;
        reasons.push({
          source: 'economic',
          factor: 'reactivation-policy',
          weight: 75,
          explanation: `Reactivation condition met (${policy.trigger})`,
        });
      }
    }

    // ── 7. Default: if currently planned, should proceed to active ──
    if (commitment.status === 'planned' && verdict === 'proceed') {
      recommendedStatus = 'active';
      confidence = 0.6;
      reasons.push({
        source: 'capacity',
        factor: 'default-promotion',
        weight: 40,
        explanation: 'Planned commitment ready for activation',
      });
    }

    // If no special verdict, keep current state
    if (reasons.length === 0) {
      reasons.push({
        source: 'capacity',
        factor: 'steady-state',
        weight: 30,
        explanation: 'No active pressure — maintaining current state',
      });
    }

    return this.buildVerdict(commitment, recommendedStatus, verdict, confidence, reasons, economicFactors, governanceFactors, context, now);
  }

  /**
   * Evaluate a batch of commitments.
   */
  evaluateBatch(commitments: readonly Commitment[], context: AgendaLawContext): AgendaLawVerdict[] {
    return commitments.map(c => this.evaluate(c, context));
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private computeEconomicFactors(c: Commitment, projection?: EconomicProjection): EconomicFactors {
    if (!projection) {
      return { reservePressure: 0, runwayUrgency: 0, burnRateStress: 0, opportunityCostCents: 0 };
    }

    const reserveRatio = Math.min(1, projection.reserveCents / 10_000);
    const reservePressure = reserveRatio < 0.3 ? 80 : reserveRatio < 0.6 ? 55 : 20;

    const runwayUrgency = projection.runwayDays <= 3 ? 95
      : projection.runwayDays <= 14 ? 70
      : projection.runwayDays <= 30 ? 45
      : 15;

    const burnRateStress = projection.netFlowCentsPerDay < -100 ? 85
      : projection.netFlowCentsPerDay < 0 ? 55
      : 15;

    const opportunityCostCents = c.revenueBearing
      ? Math.max(0, c.expectedValueCents - c.estimatedCostCents)
      : 0;

    return { reservePressure, runwayUrgency, burnRateStress, opportunityCostCents };
  }

  private computeGovernanceFactors(c: Commitment, context: AgendaLawContext): GovernanceFactors {
    const isHeld = context.governanceHolds?.includes(c.id) ?? false;
    return {
      isHeld,
      holdReason: isHeld ? 'governance policy hold' : undefined,
      policyConstraints: context.governanceConstraints ?? [],
    };
  }

  private matchCreatorDirective(c: Commitment, directives?: string[]): string | undefined {
    if (!directives || directives.length === 0) return undefined;
    // Match by name or kind keyword
    return directives.find(d => {
      const lower = d.toLowerCase();
      return lower.includes(c.name.toLowerCase()) || lower.includes(c.kind);
    });
  }

  private buildVerdict(
    commitment: Commitment,
    recommendedStatus: CommitmentStatus,
    verdict: LawVerdict,
    confidence: number,
    reasons: ReasonEntry[],
    economicFactors: EconomicFactors,
    governanceFactors: GovernanceFactors,
    context: AgendaLawContext,
    evaluatedAt: string,
  ): AgendaLawVerdict {
    return {
      commitmentId: commitment.id,
      currentStatus: commitment.status,
      recommendedStatus,
      verdict,
      confidence,
      reasons,
      economicFactors,
      governanceFactors,
      creatorDirectiveMatch: this.matchCreatorDirective(commitment, context.creatorDirectives),
      evaluatedAt,
    };
  }
}
