/**
 * Round 20.1 — Session & Orchestration Tests
 *
 * Tests for ChildSession, ToolInvocation, and SessionRegistry.
 */
import { describe, it, expect } from 'vitest';
import { ChildSession, createChildSession } from './child-session.js';
import { ToolInvocation, createToolInvocation } from './tool-invocation.js';
import { SessionRegistry } from './session-registry.js';

// ── ChildSession ────────────────────────────────────────────────────

describe('ChildSession', () => {
  it('creates with pending status and correct budget', () => {
    const s = createChildSession({
      name: 'worker-1',
      manifest: { role: 'worker', task: 'index docs' },
      budgetCents: 500,
    });
    expect(s.status).toBe('pending');
    expect(s.budgetCents).toBe(500);
    expect(s.budgetUsedCents).toBe(0);
    expect(s.budgetRemaining).toBe(500);
    expect(s.id).toMatch(/^csn_/);
  });

  it('transitions through lifecycle: pending → running → completed', () => {
    const s = createChildSession({
      name: 'worker-2',
      manifest: { role: 'worker', task: 'process batch' },
      budgetCents: 200,
    });

    s.start();
    expect(s.status).toBe('running');
    expect(s.startedAt).toBeDefined();

    s.complete('Processed 100 items');
    expect(s.status).toBe('completed');
    expect(s.completedAt).toBeDefined();
    expect(s.resultSummary).toBe('Processed 100 items');
  });

  it('tracks budget spend', () => {
    const s = createChildSession({
      name: 'spender',
      manifest: { role: 'specialist', task: 'analyze' },
      budgetCents: 1000,
    });

    s.start();
    s.trackSpend(300);
    expect(s.budgetUsedCents).toBe(300);
    expect(s.budgetRemaining).toBe(700);

    s.trackSpend(200);
    expect(s.budgetUsedCents).toBe(500);
  });

  it('can be failed', () => {
    const s = createChildSession({
      name: 'failer',
      manifest: { role: 'worker', task: 'risky-op' },
      budgetCents: 100,
    });

    s.start();
    s.fail('Out of memory');
    expect(s.status).toBe('failed');
    expect(s.errorDetails).toBe('Out of memory');
  });

  it('can be recalled', () => {
    const s = createChildSession({
      name: 'recallable',
      manifest: { role: 'delegate', task: 'external call' },
      budgetCents: 100,
    });

    s.start();
    s.recall();
    expect(s.status).toBe('recalled');
    expect(s.completedAt).toBeDefined();
  });

  it('prevents invalid transitions', () => {
    const s = createChildSession({
      name: 'invalid',
      manifest: { role: 'worker', task: 'test' },
      budgetCents: 50,
    });

    expect(() => s.complete('early')).toThrow();
    s.start();
    s.complete('done');
    expect(() => s.start()).toThrow();
  });

  it('serializes to JSON correctly', () => {
    const s = createChildSession({
      name: 'serial',
      manifest: { role: 'explorer', task: 'discover' },
      budgetCents: 300,
      parentSessionId: 'parent-123',
    });

    const json = s.toJSON();
    expect(json.name).toBe('serial');
    expect(json.parentSessionId).toBe('parent-123');
    expect(json.status).toBe('pending');
  });
});

// ── ToolInvocation ──────────────────────────────────────────────────

describe('ToolInvocation', () => {
  it('creates with pending status and audit trace', () => {
    const inv = createToolInvocation({
      toolName: 'file_read',
      toolManifest: { name: 'file_read', description: 'Read a file' },
      origin: 'session',
      riskLevel: 'low',
    });

    expect(inv.status).toBe('pending');
    expect(inv.id).toMatch(/^tinv_/);
    expect(inv.auditTrace.startedAt).toBeDefined();
  });

  it('transitions through lifecycle: pending → running → completed', () => {
    const inv = createToolInvocation({
      toolName: 'web_fetch',
      toolManifest: { name: 'web_fetch', description: 'Fetch URL' },
      origin: 'system',
      riskLevel: 'medium',
    });

    inv.start();
    expect(inv.status).toBe('running');

    inv.complete({ output: 'data fetched' });
    expect(inv.status).toBe('completed');
    expect(inv.resultEnvelope?.success).toBe(true);
    expect(inv.resultEnvelope?.output).toBe('data fetched');
    expect(inv.auditTrace.completedAt).toBeDefined();
    expect(inv.auditTrace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('can fail with error details', () => {
    const inv = createToolInvocation({
      toolName: 'dangerous_exec',
      toolManifest: { name: 'dangerous_exec', description: 'Execute command' },
      origin: 'governance',
      riskLevel: 'critical',
    });

    inv.start();
    inv.fail('Permission denied');
    expect(inv.status).toBe('failed');
    expect(inv.resultEnvelope?.success).toBe(false);
    expect(inv.resultEnvelope?.error).toBe('Permission denied');
  });

  it('supports parentSessionId linking', () => {
    const inv = createToolInvocation({
      toolName: 'shell_exec',
      toolManifest: { name: 'shell_exec', description: 'Run shell command' },
      origin: 'session',
      riskLevel: 'high',
      parentSessionId: 'csn_abc',
    });

    expect(inv.parentSessionId).toBe('csn_abc');
    expect(inv.origin).toBe('session');
  });

  it('prevents invalid transitions', () => {
    const inv = createToolInvocation({
      toolName: 'test_tool',
      toolManifest: { name: 'test', description: 'test' },
      origin: 'operator',
      riskLevel: 'low',
    });

    expect(() => inv.complete()).toThrow();
    inv.start();
    inv.complete();
    expect(() => inv.fail('late')).toThrow();
  });
});

// ── SessionRegistry ─────────────────────────────────────────────────

describe('SessionRegistry', () => {
  it('registers and retrieves sessions', () => {
    const registry = new SessionRegistry();
    const s = createChildSession({
      name: 'reg-test',
      manifest: { role: 'worker', task: 'test' },
      budgetCents: 100,
    });

    registry.registerSession(s);
    expect(registry.getSession(s.id)).toBe(s);
    expect(registry.listSessions().length).toBe(1);
  });

  it('registers and retrieves invocations', () => {
    const registry = new SessionRegistry();
    const inv = createToolInvocation({
      toolName: 'probe',
      toolManifest: { name: 'probe', description: 'Probe system' },
      origin: 'system',
      riskLevel: 'low',
    });

    registry.registerInvocation(inv);
    expect(registry.getInvocation(inv.id)).toBe(inv);
    expect(registry.listInvocations().length).toBe(1);
  });

  it('filters sessions by status', () => {
    const registry = new SessionRegistry();
    const s1 = createChildSession({ name: 'a', manifest: { role: 'w', task: 't' }, budgetCents: 10 });
    const s2 = createChildSession({ name: 'b', manifest: { role: 'w', task: 't' }, budgetCents: 20 });

    s1.start();
    registry.registerSession(s1);
    registry.registerSession(s2);

    expect(registry.listSessions({ status: 'running' }).length).toBe(1);
    expect(registry.listSessions({ status: 'pending' }).length).toBe(1);
  });

  it('filters invocations by origin', () => {
    const registry = new SessionRegistry();
    const i1 = createToolInvocation({
      toolName: 'a', toolManifest: { name: 'a', description: 'a' },
      origin: 'session', riskLevel: 'low',
    });
    const i2 = createToolInvocation({
      toolName: 'b', toolManifest: { name: 'b', description: 'b' },
      origin: 'governance', riskLevel: 'high',
    });

    registry.registerInvocation(i1);
    registry.registerInvocation(i2);

    expect(registry.listInvocations({ origin: 'governance' }).length).toBe(1);
    expect(registry.listInvocations({ origin: 'session' }).length).toBe(1);
  });

  it('returns session invocations', () => {
    const registry = new SessionRegistry();
    const session = createChildSession({ name: 'parent', manifest: { role: 'w', task: 't' }, budgetCents: 100 });
    registry.registerSession(session);

    const inv = createToolInvocation({
      toolName: 'child_tool',
      toolManifest: { name: 'child_tool', description: 'A tool' },
      origin: 'session',
      riskLevel: 'low',
      parentSessionId: session.id,
    });
    registry.registerInvocation(inv);

    const sessionInvs = registry.getSessionInvocations(session.id);
    expect(sessionInvs.length).toBe(1);
    expect(sessionInvs[0].toolName).toBe('child_tool');
  });

  it('computes active work count', () => {
    const registry = new SessionRegistry();
    const s = createChildSession({ name: 'a', manifest: { role: 'w', task: 't' }, budgetCents: 10 });
    s.start();
    registry.registerSession(s);

    const inv = createToolInvocation({
      toolName: 'x', toolManifest: { name: 'x', description: 'x' },
      origin: 'system', riskLevel: 'low',
    });
    inv.start();
    registry.registerInvocation(inv);

    expect(registry.activeWorkCount()).toBe(2);
  });

  it('produces correct diagnostics', () => {
    const registry = new SessionRegistry();

    const s1 = createChildSession({ name: 'a', manifest: { role: 'w', task: 't' }, budgetCents: 500 });
    s1.start();
    s1.trackSpend(200);
    registry.registerSession(s1);

    const s2 = createChildSession({ name: 'b', manifest: { role: 'w', task: 't' }, budgetCents: 300 });
    registry.registerSession(s2);

    const inv = createToolInvocation({
      toolName: 'y', toolManifest: { name: 'y', description: 'y' },
      origin: 'governance', riskLevel: 'critical',
    });
    registry.registerInvocation(inv);

    const diag = registry.diagnostics();
    expect(diag.totalSessions).toBe(2);
    expect(diag.totalInvocations).toBe(1);
    expect(diag.activeBudgetCents).toBe(800);
    expect(diag.usedBudgetCents).toBe(200);
    expect(diag.sessionsByStatus['running']).toBe(1);
    expect(diag.sessionsByStatus['pending']).toBe(1);
    expect(diag.invocationsByOrigin['governance']).toBe(1);
  });

  it('removes sessions and invocations', () => {
    const registry = new SessionRegistry();
    const s = createChildSession({ name: 'rm', manifest: { role: 'w', task: 't' }, budgetCents: 10 });
    registry.registerSession(s);
    expect(registry.removeSession(s.id)).toBe(true);
    expect(registry.getSession(s.id)).toBeUndefined();

    const inv = createToolInvocation({
      toolName: 'rm', toolManifest: { name: 'rm', description: 'rm' },
      origin: 'system', riskLevel: 'low',
    });
    registry.registerInvocation(inv);
    expect(registry.removeInvocation(inv.id)).toBe(true);
    expect(registry.getInvocation(inv.id)).toBeUndefined();
  });
});
