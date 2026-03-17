/**
 * Round 16.0 — Economic Memory Store
 *
 * Long-term economic memory with three-layer aggregation:
 *   taskType → taskName → runtimeMode
 *
 * Ingests all ValueEvent types and maintains per-key statistics:
 *   attempts, success/fail, cost, revenue, realization, recognition.
 *
 * In-memory Map implementation + MemoryPersistence interface stub for
 * future SQLite backing.
 */
import type { ValueEvent, TaskCompletionEvent, RevenueEvent, ValueRealizationEvent } from './value-events.js';
import type { RuntimeMode } from './economic-policy.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface MemoryKey {
  readonly taskType: string;
  readonly taskName: string;
  readonly mode: RuntimeMode;
}

export interface MemoryRecord {
  key: MemoryKey;
  attempts: number;
  successes: number;
  failures: number;
  totalCostCents: number;
  totalRevenueCents: number;
  realizationCount: number;
  recognitionCount: number;
  lastSeen: string;
  sampleCount: number;
}

export interface MemoryRecordStats extends MemoryRecord {
  readonly successRate: number;
  readonly avgCostCents: number;
  readonly avgNetValueCents: number;
  readonly realizationRate: number;
  readonly revenueRecognitionRate: number;
}

// ── Persistence Interface (stub — not wired) ──────────────────────────

/**
 * Future SQLite persistence contract.
 *
 * Schema (not yet created):
 *   CREATE TABLE economic_memory (
 *     task_type    TEXT NOT NULL,
 *     task_name    TEXT NOT NULL,
 *     mode         TEXT NOT NULL,
 *     attempts     INTEGER DEFAULT 0,
 *     successes    INTEGER DEFAULT 0,
 *     failures     INTEGER DEFAULT 0,
 *     total_cost   INTEGER DEFAULT 0,
 *     total_revenue INTEGER DEFAULT 0,
 *     realization_count INTEGER DEFAULT 0,
 *     recognition_count INTEGER DEFAULT 0,
 *     last_seen    TEXT,
 *     sample_count INTEGER DEFAULT 0,
 *     PRIMARY KEY (task_type, task_name, mode)
 *   );
 */
export interface MemoryPersistence {
  save(records: readonly MemoryRecord[]): Promise<void>;
  load(): Promise<MemoryRecord[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────

function makeKey(taskType: string, taskName: string, mode: RuntimeMode): string {
  return `${taskType}:${taskName}:${mode}`;
}

function computeStats(rec: MemoryRecord): MemoryRecordStats {
  const total = rec.successes + rec.failures;
  return {
    ...rec,
    successRate: total > 0 ? rec.successes / total : 0,
    avgCostCents: total > 0 ? Math.round(rec.totalCostCents / total) : 0,
    avgNetValueCents: total > 0 ? Math.round((rec.totalRevenueCents - rec.totalCostCents) / total) : 0,
    realizationRate: rec.successes > 0 ? rec.realizationCount / rec.successes : 0,
    revenueRecognitionRate: rec.realizationCount > 0 ? rec.recognitionCount / rec.realizationCount : 0,
  };
}

// ── Store ──────────────────────────────────────────────────────────────

export class EconomicMemoryStore {
  private records = new Map<string, MemoryRecord>();

  /**
   * Ingest a ValueEvent into long-term memory.
   * Caller must provide current RuntimeMode and task metadata
   * for proper three-layer keying.
   */
  ingest(
    event: ValueEvent,
    meta: { taskType?: string; taskName?: string; mode: RuntimeMode },
  ): void {
    const taskType = meta.taskType ?? 'general';
    const taskName = meta.taskName ?? 'unknown';
    const key = makeKey(taskType, taskName, meta.mode);

    let rec = this.records.get(key);
    if (!rec) {
      rec = {
        key: { taskType, taskName, mode: meta.mode },
        attempts: 0, successes: 0, failures: 0,
        totalCostCents: 0, totalRevenueCents: 0,
        realizationCount: 0, recognitionCount: 0,
        lastSeen: event.timestamp, sampleCount: 0,
      };
      this.records.set(key, rec);
    }

    rec.lastSeen = event.timestamp;
    rec.sampleCount++;

    switch (event.type) {
      case 'task_completion':
        rec.attempts++;
        if (event.success) rec.successes++;
        else rec.failures++;
        rec.totalCostCents += event.actualCostCents;
        if (event.netValueCents > 0) rec.totalRevenueCents += event.netValueCents;
        break;

      case 'value_realization':
        rec.realizationCount++;
        break;

      case 'revenue':
        rec.recognitionCount++;
        rec.totalRevenueCents += event.amountCents;
        break;
    }
  }

  /**
   * Get stats for records matching a partial key filter.
   * Omitted fields match everything.
   */
  getStats(filter?: Partial<MemoryKey>): readonly MemoryRecordStats[] {
    const results: MemoryRecordStats[] = [];
    for (const rec of this.records.values()) {
      if (filter) {
        if (filter.taskType && rec.key.taskType !== filter.taskType) continue;
        if (filter.taskName && rec.key.taskName !== filter.taskName) continue;
        if (filter.mode && rec.key.mode !== filter.mode) continue;
      }
      results.push(computeStats(rec));
    }
    return results;
  }

  /** Get all memory records with computed stats */
  getAllStats(): readonly MemoryRecordStats[] {
    return this.getStats();
  }

  /** Top N performers by avgNetValueCents (desc) */
  getTopPerformers(n = 5): readonly MemoryRecordStats[] {
    return [...this.getAllStats()]
      .filter((r) => r.attempts >= 2)
      .sort((a, b) => b.avgNetValueCents - a.avgNetValueCents)
      .slice(0, n);
  }

  /** Worst N performers by avgNetValueCents (asc) */
  getWorstPerformers(n = 5): readonly MemoryRecordStats[] {
    return [...this.getAllStats()]
      .filter((r) => r.attempts >= 2)
      .sort((a, b) => a.avgNetValueCents - b.avgNetValueCents)
      .slice(0, n);
  }

  /** Realization gap: completed tasks vs realized value */
  getRealizationGap(): { completed: number; realized: number; gapPct: number } {
    let completed = 0;
    let realized = 0;
    for (const rec of this.records.values()) {
      completed += rec.successes;
      realized += rec.realizationCount;
    }
    return {
      completed,
      realized,
      gapPct: completed > 0 ? Math.round((1 - realized / completed) * 100) : 0,
    };
  }

  /** Get a specific record by exact key */
  getRecord(taskType: string, taskName: string, mode: RuntimeMode): MemoryRecordStats | undefined {
    const rec = this.records.get(makeKey(taskType, taskName, mode));
    return rec ? computeStats(rec) : undefined;
  }

  /** Total number of tracked keys */
  get size(): number {
    return this.records.size;
  }

  /** Clear all records (for testing) */
  clear(): void {
    this.records.clear();
  }
}
