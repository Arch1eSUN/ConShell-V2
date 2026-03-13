/**
 * Doctor subsystem tests — Round 14.2
 *
 * Tests the execution evidence binding (Route B), insufficient-evidence
 * verdict, and gate criteria integrity.
 */
import { describe, it, expect } from 'vitest';
import { checkExecutionEvidence } from './checks/tests.js';
import type {
  CheckResult,
  ExecutionEvidence,
  ExecutionResult,
  ReadinessGate,
  DiagnosticsOptions,
} from './index.js';

// ── Helper: build a minimal passing execution result ──────────────────

function passingVitest(): ExecutionResult {
  return {
    command: 'cd packages/core && npx vitest run --no-coverage',
    exitCode: 0,
    passed: 522,
    failed: 0,
    total: 522,
    summary: 'All tests passed',
    timestamp: new Date().toISOString(),
  };
}

function failingVitest(): ExecutionResult {
  return {
    command: 'cd packages/core && npx vitest run --no-coverage',
    exitCode: 1,
    passed: 480,
    failed: 42,
    total: 522,
    summary: '42 tests failed',
    timestamp: new Date().toISOString(),
  };
}

function passingTsc(): ExecutionResult {
  return {
    command: 'cd packages/core && npx tsc --noEmit',
    exitCode: 0,
    passed: 0,
    failed: 0,
    total: 0,
    summary: 'No type errors',
    timestamp: new Date().toISOString(),
  };
}

function failingTsc(): ExecutionResult {
  return {
    command: 'cd packages/core && npx tsc --noEmit',
    exitCode: 2,
    passed: 0,
    failed: 5,
    total: 5,
    summary: '5 type errors',
    timestamp: new Date().toISOString(),
  };
}

// ── checkExecutionEvidence ────────────────────────────────────────────

describe('checkExecutionEvidence', () => {
  it('returns unknown status when no evidence is provided', () => {
    const results = checkExecutionEvidence();
    expect(results).toHaveLength(2);

    const vitest = results.find(r => r.id === 'tests-vitest-execution')!;
    expect(vitest.status).toBe('unknown');
    expect(vitest.evidenceType).toBe('test-execution');
    expect(vitest.confidence).toBe('low');

    const tsc = results.find(r => r.id === 'build-tsc-execution')!;
    expect(tsc.status).toBe('unknown');
    expect(tsc.evidenceType).toBe('test-execution');
    expect(tsc.confidence).toBe('low');
  });

  it('returns pass when vitest execution succeeds', () => {
    const results = checkExecutionEvidence({ vitest: passingVitest() });
    const vitest = results.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('pass');
    expect(vitest.severity).toBe('info');
    expect(vitest.confidence).toBe('high');
    expect(vitest.evidenceType).toBe('test-execution');
    expect(vitest.summary).toContain('522/522');
  });

  it('returns fail with blocker severity when vitest has failures', () => {
    const results = checkExecutionEvidence({ vitest: failingVitest() });
    const vitest = results.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('fail');
    expect(vitest.severity).toBe('blocker');
    expect(vitest.summary).toContain('42/522');
    expect(vitest.summary).toContain('FAILED');
  });

  it('returns pass when tsc execution succeeds', () => {
    const results = checkExecutionEvidence({ tsc: passingTsc() });
    const tsc = results.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('pass');
    expect(tsc.severity).toBe('info');
    expect(tsc.category).toBe('build');
    expect(tsc.evidenceType).toBe('test-execution');
  });

  it('returns fail with blocker severity when tsc has errors', () => {
    const results = checkExecutionEvidence({ tsc: failingTsc() });
    const tsc = results.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('fail');
    expect(tsc.severity).toBe('blocker');
    expect(tsc.summary).toContain('FAILED');
    expect(tsc.summary).toContain('5 errors');
  });

  it('handles both vitest and tsc evidence together', () => {
    const results = checkExecutionEvidence({
      vitest: passingVitest(),
      tsc: passingTsc(),
    });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'pass')).toBe(true);
    expect(results.every(r => r.evidenceType === 'test-execution')).toBe(true);
  });
});

// ── Evidence type coverage ────────────────────────────────────────────

describe('Evidence type taxonomy', () => {
  it('execution evidence checks use test-execution provenance', () => {
    const withEvidence = checkExecutionEvidence({
      vitest: passingVitest(),
      tsc: passingTsc(),
    });
    for (const check of withEvidence) {
      expect(check.evidenceType).toBe('test-execution');
    }
  });

  it('absent evidence checks still use test-execution provenance (not code-inspection)', () => {
    const noEvidence = checkExecutionEvidence();
    for (const check of noEvidence) {
      expect(check.evidenceType).toBe('test-execution');
      // Must NOT be 'code-inspection' — even absent evidence is about execution
    }
  });
});

// ── Gate verdict scenarios ────────────────────────────────────────────

describe('ReadinessGate verdict expectations', () => {
  // These test the contract that the gate logic in index.ts should uphold.
  // Since we can't easily unit-test computeReadinessGate in isolation
  // (it's private), we test the observable contract through check results.

  it('no execution evidence should produce unknown-status checks', () => {
    const results = checkExecutionEvidence();
    const vitestExec = results.find(r => r.id === 'tests-vitest-execution')!;
    const tscExec = results.find(r => r.id === 'build-tsc-execution')!;

    // Gate criterion 6 checks: vitestExec.status !== 'unknown'
    // When unknown, gate criterion fails → verdict = insufficient-evidence
    expect(vitestExec.status).toBe('unknown');
    expect(tscExec.status).toBe('unknown');
  });

  it('failing execution evidence should produce blocker checks', () => {
    const results = checkExecutionEvidence({
      vitest: failingVitest(),
      tsc: failingTsc(),
    });
    const vitestExec = results.find(r => r.id === 'tests-vitest-execution')!;
    const tscExec = results.find(r => r.id === 'build-tsc-execution')!;

    // Gate criterion 6/7: status !== 'pass' → criterion fails → verdict = not-ready
    expect(vitestExec.status).toBe('fail');
    expect(vitestExec.severity).toBe('blocker');
    expect(tscExec.status).toBe('fail');
    expect(tscExec.severity).toBe('blocker');
  });

  it('static inventory cannot substitute for execution truth', () => {
    // Having test files on disk (inventory) is NOT the same as having passed execution
    const noExec = checkExecutionEvidence();
    const vitestExec = noExec.find(r => r.id === 'tests-vitest-execution')!;

    // Even if 35 test files exist on disk, without execution evidence
    // the gate must NOT say 'ready'
    expect(vitestExec.status).not.toBe('pass');
  });
});
