/**
 * Round 20.1 / 20.2 — AgendaArbiter (Expanded)
 *
 * Receives already-admitted tasks (from TaskAdmissionGate) and ranks them
 * by priority. Supports re-prioritization triggered by lifecycle events
 * or economic state changes.
 *
 * Round 20.2: reprioritize() now accepts EconomicProjection as canonical
 * context, enabling economic state to influence agenda ranking (G3).
 */
import type { SuggestedPriority, TaskAdmissionResult } from '../economic/task-admission-gate.js';
import type { EconomicProjection } from '../economic/economic-state-service.js';

// ── Priority weight map ─────────────────────────────────────────────

const PRIORITY_WEIGHTS: Record<SuggestedPriority, number> = {
  'immediate': 100,
  'survival-driven': 95,
  'opportunity-driven': 80,
  'high': 70,
  'normal': 50,
  'deferred': 20,
};

// ── Ranked Task Item ────────────────────────────────────────────────

export interface RankedTask {
  /** Task ID */
  readonly taskId: string;
  /** Admission result from TaskAdmissionGate */
  readonly admission: TaskAdmissionResult;
  /** Computed rank score (higher = execute sooner) */
  readonly rankScore: number;
  /** Position in queue (0-indexed) */
  position: number;
}

// ── Reprioritize Trigger ────────────────────────────────────────────

export type ReprioritizeTrigger =
  | 'tick'
  | 'economic_state_changed'
  | 'revenue_task_arrived'
  | 'governance_decision'
  | 'runtime_degraded'
  | 'manual';

export interface ReprioritizeRecord {
  readonly trigger: ReprioritizeTrigger;
  readonly timestamp: string;
  readonly taskCount: number;
  readonly topTaskId?: string;
  /** Round 20.2: economic context that influenced this reprioritization */
  readonly economicContext?: {
    readonly survivalTier: string;
    readonly runwayDays: number;
    readonly reserveCents: number;
  };
}

// ── AgendaArbiter ───────────────────────────────────────────────────

export class AgendaArbiter {
  private _queue: RankedTask[] = [];
  private _reprioritizeLog: ReprioritizeRecord[] = [];

  /**
   * Set the task queue with admitted tasks and rank them.
   */
  rank(admittedResults: readonly TaskAdmissionResult[]): RankedTask[] {
    this._queue = admittedResults.map(admission => ({
      taskId: admission.netUtilityCents.toString() + '-' + admission.admissionTimestamp,
      admission,
      rankScore: this.computeScore(admission),
      position: 0,
    }));

    // Re-derive taskId from admission result
    this._queue = admittedResults.map(admission => ({
      taskId: this.extractTaskId(admission),
      admission,
      rankScore: this.computeScore(admission),
      position: 0,
    }));

    this.sortAndAssignPositions();
    return [...this._queue];
  }

  /**
   * Re-prioritize the current queue. Called by LifeCycleEngine on
   * tick or event. Records the reprioritization reason.
   *
   * Round 20.2: Accepts optional EconomicProjection as canonical context.
   * When provided, economic pressure factors influence rank scoring.
   */
  reprioritize(trigger: ReprioritizeTrigger, projection?: EconomicProjection): RankedTask[] {
    // Re-score all tasks with optional economic context
    for (const task of this._queue) {
      (task as { rankScore: number }).rankScore = this.computeScore(task.admission, projection);
    }

    this.sortAndAssignPositions();

    this._reprioritizeLog.push({
      trigger,
      timestamp: new Date().toISOString(),
      taskCount: this._queue.length,
      topTaskId: this._queue[0]?.taskId,
      economicContext: projection ? {
        survivalTier: projection.survivalTier,
        runwayDays: projection.runwayDays,
        reserveCents: projection.reserveCents,
      } : undefined,
    });

    return [...this._queue];
  }

  /**
   * Add a single admitted task to the existing queue and re-sort.
   */
  insert(admission: TaskAdmissionResult): RankedTask[] {
    const newTask: RankedTask = {
      taskId: this.extractTaskId(admission),
      admission,
      rankScore: this.computeScore(admission),
      position: 0,
    };

    this._queue.push(newTask);
    this.sortAndAssignPositions();
    return [...this._queue];
  }

  /**
   * Remove a task from the queue by ID.
   */
  remove(taskId: string): boolean {
    const before = this._queue.length;
    this._queue = this._queue.filter(t => t.taskId !== taskId);
    if (this._queue.length < before) {
      this.sortAndAssignPositions();
      return true;
    }
    return false;
  }

  /**
   * Get the current ranked queue.
   */
  getQueue(): readonly RankedTask[] {
    return this._queue;
  }

  /**
   * Get the top N tasks ready for execution.
   */
  top(n: number): readonly RankedTask[] {
    return this._queue.slice(0, n);
  }

  /**
   * Get re-prioritization history.
   */
  getReprioritizeLog(limit?: number): readonly ReprioritizeRecord[] {
    if (limit) return this._reprioritizeLog.slice(-limit);
    return [...this._reprioritizeLog];
  }

  /**
   * Queue length.
   */
  get length(): number {
    return this._queue.length;
  }

  // ── Private ───────────────────────────────────────────────────────

  /**
   * Compute a composite rank score for sorting.
   *
   * Score components:
   * - Priority weight (0-100)
   * - Net utility normalized (0-30)
   * - Survival override bonus (+25)
   * - Round 20.2: Reserve pressure bonus (+15 for revenue tasks under pressure)
   * - Round 20.2: Runway urgency factor (+10 when runway < 7 days)
   */
  private computeScore(admission: TaskAdmissionResult, projection?: EconomicProjection): number {
    let score = PRIORITY_WEIGHTS[admission.suggestedPriority] ?? 50;

    // Net utility contribution (capped at ±30)
    const utilityNorm = Math.min(30, Math.max(-30, admission.netUtilityCents / 100));
    score += utilityNorm;

    // Survival override bonus
    if (admission.survivalOverride) score += 25;

    // Round 20.2: Economic pressure factors
    if (projection) {
      // Reserve pressure: boost revenue-bearing tasks when reserve is low
      const underPressure = projection.survivalTier === 'critical' ||
        projection.survivalTier === 'terminal' ||
        projection.survivalTier === 'frugal';

      if (underPressure && admission.netUtilityCents > 0) {
        score += 15; // Revenue tasks get priority under economic pressure
      }

      // Runway urgency: boost all survival-relevant tasks when runway is short
      if (projection.runwayDays <= 7) {
        score += 10;
      }

      // Penalize high-cost tasks when reserve is very low
      if (projection.reserveCents < 5000 && admission.netUtilityCents < -500) {
        score -= 20; // Expensive non-revenue tasks deprioritized
      }
    }

    return Math.round(score * 100) / 100;
  }

  private sortAndAssignPositions(): void {
    this._queue.sort((a, b) => b.rankScore - a.rankScore);
    this._queue.forEach((task, i) => { task.position = i; });
  }

  private extractTaskId(admission: TaskAdmissionResult): string {
    // Try to extract from profitability result, or generate from timestamp
    return admission.profitabilityResult?.commitmentId ??
      `task-${admission.admissionTimestamp}`;
  }
}
