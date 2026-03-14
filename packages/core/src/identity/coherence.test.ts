/**
 * Integration test — Doctor Identity Coherence Checks
 *
 * Validates the Doctor's identity-coherence detection:
 * 1. No anchor → warns
 * 2. Anchor + valid chain → passes
 * 3. Broken chain → blocker
 * 4. Soul drift detection
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDatabase } from '../state/database.js';
import type { Logger } from '../types/common.js';
import {
  createIdentityAnchor,
  createContinuityRecord,
  advanceContinuityRecord,
  sha256,
} from './anchor.js';
import { IdentityAnchorRepository, ContinuityRecordRepository } from './anchor.repo.js';
import { checkIdentityCoherence } from '../doctor/checks/identity.js';

const silentLogger: Logger = {
  info() {}, debug() {}, warn() {}, error() {},
  child() { return silentLogger; },
} as any;
const SOUL = '# Agent\nName: Conway';
const SOUL_V2 = '# Agent\nName: Conway\nEvolved: true';

describe('Doctor — Identity Coherence Checks', () => {
  let db: ReturnType<typeof openTestDatabase>;

  beforeEach(() => {
    db = openTestDatabase(silentLogger);
  });

  it('warns when no anchor exists', () => {
    const results = checkIdentityCoherence(db, SOUL);
    const anchorCheck = results.find(c => c.id === 'identity-anchor-exists');
    expect(anchorCheck?.status).toBe('warn');
    expect(anchorCheck?.severity).toBe('warning');
  });

  it('warns when no continuity records', () => {
    const anchorRepo = new IdentityAnchorRepository(db);
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL });
    anchorRepo.insert(anchor);

    const results = checkIdentityCoherence(db, SOUL);
    const anchorCheck = results.find(c => c.id === 'identity-anchor-exists');
    const chainCheck = results.find(c => c.id === 'continuity-chain-valid');
    expect(anchorCheck?.status).toBe('pass');
    expect(chainCheck?.status).toBe('warn');
  });

  it('passes with valid anchor + chain + aligned soul', () => {
    const anchorRepo = new IdentityAnchorRepository(db);
    const recordRepo = new ContinuityRecordRepository(db);
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL });
    anchorRepo.insert(anchor);
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL });
    recordRepo.insert(r1);

    const results = checkIdentityCoherence(db, SOUL);
    expect(results.every(c => c.status === 'pass')).toBe(true);
  });

  it('detects soul drift (SOUL changed since last record)', () => {
    const anchorRepo = new IdentityAnchorRepository(db);
    const recordRepo = new ContinuityRecordRepository(db);
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL });
    anchorRepo.insert(anchor);
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL });
    recordRepo.insert(r1);

    // Check with different soul content (simulating evolution without chain advance)
    const results = checkIdentityCoherence(db, SOUL_V2);
    const soulCheck = results.find(c => c.id === 'soul-anchor-aligned');
    expect(soulCheck?.status).toBe('warn');
    expect(soulCheck?.summary).toContain('advance the chain');
  });

  it('detects broken chain as blocker', () => {
    const anchorRepo = new IdentityAnchorRepository(db);
    const recordRepo = new ContinuityRecordRepository(db);
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL });
    anchorRepo.insert(anchor);
    const r1 = createContinuityRecord({ anchor, soulContent: SOUL });
    recordRepo.insert(r1);
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL_V2 });
    recordRepo.insert(r2);

    // Tamper with r1 in the database directly
    db.prepare('UPDATE continuity_records SET record_hash = ? WHERE version = ?')
      .run('tampered', 1);

    const results = checkIdentityCoherence(db, SOUL_V2);
    const chainCheck = results.find(c => c.id === 'continuity-chain-valid');
    expect(chainCheck?.status).toBe('fail');
    expect(chainCheck?.severity).toBe('blocker');
  });

  it('warns when no soul content provided', () => {
    const results = checkIdentityCoherence(db);
    const soulCheck = results.find(c => c.id === 'soul-anchor-aligned');
    expect(soulCheck?.status).toBe('warn');
    expect(soulCheck?.summary).toContain('No SOUL content');
  });

  it('multi-record chain verified correctly after advances', () => {
    const anchorRepo = new IdentityAnchorRepository(db);
    const recordRepo = new ContinuityRecordRepository(db);
    const anchor = createIdentityAnchor({ name: 'Conway', soulContent: SOUL });
    anchorRepo.insert(anchor);

    const r1 = createContinuityRecord({ anchor, soulContent: SOUL });
    recordRepo.insert(r1);
    const r2 = advanceContinuityRecord({ previous: r1, soulContent: SOUL, sessionCount: 1 });
    recordRepo.insert(r2);
    const r3 = advanceContinuityRecord({ previous: r2, soulContent: SOUL, sessionCount: 5, memoryEpisodeCount: 20 });
    recordRepo.insert(r3);

    const results = checkIdentityCoherence(db, SOUL);
    const chainCheck = results.find(c => c.id === 'continuity-chain-valid');
    expect(chainCheck?.status).toBe('pass');
    expect(chainCheck?.summary).toContain('3 record(s)');
  });
});
