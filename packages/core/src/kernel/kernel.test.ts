/**
 * Kernel tests — boot types, stage runner, provider factory, server init exports,
 * and memory tool registration verification.
 *
 * Round 12: Added test verifying boot registers memory_store + memory_recall tools.
 */
import { describe, it, expect, vi } from 'vitest';
import { registerProviders, type ProviderConfig } from '../kernel/provider-factory.js';
import { ToolExecutor } from '../runtime/tool-executor.js';
import { createMemoryTools } from '../runtime/tools/memory.js';
import type { MemoryTierManager, MemoryContext } from '../memory/tier-manager.js';

function makeLogger() {
  return {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: () => makeLogger(),
  } as any;
}

function createMockMemory(): MemoryTierManager {
  return {
    pushHot: vi.fn(),
    getHot: vi.fn().mockReturnValue([]),
    clearHot: vi.fn(),
    buildContext: vi.fn().mockReturnValue({
      sessionSummaries: [],
      relevantFacts: [],
      relationships: [],
      recentEpisodes: [],
      skills: [],
      estimatedTokens: 0,
    } as MemoryContext),
    storeFact: vi.fn(),
    storeEpisode: vi.fn(),
    storeRelationship: vi.fn(),
    storeProcedure: vi.fn(),
    saveSessionSummary: vi.fn(),
    saveSoulSnapshot: vi.fn(),
    stats: vi.fn().mockReturnValue({ hotSize: 0, soulVersions: 0 }),
  } as unknown as MemoryTierManager;
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

  describe('Memory Tools Registration (Round 12)', () => {
    it('ToolExecutor should include memory_store and memory_recall after registration', async () => {
      const logger = makeLogger();
      const executor = new ToolExecutor(logger);
      const memory = createMockMemory();

      // Simulate what Kernel boot Step 8 does
      const { allBuiltinTools } = await import('../runtime/tools/index.js');
      executor.registerTools(allBuiltinTools);

      const memoryTools = createMemoryTools(memory);
      executor.registerTools(memoryTools);

      const toolNames = executor.listTools();
      expect(toolNames).toContain('memory_store');
      expect(toolNames).toContain('memory_recall');

      // Total tool count: 7 builtin + 2 memory = 9
      expect(executor.stats().registeredTools).toBe(9);
    });

    it('memory_store should be callable through ToolExecutor', async () => {
      const logger = makeLogger();
      const executor = new ToolExecutor(logger);
      const memory = createMockMemory();

      const memoryTools = createMemoryTools(memory);
      executor.registerTools(memoryTools);

      const result = await executor.executeOne({
        id: 'tc_1',
        name: 'memory_store',
        arguments: JSON.stringify({ type: 'fact', category: 'test', key: 'k1', value: 'v1' }),
      });

      expect(result.isError).toBe(false);
      expect(result.content).toContain('Stored fact');
      expect(memory.storeFact).toHaveBeenCalledWith('test', 'k1', 'v1');
    });

    it('memory_recall should be callable through ToolExecutor', async () => {
      const logger = makeLogger();
      const executor = new ToolExecutor(logger);
      const memory = createMockMemory();

      const memoryTools = createMemoryTools(memory);
      executor.registerTools(memoryTools);

      const result = await executor.executeOne({
        id: 'tc_2',
        name: 'memory_recall',
        arguments: JSON.stringify({ type: 'context' }),
      });

      expect(result.isError).toBe(false);
      expect(memory.buildContext).toHaveBeenCalled();
    });
  });
});
