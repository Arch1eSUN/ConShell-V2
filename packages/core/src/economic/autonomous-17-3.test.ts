/**
 * Round 17.3 — Autonomous Operation Verification Matrix
 *
 * V1:  Revenue surface requires valid payment proof
 * V2:  Verified payment proof flows into revenue service + economic projection
 * V3:  Profitability evaluator rejects unsustainable tasks
 * V4:  Profitability evaluator prioritizes revenue-positive survival-critical tasks
 * V5:  Autonomous agenda consumes economic + governance + commitment input
 * V6:  Scheduler persists due tasks and recovers after restart
 * V7:  Checkpoint/recovery correctly rebuilds active commitments
 * V8:  Revenue-seeking mode discovers and prioritizes payable work
 * V9:  Control surface reflects paid commitments / agenda / scheduler truth
 * V10: Survival state substantively changes autonomous task behavior
 */
import { describe, it, expect } from 'vitest';
import {
  RevenueSurfaceRegistry,
  type PaymentProofVerificationResult,
} from './revenue-surface.js';
import { ProfitabilityEvaluator } from './profitability-evaluator.js';
import { AgendaGenerator } from '../agenda/agenda-generator.js';
import { createCommitment } from '../agenda/commitment-model.js';
import { MemorySchedulerBackend } from '../scheduler/memory-scheduler.js';
import { SchedulerService } from '../scheduler/scheduler-service.js';
import { createScheduledTask } from '../scheduler/scheduler-contract.js';
import { CheckpointManager } from '../lifecycle/checkpoint-manager.js';
import { RevenueSeekingEngine } from './revenue-seeking-engine.js';
import type { EconomicProjection } from './economic-state-service.js';
import { createApiRoutes } from '../api/routes.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeProjection(overrides?: Partial<EconomicProjection>): EconomicProjection {
  return {
    totalRevenueCents: 5000,
    totalSpendCents: 3000,
    currentBalanceCents: 10000,
    reserveCents: 2000,
    burnRateCentsPerDay: 200,
    dailyRevenueCents: 100,
    netFlowCentsPerDay: -100,
    runwayDays: 50,
    survivalTier: 'normal',
    isSelfSustaining: false,
    revenueBySource: {},
    projectedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSurface(id = 'test-srf') {
  return {
    id,
    name: `Test Surface ${id}`,
    type: 'api_access' as const,
    isActive: true,
    totalEarnedCents: 0,
    transactionCount: 0,
    pricePolicy: {
      basePriceCents: 100,
      survivalMultipliers: {
        thriving: 1.0, normal: 1.0, frugal: 1.2, critical: 1.5, terminal: 2.0, dead: 0,
      },
    },
    registeredAt: new Date().toISOString(),
  };
}

function makeVerification(verified = true): PaymentProofVerificationResult {
  return {
    verified,
    method: 'test',
    rejectionReason: verified ? undefined : 'test rejection',
    verifiedAt: new Date().toISOString(),
  };
}

function makeProof(amount = 500) {
  return {
    txHash: `0x${Math.random().toString(16).substring(2)}`,
    chain: 'test-chain',
    from: '0x1234',
    amount,
    verifiedAt: new Date().toISOString(),
  };
}

// ── V1: Revenue Surface Requires Valid Payment Proof ──────────────────

describe('V1: Payment Proof Validation', () => {
  it('unverified payment does NOT count as confirmed revenue', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const contract = reg.recordPayment('test-srf', makeProof(500), makeVerification(false));
    expect(contract.status).toBe('rejected');
    expect(reg.totalRevenue()).toBe(0);
    expect(reg.getReceipts().length).toBe(0);
  });

  it('pending payment (no verification) uses backward compat (verified)', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    // No verification param → backward compat → verified
    const contract = reg.recordPayment('test-srf', makeProof(500));
    expect(contract.status).toBe('verified');
    expect(reg.totalRevenue()).toBe(500);
  });

  it('explicitly verified payment counts as revenue', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const contract = reg.recordPayment('test-srf', makeProof(300), makeVerification(true));
    expect(contract.status).toBe('verified');
    expect(reg.totalRevenue()).toBe(300);
    expect(reg.getReceipts().length).toBe(1);
  });
});

// ── V2: Verified Proof Flows Into Revenue + Projection ───────────────

describe('V2: Payment Proof → Revenue Flow', () => {
  it('verified proof generates receipt for revenue service', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());
    let received: unknown = null;
    reg.onRevenueRecorded(receipt => { received = receipt; });

    reg.recordPayment('test-srf', makeProof(1000), makeVerification(true));
    expect(received).not.toBeNull();
    expect((received as any).amountCents).toBe(1000);
  });

  it('pending proof can be later verified and then generates receipt', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());
    let receiptCount = 0;
    reg.onRevenueRecorded(() => { receiptCount++; });

    const contract = reg.recordPayment('test-srf', makeProof(750), makeVerification(false));
    expect(receiptCount).toBe(0); // rejected, no receipt

    // Record a proper pending payment
    const pending = reg.recordPayment('test-srf', makeProof(800), {
      verified: false,
      method: 'test',
      verifiedAt: new Date().toISOString(),
    } as any);
    // This creates a pending contract since rejectionReason is undefined
    expect(pending.status).toBe('pending');
    expect(receiptCount).toBe(0);

    // Now verify it
    const verified = reg.verifyPayment(pending.id, makeVerification(true));
    expect(verified).toBe(true);
    expect(receiptCount).toBe(1);
  });

  it('fulfillment tracking links proof to task delivery', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const contract = reg.recordPayment('test-srf', makeProof(500), makeVerification(true));
    const fulfillment = reg.linkFulfillment(contract.id, {
      status: 'completed',
      taskId: 'task-123',
      deliverable: 'API response',
      completedAt: new Date().toISOString(),
    });

    expect(fulfillment).toBeDefined();
    expect(fulfillment!.proofId).toBe(contract.id);
    expect(reg.getFulfillmentStatus(contract.id)?.status).toBe('completed');
  });
});

// ── V3: Profitability Evaluator Rejects Unsustainable ────────────────

describe('V3: Profitability — Reject Unsustainable', () => {
  it('rejects task whose cost exceeds balance threshold', () => {
    const evaluator = new ProfitabilityEvaluator({ maxCostToBalanceRatio: 0.5 });
    const commitment = createCommitment({
      name: 'Expensive task',
      kind: 'maintenance',
      origin: 'self',
      expectedValueCents: 100,
      estimatedCostCents: 6000, // 60% of balance
    });
    const projection = makeProjection({ currentBalanceCents: 10000 });

    const result = evaluator.evaluate(commitment, projection);
    expect(result.verdict).toBe('reject');
    expect(result.rejectDueToUnsustainableCost).toBe(true);
  });

  it('defers task with deeply negative net value', () => {
    const evaluator = new ProfitabilityEvaluator({ deferNetValueFloorCents: -500 });
    const commitment = createCommitment({
      name: 'Costly low-value',
      kind: 'maintenance',
      origin: 'self',
      expectedValueCents: 0,
      estimatedCostCents: 1000, // net = -1000, below -500 floor
    });
    const projection = makeProjection();

    const result = evaluator.evaluate(commitment, projection);
    expect(result.verdict).toBe('defer');
    expect(result.deferDueToNegativeValue).toBe(true);
  });
});

// ── V4: Prioritize Revenue-Positive Survival-Critical Tasks ──────────

describe('V4: Profitability — Survival Override', () => {
  it('admits revenue-positive task under critical runway', () => {
    const evaluator = new ProfitabilityEvaluator({ criticalRunwayDays: 7 });
    const commitment = createCommitment({
      name: 'Revenue task',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 2000,
      estimatedCostCents: 500,
      revenueBearing: true,
    });
    const projection = makeProjection({ runwayDays: 3, survivalTier: 'critical' });

    const result = evaluator.evaluate(commitment, projection);
    expect(result.verdict).toBe('admit');
    expect(result.reserveCriticalOverride).toBe(true);
  });

  it('defers non-revenue task under critical runway', () => {
    const evaluator = new ProfitabilityEvaluator({ criticalRunwayDays: 7 });
    const commitment = createCommitment({
      name: 'Non-revenue task',
      kind: 'maintenance',
      origin: 'self',
      revenueBearing: false,
    });
    const projection = makeProjection({ runwayDays: 3, survivalTier: 'critical' });

    const result = evaluator.evaluate(commitment, projection);
    expect(result.verdict).toBe('defer');
  });

  it('always admits mustPreserve commitments', () => {
    const evaluator = new ProfitabilityEvaluator();
    const commitment = createCommitment({
      name: 'Critical maintenance',
      kind: 'maintenance',
      origin: 'system',
      mustPreserve: true,
      estimatedCostCents: 9000,
    });
    const projection = makeProjection({ currentBalanceCents: 10000 });

    const result = evaluator.evaluate(commitment, projection);
    expect(result.verdict).toBe('admit');
    expect(result.mustDoDespiteLoss).toBe(true);
  });
});

// ── V5: Autonomous Agenda V2 ─────────────────────────────────────────

describe('V5: Autonomous Agenda Consumes Full Input', () => {
  it('agenda integrates profitability gate and filters rejected', () => {
    const evaluator = new ProfitabilityEvaluator({ maxCostToBalanceRatio: 0.3 });
    const gen = new AgendaGenerator(undefined, evaluator);

    const expensive = createCommitment({
      name: 'Too expensive',
      kind: 'maintenance',
      origin: 'self',
      estimatedCostCents: 5000, // > 30% of 10000
      expectedValueCents: 100,
    });
    const cheap = createCommitment({
      name: 'Affordable',
      kind: 'revenue',
      origin: 'external',
      estimatedCostCents: 100,
      expectedValueCents: 500,
      revenueBearing: true,
    });

    const result = gen.generate({
      commitments: [expensive, cheap],
      mode: 'normal',
      tier: 'normal',
      projection: makeProjection({ currentBalanceCents: 10000 }),
    });

    // Expensive should be rejected/deferred
    expect(result.deferred.some(d => d.commitment.id === expensive.id)).toBe(true);
    // Cheap should be selected
    expect(result.selected.some(s => s.commitment.id === cheap.id)).toBe(true);
    // Profitability gate results should be present
    expect(result.profitabilityGateResults).toBeDefined();
    expect(result.profitabilityGateResults!.length).toBe(2);
  });

  it('agenda V2 includes taskCategory and value/cost fields', () => {
    const gen = new AgendaGenerator();
    const c = createCommitment({
      name: 'Revenue task',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 1000,
      estimatedCostCents: 200,
      revenueBearing: true,
    });

    const result = gen.generate({
      commitments: [c],
      mode: 'normal',
      tier: 'normal',
    });

    expect(result.selected.length).toBe(1);
    expect(result.selected[0]!.taskCategory).toBe('revenue-seeking');
    expect(result.selected[0]!.expectedValueCents).toBe(1000);
    expect(result.selected[0]!.expectedCostCents).toBe(200);
  });

  it('pendingPaidWork boosts score', () => {
    const gen = new AgendaGenerator();
    const paid = createCommitment({
      name: 'Paid work',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 100,
      priority: 'low',
    });
    const regular = createCommitment({
      name: 'Regular work',
      kind: 'maintenance',
      origin: 'self',
      priority: 'high',
    });

    const result = gen.generate({
      commitments: [paid, regular],
      mode: 'normal',
      tier: 'normal',
      pendingPaidWork: [paid.id],
      maxItems: 1,
    });

    // Paid work should be boosted and selected
    expect(result.selected[0]!.commitment.id).toBe(paid.id);
    expect(result.selected[0]!.reasons.some(r => r.includes('Pending paid work boost'))).toBe(true);
  });
});

// ── V6: Scheduler Persistence ────────────────────────────────────────

describe('V6: Scheduler Persistence and Recovery', () => {
  it('schedules tasks and restores from snapshot', () => {
    const backend = new MemorySchedulerBackend();
    const task = createScheduledTask({
      commitmentId: 'cmt-1',
      taskType: 'api_call',
      dueAt: new Date(Date.now() + 60_000).toISOString(), // future
    });
    backend.schedule(task);
    expect(backend.allPending().length).toBe(1);

    // Serialize
    const snapshot = backend.serialize();
    expect(snapshot.tasks.length).toBe(1);
    expect(snapshot.pendingCount).toBe(1);

    // Restore into new backend
    const backend2 = new MemorySchedulerBackend();
    backend2.restore(snapshot);
    expect(backend2.allPending().length).toBe(1);
    expect(backend2.getTask(task.id)?.commitmentId).toBe('cmt-1');
  });

  it('tick dispatches due tasks and calls handler', () => {
    const backend = new MemorySchedulerBackend();
    const past = new Date(Date.now() - 60_000).toISOString();
    const task = createScheduledTask({
      commitmentId: 'cmt-2',
      taskType: 'fulfill',
      dueAt: past,
    });
    backend.schedule(task);

    const completed: string[] = [];
    const service = new SchedulerService(backend, (t) => {
      completed.push(t.id);
      return { taskId: t.id, success: true, result: 'done' };
    });

    const result = service.tick();
    expect(result.dispatched).toBe(1);
    expect(completed).toContain(task.id);
    expect(backend.getTask(task.id)?.status).toBe('completed');
  });

  it('failed task retries until maxRetries exceeded', () => {
    const backend = new MemorySchedulerBackend();
    const task = createScheduledTask({
      commitmentId: 'cmt-3',
      taskType: 'flaky',
      dueAt: new Date(Date.now() - 1000).toISOString(),
      maxRetries: 2,
    });
    backend.schedule(task);

    // First failure → retry
    backend.markDispatched(task.id);
    backend.markFailed(task.id, 'timeout');
    expect(backend.getTask(task.id)?.status).toBe('pending');
    expect(backend.getTask(task.id)?.retryCount).toBe(1);

    // Second failure → retry
    backend.markDispatched(task.id);
    backend.markFailed(task.id, 'timeout again');
    expect(backend.getTask(task.id)?.status).toBe('failed');
    expect(backend.getTask(task.id)?.retryCount).toBe(2);
  });
});

// ── V7: Checkpoint/Recovery ──────────────────────────────────────────

describe('V7: Checkpoint Recovery', () => {
  it('creates checkpoint and reconciles after restart', () => {
    const manager = new CheckpointManager();
    const backend = new MemorySchedulerBackend();

    // Schedule a task that was dispatched (in-flight)
    const task = createScheduledTask({
      commitmentId: 'cmt-4',
      taskType: 'api_call',
      dueAt: new Date().toISOString(),
    });
    backend.schedule(task);
    backend.markDispatched(task.id);

    const checkpoint = manager.createCheckpoint({
      schedulerSnapshot: backend.serialize(),
      activeCommitmentIds: ['cmt-4', 'cmt-5'],
      unfulfilledPaidIds: ['cmt-4'],
    });

    expect(checkpoint.sequenceNumber).toBe(1);
    expect(checkpoint.activeCommitmentIds).toContain('cmt-4');

    // Simulate restart — reconcile
    const report = manager.reconcile(checkpoint, {
      currentCommitmentIds: ['cmt-4', 'cmt-5'],
    });

    expect(report.inFlightTaskIds).toContain(task.id);
    expect(report.pendingFulfillment).toContain('cmt-4');
    expect(report.requiresReEvaluation).toBe(false); // no agenda in checkpoint
    expect(report.actions.length).toBeGreaterThan(0);
  });

  it('detects economic drift', () => {
    const manager = new CheckpointManager();
    const backend = new MemorySchedulerBackend();

    const checkpoint = manager.createCheckpoint({
      schedulerSnapshot: backend.serialize(),
      activeCommitmentIds: [],
      economicSnapshot: makeProjection({ currentBalanceCents: 10000 }),
    });

    const report = manager.reconcile(checkpoint, {
      currentCommitmentIds: [],
      currentProjection: makeProjection({ currentBalanceCents: 5000 }),
    });

    expect(report.economicDrift).toBe(true);
  });
});

// ── V8: Revenue-Seeking Discovery ────────────────────────────────────

describe('V8: Revenue-Seeking Engine', () => {
  it('discovers unfulfilled payments as highest-priority opportunities', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());
    reg.recordPayment('test-srf', makeProof(500), makeVerification(true));
    // This payment is verified but unfulfilled

    const engine = new RevenueSeekingEngine();
    const result = engine.scan(reg, []);

    expect(result.unfulfilledPayments).toBe(1);
    expect(result.opportunities.length).toBeGreaterThanOrEqual(1);
    expect(result.opportunities[0]!.requiredAction).toBe('fulfill_paid_contract');
  });

  it('discovers stalled revenue commitments', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const commitment = createCommitment({
      name: 'Revenue commitment',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 2000,
      revenueBearing: true,
    });
    // Make it active
    (commitment as any).status = 'active';

    const engine = new RevenueSeekingEngine();
    const result = engine.scan(reg, [commitment]);

    expect(result.opportunities.some(o => o.requiredAction === 'execute_revenue_commitment')).toBe(true);
  });

  it('in survival mode, proactively seeks payable work on active surfaces', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const engine = new RevenueSeekingEngine();
    const result = engine.scan(reg, [], makeProjection({
      survivalTier: 'critical',
    }));

    expect(result.survivalModeActive).toBe(true);
    expect(result.opportunities.some(o => o.requiredAction === 'seek_payable_work')).toBe(true);
  });

  it('prioritized list puts unfulfilled payments first', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());
    reg.recordPayment('test-srf', makeProof(100), makeVerification(true));

    const engine = new RevenueSeekingEngine();
    engine.scan(reg, []);

    const activeCommitment = createCommitment({
      name: 'Revenue',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 5000,
      revenueBearing: true,
    });
    (activeCommitment as any).status = 'active';
    engine.scan(reg, [activeCommitment]);

    const prioritized = engine.getPrioritized();
    expect(prioritized.length).toBeGreaterThanOrEqual(2);
    // Unfulfilled payment (proofId present) should come first
    expect(prioritized[0]!.proofId).toBeDefined();
  });
});

// ── V9: Control Surface Accuracy ─────────────────────────────────────

describe('V9: Control Surface Reflects Truth', () => {
  it('autonomous routes include scheduler, checkpoint, revenue in API', () => {
    const routes = createApiRoutes({});
    const paths = routes.map(r => r.path);
    expect(paths).toContain('/api/autonomous/status');
    expect(paths).toContain('/api/autonomous/scheduler');
    expect(paths).toContain('/api/autonomous/revenue-opportunities');
  });

  it('scheduler service stats reflect actual state', () => {
    const backend = new MemorySchedulerBackend();
    const service = new SchedulerService(backend);

    const t1 = createScheduledTask({ commitmentId: 'c1', taskType: 'a', dueAt: new Date().toISOString() });
    const t2 = createScheduledTask({ commitmentId: 'c2', taskType: 'b', dueAt: new Date().toISOString() });
    backend.schedule(t1);
    backend.schedule(t2);
    backend.markCompleted(t1.id);

    const stats = service.stats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(1);
  });

  it('agenda scheduleFromAgenda creates tasks for all selected items', () => {
    const backend = new MemorySchedulerBackend();
    const service = new SchedulerService(backend);
    const gen = new AgendaGenerator();

    const c1 = createCommitment({ name: 'Task A', kind: 'revenue', origin: 'external', revenueBearing: true });
    const c2 = createCommitment({ name: 'Task B', kind: 'maintenance', origin: 'self' });

    const agenda = gen.generate({ commitments: [c1, c2], mode: 'normal', tier: 'normal' });
    const tasks = service.scheduleFromAgenda(agenda);

    expect(tasks.length).toBe(agenda.selected.length);
    expect(backend.allPending().length).toBe(agenda.selected.length);
  });
});

// ── V10: Survival State Changes Behavior ─────────────────────────────

describe('V10: Survival State Changes Task Behavior', () => {
  it('critical survival defers non-revenue in agenda', () => {
    const evaluator = new ProfitabilityEvaluator({ criticalRunwayDays: 7 });
    const gen = new AgendaGenerator(undefined, evaluator);

    const revenueTask = createCommitment({
      name: 'Revenue',
      kind: 'revenue',
      origin: 'external',
      expectedValueCents: 1000,
      estimatedCostCents: 100,
      revenueBearing: true,
    });
    const maintenanceTask = createCommitment({
      name: 'Maintenance',
      kind: 'maintenance',
      origin: 'self',
      estimatedCostCents: 50,
    });

    const criticalProjection = makeProjection({
      runwayDays: 3,
      survivalTier: 'critical',
    });

    const result = gen.generate({
      commitments: [revenueTask, maintenanceTask],
      mode: 'normal',
      tier: 'critical',
      projection: criticalProjection,
    });

    // Revenue should be selected
    expect(result.selected.some(s => s.commitment.id === revenueTask.id)).toBe(true);
    // Maintenance should be deferred (by profitability gate)
    expect(result.deferred.some(d => d.commitment.id === maintenanceTask.id)).toBe(true);
  });

  it('revenue-seeking engine is more aggressive in survival mode', () => {
    const reg = new RevenueSurfaceRegistry();
    reg.register(makeSurface());

    const engine = new RevenueSeekingEngine();

    // Normal mode — no proactive seeking
    const normalResult = engine.scan(reg, [], makeProjection({ survivalTier: 'normal' }));
    const normalSeekCount = normalResult.opportunities.filter(o => o.requiredAction === 'seek_payable_work').length;

    // Reset
    const engine2 = new RevenueSeekingEngine();
    // Critical mode — proactive seeking
    const criticalResult = engine2.scan(reg, [], makeProjection({ survivalTier: 'critical' }));
    const criticalSeekCount = criticalResult.opportunities.filter(o => o.requiredAction === 'seek_payable_work').length;

    expect(criticalSeekCount).toBeGreaterThan(normalSeekCount);
  });

  it('profitability evaluator changes verdict based on survival tier', () => {
    const evaluator = new ProfitabilityEvaluator({ criticalRunwayDays: 7 });

    const nonRevenueTask = createCommitment({
      name: 'Nice-to-have',
      kind: 'memory',
      origin: 'self',
      estimatedCostCents: 200,
    });

    // Healthy — admitted
    const healthyResult = evaluator.evaluate(nonRevenueTask, makeProjection({ runwayDays: 60 }));
    expect(healthyResult.verdict).toBe('admit');

    // Critical — deferred
    const criticalResult = evaluator.evaluate(nonRevenueTask, makeProjection({ runwayDays: 3 }));
    expect(criticalResult.verdict).toBe('defer');
  });
});
