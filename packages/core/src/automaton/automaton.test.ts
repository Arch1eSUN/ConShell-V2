/**
 * Conway Automaton — Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConwayAutomaton,
  MODEL_TIERS,
  CONTEXT_WINDOW_TIERS,
  type EnvironmentSnapshot,
  type SurvivalTier,
} from './index.js';

function makeEnv(overrides?: Partial<EnvironmentSnapshot>): EnvironmentSnapshot {
  return {
    budgetRemainingPct: 80,
    memoryPressure: 0.3,
    activeConnections: 5,
    lastHeartbeat: Date.now(),
    recentIncomeCents: 100,
    recentSpendCents: 50,
    currentModel: 'claude-4-sonnet',
    contextWindowTokens: 128_000,
    ...overrides,
  };
}

describe('ConwayAutomaton', () => {
  let automaton: ConwayAutomaton;

  beforeEach(() => {
    automaton = new ConwayAutomaton();
  });

  describe('initialization', () => {
    it('should start alive at normal tier', () => {
      expect(automaton.currentState()).toBe('alive');
      expect(automaton.isAlive()).toBe(true);
    });

    it('should accept custom config', () => {
      const a = new ConwayAutomaton({
        agentName: 'test-agent',
        generationIntervalMs: 30_000,
        survivalThresholds: { frugalPct: 40, criticalPct: 20, terminalPct: 5, deadPct: 0 },
      });
      expect(a.isAlive()).toBe(true);
    });
  });

  describe('tier calculation', () => {
    it('should be thriving above 60%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 80 }));
      expect(automaton.currentTier()).toBe('thriving');
    });

    it('should be normal between 30-60%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 50 }));
      expect(automaton.currentTier()).toBe('normal');
    });

    it('should be frugal between 10-30%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 20 }));
      expect(automaton.currentTier()).toBe('frugal');
    });

    it('should be critical between 2-10%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 5 }));
      expect(automaton.currentTier()).toBe('critical');
    });

    it('should be terminal between 0-2%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 1 }));
      expect(automaton.currentTier()).toBe('terminal');
    });

    it('should be dead at 0%', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 0 }));
      expect(automaton.currentState()).toBe('dead');
      expect(automaton.currentTier()).toBe('dead');
    });
  });

  describe('evolution', () => {
    it('should increment generation', () => {
      const r1 = automaton.evolve(makeEnv());
      expect(r1.generation).toBe(1);
      const r2 = automaton.evolve(makeEnv());
      expect(r2.generation).toBe(2);
    });

    it('should include adaptations when tier drops to frugal', () => {
      const result = automaton.evolve(makeEnv({ budgetRemainingPct: 20 }));
      expect(result.adaptations.length).toBeGreaterThan(0);
      expect(result.adaptations[0].type).toBe('model_downgrade');
    });

    it('should include multiple adaptations at critical', () => {
      const result = automaton.evolve(makeEnv({ budgetRemainingPct: 5 }));
      expect(result.adaptations.length).toBeGreaterThanOrEqual(3);
      const types = result.adaptations.map(a => a.type);
      expect(types).toContain('model_downgrade');
      expect(types).toContain('context_reduction');
      expect(types).toContain('replication_halt');
    });

    it('should include income_seek at terminal with no income', () => {
      const result = automaton.evolve(makeEnv({ budgetRemainingPct: 1, recentIncomeCents: 0 }));
      const types = result.adaptations.map(a => a.type);
      expect(types).toContain('income_seek');
    });
  });

  describe('death', () => {
    it('should be irreversible', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 0 }));
      expect(automaton.isAlive()).toBe(false);

      // Evolution after death should return dead state
      const result = automaton.evolve(makeEnv({ budgetRemainingPct: 100 }));
      expect(result.state).toBe('dead');
    });

    it('should report death reason in stats', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 0 }));
      const stats = automaton.stats();
      expect(stats.deathReason).toBeDefined();
      expect(stats.deathReason).toContain('Budget');
    });

    it('should prevent wake from dead', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 0 }));
      expect(automaton.wake()).toBe(false);
    });
  });

  describe('dormancy', () => {
    it('should enter dormancy after max consecutive degradations', () => {
      const a = new ConwayAutomaton({ maxConsecutiveDegradations: 3 });
      // Progressively degrade
      a.evolve(makeEnv({ budgetRemainingPct: 80 })); // thriving
      a.evolve(makeEnv({ budgetRemainingPct: 50 })); // → normal (degradation 1)
      a.evolve(makeEnv({ budgetRemainingPct: 20 })); // → frugal (degradation 2)
      a.evolve(makeEnv({ budgetRemainingPct: 5 }));  // → critical (degradation 3, triggers dormancy)
      expect(a.currentState()).toBe('dormant');
    });

    it('should wake from dormancy', () => {
      const a = new ConwayAutomaton({ maxConsecutiveDegradations: 2 });
      a.evolve(makeEnv({ budgetRemainingPct: 80 }));
      a.evolve(makeEnv({ budgetRemainingPct: 20 })); // degradation 1
      a.evolve(makeEnv({ budgetRemainingPct: 5 }));  // degradation 2, dormant
      expect(a.currentState()).toBe('dormant');
      expect(a.wake()).toBe(true);
      expect(a.currentState()).toBe('alive');
    });
  });

  describe('events', () => {
    it('should emit tier_change event', () => {
      const events: any[] = [];
      automaton.on('tier_change', (e) => events.push(e));
      automaton.evolve(makeEnv({ budgetRemainingPct: 20 }));
      expect(events.length).toBe(1);
      expect(events[0].data.to).toBe('frugal');
    });

    it('should emit death event', () => {
      const deaths: any[] = [];
      automaton.on('death', (e) => deaths.push(e));
      automaton.evolve(makeEnv({ budgetRemainingPct: 0 }));
      expect(deaths.length).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const events: any[] = [];
      const unsub = automaton.on('generation', (e) => events.push(e));
      automaton.evolve(makeEnv());
      expect(events.length).toBe(1);
      unsub();
      automaton.evolve(makeEnv());
      expect(events.length).toBe(1); // no new event
    });
  });

  describe('model recommendations', () => {
    it('should recommend premium models when thriving', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 90 }));
      expect(automaton.recommendedModels()).toEqual(MODEL_TIERS.thriving);
    });

    it('should recommend minimal models when terminal', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 1 }));
      expect(automaton.recommendedModels()).toEqual(MODEL_TIERS.terminal);
    });

    it('should recommend appropriate context window', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 5 }));
      expect(automaton.recommendedContextWindow()).toBe(CONTEXT_WINDOW_TIERS.critical);
    });
  });

  describe('stats', () => {
    it('should track all metrics', () => {
      automaton.evolve(makeEnv({ budgetRemainingPct: 20 }));
      automaton.evolve(makeEnv({ budgetRemainingPct: 20 }));
      const stats = automaton.stats();
      expect(stats.generation).toBe(2);
      expect(stats.state).toBe('alive');
      expect(stats.adaptationCount).toBeGreaterThan(0);
      expect(stats.startedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('destroy', () => {
    it('should clean up', () => {
      const events: any[] = [];
      automaton.on('generation', (e) => events.push(e));
      automaton.destroy();
      automaton.evolve(makeEnv());
      expect(events.length).toBe(0);
    });
  });
});
