import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionAuditTrail } from './execution-audit.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeLogger() {
  const noop = () => {};
  return {
    debug: noop, info: noop, warn: noop, error: noop,
    child: () => makeLogger(),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('ExecutionAuditTrail', () => {
  let audit: ExecutionAuditTrail;

  beforeEach(() => {
    audit = new ExecutionAuditTrail(makeLogger());
  });

  // ── Recording ──

  it('records an execution and returns the entry', () => {
    const entry = audit.record('cmt-1', 'completed', 150);
    expect(entry.commitmentId).toBe('cmt-1');
    expect(entry.outcome).toBe('completed');
    expect(entry.durationMs).toBe(150);
    expect(entry.timestamp).toBeDefined();
  });

  it('records with optional reason', () => {
    const entry = audit.record('cmt-1', 'vetoed', 0, 'stale-snapshot');
    expect(entry.reason).toBe('stale-snapshot');
  });

  // ── History ──

  it('getHistory returns records for a specific commitment', () => {
    audit.record('cmt-1', 'completed', 100);
    audit.record('cmt-2', 'failed', 200, 'timeout');
    audit.record('cmt-1', 'vetoed', 0, 're-run attempt');

    const history = audit.getHistory('cmt-1');
    expect(history).toHaveLength(2);
    expect(history[0].outcome).toBe('completed');
    expect(history[1].outcome).toBe('vetoed');
  });

  it('getHistory returns empty for unknown commitment', () => {
    expect(audit.getHistory('cmt-unknown')).toHaveLength(0);
  });

  // ── getAll ──

  it('getAll returns all records newest first', () => {
    audit.record('cmt-1', 'completed', 100);
    audit.record('cmt-2', 'failed', 200);
    audit.record('cmt-3', 'vetoed', 0);

    const all = audit.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].commitmentId).toBe('cmt-3'); // newest
    expect(all[2].commitmentId).toBe('cmt-1'); // oldest
  });

  it('getAll respects limit', () => {
    audit.record('cmt-1', 'completed', 100);
    audit.record('cmt-2', 'failed', 200);
    audit.record('cmt-3', 'vetoed', 0);

    const limited = audit.getAll(2);
    expect(limited).toHaveLength(2);
  });

  // ── Stats ──

  it('stats aggregates all outcomes', () => {
    audit.record('cmt-1', 'completed', 100);
    audit.record('cmt-2', 'failed', 200);
    audit.record('cmt-3', 'vetoed', 0);
    audit.record('cmt-4', 'deduplicated', 0);
    audit.record('cmt-5', 'guard-denied', 0);
    audit.record('cmt-6', 'completed', 50);

    const s = audit.stats();
    expect(s.totalRecords).toBe(6);
    expect(s.completed).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.vetoed).toBe(1);
    expect(s.deduplicated).toBe(1);
    expect(s.guardDenied).toBe(1);
  });

  // ── Clear ──

  it('clear removes all records', () => {
    audit.record('cmt-1', 'completed', 100);
    audit.record('cmt-2', 'failed', 200);
    audit.clear();

    expect(audit.getAll()).toHaveLength(0);
    expect(audit.getHistory('cmt-1')).toHaveLength(0);
    expect(audit.stats().totalRecords).toBe(0);
  });
});
