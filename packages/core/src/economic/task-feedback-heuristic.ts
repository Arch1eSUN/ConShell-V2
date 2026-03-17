/**
 * Round 16.0 — Task Feedback Heuristic (Delegate Mode)
 *
 * Explainable heuristic that adjusts future task priority
 * based on short-term outcomes AND long-term economic memory.
 *
 * Delegate pattern: internally holds EconomicMemoryStore reference,
 * external interface unchanged (getPriorityAdjustment) plus new
 * mode-sensitive variant (getPriorityAdjustmentForMode).
 *
 * Mixing strategy:
 *   - Short-term samples ≥ 5 → weight 70% short, 30% long
 *   - Short-term samples < 5 → weight 30% short, 70% long
 *
 * Mode-sensitive bonuses:
 *   - revenue-seeking: high realization → +15
 *   - survival-recovery: low realization → -15
 */
import type { TaskCompletionEvent } from './value-events.js';
import type { EconomicMemoryStore } from './economic-memory-store.js';
import type { RuntimeMode } from './economic-policy.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface TaskTypeRecord {
  taskType: string;
  successCount: number;
  failCount: number;
  totalCostCents: number;
  totalRevenueCents: number;
}

// ── Heuristic ─────────────────────────────────────────────────────────

export class TaskFeedbackHeuristic {
  private records = new Map<string, TaskTypeRecord>();
  private _memoryStore?: EconomicMemoryStore;

  /** Inject long-term memory store (delegate pattern) */
  setMemoryStore(store: EconomicMemoryStore): void {
    this._memoryStore = store;
  }

  /** Ingest a task completion event */
  ingest(event: TaskCompletionEvent): void {
    const key = event.taskName;
    let rec = this.records.get(key);
    if (!rec) {
      rec = { taskType: key, successCount: 0, failCount: 0, totalCostCents: 0, totalRevenueCents: 0 };
      this.records.set(key, rec);
    }

    if (event.success) {
      rec.successCount++;
    } else {
      rec.failCount++;
    }
    rec.totalCostCents += event.actualCostCents;
    if (event.revenueGenerated && event.netValueCents > 0) {
      rec.totalRevenueCents += event.netValueCents;
    }
  }

  /**
   * Get a priority adjustment for a task type (original interface).
   * Now delegates to long-term memory when short-term data is sparse.
   */
  getPriorityAdjustment(taskType: string, isRevenueBearing: boolean): number {
    const shortAdj = this.computeShortTermAdjustment(taskType, isRevenueBearing);
    const longAdj = this.computeLongTermAdjustment(taskType);

    const shortSamples = this.getShortTermSamples(taskType);
    if (shortSamples >= 5) {
      // Sufficient short-term data: 70% short, 30% long
      return Math.round(shortAdj * 0.7 + longAdj * 0.3);
    } else if (shortSamples > 0 || longAdj !== 0) {
      // Sparse short-term: 30% short, 70% long
      return Math.round(shortAdj * 0.3 + longAdj * 0.7);
    }

    return 0;
  }

  /**
   * Mode-sensitive priority adjustment.
   * Adds mode-specific bonuses on top of the base adjustment.
   */
  getPriorityAdjustmentForMode(
    taskType: string, taskName: string,
    isRevenueBearing: boolean, mode: RuntimeMode,
  ): number {
    const base = this.getPriorityAdjustment(taskType, isRevenueBearing);

    if (!this._memoryStore) return base;

    // Check mode-specific memory for realization rate
    const modeRecords = this._memoryStore.getStats({ taskName, mode });
    if (modeRecords.length === 0) return base;

    const avgRealization = modeRecords.reduce((s, r) => s + r.realizationRate, 0) / modeRecords.length;

    if (mode === 'revenue-seeking' && avgRealization >= 0.6) {
      return base + 15; // bonus for high-realization in revenue-seeking
    }

    if (mode === 'survival-recovery' && avgRealization < 0.3) {
      return base - 15; // penalty for low-realization in survival-recovery
    }

    return base;
  }

  // ── Short-term computation (original logic) ─────────────────────────

  private getShortTermSamples(taskType: string): number {
    const rec = this.records.get(taskType);
    return rec ? rec.successCount + rec.failCount : 0;
  }

  private computeShortTermAdjustment(taskType: string, isRevenueBearing: boolean): number {
    const rec = this.records.get(taskType);
    if (!rec) return 0;

    const total = rec.successCount + rec.failCount;
    if (total === 0) return 0;

    const successRate = rec.successCount / total;
    const avgNetValue = rec.totalRevenueCents / total;

    // High-success revenue type → bonus
    if (isRevenueBearing && successRate >= 0.7 && avgNetValue > 0) {
      return Math.min(20, Math.round(avgNetValue / 10));
    }

    // High-failure rate → penalty
    if (successRate < 0.3 && total >= 3) {
      return -10;
    }

    // High cost, low success → mild penalty
    if (successRate < 0.5 && rec.totalCostCents / total > 100) {
      return -5;
    }

    return 0;
  }

  // ── Long-term computation (from EconomicMemoryStore) ────────────────

  private computeLongTermAdjustment(taskType: string): number {
    if (!this._memoryStore) return 0;

    const records = this._memoryStore.getStats({ taskName: taskType });
    if (records.length === 0) return 0;

    // Aggregate across all modes for this task type
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalNetValue = 0;

    for (const rec of records) {
      totalAttempts += rec.attempts;
      totalSuccesses += rec.successes;
      totalNetValue += rec.totalRevenueCents - rec.totalCostCents;
    }

    if (totalAttempts === 0) return 0;

    const successRate = totalSuccesses / totalAttempts;
    const avgNet = totalNetValue / totalAttempts;

    // High-success, positive value → long-term bonus
    if (successRate >= 0.7 && avgNet > 0) {
      return Math.min(15, Math.round(avgNet / 15));
    }

    // Low success, high cost → long-term penalty
    if (successRate < 0.3 && totalAttempts >= 5) {
      return -10;
    }

    if (successRate < 0.5 && avgNet < -50) {
      return -5;
    }

    return 0;
  }

  // ── Accessors ───────────────────────────────────────────────────────

  /** Get all tracked short-term records */
  getRecords(): readonly TaskTypeRecord[] {
    return [...this.records.values()];
  }

  /** Get record for a specific task type */
  getRecord(taskType: string): TaskTypeRecord | undefined {
    return this.records.get(taskType);
  }

  /** Clear all short-term records */
  clear(): void {
    this.records.clear();
  }
}

