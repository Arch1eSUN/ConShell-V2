/**
 * AgendaGenerator — multi-factor scoring for commitment prioritization.
 *
 * Produces an ordered agenda from pending commitments, weighted by:
 * - economicValue (historical net value from EconomicMemoryStore)
 * - urgency (time pressure from dueAt / priority)
 * - mustPreserve (protection for essential maintenance)
 * - modeBonus (RuntimeMode-specific bias)
 * - survivalPressure (Round 16.9: projection-based deep coupling)
 *
 * Round 17.3: Agenda V2 — becomes survival-driven behavior orchestrator.
 * - Integrates ProfitabilityEvaluator as pre-filter
 * - Extended input: creator directives, paid work, revenue opportunities
 * - Extended output: task category, expected value/cost per item
 *
 * Outputs include selection reasons and deferral explanations.
 */
import type { Commitment, CommitmentPriority } from './commitment-model.js';
import { PRIORITY_WEIGHTS } from './commitment-model.js';
import type { EconomicMemoryStore } from '../economic/economic-memory-store.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';
import type { AgendaFactorSummary } from '../economic/control-surface-contracts.js';
import { ProfitabilityEvaluator, type ProfitabilityResult } from '../economic/profitability-evaluator.js';

// ── Types ─────────────────────────────────────────────────────────────

export type RuntimeMode = 'normal' | 'revenue-seeking' | 'survival-recovery' | 'shutdown';
export type SurvivalTier = 'thriving' | 'normal' | 'frugal' | 'critical' | 'terminal' | 'dead';

/** Round 17.3: Task category for structured agenda output */
export type AgendaTaskCategory = 'revenue-seeking' | 'maintenance' | 'governance' | 'recovery' | 'user-facing' | 'general';

export interface AgendaItem {
  commitment: Commitment;
  score: number;
  reasons: string[];
  /** Round 17.3: What category of work this task represents */
  taskCategory: AgendaTaskCategory;
  /** Round 17.3: Expected value in cents */
  expectedValueCents: number;
  /** Round 17.3: Expected cost in cents */
  expectedCostCents: number;
}

export interface DeferredItem {
  commitment: Commitment;
  reason: string;
  /** Round 17.3: Whether deferred by profitability gate */
  profitabilityDeferred?: boolean;
  /** Round 17.3: Whether rejected by profitability gate */
  profitabilityRejected?: boolean;
}

export interface AgendaResult {
  selected: AgendaItem[];
  deferred: DeferredItem[];
  generatedAt: string;
  mode: RuntimeMode;
  tier: SurvivalTier;
  /** Round 17.3: Profitability gate results for all evaluated commitments */
  profitabilityGateResults?: ProfitabilityResult[];
}

export interface AgendaInput {
  commitments: readonly Commitment[];
  mode: RuntimeMode;
  tier: SurvivalTier;
  maxItems?: number;
  /** Round 16.9: Deep coupling — canonical economic projection */
  projection?: EconomicProjection;
  /** Round 17.3: Creator directives (high-priority instructions) */
  creatorDirectives?: string[];
  /** Round 17.3: Pending paid work commitment IDs */
  pendingPaidWork?: string[];
  /** Round 17.3: Revenue opportunity descriptions */
  revenueOpportunities?: Array<{ id: string; estimatedRevenueCents: number; description: string }>;
  /** Round 17.3: Active delegated/child commitment IDs */
  activeDelegations?: string[];
  /** Round 17.3: Governance constraint strings */
  governanceConstraints?: string[];
}

// ── Weight profiles per mode ──────────────────────────────────────────

interface WeightProfile {
  economicValue: number;
  urgency: number;
  mustPreserve: number;
  modeBonus: number;
  /** Round 16.9: weight for projection-based survival pressure factor */
  survivalPressure: number;
}

const WEIGHT_PROFILES: Record<RuntimeMode, WeightProfile> = {
  'normal':            { economicValue: 25, urgency: 25, mustPreserve: 20, modeBonus: 15, survivalPressure: 15 },
  'revenue-seeking':   { economicValue: 40, urgency: 15, mustPreserve: 10, modeBonus: 10, survivalPressure: 25 },
  'survival-recovery': { economicValue: 15, urgency: 15, mustPreserve: 30, modeBonus: 15, survivalPressure: 25 },
  'shutdown':          { economicValue: 0,  urgency: 0,  mustPreserve: 0,  modeBonus: 0,  survivalPressure: 0  },
};

// ── AgendaGenerator ───────────────────────────────────────────────────

export class AgendaGenerator {
  private memoryStore?: EconomicMemoryStore;
  private profitabilityEvaluator: ProfitabilityEvaluator;

  constructor(memoryStore?: EconomicMemoryStore, profitabilityEvaluator?: ProfitabilityEvaluator) {
    this.memoryStore = memoryStore;
    this.profitabilityEvaluator = profitabilityEvaluator ?? new ProfitabilityEvaluator();
  }

  setMemoryStore(store: EconomicMemoryStore): void {
    this.memoryStore = store;
  }

  generate(input: AgendaInput): AgendaResult {
    const { commitments, mode, tier, maxItems = 3 } = input;
    const now = new Date().toISOString();

    // Shutdown mode: defer everything
    if (mode === 'shutdown') {
      return {
        selected: [],
        deferred: commitments.map(c => ({
          commitment: c,
          reason: 'System in shutdown mode',
        })),
        generatedAt: now,
        mode,
        tier,
      };
    }

    // ── Round 17.3: Profitability gate (pre-filter) ──
    let admittedCommitments = [...commitments];
    let profitabilityGateResults: ProfitabilityResult[] | undefined;
    const deferred: DeferredItem[] = [];

    if (input.projection) {
      const { admitted, deferred: profDeferred, rejected } =
        this.profitabilityEvaluator.evaluateBatch(commitments, input.projection);

      profitabilityGateResults = [...admitted, ...profDeferred, ...rejected];
      const admittedIds = new Set(admitted.map(r => r.commitmentId));
      admittedCommitments = commitments.filter(c => admittedIds.has(c.id));

      // Deferred by profitability
      for (const r of profDeferred) {
        const c = commitments.find(x => x.id === r.commitmentId);
        if (c) {
          deferred.push({ commitment: c, reason: r.reason, profitabilityDeferred: true });
        }
      }
      // Rejected by profitability
      for (const r of rejected) {
        const c = commitments.find(x => x.id === r.commitmentId);
        if (c) {
          deferred.push({ commitment: c, reason: r.reason, profitabilityRejected: true });
        }
      }
    }

    const weights = WEIGHT_PROFILES[mode];
    const scored: AgendaItem[] = [];

    for (const commitment of admittedCommitments) {
      const { score, reasons } = this.scoreCommitment(commitment, weights, mode, tier, input.projection);
      scored.push({
        commitment,
        score,
        reasons,
        taskCategory: this.classifyTaskCategory(commitment, mode),
        expectedValueCents: commitment.expectedValueCents,
        expectedCostCents: commitment.estimatedCostCents,
      });
    }

    // ── Round 17.3: Boost pending paid work ──
    if (input.pendingPaidWork && input.pendingPaidWork.length > 0) {
      const paidSet = new Set(input.pendingPaidWork);
      for (const item of scored) {
        if (paidSet.has(item.commitment.id)) {
          item.score += 15;
          item.reasons.push('Pending paid work boost (+15)');
        }
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Ensure at least one mustPreserve slot if any exist
    const mustPreserveItems = scored.filter(s => s.commitment.mustPreserve);

    let selected: AgendaItem[] = [];

    if (mustPreserveItems.length > 0 && maxItems > 0) {
      // Reserve 1 slot for mustPreserve (the highest-scoring one)
      const bestPreserve = mustPreserveItems[0]!;
      selected.push(bestPreserve);

      // Fill remaining slots from the full sorted list (excluding the reserved one)
      const remaining = scored.filter(s => s.commitment.id !== bestPreserve.commitment.id);
      for (const item of remaining) {
        if (selected.length >= maxItems) {
          deferred.push({
            commitment: item.commitment,
            reason: this.deferralReason(item, mode, tier),
          });
        } else {
          selected.push(item);
        }
      }

      // Also defer unused mustPreserve items
      for (const item of mustPreserveItems.slice(1)) {
        if (!selected.some(s => s.commitment.id === item.commitment.id)) {
          // Already in deferred from the loop above
        }
      }
    } else {
      // No mustPreserve items, just take top N
      selected = scored.slice(0, maxItems);
      for (const item of scored.slice(maxItems)) {
        deferred.push({
          commitment: item.commitment,
          reason: this.deferralReason(item, mode, tier),
        });
      }
    }

    return {
      selected,
      deferred,
      generatedAt: now,
      mode,
      tier,
      profitabilityGateResults,
    };
  }

  // ── Round 17.3: Task Category Classification ──────────────────────

  private classifyTaskCategory(c: Commitment, mode: RuntimeMode): AgendaTaskCategory {
    if (c.kind === 'revenue' || c.revenueBearing) return 'revenue-seeking';
    if (c.kind === 'maintenance') return 'maintenance';
    if (c.kind === 'governance') return 'governance';
    if (c.kind === 'user-facing') return 'user-facing';
    if (mode === 'survival-recovery') return 'recovery';
    return 'general';
  }

  // ── Scoring ─────────────────────────────────────────────────────────

  private scoreCommitment(
    c: Commitment,
    weights: WeightProfile,
    mode: RuntimeMode,
    tier: SurvivalTier,
    projection?: EconomicProjection,
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // 1. Economic value factor
    const economicScore = this.computeEconomicScore(c);
    const weightedEconomic = (economicScore / 100) * weights.economicValue;
    score += weightedEconomic;
    if (economicScore > 50) {
      reasons.push(`High economic value (${economicScore.toFixed(0)})`);
    }

    // 2. Urgency factor (priority + due date proximity)
    const urgencyScore = this.computeUrgencyScore(c);
    const weightedUrgency = (urgencyScore / 100) * weights.urgency;
    score += weightedUrgency;
    if (urgencyScore > 50) {
      reasons.push(`Urgent (${urgencyScore.toFixed(0)})`);
    }

    // 3. MustPreserve factor
    const preserveScore = c.mustPreserve ? 100 : 0;
    const weightedPreserve = (preserveScore / 100) * weights.mustPreserve;
    score += weightedPreserve;
    if (c.mustPreserve) {
      reasons.push('Must-preserve commitment');
    }

    // 4. Mode bonus
    const modeScore = this.computeModeBonus(c, mode, tier);
    const weightedMode = (modeScore / 100) * weights.modeBonus;
    score += weightedMode;
    if (modeScore > 0) {
      reasons.push(`Mode bonus: ${mode} (+${modeScore.toFixed(0)})`);
    }

    // 5. Round 16.9: Survival pressure factor (projection-based deep coupling)
    if (projection && weights.survivalPressure > 0) {
      const pressureScore = this.computeSurvivalPressure(c, projection);
      const weightedPressure = (pressureScore / 100) * weights.survivalPressure;
      score += weightedPressure;
      if (pressureScore !== 50) { // 50 = neutral baseline
        reasons.push(`Survival pressure: ${pressureScore > 50 ? '+' : ''}${(pressureScore - 50).toFixed(0)}`);
      }
    }

    // 6. Identity degradation penalty (Round 16.2)
    if (c.identityContext && c.identityContext.status !== 'active' && !c.mustPreserve) {
      const penalty = score * 0.5; // 50% reduction
      score -= penalty;
      reasons.push(`Identity penalty: ${c.identityContext.status} (-${penalty.toFixed(0)})`);
    }

    // Round 16.9: Floor guarantee — mustPreserve tasks never score below 15
    if (c.mustPreserve && score < 15) {
      score = 15;
      reasons.push('Floor: mustPreserve minimum');
    }

    if (reasons.length === 0) {
      reasons.push('Default priority');
    }

    return { score, reasons };
  }

  private computeEconomicScore(c: Commitment): number {
    // Base: expected net value
    const netValue = c.expectedValueCents - c.estimatedCostCents;
    let score = Math.min(100, Math.max(0, netValue / 10 + 50));

    // Boost from economic memory if available
    if (this.memoryStore) {
      const stats = this.memoryStore.getStats({
        taskType: c.taskType,
        taskName: c.name,
        mode: 'normal',
      });
      const record = Array.isArray(stats) ? stats[0] : stats;
      if (record && record.sampleCount >= 3) {
        // Blend historical performance
        const realizationBoost = record.realizationRate * 30;
        const netValueBoost = Math.min(20, record.avgNetValueCents / 5);
        score = score * 0.5 + (realizationBoost + netValueBoost + 25) * 0.5;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  private computeUrgencyScore(c: Commitment): number {
    const priorityScore = PRIORITY_WEIGHTS[c.priority as CommitmentPriority] ?? 50;

    if (!c.dueAt) return priorityScore;

    const now = Date.now();
    const due = new Date(c.dueAt).getTime();
    const hoursUntilDue = (due - now) / (1000 * 60 * 60);

    if (hoursUntilDue <= 0) return 100; // overdue
    if (hoursUntilDue <= 1) return 90;
    if (hoursUntilDue <= 6) return 75;
    if (hoursUntilDue <= 24) return 60;

    return priorityScore;
  }

  private computeModeBonus(c: Commitment, mode: RuntimeMode, _tier: SurvivalTier): number {
    switch (mode) {
      case 'revenue-seeking':
        return c.revenueBearing ? 80 : (c.mustPreserve ? 20 : 0);
      case 'survival-recovery':
        return c.mustPreserve ? 80 : (c.revenueBearing ? 40 : 0);
      default:
        return c.revenueBearing ? 30 : (c.mustPreserve ? 30 : 10);
    }
  }

  // ── Round 16.9: Projection-based survival pressure ──────────────────

  /**
   * Compute survival pressure score based on EconomicProjection.
   *
   * Three sub-factors:
   * - reservePressure: low reserve → boost revenue tasks, penalize expensive
   * - netFlowFactor: negative net flow → boost revenue, penalize pure-cost
   * - burnRateUrgency: high burn relative to balance → compress task horizon
   *
   * Returns 0-100 where 50 = neutral (no pressure adjustment).
   * Above 50 = boosted (revenue or critical maintenance under pressure).
   * Below 50 = penalized (expensive non-revenue under pressure).
   */
  private computeSurvivalPressure(c: Commitment, proj: EconomicProjection): number {
    // 1. Reserve pressure: boost revenue tasks when reserve is low
    const reserveRatio = proj.reserveCents > 0
      ? Math.min(1, proj.reserveCents / 10_000) // normalize: 100.00 = full reserve
      : 0;
    let reservePressure: number;
    if (reserveRatio < 0.3) {
      // Low reserve — revenue gets +30, non-revenue gets -20
      reservePressure = c.revenueBearing ? 80 : 30;
    } else if (reserveRatio < 0.6) {
      reservePressure = c.revenueBearing ? 65 : 40;
    } else {
      reservePressure = 50; // neutral
    }

    // 2. Net flow factor: negative flow pressures toward revenue
    let netFlowFactor: number;
    if (proj.netFlowCentsPerDay < -100) {
      // Bleeding badly — strong revenue bias
      netFlowFactor = c.revenueBearing ? 85 : 20;
    } else if (proj.netFlowCentsPerDay < 0) {
      // Slightly negative
      netFlowFactor = c.revenueBearing ? 65 : 35;
    } else if (proj.netFlowCentsPerDay > 50) {
      // Positive — ease pressure
      netFlowFactor = 50; // neutral
    } else {
      netFlowFactor = 50;
    }

    // 3. Burn rate urgency: high burn vs balance compresses horizon
    let burnRateUrgency: number;
    if (proj.runwayDays <= 3) {
      // Imminent death — only revenue or mustPreserve
      burnRateUrgency = (c.revenueBearing || c.mustPreserve) ? 100 : 5;
    } else if (proj.runwayDays <= 14) {
      burnRateUrgency = c.revenueBearing ? 70 : (c.mustPreserve ? 55 : 30);
    } else if (proj.runwayDays <= 30) {
      burnRateUrgency = c.revenueBearing ? 60 : 45;
    } else {
      burnRateUrgency = 50; // ample runway
    }

    // Weighted average of three sub-factors
    const combined = (reservePressure * 0.35) + (netFlowFactor * 0.35) + (burnRateUrgency * 0.30);

    // Clamp to [0, 100]
    return Math.min(100, Math.max(0, combined));
  }

  // ── Deferral reasons ────────────────────────────────────────────────

  private deferralReason(item: AgendaItem, mode: RuntimeMode, _tier: SurvivalTier): string {
    const c = item.commitment;

    if (mode === 'revenue-seeking' && !c.revenueBearing && !c.mustPreserve) {
      return 'Non-revenue commitment deferred in revenue-seeking mode';
    }
    if (mode === 'survival-recovery' && !c.mustPreserve && !c.revenueBearing) {
      return 'Non-essential commitment deferred during survival recovery';
    }
    if (item.score < 20) {
      return 'Low priority score';
    }

    return 'Lower priority than selected commitments';
  }

  // ── Round 16.9.1: Factor explanation ──────────────────────────────

  /**
   * Explain the current agenda economic shaping factors
   * for a given EconomicProjection. Read-only query, does
   * not affect the generate() path.
   */
  explainFactors(proj: EconomicProjection): AgendaFactorSummary {
    // Compute reserve pressure
    const reserveRatio = proj.reserveCents > 0
      ? Math.min(1, proj.reserveCents / 10_000)
      : 0;
    let reservePressure: number;
    if (reserveRatio < 0.3) reservePressure = 80;
    else if (reserveRatio < 0.6) reservePressure = 65;
    else reservePressure = 50;

    // Compute net flow factor
    let netFlowFactor: number;
    if (proj.netFlowCentsPerDay < -100) netFlowFactor = 85;
    else if (proj.netFlowCentsPerDay < 0) netFlowFactor = 65;
    else netFlowFactor = 50;

    // Compute burn rate urgency
    let burnRateUrgency: number;
    if (proj.runwayDays <= 3) burnRateUrgency = 100;
    else if (proj.runwayDays <= 14) burnRateUrgency = 70;
    else if (proj.runwayDays <= 30) burnRateUrgency = 60;
    else burnRateUrgency = 50;

    const overallPressureScore = Math.min(100, Math.max(0,
      (reservePressure * 0.35) + (netFlowFactor * 0.35) + (burnRateUrgency * 0.30),
    ));

    // Build explanation
    const parts: string[] = [];
    if (reservePressure > 50) parts.push(`Low reserve (${reserveRatio.toFixed(1)}x floor) — revenue tasks boosted`);
    if (netFlowFactor > 50) parts.push(`Negative net flow (${proj.netFlowCentsPerDay}¢/day) — non-revenue penalized`);
    if (burnRateUrgency > 50) parts.push(`Short runway (${proj.runwayDays.toFixed(1)} days) — burn urgency elevated`);
    if (parts.length === 0) parts.push('Economic conditions nominal — no active shaping pressure');

    return {
      reservePressure,
      netFlowFactor,
      burnRateUrgency,
      overallPressureScore,
      mustPreserveFloor: 15,
      survivalReserveWindowMinutes: 15,
      explanation: parts.join('; '),
      timestamp: new Date().toISOString(),
    };
  }
}
