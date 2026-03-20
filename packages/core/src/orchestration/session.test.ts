import { describe, it, expect } from 'vitest';
import { SessionRegistry } from './session-registry';
import { ChildSession } from './child-session';

describe('SessionRegistry', () => {
    it('registers and tracks child sessions with budget', () => {
        const registry = new SessionRegistry();
        const session = new ChildSession('data-fetch', { budget: 50 });
        registry.register(session);
        expect(registry.getActiveSessions().length).toBe(1);
        expect(session.getBudget()).toBe(50);
    });
});
