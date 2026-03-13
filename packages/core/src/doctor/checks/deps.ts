/**
 * Dependency integrity checks — node_modules, native modules, EPERM.
 *
 * Round 14.1: Added instantiation probe for better-sqlite3
 * (resolve + require + instantiate + query) to prove full usability.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
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
 * Full native module probe: resolve → require → instantiate → query.
 * Returns granular results so Doctor can report exactly where it fails.
 */
function probeNativeModule(moduleName: string): {
  resolvable: boolean;
  loadable: boolean;
  instantiable: boolean;
  queryable: boolean;
  resolvedPath: string | null;
  error: string | null;
  failStage: 'resolve' | 'require' | 'instantiate' | 'query' | null;
} {
  let resolvedPath: string | null = null;

  // Stage 1: resolve
  try {
    resolvedPath = require.resolve(moduleName);
  } catch (err) {
    return {
      resolvable: false, loadable: false, instantiable: false, queryable: false,
      resolvedPath: null,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
      failStage: 'resolve',
    };
  }

  // Stage 2: require
  let Database: any;
  try {
    Database = require(moduleName);
  } catch (err) {
    return {
      resolvable: true, loadable: false, instantiable: false, queryable: false,
      resolvedPath,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
      failStage: 'require',
    };
  }

  // Stage 3: instantiate (in-memory)
  let db: any;
  try {
    db = new Database(':memory:');
  } catch (err) {
    return {
      resolvable: true, loadable: true, instantiable: false, queryable: false,
      resolvedPath,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
      failStage: 'instantiate',
    };
  }

  // Stage 4: query
  try {
    db.exec('CREATE TABLE _doctor_probe(x INTEGER)');
    db.prepare('INSERT INTO _doctor_probe VALUES(?)').run(1);
    const row = db.prepare('SELECT x FROM _doctor_probe').get();
    db.close();
    if (!row || (row as any).x !== 1) {
      return {
        resolvable: true, loadable: true, instantiable: true, queryable: false,
        resolvedPath, error: 'Query returned unexpected result',
        failStage: 'query',
      };
    }
  } catch (err) {
    try { db.close(); } catch { /* */ }
    return {
      resolvable: true, loadable: true, instantiable: true, queryable: false,
      resolvedPath,
      error: err instanceof Error ? err.message.split('\n')[0]! : String(err),
      failStage: 'query',
    };
  }

  return {
    resolvable: true, loadable: true, instantiable: true, queryable: true,
    resolvedPath, error: null, failStage: null,
  };
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
    evidenceType: 'fs-scan',
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
    evidenceType: 'fs-scan',
  });

  // D3: better-sqlite3 native module (4-stage probe)
  const sqliteProbe = probeNativeModule('better-sqlite3');

  // Build a detailed status summary
  let sqliteSummary: string;
  let sqliteSeverity: CheckResult['severity'];
  let sqliteStatus: CheckResult['status'];

  if (sqliteProbe.queryable) {
    sqliteSummary = `better-sqlite3 fully healthy: resolve ✅ require ✅ instantiate ✅ query ✅. Path: ${sqliteProbe.resolvedPath}`;
    sqliteSeverity = 'info';
    sqliteStatus = 'pass';
  } else if (sqliteProbe.instantiable) {
    sqliteSummary = `better-sqlite3 partially usable: resolve ✅ require ✅ instantiate ✅ query ❌ (${sqliteProbe.error}). Path: ${sqliteProbe.resolvedPath}`;
    sqliteSeverity = 'warning';
    sqliteStatus = 'warn';
  } else if (sqliteProbe.loadable) {
    sqliteSummary = `better-sqlite3 loadable but NOT instantiable: resolve ✅ require ✅ instantiate ❌ (${sqliteProbe.error}). ABI mismatch or native binding failure likely.`;
    sqliteSeverity = 'blocker';
    sqliteStatus = 'fail';
  } else if (sqliteProbe.resolvable) {
    sqliteSummary = `better-sqlite3 resolved but NOT loadable: resolve ✅ require ❌ (${sqliteProbe.error}). EPERM or ABI mismatch.`;
    sqliteSeverity = 'blocker';
    sqliteStatus = 'fail';
  } else {
    sqliteSummary = `better-sqlite3 NOT resolvable: ${sqliteProbe.error}. Module not installed or path broken.`;
    sqliteSeverity = 'blocker';
    sqliteStatus = 'fail';
  }

  results.push({
    id: 'deps-better-sqlite3',
    label: 'better-sqlite3 Native Module (4-stage probe)',
    category: 'deps',
    severity: sqliteSeverity,
    status: sqliteStatus,
    summary: sqliteSummary,
    evidence: `4-stage probe: resolve=${sqliteProbe.resolvable}, require=${sqliteProbe.loadable}, instantiate=${sqliteProbe.instantiable}, query=${sqliteProbe.queryable}${sqliteProbe.failStage ? ` | failed at: ${sqliteProbe.failStage}` : ''}${sqliteProbe.resolvedPath ? ` | path: ${sqliteProbe.resolvedPath}` : ''}`,
    confidence: 'high',
    evidenceType: 'runtime-probe',
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
    evidenceType: 'fs-scan',
  });

  return results;
}
