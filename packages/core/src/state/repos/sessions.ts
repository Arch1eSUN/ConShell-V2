/**
 * Sessions repository — conversation session metadata.
 *
 * Each session is a conversation container that groups turns together.
 * Sessions track metadata like title, channel, and timestamps.
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface SessionRow {
  readonly id: string;
  readonly title: string | null;
  readonly channel: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SessionWithCount extends SessionRow {
  readonly message_count: number;
}

// ── Repository ─────────────────────────────────────────────────────────

export class SessionsRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly listStmt: Database.Statement;
  private readonly listWithCountStmt: Database.Statement;
  private readonly updateTitleStmt: Database.Statement;
  private readonly touchStmt: Database.Statement;
  private readonly deleteSessionStmt: Database.Statement;
  private readonly deleteTurnsStmt: Database.Statement;
  private readonly countStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO sessions (id, title, channel, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
    `);

    this.findByIdStmt = db.prepare(
      'SELECT * FROM sessions WHERE id = ?',
    );

    this.listStmt = db.prepare(
      'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?',
    );

    this.listWithCountStmt = db.prepare(`
      SELECT s.*, COALESCE(t.cnt, 0) as message_count
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as cnt
        FROM turns
        GROUP BY session_id
      ) t ON t.session_id = s.id
      ORDER BY s.updated_at DESC
      LIMIT ? OFFSET ?
    `);

    this.updateTitleStmt = db.prepare(
      'UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
    );

    this.touchStmt = db.prepare(
      'UPDATE sessions SET updated_at = ? WHERE id = ?',
    );

    this.deleteSessionStmt = db.prepare(
      'DELETE FROM sessions WHERE id = ?',
    );

    this.deleteTurnsStmt = db.prepare(
      'DELETE FROM turns WHERE session_id = ?',
    );

    this.countStmt = db.prepare(
      'SELECT COUNT(*) as cnt FROM sessions',
    );
  }

  /** Create a new session or touch updated_at if it already exists. */
  upsert(id: string, channel: string = 'webchat'): void {
    const now = nowISO();
    this.upsertStmt.run(id, null, channel, now, now);
  }

  /** Find a session by ID. */
  findById(id: string): SessionRow | undefined {
    return this.findByIdStmt.get(id) as SessionRow | undefined;
  }

  /** List sessions with pagination, ordered by most recently active. */
  list(limit: number = 50, offset: number = 0): readonly SessionRow[] {
    return this.listStmt.all(limit, offset) as SessionRow[];
  }

  /** List sessions with message count, ordered by most recently active. */
  listWithCount(limit: number = 50, offset: number = 0): readonly SessionWithCount[] {
    return this.listWithCountStmt.all(limit, offset) as SessionWithCount[];
  }

  /** Update session title. */
  updateTitle(id: string, title: string): boolean {
    const result = this.updateTitleStmt.run(title, nowISO(), id);
    return result.changes > 0;
  }

  /** Touch updated_at timestamp. */
  touch(id: string): void {
    this.touchStmt.run(nowISO(), id);
  }

  /** Delete a session and all its turns. */
  delete(id: string): boolean {
    const doDelete = this.db.transaction(() => {
      this.deleteTurnsStmt.run(id);
      const result = this.deleteSessionStmt.run(id);
      return result.changes > 0;
    });
    return doDelete();
  }

  /** Total session count. */
  count(): number {
    const row = this.countStmt.get() as { cnt: number };
    return row.cnt;
  }
}
