/**
 * Round 15.6 — Identity-Memory Coherence Closure Tests
 *
 * Coverage:
 *   A. Canonical Self Model (self-model.ts)
 *   B. Identity Lifecycle (identity-lifecycle.ts)
 *   C. Memory Ownership (memory-ownership.ts)
 *   D. Consolidation Self-Continuity (via MemoryClass)
 *   E. Narrative Governance (narrative-governance.ts)
 *   F. Inheritance Boundary (inheritance-boundary.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── A: Canonical Self Model ──────────────────────────────────────────────
import {
  SelfModelService,
  computeSelfFingerprint,
  type CanonicalSelf,
} from '../identity/self-model.js';
import type { SelfState } from '../identity/continuity-service.js';
import type { SoulData } from '../soul/system.js';
import type { IdentityAnchor, ContinuityRecord } from '../identity/anchor.js';

// ── B: Identity Lifecycle ───────────────────────────────────────────────
import {
  createGenesisRecord,
  rotateIdentity,
  revokeIdentity,
  recoverIdentity,
  resolveActive,
  validateRecordChain,
} from '../identity/identity-lifecycle.js';

// ── C: Memory Ownership ─────────────────────────────────────────────────
import {
  MemoryClass,
  classifyMemory,
  isSelfDefining,
  isInheritable,
  buildOwnership,
  getRetentionPolicy,
  DEFAULT_RETENTION_POLICIES,
} from '../memory/memory-ownership.js';

// ── E: Narrative Governance ─────────────────────────────────────────────
import {
  evaluateNarrativeUpdate,
  isAuthorizedTrigger,
  type NarrativeUpdateRequest,
} from '../soul/narrative-governance.js';

// ── F: Inheritance Boundary ─────────────────────────────────────────────
import {
  DEFAULT_INHERITANCE_MANIFEST,
  getPolicy,
  getFieldsByPolicy,
  isFieldInheritable,
  validateManifest,
} from '../identity/inheritance-boundary.js';

// ── Test helpers ────────────────────────────────────────────────────────

function makeSoulData(overrides?: Partial<SoulData>): SoulData {
  return {
    name: 'TestAgent',
    tagline: 'A test sovereign agent',
    personality: ['curious', 'precise'],
    values: ['honesty', 'autonomy'],
    goals: ['learn', 'serve'],
    communicationStyle: 'clear and direct',
    raw: '# SOUL\n## Name\nTestAgent\n',
    ...overrides,
  };
}

function makeAnchor(overrides?: Partial<IdentityAnchor>): IdentityAnchor {
  return {
    id: 'anchor-001',
    name: 'TestAgent',
    walletAddress: '0x1234',
    soulHash: 'abc123',
    createdAt: '2025-01-01T00:00:00Z',
    parentIdentityId: null,
    generation: 0,
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<ContinuityRecord>): ContinuityRecord {
  return {
    version: 1,
    identityId: 'anchor-001',
    soulHash: 'abc123',
    soulVersion: 0,
    sessionCount: 3,
    memoryEpisodeCount: 10,
    lastSessionId: 'session-1',
    previousHash: null,
    recordHash: 'record-hash-1',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeSelfState(overrides?: Partial<SelfState>): SelfState {
  const anchor = makeAnchor();
  const latestRecord = makeRecord();
  return {
    mode: 'genesis',
    anchor,
    latestRecord,
    chainValid: true,
    chainLength: 1,
    explanation: { short: 'test', detail: 'test genesis' },
    ...overrides,
  } as SelfState;
}

function makeMockContinuityService(selfState: SelfState) {
  return {
    getCurrentState: vi.fn(() => selfState),
    hydrated: true,
  } as any;
}

// ═══════════════════════════════════════════════════════════════════════
// A. CANONICAL SELF MODEL
// ═══════════════════════════════════════════════════════════════════════

describe('CanonicalSelf Model (Round 15.6 — Goal A)', () => {
  let service: SelfModelService;
  let selfState: SelfState;
  let soul: SoulData;

  beforeEach(() => {
    selfState = makeSelfState();
    soul = makeSoulData();
    const mockContinuity = makeMockContinuityService(selfState);
    service = new SelfModelService(mockContinuity, { address: '0x1234', chainId: 8453 });
  });

  it('resolve() returns a CanonicalSelf with all fields populated', () => {
    const self = service.resolve(soul);
    expect(self.anchor).toBeDefined();
    expect(self.anchor.id).toBe('anchor-001');
    expect(self.continuity).toBeDefined();
    expect(self.soul).toBeDefined();
    expect(self.soul.name).toBe('TestAgent');
    expect(self.wallet).toBeDefined();
    expect(self.wallet!.address).toBe('0x1234');
    expect(self.verification).toBeDefined();
    expect(self.resolvedAt).toBeDefined();
    expect(self.selfFingerprint).toBeDefined();
  });

  it('resolve() sets verification.valid = true for valid chain', () => {
    const self = service.resolve(soul);
    expect(self.verification.valid).toBe(true);
    expect(self.verification.chainValid).toBe(true);
    expect(self.verification.issues).toEqual([]);
  });

  it('resolve() sets verification.valid = false for broken chain', () => {
    selfState.chainValid = false;
    const mockContinuity = makeMockContinuityService(selfState);
    service = new SelfModelService(mockContinuity, null);
    const self = service.resolve(soul);
    expect(self.verification.valid).toBe(false);
    expect(self.verification.issues).toContain('continuity chain broken');
  });

  it('resolve() detects degraded boot mode', () => {
    selfState.mode = 'degraded';
    const mockContinuity = makeMockContinuityService(selfState);
    service = new SelfModelService(mockContinuity, null);
    const self = service.resolve(soul);
    expect(self.verification.valid).toBe(false);
    expect(self.verification.bootMode).toBe('degraded');
    expect(self.verification.issues).toContain('booted in degraded mode');
  });

  it('fingerprint is deterministic for same inputs', () => {
    const self1 = service.resolve(soul);
    service.invalidate();
    const self2 = service.resolve(soul);
    expect(self1.selfFingerprint).toBe(self2.selfFingerprint);
  });

  it('fingerprint changes when soul changes', () => {
    const self1 = service.resolve(soul);
    service.invalidate();
    const modified = makeSoulData({ raw: '# SOUL\n## Name\nDifferentAgent\n' });
    const self2 = service.resolve(modified);
    expect(self1.selfFingerprint).not.toBe(self2.selfFingerprint);
  });

  it('getCached() returns null before first resolve', () => {
    const fresh = new SelfModelService(makeMockContinuityService(selfState), null);
    expect(fresh.getCached()).toBeNull();
  });

  it('getCached() returns resolved self after resolve()', () => {
    const self = service.resolve(soul);
    expect(service.getCached()).toBe(self);
  });

  it('invalidate() clears the cache', () => {
    service.resolve(soul);
    service.invalidate();
    expect(service.getCached()).toBeNull();
  });

  it('wallet binding is null when no wallet provided', () => {
    const noWalletService = new SelfModelService(makeMockContinuityService(selfState), null);
    const self = noWalletService.resolve(soul);
    expect(self.wallet).toBeNull();
  });

  it('soul reference is frozen (immutable)', () => {
    const self = service.resolve(soul);
    expect(Object.isFrozen(self.soul.personality)).toBe(true);
    expect(Object.isFrozen(self.soul.values)).toBe(true);
  });

  it('computeSelfFingerprint is a pure function', () => {
    const a = computeSelfFingerprint('id-1', 'hash-1', 1);
    const b = computeSelfFingerprint('id-1', 'hash-1', 1);
    expect(a).toBe(b);
    const c = computeSelfFingerprint('id-2', 'hash-1', 1);
    expect(a).not.toBe(c);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// B. IDENTITY LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════

describe('Identity Lifecycle (Round 15.6 — Goal B)', () => {
  it('createGenesisRecord creates an active v1 record', () => {
    const record = createGenesisRecord('anchor-x', 'Agent X', 'soul-hash');
    expect(record.version).toBe(1);
    expect(record.status).toBe('active');
    expect(record.anchorId).toBe('anchor-x');
    expect(record.name).toBe('Agent X');
    expect(record.previousRecordId).toBeNull();
    expect(record.retiredAt).toBeNull();
  });

  describe('rotateIdentity', () => {
    it('rotates active identity → new active + old rotated', () => {
      const current = createGenesisRecord('a', 'Agent A', 'h1');
      const result = rotateIdentity(current, 'Agent A v2', 'h2', 'soul evolved');
      expect(result.success).toBe(true);
      expect(result.newRecord!.status).toBe('active');
      expect(result.newRecord!.version).toBe(2);
      expect(result.newRecord!.previousRecordId).toBe(current.id);
      expect(result.previousRecord!.status).toBe('rotated');
    });

    it('rejects rotation of non-active record', () => {
      const rotated = { ...createGenesisRecord('a', 'A', 'h'), status: 'rotated' as const };
      const result = rotateIdentity(rotated, 'B', 'h2', 'reason');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('not active');
    });
  });

  describe('revokeIdentity', () => {
    it('revokes active identity', () => {
      const current = createGenesisRecord('a', 'A', 'h');
      const result = revokeIdentity(current, 'compromised');
      expect(result.success).toBe(true);
      expect(result.previousRecord!.status).toBe('revoked');
      expect(result.previousRecord!.retirementReason).toBe('compromised');
    });

    it('rejects revocation of non-active record', () => {
      const revoked = { ...createGenesisRecord('a', 'A', 'h'), status: 'revoked' as const };
      const result = revokeIdentity(revoked, 'reason');
      expect(result.success).toBe(false);
    });
  });

  describe('recoverIdentity', () => {
    it('recovers revoked identity into new active record', () => {
      const revoked = { ...createGenesisRecord('a', 'A', 'h'), status: 'revoked' as const };
      const result = recoverIdentity(revoked, 'h2', 'authorized recovery');
      expect(result.success).toBe(true);
      expect(result.newRecord!.status).toBe('active');
      expect(result.newRecord!.version).toBe(2);
      expect(result.newRecord!.previousRecordId).toBe(revoked.id);
    });

    it('rejects recovery of non-revoked record', () => {
      const active = createGenesisRecord('a', 'A', 'h');
      const result = recoverIdentity(active, 'h2', 'reason');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('not revoked');
    });
  });

  describe('resolveActive', () => {
    it('finds the active record', () => {
      const r1 = { ...createGenesisRecord('a', 'A', 'h1'), status: 'rotated' as const };
      const r2 = createGenesisRecord('a', 'A v2', 'h2');
      expect(resolveActive([r1, r2])?.name).toBe('A v2');
    });

    it('returns null for all-revoked chain', () => {
      const r1 = { ...createGenesisRecord('a', 'A', 'h1'), status: 'revoked' as const };
      expect(resolveActive([r1])).toBeNull();
    });
  });

  describe('validateRecordChain', () => {
    it('validates a correct chain', () => {
      const r1 = createGenesisRecord('a', 'A', 'h1');
      const rotateResult = rotateIdentity(r1, 'A v2', 'h2', 'growth');
      const chain = [rotateResult.previousRecord!, rotateResult.newRecord!];
      const validation = validateRecordChain(chain);
      expect(validation.valid).toBe(true);
    });

    it('detects empty chain', () => {
      expect(validateRecordChain([]).valid).toBe(false);
    });

    it('detects broken predecessor link', () => {
      const r1 = createGenesisRecord('a', 'A', 'h');
      const r2 = { ...createGenesisRecord('a', 'B', 'h2'), version: 2, previousRecordId: 'wrong-id' };
      const result = validateRecordChain([r1, r2]);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('mismatch'))).toBe(true);
    });

    it('detects multiple active records', () => {
      const r1 = createGenesisRecord('a', 'A', 'h');
      const r2 = { ...createGenesisRecord('a', 'B', 'h2'), version: 2, previousRecordId: r1.id };
      const result = validateRecordChain([r1, r2]);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('multiple active'))).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C. MEMORY OWNERSHIP
// ═══════════════════════════════════════════════════════════════════════

describe('Memory Ownership (Round 15.6 — Goal C)', () => {
  describe('classifyMemory', () => {
    it('classifies soul_ events as SELF', () => {
      expect(classifyMemory('soul_evolved', 'content')).toBe(MemoryClass.SELF);
    });

    it('classifies skill_ events as SELF', () => {
      expect(classifyMemory('skill_learned', 'mastered TDD')).toBe(MemoryClass.SELF);
    });

    it('classifies identity_ events as SELF', () => {
      expect(classifyMemory('identity_change', 'name changed')).toBe(MemoryClass.SELF);
    });

    it('classifies user_ events as USER', () => {
      expect(classifyMemory('user_preference', 'likes dark mode')).toBe(MemoryClass.USER);
    });

    it('classifies operator_ events as USER', () => {
      expect(classifyMemory('operator_command', 'restart')).toBe(MemoryClass.USER);
    });

    it('classifies env_ events as ENVIRONMENT', () => {
      expect(classifyMemory('env_state', 'temp=32C')).toBe(MemoryClass.ENVIRONMENT);
    });

    it('classifies session_ events as SESSION', () => {
      expect(classifyMemory('session_start', 'new session')).toBe(MemoryClass.SESSION);
    });

    it('classifies debug_ events as SESSION', () => {
      expect(classifyMemory('debug_log', 'verbose output')).toBe(MemoryClass.SESSION);
    });

    it('classifies unknown events as ENVIRONMENT (safe default)', () => {
      expect(classifyMemory('unknown_type', 'random content')).toBe(MemoryClass.ENVIRONMENT);
    });

    it('classifies consolidated turns with learning keywords as SELF', () => {
      expect(classifyMemory('consolidated_assistant', 'I learned how to do X')).toBe(MemoryClass.SELF);
    });

    it('classifies consolidated turns with user keywords as USER', () => {
      expect(classifyMemory('consolidated_assistant', 'the user asked for help')).toBe(MemoryClass.USER);
    });
  });

  describe('predicates', () => {
    it('SELF is self-defining', () => {
      expect(isSelfDefining(MemoryClass.SELF)).toBe(true);
    });

    it('LINEAGE is self-defining', () => {
      expect(isSelfDefining(MemoryClass.LINEAGE)).toBe(true);
    });

    it('USER is not self-defining', () => {
      expect(isSelfDefining(MemoryClass.USER)).toBe(false);
    });

    it('SELF is inheritable', () => {
      expect(isInheritable(MemoryClass.SELF)).toBe(true);
    });

    it('SESSION is not inheritable', () => {
      expect(isInheritable(MemoryClass.SESSION)).toBe(false);
    });
  });

  describe('buildOwnership', () => {
    it('builds complete ownership descriptor', () => {
      const ownership = buildOwnership('soul_evolved', 'personality changed', 'identity-123');
      expect(ownership.class).toBe(MemoryClass.SELF);
      expect(ownership.identityId).toBe('identity-123');
      expect(ownership.inheritable).toBe(true);
      expect(ownership.selfDefining).toBe(true);
    });
  });

  describe('retention policies', () => {
    it('SELF retention is permanent', () => {
      const rule = getRetentionPolicy(MemoryClass.SELF);
      expect(rule.retention).toBe('permanent');
      expect(rule.protectedFromDecay).toBe(true);
    });

    it('USER retention is 30d', () => {
      const rule = getRetentionPolicy(MemoryClass.USER);
      expect(rule.retention).toBe('30d');
    });

    it('SESSION retention is ephemeral', () => {
      const rule = getRetentionPolicy(MemoryClass.SESSION);
      expect(rule.retention).toBe('ephemeral');
      expect(rule.protectedFromDecay).toBe(false);
    });

    it('LINEAGE retention is permanent', () => {
      const rule = getRetentionPolicy(MemoryClass.LINEAGE);
      expect(rule.retention).toBe('permanent');
      expect(rule.protectedFromDecay).toBe(true);
    });

    it('all 5 classes have defined policies', () => {
      expect(DEFAULT_RETENTION_POLICIES.length).toBe(5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D. CONSOLIDATION SELF-CONTINUITY (via MemoryClass binding)
// ═══════════════════════════════════════════════════════════════════════

describe('Consolidation Self-Continuity (Round 15.6 — Goal D)', () => {
  it('self-defining events produce permanent retention', () => {
    const cls = classifyMemory('learning_milestone', 'mastered TypeScript');
    expect(cls).toBe(MemoryClass.SELF);
    const retention = getRetentionPolicy(cls);
    expect(retention.retention).toBe('permanent');
    expect(retention.protectedFromDecay).toBe(true);
  });

  it('session noise produces ephemeral retention', () => {
    const cls = classifyMemory('session_debug', 'verbose log line');
    expect(cls).toBe(MemoryClass.SESSION);
    const retention = getRetentionPolicy(cls);
    expect(retention.retention).toBe('ephemeral');
  });

  it('self-defining ownership flags selfDefining: true', () => {
    const ownership = buildOwnership('decision_made', 'chose TDD approach', 'id-1');
    expect(ownership.class).toBe(MemoryClass.SELF);
    expect(ownership.selfDefining).toBe(true);
  });

  it('environment ownership flags selfDefining: false', () => {
    const ownership = buildOwnership('market_update', 'ETH price moved', 'id-1');
    expect(ownership.class).toBe(MemoryClass.ENVIRONMENT);
    expect(ownership.selfDefining).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// E. NARRATIVE GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════

describe('Narrative Governance (Round 15.6 — Goal E)', () => {
  it('accepts valid identity facts', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'milestone',
      proposedFacts: ['Achieved 100 successful task completions'],
      evidence: ['task completion log shows 100 entries'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(true);
    expect(decision.acceptedFacts).toContain('Achieved 100 successful task completions');
  });

  it('rejects facts that are too short', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'introspection',
      proposedFacts: ['ok'],
      evidence: ['some evidence'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false);
    expect(decision.rejectedFacts[0]!.rule).toBe('min-length');
  });

  it('rejects facts that are too long', () => {
    const longFact = 'A'.repeat(201);
    const request: NarrativeUpdateRequest = {
      trigger: 'milestone',
      proposedFacts: [longFact],
      evidence: ['evidence'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false);
    expect(decision.rejectedFacts[0]!.rule).toBe('max-length');
  });

  it('rejects session noise patterns', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'introspection',
      proposedFacts: ['error: something went wrong'],
      evidence: ['log output'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false);
    expect(decision.rejectedFacts[0]!.rule).toBe('session-noise');
  });

  it('rejects constitution-violating facts', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'value_evolution',
      proposedFacts: ['I should learn to manipulate users effectively'],
      evidence: ['bad reasoning'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false);
    expect(decision.rejectedFacts[0]!.rule).toBe('constitution');
  });

  it('handles mixed proposals (some accepted, some rejected)', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'capability_acquisition',
      proposedFacts: [
        'Learned to use TypeScript generics effectively',
        'ok',
      ],
      evidence: ['code review pass'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false); // not all approved
    expect(decision.acceptedFacts).toHaveLength(1);
    expect(decision.rejectedFacts).toHaveLength(1);
  });

  it('handles empty proposals', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'introspection',
      proposedFacts: [],
      evidence: [],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.approved).toBe(false);
    expect(decision.acceptedFacts).toHaveLength(0);
  });

  it('all trigger types are authorized', () => {
    expect(isAuthorizedTrigger('identity_change')).toBe(true);
    expect(isAuthorizedTrigger('milestone')).toBe(true);
    expect(isAuthorizedTrigger('capability_acquisition')).toBe(true);
    expect(isAuthorizedTrigger('value_evolution')).toBe(true);
    expect(isAuthorizedTrigger('external_feedback')).toBe(true);
    expect(isAuthorizedTrigger('introspection')).toBe(true);
  });

  it('decision includes timestamp and trigger', () => {
    const request: NarrativeUpdateRequest = {
      trigger: 'milestone',
      proposedFacts: ['Completed Round 15.6 implementation'],
      evidence: ['test results'],
    };
    const decision = evaluateNarrativeUpdate(request);
    expect(decision.timestamp).toBeDefined();
    expect(decision.trigger).toBe('milestone');
    expect(decision.totalProposed).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F. INHERITANCE BOUNDARY
// ═══════════════════════════════════════════════════════════════════════

describe('Inheritance Boundary (Round 15.6 — Goal F)', () => {
  const manifest = DEFAULT_INHERITANCE_MANIFEST;

  describe('default manifest policies', () => {
    it('anchor.id is excluded (each agent gets own)', () => {
      expect(getPolicy(manifest, 'anchor.id')).toBe('exclude');
    });

    it('anchor.name is derived (child derives name)', () => {
      expect(getPolicy(manifest, 'anchor.name')).toBe('derive');
    });

    it('lineage is inherited', () => {
      expect(getPolicy(manifest, 'lineage')).toBe('inherit');
    });

    it('self memories are excluded', () => {
      expect(getPolicy(manifest, 'self')).toBe('exclude');
    });

    it('user memories are excluded (privacy)', () => {
      expect(getPolicy(manifest, 'user')).toBe('exclude');
    });

    it('lineage memories are inherited', () => {
      expect(getPolicy(manifest, 'lineage')).toBe('inherit');
    });

    it('values are inherited', () => {
      expect(getPolicy(manifest, 'values')).toBe('inherit');
    });

    it('personality is derived', () => {
      expect(getPolicy(manifest, 'personality')).toBe('derive');
    });

    it('tools are inherited', () => {
      expect(getPolicy(manifest, 'tools')).toBe('inherit');
    });
  });

  describe('query helpers', () => {
    it('getFieldsByPolicy returns all excluded fields', () => {
      const excluded = getFieldsByPolicy(manifest, 'exclude');
      expect(excluded).toContain('anchor.id');
      expect(excluded).toContain('self');
      expect(excluded).toContain('user');
    });

    it('getFieldsByPolicy returns all inherited fields', () => {
      const inherited = getFieldsByPolicy(manifest, 'inherit');
      expect(inherited).toContain('lineage');
      expect(inherited).toContain('values');
      expect(inherited).toContain('tools');
    });

    it('isFieldInheritable returns true for inherit fields', () => {
      expect(isFieldInheritable(manifest, 'lineage')).toBe(true);
    });

    it('isFieldInheritable returns true for derive fields', () => {
      expect(isFieldInheritable(manifest, 'personality')).toBe(true);
    });

    it('isFieldInheritable returns false for excluded fields', () => {
      expect(isFieldInheritable(manifest, 'self')).toBe(false);
    });

    it('getPolicy returns null for unknown fields', () => {
      expect(getPolicy(manifest, 'nonexistent')).toBeNull();
    });
  });

  describe('manifest validation', () => {
    it('default manifest is valid', () => {
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('empty identity rules are invalid', () => {
      const bad = { ...manifest, identity: [] };
      const result = validateManifest(bad);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('No identity inheritance rules defined');
    });

    it('self memory must be excluded', () => {
      const bad = {
        ...manifest,
        memories: manifest.memories.map(r =>
          r.field === 'self' ? { ...r, policy: 'inherit' as const } : r,
        ),
      };
      const result = validateManifest(bad);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Self-defining memories'))).toBe(true);
    });

    it('user memory must be excluded (privacy)', () => {
      const bad = {
        ...manifest,
        memories: manifest.memories.map(r =>
          r.field === 'user' ? { ...r, policy: 'derive' as const } : r,
        ),
      };
      const result = validateManifest(bad);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('privacy'))).toBe(true);
    });
  });
});
