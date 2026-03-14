/**
 * Identity Anchor Repository — SQLite persistence for IdentityAnchor & ContinuityRecord.
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../state/database.js';
import type { IdentityAnchor, ContinuityRecord } from './anchor.js';

// ── Row types ──────────────────────────────────────────────────────────

export interface IdentityAnchorRow {
  readonly id: string;
  readonly name: string;
  readonly wallet_address: string | null;
  readonly soul_hash: string;
  readonly created_at: string;
  readonly parent_identity_id: string | null;
  readonly generation: number;
}

export interface ContinuityRecordRow {
  readonly version: number;
  readonly identity_id: string;
  readonly soul_hash: string;
  readonly soul_version: number;
  readonly session_count: number;
  readonly memory_episode_count: number;
  readonly last_session_id: string | null;
  readonly previous_hash: string | null;
  readonly record_hash: string;
  readonly created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────

function anchorRowToModel(row: IdentityAnchorRow): IdentityAnchor {
  return {
    id: row.id,
    name: row.name,
    walletAddress: row.wallet_address,
    soulHash: row.soul_hash,
    createdAt: row.created_at,
    parentIdentityId: row.parent_identity_id,
    generation: row.generation,
  };
}

function recordRowToModel(row: ContinuityRecordRow): ContinuityRecord {
  return {
    version: row.version,
    identityId: row.identity_id,
    soulHash: row.soul_hash,
    soulVersion: row.soul_version,
    sessionCount: row.session_count,
    memoryEpisodeCount: row.memory_episode_count,
    lastSessionId: row.last_session_id,
    previousHash: row.previous_hash,
    recordHash: row.record_hash,
    createdAt: row.created_at,
  };
}

// ── IdentityAnchorRepository ───────────────────────────────────────────

export class IdentityAnchorRepository {
  private readonly insertStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findFirstStmt: Database.Statement;
  private readonly countStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO identity_anchor (id, name, wallet_address, soul_hash, created_at, parent_identity_id, generation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.findByIdStmt = db.prepare(
      'SELECT * FROM identity_anchor WHERE id = ?',
    );

    this.findFirstStmt = db.prepare(
      'SELECT * FROM identity_anchor ORDER BY created_at ASC LIMIT 1',
    );

    this.countStmt = db.prepare(
      'SELECT COUNT(*) as cnt FROM identity_anchor',
    );
  }

  /** Insert a new identity anchor (genesis). */
  insert(anchor: IdentityAnchor): void {
    this.insertStmt.run(
      anchor.id,
      anchor.name,
      anchor.walletAddress,
      anchor.soulHash,
      anchor.createdAt,
      anchor.parentIdentityId,
      anchor.generation,
    );
  }

  /** Find anchor by ID. */
  findById(id: string): IdentityAnchor | undefined {
    const row = this.findByIdStmt.get(id) as IdentityAnchorRow | undefined;
    return row ? anchorRowToModel(row) : undefined;
  }

  /** Get the first (genesis) anchor. */
  findFirst(): IdentityAnchor | undefined {
    const row = this.findFirstStmt.get() as IdentityAnchorRow | undefined;
    return row ? anchorRowToModel(row) : undefined;
  }

  /** Count anchors. */
  count(): number {
    const row = this.countStmt.get() as { cnt: number };
    return row.cnt;
  }
}

// ── ContinuityRecordRepository ─────────────────────────────────────────

export class ContinuityRecordRepository {
  private readonly insertStmt: Database.Statement;
  private readonly findByVersionStmt: Database.Statement;
  private readonly findLatestStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly countStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO continuity_records
        (version, identity_id, soul_hash, soul_version, session_count,
         memory_episode_count, last_session_id, previous_hash, record_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.findByVersionStmt = db.prepare(
      'SELECT * FROM continuity_records WHERE version = ?',
    );

    this.findLatestStmt = db.prepare(
      'SELECT * FROM continuity_records ORDER BY version DESC LIMIT 1',
    );

    this.findAllStmt = db.prepare(
      'SELECT * FROM continuity_records ORDER BY version ASC',
    );

    this.countStmt = db.prepare(
      'SELECT COUNT(*) as cnt FROM continuity_records',
    );
  }

  /** Insert a continuity record. */
  insert(record: ContinuityRecord): void {
    this.insertStmt.run(
      record.version,
      record.identityId,
      record.soulHash,
      record.soulVersion,
      record.sessionCount,
      record.memoryEpisodeCount,
      record.lastSessionId,
      record.previousHash,
      record.recordHash,
      record.createdAt,
    );
  }

  /** Find by version number. */
  findByVersion(version: number): ContinuityRecord | undefined {
    const row = this.findByVersionStmt.get(version) as ContinuityRecordRow | undefined;
    return row ? recordRowToModel(row) : undefined;
  }

  /** Get the latest (highest version) record. */
  findLatest(): ContinuityRecord | undefined {
    const row = this.findLatestStmt.get() as ContinuityRecordRow | undefined;
    return row ? recordRowToModel(row) : undefined;
  }

  /** Get the full chain in ascending version order. */
  findAll(): ContinuityRecord[] {
    const rows = this.findAllStmt.all() as ContinuityRecordRow[];
    return rows.map(recordRowToModel);
  }

  /** Count records. */
  count(): number {
    const row = this.countStmt.get() as { cnt: number };
    return row.cnt;
  }
}
