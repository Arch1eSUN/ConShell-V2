/**
 * Doctor subsystem tests — Round 14.1
 *
 * Validates that each check category runs and produces structured results
 * with proper evidenceType provenance. Tests verify structural correctness,
 * not that every check passes — some checks may report warnings in
 * environments with known issues.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { checkEnvironment } from './checks/env.js';
import { checkDependencies } from './checks/deps.js';
import { checkTestBoundary } from './checks/tests.js';
import { checkBuildReadiness } from './checks/build.js';
import { checkIntegrations } from './checks/integrations.js';
import { runDiagnostics, formatReport } from './index.js';

// Use the actual project paths
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const CORE_ROOT = join(__dirname, '..', '..');

describe('Doctor', () => {
  describe('Environment checks', () => {
    it('should return array of CheckResult objects with evidenceType', () => {
      const results = checkEnvironment(PROJECT_ROOT);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.id).toBeTruthy();
        expect(r.label).toBeTruthy();
        expect(r.category).toBe('env');
        expect(['info', 'warning', 'blocker']).toContain(r.severity);
        expect(['pass', 'fail', 'warn', 'unknown']).toContain(r.status);
        expect(r.summary).toBeTruthy();
        expect(r.evidence).toBeTruthy();
        expect(['high', 'medium', 'low']).toContain(r.confidence);
        // Round 14.1: evidenceType provenance required
        expect(['code-inspection', 'fs-scan', 'runtime-probe', 'test-execution', 'network-observation', 'historical-claim']).toContain(r.evidenceType);
      }
    });

    it('should detect Node version with runtime-probe provenance', () => {
      const results = checkEnvironment(PROJECT_ROOT);
      const nodeCheck = results.find(r => r.id === 'env-node-version');
      expect(nodeCheck).toBeTruthy();
      expect(nodeCheck!.summary).toContain(process.version);
      expect(nodeCheck!.evidenceType).toBe('runtime-probe');
    });

    it('should check workspace root validity', () => {
      const results = checkEnvironment(PROJECT_ROOT);
      const rootCheck = results.find(r => r.id === 'env-workspace-root');
      expect(rootCheck).toBeTruthy();
      expect(rootCheck!.evidenceType).toBe('fs-scan');
    });
  });

  describe('Dependency checks', () => {
    it('should return array of CheckResult objects with evidenceType', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.category).toBe('deps');
        expect(r.evidence).toBeTruthy();
        expect(r.evidenceType).toBeTruthy();
      }
    });

    it('should check for numbered node_modules duplicates with fs-scan provenance', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      const dupCheck = results.find(r => r.id === 'deps-numbered-duplicates');
      expect(dupCheck).toBeTruthy();
      expect(dupCheck!.confidence).toBe('high');
      expect(dupCheck!.evidenceType).toBe('fs-scan');
    });

    it('should probe better-sqlite3 with 4-stage pipeline and runtime-probe provenance', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      const sqliteCheck = results.find(r => r.id === 'deps-better-sqlite3');
      expect(sqliteCheck).toBeTruthy();
      expect(sqliteCheck!.evidenceType).toBe('runtime-probe');
      // The summary should describe the 4-stage result
      expect(sqliteCheck!.summary).toMatch(/resolve|require|instantiate|query/);
    });
  });

  describe('Test boundary checks', () => {
    it('should find vitest config', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const configCheck = results.find(r => r.id === 'tests-vitest-config');
      expect(configCheck).toBeTruthy();
      expect(configCheck!.status).toBe('pass');
    });

    it('should report static file inventory (not execution truth)', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const inventoryCheck = results.find(r => r.id === 'tests-file-inventory');
      expect(inventoryCheck).toBeTruthy();
      expect(inventoryCheck!.summary).toContain('Static inventory');
      expect(inventoryCheck!.summary).toContain('NOT vitest execution truth');
      expect(inventoryCheck!.evidenceType).toBe('fs-scan');
    });

    it('should include execution note that Doctor does NOT run vitest', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const execNote = results.find(r => r.id === 'tests-execution-note');
      expect(execNote).toBeTruthy();
      expect(execNote!.status).toBe('unknown');
      expect(execNote!.summary).toContain('Doctor does NOT execute vitest');
      expect(execNote!.confidence).toBe('low');
    });

    it('should check for root vitest guard', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const guardCheck = results.find(r => r.id === 'tests-root-guard');
      expect(guardCheck).toBeTruthy();
    });
  });

  describe('Build readiness checks', () => {
    it('should find tsconfig with fs-scan provenance', () => {
      const results = checkBuildReadiness(CORE_ROOT);
      const tscCheck = results.find(r => r.id === 'build-tsconfig');
      expect(tscCheck).toBeTruthy();
      expect(tscCheck!.status).toBe('pass');
      expect(tscCheck!.evidenceType).toBe('fs-scan');
    });
  });

  describe('Integration checks', () => {
    it('should split EvoMap into implemented vs observed surfaces', async () => {
      // Mock fetch for non-network test environments
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }) as any;

      try {
        const results = await checkIntegrations();

        // Should have separate checks for implemented and observed
        const implCheck = results.find(r => r.id === 'integ-evomap-implemented');
        expect(implCheck).toBeTruthy();
        expect(implCheck!.summary).toContain('gep.hello');
        expect(implCheck!.summary).toContain('gep.publish');
        expect(implCheck!.evidenceType).toBe('code-inspection');
        expect(implCheck!.confidence).toBe('high');

        const obsCheck = results.find(r => r.id === 'integ-evomap-observed');
        expect(obsCheck).toBeTruthy();
        expect(obsCheck!.summary).toContain('/a2a/work/available');
        expect(obsCheck!.summary).toContain('/a2a/work/claim');
        expect(obsCheck!.evidenceType).toBe('historical-claim');
        expect(obsCheck!.status).toBe('unknown');

        // Old monolithic contract check should NOT exist
        const oldContract = results.find(r => r.id === 'integ-evomap-contract');
        expect(oldContract).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should tag network probes with network-observation provenance', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }) as any;

      try {
        const results = await checkIntegrations();
        const reachCheck = results.find(r => r.id === 'integ-evomap-reachable');
        expect(reachCheck!.evidenceType).toBe('network-observation');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('runDiagnostics', () => {
    it('should produce a complete IntegrityReport with readiness gate', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }) as any;

      try {
        const report = await runDiagnostics(PROJECT_ROOT, CORE_ROOT);

        expect(report.timestamp).toBeTruthy();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(report.health);
        expect(report.checks.length).toBeGreaterThan(0);
        expect(report.counts).toBeDefined();
        expect(report.commands.test).toContain('vitest');
        expect(report.commands.typecheck).toContain('tsc');
        expect(report.commands.doNotUse.length).toBeGreaterThan(0);

        // Round 14.1: ReadinessGate
        expect(report.readiness).toBeDefined();
        expect(['ready', 'conditionally-ready', 'not-ready']).toContain(report.readiness.verdict);
        expect(report.readiness.criteria.length).toBeGreaterThan(0);
        expect(report.readiness.rationale).toBeTruthy();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('formatReport', () => {
    it('should produce human-readable output with provenance and readiness gate', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }) as any;

      try {
        const report = await runDiagnostics(PROJECT_ROOT, CORE_ROOT);
        const text = formatReport(report);

        expect(text).toContain('Integrity Report');
        expect(text).toContain('STANDARD COMMANDS');
        expect(text).toContain('DO NOT USE');
        expect(text).toContain('vitest');
        // Round 14.1: provenance and readiness
        expect(text).toContain('Provenance:');
        expect(text).toContain('READINESS GATE');
        expect(text).toContain('Verdict:');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
