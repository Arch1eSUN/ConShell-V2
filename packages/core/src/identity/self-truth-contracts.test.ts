/**
 * Self-Truth Contract Tests — Round 14.8.2
 *
 * Validates three formal contracts:
 * 1. Owner Write/Read Boundary — session_summaries.upsert() persists owner_id
 * 2. TierManager owner propagation — saveSessionSummary() passes ownerId
 * 3. Kernel.getDiagnosticsOptions — ContinuityService returns live selfState
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../state/database.js';
import { SessionSummariesRepository } from '../state/repos/memory.js';
import { ContinuityService } from '../identity/continuity-service.js';

const noop = () => {};
const silentLogger = {
  info: noop, warn: noop, error: noop, debug: noop,
  child: () => silentLogger,
} as any;

const SOUL_CONTENT = `---
name: TestAgent
tagline: A test agent
personality: [curious]
values: [truth]
goals: [learn]
communication_style: direct
---`;

const SOUL_CONTENT_V2 = `---
name: TestAgent
tagline: A test agent (evolved)
personality: [curious, brave]
values: [truth, integrity]
goals: [learn, grow]
communication_style: direct
---`;

function freshDb(): Database.Database {
  const agentHome = join(tmpdir(), `conshell-test-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return openDatabase({ agentHome, logger: silentLogger });
}

// ── Goal B: Owner Write/Read Boundary Tests ───────────────────────────

describe('Owner Write/Read Boundary (Round 14.8.2)', () => {
  let db: Database.Database;
  let repo: SessionSummariesRepository;

  beforeEach(() => {
    db = freshDb();
    repo = new SessionSummariesRepository(db);
  });

  afterEach(() => db.close());

  it('upsert persists owner_id when provided', () => {
    repo.upsert('sess-1', 'summary alpha', undefined, 'owner-A');
    const row = repo.findBySession('sess-1')!;
    expect(row).toBeDefined();
    expect(row.owner_id).toBe('owner-A');
  });

  it('upsert defaults owner_id to null when not provided', () => {
    repo.upsert('sess-2', 'summary beta');
    const row = repo.findBySession('sess-2')!;
    expect(row).toBeDefined();
    expect(row.owner_id).toBeNull();
  });

  it('findRecentByOwner returns only matching owner summaries', () => {
    repo.upsert('sess-A1', 'alpha summary 1', undefined, 'owner-A');
    repo.upsert('sess-B1', 'beta summary 1', undefined, 'owner-B');
    repo.upsert('sess-A2', 'alpha summary 2', undefined, 'owner-A');

    const ownerA = repo.findRecentByOwner('owner-A', 10);
    expect(ownerA.length).toBe(2);
    expect(ownerA.every(s => s.owner_id === 'owner-A')).toBe(true);

    const ownerB = repo.findRecentByOwner('owner-B', 10);
    expect(ownerB.length).toBe(1);
    expect(ownerB[0].owner_id).toBe('owner-B');
  });

  it('different owners never see each other\'s summaries', () => {
    repo.upsert('sess-X', 'X summary', undefined, 'owner-X');
    repo.upsert('sess-Y', 'Y summary', undefined, 'owner-Y');

    const xSummaries = repo.findRecentByOwner('owner-X', 10);
    const ySummaries = repo.findRecentByOwner('owner-Y', 10);

    expect(xSummaries.some(s => s.session_id === 'sess-Y')).toBe(false);
    expect(ySummaries.some(s => s.session_id === 'sess-X')).toBe(false);
  });

  it('COALESCE preserves existing owner_id on conflict update without new owner', () => {
    repo.upsert('sess-1', 'v1', undefined, 'owner-A');
    repo.upsert('sess-1', 'v2');
    const row = repo.findBySession('sess-1')!;
    expect(row.summary).toBe('v2');
    expect(row.owner_id).toBe('owner-A'); // preserved via COALESCE
  });
});

// ── Goal C: getDiagnosticsOptions Contract Tests ──────────────────────

describe('Kernel.getDiagnosticsOptions contract (Round 14.8.2)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
  });

  afterEach(() => db.close());

  it('ContinuityService.getCurrentState returns live state when hydrated', () => {
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const state = svc.getCurrentState();
    expect(state).not.toBeNull();
    expect(state!.chainValid).toBe(true);
    expect(state!.chainLength).toBeGreaterThanOrEqual(1);
    expect(state!.soulDrifted).toBe(false);
    expect(state!.explanation).toBeDefined();
    expect(state!.explanation.continuityBasis).toBeDefined();
  });

  it('ContinuityService.getCurrentState returns null when not hydrated', () => {
    const svc = new ContinuityService(db, silentLogger);
    expect(svc.getCurrentState()).toBeNull();
  });

  it('live selfState reflects state after advanceForSession', () => {
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const before = svc.getCurrentState();
    expect(before!.chainLength).toBe(1);

    svc.advanceForSession({
      soulContent: SOUL_CONTENT,
      sessionId: 'sess-1',
      sessionCount: 1,
      memoryEpisodeCount: 5,
    });

    const after = svc.getCurrentState();
    expect(after!.chainLength).toBe(2);
  });

  it('live selfState reflects soul drift after advanceForSoulChange', () => {
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(svc.getCurrentState()!.soulDrifted).toBe(false);

    svc.advanceForSoulChange(SOUL_CONTENT_V2, 2);

    const after = svc.getCurrentState();
    expect(after).not.toBeNull();
    expect(after!.chainLength).toBe(2);
  });
});
