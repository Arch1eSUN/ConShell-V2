/**
 * Skills repository — manage installed skills (local + ClawHub).
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';

export interface SkillRow {
  readonly name: string;
  readonly description: string | null;
  readonly triggers_json: string | null;
  readonly content: string;
  readonly source: string;
  readonly enabled: number;
  readonly installed_at: string;
}

export interface InsertSkill {
  readonly name: string;
  readonly description?: string;
  readonly triggersJson?: string;
  readonly content: string;
  readonly source?: string;
}

export class SkillsRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findByNameStmt: Database.Statement;
  private readonly listEnabledStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;
  private readonly setEnabledStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO skills (name, description, triggers_json, content, source, installed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description, triggers_json = excluded.triggers_json,
        content = excluded.content, source = excluded.source
    `);
    this.findByNameStmt = db.prepare('SELECT * FROM skills WHERE name = ?');
    this.listEnabledStmt = db.prepare('SELECT * FROM skills WHERE enabled = 1 ORDER BY name');
    this.listAllStmt = db.prepare('SELECT * FROM skills ORDER BY name');
    this.setEnabledStmt = db.prepare('UPDATE skills SET enabled = ? WHERE name = ?');
    this.deleteStmt = db.prepare('DELETE FROM skills WHERE name = ?');
  }

  upsert(skill: InsertSkill): void {
    this.upsertStmt.run(
      skill.name, skill.description ?? null,
      skill.triggersJson ?? null, skill.content,
      skill.source ?? 'local', nowISO(),
    );
  }

  findByName(name: string): SkillRow | undefined {
    return this.findByNameStmt.get(name) as SkillRow | undefined;
  }

  listEnabled(): readonly SkillRow[] {
    return this.listEnabledStmt.all() as SkillRow[];
  }

  listAll(): readonly SkillRow[] {
    return this.listAllStmt.all() as SkillRow[];
  }

  setEnabled(name: string, enabled: boolean): void {
    this.setEnabledStmt.run(enabled ? 1 : 0, name);
  }

  delete(name: string): boolean {
    return this.deleteStmt.run(name).changes > 0;
  }
}
