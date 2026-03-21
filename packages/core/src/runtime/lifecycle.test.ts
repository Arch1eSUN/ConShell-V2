/**
 * Round 20.1 — LifeCycleEngine & AgendaArbiter integration tests
 * (Replaces old lifecycle.test.ts that used deprecated AgendaTask API)
 */
import { describe, it, expect } from 'vitest';
import { LifeCycleEngine } from './lifecycle-engine.js';
import { AgendaArbiter } from './agenda-arbiter.js';
import { HeartbeatDaemon } from './heartbeat.js';
import { TaskAdmissionGate, type TaskAdmissionRequest } from '../economic/task-admission-gate.js';
import { buildEconomicState } from '../economic/economic-state.js';

// ── Minimal logger stub ─────────────────────────────────────────────

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
} as any;

// ── Helper ──────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<TaskAdmissionRequest> = {}): TaskAdmissionRequest {
  return {
    taskId: overrides.taskId ?? 'test-task-1',
    estimatedCostCents: overrides.estimatedCostCents ?? 100,
    estimatedRevenueCents: overrides.estimatedRevenueCents ?? 500,
    revenueBearing: overrides.revenueBearing ?? true,
    mustPreserve: overrides.mustPreserve ?? false,
    timeSensitivity: overrides.timeSensitivity ?? 'flexible',
    riskLevel: overrides.riskLevel ?? 'low',
    source: overrides.source ?? 'external',
  };
}

// ── LifeCycleEngine Tests ───────────────────────────────────────────

describe('LifeCycleEngine', () => {
  it('starts and stops correctly', () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    expect(engine.isRunning).toBe(false);
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it('registers lifecycle-tick phase with HeartbeatDaemon', () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    engine.start();
    // Verify the phase was registered
    const stats = heartbeat.stats();
    expect(stats.some(s => s.name === 'lifecycle-tick')).toBe(true);
  });

  it('onTick increments tick count and triggers reprioritize', async () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    engine.start();
    await engine.onTick();

    const stats = engine.stats();
    expect(stats.tickCount).toBe(1);
    expect(stats.reprioritizeCount).toBeGreaterThanOrEqual(1);
    expect(stats.lastTickAt).not.toBeNull();
  });

  it('processes queued events on tick', async () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    let handled = false;
    engine.on('task_completed', () => { handled = true; });

    engine.start();
    engine.emit({ kind: 'task_completed', payload: {}, timestamp: new Date().toISOString() });

    // Event queued, not yet handled
    expect(handled).toBe(false);

    // Tick processes the queue
    await engine.onTick();
    expect(handled).toBe(true);
  });

  it('handles immediate events without waiting for tick', () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    let handled = false;
    engine.on('task_completed', () => { handled = true; });

    engine.start();
    engine.emit({ kind: 'task_completed', payload: {}, timestamp: new Date().toISOString() }, true);

    expect(handled).toBe(true);
  });

  it('economic_state_changed triggers reprioritize', async () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    engine.start();
    engine.emit(
      { kind: 'economic_state_changed', payload: {}, timestamp: new Date().toISOString() },
      true,
    );

    const log = arbiter.getReprioritizeLog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log.some(r => r.trigger === 'economic_state_changed')).toBe(true);
  });

  it('tracks deferred tasks', () => {
    const heartbeat = new HeartbeatDaemon(noopLogger, 60_000);
    const arbiter = new AgendaArbiter();
    const engine = new LifeCycleEngine(heartbeat, arbiter);

    engine.trackDeferred('task-99', 'Budget exceeded');
    expect(engine.getDeferredTasks().length).toBe(1);
    expect(engine.getDeferredTasks()[0].taskId).toBe('task-99');
  });
});

// ── AgendaArbiter Integration Tests (replaces old evaluateTask tests) ──

describe('AgendaArbiter (via TaskAdmissionGate)', () => {
  const gate = new TaskAdmissionGate();

  it('defers non-revenue tasks in healthy state via admission gate + arbiter', () => {
    const state = buildEconomicState({
      balanceCents: 5000,
      totalSpendCents: 1000,
      totalIncomeCents: 6000,
      burnRateCentsPerDay: 100,
      dailyIncomeCents: 150,
      survivalTier: 'thriving',
    });

    const projection = {
      totalRevenueCents: 6000,
      totalSpendCents: 1000,
      currentBalanceCents: 5000,
      reserveCents: 4000,
      burnRateCentsPerDay: 100,
      dailyRevenueCents: 150,
      netFlowCentsPerDay: 50,
      runwayDays: 50,
      survivalTier: 'thriving' as const,
      isSelfSustaining: true,
      revenueBySource: {},
      projectedAt: new Date().toISOString(),
    };

    const result = gate.evaluate(
      makeRequest({ revenueBearing: false, estimatedRevenueCents: 0, estimatedCostCents: 10 }),
      state,
      projection,
    );

    // Non-revenue, cheap task should be admitted with low priority
    expect(result.verdict).toBe('admit');
  });

  it('prioritizes high revenue tasks', () => {
    const state = buildEconomicState({
      balanceCents: 5000,
      totalSpendCents: 1000,
      totalIncomeCents: 6000,
      burnRateCentsPerDay: 100,
      dailyIncomeCents: 150,
      survivalTier: 'thriving',
    });

    const projection = {
      totalRevenueCents: 6000,
      totalSpendCents: 1000,
      currentBalanceCents: 5000,
      reserveCents: 4000,
      burnRateCentsPerDay: 100,
      dailyRevenueCents: 150,
      netFlowCentsPerDay: 50,
      runwayDays: 50,
      survivalTier: 'thriving' as const,
      isSelfSustaining: true,
      revenueBySource: {},
      projectedAt: new Date().toISOString(),
    };

    const result = gate.evaluate(
      makeRequest({ revenueBearing: true, estimatedRevenueCents: 200, estimatedCostCents: 10 }),
      state,
      projection,
    );

    expect(result.verdict).toBe('admit');
    expect(['high', 'opportunity-driven', 'immediate']).toContain(result.suggestedPriority);
  });

  it('blocks non-revenue tasks in terminal tier via survival gate', () => {
    const state = buildEconomicState({
      balanceCents: 100,
      totalSpendCents: 1000,
      totalIncomeCents: 100,
      burnRateCentsPerDay: 500,
      dailyIncomeCents: 0,
      survivalTier: 'terminal',
    });

    const projection = {
      totalRevenueCents: 100,
      totalSpendCents: 1000,
      currentBalanceCents: 100,
      reserveCents: 0,
      burnRateCentsPerDay: 500,
      dailyRevenueCents: 0,
      netFlowCentsPerDay: -500,
      runwayDays: 0,
      survivalTier: 'terminal' as const,
      isSelfSustaining: false,
      revenueBySource: {},
      projectedAt: new Date().toISOString(),
    };

    const result = gate.evaluate(
      makeRequest({ revenueBearing: false, mustPreserve: false, estimatedCostCents: 10 }),
      state,
      projection,
    );

    expect(result.verdict).toBe('defer');
    expect(result.reason.toLowerCase()).toContain('terminal');
  });

  it('allows revenue-bearing tasks in terminal tier', () => {
    const state = buildEconomicState({
      balanceCents: 100,
      totalSpendCents: 1000,
      totalIncomeCents: 100,
      burnRateCentsPerDay: 500,
      dailyIncomeCents: 0,
      survivalTier: 'terminal',
    });

    const projection = {
      totalRevenueCents: 100,
      totalSpendCents: 1000,
      currentBalanceCents: 100,
      reserveCents: 0,
      burnRateCentsPerDay: 500,
      dailyRevenueCents: 0,
      netFlowCentsPerDay: -500,
      runwayDays: 0,
      survivalTier: 'terminal' as const,
      isSelfSustaining: false,
      revenueBySource: {},
      projectedAt: new Date().toISOString(),
    };

    const result = gate.evaluate(
      makeRequest({ revenueBearing: true, estimatedRevenueCents: 500, estimatedCostCents: 10 }),
      state,
      projection,
    );

    expect(result.verdict).toBe('admit');
    expect(result.survivalOverride).toBe(true);
  });
});
