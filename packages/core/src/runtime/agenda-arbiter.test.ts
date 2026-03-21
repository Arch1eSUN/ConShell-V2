/**
 * Round 20.1 — AgendaArbiter tests
 */
import { describe, it, expect } from 'vitest';
import { AgendaArbiter, type ReprioritizeTrigger } from './agenda-arbiter.js';
import type { TaskAdmissionResult } from '../economic/task-admission-gate.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeAdmissionResult(overrides: Partial<TaskAdmissionResult> = {}): TaskAdmissionResult {
  const defaultProfitability = {
    verdict: 'admit' as const,
    reason: 'Test',
    commitmentId: `cmt-${Math.random().toString(36).slice(2, 8)}`,
    revenuePositive: true,
    reserveCriticalOverride: false,
    mustDoDespiteLoss: false,
    deferDueToNegativeValue: false,
    rejectDueToUnsustainableCost: false,
    expectedRevenueCents: 500,
    expectedCostCents: 100,
    netValueCents: 400,
    survivalValue: 50,
    strategicValue: 50,
  };

  return {
    verdict: 'admit',
    reason: overrides.reason ?? 'Test admission',
    netUtilityCents: overrides.netUtilityCents ?? 100,
    suggestedPriority: overrides.suggestedPriority ?? 'normal',
    survivalOverride: overrides.survivalOverride ?? false,
    admissionTimestamp: overrides.admissionTimestamp ?? new Date().toISOString(),
    survivalGateResult: overrides.survivalGateResult ?? { allowed: true, enforcedTier: 'normal' },
    profitabilityResult: overrides.profitabilityResult ?? defaultProfitability,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('AgendaArbiter', () => {
  describe('rank', () => {
    it('sorts tasks by priority weight descending', () => {
      const arbiter = new AgendaArbiter();
      const results = [
        makeAdmissionResult({ suggestedPriority: 'normal', profitabilityResult: { verdict: 'admit', reason: 'a', commitmentId: 'low', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
        makeAdmissionResult({ suggestedPriority: 'immediate', profitabilityResult: { verdict: 'admit', reason: 'b', commitmentId: 'high', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
      ];

      const ranked = arbiter.rank(results);
      expect(ranked[0].taskId).toBe('high');
      expect(ranked[0].position).toBe(0);
      expect(ranked[1].taskId).toBe('low');
      expect(ranked[1].position).toBe(1);
    });

    it('ranks survival-driven above normal', () => {
      const arbiter = new AgendaArbiter();
      const results = [
        makeAdmissionResult({ suggestedPriority: 'normal', profitabilityResult: { verdict: 'admit', reason: 'n', commitmentId: 'normal-1', revenuePositive: false, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 0, expectedCostCents: 50, netValueCents: -50, survivalValue: 50, strategicValue: 50 } }),
        makeAdmissionResult({ suggestedPriority: 'survival-driven', survivalOverride: true, profitabilityResult: { verdict: 'admit', reason: 's', commitmentId: 'survival-1', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 500, expectedCostCents: 50, netValueCents: 450, survivalValue: 90, strategicValue: 80 } }),
      ];

      const ranked = arbiter.rank(results);
      expect(ranked[0].taskId).toBe('survival-1');
    });
  });

  describe('reprioritize', () => {
    it('re-sorts and records the trigger', () => {
      const arbiter = new AgendaArbiter();
      arbiter.rank([
        makeAdmissionResult({ suggestedPriority: 'normal', profitabilityResult: { verdict: 'admit', reason: 'a', commitmentId: 'a', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
      ]);

      const result = arbiter.reprioritize('economic_state_changed');
      expect(result.length).toBe(1);

      const log = arbiter.getReprioritizeLog();
      expect(log.length).toBe(1);
      expect(log[0].trigger).toBe('economic_state_changed');
    });
  });

  describe('insert and remove', () => {
    it('inserts a new task and re-sorts', () => {
      const arbiter = new AgendaArbiter();
      arbiter.rank([
        makeAdmissionResult({ suggestedPriority: 'normal', profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'existing', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
      ]);

      arbiter.insert(
        makeAdmissionResult({ suggestedPriority: 'immediate', profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'new-urgent', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 1000, expectedCostCents: 50, netValueCents: 950, survivalValue: 50, strategicValue: 50 } }),
      );

      expect(arbiter.length).toBe(2);
      expect(arbiter.top(1)[0].taskId).toBe('new-urgent');
    });

    it('removes a task by ID', () => {
      const arbiter = new AgendaArbiter();
      arbiter.rank([
        makeAdmissionResult({ profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'keep', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
        makeAdmissionResult({ profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'remove-me', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
      ]);

      const removed = arbiter.remove('remove-me');
      expect(removed).toBe(true);
      expect(arbiter.length).toBe(1);
    });
  });

  describe('top', () => {
    it('returns the top N tasks', () => {
      const arbiter = new AgendaArbiter();
      arbiter.rank([
        makeAdmissionResult({ suggestedPriority: 'deferred', profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'c', revenuePositive: false, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 0, expectedCostCents: 50, netValueCents: -50, survivalValue: 50, strategicValue: 50 } }),
        makeAdmissionResult({ suggestedPriority: 'high', profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'a', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 500, expectedCostCents: 50, netValueCents: 450, survivalValue: 50, strategicValue: 50 } }),
        makeAdmissionResult({ suggestedPriority: 'normal', profitabilityResult: { verdict: 'admit', reason: '', commitmentId: 'b', revenuePositive: true, reserveCriticalOverride: false, mustDoDespiteLoss: false, deferDueToNegativeValue: false, rejectDueToUnsustainableCost: false, expectedRevenueCents: 100, expectedCostCents: 50, netValueCents: 50, survivalValue: 50, strategicValue: 50 } }),
      ]);

      const topTwo = arbiter.top(2);
      expect(topTwo.length).toBe(2);
      expect(topTwo[0].taskId).toBe('a');
    });
  });
});
