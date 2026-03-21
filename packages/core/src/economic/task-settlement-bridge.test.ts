/**
 * Round 20.2 — TaskSettlementBridge Tests (G2)
 */
import { describe, it, expect } from 'vitest';
import { TaskSettlementBridge, type TaskOutcome } from './task-settlement-bridge.js';
import { CanonicalSettlementLedger } from './settlement-ledger.js';
import { RevenueSurfaceRegistry, createTaskServiceSurface } from './revenue-surface.js';

function makeBridge() {
  const ledger = new CanonicalSettlementLedger();
  const registry = new RevenueSurfaceRegistry();
  registry.register(createTaskServiceSurface('task-svc-1', 500));
  const bridge = new TaskSettlementBridge(ledger, registry);
  return { bridge, ledger, registry };
}

describe('TaskSettlementBridge', () => {
  it('settles successful task with revenue and cost', () => {
    const { bridge } = makeBridge();
    const result = bridge.settleTaskOutcome({
      taskId: 'task-001',
      success: true,
      revenueSurfaceId: 'task-svc-1',
      actualCostCents: 200,
      actualRevenueCents: 800,
    });

    expect(result.settled).toBe(true);
    expect(result.netImpactCents).toBe(600); // 800 - 200
    expect(result.ledgerEntryIds).toHaveLength(2); // spend + income
    expect(result.reserveAffected).toBe(true);
  });

  it('settles failed task recording only cost as loss', () => {
    const { bridge } = makeBridge();
    const result = bridge.settleTaskOutcome({
      taskId: 'task-002',
      success: false,
      actualCostCents: 300,
      actualRevenueCents: 0,
      failureReason: 'timeout',
    });

    expect(result.settled).toBe(true);
    expect(result.netImpactCents).toBe(-300);
    expect(result.reason).toContain('failed');
  });

  it('updates revenue surface stats on success', () => {
    const { bridge, registry } = makeBridge();
    bridge.settleTaskOutcome({
      taskId: 'task-003',
      success: true,
      revenueSurfaceId: 'task-svc-1',
      actualCostCents: 100,
      actualRevenueCents: 500,
    });

    const surface = registry.get('task-svc-1')!;
    expect(surface.totalEarnedCents).toBe(500);
    expect(surface.transactionCount).toBe(1);
  });

  it('does not update revenue surface on failure', () => {
    const { bridge, registry } = makeBridge();
    bridge.settleTaskOutcome({
      taskId: 'task-004',
      success: false,
      revenueSurfaceId: 'task-svc-1',
      actualCostCents: 200,
      actualRevenueCents: 0,
    });

    const surface = registry.get('task-svc-1')!;
    expect(surface.totalEarnedCents).toBe(0);
  });

  it('writes failed entry to ledger', () => {
    const { bridge, ledger } = makeBridge();
    bridge.settleTaskOutcome({
      taskId: 'task-005',
      success: false,
      actualCostCents: 150,
      actualRevenueCents: 0,
      failureReason: 'OOM',
    });

    const failed = ledger.allFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].failureReason).toBe('OOM');
  });

  it('writes pending entries to ledger for successful task', () => {
    const { bridge, ledger } = makeBridge();
    bridge.settleTaskOutcome({
      taskId: 'task-006',
      success: true,
      actualCostCents: 100,
      actualRevenueCents: 400,
    });

    const pending = ledger.allPending();
    expect(pending).toHaveLength(2); // spend + income
  });

  it('handles zero-cost task', () => {
    const { bridge } = makeBridge();
    const result = bridge.settleTaskOutcome({
      taskId: 'task-007',
      success: true,
      actualCostCents: 0,
      actualRevenueCents: 300,
    });

    expect(result.netImpactCents).toBe(300);
    expect(result.ledgerEntryIds).toHaveLength(1); // only income
  });

  it('tracks diagnostics correctly', () => {
    const { bridge } = makeBridge();

    bridge.settleTaskOutcome({ taskId: 't1', success: true, actualCostCents: 100, actualRevenueCents: 500 });
    bridge.settleTaskOutcome({ taskId: 't2', success: false, actualCostCents: 200, actualRevenueCents: 0 });
    bridge.settleTaskOutcome({ taskId: 't3', success: true, actualCostCents: 50, actualRevenueCents: 300 });

    const diag = bridge.diagnostics();
    expect(diag.totalSettled).toBe(2);
    expect(diag.totalFailed).toBe(1);
    expect(diag.totalRevenueCents).toBe(800);
    expect(diag.totalCostCents).toBe(350);
    expect(diag.netCents).toBe(450);
  });
});
