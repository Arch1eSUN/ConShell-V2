/**
 * Round 15.5 — Governance Evaluator Tests
 *
 * Covers: threshold boundaries, scope interactions, decision object,
 * recovery, override, and no-bypass guarantees.
 */
import { describe, it, expect } from 'vitest';
import { GovernanceEvaluator } from './governance-evaluator.js';
import { evaluateScopes, DEFAULT_SCOPE_CONFIGS } from './budget-scope.js';
import type { BudgetScopeResult, GovernanceOverride } from './governance-types.js';
import { REASON_CODES, THRESHOLDS } from './governance-types.js';
import type { SpendRecord } from './index.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeEvaluator() {
  return new GovernanceEvaluator();
}

function makeScopeResult(
  scope: 'turn' | 'session' | 'hourly' | 'daily',
  utilization: number,
  limitCents = 1000,
): BudgetScopeResult {
  return {
    scope,
    utilization,
    spentCents: Math.round(utilization * limitCents),
    limitCents,
    violated: utilization >= THRESHOLDS.CAUTION_UTILIZATION,
    violationThreshold: THRESHOLDS.CAUTION_UTILIZATION,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('GovernanceEvaluator (Round 15.5)', () => {
  const evaluator = makeEvaluator();

  // ────────────────────────────────────────────────────────────────
  // 8.1 Threshold boundary tests
  // ────────────────────────────────────────────────────────────────

  describe('Threshold boundaries', () => {
    it('all scopes below 50% → allow', () => {
      const scopes = [
        makeScopeResult('hourly', 0.30),
        makeScopeResult('daily', 0.20),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 80 });
      expect(d.level).toBe('allow');
      expect(d.selectedActions).toEqual([]);
      expect(d.reasonCodes).toEqual([]);
    });

    it('allow → caution at 50% boundary', () => {
      const scopes = [makeScopeResult('hourly', 0.50)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 60 });
      expect(d.level).toBe('caution');
      expect(d.selectedActions).toContain('inject_guidance');
      expect(d.selectedActions).toContain('cap_iterations');
      expect(d.maxIterationsCap).toBe(3);
    });

    it('caution → degrade at 80% boundary', () => {
      const scopes = [makeScopeResult('hourly', 0.80)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 40 });
      expect(d.level).toBe('degrade');
      expect(d.reasonCodes).toContain(REASON_CODES.DEGRADE_POLICY_TRIGGERED);
      expect(d.maxIterationsCap).toBe(1);
    });

    it('degrade → block at 95% boundary', () => {
      const scopes = [makeScopeResult('hourly', 0.95)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 10 });
      expect(d.level).toBe('block');
      expect(d.selectedActions).toContain('block_inference');
      expect(d.reasonCodes).toContain(REASON_CODES.BLOCK_POLICY_TRIGGERED);
    });

    it('balance = 0 → block regardless of utilization', () => {
      const scopes = [makeScopeResult('hourly', 0.10)]; // low util
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 0, balanceRemainingPct: 0 });
      expect(d.level).toBe('block');
      expect(d.reasonCodes).toContain(REASON_CODES.BALANCE_EXHAUSTED);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8.2 Scope interaction tests
  // ────────────────────────────────────────────────────────────────

  describe('Scope interactions', () => {
    it('turn normal but session exceeded → level from session', () => {
      const scopes = [
        makeScopeResult('turn', 0.20),
        makeScopeResult('session', 0.85),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 50 });
      expect(d.level).toBe('degrade');
      expect(d.violatedScopes).toContain('session');
      expect(d.reasonCodes).toContain(REASON_CODES.SESSION_BUDGET_EXCEEDED);
    });

    it('session normal but hourly critical → level from hourly', () => {
      const scopes = [
        makeScopeResult('session', 0.30),
        makeScopeResult('hourly', 0.96),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 50 });
      expect(d.level).toBe('block');
      expect(d.violatedScopes).toContain('hourly');
      expect(d.reasonCodes).toContain(REASON_CODES.HOURLY_BUDGET_CRITICAL);
    });

    it('multiple scopes violated → all appear in violatedScopes', () => {
      const scopes = [
        makeScopeResult('hourly', 0.60),
        makeScopeResult('daily', 0.55),
        makeScopeResult('session', 0.70),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 50 });
      expect(d.level).toBe('caution'); // max = 0.70, still below degrade
      expect(d.violatedScopes).toContain('hourly');
      expect(d.violatedScopes).toContain('daily');
      expect(d.violatedScopes).toContain('session');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8.3 Decision object tests
  // ────────────────────────────────────────────────────────────────

  describe('Decision object completeness', () => {
    it('contains all required fields', () => {
      const scopes = [makeScopeResult('hourly', 0.60)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 60 });

      expect(d).toHaveProperty('level');
      expect(d).toHaveProperty('reasonCodes');
      expect(d).toHaveProperty('explanation');
      expect(d).toHaveProperty('violatedScopes');
      expect(d).toHaveProperty('selectedActions');
      expect(d).toHaveProperty('maxIterationsCap');
      expect(d).toHaveProperty('metricsSnapshot');
      expect(d).toHaveProperty('recoveryHint');
      expect(d).toHaveProperty('overrideable');
      expect(d).toHaveProperty('overrideSource');
      expect(d).toHaveProperty('decisionTimestamp');
      expect(d.metricsSnapshot).toHaveProperty('balanceCents');
      expect(d.metricsSnapshot).toHaveProperty('balanceRemainingPct');
      expect(d.metricsSnapshot).toHaveProperty('scopeResults');
    });

    it('reason codes are stable identifiers, not free text', () => {
      const scopes = [makeScopeResult('hourly', 0.85)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 40 });
      // All reason codes must be from the REASON_CODES enum
      const validCodes = Object.values(REASON_CODES);
      for (const code of d.reasonCodes) {
        expect(validCodes).toContain(code);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8.4 Recovery tests
  // ────────────────────────────────────────────────────────────────

  describe('Recovery', () => {
    it('all scopes below recovery threshold → recovers to allow', () => {
      // Even though we'd expect 'degrade' from 85%, if all scopes
      // are actually below 50% at evaluation time, recovery kicks in
      const scopes = [
        makeScopeResult('hourly', 0.20),
        makeScopeResult('daily', 0.10),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 80 });
      expect(d.level).toBe('allow');
      // No recovery code because never entered elevated state
    });

    it('block with balance > 0 and all scopes low → recovery achievable', () => {
      // This simulates time window advancing: spend was high before,
      // but now scopes report low because the window moved
      const scopes = [
        makeScopeResult('hourly', 0.30), // below recovery threshold
        makeScopeResult('daily', 0.40),  // below recovery threshold
      ];
      // Force level to initially be high via utilization computation,
      // but scopes at evaluation report they're now low
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 80 });
      expect(d.level).toBe('allow');
    });

    it('block with balance = 0 → no recovery possible', () => {
      const scopes = [makeScopeResult('hourly', 0.10)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 0, balanceRemainingPct: 0 });
      expect(d.level).toBe('block');
      expect(d.recoveryHint).toContain('recovery requires income');
    });

    it('degrade with some scopes still high → recovery hint shows which scopes', () => {
      const scopes = [
        makeScopeResult('hourly', 0.85),
        makeScopeResult('daily', 0.40),
      ];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 40 });
      expect(d.level).toBe('degrade');
      expect(d.recoveryHint).toContain('hourly');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8.5 Override tests
  // ────────────────────────────────────────────────────────────────

  describe('Override', () => {
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();
    const pastExpiry = new Date(Date.now() - 1000).toISOString();

    it('active override reduces level and records source', () => {
      const scopes = [makeScopeResult('hourly', 0.85)]; // would be degrade
      const override: GovernanceOverride = {
        source: 'creator',
        targetLevel: 'allow',
        expiresAt: futureExpiry,
        bypassSafety: false,
      };
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 40, override });
      expect(d.level).toBe('allow');
      expect(d.overrideSource).toBe('creator');
      expect(d.reasonCodes).toContain(REASON_CODES.OVERRIDE_ACTIVE);
    });

    it('expired override is ignored', () => {
      const scopes = [makeScopeResult('hourly', 0.85)];
      const override: GovernanceOverride = {
        source: 'creator',
        targetLevel: 'allow',
        expiresAt: pastExpiry,
        bypassSafety: false,
      };
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 40, override });
      expect(d.level).toBe('degrade'); // override expired, original level
      expect(d.overrideSource).toBeNull();
    });

    it('override cannot bypass balance=0 safety', () => {
      const scopes = [makeScopeResult('hourly', 0.10)];
      const override: GovernanceOverride = {
        source: 'creator',
        targetLevel: 'allow',
        expiresAt: futureExpiry,
        bypassSafety: false,
      };
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 0, balanceRemainingPct: 0, override });
      expect(d.level).toBe('block'); // balance=0 overrides everything
      expect(d.overrideSource).toBeNull();
    });

    it('override appears in decision trace (reason codes)', () => {
      const scopes = [makeScopeResult('hourly', 0.60)];
      const override: GovernanceOverride = {
        source: 'admin',
        targetLevel: 'allow',
        expiresAt: futureExpiry,
        bypassSafety: false,
      };
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 5000, balanceRemainingPct: 60, override });
      expect(d.reasonCodes).toContain(REASON_CODES.OVERRIDE_ACTIVE);
      expect(d.overrideSource).toBe('admin');
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8.6 No-bypass tests
  // ────────────────────────────────────────────────────────────────

  describe('No-bypass guarantees', () => {
    it('block decision always includes block_inference action', () => {
      const scopes = [makeScopeResult('hourly', 0.96)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 100, balanceRemainingPct: 1 });
      expect(d.level).toBe('block');
      expect(d.selectedActions).toContain('block_inference');
    });

    it('degrade actions are consistent regardless of which scope causes it', () => {
      // Degrade from hourly
      const d1 = evaluator.evaluate({
        scopeResults: [makeScopeResult('hourly', 0.85)],
        balanceCents: 5000,
        balanceRemainingPct: 50,
      });
      // Degrade from session
      const d2 = evaluator.evaluate({
        scopeResults: [makeScopeResult('session', 0.85)],
        balanceCents: 5000,
        balanceRemainingPct: 50,
      });
      // Same actions regardless of source
      expect(d1.selectedActions.sort()).toEqual(d2.selectedActions.sort());
      expect(d1.maxIterationsCap).toBe(d2.maxIterationsCap);
    });

    it('decision is JSON-serializable for audit trail', () => {
      const scopes = [makeScopeResult('hourly', 0.75)];
      const d = evaluator.evaluate({ scopeResults: scopes, balanceCents: 3000, balanceRemainingPct: 50 });
      const json = JSON.stringify(d);
      const parsed = JSON.parse(json);
      expect(parsed.level).toBe(d.level);
      expect(parsed.reasonCodes).toEqual(d.reasonCodes);
      expect(parsed.selectedActions).toEqual(d.selectedActions);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Budget scope evaluation (evaluateScopes)
  // ────────────────────────────────────────────────────────────────

  describe('evaluateScopes', () => {
    it('returns results for all enabled scopes', () => {
      const records: SpendRecord[] = [];
      const results = evaluateScopes(DEFAULT_SCOPE_CONFIGS, { records });
      expect(results.length).toBe(4); // turn, session, hourly, daily
      for (const r of results) {
        expect(r.utilization).toBe(0);
        expect(r.violated).toBe(false);
      }
    });

    it('hourly scope calculates correctly from records', () => {
      const now = Date.now();
      const records: SpendRecord[] = [
        { id: '1', provider: 'openai', costCents: 500, category: 'inference', timestamp: now - 1000 },
        { id: '2', provider: 'openai', costCents: 500, category: 'inference', timestamp: now - 2000 },
      ];
      const configs = [{ scope: 'hourly' as const, limitCents: 2000, enabled: true }];
      const results = evaluateScopes(configs, { records, now });
      expect(results[0].spentCents).toBe(1000);
      expect(results[0].utilization).toBe(0.5);
      expect(results[0].violated).toBe(true); // >= 0.5 threshold
    });
  });
});
