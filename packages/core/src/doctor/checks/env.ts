/**
 * Environment checks — Node version, package manager, workspace root.
 */
import { existsSync, readFileSync } from 'node:fs';
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

  // E2: Node ABI (informational — probe determines actual native compat)
  const abi = process.versions.modules;
  results.push({
    id: 'env-node-abi',
    label: 'Node.js ABI Version',
    category: 'env',
    severity: 'info',
    status: 'pass',
    summary: `ABI ${abi}. Native modules must be compiled against this ABI to load. Actual usability is determined by the deps probe, not this number alone.`,
    evidence: `process.versions.modules = ${abi}`,
    confidence: 'high',
    evidenceType: 'runtime-probe',
  });

  // E3: .nvmrc presence
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

  // E3b: Runtime pin alignment (.nvmrc content vs process.version)
  const pinFile = nvmrcExists
    ? join(projectRoot, '.nvmrc')
    : nodeVersionExists
      ? join(projectRoot, '.node-version')
      : null;

  if (pinFile) {
    try {
      const pinnedVersion = readFileSync(pinFile, 'utf-8').trim();
      const currentVersion = process.version;
      // Normalize: .nvmrc may have "v" prefix or not
      const normalizedPinned = pinnedVersion.startsWith('v')
        ? pinnedVersion
        : `v${pinnedVersion}`;
      const aligned = normalizedPinned === currentVersion;
      results.push({
        id: 'env-runtime-pin-alignment',
        label: 'Runtime Pin Alignment',
        category: 'env',
        severity: aligned ? 'info' : 'blocker',
        status: aligned ? 'pass' : 'fail',
        summary: aligned
          ? `Current runtime ${currentVersion} matches pinned ${normalizedPinned}.`
          : `MISMATCH: Current runtime ${currentVersion} ≠ pinned ${normalizedPinned}. Run \`nvm use\` or switch Node to match the project pin.`,
        evidence: `Pinned: ${normalizedPinned} (from ${pinFile}), Current: ${currentVersion}`,
        confidence: 'high',
        evidenceType: 'runtime-probe',
      });
    } catch {
      results.push({
        id: 'env-runtime-pin-alignment',
        label: 'Runtime Pin Alignment',
        category: 'env',
        severity: 'warning',
        status: 'warn',
        summary: 'Could not read pin file to verify runtime alignment.',
        evidence: `Failed to read ${pinFile}`,
        confidence: 'low',
        evidenceType: 'fs-scan',
      });
    }
  } else {
    results.push({
      id: 'env-runtime-pin-alignment',
      label: 'Runtime Pin Alignment',
      category: 'env',
      severity: 'warning',
      status: 'warn',
      summary: 'No .nvmrc or .node-version file — cannot verify runtime alignment.',
      evidence: 'No pin file exists',
      confidence: 'low',
      evidenceType: 'fs-scan',
    });
  }

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
