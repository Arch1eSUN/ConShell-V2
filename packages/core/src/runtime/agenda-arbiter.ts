import { SurvivalGate } from '../economic/survival-coupling.js';
import { EconomicState } from '../economic/economic-state.js';

export interface AgendaTask {
    id: string;
    estimatedCostCents: number;
    estimatedRevenueCents: number;
    revenueBearing: boolean;
    mustPreserve: boolean;
}

export interface AgendaEvaluation {
    priority: 'high' | 'normal' | 'deferred' | 'blocked';
    reason?: string;
}

export class AgendaArbiter {
    constructor(private survivalGate?: SurvivalGate) {}

    evaluateTask(task: AgendaTask, state?: EconomicState): AgendaEvaluation {
        if (this.survivalGate && state) {
            const decision = this.survivalGate.canAcceptTaskDetailed(
                state, 
                task.revenueBearing, 
                task.mustPreserve
            );
            if (!decision.allowed) {
                return { priority: 'blocked', reason: decision.message };
            }
        }
        
        // ROI calculation
        const roi = task.estimatedRevenueCents - task.estimatedCostCents;
        let priority: AgendaEvaluation['priority'] = 'deferred';
        
        if (roi > 100) {
            priority = 'high';
        } else if (roi > 0) {
            priority = 'normal';
        }
        
        return { priority };
    }
}
