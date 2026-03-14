/**
 * Memory Repositories — CRUD for the 5 memory tiers + session summaries.
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';

/** Optional text sanitizer for PII redaction before writes */
export type TextSanitizer = (text: string) => string;

// ── Row types ──────────────────────────────────────────────────────────

export interface WorkingMemoryRow {
  id: number; session_id: string; type: string; content: string; created_at: string;
}
export interface EpisodicMemoryRow {
  id: number; event_type: string; content: string; importance: number;
  classification: string | null; session_id: string | null; turn_id: number | null;
  owner_id: string | null; created_at: string;
}
export interface SemanticMemoryRow {
  id: number; category: string; key: string; value: string;
  confidence: number; source: string | null; created_at: string; updated_at: string;
}
export interface ProceduralMemoryRow {
  id: number; name: string; steps_json: string;
  success_count: number; failure_count: number; last_used: string | null; created_at: string;
}
export interface RelationshipMemoryRow {
  id: number; entity_id: string; entity_type: string; trust_score: number;
  interaction_count: number; last_interaction: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface SessionSummaryRow {
  id: number; session_id: string; summary: string; outcome: string | null; owner_id: string | null; created_at: string;
}
export interface SoulHistoryRow {
  id: number; content: string; content_hash: string; alignment_score: number | null;
  owner_id: string | null; created_at: string;
}

// ── Insert types ───────────────────────────────────────────────────────

export interface InsertWorkingMemory { sessionId: string; type: string; content: string; }
export interface InsertEpisodicMemory {
  eventType: string; content: string; importance?: number;
  classification?: string; sessionId?: string; turnId?: number;
  ownerId?: string;
}
export interface UpsertSemanticMemory {
  category: string; key: string; value: string; confidence?: number; source?: string;
}
export interface UpsertProceduralMemory { name: string; stepsJson: string; }
export interface UpsertRelationship {
  entityId: string; entityType: string; trustDelta?: number; notes?: string;
}
export interface InsertSoulHistory {
  content: string; contentHash: string; alignmentScore?: number;
  ownerId?: string;
}

// ── Working Memory Repository ──────────────────────────────────────────

export class WorkingMemoryRepository {
  constructor(private readonly db: Database.Database, private readonly sanitize?: TextSanitizer) {}

  insert(mem: InsertWorkingMemory): number {
    const content = this.sanitize ? this.sanitize(mem.content) : mem.content;
    const result = this.db.prepare(
      'INSERT INTO working_memory (session_id, type, content, created_at) VALUES (?, ?, ?, ?)',
    ).run(mem.sessionId, mem.type, content, nowISO());
    return Number(result.lastInsertRowid);
  }

  findBySession(sessionId: string): WorkingMemoryRow[] {
    return this.db.prepare(
      'SELECT * FROM working_memory WHERE session_id = ? ORDER BY created_at',
    ).all(sessionId) as WorkingMemoryRow[];
  }

  clearSession(sessionId: string): number {
    return this.db.prepare('DELETE FROM working_memory WHERE session_id = ?').run(sessionId).changes;
  }
}

// ── Episodic Memory Repository ─────────────────────────────────────────

export class EpisodicMemoryRepository {
  constructor(private readonly db: Database.Database, private readonly sanitize?: TextSanitizer) {}

  insert(mem: InsertEpisodicMemory): number {
    const content = this.sanitize ? this.sanitize(mem.content) : mem.content;
    const result = this.db.prepare(
      'INSERT INTO episodic_memory (event_type, content, importance, classification, session_id, turn_id, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(mem.eventType, content, mem.importance ?? 5, mem.classification ?? null, mem.sessionId ?? null, mem.turnId ?? null, mem.ownerId ?? null, nowISO());
    return Number(result.lastInsertRowid);
  }

  findTopByImportance(limit: number): EpisodicMemoryRow[] {
    return this.db.prepare(
      'SELECT * FROM episodic_memory ORDER BY importance DESC, created_at DESC LIMIT ?',
    ).all(limit) as EpisodicMemoryRow[];
  }

  findBySession(sessionId: string): EpisodicMemoryRow[] {
    return this.db.prepare(
      'SELECT * FROM episodic_memory WHERE session_id = ? ORDER BY created_at',
    ).all(sessionId) as EpisodicMemoryRow[];
  }

  /** Find by owner identity. */
  findByOwner(ownerId: string): EpisodicMemoryRow[] {
    return this.db.prepare(
      'SELECT * FROM episodic_memory WHERE owner_id = ? ORDER BY created_at',
    ).all(ownerId) as EpisodicMemoryRow[];
  }

  /** Find top episodes by importance, scoped to an owner identity. */
  findTopByImportanceForOwner(ownerId: string, limit: number): EpisodicMemoryRow[] {
    return this.db.prepare(
      'SELECT * FROM episodic_memory WHERE owner_id = ? ORDER BY importance DESC, created_at DESC LIMIT ?',
    ).all(ownerId, limit) as EpisodicMemoryRow[];
  }

  /**
   * Find top episodes by blended relevance score (Round 15.1.1 — hardened).
   * Score = importance×2 + recency_bonus + continuity_bonus.
   * Continuity bonus: consolidated/preference/lesson types get +2/+3.
   */
  findTopByRelevance(limit: number): EpisodicMemoryRow[] {
    return this.db.prepare(`
      SELECT *, (importance * 2 + CASE
        WHEN created_at > datetime('now', '-1 hour') THEN 5
        WHEN created_at > datetime('now', '-1 day') THEN 3
        WHEN created_at > datetime('now', '-7 days') THEN 1
        ELSE 0
      END + CASE
        WHEN event_type LIKE 'preference%' OR event_type LIKE 'lesson%' THEN 3
        WHEN event_type LIKE 'consolidated_%' THEN 2
        ELSE 0
      END) as relevance_score
      FROM episodic_memory
      ORDER BY relevance_score DESC, created_at DESC LIMIT ?
    `).all(limit) as EpisodicMemoryRow[];
  }

  /**
   * Find top episodes by blended relevance score, scoped to owner (Round 15.1.1).
   * Same scoring as findTopByRelevance but filtered to a specific owner.
   */
  findTopByRelevanceForOwner(ownerId: string, limit: number): EpisodicMemoryRow[] {
    return this.db.prepare(`
      SELECT *, (importance * 2 + CASE
        WHEN created_at > datetime('now', '-1 hour') THEN 5
        WHEN created_at > datetime('now', '-1 day') THEN 3
        WHEN created_at > datetime('now', '-7 days') THEN 1
        ELSE 0
      END + CASE
        WHEN event_type LIKE 'preference%' OR event_type LIKE 'lesson%' THEN 3
        WHEN event_type LIKE 'consolidated_%' THEN 2
        ELSE 0
      END) as relevance_score
      FROM episodic_memory
      WHERE owner_id = ?
      ORDER BY relevance_score DESC, created_at DESC LIMIT ?
    `).all(ownerId, limit) as EpisodicMemoryRow[];
  }

  /**
   * Check if an episode with the same session + event_type + content prefix exists (Round 15.1).
   * Used by ConsolidationPipeline as a dedup guard to prevent duplicate episodes.
   */
  existsBySessionAndContent(sessionId: string, eventType: string, contentPrefix: string): boolean {
    const row = this.db.prepare(
      'SELECT 1 FROM episodic_memory WHERE session_id = ? AND event_type = ? AND content LIKE ? LIMIT 1',
    ).get(sessionId, eventType, contentPrefix.slice(0, 200) + '%') as { 1: number } | undefined;
    return row !== undefined;
  }

  /** Total episode count. */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM episodic_memory').get() as { cnt: number };
    return row.cnt;
  }

  /** Episode count scoped to a specific owner (Goal D — Round 15.0.2). */
  countByOwner(ownerId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM episodic_memory WHERE owner_id = ?').get(ownerId) as { cnt: number };
    return row.cnt;
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM episodic_memory WHERE id = ?').run(id).changes > 0;
  }
}

// ── Semantic Memory Repository ─────────────────────────────────────────

export class SemanticMemoryRepository {
  constructor(private readonly db: Database.Database, private readonly sanitize?: TextSanitizer) {}

  upsert(mem: UpsertSemanticMemory): number {
    const value = this.sanitize ? this.sanitize(mem.value) : mem.value;
    const now = nowISO();
    const result = this.db.prepare(`
      INSERT INTO semantic_memory (category, key, value, confidence, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(category, key) DO UPDATE SET value = excluded.value, confidence = excluded.confidence, source = excluded.source, updated_at = excluded.updated_at
    `).run(mem.category, mem.key, value, mem.confidence ?? 5, mem.source ?? null, now, now);
    return Number(result.lastInsertRowid);
  }

  findByCategory(category: string): SemanticMemoryRow[] {
    return this.db.prepare('SELECT * FROM semantic_memory WHERE category = ? ORDER BY key').all(category) as SemanticMemoryRow[];
  }

  findByKey(category: string, key: string): SemanticMemoryRow | undefined {
    return this.db.prepare('SELECT * FROM semantic_memory WHERE category = ? AND key = ?').get(category, key) as SemanticMemoryRow | undefined;
  }

  findAll(): SemanticMemoryRow[] {
    return this.db.prepare('SELECT * FROM semantic_memory ORDER BY category, key').all() as SemanticMemoryRow[];
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM semantic_memory WHERE id = ?').run(id).changes > 0;
  }
}

// ── Procedural Memory Repository ───────────────────────────────────────

export class ProceduralMemoryRepository {
  constructor(private readonly db: Database.Database) {}

  upsert(mem: UpsertProceduralMemory): number {
    const result = this.db.prepare(`
      INSERT INTO procedural_memory (name, steps_json, created_at) VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET steps_json = excluded.steps_json
    `).run(mem.name, mem.stepsJson, nowISO());
    return Number(result.lastInsertRowid);
  }

  findByName(name: string): ProceduralMemoryRow | undefined {
    return this.db.prepare('SELECT * FROM procedural_memory WHERE name = ?').get(name) as ProceduralMemoryRow | undefined;
  }

  recordSuccess(name: string): void {
    this.db.prepare('UPDATE procedural_memory SET success_count = success_count + 1, last_used = ? WHERE name = ?').run(nowISO(), name);
  }

  recordFailure(name: string): void {
    this.db.prepare('UPDATE procedural_memory SET failure_count = failure_count + 1, last_used = ? WHERE name = ?').run(nowISO(), name);
  }

  findAll(): ProceduralMemoryRow[] {
    return this.db.prepare('SELECT * FROM procedural_memory ORDER BY name').all() as ProceduralMemoryRow[];
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM procedural_memory WHERE id = ?').run(id).changes > 0;
  }
}

// ── Relationship Memory Repository ─────────────────────────────────────

export class RelationshipMemoryRepository {
  constructor(private readonly db: Database.Database) {}

  upsert(mem: UpsertRelationship): number {
    const now = nowISO();
    const existing = this.findByEntity(mem.entityId);
    if (existing) {
      const newTrust = Math.max(0, Math.min(100, existing.trust_score + (mem.trustDelta ?? 0)));
      this.db.prepare(`
        UPDATE relationship_memory
        SET trust_score = ?, interaction_count = interaction_count + 1,
            last_interaction = ?, notes = ?, updated_at = ?
        WHERE entity_id = ?
      `).run(newTrust, now, mem.notes ?? existing.notes, now, mem.entityId);
      return existing.id;
    }
    const result = this.db.prepare(`
      INSERT INTO relationship_memory (entity_id, entity_type, trust_score, interaction_count, last_interaction, notes, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?)
    `).run(mem.entityId, mem.entityType, Math.max(0, Math.min(100, 50 + (mem.trustDelta ?? 0))), now, mem.notes ?? null, now, now);
    return Number(result.lastInsertRowid);
  }

  findByEntity(entityId: string): RelationshipMemoryRow | undefined {
    return this.db.prepare('SELECT * FROM relationship_memory WHERE entity_id = ?').get(entityId) as RelationshipMemoryRow | undefined;
  }

  findAll(): RelationshipMemoryRow[] {
    return this.db.prepare('SELECT * FROM relationship_memory ORDER BY trust_score DESC').all() as RelationshipMemoryRow[];
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM relationship_memory WHERE id = ?').run(id).changes > 0;
  }
}

// ── Soul History Repository ────────────────────────────────────────────

export class SoulHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  insert(entry: InsertSoulHistory): number {
    const result = this.db.prepare(
      'INSERT INTO soul_history (content, content_hash, alignment_score, owner_id, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(entry.content, entry.contentHash, entry.alignmentScore ?? null, entry.ownerId ?? null, nowISO());
    return Number(result.lastInsertRowid);
  }

  getLatest(): SoulHistoryRow | undefined {
    return this.db.prepare('SELECT * FROM soul_history ORDER BY created_at DESC LIMIT 1').get() as SoulHistoryRow | undefined;
  }

  findAll(): SoulHistoryRow[] {
    return this.db.prepare('SELECT * FROM soul_history ORDER BY created_at').all() as SoulHistoryRow[];
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM soul_history').get() as { cnt: number };
    return row.cnt;
  }

  /** Find soul history entries by owner identity. */
  findByOwner(ownerId: string): SoulHistoryRow[] {
    return this.db.prepare(
      'SELECT * FROM soul_history WHERE owner_id = ? ORDER BY created_at',
    ).all(ownerId) as SoulHistoryRow[];
  }
}

// ── Session Summaries Repository ───────────────────────────────────────

export class SessionSummariesRepository {
  constructor(private readonly db: Database.Database) {}

  upsert(sessionId: string, summary: string, outcome?: string, ownerId?: string): number {
    const result = this.db.prepare(`
      INSERT INTO session_summaries (session_id, summary, outcome, owner_id, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET summary = excluded.summary, outcome = excluded.outcome, owner_id = COALESCE(excluded.owner_id, owner_id)
    `).run(sessionId, summary, outcome ?? null, ownerId ?? null, nowISO());
    return Number(result.lastInsertRowid);
  }

  findBySession(sessionId: string): SessionSummaryRow | undefined {
    return this.db.prepare('SELECT * FROM session_summaries WHERE session_id = ?').get(sessionId) as SessionSummaryRow | undefined;
  }

  findRecent(limit: number): SessionSummaryRow[] {
    return this.db.prepare('SELECT * FROM session_summaries ORDER BY created_at DESC LIMIT ?').all(limit) as SessionSummaryRow[];
  }

  /** Find recent session summaries scoped to an owner identity. */
  findRecentByOwner(ownerId: string, limit: number): SessionSummaryRow[] {
    return this.db.prepare(
      'SELECT * FROM session_summaries WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?',
    ).all(ownerId, limit) as SessionSummaryRow[];
  }
}
