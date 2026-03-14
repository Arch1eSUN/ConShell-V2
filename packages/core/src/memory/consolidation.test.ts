/**
 * ConsolidationPipeline — Tests (Phase 2 — P2-4)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../state/database.js';
import { ConsolidationPipeline, _scoreSalience } from './consolidation.js';
import { WorkingMemoryRepository, EpisodicMemoryRepository } from '../state/repos/memory.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

const noop = () => {};
const silentLogger = {
  info: noop, debug: noop, warn: noop, error: noop,
  child: () => silentLogger,
} as any;

function freshDb(): Database.Database {
  const agentHome = join(tmpdir(), `conshell-test-${randomUUID()}`);
  mkdirSync(agentHome, { recursive: true });
  return openDatabase({ agentHome, logger: silentLogger });
}

describe('scoreSalience', () => {
  it('gives baseline score of 1 for short plain text', () => {
    const row = { id: 1, session_id: 's1', type: 'user', content: 'hello', created_at: '' };
    expect(_scoreSalience(row)).toBe(1);
  });

  it('boosts long responses', () => {
    const row = { id: 1, session_id: 's1', type: 'assistant', content: 'x'.repeat(300), created_at: '' };
    expect(_scoreSalience(row)).toBeGreaterThanOrEqual(3);
  });

  it('boosts tool-related content', () => {
    const row = { id: 1, session_id: 's1', type: 'tool_result', content: 'ran tool', created_at: '' };
    expect(_scoreSalience(row)).toBeGreaterThanOrEqual(4);
  });

  it('boosts error content', () => {
    const row = { id: 1, session_id: 's1', type: 'assistant', content: 'Error: connection failed', created_at: '' };
    expect(_scoreSalience(row)).toBeGreaterThanOrEqual(3);
  });

  it('caps at 10', () => {
    const row = { id: 1, session_id: 's1', type: 'tool_result', content: 'Error: ' + 'x'.repeat(600) + ' therefore decided', created_at: '' };
    expect(_scoreSalience(row)).toBeLessThanOrEqual(10);
  });
});

describe('ConsolidationPipeline (P2-4)', () => {
  let db: Database.Database;
  let pipeline: ConsolidationPipeline;
  let workingRepo: WorkingMemoryRepository;
  let episodicRepo: EpisodicMemoryRepository;

  beforeEach(() => {
    db = freshDb();
    pipeline = new ConsolidationPipeline(db, silentLogger);
    workingRepo = new WorkingMemoryRepository(db);
    episodicRepo = new EpisodicMemoryRepository(db);
  });

  it('promotes salient turns to episodic memory', () => {
    const sid = 'session-1';
    // Insert turns: one short (low salience), one tool-related (high salience)
    workingRepo.insert({ sessionId: sid, type: 'user', content: 'hello' });
    workingRepo.insert({ sessionId: sid, type: 'tool_result', content: 'Tool executed: search("cats") - Error: timeout after 5000ms' });

    const result = pipeline.consolidateSession(sid, 'owner-1');

    expect(result.turnsProcessed).toBe(2);
    expect(result.episodesCreated).toBeGreaterThanOrEqual(1); // tool turn should be promoted
    expect(result.skipped).toBe(false);

    // Verify episodic memory was created with correct owner
    const episodes = episodicRepo.findByOwner('owner-1');
    expect(episodes.length).toBeGreaterThanOrEqual(1);
    expect(episodes[0]!.event_type).toMatch(/^consolidated_/);
    expect(episodes[0]!.owner_id).toBe('owner-1');
  });

  it('skips sessions with no turns', () => {
    const result = pipeline.consolidateSession('empty-session', 'owner-1');
    expect(result.skipped).toBe(true);
    expect(result.turnsProcessed).toBe(0);
    expect(result.episodesCreated).toBe(0);
  });

  it('filters out low-salience turns', () => {
    const sid = 'low-salience-session';
    // All short plain messages → salience ≈ 1
    workingRepo.insert({ sessionId: sid, type: 'user', content: 'hi' });
    workingRepo.insert({ sessionId: sid, type: 'assistant', content: 'hello' });
    workingRepo.insert({ sessionId: sid, type: 'user', content: 'ok' });

    const result = pipeline.consolidateSession(sid);
    expect(result.turnsProcessed).toBe(3);
    expect(result.episodesCreated).toBe(0); // all below threshold
  });

  it('respects maxEpisodesPerSession', () => {
    const sid = 'many-turns';
    // Insert many salient turns (tool-related)
    for (let i = 0; i < 20; i++) {
      workingRepo.insert({ sessionId: sid, type: 'tool_result', content: `Error: step ${i} failed with exception` });
    }

    const pipe = new ConsolidationPipeline(db, silentLogger, { maxEpisodesPerSession: 5 });
    const result = pipe.consolidateSession(sid);
    expect(result.episodesCreated).toBe(5);
  });

  it('carries ownerId into promoted episodes', () => {
    const sid = 'owned-session';
    const ownerId = 'sovereign-self-001';
    workingRepo.insert({ sessionId: sid, type: 'tool_result', content: 'Error: critical failure in subsystem' });

    pipeline.consolidateSession(sid, ownerId);

    const episodes = episodicRepo.findByOwner(ownerId);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]!.owner_id).toBe(ownerId);
  });

  it('is idempotent — running twice does NOT create duplicates (Round 15.1 dedup)', () => {
    const sid = 'idempotent-session';
    workingRepo.insert({ sessionId: sid, type: 'tool_result', content: 'Error: connection failed in critical path' });

    const r1 = pipeline.consolidateSession(sid, 'owner');
    const r2 = pipeline.consolidateSession(sid, 'owner');

    // First run creates episode, second run deduplicates
    expect(r1.episodesCreated).toBe(1);
    expect(r2.episodesCreated).toBe(0);
    expect(episodicRepo.findByOwner('owner')).toHaveLength(1);
  });
});
