import { describe, it, expect } from 'vitest';
import { LifeCycleEngine } from './lifecycle-engine';
import { AgendaArbiter } from './agenda-arbiter';

describe('LifeCycleEngine & AgendaArbiter', () => {
    it('should initialize and process a tick', () => {
        const arbiter = new AgendaArbiter();
        const engine = new LifeCycleEngine(arbiter);
        expect(engine.isTracking()).toBe(false);
        engine.start();
        expect(engine.isTracking()).toBe(true);
        engine.stop();
    });
});
