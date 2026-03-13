/**
 * SpendRepository — spend_tracking 表的持久化层
 *
 * 将 SpendTracker 的内存数据持久化到 SQLite。
 * 使用 migration v2 创建的 spend_tracking 表。
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface SpendRow {
  readonly id: number;
  /** 'spend' or 'income' */
  readonly type: string;
  readonly amount_cents: number;
  readonly window_hour: string;
  readonly window_day: string;
  readonly provider?: string;
  readonly model?: string;
  readonly category?: string;
  readonly description?: string;
  readonly created_at: string;
}

export interface InsertSpend {
  readonly type: 'spend' | 'income';
  readonly amountCents: number;
  readonly provider?: string;
  readonly model?: string;
  readonly category?: string;
  readonly description?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function windowHour(date: Date = new Date()): string {
  return date.toISOString().slice(0, 13); // "2026-03-13T18"
}

function windowDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10); // "2026-03-13"
}

// ── Repository ────────────────────────────────────────────────────────

export class SpendRepository {
  private stmtInsert: Database.Statement;
  private stmtTotalByType: Database.Statement;
  private stmtDailyByType: Database.Statement;
  private stmtHourlyByType: Database.Statement;
  private stmtBreakdown: Database.Statement;
  private stmtRecentSpend: Database.Statement;
  private stmtAll: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO spend_tracking (type, amount_cents, window_hour, window_day, created_at)
      VALUES (@type, @amount_cents, @window_hour, @window_day, @created_at)
    `);

    this.stmtTotalByType = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM spend_tracking
      WHERE type = ?
    `);

    this.stmtDailyByType = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM spend_tracking
      WHERE type = ? AND window_day = ?
    `);

    this.stmtHourlyByType = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM spend_tracking
      WHERE type = ? AND window_hour = ?
    `);

    this.stmtBreakdown = db.prepare(`
      SELECT window_day, COALESCE(SUM(amount_cents), 0) as total_cents, COUNT(*) as count
      FROM spend_tracking
      WHERE type = 'spend' AND window_day >= ?
      GROUP BY window_day
      ORDER BY window_day DESC
    `);

    this.stmtRecentSpend = db.prepare(`
      SELECT COALESCE(SUM(amount_cents), 0) as total
      FROM spend_tracking
      WHERE type = 'spend' AND created_at >= ?
    `);

    this.stmtAll = db.prepare(`
      SELECT * FROM spend_tracking ORDER BY id DESC LIMIT ?
    `);
  }

  /** Record a spend or income entry */
  insert(entry: InsertSpend): number {
    const now = new Date();
    const result = this.stmtInsert.run({
      type: entry.type,
      amount_cents: entry.amountCents,
      window_hour: windowHour(now),
      window_day: windowDay(now),
      created_at: nowISO(),
    });
    return Number(result.lastInsertRowid);
  }

  /** Total spend or income (all time) */
  totalByType(type: 'spend' | 'income'): number {
    const row = this.stmtTotalByType.get(type) as { total: number };
    return row.total;
  }

  /** Daily spend or income for a given day (default: today) */
  dailyByType(type: 'spend' | 'income', day?: string): number {
    const d = day ?? windowDay();
    const row = this.stmtDailyByType.get(type, d) as { total: number };
    return row.total;
  }

  /** Hourly spend or income for a given hour (default: current hour) */
  hourlyByType(type: 'spend' | 'income', hour?: string): number {
    const h = hour ?? windowHour();
    const row = this.stmtHourlyByType.get(type, h) as { total: number };
    return row.total;
  }

  /** Daily breakdown for the last N days */
  dailyBreakdown(sinceDay: string): Array<{ window_day: string; total_cents: number; count: number }> {
    return this.stmtBreakdown.all(sinceDay) as Array<{ window_day: string; total_cents: number; count: number }>;
  }

  /** Total spend since a given ISO timestamp */
  spendSince(sinceISO: string): number {
    const row = this.stmtRecentSpend.get(sinceISO) as { total: number };
    return row.total;
  }

  /** Get recent entries */
  recent(limit: number = 50): SpendRow[] {
    return this.stmtAll.all(limit) as SpendRow[];
  }
}
