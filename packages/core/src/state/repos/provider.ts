/**
 * Provider config repository — manage LLM provider configurations.
 */
import type Database from 'better-sqlite3';
import { nowISO } from '../database.js';

export interface ProviderConfigRow {
  readonly name: string;
  readonly auth_type: string;
  readonly endpoint: string | null;
  readonly api_key: string | null;
  readonly enabled: number;
  readonly priority: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UpsertProviderConfig {
  readonly name: string;
  readonly authType: string;
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly enabled?: boolean;
  readonly priority?: number;
}

export class ProviderConfigRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly findByNameStmt: Database.Statement;
  private readonly listEnabledStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;
  private readonly setEnabledStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    const now = nowISO();
    this.upsertStmt = db.prepare(`
      INSERT INTO provider_config (name, auth_type, endpoint, api_key, enabled, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        auth_type = excluded.auth_type, endpoint = excluded.endpoint,
        api_key = excluded.api_key, enabled = excluded.enabled,
        priority = excluded.priority, updated_at = excluded.updated_at
    `);
    this.findByNameStmt = db.prepare('SELECT * FROM provider_config WHERE name = ?');
    this.listEnabledStmt = db.prepare('SELECT * FROM provider_config WHERE enabled = 1 ORDER BY priority ASC');
    this.listAllStmt = db.prepare('SELECT * FROM provider_config ORDER BY priority ASC');
    this.setEnabledStmt = db.prepare('UPDATE provider_config SET enabled = ?, updated_at = ? WHERE name = ?');
    this.deleteStmt = db.prepare('DELETE FROM provider_config WHERE name = ?');
  }

  upsert(config: UpsertProviderConfig): void {
    const now = nowISO();
    this.upsertStmt.run(
      config.name, config.authType,
      config.endpoint ?? null, config.apiKey ?? null,
      config.enabled !== false ? 1 : 0,
      config.priority ?? 100, now, now,
    );
  }

  findByName(name: string): ProviderConfigRow | undefined {
    return this.findByNameStmt.get(name) as ProviderConfigRow | undefined;
  }

  listEnabled(): readonly ProviderConfigRow[] {
    return this.listEnabledStmt.all() as ProviderConfigRow[];
  }

  listAll(): readonly ProviderConfigRow[] {
    return this.listAllStmt.all() as ProviderConfigRow[];
  }

  setEnabled(name: string, enabled: boolean): void {
    this.setEnabledStmt.run(enabled ? 1 : 0, nowISO(), name);
  }

  delete(name: string): boolean {
    return this.deleteStmt.run(name).changes > 0;
  }
}
