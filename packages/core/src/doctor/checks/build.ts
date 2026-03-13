/**
 * Build readiness checks — tsc availability, tsconfig, dist freshness.
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../index.js';

export function checkBuildReadiness(coreRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // B1: tsconfig presence
  const tsconfigPath = join(coreRoot, 'tsconfig.json');
  const tsconfigExists = existsSync(tsconfigPath);
  results.push({
    id: 'build-tsconfig',
    label: 'TypeScript Config',
    category: 'build',
    severity: tsconfigExists ? 'info' : 'blocker',
    status: tsconfigExists ? 'pass' : 'fail',
    summary: tsconfigExists
      ? 'tsconfig.json present in packages/core'
      : 'tsconfig.json MISSING — TypeScript compilation will fail.',
    evidence: `existsSync(${tsconfigPath}) = ${tsconfigExists}`,
    confidence: 'high',
  });

  // B2: dist directory
  const distPath = join(coreRoot, 'dist');
  const distExists = existsSync(distPath);
  let distAge = 'N/A';
  if (distExists) {
    try {
      const stat = statSync(distPath);
      const ageHours = Math.round((Date.now() - stat.mtimeMs) / 3_600_000);
      distAge = `${ageHours}h ago`;
    } catch { /* */ }
  }

  results.push({
    id: 'build-dist',
    label: 'Build Output (dist/)',
    category: 'build',
    severity: distExists ? 'info' : 'warning',
    status: distExists ? 'pass' : 'warn',
    summary: distExists
      ? `dist/ exists (last modified: ${distAge}). Note: freshness is not verified against source.`
      : 'dist/ does not exist. The package has not been built, or build output was cleaned.',
    evidence: `existsSync(${distPath}) = ${distExists}`,
    confidence: distExists ? 'medium' : 'high',
  });

  // B3: package.json build script
  const packageJsonPath = join(coreRoot, 'package.json');
  let hasBuildScript = false;
  try {
    const pkg = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf-8'));
    hasBuildScript = !!(pkg.scripts?.build);
  } catch { /* */ }

  results.push({
    id: 'build-script',
    label: 'Build Script',
    category: 'build',
    severity: hasBuildScript ? 'info' : 'warning',
    status: hasBuildScript ? 'pass' : 'warn',
    summary: hasBuildScript
      ? 'package.json has a "build" script defined'
      : 'No "build" script found in package.json.',
    evidence: `package.json scripts.build exists: ${hasBuildScript}`,
    confidence: 'high',
  });

  return results;
}
