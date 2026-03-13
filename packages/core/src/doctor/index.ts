/**
 * Runtime Integrity Doctor — ConShell self-diagnosis subsystem
 *
 * Purpose: Allow ConShell to determine, report, and defend whether
 * it is currently trustworthy by checking environment, dependencies,
 * tests, build, and external integrations.
 *
 * Design principle: truth-preserving, not narrative-generating.
 * Every check includes evidence provenance and confidence levels.
 *
 * Round 14.1: Added evidenceType provenance and ReadinessGate.
 * Round 14.2: Added ExecutionEvidence binding and insufficient-evidence verdict.
 *   Route B: Doctor does not execute commands — it accepts structured
 *   execution results from the caller. When absent, verdict degrades to
 *   insufficient-evidence. This prevents false-positive readiness.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type Severity = 'info' | 'warning' | 'blocker';

export type Confidence = 'high' | 'medium' | 'low';

/** How the evidence was obtained */
export type EvidenceType =
  | 'code-inspection'
  | 'fs-scan'
  | 'runtime-probe'
  | 'test-execution'
  | 'network-observation'
  | 'historical-claim';

export interface CheckResult {
  /** Check identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Category this check belongs to */
  category: 'env' | 'deps' | 'tests' | 'build' | 'integrations';
  /** Result severity */
  severity: Severity;
  /** Current status */
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  /** Human-readable summary */
  summary: string;
  /** Evidence supporting this result */
  evidence: string;
  /** Confidence in the conclusion */
  confidence: Confidence;
  /** How the evidence was obtained */
  evidenceType: EvidenceType;
}

export interface ReadinessGate {
  /** Whether project is ready for feature expansion */
  verdict: 'ready' | 'conditionally-ready' | 'not-ready' | 'insufficient-evidence';
  /** Individual gate criteria */
  criteria: GateCriterion[];
  /** Human-readable rationale */
  rationale: string;
}

// ── Execution Evidence (Route B) ──────────────────────────────────────

/** Result from running a trusted command externally */
export interface ExecutionResult {
  /** The command that was run */
  command: string;
  /** Process exit code (0 = success) */
  exitCode: number;
  /** Number of tests/checks that passed */
  passed: number;
  /** Number of tests/checks that failed */
  failed: number;
  /** Total number of tests/checks */
  total: number;
  /** One-line summary */
  summary: string;
  /** ISO-8601 timestamp of execution */
  timestamp: string;
}

/** Structured results from external trusted command execution */
export interface ExecutionEvidence {
  vitest?: ExecutionResult;
  tsc?: ExecutionResult;
}

/** Options for runDiagnostics */
export interface DiagnosticsOptions {
  /**
   * Structured results from running vitest/tsc externally.
   * When absent, the readiness gate verdict degrades to 'insufficient-evidence'
   * because the Doctor has no proof that tests actually pass.
   */
  executionEvidence?: ExecutionEvidence;
}

export interface GateCriterion {
  /** Criterion name */
  name: string;
  /** Whether it passes */
  pass: boolean;
  /** Evidence or note */
  note: string;
}

export interface IntegrityReport {
  /** ISO timestamp of report generation */
  timestamp: string;
  /** Overall health: healthy | degraded | unhealthy */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** All check results */
  checks: CheckResult[];
  /** Count by severity */
  counts: { info: number; warning: number; blocker: number };
  /** Standard command panel */
  commands: CommandPanel;
  /** Expansion readiness gate */
  readiness: ReadinessGate;
}

export interface CommandPanel {
  /** Most trustworthy test command */
  test: string;
  /** Most trustworthy type check command */
  typecheck: string;
  /** Doctor self-test */
  doctor: string;
  /** Commands that should NOT be used */
  doNotUse: string[];
}

// ── Checks ─────────────────────────────────────────────────────────────

import { checkEnvironment } from './checks/env.js';
import { checkDependencies } from './checks/deps.js';
import { checkTestBoundary, checkExecutionEvidence } from './checks/tests.js';
import { checkBuildReadiness } from './checks/build.js';
import { checkIntegrations } from './checks/integrations.js';

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Run all diagnostic checks and produce an integrity report.
 *
 * @param projectRoot - Absolute path to the monorepo root
 * @param coreRoot - Absolute path to packages/core
 * @param options - Optional execution evidence from external runs
 */
export async function runDiagnostics(
  projectRoot: string,
  coreRoot: string,
  options?: DiagnosticsOptions,
): Promise<IntegrityReport> {
  const checks: CheckResult[] = [];

  // Run all check categories
  checks.push(...checkEnvironment(projectRoot));
  checks.push(...checkDependencies(projectRoot, coreRoot));
  checks.push(...checkTestBoundary(coreRoot));
  checks.push(...checkBuildReadiness(coreRoot));
  checks.push(...(await checkIntegrations()));

  // Add execution evidence checks (Route B)
  checks.push(...checkExecutionEvidence(options?.executionEvidence));

  // Compute counts
  const counts = {
    info: checks.filter(c => c.severity === 'info').length,
    warning: checks.filter(c => c.severity === 'warning').length,
    blocker: checks.filter(c => c.severity === 'blocker').length,
  };

  // Determine overall health
  let health: IntegrityReport['health'] = 'healthy';
  if (counts.blocker > 0) health = 'unhealthy';
  else if (counts.warning > 0) health = 'degraded';

  const commands: CommandPanel = {
    test: 'cd packages/core && npx vitest run --no-coverage',
    typecheck: 'cd packages/core && npx tsc --noEmit',
    doctor: 'cd packages/core && npx vitest run src/doctor/doctor.test.ts',
    doNotUse: [
      'npx vitest run (from repo root — scans contaminated node_modules duplicates)',
      'pnpm test (from repo root — same contamination risk)',
    ],
  };

  // Build readiness gate (includes execution evidence criteria)
  const readiness = computeReadinessGate(checks, counts);

  return {
    timestamp: new Date().toISOString(),
    health,
    checks,
    counts,
    commands,
    readiness,
  };
}

/**
 * Compute the readiness gate from check results.
 *
 * Verdicts:
 *   ready               — all criteria pass, no warnings
 *   conditionally-ready  — all criteria pass, warnings exist
 *   insufficient-evidence — execution evidence is missing (can't prove readiness)
 *   not-ready            — one or more criteria fail
 */
function computeReadinessGate(
  checks: CheckResult[],
  counts: { blocker: number; warning: number },
): ReadinessGate {
  const criteria: GateCriterion[] = [];

  // Criterion 1: No blockers
  criteria.push({
    name: 'No blocker-severity checks',
    pass: counts.blocker === 0,
    note: counts.blocker === 0 ? 'All checks pass or warn' : `${counts.blocker} blocker(s) found`,
  });

  // Criterion 2: better-sqlite3 usable
  const sqliteCheck = checks.find(c => c.id === 'deps-better-sqlite3');
  criteria.push({
    name: 'Critical native dependency (better-sqlite3)',
    pass: sqliteCheck?.status === 'pass',
    note: sqliteCheck?.summary ?? 'not checked',
  });

  // Criterion 3: Test boundary controlled
  const guardCheck = checks.find(c => c.id === 'tests-root-guard');
  criteria.push({
    name: 'Root vitest contamination guard',
    pass: guardCheck?.status === 'pass',
    note: guardCheck?.summary ?? 'not checked',
  });

  // Criterion 4: Vitest config present
  const vitestCheck = checks.find(c => c.id === 'tests-vitest-config');
  criteria.push({
    name: 'Vitest configuration present',
    pass: vitestCheck?.status === 'pass',
    note: vitestCheck?.summary ?? 'not checked',
  });

  // Criterion 5: Integration truth model honest
  const integChecks = checks.filter(c => c.category === 'integrations');
  const hasOverclaim = integChecks.some(c => c.confidence === 'high' && c.evidenceType === 'historical-claim');
  criteria.push({
    name: 'Integration claims evidence-backed',
    pass: !hasOverclaim,
    note: hasOverclaim
      ? 'Some integration claims use historical-claim provenance with high confidence — review needed'
      : 'Integration claims properly provenance-tagged',
  });

  // Criterion 6: Test execution evidence present and passing (Route B)
  const vitestExec = checks.find(c => c.id === 'tests-vitest-execution');
  const hasVitestEvidence = vitestExec !== undefined && vitestExec.status !== 'unknown';
  criteria.push({
    name: 'Test execution evidence',
    pass: vitestExec?.status === 'pass',
    note: !hasVitestEvidence
      ? 'No execution evidence provided — Doctor cannot verify tests pass'
      : vitestExec?.summary ?? 'unknown',
  });

  // Criterion 7: Typecheck execution evidence present and passing (Route B)
  const tscExec = checks.find(c => c.id === 'build-tsc-execution');
  const hasTscEvidence = tscExec !== undefined && tscExec.status !== 'unknown';
  criteria.push({
    name: 'Typecheck execution evidence',
    pass: tscExec?.status === 'pass',
    note: !hasTscEvidence
      ? 'No execution evidence provided — Doctor cannot verify typecheck passes'
      : tscExec?.summary ?? 'unknown',
  });

  // Determine verdict
  const executionEvidenceMissing = !hasVitestEvidence || !hasTscEvidence;
  const allPass = criteria.every(c => c.pass);
  const warningCount = counts.warning;

  let verdict: ReadinessGate['verdict'];
  let rationale: string;

  if (executionEvidenceMissing && criteria.filter(c => !c.pass).length === (executionEvidenceMissing ? criteria.filter(c => !c.pass).length : 0)) {
    // If the ONLY failures are missing execution evidence, verdict is insufficient-evidence
    const nonExecFails = criteria.filter(c => !c.pass && c.name !== 'Test execution evidence' && c.name !== 'Typecheck execution evidence');
    if (nonExecFails.length === 0) {
      verdict = 'insufficient-evidence';
      const missing: string[] = [];
      if (!hasVitestEvidence) missing.push('vitest');
      if (!hasTscEvidence) missing.push('tsc');
      rationale = `Structural checks pass but execution evidence is missing for: ${missing.join(', ')}. Run tests externally and provide results to upgrade verdict.`;
    } else {
      verdict = 'not-ready';
      const failed = criteria.filter(c => !c.pass).map(c => c.name);
      rationale = `Gate criteria failed: ${failed.join(', ')}. Resolve before feature expansion.`;
    }
  } else if (allPass && warningCount === 0) {
    verdict = 'ready';
    rationale = 'All gate criteria pass with execution evidence. No warnings. Ready for feature expansion.';
  } else if (allPass && warningCount > 0) {
    verdict = 'conditionally-ready';
    rationale = `All gate criteria pass with execution evidence but ${warningCount} warning(s) exist. Feature expansion is possible but warnings should be triaged.`;
  } else {
    verdict = 'not-ready';
    const failed = criteria.filter(c => !c.pass).map(c => c.name);
    rationale = `Gate criteria failed: ${failed.join(', ')}. Resolve before feature expansion.`;
  }

  return { verdict, criteria, rationale };
}

/**
 * Format an integrity report as human-readable text.
 */
export function formatReport(report: IntegrityReport): string {
  const lines: string[] = [];
  const icon = report.health === 'healthy' ? '✅' : report.health === 'degraded' ? '⚠️' : '❌';

  lines.push(`${icon} ConShell Integrity Report — ${report.health.toUpperCase()}`);
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Checks: ${report.checks.length} (${report.counts.blocker} blockers, ${report.counts.warning} warnings, ${report.counts.info} info)`);
  lines.push('');

  // Group by category
  const categories = ['env', 'deps', 'tests', 'build', 'integrations'] as const;
  for (const cat of categories) {
    const catChecks = report.checks.filter(c => c.category === cat);
    if (catChecks.length === 0) continue;

    lines.push(`── ${cat.toUpperCase()} ${'─'.repeat(50 - cat.length)}`);
    for (const check of catChecks) {
      const statusIcon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : check.status === 'warn' ? '⚠️' : '❓';
      lines.push(`${statusIcon} [${check.id}] ${check.label}`);
      lines.push(`   ${check.summary}`);
      lines.push(`   Evidence: ${check.evidence}`);
      lines.push(`   Provenance: ${check.evidenceType} | Confidence: ${check.confidence}`);
      lines.push('');
    }
  }

  lines.push('── STANDARD COMMANDS ──────────────────────────────');
  lines.push(`  Test:      ${report.commands.test}`);
  lines.push(`  Typecheck: ${report.commands.typecheck}`);
  lines.push(`  Doctor:    ${report.commands.doctor}`);
  lines.push(`  DO NOT USE:`);
  for (const cmd of report.commands.doNotUse) {
    lines.push(`    ✗ ${cmd}`);
  }
  lines.push('');

  // Readiness gate
  const gateIcon = report.readiness.verdict === 'ready' ? '✅' : report.readiness.verdict === 'conditionally-ready' ? '⚠️' : report.readiness.verdict === 'insufficient-evidence' ? '❓' : '❌';
  lines.push(`── READINESS GATE ────────────────────────────────`);
  lines.push(`${gateIcon} Verdict: ${report.readiness.verdict.toUpperCase()}`);
  lines.push(`   ${report.readiness.rationale}`);
  for (const c of report.readiness.criteria) {
    lines.push(`   ${c.pass ? '✅' : '❌'} ${c.name}: ${c.note}`);
  }

  return lines.join('\n');
}
