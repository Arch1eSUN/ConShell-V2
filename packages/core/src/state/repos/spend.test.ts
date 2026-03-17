/**
 * SpendRepository 单元测试
 * Round 15.3: Extended with attribution tests (session_id, turn_id, kind)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { SpendRepository } from './spend.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  // Apply migration v1 (schema_version)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  // Apply migration v2 (spend_tracking) + v9 attribution columns
  db.exec(`
    CREATE TABLE IF NOT EXISTS spend_tracking (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT    NOT NULL,
      amount_cents INTEGER NOT NULL,
      window_hour  TEXT    NOT NULL,
      window_day   TEXT    NOT NULL,
      created_at   TEXT    NOT NULL,
      session_id   TEXT    DEFAULT NULL,
      turn_id      TEXT    DEFAULT NULL,
      kind         TEXT    DEFAULT 'inference',
      provider     TEXT    DEFAULT NULL,
      model        TEXT    DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_spend_hour ON spend_tracking(window_hour);
    CREATE INDEX IF NOT EXISTS idx_spend_session ON spend_tracking(session_id);
    CREATE INDEX IF NOT EXISTS idx_spend_turn ON spend_tracking(turn_id);
  `);
  return db;
}

describe('SpendRepository', () => {
  let db: Database.Database;
  let repo: SpendRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SpendRepository(db);
  });

  it('should insert spend entries', () => {
    const id = repo.insert({ type: 'spend', amountCents: 100 });
    expect(id).toBeGreaterThan(0);
  });

  it('should insert income entries', () => {
    const id = repo.insert({ type: 'income', amountCents: 500 });
    expect(id).toBeGreaterThan(0);
  });

  it('should calculate total by type', () => {
    repo.insert({ type: 'spend', amountCents: 100 });
    repo.insert({ type: 'spend', amountCents: 200 });
    repo.insert({ type: 'income', amountCents: 500 });

    expect(repo.totalByType('spend')).toBe(300);
    expect(repo.totalByType('income')).toBe(500);
  });

  it('should calculate daily totals', () => {
    repo.insert({ type: 'spend', amountCents: 100 });
    repo.insert({ type: 'spend', amountCents: 200 });

    const today = new Date().toISOString().slice(0, 10);
    expect(repo.dailyByType('spend', today)).toBe(300);
    expect(repo.dailyByType('income', today)).toBe(0);
  });

  it('should calculate hourly totals', () => {
    repo.insert({ type: 'spend', amountCents: 50 });

    const currentHour = new Date().toISOString().slice(0, 13);
    expect(repo.hourlyByType('spend', currentHour)).toBe(50);
  });

  it('should return daily breakdown', () => {
    repo.insert({ type: 'spend', amountCents: 100 });
    repo.insert({ type: 'spend', amountCents: 200 });

    const today = new Date().toISOString().slice(0, 10);
    const breakdown = repo.dailyBreakdown(today);
    expect(breakdown.length).toBe(1);
    expect(breakdown[0]!.total_cents).toBe(300);
    expect(breakdown[0]!.count).toBe(2);
  });

  it('should return recent entries', () => {
    repo.insert({ type: 'spend', amountCents: 100 });
    repo.insert({ type: 'income', amountCents: 200 });
    repo.insert({ type: 'spend', amountCents: 300 });

    const recent = repo.recent(10);
    expect(recent.length).toBe(3);
    // Most recent first
    expect(recent[0]!.amount_cents).toBe(300);
  });

  it('should return 0 for empty aggregates', () => {
    expect(repo.totalByType('spend')).toBe(0);
    expect(repo.totalByType('income')).toBe(0);
    expect(repo.dailyByType('spend')).toBe(0);
    expect(repo.hourlyByType('spend')).toBe(0);
  });

  // ── Round 15.3: Attribution Tests ────────────────────────────────────

  describe('attribution (Round 15.3)', () => {
    it('should store and retrieve attribution fields', () => {
      repo.insert({
        type: 'spend',
        amountCents: 42,
        sessionId: 'sess_abc',
        turnId: 'turn_001',
        kind: 'inference',
        provider: 'openai',
        model: 'gpt-4o',
      });

      const rows = repo.recent(1);
      expect(rows.length).toBe(1);
      expect(rows[0]!.session_id).toBe('sess_abc');
      expect(rows[0]!.turn_id).toBe('turn_001');
      expect(rows[0]!.kind).toBe('inference');
      expect(rows[0]!.provider).toBe('openai');
      expect(rows[0]!.model).toBe('gpt-4o');
    });

    it('bySession should sum spend for a given session', () => {
      repo.insert({ type: 'spend', amountCents: 100, sessionId: 'sess_a' });
      repo.insert({ type: 'spend', amountCents: 200, sessionId: 'sess_a' });
      repo.insert({ type: 'spend', amountCents: 50, sessionId: 'sess_b' });

      const result = repo.bySession('sess_a');
      expect(result.totalCents).toBe(300);
      expect(result.count).toBe(2);
    });

    it('bySession should return 0 for unknown session', () => {
      const result = repo.bySession('nonexistent');
      expect(result.totalCents).toBe(0);
      expect(result.count).toBe(0);
    });

    it('byTurn should sum spend for a given turn', () => {
      repo.insert({ type: 'spend', amountCents: 30, turnId: 'turn_x', sessionId: 'sess_a' });
      repo.insert({ type: 'spend', amountCents: 20, turnId: 'turn_x', sessionId: 'sess_a' });
      repo.insert({ type: 'spend', amountCents: 99, turnId: 'turn_y', sessionId: 'sess_a' });

      const result = repo.byTurn('turn_x');
      expect(result.totalCents).toBe(50);
      expect(result.count).toBe(2);
    });

    it('byTurn should return 0 for unknown turn', () => {
      const result = repo.byTurn('nonexistent');
      expect(result.totalCents).toBe(0);
      expect(result.count).toBe(0);
    });

    it('attribution fields should be optional (backward compat)', () => {
      // Insert without attribution — should still work
      const id = repo.insert({ type: 'spend', amountCents: 55 });
      expect(id).toBeGreaterThan(0);

      const rows = repo.recent(1);
      expect(rows[0]!.session_id).toBeNull();
      expect(rows[0]!.turn_id).toBeNull();
    });
  });
});
