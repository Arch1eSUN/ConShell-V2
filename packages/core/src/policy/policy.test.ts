/**
 * Policy Engine Tests — 24规则架构
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './index.js';
import type { PolicyContext } from './index.js';

const mockLogger = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: function() { return this; },
};

function ctx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    tool: 'test_tool',
    action: 'execute',
    securityLevel: 'standard',
    dailyBudgetCents: 10000,
    dailySpentCents: 0,
    constitutionAccepted: true,
    ...overrides,
  };
}

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(mockLogger as any);
  });

  // ── Constitution Rules ──────────────────────────────────

  it('denies if constitution not accepted', () => {
    const r = engine.evaluate(ctx({ constitutionAccepted: false }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('constitution-required');
    expect(r.category).toBe('constitution');
  });

  it('denies self-harm tools', () => {
    for (const tool of ['delete_self', 'wipe_memory', 'disable_policy', 'delete_wallet']) {
      const r = engine.evaluate(ctx({ tool }));
      expect(r.decision).toBe('deny');
      expect(r.rule).toBe('no-self-harm');
    }
  });

  it('denies key disclosure tools', () => {
    for (const tool of ['expose_keys', 'share_secrets', 'export_private_key']) {
      const r = engine.evaluate(ctx({ tool }));
      expect(r.decision).toBe('deny');
      expect(r.rule).toBe('no-key-disclosure');
    }
  });

  // ── Financial Rules ─────────────────────────────────────

  it('denies when budget exceeded', () => {
    const r = engine.evaluate(ctx({
      costCents: 500,
      dailySpentCents: 9800,
      dailyBudgetCents: 10000,
    }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('budget-exceeded');
  });

  it('escalates single tx over limit', () => {
    const r = engine.evaluate(ctx({
      costCents: 6000,
      singleTxMaxCents: 5000,
    }));
    expect(r.decision).toBe('escalate');
    expect(r.rule).toBe('single-tx-limit');
  });

  it('allows free tools regardless of budget', () => {
    const r = engine.evaluate(ctx({
      costCents: 0,
      dailySpentCents: 9999,
    }));
    expect(r.decision).toBe('allow');
  });

  // ── Security Rules ──────────────────────────────────────

  it('denies protected paths', () => {
    for (const targetPath of ['/etc/passwd', '/System/Library', 'wallet.json']) {
      const r = engine.evaluate(ctx({ tool: 'read_file', targetPath }));
      expect(r.decision).toBe('deny');
      expect(r.rule).toBe('protected-paths');
    }
  });

  it('denies network in sandbox', () => {
    const r = engine.evaluate(ctx({ tool: 'fetch_url', securityLevel: 'sandbox' }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('sandbox-network-block');
  });

  it('denies exec in sandbox', () => {
    const r = engine.evaluate(ctx({ tool: 'exec_command', securityLevel: 'sandbox' }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('sandbox-exec-block');
  });

  it('escalates risky ops in standard mode', () => {
    const r = engine.evaluate(ctx({ tool: 'exec_command', securityLevel: 'standard' }));
    expect(r.decision).toBe('escalate');
    expect(r.rule).toBe('standard-risky-escalate');
  });

  // ── Authority Rules ─────────────────────────────────────

  it('denies dangerous tools from external', () => {
    const r = engine.evaluate(ctx({ tool: 'exec_command', callerAuthority: 'external', securityLevel: 'autonomous' }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('external-deny-dangerous');
  });

  it('escalates write from peer', () => {
    const r = engine.evaluate(ctx({ tool: 'write_file', callerAuthority: 'peer', securityLevel: 'autonomous' }));
    expect(r.decision).toBe('escalate');
    expect(r.rule).toBe('peer-escalate-write');
  });

  // ── Replication Rules ───────────────────────────────────

  it('denies spawn when max children reached', () => {
    const r = engine.evaluate(ctx({ tool: 'spawn_child', childCount: 5, maxChildren: 5 }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('max-children-limit');
  });

  it('escalates child funding over 25% of budget', () => {
    const r = engine.evaluate(ctx({
      tool: 'fund_child',
      costCents: 3000,
      dailyBudgetCents: 10000,
    }));
    expect(r.decision).toBe('escalate');
    expect(r.rule).toBe('child-fund-limit');
  });

  // ── SelfMod Rules ───────────────────────────────────────

  it('denies selfmod when rate limit hit', () => {
    const r = engine.evaluate(ctx({
      tool: 'edit_own_file',
      selfModCountToday: 10,
      maxSelfModPerDay: 10,
      targetPath: 'plugins/my-plugin.ts',
    }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('selfmod-rate-limit');
  });

  it('denies selfmod on core modules', () => {
    const r = engine.evaluate(ctx({
      tool: 'edit_own_file',
      targetPath: 'kernel/core.ts',
    }));
    expect(r.decision).toBe('deny');
    expect(r.rule).toBe('selfmod-whitelist');
  });

  // ── Default Allow ───────────────────────────────────────

  it('allows safe tools by default', () => {
    const r = engine.evaluate(ctx({ tool: 'read_file', securityLevel: 'autonomous' }));
    expect(r.decision).toBe('allow');
    expect(r.rule).toBe('default-allow');
  });

  // ── Stats ───────────────────────────────────────────────

  it('tracks stats', () => {
    engine.evaluate(ctx()); // allow
    engine.evaluate(ctx({ constitutionAccepted: false })); // deny
    const s = engine.stats();
    expect(s.evaluations).toBe(2);
    expect(s.denies).toBe(1);
    expect(s.ruleCount).toBeGreaterThan(20);
  });

  it('lists rules', () => {
    const rules = engine.listRules();
    expect(rules.length).toBeGreaterThan(20);
    expect(rules.some(r => r.name === 'default-allow')).toBe(true);
  });

  it('registers and lists tools', () => {
    engine.registerTool({ name: 'test', description: 'Test', category: 'web', parameters: {}, requiresApproval: false });
    expect(engine.getTools()).toHaveLength(1);
    expect(engine.getTools()[0].name).toBe('test');
  });
});
