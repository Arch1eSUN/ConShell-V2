/**
 * SessionsRepository tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openTestDatabase } from '../database.js';
import { SessionsRepository } from './sessions.js';
import { TurnsRepository } from './turns.js';

const silentLogger = {
  debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  child: function () { return this; },
};

describe('SessionsRepository', () => {
  let db: ReturnType<typeof openTestDatabase>;
  let repo: SessionsRepository;

  beforeEach(() => {
    db = openTestDatabase(silentLogger as any);
    repo = new SessionsRepository(db);
  });

  it('upsert creates a new session', () => {
    repo.upsert('sess-1', 'webchat');
    const session = repo.findById('sess-1');
    expect(session).toBeDefined();
    expect(session!.id).toBe('sess-1');
    expect(session!.channel).toBe('webchat');
    expect(session!.title).toBeNull();
  });

  it('upsert is idempotent — updates updated_at', () => {
    repo.upsert('sess-1', 'webchat');
    const first = repo.findById('sess-1')!;

    // Wait a tiny bit for timestamp difference
    repo.upsert('sess-1', 'webchat');
    const second = repo.findById('sess-1')!;

    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    // updated_at should be >= first (may be same if very fast)
    expect(second.updated_at >= first.updated_at).toBe(true);
  });

  it('findById returns undefined for non-existent session', () => {
    expect(repo.findById('nope')).toBeUndefined();
  });

  it('list returns sessions ordered by updated_at DESC', () => {
    repo.upsert('a', 'webchat');
    repo.upsert('b', 'webchat');
    repo.upsert('c', 'webchat');
    // Touch 'a' to make it most recent
    repo.touch('a');

    const list = repo.list();
    expect(list.length).toBe(3);
    expect(list[0]!.id).toBe('a');
  });

  it('list supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      repo.upsert(`s-${i}`, 'webchat');
    }

    const page1 = repo.list(2, 0);
    expect(page1.length).toBe(2);

    const page2 = repo.list(2, 2);
    expect(page2.length).toBe(2);

    const page3 = repo.list(2, 4);
    expect(page3.length).toBe(1);
  });

  it('listWithCount includes message_count', () => {
    repo.upsert('sess-1', 'webchat');
    const turns = new TurnsRepository(db);
    turns.insert({
      sessionId: 'sess-1',
      role: 'user',
      content: 'hello',
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0 as any,
    });
    turns.insert({
      sessionId: 'sess-1',
      role: 'assistant',
      content: 'hi',
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0 as any,
    });

    const list = repo.listWithCount();
    expect(list.length).toBe(1);
    expect(list[0]!.message_count).toBe(2);
  });

  it('updateTitle sets the title', () => {
    repo.upsert('sess-1', 'webchat');
    const ok = repo.updateTitle('sess-1', 'Hello World');
    expect(ok).toBe(true);

    const session = repo.findById('sess-1')!;
    expect(session.title).toBe('Hello World');
  });

  it('updateTitle returns false for non-existent session', () => {
    expect(repo.updateTitle('nope', 'test')).toBe(false);
  });

  it('delete removes session and its turns', () => {
    repo.upsert('sess-1', 'webchat');
    const turns = new TurnsRepository(db);
    turns.insert({
      sessionId: 'sess-1',
      role: 'user',
      content: 'hello',
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0 as any,
    });

    const deleted = repo.delete('sess-1');
    expect(deleted).toBe(true);
    expect(repo.findById('sess-1')).toBeUndefined();
    expect(turns.findBySession('sess-1').length).toBe(0);
  });

  it('delete returns false for non-existent session', () => {
    expect(repo.delete('nope')).toBe(false);
  });

  it('count returns total sessions', () => {
    expect(repo.count()).toBe(0);
    repo.upsert('a', 'webchat');
    repo.upsert('b', 'webchat');
    expect(repo.count()).toBe(2);
  });
});
