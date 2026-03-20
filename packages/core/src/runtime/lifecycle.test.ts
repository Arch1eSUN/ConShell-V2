import { describe, it, expect } from 'vitest';
import { LifeCycleEngine } from './lifecycle-engine';
import { AgendaArbiter, AgendaTask } from './agenda-arbiter';
import { SurvivalGate } from '../economic/survival-coupling';
import { buildEconomicState } from '../economic/economic-state';

describe('LifeCycleEngine & AgendaArbiter', () => {
    it('should initialize and process a tick', () => {
        const arbiter = new AgendaArbiter();
        const engine = new LifeCycleEngine(arbiter);
        expect(engine.isTracking()).toBe(false);
        engine.start();
        expect(engine.isTracking()).toBe(true);
        engine.stop();
    });

    describe('AgendaArbiter - Economic Task Admission', () => {
        const gate = new SurvivalGate();
        const arbiter = new AgendaArbiter(gate);

        it('defers tasks with negative or low ROI when not in survival pressure', () => {
            const state = buildEconomicState({
                balanceCents: 5000,
                totalSpendCents: 1000,
                totalIncomeCents: 6000,
                burnRateCentsPerDay: 100,
                dailyIncomeCents: 150,
                survivalTier: 'thriving',
            });
            const task: AgendaTask = {
                id: 't1',
                estimatedCostCents: 10,
                estimatedRevenueCents: 0,
                revenueBearing: false,
                mustPreserve: false,
            };
            const result = arbiter.evaluateTask(task, state);
            expect(result.priority).toBe('deferred');
        });

        it('prioritizes high ROI tasks', () => {
            const state = buildEconomicState({
                balanceCents: 5000,
                totalSpendCents: 1000,
                totalIncomeCents: 6000,
                burnRateCentsPerDay: 100,
                dailyIncomeCents: 150,
                survivalTier: 'thriving',
            });
            const task: AgendaTask = {
                id: 't2',
                estimatedCostCents: 10,
                estimatedRevenueCents: 200,
                revenueBearing: true,
                mustPreserve: false,
            };
            const result = arbiter.evaluateTask(task, state);
            expect(result.priority).toBe('high');
        });

        it('blocks non-revenue tasks when in terminal tier', () => {
            const state = buildEconomicState({
                balanceCents: 100,
                totalSpendCents: 1000,
                totalIncomeCents: 100,
                burnRateCentsPerDay: 500,
                dailyIncomeCents: 0,
                survivalTier: 'terminal',
            });
            const task: AgendaTask = {
                id: 't3',
                estimatedCostCents: 10,
                estimatedRevenueCents: 0,
                revenueBearing: false,
                mustPreserve: false,
            };
            const result = arbiter.evaluateTask(task, state);
            expect(result.priority).toBe('blocked');
            expect(result.reason).toContain('Terminal');
        });

        it('allows revenue-bearing tasks even in terminal tier', () => {
             const state = buildEconomicState({
                balanceCents: 100,
                totalSpendCents: 1000,
                totalIncomeCents: 100,
                burnRateCentsPerDay: 500,
                dailyIncomeCents: 0,
                survivalTier: 'terminal',
            });
            const task: AgendaTask = {
                id: 't4',
                estimatedCostCents: 10,
                estimatedRevenueCents: 500,
                revenueBearing: true,
                mustPreserve: false,
            };
            const result = arbiter.evaluateTask(task, state);
            expect(result.priority).toBe('high'); // High ROI -> high
        });
    });
});
