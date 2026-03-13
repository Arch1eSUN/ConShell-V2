/**
 * Test boundary checks — vitest config, test file inventory, contamination risk.
 *
 * Round 14.1: Relabeled "file count" as "static inventory" and added
 * an explicit execution-note check to distinguish inventory from
 * actual vitest execution truth.
 *
 * Round 14.2: Added checkExecutionEvidence() for Route B external
 * execution results. Produces tests-vitest-execution and
 * build-tsc-execution checks from caller-provided evidence.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { CheckResult, ExecutionEvidence, ExecutionResult, RuntimeIdentity } from '../index.js';

/**
 * Recursively find all *.test.ts files under a directory.
 */
function findTestFiles(dir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, and numbered duplicates
        if (/^(node_modules|dist)/.test(entry.name)) continue;
        if (/^node_modules\s+\d+$/.test(entry.name)) continue;
        findTestFiles(fullPath, results);
      } else if (entry.name.endsWith('.test.ts')) {
        results.push(fullPath);
      }
    }
  } catch {
    // EPERM or missing directory
  }
  return results;
}

export function checkTestBoundary(coreRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // T1: Vitest config presence
  const vitestConfig = join(coreRoot, 'vitest.config.ts');
  const vitestConfigExists = existsSync(vitestConfig);
  let configContent = '';
  if (vitestConfigExists) {
    try { configContent = readFileSync(vitestConfig, 'utf-8'); } catch { /* */ }
  }

  results.push({
    id: 'tests-vitest-config',
    label: 'Vitest Configuration',
    category: 'tests',
    severity: vitestConfigExists ? 'info' : 'blocker',
    status: vitestConfigExists ? 'pass' : 'fail',
    summary: vitestConfigExists
      ? `vitest.config.ts present. Include pattern: ${configContent.includes("src/**/*.test.ts") ? 'src/**/*.test.ts' : 'unknown'}. Benchmark isolation: ${configContent.includes('benchmarks') ? 'yes (excluded)' : 'unknown'}.`
      : 'vitest.config.ts MISSING. Test discovery scope is uncontrolled.',
    evidence: `existsSync(vitest.config.ts) = ${vitestConfigExists}`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  // T2: STATIC test file inventory (NOT execution truth)
  const srcDir = join(coreRoot, 'src');
  const testFiles = findTestFiles(srcDir);
  const testDir = join(coreRoot, 'test');
  const testDirFiles = existsSync(testDir) ? findTestFiles(testDir) : [];
  const allTestFiles = [...testFiles, ...testDirFiles];

  // Categorize by convention
  const benchmarkFiles = allTestFiles.filter(f => f.includes('bench') || f.includes('perf'));
  const functionalFiles = allTestFiles.filter(f => !f.includes('bench') && !f.includes('perf'));

  results.push({
    id: 'tests-file-inventory',
    label: 'Static Test File Inventory',
    category: 'tests',
    severity: 'info',
    status: allTestFiles.length > 0 ? 'pass' : 'fail',
    summary: [
      `Static inventory: ${allTestFiles.length} *.test.ts files on disk`,
      `(${functionalFiles.length} functional, ${benchmarkFiles.length} benchmark).`,
      `NOTE: This is a filesystem scan, NOT vitest execution truth.`,
      `Vitest may execute fewer files if config excludes benchmarks or other patterns.`,
      `Canonical execution: run vitest from packages/core and check its summary line.`,
    ].join(' '),
    evidence: `Recursive fs scan of ${srcDir}, excluding node_modules and dist`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  // T3: Execution boundary note
  results.push({
    id: 'tests-execution-note',
    label: 'Test Execution Truth (Not Verified Here)',
    category: 'tests',
    severity: 'info',
    status: 'unknown',
    summary: [
      `Doctor does NOT execute vitest — it cannot report execution truth.`,
      `Trusted command: cd packages/core && npx vitest run --no-coverage.`,
      `Static inventory (${allTestFiles.length} files) may differ from vitest execution count`,
      `due to config exclusions (e.g., benchmarks excluded by vitest.config.ts).`,
      `Last verified execution: run the trusted command and compare against this inventory.`,
    ].join(' '),
    evidence: 'This check is a documentation note, not an execution probe.',
    confidence: 'low',
    evidenceType: 'code-inspection',
  });

  // T4: Benchmark isolation
  const benchExcluded = configContent.includes('benchmarks');
  results.push({
    id: 'tests-benchmark-isolation',
    label: 'Benchmark Isolation',
    category: 'tests',
    severity: benchExcluded ? 'info' : 'warning',
    status: benchExcluded ? 'pass' : 'warn',
    summary: benchExcluded
      ? 'Benchmark files are excluded from functional test runs via vitest.config.ts'
      : 'Benchmark isolation status unclear — benchmarks may run in functional test sweep.',
    evidence: `vitest.config.ts contains "benchmarks" in exclude: ${benchExcluded}`,
    confidence: benchExcluded ? 'high' : 'medium',
    evidenceType: 'code-inspection',
  });

  // T5: Root vitest guard
  const projectRoot = join(coreRoot, '..', '..');
  const rootVitestConfig = join(projectRoot, 'vitest.config.ts');
  const rootGuardExists = existsSync(rootVitestConfig);
  results.push({
    id: 'tests-root-guard',
    label: 'Root Vitest Guard',
    category: 'tests',
    severity: rootGuardExists ? 'info' : 'warning',
    status: rootGuardExists ? 'pass' : 'warn',
    summary: rootGuardExists
      ? 'Root vitest.config.ts exists — prevents accidental contaminated test runs from repo root.'
      : 'No root vitest guard. Running vitest from repo root will scan numbered node_modules duplicates.',
    evidence: `existsSync(root/vitest.config.ts) = ${rootGuardExists}`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  return results;
}

/**
 * Return type for checkExecutionEvidence — carries both checks AND alignment metadata
 * so the gate can use runtimeAligned without re-parsing checks.
 */
export interface EvidenceAlignmentResult {
  checks: CheckResult[];
  runtimeAligned: boolean;
  runtimeMismatchDetail: string;
}

/**
 * Check if execution evidence is stale (>24h old).
 */
function isStale(timestamp: string): boolean {
  try {
    const ts = new Date(timestamp).getTime();
    const now = Date.now();
    return (now - ts) > 24 * 60 * 60 * 1000;
  } catch {
    return true; // Unparseable timestamp = stale
  }
}

/**
 * Check if an ExecutionResult's runtime identity matches the current runtime.
 * Returns null if aligned, or a mismatch description string if not.
 */
function checkRuntimeAlignment(
  result: ExecutionResult,
  current: RuntimeIdentity,
): string | null {
  const mismatches: string[] = [];
  if (result.nodeVersion && result.nodeVersion !== current.nodeVersion) {
    mismatches.push(`nodeVersion: evidence=${result.nodeVersion} current=${current.nodeVersion}`);
  }
  if (result.nodeAbi && result.nodeAbi !== current.nodeAbi) {
    mismatches.push(`nodeAbi: evidence=${result.nodeAbi} current=${current.nodeAbi}`);
  }
  if (result.platform && result.platform !== current.platform) {
    mismatches.push(`platform: evidence=${result.platform} current=${current.platform}`);
  }
  if (result.arch && result.arch !== current.arch) {
    mismatches.push(`arch: evidence=${result.arch} current=${current.arch}`);
  }
  return mismatches.length > 0 ? mismatches.join('; ') : null;
}

/**
 * Produce check results from externally-provided execution evidence (Route B).
 *
 * Round 14.3: Now accepts RuntimeIdentity to cross-check evidence against
 * the current runtime. Returns EvidenceAlignmentResult with alignment metadata.
 *
 * When evidence runtime doesn't match current runtime → blocker.
 * When evidence is stale (>24h) → warning.
 * When evidence is absent → unknown status.
 */
export function checkExecutionEvidence(
  evidence?: ExecutionEvidence,
  currentRuntime?: RuntimeIdentity,
): EvidenceAlignmentResult {
  const checks: CheckResult[] = [];
  let runtimeAligned = true;
  let runtimeMismatchDetail = '';

  // EX1: Vitest execution
  if (evidence?.vitest) {
    const v = evidence.vitest;
    const execPassed = v.exitCode === 0 && v.failed === 0;
    const stale = isStale(v.timestamp);

    // Check runtime alignment
    let mismatch: string | null = null;
    if (currentRuntime) {
      mismatch = checkRuntimeAlignment(v, currentRuntime);
      if (mismatch) {
        runtimeAligned = false;
        runtimeMismatchDetail = `vitest: ${mismatch}`;
      }
    }

    if (mismatch) {
      checks.push({
        id: 'tests-vitest-execution',
        label: 'Vitest Execution Result',
        category: 'tests',
        severity: 'blocker',
        status: 'fail',
        summary: `REJECTED: Evidence from foreign runtime. ${mismatch}. Re-run vitest in the current runtime to produce valid evidence.`,
        evidence: `Command: ${v.command} | Runtime mismatch: ${mismatch}`,
        confidence: 'high',
        evidenceType: 'test-execution',
      });
    } else if (stale) {
      checks.push({
        id: 'tests-vitest-execution',
        label: 'Vitest Execution Result',
        category: 'tests',
        severity: 'warning',
        status: 'warn',
        summary: `STALE: Evidence is >24h old (${v.timestamp}). ${v.passed}/${v.total} tests passed when run. Re-run vitest to refresh.`,
        evidence: `Command: ${v.command} | Timestamp: ${v.timestamp} | Stale: true`,
        confidence: 'medium',
        evidenceType: 'test-execution',
      });
    } else {
      checks.push({
        id: 'tests-vitest-execution',
        label: 'Vitest Execution Result',
        category: 'tests',
        severity: execPassed ? 'info' : 'blocker',
        status: execPassed ? 'pass' : 'fail',
        summary: execPassed
          ? `${v.passed}/${v.total} tests passed (exit ${v.exitCode}). ${v.summary}`
          : `${v.failed}/${v.total} tests FAILED (exit ${v.exitCode}). ${v.summary}`,
        evidence: `Command: ${v.command} | Exit: ${v.exitCode} | Passed: ${v.passed} | Failed: ${v.failed} | Total: ${v.total} | At: ${v.timestamp}`,
        confidence: 'high',
        evidenceType: 'test-execution',
      });
    }
  } else {
    checks.push({
      id: 'tests-vitest-execution',
      label: 'Vitest Execution Result',
      category: 'tests',
      severity: 'info',
      status: 'unknown',
      summary: 'No vitest execution evidence provided. Run vitest externally and pass results to Doctor.',
      evidence: 'No ExecutionEvidence.vitest supplied to runDiagnostics()',
      confidence: 'low',
      evidenceType: 'test-execution',
    });
    runtimeAligned = false;
    runtimeMismatchDetail = runtimeMismatchDetail || 'No execution evidence provided';
  }

  // EX2: TypeScript typecheck execution
  if (evidence?.tsc) {
    const t = evidence.tsc;
    const execPassed = t.exitCode === 0 && t.failed === 0;
    const stale = isStale(t.timestamp);

    // Check runtime alignment
    let mismatch: string | null = null;
    if (currentRuntime) {
      mismatch = checkRuntimeAlignment(t, currentRuntime);
      if (mismatch) {
        runtimeAligned = false;
        const detail = `tsc: ${mismatch}`;
        runtimeMismatchDetail = runtimeMismatchDetail
          ? `${runtimeMismatchDetail}; ${detail}`
          : detail;
      }
    }

    if (mismatch) {
      checks.push({
        id: 'build-tsc-execution',
        label: 'TypeScript Typecheck Result',
        category: 'build',
        severity: 'blocker',
        status: 'fail',
        summary: `REJECTED: Evidence from foreign runtime. ${mismatch}. Re-run tsc in the current runtime.`,
        evidence: `Command: ${t.command} | Runtime mismatch: ${mismatch}`,
        confidence: 'high',
        evidenceType: 'test-execution',
      });
    } else if (stale) {
      checks.push({
        id: 'build-tsc-execution',
        label: 'TypeScript Typecheck Result',
        category: 'build',
        severity: 'warning',
        status: 'warn',
        summary: `STALE: Evidence is >24h old (${t.timestamp}). Re-run tsc to refresh.`,
        evidence: `Command: ${t.command} | Timestamp: ${t.timestamp} | Stale: true`,
        confidence: 'medium',
        evidenceType: 'test-execution',
      });
    } else {
      checks.push({
        id: 'build-tsc-execution',
        label: 'TypeScript Typecheck Result',
        category: 'build',
        severity: execPassed ? 'info' : 'blocker',
        status: execPassed ? 'pass' : 'fail',
        summary: execPassed
          ? `tsc --noEmit passed (0 errors). ${t.summary}`
          : `tsc --noEmit FAILED (${t.failed} errors, exit ${t.exitCode}). ${t.summary}`,
        evidence: `Command: ${t.command} | Exit: ${t.exitCode} | Errors: ${t.failed} | At: ${t.timestamp}`,
        confidence: 'high',
        evidenceType: 'test-execution',
      });
    }
  } else {
    checks.push({
      id: 'build-tsc-execution',
      label: 'TypeScript Typecheck Result',
      category: 'build',
      severity: 'info',
      status: 'unknown',
      summary: 'No tsc execution evidence provided. Run tsc --noEmit externally and pass results to Doctor.',
      evidence: 'No ExecutionEvidence.tsc supplied to runDiagnostics()',
      confidence: 'low',
      evidenceType: 'test-execution',
    });
    if (!evidence?.vitest) {
      // Both missing — already set above
    } else {
      runtimeAligned = false;
      runtimeMismatchDetail = runtimeMismatchDetail || 'tsc evidence missing';
    }
  }

  return { checks, runtimeAligned, runtimeMismatchDetail };
}
