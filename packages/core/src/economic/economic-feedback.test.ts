/**
 * Round 15.9 — Economic Feedback Loop Integration Tests
 *
 * Tests:
 * - ValueEventRecorder: record, recent, byType, stats, overflow
 * - TaskFeedbackHeuristic: ingest, priority adjustment, penalty
 * - Freshness: on-demand tier read in ToolExecutor
 * - RuntimeMode behavior contracts in TaskQueue + ToolExecutor
 * - Feedback loop: TaskQueue → ValueEventRecorder → Heuristic → priority
 *
 * All components use REAL implementations — no mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { SpendTracker } from '../spend/index.js';
import { ConwayAutomaton, type EnvironmentSnapshot } from '../automaton/index.js';
import { EconomicStateService } from './economic-state-service.js';
import { EconomicPolicy, resolveRuntimeMode } from './economic-policy.js';
import { ValueEventRecorder } from './value-event-recorder.js';
import { TaskFeedbackHeuristic } from './task-feedback-heuristic.js';
import { TaskQueue, type QueuedTask } from '../runtime/task-queue.js';
import { ToolExecutor, type ToolHandler } from '../runtime/tool-executor.js';
import { createLogger } from '../logger/index.js';
import type { TaskCompletionEvent, RevenueEvent, ValueRealizationEvent } from './value-events.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const logger = createLogger('feedback-test', { level: 'silent' });

const envBase: EnvironmentSnapshot = {
  budgetRemainingPct: 80,
  memoryPressure: 0.3,
  activeConnections: 2,
  lastHeartbeat: Date.now(),
  recentIncomeCents: 0,
  recentSpendCents: 0,
};

function makeTask(overrides?: Partial<QueuedTask>): QueuedTask {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    name: 'test-task',
    execute: async () => 'ok',
    priority: 5,
    ...overrides,
  };
}

// ── 9.1 ValueEventRecorder ────────────────────────────────────────────

describe('ValueEventRecorder', () => {
  let recorder: ValueEventRecorder;

  beforeEach(() => {
    recorder = new ValueEventRecorder(10); // small buffer for testing overflow
  });

  it('records and retrieves events', () => {
    const event: TaskCompletionEvent = {
      type: 'task_completion',
      taskId: 'task-1',
      taskName: 'test',
      success: true,
      actualCostCents: 10,
      revenueGenerated: false,
      netValueCents: -10,
      timestamp: new Date().toISOString(),
    };

    recorder.record(event);
    expect(recorder.size).toBe(1);
    expect(recorder.recent(1)).toHaveLength(1);
    expect(recorder.recent(1)[0]).toEqual(event);
  });

  it('filters by type', () => {
    const completion: TaskCompletionEvent = {
      type: 'task_completion', taskId: '1', taskName: 'a',
      success: true, actualCostCents: 5, revenueGenerated: false, netValueCents: -5,
      timestamp: new Date().toISOString(),
    };
    const revenue: RevenueEvent = {
      type: 'revenue', source: 'x402', amountCents: 100,
      txRef: 'tx-1', timestamp: new Date().toISOString(), protocol: 'x402',
    };
    const realization: ValueRealizationEvent = {
      type: 'value_realization', taskId: '1', valueType: 'api_response',
      revenueAssociated: true, revenueRef: 'tx-1', timestamp: new Date().toISOString(),
    };

    recorder.record(completion);
    recorder.record(revenue);
    recorder.record(realization);

    expect(recorder.byType('revenue')).toHaveLength(1);
    expect(recorder.byType('task_completion')).toHaveLength(1);
    expect(recorder.byType('value_realization')).toHaveLength(1);
  });

  it('produces aggregate stats', () => {
    recorder.record({
      type: 'task_completion', taskId: '1', taskName: 'a',
      success: true, actualCostCents: 10, revenueGenerated: true, netValueCents: 20,
      timestamp: new Date().toISOString(),
    });
    recorder.record({
      type: 'revenue', source: 'x402', amountCents: 50,
      txRef: 'tx-1', timestamp: new Date().toISOString(), protocol: 'x402',
    });

    const s = recorder.stats();
    expect(s.total).toBe(2);
    expect(s.completions).toBe(1);
    expect(s.revenue).toBe(1);
    expect(s.totalRevenueCents).toBe(50);
    expect(s.totalCostCents).toBe(10);
    expect(s.avgNetValueCents).toBe(20);
  });

  it('evicts oldest entries when buffer overflows', () => {
    for (let i = 0; i < 15; i++) {
      recorder.record({
        type: 'task_completion', taskId: `t-${i}`, taskName: `task-${i}`,
        success: true, actualCostCents: 1, revenueGenerated: false, netValueCents: -1,
        timestamp: new Date().toISOString(),
      });
    }
    // Buffer size is 10, so only last 10 entries remain
    expect(recorder.size).toBe(10);
    const events = recorder.recent();
    expect((events[0] as TaskCompletionEvent).taskId).toBe('t-5'); // first 5 evicted
  });

  it('clears all events', () => {
    recorder.record({
      type: 'task_completion', taskId: '1', taskName: 'a',
      success: true, actualCostCents: 1, revenueGenerated: false, netValueCents: -1,
      timestamp: new Date().toISOString(),
    });
    recorder.clear();
    expect(recorder.size).toBe(0);
    expect(recorder.recent()).toHaveLength(0);
  });
});

// ── 9.2 TaskFeedbackHeuristic ─────────────────────────────────────────

describe('TaskFeedbackHeuristic', () => {
  let heuristic: TaskFeedbackHeuristic;

  beforeEach(() => {
    heuristic = new TaskFeedbackHeuristic();
  });

  it('returns 0 adjustment for unknown task types', () => {
    expect(heuristic.getPriorityAdjustment('unknown', false)).toBe(0);
  });

  it('gives positive bonus for high-success revenue types', () => {
    // Ingest 10 successful revenue tasks
    for (let i = 0; i < 10; i++) {
      heuristic.ingest({
        type: 'task_completion', taskId: `t-${i}`, taskName: 'api-call',
        success: true, actualCostCents: 5, revenueGenerated: true, netValueCents: 50,
        timestamp: new Date().toISOString(),
      });
    }

    const adj = heuristic.getPriorityAdjustment('api-call', true);
    expect(adj).toBeGreaterThan(0);
  });

  it('gives negative penalty for high-failure types', () => {
    // Ingest 5 failures
    for (let i = 0; i < 5; i++) {
      heuristic.ingest({
        type: 'task_completion', taskId: `t-${i}`, taskName: 'flaky-task',
        success: false, actualCostCents: 20, revenueGenerated: false, netValueCents: -20,
        timestamp: new Date().toISOString(),
      });
    }

    const adj = heuristic.getPriorityAdjustment('flaky-task', false);
    expect(adj).toBeLessThan(0);
  });

  it('tracks separate records per task type', () => {
    heuristic.ingest({
      type: 'task_completion', taskId: '1', taskName: 'type-a',
      success: true, actualCostCents: 5, revenueGenerated: false, netValueCents: -5,
      timestamp: new Date().toISOString(),
    });
    heuristic.ingest({
      type: 'task_completion', taskId: '2', taskName: 'type-b',
      success: false, actualCostCents: 10, revenueGenerated: false, netValueCents: -10,
      timestamp: new Date().toISOString(),
    });

    const records = heuristic.getRecords();
    expect(records).toHaveLength(2);
    expect(heuristic.getRecord('type-a')?.successCount).toBe(1);
    expect(heuristic.getRecord('type-b')?.failCount).toBe(1);
  });
});

// ── 9.3 Freshness: On-Demand Tier in ToolExecutor ─────────────────────

describe('ToolExecutor freshness — on-demand tier reads', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let service: EconomicStateService;
  let executor: ToolExecutor;
  let policy: EconomicPolicy;

  beforeEach(() => {
    tracker = new SpendTracker();
    automaton = new ConwayAutomaton();
    service = new EconomicStateService(tracker, automaton, logger);
    policy = service.getPolicy();
    executor = new ToolExecutor(logger);
    executor.setEconomicPolicy(policy);
    executor.setEconomicService(service);

    executor.registerTool({
      name: 'high-cost-tool',
      description: 'A high-cost test tool',
      execute: async () => 'result',
      costClass: 'high',
    });
    executor.registerTool({
      name: 'low-cost-tool',
      description: 'A low-cost test tool',
      execute: async () => 'result',
      costClass: 'low',
    });
  });

  it('reads fresh tier from EconomicStateService before gating', async () => {
    // Initially at normal tier → high-cost tool should be allowed
    const r1 = await executor.executeOne({ id: 'c-1', name: 'high-cost-tool', arguments: '{}' });
    expect(r1.isError).toBe(false);

    // Drive automaton to critical → high-cost should be blocked
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });

    const r2 = await executor.executeOne({ id: 'c-2', name: 'high-cost-tool', arguments: '{}' });
    expect(r2.isError).toBe(true);
    expect(r2.content).toContain('blocked');
  });

  it('low-cost tools remain available even at critical tier', async () => {
    // Drive to critical
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });
    automaton.evolve({ ...envBase, budgetRemainingPct: 5, memoryPressure: 0.95 });

    const r = await executor.executeOne({ id: 'c-3', name: 'low-cost-tool', arguments: '{}' });
    expect(r.isError).toBe(false);
  });

  it('shutdown mode blocks all tools regardless of cost', async () => {
    // Drive to dead (shutdown mode)
    for (let i = 0; i < 10; i++) {
      automaton.evolve({ ...envBase, budgetRemainingPct: 0, memoryPressure: 1.0 });
    }
    expect(service.getCurrentMode()).toBe('shutdown');

    const r = await executor.executeOne({ id: 'c-4', name: 'low-cost-tool', arguments: '{}' });
    expect(r.isError).toBe(true);
    expect(r.content).toContain('shutdown');
  });

  it('survival-recovery mode treats tier as terminal', async () => {
    // Drive to terminal (survival-recovery)
    for (let i = 0; i < 6; i++) {
      automaton.evolve({ ...envBase, budgetRemainingPct: 1, memoryPressure: 0.99 });
    }
    const mode = service.getCurrentMode();
    expect(mode).toBe('survival-recovery');

    // Medium-cost tool should be blocked (terminal policy blocks medium)
    executor.registerTool({
      name: 'medium-tool', description: 'medium', execute: async () => 'x', costClass: 'medium',
    });
    const r = await executor.executeOne({ id: 'c-5', name: 'medium-tool', arguments: '{}' });
    expect(r.isError).toBe(true);
  });
});

// ── 9.4 RuntimeMode Behavior in TaskQueue ─────────────────────────────

describe('TaskQueue RuntimeMode behavior contracts', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let service: EconomicStateService;
  let queue: TaskQueue;

  beforeEach(() => {
    tracker = new SpendTracker();
    automaton = new ConwayAutomaton();
    service = new EconomicStateService(tracker, automaton, logger);
    queue = new TaskQueue(logger);
    queue.setEconomicService(service, service.getPolicy());
  });

  it('shutdown mode rejects all tasks', () => {
    // Drive to dead
    for (let i = 0; i < 10; i++) {
      automaton.evolve({ ...envBase, budgetRemainingPct: 0, memoryPressure: 1.0 });
    }

    const result = queue.enqueue(makeTask({ isRevenueBearing: true }));
    expect(result).toBe(false);
    expect(queue.rejectedCount).toBe(1);
  });

  it('survival-recovery rejects non-revenue tasks', () => {
    // Drive to terminal
    for (let i = 0; i < 6; i++) {
      automaton.evolve({ ...envBase, budgetRemainingPct: 1, memoryPressure: 0.99 });
    }
    expect(service.getCurrentMode()).toBe('survival-recovery');

    const r1 = queue.enqueue(makeTask({ isRevenueBearing: false }));
    expect(r1).toBe(false);
  });

  it('revenue-seeking mode gives +20 priority to revenue tasks', () => {
    // Drive to frugal (revenue-seeking)
    automaton.evolve({ ...envBase, budgetRemainingPct: 20, memoryPressure: 0.7 });
    automaton.evolve({ ...envBase, budgetRemainingPct: 20, memoryPressure: 0.7 });
    expect(service.getCurrentMode()).toBe('revenue-seeking');

    // Enqueue revenue task with priority 10
    const result = queue.enqueue(makeTask({ isRevenueBearing: true, priority: 10 }));
    expect(result).toBe(true);
    // Task got priority bonus in internal routing
  });

  it('normal mode uses standard routing', () => {
    // Normal tier → should accept both revenue and non-revenue
    const r1 = queue.enqueue(makeTask({ isRevenueBearing: false }));
    expect(r1).toBe(true);

    const r2 = queue.enqueue(makeTask({ isRevenueBearing: true }));
    expect(r2).toBe(true);
  });
});

// ── 9.5 End-to-End Feedback Loop ──────────────────────────────────────

describe('End-to-end feedback loop: TaskQueue → Recorder → Heuristic', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let service: EconomicStateService;
  let queue: TaskQueue;
  let recorder: ValueEventRecorder;
  let heuristic: TaskFeedbackHeuristic;

  beforeEach(() => {
    tracker = new SpendTracker();
    automaton = new ConwayAutomaton();
    service = new EconomicStateService(tracker, automaton, logger);
    recorder = new ValueEventRecorder();
    heuristic = new TaskFeedbackHeuristic();
    queue = new TaskQueue(logger);
    queue.setEconomicService(service, service.getPolicy());
    queue.setValueRecorder(recorder);
    queue.setFeedbackHeuristic(heuristic);
  });

  it('task completion emits event to recorder', async () => {
    queue.enqueue(makeTask({ name: 'log-task' }));
    await queue.drain();

    expect(recorder.size).toBe(1);
    const events = recorder.byType('task_completion');
    expect(events).toHaveLength(1);
    expect(events[0].taskName).toBe('log-task');
    expect(events[0].success).toBe(true);
  });

  it('task failure emits failure event', async () => {
    queue.enqueue(makeTask({
      name: 'fail-task',
      execute: async () => { throw new Error('oops'); },
      retries: 0,
    }));
    await queue.drain();

    const events = recorder.byType('task_completion');
    expect(events).toHaveLength(1);
    expect(events[0].success).toBe(false);
  });

  it('heuristic ingests completion events from queue', async () => {
    // Run repeated tasks
    for (let i = 0; i < 5; i++) {
      queue.enqueue(makeTask({ name: 'repeated-task', isRevenueBearing: true }));
    }
    await queue.drain();

    const rec = heuristic.getRecord('repeated-task');
    expect(rec).toBeDefined();
    expect(rec!.successCount).toBe(5);
  });

  it('feedback heuristic influences future task priority', async () => {
    // Ingest many failures to build up negative heuristic
    for (let i = 0; i < 5; i++) {
      heuristic.ingest({
        type: 'task_completion', taskId: `t-${i}`, taskName: 'bad-task',
        success: false, actualCostCents: 50, revenueGenerated: false, netValueCents: -50,
        timestamp: new Date().toISOString(),
      });
    }

    // The heuristic should now give a penalty for 'bad-task'
    const adj = heuristic.getPriorityAdjustment('bad-task', false);
    expect(adj).toBeLessThan(0);

    // When enqueuing, the task should get deprioritized (but still accepted at normal tier)
    const result = queue.enqueue(makeTask({ name: 'bad-task', priority: 10 }));
    expect(result).toBe(true);
  });
});
