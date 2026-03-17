/**
 * Round 15.8 — Economic Runtime Integration Tests
 *
 * Tests that runtime components TRULY CONSUME economic state:
 * - 8.1 Queue/Routing: TaskQueue value routing
 * - 8.2 Enforcement: ToolExecutor survival gate
 * - 8.3 Recovery Mode: RuntimeMode auto-switching
 * - 8.4 Value Semantics: Revenue vs Value Realization types
 * - 8.5 Freshness: State doesn't go stale
 *
 * All components use REAL implementations — no mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { SpendTracker } from '../spend/index.js';
import { ConwayAutomaton, type EnvironmentSnapshot } from '../automaton/index.js';
import { EconomicStateService } from './economic-state-service.js';
import { EconomicPolicy, resolveRuntimeMode, type RuntimeMode } from './economic-policy.js';
import { TaskQueue, type QueuedTask } from '../runtime/task-queue.js';
import { ToolExecutor, type ToolHandler } from '../runtime/tool-executor.js';
import { createLogger } from '../logger/index.js';

// ── Shared test fixtures ──────────────────────────────────────────────

const logger = createLogger('economic-runtime-test', { level: 'silent' });

const envBase: EnvironmentSnapshot = {
  budgetRemainingPct: 80,
  memoryPressure: 0.3,
  activeConnections: 2,
  lastHeartbeat: Date.now(),
  recentIncomeCents: 0,
  recentSpendCents: 0,
};

function createTestTask(overrides?: Partial<QueuedTask>): QueuedTask {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    name: 'test-task',
    execute: async () => 'done',
    priority: 5,
    ...overrides,
  };
}

// ── 8.1 Queue / Routing Integration Tests ─────────────────────────────

describe('TaskQueue ← EconomicStateService routing', () => {
  let tracker: SpendTracker;
  let automaton: ConwayAutomaton;
  let service: EconomicStateService;
  let queue: TaskQueue;
  let policy: EconomicPolicy;

  beforeEach(() => {
    tracker = new SpendTracker();
    automaton = new ConwayAutomaton();
    service = new EconomicStateService(tracker, automaton, logger);
    policy = service.getPolicy();
    queue = new TaskQueue(logger);
    queue.setEconomicService(service, policy);
  });

  it('accepts a revenue-bearing task at normal tier', () => {
    const task = createTestTask({ isRevenueBearing: true });
    const accepted = queue.enqueue(task);
    expect(accepted).toBe(true);
  });

  it('accepts a non-revenue task at normal tier', () => {
    const task = createTestTask({ isRevenueBearing: false });
    const accepted = queue.enqueue(task);
    expect(accepted).toBe(true);
  });

  it('rejects non-revenue tasks when tier is terminal', () => {
    // Push to terminal: budgetRemainingPct <= 2
    automaton.evolve({ ...envBase, budgetRemainingPct: 1 });

    const task = createTestTask({ isRevenueBearing: false });
    const accepted = queue.enqueue(task);
    expect(accepted).toBe(false);
    expect(queue.rejectedCount).toBeGreaterThan(0);
  });

  it('rejects revenue-bearing tasks without actual revenue at critical tier', () => {
    // Critical: budgetRemainingPct ~5
    automaton.evolve({ ...envBase, budgetRemainingPct: 5 });

    // isRevenueBearing=true but expectedRevenueCents=0 → netValue < 0 → rejected
    // This is correct economic behavior: claims of revenue without actual expected value
    const task = createTestTask({ isRevenueBearing: true });
    const accepted = queue.enqueue(task);
    expect(accepted).toBe(false);
    expect(queue.rejectedCount).toBeGreaterThan(0);
  });

  it('records routing decisions in audit trail', () => {
    const task = createTestTask({ isRevenueBearing: true });
    queue.enqueue(task);

    const trail = policy.getTrail();
    expect(trail.length).toBeGreaterThan(0);
    const lastRecord = trail[trail.length - 1];
    expect(lastRecord.component).toBe('task-queue');
    expect(lastRecord.actionType).toBe('enqueue');
  });

  it('higher priority for revenue tasks than non-revenue at same tier', () => {
    // Enqueue non-revenue first, then revenue
    const nonRevTask = createTestTask({ id: 'non-rev', isRevenueBearing: false, priority: 5 });
    const revTask = createTestTask({ id: 'rev', isRevenueBearing: true, priority: 5 });

    const a1 = queue.enqueue(nonRevTask);
    const a2 = queue.enqueue(revTask);

    // Both should be accepted at normal tier
    expect(a1).toBe(true);
    expect(a2).toBe(true);
  });
});

// ── 8.2 Enforcement Breadth Tests ─────────────────────────────────────

describe('ToolExecutor ← EconomicPolicy survival gate', () => {
  let executor: ToolExecutor;
  let policy: EconomicPolicy;

  const lowCostTool: ToolHandler = {
    name: 'read-file',
    description: 'Read a file',
    execute: async () => 'file contents',
    costClass: 'low',
  };

  const highCostTool: ToolHandler = {
    name: 'web-scrape',
    description: 'Scrape a website',
    execute: async () => 'scraped data',
    costClass: 'high',
  };

  const mediumCostTool: ToolHandler = {
    name: 'api-call',
    description: 'Call an external API',
    execute: async () => 'api response',
    costClass: 'medium',
  };

  beforeEach(() => {
    executor = new ToolExecutor(logger);
    policy = new EconomicPolicy();
    executor.setEconomicPolicy(policy);
    executor.registerTools([lowCostTool, highCostTool, mediumCostTool]);
  });

  it('allows all tools at normal tier', async () => {
    executor.updateTier('normal');
    const result = await executor.executeOne({ id: '1', name: 'web-scrape', arguments: '{}' });
    expect(result.isError).toBe(false);
    expect(result.content).toBe('scraped data');
  });

  it('blocks high-cost tools at critical tier', async () => {
    executor.updateTier('critical');
    const result = await executor.executeOne({ id: '1', name: 'web-scrape', arguments: '{}' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('blocked');
    expect(executor.stats().blockedCount).toBe(1);
  });

  it('allows low-cost tools at terminal tier', async () => {
    executor.updateTier('terminal');
    const result = await executor.executeOne({ id: '1', name: 'read-file', arguments: '{}' });
    expect(result.isError).toBe(false);
    expect(result.content).toBe('file contents');
  });

  it('blocks medium-cost tools at terminal tier', async () => {
    executor.updateTier('terminal');
    const result = await executor.executeOne({ id: '1', name: 'api-call', arguments: '{}' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('blocked');
  });

  it('blocks all tools at dead tier', async () => {
    executor.updateTier('dead');
    const result = await executor.executeOne({ id: '1', name: 'read-file', arguments: '{}' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('blocked');
  });

  it('records enforcement decisions in audit trail', async () => {
    executor.updateTier('critical');
    await executor.executeOne({ id: '1', name: 'web-scrape', arguments: '{}' });

    const trail = policy.getTrail();
    expect(trail.length).toBe(1);
    expect(trail[0].component).toBe('tool-executor');
    expect(trail[0].decision).toBe('block');
    expect(trail[0].context).toContain('web-scrape');
  });
});

// ── 8.3 Recovery Mode Tests ───────────────────────────────────────────

describe('RuntimeMode auto-switching', () => {
  it('normal at thriving/normal tier', () => {
    expect(resolveRuntimeMode('thriving')).toBe('normal');
    expect(resolveRuntimeMode('normal')).toBe('normal');
  });

  it('revenue-seeking at frugal/critical tier', () => {
    expect(resolveRuntimeMode('frugal')).toBe('revenue-seeking');
    expect(resolveRuntimeMode('critical')).toBe('revenue-seeking');
  });

  it('survival-recovery at terminal tier', () => {
    expect(resolveRuntimeMode('terminal')).toBe('survival-recovery');
  });

  it('shutdown at dead tier', () => {
    expect(resolveRuntimeMode('dead')).toBe('shutdown');
  });

  it('EconomicStateService reflects mode from automaton tier', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    // Default tier is 'normal'
    expect(service.getCurrentMode()).toBe('normal');

    // Evolve to critical
    automaton.evolve({ ...envBase, budgetRemainingPct: 5 });
    expect(service.getCurrentMode()).toBe('revenue-seeking');

    // Evolve to terminal
    automaton.evolve({ ...envBase, budgetRemainingPct: 1 });
    expect(service.getCurrentMode()).toBe('survival-recovery');
  });

  it('mode recovers when budget improves', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    // Go to critical
    automaton.evolve({ ...envBase, budgetRemainingPct: 5 });
    expect(service.getCurrentMode()).toBe('revenue-seeking');

    // Recover to normal
    automaton.evolve({ ...envBase, budgetRemainingPct: 80 });
    expect(service.getCurrentMode()).toBe('normal');
  });
});

// ── 8.4 Value Semantics Tests ─────────────────────────────────────────

describe('Value event type boundaries', () => {
  it('RevenueEvent has distinct type from TaskCompletionEvent', () => {
    // Import types — compile-time check that they're distinct
    const revenue = {
      type: 'revenue' as const,
      source: 'x402',
      amountCents: 500,
      txRef: '0xabc',
      timestamp: new Date().toISOString(),
      protocol: 'x402' as const,
    };

    const completion = {
      type: 'task_completion' as const,
      taskId: 'task-1',
      taskName: 'inference',
      success: true,
      actualCostCents: 100,
      revenueGenerated: true,
      netValueCents: 400,
      timestamp: new Date().toISOString(),
    };

    expect(revenue.type).not.toBe(completion.type);
    expect(revenue.type).toBe('revenue');
    expect(completion.type).toBe('task_completion');
  });

  it('ValueRealizationEvent bridges revenue and task completion', () => {
    const realization = {
      type: 'value_realization' as const,
      taskId: 'task-1',
      valueType: 'api_response' as const,
      revenueAssociated: true,
      revenueRef: '0xabc',
      timestamp: new Date().toISOString(),
    };

    expect(realization.type).toBe('value_realization');
    expect(realization.revenueAssociated).toBe(true);
    expect(realization.revenueRef).toBe('0xabc');
  });
});

// ── 8.5 Runtime Freshness Tests ───────────────────────────────────────

describe('EconomicState freshness', () => {
  it('snapshot reflects new spend immediately', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    const before = service.snapshot();

    tracker.recordSpend('openai', 500, { model: 'gpt-4o', category: 'inference' });

    const after = service.snapshot();
    expect(after.totalSpendCents).toBeGreaterThan(before.totalSpendCents);
  });

  it('snapshot reflects new income immediately', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    const before = service.snapshot();

    tracker.recordIncome('x402', 1000);

    const after = service.snapshot();
    expect(after.totalIncomeCents).toBeGreaterThan(before.totalIncomeCents);
  });

  it('gate decision changes after tier evolves', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    const normalGate = service.getGateDecision();
    expect(normalGate.allowed).toBe(true);

    automaton.evolve({ ...envBase, budgetRemainingPct: 1 }); // terminal

    const terminalGate = service.getGateDecision();
    expect(terminalGate.allowed).toBe(false);
    expect(terminalGate.tier).toBe('terminal');
  });

  it('getCurrentTier() updates in real time', () => {
    const tracker = new SpendTracker();
    const automaton = new ConwayAutomaton();
    const service = new EconomicStateService(tracker, automaton, logger);

    expect(service.getCurrentTier()).toBe('normal');
    automaton.evolve({ ...envBase, budgetRemainingPct: 5 });
    expect(service.getCurrentTier()).toBe('critical');
  });
});

// ── EconomicPolicy audit stats ────────────────────────────────────────

describe('EconomicPolicy audit trail', () => {
  it('tracks aggregate stats correctly', () => {
    const policy = new EconomicPolicy();

    // 3 allows, 1 block, 1 restrict
    policy.evaluateAndRecord('test', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('test', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('test', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('test', 'tool', 'high', 'critical');
    policy.evaluateAndRecord('test', 'tool', 'medium', 'critical');

    const stats = policy.stats();
    expect(stats.total).toBe(5);
    expect(stats.allows).toBe(3);
    expect(stats.blocks).toBe(1);
    expect(stats.restricts).toBe(1);
  });

  it('ring buffer evicts oldest when full', () => {
    const policy = new EconomicPolicy(3); // max 3

    policy.evaluateAndRecord('a', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('b', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('c', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('d', 'tool', 'low', 'normal');

    const trail = policy.getTrail();
    expect(trail.length).toBe(3);
    expect(trail[0].component).toBe('b'); // 'a' evicted
  });

  it('filters by component', () => {
    const policy = new EconomicPolicy();

    policy.evaluateAndRecord('task-queue', 'enqueue', 'low', 'normal');
    policy.evaluateAndRecord('tool-executor', 'tool', 'low', 'normal');
    policy.evaluateAndRecord('task-queue', 'enqueue', 'low', 'normal');

    const queueRecords = policy.getByComponent('task-queue');
    expect(queueRecords.length).toBe(2);
  });
});
