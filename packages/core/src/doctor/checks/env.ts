/**
 * Environment checks — Node version, package manager, workspace root.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../index.js';

export function checkEnvironment(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  // E1: Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace('v', ''), 10);
  results.push({
    id: 'env-node-version',
    label: 'Node.js Version',
    category: 'env',
    severity: majorVersion >= 20 ? 'info' : 'blocker',
    status: majorVersion >= 20 ? 'pass' : 'fail',
    summary: `Node ${nodeVersion} (arch: ${process.arch}, platform: ${process.platform}). Engine spec requires >=20.0.0.`,
    evidence: `process.version = ${nodeVersion}`,
    confidence: 'high',
    evidenceType: 'runtime-probe',
  });

  // E2: .nvmrc presence
  const nvmrcExists = existsSync(join(projectRoot, '.nvmrc'));
  const nodeVersionExists = existsSync(join(projectRoot, '.node-version'));
  results.push({
    id: 'env-nvmrc',
    label: 'Node Version Pinning',
    category: 'env',
    severity: nvmrcExists || nodeVersionExists ? 'info' : 'warning',
    status: nvmrcExists || nodeVersionExists ? 'pass' : 'warn',
    summary: nvmrcExists
      ? '.nvmrc exists — Node version is pinned'
      : nodeVersionExists
        ? '.node-version exists — Node version is pinned'
        : 'No .nvmrc or .node-version file. Node version drift between environments is possible.',
    evidence: `existsSync(.nvmrc) = ${nvmrcExists}, existsSync(.node-version) = ${nodeVersionExists}`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  // E3: workspace root validity
  const packageJsonExists = existsSync(join(projectRoot, 'package.json'));
  const pnpmWorkspaceExists = existsSync(join(projectRoot, 'pnpm-workspace.yaml'));
  results.push({
    id: 'env-workspace-root',
    label: 'Workspace Root Validity',
    category: 'env',
    severity: packageJsonExists && pnpmWorkspaceExists ? 'info' : 'blocker',
    status: packageJsonExists && pnpmWorkspaceExists ? 'pass' : 'fail',
    summary: `package.json: ${packageJsonExists ? 'present' : 'MISSING'}, pnpm-workspace.yaml: ${pnpmWorkspaceExists ? 'present' : 'MISSING'}`,
    evidence: `existsSync(package.json) = ${packageJsonExists}, existsSync(pnpm-workspace.yaml) = ${pnpmWorkspaceExists}`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  // E4: Core config files
  const constitutionExists = existsSync(join(projectRoot, 'CONSTITUTION.md'));
  const tsconfigBaseExists = existsSync(join(projectRoot, 'tsconfig.base.json'));
  results.push({
    id: 'env-config-files',
    label: 'Core Config Files',
    category: 'env',
    severity: constitutionExists && tsconfigBaseExists ? 'info' : 'warning',
    status: constitutionExists && tsconfigBaseExists ? 'pass' : 'warn',
    summary: `CONSTITUTION.md: ${constitutionExists ? '✓' : '✗'}, tsconfig.base.json: ${tsconfigBaseExists ? '✓' : '✗'}`,
    evidence: `File existence checks on project root`,
    confidence: 'high',
    evidenceType: 'fs-scan',
  });

  return results;
}
