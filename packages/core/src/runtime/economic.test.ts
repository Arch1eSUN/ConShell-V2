import { describe, it, expect } from 'vitest';
import { EconomicEngine } from './economic-engine';

describe('EconomicEngine', () => {
    it('evaluates task ROI and updates survival pressure', () => {
        const engine = new EconomicEngine(100); // 100 base reserve
        
        // High ROI -> positive return
        const assessment = engine.evaluateTaskROI({ reward: 50, cost: 10 });
        expect(assessment.viable).toBe(true);
        expect(assessment.roi).toBe(4); // (50-10)/10
        
        // Low ROI -> not viable
        const badAssessment = engine.evaluateTaskROI({ reward: 10, cost: 20 });
        expect(badAssessment.viable).toBe(false);
    });

    it('blocks low priority work under severe survival pressure', () => {
        const engine = new EconomicEngine(5); // critical low reserve
        expect(engine.isCriticalPressure()).toBe(true);
        
        const assessment = engine.evaluateTaskROI({ reward: 12, cost: 10 });
        // Under critical pressure, small margins might be rejected or deferred
        expect(assessment.viable).toBe(false);
    });
});
