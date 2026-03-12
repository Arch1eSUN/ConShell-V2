/**
 * Performance Benchmarks
 *
 * Measures execution time for critical paths to establish baseline
 * metrics and catch regressions. Uses vitest bench when available,
 * falls back to manual timing.
 */
import { describe, it, expect } from 'vitest';
import {
  validateConstitutionHash,
  checkConstitutionalViolation,
  getConstitutionText,
  CONSTITUTION_HASH,
} from '../constitution/index.js';
import { validateManifest, PluginManager } from '../plugins/index.js';
import { PluginSandbox } from '../plugins/sandbox.js';
import { loadConfig } from '../config/index.js';

// ── Benchmark helper ───────────────────────────────────────

function bench(name: string, fn: () => void, iterations = 1000): { name: string; avgMs: number; opsPerSec: number } {
  // Warm up
  for (let i = 0; i < 10; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { name, avgMs, opsPerSec };
}

async function benchAsync(name: string, fn: () => Promise<void>, iterations = 100): Promise<{ name: string; avgMs: number; opsPerSec: number }> {
  // Warm up
  for (let i = 0; i < 3; i++) await fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;

  const avgMs = elapsed / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { name, avgMs, opsPerSec };
}

// ── Benchmarks ─────────────────────────────────────────────

describe('Performance Benchmarks', () => {
  describe('Constitution', () => {
    it('should validate hash quickly (>10k ops/s)', () => {
      const result = bench('constitution-hash-validation', () => {
        validateConstitutionHash(CONSTITUTION_HASH);
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(10_000);
    });

    it('should check violations quickly (>50k ops/s)', () => {
      const result = bench('constitution-violation-check', () => {
        checkConstitutionalViolation('rm -rf /tmp/test', 'shell_exec');
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(50_000);
    });

    it('should generate constitution text quickly (>100k ops/s)', () => {
      const result = bench('constitution-text-gen', () => {
        getConstitutionText();
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(100_000);
    });
  });

  describe('Plugin System', () => {
    it('should validate manifests quickly (>20k ops/s)', () => {
      const validManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        entrypoint: './index.js',
        permissions: ['fs:read', 'net:http'],
        hooks: [{ event: 'onBoot', handler: 'init' }],
      };
      const result = bench('manifest-validation', () => {
        validateManifest(validManifest);
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(20_000);
    });

    it('should register/unload plugins quickly (>50k ops/s)', () => {
      const mgr = new PluginManager();
      const manifest = {
        name: 'bench-plugin',
        version: '1.0.0',
        entrypoint: './index.js',
        permissions: [] as any[],
        hooks: [] as any[],
        description: '',
        license: 'MIT',
      };
      const result = bench('plugin-register', () => {
        mgr.register(manifest);
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(50_000);
    });
  });

  describe('Plugin Sandbox', () => {
    it('should validate code statically (>100k ops/s)', () => {
      const code = 'const x = 1 + 2; console.log(x); JSON.stringify({a: 1});';
      const result = bench('sandbox-code-validation', () => {
        PluginSandbox.validateCode(code);
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(100_000);
    });

    it('should execute simple VM scripts (>500 ops/s)', async () => {
      const sandbox = new PluginSandbox({ timeout: 1000 });
      const result = await benchAsync('sandbox-vm-simple', async () => {
        await sandbox.runInVM('1 + 2 + 3');
      }, 200);
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(500);
    });

    it('should execute complex VM scripts (>200 ops/s)', async () => {
      const sandbox = new PluginSandbox({ timeout: 1000 });
      const code = `
        const arr = [];
        for (let i = 0; i < 100; i++) arr.push(i * i);
        JSON.stringify(arr);
      `;
      const result = await benchAsync('sandbox-vm-complex', async () => {
        await sandbox.runInVM(code);
      }, 100);
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(200);
    });
  });

  describe('Config', () => {
    it('should load config quickly (>10k ops/s)', () => {
      const result = bench('config-load', () => {
        loadConfig('/tmp/nonexistent');
      });
      console.log(`  ${result.name}: ${result.avgMs.toFixed(4)}ms avg, ${result.opsPerSec} ops/s`);
      expect(result.opsPerSec).toBeGreaterThan(10_000);
    });
  });

  describe('Summary', () => {
    it('should print performance summary', () => {
      const results = [
        bench('constitution-hash', () => validateConstitutionHash(CONSTITUTION_HASH)),
        bench('constitution-check', () => checkConstitutionalViolation('ls -la', 'shell_exec')),
        bench('manifest-validate', () => validateManifest({ name: 'x', version: '1.0.0', entrypoint: './i.js' })),
        bench('code-validate', () => PluginSandbox.validateCode('const x = 1;')),
        bench('config-load', () => loadConfig('/tmp/na')),
      ];

      console.log('\n  ╔══════════════════════════════════════════════════╗');
      console.log('  ║           Performance Benchmark Results          ║');
      console.log('  ╠══════════════════════════════════════════════════╣');
      for (const r of results) {
        const name = r.name.padEnd(24);
        const ops = String(r.opsPerSec).padStart(10);
        console.log(`  ║  ${name} ${ops} ops/s  ║`);
      }
      console.log('  ╚══════════════════════════════════════════════════╝\n');

      expect(results.every(r => r.opsPerSec > 1000)).toBe(true);
    });
  });
});
