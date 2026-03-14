/**
 * ContinuityService — Comprehensive Test Suite (Round 14.5)
 *
 * Covers all 7 scenarios from the dev plan:
 * 1. Genesis bootstrap — fresh DB creates anchor + first record
 * 2. Restart hydration — existing anchor loads same self
 * 3. Continuity advance (soul) — soul change extends chain
 * 4. Session continuity — session finalize extends chain
 * 5. Soul lifecycle — evolve callback triggers advance
 * 6. Recovery truth — broken chain enters degraded mode
 * 7. Lineage compatibility — parentIdentityId/generation work
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDatabase } from '../state/database.js';
import { ContinuityService } from './continuity-service.js';
import {
  createIdentityAnchor,
  createContinuityRecord,
  advanceContinuityRecord,
  sha256,
} from './anchor.js';
import { IdentityAnchorRepository, ContinuityRecordRepository } from './anchor.repo.js';
import { SoulSystem } from '../soul/system.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// ── Silent logger ────────────────────────────────────────────────────
const noop = () => {};
const silentLogger = {
  info: noop, debug: noop, warn: noop, error: noop,
  child: () => silentLogger,
} as any;

// ── Helper: fresh in-memory DB with migrations applied ─────────────
function freshDb(): Database.Database {
  const agentHome = join(tmpdir(), `conshell-test-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return openDatabase({ agentHome, logger: silentLogger });
}

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

// ══════════════════════════════════════════════════════════════════════
// 1. Genesis Bootstrap
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Genesis', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
  });

  it('creates anchor + first record on fresh DB', () => {
    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
      walletAddress: '0xABC',
    });

    expect(state.mode).toBe('genesis');
    expect(state.chainValid).toBe(true);
    expect(state.chainLength).toBe(1);
    expect(state.anchor.name).toBe('TestAgent');
    expect(state.anchor.soulHash).toBe(sha256(SOUL_CONTENT));
    expect(state.anchor.parentIdentityId).toBeNull();
    expect(state.anchor.generation).toBe(0);
    expect(state.latestRecord.version).toBe(1);
    expect(state.latestRecord.identityId).toBe(state.anchor.id);
  });

  it('persists anchor and record to DB', () => {
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
    });

    const anchorRepo = new IdentityAnchorRepository(db);
    const recordRepo = new ContinuityRecordRepository(db);

    expect(anchorRepo.count()).toBe(1);
    expect(recordRepo.count()).toBe(1);
  });

  it('marks service as hydrated', () => {
    const svc = new ContinuityService(db, silentLogger);
    expect(svc.hydrated).toBe(false);
    svc.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
    });
    expect(svc.hydrated).toBe(true);
    expect(svc.getCurrentState()).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Restart Hydration
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Restart', () => {
  it('loads existing self and enters restart mode', () => {
    const db = freshDb();

    // First boot = genesis
    const svc1 = new ContinuityService(db, silentLogger);
    const genesis = svc1.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
    });
    expect(genesis.mode).toBe('genesis');

    // Second boot = restart (same DB, new service instance)
    const svc2 = new ContinuityService(db, silentLogger);
    const restart = svc2.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
    });

    expect(restart.mode).toBe('restart');
    expect(restart.chainValid).toBe(true);
    expect(restart.anchor.id).toBe(genesis.anchor.id);
    expect(restart.latestRecord.version).toBe(genesis.latestRecord.version);
    expect(restart.chainLength).toBe(1);
  });

  it('does not create a new anchor on restart', () => {
    const db = freshDb();

    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const svc2 = new ContinuityService(db, silentLogger);
    svc2.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const anchorRepo = new IdentityAnchorRepository(db);
    expect(anchorRepo.count()).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Continuity Advance — Soul Change
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Soul Advance', () => {
  it('extends chain when soul changes', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const newRecord = svc.advanceForSoulChange(SOUL_CONTENT_V2, 2);

    expect(newRecord.version).toBe(2);
    expect(newRecord.soulHash).toBe(sha256(SOUL_CONTENT_V2));
    expect(newRecord.soulVersion).toBe(2);
    expect(newRecord.previousHash).not.toBeNull();

    const state = svc.getCurrentState()!;
    expect(state.chainLength).toBe(2);
    expect(state.latestRecord.version).toBe(2);
  });

  it('throws if not hydrated', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    expect(() => svc.advanceForSoulChange(SOUL_CONTENT, 1))
      .toThrow('ContinuityService not hydrated');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Session Continuity
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Session Advance', () => {
  it('extends chain with session data', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const sessionId = randomUUID();
    const newRecord = svc.advanceForSession({
      soulContent: SOUL_CONTENT,
      sessionId,
      sessionCount: 5,
      memoryEpisodeCount: 42,
    });

    expect(newRecord.version).toBe(2);
    expect(newRecord.sessionCount).toBe(5);
    expect(newRecord.lastSessionId).toBe(sessionId);
    expect(newRecord.memoryEpisodeCount).toBe(42);
  });

  it('chain remains valid after multiple advances', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Advance 5 times
    for (let i = 1; i <= 5; i++) {
      svc.advanceForSession({
        soulContent: SOUL_CONTENT,
        sessionId: randomUUID(),
        sessionCount: i,
      });
    }

    const state = svc.getCurrentState()!;
    expect(state.chainLength).toBe(6); // genesis + 5 advances
    expect(state.latestRecord.version).toBe(6);

    // Verify the persisted chain is valid by re-hydrating
    const svc2 = new ContinuityService(db, silentLogger);
    const restart = svc2.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });
    expect(restart.mode).toBe('restart');
    expect(restart.chainValid).toBe(true);
    expect(restart.chainLength).toBe(6);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Soul Lifecycle — Evolve Callback
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Soul Lifecycle Integration', () => {
  it('onSoulEvolved callback triggers advance', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Simulate what kernel does: wire evolve callback
    const onSoulEvolved = (raw: string, version: number) => {
      svc.advanceForSoulChange(raw, version);
    };

    // Simulate soul evolution
    onSoulEvolved(SOUL_CONTENT_V2, 1);

    const state = svc.getCurrentState()!;
    expect(state.chainLength).toBe(2);
    expect(state.latestRecord.soulHash).toBe(sha256(SOUL_CONTENT_V2));
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Recovery Truth — Degraded Mode
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Degraded Mode', () => {
  it('enters degraded when chain is broken (tampered hash)', () => {
    const db = freshDb();

    // Create valid genesis state
    const svc1 = new ContinuityService(db, silentLogger);
    const genesis = svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Advance once
    svc1.advanceForSoulChange(SOUL_CONTENT_V2, 2);

    // Tamper with record 1's hash directly in DB
    db.prepare('UPDATE continuity_records SET record_hash = ? WHERE version = 1')
      .run('TAMPERED_HASH');

    // Re-hydrate should detect broken chain
    const svc2 = new ContinuityService(db, silentLogger);
    const degraded = svc2.hydrate({ soulContent: SOUL_CONTENT_V2, soulName: 'TestAgent' });

    expect(degraded.mode).toBe('degraded');
    expect(degraded.chainValid).toBe(false);
    expect(degraded.chainBreakReason).toBeDefined();
  });

  it('enters degraded when anchor exists but no records', () => {
    const db = freshDb();

    // Manually insert anchor without records
    const anchor = createIdentityAnchor({
      name: 'TestAgent',
      soulContent: SOUL_CONTENT,
    });
    const anchorRepo = new IdentityAnchorRepository(db);
    anchorRepo.insert(anchor);

    // Hydrate should detect missing records and create recovery record
    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.mode).toBe('degraded');
    expect(state.chainValid).toBe(false);
    expect(state.chainBreakReason).toContain('recovery record');
    // But it still creates a recovery record so the agent can function
    expect(state.chainLength).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Lineage Compatibility
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Lineage', () => {
  it('genesis agent has null parent and generation 0', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({
      soulContent: SOUL_CONTENT,
      soulName: 'TestAgent',
    });

    expect(state.anchor.parentIdentityId).toBeNull();
    expect(state.anchor.generation).toBe(0);
  });

  it('manually created child anchor has parent reference and generation', () => {
    const db = freshDb();

    // Genesis parent
    const parentAnchor = createIdentityAnchor({
      name: 'ParentAgent',
      soulContent: SOUL_CONTENT,
    });
    const anchorRepo = new IdentityAnchorRepository(db);
    anchorRepo.insert(parentAnchor);

    // Create child anchor manually (simulating future fork logic)
    const childAnchor = createIdentityAnchor({
      name: 'ChildAgent',
      soulContent: SOUL_CONTENT,
      parentIdentityId: parentAnchor.id,
      generation: 1,
    });
    anchorRepo.insert(childAnchor);

    // Verify lineage fields
    const readChild = anchorRepo.findById(childAnchor.id);
    expect(readChild).toBeDefined();
    expect(readChild!.parentIdentityId).toBe(parentAnchor.id);
    expect(readChild!.generation).toBe(1);

    // Parent should have null parent
    const readParent = anchorRepo.findById(parentAnchor.id);
    expect(readParent!.parentIdentityId).toBeNull();
    expect(readParent!.generation).toBe(0);
  });

  it('lineage fields survive DB round-trip', () => {
    const db = freshDb();
    const anchorRepo = new IdentityAnchorRepository(db);

    const anchor = createIdentityAnchor({
      name: 'Gen2Agent',
      soulContent: SOUL_CONTENT,
      parentIdentityId: 'parent-uuid-123',
      generation: 2,
    });
    anchorRepo.insert(anchor);

    const loaded = anchorRepo.findFirst();
    expect(loaded).toBeDefined();
    expect(loaded!.parentIdentityId).toBe('parent-uuid-123');
    expect(loaded!.generation).toBe(2);
    expect(loaded!.name).toBe('Gen2Agent');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. shouldAdvanceForSession — Advance Rules (Round 14.8)
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — shouldAdvanceForSession', () => {
  it('returns true when sessionCount differs', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Genesis record has sessionCount=0 by default
    expect(svc.shouldAdvanceForSession({ sessionCount: 1 })).toBe(true);
  });

  it('returns false when sessionCount matches and no memoryEpisodeCount change', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Advance once with sessionCount=5
    svc.advanceForSession({
      soulContent: SOUL_CONTENT,
      sessionId: randomUUID(),
      sessionCount: 5,
      memoryEpisodeCount: 10,
    });

    // Same values — should not advance again
    expect(svc.shouldAdvanceForSession({ sessionCount: 5, memoryEpisodeCount: 10 })).toBe(false);
  });

  it('returns true when memoryEpisodeCount differs', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    svc.advanceForSession({
      soulContent: SOUL_CONTENT,
      sessionId: randomUUID(),
      sessionCount: 5,
      memoryEpisodeCount: 10,
    });

    // Same sessionCount but different memoryEpisodeCount
    expect(svc.shouldAdvanceForSession({ sessionCount: 5, memoryEpisodeCount: 15 })).toBe(true);
  });

  it('throws if not hydrated', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    expect(() => svc.shouldAdvanceForSession({ sessionCount: 1 }))
      .toThrow('ContinuityService not hydrated');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Soul Drift Detection (Round 14.8)
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Soul Drift Detection', () => {
  it('soulDrifted is false when soul matches latest record', () => {
    const db = freshDb();

    // Genesis
    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Restart with same soul
    const svc2 = new ContinuityService(db, silentLogger);
    const state = svc2.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.soulDrifted).toBe(false);
  });

  it('soulDrifted is true when soul differs from latest record', () => {
    const db = freshDb();

    // Genesis with original soul
    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Restart with changed soul (simulates external SOUL.md edit)
    const svc2 = new ContinuityService(db, silentLogger);
    const state = svc2.hydrate({ soulContent: SOUL_CONTENT_V2, soulName: 'TestAgent' });

    expect(state.soulDrifted).toBe(true);
    expect(state.mode).toBe('restart'); // still valid restart, just drifted
    expect(state.chainValid).toBe(true);
  });

  it('genesis always has soulDrifted=false', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.mode).toBe('genesis');
    expect(state.soulDrifted).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. SelfExplanation (Round 14.8)
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — SelfExplanation', () => {
  it('genesis has fresh-genesis explanation', () => {
    const db = freshDb();
    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.explanation.continuityBasis).toBe('fresh-genesis');
    expect(state.explanation.soulDrifted).toBe(false);
    expect(state.explanation.summary).toContain('Fresh genesis');
    expect(state.explanation.summary).toContain('TestAgent');
  });

  it('valid restart has chain-valid explanation', () => {
    const db = freshDb();

    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const svc2 = new ContinuityService(db, silentLogger);
    const state = svc2.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.explanation.continuityBasis).toBe('chain-valid');
    expect(state.explanation.soulDrifted).toBe(false);
    expect(state.explanation.summary).toContain('Valid restart');
  });

  it('restart with soul drift has chain-valid + soulDrifted explanation', () => {
    const db = freshDb();

    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const svc2 = new ContinuityService(db, silentLogger);
    const state = svc2.hydrate({ soulContent: SOUL_CONTENT_V2, soulName: 'TestAgent' });

    expect(state.explanation.continuityBasis).toBe('chain-valid');
    expect(state.explanation.soulDrifted).toBe(true);
    expect(state.explanation.summary).toContain('drifted');
  });

  it('degraded (tampered chain) has chain-broken explanation', () => {
    const db = freshDb();

    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });
    svc1.advanceForSoulChange(SOUL_CONTENT_V2, 2);

    // Tamper
    db.prepare('UPDATE continuity_records SET record_hash = ? WHERE version = 1')
      .run('TAMPERED');

    const svc2 = new ContinuityService(db, silentLogger);
    const state = svc2.hydrate({ soulContent: SOUL_CONTENT_V2, soulName: 'TestAgent' });

    expect(state.explanation.continuityBasis).toBe('chain-broken-but-anchor-exists');
    expect(state.explanation.summary).toContain('chain is broken');
  });

  it('degraded (no records) has chain-broken explanation with recovery info', () => {
    const db = freshDb();

    const anchor = createIdentityAnchor({
      name: 'TestAgent',
      soulContent: SOUL_CONTENT,
    });
    const anchorRepo = new IdentityAnchorRepository(db);
    anchorRepo.insert(anchor);

    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    expect(state.explanation.continuityBasis).toBe('chain-broken-but-anchor-exists');
    expect(state.explanation.summary).toContain('recovery record');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Post-Advance Self-State Consistency (Round 14.8.1 — Goal D)
// ══════════════════════════════════════════════════════════════════════
describe('ContinuityService — Post-Advance Consistency', () => {
  it('advanceForSoulChange resets soulDrifted to false', () => {
    const db = freshDb();

    // Genesis
    const svc1 = new ContinuityService(db, silentLogger);
    svc1.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    // Restart with drifted soul
    const svc2 = new ContinuityService(db, silentLogger);
    const stateBeforeAdvance = svc2.hydrate({ soulContent: SOUL_CONTENT_V2, soulName: 'TestAgent' });
    expect(stateBeforeAdvance.soulDrifted).toBe(true);

    // Advance records the new soul content
    svc2.advanceForSoulChange(SOUL_CONTENT_V2, 2);
    const stateAfterAdvance = svc2.getCurrentState()!;

    expect(stateAfterAdvance.soulDrifted).toBe(false);
    expect(stateAfterAdvance.explanation.soulDrifted).toBe(false);
    expect(stateAfterAdvance.explanation.summary).toContain('matches latest record');
  });

  it('advanceForSession refreshes explanation with updated chain length', () => {
    const db = freshDb();

    const svc = new ContinuityService(db, silentLogger);
    svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });

    const stateBefore = svc.getCurrentState()!;
    expect(stateBefore.chainLength).toBe(1); // genesis record

    svc.advanceForSession({
      soulContent: SOUL_CONTENT,
      sessionId: 'sess-1',
      sessionCount: 1,
      memoryEpisodeCount: 5,
    });

    const stateAfter = svc.getCurrentState()!;
    expect(stateAfter.chainLength).toBe(2);
    expect(stateAfter.soulDrifted).toBe(false);
    expect(stateAfter.explanation.continuityBasis).toBe('chain-valid');
    expect(stateAfter.explanation.summary).toContain('v2');
    expect(stateAfter.explanation.summary).toContain('2 records');
  });

  it('advanceForSoulChange with matching content keeps soulDrifted false', () => {
    const db = freshDb();

    const svc = new ContinuityService(db, silentLogger);
    const state = svc.hydrate({ soulContent: SOUL_CONTENT, soulName: 'TestAgent' });
    expect(state.soulDrifted).toBe(false);

    // Advance with same content (shouldn't drift since hash matches)
    svc.advanceForSoulChange(SOUL_CONTENT, 2);
    const afterState = svc.getCurrentState()!;
    expect(afterState.soulDrifted).toBe(false);
    expect(afterState.explanation.continuityBasis).toBe('chain-valid');
  });
});

