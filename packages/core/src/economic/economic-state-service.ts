/**
 * Round 15.7B — EconomicStateService (Facade)
 *
 * Runtime service that aggregates SpendTracker + ConwayAutomaton → EconomicState.
 * Provides unified access to survival gate decisions and value routing.
 *
 * This is the canonical runtime integration point for the economic subsystem.
 * Kernel initializes this at Step 8.5 and injects it into AgentLoop.
 */
import type { SpendTracker } from '../spend/index.js';
import type { ConwayAutomaton, SurvivalTier } from '../automaton/index.js';
import type { Logger } from '../types/common.js';
import { buildEconomicState, classifyHealth, type EconomicState, type EconomicHealth } from './economic-state.js';
import { SurvivalGate, type EnforcementResult, TIER_CONSTRAINTS, type SurvivalConstraints } from './survival-coupling.js';
import { ValueRouter, type TaskDescriptor, type RoutingDecision } from './value-router.js';
import { EconomicNarrator, type EconomicNarrative } from './economic-narrator.js';
import { LedgerProjection } from './ledger-projection.js';
import { EconomicPolicy, resolveRuntimeMode, type RuntimeMode, type DecisionRecord } from './economic-policy.js';
import { type RevenueService } from './revenue-service.js';
import { type RevenueSurfaceRegistry } from './revenue-surface.js';
import type { RevenueEvent } from './value-events.js';
import { TaskFeedbackHeuristic } from './task-feedback-heuristic.js';
// ── Economic Projection (Round 16.9 — Canonical unified view) ────────

export interface EconomicProjection {
  /** Total revenue received (cents) — from RevenueService */
  readonly totalRevenueCents: number;
  /** Total spend (cents) — from SpendTracker */
  readonly totalSpendCents: number;
  /** Current balance (cents) — revenue - spend + initial */
  readonly currentBalanceCents: number;
  /** Reserve after minimum operating costs */
  readonly reserveCents: number;
  /** Daily burn rate (7-day rolling average) */
  readonly burnRateCentsPerDay: number;
  /** Daily revenue rate */
  readonly dailyRevenueCents: number;
  /** Net flow per day (revenue - burn) */
  readonly netFlowCentsPerDay: number;
  /** Estimated runway in days */
  readonly runwayDays: number;
  /** Current survival tier */
  readonly survivalTier: SurvivalTier;
  /** Whether netFlow >= 0 and balance > 0 */
  readonly isSelfSustaining: boolean;
  /** Revenue breakdown by source */
  readonly revenueBySource: Record<string, number>;
  /** ISO timestamp */
  readonly projectedAt: string;
}

// ── Survival State Summary ───────────────────────────────────────────

export interface SurvivalStateSummary {
  readonly tier: SurvivalTier;
  readonly health: EconomicHealth;
  readonly constraints: SurvivalConstraints;
  readonly projection: EconomicProjection;
  readonly isEmergency: boolean;
}

// ── Gate Decision (consumed by AgentLoop) ────────────────────────────


export interface EconomicGateDecision {
  /** Whether inference is allowed */
  readonly allowed: boolean;
  /** Human-readable explanation */
  readonly reason: string;
  /** Action hint: 'allow' | 'restrict' | 'block' */
  readonly action: 'allow' | 'restrict' | 'block';
  /** If restricted, suggested model to use */
  readonly suggestedModel?: string;
  /** Current survival tier */
  readonly tier: SurvivalTier;
  /** Maximum context window tokens allowed */
  readonly maxContextTokens: number;
  /** Current economic health classification */
  readonly health: EconomicHealth;
}

// ── Service ──────────────────────────────────────────────────────────

export class EconomicStateService {
  private spendTracker: SpendTracker;
  private automaton: ConwayAutomaton;
  private logger: Logger;
  private gate: SurvivalGate;
  private router: ValueRouter;
  private narrator: EconomicNarrator;
  private projection: LedgerProjection;
  private _policy: EconomicPolicy;
  private _revenueService?: RevenueService;
  private _revenueSurfaces?: RevenueSurfaceRegistry;
  private _feedbackHeuristic: TaskFeedbackHeuristic;

  constructor(
    spendTracker: SpendTracker,
    automaton: ConwayAutomaton,
    logger: Logger,
    revenueService?: RevenueService,
    revenueSurfaces?: RevenueSurfaceRegistry,
    feedbackHeuristic?: TaskFeedbackHeuristic,
  ) {
    this.spendTracker = spendTracker;
    this.automaton = automaton;
    this.logger = logger.child('economic-svc');
    this.gate = new SurvivalGate();
    this.narrator = new EconomicNarrator();
    this.projection = new LedgerProjection();
    this._policy = new EconomicPolicy();
    this._revenueService = revenueService;
    this._revenueSurfaces = revenueSurfaces;
    this._feedbackHeuristic = feedbackHeuristic ?? new TaskFeedbackHeuristic();
    this.router = new ValueRouter(this._feedbackHeuristic);

    // Wire ledger projection to receive spend/income events
    this.projection.wire(spendTracker);

    this.logger.info('EconomicStateService initialized');
  }

  /**
   * Build an immutable EconomicState snapshot from current live data.
   * Pure aggregation — SpendTracker is the source of truth for financial data,
   * ConwayAutomaton is the source of truth for survival tier.
   */
  snapshot(): EconomicState {
    const agg = this.spendTracker.aggregates();
    const tier = this.automaton.currentTier();

    return buildEconomicState({
      balanceCents: agg.netBalanceCents as unknown as number,
      totalSpendCents: agg.totalSpendCents as unknown as number,
      totalIncomeCents: agg.totalIncomeCents as unknown as number,
      burnRateCentsPerDay: agg.burnRateCentsPerDay,
      dailyIncomeCents: agg.dailyIncomeCents as unknown as number,
      survivalTier: tier,
    });
  }

  /**
   * Get a gate decision for inference — consumed by AgentLoop pre-loop check.
   * Combines SurvivalGate enforcement with economic state analysis.
   */
  getGateDecision(requestedModel?: string): EconomicGateDecision {
    const state = this.snapshot();
    const health = classifyHealth(state);
    const tier = state.survivalTier;
    const constraints = TIER_CONSTRAINTS[tier];

    // Dead → hard block
    if (tier === 'dead') {
      return {
        allowed: false,
        reason: 'Agent is dead — all inference blocked. Economic reserves exhausted.',
        action: 'block',
        tier,
        maxContextTokens: 0,
        health,
      };
    }

    // Terminal → block unless seeking income
    if (tier === 'terminal') {
      return {
        allowed: false,
        reason: `Terminal economic state (balance: ${state.balanceCents}¢, runway: ${state.survivalDays}d). Only income-seeking operations allowed.`,
        action: 'block',
        tier,
        maxContextTokens: constraints.maxContextTokens,
        health,
      };
    }

    // If a specific model is requested, check if it's allowed
    if (requestedModel) {
      const enforcement = this.gate.enforce('infer', state, { model: requestedModel });
      if (!enforcement.allowed) {
        return {
          allowed: true, // Allow inference, but with substitution
          reason: enforcement.reason ?? `Model '${requestedModel}' not allowed at tier '${tier}'`,
          action: 'restrict',
          suggestedModel: enforcement.substitute,
          tier,
          maxContextTokens: constraints.maxContextTokens,
          health,
        };
      }
    }

    // Critical → allow but with strong restrictions
    if (tier === 'critical') {
      return {
        allowed: true,
        reason: `Critical economic state — use minimal resources. Balance: ${state.balanceCents}¢`,
        action: 'restrict',
        suggestedModel: constraints.allowedModels[0],
        tier,
        maxContextTokens: constraints.maxContextTokens,
        health,
      };
    }

    // Normal/Thriving/Frugal → allow
    return {
      allowed: true,
      reason: `Economic health: ${health}. Balance: ${state.balanceCents}¢, runway: ${state.survivalDays}d`,
      action: 'allow',
      tier,
      maxContextTokens: constraints.maxContextTokens,
      health,
    };
  }

  /**
   * Get a routing decision for a task — consumed by AgentLoop or task queue.
   */
  getTaskRouting(task: TaskDescriptor): RoutingDecision {
    return this.router.getRoutingDecision(task, this.snapshot(), this.getCurrentMode());
  }

  /**
   * Get human-readable economic narrative — for UI/logs.
   */
  getNarrative(): EconomicNarrative {
    return this.narrator.narrate(this.snapshot());
  }

  /**
   * Get the current economic health classification.
   */
  getHealth(): EconomicHealth {
    return classifyHealth(this.snapshot());
  }

  /**
   * Verify the integrity of the projected ledger chain.
   */
  verifyLedger(): boolean {
    return this.projection.verify();
  }

  /**
   * Get the ledger projection for inspection.
   */
  getLedgerProjection(): LedgerProjection {
    return this.projection;
  }

  /**
   * Evaluate if the agent can afford to replicate (spawn a child).
   * Checks if balance is above the requested funding + a safety buffer (Round 18.6).
   */
  evaluateLineageViability(requestedFundingCents: number): { viable: boolean; reason: string } {
    const state = this.snapshot();
    
    if (state.survivalTier === 'dead' || state.survivalTier === 'terminal') {
      return { viable: false, reason: `Cannot replicate from tier: ${state.survivalTier}` };
    }

    // Safety buffer: 1000 cents ($10), so parent isn't drained completely
    const required = requestedFundingCents + 1000;
    const available = state.balanceCents;
    
    if (available < required) {
      return { 
        viable: false, 
        reason: `Insufficient funds. Have ${available}¢, need ${required}¢ (funding + 1000¢ safety buffer)` 
      };
    }
    
    return { viable: true, reason: 'Viable' };
  }

  // ── Round 15.8: RuntimeMode + Policy ────────────────────────────────

  /**
   * Get the current runtime mode resolved from survival tier.
   * Consumers (AgentLoop, TaskQueue) use this to adjust behavior.
   */
  getCurrentMode(): RuntimeMode {
    return resolveRuntimeMode(this.automaton.currentTier());
  }

  /**
   * Get the shared EconomicPolicy instance for audit trail access.
   */
  getPolicy(): EconomicPolicy {
    return this._policy;
  }

  /**
   * Get the current survival tier directly.
   */
  getCurrentTier(): SurvivalTier {
    return this.automaton.currentTier();
  }

  /**
   * Get recent decision audit trail.
   */
  getAuditTrail(limit?: number): readonly DecisionRecord[] {
    return this._policy.getTrail(limit);
  }

  // ── Round 16.9: Unified Projection + Revenue + Survival ─────────────

  /**
   * Get the canonical unified economic projection.
   * Merges SpendTracker (spend truth) + RevenueService (revenue truth)
   * + ConwayAutomaton (tier truth) into one canonical view.
   *
   * ALL consumers (agenda, governance, routing) should read this,
   * not assemble their own economic truth.
   */
  getProjection(): EconomicProjection {
    const agg = this.spendTracker.aggregates();
    const tier = this.automaton.currentTier();
    const revenueCents = this._revenueService?.totalRevenueCents() ?? (agg.totalIncomeCents as unknown as number);
    const revenueBySource = this._revenueService?.revenueBySource() ?? {};
    const spendCents = agg.totalSpendCents as unknown as number;
    const balanceCents = agg.netBalanceCents as unknown as number;
    const burnRate = agg.burnRateCentsPerDay;
    const dailyRevenue = agg.dailyIncomeCents as unknown as number;
    const netFlow = dailyRevenue - burnRate;
    const runwayDays = burnRate > 0 ? Math.floor(balanceCents / burnRate) : (balanceCents > 0 ? 999 : 0);
    const reserveCents = Math.max(0, balanceCents - 1_000); // MIN_OPERATING_RESERVE

    return Object.freeze({
      totalRevenueCents: revenueCents,
      totalSpendCents: spendCents,
      currentBalanceCents: balanceCents,
      reserveCents,
      burnRateCentsPerDay: burnRate,
      dailyRevenueCents: dailyRevenue,
      netFlowCentsPerDay: netFlow,
      runwayDays,
      survivalTier: tier,
      isSelfSustaining: netFlow >= 0 && balanceCents > 0,
      revenueBySource,
      projectedAt: new Date().toISOString(),
    });
  }

  /**
   * Record a revenue event via the independent revenue path.
   * If a RevenueSurfaceRegistry is available, also records the payment there.
   */
  recordRevenue(event: RevenueEvent): void {
    if (!this._revenueService) {
      throw new Error('RevenueService not configured — cannot record revenue');
    }
    this._revenueService.recordRevenueEvent(event);
    this.logger.info(`Revenue recorded: ${event.amountCents}¢ from ${event.source}`);
  }

  /**
   * Get comprehensive survival state summary.
   */
  currentSurvivalState(): SurvivalStateSummary {
    const state = this.snapshot();
    const tier = state.survivalTier;
    return {
      tier,
      health: classifyHealth(state),
      constraints: TIER_CONSTRAINTS[tier],
      projection: this.getProjection(),
      isEmergency: state.balanceCents <= 0 || tier === 'dead' || tier === 'terminal',
    };
  }

  /**
   * Get the RevenueService (if configured).
   */
  getRevenueService(): RevenueService | undefined {
    return this._revenueService;
  }

  /**
   * Get the TaskFeedbackHeuristic to analyze and track task completion events.
   */
  getFeedbackHeuristic(): TaskFeedbackHeuristic {
    return this._feedbackHeuristic;
  }
}
