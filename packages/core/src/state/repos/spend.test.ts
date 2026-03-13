/**
 * SpendRepository 单元测试
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
  // Apply migration v2 (spend_tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spend_tracking (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      type         TEXT    NOT NULL,
      amount_cents INTEGER NOT NULL,
      window_hour  TEXT    NOT NULL,
      window_day   TEXT    NOT NULL,
      created_at   TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_spend_hour ON spend_tracking(window_hour);
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
});
