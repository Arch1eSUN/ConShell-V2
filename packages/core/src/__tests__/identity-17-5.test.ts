/**
 * Round 17.5 — Identity-Governance Migration Closure Verification Matrix
 *
 * V1:  revoked identity → proposal_invalid (not throw)
 * V2:  governance test suite passes (0 regressions)
 * V3:  proposal_invalid vs deny vs execution_failure 三分明确
 * V4:  initiation receipt semantics correct
 * V5:  restoreRecords rejects invalid snapshot
 * V6:  chain integrity detects broken chain
 * V7:  revoked identity → claims immediately invalidated
 * V8:  rotated identity → capability inherit + service revoke
 * V9:  reassignIssuer correctly migrates claims
 * V10: restoreRecordsHardened validates active count
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceService, type GovernanceServiceOptions } from '../governance/governance-service.js';
import { isExecutableVerdict } from '../governance/governance-verdict.js';
import { ClaimRegistry, ClaimIssuer } from '../identity/identity-claims.js';
import {
  createGenesisRecord, restoreRecords,
  restoreRecordsHardened, serializeRecords,
  rotateIdentity, revokeIdentity,
  type IdentityRecord,
} from '../identity/identity-lifecycle.js';

// ── Mock Factories ────────────────────────────────────────────────────

function createMockIdentity(status: 'active' | 'degraded' | 'revoked' = 'active') {
  return {
    status: () => status,
    selfFingerprint: () => 'fp_175_test',
  };
}

function createMockPolicy() {
  return {
    evaluate: () => ({ decision: 'allow' as const, rule: 'default-allow', reason: 'mock', category: 'security' as const }),
  };
}

const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any;

function createGovService(overrides: Partial<GovernanceServiceOptions> = {}): GovernanceService {
  return new GovernanceService({
    identity: createMockIdentity(),
    policy: createMockPolicy(),
    logger: mockLogger,
    ...overrides,
  });
}

function makeRecord(overrides: Partial<IdentityRecord>): IdentityRecord {
  return {
    id: 'rec_1',
    version: 1,
    status: 'active',
    anchorId: 'anchor_1',
    name: 'test-agent',
    soulHash: 'abc123',
    previousRecordId: null,
    successorRecordId: null,
    createdAt: new Date().toISOString(),
    retiredAt: null,
    retirementReason: null,
    walletAddress: null,
    publicClaimsHash: null,
    keyFingerprint: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// V1: REVOKED IDENTITY → PROPOSAL_INVALID (NOT THROW)
// ══════════════════════════════════════════════════════════════════════

describe('V1: proposal_invalid semantics', () => {
  it('revoked identity produces proposal_invalid, not throw', () => {
    const svc = createGovService({ identity: createMockIdentity('revoked') });
    // Should NOT throw
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    expect(p.status).toBe('proposal_invalid');
    expect(p.denialLayer).toBe('identity');
    expect(p.denialReason).toContain('revoked');
  });

  it('proposal_invalid is terminal — cannot evaluate', () => {
    const svc = createGovService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    expect(() => svc.evaluate(p.id)).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════
// V3: PROPOSAL_INVALID VS DENY VS EXECUTION_FAILURE — 三分明确
// ══════════════════════════════════════════════════════════════════════

describe('V3: three-way distinction', () => {
  it('proposal_invalid: revoked at initiation', () => {
    const svc = createGovService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    expect(p.status).toBe('proposal_invalid');
  });

  it('deny: policy denies at evaluation', () => {
    const svc = createGovService({
      policy: { evaluate: () => ({ decision: 'deny' as const, rule: 'deny-all', reason: 'policy', category: 'security' }) },
    });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    const v = svc.evaluate(p.id);
    expect(v.code).toBe('deny');
    expect(svc.getProposal(p.id)?.status).toBe('denied');
  });

  it('allow: normal active identity path', () => {
    const svc = createGovService();
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    const v = svc.evaluate(p.id);
    expect(v.code).toBe('allow');
    expect(isExecutableVerdict(v)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V4: INITIATION RECEIPT SEMANTICS
// ══════════════════════════════════════════════════════════════════════

describe('V4: initiation receipt', () => {
  it('proposal_invalid generates initiation phase receipt', () => {
    const svc = createGovService({ identity: createMockIdentity('revoked') });
    const p = svc.propose({ actionKind: 'selfmod', target: 'x', justification: 'test' });
    const receipts = svc.getReceipts(p.id);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.phase).toBe('initiation');
    expect(receipts[0]!.result).toBe('failure');
    expect(receipts[0]!.reason).toContain('revoked');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V5: RESTORE RECORDS REJECTS INVALID SNAPSHOT
// ══════════════════════════════════════════════════════════════════════

describe('V5: restoreRecords rejects invalid', () => {
  it('null snapshot returns null', () => {
    expect(restoreRecords(null)).toBeNull();
  });

  it('wrong version returns null', () => {
    expect(restoreRecords({ version: 99, records: [] })).toBeNull();
  });

  it('missing required fields returns null', () => {
    const snapshot = {
      version: 1,
      records: [{ id: 'x', version: 1 }], // missing status, anchorId etc
    };
    expect(restoreRecords(snapshot)).toBeNull();
  });

  it('invalid status returns null', () => {
    const snapshot = {
      version: 1,
      records: [makeRecord({ status: 'garbage' as any })],
    };
    expect(restoreRecords(snapshot)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// V6: CHAIN INTEGRITY DETECTS BROKEN CHAIN
// ══════════════════════════════════════════════════════════════════════

describe('V6: chain integrity', () => {
  it('Valid chain passes', () => {
    const r1 = makeRecord({ id: 'r1', version: 1, status: 'rotated', previousRecordId: null });
    const r2 = makeRecord({ id: 'r2', version: 2, status: 'active', previousRecordId: 'r1' });
    const snapshot = { version: 1, records: [r1, r2], snapshotAt: new Date().toISOString() };
    const result = restoreRecordsHardened(snapshot);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Broken previousRecordId detected', () => {
    const r1 = makeRecord({ id: 'r1', version: 1, status: 'rotated', previousRecordId: null });
    const r2 = makeRecord({ id: 'r2', version: 2, status: 'active', previousRecordId: 'WRONG' });
    const snapshot = { version: 1, records: [r1, r2], snapshotAt: new Date().toISOString() };
    const result = restoreRecordsHardened(snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('Chain break'))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V7: REVOKED IDENTITY → CLAIMS IMMEDIATELY INVALIDATED
// ══════════════════════════════════════════════════════════════════════

describe('V7: revoke invalidates claims', () => {
  it('revokeByIssuer revokes all claims from identity', () => {
    const registry = new ClaimRegistry();
    const provider = {
      status: () => 'active',
      getActiveRecord: () => ({ id: 'id_1' }),
    };
    const issuer = new ClaimIssuer(provider);

    const c1 = issuer.issueCapabilityClaim({ subject: 'mcp', scope: 'runtime' });
    const c2 = issuer.issueServiceClaim({ subject: 'text-gen', scope: 'public', endpoint: '/api' });
    registry.register(c1);
    registry.register(c2);

    expect(registry.getActiveClaims()).toHaveLength(2);

    registry.revokeByIssuer('id_1');
    expect(registry.getActiveClaims()).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// V8: ROTATED IDENTITY → CAPABILITY INHERIT + SERVICE REVOKE
// ══════════════════════════════════════════════════════════════════════

describe('V8: rotation claim lifecycle', () => {
  it('capability claims reassigned, service claims revoked', () => {
    const registry = new ClaimRegistry();
    const provider = {
      status: () => 'active',
      getActiveRecord: () => ({ id: 'old_id' }),
    };
    const issuer = new ClaimIssuer(provider);

    const cap = issuer.issueCapabilityClaim({ subject: 'mcp', scope: 'runtime' });
    const svc = issuer.issueServiceClaim({ subject: 'text-gen', scope: 'public', endpoint: '/api' });
    registry.register(cap);
    registry.register(svc);

    // Simulate rotation: reassign capability, revoke service
    registry.reassignIssuer('old_id', 'new_id', 'capability');
    for (const claim of registry.getByIssuer('old_id')) {
      if (claim.claimType === 'service' && !claim.revoked) {
        registry.revoke(claim.claimId);
      }
    }

    const active = registry.getActiveClaims();
    expect(active).toHaveLength(1);
    expect(active[0]!.claimType).toBe('capability');
    expect(active[0]!.issuerIdentityId).toBe('new_id');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V9: REASSIGN ISSUER CORRECTLY MIGRATES
// ══════════════════════════════════════════════════════════════════════

describe('V9: reassignIssuer', () => {
  it('reassigns only matching claim type', () => {
    const registry = new ClaimRegistry();
    const provider = {
      status: () => 'active',
      getActiveRecord: () => ({ id: 'src_id' }),
    };
    const issuer = new ClaimIssuer(provider);

    const c1 = issuer.issueCapabilityClaim({ subject: 'mcp', scope: 'runtime' });
    const c2 = issuer.issueServiceClaim({ subject: 'text', scope: 'public', endpoint: '/api' });
    registry.register(c1);
    registry.register(c2);

    const count = registry.reassignIssuer('src_id', 'dst_id', 'capability');
    expect(count).toBe(1);

    // Capability reassigned
    const caps = registry.getByType('capability');
    expect(caps[0]!.issuerIdentityId).toBe('dst_id');

    // Service unchanged
    const svcs = registry.getByType('service');
    expect(svcs[0]!.issuerIdentityId).toBe('src_id');
  });
});

// ══════════════════════════════════════════════════════════════════════
// V10: RESTORE HARDENED VALIDATES ACTIVE COUNT
// ══════════════════════════════════════════════════════════════════════

describe('V10: active count validation', () => {
  it('rejects snapshot with multiple active records', () => {
    const r1 = makeRecord({ id: 'r1', version: 1, status: 'active', previousRecordId: null });
    const r2 = makeRecord({ id: 'r2', version: 2, status: 'active', previousRecordId: 'r1' });
    const snapshot = { version: 1, records: [r1, r2], snapshotAt: new Date().toISOString() };
    const result = restoreRecordsHardened(snapshot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes('active records'))).toBe(true);
  });

  it('accepts snapshot with 0 active records (all revoked)', () => {
    const r1 = makeRecord({ id: 'r1', version: 1, status: 'revoked', previousRecordId: null });
    const snapshot = { version: 1, records: [r1], snapshotAt: new Date().toISOString() };
    const result = restoreRecordsHardened(snapshot);
    expect(result.valid).toBe(true);
  });
});
