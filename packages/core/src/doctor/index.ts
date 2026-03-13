/**
 * Runtime Integrity Doctor — ConShell self-diagnosis subsystem
 *
 * Purpose: Allow ConShell to determine, report, and defend whether
 * it is currently trustworthy by checking environment, dependencies,
 * tests, build, and external integrations.
 *
 * Each check produces evidence-backed results with confidence levels.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type Severity = 'info' | 'warning' | 'blocker';

export type Confidence = 'high' | 'medium' | 'low';

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

  return {
    timestamp: new Date().toISOString(),
    health,
    checks,
    counts,
    commands,
  };
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
      lines.push(`   Confidence: ${check.confidence}`);
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

  return lines.join('\n');
}
