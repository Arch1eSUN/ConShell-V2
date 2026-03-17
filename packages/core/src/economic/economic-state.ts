/**
 * Round 15.7 — Unified Economic State
 *
 * Single source of truth for the agent's economic position.
 * Consumes SpendTracker + ConwayAutomaton → produces immutable EconomicState snapshot.
 * Runtime reads this; it never assembles economic data from multiple sources itself.
 */
import type { SurvivalTier } from '../automaton/index.js';

// ── Economic State Snapshot ──────────────────────────────────────────

export interface EconomicState {
  /** Current balance in cents (income - spend + initial) */
  readonly balanceCents: number;
  /** Total lifetime spend in cents */
  readonly totalSpendCents: number;
  /** Total lifetime income in cents */
  readonly totalIncomeCents: number;
  /** Reserve = balance minus minimum operating costs */
  readonly reserveCents: number;
  /** Daily burn rate in cents (7-day rolling average) */
  readonly burnRateCentsPerDay: number;
  /** Daily income rate in cents */
  readonly dailyIncomeCents: number;
  /** Estimated days until funds exhausted */
  readonly survivalDays: number;
  /** Profitability ratio: income / spend (>1 = profitable) */
  readonly profitabilityRatio: number;
  /** Current survival tier from automaton */
  readonly survivalTier: SurvivalTier;
  /** Net flow per day (income - burn) */
  readonly netFlowCentsPerDay: number;
  /** Whether the agent can sustain itself (netFlow >= 0) */
  readonly isSelfSustaining: boolean;
  /** ISO timestamp of snapshot creation */
  readonly snapshotAt: string;
}

// ── Survival Thresholds (aligned with ConwayAutomaton) ───────────────

export const SURVIVAL_THRESHOLDS = {
  /** Minimum reserve to maintain normal operations (cents) */
  MIN_OPERATING_RESERVE_CENTS: 1_000,   // $10
  /** Days of runway considered "safe" */
  SAFE_RUNWAY_DAYS: 7,
  /** Days of runway considered "critical" */
  CRITICAL_RUNWAY_DAYS: 1,
  /** profitabilityRatio below which agent is "bleeding" */
  BLEEDING_RATIO: 0.5,
  /** profitabilityRatio above which agent is "thriving" */
  THRIVING_RATIO: 1.2,
} as const;

// ── State Builder ────────────────────────────────────────────────────

/**
 * Inputs required to build an EconomicState.
 * Decoupled from SpendTracker/ConwayAutomaton to keep this module pure.
 */
export interface EconomicStateInput {
  balanceCents: number;
  totalSpendCents: number;
  totalIncomeCents: number;
  burnRateCentsPerDay: number;
  dailyIncomeCents: number;
  survivalTier: SurvivalTier;
}

/**
 * Build an immutable EconomicState snapshot from raw inputs.
 * Pure function — no side effects, no I/O.
 */
export function buildEconomicState(input: EconomicStateInput): EconomicState {
  const {
    balanceCents,
    totalSpendCents,
    totalIncomeCents,
    burnRateCentsPerDay,
    dailyIncomeCents,
    survivalTier,
  } = input;

  const reserveCents = Math.max(0, balanceCents - SURVIVAL_THRESHOLDS.MIN_OPERATING_RESERVE_CENTS);
  const netFlowCentsPerDay = dailyIncomeCents - burnRateCentsPerDay;
  const survivalDays = burnRateCentsPerDay > 0
    ? Math.floor(balanceCents / burnRateCentsPerDay)
    : (balanceCents > 0 ? 999 : 0);
  const profitabilityRatio = totalSpendCents > 0
    ? Math.round((totalIncomeCents / totalSpendCents) * 1000) / 1000
    : (totalIncomeCents > 0 ? Infinity : 0);
  const isSelfSustaining = netFlowCentsPerDay >= 0 && balanceCents > 0;

  const state: EconomicState = {
    balanceCents,
    totalSpendCents,
    totalIncomeCents,
    reserveCents,
    burnRateCentsPerDay,
    dailyIncomeCents,
    survivalDays,
    profitabilityRatio,
    survivalTier,
    netFlowCentsPerDay,
    isSelfSustaining,
    snapshotAt: new Date().toISOString(),
  };

  return Object.freeze(state);
}

/**
 * Determine if economic state qualifies as an emergency.
 * Used by survival coupling to decide enforcement level.
 */
export function isEconomicEmergency(state: EconomicState): boolean {
  return (
    state.balanceCents <= 0 ||
    state.survivalTier === 'dead' ||
    state.survivalTier === 'terminal' ||
    state.survivalDays <= SURVIVAL_THRESHOLDS.CRITICAL_RUNWAY_DAYS
  );
}

/**
 * Classify economic health into a simple label for routing/narrative.
 */
export type EconomicHealth = 'thriving' | 'stable' | 'stressed' | 'critical' | 'dying';

export function classifyHealth(state: EconomicState): EconomicHealth {
  if (state.survivalTier === 'dead' || state.survivalTier === 'terminal') return 'dying';
  if (state.survivalTier === 'critical') return 'critical';
  if (state.survivalDays < SURVIVAL_THRESHOLDS.SAFE_RUNWAY_DAYS) return 'stressed';
  if (state.profitabilityRatio >= SURVIVAL_THRESHOLDS.THRIVING_RATIO && state.isSelfSustaining) return 'thriving';
  return 'stable';
}
