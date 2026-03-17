/**
 * SpendTracker — Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpendTracker, type BudgetAlert } from './index.js';

describe('SpendTracker', () => {
  let tracker: SpendTracker;

  beforeEach(() => {
    tracker = new SpendTracker({
      dailyLimitCents: 1000,
      hourlyLimitCents: 200,
      maxSingleSpendCents: 100,
      initialBalanceCents: 5000,
    });
  });

  describe('recordSpend', () => {
    it('should record valid spend', () => {
      const ok = tracker.recordSpend('openai', 50, { model: 'gpt-4o' });
      expect(ok).toBe(true);
      expect(tracker.getBalance()).toBe(4950);
    });

    it('should reject single spend over limit', () => {
      const alerts: BudgetAlert[] = [];
      tracker.onAlert(a => alerts.push(a));
      const ok = tracker.recordSpend('openai', 150);
      expect(ok).toBe(false);
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('single_limit');
    });

    it('should reject when hourly limit exceeded', () => {
      // Fill up hourly limit
      tracker.recordSpend('openai', 90);
      tracker.recordSpend('openai', 90);
      // This should fail (90+90+90 = 270 > 200)
      const ok = tracker.recordSpend('openai', 90);
      expect(ok).toBe(false);
    });

    it('should reject when daily limit exceeded', () => {
      // Make many small transactions
      for (let i = 0; i < 10; i++) tracker.recordSpend('openai', 99);
      // 990 spent, next should exceed 1000
      const ok = tracker.recordSpend('openai', 50);
      expect(ok).toBe(false);
    });

    it('should emit low_balance alert', () => {
      const alerts: BudgetAlert[] = [];
      tracker.onAlert(a => alerts.push(a));
      // Spend most of balance (5000 initial, need to get below 500 = 10%)
      // Use a fresh tracker with higher per-limits
      const t2 = new SpendTracker({
        dailyLimitCents: 50_000,
        hourlyLimitCents: 50_000,
        maxSingleSpendCents: 5_000,
        initialBalanceCents: 5000,
      });
      t2.onAlert(a => alerts.push(a));
      t2.recordSpend('openai', 4_600);
      expect(alerts.some(a => a.type === 'low_balance')).toBe(true);
    });
  });

  describe('recordIncome', () => {
    it('should increase balance', () => {
      tracker.recordIncome('x402', 1000, '0xabc');
      expect(tracker.getBalance()).toBe(6000);
    });

    it('should track in aggregates', () => {
      tracker.recordIncome('x402', 500);
      const agg = tracker.aggregates();
      expect((agg.totalIncomeCents as unknown as number)).toBe(500);
    });
  });

  describe('getBalance', () => {
    it('should reflect initial balance', () => {
      expect(tracker.getBalance()).toBe(5000);
    });

    it('should account for spend and income', () => {
      tracker.recordSpend('openai', 50);
      tracker.recordIncome('x402', 200);
      expect(tracker.getBalance()).toBe(5150); // 5000 - 50 + 200
    });
  });

  describe('getBudgetRemainingPct', () => {
    it('should be 100% when nothing spent', () => {
      expect(tracker.getBudgetRemainingPct()).toBe(100);
    });

    it('should decrease with spending', () => {
      const bigTracker = new SpendTracker({
        dailyLimitCents: 100_000,
        hourlyLimitCents: 100_000,
        maxSingleSpendCents: 10_000,
        initialBalanceCents: 10_000,
      });
      bigTracker.recordSpend('openai', 5_000);
      expect(bigTracker.getBudgetRemainingPct()).toBe(50);
    });
  });

  describe('aggregates', () => {
    it('should return breakdown by provider', () => {
      tracker.recordSpend('openai', 50, { model: 'gpt-4o' });
      tracker.recordSpend('anthropic', 30, { model: 'claude-4' });
      tracker.recordSpend('openai', 20, { model: 'gpt-4o' });

      const agg = tracker.aggregates();
      expect(agg.breakdown.length).toBe(2); // openai:gpt-4o and anthropic:claude-4
      const openai = agg.breakdown.find(b => b.provider === 'openai');
      expect(openai?.requests).toBe(2);
    });

    it('should calculate burn rate', () => {
      tracker.recordSpend('openai', 50);
      tracker.recordSpend('openai', 50);
      const agg = tracker.aggregates();
      expect(agg.burnRateCentsPerDay).toBeGreaterThanOrEqual(0);
    });

    it('should estimate survival days', () => {
      const agg = tracker.aggregates();
      expect(agg.estimatedSurvivalDays).toBeGreaterThan(0);
    });
  });

  describe('getRecords / loadRecords', () => {
    it('should export and import records', () => {
      tracker.recordSpend('openai', 50);
      tracker.recordIncome('x402', 200);
      const data = tracker.getRecords();

      const t2 = new SpendTracker({ initialBalanceCents: 5000 });
      t2.loadRecords(data);
      expect(t2.getBalance()).toBe(5150);
    });
  });

  describe('onAlert', () => {
    it('should return unsubscribe function', () => {
      const alerts: BudgetAlert[] = [];
      const unsub = tracker.onAlert(a => alerts.push(a));
      tracker.recordSpend('openai', 150); // over single limit
      expect(alerts.length).toBe(1);
      unsub();
      tracker.recordSpend('openai', 150);
      expect(alerts.length).toBe(1); // no new alert
    });
  });

  describe('getBurnInfo', () => {
    it('should return burn info for automaton integration', () => {
      tracker.recordSpend('openai', 50);
      const info = tracker.getBurnInfo();
      expect(info.balanceCents).toBe(4950);
      expect(info.dailyBurnCents).toBeGreaterThanOrEqual(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // Round 15.5: PolicyDecision (upgraded from 15.4 GovernanceVerdict)
  // ══════════════════════════════════════════════════════════════════

  describe('PolicyDecision (Round 15.5)', () => {
    it('fresh tracker → allow level, no actions', () => {
      const d = tracker.assessPressure();
      expect(d.level).toBe('allow');
      expect(d.selectedActions).toEqual([]);
      expect(d.reasonCodes).toEqual([]);
      expect(d.violatedScopes).toEqual([]);
      expect(d.maxIterationsCap).toBeNull();
      expect(d.overrideable).toBe(false); // allow is not overrideable
      expect(d.decisionTimestamp).toBeTruthy();
      expect(d.metricsSnapshot.balanceCents).toBe(5000);
    });

    it('50% hourly utilization → caution level with guidance + cap', () => {
      // hourlyLimitCents = 200, spend 100 → 50%
      tracker.recordSpend('openai', 99);
      tracker.recordSpend('openai', 1);
      const d = tracker.assessPressure();
      expect(d.level).toBe('caution');
      expect(d.selectedActions).toContain('inject_guidance');
      expect(d.selectedActions).toContain('cap_iterations');
      expect(d.maxIterationsCap).toBe(3);
      expect(d.reasonCodes).toContain('HOURLY_BUDGET_NEAR_LIMIT');
    });

    it('80% hourly utilization → degrade level, single iteration cap', () => {
      tracker.recordSpend('openai', 80);
      tracker.recordSpend('openai', 80);
      const d = tracker.assessPressure();
      expect(d.level).toBe('degrade');
      expect(d.selectedActions).toContain('cap_iterations');
      expect(d.maxIterationsCap).toBe(1);
      expect(d.reasonCodes).toContain('DEGRADE_POLICY_TRIGGERED');
    });

    it('95%+ utilization → block level', () => {
      tracker.recordSpend('openai', 95);
      tracker.recordSpend('openai', 95);
      const d = tracker.assessPressure();
      expect(d.level).toBe('block');
      expect(d.selectedActions).toContain('block_inference');
      expect(d.reasonCodes).toContain('BLOCK_POLICY_TRIGGERED');
    });

    it('zero balance → block with BALANCE_EXHAUSTED reason code', () => {
      const bigTracker = new SpendTracker({
        dailyLimitCents: 100_000,
        hourlyLimitCents: 100_000,
        maxSingleSpendCents: 100_000,
        initialBalanceCents: 100,
      });
      bigTracker.recordSpend('openai', 99);
      bigTracker.recordSpend('anthropic', 1);
      const d = bigTracker.assessPressure();
      expect(d.level).toBe('block');
      expect(d.reasonCodes).toContain('BALANCE_EXHAUSTED');
      expect(d.recoveryHint).toContain('recovery requires income');
    });

    it('daily limit drives level when worse than hourly', () => {
      const t = new SpendTracker({
        dailyLimitCents: 200,
        hourlyLimitCents: 10_000,
        maxSingleSpendCents: 500,
        initialBalanceCents: 50_000,
      });
      t.recordSpend('openai', 60);
      t.recordSpend('openai', 60);
      const d = t.assessPressure();
      expect(d.level).toBe('caution');
      expect(d.reasonCodes).toContain('DAILY_BUDGET_NEAR_LIMIT');
      expect(d.violatedScopes).toContain('daily');
    });

    it('decision is serializable (JSON round-trip)', () => {
      tracker.recordSpend('openai', 50);
      const d = tracker.assessPressure();
      const json = JSON.stringify(d);
      const parsed = JSON.parse(json);
      expect(parsed.level).toBe(d.level);
      expect(parsed.reasonCodes).toEqual(d.reasonCodes);
      expect(parsed.selectedActions).toEqual(d.selectedActions);
      expect(parsed.decisionTimestamp).toBe(d.decisionTimestamp);
      expect(parsed.metricsSnapshot).toBeDefined();
    });
  });
});
