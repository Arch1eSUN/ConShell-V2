import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionGuard } from './execution-guard.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeLogger() {
  const noop = () => {};
  return {
    debug: noop, info: noop, warn: noop, error: noop,
    child: () => makeLogger(),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('ExecutionGuard', () => {
  let guard: ExecutionGuard;

  beforeEach(() => {
    guard = new ExecutionGuard(makeLogger());
  });

  // ── Basic acquire/release ──

  it('allows first acquire for a new commitmentId', () => {
    const result = guard.tryAcquire('cmt-1');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('denies concurrent acquire for the same commitmentId', () => {
    guard.tryAcquire('cmt-1');
    const result = guard.tryAcquire('cmt-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('concurrent-execution-blocked');
  });

  it('allows acquire after non-terminal release', () => {
    guard.tryAcquire('cmt-1');
    guard.release('cmt-1', false);
    const result = guard.tryAcquire('cmt-1');
    expect(result.allowed).toBe(true);
  });

  // ── Terminal blacklist ──

  it('denies acquire after terminal release', () => {
    guard.tryAcquire('cmt-1');
    guard.release('cmt-1', true);
    const result = guard.tryAcquire('cmt-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('re-entry-suppressed');
  });

  it('terminal blacklist persists across multiple acquire attempts', () => {
    guard.tryAcquire('cmt-1');
    guard.release('cmt-1', true);
    
    const r1 = guard.tryAcquire('cmt-1');
    const r2 = guard.tryAcquire('cmt-1');
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(false);
  });

  // ── Isolation between commitments ──

  it('different commitmentIds are independent', () => {
    guard.tryAcquire('cmt-1');
    const result = guard.tryAcquire('cmt-2');
    expect(result.allowed).toBe(true);
  });

  it('terminal blacklist for one does not affect another', () => {
    guard.tryAcquire('cmt-1');
    guard.release('cmt-1', true);
    const result = guard.tryAcquire('cmt-2');
    expect(result.allowed).toBe(true);
  });

  // ── Query methods ──

  it('isActive reports active locks correctly', () => {
    expect(guard.isActive('cmt-1')).toBe(false);
    guard.tryAcquire('cmt-1');
    expect(guard.isActive('cmt-1')).toBe(true);
    guard.release('cmt-1', false);
    expect(guard.isActive('cmt-1')).toBe(false);
  });

  it('isTerminal reports blacklist correctly', () => {
    expect(guard.isTerminal('cmt-1')).toBe(false);
    guard.tryAcquire('cmt-1');
    expect(guard.isTerminal('cmt-1')).toBe(false);
    guard.release('cmt-1', true);
    expect(guard.isTerminal('cmt-1')).toBe(true);
  });

  // ── Stats ──

  it('tracks statistics correctly', () => {
    guard.tryAcquire('cmt-1');
    guard.tryAcquire('cmt-1'); // denied
    guard.release('cmt-1', true);
    guard.tryAcquire('cmt-1'); // denied (blacklisted)

    const s = guard.stats();
    expect(s.acquireAttempts).toBe(3);
    expect(s.deniedCount).toBe(2);
    expect(s.activeCount).toBe(0);
    expect(s.terminalCount).toBe(1);
  });

  // ── Clear ──

  it('clear resets all state', () => {
    guard.tryAcquire('cmt-1');
    guard.release('cmt-1', true);
    guard.clear();

    expect(guard.isActive('cmt-1')).toBe(false);
    expect(guard.isTerminal('cmt-1')).toBe(false);
    expect(guard.stats().acquireAttempts).toBe(0);
  });
});
