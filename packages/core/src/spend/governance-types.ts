/**
 * Round 15.5 — Governance Types
 *
 * All governance types in one file: reason codes, budget scopes,
 * policy decisions, actions, overrides. Runtime consumes these;
 * it never re-interprets level semantics itself.
 */

// ── Reason Codes ──────────────────────────────────────────────────────
// Stable identifiers for governance decisions. Tests assert on these,
// not on human-readable messages.

export const REASON_CODES = {
  // Hourly scope
  HOURLY_BUDGET_NEAR_LIMIT: 'HOURLY_BUDGET_NEAR_LIMIT',
  HOURLY_BUDGET_EXCEEDED: 'HOURLY_BUDGET_EXCEEDED',
  HOURLY_BUDGET_CRITICAL: 'HOURLY_BUDGET_CRITICAL',
  // Daily scope
  DAILY_BUDGET_NEAR_LIMIT: 'DAILY_BUDGET_NEAR_LIMIT',
  DAILY_BUDGET_EXCEEDED: 'DAILY_BUDGET_EXCEEDED',
  DAILY_BUDGET_CRITICAL: 'DAILY_BUDGET_CRITICAL',
  // Session scope
  SESSION_BUDGET_NEAR_LIMIT: 'SESSION_BUDGET_NEAR_LIMIT',
  SESSION_BUDGET_EXCEEDED: 'SESSION_BUDGET_EXCEEDED',
  // Turn scope
  TURN_BUDGET_NEAR_LIMIT: 'TURN_BUDGET_NEAR_LIMIT',
  TURN_BUDGET_EXCEEDED: 'TURN_BUDGET_EXCEEDED',
  // Balance
  BALANCE_EXHAUSTED: 'BALANCE_EXHAUSTED',
  BALANCE_LOW: 'BALANCE_LOW',
  // Governance actions
  DEGRADE_POLICY_TRIGGERED: 'DEGRADE_POLICY_TRIGGERED',
  BLOCK_POLICY_TRIGGERED: 'BLOCK_POLICY_TRIGGERED',
  // Override & recovery
  OVERRIDE_ACTIVE: 'OVERRIDE_ACTIVE',
  RECOVERY_ACHIEVED: 'RECOVERY_ACHIEVED',
} as const;

export type ReasonCode = typeof REASON_CODES[keyof typeof REASON_CODES];

// ── Budget Scopes ─────────────────────────────────────────────────────

export type BudgetScopeId = 'turn' | 'session' | 'hourly' | 'daily';

export interface BudgetScopeResult {
  scope: BudgetScopeId;
  /** Utilization ratio 0–1 */
  utilization: number;
  /** Spent in this scope (cents) */
  spentCents: number;
  /** Limit for this scope (cents) */
  limitCents: number;
  /** Whether this scope is violated (utilization >= threshold) */
  violated: boolean;
  /** Threshold that was crossed */
  violationThreshold: number;
}

// ── Governance Actions ────────────────────────────────────────────────
// Canonical actions that runtime can execute. Each level maps to a
// fixed set of these — runtime never invents new interpretations.

export type GovernanceActionId =
  | 'cap_iterations'
  | 'inject_guidance'
  | 'block_inference'
  | 'log_warning';

// ── Pressure Levels ───────────────────────────────────────────────────

export type PressureLevel = 'allow' | 'caution' | 'degrade' | 'block';

// ── Level → Action Map ───────────────────────────────────────────────
// Canonical contract: each level produces exactly these actions.
// Runtime reads this; it never second-guesses the level.

export interface LevelContract {
  actions: GovernanceActionId[];
  /** Max iterations cap (null = no cap) */
  maxIterationsCap: number | null;
  /** Whether level can be overridden by creator */
  overrideable: boolean;
  /** Human-readable description for audit */
  description: string;
}

export const LEVEL_CONTRACTS: Record<PressureLevel, LevelContract> = {
  allow: {
    actions: [],
    maxIterationsCap: null,
    overrideable: false,
    description: 'Normal operation — within safe budget limits',
  },
  caution: {
    actions: ['inject_guidance', 'cap_iterations', 'log_warning'],
    maxIterationsCap: 3,
    overrideable: true,
    description: 'Economic caution — reduced iterations, cost-aware guidance injected',
  },
  degrade: {
    actions: ['inject_guidance', 'cap_iterations', 'log_warning'],
    maxIterationsCap: 1,
    overrideable: true,
    description: 'Degraded mode — single iteration, strong cost guidance',
  },
  block: {
    actions: ['block_inference', 'log_warning'],
    maxIterationsCap: 0,
    overrideable: false, // balance=0 cannot be overridden; utilization-based can be
    description: 'Blocked — execution refused to protect budget',
  },
};

// ── Policy Decision ───────────────────────────────────────────────────
// The single structured object that runtime consumes. All governance
// logic converges here; all logging, testing, and audit emanates here.

export interface PolicyDecision {
  /** Pressure level */
  level: PressureLevel;
  /** Stable reason codes (test-assertable) */
  reasonCodes: ReasonCode[];
  /** Human-readable explanation */
  explanation: string;
  /** Which budget scopes were violated */
  violatedScopes: BudgetScopeId[];
  /** Actions runtime must execute */
  selectedActions: GovernanceActionId[];
  /** Max iterations cap (from level contract) */
  maxIterationsCap: number | null;
  /** Metrics snapshot for audit */
  metricsSnapshot: {
    balanceCents: number;
    balanceRemainingPct: number;
    scopeResults: BudgetScopeResult[];
  };
  /** Hint for how to recover from current state */
  recoveryHint: string | null;
  /** Whether creator can override this decision */
  overrideable: boolean;
  /** If override is active, its source */
  overrideSource: string | null;
  /** ISO timestamp of decision */
  decisionTimestamp: string;
}

// ── Governance Override ───────────────────────────────────────────────

export interface GovernanceOverride {
  /** Who issued the override (e.g. 'creator', 'admin') */
  source: string;
  /** Force level down to this (cannot go below 'allow') */
  targetLevel: PressureLevel;
  /** When override expires (ISO string) */
  expiresAt: string;
  /** Override cannot bypass balance=0 safety */
  bypassSafety: false;
}

// ── Named Thresholds ──────────────────────────────────────────────────
// No magic numbers — all thresholds named and exported for testing.

export const THRESHOLDS = {
  /** Utilization at which caution kicks in */
  CAUTION_UTILIZATION: 0.50,
  /** Utilization at which degrade kicks in */
  DEGRADE_UTILIZATION: 0.80,
  /** Utilization at which block kicks in */
  BLOCK_UTILIZATION: 0.95,
  /** Balance percentage considered "low" */
  LOW_BALANCE_PCT: 10,
  /** Recovery: all scopes must be below this to recover */
  RECOVERY_UTILIZATION: 0.50,
} as const;
