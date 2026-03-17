/**
 * Round 16.9.1 — Control Surface Contracts
 *
 * External-facing, read-only type definitions for economic / survival
 * observability endpoints. All types are consumed by REST routes,
 * dashboard, and CLI — none contain mutable state.
 *
 * Design principle: route handlers MUST NOT compute these;
 * they are produced exclusively by service-layer methods.
 */
import type { SurvivalTier } from '../automaton/index.js';
import type { EconomicHealth } from './economic-state.js';

// ── Admission Codes ─────────────────────────────────────────────────

/** Discriminated admission decision codes. */
export type AdmissionCode =
  | 'GATE_ALLOWED'
  | 'GATE_BLOCKED_DEAD'
  | 'GATE_BLOCKED_TERMINAL'
  | 'GATE_BLOCKED_CRITICAL'
  | 'GATE_EXEMPT_REVENUE'
  | 'GATE_EXEMPT_PRESERVE';

// ── Task Admission Decision ─────────────────────────────────────────

/**
 * Structured result from survival gate task admission check.
 * Replaces the flat `reason: string` in `EnforcementResult` for
 * control-surface consumers that need explainability.
 */
export interface TaskAdmissionDecision {
  /** Whether the task was accepted */
  readonly allowed: boolean;
  /** Discriminated admission code */
  readonly code: AdmissionCode;
  /** Human-readable explanation */
  readonly message: string;
  /** The survival tier that caused blocking (if blocked) */
  readonly blockingState: SurvivalTier;
  /** Task classes still allowed under current policy */
  readonly allowedTaskClasses: readonly string[];
  /** The class of the rejected task (if rejected) */
  readonly rejectedTaskClass: 'non-revenue' | 'non-preserve' | 'all' | null;
  /** Exemption that was applied (if allowed under pressure) */
  readonly exemptionApplied: 'revenue' | 'must-preserve' | null;
  /** Survival metrics snapshot at decision time */
  readonly survivalMetrics: {
    readonly balanceCents: number;
    readonly burnRateCentsPerDay: number;
    readonly runwayDays: number;
    readonly tier: SurvivalTier;
  };
  /** What needs to change to resume normal admission */
  readonly recoveryCondition: string | null;
  /** ISO timestamp */
  readonly timestamp: string;
}

// ── Survival Gate Explain ───────────────────────────────────────────

/**
 * Current gate policy summary — what the gate is doing and why.
 */
export interface SurvivalGateExplain {
  /** Whether the gate is open for general tasks */
  readonly isOpen: boolean;
  /** Current survival tier */
  readonly tier: SurvivalTier;
  /** Economic health classification */
  readonly health: EconomicHealth;
  /** What the gate is currently accepting */
  readonly accepting: 'all' | 'revenue-and-preserve-only' | 'none';
  /** Active restrictions */
  readonly restrictions: readonly string[];
  /** Active exemptions (e.g. "revenue tasks bypass critical gate") */
  readonly activeExemptions: readonly string[];
  /** Max concurrent background operations allowed */
  readonly backgroundWorkLimit: number;
  /** ISO timestamp */
  readonly timestamp: string;
}

// ── Economic Snapshot ───────────────────────────────────────────────

/**
 * External-facing economic snapshot.
 * Built from `EconomicProjection` + survival context.
 * Fields are labeled by category for consumers.
 */
export interface EconomicSnapshot {
  // ── Factual (direct measurements) ──
  readonly totalRevenueCents: number;
  readonly totalSpendCents: number;
  readonly currentBalanceCents: number;
  readonly revenueBySource: Readonly<Record<string, number>>;

  // ── Derived (computed from factual) ──
  readonly burnRateCentsPerDay: number;
  readonly dailyRevenueCents: number;
  readonly netFlowCentsPerDay: number;
  readonly runwayDays: number;
  readonly reserveCents: number;
  readonly isSelfSustaining: boolean;

  // ── Threshold (policy-defined boundaries) ──
  readonly reserveFloorCents: number;
  readonly mustPreserveWindowMinutes: number;

  // ── Explanatory (context for interpretation) ──
  readonly projectionOwner: 'EconomicStateService';
  readonly survivalTier: SurvivalTier;
  readonly economicHealth: EconomicHealth;
  readonly isEmergency: boolean;

  // ── Supplementary ──
  readonly revenueStats: {
    readonly totalRevenueCents: number;
    readonly eventCount: number;
    readonly byProtocol: Readonly<Record<string, number>>;
  } | null;

  // ── Meta ──
  readonly projectedAt: string;
}

// ── Agenda Factor Summary ───────────────────────────────────────────

/**
 * Snapshot of the agenda economic shaping factors currently in effect.
 * Produced by `AgendaGenerator.explainFactors()`.
 */
export interface AgendaFactorSummary {
  /** Reserve pressure score (0-100). Low reserve → high pressure */
  readonly reservePressure: number;
  /** Net flow factor (0-100). Negative flow → high pressure */
  readonly netFlowFactor: number;
  /** Burn rate urgency (0-100). Short runway → high urgency */
  readonly burnRateUrgency: number;
  /** Combined survival pressure (weighted average of above 3) */
  readonly overallPressureScore: number;
  /** Must-preserve floor guarantee (score minimum for mustPreserve tasks) */
  readonly mustPreserveFloor: number;
  /** Survival reserve window in minutes */
  readonly survivalReserveWindowMinutes: number;
  /** Human-readable explanation of current economic shaping */
  readonly explanation: string;
  /** ISO timestamp */
  readonly timestamp: string;
}
