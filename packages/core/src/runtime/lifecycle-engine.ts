import { AgendaArbiter } from './agenda-arbiter';

export class LifeCycleEngine {
    private running = false;
    constructor(private arbiter: AgendaArbiter) {}
    
    start() { this.running = true; }
    stop() { this.running = false; }
    isTracking() { return this.running; }
}
