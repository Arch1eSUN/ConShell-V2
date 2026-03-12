/**
 * Plugin Sandbox Tests
 *
 * Tests VM isolation, permission gating, code validation, 
 * timeout enforcement, and security boundaries.
 */
import { describe, it, expect, vi } from 'vitest';
import { PluginSandbox } from '../plugins/sandbox.js';

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

describe('PluginSandbox', () => {
  describe('runInVM', () => {
    it('should execute simple code', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('1 + 2');
      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should capture console.log output', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('console.log("hello"); console.log("world"); 42');
      expect(result.success).toBe(true);
      expect(result.logs).toEqual(['hello', 'world']);
      expect(result.result).toBe(42);
    });

    it('should enforce execution timeout', async () => {
      const sandbox = new PluginSandbox({ timeout: 100, logger: makeLogger() });
      const result = await sandbox.runInVM('while(true) {}');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should prevent access to process', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('process.exit(1)');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should prevent require()', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM("require('fs')");
      expect(result.success).toBe(false);
    });

    it('should allow JSON operations', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('JSON.stringify({a:1})');
      expect(result.success).toBe(true);
      expect(result.result).toBe('{"a":1}');
    });

    it('should prevent eval() via codeGeneration option', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM("eval('1+1')");
      expect(result.success).toBe(false);
    });

    it('should support extra context injection', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('myVar * 2', { myVar: 21 });
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });

    it('should handle syntax errors gracefully', async () => {
      const sandbox = new PluginSandbox({ logger: makeLogger() });
      const result = await sandbox.runInVM('function(');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Permission gating', () => {
    it('should not inject fetch without net:http permission', async () => {
      const sandbox = new PluginSandbox({ permissions: [], logger: makeLogger() });
      const result = await sandbox.runInVM('typeof fetch');
      expect(result.result).toBe('undefined');
    });

    it('should inject fetch with net:http permission', async () => {
      const sandbox = new PluginSandbox({ permissions: ['net:http'], logger: makeLogger() });
      const result = await sandbox.runInVM('typeof fetch');
      expect(result.result).toBe('function');
    });

    it('should not inject Buffer without fs permission', async () => {
      const sandbox = new PluginSandbox({ permissions: [], logger: makeLogger() });
      const result = await sandbox.runInVM('typeof Buffer');
      expect(result.result).toBe('undefined');
    });

    it('should inject Buffer with fs:read permission', async () => {
      const sandbox = new PluginSandbox({ permissions: ['fs:read'], logger: makeLogger() });
      const result = await sandbox.runInVM('typeof Buffer');
      expect(result.result).toBe('function');
    });
  });

  describe('validateCode', () => {
    it('should flag child_process import', () => {
      const result = PluginSandbox.validateCode("require('child_process')");
      expect(result.safe).toBe(false);
      expect(result.warnings).toContain('Imports child_process');
    });

    it('should flag fs import', () => {
      const result = PluginSandbox.validateCode("require('fs')");
      expect(result.safe).toBe(false);
    });

    it('should flag eval usage', () => {
      const result = PluginSandbox.validateCode("eval('code')");
      expect(result.safe).toBe(false);
    });

    it('should flag process.exit', () => {
      const result = PluginSandbox.validateCode('process.exit(1)');
      expect(result.safe).toBe(false);
    });

    it('should pass safe code', () => {
      const result = PluginSandbox.validateCode('const x = 1 + 2; console.log(x);');
      expect(result.safe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should flag dynamic import', () => {
      const result = PluginSandbox.validateCode("import('fs')");
      expect(result.safe).toBe(false);
    });

    it('should flag Function constructor', () => {
      const result = PluginSandbox.validateCode("new Function('return 1')");
      expect(result.safe).toBe(false);
    });
  });
});
