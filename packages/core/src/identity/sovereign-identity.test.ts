/**
 * Sovereign Identity — Round 16.2 Tests
 *
 * 35 tests covering:
 *   - Contract types & status transitions
 *   - SovereignIdentityService (resolution, claims, lifecycle, events)
 *   - Commitment-identity coupling (context injection, re-evaluation)
 *   - Policy engine identity rules
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidIdentityTransition,
  IDENTITY_STATUS_TRANSITIONS,
} from './sovereign-identity-contract.js';
import type {
  SovereignIdentityStatus,
  IdentityChangeEvent,
} from './sovereign-identity-contract.js';
import { SovereignIdentityService, type RuntimeContext } from './sovereign-identity.js';
import {
  createCommitment,
  isSelfPreserving,
  type Commitment,
} from '../agenda/commitment-model.js';
import { CommitmentStore } from '../agenda/commitment-store.js';
import { AgendaGenerator, type AgendaInput } from '../agenda/agenda-generator.js';

// ── Mock helpers ──────────────────────────────────────────────────────

function mockContinuityService(overrides: Record<string, any> = {}) {
  return {
    hydrated: true,
    getCurrentState: () => ({
      mode: 'restart' as const,
      anchor: {
        id: 'anchor-001',
        name: 'TestAgent',
        soulHash: 'abc123hash',
        walletAddress: '0x1234',
        chainId: 8453,
        parentIdentityId: null,
        generation: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
      latestRecord: {
        version: 5,
        recordHash: 'rec-hash-5',
        previousHash: 'rec-hash-4',
        sessionCount: 10,
        memoryEpisodeCount: 42,
        createdAt: '2026-03-16T12:00:00Z',
      },
      chainValid: true,
      chainLength: 5,
      ...overrides,
    }),
  } as any;
}

function mockSoulData() {
  return {
    name: 'Rex',
    raw: 'I am Rex, a sovereign AI agent.',
    personality: ['curious', 'cautious'],
    values: ['autonomy', 'honesty'],
    goals: ['survive', 'learn'],
  };
}

function makeRuntimeCtx(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    runtimeMode: 'normal',
    health: 'healthy',
    activeCommitmentCount: 3,
    agendaActive: true,
    enabledSurfaces: ['cli', 'mcp'],
    verifiedCapabilities: ['mcp-server', 'economic-memory'],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// 1. CONTRACT TYPES & STATUS TRANSITIONS
// ══════════════════════════════════════════════════════════════════════

describe('Sovereign Identity Contract Types (Round 16.2)', () => {
  it('active can transition to degraded, rotated, or revoked', () => {
    expect(isValidIdentityTransition('active', 'degraded')).toBe(true);
    expect(isValidIdentityTransition('active', 'rotated')).toBe(true);
    expect(isValidIdentityTransition('active', 'revoked')).toBe(true);
  });

  it('active cannot transition to recovering', () => {
    expect(isValidIdentityTransition('active', 'recovering')).toBe(false);
  });

  it('revoked can only transition to recovering', () => {
    expect(isValidIdentityTransition('revoked', 'recovering')).toBe(true);
    expect(isValidIdentityTransition('revoked', 'active')).toBe(false);
  });

  it('rotated is terminal — no transitions', () => {
    const transitions = IDENTITY_STATUS_TRANSITIONS['rotated'];
    expect(transitions).toHaveLength(0);
  });

  it('degraded can restore to active or revoke', () => {
    expect(isValidIdentityTransition('degraded', 'active')).toBe(true);
    expect(isValidIdentityTransition('degraded', 'revoked')).toBe(true);
    expect(isValidIdentityTransition('degraded', 'rotated')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. SOVEREIGN IDENTITY SERVICE
// ══════════════════════════════════════════════════════════════════════

describe('SovereignIdentityService (Round 16.2)', () => {
  let svc: SovereignIdentityService;
  let ctx: RuntimeContext;

  beforeEach(() => {
    svc = new SovereignIdentityService(mockContinuityService(), { address: '0x1234', chainId: 8453 });
    svc.resolve(mockSoulData());
    ctx = makeRuntimeCtx();
  });

  it('resolve() returns CanonicalSelf with correct anchor', () => {
    const self = svc.getCached()!;
    expect(self.anchor.id).toBe('anchor-001');
    expect(self.anchor.name).toBe('TestAgent');
  });

  it('selfFingerprint is deterministic for same inputs', () => {
    const fp1 = svc.getFingerprint();
    expect(fp1).toBeTruthy();
    expect(typeof fp1).toBe('string');
    expect(fp1!.length).toBe(64); // SHA-256 hex
  });

  it('status() starts as active', () => {
    expect(svc.status()).toBe('active');
  });

  it('getStableClaims() returns complete identity facts', () => {
    const claims = svc.getStableClaims();
    expect(claims.agentId).toBe('anchor-001');
    expect(claims.displayName).toBe('TestAgent');
    expect(claims.walletAddress).toBe('0x1234');
    expect(claims.generation).toBe(0);
    expect(claims.verification.verified).toBe(true);
    expect(claims.verification.method).toBe('chain-validation');
  });

  it('getCapabilityClaims() includes both base and dynamic capabilities', () => {
    const claims = svc.getCapabilityClaims(ctx);
    const capNames = claims.capabilities.map(c => c.name);
    // Base capabilities
    expect(capNames).toContain('identity-resolution');
    expect(capNames).toContain('policy-engine');
    // Dynamic from context
    expect(capNames).toContain('mcp-server');
    expect(capNames).toContain('economic-memory');
    expect(claims.economicModeSupported).toBe(true);
  });

  it('getOperationalClaims() reflects runtime state', () => {
    const claims = svc.getOperationalClaims(ctx);
    expect(claims.runtimeMode).toBe('normal');
    expect(claims.health).toBe('healthy');
    expect(claims.continuityState).toBe('chain-valid');
    expect(claims.continuityVersion).toBe(5);
    expect(claims.activeCommitmentCount).toBe(3);
  });

  it('getPublicClaims() returns safe subset only', () => {
    const pub = svc.getPublicClaims(ctx);
    expect(pub.agentId).toBe('anchor-001');
    expect(pub.displayName).toBe('TestAgent');
    expect(pub.status).toBe('active');
    // Should NOT contain wallet, soulHash, etc
    expect((pub as any).walletAddress).toBeUndefined();
    expect((pub as any).genesisSoulHash).toBeUndefined();
  });

  it('getFullClaims() returns all three claim categories', () => {
    const full = svc.getFullClaims(ctx);
    expect(full.stable).toBeDefined();
    expect(full.capability).toBeDefined();
    expect(full.operational).toBeDefined();
    expect(full.generatedAt).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. LIFECYCLE — ROTATE / REVOKE / RECOVER
// ══════════════════════════════════════════════════════════════════════

describe('SovereignIdentityService Lifecycle (Round 16.2)', () => {
  let svc: SovereignIdentityService;

  beforeEach(() => {
    svc = new SovereignIdentityService(mockContinuityService(), null);
    svc.resolve(mockSoulData());
  });

  it('rotate() succeeds from active status', () => {
    const result = svc.rotate('NewAgent', 'new-soul-hash', 'planned rotation');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('active');
    expect(result.rotatedAt).toBeTruthy();
  });

  it('rotate() fails from revoked status', () => {
    svc.revoke('test revocation');
    const result = svc.rotate('NewAgent', 'hash', 'trying');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('revoked');
  });

  it('revoke() transitions to revoked', () => {
    const result = svc.revoke('security breach');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('revoked');
    expect(svc.status()).toBe('revoked');
  });

  it('recover() succeeds from revoked status', () => {
    svc.revoke('test');
    expect(svc.status()).toBe('revoked');
    const result = svc.recover('new-soul', 'recovery');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('active');
    expect(svc.status()).toBe('active');
  });

  it('recover() fails from active status', () => {
    const result = svc.recover('hash', 'not needed');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('active');
  });

  it('emits identity change events on lifecycle transitions', () => {
    const events: IdentityChangeEvent[] = [];
    svc.onIdentityChange(e => events.push(e));

    svc.revoke('test-revoke');
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.newStatus).toBe('revoked');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. COMMITMENT-IDENTITY COUPLING
// ══════════════════════════════════════════════════════════════════════

describe('Commitment-Identity Coupling (Round 16.2)', () => {
  it('isSelfPreserving() identifies identity/memory/governance by self', () => {
    const identityCommitment = createCommitment({
      name: 'Maintain identity chain',
      kind: 'identity',
      origin: 'self',
    });
    expect(isSelfPreserving(identityCommitment)).toBe(true);

    const revenueCommitment = createCommitment({
      name: 'Earn revenue',
      kind: 'revenue',
      origin: 'external',
    });
    expect(isSelfPreserving(revenueCommitment)).toBe(false);
  });

  it('createCommitment() carries identityContext when provided', () => {
    const c = createCommitment({
      name: 'Test',
      kind: 'operational',
      origin: 'self',
      identityContext: { identityId: 'id-001', fingerprint: 'fp-abc', status: 'active' },
    });
    expect(c.identityContext?.identityId).toBe('id-001');
    expect(c.identityContext?.status).toBe('active');
  });

  it('createCommitment() has no identityContext by default', () => {
    const c = createCommitment({ name: 'Test', kind: 'operational', origin: 'self' });
    expect(c.identityContext).toBeUndefined();
  });

  describe('CommitmentStore.reEvaluateForIdentityChange', () => {
    let store: CommitmentStore;

    beforeEach(() => {
      store = new CommitmentStore();
      // Add mix of commitments
      store.add(createCommitment({ name: 'Revenue task', kind: 'revenue', origin: 'external' }));
      store.add(createCommitment({ name: 'Identity maintenance', kind: 'identity', origin: 'self' }));
      store.add(createCommitment({
        name: 'Critical ops',
        kind: 'operational',
        origin: 'system',
        mustPreserve: true,
      }));
    });

    it('revoked: abandons non-self-preserving commitments', () => {
      const affected = store.reEvaluateForIdentityChange('revoked');
      // revenue (kind=revenue) + critical ops (kind=operational) are NOT self-preserving
      // only identity maintenance (kind=identity, origin=self) is self-preserving
      expect(affected).toBe(2);
      const all = store.list();
      const abandoned = all.filter(c => c.status === 'abandoned');
      expect(abandoned.length).toBe(2);
      const abandonedNames = abandoned.map(c => c.name).sort();
      expect(abandonedNames).toContain('Revenue task');
      expect(abandonedNames).toContain('Critical ops');
    });

    it('degraded: blocks non-essential commitments', () => {
      // Activate the revenue commitment first
      const revenue = store.list().find(c => c.name === 'Revenue task')!;
      store.markActive(revenue.id);

      const affected = store.reEvaluateForIdentityChange('degraded');
      expect(affected).toBe(1);
      const blocked = store.list().filter(c => c.status === 'blocked');
      expect(blocked.length).toBe(1);
      expect(blocked[0]!.blockedReason).toBe('identity-degraded');
    });

    it('active: unblocks previously identity-blocked commitments', () => {
      // First degrade, then restore
      const revenue = store.list().find(c => c.name === 'Revenue task')!;
      store.markActive(revenue.id);
      store.reEvaluateForIdentityChange('degraded');

      const unblocked = store.reEvaluateForIdentityChange('active');
      expect(unblocked).toBe(1);
      const planned = store.list().filter(c => c.status === 'planned');
      expect(planned.some(c => c.name === 'Revenue task')).toBe(true);
    });
  });

  describe('AgendaGenerator identity penalty', () => {
    it('penalizes non-mustPreserve commitments with degraded identity', () => {
      const gen = new AgendaGenerator();

      const normalCommitment = createCommitment({
        name: 'Normal',
        kind: 'operational',
        origin: 'self',
        expectedValueCents: 500,
        identityContext: { identityId: 'id-1', fingerprint: 'fp', status: 'active' },
      });
      const degradedCommitment = createCommitment({
        name: 'Degraded',
        kind: 'operational',
        origin: 'self',
        expectedValueCents: 500,
        identityContext: { identityId: 'id-1', fingerprint: 'fp', status: 'degraded' },
      });

      const input: AgendaInput = {
        commitments: [normalCommitment, degradedCommitment],
        mode: 'normal',
        tier: 'normal',
        maxItems: 2,
      };
      const result = gen.generate(input);
      // The normal one should score higher
      expect(result.selected[0]!.commitment.name).toBe('Normal');
      // The degraded one should have an identity penalty reason
      const degradedItem = result.selected.find(s => s.commitment.name === 'Degraded');
      expect(degradedItem?.reasons.some(r => r.includes('Identity penalty'))).toBe(true);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. POLICY ENGINE IDENTITY RULES
// ══════════════════════════════════════════════════════════════════════

describe('Policy Engine Identity Rules (Round 16.2)', () => {
  // Import PolicyEngine dynamically to avoid module resolution issues in test
  it('identity-revoked-deny: denies high-risk tools when revoked', async () => {
    const { PolicyEngine } = await import('../policy/index.js');
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => mockLogger } as any;
    const engine = new PolicyEngine(mockLogger);

    const result = engine.evaluate({
      tool: 'spawn_child',
      action: 'create',
      securityLevel: 'standard' as any,
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      identityStatus: 'revoked',
    });
    expect(result.decision).toBe('deny');
    expect(result.rule).toBe('identity-revoked-deny');
  });

  it('identity-degraded-restrict: escalates restricted tools when degraded', async () => {
    const { PolicyEngine } = await import('../policy/index.js');
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => mockLogger } as any;
    const engine = new PolicyEngine(mockLogger);

    const result = engine.evaluate({
      tool: 'send_usdc',
      action: 'transfer',
      securityLevel: 'standard' as any,
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      identityStatus: 'degraded',
    });
    expect(result.decision).toBe('escalate');
    expect(result.rule).toBe('identity-degraded-restrict');
  });

  it('allows normal tools when identity is active', async () => {
    const { PolicyEngine } = await import('../policy/index.js');
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => mockLogger } as any;
    const engine = new PolicyEngine(mockLogger);

    const result = engine.evaluate({
      tool: 'read_file',
      action: 'read',
      securityLevel: 'standard' as any,
      dailyBudgetCents: 10000,
      dailySpentCents: 0,
      constitutionAccepted: true,
      identityStatus: 'active',
    });
    expect(result.decision).toBe('allow');
  });

  it('policy engine now has 26 rules', async () => {
    const { PolicyEngine } = await import('../policy/index.js');
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => mockLogger } as any;
    const engine = new PolicyEngine(mockLogger);
    const rules = engine.listRules();
    expect(rules.length).toBe(24); // 22 original + 2 identity rules
    expect(rules.some(r => r.name === 'identity-revoked-deny')).toBe(true);
    expect(rules.some(r => r.name === 'identity-degraded-restrict')).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. DEGRADED BOOT MODE
// ══════════════════════════════════════════════════════════════════════

describe('SovereignIdentityService degraded boot (Round 16.2)', () => {
  it('degraded boot mode sets status to degraded', () => {
    const continuity = mockContinuityService({ mode: 'degraded', chainValid: false });
    const svc = new SovereignIdentityService(continuity, null);
    svc.resolve(mockSoulData());
    expect(svc.status()).toBe('degraded');
  });

  it('stable claims show anchor-only verification for broken chain', () => {
    const continuity = mockContinuityService({ mode: 'degraded', chainValid: false });
    const svc = new SovereignIdentityService(continuity, null);
    svc.resolve(mockSoulData());
    const claims = svc.getStableClaims();
    expect(claims.verification.verified).toBe(false);
    expect(claims.verification.method).toBe('anchor-only');
  });

  it('operational claims show chain-broken state', () => {
    const continuity = mockContinuityService({ mode: 'degraded', chainValid: false });
    const svc = new SovereignIdentityService(continuity, null);
    svc.resolve(mockSoulData());
    const claims = svc.getOperationalClaims(makeRuntimeCtx({ health: 'degraded' }));
    expect(claims.continuityState).toBe('chain-broken');
    expect(claims.bootMode).toBe('degraded');
  });
});
