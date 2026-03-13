/**
 * Test boundary checks — vitest config, test file count, contamination risk.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { CheckResult } from '../index.js';

/**
 * Recursively find all *.test.ts files under a directory.
 */
function findTestFiles(dir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, benchmarks, and numbered duplicates
        if (/^(node_modules|dist|benchmarks)/.test(entry.name)) continue;
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
  });

  // T2: Test file inventory
  const srcDir = join(coreRoot, 'src');
  const testFiles = findTestFiles(srcDir);
  const testDir = join(coreRoot, 'test');
  const testDirFiles = existsSync(testDir) ? findTestFiles(testDir) : [];
  const allTestFiles = [...testFiles, ...testDirFiles];

  // Check for benchmark files
  const benchmarkFiles = allTestFiles.filter(f => f.includes('bench') || f.includes('perf'));
  const functionalFiles = allTestFiles.filter(f => !f.includes('bench') && !f.includes('perf'));

  results.push({
    id: 'tests-file-count',
    label: 'Test File Inventory',
    category: 'tests',
    severity: 'info',
    status: allTestFiles.length > 0 ? 'pass' : 'fail',
    summary: `Found ${allTestFiles.length} test files (${functionalFiles.length} functional, ${benchmarkFiles.length} benchmark). Files in src/: ${testFiles.length}, test/: ${testDirFiles.length}.`,
    evidence: `Recursive scan of ${srcDir} excluding node_modules/dist/benchmarks`,
    confidence: 'high',
  });

  // T3: Benchmark isolation
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
  });

  // T4: Root vitest guard
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
  });

  return results;
}
