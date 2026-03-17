/**
 * CommitmentRepository — SQLite persistence for Commitments.
 *
 * Follows the HeartbeatRepository pattern: prepared statements,
 * better-sqlite3, WAL-compatible.
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';
import type {
  CommitmentStatus,
  CommitmentKind,
} from '../../agenda/commitment-model.js';

// ── Row type ──────────────────────────────────────────────────────────

export interface CommitmentRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly kind: string;
  readonly origin: string;
  readonly status: string;
  readonly priority: string;
  readonly due_at: string | null;
  readonly last_evaluated_at: string | null;
  readonly next_review_at: string | null;
  readonly expected_value_cents: number;
  readonly estimated_cost_cents: number;
  readonly must_preserve: number;
  readonly revenue_bearing: number;
  readonly task_type: string;
  readonly blocked_reason: string | null;
  readonly failed_reason: string | null;
  readonly materialized_tasks: number;
  readonly created_at: string;
  readonly updated_at: string;
}

// ── Filter ────────────────────────────────────────────────────────────

export interface CommitmentFilter {
  status?: CommitmentStatus[];
  kind?: CommitmentKind[];
}

// ── Repository ────────────────────────────────────────────────────────

export class CommitmentRepository {
  private readonly insertStmt: Database.Statement;
  private readonly updateStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;
  private readonly findDueStmt: Database.Statement;
  private readonly findReviewableStmt: Database.Statement;
  private readonly loadActiveStmt: Database.Statement;
  private readonly markStatusStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO commitments (
        id, name, description, kind, origin, status, priority,
        due_at, last_evaluated_at, next_review_at,
        expected_value_cents, estimated_cost_cents,
        must_preserve, revenue_bearing, task_type,
        blocked_reason, failed_reason, materialized_tasks,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    this.updateStmt = db.prepare(`
      UPDATE commitments SET
        name = ?, description = ?, kind = ?, origin = ?,
        status = ?, priority = ?,
        due_at = ?, last_evaluated_at = ?, next_review_at = ?,
        expected_value_cents = ?, estimated_cost_cents = ?,
        must_preserve = ?, revenue_bearing = ?, task_type = ?,
        blocked_reason = ?, failed_reason = ?,
        materialized_tasks = ?, updated_at = ?
      WHERE id = ?
    `);

    this.findByIdStmt = db.prepare('SELECT * FROM commitments WHERE id = ?');
    this.listAllStmt = db.prepare('SELECT * FROM commitments ORDER BY created_at ASC');

    this.findDueStmt = db.prepare(`
      SELECT * FROM commitments
      WHERE due_at IS NOT NULL AND due_at <= ?
        AND status IN ('planned', 'active')
      ORDER BY due_at ASC
    `);

    this.findReviewableStmt = db.prepare(`
      SELECT * FROM commitments
      WHERE next_review_at IS NOT NULL AND next_review_at <= ?
        AND status IN ('planned', 'active', 'blocked')
      ORDER BY next_review_at ASC
    `);

    this.loadActiveStmt = db.prepare(`
      SELECT * FROM commitments
      WHERE status IN ('planned', 'active', 'blocked')
      ORDER BY created_at ASC
    `);

    this.markStatusStmt = db.prepare(`
      UPDATE commitments
      SET status = ?, blocked_reason = ?, failed_reason = ?, updated_at = ?
      WHERE id = ?
    `);
  }

  // ── CRUD ────────────────────────────────────────────────────────────

  insert(row: CommitmentRow): void {
    this.insertStmt.run(
      row.id, row.name, row.description, row.kind, row.origin,
      row.status, row.priority,
      row.due_at, row.last_evaluated_at, row.next_review_at,
      row.expected_value_cents, row.estimated_cost_cents,
      row.must_preserve, row.revenue_bearing, row.task_type,
      row.blocked_reason, row.failed_reason, row.materialized_tasks,
      row.created_at, row.updated_at,
    );
  }

  update(row: CommitmentRow): void {
    this.updateStmt.run(
      row.name, row.description, row.kind, row.origin,
      row.status, row.priority,
      row.due_at, row.last_evaluated_at, row.next_review_at,
      row.expected_value_cents, row.estimated_cost_cents,
      row.must_preserve, row.revenue_bearing, row.task_type,
      row.blocked_reason, row.failed_reason,
      row.materialized_tasks, row.updated_at,
      row.id,
    );
  }

  findById(id: string): CommitmentRow | undefined {
    return this.findByIdStmt.get(id) as CommitmentRow | undefined;
  }

  listAll(): readonly CommitmentRow[] {
    return this.listAllStmt.all() as CommitmentRow[];
  }

  // ── Query ───────────────────────────────────────────────────────────

  findDue(now: string): readonly CommitmentRow[] {
    return this.findDueStmt.all(now) as CommitmentRow[];
  }

  findReviewable(now: string): readonly CommitmentRow[] {
    return this.findReviewableStmt.all(now) as CommitmentRow[];
  }

  loadActive(): readonly CommitmentRow[] {
    return this.loadActiveStmt.all() as CommitmentRow[];
  }

  // ── Status ──────────────────────────────────────────────────────────

  markStatus(
    id: string,
    status: CommitmentStatus,
    reason?: string,
  ): void {
    const blockedReason = status === 'blocked' ? (reason ?? null) : null;
    const failedReason = status === 'failed' ? (reason ?? null) : null;
    this.markStatusStmt.run(status, blockedReason, failedReason, nowISO(), id);
  }
}
