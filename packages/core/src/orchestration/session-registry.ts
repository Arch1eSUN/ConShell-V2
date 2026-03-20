import { ChildSession } from './child-session.js';

export class SessionRegistry {
    private sessions: ChildSession[] = [];
    register(session: ChildSession) { this.sessions.push(session); }
    getActiveSessions() { return this.sessions; }
}
