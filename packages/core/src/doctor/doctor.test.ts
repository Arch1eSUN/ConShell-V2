/**
 * Doctor subsystem tests — Round 14.3
 *
 * Tests execution evidence binding (Route B), runtime identity alignment,
 * stale evidence detection, foreign-runtime rejection, and gate criteria.
 */
import { describe, it, expect } from 'vitest';
import { checkExecutionEvidence, type EvidenceAlignmentResult } from './checks/tests.js';
import type {
  CheckResult,
  ExecutionEvidence,
  ExecutionResult,
  RuntimeIdentity,
  ReadinessGate,
  DiagnosticsOptions,
} from './index.js';
import { computeRuntimeIdentity } from './index.js';

// ── Helpers ──────────────────────────────────────────────────────────

function currentRuntime(): RuntimeIdentity {
  return computeRuntimeIdentity();
}

function passingVitest(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  const rt = currentRuntime();
  return {
    command: 'npx vitest run --no-coverage',
    exitCode: 0,
    passed: 518,
    failed: 0,
    total: 518,
    summary: 'All tests passed',
    timestamp: new Date().toISOString(),
    nodeVersion: rt.nodeVersion,
    nodeAbi: rt.nodeAbi,
    platform: rt.platform,
    arch: rt.arch,
    cwd: rt.cwd,
    ...overrides,
  };
}

function failingVitest(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  const rt = currentRuntime();
  return {
    command: 'npx vitest run --no-coverage',
    exitCode: 1,
    passed: 480,
    failed: 38,
    total: 518,
    summary: '38 tests failed',
    timestamp: new Date().toISOString(),
    nodeVersion: rt.nodeVersion,
    nodeAbi: rt.nodeAbi,
    platform: rt.platform,
    arch: rt.arch,
    cwd: rt.cwd,
    ...overrides,
  };
}

function passingTsc(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  const rt = currentRuntime();
  return {
    command: 'npx tsc --noEmit',
    exitCode: 0,
    passed: 0,
    failed: 0,
    total: 0,
    summary: 'No type errors',
    timestamp: new Date().toISOString(),
    nodeVersion: rt.nodeVersion,
    nodeAbi: rt.nodeAbi,
    platform: rt.platform,
    arch: rt.arch,
    cwd: rt.cwd,
    ...overrides,
  };
}

function failingTsc(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  const rt = currentRuntime();
  return {
    command: 'npx tsc --noEmit',
    exitCode: 2,
    passed: 0,
    failed: 5,
    total: 5,
    summary: '5 type errors',
    timestamp: new Date().toISOString(),
    nodeVersion: rt.nodeVersion,
    nodeAbi: rt.nodeAbi,
    platform: rt.platform,
    arch: rt.arch,
    cwd: rt.cwd,
    ...overrides,
  };
}

function foreignRuntime(): RuntimeIdentity {
  return {
    nodeVersion: 'v25.7.0',
    nodeAbi: '141',
    platform: 'darwin',
    arch: 'arm64',
    cwd: '/Users/archiesun/Desktop/ConShellV2/packages/core',
    binaryPath: '/Users/archiesun/.nvm/versions/node/v25.7.0/bin/node',
  };
}

// ── checkExecutionEvidence (basic) ───────────────────────────────────

describe('checkExecutionEvidence', () => {
  it('returns unknown status when no evidence is provided', () => {
    const result = checkExecutionEvidence();
    expect(result.checks).toHaveLength(2);
    expect(result.runtimeAligned).toBe(false);

    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;
    expect(vitest.status).toBe('unknown');
    expect(vitest.confidence).toBe('low');

    const tsc = result.checks.find(r => r.id === 'build-tsc-execution')!;
    expect(tsc.status).toBe('unknown');
  });

  it('returns pass when vitest execution succeeds with aligned runtime', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({ vitest: passingVitest() }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('pass');
    expect(vitest.severity).toBe('info');
    expect(vitest.summary).toContain('518/518');
  });

  it('returns fail with blocker severity when vitest has failures', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({ vitest: failingVitest() }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('fail');
    expect(vitest.severity).toBe('blocker');
    expect(vitest.summary).toContain('FAILED');
  });

  it('returns pass when tsc execution succeeds with aligned runtime', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({ tsc: passingTsc() }, rt);
    const tsc = result.checks.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('pass');
    expect(tsc.severity).toBe('info');
  });

  it('returns fail with blocker when tsc has errors', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({ tsc: failingTsc() }, rt);
    const tsc = result.checks.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('fail');
    expect(tsc.severity).toBe('blocker');
    expect(tsc.summary).toContain('FAILED');
  });

  it('handles both evidence together', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({
      vitest: passingVitest(),
      tsc: passingTsc(),
    }, rt);

    expect(result.checks).toHaveLength(2);
    expect(result.checks.every(r => r.status === 'pass')).toBe(true);
    expect(result.runtimeAligned).toBe(true);
  });
});

// ── Runtime identity alignment ───────────────────────────────────────

describe('Runtime identity alignment (Round 14.3)', () => {
  it('rejects vitest evidence from foreign runtime', () => {
    const rt = currentRuntime();
    const foreignVitest = passingVitest({
      nodeVersion: 'v25.7.0',
      nodeAbi: '141',
    });
    const result = checkExecutionEvidence({ vitest: foreignVitest }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('fail');
    expect(vitest.severity).toBe('blocker');
    expect(vitest.summary).toContain('REJECTED');
    expect(vitest.summary).toContain('foreign runtime');
    expect(result.runtimeAligned).toBe(false);
  });

  it('rejects tsc evidence from foreign runtime', () => {
    const rt = currentRuntime();
    const foreignTscResult = passingTsc({
      nodeVersion: 'v25.7.0',
      nodeAbi: '141',
    });
    const result = checkExecutionEvidence({ tsc: foreignTscResult }, rt);
    const tsc = result.checks.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('fail');
    expect(tsc.severity).toBe('blocker');
    expect(tsc.summary).toContain('REJECTED');
    expect(result.runtimeAligned).toBe(false);
  });

  it('rejects ABI-only mismatch in evidence', () => {
    const rt = currentRuntime();
    const abiMismatch = passingVitest({
      nodeVersion: rt.nodeVersion,  // same version
      nodeAbi: '999',              // different ABI
    });
    const result = checkExecutionEvidence({ vitest: abiMismatch }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('fail');
    expect(vitest.summary).toContain('REJECTED');
    expect(result.runtimeAligned).toBe(false);
    expect(result.runtimeMismatchDetail).toContain('nodeAbi');
  });

  it('accepts evidence without runtime fields (backwards compat)', () => {
    const rt = currentRuntime();
    const noRuntimeFields: ExecutionResult = {
      command: 'npx vitest run',
      exitCode: 0,
      passed: 518,
      failed: 0,
      total: 518,
      summary: 'All passed',
      timestamp: new Date().toISOString(),
      // No nodeVersion/nodeAbi/platform/arch
    };
    const result = checkExecutionEvidence({ vitest: noRuntimeFields }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    // Without runtime fields, no mismatch is detected → pass
    expect(vitest.status).toBe('pass');
  });
});

// ── Stale evidence detection ─────────────────────────────────────────

describe('Stale evidence detection (Round 14.3)', () => {
  it('warns when vitest evidence is >24h old', () => {
    const rt = currentRuntime();
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const staleVitest = passingVitest({ timestamp: staleTimestamp });
    const result = checkExecutionEvidence({ vitest: staleVitest }, rt);
    const vitest = result.checks.find(r => r.id === 'tests-vitest-execution')!;

    expect(vitest.status).toBe('warn');
    expect(vitest.severity).toBe('warning');
    expect(vitest.summary).toContain('STALE');
  });

  it('warns when tsc evidence is >24h old', () => {
    const rt = currentRuntime();
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const staleTsc = passingTsc({ timestamp: staleTimestamp });
    const result = checkExecutionEvidence({ tsc: staleTsc }, rt);
    const tsc = result.checks.find(r => r.id === 'build-tsc-execution')!;

    expect(tsc.status).toBe('warn');
    expect(tsc.severity).toBe('warning');
    expect(tsc.summary).toContain('STALE');
  });

  it('does not warn when evidence is fresh (<24h)', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({
      vitest: passingVitest(),
      tsc: passingTsc(),
    }, rt);

    for (const check of result.checks) {
      expect(check.status).not.toBe('warn');
    }
  });
});

// ── Evidence provenance ──────────────────────────────────────────────

describe('Evidence provenance', () => {
  it('all execution evidence checks use test-execution provenance', () => {
    const rt = currentRuntime();
    const result = checkExecutionEvidence({
      vitest: passingVitest(),
      tsc: passingTsc(),
    }, rt);
    for (const check of result.checks) {
      expect(check.evidenceType).toBe('test-execution');
    }
  });

  it('absent evidence checks still use test-execution provenance', () => {
    const result = checkExecutionEvidence();
    for (const check of result.checks) {
      expect(check.evidenceType).toBe('test-execution');
    }
  });
});

// ── computeRuntimeIdentity ───────────────────────────────────────────

describe('computeRuntimeIdentity', () => {
  it('returns current runtime snapshot', () => {
    const rt = computeRuntimeIdentity();
    expect(rt.nodeVersion).toBe(process.version);
    expect(rt.nodeAbi).toBe(process.versions.modules);
    expect(rt.platform).toBe(process.platform);
    expect(rt.arch).toBe(process.arch);
    expect(typeof rt.cwd).toBe('string');
    expect(typeof rt.binaryPath).toBe('string');
  });
});
