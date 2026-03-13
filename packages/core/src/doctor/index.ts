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
  verdict: 'ready' | 'conditionally-ready' | 'not-ready';
  /** Individual gate criteria */
  criteria: GateCriterion[];
  /** Human-readable rationale */
  rationale: string;
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
import { checkTestBoundary } from './checks/tests.js';
import { checkBuildReadiness } from './checks/build.js';
import { checkIntegrations } from './checks/integrations.js';

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Run all diagnostic checks and produce an integrity report.
 *
 * @param projectRoot - Absolute path to the monorepo root
 * @param coreRoot - Absolute path to packages/core
 */
export async function runDiagnostics(
  projectRoot: string,
  coreRoot: string,
): Promise<IntegrityReport> {
  const checks: CheckResult[] = [];

  // Run all check categories
  checks.push(...checkEnvironment(projectRoot));
  checks.push(...checkDependencies(projectRoot, coreRoot));
  checks.push(...checkTestBoundary(coreRoot));
  checks.push(...checkBuildReadiness(coreRoot));
  checks.push(...(await checkIntegrations()));

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

  // Build readiness gate
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

  const allPass = criteria.every(c => c.pass);
  const anyFail = criteria.some(c => !c.pass);
  const warningCount = counts.warning;

  let verdict: ReadinessGate['verdict'];
  let rationale: string;

  if (allPass && warningCount === 0) {
    verdict = 'ready';
    rationale = 'All gate criteria pass. No warnings. Ready for feature expansion.';
  } else if (allPass && warningCount > 0) {
    verdict = 'conditionally-ready';
    rationale = `All gate criteria pass but ${warningCount} warning(s) exist. Feature expansion is possible but warnings should be triaged.`;
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
  const gateIcon = report.readiness.verdict === 'ready' ? '✅' : report.readiness.verdict === 'conditionally-ready' ? '⚠️' : '❌';
  lines.push(`── READINESS GATE ────────────────────────────────`);
  lines.push(`${gateIcon} Verdict: ${report.readiness.verdict.toUpperCase()}`);
  lines.push(`   ${report.readiness.rationale}`);
  for (const c of report.readiness.criteria) {
    lines.push(`   ${c.pass ? '✅' : '❌'} ${c.name}: ${c.note}`);
  }

  return lines.join('\n');
}
