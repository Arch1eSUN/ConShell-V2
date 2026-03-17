/**
 * Round 16.0 — Economic Performance Report
 *
 * Generates a structured, explainable performance report from
 * EconomicMemoryStore and ValueLifecycleTracker data.
 */
import type { EconomicMemoryStore, MemoryRecordStats } from './economic-memory-store.js';
import type { ValueLifecycleTracker, LifecycleStage } from './value-lifecycle-tracker.js';
import type { RuntimeMode } from './economic-policy.js';

// ── Report Types ──────────────────────────────────────────────────────

export interface EconomicPerformanceReport {
  readonly generatedAt: string;
  readonly summary: {
    readonly totalTasks: number;
    readonly successRate: number;
    readonly totalCostCents: number;
    readonly totalRevenueCents: number;
    readonly netValueCents: number;
  };
  readonly topPerformers: readonly MemoryRecordStats[];
  readonly worstPerformers: readonly MemoryRecordStats[];
  readonly realizationGap: {
    readonly completed: number;
    readonly realized: number;
    readonly gapPct: number;
  };
  readonly modeBreakdown: Partial<Record<RuntimeMode, { tasks: number; avgNetValue: number }>>;
  readonly lifecycleDistribution: Record<LifecycleStage, number>;
}

// ── Generator ─────────────────────────────────────────────────────────

export function generateEconomicPerformanceReport(
  memory: EconomicMemoryStore,
  lifecycle: ValueLifecycleTracker,
): EconomicPerformanceReport {
  const allStats = memory.getAllStats();

  // Aggregate summary
  let totalTasks = 0;
  let totalSuccesses = 0;
  let totalCostCents = 0;
  let totalRevenueCents = 0;

  // Mode breakdown accumulators
  const modeAcc = new Map<RuntimeMode, { tasks: number; totalNetValue: number }>();

  for (const rec of allStats) {
    const tasks = rec.successes + rec.failures;
    totalTasks += tasks;
    totalSuccesses += rec.successes;
    totalCostCents += rec.totalCostCents;
    totalRevenueCents += rec.totalRevenueCents;

    // Mode breakdown
    const mode = rec.key.mode;
    let m = modeAcc.get(mode);
    if (!m) {
      m = { tasks: 0, totalNetValue: 0 };
      modeAcc.set(mode, m);
    }
    m.tasks += tasks;
    m.totalNetValue += rec.totalRevenueCents - rec.totalCostCents;
  }

  // Build mode breakdown
  const modeBreakdown: Partial<Record<RuntimeMode, { tasks: number; avgNetValue: number }>> = {};
  for (const [mode, acc] of modeAcc) {
    modeBreakdown[mode] = {
      tasks: acc.tasks,
      avgNetValue: acc.tasks > 0 ? Math.round(acc.totalNetValue / acc.tasks) : 0,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks,
      successRate: totalTasks > 0 ? totalSuccesses / totalTasks : 0,
      totalCostCents,
      totalRevenueCents,
      netValueCents: totalRevenueCents - totalCostCents,
    },
    topPerformers: memory.getTopPerformers(5),
    worstPerformers: memory.getWorstPerformers(5),
    realizationGap: (() => {
      const gap = lifecycle.getRealizationGap();
      return { completed: gap.total, realized: gap.realized, gapPct: gap.gapPct };
    })(),
    modeBreakdown,
    lifecycleDistribution: lifecycle.getStageDistribution(),
  };
}
