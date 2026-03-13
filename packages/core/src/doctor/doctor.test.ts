/**
 * Doctor subsystem tests
 *
 * Validates that each check category runs and produces structured results,
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
    it('should return array of CheckResult objects', () => {
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
      }
    });

    it('should detect Node version', () => {
      const results = checkEnvironment(PROJECT_ROOT);
      const nodeCheck = results.find(r => r.id === 'env-node-version');
      expect(nodeCheck).toBeTruthy();
      expect(nodeCheck!.summary).toContain(process.version);
    });

    it('should check workspace root validity', () => {
      const results = checkEnvironment(PROJECT_ROOT);
      const rootCheck = results.find(r => r.id === 'env-workspace-root');
      expect(rootCheck).toBeTruthy();
    });
  });

  describe('Dependency checks', () => {
    it('should return array of CheckResult objects', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.category).toBe('deps');
        expect(r.evidence).toBeTruthy();
      }
    });

    it('should check for numbered node_modules duplicates', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      const dupCheck = results.find(r => r.id === 'deps-numbered-duplicates');
      expect(dupCheck).toBeTruthy();
      expect(dupCheck!.confidence).toBe('high');
    });

    it('should probe better-sqlite3', () => {
      const results = checkDependencies(PROJECT_ROOT, CORE_ROOT);
      const sqliteCheck = results.find(r => r.id === 'deps-better-sqlite3');
      expect(sqliteCheck).toBeTruthy();
      // Result could be pass or warn depending on environment
      expect(['pass', 'warn']).toContain(sqliteCheck!.status);
    });
  });

  describe('Test boundary checks', () => {
    it('should find vitest config', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const configCheck = results.find(r => r.id === 'tests-vitest-config');
      expect(configCheck).toBeTruthy();
      expect(configCheck!.status).toBe('pass');
    });

    it('should count test files', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const countCheck = results.find(r => r.id === 'tests-file-count');
      expect(countCheck).toBeTruthy();
      expect(countCheck!.summary).toContain('test files');
    });

    it('should check for root vitest guard', () => {
      const results = checkTestBoundary(CORE_ROOT);
      const guardCheck = results.find(r => r.id === 'tests-root-guard');
      expect(guardCheck).toBeTruthy();
    });
  });

  describe('Build readiness checks', () => {
    it('should find tsconfig', () => {
      const results = checkBuildReadiness(CORE_ROOT);
      const tscCheck = results.find(r => r.id === 'build-tsconfig');
      expect(tscCheck).toBeTruthy();
      expect(tscCheck!.status).toBe('pass');
    });
  });

  describe('Integration checks', () => {
    it('should check EvoMap contract status', async () => {
      // Mock fetch for non-network test environments
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }) as any;

      try {
        const results = await checkIntegrations();
        expect(results.length).toBeGreaterThan(0);
        const contractCheck = results.find(r => r.id === 'integ-evomap-contract');
        expect(contractCheck).toBeTruthy();
        expect(contractCheck!.summary).toContain('gep.hello');
        expect(contractCheck!.summary).toContain('gep.publish');
        expect(contractCheck!.confidence).toBe('high');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('runDiagnostics', () => {
    it('should produce a complete IntegrityReport', async () => {
      // Mock fetch for integration checks
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
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('formatReport', () => {
    it('should produce human-readable output', async () => {
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
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
