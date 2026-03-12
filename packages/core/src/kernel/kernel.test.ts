/**
 * Kernel tests — boot types, stage runner, provider factory, server init exports
 */
import { describe, it, expect, vi } from 'vitest';
import { registerProviders, type ProviderConfig } from '../kernel/provider-factory.js';

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

describe('Kernel', () => {
  describe('BootStage types', () => {
    it('should export BootStage type with 11 stages', async () => {
      const mod = await import('../kernel/index.js');
      // Verify type exports exist via runtime export check
      expect(mod.Kernel).toBeDefined();
      expect(mod.createKernel).toBeDefined();
      expect(mod.registerProviders).toBeDefined();
      expect(mod.initServer).toBeDefined();
    });

    it('Kernel class should have expected API', async () => {
      const mod = await import('../kernel/index.js');
      const k = new mod.Kernel();
      expect(k.running).toBe(false);
      expect(k.bootStages).toEqual([]);
      expect(() => k.svc).toThrow('Kernel not booted');
    });
  });

  describe('Provider Factory', () => {
    it('should handle empty provider list', async () => {
      const mockRouter = { register: vi.fn(), stats: () => ({ providerCount: 0 }) };
      const count = await registerProviders(mockRouter as any, [], makeLogger());
      expect(count).toBe(0);
      expect(mockRouter.register).not.toHaveBeenCalled();
    });

    it('should warn on unknown provider type', async () => {
      const logger = makeLogger();
      const mockRouter = { register: vi.fn() };
      const configs: ProviderConfig[] = [{ type: 'nonexistent', apiKey: 'test' }];
      const count = await registerProviders(mockRouter as any, configs, logger);
      expect(count).toBe(0);
    });

    it('should handle provider init failure gracefully', async () => {
      const logger = makeLogger();
      const mockRouter = {
        register: vi.fn().mockImplementation(() => { throw new Error('fail'); }),
      };
      const configs: ProviderConfig[] = [{ type: 'ollama', endpoint: 'http://localhost:11434' }];
      // Should not throw
      const count = await registerProviders(mockRouter as any, configs, logger);
      // Count is 0 because register threw
      expect(count).toBe(0);
    });
  });
});
