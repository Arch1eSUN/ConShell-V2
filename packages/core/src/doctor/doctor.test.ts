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
  VerificationContext,
  VerificationMode,
} from './index.js';
import { computeRuntimeIdentity, runDiagnostics, formatReport } from './index.js';

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

// ── VerificationContext (Round 14.6) ────────────────────────────────

describe('VerificationContext in IntegrityReport (Round 14.6)', () => {
  // Test file: packages/core/src/doctor/doctor.test.ts → 4 levels up for monorepo root
  const projectRoot = new URL('../../../..', import.meta.url).pathname.replace(/\/$/, '');
  const coreRoot = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

  it('runDiagnostics report contains verificationContext with runtime identity', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const vc = report.verificationContext;

    expect(vc).toBeDefined();
    expect(vc.currentRuntime).toBeDefined();
    expect(vc.currentRuntime.nodeVersion).toBe(process.version);
    expect(vc.currentRuntime.nodeAbi).toBe(process.versions.modules);
    expect(vc.currentRuntime.platform).toBe(process.platform);
    expect(vc.currentRuntime.arch).toBe(process.arch);
  });

  it('verificationContext reflects pinned runtime from .nvmrc', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const vc = report.verificationContext;

    // .nvmrc exists in the project — pinnedRuntime should be populated
    expect(vc.pinnedRuntime).not.toBeNull();
    expect(vc.pinnedRuntime!.source).toBe('.nvmrc');
    expect(vc.pinnedRuntime!.version).toMatch(/^v\d+/);
  });

  it('alignment status is "aligned" when current matches pinned', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const vc = report.verificationContext;

    // Current shell should match .nvmrc
    if (vc.pinnedRuntime && vc.pinnedRuntime.version === process.version) {
      expect(vc.alignmentStatus).toBe('aligned');
    }
  });

  it('summary is a non-empty human-readable string', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const vc = report.verificationContext;

    expect(typeof vc.summary).toBe('string');
    expect(vc.summary.length).toBeGreaterThan(0);
    expect(vc.summary).toContain('Runtime:');
    expect(vc.summary).toContain('Pinned:');
    expect(vc.summary).toContain('Alignment:');
  });
});

describe('formatReport includes VERIFICATION CONTEXT (Round 14.6)', () => {
  const projectRoot = new URL('../../../..', import.meta.url).pathname.replace(/\/$/, '');
  const coreRoot = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

  it('formatted output contains VERIFICATION CONTEXT section', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const formatted = formatReport(report);

    expect(formatted).toContain('VERIFICATION CONTEXT');
    expect(formatted).toContain('Runtime:');
    expect(formatted).toContain('Pinned:');
    expect(formatted).toContain('Alignment:');
    expect(formatted).toContain('Evidence:');
  });

  it('VERIFICATION CONTEXT appears before check details', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const formatted = formatReport(report);

    const vcPos = formatted.indexOf('VERIFICATION CONTEXT');
    const envPos = formatted.indexOf('── ENV');
    expect(vcPos).toBeLessThan(envPos);
  });
});

// ── VerificationMode (Round 14.7) ───────────────────────────────────

describe('VerificationMode in IntegrityReport (Round 14.7)', () => {
  const projectRoot = new URL('../../../..', import.meta.url).pathname.replace(/\/$/, '');
  const coreRoot = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

  it('report carries verificationMode field', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    expect(report.verificationMode).toBeDefined();
    expect(['deterministic', 'degraded-no-pin', 'degraded-misaligned', 'degraded-no-evidence'])
      .toContain(report.verificationMode);
  });

  it('mode is degraded-no-evidence when no execution evidence provided', async () => {
    // Default run without executionEvidence → degraded-no-evidence
    const report = await runDiagnostics(projectRoot, coreRoot);
    expect(report.verificationMode).toBe('degraded-no-evidence');
  });

  it('mode is deterministic when aligned runtime + evidence provided', async () => {
    const current = computeRuntimeIdentity();
    const evidence: ExecutionEvidence = {
      vitest: {
        command: 'vitest run',
        exitCode: 0,
        passed: 100,
        failed: 0,
        total: 100,
        summary: 'all pass',
        timestamp: new Date().toISOString(),
        nodeVersion: current.nodeVersion,
        nodeAbi: current.nodeAbi,
        platform: current.platform,
        arch: current.arch,
      },
      tsc: {
        command: 'tsc --noEmit',
        exitCode: 0,
        passed: 1,
        failed: 0,
        total: 1,
        summary: 'clean',
        timestamp: new Date().toISOString(),
        nodeVersion: current.nodeVersion,
        nodeAbi: current.nodeAbi,
        platform: current.platform,
        arch: current.arch,
      },
    };
    const report = await runDiagnostics(projectRoot, coreRoot, { executionEvidence: evidence });
    expect(report.verificationMode).toBe('deterministic');
  });

  it('formatReport shows Verification Mode line', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const formatted = formatReport(report);
    expect(formatted).toContain('Verification Mode:');
    expect(formatted).toContain('DEGRADED-NO-EVIDENCE');
  });

  it('Verification Mode appears before VERIFICATION CONTEXT', async () => {
    const report = await runDiagnostics(projectRoot, coreRoot);
    const formatted = formatReport(report);
    const modePos = formatted.indexOf('Verification Mode:');
    const ctxPos = formatted.indexOf('VERIFICATION CONTEXT');
    expect(modePos).toBeLessThan(ctxPos);
  });
});

describe('Comprehensive foreign-runtime rejection (Round 14.7)', () => {
  it('rejects evidence when all 4 runtime fields are foreign', () => {
    const current: RuntimeIdentity = {
      nodeVersion: 'v24.10.0',
      nodeAbi: '137',
      platform: 'darwin',
      arch: 'arm64',
      cwd: '/test',
      binaryPath: '/usr/local/bin/node',
    };
    const evidence: ExecutionEvidence = {
      vitest: {
        command: 'vitest run',
        exitCode: 0,
        passed: 100,
        failed: 0,
        total: 100,
        summary: 'all pass',
        timestamp: new Date().toISOString(),
        // ALL 4 fields are foreign
        nodeVersion: 'v25.7.0',
        nodeAbi: '140',
        platform: 'linux',
        arch: 'x64',
      },
    };
    const result = checkExecutionEvidence(evidence, current);
    const vitestCheck = result.checks.find(c => c.id === 'tests-vitest-execution');
    expect(vitestCheck).toBeDefined();
    expect(vitestCheck!.status).toBe('fail');
    expect(vitestCheck!.severity).toBe('blocker');
    expect(vitestCheck!.summary).toContain('REJECTED');
    expect(vitestCheck!.summary).toContain('foreign runtime');
    expect(result.runtimeAligned).toBe(false);
    expect(result.runtimeMismatchDetail).toContain('nodeVersion');
    expect(result.runtimeMismatchDetail).toContain('nodeAbi');
    expect(result.runtimeMismatchDetail).toContain('platform');
    expect(result.runtimeMismatchDetail).toContain('arch');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Doctor Self-Model Unification (Round 14.8.1 — Goal C)
// ══════════════════════════════════════════════════════════════════════
import { checkIdentityCoherence } from './checks/identity.js';
import { ContinuityService } from '../identity/continuity-service.js';
import { openDatabase } from '../state/database.js';
import type { SelfState } from '../identity/continuity-service.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

function freshDoctorDb() {
  const agentHome = join(tmpdir(), `conshell-doctor-test-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return openDatabase({ agentHome, logger: silentLogger });
}

const DOCTOR_SOUL = '# Doctor Test Soul\n\nI am a test soul for doctor checks.';

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => silentLogger,
} as any;

describe('Doctor — Self-Model Unification (Round 14.8.1)', () => {
  it('passes runtime-self-state-consistent when runtime matches DB', () => {
    const db = freshDoctorDb();
    const svc = new ContinuityService(db, silentLogger);
    const selfState = svc.hydrate({ soulContent: DOCTOR_SOUL, soulName: 'DoctorTest' });

    const results = checkIdentityCoherence(db, DOCTOR_SOUL, selfState);
    const selfCheck = results.find(c => c.id === 'runtime-self-state-consistent');

    expect(selfCheck).toBeDefined();
    expect(selfCheck!.status).toBe('pass');
    expect(selfCheck!.summary).toContain('verified');
  });

  it('fails runtime-self-state-consistent when chainLength diverges', () => {
    const db = freshDoctorDb();
    const svc = new ContinuityService(db, silentLogger);
    const selfState = svc.hydrate({ soulContent: DOCTOR_SOUL, soulName: 'DoctorTest' });

    // Artificially tamper with chainLength to simulate divergence
    const tamperedState: SelfState = { ...selfState, chainLength: 999 };

    const results = checkIdentityCoherence(db, DOCTOR_SOUL, tamperedState);
    const selfCheck = results.find(c => c.id === 'runtime-self-state-consistent');

    expect(selfCheck).toBeDefined();
    expect(selfCheck!.status).toBe('fail');
    expect(selfCheck!.severity).toBe('blocker');
    expect(selfCheck!.evidence).toContain('chainLength mismatch');
  });

  it('backward compat: no selfState means no runtime-self-state check', () => {
    const db = freshDoctorDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: DOCTOR_SOUL, soulName: 'DoctorTest' });

    // Call without selfState — should still work, just no selfState check
    const results = checkIdentityCoherence(db, DOCTOR_SOUL);
    const selfCheck = results.find(c => c.id === 'runtime-self-state-consistent');

    expect(selfCheck).toBeUndefined(); // No selfState check
    // But other checks still run
    expect(results.some(c => c.id === 'identity-anchor-exists')).toBe(true);
    expect(results.some(c => c.id === 'continuity-chain-valid')).toBe(true);
  });

  it('detects soulDrifted mismatch between runtime and actual', () => {
    const db = freshDoctorDb();
    const svc = new ContinuityService(db, silentLogger);
    const selfState = svc.hydrate({ soulContent: DOCTOR_SOUL, soulName: 'DoctorTest' });

    // Runtime says not drifted, but we pass different soul content
    // so actual drift = true but selfState.soulDrifted = false
    const differentSoul = '# Changed soul content';
    const results = checkIdentityCoherence(db, differentSoul, selfState);
    const selfCheck = results.find(c => c.id === 'runtime-self-state-consistent');

    expect(selfCheck).toBeDefined();
    expect(selfCheck!.status).toBe('fail');
    expect(selfCheck!.evidence).toContain('soulDrifted mismatch');
  });
});
