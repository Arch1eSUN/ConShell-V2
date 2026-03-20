/**
 * SessionFabric — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { SessionFabric } from './session-fabric.js';

const noopLogger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {}, child: () => noopLogger } as any;

describe('SessionFabric', () => {
  // ── Creation ──────────────────────────────────────────────────────

  it('creates a session', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Chat', channelKind: 'webchat' });
    expect(s.status).toBe('active');
    expect(sf.activeSessions()).toHaveLength(1);
  });

  it('rejects session creation when fabric is paused', () => {
    const sf = new SessionFabric(noopLogger);
    sf.pauseAll();
    expect(() => sf.createSession({ name: 'X', channelKind: 'api' }))
      .toThrow('paused');
  });

  // ── Lifecycle ─────────────────────────────────────────────────────

  it('pauses and resumes a session', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Chat', channelKind: 'webchat' });
    sf.pauseSession(s.id);
    expect(sf.getSession(s.id)!.status).toBe('paused');
    sf.resumeSession(s.id);
    expect(sf.getSession(s.id)!.status).toBe('active');
  });

  it('drains a session', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Chat', channelKind: 'webchat' });
    sf.drainSession(s.id);
    expect(sf.getSession(s.id)!.status).toBe('draining');
  });

  it('terminates a session with reason', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Chat', channelKind: 'webchat' });
    sf.terminateSession(s.id, 'done');
    expect(sf.getSession(s.id)!.status).toBe('terminated');
    expect(sf.getSession(s.id)!.terminatedReason).toBe('done');
  });

  it('returns failure receipt for non-existent session', () => {
    const sf = new SessionFabric(noopLogger);
    const r = sf.pauseSession('no-such');
    expect(r.success).toBe(false);
    expect(r.reason).toContain('not found');
  });

  // ── Worker Management ─────────────────────────────────────────────

  it('acquires and releases workers', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Workers', channelKind: 'api', maxWorkers: 2 });
    expect(sf.acquireWorker(s.id)).toBe(true);
    expect(sf.acquireWorker(s.id)).toBe(true);
    expect(sf.acquireWorker(s.id)).toBe(false); // at max
    sf.releaseWorker(s.id);
    expect(sf.getSession(s.id)!.activeWorkers).toBe(1);
  });

  it('auto-terminates draining session when workers finish', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Drain', channelKind: 'api' });
    sf.acquireWorker(s.id);
    sf.drainSession(s.id);
    sf.releaseWorker(s.id);
    expect(sf.getSession(s.id)!.status).toBe('terminated');
  });

  it('refuses worker acquisition for paused sessions', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'Paused', channelKind: 'api' });
    sf.pauseSession(s.id);
    expect(sf.acquireWorker(s.id)).toBe(false);
  });

  // ── Bulk Control ──────────────────────────────────────────────────

  it('pause_all pauses all active sessions', () => {
    const sf = new SessionFabric(noopLogger);
    sf.createSession({ name: 'A', channelKind: 'webchat' });
    sf.createSession({ name: 'B', channelKind: 'api' });
    const r = sf.pauseAll();
    expect(r.affectedCount).toBe(2);
    expect(sf.activeSessions()).toHaveLength(0);
    expect(sf.isPaused()).toBe(true);
  });

  it('resume_all resumes paused sessions', () => {
    const sf = new SessionFabric(noopLogger);
    sf.createSession({ name: 'A', channelKind: 'webchat' });
    sf.createSession({ name: 'B', channelKind: 'api' });
    sf.pauseAll();
    sf.resumeAll();
    expect(sf.activeSessions()).toHaveLength(2);
  });

  // ── Stats ─────────────────────────────────────────────────────────

  it('reports correct stats', () => {
    const sf = new SessionFabric(noopLogger);
    sf.createSession({ name: 'A', channelKind: 'webchat' });
    const s2 = sf.createSession({ name: 'B', channelKind: 'api' });
    sf.terminateSession(s2.id);
    const stats = sf.stats();
    expect(stats.active).toBe(1);
    expect(stats.terminated).toBe(1);
    expect(stats.total).toBe(2);
  });

  it('tracks control history', () => {
    const sf = new SessionFabric(noopLogger);
    const s = sf.createSession({ name: 'A', channelKind: 'webchat' });
    sf.pauseSession(s.id);
    sf.resumeSession(s.id);
    expect(sf.controlHistory()).toHaveLength(2);
  });
});
