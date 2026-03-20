/**
 * WakeSemantics — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { WakeSemantics } from './wake-semantics.js';

const noopLogger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {}, child: () => noopLogger } as any;

describe('WakeSemantics', () => {
  // ── Trigger Registration ──────────────────────────────────────────

  it('registers a scheduled trigger', () => {
    const ws = new WakeSemantics(noopLogger);
    const t = ws.registerTrigger({
      kind: 'scheduled',
      description: 'Daily check',
      fireAt: '2026-06-01T00:00:00Z',
    });
    expect(t.kind).toBe('scheduled');
    expect(t.status).toBe('armed');
    expect(ws.armedTriggers()).toHaveLength(1);
  });

  it('cancels a trigger', () => {
    const ws = new WakeSemantics(noopLogger);
    const t = ws.registerTrigger({ kind: 'event', description: 'test', eventName: 'foo' });
    expect(ws.cancelTrigger(t.id)).toBe(true);
    expect(ws.armedTriggers()).toHaveLength(0);
  });

  it('cannot cancel a non-armed trigger', () => {
    const ws = new WakeSemantics(noopLogger);
    const t = ws.registerTrigger({ kind: 'event', description: 'test', eventName: 'foo' });
    ws.cancelTrigger(t.id);
    expect(ws.cancelTrigger(t.id)).toBe(false);
  });

  // ── Scheduled Evaluation ──────────────────────────────────────────

  it('fires scheduled trigger when time is reached', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({
      kind: 'scheduled',
      description: 'Past due',
      fireAt: '2020-01-01T00:00:00Z',
    });
    const fired = ws.evaluateScheduled('2026-01-01T00:00:00Z');
    expect(fired).toHaveLength(1);
  });

  it('does NOT fire future scheduled trigger', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({
      kind: 'scheduled',
      description: 'Future',
      fireAt: '2030-01-01T00:00:00Z',
    });
    const fired = ws.evaluateScheduled('2026-01-01T00:00:00Z');
    expect(fired).toHaveLength(0);
  });

  it('fires interval trigger when elapsed time exceeds intervalMs', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({
      kind: 'interval',
      description: 'Every 100ms',
      intervalMs: 100,
      maxFires: 0, // unlimited
    });
    // 1 second later
    const fired = ws.evaluateScheduled(new Date(Date.now() + 1000).toISOString());
    expect(fired).toHaveLength(1);
  });

  // ── Event Triggers ────────────────────────────────────────────────

  it('fires event trigger by name', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({ kind: 'event', description: 'On update', eventName: 'data-updated' });
    const fired = ws.fireEvent('data-updated');
    expect(fired).toHaveLength(1);
  });

  it('does NOT fire event trigger for wrong event name', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({ kind: 'event', description: 'On update', eventName: 'data-updated' });
    const fired = ws.fireEvent('other-event');
    expect(fired).toHaveLength(0);
  });

  it('fires survival_change trigger on survival: events', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({ kind: 'survival_change', description: 'Survival alert' });
    const fired = ws.fireEvent('survival:critical');
    expect(fired).toHaveLength(1);
  });

  // ── Missions ──────────────────────────────────────────────────────

  it('registers a mission with auto checkpoint trigger', () => {
    const ws = new WakeSemantics(noopLogger);
    const m = ws.registerMission({
      name: 'Long task',
      description: 'Multi-day objective',
      commitmentIds: ['cmt-1', 'cmt-2'],
    });
    expect(m.status).toBe('active');
    expect(ws.activeMissions()).toHaveLength(1);
    // Auto-created checkpoint trigger
    expect(ws.armedTriggers().some(t => t.kind === 'mission_checkpoint')).toBe(true);
  });

  it('completes mission at 100% progress', () => {
    const ws = new WakeSemantics(noopLogger);
    const m = ws.registerMission({
      name: 'Short task',
      description: 'Quick objective',
      commitmentIds: ['cmt-1'],
    });
    ws.updateMissionProgress(m.id, 100);
    expect(ws.getMission(m.id)!.status).toBe('completed');
    expect(ws.activeMissions()).toHaveLength(0);
  });

  // ── Stats ─────────────────────────────────────────────────────────

  it('tracks stats correctly', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({ kind: 'event', description: 'E1', eventName: 'a' });
    ws.registerTrigger({ kind: 'event', description: 'E2', eventName: 'b' });
    ws.cancelTrigger(ws.armedTriggers()[0].id);
    const stats = ws.stats();
    expect(stats.totalTriggers).toBe(2);
    expect(stats.armed).toBe(1);
    expect(stats.cancelled).toBe(1);
  });

  it('tracks fired history', () => {
    const ws = new WakeSemantics(noopLogger);
    ws.registerTrigger({ kind: 'event', description: 'E1', eventName: 'test' });
    ws.fireEvent('test');
    expect(ws.firedHistory()).toHaveLength(1);
  });
});
