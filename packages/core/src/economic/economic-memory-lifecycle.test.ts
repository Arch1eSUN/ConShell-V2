/**
 * Round 16.0 — Economic Memory, Lifecycle & Adaptive Routing Tests
 *
 * T8: ~25 tests covering:
 *   - EconomicMemoryStore (ingest, stats, top/worst, realization gap)
 *   - ValueLifecycleTracker (stages, dual-track, gap)
 *   - TaskFeedbackHeuristic delegate mode (short+long mix, mode-sensitive)
 *   - generateEconomicPerformanceReport
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomicMemoryStore } from './economic-memory-store.js';
import { ValueLifecycleTracker } from './value-lifecycle-tracker.js';
import { TaskFeedbackHeuristic } from './task-feedback-heuristic.js';
import { generateEconomicPerformanceReport } from './economic-report.js';
import type { TaskCompletionEvent, ValueRealizationEvent, RevenueEvent } from './value-events.js';
import type { RuntimeMode } from './economic-policy.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeCompletion(overrides: Partial<TaskCompletionEvent> = {}): TaskCompletionEvent {
  return {
    type: 'task_completion',
    taskId: `task-${Math.random().toString(36).slice(2, 8)}`,
    taskName: 'test-task',
    success: true,
    actualCostCents: 10,
    revenueGenerated: false,
    netValueCents: -10,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeRealization(overrides: Partial<ValueRealizationEvent> = {}): ValueRealizationEvent {
  return {
    type: 'value_realization',
    taskId: 'task-1',
    taskName: 'test-task',
    realizedValueCents: 50,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeRevenue(overrides: Partial<RevenueEvent> = {}): RevenueEvent {
  return {
    type: 'revenue',
    taskId: 'task-1',
    taskName: 'test-task',
    amountCents: 100,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
//  A) EconomicMemoryStore
// ══════════════════════════════════════════════════════════════════════

describe('EconomicMemoryStore', () => {
  let store: EconomicMemoryStore;

  beforeEach(() => {
    store = new EconomicMemoryStore();
  });

  it('starts empty', () => {
    expect(store.size).toBe(0);
    expect(store.getAllStats()).toHaveLength(0);
  });

  it('ingests a TaskCompletionEvent and creates a record', () => {
    store.ingest(makeCompletion({ success: true, actualCostCents: 20, netValueCents: 5 }), {
      taskType: 'inference', taskName: 'summarize', mode: 'normal',
    });

    expect(store.size).toBe(1);
    const stats = store.getStats({ taskName: 'summarize' });
    expect(stats).toHaveLength(1);
    expect(stats[0].attempts).toBe(1);
    expect(stats[0].successes).toBe(1);
    expect(stats[0].totalCostCents).toBe(20);
    expect(stats[0].successRate).toBe(1);
  });

  it('tracks failures separately', () => {
    const meta = { taskType: 'tool_call', taskName: 'fetch', mode: 'normal' as RuntimeMode };
    store.ingest(makeCompletion({ success: true, actualCostCents: 10 }), meta);
    store.ingest(makeCompletion({ success: false, actualCostCents: 10 }), meta);
    store.ingest(makeCompletion({ success: false, actualCostCents: 10 }), meta);

    const stats = store.getStats({ taskName: 'fetch' });
    expect(stats[0].successes).toBe(1);
    expect(stats[0].failures).toBe(2);
    expect(stats[0].successRate).toBeCloseTo(1 / 3);
  });

  it('aggregates across three-layer key (taskType, taskName, mode)', () => {
    const meta1 = { taskType: 'inference', taskName: 'summarize', mode: 'normal' as RuntimeMode };
    const meta2 = { taskType: 'inference', taskName: 'summarize', mode: 'revenue-seeking' as RuntimeMode };

    store.ingest(makeCompletion({ success: true, actualCostCents: 10 }), meta1);
    store.ingest(makeCompletion({ success: true, actualCostCents: 20 }), meta2);

    // Two separate records (different mode)
    expect(store.size).toBe(2);

    // Filter by taskName only → both
    expect(store.getStats({ taskName: 'summarize' })).toHaveLength(2);

    // Filter by mode → one each
    expect(store.getStats({ mode: 'normal' })).toHaveLength(1);
    expect(store.getStats({ mode: 'revenue-seeking' })).toHaveLength(1);
  });

  it('ingests ValueRealizationEvent – updates realizationCount', () => {
    const meta = { taskType: 'inference', taskName: 'deploy', mode: 'normal' as RuntimeMode };
    store.ingest(makeCompletion({ success: true }), meta);
    store.ingest(makeRealization(), meta);

    const stats = store.getStats({ taskName: 'deploy' });
    expect(stats[0].realizationCount).toBe(1);
    expect(stats[0].realizationRate).toBe(1);
  });

  it('ingests RevenueEvent – updates recognitionCount and totalRevenueCents', () => {
    const meta = { taskType: 'inference', taskName: 'bill', mode: 'normal' as RuntimeMode };
    store.ingest(makeCompletion({ success: true }), meta);
    store.ingest(makeRealization(), meta);
    store.ingest(makeRevenue({ amountCents: 200 }), meta);

    const stats = store.getStats({ taskName: 'bill' });
    expect(stats[0].recognitionCount).toBe(1);
    expect(stats[0].revenueRecognitionRate).toBe(1);
    expect(stats[0].totalRevenueCents).toBe(200);
  });

  it('getTopPerformers returns highest avgNetValue tasks', () => {
    const metaGood = { taskType: 'inference', taskName: 'profitable', mode: 'normal' as RuntimeMode };
    const metaBad = { taskType: 'tool_call', taskName: 'costly', mode: 'normal' as RuntimeMode };

    // Profitable: 2 successes with positive revenue
    for (let i = 0; i < 2; i++) {
      store.ingest(makeCompletion({
        success: true, actualCostCents: 5,
        netValueCents: 50, revenueGenerated: true,
      }), metaGood);
    }

    // Costly: 2 failures with high cost
    for (let i = 0; i < 2; i++) {
      store.ingest(makeCompletion({
        success: false, actualCostCents: 100, netValueCents: -100,
      }), metaBad);
    }

    const top = store.getTopPerformers(1);
    expect(top).toHaveLength(1);
    expect(top[0].key.taskName).toBe('profitable');

    const worst = store.getWorstPerformers(1);
    expect(worst).toHaveLength(1);
    expect(worst[0].key.taskName).toBe('costly');
  });

  it('getRealizationGap computes correctly', () => {
    const meta = { taskType: 'inference', taskName: 'task', mode: 'normal' as RuntimeMode };
    for (let i = 0; i < 10; i++) {
      store.ingest(makeCompletion({ success: true }), meta);
    }
    for (let i = 0; i < 3; i++) {
      store.ingest(makeRealization(), meta);
    }

    const gap = store.getRealizationGap();
    expect(gap.completed).toBe(10);
    expect(gap.realized).toBe(3);
    expect(gap.gapPct).toBe(70);
  });
});

// ══════════════════════════════════════════════════════════════════════
//  B) ValueLifecycleTracker
// ══════════════════════════════════════════════════════════════════════

describe('ValueLifecycleTracker', () => {
  let tracker: ValueLifecycleTracker;

  beforeEach(() => {
    tracker = new ValueLifecycleTracker();
  });

  it('plans a task at planned stage', () => {
    tracker.plan('t1', 'task one', 'inference', false);
    const entry = tracker.getEntry('t1');
    expect(entry).toBeDefined();
    expect(entry!.currentStage).toBe('planned');
    expect(entry!.track).toBe('non-revenue');
  });

  it('revenue track advances through all 5 stages', () => {
    tracker.plan('t1', 'rev task', 'inference', true);

    expect(tracker.advance('t1', 'completed')).toBe(true);
    expect(tracker.advance('t1', 'realized')).toBe(true);
    expect(tracker.advance('t1', 'recognized')).toBe(true);
    expect(tracker.advance('t1', 'retained')).toBe(true);

    const entry = tracker.getEntry('t1');
    expect(entry!.currentStage).toBe('retained');
    expect(entry!.stages.planned).toBeDefined();
    expect(entry!.stages.completed).toBeDefined();
    expect(entry!.stages.realized).toBeDefined();
    expect(entry!.stages.recognized).toBeDefined();
    expect(entry!.stages.retained).toBeDefined();
  });

  it('non-revenue track skips realized/recognized', () => {
    tracker.plan('t1', 'non-rev', 'tool_call', false);

    expect(tracker.advance('t1', 'completed')).toBe(true);
    // Cannot go to realized on non-revenue track
    expect(tracker.advance('t1', 'realized')).toBe(false);
    expect(tracker.advance('t1', 'recognized')).toBe(false);
    // Can go to retained directly
    expect(tracker.advance('t1', 'retained')).toBe(true);
    expect(tracker.getEntry('t1')!.currentStage).toBe('retained');
  });

  it('rejects backward transitions', () => {
    tracker.plan('t1', 'task', 'inference', true);
    tracker.advance('t1', 'completed');
    expect(tracker.advance('t1', 'planned')).toBe(false);
    expect(tracker.getEntry('t1')!.currentStage).toBe('completed');
  });

  it('getRealizationGap counts revenue-track completed vs realized', () => {
    // 5 revenue tasks: 3 completed, 2 realized
    for (let i = 0; i < 5; i++) {
      tracker.plan(`r${i}`, `rev-${i}`, 'inference', true);
      tracker.advance(`r${i}`, 'completed');
    }
    tracker.advance('r0', 'realized');
    tracker.advance('r1', 'realized');

    // 3 non-revenue tasks (should not affect gap)
    for (let i = 0; i < 3; i++) {
      tracker.plan(`nr${i}`, `non-${i}`, 'tool_call', false);
      tracker.advance(`nr${i}`, 'completed');
    }

    const gap = tracker.getRealizationGap();
    expect(gap.total).toBe(5);
    expect(gap.realized).toBe(2);
    expect(gap.gapPct).toBe(60);
  });

  it('getStageDistribution returns correct counts', () => {
    tracker.plan('t1', 'a', 'inf', true);
    tracker.plan('t2', 'b', 'inf', true);
    tracker.plan('t3', 'c', 'inf', false);
    tracker.advance('t1', 'completed');
    tracker.advance('t2', 'completed');
    tracker.advance('t2', 'realized');

    const dist = tracker.getStageDistribution();
    expect(dist.planned).toBe(1);     // t3
    expect(dist.completed).toBe(1);   // t1
    expect(dist.realized).toBe(1);    // t2
    expect(dist.recognized).toBe(0);
    expect(dist.retained).toBe(0);
  });

  it('respects maxEntries by evicting oldest', () => {
    const small = new ValueLifecycleTracker(3);
    small.plan('t1', 'a', 'inf', false);
    small.plan('t2', 'b', 'inf', false);
    small.plan('t3', 'c', 'inf', false);
    small.plan('t4', 'd', 'inf', false); // should evict t1

    expect(small.size).toBe(3);
    expect(small.getEntry('t1')).toBeUndefined();
    expect(small.getEntry('t4')).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
//  C) TaskFeedbackHeuristic — Delegate Mode
// ══════════════════════════════════════════════════════════════════════

describe('TaskFeedbackHeuristic (delegate mode)', () => {
  let heuristic: TaskFeedbackHeuristic;
  let memory: EconomicMemoryStore;

  beforeEach(() => {
    heuristic = new TaskFeedbackHeuristic();
    memory = new EconomicMemoryStore();
    heuristic.setMemoryStore(memory);
  });

  it('returns 0 for unknown task with no memory', () => {
    expect(heuristic.getPriorityAdjustment('unknown', false)).toBe(0);
  });

  it('uses long-term memory when short-term samples < 5', () => {
    // Load long-term memory with 10 successful, high-revenue events
    const meta = { taskType: 'inference', taskName: 'profitable', mode: 'normal' as RuntimeMode };
    for (let i = 0; i < 10; i++) {
      memory.ingest(makeCompletion({
        taskName: 'profitable', success: true, actualCostCents: 5,
        netValueCents: 100, revenueGenerated: true,
      }), meta);
    }

    // Short-term: only 1 sample
    heuristic.ingest(makeCompletion({
      taskName: 'profitable', success: true, actualCostCents: 5,
      netValueCents: 100, revenueGenerated: true,
    }));

    // Should get a positive adjustment (70% long-term weight)
    const adj = heuristic.getPriorityAdjustment('profitable', true);
    expect(adj).toBeGreaterThan(0);
  });

  it('prefers short-term data when samples >= 5', () => {
    // Long-term: high revenue task
    const meta = { taskType: 'inference', taskName: 'task-a', mode: 'normal' as RuntimeMode };
    for (let i = 0; i < 10; i++) {
      memory.ingest(makeCompletion({
        taskName: 'task-a', success: true, actualCostCents: 5,
        netValueCents: 100, revenueGenerated: true,
      }), meta);
    }

    // Short-term: 6 failures (should override long-term positive)
    for (let i = 0; i < 6; i++) {
      heuristic.ingest(makeCompletion({
        taskName: 'task-a', success: false, actualCostCents: 200,
      }));
    }

    const adj = heuristic.getPriorityAdjustment('task-a', false);
    // Short-term dominates: 70% of -10 (failure penalty) + 30% of long-term positive
    expect(adj).toBeLessThan(0);
  });

  it('getPriorityAdjustmentForMode adds revenue-seeking bonus for high realization', () => {
    const meta = { taskType: 'inference', taskName: 'good-realizer', mode: 'revenue-seeking' as RuntimeMode };

    // Create memory: 10 successes + 8 realizations → 80% realization rate
    for (let i = 0; i < 10; i++) {
      memory.ingest(makeCompletion({
        taskName: 'good-realizer', success: true, actualCostCents: 5,
        netValueCents: 50, revenueGenerated: true,
      }), meta);
    }
    for (let i = 0; i < 8; i++) {
      memory.ingest(makeRealization({ taskName: 'good-realizer' }), meta);
    }

    const adj = heuristic.getPriorityAdjustmentForMode(
      'inference', 'good-realizer', true, 'revenue-seeking',
    );
    // Should include +15 mode-sensitive bonus
    expect(adj).toBeGreaterThanOrEqual(15);
  });

  it('getPriorityAdjustmentForMode adds survival-recovery penalty for low realization', () => {
    const meta = { taskType: 'inference', taskName: 'bad-realizer', mode: 'survival-recovery' as RuntimeMode };

    // 10 successes + 1 realization → 10% realization rate
    for (let i = 0; i < 10; i++) {
      memory.ingest(makeCompletion({
        taskName: 'bad-realizer', success: true, actualCostCents: 5,
        netValueCents: 50, revenueGenerated: true,
      }), meta);
    }
    memory.ingest(makeRealization({ taskName: 'bad-realizer' }), meta);

    const adj = heuristic.getPriorityAdjustmentForMode(
      'inference', 'bad-realizer', false, 'survival-recovery',
    );
    // Should include -15 mode-sensitive penalty
    expect(adj).toBeLessThanOrEqual(-15);
  });
});

// ══════════════════════════════════════════════════════════════════════
//  D) generateEconomicPerformanceReport
// ══════════════════════════════════════════════════════════════════════

describe('generateEconomicPerformanceReport', () => {
  it('generates a complete report from memory + lifecycle data', () => {
    const memory = new EconomicMemoryStore();
    const lifecycle = new ValueLifecycleTracker();

    // Populate memory
    const meta = { taskType: 'inference', taskName: 'task-a', mode: 'normal' as RuntimeMode };
    for (let i = 0; i < 5; i++) {
      memory.ingest(makeCompletion({
        success: true, actualCostCents: 10, netValueCents: 20, revenueGenerated: true,
      }), meta);
    }
    memory.ingest(makeCompletion({ success: false, actualCostCents: 10 }), meta);

    // Populate lifecycle
    lifecycle.plan('t1', 'task-a', 'inference', true);
    lifecycle.advance('t1', 'completed');
    lifecycle.plan('t2', 'task-b', 'tool_call', false);

    const report = generateEconomicPerformanceReport(memory, lifecycle);

    expect(report.generatedAt).toBeDefined();
    expect(report.summary.totalTasks).toBe(6);
    expect(report.summary.successRate).toBeCloseTo(5 / 6);
    expect(report.summary.totalCostCents).toBe(60);
    expect(report.summary.netValueCents).toBe(report.summary.totalRevenueCents - 60);
    expect(report.lifecycleDistribution.planned).toBe(1);    // t2
    expect(report.lifecycleDistribution.completed).toBe(1);  // t1
    expect(report.modeBreakdown.normal).toBeDefined();
    expect(report.modeBreakdown.normal!.tasks).toBe(6);
  });

  it('handles empty data gracefully', () => {
    const report = generateEconomicPerformanceReport(
      new EconomicMemoryStore(), new ValueLifecycleTracker(),
    );
    expect(report.summary.totalTasks).toBe(0);
    expect(report.summary.successRate).toBe(0);
    expect(report.realizationGap.completed).toBe(0);
    expect(report.lifecycleDistribution.planned).toBe(0);
  });

  it('includes mode breakdown per RuntimeMode', () => {
    const memory = new EconomicMemoryStore();
    const lifecycle = new ValueLifecycleTracker();

    memory.ingest(makeCompletion({ success: true, actualCostCents: 10 }), {
      taskType: 'inference', taskName: 'a', mode: 'normal',
    });
    memory.ingest(makeCompletion({ success: true, actualCostCents: 20 }), {
      taskType: 'inference', taskName: 'b', mode: 'revenue-seeking',
    });

    const report = generateEconomicPerformanceReport(memory, lifecycle);
    expect(report.modeBreakdown.normal).toBeDefined();
    expect(report.modeBreakdown['revenue-seeking']).toBeDefined();
    expect(report.modeBreakdown.normal!.tasks).toBe(1);
    expect(report.modeBreakdown['revenue-seeking']!.tasks).toBe(1);
  });
});
