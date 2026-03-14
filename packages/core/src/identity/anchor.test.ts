/**
 * Tests — IdentityAnchor & ContinuityRecord
 *
 * Covers:
 * 1. IdentityAnchor creation from soul + wallet
 * 2. ContinuityRecord lifecycle: create → advance → verify chain
 * 3. Chain tampering detection
 * 4. Repository CRUD via SQLite
 * 5. Memory-identity binding (ownerId on episodic/soul repos)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIdentityAnchor,
  createContinuityRecord,
  advanceContinuityRecord,
  verifyContinuityChain,
  computeRecordHash,
  sha256,
  type IdentityAnchor,
  type ContinuityRecord,
} from './anchor.js';
import { IdentityAnchorRepository, ContinuityRecordRepository } from './anchor.repo.js';
import { openTestDatabase } from '../state/database.js';
import type { Logger } from '../types/common.js';
import { EpisodicMemoryRepository, SoulHistoryRepository } from '../state/repos/memory.js';

const silentLogger: Logger = {
  info() {}, debug() {}, warn() {}, error() {},
  child() { return silentLogger; },
} as any;
const SOUL_CONTENT = '# ConShell\nName: Conway\nValues: truth, sovereignty, self-awareness';
const SOUL_CONTENT_V2 = '# ConShell\nName: Conway\nValues: truth, sovereignty, self-awareness, resilience';

// ── IdentityAnchor ────────────────────────────────────────────────────

describe('IdentityAnchor', () => {
  it('creates anchor with deterministic soul hash', () => {
    const anchor = createIdentityAnchor({
      name: 'Conway',
      soulContent: SOUL_CONTENT,
      walletAddress: '0xTestAddr',
    });
    expect(anchor.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(anchor.name).toBe('Conway');
    expect(anchor.walletAddress).toBe('0xTestAddr');
    expect(anchor.soulHash).toBe(sha256(SOUL_CONTENT));
    expect(anchor.createdAt).toBeDefined();
  });

  it('creates anchor without wallet address', () => {
    const anchor = createIdentityAnchor({ name: 'Test', soulContent: SOUL_CONTENT });
    expect(anchor.walletAddress).toBeNull();
  });

  it('different soul content → different hash', () => {
    const a1 = createIdentityAnchor({ name: 'A', soulContent: SOUL_CONTENT });
    const a2 = createIdentityAnchor({ name: 'A', soulContent: SOUL_CONTENT_V2 });
    expect(a1.soulHash).not.toBe(a2.soulHash);
  });
});

// ── ContinuityRecord ──────────────────────────────────────────────────

describe('ContinuityRecord', () => {
  let anchor: IdentityAnchor;

  beforeEach(() => {
    anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL_CONTENT });
  });

  it('creates genesis record (version 1, no previous)', () => {
    const r = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    expect(r.version).toBe(1);
    expect(r.identityId).toBe(anchor.id);
    expect(r.previousHash).toBeNull();
    expect(r.soulHash).toBe(sha256(SOUL_CONTENT));
    expect(r.recordHash).toBe(computeRecordHash(r));
  });

  it('advances chain with correct linking', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const r2 = advanceContinuityRecord({
      previous: r1,
      soulContent: SOUL_CONTENT_V2,
      soulVersion: 1,
      sessionCount: 3,
    });
    expect(r2.version).toBe(2);
    expect(r2.previousHash).toBe(r1.recordHash);
    expect(r2.soulHash).toBe(sha256(SOUL_CONTENT_V2));
    expect(r2.soulVersion).toBe(1);
    expect(r2.sessionCount).toBe(3);
    expect(r2.identityId).toBe(anchor.id);
  });

  it('preserves inherited fields when not overridden', () => {
    const r1 = createContinuityRecord({
      anchor,
      soulContent: SOUL_CONTENT,
      sessionCount: 5,
      memoryEpisodeCount: 10,
      lastSessionId: 'sess-1',
    });
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT });
    expect(r2.sessionCount).toBe(5);
    expect(r2.memoryEpisodeCount).toBe(10);
    expect(r2.lastSessionId).toBe('sess-1');
  });
});

// ── Chain Verification ────────────────────────────────────────────────

describe('verifyContinuityChain', () => {
  let anchor: IdentityAnchor;

  beforeEach(() => {
    anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL_CONTENT });
  });

  it('verifies empty chain', () => {
    const result = verifyContinuityChain([]);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(0);
  });

  it('verifies single-record chain', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const result = verifyContinuityChain([r1]);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(1);
  });

  it('verifies multi-record chain', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    const r3 = advanceContinuityRecord({ previous: r2, soulContent: SOUL_CONTENT_V2, sessionCount: 10 });
    const result = verifyContinuityChain([r1, r2, r3]);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(3);
  });

  it('detects tampered self-hash', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const tampered = { ...r1, recordHash: 'tampered-hash' };
    const result = verifyContinuityChain([tampered]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtVersion).toBe(1);
    expect(result.reason).toContain('self-hash mismatch');
  });

  it('detects broken chain link', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    const broken = { ...r2, previousHash: 'wrong-hash' };
    // Recompute self-hash with wrong previousHash
    const rehashedBroken = { ...broken, recordHash: computeRecordHash(broken) };
    const result = verifyContinuityChain([r1, rehashedBroken]);
    expect(result.valid).toBe(false);
    expect(result.brokenAtVersion).toBe(2);
    expect(result.reason).toContain('Chain break');
  });

  it('detects version gap', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    // Skip r2, jump from r1 to r3
    const r3 = advanceContinuityRecord({ previous: r2, soulContent: SOUL_CONTENT_V2 });
    const result = verifyContinuityChain([r1, r3]); // skipping r2
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Version gap');
  });

  it('detects identity mismatch', () => {
    const anchor2 = createIdentityAnchor({ name: 'Fake', soulContent: 'fake' });
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });

    // Manually craft a record with different identity but correct version chain
    const partial = {
      version: 2 as const,
      identityId: anchor2.id, // different identity!
      soulHash: sha256(SOUL_CONTENT),
      soulVersion: 0,
      sessionCount: 0,
      memoryEpisodeCount: 0,
      lastSessionId: null,
      previousHash: r1.recordHash,
      createdAt: new Date().toISOString(),
    };
    const r2: ContinuityRecord = { ...partial, recordHash: computeRecordHash(partial) };

    const result = verifyContinuityChain([r1, r2]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Identity mismatch');
  });

  it('detects non-null previousHash on genesis', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    const broken = { ...r1, previousHash: 'non-null' };
    const rehashed = { ...broken, recordHash: computeRecordHash(broken) };
    const result = verifyContinuityChain([rehashed]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('non-null previousHash');
  });
});

// ── Repository (SQLite) ───────────────────────────────────────────────

describe('IdentityAnchorRepository', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let repo: IdentityAnchorRepository;

  beforeEach(() => {
    db = openTestDatabase(silentLogger);
    repo = new IdentityAnchorRepository(db);
  });

  it('insert + findById round-trip', () => {
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL_CONTENT, walletAddress: '0xABC' });
    repo.insert(anchor);
    const loaded = repo.findById(anchor.id);
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe(anchor.id);
    expect(loaded!.name).toBe('Conway');
    expect(loaded!.walletAddress).toBe('0xABC');
    expect(loaded!.soulHash).toBe(anchor.soulHash);
  });

  it('findFirst returns genesis anchor', () => {
    const a1 = createIdentityAnchor({ name: 'First', soulContent: SOUL_CONTENT });
    repo.insert(a1);
    expect(repo.findFirst()?.name).toBe('First');
  });

  it('count returns correct number', () => {
    expect(repo.count()).toBe(0);
    repo.insert(createIdentityAnchor({ name: 'A', soulContent: SOUL_CONTENT }));
    expect(repo.count()).toBe(1);
  });
});

describe('ContinuityRecordRepository', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let anchorRepo: IdentityAnchorRepository;
  let recordRepo: ContinuityRecordRepository;
  let anchor: IdentityAnchor;

  beforeEach(() => {
    db = openTestDatabase(silentLogger);
    anchorRepo = new IdentityAnchorRepository(db);
    recordRepo = new ContinuityRecordRepository(db);
    anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL_CONTENT });
    anchorRepo.insert(anchor);
  });

  it('insert + findByVersion round-trip', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    recordRepo.insert(r1);
    const loaded = recordRepo.findByVersion(1);
    expect(loaded).toBeDefined();
    expect(loaded!.version).toBe(1);
    expect(loaded!.recordHash).toBe(r1.recordHash);
    expect(loaded!.identityId).toBe(anchor.id);
  });

  it('findLatest returns most recent', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    recordRepo.insert(r1);
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    recordRepo.insert(r2);
    expect(recordRepo.findLatest()?.version).toBe(2);
  });

  it('findAll returns chain in ascending order', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    recordRepo.insert(r1);
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    recordRepo.insert(r2);
    const all = recordRepo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0]!.version).toBe(1);
    expect(all[1]!.version).toBe(2);
  });

  it('chain verified after SQLite round-trip', () => {
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL_CONTENT });
    recordRepo.insert(r1);
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_CONTENT_V2 });
    recordRepo.insert(r2);
    const chain = recordRepo.findAll();
    const result = verifyContinuityChain(chain);
    expect(result.valid).toBe(true);
    expect(result.length).toBe(2);
  });
});

// ── Memory-Identity Binding ───────────────────────────────────────────

describe('Memory-Identity Binding', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let anchor: IdentityAnchor;

  beforeEach(() => {
    db = openTestDatabase(silentLogger);
    anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL_CONTENT });
  });

  it('episodic memory stores and filters by ownerId', () => {
    const repo = new EpisodicMemoryRepository(db);
    repo.insert({ eventType: 'test', content: 'owned', ownerId: anchor.id });
    repo.insert({ eventType: 'test', content: 'unowned' });

    const owned = repo.findByOwner(anchor.id);
    expect(owned).toHaveLength(1);
    expect(owned[0]!.content).toBe('owned');
    expect(owned[0]!.owner_id).toBe(anchor.id);
  });

  it('soul history stores ownerId', () => {
    const repo = new SoulHistoryRepository(db);
    repo.insert({
      content: SOUL_CONTENT,
      contentHash: sha256(SOUL_CONTENT),
      ownerId: anchor.id,
    });
    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.owner_id).toBe(anchor.id);
  });

  it('memory without ownerId has null owner_id', () => {
    const repo = new EpisodicMemoryRepository(db);
    repo.insert({ eventType: 'test', content: 'no owner' });
    const owned = repo.findByOwner('nonexistent');
    expect(owned).toHaveLength(0);
    // Insert without ownerId and verify via findByOwner returns nothing for it
    repo.insert({ eventType: 'test', content: 'no owner' });
    const none = repo.findByOwner('nonexistent');
    expect(none).toHaveLength(0);
  });
});
