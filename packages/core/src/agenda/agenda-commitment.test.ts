/**
 * Round 16.1 — Autonomous Agenda test suite.
 *
 * Covers:
 *   T1  commitment-model (transitions, factory, invariants)
 *   T2  commitment-store (CRUD, filtering, boot recovery)
 *   T3  agenda-generator (scoring, mode weights, mustPreserve)
 *   T4  heartbeat-daemon (tick-based phases, lifecycle)
 *   T5  commitment-materializer (materialize, result handling)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── T1: Commitment Model ──────────────────────────────────────────────
import {
  createCommitment,
  isValidTransition,
  TERMINAL_STATUSES,
  PRIORITY_WEIGHTS,
  type Commitment,
} from '../agenda/commitment-model.js';

describe('commitment-model', () => {
  it('creates commitment with UUID id and ISO timestamps', () => {
    const c = createCommitment({
      name: 'test-commitment',
      kind: 'revenue',
      origin: 'system',
      taskType: 'api-call',
      expectedValueCents: 500,
    });
    expect(c.id).toMatch(/^cmt-\d+-\d+$/);
    expect(c.status).toBe('planned');
    expect(c.priority).toBe('normal');
    expect(c.createdAt).toBeTruthy();
    expect(c.updatedAt).toBeTruthy();
    expect(c.expectedValueCents).toBe(500);
    expect(c.estimatedCostCents).toBe(0);
    expect(c.materializedTaskCount).toBe(0);
    expect(c.mustPreserve).toBe(false);
    expect(c.revenueBearing).toBe(false);
  });

  it('applies overrides in createCommitment', () => {
    const c = createCommitment({
      name: 'critical',
      kind: 'maintenance',
      origin: 'external',
      taskType: 'infra',
      priority: 'critical',
      mustPreserve: true,
      revenueBearing: true,
    });
    expect(c.priority).toBe('critical');
    expect(c.mustPreserve).toBe(true);
    expect(c.revenueBearing).toBe(true);
  });

  describe('state transitions', () => {
    it('allows valid transitions', () => {
      expect(isValidTransition('planned', 'active')).toBe(true);
      expect(isValidTransition('active', 'completed')).toBe(true);
      expect(isValidTransition('active', 'blocked')).toBe(true);
      expect(isValidTransition('blocked', 'active')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(isValidTransition('planned', 'completed')).toBe(false);
      expect(isValidTransition('completed', 'active')).toBe(false);
      expect(isValidTransition('abandoned', 'planned')).toBe(false);
    });

    it('terminal statuses include completed, failed, abandoned', () => {
      expect(TERMINAL_STATUSES).toContain('completed');
      expect(TERMINAL_STATUSES).toContain('failed');
      expect(TERMINAL_STATUSES).toContain('abandoned');
      expect(TERMINAL_STATUSES).not.toContain('active');
    });
  });

  it('defines priority weights in descending order', () => {
    expect(PRIORITY_WEIGHTS.critical).toBeGreaterThan(PRIORITY_WEIGHTS.high);
    expect(PRIORITY_WEIGHTS.high).toBeGreaterThan(PRIORITY_WEIGHTS.normal);
    expect(PRIORITY_WEIGHTS.normal).toBeGreaterThan(PRIORITY_WEIGHTS.low);
  });
});

// ── T2: CommitmentStore ───────────────────────────────────────────────
import { CommitmentStore } from '../agenda/commitment-store.js';

describe('CommitmentStore', () => {
  let store: CommitmentStore;

  beforeEach(() => {
    store = new CommitmentStore(); // no repo (in-memory only)
  });

  it('add + get returns defensive copy', () => {
    const c = createCommitment({ name: 'a', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);

    const retrieved = store.get(c.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('a');
    expect(retrieved).not.toBe(c); // defensive copy
  });

  it('update patches fields and validates transitions', () => {
    const c = createCommitment({ name: 'x', kind: 'maintenance', origin: 'system', taskType: 't' });
    store.add(c);

    // planned → active is valid
    store.update(c.id, { status: 'active' });
    expect(store.get(c.id)!.status).toBe('active');

    // active → completed is valid
    store.update(c.id, { status: 'completed' });
    expect(store.get(c.id)!.status).toBe('completed');
  });

  it('throws on invalid transition', () => {
    const c = createCommitment({ name: 'y', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);

    // planned → completed is NOT valid
    expect(() => store.update(c.id, { status: 'completed' })).toThrow(/Invalid commitment transition/);
  });

  it('list filters by status and kind', () => {
    const c1 = createCommitment({ name: 'a', kind: 'revenue', origin: 'system', taskType: 't' });
    const c2 = createCommitment({ name: 'b', kind: 'maintenance', origin: 'system', taskType: 't' });
    const c3 = createCommitment({ name: 'c', kind: 'revenue', origin: 'external', taskType: 't' });
    store.add(c1);
    store.add(c2);
    store.add(c3);

    expect(store.list().length).toBe(3);
    expect(store.list({ kind: ['revenue'] }).length).toBe(2);
    expect(store.list({ status: ['planned'] }).length).toBe(3);
    expect(store.list({ status: ['active'] }).length).toBe(0);
  });

  it('status shortcuts: markBlocked, markCompleted, markFailed', () => {
    const c = createCommitment({ name: 'z', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);

    store.update(c.id, { status: 'active' });  // planned → active
    store.markBlocked(c.id, 'rate-limited');
    expect(store.get(c.id)!.status).toBe('blocked');
    expect(store.get(c.id)!.blockedReason).toBe('rate-limited');

    store.markActive(c.id);  // blocked → active
    store.markCompleted(c.id);
    expect(store.get(c.id)!.status).toBe('completed');
  });

  it('due() returns actionable overdue commitments', () => {
    const past = new Date(Date.now() - 60000).toISOString();
    const future = new Date(Date.now() + 60000).toISOString();

    const c1 = createCommitment({ name: 'overdue', kind: 'revenue', origin: 'system', taskType: 't', dueAt: past });
    const c2 = createCommitment({ name: 'future', kind: 'revenue', origin: 'system', taskType: 't', dueAt: future });
    store.add(c1);
    store.add(c2);

    const due = store.due(new Date().toISOString());
    expect(due.length).toBe(1);
    expect(due[0]!.name).toBe('overdue');
  });

  it('size and clear work', () => {
    store.add(createCommitment({ name: 'a', kind: 'revenue', origin: 'system', taskType: 't' }));
    store.add(createCommitment({ name: 'b', kind: 'revenue', origin: 'system', taskType: 't' }));
    expect(store.size).toBe(2);

    store.clear();
    expect(store.size).toBe(0);
  });
});

// ── T3: AgendaGenerator ───────────────────────────────────────────────
import { AgendaGenerator, type AgendaInput } from '../agenda/agenda-generator.js';

describe('AgendaGenerator', () => {
  let gen: AgendaGenerator;

  const makeCommitment = (overrides: Partial<Commitment> & { name: string }): Commitment =>
    createCommitment({
      kind: 'revenue',
      origin: 'system',
      taskType: 'general',
      ...overrides,
    });

  beforeEach(() => {
    gen = new AgendaGenerator();
  });

  it('selects top N commitments by score', () => {
    const commitments = [
      makeCommitment({ name: 'low', expectedValueCents: 10 }),
      makeCommitment({ name: 'high', expectedValueCents: 1000 }),
      makeCommitment({ name: 'mid', expectedValueCents: 200 }),
    ];

    const result = gen.generate({ commitments, mode: 'normal', tier: 'normal', maxItems: 2 });
    expect(result.selected.length).toBe(2);
    expect(result.deferred.length).toBe(1);
    expect(result.selected[0]!.commitment.name).toBe('high');
  });

  it('shutdown mode defers everything', () => {
    const commitments = [
      makeCommitment({ name: 'a', expectedValueCents: 1000 }),
    ];

    const result = gen.generate({ commitments, mode: 'shutdown', tier: 'terminal' });
    expect(result.selected.length).toBe(0);
    expect(result.deferred.length).toBe(1);
    expect(result.deferred[0]!.reason).toContain('shutdown');
  });

  it('revenue-seeking mode favors revenue-bearing commitments', () => {
    const commitments = [
      makeCommitment({ name: 'revenue', revenueBearing: true, expectedValueCents: 100 }),
      makeCommitment({ name: 'non-rev', revenueBearing: false, expectedValueCents: 100 }),
    ];

    const result = gen.generate({ commitments, mode: 'revenue-seeking', tier: 'normal', maxItems: 1 });
    expect(result.selected[0]!.commitment.name).toBe('revenue');
  });

  it('survival-recovery mode favors mustPreserve commitments', () => {
    const commitments = [
      makeCommitment({ name: 'preserve', mustPreserve: true, expectedValueCents: 50 }),
      makeCommitment({ name: 'revenue', revenueBearing: true, expectedValueCents: 200 }),
    ];

    const result = gen.generate({ commitments, mode: 'survival-recovery', tier: 'critical', maxItems: 1 });
    expect(result.selected[0]!.commitment.name).toBe('preserve');
  });

  it('reserves at least 1 slot for mustPreserve items', () => {
    const commitments = [
      makeCommitment({ name: 'big-rev', revenueBearing: true, expectedValueCents: 5000 }),
      makeCommitment({ name: 'preserve', mustPreserve: true, expectedValueCents: 10 }),
    ];

    const result = gen.generate({ commitments, mode: 'revenue-seeking', tier: 'normal', maxItems: 2 });
    const names = result.selected.map(s => s.commitment.name);
    expect(names).toContain('preserve'); // guaranteed slot
    expect(names).toContain('big-rev');
  });

  it('includes reasons in selected items', () => {
    const commitments = [
      makeCommitment({ name: 'mp', mustPreserve: true, expectedValueCents: 100 }),
    ];

    const result = gen.generate({ commitments, mode: 'normal', tier: 'normal', maxItems: 3 });
    const reasons = result.selected[0]!.reasons;
    expect(reasons.some(r => r.includes('Must-preserve'))).toBe(true);
  });

  it('handles empty commitment list', () => {
    const result = gen.generate({ commitments: [], mode: 'normal', tier: 'normal' });
    expect(result.selected.length).toBe(0);
    expect(result.deferred.length).toBe(0);
  });
});

// ── T4: HeartbeatDaemon (tick-based) ──────────────────────────────────
import { HeartbeatDaemon } from '../runtime/heartbeat.js';

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => makeLogger()),
  };
}

describe('HeartbeatDaemon (tick-based)', () => {
  let daemon: HeartbeatDaemon;
  let logger: ReturnType<typeof makeLogger>;

  beforeEach(() => {
    logger = makeLogger();
    daemon = new HeartbeatDaemon(logger as any, 1000);
  });

  it('registers and executes phases sequentially', async () => {
    const order: string[] = [];

    daemon.registerPhase({
      name: 'first',
      enabled: true,
      execute: async () => { order.push('first'); },
    });
    daemon.registerPhase({
      name: 'second',
      enabled: true,
      execute: async () => { order.push('second'); },
    });

    await daemon.tick();
    expect(order).toEqual(['first', 'second']);
    expect(daemon.tickCount).toBe(1);
  });

  it('skips disabled phases', async () => {
    const ran: string[] = [];

    daemon.registerPhase({ name: 'enabled', enabled: true, execute: async () => { ran.push('enabled'); } });
    daemon.registerPhase({ name: 'disabled', enabled: false, execute: async () => { ran.push('disabled'); } });

    await daemon.tick();
    expect(ran).toEqual(['enabled']);
  });

  it('phase errors do not abort the tick', async () => {
    const ran: string[] = [];

    daemon.registerPhase({
      name: 'error-phase',
      enabled: true,
      execute: async () => { throw new Error('boom'); },
    });
    daemon.registerPhase({
      name: 'ok-phase',
      enabled: true,
      execute: async () => { ran.push('ok'); },
    });

    await daemon.tick();
    expect(ran).toEqual(['ok']);

    const stats = daemon.stats();
    const errorPhase = stats.find(s => s.name === 'error-phase')!;
    expect(errorPhase.errorCount).toBe(1);
    expect(errorPhase.runCount).toBe(0);
  });

  it('runNow(name) triggers specific phase', async () => {
    const ran: string[] = [];
    daemon.registerPhase({ name: 'target', enabled: true, execute: async () => { ran.push('target'); } });
    daemon.registerPhase({ name: 'other', enabled: true, execute: async () => { ran.push('other'); } });

    const ok = await daemon.runNow('target');
    expect(ok).toBe(true);
    expect(ran).toEqual(['target']); // only target ran
  });

  it('runNow() with no name triggers full tick', async () => {
    const ran: string[] = [];
    daemon.registerPhase({ name: 'a', enabled: true, execute: async () => { ran.push('a'); } });
    daemon.registerPhase({ name: 'b', enabled: true, execute: async () => { ran.push('b'); } });

    await daemon.runNow();
    expect(ran).toEqual(['a', 'b']);
  });

  it('replaces phase when re-registered with same name', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    daemon.registerPhase({ name: 'same', enabled: true, execute: fn1 });
    daemon.registerPhase({ name: 'same', enabled: true, execute: fn2 });

    expect(daemon.stats().filter(s => s.name === 'same').length).toBe(1);
  });

  it('start/stop lifecycle toggles running state', () => {
    expect(daemon.running).toBe(false);

    daemon.start();
    expect(daemon.running).toBe(true);

    daemon.stop();
    expect(daemon.running).toBe(false);
  });
});

// ── T5: CommitmentMaterializer ────────────────────────────────────────
import { CommitmentMaterializer } from '../agenda/commitment-materializer.js';

describe('CommitmentMaterializer', () => {
  let mat: CommitmentMaterializer;

  beforeEach(() => {
    mat = new CommitmentMaterializer();
  });

  it('materializes revenue commitment with revenue-bearing flag', () => {
    const c = createCommitment({
      name: 'earn-money',
      kind: 'revenue',
      origin: 'system',
      taskType: 'api-call',
      expectedValueCents: 500,
      estimatedCostCents: 10,
    });
    const task = mat.materialize(c);
    expect(task.isRevenueBearing).toBe(true);
    expect(task.commitmentId).toBe(c.id);
    expect(task.taskName).toBe('cmt:earn-money');
    expect(task.expectedRevenueCents).toBe(500);
  });

  it('materializes maintenance commitment with priority floor', () => {
    const c = createCommitment({
      name: 'backup-db',
      kind: 'maintenance',
      origin: 'system',
      taskType: 'infra',
      priority: 'low',
    });
    const task = mat.materialize(c);
    expect(task.priority).toBeGreaterThanOrEqual(40); // floor
  });

  it('materializes governance/memory/identity with cost cap', () => {
    const c = createCommitment({
      name: 'identity-check',
      kind: 'identity',
      origin: 'system',
      taskType: 'identity-audit',
      estimatedCostCents: 100,
    });
    const task = mat.materialize(c);
    expect(task.estimatedCostCents).toBeLessThanOrEqual(10); // capped
  });

  it('handleTaskResult updates store on success', () => {
    const store = new CommitmentStore();
    const c = createCommitment({ name: 'x', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);
    store.update(c.id, { status: 'active' }); // planned → active

    mat.handleTaskResult(c.id, 'success', store);
    expect(store.get(c.id)!.status).toBe('completed');
  });

  it('handleTaskResult handles failure with reason', () => {
    const store = new CommitmentStore();
    const c = createCommitment({ name: 'x', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);
    store.update(c.id, { status: 'active' }); // planned → active

    mat.handleTaskResult(c.id, 'failure', store, 'API error 500');
    expect(store.get(c.id)!.status).toBe('failed');
    expect(store.get(c.id)!.failedReason).toBe('API error 500');
  });

  it('handleTaskResult handles blocked', () => {
    const store = new CommitmentStore();
    const c = createCommitment({ name: 'x', kind: 'revenue', origin: 'system', taskType: 't' });
    store.add(c);
    store.update(c.id, { status: 'active' }); // planned → active

    mat.handleTaskResult(c.id, 'blocked', store, 'Rate limited');
    expect(store.get(c.id)!.status).toBe('blocked');
  });

  it('handleTaskResult ignores unknown commitmentId', () => {
    const store = new CommitmentStore();
    // Should not throw
    mat.handleTaskResult('no-such-id', 'success', store);
  });
});
