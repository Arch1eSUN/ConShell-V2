/**
 * Dependency integrity checks — abnormal node_modules, native modules, EPERM.
 */
import { existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../index.js';

/**
 * Scan for numbered node_modules duplicates (macOS Finder artifact).
 * Pattern: "node_modules 2", "node_modules 3", etc.
 */
function findNumberedNodeModules(dir: string): string[] {
  const found: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (/^node_modules\s+\d+$/.test(entry)) {
        found.push(join(dir, entry));
      }
    }
  } catch {
    // EPERM or other access issue — dir itself may be inaccessible
  }
  return found;
}

/**
 * Check if a native module can be loaded.
 */
function probeNativeModule(moduleName: string): { loadable: boolean; resolvedPath: string | null; error: string | null } {
  try {
    const resolved = require.resolve(moduleName);
    // Verify the actual module can instantiate
    const mod = require(moduleName);
    return { loadable: true, resolvedPath: resolved, error: null };
  } catch (err) {
    return {
      loadable: false,
      resolvedPath: null,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
    };
  }
}

/**
 * Check if a directory is accessible (not EPERM-blocked).
 */
function isAccessible(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function checkDependencies(projectRoot: string, coreRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // D1: Root node_modules accessibility
  const rootNm = join(projectRoot, 'node_modules');
  const rootNmAccessible = isAccessible(rootNm);
  results.push({
    id: 'deps-root-node-modules',
    label: 'Root node_modules Accessibility',
    category: 'deps',
    severity: rootNmAccessible ? 'info' : 'warning',
    status: rootNmAccessible ? 'pass' : 'warn',
    summary: rootNmAccessible
      ? 'Root node_modules is accessible'
      : 'Root node_modules is EPERM-blocked. pnpm install/build operations will fail.',
    evidence: `statSync("${rootNm}") ${rootNmAccessible ? 'succeeded' : 'threw EPERM'}`,
    confidence: 'high',
  });

  // D2: Numbered node_modules duplicates
  const numberedDirs: string[] = [];
  const dirsToScan = [
    projectRoot,
    join(projectRoot, 'packages', 'core'),
    join(projectRoot, 'packages', 'cli'),
    join(projectRoot, 'packages', 'dashboard'),
  ];

  for (const dir of dirsToScan) {
    try {
      numberedDirs.push(...findNumberedNodeModules(dir));
    } catch { /* dir may not exist */ }
  }

  results.push({
    id: 'deps-numbered-duplicates',
    label: 'Numbered node_modules Duplicates',
    category: 'deps',
    severity: numberedDirs.length > 0 ? 'warning' : 'info',
    status: numberedDirs.length > 0 ? 'warn' : 'pass',
    summary: numberedDirs.length > 0
      ? `Found ${numberedDirs.length} numbered node_modules duplicate(s). These can contaminate test discovery and module resolution. Directories: ${numberedDirs.map(d => d.replace(projectRoot, '.')).join(', ')}`
      : 'No numbered node_modules duplicates found.',
    evidence: `Scanned ${dirsToScan.length} directories for pattern /^node_modules\\s+\\d+$/`,
    confidence: 'high',
  });

  // D3: better-sqlite3 native module
  const sqliteProbe = probeNativeModule('better-sqlite3');
  results.push({
    id: 'deps-better-sqlite3',
    label: 'better-sqlite3 Native Module',
    category: 'deps',
    severity: sqliteProbe.loadable ? 'info' : 'warning',
    status: sqliteProbe.loadable ? 'pass' : 'warn',
    summary: sqliteProbe.loadable
      ? `better-sqlite3 is loadable. Resolved: ${sqliteProbe.resolvedPath}`
      : `better-sqlite3 NOT loadable: ${sqliteProbe.error}. Tests that directly instantiate Database will fail if not mocked.`,
    evidence: sqliteProbe.loadable
      ? `require.resolve('better-sqlite3') = ${sqliteProbe.resolvedPath}`
      : `require('better-sqlite3') threw: ${sqliteProbe.error}`,
    confidence: 'high',
  });

  // D4: Core node_modules accessibility
  const coreNm = join(coreRoot, 'node_modules');
  const coreNmAccessible = isAccessible(coreNm);
  results.push({
    id: 'deps-core-node-modules',
    label: 'Core node_modules Accessibility',
    category: 'deps',
    severity: coreNmAccessible ? 'info' : 'warning',
    status: coreNmAccessible ? 'pass' : 'warn',
    summary: coreNmAccessible
      ? 'Core node_modules is accessible'
      : 'Core node_modules is EPERM-blocked.',
    evidence: `statSync("${coreNm}") ${coreNmAccessible ? 'succeeded' : 'threw EPERM'}`,
    confidence: 'high',
  });

  return results;
}
