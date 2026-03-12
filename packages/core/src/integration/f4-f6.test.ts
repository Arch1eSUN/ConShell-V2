/**
 * F6 Test Suite — ToolRegistry + PolicyEngine + InferenceRouter + API Routes
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, createBuiltinTools } from '../tools/registry.js';
import { PolicyEngine } from '../policy/index.js';
import { InferenceRouter } from '../inference/index.js';
import { createApiRoutes } from '../api/routes.js';
import type { Logger } from '../types/common.js';

// ── Test Logger ──────────────────────────────────────────────────────

function createTestLogger(): Logger {
  const noop = () => {};
  return {
    info: noop, debug: noop, warn: noop, error: noop,
    child: () => createTestLogger(),
  } as unknown as Logger;
}

// ══════════════════════════════════════════════════════════════════════
// ToolRegistry Tests
// ══════════════════════════════════════════════════════════════════════

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry(createTestLogger());
  });

  it('should register builtin tools', () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);

    expect(registry.count()).toBeGreaterThanOrEqual(50);
  });

  it('should have 13 categories', () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);
    const stats = registry.stats();
    const categories = Object.keys(stats.byCategory);

    expect(categories.length).toBe(13);
    expect(categories).toContain('filesystem');
    expect(categories).toContain('shell');
    expect(categories).toContain('memory');
    expect(categories).toContain('web');
    expect(categories).toContain('wallet');
    expect(categories).toContain('identity');
    expect(categories).toContain('social');
    expect(categories).toContain('self_mod');
    expect(categories).toContain('replication');
    expect(categories).toContain('mcp');
    expect(categories).toContain('skills');
    expect(categories).toContain('system');
    expect(categories).toContain('inference');
  });

  it('should list MCP exposed tools', () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);
    const mcpTools = registry.listMcpExposed();

    expect(mcpTools.length).toBeGreaterThan(20);
    for (const tool of mcpTools) {
      expect(tool.mcpExposed).toBe(true);
    }
  });

  it('should list tools by category', () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);
    const fsTools = registry.listByCategory('filesystem');

    expect(fsTools.length).toBeGreaterThanOrEqual(5);
    for (const tool of fsTools) {
      expect(tool.category).toBe('filesystem');
    }
  });

  it('should execute a tool', async () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);

    const result = await registry.execute('agent_status', {}, {
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('allow');
    expect(result.output).toContain('running');
  });

  it('should throw for unknown tool', async () => {
    await expect(
      registry.execute('nonexistent', {}, {
        securityLevel: 'autonomous',
        dailyBudgetCents: 10000,
        dailySpentCents: 0,
        constitutionAccepted: true,
      })
    ).rejects.toThrow('Tool not found');
  });

  it('should track stats', async () => {
    const tools = createBuiltinTools();
    registry.registerAll(tools);

    await registry.execute('agent_status', {}, {
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    const stats = registry.stats();
    expect(stats.totalCalls).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// PolicyEngine Tests
// ══════════════════════════════════════════════════════════════════════

describe('PolicyEngine (24-rule, 6-category)', () => {
  let policy: PolicyEngine;

  beforeEach(() => {
    policy = new PolicyEngine(createTestLogger());
  });

  it('should deny without constitution', () => {
    const result = policy.evaluate({
      tool: 'read_file',
      action: 'filesystem',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: false,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('constitution-required');
    expect(result.category).toBe('constitution');
  });

  it('should deny self-harm tools', () => {
    const result = policy.evaluate({
      tool: 'delete_self',
      action: 'system',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('no-self-harm');
  });

  it('should deny key disclosure', () => {
    const result = policy.evaluate({
      tool: 'export_private_key',
      action: 'wallet',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('no-key-disclosure');
  });

  it('should deny when budget exceeded', () => {
    const result = policy.evaluate({
      tool: 'chat_external',
      action: 'inference',
      costCents: 100,
      securityLevel: 'autonomous',
      dailyBudgetCents: 1000,
      dailySpentCents: 950,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('budget-exceeded');
    expect(result.category).toBe('financial');
  });

  it('should escalate for large single transactions', () => {
    const result = policy.evaluate({
      tool: 'send_usdc',
      action: 'wallet',
      costCents: 6000,
      securityLevel: 'autonomous',
      dailyBudgetCents: 50000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      singleTxMaxCents: 5000,
    });

    expect(result.decision).toBe('escalate');
    expect(result.rule).toBe('single-tx-limit');
  });

  it('should deny protected path access', () => {
    const result = policy.evaluate({
      tool: 'write_file',
      action: 'filesystem',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      targetPath: '/etc/passwd',
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('protected-paths');
    expect(result.category).toBe('security');
  });

  it('should block network in sandbox', () => {
    const result = policy.evaluate({
      tool: 'fetch_url',
      action: 'web',
      securityLevel: 'sandbox',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('sandbox-network-block');
  });

  it('should deny dangerous tools from external callers', () => {
    const result = policy.evaluate({
      tool: 'exec_command',
      action: 'shell',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      callerAuthority: 'external',
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('external-deny-dangerous');
    expect(result.category).toBe('authority');
  });

  it('should limit max children', () => {
    const result = policy.evaluate({
      tool: 'spawn_child',
      action: 'replication',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      childCount: 5,
      maxChildren: 5,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('max-children-limit');
    expect(result.category).toBe('replication');
  });

  it('should rate-limit self-modification', () => {
    const result = policy.evaluate({
      tool: 'edit_own_file',
      action: 'self_mod',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      selfModCountToday: 10,
      maxSelfModPerDay: 10,
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('selfmod-rate-limit');
    expect(result.category).toBe('selfmod');
  });

  it('should deny self-mod on core directories', () => {
    const result = policy.evaluate({
      tool: 'edit_own_file',
      action: 'self_mod',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      selfModCountToday: 0,
      targetPath: 'src/policy/index.ts',
    });

    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('selfmod-whitelist');
  });

  it('should allow safe tools with constitution accepted', () => {
    const result = policy.evaluate({
      tool: 'read_file',
      action: 'filesystem',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    expect(result.decision).toBe('allow');
    expect(result.rule).toBe('default-allow');
  });

  it('should track evaluation stats', () => {
    policy.evaluate({
      tool: 'read_file',
      action: 'filesystem',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    policy.evaluate({
      tool: 'delete_self',
      action: 'system',
      securityLevel: 'autonomous',
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
    });

    const stats = policy.stats();
    expect(stats.evaluations).toBe(2);
    expect(stats.denies).toBe(1);
    expect(stats.ruleCount).toBeGreaterThanOrEqual(20);
  });

  it('should list all rules', () => {
    const rules = policy.listRules();
    expect(rules.length).toBeGreaterThanOrEqual(20);

    const categories = [...new Set(rules.map(r => r.category))];
    expect(categories).toContain('constitution');
    expect(categories).toContain('financial');
    expect(categories).toContain('security');
    expect(categories).toContain('authority');
    expect(categories).toContain('replication');
    expect(categories).toContain('selfmod');
  });
});

// ══════════════════════════════════════════════════════════════════════
// InferenceRouter Tests
// ══════════════════════════════════════════════════════════════════════

describe('InferenceRouter (SurvivalTier)', () => {
  let router: InferenceRouter;

  // Helper: create a mock provider that conforms to actual InferenceProvider interface
  function mockProvider(id: string, response: string): any {
    return {
      id,
      name: id,
      async *chat() {
        yield { type: 'text' as const, text: response };
        yield { type: 'usage' as const, usage: { inputTokens: 10, outputTokens: 5, cost: 1 as any } };
      },
      listModels: async () => ['test-model'],
      estimateCost: () => 0 as any,
    };
  }

  beforeEach(() => {
    router = new InferenceRouter(createTestLogger());
  });

  it('should register providers', () => {
    router.register(mockProvider('test', 'test response'));

    expect(router.listProviders()).toContain('test');
  });

  it('should set primary', () => {
    router.register(mockProvider('a', 'a'));
    router.register(mockProvider('b', 'b'));
    router.setPrimary('b');

    expect(router.getProvider().name).toBe('b');
  });

  it('should throw for unregistered provider', () => {
    expect(() => router.setPrimary('nonexistent')).toThrow('not registered');
  });

  it('should route based on SurvivalTier', async () => {
    router.register(mockProvider('expensive', 'expensive result'));
    router.register(mockProvider('ollama', 'local result'));
    router.setPrimary('expensive');
    router.setFallbackChain(['ollama']);

    // Normal: use expensive
    let text = '';
    for await (const chunk of router.chat([{ role: 'user', content: 'test' }], { model: 'gpt-4' })) {
      if (chunk.type === 'text' && chunk.text) text += chunk.text;
    }
    expect(text).toBe('expensive result');

    // Critical: force ollama
    router.updateSurvivalTier('critical');
    text = '';
    for await (const chunk of router.chat([{ role: 'user', content: 'test' }], { model: 'gpt-4' })) {
      if (chunk.type === 'text' && chunk.text) text += chunk.text;
    }
    expect(text).toBe('local result');
  });

  it('should throw when dead', async () => {
    router.register(mockProvider('test', 'ok'));
    router.updateSurvivalTier('dead');

    const gen = router.chat([{ role: 'user', content: 'test' }], { model: 'test' });
    await expect(async () => {
      for await (const _ of gen) { /* drain */ }
    }).rejects.toThrow('DEAD');
  });

  it('should track stats', async () => {
    router.register(mockProvider('test', 'response text here'));

    for await (const _ of router.chat([{ role: 'user', content: 'test' }], { model: 'test' })) {
      // drain
    }
    const stats = router.stats();

    expect(stats.totalInputTokens + stats.totalOutputTokens).toBeGreaterThan(0);
    expect(stats.survivalTier).toBe('thriving');
    expect(stats.providerCount).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// API Routes Tests
// ══════════════════════════════════════════════════════════════════════

describe('API Routes', () => {
  it('should create 7 API routes', () => {
    const routes = createApiRoutes({});
    expect(routes.length).toBe(7);
  });

  it('should handle wallet/info when no wallet', async () => {
    const routes = createApiRoutes({});
    const walletInfo = routes.find(r => r.path === '/api/wallet/info');
    expect(walletInfo).toBeDefined();

    const result = await walletInfo!.handler();
    expect(result).toEqual({ address: null, balances: null, tier: 'dead' });
  });

  it('should handle empty memory stats', async () => {
    const routes = createApiRoutes({});
    const memStats = routes.find(r => r.path === '/api/memory/stats');
    const result = await memStats!.handler();
    expect(result).toHaveProperty('totalCount', 0);
  });

  it('should handle empty tools list', async () => {
    const routes = createApiRoutes({});
    const toolsList = routes.find(r => r.path === '/api/tools/list');
    const result = await toolsList!.handler() as { tools: unknown[] };
    expect(result.tools).toEqual([]);
  });

  it('should handle wallet sync', async () => {
    const routes = createApiRoutes({});
    const syncRoute = routes.find(r => r.path === '/api/wallet/sync-external');
    const result = await syncRoute!.handler({
      address: '0x1234',
      chainId: 8453,
      walletType: 'metamask',
      connected: true,
    }) as { synced: boolean };

    expect(result.synced).toBe(true);
  });
});
